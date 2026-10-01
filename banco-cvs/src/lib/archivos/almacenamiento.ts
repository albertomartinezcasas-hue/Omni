import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Carpeta privada (fuera de /public). Nunca se sirve de forma estática. */
export function directorioAlmacenamiento() {
  return path.join(process.cwd(), "storage");
}

function rutaDe(archivoId: string) {
  // La ruta solo se arma con un UUID validado: no hay forma de salir de la carpeta.
  if (!REGEX_UUID.test(archivoId)) throw new Error("Identificador de archivo no válido");
  return path.join(directorioAlmacenamiento(), archivoId);
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
