import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describirModelo, esModeloLigero, proveedoresConfigurados } from "@/lib/analizador/proveedores";

// SDK de OpenAI simulado: el comportamiento depende de "baseURL|modelo" o, si no está, de la baseURL.
const comportamiento = new Map<string, () => unknown>();
const llamadas: { baseURL: string; modelo: string; mensaje: string }[] = [];

vi.mock("openai", async (original) => {
  const real = await original<typeof import("openai")>();
  class OpenAIFalso {
    baseURL: string;
    chat: { completions: { create: (p: { model: string; messages: { content: string }[] }) => Promise<unknown> } };
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
            llamadas.push({ baseURL: this.baseURL, modelo: p.model, mensaje: p.messages[1].content });
            const r = (comportamiento.get(`${this.baseURL}|${p.model}`) ?? comportamiento.get(this.baseURL))?.();
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
    expect(lista.every((p) => p.nombre === "gemini" && p.baseURL === GEMINI && p.apiKey === "k")).toBe(true);
    expect(lista[0].modelo).toBe("gemini-3.8-flash");
  });

  it("por defecto encadena todos los modelos gratuitos de Gemini, del más capaz al más ligero", () => {
    const modelos = proveedoresConfigurados({ IA_PROVEEDORES: "gemini", GEMINI_API_KEY: "k" }).map((p) => p.modelo);
    expect(modelos.length).toBeGreaterThan(4);
    expect(modelos.at(-1)).toMatch(/lite/);
  });

  it("N_MODEL acepta varios modelos separados por comas (sin repetidos)", () => {
    const lista = proveedoresConfigurados({ IA_PROVEEDORES: "gemini", GEMINI_API_KEY: "k", GEMINI_MODEL: " a , b,a " });
    expect(lista.map((p) => p.modelo)).toEqual(["a", "b"]);
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

describe("Configuración segura", () => {
  it("rechaza http:// salvo hacia la propia máquina", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const env = { IA_PROVEEDORES: "a,b", A_API_KEY: "k", A_BASE_URL: "http://ejemplo.com/v1", A_MODEL: "m",
      B_API_KEY: "k", B_BASE_URL: "http://localhost:20128/v1", B_MODEL: "cvs" };
    expect(proveedoresConfigurados(env).map((p) => p.nombre)).toEqual(["b"]);
  });
});

describe("Respaldo entre proveedores", () => {
  it.each([
    ["429", status(429)],
    ["503", status(503)],
    ["timeout", () => new OpenAI.APIConnectionTimeoutError()],
  ])("si Groq responde %s, pasa a Gemini", async (_n, falla) => {
    comportamiento.set(GROQ, falla);
    comportamiento.set(GEMINI, ok("gemini-3.8-flash"));
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await solicitarExtraccion("sistema", "CV CON NOMBRE Laura");
    expect(r).toMatchObject({ proveedor: "gemini" });
    expect(llamadas.map((l) => l.baseURL).slice(0, 2)).toEqual([GROQ, GEMINI]);
    // El log dice qué proveedor respondió, sin contenido del CV.
    const registrado = JSON.stringify([...log.mock.calls, ...avisos.mock.calls]);
    expect(registrado).toContain("Respondió gemini");
    expect(registrado).not.toContain("Laura");
  });

  it.each([
    ["429 (cupo agotado)", 429],
    ["404 (modelo retirado)", 404],
  ])("si un modelo de Gemini responde %s, usa el siguiente modelo", async (_n, codigo) => {
    process.env.IA_PROVEEDORES = "gemini";
    process.env.GEMINI_MODEL = "modelo-a,modelo-b";
    comportamiento.set(`${GEMINI}|modelo-a`, status(codigo));
    comportamiento.set(GEMINI, ok("modelo-b"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await solicitarExtraccion("s", "cv");
    expect(r).toMatchObject({ proveedor: "gemini", modelo: "modelo-b" });
    expect(llamadas.map((l) => l.modelo)).toEqual(["modelo-a", "modelo-b"]);
  });

  it("si un proveedor no tiene clave, se salta", async () => {
    delete process.env.GROQ_API_KEY;
    comportamiento.set(GEMINI, ok("gemini-3.8-flash"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    const r = await solicitarExtraccion("s", "cv");
    expect(r.proveedor).toBe("gemini");
    expect(llamadas.map((l) => l.baseURL)).toEqual([GEMINI]);
  });

  it("con clave inválida (401) salta los demás modelos de ese proveedor y prueba el siguiente proveedor", async () => {
    process.env.GROQ_MODEL = "g1,g2";
    comportamiento.set(GROQ, status(401));
    comportamiento.set(GEMINI, ok("gemini-3.8-flash"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const r = await solicitarExtraccion("s", "cv");
    expect(r.proveedor).toBe("gemini");
    expect(llamadas.map((l) => l.modelo)).toEqual(["g1", "gemini-3.8-flash"]);
  });

  it("si todas las claves son inválidas, mensaje genérico para avisar al Admin", async () => {
    comportamiento.set(GROQ, status(401));
    comportamiento.set(GEMINI, status(403));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(solicitarExtraccion("s", "cv")).rejects.toThrow("La clave de un servicio de análisis no es válida");
    expect(llamadas).toHaveLength(2);
  });

  it("un error no recuperable (400) no sigue con la cadena", async () => {
    comportamiento.set(GROQ, status(400));
    comportamiento.set(GEMINI, ok("gemini-3.8-flash"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(solicitarExtraccion("s", "cv")).rejects.toThrow();
    expect(llamadas).toHaveLength(1);
  });

  it("el reintento empieza por el modelo que ya respondió", async () => {
    process.env.IA_PROVEEDORES = "groq,gemini";
    comportamiento.set(GEMINI, ok("gemini-3.7-flash"));
    vi.spyOn(console, "info").mockImplementation(() => {});
    await solicitarExtraccion("s", "cv", 60_000, { proveedor: "gemini", modelo: "gemini-3.7-flash" });
    expect(llamadas.map((l) => l.modelo)).toEqual(["gemini-3.7-flash"]);
  });

  it("limita la lista a 10 modelos por proveedor", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const modelos = Array.from({ length: 15 }, (_, i) => `m${i}`).join(",");
    expect(proveedoresConfigurados({ IA_PROVEEDORES: "x", X_API_KEY: "k", X_BASE_URL: "https://x.test/v1", X_MODEL: modelos })).toHaveLength(10);
  });

  it("si todos fallan con 429, avisa que están saturados", async () => {
    comportamiento.set(GROQ, status(429));
    comportamiento.set(GEMINI, status(429));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(solicitarExtraccion("s", "cv")).rejects.toThrow("saturados");
  });

  it("sin ningún proveedor configurado, mensaje genérico (sin nombres de variables)", async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(solicitarExtraccion("s", "cv")).rejects.toThrow("El análisis automático no está disponible por ahora. Avisa a un Admin.");
  });
});

describe("Modelo legible (análisis, bitácora y CSV)", () => {
  it("separa el servicio y el modelo, y avisa si es la versión rápida (menos precisa)", () => {
    expect(describirModelo("groq:openai/gpt-oss-120b", {})).toBe("Servicio de IA: Groq · modelo openai/gpt-oss-120b");
    expect(describirModelo("openai:gpt-oss:20b", {})).toBe("Servicio de IA: Openai · modelo gpt-oss:20b");
    expect(describirModelo("gemini:models/gemini-3.5-flash-lite", {})).toBe(
      "Servicio de IA: Gemini · versión rápida de la IA (menos precisa) · modelo gemini-3.5-flash-lite",
    );
    expect(describirModelo("prueba", {})).toBe("Servicio de IA · modelo prueba");
  });
});

describe("Modelos ligeros", () => {
  it("por defecto, los que contienen «lite»; acepta el formato guardado «proveedor:modelo»", () => {
    expect(esModeloLigero("gemini:gemini-3.5-flash-lite", {})).toBe(true);
    expect(esModeloLigero("models/gemini-flash-lite-latest", {})).toBe(true);
    expect(esModeloLigero("gemini:gemini-3.7-flash", {})).toBe(false);
    expect(esModeloLigero("groq:openai/gpt-oss-120b", {})).toBe(false);
  });

  it("IA_MODELOS_LIGEROS define la lista explícita", () => {
    const env = { IA_MODELOS_LIGEROS: "gemini-3.6-flash, gemma-4-26b-a4b-it" };
    expect(esModeloLigero("gemini:gemini-3.6-flash", env)).toBe(true);
    expect(esModeloLigero("gemini:gemini-3.5-flash-lite", env)).toBe(false);
  });
});
