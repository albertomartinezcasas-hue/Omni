import mammoth from "mammoth";
import { extractTextItems, getDocumentProxy } from "unpdf";
import type { TipoArchivo } from "./firma";

const TIEMPO_MAXIMO_MS = 30_000;
// Umbral de «texto legible» (sin contar espacios). Un CV breve pero real (nombre, contacto, un puesto y estudios)
// tiene ~100 caracteres; un PDF escaneado suele dar 0 o solo una marca de agua («Escaneado con CamScanner»).
// Se exigen también palabras: números de página o restos sueltos no cuentan como texto.
export const MIN_CARACTERES_LEGIBLES = 100;
export const MIN_PALABRAS_LEGIBLES = 15;
// PDF de varias páginas: un CV con texto real tiene más de 1,000 caracteres por página; uno con el encabezado como
// texto y el cuerpo como imagen pasa el mínimo global pero queda muy por debajo de esto en promedio.
// En PDFs de 1 página solo aplica el mínimo global, para no rechazar un CV breve pero real.
export const MIN_CARACTERES_POR_PAGINA = 250;
/** Texto de menos de 3 pt no se lee a simple vista: se omite (posible texto oculto para manipular el análisis). */
const TAMANO_MINIMO_VISIBLE = 3;
export const MARCA_TEXTO_OCULTO = "[TEXTO OCULTO OMITIDO";

async function extraer(buf: Buffer, tipo: TipoArchivo): Promise<{ texto: string; paginas: number }> {
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
    return { texto, paginas: items.length };
  }
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return { texto: value, paginas: 1 }; // DOCX: no hay páginas fijas; solo aplica el mínimo global
}

/** Extrae el texto y el número de páginas (sin OCR). Lanza error si tarda demasiado o el archivo está dañado. */
export async function extraerContenido(buf: Buffer, tipo: TipoArchivo): Promise<{ texto: string; paginas: number }> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error("TIEMPO_EXTRACCION")), TIEMPO_MAXIMO_MS);
  });
  try {
    const { texto, paginas } = await Promise.race([extraer(buf, tipo), limite]);
    return { texto: texto.replace(/\u0000/g, "").trim(), paginas: Math.max(1, paginas) };
  } finally {
    clearTimeout(temporizador);
  }
}

/** Solo el texto extraído. */
export async function extraerTexto(buf: Buffer, tipo: TipoArchivo): Promise<string> {
  return (await extraerContenido(buf, tipo)).texto;
}

/**
 * ¿Hay texto suficiente para analizar? Si no, el CV se guarda «sin texto legible» (PDF escaneado o con partes en
 * imagen) y se pide una versión con texto: así la IA no lo descarta por falta de evidencia que sí está en la imagen.
 */
export function esTextoLegible(texto: string, paginas = 1) {
  // La marca de texto oculto la agrega el sistema: no es texto del CV.
  const visible = texto.replace(/\[TEXTO OCULTO OMITIDO[^\]]*\]/g, "");
  const caracteres = visible.replace(/\s+/g, "").length;
  const palabras = visible.match(/\p{L}{2,}/gu)?.length ?? 0;
  if (caracteres < MIN_CARACTERES_LEGIBLES || palabras < MIN_PALABRAS_LEGIBLES) return false;
  return paginas < 2 || caracteres / paginas >= MIN_CARACTERES_POR_PAGINA;
}
