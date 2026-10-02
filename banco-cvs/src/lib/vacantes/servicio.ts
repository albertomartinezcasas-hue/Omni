import { registrarEvento, type Actor } from "@/lib/bitacora";
import { db } from "@/lib/db";
import { ErrorNegocio } from "@/lib/errores";
import { aRequisitos, esquemaVacante, leerIdiomas, leerRequisitos } from "./esquema";

function aRegistro(entrada: unknown) {
  const d = esquemaVacante.parse(entrada);
  return {
    titulo: d.titulo,
    area: d.area,
    descripcion: d.descripcion,
    requisitosObligatorios: JSON.stringify(aRequisitos(d.requisitosObligatorios, "O")),
    requisitosDeseables: JSON.stringify(aRequisitos(d.requisitosDeseables, "D")),
    aniosMinimos: d.aniosMinimos,
    cuentanPracticas: d.cuentanPracticas,
    nivelEstudiosMinimo: d.nivelEstudiosMinimo,
    idiomas: JSON.stringify(d.idiomas),
    modalidad: d.modalidad,
    ubicacion: d.ubicacion,
  };
}

export async function crearVacante(actor: Actor, entrada: unknown) {
  const datos = aRegistro(entrada);
  return db.$transaction(async (tx) => {
    const vacante = await tx.vacante.create({
      data: { ...datos, creadoPorId: actor.id, actualizadoPorId: actor.id },
    });
    await registrarEvento(
      {
        actor,
        accion: "VACANTE_CREADA",
        entidadTipo: "VACANTE",
        entidadId: vacante.id,
        detalle: { titulo: vacante.titulo },
      },
      tx,
    );
    return vacante;
  });
}

const ETIQUETA_CAMPO: Record<string, string> = {
  titulo: "título",
  area: "área",
  descripcion: "descripción",
  requisitosObligatorios: "requisitos obligatorios",
  requisitosDeseables: "requisitos deseables",
  aniosMinimos: "años mínimos",
  cuentanPracticas: "cuentan prácticas y servicio social",
  nivelEstudiosMinimo: "estudios mínimos",
  idiomas: "idiomas",
  modalidad: "modalidad",
  ubicacion: "ubicación",
};

/**
 * Editar incrementa la versión: los análisis previos quedan "Desactualizados".
 * Si no cambió ningún campo, no se guarda nada ni se registra en la bitácora.
 */
export async function editarVacante(actor: Actor, vacanteId: string, entrada: unknown) {
  const datos = aRegistro(entrada);
  return db.$transaction(async (tx) => {
    const actual = await tx.vacante.findUnique({ where: { id: vacanteId } });
    if (!actual) throw new ErrorNegocio("La vacante no existe.");
    if (actual.estado === "ARCHIVADA") {
      throw new ErrorNegocio("La vacante está archivada y es de solo lectura.");
    }
    const cambios = (Object.keys(datos) as (keyof typeof datos)[])
      .filter((campo) => String(actual[campo]) !== String(datos[campo]))
      .map((campo) => ({ campo: ETIQUETA_CAMPO[campo], anterior: actual[campo], nuevo: datos[campo] }));
    if (cambios.length === 0) return actual;

    const vacante = await tx.vacante.update({
      where: { id: vacanteId },
      data: { ...datos, actualizadoPorId: actor.id, version: { increment: 1 } },
    });
    await registrarEvento(
      {
        actor,
        accion: "VACANTE_EDITADA",
        entidadTipo: "VACANTE",
        entidadId: vacanteId,
        detalle: { titulo: vacante.titulo, version: vacante.version, cambios },
      },
      tx,
    );
    return vacante;
  });
}

export async function archivarVacante(actor: Actor, vacanteId: string) {
  await db.$transaction(async (tx) => {
    const actual = await tx.vacante.findUnique({ where: { id: vacanteId } });
    if (!actual) throw new ErrorNegocio("La vacante no existe.");
    if (actual.estado === "ARCHIVADA") return;
    await tx.vacante.update({
      where: { id: vacanteId },
      data: { estado: "ARCHIVADA", archivadaEn: new Date(), actualizadoPorId: actor.id },
    });
    await registrarEvento(
      {
        actor,
        accion: "VACANTE_ARCHIVADA",
        entidadTipo: "VACANTE",
        entidadId: vacanteId,
        detalle: { titulo: actual.titulo },
      },
      tx,
    );
  });
}

export function listarVacantes(estado: "ACTIVA" | "ARCHIVADA") {
  return db.vacante.findMany({
    where: { estado },
    orderBy: { actualizadoEn: "desc" },
    include: { _count: { select: { analisis: true } } },
  });
}

export async function obtenerVacante(id: string) {
  const vacante = await db.vacante.findUnique({
    where: { id },
    include: {
      creadoPor: { select: { nombre: true } },
      actualizadoPor: { select: { nombre: true } },
    },
  });
  if (!vacante) return null;
  return {
    ...vacante,
    obligatorios: leerRequisitos(vacante.requisitosObligatorios),
    deseables: leerRequisitos(vacante.requisitosDeseables),
    listaIdiomas: leerIdiomas(vacante.idiomas),
  };
}

/** Exige que la vacante exista y esté activa (para subir y analizar CVs o ajustar categorías). */
export async function exigirVacanteActiva(vacanteId: string) {
  const vacante = await db.vacante.findUnique({ where: { id: vacanteId } });
  if (!vacante) throw new ErrorNegocio("La vacante no existe.");
  if (vacante.estado === "ARCHIVADA") {
    throw new ErrorNegocio("La vacante está archivada y es de solo lectura.");
  }
  return vacante;
}
