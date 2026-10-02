import { z } from "zod";
import { NIVELES_ESTUDIO, NIVELES_IDIOMA, type NivelEstudio, type NivelIdioma } from "@/lib/catalogos";

export const TIPOS_PUESTO = ["EMPLEO", "PRACTICAS", "FREELANCE"] as const;
export const ETIQUETA_TIPO_PUESTO: Record<(typeof TIPOS_PUESTO)[number], string> = {
  EMPLEO: "Empleo",
  PRACTICAS: "Prácticas profesionales",
  FREELANCE: "Independiente / freelance",
};
export const ESTATUS_ESTUDIOS = ["CONCLUIDO", "TITULADO", "EN_CURSO", "TRUNCO", "NO_ESPECIFICADO"] as const;

// --- Salida de la IA (Paso 2). Solo evidencia: la IA nunca decide veredicto ni puntaje. ---

const cita = z.string().max(600).nullable();

export const esquemaExtraccion = z.object({
  nombreCandidato: z.object({ valor: z.string().max(120).nullable(), cita }),
  requisitos: z
    .array(
      z.object({
        id: z.string().max(10),
        nivel: z.number().int().min(0).max(2),
        cita,
      }),
    )
    .max(40),
  puestos: z
    .array(
      z.object({
        puesto: z.string().max(150),
        empresa: z.string().max(150),
        tipo: z.enum(TIPOS_PUESTO),
        /** ¿Aplica al menos un requisito obligatorio o las funciones de la descripción de la vacante? */
        relevante: z.boolean(),
        justificacion: z.string().max(300),
        cita: z.string().max(600),
      }),
    )
    .max(30),
  estudios: z.object({
    nivel: z.enum([...NIVELES_ESTUDIO, "NO_ESPECIFICADO"]),
    estatus: z.enum(ESTATUS_ESTUDIOS),
    cita,
  }),
  idiomas: z
    .array(z.object({ idioma: z.string().max(40), nivel: z.enum([...NIVELES_IDIOMA, "NO_ESPECIFICADO"]), cita }))
    .max(10),
  cualidades: z.array(z.object({ cualidad: z.string().max(300), cita: z.string().max(600) })).min(3).max(5),
  brechas: z.array(z.string().max(400)).max(10),
  preguntas: z.array(z.string().max(400)).min(2).max(3),
});

export type Extraccion = z.infer<typeof esquemaExtraccion>;

// --- Vacante tal como estaba al analizar (se guarda en Analisis.vacanteSnapshot). ---

export type VacanteEvaluada = {
  id: string;
  version: number;
  titulo: string;
  area: string;
  descripcion: string;
  obligatorios: { id: string; texto: string }[];
  deseables: { id: string; texto: string }[];
  aniosMinimos: number;
  nivelEstudiosMinimo: NivelEstudio;
  idiomas: { idioma: string; nivel: NivelIdioma }[];
  modalidad: string;
  ubicacion: string;
};

// --- Resultado verificado (Paso 3) que se guarda en Analisis.resultado. ---

export type RequisitoEvaluado = {
  id: string;
  tipo: "OBLIGATORIO" | "DESEABLE";
  texto: string;
  nivel: 0 | 1 | 2;
  cita: string | null;
  /** La IA dio una cita que no aparece en el CV: el nivel se bajó a 0. */
  citaNoVerificada: boolean;
};

export type ResultadoVerificado = {
  nombreCandidato: string | null;
  /** Renglones del CV omitidos por parecer instrucciones al sistema (posible inyección). */
  instruccionesOmitidas?: number;
  /** Caracteres en letra diminuta omitidos al extraer el PDF (posible texto oculto). */
  textoOcultoOmitido?: number;
  requisitos: RequisitoEvaluado[];
  experiencia: {
    anios: number;
    /** Meses verificables sin traslapes (para mostrar con precisión). */
    meses: number;
    minimo: number;
    puestos: {
      puesto: string;
      empresa: string;
      tipo: (typeof TIPOS_PUESTO)[number];
      /** Periodo calculado en código a partir de las fechas de la cita. */
      inicio: string;
      fin: string;
      anios: number;
      /** La cita no trae meses: se contó de forma conservadora; confirmar en entrevista. */
      fechasSinMes: boolean;
      justificacion: string;
      cita: string;
    }[];
    /** Puestos verificados que la IA no consideró relevantes: no suman años, pero quedan visibles. */
    puestosNoRelevantes?: {
      puesto: string;
      empresa: string;
      inicio: string;
      fin: string;
      meses: number;
      justificacion: string;
      cita: string;
    }[];
    puestosDescartados: number;
    /** Por qué se descartó cada puesto que la IA reportó (para revisar el CV). */
    descartes?: { puesto: string; empresa: string; motivo: string; cita: string }[];
    fechaAnalisis: string;
  };
  estudios: {
    requerido: NivelEstudio;
    encontrado: NivelEstudio | "NO_ESPECIFICADO";
    estatus: (typeof ESTATUS_ESTUDIOS)[number];
    cita: string | null;
  };
  idiomas: { idioma: string; requerido: NivelIdioma; encontrado: NivelIdioma | "NO_ESPECIFICADO"; cita: string | null }[];
  cualidades: { cualidad: string; cita: string }[];
  cualidadesDescartadas: number;
  brechas: string[];
  preguntas: string[];
};
