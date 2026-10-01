// Atributos protegidos (regla crítica 4): nunca se usan ni se mencionan en vacantes ni en análisis.

const TERMINOS: { patron: string; atributo: string }[] = [
  { patron: "edad", atributo: "edad" },
  { patron: "años de edad", atributo: "edad" },
  { patron: "fecha de nacimiento", atributo: "edad" },
  { patron: "joven(?:es)?", atributo: "edad" },
  { patron: "sexo", atributo: "género" },
  { patron: "g[eé]nero", atributo: "género" },
  { patron: "masculino", atributo: "género" },
  { patron: "femenino", atributo: "género" },
  { patron: "hombres?", atributo: "género" },
  { patron: "mujer(?:es)?", atributo: "género" },
  { patron: "estado civil", atributo: "estado civil" },
  { patron: "solter[oa]s?", atributo: "estado civil" },
  { patron: "casad[oa]s?", atributo: "estado civil" },
  { patron: "divorciad[oa]s?", atributo: "estado civil" },
  { patron: "sin hijos", atributo: "estado civil" },
  { patron: "embaraz[oa]s?", atributo: "embarazo" },
  { patron: "embarazada", atributo: "embarazo" },
  { patron: "gravidez", atributo: "embarazo" },
  { patron: "religi[oó]n", atributo: "religión" },
  { patron: "religios[oa]s?", atributo: "religión" },
  { patron: "cat[oó]lic[oa]s?", atributo: "religión" },
  { patron: "cristian[oa]s?", atributo: "religión" },
  { patron: "nacionalidad", atributo: "origen nacional" },
  { patron: "mexican[oa]s? por nacimiento", atributo: "origen nacional" },
  { patron: "origen [eé]tnico", atributo: "origen étnico" },
  { patron: "raza", atributo: "origen étnico" },
  { patron: "ind[ií]gena", atributo: "origen étnico" },
  { patron: "color de piel", atributo: "origen étnico" },
  { patron: "tez", atributo: "origen étnico" },
  { patron: "discapacidad(?:es)?", atributo: "discapacidad" },
  { patron: "(?:con|anexar|enviar|adjuntar|incluir) foto(?:graf[ií]a)?", atributo: "fotografía" },
  { patron: "buena presentaci[oó]n", atributo: "apariencia" },
  { patron: "apariencia", atributo: "apariencia" },
  { patron: "complexi[oó]n", atributo: "apariencia" },
  { patron: "estatura", atributo: "apariencia" },
  { patron: "domicilio", atributo: "domicilio" },
  { patron: "colonia", atributo: "domicilio" },
  { patron: "viva cerca", atributo: "domicilio" },
  { patron: "que viva en", atributo: "domicilio" },
];

// Límites de palabra que respetan acentos y ñ.
const EXPRESIONES = TERMINOS.map(({ patron, atributo }) => ({
  regex: new RegExp(`(?<![\\p{L}\\p{N}])${patron}(?![\\p{L}\\p{N}])`, "iu"),
  atributo,
}));

/** Devuelve los atributos protegidos que menciona el texto (sin repetir). */
export function atributosProtegidosEn(texto: string): string[] {
  const normalizado = texto.normalize("NFC");
  return [...new Set(EXPRESIONES.filter((e) => e.regex.test(normalizado)).map((e) => e.atributo))];
}

export function mencionaAtributoProtegido(texto: string) {
  return atributosProtegidosEn(texto).length > 0;
}
