"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { mensajeDeError } from "@/lib/acciones";
import { signIn, signOut } from "./config";
import { cambiarContrasenaPropia } from "./cuenta";
import { invalidarSesiones } from "./administracion";
import { obtenerUsuarioActual } from "./usuario-actual";

export type EstadoFormulario = { error?: string } | undefined;

const MENSAJE_LOGIN = "Correo o contraseña incorrectos";

export async function iniciarSesionAccion(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  try {
    await signIn("credentials", {
      correo: String(formData.get("correo") ?? ""),
      contrasena: String(formData.get("contrasena") ?? ""),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: MENSAJE_LOGIN };
    throw error;
  }
  redirect("/");
}

export async function cerrarSesionAccion() {
  const usuario = await obtenerUsuarioActual();
  if (usuario) await invalidarSesiones(usuario.id);
  await signOut({ redirect: false });
  redirect("/login");
}

/** Cambio de contraseña propio (obligatorio tras una temporal, o voluntario desde "Mi cuenta"). */
export async function cambiarContrasenaAccion(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");

  let credencial: { correo: string; nueva: string };
  try {
    credencial = await cambiarContrasenaPropia(usuario.id, {
      actual: String(formData.get("actual") ?? ""),
      nueva: String(formData.get("nueva") ?? ""),
      confirmacion: String(formData.get("confirmacion") ?? ""),
    });
  } catch (error) {
    return { error: mensajeDeError(error) };
  }

  // Las sesiones anteriores quedaron invalidadas; se emite una nueva de inmediato.
  try {
    await signIn("credentials", {
      correo: credencial.correo,
      contrasena: credencial.nueva,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login");
    throw error;
  }
  redirect("/?contrasena=actualizada");
}
