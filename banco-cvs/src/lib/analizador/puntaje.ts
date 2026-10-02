// Paso 4 — Veredicto y puntaje (código). Fórmulas exactas del documento de requerimientos.
import { NIVELES_ESTUDIO, NIVELES_IDIOMA, type NivelEstudio, type NivelIdioma } from "@/lib/catalogos";
import type { ResultadoVerificado } from "./tipos";

export const VALOR_NIVEL = { 0: 0, 1: 60, 2: 100 } as const;
export const PESOS = { O: 0.4, D: 0.25, E: 0.2, F: 0.15 } as const;

const promedio = (valores: number[]) => valores.reduce((a, b) => a + b, 0) / valores.length;

/** E = mín(100, 70 + 30 × (años − mínimo) / máx(mínimo, 1)), acotado a ≥ 0. */
export function puntajeExperiencia(anios: number, minimo: number) {
  return Math.max(0, Math.min(100, 70 + (30 * (anios - minimo)) / Math.max(minimo, 1)));
}

/** Estudios: cumple o supera = 100; inferior o no especificado = 0. Sin requisito = 100. */
export function puntajeEstudios(requerido: NivelEstudio, encontrado: NivelEstudio | "NO_ESPECIFICADO") {
  if (requerido === "NINGUNO") return 100;
  if (encontrado === "NO_ESPECIFICADO") return 0;
  return NIVELES_ESTUDIO.indexOf(encontrado) >= NIVELES_ESTUDIO.indexOf(requerido) ? 100 : 0;
}

/** Idioma: cumple o supera = 100; un nivel abajo = 50; más abajo o no especificado = 0. */
export function puntajeIdioma(requerido: NivelIdioma, encontrado: NivelIdioma | "NO_ESPECIFICADO") {
  if (encontrado === "NO_ESPECIFICADO") return 0;
  const diferencia = NIVELES_IDIOMA.indexOf(encontrado) - NIVELES_IDIOMA.indexOf(requerido);
  if (diferencia >= 0) return 100;
  return diferencia === -1 ? 50 : 0;
}

export type Calificacion = {
  veredicto: "VIABLE" | "NO_VIABLE";
  motivosNoViable: string[];
  puntaje: number;
  O: number;
  D: number | null;
  E: number;
  F: number;
  pesos: { O: number; D: number; E: number; F: number };
};

export function calificar(r: ResultadoVerificado): Calificacion {
  const obligatorios = r.requisitos.filter((q) => q.tipo === "OBLIGATORIO");
  const deseables = r.requisitos.filter((q) => q.tipo === "DESEABLE");

  const O = promedio(obligatorios.map((q) => VALOR_NIVEL[q.nivel]));
  const D = deseables.length ? promedio(deseables.map((q) => VALOR_NIVEL[q.nivel])) : null;
  const E = puntajeExperiencia(r.experiencia.anios, r.experiencia.minimo);
  const F = promedio([
    puntajeEstudios(r.estudios.requerido, r.estudios.encontrado),
    ...r.idiomas.map((i) => puntajeIdioma(i.requerido, i.encontrado)),
  ]);

  // Sin deseables, su 25 % se reparte proporcionalmente entre O, E y F.
  const resto = PESOS.O + PESOS.E + PESOS.F;
  const pesos =
    D === null
      ? { O: PESOS.O / resto, D: 0, E: PESOS.E / resto, F: PESOS.F / resto }
      : { ...PESOS };

  const puntaje = Math.round(pesos.O * O + pesos.D * (D ?? 0) + pesos.E * E + pesos.F * F);

  const motivosNoViable = obligatorios
    .filter((q) => q.nivel === 0)
    .map((q) => `No se encontró evidencia de: ${q.texto}`);
  if (r.experiencia.anios < r.experiencia.minimo) {
    motivosNoViable.push(
      `No se encontró evidencia de: ${r.experiencia.minimo} ${r.experiencia.minimo === 1 ? "año" : "años"} de experiencia relevante (se encontraron ${r.experiencia.anios})`,
    );
  }

  return {
    veredicto: motivosNoViable.length ? "NO_VIABLE" : "VIABLE",
    motivosNoViable,
    puntaje,
    O,
    D,
    E,
    F,
    pesos,
  };
}
