// Fechas de los filtros (AAAA-MM-DD), capturadas en hora de CDMX (UTC−6).

/**
 * Inicio (o fin, con `finDelDia`) del día indicado. Devuelve undefined si el valor no es una fecha real
 * (p. ej. «2026-13-45» o «2026-02-31»): el filtro se ignora en lugar de romper la página.
 */
export function fechaDeFiltro(valor: string | undefined, finDelDia: boolean): Date | undefined {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
  const [anio, mes, dia] = valor.split("-").map(Number);
  // El motor de JS desborda «31 de febrero» al 3 de marzo: se exige que el día exista.
  const real = new Date(Date.UTC(anio, mes - 1, dia));
  if (real.getUTCFullYear() !== anio || real.getUTCMonth() !== mes - 1 || real.getUTCDate() !== dia) return undefined;
  const resultado = new Date(`${valor}T${finDelDia ? "23:59:59.999" : "00:00:00.000"}-06:00`);
  return isNaN(resultado.getTime()) ? undefined : resultado;
}
