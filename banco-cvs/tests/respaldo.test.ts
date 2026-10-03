import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, utimesSync } from "node:fs";
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

/** Carpeta `nombre` dentro de `destino` con fecha de modificación de hace `antiguedad` ms. */
function carpetaVieja(destino: string, nombre: string, antiguedad: number) {
  const ruta = path.join(destino, nombre);
  mkdirSync(ruta, { recursive: true });
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
    expect(readdirSync(r.permanente)).toEqual(["banco.db"]); // sin carpeta storage/
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

  it("valida los días de cada nivel", () => {
    expect(diasDeRespaldo(undefined, 30)).toBe(30);
    expect(diasDeRespaldo("7", 30)).toBe(7);
    for (const malo of ["0", "-1", "1.5", "7d"]) expect(diasDeRespaldo(malo, 30)).toBeNull();
  });
});
