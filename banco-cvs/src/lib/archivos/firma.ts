export type TipoArchivo = "PDF" | "DOCX";

export const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB
const MAX_ENTRADAS_ZIP = 2000;
const MAX_DESCOMPRIMIDO_ZIP = 100 * 1024 * 1024; // protección contra bombas de descompresión

/** Inspecciona el directorio central de un ZIP sin descomprimirlo. */
export function inspeccionarZip(buf: Buffer) {
  // Registro de fin de directorio central (EOCD): firma 0x06054b50, a ≤ 65 557 bytes del final.
  const inicioBusqueda = Math.max(0, buf.length - 65_557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= inicioBusqueda; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const totalEntradas = buf.readUInt16LE(eocd + 10);
  let posicion = buf.readUInt32LE(eocd + 16);
  if (totalEntradas > MAX_ENTRADAS_ZIP || posicion >= buf.length) return null;

  const nombres: string[] = [];
  let descomprimido = 0;
  for (let i = 0; i < totalEntradas; i++) {
    if (posicion + 46 > buf.length || buf.readUInt32LE(posicion) !== 0x02014b50) return null;
    descomprimido += buf.readUInt32LE(posicion + 24);
    const largoNombre = buf.readUInt16LE(posicion + 28);
    const largoExtra = buf.readUInt16LE(posicion + 30);
    const largoComentario = buf.readUInt16LE(posicion + 32);
    if (posicion + 46 + largoNombre > buf.length) return null;
    nombres.push(buf.toString("utf8", posicion + 46, posicion + 46 + largoNombre));
    posicion += 46 + largoNombre + largoExtra + largoComentario;
  }
  return { nombres, descomprimido, entradas: totalEntradas };
}

/**
 * Detecta el tipo real por contenido (firma), no por extensión.
 * PDF: inicia con "%PDF-". DOCX: ZIP ("PK\x03\x04") con [Content_Types].xml y word/document.xml,
 * dentro de los límites de entradas y tamaño descomprimido.
 */
export function detectarTipo(buf: Buffer): TipoArchivo | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "PDF";
  if (buf.length >= 4 && buf.readUInt32LE(0) === 0x04034b50) {
    const zip = inspeccionarZip(buf);
    if (
      zip &&
      zip.descomprimido <= MAX_DESCOMPRIMIDO_ZIP &&
      zip.nombres.includes("[Content_Types].xml") &&
      zip.nombres.includes("word/document.xml")
    ) {
      return "DOCX";
    }
  }
  return null;
}
