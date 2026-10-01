import { z } from "zod";
import { credencialInicial, invalidarSesiones } from "@/lib/auth/administracion";
import { registrarEvento, type Actor } from "@/lib/bitacora";
import { ROLES, type Rol } from "@/lib/catalogos";
import { dominioPermitido, esquemaCorreo } from "@/lib/correo";
import { db, type ClienteDb } from "@/lib/db";
import { ErrorNegocio } from "@/lib/errores";

export const esquemaNuevoUsuario = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, { error: "Escribe el nombre completo." })
    .max(120, { error: "El nombre es demasiado largo." }),
  correo: esquemaCorreo,
  rol: z.enum(ROLES, { error: "Selecciona un rol válido." }),
});

const MENSAJE_ULTIMO_ADMIN =
  "No se puede: es el último Admin activo. Primero asigna el rol Admin a otra persona.";

async function obtenerUsuario(id: string, cliente: ClienteDb = db) {
  const usuario = await cliente.usuario.findUnique({ where: { id } });
  if (!usuario) throw new ErrorNegocio("El usuario no existe.");
  return usuario;
}

/** Lanza error si quitar a este usuario dejaría al sistema sin Admins activos. */
async function protegerUltimoAdmin(usuarioId: string, cliente: ClienteDb) {
  const otrosAdmins = await cliente.usuario.count({
    where: { rol: "ADMIN", activo: true, id: { not: usuarioId } },
  });
  if (otrosAdmins === 0) throw new ErrorNegocio(MENSAJE_ULTIMO_ADMIN);
}

/** Alta de usuario. Devuelve la contraseña temporal para mostrarla una sola vez. */
export async function crearUsuario(actor: Actor, entrada: unknown) {
  const datos = esquemaNuevoUsuario.parse(entrada);
  if (!dominioPermitido(datos.correo)) {
    throw new ErrorNegocio("El dominio del correo no está permitido para crear cuentas.");
  }
  if (await db.usuario.findUnique({ where: { correo: datos.correo } })) {
    throw new ErrorNegocio("Ya existe una cuenta con ese correo.");
  }
  const { temporal, datos: credencial } = await credencialInicial();
  const usuario = await db.$transaction(async (tx) => {
    const creado = await tx.usuario.create({
      data: { ...datos, ...credencial, creadoPorId: actor.id },
    });
    await registrarEvento(
      {
        actor,
        accion: "USUARIO_CREADO",
        entidadTipo: "USUARIO",
        entidadId: creado.id,
        detalle: { usuario: creado.correo, nombre: creado.nombre, rol: creado.rol },
      },
      tx,
    );
    return creado;
  });
  return { id: usuario.id, correo: usuario.correo, contrasenaTemporal: temporal };
}

export async function cambiarRol(actor: Actor, usuarioId: string, rolNuevo: unknown) {
  const rol = z.enum(ROLES, { error: "Selecciona un rol válido." }).parse(rolNuevo) as Rol;
  await db.$transaction(async (tx) => {
    const usuario = await obtenerUsuario(usuarioId, tx);
    if (usuario.rol === rol) return;
    if (usuario.rol === "ADMIN" && usuario.activo) await protegerUltimoAdmin(usuarioId, tx);
    await tx.usuario.update({ where: { id: usuarioId }, data: { rol } });
    await invalidarSesiones(usuarioId, tx);
    await registrarEvento(
      {
        actor,
        accion: "USUARIO_ROL_CAMBIADO",
        entidadTipo: "USUARIO",
        entidadId: usuarioId,
        detalle: { usuario: usuario.correo, rolAnterior: usuario.rol, rolNuevo: rol },
      },
      tx,
    );
  });
}

export async function desactivarUsuario(actor: Actor, usuarioId: string) {
  await db.$transaction(async (tx) => {
    const usuario = await obtenerUsuario(usuarioId, tx);
    if (!usuario.activo) return;
    if (usuario.rol === "ADMIN") await protegerUltimoAdmin(usuarioId, tx);
    await tx.usuario.update({ where: { id: usuarioId }, data: { activo: false } });
    await invalidarSesiones(usuarioId, tx);
    await registrarEvento(
      {
        actor,
        accion: "USUARIO_DESACTIVADO",
        entidadTipo: "USUARIO",
        entidadId: usuarioId,
        detalle: { usuario: usuario.correo },
      },
      tx,
    );
  });
}

export async function reactivarUsuario(actor: Actor, usuarioId: string) {
  await db.$transaction(async (tx) => {
    const usuario = await obtenerUsuario(usuarioId, tx);
    if (usuario.activo) return;
    await tx.usuario.update({
      where: { id: usuarioId },
      data: { activo: true, intentosFallidos: 0, bloqueadoHasta: null },
    });
    await registrarEvento(
      {
        actor,
        accion: "USUARIO_REACTIVADO",
        entidadTipo: "USUARIO",
        entidadId: usuarioId,
        detalle: { usuario: usuario.correo },
      },
      tx,
    );
  });
}

export function listarUsuarios() {
  return db.usuario.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: {
      id: true,
      nombre: true,
      correo: true,
      rol: true,
      activo: true,
      debeCambiarContrasena: true,
      bloqueadoHasta: true,
      creadoEn: true,
    },
  });
}
