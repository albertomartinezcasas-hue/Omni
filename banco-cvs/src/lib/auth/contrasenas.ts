import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";

const COSTO_BCRYPT = 12;
const LONGITUD_TEMPORAL = 16;
// Sin caracteres ambiguos (0/O, 1/l/I) para que se puedan dictar o copiar sin errores.
const ALFABETO_TEMPORAL = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";

export const MIN_CARACTERES = 12;
export const MAX_BYTES = 72; // bcrypt solo considera los primeros 72 bytes

export function normalizarContrasena(contrasena: string) {
  return contrasena.normalize("NFC");
}

export const esquemaContrasenaNueva = z
  .string()
  .transform(normalizarContrasena)
  .refine((c) => [...c].length >= MIN_CARACTERES, {
    error: `La contraseña debe tener al menos ${MIN_CARACTERES} caracteres.`,
  })
  .refine((c) => Buffer.byteLength(c, "utf8") <= MAX_BYTES, {
    error: `La contraseña es demasiado larga (máximo ${MAX_BYTES} bytes).`,
  });

export function hashContrasena(contrasena: string) {
  return bcrypt.hash(normalizarContrasena(contrasena), COSTO_BCRYPT);
}

export function compararContrasena(contrasena: string, hash: string) {
  return bcrypt.compare(normalizarContrasena(contrasena), hash);
}

let hashFicticio: Promise<string> | null = null;

/**
 * Compara contra un hash ficticio para que el tiempo de respuesta sea el mismo
 * cuando la cuenta no existe, está bloqueada o desactivada.
 */
export async function compararContraFicticio(contrasena: string) {
  hashFicticio ??= bcrypt.hash(generarContrasenaTemporal(), COSTO_BCRYPT);
  await bcrypt.compare(normalizarContrasena(contrasena), await hashFicticio);
}

/** Contraseña temporal generada con CSPRNG. Nunca se guarda ni se registra en texto plano. */
export function generarContrasenaTemporal() {
  let resultado = "";
  for (let i = 0; i < LONGITUD_TEMPORAL; i++) {
    resultado += ALFABETO_TEMPORAL[randomInt(ALFABETO_TEMPORAL.length)];
  }
  return resultado;
}

/** Genera una contraseña temporal y su hash. La temporal se muestra una sola vez. */
export async function crearCredencialTemporal() {
  const temporal = generarContrasenaTemporal();
  return { temporal, hash: await hashContrasena(temporal) };
}
