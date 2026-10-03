import { ErrorNegocio, ErrorTransitorio } from "@/lib/errores";

// Límite de uso del analizador, en memoria del proceso del servidor (la app corre en una sola instancia con SQLite).
// Evita que clics repetidos o análisis en paralelo agoten el cupo gratuito de todos los modelos.

export const MAX_ANALISIS_POR_MINUTO = 10;
const VENTANA_MS = 60_000;

const enCurso = new Set<string>();
const recientes = new Map<string, number[]>();

/**
 * Ejecuta `fn` si el usuario no rebasó el límite por minuto y no hay otro análisis del mismo CV con la misma vacante
 * en curso. Si no, lanza un ErrorNegocio con un mensaje claro.
 */
export async function conLimiteDeAnalisis<T>(usuarioId: string, cvId: string, vacanteId: string, fn: () => Promise<T>) {
  const clave = `${cvId}:${vacanteId}`;
  if (enCurso.has(clave)) {
    throw new ErrorNegocio("Este CV ya se está analizando para esta vacante. Espera a que termine.");
  }
  const ahora = Date.now();
  const marcas = (recientes.get(usuarioId) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (marcas.length >= MAX_ANALISIS_POR_MINUTO) {
    throw new ErrorTransitorio(`Alcanzaste el límite de ${MAX_ANALISIS_POR_MINUTO} análisis por minuto. Intenta en un momento.`);
  }
  marcas.push(ahora);
  recientes.set(usuarioId, marcas);
  enCurso.add(clave);
  try {
    return await fn();
  } finally {
    enCurso.delete(clave);
  }
}

/** Solo para pruebas. */
export function reiniciarLimites() {
  enCurso.clear();
  recientes.clear();
}
