import mammoth from "mammoth";
import { extractTextItems, getDocumentProxy } from "unpdf";
import type { TipoArchivo } from "./firma";

const TIEMPO_MAXIMO_MS = 30_000;
// Umbral de «texto legible» (sin contar espacios). Un CV breve pero real (nombre, contacto, un puesto y estudios)
// tiene ~100 caracteres; un PDF escaneado suele dar 0 o solo una marca de agua («Escaneado con CamScanner»).
// Se exigen también palabras: números de página o restos sueltos no cuentan como texto.
export const MIN_CARACTERES_LEGIBLES = 100;
export const MIN_PALABRAS_LEGIBLES = 15;
/** Texto de menos de 3 pt no se lee a simple vista: se omite (posible texto oculto para manipular el análisis). */
const TAMANO_MINIMO_VISIBLE = 3;
export const MARCA_TEXTO_OCULTO = "[TEXTO OCULTO OMITIDO";

async function extraer(buf: Buffer, tipo: TipoArchivo) {
  if (tipo === "PDF") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { items } = await extractTextItems(pdf);
    let texto = "";
    let ocultos = 0;
    for (const pagina of items) {
      for (const item of pagina) {
        if (item.str.trim() && item.fontSize > 0 && item.fontSize < TAMANO_MINIMO_VISIBLE) {
          ocultos += item.str.length;
          continue;
        }
        texto += item.str + (item.hasEOL ? "\n" : "");
      }
      texto += "\n";
    }
    if (ocultos > 0) texto += `\n${MARCA_TEXTO_OCULTO}: ${ocultos} caracteres en letra diminuta]`;
    return texto;
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
  // La marca de texto oculto la agrega el sistema: no es texto del CV.
  const visible = texto.replace(/\[TEXTO OCULTO OMITIDO[^\]]*\]/g, "");
  const palabras = visible.match(/\p{L}{2,}/gu)?.length ?? 0;
  return visible.replace(/\s+/g, "").length >= MIN_CARACTERES_LEGIBLES && palabras >= MIN_PALABRAS_LEGIBLES;
}
