import { requerirRol } from "@/lib/auth";
import {
  analisisDeCv,
  buscarCvs,
  candidatosDeVacante,
  detalleAnalisis,
  type FiltrosRepositorio,
} from "@/lib/analisis/consultas";
import { listarCvs, obtenerCv } from "@/lib/archivos/servicio";
import { db } from "@/lib/db";
import { opcionesDelHistorial, registrosDelHistorial, resumirHistorial, type FiltrosHistorial } from "@/lib/historial";
import { obtenerUmbrales } from "@/lib/umbrales/servicio";
import { listarUsuarios } from "@/lib/usuarios/servicio";
import { listarVacantes, obtenerVacante } from "@/lib/vacantes/servicio";

// Consultas para páginas. Cada una vuelve a verificar el rol en el servidor.

export async function consultarVacantes(estado: "ACTIVA" | "ARCHIVADA") {
  await requerirRol("USUARIO");
  return listarVacantes(estado);
}

export async function consultarVacante(id: string) {
  await requerirRol("USUARIO");
  return obtenerVacante(id);
}

export async function consultarCvs() {
  await requerirRol("USUARIO");
  return listarCvs();
}

export async function consultarCv(id: string) {
  await requerirRol("USUARIO");
  return obtenerCv(id);
}

export async function consultarUsuarios() {
  await requerirRol("ADMIN");
  return listarUsuarios();
}

export async function consultarBitacora(
  filtros: { accion?: string; actorId?: string; desde?: string; hasta?: string } = {},
) {
  await requerirRol("ADMIN");
  const fecha = (v: string | undefined, fin: boolean) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${fin ? "23:59:59.999" : "00:00:00.000"}-06:00`) : undefined;
  const desde = fecha(filtros.desde, false);
  const hasta = fecha(filtros.hasta, true);
  return db.eventoBitacora.findMany({
    where: {
      ...(filtros.accion ? { accion: filtros.accion } : {}),
      ...(filtros.actorId ? { actorId: filtros.actorId } : {}),
      ...(desde || hasta ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
    },
    orderBy: { fecha: "desc" },
    take: 200,
  });
}

export async function consultarCandidatos(vacanteId: string, versionActual: number) {
  await requerirRol("USUARIO");
  return candidatosDeVacante(vacanteId, versionActual);
}

export async function consultarAnalisis(id: string) {
  await requerirRol("USUARIO");
  return detalleAnalisis(id);
}

export async function consultarAnalisisDeCv(cvId: string) {
  await requerirRol("USUARIO");
  return analisisDeCv(cvId);
}

export async function consultarRepositorio(filtros: FiltrosRepositorio) {
  await requerirRol("USUARIO");
  return buscarCvs(filtros);
}

/** Personas que han subido CVs (para el filtro del repositorio). */
export async function consultarPersonasQueSubieron() {
  await requerirRol("USUARIO");
  return db.usuario.findMany({
    where: { cvsSubidos: { some: {} } },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}

export async function consultarUmbrales() {
  await requerirRol("USUARIO");
  return obtenerUmbrales();
}

export async function consultarUmbralesAdmin() {
  await requerirRol("ADMIN");
  return db.configuracionUmbrales.findUnique({
    where: { id: 1 },
    include: { actualizadoPor: { select: { nombre: true } } },
  });
}

/** Lista de usuarios para el filtro de la bitácora (solo Admin). */
export async function consultarActores() {
  await requerirRol("ADMIN");
  return db.usuario.findMany({ select: { id: true, nombre: true, correo: true }, orderBy: { nombre: "asc" } });
}

/** Historial de análisis segmentado (solo Admin: auditoría). */
export async function consultarHistorial(filtros: FiltrosHistorial) {
  await requerirRol("ADMIN");
  const [registros, opciones] = await Promise.all([registrosDelHistorial(filtros), opcionesDelHistorial()]);
  return { resumen: resumirHistorial(registros), opciones };
}
