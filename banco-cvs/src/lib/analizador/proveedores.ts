/**
 * Proveedores de IA compatibles con la API de OpenAI, configurados SOLO por variables de entorno del servidor.
 *
 * IA_PROVEEDORES=groq,gemini        → orden de respaldo (si no se define: "groq,gemini")
 * Para cada nombre N (en mayúsculas):
 *   N_API_KEY      clave (si falta, el proveedor se salta)
 *   N_BASE_URL     URL base compatible con OpenAI
 *   N_MODEL        modelo
 *   N_ANONIMIZAR   "true" para quitar además nombre, dirección e identificaciones antes de enviar
 *   N_FORMATO_JSON "json_schema" (por defecto) o "json_object"
 *
 * Agregar un proveedor no requiere tocar código; p. ej. OmniRoute:
 *   IA_PROVEEDORES=openai,groq,gemini  OPENAI_BASE_URL=http://localhost:20128/v1  OPENAI_MODEL=cvs  OPENAI_API_KEY=...
 */

export type FormatoJson = "json_schema" | "json_object";

export type ProveedorIA = {
  nombre: string;
  baseURL: string;
  modelo: string;
  apiKey: string;
  anonimizar: boolean;
  formato: FormatoJson;
};

/** Valores por defecto de proveedores conocidos (la clave nunca tiene valor por defecto). */
const CONOCIDOS: Record<string, Partial<Omit<ProveedorIA, "nombre" | "apiKey">>> = {
  groq: { baseURL: "https://api.groq.com/openai/v1", modelo: "openai/gpt-oss-120b" },
  // El plan gratuito de Gemini puede usar los datos para entrenar: se anonimiza siempre por defecto.
  gemini: { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", modelo: "gemini-2.5-flash", anonimizar: true },
};

const ORDEN_POR_DEFECTO = "groq,gemini";

function variable(env: Record<string, string | undefined>, nombre: string, sufijo: string) {
  const valor = env[`${nombre.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_${sufijo}`];
  return valor?.trim() ? valor.trim() : undefined;
}

/** Proveedores en orden de respaldo, solo los que tienen clave, URL y modelo. */
export function proveedoresConfigurados(env: Record<string, string | undefined> = process.env): ProveedorIA[] {
  const nombres = (env.IA_PROVEEDORES?.trim() || ORDEN_POR_DEFECTO)
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  const lista: ProveedorIA[] = [];
  for (const nombre of [...new Set(nombres)]) {
    const base = CONOCIDOS[nombre] ?? {};
    const apiKey = variable(env, nombre, "API_KEY");
    const baseURL = variable(env, nombre, "BASE_URL") ?? base.baseURL;
    const modelo = variable(env, nombre, "MODEL") ?? base.modelo;
    if (!apiKey || !baseURL || !modelo) continue; // sin clave (o incompleto): se salta
    const anonimizarVar = variable(env, nombre, "ANONIMIZAR");
    const formatoVar = variable(env, nombre, "FORMATO_JSON");
    lista.push({
      nombre,
      baseURL,
      modelo,
      apiKey,
      anonimizar: anonimizarVar ? anonimizarVar.toLowerCase() === "true" : (base.anonimizar ?? false),
      formato: formatoVar === "json_object" ? "json_object" : "json_schema",
    });
  }
  return lista;
}
