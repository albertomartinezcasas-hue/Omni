import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Base de datos plantilla de pruebas (fuera del proyecto), con todas las migraciones aplicadas.
export const DIRECTORIO_PRUEBAS = path.join(tmpdir(), "banco-cvs-pruebas");
export const PLANTILLA = path.join(DIRECTORIO_PRUEBAS, "plantilla.db");

export default function setup() {
  rmSync(DIRECTORIO_PRUEBAS, { recursive: true, force: true });
  mkdirSync(DIRECTORIO_PRUEBAS, { recursive: true });
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${PLANTILLA}` },
    stdio: "ignore",
  });
}
