/**
 * Proveedores de IA compatibles con la API de OpenAI, configurados SOLO por variables de entorno del servidor.
 *
 * IA_PROVEEDORES=groq,gemini        → orden de respaldo (si no se define: "groq,gemini")
 * Para cada nombre N (en mayúsculas):
 *   N_API_KEY      clave (si falta, el proveedor se salta)
 *   N_BASE_URL     URL base compatible con OpenAI
 *   N_MODEL        modelo, o varios separados por comas: se prueban en orden (el cupo gratuito es por modelo)
 *   N_FORMATO_JSON "json_schema" (por defecto) o "json_object"
 *
 * IA_MODELOS_LIGEROS=modelo1,modelo2 → modelos menos precisos: un requisito que no encontraron deja el análisis
 * «Pendiente de revisión». Si no se define, se consideran ligeros los que contienen "lite" en el nombre.
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
  formato: FormatoJson;
};

/** Valores por defecto de proveedores conocidos (la clave nunca tiene valor por defecto). */
const CONOCIDOS: Record<string, Partial<Omit<ProveedorIA, "nombre" | "apiKey">>> = {
  groq: { baseURL: "https://api.groq.com/openai/v1", modelo: "openai/gpt-oss-120b" },
  // Todos los modelos de texto gratuitos de Gemini, del más capaz al más ligero: si uno agota su cupo, se usa el siguiente.
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    modelo: [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-flash-lite-latest",
    ].join(","),
  },
};

const ORDEN_POR_DEFECTO = "groq,gemini";
/** Tope de modelos por proveedor: limita cuántas llamadas puede encadenar un solo análisis. */
const MAX_MODELOS = 10;

function variable(env: Record<string, string | undefined>, nombre: string, sufijo: string) {
  const valor = env[`${nombre.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_${sufijo}`];
  return valor?.trim() ? valor.trim() : undefined;
}

function urlSegura(baseURL: string) {
  try {
    const url = new URL(baseURL);
    if (url.protocol === "https:") return true;
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
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
    if (!urlSegura(baseURL)) {
      // La clave viajaría sin cifrar: solo se acepta http:// hacia la propia máquina (p. ej. OmniRoute local).
      console.error(`[analizador] ${nombre} se omite: ${nombre.toUpperCase()}_BASE_URL debe usar https://`);
      continue;
    }
    const formatoVar = variable(env, nombre, "FORMATO_JSON");
    let modelos = [...new Set(modelo.split(",").map((m) => m.trim()).filter(Boolean))];
    if (modelos.length > MAX_MODELOS) {
      console.warn(`[analizador] ${nombre}: se usan solo los primeros ${MAX_MODELOS} modelos de la lista`);
      modelos = modelos.slice(0, MAX_MODELOS);
    }
    for (const m of modelos) {
      lista.push({
        nombre,
        baseURL,
        modelo: m,
        apiKey,
        formato: formatoVar === "json_object" ? "json_object" : "json_schema",
      });
    }
  }
  return lista;
}

/** Los modelos ligeros son menos precisos: un requisito que no encontraron se confirma con una persona. */
export function esModeloLigero(modelo: string, env: Record<string, string | undefined> = process.env) {
  // El modelo puede venir como "proveedor:modelo" (así se guarda en el análisis) o con prefijo "models/".
  const nombre = modelo.split(":").pop()!.replace(/^models\//, "").trim().toLowerCase();
  const lista = env.IA_MODELOS_LIGEROS?.split(",").map((m) => m.trim().toLowerCase()).filter(Boolean);
  return lista?.length ? lista.includes(nombre) : /lite/.test(nombre);
}

/**
 * Texto legible del modelo guardado («proveedor:modelo»), sin jerga: «Servicio de IA: Groq · modelo openai/gpt-oss-120b».
 * Si es un modelo ligero, lo dice: «versión rápida de la IA (menos precisa)». El valor guardado no cambia.
 */
export function describirModelo(modelo: string, env: Record<string, string | undefined> = process.env) {
  const separador = modelo.indexOf(":");
  const servicio = separador > 0 ? modelo.slice(0, separador) : "";
  const nombre = (separador > 0 ? modelo.slice(separador + 1) : modelo).replace(/^models\//, "");
  const partes = [
    servicio ? `Servicio de IA: ${servicio.charAt(0).toUpperCase()}${servicio.slice(1)}` : "Servicio de IA",
    ...(esModeloLigero(modelo, env) ? ["versión rápida de la IA (menos precisa)"] : []),
    `modelo ${nombre}`,
  ];
  return partes.join(" · ");
}
