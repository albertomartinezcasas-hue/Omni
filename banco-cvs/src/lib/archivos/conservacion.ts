import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { registrarEvento } from "@/lib/bitacora";
import { db } from "@/lib/db";
import { directorioAlmacenamiento, eliminarArchivo } from "./almacenamiento";
import { olvidarCvs } from "./olvido";

// Plazo de conservación de CVs (aviso de privacidad): se eliminan, con sus análisis y ajustes, al cumplirse
// CONSERVACION_DIAS desde su última actividad (subida o análisis más reciente). Por defecto, 1 día.

export const CONSERVACION_DIAS_POR_DEFECTO = 1;
const CADA_MS = 60 * 60 * 1000; // revisión cada hora
const DIA_MS = 24 * 60 * 60 * 1000;
// Un archivo sin registro solo se borra si es más antiguo que esto (evita chocar con una subida en curso).
const GRACIA_HUERFANOS_MS = 60 * 60 * 1000;

/**
 * Días de conservación. Sin definir: 1. Si el valor no es un entero ≥ 1 (p. ej. "0.001" o "7d"), devuelve null:
 * la purga no se ejecuta y se registra el error, para no borrar datos de más por un error de configuración.
 */
export function diasDeConservacion(env: Record<string, string | undefined> = process.env): number | null {
  const valor = env.CONSERVACION_DIAS?.trim();
  if (!valor) return CONSERVACION_DIAS_POR_DEFECTO;
  return /^[1-9]\d*$/.test(valor) ? Number(valor) : null;
}

/** Fecha en la que se eliminará un CV según su última actividad. */
export function fechaDeEliminacion(ultimaActividad: Date, dias: number) {
  return new Date(ultimaActividad.getTime() + dias * DIA_MS);
}

/**
 * Elimina los CVs vencidos y sus archivos. Devuelve cuántos eliminó.
 * La bitácora registra la cantidad y los ids (no son datos personales): ni nombres de candidatos ni de archivos.
 */
export async function purgarCvsVencidos(ahora: Date = new Date(), dias: number | null = diasDeConservacion()) {
  if (dias === null) {
    console.error("[conservacion] CONSERVACION_DIAS no es un entero mayor o igual a 1: no se purgó nada.");
    return 0;
  }
  const limite = new Date(ahora.getTime() - dias * DIA_MS);
  const vencido = { creadoEn: { lt: limite }, analisis: { none: { creadoEn: { gte: limite } } } };

  const eliminados = await db.$transaction(async (tx) => {
    const lista = await tx.cv.findMany({ where: vencido, select: { id: true, archivoId: true } });
    if (lista.length === 0) return [];
    // La condición se repite al borrar: un CV analizado entre la consulta y el borrado se conserva.
    const confirmados = await tx.cv.findMany({ where: { id: { in: lista.map((c) => c.id) }, ...vencido }, select: { id: true } });
    const ids = new Set(confirmados.map((c) => c.id));
    const borrados = lista.filter((c) => ids.has(c.id));
    if (borrados.length === 0) return [];
    // Antes de borrar: historial con seudónimos y bitácora sin datos del candidato.
    await olvidarCvs(tx, [...ids]);
    await tx.cv.deleteMany({ where: { id: { in: [...ids] } } });
    if (borrados.length > 0) {
      await registrarEvento(
        {
          actor: null,
          sistema: true,
          accion: "CV_ELIMINADO_POR_PLAZO",
          entidadTipo: "CV",
          detalle: { cantidad: borrados.length, plazoDias: dias, ids: borrados.map((c) => c.id) },
        },
        tx,
      );
    }
    return borrados;
  });

  // Los análisis y ajustes se eliminaron en cascada; ahora los archivos. Un fallo no detiene a los demás.
  for (const cv of eliminados) {
    try {
      await eliminarArchivo(cv.archivoId);
    } catch {
      console.error("[conservacion] No se pudo borrar un archivo; se reintentará en el barrido de huérfanos.");
    }
  }
  await barrerHuerfanos(ahora);
  if (eliminados.length > 0) {
    console.info(`[conservacion] Se eliminaron ${eliminados.length} CV(s) vencidos (plazo: ${dias} día(s)).`);
  }
  return eliminados.length;
}

/** Borra de storage/ los archivos que ya no tienen un CV en la base de datos. */
async function barrerHuerfanos(ahora: Date) {
  let nombres: string[];
  try {
    nombres = await readdir(directorioAlmacenamiento());
  } catch {
    return; // aún no existe storage/
  }
  const existentes = new Set((await db.cv.findMany({ select: { archivoId: true } })).map((c) => c.archivoId));
  // Base vacía con archivos en disco: probablemente DATABASE_URL apunta a otra base. No se barre nada.
  if (existentes.size === 0) return;
  for (const nombre of nombres) {
    if (existentes.has(nombre)) continue;
    try {
      const info = await stat(path.join(directorioAlmacenamiento(), nombre));
      if (ahora.getTime() - info.mtimeMs < GRACIA_HUERFANOS_MS) continue;
      await eliminarArchivo(nombre); // solo acepta nombres UUID: nada fuera de los CVs
    } catch {
      // Nombre que no es un UUID o error de disco: se ignora.
    }
  }
}

let iniciada = false;

/** Purga al arrancar el servidor y después cada hora. Un fallo se registra y se reintenta en la siguiente vuelta. */
export function iniciarPurgaPeriodica() {
  if (iniciada) return;
  iniciada = true;
  const ejecutar = () =>
    purgarCvsVencidos().catch((error) => {
      console.error(`[conservacion] No se pudo purgar: ${error instanceof Error ? error.name : "error"}`);
    });
  void ejecutar();
  setInterval(ejecutar, CADA_MS).unref();
}
