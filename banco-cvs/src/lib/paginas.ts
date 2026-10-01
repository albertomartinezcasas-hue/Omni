import { redirect } from "next/navigation";
import { ErrorAutorizacion, requerirRol } from "@/lib/auth";
import type { Rol } from "@/lib/catalogos";

/**
 * Verificación de acceso para páginas (Server Components). Cada página la llama,
 * porque los layouts no se vuelven a ejecutar en cada navegación.
 */
export async function protegerPagina(rol: Rol) {
  try {
    return await requerirRol(rol);
  } catch (error) {
    if (error instanceof ErrorAutorizacion) {
      if (error.motivo === "NO_AUTENTICADO") redirect("/login");
      if (error.motivo === "CAMBIO_CONTRASENA_PENDIENTE") redirect("/cambiar-contrasena");
      redirect("/sin-permiso");
    }
    throw error;
  }
}
