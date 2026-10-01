import { registrarEvento, type Actor } from "@/lib/bitacora";
import { db, type ClienteDb } from "@/lib/db";
import { ErrorNegocio } from "@/lib/errores";
import { crearCredencialTemporal } from "./contrasenas";

/** Credencial inicial de una cuenta nueva: hash de una contraseña temporal que debe cambiarse. */
export async function credencialInicial() {
  const { temporal, hash } = await crearCredencialTemporal();
  return { temporal, datos: { hashContrasena: hash, debeCambiarContrasena: true } };
}

/** Invalida todas las sesiones abiertas del usuario. */
export async function invalidarSesiones(usuarioId: string, cliente: ClienteDb = db) {
  await cliente.usuario.update({
    where: { id: usuarioId },
    data: { versionSesion: { increment: 1 } },
  });
}

/**
 * Restablece la contraseña de un usuario (solo Admin; el permiso se verifica antes de llamar).
 * Devuelve la contraseña temporal para mostrarla una sola vez.
 */
export async function restablecerContrasena(actor: Actor, usuarioId: string) {
  const usuario = await db.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new ErrorNegocio("El usuario no existe.");
  const { temporal, hash } = await crearCredencialTemporal();
  await db.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        hashContrasena: hash,
        debeCambiarContrasena: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        versionSesion: { increment: 1 },
      },
    });
    await registrarEvento(
      {
        actor,
        accion: "CONTRASENA_RESTABLECIDA",
        entidadTipo: "USUARIO",
        entidadId: usuarioId,
        detalle: { usuario: usuario.correo },
      },
      tx,
    );
  });
  return temporal;
}
