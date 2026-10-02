import { existsSync } from "node:fs";
import path from "node:path";
import { utimesSync, writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { analizarCvAccion } from "@/acciones/analisis";
import { marcarOposicionIAAccion } from "@/acciones/cvs";
import { diasDeConservacion, purgarCvsVencidos } from "@/lib/archivos/conservacion";
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
    expect(await purgarCvsVencidos(new Date(), null)).toBe(0);
    expect(await db.cv.findUnique({ where: { id: cv.id } })).not.toBeNull();
    await db.cv.update({ where: { id: cv.id }, data: { creadoEn: new Date() } });
  });

  it("elimina los CVs vencidos (con su archivo) y conserva los recientes; la bitácora no guarda nombres", async () => {
    const viejo = await cvDePrueba("Viejo");
    const reciente = await cvDePrueba("Reciente");
    await db.cv.update({ where: { id: viejo.id }, data: { creadoEn: new Date(Date.now() - 25 * HORA) } });
    const archivoViejo = path.join(directorioAlmacenamiento(), viejo.archivoId);
    expect(existsSync(archivoViejo)).toBe(true);

    expect(await purgarCvsVencidos(new Date(), 1)).toBe(1);
    expect(await db.cv.findUnique({ where: { id: viejo.id } })).toBeNull();
    expect(await db.cv.findUnique({ where: { id: reciente.id } })).not.toBeNull();
    expect(existsSync(archivoViejo)).toBe(false);

    const evento = await db.eventoBitacora.findFirstOrThrow({ where: { accion: "CV_ELIMINADO_POR_PLAZO" } });
    expect(evento.actorNombre).toBe("Sistema");
    expect(JSON.parse(evento.detalle!)).toEqual({ cantidad: 1, plazoDias: 1, ids: [viejo.id] });
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

describe("Archivos huérfanos", () => {
  it("borra de storage/ los archivos sin CV con más de 1 hora; respeta los recientes", async () => {
    await cvDePrueba("Ancla"); // asegura que exista storage/
    const huerfano = path.join(directorioAlmacenamiento(), "00000000-0000-4000-8000-000000000001");
    const reciente = path.join(directorioAlmacenamiento(), "00000000-0000-4000-8000-000000000002");
    writeFileSync(huerfano, "x");
    writeFileSync(reciente, "x");
    const haceDosHoras = new Date(Date.now() - 2 * HORA);
    utimesSync(huerfano, haceDosHoras, haceDosHoras);
    await purgarCvsVencidos(new Date(), 30);
    expect(existsSync(huerfano)).toBe(false);
    expect(existsSync(reciente)).toBe(true);
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
