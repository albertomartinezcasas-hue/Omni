import { z } from "zod";
import { registrarEvento, type Actor } from "@/lib/bitacora";
import { db } from "@/lib/db";
import { ErrorNegocio } from "@/lib/errores";
import { eliminarArchivo, guardarArchivo, leerArchivo } from "./almacenamiento";
import { olvidarCvs } from "./olvido";
import { extraerCorreo, hashDeTexto } from "./duplicados";
import { esTextoLegible, extraerTexto } from "./extraer";
import { detectarTipo, TAMANO_MAXIMO } from "./firma";

export const ESTADO_SIN_TEXTO = "SIN_TEXTO_LEGIBLE";
export const ETIQUETA_ESTADO_CV: Record<string, string> = {
  CON_TEXTO: "Texto extraído",
  SIN_TEXTO_LEGIBLE: "Sin texto legible (posible PDF escaneado)",
};

export type CvDuplicado = {
  id: string;
  nombre: string;
  subidoPor: string;
  creadoEn: string;
  coincidencia: "correo" | "texto";
};

export type ResultadoCarga =
  | { estado: "GUARDADO"; id: string; sinTexto: boolean; sinAnalisisIA: boolean }
  | { estado: "DUPLICADO"; duplicados: CvDuplicado[] };

function limpiarNombre(nombre: string) {
  // Sin rutas, caracteres de control ni comillas; solo se guarda en la base de datos.
  const base = nombre.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 200) || "cv";
}

/**
 * Valida, extrae el texto, revisa duplicados y guarda el CV.
 * Si hay duplicados y no se pidió "Guardar de todos modos", no guarda nada.
 */
export async function subirCv(
  actor: Actor,
  entrada: { nombreArchivo: string; contenido: Buffer; forzar: boolean; sinAnalisisIA?: boolean },
): Promise<ResultadoCarga> {
  const { contenido } = entrada;
  if (contenido.length === 0) throw new ErrorNegocio("El archivo está vacío.");
  if (contenido.length > TAMANO_MAXIMO) throw new ErrorNegocio("El archivo supera 10 MB.");
  const tipo = detectarTipo(contenido);
  if (!tipo) throw new ErrorNegocio("Formato no válido: solo se aceptan PDF y DOCX.");

  let texto: string;
  try {
    texto = await extraerTexto(contenido, tipo);
  } catch {
    throw new ErrorNegocio("No se pudo leer el archivo: puede estar dañado o protegido.");
  }

  const hashTexto = hashDeTexto(texto);
  const correoCandidato = extraerCorreo(texto);

  if (!entrada.forzar) {
    const existentes = await db.cv.findMany({
      where: {
        OR: [{ hashTexto }, ...(correoCandidato ? [{ correoCandidato }] : [])],
      },
      include: { subidoPor: { select: { nombre: true } } },
      take: 5,
      orderBy: { creadoEn: "desc" },
    });
    if (existentes.length > 0) {
      return {
        estado: "DUPLICADO",
        duplicados: existentes.map((cv) => ({
          id: cv.id,
          nombre: cv.nombreCandidato ?? cv.nombreArchivo,
          subidoPor: cv.subidoPor.nombre,
          creadoEn: cv.creadoEn.toISOString(),
          coincidencia: cv.hashTexto === hashTexto ? "texto" : "correo",
        })),
      };
    }
  }

  // Si el mismo candidato (mismo texto o correo) ya se había opuesto al análisis con IA, la oposición se hereda.
  const oposicionPrevia =
    (await db.cv.count({
      where: { sinAnalisisIA: true, OR: [{ hashTexto }, ...(correoCandidato ? [{ correoCandidato }] : [])] },
    })) > 0;
  const sinAnalisisIA = entrada.sinAnalisisIA === true || oposicionPrevia;

  const sinTexto = !esTextoLegible(texto);
  const nombreArchivo = limpiarNombre(entrada.nombreArchivo);
  const archivoId = await guardarArchivo(contenido);
  try {
    const cv = await db.$transaction(async (tx) => {
      const creado = await tx.cv.create({
        data: {
          nombreArchivo,
          archivoId,
          tipo,
          tamanoBytes: contenido.length,
          textoExtraido: texto,
          hashTexto,
          correoCandidato,
          estado: sinTexto ? ESTADO_SIN_TEXTO : "CON_TEXTO",
          sinAnalisisIA,
          subidoPorId: actor.id,
        },
      });
      await registrarEvento(
        {
          actor,
          accion: "CV_SUBIDO",
          entidadTipo: "CV",
          entidadId: creado.id,
          // Sin nombre de archivo ni del candidato: la bitácora no se borra y el CV sí (minimización).
          detalle: {
            tipo,
            sinTexto,
            duplicadoConfirmado: entrada.forzar,
            ...(sinAnalisisIA ? { oposicionIA: true } : {}),
          },
        },
        tx,
      );
      return creado;
    });
    return { estado: "GUARDADO", id: cv.id, sinTexto, sinAnalisisIA };
  } catch (error) {
    await eliminarArchivo(archivoId);
    throw error;
  }
}

