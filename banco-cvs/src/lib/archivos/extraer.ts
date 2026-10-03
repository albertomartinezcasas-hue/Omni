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
// Páginas con poco texto (posible imagen): se marcan al extraer para avisar al analizar. No cambian el veredicto.
// Una página de un CV con texto real rara vez baja de 250 caracteres; un CV de 1 página, de 600.
export const MIN_CARACTERES_PAGINA = 250;
// 300: un CV real de 1 página tiene ~350 o más (fase 4: 354–575); una plantilla con el cuerpo en imagen, mucho menos.
export const MIN_CARACTERES_PAGINA_UNICA = 300;
export const MARCA_POCO_TEXTO = "[PÁGINAS CON POCO TEXTO";
const REGEX_MARCAS = /\[(?:TEXTO OCULTO OMITIDO|PÁGINAS CON POCO TEXTO)[^\]]*\]/g;
const REGEX_POCO_TEXTO = /\n?\[PÁGINAS CON POCO TEXTO: ([\d, ]+)\]/;

/** Números de página (desde 1) con menos texto del esperado, según la marca guardada en el texto extraído. */
export function paginasConPocoTexto(texto: string): number[] {
  return texto.match(REGEX_POCO_TEXTO)?.[1].split(",").map((n) => Number(n.trim())).filter((n) => n > 0) ?? [];
}

/** Texto sin la marca de páginas con poco texto (es un metadato para la alerta, no contenido del CV). */
export function quitarMarcaPocoTexto(texto: string) {
  return texto.replace(REGEX_POCO_TEXTO, "");
}

/** Un CV no puede imitar las marcas que agrega el sistema (alertas falsas o texto oculto «declarado»). */
function sinMarcasFalsas(texto: string) {
  return texto.replace(REGEX_MARCAS, "");
}

async function extraer(buf: Buffer, tipo: TipoArchivo): Promise<{ texto: string; paginas: number }> {
  if (tipo === "PDF") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { items } = await extractTextItems(pdf);
    let texto = "";
    let ocultos = 0;
    const porPagina: number[] = [];
    for (const pagina of items) {
      let visibles = 0;
      for (const item of pagina) {
        if (item.str.trim() && item.fontSize > 0 && item.fontSize < TAMANO_MINIMO_VISIBLE) {
          ocultos += item.str.length;
          continue;
        }
        texto += item.str + (item.hasEOL ? "\n" : "");
        visibles += item.str.replace(/\s+/g, "").length;
      }
      texto += "\n";
      porPagina.push(visibles);
    }
    texto = sinMarcasFalsas(texto);
    if (ocultos > 0) texto += `\n${MARCA_TEXTO_OCULTO}: ${ocultos} caracteres en letra diminuta]`;
    const minimo = porPagina.length === 1 ? MIN_CARACTERES_PAGINA_UNICA : MIN_CARACTERES_PAGINA;
    const escasas = porPagina.flatMap((n, i) => (n < minimo ? [i + 1] : []));
    if (escasas.length > 0) texto += `\n${MARCA_POCO_TEXTO}: ${escasas.join(", ")}]`;
    return { texto, paginas: items.length };
  }
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return { texto: sinMarcasFalsas(value), paginas: 1 }; // DOCX: no hay páginas fijas; solo aplica el mínimo global
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
  // Las marcas (texto oculto, páginas con poco texto) las agrega el sistema: no son texto del CV.
  const visible = texto.replace(REGEX_MARCAS, "");
  const caracteres = visible.replace(/\s+/g, "").length;
  const palabras = visible.match(/\p{L}{2,}/gu)?.length ?? 0;
  if (caracteres < MIN_CARACTERES_LEGIBLES || palabras < MIN_PALABRAS_LEGIBLES) return false;
  return paginas < 2 || caracteres / paginas >= MIN_CARACTERES_POR_PAGINA;
}
