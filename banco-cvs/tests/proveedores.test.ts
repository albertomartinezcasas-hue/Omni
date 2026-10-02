import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anonimizar, ocultarDatosPersonales } from "@/lib/analizador/ocultar";
import { proveedoresConfigurados } from "@/lib/analizador/proveedores";

// SDK de OpenAI simulado: el comportamiento depende de la baseURL de cada proveedor.
const comportamiento = new Map<string, () => unknown>();
const llamadas: { baseURL: string; mensaje: string }[] = [];

vi.mock("openai", async (original) => {
  const real = await original<typeof import("openai")>();
  class OpenAIFalso {
    baseURL: string;
    chat: { completions: { create: (p: { messages: { content: string }[] }) => Promise<unknown> } };
    static APIError = real.default.APIError;
    static APIConnectionError = real.default.APIConnectionError;
    static APIConnectionTimeoutError = real.default.APIConnectionTimeoutError;
    static RateLimitError = real.default.RateLimitError;
    static AuthenticationError = real.default.AuthenticationError;
    static PermissionDeniedError = real.default.PermissionDeniedError;
    static BadRequestError = real.default.BadRequestError;
    constructor(opciones: { baseURL: string }) {
      this.baseURL = opciones.baseURL;
      this.chat = {
        completions: {
          create: async (p) => {
            llamadas.push({ baseURL: this.baseURL, mensaje: p.messages[1].content });
            const r = comportamiento.get(this.baseURL)?.();
            if (r instanceof Error) throw r;
            return r;
          },
        },
      };
    }
  }
  return { ...real, default: OpenAIFalso };
});

const { default: OpenAI } = await import("openai");
const { solicitarExtraccion } = await import("@/lib/analizador/cliente");

const ok = (modelo: string) => () => ({ model: modelo, choices: [{ finish_reason: "stop", message: { content: "{}" } }] });
const status = (codigo: number) => () => OpenAI.APIError.generate(codigo, { error: { message: "x" } }, "x", new Headers());
const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  comportamiento.clear();
  llamadas.length = 0;
  process.env.IA_PROVEEDORES = "groq,gemini";
  process.env.GROQ_API_KEY = "clave-ficticia-groq";
  process.env.GEMINI_API_KEY = "clave-ficticia-gemini";
});
afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  vi.restoreAllMocks();
});

const GROQ = "https://api.groq.com/openai/v1";
const GEMINI = "https://generativelanguage.googleapis.com/v1beta/openai/";

describe("Configuración de proveedores (solo variables de entorno)", () => {
  it("usa el orden de IA_PROVEEDORES, valores por defecto conocidos y salta los que no tienen clave", () => {
    const lista = proveedoresConfigurados({ IA_PROVEEDORES: "gemini,groq", GEMINI_API_KEY: "k" });
    expect(lista).toEqual([
      { nombre: "gemini", baseURL: GEMINI, modelo: "gemini-2.5-flash", apiKey: "k", anonimizar: true, formato: "json_schema" },
    ]);
  });

  it("permite agregar un proveedor nuevo solo con configuración (OmniRoute)", () => {
    const lista = proveedoresConfigurados({
      IA_PROVEEDORES: "openai,groq",
      OPENAI_BASE_URL: "http://localhost:20128/v1",
      OPENAI_MODEL: "cvs",
      OPENAI_API_KEY: "k1",
      GROQ_API_KEY: "k2",
    });
    expect(lista.map((p) => [p.nombre, p.baseURL, p.modelo])).toEqual([
      ["openai", "http://localhost:20128/v1", "cvs"],
      ["groq", GROQ, "openai/gpt-oss-120b"],
    ]);
  });
});

describe("Respaldo entre proveedores", () => {
  it.each([
    ["429", status(429)],
    ["503", status(503)],
    ["timeout", () => new OpenAI.APIConnectionTimeoutError()],
  ])("si Groq responde %s, pasa a Gemini (que recibe el CV anonimizado)", async (_n, falla) => {
    comportamiento.set(GROQ, falla);
    comportamiento.set(GEMINI, ok("gemini-2.5-flash"));
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await solicitarExtraccion("sistema", (anon) => (anon ? "CV ANÓNIMO" : "CV CON NOMBRE Laura"));
    expect(r).toMatchObject({ proveedor: "gemini", anonimizado: true });
    expect(llamadas.map((l) => l.baseURL)).toEqual([GROQ, GEMINI]);
    expect(llamadas[1].mensaje).toBe("CV ANÓNIMO");
    // El log dice qué proveedor respondió, sin contenido del CV.
    const registrado = JSON.stringify([...log.mock.calls, ...avisos.mock.calls]);
    expect(registrado).toContain("Respondió gemini");
    expect(registrado).not.toContain("Laura");
    expect(registrado).not.toContain("CV ANÓNIMO");
  });

  it("si un proveedor no tiene clave, se salta", async () => {
    delete process.env.GROQ_API_KEY;
    comportamiento.set(GEMINI, ok("gemini-2.5-flash"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    const r = await solicitarExtraccion("s", () => "cv");
    expect(r.proveedor).toBe("gemini");
    expect(llamadas.map((l) => l.baseURL)).toEqual([GEMINI]);
  });

  it("un error no recuperable (401) no pasa al siguiente y da un mensaje genérico", async () => {
    comportamiento.set(GROQ, status(401));
    comportamiento.set(GEMINI, ok("gemini-2.5-flash"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(solicitarExtraccion("s", () => "cv")).rejects.toThrow("La clave de un servicio de análisis no es válida");
    expect(llamadas).toHaveLength(1);
  });

  it("si todos fallan con 429, avisa que están saturados", async () => {
    comportamiento.set(GROQ, status(429));
    comportamiento.set(GEMINI, status(429));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(solicitarExtraccion("s", () => "cv")).rejects.toThrow("saturados");
  });

  it("sin ningún proveedor configurado, mensaje genérico (sin nombres de variables)", async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(solicitarExtraccion("s", () => "cv")).rejects.toThrow("El análisis automático no está disponible por ahora. Avisa a un Admin.");
  });
});

describe("Anonimización para proveedores que pueden entrenar con los datos", () => {
  it("quita nombre, correo, teléfono, dirección y RUT/DNI", () => {
    const cv = [
      "Laura Ficticia Pérez",
      "Correo: laura@correo-ficticio.mx | Tel. 55 1234 5678",
      "Dirección: Calle Pino 12, Col. Roma, C.P. 06700",
      "RUT: 12.345.678-9 · DNI 30123456",
      "Analista de Datos, Empresa Ficticia (2022 - 2024)",
      "Referencias: disponibles. Laura Ficticia Pérez",
    ].join("\n");
    const resultado = anonimizar(ocultarDatosPersonales(cv), ["Laura Ficticia Pérez"]);
    for (const dato of ["Laura", "Pérez", "laura@", "1234 5678", "Calle Pino", "06700", "12.345.678-9", "30123456"]) {
      expect(resultado).not.toContain(dato);
    }
    expect(resultado).toContain("[NOMBRE]");
    expect(resultado).toContain("Analista de Datos, Empresa Ficticia (2022 - 2024)");
  });

  it("no confunde un encabezado con el nombre", () => {
    expect(anonimizar("Curriculum Vitae\nAnalista de datos")).toBe("Curriculum Vitae\nAnalista de datos");
  });
});
