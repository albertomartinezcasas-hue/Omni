import { categoriaMostrada, type AjusteVigente } from "@/lib/analizador/categoria";
import { esModeloLigero } from "@/lib/analizador/proveedores";
import { diasDeConservacion, fechaDeEliminacion } from "@/lib/archivos/conservacion";
import type { ResultadoVerificado, VacanteEvaluada } from "@/lib/analizador/tipos";
import { CATEGORIAS, type Categoria } from "@/lib/catalogos";
import { db } from "@/lib/db";
import { fechaDeFiltro } from "@/lib/fechas";
import { obtenerUmbrales, type Umbrales } from "@/lib/umbrales/servicio";

const incluirAjuste = {
  ajustes: {
    orderBy: { creadoEn: "desc" as const },
    take: 1,
    include: { autor: { select: { nombre: true } } },
  },
};

function ajusteVigente(ajustes: { categoria: string; comentario: string; creadoEn: Date; autor: { nombre: string } }[]): AjusteVigente {
  const a = ajustes[0];
  return a ? { categoria: a.categoria, comentario: a.comentario, autor: a.autor.nombre, creadoEn: a.creadoEn } : null;
}

function resumenClave(r: ResultadoVerificado): FilaCandidato["clave"] {
  const obligatorios = (r.requisitos ?? []).filter((q) => q.tipo === "OBLIGATORIO");
  return {
    obligatorios: {
      demostrados: obligatorios.filter((q) => q.nivel === 2).length,
      mencionados: obligatorios.filter((q) => q.nivel === 1).length,
      sin: obligatorios.filter((q) => q.nivel === 0).length,
    },
    meses: r.experiencia?.meses ?? Math.round((r.experiencia?.anios ?? 0) * 12),
    minimo: r.experiencia?.minimo ?? 0,
    idiomas: (r.idiomas ?? []).map((i) => ({ idioma: i.idioma, encontrado: i.encontrado })),
    estudios: { encontrado: r.estudios?.encontrado ?? "NO_ESPECIFICADO", estatus: r.estudios?.estatus ?? "NO_ESPECIFICADO" },
    posibleManipulacion: (r.instruccionesOmitidas ?? 0) > 0 || (r.textoOcultoOmitido ?? 0) > 0,
  };
}

export type FilaCandidato = {
  analisisId: string;
  cvId: string;
  candidato: string;
  puntaje: number;
  veredicto: string;
  motivos: string[];
  O: number;
  D: number | null;
  E: number;
  F: number;
  creadoEn: Date;
  desactualizado: boolean;
  /** El candidato se opuso al análisis con IA: no se puede re-analizar. */
  sinAnalisisIA: boolean;
  /** Cuándo se eliminará el CV por el plazo de conservación (null si el plazo no es válido). */
  seElimina: Date | null;
  categoria: ReturnType<typeof categoriaMostrada>;
  /** Resumen para comparar sin abrir cada análisis. */
  clave: {
    obligatorios: { demostrados: number; mencionados: number; sin: number };
    meses: number;
    minimo: number;
    idiomas: { idioma: string; encontrado: string }[];
    estudios: { encontrado: string; estatus: string };
    /** El CV traía texto oculto o renglones con instrucciones al sistema. */
    posibleManipulacion: boolean;
  };
};

/**
 * Candidatos de una vacante: el análisis más reciente de cada CV, agrupado por categoría
 * (la ajustada manualmente prevalece) y ordenado por puntaje.
 */
