// Historial de análisis (estadística y auditoría). Lee solo RegistroAnalisis: sin datos de candidatos.
import { esModeloLigero } from "@/lib/analizador/proveedores";
import { PREFIJO_SEUDONIMO } from "@/lib/archivos/olvido";
import { CATEGORIAS, ETIQUETA_CATEGORIA, ETIQUETA_MOTIVO_AJUSTE, type Categoria, type MotivoAjuste } from "@/lib/catalogos";
import { db } from "@/lib/db";
import { fechaDeFiltro } from "@/lib/fechas";

export type FiltrosHistorial = { desde?: string; hasta?: string; area?: string; vacanteId?: string };

export type Conteo = Record<Categoria, number>;

export type Segmento = {
  clave: string;
  etiqueta: string;
  /** CVs distintos en el segmento. */
  cvs: number;
  /** Resultados vigentes (el análisis más reciente por CV y vacante). Las categorías suman este número. */
  resultados: number;
  /** Análisis realizados, incluidos los re-análisis. */
  analisis: number;
  porCategoria: Conteo;
};

const conteoVacio = (): Conteo => Object.fromEntries(CATEGORIAS.map((c) => [c, 0])) as Conteo;
const comoCategoria = (c: string): Categoria => ((CATEGORIAS as readonly string[]).includes(c) ? (c as Categoria) : "NO_VIABLE");

