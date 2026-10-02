// Paso 1 — Preparación: se ocultan datos de contacto e identificadores antes de enviar el CV a la API.
// Además (ampliación aprobada en la Fase 0) se omiten datos protegidos: edad, estado civil, domicilio, etc.

const CORREO = /[a-z0-9._%+-]+\s*(?:@|\[\s*at\s*\]|\(\s*at\s*\)|\s+arroba\s+)\s*[a-z0-9-]+(?:\s*(?:\.|\[\s*dot\s*\]|\(\s*dot\s*\))\s*[a-z0-9-]+)*\s*(?:\.|\[\s*dot\s*\]|\(\s*dot\s*\))\s*[a-z]{2,}\b/gi;
const URL_CON_ESQUEMA = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
// TLD en minúsculas: evita convertir "ASP.NET" o "VB.NET" en [URL].
const DOMINIO = /\b(?:[A-Za-z0-9-]+\.)+(?:com|net|org|io|dev|me|mx|co|info|app|site|page|link)(?:\.[a-z]{2})?\b(?:\/[^\s<>"')]*)?/g;
const USUARIO_RED = /(?<![\w.@])@[a-z0-9_.]{3,30}\b/gi;
// CURP: 4 letras, fecha (6 dígitos), sexo, entidad (2), 3 consonantes, homoclave y dígito.
const CURP = /\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d\b/gi;
// RFC: 3 (moral) o 4 (física) letras, fecha (6 dígitos) y homoclave de 3.
const RFC = /\b[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}\b/gi;
const ANIO_ACTUAL = new Date().getFullYear();
/** Una secuencia formada solo por años de 4 dígitos (p. ej. "2015-2018 2019-2022") no es un teléfono. */
function sonAnios(coincidencia: string) {
  const grupos = coincidencia.match(/\d+/g) ?? [];
  return grupos.every((g) => g.length === 4 && Number(g) >= 1950 && Number(g) <= ANIO_ACTUAL + 1);
}

// RUT chileno (12.345.678-9) y DNI/INE con etiqueta.
const RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;
const DNI = /\b(?:DNI|D\.N\.I\.|RUT|R\.U\.T\.|INE|NSS|pasaporte|c[eé]dula)\s*(?:n[uú]m(?:ero)?\.?|no\.?|#)?\s*[:：]?\s*[A-Z0-9][A-Z0-9.\-]{5,17}\b/gi;

// Teléfonos: de 10 a 13 dígitos con separadores cortos (espacios, puntos, guiones, paréntesis),
// p. ej. "55 12 34 56 78", "(55) 1234-5678", "+52 1 55 1234 5678". Los rangos de años no coinciden.
const TELEFONO = /(?<![\d\w])\+?\(?\d(?:[\s.\-()]{0,2}\d){9,12}(?!\d)/g;

// Etiquetas que se omiten con dos puntos, guion o solo un espacio ("Edad 32 años").
const ETIQUETAS_PROTEGIDAS =
  /^[^\S\n]*[-•*]?[^\S\n]*(?:edad|fecha de nacimiento|lugar de nacimiento|estado civil|sexo|g[eé]nero|nacionalidad|religi[oó]n|dependientes econ[oó]micos|n[uú]mero de hijos|hijos)\b(?:[^\S\n]*[:：\-–][^\S\n]*|[^\S\n]+).*$/gim;
// "Dirección"/"Domicilio" solo con dos puntos o guion: "Dirección Comercial — Acme" es un puesto.
const ETIQUETAS_DOMICILIO = /^[^\S\n]*[-•*]?[^\S\n]*(?:domicilio|direcci[oó]n)[^\S\n]*[:：\-–].*$/gim;
const EDAD_SUELTA = /\b\d{2}\s+años\s+de\s+edad\b|(?<!(?:de|por|durante|hace|con|más de|mas de)\s)\b(?:1[89]|[2-6]\d)\s*años\b(?=\s*(?:[,;.)]|$))/gim;
const ESTADO_CIVIL = /(?<![\p{L}])(?:solter[oa]|casad[oa]|divorciad[oa]|viud[oa]|uni[oó]n libre)(?![\p{L}])/giu;
const DIRECCION =
  /\b(?:C\.?\s?P\.?\s*\d{5}|Col(?:onia)?\.?\s+[A-ZÁÉÍÓÚÑ][^\n,;]{1,40}|(?:Calle|Av(?:enida)?\.?|Calz(?:ada)?\.?|Blvd\.?|Privada)\s+[^\n,;]{1,40}?\s#?\d+[A-Z]?)/gu;

export const MARCAS = ["[CORREO]", "[TELÉFONO]", "[URL]", "[CURP]", "[RFC]", "[ID]", "[DATO PERSONAL OMITIDO]"] as const;

export function ocultarDatosPersonales(texto: string): string {
  return texto
    .normalize("NFKC") // ancho completo, ligaduras, etc. → forma canónica
    .replace(ETIQUETAS_PROTEGIDAS, "[DATO PERSONAL OMITIDO]")
    .replace(ETIQUETAS_DOMICILIO, "[DATO PERSONAL OMITIDO]")
    .replace(EDAD_SUELTA, "[DATO PERSONAL OMITIDO]")
    .replace(ESTADO_CIVIL, "[DATO PERSONAL OMITIDO]")
    .replace(DIRECCION, "[DATO PERSONAL OMITIDO]")
    .replace(CORREO, "[CORREO]")
    .replace(URL_CON_ESQUEMA, "[URL]")
    .replace(DOMINIO, "[URL]")
    .replace(USUARIO_RED, "[URL]")
    .replace(DNI, "[ID]")
    .replace(RUT, "[ID]")
    .replace(CURP, "[CURP]")
    .replace(RFC, "[RFC]")
    .replace(TELEFONO, (coincidencia) => (sonAnios(coincidencia) ? coincidencia : "[TELÉFONO]"));
}

const ENCABEZADOS = /^(curr[ií]cul[ou]m( vitae)?|cv|hoja de vida|resumen|perfil|experiencia|educaci[oó]n|formaci[oó]n|habilidades|idiomas|datos personales|contacto)$/i;
const PARECE_NOMBRE = /^[\p{Lu}][\p{L}'’.-]+(?:\s+[\p{L}'’.-]+){1,4}$/u;

/**
 * Anonimización adicional para proveedores que pueden usar los datos para entrenar (p. ej. el plan gratuito de Gemini):
 * además de lo que oculta `ocultarDatosPersonales`, quita el nombre del candidato.
 * Se aplica sobre texto ya ocultado.
 */
export function anonimizar(texto: string, nombresConocidos: (string | null | undefined)[] = []) {
  const renglones = texto.split("\n");
  // El nombre suele ser el primer renglón con texto: 2 a 5 palabras, sin dígitos ni marcas.
  const primero = renglones.findIndex((r) => r.trim());
  const nombres = nombresConocidos.filter((n): n is string => !!n && n.trim().length >= 3).map((n) => n.trim());
  if (primero >= 0) {
    const r = renglones[primero].trim();
    if (PARECE_NOMBRE.test(r) && !/\d|\[/.test(r) && !ENCABEZADOS.test(r) && r.length <= 60) {
      nombres.push(r);
      renglones[primero] = "[NOMBRE]";
    }
  }
  let salida = renglones
    .join("\n")
    .replace(/^[^\S\n]*(?:nombre(?: completo)?|candidat[oa])[^\S\n]*[:：].*$/gim, "[NOMBRE]");
  for (const nombre of nombres) {
    const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    salida = salida.replace(new RegExp(escapado, "giu"), "[NOMBRE]");
  }
  return salida;
}
