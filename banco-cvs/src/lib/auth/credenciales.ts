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

  if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
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
    const actualizado = await db.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: { increment: 1 } },
    });
    await registrarEvento({
      actor,
      accion: "LOGIN_FALLIDO",
      entidadTipo: "USUARIO",
      entidadId: usuario.id,
      detalle: { motivo: "CONTRASENA_INCORRECTA", intento: actualizado.intentosFallidos },
    });
    if (actualizado.intentosFallidos >= MAX_INTENTOS) {
      const bloqueadoHasta = new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000);
      await db.usuario.update({
        where: { id: usuario.id },
        data: { bloqueadoHasta, intentosFallidos: 0 },
      });
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

  await db.usuario.update({
    where: { id: usuario.id },
    data: { intentosFallidos: 0, bloqueadoHasta: null },
  });
  await registrarEvento({ actor, accion: "LOGIN_OK", entidadTipo: "USUARIO", entidadId: usuario.id });
  return { id: usuario.id, versionSesion: usuario.versionSesion };
}
