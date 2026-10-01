import { requerirRol } from "@/lib/auth";
import { listarCvs, obtenerCv } from "@/lib/archivos/servicio";
import { db } from "@/lib/db";
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

export async function consultarBitacora(filtros: { accion?: string; actorId?: string } = {}) {
  await requerirRol("ADMIN");
  return db.eventoBitacora.findMany({
    where: {
      ...(filtros.accion ? { accion: filtros.accion } : {}),
      ...(filtros.actorId ? { actorId: filtros.actorId } : {}),
    },
    orderBy: { fecha: "desc" },
    take: 200,
  });
}
