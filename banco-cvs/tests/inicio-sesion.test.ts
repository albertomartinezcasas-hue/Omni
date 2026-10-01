import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth/config";
import { iniciarSesionAccion } from "@/lib/auth/acciones";
import { MAX_INTENTOS, verificarCredenciales } from "@/lib/auth/credenciales";
import { obtenerUsuarioActual } from "@/lib/auth";
import { db } from "@/lib/db";
import { CONTRASENA, crearUsuario, simularSesion } from "./ayuda";

afterEach(() => {
  vi.useRealTimers();
});

describe("Inicio de sesión", () => {
  it("acepta correo y contraseña correctos y registra LOGIN_OK", async () => {
    const usuario = await crearUsuario();
    const resultado = await verificarCredenciales(usuario.correo.toUpperCase(), CONTRASENA);
    expect(resultado).toEqual({ id: usuario.id, versionSesion: usuario.versionSesion });
    const evento = await db.eventoBitacora.findFirst({ where: { actorId: usuario.id, accion: "LOGIN_OK" } });
    expect(evento).not.toBeNull();
  });

  it("rechaza contraseña incorrecta y correo inexistente sin registrar la contraseña", async () => {
    const usuario = await crearUsuario();
    expect(await verificarCredenciales(usuario.correo, "otra-contraseña-mala")).toBeNull();
    expect(await verificarCredenciales("nadie@empresa-ficticia.mx", CONTRASENA)).toBeNull();
    const eventos = await db.eventoBitacora.findMany({ where: { accion: "LOGIN_FALLIDO" } });
    expect(eventos.length).toBeGreaterThanOrEqual(2);
    for (const e of eventos) {
      expect(JSON.stringify(e)).not.toContain("otra-contraseña-mala");
      expect(JSON.stringify(e)).not.toContain(CONTRASENA);
    }
    expect(eventos.some((e) => e.actorCorreo === "nadie@empresa-ficticia.mx" && e.actorId === null)).toBe(true);
  });

  it("no guarda en la bitácora un valor que no sea correo (p. ej. una contraseña tecleada por error)", async () => {
    expect(await verificarCredenciales("MiContraseñaSecreta!", CONTRASENA)).toBeNull();
    const eventos = await db.eventoBitacora.findMany({ where: { accion: "LOGIN_FALLIDO" } });
    expect(JSON.stringify(eventos)).not.toContain("MiContraseñaSecreta!");
  });

  it("muestra siempre el mensaje genérico 'Correo o contraseña incorrectos'", async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new AuthError("CredentialsSignin"));
    const datos = new FormData();
    datos.set("correo", "x@empresa-ficticia.mx");
    datos.set("contrasena", "mala");
    expect(await iniciarSesionAccion(undefined, datos)).toEqual({ error: "Correo o contraseña incorrectos" });
  });

  it(`bloquea la cuenta 15 minutos tras ${MAX_INTENTOS} intentos fallidos`, async () => {
    const usuario = await crearUsuario();
    for (let i = 0; i < MAX_INTENTOS; i++) {
      expect(await verificarCredenciales(usuario.correo, "contraseña-equivocada")).toBeNull();
    }
    const bloqueado = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(bloqueado.bloqueadoHasta).not.toBeNull();
    const minutos = (bloqueado.bloqueadoHasta!.getTime() - Date.now()) / 60_000;
    expect(minutos).toBeGreaterThan(14);
    expect(minutos).toBeLessThanOrEqual(15);
    expect(await db.eventoBitacora.count({ where: { actorId: usuario.id, accion: "CUENTA_BLOQUEADA" } })).toBe(1);

    // Con la cuenta bloqueada ni la contraseña correcta entra.
    expect(await verificarCredenciales(usuario.correo, CONTRASENA)).toBeNull();

    // A los 16 minutos ya puede entrar.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 16 * 60_000));
    expect(await verificarCredenciales(usuario.correo, CONTRASENA)).not.toBeNull();
  });

  it("intentos en paralelo no rebasan el límite de 5", async () => {
    const usuario = await crearUsuario();
    await Promise.all(
      Array.from({ length: 12 }, () => verificarCredenciales(usuario.correo, "contraseña-equivocada")),
    );
    const eventos = await db.eventoBitacora.findMany({ where: { actorId: usuario.id, accion: "LOGIN_FALLIDO" } });
    const comparados = eventos.filter((e) => e.detalle?.includes("CONTRASENA_INCORRECTA"));
    expect(comparados.length).toBe(MAX_INTENTOS);
    expect(await db.eventoBitacora.count({ where: { actorId: usuario.id, accion: "CUENTA_BLOQUEADA" } })).toBe(1);
    expect(await verificarCredenciales(usuario.correo, CONTRASENA)).toBeNull();
  });

  it("no bloquea con 4 intentos fallidos y un acceso correcto reinicia el contador", async () => {
    const usuario = await crearUsuario();
    for (let i = 0; i < MAX_INTENTOS - 1; i++) await verificarCredenciales(usuario.correo, "mala-mala-mala");
    expect(await verificarCredenciales(usuario.correo, CONTRASENA)).not.toBeNull();
    const actual = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    expect(actual.intentosFallidos).toBe(0);
    expect(actual.bloqueadoHasta).toBeNull();
  });

  it("rechaza a una cuenta desactivada aunque la contraseña sea correcta", async () => {
    const usuario = await crearUsuario({ activo: false });
    expect(await verificarCredenciales(usuario.correo, CONTRASENA)).toBeNull();
  });

  it("la sesión expira a las 8 horas", async () => {
    const usuario = await crearUsuario();
    await simularSesion(usuario, { inicio: Date.now() - 7.9 * 3600_000 });
    expect(await obtenerUsuarioActual()).not.toBeNull();
    await simularSesion(usuario, { inicio: Date.now() - 8 * 3600_000 - 1000 });
    expect(await obtenerUsuarioActual()).toBeNull();
  });

  it("el rol se lee de la base de datos, no del token", async () => {
    const usuario = await crearUsuario({ rol: "USUARIO" });
    await simularSesion(usuario);
    await db.usuario.update({ where: { id: usuario.id }, data: { rol: "ADMIN" } });
    expect((await obtenerUsuarioActual())?.rol).toBe("ADMIN");
  });
});
