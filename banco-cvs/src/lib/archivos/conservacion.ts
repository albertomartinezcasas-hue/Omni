import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { registrarEvento } from "@/lib/bitacora";
import { db } from "@/lib/db";
import { directorioAlmacenamiento, eliminarArchivo, esIdDeArchivo } from "./almacenamiento";
import { olvidarCvs } from "./olvido";

// Plazo de conservación de CVs (aviso de privacidad): se eliminan, con sus análisis y ajustes, al cumplirse
// CONSERVACION_DIAS desde su última actividad (subida o análisis más reciente). Por defecto, 1 día.

export const CONSERVACION_DIAS_POR_DEFECTO = 1;
const CADA_MS = 60 * 60 * 1000; // revisión cada hora
const DIA_MS = 24 * 60 * 60 * 1000;
// Un archivo sin registro solo se borra si es más antiguo que el plazo más este margen: un CV legítimo nunca pasa del
// plazo sin actividad, así que una copia vieja de la base no puede llevarse los CVs recientes.
const MARGEN_HUERFANOS_MS = 2 * 60 * 60 * 1000;

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

/** Aviso para los pendientes de revisión: revisarlo no evita que se borre; solo una subida o un análisis nuevo lo extienden. */
export function tiempoRestante(seElimina: Date, ahora: number = Date.now()) {
  const horas = (seElimina.getTime() - ahora) / 3_600_000;
  // Ya venció: la purga corre cada hora, así que se eliminará en la siguiente vuelta.
  if (horas <= 0) return "Plazo vencido: se eliminará en menos de 1 hora";
  return `Se eliminará en ${horas < 1 ? "menos de 1" : Math.floor(horas)} h: decide antes`;
}

export type ResultadoPurga = { cvs: number; huerfanos: number };

/**
 * Elimina los CVs vencidos, sus archivos y los archivos huérfanos. Devuelve cuántos CVs y huérfanos eliminó.
 * La bitácora registra las cantidades y los ids de los CVs (no son datos personales): ni nombres de candidatos ni de archivos.
 */
export async function purgarCvsVencidos(
  ahora: Date = new Date(),
  dias: number | null = diasDeConservacion(),
): Promise<ResultadoPurga> {
  if (dias === null) {
    console.error("[conservacion] CONSERVACION_DIAS no es un entero mayor o igual a 1: no se purgó nada.");
    return { cvs: 0, huerfanos: 0 };
  }
  const limite = new Date(ahora.getTime() - dias * DIA_MS);
  const vencido = { creadoEn: { lt: limite }, analisis: { none: { creadoEn: { gte: limite } } } };

  const { eliminados, huerfanos } = await db.$transaction(async (tx) => {
    // El barrido se planea con la base ANTES de borrar: los archivos de los CVs vencidos cuentan como coincidencias,
    // así que se reconocen aunque esta misma purga deje la base vacía.
    const enBase = new Set((await tx.cv.findMany({ select: { archivoId: true } })).map((c) => c.archivoId));
    const huerfanos = await planearBarrido(enBase, ahora, dias);

    const lista = await tx.cv.findMany({ where: vencido, select: { id: true, archivoId: true } });
    let borrados: typeof lista = [];
    if (lista.length > 0) {
      // La condición se repite al borrar: un CV analizado entre la consulta y el borrado se conserva.
      const confirmados = await tx.cv.findMany({ where: { id: { in: lista.map((c) => c.id) }, ...vencido }, select: { id: true } });
      const ids = new Set(confirmados.map((c) => c.id));
      borrados = lista.filter((c) => ids.has(c.id));
    }
    if (borrados.length > 0) {
      const ids = borrados.map((c) => c.id);
      // Antes de borrar: historial con seudónimos y bitácora sin datos del candidato.
      await olvidarCvs(tx, ids, "PLAZO");
      await tx.cv.deleteMany({ where: { id: { in: ids } } });
    }
    if (borrados.length > 0 || huerfanos.length > 0) {
      await registrarEvento(
        {
          actor: null,
          sistema: true,
          accion: "CV_ELIMINADO_POR_PLAZO",
          entidadTipo: "CV",
          detalle: { cantidad: borrados.length, plazoDias: dias, ids: borrados.map((c) => c.id), huerfanos: huerfanos.length },
        },
        tx,
      );
    }
    return { eliminados: borrados, huerfanos };
  });

  // Los análisis y ajustes se eliminaron en cascada; ahora los archivos. Un fallo no detiene a los demás.
  for (const cv of eliminados) {
    try {
      await eliminarArchivo(cv.archivoId);
    } catch {
      console.error("[conservacion] No se pudo borrar un archivo; se reintentará en el barrido de huérfanos.");
    }
  }
  let huerfanosBorrados = 0;
  for (const nombre of huerfanos) {
    try {
      await eliminarArchivo(nombre); // solo acepta nombres UUID: nada fuera de los CVs
      huerfanosBorrados += 1;
    } catch {
      // Error de disco: se reintenta en la siguiente vuelta.
    }
  }
  if (eliminados.length > 0 || huerfanosBorrados > 0) {
    console.info(
      `[conservacion] Se eliminaron ${eliminados.length} CV(s) vencidos (plazo: ${dias} día(s)) y ${huerfanosBorrados} archivo(s) huérfano(s).`,
    );
  }
  return { cvs: eliminados.length, huerfanos: huerfanosBorrados };
}

/**
 * Archivos de la carpeta de CVs que ya no tienen un CV en la base y se pueden borrar. Por seguridad:
 * - la mayoría (más del 50 %) de los archivos debe corresponder a CVs de la base: prueba de que carpeta y base son
 *   la misma instalación (no otro DATABASE_URL, otra STORAGE_DIR ni una copia vieja de la base);
 * - solo cuentan los archivos más antiguos que el plazo de conservación más 2 h.
 */
export async function planearBarrido(enBase: Set<string>, ahora: Date, dias: number): Promise<string[]> {
  const directorio = directorioAlmacenamiento();
  let nombres: string[];
  try {
    nombres = (await readdir(directorio)).filter(esIdDeArchivo);
  } catch {
    return []; // aún no existe storage/
  }
  const sinRegistro = nombres.filter((nombre) => !enBase.has(nombre));
  if (sinRegistro.length === 0) return [];
  const coinciden = nombres.length - sinRegistro.length;
  if (coinciden * 2 <= nombres.length) {
    console.warn(
      `[conservacion] Solo ${coinciden} de ${nombres.length} archivos de la carpeta de CVs corresponden a la base de ` +
        "datos: no se barrieron huérfanos. Revisa que DATABASE_URL y STORAGE_DIR apunten a la misma instalación.",
    );
    return [];
  }
  const antiguedadMinima = dias * DIA_MS + MARGEN_HUERFANOS_MS;
  const huerfanos: string[] = [];
  for (const nombre of sinRegistro) {
    try {
      const info = await stat(path.join(directorio, nombre));
      if (ahora.getTime() - info.mtimeMs > antiguedadMinima) huerfanos.push(nombre);
    } catch {
      // Error de disco: se ignora.
    }
  }
  return huerfanos;
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
