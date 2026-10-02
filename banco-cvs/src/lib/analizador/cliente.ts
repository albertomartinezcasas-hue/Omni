import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ErrorNegocio } from "@/lib/errores";
import { esquemaExtraccion } from "./tipos";

export const TIEMPO_MAXIMO_MS = 60_000;

export function modeloConfigurado() {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";
}

let cliente: Anthropic | null = null;

function obtenerCliente() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ErrorNegocio("El analizador no está configurado (falta ANTHROPIC_API_KEY). Avisa a un Admin.");
  }
  // Sin reintentos automáticos del SDK: el único reintento es el de JSON inválido.
  cliente ??= new Anthropic({ timeout: TIEMPO_MAXIMO_MS, maxRetries: 0 });
  return cliente;
}

export class ErrorApiAnalizador extends Error {
  constructor(public motivo: string) {
    super(motivo);
    this.name = "ErrorApiAnalizador";
  }
}

/**
 * Llama a la API con salida estructurada (JSON Schema de la extracción) y devuelve el texto JSON crudo.
 * Lanza ErrorApiAnalizador ante errores de red, tiempo agotado, rechazo o respuesta truncada.
 */
export async function solicitarExtraccion(sistema: string, usuario: string): Promise<{ json: string; modelo: string }> {
  const api = obtenerCliente();
  let respuesta: Anthropic.Message;
  try {
    respuesta = await api.messages.create({
      model: modeloConfigurado(),
      max_tokens: 16000,
      system: sistema,
      messages: [{ role: "user", content: usuario }],
      output_config: { format: zodOutputFormat(esquemaExtraccion) },
    });
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      throw new ErrorApiAnalizador("El análisis tardó más de 60 segundos.");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new ErrorApiAnalizador("El servicio de análisis está saturado. Intenta en unos minutos.");
    }
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new ErrorApiAnalizador("La clave del analizador no es válida. Avisa a un Admin.");
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new ErrorApiAnalizador("No hubo conexión con el servicio de análisis.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new ErrorApiAnalizador(`El servicio de análisis respondió con un error (${error.status ?? "sin código"}).`);
    }
    throw error;
  }

  if (respuesta.stop_reason === "refusal") {
    throw new ErrorApiAnalizador("El modelo no pudo analizar este CV.");
  }
  if (respuesta.stop_reason === "max_tokens") {
    throw new ErrorApiAnalizador("La respuesta del análisis quedó incompleta.");
  }
  const texto = respuesta.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { json: texto, modelo: respuesta.model };
}
