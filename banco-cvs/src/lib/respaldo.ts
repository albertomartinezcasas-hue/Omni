// Respaldos en dos niveles (ver DESPLIEGUE.md):
// - Completo: base de datos y archivos de CVs. Contiene datos de candidatos, así que por defecto se conserva el mismo
//   plazo que los CVs (RESPALDO_DIAS).
// - Permanente: solo la base, SIN datos de candidatos (se borran CVs, análisis y ajustes). Conserva lo que no vence:
//   historial, vacantes, usuarios, bitácora y umbrales. Por defecto, 30 días (RESPALDO_PERMANENTE_DIAS).
// El historial y la bitácora ya no guardan datos del candidato, así que pueden conservarse más tiempo.
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { directorioAlmacenamiento } from "@/lib/archivos/almacenamiento";
import { olvidarCvs } from "@/lib/archivos/olvido";
import { crearClienteDb, db } from "@/lib/db";

const DIA_MS = 24 * 60 * 60 * 1000;
// Con un cron diario, el respaldo de ayer tiene unas 23 h 59 min: sin margen sobreviviría un día de más.
const MARGEN_ROTACION_MS = 60 * 60 * 1000;
export const RESPALDO_PERMANENTE_DIAS_POR_DEFECTO = 30;

export type OpcionesRespaldo = { destino: string; diasCompleto: number; diasPermanente: number; ahora?: Date };

/** VACUUM INTO a una ruta generada por el script (sin comillas: SQLite no admite parámetros aquí). */
async function copiarBase(archivo: string) {
  if (archivo.includes("'")) throw new Error("La ruta de respaldo no puede contener comillas simples.");
  await db.$executeRawUnsafe(`VACUUM INTO '${archivo}'`);
}

/** Copia de la base sin datos de candidatos: borra ajustes, análisis y CVs, y compacta para no dejar restos. */
export async function crearRespaldoPermanente(archivo: string) {
  await copiarBase(archivo);
  const copia = crearClienteDb(`file:${archivo}`);
  try {
    // Como al eliminar un CV: su historial pasa a seudónimo (sin id de análisis y con fechas redondeadas al día).
    const cvs = await copia.cv.findMany({ select: { id: true } });
    await copia.$transaction((tx) => olvidarCvs(tx, cvs.map((c) => c.id), "MANUAL"), { timeout: 120_000 });
    await copia.ajusteCategoria.deleteMany();
    await copia.analisis.deleteMany();
    await copia.cv.deleteMany();
    // VACUUM reescribe el archivo: las páginas libres (con el texto de los CVs borrados) no quedan en el respaldo.
    await copia.$executeRawUnsafe("VACUUM");
  } finally {
    await copia.$disconnect();
  }
}

/** Borra las carpetas `prefijo-*` más antiguas que `dias` (con 1 h de margen). Devuelve cuántas borró. */
async function rotar(destino: string, prefijo: string, dias: number, ahora: Date, actual: string) {
  let borrados = 0;
  for (const nombre of await readdir(destino)) {
    if (!nombre.startsWith(`${prefijo}-`) || nombre === actual) continue;
    const ruta = path.join(destino, nombre);
    if (ahora.getTime() - (await stat(ruta)).mtimeMs > dias * DIA_MS - MARGEN_ROTACION_MS) {
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
  await copiarBase(path.join(completo, "banco.db"));
  try {
    await cp(directorioAlmacenamiento(), path.join(completo, "storage"), { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  // Permanente: solo la base, sin datos de candidatos.
  const permanente = path.join(destino, `permanente-${sello}`);
  await mkdir(permanente, { recursive: true, mode: 0o700 });
  await crearRespaldoPermanente(path.join(permanente, "banco.db"));

  const borradosCompletos = await rotar(destino, "respaldo", diasCompleto, ahora, path.basename(completo));
  const borradosPermanentes = await rotar(destino, "permanente", diasPermanente, ahora, path.basename(permanente));
  return { completo, permanente, borradosCompletos, borradosPermanentes };
}

/** Días de un nivel de respaldo: entero ≥ 1 o null si el valor no es válido. */
export function diasDeRespaldo(valor: string | undefined, porDefecto: number): number | null {
  if (valor === undefined || valor.trim() === "") return porDefecto;
  return /^[1-9]\d*$/.test(valor.trim()) ? Number(valor.trim()) : null;
}
