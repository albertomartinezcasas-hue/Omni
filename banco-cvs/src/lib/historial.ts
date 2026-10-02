// Historial de análisis (estadística y auditoría). Lee solo RegistroAnalisis: sin datos de candidatos.
import { CATEGORIAS, type Categoria } from "@/lib/catalogos";
import { db } from "@/lib/db";

export type FiltrosHistorial = { desde?: string; hasta?: string; area?: string; vacanteId?: string };

export type Conteo = Record<Categoria, number>;

export type Segmento = {
  clave: string;
  etiqueta: string;
  /** CVs distintos con resultado vigente en el segmento. */
  cvs: number;
  /** Análisis realizados, incluidos los re-análisis. */
  analisis: number;
  porCategoria: Conteo;
};

const conteoVacio = (): Conteo => Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Conteo;

/** Fechas del filtro en hora de CDMX (igual que la bitácora). */
function fecha(v: string | undefined, fin: boolean) {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${fin ? "23:59:59.999" : "00:00:00.000"}-06:00`) : undefined;
}

function filtroWhere(f: FiltrosHistorial) {
  const desde = fecha(f.desde, false);
  const hasta = fecha(f.hasta, true);
  return {
    ...(f.area ? { area: f.area } : {}),
    ...(f.vacanteId ? { vacanteId: f.vacanteId } : {}),
    ...(desde || hasta ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
  };
}

export function registrosDelHistorial(f: FiltrosHistorial = {}) {
  return db.registroAnalisis.findMany({ where: filtroWhere(f), orderBy: { fecha: "desc" } });
}

type Registro = Awaited<ReturnType<typeof registrosDelHistorial>>[number];

/**
 * Resumen segmentado por número de CVs, área y categoría.
 * La categoría de cada CV es la de su análisis más reciente contra cada vacante (resultado vigente, con ajustes);
 * los re-análisis cuentan en «análisis realizados», no duplican al CV.
 */
export function resumirHistorial(registros: Registro[]) {
  // Resultado vigente por CV y vacante: el registro más reciente.
  const vigentes = new Map<string, Registro>();
  for (const r of registros) {
    const clave = `${r.cvId}:${r.vacanteId}`;
    const previo = vigentes.get(clave);
    if (!previo || r.fecha > previo.fecha) vigentes.set(clave, r);
  }

  const total: Segmento = { clave: "total", etiqueta: "Total", cvs: 0, analisis: registros.length, porCategoria: conteoVacio() };
  const porArea = new Map<string, Segmento & { cvsIds: Set<string> }>();
  const porVacante = new Map<string, Segmento & { area: string; cvsIds: Set<string> }>();
  const cvsTotales = new Set<string>();

  const segmentoArea = (area: string) => {
    let s = porArea.get(area);
    if (!s) porArea.set(area, (s = { clave: area, etiqueta: area, cvs: 0, analisis: 0, porCategoria: conteoVacio(), cvsIds: new Set() }));
    return s;
  };
  const segmentoVacante = (r: Registro) => {
    let s = porVacante.get(r.vacanteId);
    if (!s) {
      s = { clave: r.vacanteId, etiqueta: r.vacanteTitulo, area: r.area, cvs: 0, analisis: 0, porCategoria: conteoVacio(), cvsIds: new Set() };
      porVacante.set(r.vacanteId, s);
    }
    return s;
  };

  for (const r of registros) {
    segmentoArea(r.area).analisis += 1;
    segmentoVacante(r).analisis += 1;
  }
  let ajustadas = 0;
  for (const r of vigentes.values()) {
    const categoria = (CATEGORIAS as readonly string[]).includes(r.categoriaFinal) ? (r.categoriaFinal as Categoria) : "NO_VIABLE";
    if (r.ajustada) ajustadas += 1;
    total.porCategoria[categoria] += 1;
    cvsTotales.add(r.cvId);
    for (const s of [segmentoArea(r.area), segmentoVacante(r)]) {
      s.porCategoria[categoria] += 1;
      s.cvsIds.add(r.cvId);
    }
  }
  total.cvs = cvsTotales.size;
  const cerrar = <T extends { cvsIds: Set<string>; cvs: number }>(s: T) => {
    const { cvsIds, ...resto } = s;
    return { ...resto, cvs: cvsIds.size };
  };
  return {
    total,
    resultados: vigentes.size,
    ajustadas,
    porArea: [...porArea.values()].map(cerrar).sort((a, b) => b.cvs - a.cvs || a.etiqueta.localeCompare(b.etiqueta)),
    porVacante: [...porVacante.values()].map(cerrar).sort((a, b) => a.area.localeCompare(b.area) || b.cvs - a.cvs),
  };
}

/** Áreas y vacantes que aparecen en el historial (para los filtros). */
export async function opcionesDelHistorial() {
  const filas = await db.registroAnalisis.findMany({
    distinct: ["vacanteId"],
    select: { vacanteId: true, vacanteTitulo: true, area: true },
    orderBy: { vacanteTitulo: "asc" },
  });
  const areas = [...new Set(filas.map((f) => f.area))].sort((a, b) => a.localeCompare(b));
  return { areas, vacantes: filas.map((f) => ({ id: f.vacanteId, titulo: f.vacanteTitulo, area: f.area })) };
}

/** CSV del historial para auditoría (sin datos de candidatos). */
export function historialACsv(registros: Registro[]) {
  const celda = (v: string | number | boolean) => {
    const texto = String(v);
    // Comillas siempre; se neutralizan fórmulas al abrir en Excel.
    const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
    return `"${seguro.replace(/"/g, '""')}"`;
  };
  const encabezado = ["Fecha", "Área", "Vacante", "Id CV", "Id análisis", "Veredicto", "Puntaje", "Categoría al analizar", "Categoría vigente", "Ajustada", "Modelo", "Analizado por"];
  const filas = registros.map((r) =>
    [r.fecha.toISOString(), r.area, r.vacanteTitulo, r.cvId, r.analisisId, r.veredicto, r.puntaje, r.categoria, r.categoriaFinal, r.ajustada ? "Sí" : "No", r.modelo, r.usuarioNombre]
      .map(celda)
      .join(","),
  );
  // BOM para que Excel abra bien los acentos.
  return "﻿" + [encabezado.map(celda).join(","), ...filas].join("\r\n");
}
