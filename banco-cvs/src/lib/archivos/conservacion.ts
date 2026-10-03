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

/** «Expira en X h» para los pendientes de revisión: el CV se elimina por el plazo de conservación. */
export function tiempoRestante(seElimina: Date, ahora: number = Date.now()) {
  const horas = (seElimina.getTime() - ahora) / 3_600_000;
  // Ya venció: la purga corre cada hora, así que se eliminará en la siguiente vuelta.
  if (horas <= 0) return "Se eliminará en la próxima revisión automática";
  if (horas <= 1) return "Expira en menos de 1 h: revísalo ya";
  return `Expira en ${Math.floor(horas)} h si no se revisa`;
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
    await olvidarCvs(tx, [...ids], "PLAZO");
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

/**
 * Borra de storage/ los archivos que ya no tienen un CV en la base de datos.
 * Solo barre si al menos un archivo del disco corresponde a un CV de la base: es la prueba de que la carpeta y la
 * base son las mismas. Si no coincide ninguno (p. ej. otro DATABASE_URL u otra STORAGE_DIR), no se borra nada.
 */
export async function barrerHuerfanos(ahora: Date = new Date()) {
  const directorio = directorioAlmacenamiento();
  let nombres: string[];
  try {
    nombres = await readdir(directorio);
  } catch {
    return 0; // aún no existe storage/
  }
  if (nombres.length === 0) return 0;
  const existentes = new Set((await db.cv.findMany({ select: { archivoId: true } })).map((c) => c.archivoId));
  const huerfanos = nombres.filter((nombre) => !existentes.has(nombre));
  if (huerfanos.length === 0) return 0;
  if (huerfanos.length === nombres.length) {
    console.warn(
      "[conservacion] Ningún archivo de la carpeta de CVs corresponde a un CV de la base de datos: no se barrieron " +
        "huérfanos. Revisa que DATABASE_URL y STORAGE_DIR apunten a la misma instalación.",
    );
    return 0;
  }
  let borrados = 0;
  for (const nombre of huerfanos) {
    try {
      const info = await stat(path.join(directorio, nombre));
      if (ahora.getTime() - info.mtimeMs < GRACIA_HUERFANOS_MS) continue;
      await eliminarArchivo(nombre); // solo acepta nombres UUID: nada fuera de los CVs
      borrados += 1;
    } catch {
      // Nombre que no es un UUID o error de disco: se ignora.
    }
  }
  return borrados;
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
