import { describe, expect, it, vi } from "vitest";
import { signIn } from "@/lib/auth/config";
import { cambiarContrasenaAccion } from "@/lib/auth/acciones";
import { cambiarContrasenaPropia } from "@/lib/auth/cuenta";
import { compararContrasena } from "@/lib/auth/contrasenas";
import { obtenerUsuarioActual, requerirRol } from "@/lib/auth";
import { crearVacanteAccion } from "@/acciones/vacantes";
import { db } from "@/lib/db";
import { protegerPagina } from "@/lib/paginas";
import { CONTRASENA, crearUsuario, sesionCongelada, simularSesion } from "./ayuda";

const NUEVA = "Una-frase-nueva-y-larga-2026";

describe("Cambio obligatorio de contraseña temporal", () => {
  it("bloquea toda pantalla y acción hasta cambiarla", async () => {
    const admin = await crearUsuario({ rol: "ADMIN", debeCambiar: true });
    await simularSesion(admin);
    expect(await obtenerUsuarioActual()).not.toBeNull();
    await expect(requerirRol("USUARIO")).rejects.toMatchObject({ motivo: "CAMBIO_CONTRASENA_PENDIENTE" });
    await expect(protegerPagina("USUARIO")).rejects.toMatchObject({
      digest: expect.stringContaining("/cambiar-contrasena"),
    });
    const resultado = await crearVacanteAccion(undefined, new FormData());
    expect(resultado).toEqual({ ok: false, error: "Debes cambiar tu contraseña temporal antes de continuar." });
  });

  it("valida la contraseña actual, la longitud mínima, el máximo de bytes y que sea distinta", async () => {
    const u = await crearUsuario({ debeCambiar: true });
    await expect(
      cambiarContrasenaPropia(u.id, { actual: "incorrecta", nueva: NUEVA, confirmacion: NUEVA }),
    ).rejects.toThrow("La contraseña actual no es correcta.");
    await expect(
      cambiarContrasenaPropia(u.id, { actual: CONTRASENA, nueva: "corta", confirmacion: "corta" }),
    ).rejects.toThrow(/al menos 12/);
    const larga = "ñ".repeat(40); // 80 bytes
    await expect(
      cambiarContrasenaPropia(u.id, { actual: CONTRASENA, nueva: larga, confirmacion: larga }),
    ).rejects.toThrow(/demasiado larga/);
    await expect(
      cambiarContrasenaPropia(u.id, { actual: CONTRASENA, nueva: NUEVA, confirmacion: "otra-distinta-123" }),
    ).rejects.toThrow(/confirmación no coincide/);
    await expect(
      cambiarContrasenaPropia(u.id, { actual: CONTRASENA, nueva: CONTRASENA, confirmacion: CONTRASENA }),
    ).rejects.toThrow(/distinta de la actual/);
  });

  it("al cambiarla quita la marca, invalida la sesión anterior y emite una nueva", async () => {
    const u = await crearUsuario({ debeCambiar: true });
    sesionCongelada(u.id, u.versionSesion);
    const datos = new FormData();
    datos.set("actual", CONTRASENA);
    datos.set("nueva", NUEVA);
    datos.set("confirmacion", NUEVA);
    await expect(cambiarContrasenaAccion(undefined, datos)).rejects.toMatchObject({
      digest: expect.stringContaining("/?contrasena=actualizada"),
    });
    expect(vi.mocked(signIn)).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ correo: u.correo, contrasena: NUEVA }),
    );

    const actual = await db.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(actual.debeCambiarContrasena).toBe(false);
    expect(actual.versionSesion).toBe(u.versionSesion + 1);
    expect(await compararContrasena(NUEVA, actual.hashContrasena!)).toBe(true);
    // La sesión vieja (versión anterior) ya no sirve.
    expect(await obtenerUsuarioActual()).toBeNull();

    const evento = await db.eventoBitacora.findFirstOrThrow({ where: { actorId: u.id, accion: "CONTRASENA_CAMBIADA" } });
    expect(JSON.stringify(evento)).not.toContain(NUEVA);
    expect(JSON.stringify(evento)).not.toContain(CONTRASENA);
  });
});
