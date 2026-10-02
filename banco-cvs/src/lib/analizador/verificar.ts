// Paso 3 — Verificación (código): toda cita debe existir literalmente en el texto del CV.
import { coincidenciasProtegidas } from "./atributosProtegidos";
import { ocultarDatosPersonales } from "./ocultar";
import type { Extraccion, ResultadoVerificado, VacanteEvaluada } from "./tipos";

const MIN_CARACTERES_CITA = 3;

/** Comparación sin distinguir mayúsculas, con espacios normalizados (y Unicode NFC). */
export function normalizarParaCita(texto: string) {
  return texto.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** ¿La cita aparece literalmente en el texto (el mismo texto ocultado que vio la IA)? */
export function citaEnTexto(cita: string | null | undefined, textoNormalizado: string) {
  if (!cita) return false;
  const buscada = normalizarParaCita(cita);
  return buscada.length >= MIN_CARACTERES_CITA && textoNormalizado.includes(buscada);
}

/** Texto libre generado (brechas, preguntas, cualidades): sin datos de contacto ni atributos protegidos. */
function textoLibreSeguro(texto: string) {
  const limpio = ocultarDatosPersonales(texto.trim());
  return limpio && coincidenciasProtegidas(limpio).length === 0 ? limpio : null;
}

export function verificarExtraccion(
  extraccion: Extraccion,
  vacante: VacanteEvaluada,
  textoOculto: string,
): ResultadoVerificado {
  const texto = normalizarParaCita(textoOculto);
  const existe = (cita: string | null | undefined) => citaEnTexto(cita, texto);

  const porId = new Map(extraccion.requisitos.map((r) => [r.id, r]));
  const requisitos = [
    ...vacante.obligatorios.map((r) => ({ ...r, tipo: "OBLIGATORIO" as const })),
    ...vacante.deseables.map((r) => ({ ...r, tipo: "DESEABLE" as const })),
  ].map((r) => {
    const dado = porId.get(r.id);
    const nivelDado = (dado?.nivel ?? 0) as 0 | 1 | 2;
    const verificada = nivelDado > 0 && existe(dado?.cita);
    return {
      id: r.id,
      tipo: r.tipo,
      texto: r.texto,
      nivel: verificada ? nivelDado : 0,
      cita: verificada ? dado!.cita : null,
      citaNoVerificada: nivelDado > 0 && !verificada,
    } as const;
  });

  const puestos = extraccion.puestos.filter((p) => existe(p.cita) && p.anios >= 0);
  const anios = Math.round(puestos.reduce((total, p) => total + p.anios, 0) * 10) / 10;

  const estudiosVerificados = extraccion.estudios.nivel !== "NO_ESPECIFICADO" && existe(extraccion.estudios.cita);

  const idiomas = vacante.idiomas.map((requerido) => {
    const clave = normalizarParaCita(requerido.idioma);
    const dado = extraccion.idiomas.find((i) => normalizarParaCita(i.idioma) === clave);
    const verificado = !!dado && dado.nivel !== "NO_ESPECIFICADO" && existe(dado.cita);
    return {
      idioma: requerido.idioma,
      requerido: requerido.nivel,
      encontrado: verificado ? dado!.nivel : ("NO_ESPECIFICADO" as const),
      cita: verificado ? dado!.cita : null,
    };
  });

  const cualidades = extraccion.cualidades
    .filter((c) => existe(c.cita) && coincidenciasProtegidas(`${c.cualidad} ${c.cita}`).length === 0)
    .map((c) => ({ cualidad: textoLibreSeguro(c.cualidad), cita: c.cita }))
    .filter((c): c is { cualidad: string; cita: string } => c.cualidad !== null);

  const nombreVerificado =
    extraccion.nombreCandidato.valor &&
    existe(extraccion.nombreCandidato.cita) &&
    normalizarParaCita(extraccion.nombreCandidato.cita!).includes(normalizarParaCita(extraccion.nombreCandidato.valor));

  return {
    nombreCandidato: nombreVerificado ? extraccion.nombreCandidato.valor!.trim() : null,
    requisitos,
    experiencia: {
      anios,
      minimo: vacante.aniosMinimos,
      puestos,
      puestosDescartados: extraccion.puestos.length - puestos.length,
    },
    estudios: {
      requerido: vacante.nivelEstudiosMinimo,
      encontrado: estudiosVerificados ? extraccion.estudios.nivel : "NO_ESPECIFICADO",
      cita: estudiosVerificados ? extraccion.estudios.cita : null,
    },
    idiomas,
    cualidades,
    cualidadesDescartadas: extraccion.cualidades.length - cualidades.length,
    brechas: extraccion.brechas.map(textoLibreSeguro).filter((t): t is string => !!t),
    preguntas: extraccion.preguntas.map(textoLibreSeguro).filter((t): t is string => !!t),
  };
}
