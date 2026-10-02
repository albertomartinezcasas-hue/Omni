// Paso 4 — Veredicto y puntaje (código). Fórmulas exactas del documento de requerimientos.
import { NIVELES_ESTUDIO, NIVELES_IDIOMA, type NivelEstudio, type NivelIdioma } from "@/lib/catalogos";
import { describirMeses } from "./fechas";
import type { ResultadoVerificado } from "./tipos";

export const VALOR_NIVEL = { 0: 0, 1: 60, 2: 100 } as const;
export const PESOS = { O: 0.4, D: 0.25, E: 0.2, F: 0.15 } as const;

const promedio = (valores: number[]) => valores.reduce((a, b) => a + b, 0) / valores.length;

/** E = mín(100, 70 + 30 × (años − mínimo) / máx(mínimo, 1)); si los años son menores al mínimo, E = 0. */
export function puntajeExperiencia(anios: number, minimo: number) {
  if (anios < minimo) return 0;
  return Math.min(100, 70 + (30 * (anios - minimo)) / Math.max(minimo, 1));
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

/**
 * VIABLE, NO_VIABLE o REVISION (pendiente de revisión): NO VIABLE solo por causas que una persona debe confirmar
 * (cita de la IA que no coincide con el CV, requisito no encontrado por un modelo ligero o relevancia de puestos).
 */
export type Veredicto = "VIABLE" | "NO_VIABLE" | "REVISION";

export type Calificacion = {
  veredicto: Veredicto;
  motivosNoViable: string[];
  puntaje: number;
  O: number;
  D: number | null;
  E: number;
  F: number;
  pesos: { O: number; D: number; E: number; F: number };
};

/** Los modelos "lite" son menos precisos: un requisito que no encontraron se confirma con una persona. */
export function esModeloLigero(modelo: string) {
  return /lite/i.test(modelo);
}

/**
 * `posibleManipulacion`: el CV traía instrucciones o texto oculto. Entonces una cita que no coincide puede venir de una
 * inyección y no ablanda el veredicto: cuenta como causa firme.
 */
export function calificar(
  r: ResultadoVerificado,
  opciones: { modeloLigero?: boolean; posibleManipulacion?: boolean } = {},
): Calificacion {
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

  // Cada causa de NO VIABLE se marca como firme o como "a revisar" por una persona.
  let hayCausaFirme = false;
  const motivosNoViable = obligatorios
    .filter((q) => q.nivel === 0)
    .map((q) => {
      if (q.citaNoVerificada) {
        if (opciones.posibleManipulacion) hayCausaFirme = true;
        return `No se encontró evidencia de: ${q.texto} (la cita del análisis no coincide con el CV; revisar manualmente)`;
      }
      if (opciones.modeloLigero) return `No se encontró evidencia de: ${q.texto} (analizado con un modelo ligero; confirmar en el CV)`;
      hayCausaFirme = true;
      return `No se encontró evidencia de: ${q.texto}`;
    });
  if (r.experiencia.anios < r.experiencia.minimo) {
    const dudaPorRelevancia = (r.experiencia.aniosConNoRelevantes ?? 0) >= r.experiencia.minimo;
    if (!dudaPorRelevancia) hayCausaFirme = true;
    const notas = [
      ...(r.experiencia.puestosDescartados > 0
        ? [`${r.experiencia.puestosDescartados} ${r.experiencia.puestosDescartados === 1 ? "puesto no se sumó" : "puestos no se sumaron"} por fechas incompletas o cita no verificable; revisar el CV`]
        : []),
      ...(r.experiencia.puestos.some((p) => p.fechasSinMes) ? ["fechas sin mes; confirmar en entrevista"] : []),
      ...((r.experiencia.puestosNoRelevantes?.length ?? 0) > 0
        ? [
            `no contados: ${r.experiencia
              .puestosNoRelevantes!.map((p) => `${p.puesto} (${describirMeses(p.meses)})`)
              .join(", ")}; revisar`,
          ]
        : []),
    ];
    if (dudaPorRelevancia) notas.push("con los puestos no contados se alcanza el mínimo; confirmar su relevancia");
    motivosNoViable.push(
      `Experiencia relevante: ${r.experiencia.anios.toFixed(1)} años; mínimo requerido: ${r.experiencia.minimo}${notas.length ? ` (${notas.join("; ")})` : ""}`,
    );
  }

  return {
    veredicto: !motivosNoViable.length ? "VIABLE" : hayCausaFirme ? "NO_VIABLE" : "REVISION",
    motivosNoViable,
    puntaje,
    O,
    D,
    E,
    F,
    pesos,
  };
}
