import type { Rol } from "@/lib/catalogos";
import { db } from "@/lib/db";
import { DURACION_SESION_SEGUNDOS } from "./constantes";
import { leerSesion } from "./sesion";

export type UsuarioActual = {
  id: string;
  correo: string;
  nombre: string;
  rol: Rol;
  debeCambiarContrasena: boolean;
};

export type MotivoAutorizacion = "NO_AUTENTICADO" | "CAMBIO_CONTRASENA_PENDIENTE" | "SIN_PERMISO";

export class ErrorAutorizacion extends Error {
  constructor(public motivo: MotivoAutorizacion) {
    super(motivo);
    this.name = "ErrorAutorizacion";
  }
}

/**
 * Usuario de la sesión actual, leído de la base de datos en cada llamada.
 * Devuelve null si no hay sesión, si expiró (8 h desde el inicio), si la cuenta está
 * desactivada o si la sesión fue invalidada (versionSesion distinta).
 */
export async function obtenerUsuarioActual(): Promise<UsuarioActual | null> {
  const sesion = await leerSesion();
  if (!sesion) return null;
  if (Date.now() - sesion.inicio > DURACION_SESION_SEGUNDOS * 1000) return null;

  const usuario = await db.usuario.findUnique({ where: { id: sesion.uid } });
  if (!usuario || !usuario.activo || usuario.versionSesion !== sesion.ver) return null;

  return {
    id: usuario.id,
    correo: usuario.correo,
    nombre: usuario.nombre,
    rol: usuario.rol as Rol,
    debeCambiarContrasena: usuario.debeCambiarContrasena,
  };
}

/**
 * Exige un usuario autenticado, con su contraseña temporal ya cambiada y con el rol indicado.
 * "USUARIO" admite a cualquier usuario activo; "ADMIN" solo a administradores.
 */
export async function requerirRol(rol: Rol): Promise<UsuarioActual> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new ErrorAutorizacion("NO_AUTENTICADO");
  if (usuario.debeCambiarContrasena) throw new ErrorAutorizacion("CAMBIO_CONTRASENA_PENDIENTE");
  if (rol === "ADMIN" && usuario.rol !== "ADMIN") throw new ErrorAutorizacion("SIN_PERMISO");
  return usuario;
}
