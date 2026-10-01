import { z } from "zod";
import { ErrorAutorizacion, requerirRol, type UsuarioActual } from "@/lib/auth";
import type { Rol } from "@/lib/catalogos";
import { ErrorNegocio } from "@/lib/errores";

export type ResultadoAccion<T = undefined> =
  | { ok: true; datos: T; error?: undefined }
  | { ok: false; error: string; datos?: undefined };

export const MENSAJE_AUTORIZACION: Record<ErrorAutorizacion["motivo"], string> = {
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
  CAMBIO_CONTRASENA_PENDIENTE: "Debes cambiar tu contraseña temporal antes de continuar.",
  SIN_PERMISO: "No tienes permiso para realizar esta acción.",
};

/** Convierte un error en un mensaje seguro para mostrar (sin detalles internos). */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorAutorizacion) return MENSAJE_AUTORIZACION[error.motivo];
  if (error instanceof ErrorNegocio) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Datos no válidos.";
  console.error("Error inesperado:", error instanceof Error ? error.name : "desconocido");
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}

/**
 * Ejecuta una acción de servidor verificando primero el rol en el servidor.
 * Toda server action de la app pasa por aquí.
 */
export async function ejecutarAccion<T>(
  rol: Rol,
  fn: (usuario: UsuarioActual) => Promise<T>,
): Promise<ResultadoAccion<T>> {
  try {
    const usuario = await requerirRol(rol);
    return { ok: true, datos: await fn(usuario) };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

/** Convierte FormData en objeto plano (los valores repetidos se convierten en arreglo). */
export function formDataAObjeto(formData: FormData): Record<string, unknown> {
  const objeto: Record<string, unknown> = {};
  for (const [clave, valor] of formData.entries()) {
    if (clave.startsWith("$ACTION")) continue;
    if (clave in objeto) {
      const previo = objeto[clave];
      objeto[clave] = Array.isArray(previo) ? [...previo, valor] : [previo, valor];
    } else {
      objeto[clave] = valor;
    }
  }
  return objeto;
}
