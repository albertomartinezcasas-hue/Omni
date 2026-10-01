"use server";

import { revalidatePath } from "next/cache";
import { ejecutarAccion, formDataAObjeto } from "@/lib/acciones";
import { restablecerContrasena } from "@/lib/auth/administracion";
import {
  cambiarRol,
  crearUsuario,
  desactivarUsuario,
  reactivarUsuario,
} from "@/lib/usuarios/servicio";

const RUTA = "/admin/usuarios";

export async function crearUsuarioAccion(_previo: unknown, formData: FormData) {
  const resultado = await ejecutarAccion("ADMIN", (actor) =>
    crearUsuario(actor, formDataAObjeto(formData)),
  );
  if (resultado.ok) revalidatePath(RUTA);
  return resultado;
}

export async function cambiarRolAccion(usuarioId: string, rol: string) {
  const resultado = await ejecutarAccion("ADMIN", (actor) => cambiarRol(actor, usuarioId, rol));
  if (resultado.ok) revalidatePath(RUTA);
  return resultado;
}

export async function desactivarUsuarioAccion(usuarioId: string) {
  const resultado = await ejecutarAccion("ADMIN", (actor) => desactivarUsuario(actor, usuarioId));
  if (resultado.ok) revalidatePath(RUTA);
  return resultado;
}

export async function reactivarUsuarioAccion(usuarioId: string) {
  const resultado = await ejecutarAccion("ADMIN", (actor) => reactivarUsuario(actor, usuarioId));
  if (resultado.ok) revalidatePath(RUTA);
  return resultado;
}

export async function restablecerContrasenaAccion(usuarioId: string) {
  const resultado = await ejecutarAccion("ADMIN", (actor) =>
    restablecerContrasena(actor, usuarioId),
  );
  if (resultado.ok) revalidatePath(RUTA);
  return resultado;
}
