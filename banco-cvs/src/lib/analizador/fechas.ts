// Cálculo en código de la duración de cada puesto a partir de las fechas literales de su cita.

const MESES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11,
  jan: 0, apr: 3, aug: 7, dec: 11,
};

const FECHA =
  /(?:\b(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic|jan|apr|aug|dec)[a-záéíóú]*\.?\s*(?:de\s+|del\s+)?|\b(\d{1,2})\s*[/.-]\s*)?\b((?:19|20)\d{2})\b|\b(actual(?:mente|idad)?|presente|a la fecha|la fecha|hoy|current|present)\b/gi;

export type Periodo = { inicio: number; fin: number; sinMes: boolean }; // meses absolutos (año·12 + mes), fin inclusivo

const formatoCdmx = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha del análisis en la Ciudad de México (AAAA-MM-DD), la misma para la IA y para el cálculo. */
export function fechaCdmx(fecha: Date) {
  const iso = formatoCdmx.format(fecha); // en-CA → AAAA-MM-DD
  const [anio, mes] = iso.split("-").map(Number);
  return { iso, anio, mes: mes - 1 };
}

const aMes = (anio: number, mes: number) => anio * 12 + mes;
export const formatoMes = (m: number) => `${String((m % 12) + 1).padStart(2, "0")}/${Math.floor(m / 12)}`;

/**
 * Interpreta el periodo de una cita como "ene 2023 - dic 2025", "03/2021 – actual", "desde 2021" o "2019 - 2021".
 * - "Actual", "presente" o "desde" = fecha del análisis (hora de CDMX).
 * - Si solo hay años, cuenta la diferencia: "2019 - 2021" = 2 años (ene 2019 – dic 2020).
 * - Si falta la fecha de inicio o de fin (un solo año o mes), devuelve null: no se suma (se reporta en Alertas).
 * - Más de un periodo en la misma cita también devuelve null.
 */
export function periodoDeCita(cita: string, fechaAnalisis: Date): Periodo | null {
  const hoy = fechaCdmx(fechaAnalisis);
  const ahora = aMes(hoy.anio, hoy.mes);
  const marcas: { mes: number; esFin: boolean | null }[] = [];
  for (const m of cita.normalize("NFKC").matchAll(FECHA)) {
    if (m[4]) {
      marcas.push({ mes: ahora, esFin: true });
      continue;
    }
    const anio = Number(m[3]);
    const mesTexto = m[1] ? MESES[m[1].toLowerCase().slice(0, 3)] : undefined;
    const mesNumero = m[2] ? Number(m[2]) - 1 : undefined;
    const mes = mesTexto ?? (mesNumero !== undefined && mesNumero >= 0 && mesNumero <= 11 ? mesNumero : null);
    // esFin = null → solo año (sin mes)
    marcas.push({ mes: mes === null ? aMes(anio, 0) : aMes(anio, mes), esFin: mes === null ? null : false });
  }
  // "desde 2021" sin fecha de término = hasta la fecha del análisis.
  if (marcas.length === 1 && /\bdesde\b/i.test(cita)) marcas.push({ mes: ahora, esFin: true });
  // Exactamente un periodo con inicio y fin; un solo año o mes no basta.
  if (marcas.length !== 2 || marcas[0].esFin === true) return null;

  const [primera, ultima] = marcas;
  const inicio = primera.mes; // año sin mes: desde enero
  // Año sin mes al final: se cuenta la diferencia de años → termina en diciembre del año anterior.
  let fin = ultima.esFin === null ? ultima.mes - 1 : ultima.mes;
  fin = Math.min(fin, ahora);
  if (fin < inicio) return null;
  return { inicio, fin, sinMes: primera.esFin === null || ultima.esFin === null };
}

/** Meses totales de una lista de periodos, sin contar dos veces los traslapes. */
export function mesesSinTraslapes(periodos: Periodo[]) {
  const ordenados = [...periodos].sort((a, b) => a.inicio - b.inicio);
  let meses = 0;
  let actual: Periodo | null = null;
  for (const p of ordenados) {
    if (!actual || p.inicio > actual.fin + 1) {
      if (actual) meses += actual.fin - actual.inicio + 1;
      actual = { ...p };
    } else {
      actual.fin = Math.max(actual.fin, p.fin);
    }
  }
  if (actual) meses += actual.fin - actual.inicio + 1;
  return meses;
}

/** Años totales (un decimal), sin traslapes. Con mínimos enteros el redondeo nunca cruza el corte. */
export function aniosSinTraslapes(periodos: Periodo[]) {
  return Math.round((mesesSinTraslapes(periodos) / 12) * 10) / 10;
}

/** "9 meses", "1 año 3 meses", "4.5 años". */
export function describirMeses(meses: number) {
  if (meses >= 24) return `${Math.round((meses / 12) * 10) / 10} años`;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [
    ...(anios ? [`${anios} ${anios === 1 ? "año" : "años"}`] : []),
    ...(resto || !anios ? [`${resto} ${resto === 1 ? "mes" : "meses"}`] : []),
  ];
  return partes.join(" ");
}

export const aniosDePeriodo = (p: Periodo) => Math.round(((p.fin - p.inicio + 1) / 12) * 10) / 10;
