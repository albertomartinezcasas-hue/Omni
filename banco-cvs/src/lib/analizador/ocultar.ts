// Paso 1 — Preparación: se ocultan datos de contacto e identificadores antes de enviar el CV a la API.
// Además (ampliación aprobada en la Fase 0) se omiten los renglones etiquetados con datos protegidos.

const CORREO = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const URL = /\b(?:https?:\/\/|www\.)[^\s<>"')]+|\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|me|mx|co|info|app)(?:\.[a-z]{2})?\/[^\s<>"')]*/gi;
// CURP: 4 letras, fecha (6 dígitos), sexo, entidad (2), 3 consonantes, homoclave y dígito.
const CURP = /\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d\b/gi;
// RFC: 3 (moral) o 4 (física) letras, fecha (6 dígitos) y homoclave de 3.
const RFC = /\b[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}\b/gi;
// Teléfonos: secuencias con 10 a 13 dígitos (lada, +52, separadores).
const TELEFONO = /(?<![\w])(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)\d{3,4}[\s.-]?\d{4}(?![\w])/g;

const ETIQUETAS_PROTEGIDAS =
  /^[^\S\n]*[-•*]?[^\S\n]*(?:edad|fecha de nacimiento|lugar de nacimiento|estado civil|sexo|g[eé]nero|nacionalidad|religi[oó]n|domicilio|direcci[oó]n|dependientes econ[oó]micos|n[uú]mero de hijos|hijos)[^\S\n]*[:：].*$/gim;
const EDAD_SUELTA = /\b\d{2}\s+años\s+de\s+edad\b/gi;

export const MARCAS = ["[CORREO]", "[TELÉFONO]", "[URL]", "[CURP]", "[RFC]", "[DATO PERSONAL OMITIDO]"] as const;

export function ocultarDatosPersonales(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(ETIQUETAS_PROTEGIDAS, "[DATO PERSONAL OMITIDO]")
    .replace(EDAD_SUELTA, "[DATO PERSONAL OMITIDO]")
    .replace(CORREO, "[CORREO]")
    .replace(URL, "[URL]")
    .replace(CURP, "[CURP]")
    .replace(RFC, "[RFC]")
    .replace(TELEFONO, (coincidencia) =>
      (coincidencia.match(/\d/g)?.length ?? 0) >= 10 ? "[TELÉFONO]" : coincidencia,
    );
}
