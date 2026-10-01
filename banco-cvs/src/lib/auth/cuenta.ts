import { z } from "zod";
import { registrarEvento } from "@/lib/bitacora";
import { db } from "@/lib/db";
import { ErrorNegocio } from "@/lib/errores";
import { compararContrasena, esquemaContrasenaNueva, hashContrasena } from "./contrasenas";

export const esquemaCambioContrasena = z
  .object({
    actual: z.string().min(1, { error: "Escribe tu contraseña actual." }).max(1024),
    nueva: esquemaContrasenaNueva,
    confirmacion: z.string().max(1024),
  })
  .refine((d) => d.nueva === d.confirmacion.normalize("NFC"), {
    error: "La confirmación no coincide con la nueva contraseña.",
    path: ["confirmacion"],
  });

/**
 * Cambia la contraseña del propio usuario. Quita la marca de contraseña temporal
 * e invalida las sesiones anteriores. Devuelve la nueva contraseña normalizada
 * para volver a iniciar sesión de inmediato.
 */
export async function cambiarContrasenaPropia(usuarioId: string, entrada: unknown) {
  const datos = esquemaCambioContrasena.parse(entrada);
  const usuario = await db.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario || !usuario.activo || !usuario.hashContrasena) {
    throw new ErrorNegocio("No se pudo cambiar la contraseña.");
  }
  if (!(await compararContrasena(datos.actual, usuario.hashContrasena))) {
    throw new ErrorNegocio("La contraseña actual no es correcta.");
  }
  if (await compararContrasena(datos.nueva, usuario.hashContrasena)) {
    throw new ErrorNegocio("La nueva contraseña debe ser distinta de la actual.");
  }
  const hash = await hashContrasena(datos.nueva);
  await db.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        hashContrasena: hash,
        debeCambiarContrasena: false,
        versionSesion: { increment: 1 },
      },
    });
    await registrarEvento(
      {
        actor: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
        accion: "CONTRASENA_CAMBIADA",
        entidadTipo: "USUARIO",
        entidadId: usuario.id,
        detalle: { eraTemporal: usuario.debeCambiarContrasena },
      },
      tx,
    );
  });
  return { correo: usuario.correo, nueva: datos.nueva };
}
