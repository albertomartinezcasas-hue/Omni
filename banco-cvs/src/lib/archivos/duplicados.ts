import { createHash } from "node:crypto";

/** Normaliza el texto para comparar: minúsculas, NFC y espacios colapsados. */
export function normalizarParaComparar(texto: string) {
  return texto.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function hashDeTexto(texto: string) {
  return createHash("sha256").update(normalizarParaComparar(texto)).digest("hex");
}

const REGEX_CORREO = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/** Primer correo del texto (extracción local; no se envía a ningún servicio). */
export function extraerCorreo(texto: string): string | null {
  return texto.match(REGEX_CORREO)?.[0].toLowerCase() ?? null;
}
