import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { subirCv } from "@/lib/archivos/servicio";
import { crearClienteDb, db } from "@/lib/db";
import { crearRespaldos, diasDeRespaldo } from "@/lib/respaldo";
import { crearPdf, crearUsuario, textoCv } from "./ayuda";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
let usuario: Awaited<ReturnType<typeof crearUsuario>>;
let cv: Awaited<ReturnType<typeof db.cv.findUniqueOrThrow>>;

beforeAll(async () => {
  usuario = await crearUsuario({ rol: "ADMIN" });
  const r = await subirCv(usuario, {
    nombreArchivo: "Candidata Xochiquetzalli.pdf",
    contenido: crearPdf([...textoCv("Xochiquetzalli Ficticia", "xochiquetzalli@correo-ficticio.mx"), "Marcador ZZQXUNICO de prueba."]),
    forzar: true,
  });
  if (r.estado !== "GUARDADO") throw new Error("no se guardó");
  cv = await db.cv.findUniqueOrThrow({ where: { id: r.id } });
  await db.registroAnalisis.create({
    data: {
      cvId: cv.id, vacanteId: "v1", vacanteTitulo: "Analista", area: "Datos", veredicto: "VIABLE", puntaje: 80,
      categoria: "BUENO", categoriaFinal: "BUENO", modelo: "groq:m", usuarioId: usuario.id, usuarioNombre: usuario.nombre,
    },
  });
});

/** Respaldo `nombre` (con su banco.db, salvo `incompleto`) y fecha de modificación de hace `antiguedad` ms. */
function carpetaVieja(destino: string, nombre: string, antiguedad: number, incompleto = false) {
  const ruta = path.join(destino, nombre);
  mkdirSync(ruta, { recursive: true });
  if (!incompleto) writeFileSync(path.join(ruta, "banco.db"), "x");
  const fecha = new Date(Date.now() - antiguedad);
  utimesSync(ruta, fecha, fecha);
  return ruta;
}

describe("Respaldos en dos niveles", () => {
  it("el completo tiene la base y los CVs; el permanente conserva lo demás sin datos de candidatos", async () => {
    const destino = mkdtempSync(path.join(tmpdir(), "banco-cvs-respaldos-"));
    const r = await crearRespaldos({ destino, diasCompleto: 1, diasPermanente: 30 });

    const completo = crearClienteDb(`file:${path.join(r.completo, "banco.db")}`);
    try {
      expect(await completo.cv.count({ where: { id: cv.id } })).toBe(1);
    } finally {
      await completo.$disconnect();
    }
    expect(existsSync(path.join(r.completo, "storage", cv.archivoId))).toBe(true);

    const archivoPermanente = path.join(r.permanente, "banco.db");
    const permanente = crearClienteDb(`file:${archivoPermanente}`);
    try {
      expect(await permanente.cv.count()).toBe(0);
      expect(await permanente.analisis.count()).toBe(0);
      expect(await permanente.ajusteCategoria.count()).toBe(0);
      expect(await permanente.usuario.count({ where: { id: usuario.id } })).toBe(1);
      expect(await permanente.registroAnalisis.count()).toBeGreaterThan(0);
      expect(await permanente.registroAnalisis.count({ where: { cvId: cv.id } })).toBe(0); // pasó a seudónimo
      expect(await permanente.eventoBitacora.count()).toBeGreaterThan(0);
    } finally {
      await permanente.$disconnect();
    }
    expect(readdirSync(r.permanente)).toEqual(["banco.db"]); // sin carpeta storage/ ni banco.db.tmp
    // Tras el VACUUM no quedan restos del CV en páginas libres del archivo.
    const bytes = readFileSync(archivoPermanente);
    expect(bytes.includes("ZZQXUNICO")).toBe(false);
    expect(bytes.includes("Xochiquetzalli")).toBe(false);
  });

  it("rota cada nivel con su plazo y 1 h de margen (el respaldo de ayer no sobrevive un día extra)", async () => {
    const destino = mkdtempSync(path.join(tmpdir(), "banco-cvs-rotacion-"));
    const ayer = carpetaVieja(destino, "respaldo-ayer", 23.5 * HORA);
    const hoy = carpetaVieja(destino, "respaldo-hoy", 20 * HORA);
    const permanenteReciente = carpetaVieja(destino, "permanente-reciente", 10 * DIA);
    const permanenteVencido = carpetaVieja(destino, "permanente-vencido", 30 * DIA);
    const ajeno = carpetaVieja(destino, "otra-cosa", 90 * DIA);
    const r = await crearRespaldos({ destino, diasCompleto: 1, diasPermanente: 30 });
    expect(r).toMatchObject({ borradosCompletos: 1, borradosPermanentes: 1 });
    expect(existsSync(ayer)).toBe(false);
    expect(existsSync(hoy)).toBe(true);
    expect(existsSync(permanenteReciente)).toBe(true);
    expect(existsSync(permanenteVencido)).toBe(false);
    expect(existsSync(ajeno)).toBe(true);
    expect(existsSync(r.completo) && existsSync(r.permanente)).toBe(true);
  });

  it("si el respaldo permanente falla a la mitad, no deja la copia con CVs y propaga el error", async () => {
    const destino = mkdtempSync(path.join(tmpdir(), "banco-cvs-fallo-"));
    const ahora = new Date("2026-05-01T10:00:00.000Z");
    const permanente = path.join(destino, `permanente-${ahora.toISOString().replace(/[:.]/g, "-")}`);
    // Un directorio no vacío llamado banco.db hace fallar el renombrado final (después de VACUUM INTO y del borrado).
    mkdirSync(path.join(permanente, "banco.db", "ocupado"), { recursive: true });
    await expect(crearRespaldos({ destino, diasCompleto: 1, diasPermanente: 30, ahora })).rejects.toThrow();
    expect(existsSync(permanente)).toBe(false);
    expect(readdirSync(destino).filter((n) => n.startsWith("permanente-"))).toEqual([]);
  });

  it("la rotación borra las carpetas incompletas (sin banco.db) de más de 1 h; respeta las de un respaldo en curso", async () => {
    const destino = mkdtempSync(path.join(tmpdir(), "banco-cvs-incompleto-"));
    const incompleta = carpetaVieja(destino, "permanente-incompleta", 2 * HORA, true);
    writeFileSync(path.join(incompleta, "banco.db.tmp"), "copia a medio limpiar");
    const hace2h = new Date(Date.now() - 2 * HORA);
    utimesSync(incompleta, hace2h, hace2h); // escribir el archivo actualiza la fecha de la carpeta
    const enCurso = carpetaVieja(destino, "permanente-en-curso", 0.1 * HORA, true);
    const completa = carpetaVieja(destino, "permanente-completa", 1 * HORA);
    await crearRespaldos({ destino, diasCompleto: 1, diasPermanente: 30 });
    expect(existsSync(incompleta)).toBe(false);
    expect(existsSync(enCurso)).toBe(true);
    expect(existsSync(completa)).toBe(true);
  });

  it("valida los días de cada nivel", () => {
    expect(diasDeRespaldo(undefined, 30)).toBe(30);
    expect(diasDeRespaldo("7", 30)).toBe(7);
    for (const malo of ["0", "-1", "1.5", "7d"]) expect(diasDeRespaldo(malo, 30)).toBeNull();
  });
});
