import Groq from "groq-sdk";
import { z } from "zod";
import { ErrorNegocio } from "@/lib/errores";
import { esquemaExtraccion } from "./tipos";

export const TIEMPO_MAXIMO_MS = 60_000;

export function modeloConfigurado() {
  return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
}

let cliente: Groq | null = null;

function obtenerCliente() {
  if (!process.env.GROQ_API_KEY) {
    console.error("Analizador sin configurar: falta GROQ_API_KEY");
    throw new ErrorNegocio("El análisis automático no está disponible por ahora. Avisa a un Admin.");
  }
  // Sin reintentos automáticos del SDK: el único reintento es el de JSON inválido.
  cliente ??= new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: TIEMPO_MAXIMO_MS, maxRetries: 0 });
  return cliente;
}

export class ErrorApiAnalizador extends Error {
  constructor(public motivo: string) {
    super(motivo);
    this.name = "ErrorApiAnalizador";
  }
}

const RESTRICCIONES = ["minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "$schema"];

/**
 * JSON Schema para salida estructurada estricta: todas las propiedades requeridas,
 * sin propiedades adicionales y sin restricciones numéricas o de longitud
 * (esas las valida zod en el servidor al recibir la respuesta).
 */
function esquemaEstricto(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(esquemaEstricto);
  if (!nodo || typeof nodo !== "object") return nodo;
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(nodo)) {
    if (RESTRICCIONES.includes(clave)) continue;
    salida[clave] = esquemaEstricto(valor);
  }
  if (salida.type === "object" && salida.properties) {
    salida.required = Object.keys(salida.properties as object);
    salida.additionalProperties = false;
  }
  return salida;
}

export const ESQUEMA_JSON = esquemaEstricto(z.toJSONSchema(esquemaExtraccion)) as Record<string, unknown>;

/**
 * Llama a la API de Groq con salida estructurada (JSON Schema de la extracción) y devuelve el texto JSON crudo.
 * Lanza ErrorApiAnalizador ante errores de red, tiempo agotado, rechazo o respuesta truncada.
 */
export async function solicitarExtraccion(
  sistema: string,
  usuario: string,
  tiempoMs: number = TIEMPO_MAXIMO_MS,
): Promise<{ json: string; modelo: string }> {
  const api = obtenerCliente();
  let respuesta: Groq.Chat.ChatCompletion;
  try {
    respuesta = await api.chat.completions.create(
      {
        model: modeloConfigurado(),
        max_completion_tokens: 16000,
        temperature: 0,
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: usuario },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "extraccion_cv", schema: ESQUEMA_JSON, strict: true },
        },
      },
      { timeout: tiempoMs },
    );
  } catch (error) {
    // La generación no cumplió el esquema estricto: se trata como JSON inválido (usa el único reintento).
    if (error instanceof Groq.BadRequestError && JSON.stringify(error.error ?? {}).includes("json_validate_failed")) {
      return { json: "", modelo: modeloConfigurado() };
    }
    if (error instanceof Groq.APIConnectionTimeoutError) {
      throw new ErrorApiAnalizador("El análisis tardó más de 60 segundos.");
    }
    if (error instanceof Groq.RateLimitError) {
      throw new ErrorApiAnalizador("El servicio de análisis está saturado. Intenta en unos minutos.");
    }
    if (error instanceof Groq.AuthenticationError || error instanceof Groq.PermissionDeniedError) {
      throw new ErrorApiAnalizador("La clave del analizador no es válida. Avisa a un Admin.");
    }
    if (error instanceof Groq.APIConnectionError) {
      throw new ErrorApiAnalizador("No hubo conexión con el servicio de análisis.");
    }
    if (error instanceof Groq.APIError) {
      // Diagnóstico mínimo en el servidor: solo el tipo y el código, nunca el cuerpo ni el prompt.
      console.error("Error de la API de análisis:", error.name, error.status ?? "sin código");
      throw new ErrorApiAnalizador("El servicio de análisis no está disponible en este momento.");
    }
    throw error;
  }

  const opcion = respuesta.choices[0];
  if (!opcion) throw new ErrorApiAnalizador("El servicio de análisis no devolvió respuesta.");
  if (opcion.finish_reason === "length") {
    throw new ErrorApiAnalizador("La respuesta del análisis quedó incompleta.");
  }
  return { json: opcion.message.content ?? "", modelo: respuesta.model };
}