/** Devuelve el archivo para descarga y registra el evento. */
export async function descargarCv(actor: Actor, cvId: string) {
  const cv = await db.cv.findUnique({ where: { id: cvId } });
  if (!cv) return null;
  const contenido = await leerArchivo(cv.archivoId);
  await registrarEvento({
    actor,
    accion: "CV_DESCARGADO",
    entidadTipo: "CV",
    entidadId: cv.id,
  });
  return { contenido, nombreArchivo: cv.nombreArchivo, tipo: cv.tipo as "PDF" | "DOCX" };
}

/** Corrección manual del nombre del candidato (Usuario y Admin), con registro en la bitácora. */
export async function corregirNombreCandidato(actor: Actor, cvId: string, nombre: unknown) {
  const nuevo = z
    .string()
    .trim()
    .min(2, { error: "Escribe el nombre del candidato." })
    .max(120, { error: "El nombre es demasiado largo." })
    .parse(nombre);
  const cv = await db.cv.findUnique({ where: { id: cvId } });
  if (!cv) throw new ErrorNegocio("El CV no existe.");
  if (cv.nombreCandidato === nuevo) return;
  await db.$transaction(async (tx) => {
    await tx.cv.update({ where: { id: cvId }, data: { nombreCandidato: nuevo } });
    await registrarEvento(
      {
        actor,
        accion: "CV_NOMBRE_CORREGIDO",
        entidadTipo: "CV",
        entidadId: cvId,
      },
      tx,
    );
  });
}

/**
 * Registra (o retira) la oposición del candidato al análisis con IA (Usuario y Admin), con registro en la bitácora.
 * Con la oposición activa, el CV se conserva pero no se puede analizar.
 */
export async function marcarOposicionIA(actor: Actor, cvId: string, seOpone: boolean) {
  const cv = await db.cv.findUnique({ where: { id: cvId } });
  if (!cv) throw new ErrorNegocio("El CV no existe.");
  if (cv.sinAnalisisIA === seOpone) return;
  await db.$transaction(async (tx) => {
    await tx.cv.update({ where: { id: cvId }, data: { sinAnalisisIA: seOpone } });
    await registrarEvento(
      { actor, accion: "CV_OPOSICION_IA", entidadTipo: "CV", entidadId: cvId, detalle: { seOpone } },
      tx,
    );
  });
}

/** Eliminación definitiva (solo Admin; el permiso se verifica antes de llamar). */
export async function eliminarCv(actor: Actor, cvId: string) {
  const cv = await db.cv.findUnique({ where: { id: cvId } });
  if (!cv) throw new ErrorNegocio("El CV no existe.");
  await db.$transaction(async (tx) => {
    // Historial con seudónimo y bitácora sin datos del candidato; el evento de eliminación tampoco los guarda.
    await olvidarCvs(tx, [cvId]);
    await tx.cv.delete({ where: { id: cvId } });
    await registrarEvento({ actor, accion: "CV_ELIMINADO", entidadTipo: "CV", entidadId: cvId }, tx);
  });
  await eliminarArchivo(cv.archivoId);
}

export function listarCvs() {
  return db.cv.findMany({
    orderBy: { creadoEn: "desc" },
    take: 200,
    select: {
      id: true,
      nombreCandidato: true,
      nombreArchivo: true,
      tipo: true,
      estado: true,
      sinAnalisisIA: true,
      creadoEn: true,
      subidoPor: { select: { nombre: true } },
      _count: { select: { analisis: true } },
    },
  });
}

export function obtenerCv(id: string) {
  return db.cv.findUnique({
    where: { id },
    select: {
      id: true,
      nombreCandidato: true,
      nombreArchivo: true,
      tipo: true,
      tamanoBytes: true,
      estado: true,
      sinAnalisisIA: true,
      creadoEn: true,
      subidoPor: { select: { nombre: true } },
    },
  });
}
