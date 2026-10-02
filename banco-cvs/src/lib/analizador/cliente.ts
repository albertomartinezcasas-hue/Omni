import OpenAI from "openai";
import { z } from "zod";
import { ErrorNegocio } from "@/lib/errores";
import { proveedoresConfigurados, type ProveedorIA } from "./proveedores";
import { esquemaExtraccion } from "./tipos";

export const TIEMPO_MAXIMO_MS = 60_000;

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

export type RespuestaIA = { json: string; modelo: string; proveedor: string };

/** Errores por los que se pasa al siguiente proveedor: 429, 5xx, tiempo agotado o sin conexión. */
function esRecuperable(error: unknown) {
  if (error instanceof OpenAI.APIConnectionError) return true; // incluye APIConnectionTimeoutError
  if (error instanceof OpenAI.APIError) return error.status === 429 || (error.status ?? 0) >= 500;
  return false;
}

function describir(error: unknown) {
  if (error instanceof OpenAI.APIConnectionTimeoutError) return "tiempo agotado";
  if (error instanceof OpenAI.APIConnectionError) return "sin conexión";
  if (error instanceof OpenAI.APIError) return `HTTP ${error.status ?? "?"}`;
  return error instanceof Error ? error.name : "desconocido";
}

async function llamar(p: ProveedorIA, sistema: string, usuario: string, tiempoMs: number) {
  const cliente = new OpenAI({ apiKey: p.apiKey, baseURL: p.baseURL, timeout: tiempoMs, maxRetries: 0 });
  const respuesta = await cliente.chat.completions.create({
    model: p.modelo,
    temperature: 0,
    max_completion_tokens: 16000,
    messages: [
      { role: "system", content: sistema },
      { role: "user", content: usuario },
    ],
    response_format:
      p.formato === "json_schema"
        ? { type: "json_schema", json_schema: { name: "extraccion_cv", schema: ESQUEMA_JSON, strict: true } }
        : { type: "json_object" },
  });
  const opcion = respuesta.choices[0];
  if (!opcion) throw new ErrorApiAnalizador("El servicio de análisis no devolvió respuesta.");
  if (opcion.finish_reason === "length") throw new ErrorApiAnalizador("La respuesta del análisis quedó incompleta.");
  return { json: opcion.message.content ?? "", modelo: respuesta.model || p.modelo };
}

/**
 * Pide la extracción a los proveedores en orden de respaldo. Ante 429, 5xx, tiempo agotado o sin conexión
 * pasa al siguiente. El log registra qué proveedor respondió o falló, nunca el contenido del CV ni del prompt.
 */
export async function solicitarExtraccion(
  sistema: string,
  mensaje: string,
  tiempoMs: number = TIEMPO_MAXIMO_MS,
): Promise<RespuestaIA> {
  const proveedores = proveedoresConfigurados();
  if (proveedores.length === 0) {
    console.error("[analizador] Ningún proveedor de IA configurado (faltan claves *_API_KEY).");
    throw new ErrorNegocio("El análisis automático no está disponible por ahora. Avisa a un Admin.");
  }
  const limite = Date.now() + tiempoMs;
  let ultimo: unknown = null;
  for (const p of proveedores) {
    const restante = limite - Date.now();
    if (restante < 3_000) break;
    const inicio = Date.now();
    try {
      const r = await llamar(p, sistema, mensaje, restante);
      console.info(`[analizador] Respondió ${p.nombre} (${r.modelo}) en ${Date.now() - inicio} ms`);
      return { ...r, proveedor: p.nombre };
    } catch (error) {
      // La generación no cumplió el esquema estricto: se trata como JSON inválido (usa el único reintento).
      if (error instanceof OpenAI.BadRequestError && JSON.stringify(error.error ?? {}).includes("json_validate_failed")) {
        console.warn(`[analizador] ${p.nombre}: la respuesta no cumplió el esquema`);
        return { json: "", modelo: p.modelo, proveedor: p.nombre };
      }
      if (error instanceof ErrorApiAnalizador) throw error;
      console.warn(`[analizador] ${p.nombre} falló (${describir(error)})${esRecuperable(error) ? "; se intenta el siguiente" : ""}`);
      ultimo = error;
      if (!esRecuperable(error)) break;
    }
  }
  if (ultimo instanceof OpenAI.APIConnectionTimeoutError || ultimo === null) {
    throw new ErrorApiAnalizador("El análisis tardó más de 60 segundos.");
  }
  if (ultimo instanceof OpenAI.RateLimitError) {
    throw new ErrorApiAnalizador("Los servicios de análisis están saturados. Intenta en unos minutos.");
  }
  if (ultimo instanceof OpenAI.AuthenticationError || ultimo instanceof OpenAI.PermissionDeniedError) {
    throw new ErrorApiAnalizador("La clave de un servicio de análisis no es válida. Avisa a un Admin.");
  }
  if (ultimo instanceof OpenAI.APIConnectionError) {
    throw new ErrorApiAnalizador("No hubo conexión con los servicios de análisis.");
  }
  throw new ErrorApiAnalizador("Los servicios de análisis no están disponibles en este momento.");
}
