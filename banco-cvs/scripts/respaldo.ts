// Respaldo en caliente de la base de datos y de los archivos de CVs: npm run respaldo
// Pensado para un cron diario (ver DESPLIEGUE.md). Usa VACUUM INTO de SQLite: copia consistente sin detener la app.
//
// Privacidad: los respaldos contienen CVs. Por defecto se conservan los mismos días que CONSERVACION_DIAS
// (RESPALDO_DIAS lo cambia), para no guardar CVs más tiempo del que promete el aviso de privacidad.
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { directorioAlmacenamiento } from "../src/lib/archivos/almacenamiento";
import { diasDeConservacion } from "../src/lib/archivos/conservacion";
import { db } from "../src/lib/db";

const DIA_MS = 24 * 60 * 60 * 1000;

async function principal() {
  const dias = Number(process.env.RESPALDO_DIAS ?? diasDeConservacion() ?? 1);
  if (!Number.isInteger(dias) || dias < 1) {
    console.error("Error: RESPALDO_DIAS debe ser un entero mayor o igual a 1.");
    return 1;
  }
  const destino = path.resolve(process.env.RESPALDO_DIR ?? "./respaldos");
  const sello = new Date().toISOString().replace(/[:.]/g, "-");
  const carpeta = path.join(destino, `respaldo-${sello}`);
  await mkdir(carpeta, { recursive: true, mode: 0o700 });

  // Copia consistente de SQLite aunque la app esté escribiendo. La ruta la genera el script (sin comillas).
  const archivoDb = path.join(carpeta, "banco.db");
  if (archivoDb.includes("'")) throw new Error("La ruta de respaldo no puede contener comillas simples.");
  await db.$executeRawUnsafe(`VACUUM INTO '${archivoDb}'`);
  await db.$disconnect();

  const storage = directorioAlmacenamiento(); // STORAGE_DIR o ./storage, igual que la app
  try {
    await cp(storage, path.join(carpeta, "storage"), { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  // Rotación: se borran los respaldos más antiguos que el plazo.
  let borrados = 0;
  for (const nombre of await readdir(destino)) {
    if (!nombre.startsWith("respaldo-") || nombre === path.basename(carpeta)) continue;
    const ruta = path.join(destino, nombre);
    if (Date.now() - (await stat(ruta)).mtimeMs > dias * DIA_MS) {
      await rm(ruta, { recursive: true, force: true });
      borrados += 1;
    }
  }
  console.log(`Respaldo creado en ${carpeta}. Respaldos antiguos eliminados: ${borrados} (se conservan ${dias} día(s)).`);
  return 0;
}

principal().then(
  (codigo) => process.exit(codigo),
  (error) => {
    console.error(`Error al respaldar: ${error instanceof Error ? error.message : "desconocido"}`);
    process.exit(1);
  },
);
