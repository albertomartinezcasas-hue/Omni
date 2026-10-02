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

// Domicilios sin palabra clave de calle: "Insurgentes Sur 1234, Del. Benito Juárez", "Paseo de la Reforma 222".
// La alcaldía o municipio solo se quita tras calle y número: "Municipio de Zapopan" puede ser un empleador.
const DIRECCION_VIALIDAD =
  /\b(?:Paseo|Perif[eé]rico|Circuito|Retorno|Cerrada|Andador|Prolongaci[oó]n|Callej[oó]n)\s+[\p{L}. ]{1,40}?\s#?(?!(?:19|20)\d\d\b)\d{1,5}[A-Z]?\b/gu;
const DIRECCION_CON_ALCALDIA =
  /(?:[\p{Lu}][\p{L}.]*(?:[^\S\n]+[\p{L}.]+){0,5}[^\S\n]+#?(?!(?:19|20)\d\d\b)\d{1,5}[A-Z]?[^\S\n]*,[^\S\n]*)\b(?:Del\.|Delegaci[oó]n|Alcald[ií]a|Mun\.|Municipio)[^\S\n]+[\p{L}.]+(?:[^\S\n]+[\p{L}.]+){0,4}/gu;
// Teléfonos locales de 8 dígitos solo cuando llevan etiqueta ("Tel. 5512-3456").
const TELEFONO_ETIQUETADO =
  /\b(?:tel(?:[eé]fono)?|cel(?:ular)?|m[oó]vil|whats(?:app)?)\.?\s*[:：]?\s*\+?\(?\d(?:[\s.\-()]{0,2}\d){7,8}(?!\d)/gi;

const ENCABEZADOS = /^(curr[ií]cul[ou]m( vitae)?|cv|hoja de vida|resumen|perfil|experiencia|educaci[oó]n|formaci[oó]n|habilidades|idiomas|datos personales|contacto)$/i;
const PARECE_NOMBRE = /^[\p{Lu}][\p{L}'’.-]+(?:\s+[\p{L}'’.-]+){1,4}$/u;
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "san", "santa"]);
// Palabras de puestos o secciones: un renglón con ellas no es un nombre ("Analista de Datos").
const NO_NOMBRE =
  /\b(?:analista|gerente|auxiliar|asistente|ingenier[oa]|ing\.|lic\.|licenciad[oa]|desarrollador[a]?|coordinador[a]?|jef[ea]|director[a]?|ejecutiv[oa]|contador[a]?|t[eé]cnic[oa]|especialista|consultor[a]?|supervisor[a]?|administrador[a]?|vendedor[a]?|programador[a]?|dise[nñ]ador[a]?|practicante|becari[oa]|encargad[oa]|operador[a]?|l[ií]der|responsable|objetivo|profesional|datos|ventas|sistemas|recursos|humanos|marketing|finanzas|log[ií]stica|empresa|universidad|instituto|escuela)\b/i;

function pareceNombre(r: string) {
  if (!PARECE_NOMBRE.test(r) || /\d|\[/.test(r) || ENCABEZADOS.test(r) || NO_NOMBRE.test(r) || r.length > 60) return false;
  // Todas las palabras, salvo las partículas, empiezan con mayúscula.
  return r.split(/\s+/).every((w) => PARTICULAS.has(w.toLowerCase()) || /^\p{Lu}/u.test(w));
}

function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Anonimización adicional para proveedores que pueden usar los datos para entrenar (p. ej. el plan gratuito de Gemini):
 * además de lo que oculta `ocultarDatosPersonales`, quita el nombre del candidato (completo y cada una de sus partes),
 * domicilios sin palabra clave y teléfonos locales etiquetados. Se aplica sobre texto ya ocultado.
 * `nombreEncontrado` es falso si no se identificó ningún nombre: entonces el CV no debe enviarse a ese proveedor.
 */
export function anonimizarCv(texto: string, nombresConocidos: (string | null | undefined)[] = []) {
  const renglones = texto.split("\n");
  const nombres = nombresConocidos.filter((n): n is string => !!n && n.trim().length >= 3).map((n) => n.trim());
  // El nombre suele estar en los primeros renglones con texto, antes o después de un encabezado.
  let revisados = 0;
  for (let i = 0; i < renglones.length && revisados < 5; i++) {
    const r = renglones[i].trim();
    if (!r) continue;
    revisados++;
    if (pareceNombre(r)) {
      nombres.push(r);
      renglones[i] = "[NOMBRE]";
      break;
    }
  }
  let salida = renglones.join("\n").replace(
    /^([^\S\n]*(?:nombre(?: completo)?|candidat[oa])[^\S\n]*[:：][^\S\n]*)(.*)$/gim,
    (_m, _etiqueta: string, valor: string) => {
      if (valor.trim().length >= 3 && !valor.includes("[")) nombres.push(valor.trim());
      return "[NOMBRE]";
    },
  );
  // Nombre completo primero y después cada parte (≥ 3 letras, sin partículas) por separado.
  const partes = new Set<string>();
  for (const nombre of nombres) {
    salida = salida.replace(new RegExp(escapar(nombre), "giu"), "[NOMBRE]");
    for (const w of nombre.split(/\s+/)) if (w.length >= 3 && !PARTICULAS.has(w.toLowerCase())) partes.add(w);
  }
  for (const parte of partes) {
    salida = salida.replace(new RegExp(`(?<![\\p{L}])${escapar(parte)}(?![\\p{L}])`, "giu"), "[NOMBRE]");
  }
  salida = salida
    .replace(DIRECCION_VIALIDAD, "[DATO PERSONAL OMITIDO]")
    .replace(DIRECCION_CON_ALCALDIA, "[DATO PERSONAL OMITIDO]")
    .replace(TELEFONO_ETIQUETADO, "[TELÉFONO]");
  return { texto: salida, nombreEncontrado: nombres.length > 0 };
}

export function anonimizar(texto: string, nombresConocidos: (string | null | undefined)[] = []) {
  return anonimizarCv(texto, nombresConocidos).texto;
}
