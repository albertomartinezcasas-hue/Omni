// Atributos protegidos (regla crítica 4): nunca se usan ni se mencionan en vacantes ni en análisis.

const EDAD_NUM = "(?:1[89]|[2-6]\\d|70)";
const NO_EXPERIENCIA = "(?!\\s+(?:de\\s+)?(?:experiencia|antig[uü]edad|trayectoria))";

const TERMINOS: { patron: string; atributo: string }[] = [
  { patron: "edad", atributo: "edad" },
  { patron: "años de edad", atributo: "edad" },
  { patron: "fecha de nacimiento", atributo: "edad" },
  { patron: "j[oó]ven(?:es)?", atributo: "edad" },
  // Rangos de edad sin la palabra "edad": "de 25 a 35 años", "25-40 años", "mayor de 30".
  { patron: `${EDAD_NUM}\\s*(?:a|-|–|y)\\s*${EDAD_NUM}\\s*años${NO_EXPERIENCIA}`, atributo: "edad" },
  { patron: `(?:mayor|menor)(?:es)?\\s+de\\s+${EDAD_NUM}(?:\\s*años)?${NO_EXPERIENCIA}`, atributo: "edad" },
  { patron: "sexo", atributo: "género" },
  { patron: "ambos sexos", atributo: "género" },
  { patron: "g[eé]nero", atributo: "género" },
  { patron: "masculino", atributo: "género" },
  { patron: "femenino", atributo: "género" },
  { patron: "hombres?", atributo: "género" },
  { patron: "mujer(?:es)?", atributo: "género" },
  { patron: "(?:orientaci[oó]n|preferencia) sexual", atributo: "orientación sexual" },
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
  { patron: "estado de salud", atributo: "salud" },
  { patron: "vih", atributo: "salud" },
  { patron: "(?:con|anexar|enviar|adjuntar|incluir) foto(?:graf[ií]a)?", atributo: "fotografía" },
  { patron: "buena presentaci[oó]n", atributo: "apariencia" },
  { patron: "apariencia", atributo: "apariencia" },
  { patron: "complexi[oó]n", atributo: "apariencia" },
  { patron: "estatura", atributo: "apariencia" },
  { patron: "tatuajes?", atributo: "apariencia" },
  { patron: "domicilio", atributo: "domicilio" },
  { patron: "viva cerca", atributo: "domicilio" },
  { patron: "que viva en", atributo: "domicilio" },
  { patron: "radique en", atributo: "domicilio" },
];

// Contextos legítimos que se omiten antes de buscar (p. ej. "servicio a domicilio").
const CONTEXTOS_PERMITIDOS = [
  /(?<![\p{L}])a domicilio(?![\p{L}])/giu,
  /j[oó]venes construyendo el futuro/giu,
  /(?:igualdad|equidad|perspectiva|violencia) de g[eé]nero/giu,
  /(?:incluyente|inclusi[oó]n|inclusiv[oa]|accesible)[^.\n]{0,60}discapacidad(?:es)?/giu,
  /discapacidad(?:es)?[^.\n]{0,40}(?:bienvenid[oa]s|incluyente|inclusi[oó]n)/giu,
];

// Límites de palabra que respetan acentos y ñ.
const EXPRESIONES = TERMINOS.map(({ patron, atributo }) => ({
  regex: new RegExp(`(?<![\\p{L}\\p{N}])${patron}(?![\\p{L}\\p{N}])`, "iu"),
  atributo,
}));

export type CoincidenciaProtegida = { atributo: string; fragmento: string };

/** Fragmentos del texto que mencionan atributos protegidos (uno por atributo). */
export function coincidenciasProtegidas(texto: string): CoincidenciaProtegida[] {
  let limpio = texto.normalize("NFC");
  for (const permitido of CONTEXTOS_PERMITIDOS) limpio = limpio.replace(permitido, " ");
  const resultado = new Map<string, string>();
  for (const { regex, atributo } of EXPRESIONES) {
    const encontrado = limpio.match(regex);
    if (encontrado && !resultado.has(atributo)) resultado.set(atributo, encontrado[0]);
  }
  return [...resultado].map(([atributo, fragmento]) => ({ atributo, fragmento }));
}

/** Atributos protegidos que menciona el texto (sin repetir). */
export function atributosProtegidosEn(texto: string): string[] {
  return coincidenciasProtegidas(texto).map((c) => c.atributo);
}

export function mencionaAtributoProtegido(texto: string) {
  return coincidenciasProtegidas(texto).length > 0;
}
