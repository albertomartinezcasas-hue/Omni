import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { compararContrasena } from "@/lib/auth/contrasenas";
import { db } from "@/lib/db";

function crearAdmin(...args: string[]) {
  try {
    const salida = execFileSync("npx", ["tsx", "scripts/crear-admin.ts", ...args], {
      env: { ...process.env },
      encoding: "utf8",
      stdio: "pipe",
    });
    return { codigo: 0, salida };
  } catch (error) {
    const e = error as { status: number; stdout: string; stderr: string };
    return { codigo: e.status, salida: e.stdout + e.stderr };
  }
}

describe("npm run crear-admin", () => {
  it("valida el dominio, crea el primer Admin con contraseña temporal y rechaza un segundo", async () => {
    expect(crearAdmin("jefa@gmail.com", "Jefa Ficticia").codigo).toBe(1);

    const primero = crearAdmin("Jefa@Empresa-Ficticia.mx", "Jefa Ficticia");
    expect(primero.codigo).toBe(0);
    const temporal = primero.salida.trim().split("\n").pop()!;
    expect(temporal).toHaveLength(16);
    const admin = await db.usuario.findUniqueOrThrow({ where: { correo: "jefa@empresa-ficticia.mx" } });
    expect(admin.rol).toBe("ADMIN");
    expect(admin.debeCambiarContrasena).toBe(true);
    expect(await compararContrasena(temporal, admin.hashContrasena!)).toBe(true);

    const segundo = crearAdmin("otro@empresa-ficticia.mx", "Otro Ficticio");
    expect(segundo.codigo).toBe(1);
    expect(segundo.salida).toContain("ya existe un Admin activo");
    expect(await db.usuario.count({ where: { rol: "ADMIN" } })).toBe(1);
  });
});
