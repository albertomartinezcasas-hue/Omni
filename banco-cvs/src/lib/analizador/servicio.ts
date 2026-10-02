import { registrarEvento, type Actor } from "@/lib/bitacora";
import type { NivelEstudio, NivelIdioma } from "@/lib/catalogos";
import { db } from "@/lib/db";
import { obtenerUmbrales } from "@/lib/umbrales/servicio";
import { ErrorNegocio } from "@/lib/errores";
import { leerIdiomas, leerRequisitos } from "@/lib/vacantes/esquema";
import { ErrorApiAnalizador, solicitarExtraccion, TIEMPO_MAXIMO_MS } from "./cliente";
import { calcularCategoria } from "./categoria";
import { conLimiteDeAnalisis } from "./limite";
import { ocultarDatosPersonales } from "./ocultar";
import { mensajeUsuario, PROMPT_SISTEMA } from "./prompt";
import { esModeloLigero } from "./proveedores";
import { calificar } from "./puntaje";
import { esquemaExtraccion, type Extraccion, type VacanteEvaluada } from "./tipos";
import { neutralizarInstrucciones, verificarExtraccion } from "./verificar";

const MIN_TIEMPO_REINTENTO_MS = 5_000;

/**
 * Paso 2 — Extracción con un solo reintento si el JSON no es válido.
 * El plazo de 60 s es total: el reintento solo usa el tiempo que queda.
 */
export async function extraerEvidencia(
  vacante: VacanteEvaluada,
  textoOculto: string,
  fechaAnalisis: Date = new Date(),
) {
  const mensaje = mensajeUsuario(vacante, textoOculto, fechaAnalisis);
  const limite = Date.now() + TIEMPO_MAXIMO_MS;
  // El reintento empieza por el modelo que respondió: no se vuelve a gastar el cupo de los anteriores.
  let desde: { proveedor: string; modelo: string } | undefined;
  for (let intento = 1; intento <= 2; intento++) {
    const restante = limite - Date.now();
    if (restante < MIN_TIEMPO_REINTENTO_MS) throw new ErrorApiAnalizador("El análisis tardó más de 60 segundos.");
    const respuesta = await solicitarExtraccion(PROMPT_SISTEMA, mensaje, restante, desde);
    desde = { proveedor: respuesta.proveedor, modelo: respuesta.modeloSolicitado };
    let datos: unknown;
    try {
      datos = JSON.parse(respuesta.json);
    } catch {
      continue;
    }
    const validado = esquemaExtraccion.safeParse(datos);
    if (validado.success) {
      return {
        extraccion: validado.data as Extraccion,
        modelo: respuesta.modelo,
        proveedor: respuesta.proveedor,
      };
    }
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
  cuentanPracticas?: boolean;
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
    cuentanPracticas: v.cuentanPracticas ?? false,
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
  if (cv.sinAnalisisIA) {
    throw new ErrorNegocio("El candidato se opuso al análisis con IA: este CV solo puede evaluarlo una persona.");
  }
  if (cv.estado !== "CON_TEXTO") {
    throw new ErrorNegocio("Este CV no tiene texto legible (posible PDF escaneado) y no se puede analizar.");
  }

  const evaluada = vacanteEvaluada(vacante);
  const { texto: textoOculto, omitidos } = neutralizarInstrucciones(ocultarDatosPersonales(cv.textoExtraido));
  const fechaAnalisis = new Date();

  let ext: Awaited<ReturnType<typeof extraerEvidencia>>;
  try {
    ext = await conLimiteDeAnalisis(actor.id, cvId, vacanteId, () => extraerEvidencia(evaluada, textoOculto, fechaAnalisis));
  } catch (error) {
    if (error instanceof ErrorApiAnalizador) throw new ErrorNegocio(`${error.motivo} Usa «Reintentar».`);
    throw error;
  }
  const { extraccion, proveedor } = ext;
  const modelo = `${proveedor}:${ext.modelo}`;

  const textoOcultoOmitido = Number(cv.textoExtraido.match(/\[TEXTO OCULTO OMITIDO: (\d+) caracteres/)?.[1] ?? 0);
  const verificado = verificarExtraccion(extraccion, evaluada, textoOculto, fechaAnalisis);
  const alertasCodigo = [
    ...(textoOcultoOmitido ? [`El PDF tenía ${textoOcultoOmitido} caracteres en letra diminuta (posible texto oculto); se omitieron.`] : []),
    ...(omitidos ? [`Se ignoraron ${omitidos} renglón(es) con texto que parece una instrucción al sistema.`] : []),
  ];
  const resultado = {
    ...verificado,
    instruccionesOmitidas: omitidos,
    textoOcultoOmitido,
    alertas: [...alertasCodigo, ...(verificado.alertas ?? [])],
    proveedor,
  };
  const calificacion = calificar(resultado, {
    modeloLigero: esModeloLigero(ext.modelo),
    posibleManipulacion: omitidos > 0 || textoOcultoOmitido > 0,
  });

  // Categoría con los umbrales de este momento: queda fija en el historial.
  const categoriaAlAnalizar = calcularCategoria(calificacion.veredicto, calificacion.puntaje, await obtenerUmbrales());

  return db.$transaction(async (tx) => {
    // Se vuelve a verificar: la oposición pudo registrarse (o el CV eliminarse) mientras la IA respondía.
    const vigente = await tx.cv.findUnique({ where: { id: cvId }, select: { sinAnalisisIA: true } });
    if (!vigente) throw new ErrorNegocio("El CV ya no existe.");
    if (vigente.sinAnalisisIA) {
      throw new ErrorNegocio("El candidato se opuso al análisis con IA: este CV solo puede evaluarlo una persona.");
    }
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
    // Historial permanente (estadística y auditoría): sin datos del candidato, sobrevive a la purga.
    await tx.registroAnalisis.create({
      data: {
        analisisId: analisis.id,
        cvId,
        vacanteId,
        vacanteTitulo: vacante.titulo,
        area: vacante.area,
        fecha: analisis.creadoEn,
        veredicto: calificacion.veredicto,
        puntaje: calificacion.puntaje,
        categoria: categoriaAlAnalizar,
        categoriaFinal: categoriaAlAnalizar,
        modelo,
        usuarioId: actor.id,
        usuarioNombre: actor.nombre,
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
          ...(omitidos ? { instruccionesOmitidas: omitidos } : {}),
          ...(textoOcultoOmitido ? { textoOcultoOmitido } : {}),
        },
      },
      tx,
    );
    return analisis.id;
  });
}