export async function candidatosDeVacante(vacanteId: string, versionActual: number) {
  const umbrales = await obtenerUmbrales();
  const dias = diasDeConservacion();
  const analisis = await db.analisis.findMany({
    where: { vacanteId },
    orderBy: { creadoEn: "desc" },
    include: {
      cv: {
        select: {
          id: true,
          nombreCandidato: true,
          nombreArchivo: true,
          sinAnalisisIA: true,
          creadoEn: true,
          // Último análisis contra cualquier vacante: define cuándo se elimina el CV.
          analisis: { orderBy: { creadoEn: "desc" }, take: 1, select: { creadoEn: true } },
        },
      },
      ...incluirAjuste,
    },
  });
  const vistos = new Set<string>();
  const filas: FilaCandidato[] = [];
  for (const a of analisis) {
    if (vistos.has(a.cvId)) continue;
    vistos.add(a.cvId);
    filas.push({
      analisisId: a.id,
      cvId: a.cvId,
      candidato: a.cv.nombreCandidato ?? a.cv.nombreArchivo,
      puntaje: a.puntaje,
      veredicto: a.veredicto,
      motivos: JSON.parse(a.motivosNoViable) as string[],
      O: a.puntajeO,
      D: a.puntajeD,
      E: a.puntajeE,
      F: a.puntajeF,
      creadoEn: a.creadoEn,
      desactualizado: a.vacanteVersion !== versionActual,
      sinAnalisisIA: a.cv.sinAnalisisIA,
      seElimina:
        dias === null
          ? null
          : fechaDeEliminacion(new Date(Math.max(a.cv.creadoEn.getTime(), a.cv.analisis[0]?.creadoEn.getTime() ?? 0)), dias),
      categoria: categoriaMostrada(a, umbrales, ajusteVigente(a.ajustes)),
      clave: resumenClave(JSON.parse(a.resultado) as ResultadoVerificado),
    });
  }
  filas.sort((x, y) => y.puntaje - x.puntaje);
  // Pendientes de revisión hechos con un modelo ligero (p. ej. por saturación de los modelos completos).
  const modeloPorAnalisis = new Map(analisis.map((a) => [a.id, a.modelo]));
  const pendientesLigeros = filas.filter(
    (f) => f.categoria.final === "REVISION" && esModeloLigero(modeloPorAnalisis.get(f.analisisId) ?? ""),
  ).length;
  const grupos = Object.fromEntries(CATEGORIAS.map((c) => [c, [] as FilaCandidato[]])) as Record<Categoria, FilaCandidato[]>;
  for (const f of filas) grupos[f.categoria.final].push(f);
  return { grupos, total: filas.length, umbrales, pendientesLigeros };
}

/** Detalle completo de un análisis, con su vacante (copia y estado actual) y ajustes. */
export async function detalleAnalisis(id: string) {
  const a = await db.analisis.findUnique({
    where: { id },
    include: {
      cv: { select: { id: true, nombreCandidato: true, nombreArchivo: true, estado: true, sinAnalisisIA: true } },
      vacante: { select: { id: true, titulo: true, version: true, estado: true } },
      creadoPor: { select: { nombre: true } },
      ajustes: { orderBy: { creadoEn: "desc" }, include: { autor: { select: { nombre: true } } } },
    },
  });
  if (!a) return null;
  const umbrales = await obtenerUmbrales();

  // Ajustes hechos en análisis anteriores del mismo CV y vacante (quedan ocultos al re-analizar).
  const ajustesPrevios = await db.ajusteCategoria.findMany({
    where: { analisis: { cvId: a.cvId, vacanteId: a.vacanteId, creadoEn: { lt: a.creadoEn } } },
    orderBy: { creadoEn: "desc" },
    take: 3,
    include: { autor: { select: { nombre: true } }, analisis: { select: { id: true } } },
  });

  return {
    ...a,
    resultado: JSON.parse(a.resultado) as ResultadoVerificado,
    vacanteSnapshot: JSON.parse(a.vacanteSnapshot) as VacanteEvaluada,
    motivos: JSON.parse(a.motivosNoViable) as string[],
    desactualizado: a.vacanteVersion !== a.vacante.version,
    categoria: categoriaMostrada(a, umbrales, ajusteVigente(a.ajustes)),
    umbrales,
    ajustesPrevios,
  };
}

const LIMITE_REPOSITORIO = 300;

