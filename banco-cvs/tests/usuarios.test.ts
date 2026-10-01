import { describe, expect, it } from "vitest";
import {
  cambiarRolAccion,
  crearUsuarioAccion,
  desactivarUsuarioAccion,
  reactivarUsuarioAccion,
  restablecerContrasenaAccion,
} from "@/acciones/usuarios";
import { cerrarSesionAccion } from "@/lib/auth/acciones";
import { compararContrasena } from "@/lib/auth/contrasenas";
import { obtenerUsuarioActual } from "@/lib/auth";
import { verificarCredenciales } from "@/lib/auth/credenciales";
import { db } from "@/lib/db";
import { crearUsuario, sesionCongelada, simularSesion } from "./ayuda";

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [k, v] of Object.entries(campos)) datos.set(k, v);
  return datos;
}

describe("Gestión de usuarios", () => {
  it("el Admin da de alta y la contraseña temporal solo se devuelve una vez (nunca se guarda en claro)", async () => {
    const admin = await crearUsuario({ rol: "ADMIN" });
    await simularSesion(admin);
    const resultado = await crearUsuarioAccion(
      undefined,
      formulario({ nombre: "Reclutadora Ficticia", correo: "Recluta.Uno@Empresa-Ficticia.mx", rol: "USUARIO" }),
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const temporal = resultado.datos.contrasenaTemporal;
    expect(temporal).toHaveLength(16);

    const creado = await db.usuario.findUniqueOrThrow({ where: { correo: "recluta.uno@empresa-ficticia.mx" } });
    expect(creado.debeCambiarContrasena).toBe(true);
    expect(creado.creadoPorId).toBe(admin.id);
    expect(creado.hashContrasena).not.toContain(temporal);
    expect(creado.hashContrasena).toMatch(/^\$2[aby]\$12\$/);
    expect(await compararContrasena(temporal, creado.hashContrasena!)).toBe(true);

    const eventos = await db.eventoBitacora.findMany();
    expect(JSON.stringify(eventos)).not.toContain(temporal);
    expect(eventos.some((e) => e.accion === "USUARIO_CREADO" && e.actorId === admin.id)).toBe(true);
  });

  it("valida formato de correo, dominio permitido y correo repetido", async () => {
    const admin = await crearUsuario({ rol: "ADMIN" });
    await simularSesion(admin);
    expect(await crearUsuarioAccion(undefined, formulario({ nombre: "Ana Ficticia", correo: "no-es-correo", rol: "USUARIO" })))
      .toEqual({ ok: false, error: "El correo no tiene un formato válido." });
    expect(await crearUsuarioAccion(undefined, formulario({ nombre: "Ana Ficticia", correo: "ana@gmail.com", rol: "USUARIO" })))
      .toEqual({ ok: false, error: "El dominio del correo no está permitido para crear cuentas." });
    expect(await crearUsuarioAccion(undefined, formulario({ nombre: "Ana Ficticia", correo: admin.correo, rol: "USUARIO" })))
      .toEqual({ ok: false, error: "Ya existe una cuenta con ese correo." });
  });

  it("desactivar a un usuario invalida su sesión abierta de inmediato", async () => {
    const admin = await crearUsuario({ rol: "ADMIN" });
    const usuario = await crearUsuario();
    sesionCongelada(usuario.id, usuario.versionSesion);
    expect(await obtenerUsuarioActual()).not.toBeNull();

    await simularSesion(admin);
    expect((await desactivarUsuarioAccion(usuario.id)).ok).toBe(true);

    sesionCongelada(usuario.id, usuario.versionSesion);
    expect(await obtenerUsuarioActual()).toBeNull();
    // Aunque el token tuviera la versión nueva, la cuenta desactivada no entra.
    const actual = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    sesionCongelada(usuario.id, actual.versionSesion);
    expect(await obtenerUsuarioActual()).toBeNull();
    expect(await db.usuario.count({ where: { id: usuario.id } })).toBe(1); // nunca se borra
  });

  it("reactivar permite volver a entrar con la contraseña actual", async () => {
    const admin = await crearUsuario({ rol: "ADMIN" });
    const usuario = await crearUsuario({ activo: false });
    await simularSesion(admin);
    expect((await reactivarUsuarioAccion(usuario.id)).ok).toBe(true);
    expect(await verificarCredenciales(usuario.correo, "Contraseña-de-prueba-123")).not.toBeNull();
  });

  it("cambiar el rol y restablecer la contraseña también cierran la sesión abierta", async () => {
    const admin = await crearUsuario({ rol: "ADMIN" });
    const usuario = await crearUsuario();

    await simularSesion(admin);
    expect((await cambiarRolAccion(usuario.id, "ADMIN")).ok).toBe(true);
    sesionCongelada(usuario.id, usuario.versionSesion);
    expect(await obtenerUsuarioActual()).toBeNull();

    const tras = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    await simularSesion(admin);
    const restablecida = await restablecerContrasenaAccion(usuario.id);
    expect(restablecida.ok).toBe(true);
    sesionCongelada(usuario.id, tras.versionSesion);
    expect(await obtenerUsuarioActual()).toBeNull();

    const final = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(final.debeCambiarContrasena).toBe(true);
    expect(final.intentosFallidos).toBe(0);
    expect(final.bloqueadoHasta).toBeNull();
    if (restablecida.ok) expect(await compararContrasena(restablecida.datos, final.hashContrasena!)).toBe(true);
  });

  it("cerrar sesión invalida el token", async () => {
    const usuario = await crearUsuario();
    sesionCongelada(usuario.id, usuario.versionSesion);
    await expect(cerrarSesionAccion()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
    expect(await obtenerUsuarioActual()).toBeNull();
  });
});

describe("Protección del último Admin", () => {
  it("impide desactivar o degradar al último Admin activo", async () => {
    await db.usuario.updateMany({ where: { rol: "ADMIN" }, data: { activo: false } });
    const unico = await crearUsuario({ rol: "ADMIN" });
    await simularSesion(unico);
    const mensaje = "No se puede: es el último Admin activo. Primero asigna el rol Admin a otra persona.";
    expect(await desactivarUsuarioAccion(unico.id)).toEqual({ ok: false, error: mensaje });
    await simularSesion(unico);
    expect(await cambiarRolAccion(unico.id, "USUARIO")).toEqual({ ok: false, error: mensaje });

    // Con un segundo Admin sí se puede degradar al primero…
    const segundo = await crearUsuario({ rol: "ADMIN" });
    await simularSesion(segundo);
    expect((await cambiarRolAccion(unico.id, "USUARIO")).ok).toBe(true);
    // …pero el segundo ya es el último.
    await simularSesion(segundo);
    expect(await desactivarUsuarioAccion(segundo.id)).toEqual({ ok: false, error: mensaje });
    expect(await db.usuario.count({ where: { rol: "ADMIN", activo: true } })).toBe(1);
  });
});
