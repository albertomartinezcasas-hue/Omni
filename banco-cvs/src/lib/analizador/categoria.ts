// Paso 5 — Categoría (código). Se calcula al mostrar, con el puntaje guardado y los umbrales vigentes.
import type { Categoria } from "@/lib/catalogos";
import type { Umbrales } from "@/lib/umbrales/servicio";

export function calcularCategoria(
  veredicto: string,
  puntaje: number,
  umbrales: Umbrales,
): Categoria {
  // Pendiente de revisión: una persona confirma la evidencia antes de descartar (sin importar el puntaje).
  if (veredicto === "REVISION") return "REVISION";
  if (veredicto === "NO_VIABLE" || puntaje < umbrales.pasable) return "NO_VIABLE";
  if (puntaje >= umbrales.excelente) return "EXCELENTE";
  if (puntaje >= umbrales.bueno) return "BUENO";
  return "PASABLE";
}

export type AjusteVigente = { categoria: string; comentario: string; autor: string; creadoEn: Date } | null;

/** La categoría ajustada manualmente prevalece; la calculada se conserva visible. */
export function categoriaMostrada(
  analisis: { veredicto: string; puntaje: number },
  umbrales: Umbrales,
  ajuste: AjusteVigente,
) {
  const calculada = calcularCategoria(analisis.veredicto, analisis.puntaje, umbrales);
  const causaNoViable =
    calculada !== "NO_VIABLE" ? null : analisis.veredicto === "NO_VIABLE" ? ("REQUISITO" as const) : ("PUNTAJE" as const);
  return {
    calculada,
    causaNoViable,
    final: (ajuste?.categoria as Categoria | undefined) ?? calculada,
    ajustadaPor: ajuste?.autor ?? null,
    ajuste,
  };
}
