// Cálculo en código de la duración de cada puesto a partir de las fechas literales de su cita.

const MESES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11,
  jan: 0, apr: 3, aug: 7, dec: 11,
};

const FECHA =
  /(?:\b(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic|jan|apr|aug|dec)[a-záéíóú]*\.?\s*(?:de\s+|del\s+)?|\b(\d{1,2})\s*[/.-]\s*)?\b((?:19|20)\d{2})\b|\b(actual(?:mente|idad)?|presente|a la fecha|la fecha|hoy|current|present)\b/gi;

export type Periodo = { inicio: number; fin: number }; // meses absolutos (año·12 + mes), fin inclusivo

const aMes = (anio: number, mes: number) => anio * 12 + mes;
export const formatoMes = (m: number) => `${String((m % 12) + 1).padStart(2, "0")}/${Math.floor(m / 12)}`;

/**
 * Interpreta el periodo de una cita como "ene 2023 - dic 2025", "03/2021 – actual" o "2019 - 2022".
 * Sin mes: el inicio cuenta desde enero y el fin hasta diciembre. "Actual" = fecha del análisis.
 * Devuelve null si la cita no tiene ningún año.
 */
export function periodoDeCita(cita: string, fechaAnalisis: Date): Periodo | null {
  const ahora = aMes(fechaAnalisis.getFullYear(), fechaAnalisis.getMonth());
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
    marcas.push({ mes: mes === null ? aMes(anio, -1) : aMes(anio, mes), esFin: mes === null ? null : false });
  }
  const conAnio = marcas.filter((m) => m.esFin !== true);
  if (conAnio.length === 0) return null;

  const primera = marcas[0];
  const ultima = marcas.length > 1 ? marcas[marcas.length - 1] : marcas[0];
  // Año sin mes: aMes(año, -1) es diciembre del año anterior → inicio = enero, fin = diciembre.
  const inicio = primera.esFin === null ? primera.mes + 1 : primera.mes;
  let fin = ultima.esFin === null ? ultima.mes + 12 : ultima.mes;
  fin = Math.min(fin, ahora);
  if (fin < inicio) return null;
  return { inicio, fin };
}

/** Años totales de una lista de periodos, sin contar dos veces los traslapes. */
export function aniosSinTraslapes(periodos: Periodo[]) {
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
  return Math.round((meses / 12) * 10) / 10;
}

export const aniosDePeriodo = (p: Periodo) => Math.round(((p.fin - p.inicio + 1) / 12) * 10) / 10;
