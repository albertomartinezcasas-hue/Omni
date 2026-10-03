import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Carpeta privada (fuera de /public). Nunca se sirve de forma estática.
 * STORAGE_DIR (opcional) la cambia: ruta absoluta o relativa a la carpeta de ejecución. Por defecto, ./storage.
 */
export function directorioAlmacenamiento(env: Record<string, string | undefined> = process.env) {
  // turbopackIgnore: la carpeta se decide al ejecutar; no debe incluir el proyecto en el rastreo de archivos del build.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), env.STORAGE_DIR?.trim() || "storage");
}

function rutaDe(archivoId: string) {
  // La ruta solo se arma con un UUID validado: no hay forma de salir de la carpeta.
  if (!REGEX_UUID.test(archivoId)) throw new Error("Identificador de archivo no válido");
  return path.join(/*turbopackIgnore: true*/ directorioAlmacenamiento(), archivoId);
}

export async function guardarArchivo(buf: Buffer) {
  const archivoId = randomUUID();
  await mkdir(directorioAlmacenamiento(), { recursive: true });
  await writeFile(rutaDe(archivoId), buf, { flag: "wx", mode: 0o600 });
  return archivoId;
}

export function leerArchivo(archivoId: string) {
  return readFile(rutaDe(archivoId));
}

export async function eliminarArchivo(archivoId: string) {
  try {
    await unlink(rutaDe(archivoId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
