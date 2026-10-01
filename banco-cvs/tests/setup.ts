// Configuración de cada archivo de prueba. La sesión se simula SOLO aquí (tests/).
import { copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { vi } from "vitest";

const directorio = path.join(tmpdir(), "banco-cvs-pruebas", randomUUID());
mkdirSync(directorio, { recursive: true });
const archivoDb = path.join(directorio, "prueba.db");
copyFileSync(path.join(tmpdir(), "banco-cvs-pruebas", "plantilla.db"), archivoDb);

process.env.DATABASE_URL = `file:${archivoDb}`;
process.env.ALLOWED_DOMAINS = "empresa-ficticia.mx";
delete process.env.AUTH_URL;

// storage/ de las pruebas en una carpeta temporal.
vi.spyOn(process, "cwd").mockReturnValue(directorio);

// Sesión simulada: las pruebas fijan el valor con simularSesion().
vi.mock("@/lib/auth/sesion", () => ({ leerSesion: vi.fn(async () => null) }));

// Auth.js simulado: signIn/signOut no se ejecutan en pruebas.
vi.mock("@/lib/auth/config", () => ({
  handlers: {},
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
