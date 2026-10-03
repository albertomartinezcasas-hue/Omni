// Respaldos en dos niveles (ver DESPLIEGUE.md):
// - Completo: base de datos y archivos de CVs. Contiene datos de candidatos, así que por defecto se conserva el mismo
//   plazo que los CVs (RESPALDO_DIAS).
// - Permanente: solo la base, SIN datos de candidatos (se borran CVs, análisis y ajustes). Conserva lo que no vence:
//   historial, vacantes, usuarios, bitácora y umbrales. Por defecto, 30 días (RESPALDO_PERMANENTE_DIAS).
// El historial y la bitácora ya no guardan datos del candidato, así que pueden conservarse más tiempo.
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { directorioAlmacenamiento } from "@/lib/archivos/almacenamiento";
import { olvidarCvs } from "@/lib/archivos/olvido";
import { crearClienteDb, db } from "@/lib/db";

const DIA_MS = 24 * 60 * 60 * 1000;
// Con un cron diario, el respaldo de ayer tiene unas 23 h 59 min: sin margen sobreviviría un día de más.
const MARGEN_ROTACION_MS = 60 * 60 * 1000;
export const RESPALDO_PERMANENTE_DIAS_POR_DEFECTO = 30;
const ARCHIVO_BASE = "banco.db";

export type OpcionesRespaldo = { destino: string; diasCompleto: number; diasPermanente: number; ahora?: Date };

/** VACUUM INTO a una ruta generada por el script (sin comillas: SQLite no admite parámetros aquí). */
async function copiarBase(archivo: string) {
  if (archivo.includes("'")) throw new Error("La ruta de respaldo no puede contener comillas simples.");
  await db.$executeRawUnsafe(`VACUUM INTO '${archivo}'`);
}

/**
 * Respaldo permanente en `carpeta`: copia de la base sin datos de candidatos (borra ajustes, análisis y CVs, y
 * compacta para no dejar restos). Es atómico: se trabaja sobre `banco.db.tmp` y solo se renombra a `banco.db` si el
 * borrado se verificó. Ante cualquier error se borra la carpeta completa (para que no sobreviva una copia con CVs)
 * y se propaga el error.
 */
export async function crearRespaldoPermanente(carpeta: string) {
  const temporal = path.join(carpeta, "banco.db.tmp");
  try {
    await mkdir(carpeta, { recursive: true, mode: 0o700 });
    await copiarBase(temporal);
    const copia = crearClienteDb(`file:${temporal}`);
    try {
      // Como al eliminar un CV: su historial pasa a seudónimo (sin id de análisis y con fechas redondeadas al día).
      const cvs = await copia.cv.findMany({ select: { id: true } });
      await copia.$transaction((tx) => olvidarCvs(tx, cvs.map((c) => c.id), "RESPALDO"), { timeout: 120_000 });
      await copia.ajusteCategoria.deleteMany();
      await copia.analisis.deleteMany();
      await copia.cv.deleteMany();
      const restantes = (await copia.cv.count()) + (await copia.analisis.count()) + (await copia.ajusteCategoria.count());
      if (restantes !== 0) throw new Error("El respaldo permanente aún tiene datos de candidatos.");
      // VACUUM reescribe el archivo: las páginas libres (con el texto de los CVs borrados) no quedan en el respaldo.
      await copia.$executeRawUnsafe("VACUUM");
    } finally {
      await copia.$disconnect();
    }
    await rename(temporal, path.join(carpeta, ARCHIVO_BASE));
  } catch (error) {
    await rm(carpeta, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Borra las carpetas `prefijo-*` más antiguas que `dias` (con 1 h de margen). Devuelve cuántas borró.
 * Una carpeta sin `banco.db` es un respaldo incompleto (p. ej. si el proceso murió a la mitad): se borra siempre,
 * porque podría tener una copia a medio limpiar.
 */
async function rotar(destino: string, prefijo: string, dias: number, ahora: Date, actual: string) {
  let borrados = 0;
  for (const nombre of await readdir(destino)) {
    if (!nombre.startsWith(`${prefijo}-`) || nombre === actual) continue;
    const ruta = path.join(destino, nombre);
    const antiguedad = ahora.getTime() - (await stat(ruta)).mtimeMs;
    const vencido = antiguedad > dias * DIA_MS - MARGEN_ROTACION_MS;
    // Incompleta y reciente (menos de 1 h): puede ser otro respaldo en curso (cron y manual a la vez); no se toca.
    const incompleta = !existsSync(path.join(ruta, ARCHIVO_BASE)) && antiguedad > MARGEN_ROTACION_MS;
    if (vencido || incompleta) {
      await rm(ruta, { recursive: true, force: true });
      borrados += 1;
    }
  }
  return borrados;
}

/** Crea los dos respaldos y rota los antiguos. Devuelve las carpetas creadas y cuántos respaldos viejos borró. */
export async function crearRespaldos({ destino, diasCompleto, diasPermanente, ahora = new Date() }: OpcionesRespaldo) {
  const sello = ahora.toISOString().replace(/[:.]/g, "-");
  await mkdir(destino, { recursive: true, mode: 0o700 });

  // Completo: base + CVs (copia consistente de SQLite aunque la app esté escribiendo).
  const completo = path.join(destino, `respaldo-${sello}`);
  await mkdir(completo, { recursive: true, mode: 0o700 });
  await copiarBase(path.join(completo, ARCHIVO_BASE));
  try {
    await cp(directorioAlmacenamiento(), path.join(completo, "storage"), { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  // Permanente: solo la base, sin datos de candidatos.
  const permanente = path.join(destino, `permanente-${sello}`);
  await crearRespaldoPermanente(permanente);

  const borradosCompletos = await rotar(destino, "respaldo", diasCompleto, ahora, path.basename(completo));
  const borradosPermanentes = await rotar(destino, "permanente", diasPermanente, ahora, path.basename(permanente));
  return { completo, permanente, borradosCompletos, borradosPermanentes };
}

/** Días de un nivel de respaldo: entero ≥ 1 o null si el valor no es válido. */
export function diasDeRespaldo(valor: string | undefined, porDefecto: number): number | null {
  if (valor === undefined || valor.trim() === "") return porDefecto;
  return /^[1-9]\d*$/.test(valor.trim()) ? Number(valor.trim()) : null;
}