/** Minúsculas y sin acentos: «HÉCTOR NÚÑEZ» → «hector nunez». */
export function normalizarBusqueda(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export type FiltrosRepositorio = {
  q?: string;
  vacanteId?: string;
  categoria?: string;
  desde?: string;
  hasta?: string;
  subidoPorId?: string;
};

/**
 * Repositorio: búsqueda por nombre y palabra clave; filtros por vacante, categoría, fecha de carga
 * y persona que lo subió. La categoría se calcula con el análisis más reciente del CV para la vacante elegida.
 */
export async function buscarCvs(f: FiltrosRepositorio) {
  const q = f.q ? normalizarBusqueda(f.q.trim()) : "";
  // Fechas capturadas en CDMX (UTC−6); una fecha inválida se ignora.
  const desde = fechaDeFiltro(f.desde, false);
  const hasta = fechaDeFiltro(f.hasta, true);
  const filtros = {
    ...(f.subidoPorId ? { subidoPorId: f.subidoPorId } : {}),
    ...(desde || hasta ? { creadoEn: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
    ...(f.vacanteId ? { analisis: { some: { vacanteId: f.vacanteId } } } : {}),
  };

  // SQLite no compara sin acentos: la palabra clave se busca en memoria (los CVs se conservan pocos días).
  let ids: string[] | undefined;
  if (q) {
    const candidatos = await db.cv.findMany({
      where: filtros,
      orderBy: { creadoEn: "desc" },
      select: { id: true, nombreCandidato: true, nombreArchivo: true, textoExtraido: true },
    });
    ids = candidatos
      .filter((c) => [c.nombreCandidato, c.nombreArchivo, c.textoExtraido].some((t) => t && normalizarBusqueda(t).includes(q)))
      .slice(0, LIMITE_REPOSITORIO)
      .map((c) => c.id);
  }

  const cvs = await db.cv.findMany({
    where: { ...filtros, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { creadoEn: "desc" },
    take: LIMITE_REPOSITORIO,
    select: {
      id: true,
      nombreCandidato: true,
      nombreArchivo: true,
      tipo: true,
      estado: true,
      creadoEn: true,
      subidoPor: { select: { nombre: true } },
      analisis: {
        where: f.vacanteId ? { vacanteId: f.vacanteId } : {},
        orderBy: { creadoEn: "desc" },
        take: 1,
        select: {
          id: true,
          puntaje: true,
          veredicto: true,
          vacante: { select: { titulo: true } },
          ...incluirAjuste,
        },
      },
      _count: { select: { analisis: true } },
    },
  });

  const umbrales: Umbrales = await obtenerUmbrales();
  const filas = cvs.map((cv) => {
    const ultimo = cv.analisis[0];
    return {
      ...cv,
      ultimo: ultimo
        ? {
            id: ultimo.id,
            puntaje: ultimo.puntaje,
            vacante: ultimo.vacante.titulo,
            categoria: categoriaMostrada(ultimo, umbrales, ajusteVigente(ultimo.ajustes)),
          }
        : null,
    };
  });
  return f.vacanteId && f.categoria && (CATEGORIAS as readonly string[]).includes(f.categoria)
    ? filas.filter((c) => c.ultimo?.categoria.final === f.categoria)
    : filas;
}

/** Análisis de un CV (para su página de detalle). */
export async function analisisDeCv(cvId: string) {
  const umbrales = await obtenerUmbrales();
  const lista = await db.analisis.findMany({
    where: { cvId },
    orderBy: { creadoEn: "desc" },
    include: { vacante: { select: { id: true, titulo: true, version: true, estado: true } }, ...incluirAjuste },
  });
  return lista.map((a) => ({
    id: a.id,
    posibleManipulacion: resumenClave(JSON.parse(a.resultado) as ResultadoVerificado).posibleManipulacion,
    vacante: a.vacante,
    puntaje: a.puntaje,
    creadoEn: a.creadoEn,
    desactualizado: a.vacanteVersion !== a.vacante.version,
    categoria: categoriaMostrada(a, umbrales, ajusteVigente(a.ajustes)),
  }));
}
