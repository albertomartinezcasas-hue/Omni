import { categoriaMostrada, type AjusteVigente } from "@/lib/analizador/categoria";
import type { ResultadoVerificado, VacanteEvaluada } from "@/lib/analizador/tipos";
import { CATEGORIAS, type Categoria } from "@/lib/catalogos";
import { db } from "@/lib/db";
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
  categoria: ReturnType<typeof categoriaMostrada>;
};

/**
 * Candidatos de una vacante: el análisis más reciente de cada CV, agrupado por categoría
 * (la ajustada manualmente prevalece) y ordenado por puntaje.
 */
export async function candidatosDeVacante(vacanteId: string, versionActual: number) {
  const umbrales = await obtenerUmbrales();
  const analisis = await db.analisis.findMany({
    where: { vacanteId },
    orderBy: { creadoEn: "desc" },
    include: { cv: { select: { id: true, nombreCandidato: true, nombreArchivo: true } }, ...incluirAjuste },
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
      categoria: categoriaMostrada(a, umbrales, ajusteVigente(a.ajustes)),
    });
  }
  filas.sort((x, y) => y.puntaje - x.puntaje);
  const grupos = Object.fromEntries(CATEGORIAS.map((c) => [c, [] as FilaCandidato[]])) as Record<Categoria, FilaCandidato[]>;
  for (const f of filas) grupos[f.categoria.final].push(f);
  return { grupos, total: filas.length, umbrales };
}

/** Detalle completo de un análisis, con su vacante (copia y estado actual) y ajustes. */
export async function detalleAnalisis(id: string) {
  const a = await db.analisis.findUnique({
    where: { id },
    include: {
      cv: { select: { id: true, nombreCandidato: true, nombreArchivo: true } },
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
  const q = f.q?.trim();
  const fecha = (valor: string | undefined, finDelDia: boolean) => {
    if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined;
    // Fechas capturadas en CDMX (UTC−6).
    return new Date(`${valor}T${finDelDia ? "23:59:59.999" : "00:00:00.000"}-06:00`);
  };
  const desde = fecha(f.desde, false);
  const hasta = fecha(f.hasta, true);

  const cvs = await db.cv.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { nombreCandidato: { contains: q } },
              { nombreArchivo: { contains: q } },
              { textoExtraido: { contains: q } },
            ],
          }
        : {}),
      ...(f.subidoPorId ? { subidoPorId: f.subidoPorId } : {}),
      ...(desde || hasta ? { creadoEn: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
      ...(f.vacanteId ? { analisis: { some: { vacanteId: f.vacanteId } } } : {}),
    },
    orderBy: { creadoEn: "desc" },
    take: 300,
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
    vacante: a.vacante,
    puntaje: a.puntaje,
    creadoEn: a.creadoEn,
    desactualizado: a.vacanteVersion !== a.vacante.version,
    categoria: categoriaMostrada(a, umbrales, ajusteVigente(a.ajustes)),
  }));
}
