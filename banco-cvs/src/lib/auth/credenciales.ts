import { registrarEvento } from "@/lib/bitacora";
import { esCorreoValido, normalizarCorreo } from "@/lib/correo";
import { db } from "@/lib/db";
import { compararContraFicticio, compararContrasena } from "./contrasenas";

export const MAX_INTENTOS = 5;
export const MINUTOS_BLOQUEO = 15;

export type ResultadoCredenciales = { id: string; versionSesion: number } | null;

/**
 * Verifica correo y contraseña aplicando bloqueo por intentos fallidos.
 * Devuelve null ante cualquier fallo; quien llama muestra siempre el mismo mensaje genérico.
 */
export async function verificarCredenciales(
  correoIngresado: string,
  contrasena: string,
): Promise<ResultadoCredenciales> {
  const correo = normalizarCorreo(correoIngresado);
  const usuario = esCorreoValido(correo)
    ? await db.usuario.findUnique({ where: { correo } })
    : null;

  if (!usuario) {
    await compararContraFicticio(contrasena);
    await registrarEvento({
      actor: null,
      correoIntentado: esCorreoValido(correo) ? correo : "[inválido]",
      accion: "LOGIN_FALLIDO",
      detalle: { motivo: "CUENTA_INEXISTENTE" },
    });
    return null;
  }

  const actor = { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo };
  const ahora = new Date();

  if (!usuario.activo || !usuario.hashContrasena) {
    await compararContraFicticio(contrasena);
    await registrarEvento({
      actor,
      accion: "LOGIN_FALLIDO",
      entidadTipo: "USUARIO",
      entidadId: usuario.id,
      detalle: { motivo: "CUENTA_DESACTIVADA" },
    });
    return null;
  }

  // Reserva atómica del intento: solo pasa si la cuenta no está bloqueada y le quedan
  // intentos. Así, peticiones en paralelo no pueden rebasar el límite de intentos.
  const sinBloqueo = { OR: [{ bloqueadoHasta: null }, { bloqueadoHasta: { lte: ahora } }] };
  const reserva = await db.usuario.updateMany({
    where: { id: usuario.id, ...sinBloqueo, intentosFallidos: { lt: MAX_INTENTOS } },
    data: { intentosFallidos: { increment: 1 } },
  });
  if (reserva.count === 0) {
    await compararContraFicticio(contrasena);
    await registrarEvento({
      actor,
      accion: "LOGIN_FALLIDO",
      entidadTipo: "USUARIO",
      entidadId: usuario.id,
      detalle: { motivo: "CUENTA_BLOQUEADA" },
    });
    return null;
  }

  if (!(await compararContrasena(contrasena, usuario.hashContrasena))) {
    const actualizado = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    await registrarEvento({
      actor,
      accion: "LOGIN_FALLIDO",
      entidadTipo: "USUARIO",
      entidadId: usuario.id,
      detalle: { motivo: "CONTRASENA_INCORRECTA", intento: actualizado.intentosFallidos },
    });
    const bloqueadoHasta = new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000);
    const bloqueo = await db.usuario.updateMany({
      where: { id: usuario.id, intentosFallidos: { gte: MAX_INTENTOS } },
      data: { bloqueadoHasta, intentosFallidos: 0 },
    });
    if (bloqueo.count > 0) {
      await registrarEvento({
        actor,
        accion: "CUENTA_BLOQUEADA",
        entidadTipo: "USUARIO",
        entidadId: usuario.id,
        detalle: { hasta: bloqueadoHasta.toISOString() },
      });
    }
    return null;
  }

  // Acierto: reinicia el contador, salvo que otra petición haya bloqueado la cuenta mientras tanto.
  const acierto = await db.usuario.updateMany({
    where: { id: usuario.id, ...sinBloqueo },
    data: { intentosFallidos: 0, bloqueadoHasta: null },
  });
  if (acierto.count === 0) return null;
  await registrarEvento({ actor, accion: "LOGIN_OK", entidadTipo: "USUARIO", entidadId: usuario.id });
  return { id: usuario.id, versionSesion: usuario.versionSesion };
}
