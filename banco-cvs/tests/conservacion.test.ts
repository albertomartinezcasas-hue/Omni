import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { utimesSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { analizarCvAccion } from "@/acciones/analisis";
import { marcarOposicionIAAccion } from "@/acciones/cvs";
import { diasDeConservacion, purgarCvsVencidos, tiempoRestante } from "@/lib/archivos/conservacion";
import { directorioAlmacenamiento } from "@/lib/archivos/almacenamiento";
import { subirCv } from "@/lib/archivos/servicio";
import { db } from "@/lib/db";
import { crearPdf, crearUsuario, simularSesion, textoCv } from "./ayuda";

let usuario: Awaited<ReturnType<typeof crearUsuario>>;
const HORA = 60 * 60 * 1000;

beforeAll(async () => {
  usuario = await crearUsuario();
});

async function cvDePrueba(nombre: string) {
  const r = await subirCv(usuario, { nombreArchivo: `${nombre}.pdf`, contenido: crearPdf(textoCv(nombre, `${nombre.toLowerCase()}@correo.mx`)), forzar: true });
  if (r.estado !== "GUARDADO") throw new Error("no se guardó");
  return db.cv.findUniqueOrThrow({ where: { id: r.id } });
}

describe("Plazo de conservación", () => {
  it("por defecto es 1 día; CONSERVACION_DIAS lo cambia", () => {
    expect(diasDeConservacion({})).toBe(1);
    expect(diasDeConservacion({ CONSERVACION_DIAS: "30" })).toBe(30);
    // Valores inválidos no caen al valor por defecto en silencio: la purga no se ejecuta.
    for (const malo of ["no", "0", "-3", "0.001", "7d"]) expect(diasDeConservacion({ CONSERVACION_DIAS: malo })).toBeNull();
  });

  it("con un plazo inválido no borra nada", async () => {
    const cv = await cvDePrueba("Invalido");
    await db.cv.update({ where: { id: cv.id }, data: { creadoEn: new Date(Date.now() - 100 * 24 * HORA) } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await purgarCvsVencidos(new Date(), null)).toEqual({ cvs: 0, huerfanos: 0 });
    expect(await db.cv.findUnique({ where: { id: cv.id } })).not.toBeNull();
    await db.cv.update({ where: { id: cv.id }, data: { creadoEn: new Date() } });
  });

  it("elimina los CVs vencidos (con su archivo) y conserva los recientes; la bitácora no guarda nombres", async () => {
    const viejo = await cvDePrueba("Viejo");
    const reciente = await cvDePrueba("Reciente");
    await db.cv.update({ where: { id: viejo.id }, data: { creadoEn: new Date(Date.now() - 25 * HORA) } });
    const archivoViejo = path.join(directorioAlmacenamiento(), viejo.archivoId);
    expect(existsSync(archivoViejo)).toBe(true);

    expect(await purgarCvsVencidos(new Date(), 1)).toMatchObject({ cvs: 1 });
    expect(await db.cv.findUnique({ where: { id: viejo.id } })).toBeNull();
    expect(await db.cv.findUnique({ where: { id: reciente.id } })).not.toBeNull();
    expect(existsSync(archivoViejo)).toBe(false);

    const evento = await db.eventoBitacora.findFirstOrThrow({ where: { accion: "CV_ELIMINADO_POR_PLAZO" } });
    expect(evento.actorNombre).toBe("Sistema");
    expect(JSON.parse(evento.detalle!)).toEqual({ cantidad: 1, plazoDias: 1, ids: [viejo.id], huerfanos: 0 });
    expect(evento.detalle).not.toContain("Viejo");
  });

  it("un análisis reciente cuenta como actividad: el CV no se elimina", async () => {
    const cv = await cvDePrueba("Activo");
    await db.cv.update({ where: { id: cv.id }, data: { creadoEn: new Date(Date.now() - 48 * HORA) } });
    const vacante = await db.vacante.create({
      data: {
        titulo: "Analista", area: "Datos", descripcion: "x", requisitosObligatorios: "[]", requisitosDeseables: "[]",
        aniosMinimos: 0, nivelEstudiosMinimo: "NINGUNO", idiomas: "[]", modalidad: "REMOTO", ubicacion: "CDMX",
        creadoPorId: usuario.id, actualizadoPorId: usuario.id,
      },
    });
    await db.analisis.create({
      data: {
        cvId: cv.id, vacanteId: vacante.id, vacanteVersion: 1, vacanteSnapshot: "{}", modelo: "m", creadoPorId: usuario.id,
        veredicto: "VIABLE", motivosNoViable: "[]", puntaje: 80, puntajeO: 80, puntajeE: 80, puntajeF: 80, resultado: "{}",
      },
    });
    await purgarCvsVencidos(new Date(), 1);
    expect(await db.cv.findUnique({ where: { id: cv.id } })).not.toBeNull();
  });
});

describe("Tiempo restante de un pendiente de revisión", () => {
  it("avisa las horas que faltan y, si el plazo ya venció, que se eliminará en la próxima revisión", () => {
    const ahora = Date.now();
    expect(tiempoRestante(new Date(ahora + 5.5 * HORA), ahora)).toBe("Se eliminará en 5 h: decide antes");
    expect(tiempoRestante(new Date(ahora + 0.5 * HORA), ahora)).toBe("Se eliminará en menos de 1 h: decide antes");
    expect(tiempoRestante(new Date(ahora - 2 * HORA), ahora)).toBe("Plazo vencido: se eliminará en menos de 1 hora");
    expect(tiempoRestante(new Date(ahora), ahora)).toBe("Plazo vencido: se eliminará en menos de 1 hora");
  });
});

const DIA = 24 * HORA;

/** Archivo con nombre UUID y fecha de modificación de hace `antiguedad` ms. */
function archivoSuelto(carpeta: string, n: number, antiguedad: number) {
  const ruta = path.join(carpeta, `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  writeFileSync(ruta, "x");
  const fecha = new Date(Date.now() - antiguedad);
  utimesSync(ruta, fecha, fecha);
  return ruta;
}

/** Ejecuta `fn` con STORAGE_DIR apuntando a una carpeta temporal nueva. */
async function enOtraCarpeta(fn: (carpeta: string) => Promise<void>) {
  const carpeta = mkdtempSync(path.join(tmpdir(), "banco-cvs-storage-"));
  process.env.STORAGE_DIR = carpeta;
  try {
    await fn(carpeta);
  } finally {
    delete process.env.STORAGE_DIR;
  }
}

describe("Archivos huérfanos", () => {
  it("solo borra los huérfanos más antiguos que el plazo + 2 h y reporta cuántos (también en la bitácora)", async () => {
    await cvDePrueba("Ancla"); // la mayoría de los archivos de storage/ corresponde a la base
    const viejo = archivoSuelto(directorioAlmacenamiento(), 1, 30 * DIA + 3 * HORA);
    const dentroDelMargen = archivoSuelto(directorioAlmacenamiento(), 2, 30 * DIA + 1 * HORA);
    const reciente = archivoSuelto(directorioAlmacenamiento(), 3, 2 * HORA);
    expect(await purgarCvsVencidos(new Date(), 30)).toEqual({ cvs: 0, huerfanos: 1 });
    expect(existsSync(viejo)).toBe(false);
    expect(existsSync(dentroDelMargen)).toBe(true);
    expect(existsSync(reciente)).toBe(true);
    const evento = await db.eventoBitacora.findFirstOrThrow({ where: { accion: "CV_ELIMINADO_POR_PLAZO" }, orderBy: { fecha: "desc" } });
    expect(JSON.parse(evento.detalle!)).toMatchObject({ cantidad: 0, huerfanos: 1 });
  });
});

describe("Carpeta de CVs (STORAGE_DIR)", () => {
  it("por defecto es ./storage; acepta una ruta absoluta o relativa a la carpeta de ejecución", () => {
    expect(directorioAlmacenamiento({})).toBe(path.join(process.cwd(), "storage"));
    expect(directorioAlmacenamiento({ STORAGE_DIR: "  " })).toBe(path.join(process.cwd(), "storage"));
    expect(directorioAlmacenamiento({ STORAGE_DIR: "/srv/cvs" })).toBe(path.resolve("/srv/cvs"));
    expect(directorioAlmacenamiento({ STORAGE_DIR: "otra/carpeta" })).toBe(path.join(process.cwd(), "otra", "carpeta"));
  });

  it("no barre si ningún archivo del disco corresponde a la base (otra base u otra carpeta)", async () => {
    await cvDePrueba("BaseConDatos");
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    await enOtraCarpeta(async (carpeta) => {
      const ajeno = archivoSuelto(carpeta, 10, 40 * DIA);
      expect(await purgarCvsVencidos(new Date(), 1)).toMatchObject({ huerfanos: 0 });
      expect(existsSync(ajeno)).toBe(true);
    });
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("no se barrieron"));
  });

  it("con una copia vieja de la base (la minoría coincide), no borra los CVs reales más recientes", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await enOtraCarpeta(async (carpeta) => {
      const conocido = await cvDePrueba("EnLaCopia"); // el único que la «copia vieja» conoce
      // CVs reales posteriores a la copia: no están en esta base. Aunque fueran antiguos, la mayoría no coincide.
      const reales = [archivoSuelto(carpeta, 20, 3 * DIA), archivoSuelto(carpeta, 21, 3 * DIA)];
      expect(await purgarCvsVencidos(new Date(), 1)).toMatchObject({ huerfanos: 0 });
      for (const r of reales) expect(existsSync(r)).toBe(true);
      expect(existsSync(path.join(carpeta, conocido.archivoId))).toBe(true);
    });
  });

  it("con la mayoría de los archivos en la base, sí barre los huérfanos antiguos de esa carpeta", async () => {
    await enOtraCarpeta(async (carpeta) => {
      const a = await cvDePrueba("Mayoria1");
      const b = await cvDePrueba("Mayoria2");
      const huerfano = archivoSuelto(carpeta, 30, 1 * DIA + 3 * HORA);
      expect(await purgarCvsVencidos(new Date(), 1)).toMatchObject({ huerfanos: 1 });
      expect(existsSync(huerfano)).toBe(false);
      expect(existsSync(path.join(carpeta, a.archivoId))).toBe(true);
      expect(existsSync(path.join(carpeta, b.archivoId))).toBe(true);
    });
  });
});

describe("Oposición al análisis con IA", () => {
  it("se puede registrar al subir y se hereda en los duplicados del mismo candidato", async () => {
    const r1 = await subirCv(usuario, { nombreArchivo: "o.pdf", contenido: crearPdf(textoCv("Olga", "olga@correo.mx")), forzar: true, sinAnalisisIA: true });
    const r2 = await subirCv(usuario, { nombreArchivo: "o2.pdf", contenido: crearPdf(textoCv("Olga", "olga@correo.mx")), forzar: true });
    if (r1.estado !== "GUARDADO" || r2.estado !== "GUARDADO") throw new Error("no se guardó");
    expect((await db.cv.findUniqueOrThrow({ where: { id: r1.id } })).sinAnalisisIA).toBe(true);
    expect((await db.cv.findUniqueOrThrow({ where: { id: r2.id } })).sinAnalisisIA).toBe(true);
  });

  it("bloquea el análisis, queda en la bitácora y se puede retirar", async () => {
    const cv = await cvDePrueba("Opositor");
    const vacante = await db.vacante.findFirstOrThrow();
    await simularSesion(usuario);

    expect((await marcarOposicionIAAccion(cv.id, true)).ok).toBe(true);
    expect((await db.cv.findUniqueOrThrow({ where: { id: cv.id } })).sinAnalisisIA).toBe(true);
    const r = await analizarCvAccion(cv.id, vacante.id);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("se opuso al análisis con IA") });
    expect(await db.eventoBitacora.count({ where: { accion: "CV_OPOSICION_IA", entidadId: cv.id } })).toBe(1);

    expect((await marcarOposicionIAAccion(cv.id, false)).ok).toBe(true);
    expect((await db.cv.findUniqueOrThrow({ where: { id: cv.id } })).sinAnalisisIA).toBe(false);
  });
});

describe("La purga deja la base vacía", () => {
  it("también barre los huérfanos: los archivos de los CVs que acaba de borrar cuentan como coincidencias", async () => {
    await enOtraCarpeta(async (carpeta) => {
      await cvDePrueba("Ultimo1");
      await cvDePrueba("Ultimo2");
      archivoSuelto(carpeta, 40, 1 * DIA + 3 * HORA); // huérfano antiguo
      // Todos los CVs (y sus análisis) vencen: la purga deja la base vacía.
      const hace3Dias = new Date(Date.now() - 3 * DIA);
      await db.analisis.updateMany({ data: { creadoEn: hace3Dias } });
      await db.cv.updateMany({ data: { creadoEn: hace3Dias } });
      const r = await purgarCvsVencidos(new Date(), 1);
      expect(await db.cv.count()).toBe(0);
      expect(r.huerfanos).toBe(1);
      expect(readdirSync(carpeta)).toEqual([]);
    });
  });
});
