import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import type { TipoArchivo } from "./firma";

const TIEMPO_MAXIMO_MS = 30_000;
export const MIN_CARACTERES_LEGIBLES = 200;

async function extraer(buf: Buffer, tipo: TipoArchivo) {
  if (tipo === "PDF") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;
}

/** Extrae el texto del archivo (sin OCR). Lanza error si tarda demasiado o el archivo está dañado. */
export async function extraerTexto(buf: Buffer, tipo: TipoArchivo): Promise<string> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error("TIEMPO_EXTRACCION")), TIEMPO_MAXIMO_MS);
  });
  try {
    const texto = await Promise.race([extraer(buf, tipo), limite]);
    return texto.replace(/\u0000/g, "").trim();
  } finally {
    clearTimeout(temporizador);
  }
}

export function esTextoLegible(texto: string) {
  return texto.replace(/\s+/g, "").length >= MIN_CARACTERES_LEGIBLES;
}
