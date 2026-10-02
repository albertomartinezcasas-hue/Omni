import { registrarEvento, type Actor } from "@/lib/bitacora";
import type { NivelEstudio, NivelIdioma } from "@/lib/catalogos";
import { db } from "@/lib/db";
import { ErrorNegocio } from "@/lib/errores";
import { leerIdiomas, leerRequisitos } from "@/lib/vacantes/esquema";
import { ErrorApiAnalizador, solicitarExtraccion } from "./cliente";
import { ocultarDatosPersonales } from "./ocultar";
import { mensajeUsuario, PROMPT_SISTEMA } from "./prompt";
import { calificar } from "./puntaje";
import { esquemaExtraccion, type Extraccion, type VacanteEvaluada } from "./tipos";
import { verificarExtraccion } from "./verificar";

/** Paso 2 — Extracción con un solo reintento si el JSON no es válido. */
export async function extraerEvidencia(vacante: VacanteEvaluada, textoOculto: string) {
  const usuario = mensajeUsuario(vacante, textoOculto);
  for (let intento = 1; intento <= 2; intento++) {
    const { json, modelo } = await solicitarExtraccion(PROMPT_SISTEMA, usuario);
    let datos: unknown;
    try {
      datos = JSON.parse(json);
    } catch {
      continue;
    }
    const validado = esquemaExtraccion.safeParse(datos);
    if (validado.success) return { extraccion: validado.data as Extraccion, modelo };
  }
  throw new ErrorApiAnalizador("La respuesta del análisis no tuvo el formato esperado.");
}

export function vacanteEvaluada(v: {
  id: string;
  version: number;
  titulo: string;
  area: string;
  descripcion: string;
  requisitosObligatorios: string;
  requisitosDeseables: string;
  aniosMinimos: number;
  nivelEstudiosMinimo: string;
  idiomas: string;
  modalidad: string;
  ubicacion: string;
}): VacanteEvaluada {
  return {
    id: v.id,
    version: v.version,
    titulo: v.titulo,
    area: v.area,
    descripcion: v.descripcion,
    obligatorios: leerRequisitos(v.requisitosObligatorios),
    deseables: leerRequisitos(v.requisitosDeseables),
    aniosMinimos: v.aniosMinimos,
    nivelEstudiosMinimo: v.nivelEstudiosMinimo as NivelEstudio,
    idiomas: leerIdiomas(v.idiomas).map((i) => ({ idioma: i.idioma, nivel: i.nivel as NivelIdioma })),
    modalidad: v.modalidad,
    ubicacion: v.ubicacion,
  };
}

/**
 * Analiza un CV contra una vacante (Pasos 1 a 6). Si algo falla no se guarda nada parcial.
 * Devuelve el id del análisis guardado.
 */
export async function analizarCv(actor: Actor, cvId: string, vacanteId: string) {
  const [cv, vacante] = await Promise.all([
    db.cv.findUnique({ where: { id: cvId } }),
    db.vacante.findUnique({ where: { id: vacanteId } }),
  ]);
  if (!cv) throw new ErrorNegocio("El CV no existe.");
  if (!vacante) throw new ErrorNegocio("La vacante no existe.");
  if (vacante.estado === "ARCHIVADA") throw new ErrorNegocio("La vacante está archivada y es de solo lectura.");
  if (cv.estado !== "CON_TEXTO") {
    throw new ErrorNegocio("Este CV no tiene texto legible (posible PDF escaneado) y no se puede analizar.");
  }

  const evaluada = vacanteEvaluada(vacante);
  const textoOculto = ocultarDatosPersonales(cv.textoExtraido);

  let extraccion: Extraccion;
  let modelo: string;
  try {
    ({ extraccion, modelo } = await extraerEvidencia(evaluada, textoOculto));
  } catch (error) {
    if (error instanceof ErrorApiAnalizador) throw new ErrorNegocio(`${error.motivo} Usa «Reintentar».`);
    throw error;
  }

  const resultado = verificarExtraccion(extraccion, evaluada, textoOculto);
  const calificacion = calificar(resultado);

  return db.$transaction(async (tx) => {
    const analisis = await tx.analisis.create({
      data: {
        cvId,
        vacanteId,
        vacanteVersion: vacante.version,
        vacanteSnapshot: JSON.stringify(evaluada),
        modelo,
        creadoPorId: actor.id,
        veredicto: calificacion.veredicto,
        motivosNoViable: JSON.stringify(calificacion.motivosNoViable),
        puntaje: calificacion.puntaje,
        puntajeO: calificacion.O,
        puntajeD: calificacion.D,
        puntajeE: calificacion.E,
        puntajeF: calificacion.F,
        resultado: JSON.stringify(resultado),
      },
    });
    if (!cv.nombreCandidato && resultado.nombreCandidato) {
      await tx.cv.update({ where: { id: cvId }, data: { nombreCandidato: resultado.nombreCandidato } });
    }
    await registrarEvento(
      {
        actor,
        accion: "ANALISIS_REALIZADO",
        entidadTipo: "ANALISIS",
        entidadId: analisis.id,
        detalle: {
          cv: cv.nombreCandidato ?? resultado.nombreCandidato ?? cv.nombreArchivo,
          vacante: vacante.titulo,
          veredicto: calificacion.veredicto,
          puntaje: calificacion.puntaje,
          modelo,
        },
      },
      tx,
    );
    return analisis.id;
  });
}