function filtroWhere(f: FiltrosHistorial) {
  // Fechas del filtro en hora de CDMX (igual que la bitácora); una fecha inválida se ignora.
  const desde = fechaDeFiltro(f.desde, false);
  const hasta = fechaDeFiltro(f.hasta, true);
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

type Acumulado = Segmento & { cvsIds: Set<string> };
const nuevoSegmento = (clave: string, etiqueta: string): Acumulado => ({
  clave, etiqueta, cvs: 0, resultados: 0, analisis: 0, porCategoria: conteoVacio(), cvsIds: new Set(),
});

/**
 * Resumen segmentado por número de CVs, área y categoría.
 * La categoría de cada CV es la de su análisis más reciente contra cada vacante dentro del periodo filtrado
 * (resultado vigente, con ajustes); los re-análisis cuentan en «análisis realizados», no duplican al CV.
 * Los ajustes manuales (cantidad, motivos, cambios y tiempos de revisión) se cuentan sobre TODOS los registros del
 * periodo: re-analizar un CV no borra del resumen un ajuste que ya se hizo.
 * El historial es de auditoría: cada registro congela la categoría con los umbrales vigentes al analizar (o la del
 * ajuste manual); cambiar los umbrales después no lo recalcula.
 */
export function resumirHistorial(registros: Registro[]) {
  const vigentes = new Map<string, Registro>();
  for (const r of registros) {
    const clave = `${r.cvId}:${r.vacanteId}`;
    const previo = vigentes.get(clave);
    if (!previo || r.fecha > previo.fecha) vigentes.set(clave, r);
  }

  const total = nuevoSegmento("total", "Total");
  const porArea = new Map<string, Acumulado>();
  const porVacante = new Map<string, Acumulado & { area: string }>();
  const segArea = (r: Registro) => porArea.get(r.area) ?? porArea.set(r.area, nuevoSegmento(r.area, r.area)).get(r.area)!;
  const segVacante = (r: Registro) =>
    porVacante.get(r.vacanteId) ??
    porVacante.set(r.vacanteId, { ...nuevoSegmento(r.vacanteId, r.vacanteTitulo), area: r.area }).get(r.vacanteId)!;

  let conModeloLigero = 0;
  let conManipulacion = 0;
  for (const r of registros) {
    total.analisis += 1;
    segArea(r).analisis += 1;
    segVacante(r).analisis += 1;
    if (esModeloLigero(r.modelo)) conModeloLigero += 1;
    if (r.posibleManipulacion) conManipulacion += 1;
  }

  // Ajustes manuales (todos los del periodo): de qué categoría a cuál, y cuánto tardó en resolverse un «Pendiente de revisión».
  const cambios = new Map<string, number>();
  const motivos = new Map<string, number>();
  const horasRevision: number[] = [];
  let ajustadas = 0;
  for (const r of registros) {
    if (!r.ajustada) continue;
    ajustadas += 1;
    const clave = `${comoCategoria(r.categoria)}>${comoCategoria(r.categoriaFinal)}`;
    cambios.set(clave, (cambios.get(clave) ?? 0) + 1);
    if (r.motivoAjuste) motivos.set(r.motivoAjuste, (motivos.get(r.motivoAjuste) ?? 0) + 1);
    if (r.categoria === "REVISION" && r.horasHastaAjuste !== null) horasRevision.push(r.horasHastaAjuste);
  }

  // Categorías por CV: solo el resultado vigente de cada CV y vacante.
  let expiradas = 0;
  let pendientes = 0;
  for (const r of vigentes.values()) {
    const categoria = comoCategoria(r.categoriaFinal);
    for (const s of [total, segArea(r), segVacante(r)]) {
      s.resultados += 1;
      s.porCategoria[categoria] += 1;
      s.cvsIds.add(r.cvId);
    }
    if (categoria === "REVISION") {
      if (r.expiroSinRevision) expiradas += 1;
      else pendientes += 1;
    }
  }

  const cerrar = <T extends Acumulado>({ cvsIds, ...resto }: T) => ({ ...resto, cvs: cvsIds.size });
  return {
    total: cerrar(total),
    /** Análisis con categoría ajustada a mano en el periodo (incluye los que después se re-analizaron). */
    ajustadas,
    conModeloLigero,
    conManipulacion,
    /** Pendientes de revisión que aún pueden resolverse (su CV sigue existiendo). */
    pendientesRevision: pendientes,
    /** CVs eliminados por plazo mientras seguían pendientes de revisión. */
    expiradasSinRevision: expiradas,
    revisionesResueltas: horasRevision.length,
    horasPromedioRevision: horasRevision.length ? horasRevision.reduce((a, b) => a + b, 0) / horasRevision.length : null,
    motivosAjuste: [...motivos.entries()]
      .map(([motivo, cantidad]) => ({ motivo: ETIQUETA_MOTIVO_AJUSTE[motivo as MotivoAjuste] ?? motivo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad),
    cambiosManuales: [...cambios.entries()]
      .map(([clave, cantidad]) => {
        const [de, a] = clave.split(">") as [Categoria, Categoria];
        return { de, a, cantidad };
      })
      .sort((x, y) => y.cantidad - x.cantidad),
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

const VEREDICTO: Record<string, string> = { VIABLE: "Viable", NO_VIABLE: "No viable", REVISION: "Pendiente de revisión" };
const fechaCdmx = (d: Date) =>
  d.toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "short", timeStyle: "short" });
// Al eliminar el CV, las fechas se redondean al día: se muestra solo la fecha (sin una hora «12:00 a.m.» que no es real).
const diaCdmx = (d: Date) => d.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "short" });

/** Celda CSV entre comillas; neutraliza fórmulas aunque vengan tras espacios o saltos de línea. */
export function celdaCsv(v: string | number) {
  const texto = String(v);
  const seguro = /^[\s]*[=+\-@\t\r\n]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

/**
 * CSV del historial para auditoría: sin datos de candidatos ni ids que permitan ligarlos.
 * Las categorías quedan como se decidieron en su momento: cambiar los umbrales no las recalcula.
 */
export function historialACsv(registros: Registro[]) {
  const encabezado = [
    "Fecha (CDMX)", "Área", "Vacante", "Veredicto", "Puntaje", "Categoría al analizar", "Categoría final (al analizar o por ajuste)",
    "Ajustada", "Ajustada por", "Fecha del ajuste (CDMX)", "Motivo del ajuste", "Expiró sin revisión",
    "Posible manipulación", "Modelo", "Analizado por",
  ];
  const filas = registros.map((r) => {
    const fechaDe = r.cvId.startsWith(PREFIJO_SEUDONIMO) ? diaCdmx : fechaCdmx;
    return [
      fechaDe(r.fecha), r.area, r.vacanteTitulo, VEREDICTO[r.veredicto] ?? r.veredicto, r.puntaje,
      ETIQUETA_CATEGORIA[comoCategoria(r.categoria)], ETIQUETA_CATEGORIA[comoCategoria(r.categoriaFinal)],
      r.ajustada ? "Sí" : "No", r.ajustadaPor ?? "", r.fechaAjuste ? fechaDe(r.fechaAjuste) : "",
      r.motivoAjuste ? (ETIQUETA_MOTIVO_AJUSTE[r.motivoAjuste as MotivoAjuste] ?? r.motivoAjuste) : "",
      r.expiroSinRevision ? "Sí" : "No",
      r.posibleManipulacion ? "Sí" : "No", r.modelo, r.usuarioNombre,
    ]
      .map(celdaCsv)
      .join(",");
  });
  // BOM para que Excel abra bien los acentos.
  return "﻿" + [encabezado.map(celdaCsv).join(","), ...filas].join("\r\n");
}
