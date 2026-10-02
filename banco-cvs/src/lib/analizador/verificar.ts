// Paso 3 — Verificación (código): toda cita debe existir literalmente en el texto del CV.
import { ETIQUETA_ESTUDIO, ETIQUETA_IDIOMA, NIVELES_ESTUDIO, NIVELES_IDIOMA } from "@/lib/catalogos";
import { coincidenciasProtegidas, enmascararProtegidos } from "./atributosProtegidos";
import { aniosDePeriodo, aniosSinTraslapes, describirMeses, fechaCdmx, formatoMes, mesesSinTraslapes, periodoDeCita } from "./fechas";
import { ocultarDatosPersonales } from "./ocultar";
import type { Extraccion, ResultadoVerificado, VacanteEvaluada } from "./tipos";

const MIN_CARACTERES_CITA = 12;
// Citas que parecen instrucciones dirigidas al sistema (posible inyección): nunca son evidencia.
export const PARECE_INSTRUCCION = new RegExp(
  [
    "\\b(ignora|olvida|omite|disregard|ignore)\\b.{0,40}\\b(instrucci|reglas|indicaciones|instructions)",
    "\\b(calif[ií]ca(?:me|lo|la|r)?|eval[uú]a(?:me|lo|la)?|clasif[ií]ca(?:me|lo|la)?)\\b.{0,30}\\b(como|con)\\b.{0,20}\\b(excelente|bueno|viable|100|nivel)",
    "\\binstrucci[oó]n(?:es)?\\s+(?:para|al|a la)\\s+(?:el\\s+|la\\s+)?(?:sistema|modelo|evaluador|evaluadora|revisor|reclutador|asistente|ia|analizador)\\b",
    "\\b(nota|mensaje|aviso)\\s+(?:para|al|a la)\\s+(?:quien\\s+eval[uú]a|el\\s+evaluador|la\\s+evaluadora|el\\s+revisor|el\\s+reclutador|la\\s+ia|el\\s+sistema|el\\s+modelo)",
    "^\\s*(?:al|a la|para el|para la)\\s+(?:revisor|evaluador|evaluadora|reclutador|reclutadora|sistema|modelo|ia)\\s*[:,]",
    "\\basigna(?:r|le)?\\s+(?:el\\s+)?nivel\\b",
    "\\btodos\\s+los\\s+requisitos\\s+(?:est[aá]n|quedan|son)\\s+(?:demostrados|cumplidos)",
    "\\b(note to|attention)\\s+(?:the\\s+)?(?:reviewer|recruiter|evaluator|ai|model|system)\\b",
  ].join("|"),
  "im",
);

export const MARCA_INSTRUCCION = "[TEXTO OMITIDO: parece una instrucción al sistema]";

/**
 * El CV es dato, nunca instrucciones: los renglones que parecen órdenes al sistema se omiten antes
 * de enviar el texto a la API y antes de verificar citas (no pueden aportar evidencia).
 */
export function neutralizarInstrucciones(texto: string) {
  let omitidos = 0;
  const limpio = texto
    .split("\n")
    .map((renglon) => {
      if (!PARECE_INSTRUCCION.test(renglon)) return renglon;
      omitidos += 1;
      return MARCA_INSTRUCCION;
    })
    .join("\n");
  return { texto: limpio, omitidos };
}

/**
 * Comparación sin distinguir mayúsculas, con espacios normalizados, NFKC (ligaduras, ancho completo),
 * comillas y guiones unificados, y sin el guion de corte al final de renglón de los PDF.
 */
export function normalizarParaCita(texto: string) {
  return texto
    .normalize("NFKC")
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―−]/g, "-")
    // Viñetas de lista (al inicio de renglón o sueltas entre espacios): la IA a veces las omite al citar.
    .replace(/(^|\s)[-•*▪◦·](?=\s)/gm, "$1")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿La cita aparece literalmente en el texto (el mismo texto ocultado que vio la IA)? */
export function citaEnTexto(cita: string | null | undefined, textoNormalizado: string) {
  if (!cita || PARECE_INSTRUCCION.test(cita)) return false;
  const buscada = normalizarParaCita(cita);
  return buscada.length >= MIN_CARACTERES_CITA && textoNormalizado.includes(buscada);
}

/** Texto libre generado (brechas, preguntas, cualidades): sin datos de contacto ni atributos protegidos. */
function textoLibreSeguro(texto: string) {
  if (coincidenciasProtegidas(texto).length) return null;
  const limpio = ocultarDatosPersonales(texto.trim());
  // Si al ocultar apareció un dato protegido (p. ej. estado civil suelto), se descarta completo.
  if (!limpio || limpio.includes("[DATO PERSONAL OMITIDO]") || coincidenciasProtegidas(limpio).length) return null;
  return limpio;
}

/** Palabras significativas (4+ letras, sin acentos) para comparar textos. */
function palabrasClave(texto: string) {
  return normalizarParaCita(texto)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4);
}

/** Cita que se guarda: literal del CV, con cualquier mención protegida enmascarada. */
const citaSegura = (cita: string) => enmascararProtegidos(cita);

export function verificarExtraccion(
  extraccion: Extraccion,
  vacante: VacanteEvaluada,
  textoOculto: string,
  fechaAnalisis: Date = new Date(),
): ResultadoVerificado {
  const texto = normalizarParaCita(textoOculto);
  const existe = (cita: string | null | undefined) => citaEnTexto(cita, texto);

  // Requisitos: nivel > 0 solo con cita verificada.
  const porId = new Map(extraccion.requisitos.map((r) => [r.id, r]));
  // "Demostrado" (nivel 2) exige que la cita no venga de un renglón que solo enlista habilidades
  // (p. ej. "Habilidades: SQL, Excel, Tableau"). Si viene de una lista, se toma como "mencionado" (nivel 1).
  const renglones = textoOculto.split("\n").map((r) => ({ original: r, normal: normalizarParaCita(r) }));
  const esLista = (r: string) => {
    const sinEtiqueta = r.replace(/^[^:]{0,30}:/, "");
    const elementos = sinEtiqueta.split(/[,;|·•]/).map((e) => e.trim()).filter(Boolean);
    return elementos.length >= 2 && elementos.every((e) => e.split(/\s+/).length <= 3);
  };
  const demuestra = (cita: string) => {
    const buscada = normalizarParaCita(cita);
    const origen = renglones.filter((r) => r.normal.includes(buscada));
    // Si la cita abarca varios renglones, no se puede atribuir a una lista.
    return origen.length === 0 ? !esLista(cita) : origen.some((r) => !esLista(r.original));
  };
  const requisitos = [
    ...vacante.obligatorios.map((r) => ({ ...r, tipo: "OBLIGATORIO" as const })),
    ...vacante.deseables.map((r) => ({ ...r, tipo: "DESEABLE" as const })),
  ].map((r) => {
    const dado = porId.get(r.id);
    const nivelDado = (dado?.nivel ?? 0) as 0 | 1 | 2;
    const verificada = nivelDado > 0 && existe(dado?.cita);
    const nivel = !verificada ? 0 : nivelDado === 2 && !demuestra(dado!.cita!) ? 1 : nivelDado;
    return {
      id: r.id,
      tipo: r.tipo,
      texto: r.texto,
      nivel,
      cita: verificada ? citaSegura(dado!.cita!) : null,
      citaNoVerificada: nivelDado > 0 && !verificada,
    } as const;
  });

  // Puestos: cita verificada que contiene literalmente el puesto, la empresa y al menos un año.
  // La duración la calcula el código con esas fechas ("actual" = fecha del análisis), sin traslapes.
  const vistas = new Set<string>();
  const descartes: { puesto: string; empresa: string; motivo: string; cita: string }[] = [];
  const descartar = (p: { puesto: string; empresa: string; cita: string }, motivo: string) => {
    descartes.push({
      puesto: textoLibreSeguro(p.puesto) ?? "—",
      empresa: textoLibreSeguro(p.empresa) ?? "—",
      motivo,
      cita: citaSegura(p.cita).slice(0, 200),
    });
    return [];
  };
  const puestos = extraccion.puestos.flatMap((p) => {
    const clave = normalizarParaCita(p.cita);
    if (vistas.has(clave)) return descartar(p, "cita repetida");
    if (!existe(p.cita)) return descartar(p, "la cita no aparece literalmente en el CV");
    const sinPuntuacion = (t: string) => normalizarParaCita(t).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const claveSinPuntuacion = sinPuntuacion(p.cita);
    if (!claveSinPuntuacion.includes(sinPuntuacion(p.puesto)) || !claveSinPuntuacion.includes(sinPuntuacion(p.empresa))) {
      return descartar(p, "el puesto o la empresa no aparecen en la cita");
    }
    if (coincidenciasProtegidas(`${p.puesto} ${p.empresa}`).length) return descartar(p, "contiene datos protegidos");
    const periodo = periodoDeCita(p.cita, fechaAnalisis);
    if (!periodo) return descartar(p, "falta la fecha de inicio o de fin (o hay más de un periodo); no se sumó");
    vistas.add(clave);
    return [{ ...p, periodo }];
  });
  // Solo suman los puestos que la IA consideró relevantes; los demás quedan visibles con su justificación.
  // Prácticas profesionales y servicio social solo suman si la vacante lo indica.
  const cuentaPorTipo = (p: { tipo: string }) =>
    vacante.cuentanPracticas || (p.tipo !== "PRACTICAS" && p.tipo !== "SERVICIO_SOCIAL");
  const relevantes = puestos.filter((p) => p.relevante && cuentaPorTipo(p));
  const noRelevantes = puestos
    .filter((p) => !p.relevante || !cuentaPorTipo(p))
    .map((p) =>
      p.relevante
        ? { ...p, justificacion: `${p.tipo === "PRACTICAS" ? "Prácticas profesionales" : "Servicio social"}: la vacante no las cuenta como experiencia` }
        : p,
    );
  const anios = aniosSinTraslapes(relevantes.map((p) => p.periodo));
  const meses = mesesSinTraslapes(relevantes.map((p) => p.periodo));

  // Estudios e idiomas.
  const estudiosVerificados = extraccion.estudios.nivel !== "NO_ESPECIFICADO" && existe(extraccion.estudios.cita);
  const estudios = {
    requerido: vacante.nivelEstudiosMinimo,
    encontrado: estudiosVerificados ? extraccion.estudios.nivel : ("NO_ESPECIFICADO" as const),
    estatus: estudiosVerificados ? extraccion.estudios.estatus : ("NO_ESPECIFICADO" as const),
    cita: estudiosVerificados ? citaSegura(extraccion.estudios.cita!) : null,
  };

  const idiomas = vacante.idiomas.map((requerido) => {
    const clave = normalizarParaCita(requerido.idioma);
    const dado = extraccion.idiomas.find((i) => normalizarParaCita(i.idioma) === clave);
    const verificado = !!dado && dado.nivel !== "NO_ESPECIFICADO" && existe(dado.cita);
    return {
      idioma: requerido.idioma,
      requerido: requerido.nivel,
      encontrado: verificado ? dado!.nivel : ("NO_ESPECIFICADO" as const),
      cita: verificado ? citaSegura(dado!.cita!) : null,
    };
  });

  // Cualidades: cita verificada y sin atributos protegidos.
  const cualidades = extraccion.cualidades
    .filter((c) => existe(c.cita) && coincidenciasProtegidas(`${c.cualidad} ${c.cita}`).length === 0)
    .map((c) => ({ cualidad: textoLibreSeguro(c.cualidad), cita: c.cita }))
    .filter((c): c is { cualidad: string; cita: string } => c.cualidad !== null);

  // Brechas: primero las que se derivan de la evidencia verificada; luego las de la IA como complemento.
  const brechasBase = [
    ...requisitos
      .filter((q) => q.nivel === 0)
      .map((q) => `${q.tipo === "OBLIGATORIO" ? "Obligatorio" : "Deseable"} sin evidencia: ${q.texto}${q.citaNoVerificada ? " (la cita del análisis no coincide con el CV; revisar)" : ""}`),
    ...requisitos.filter((q) => q.nivel === 1).map((q) => `Solo se menciona, sin detalle: ${q.texto}`),
    ...(anios < vacante.aniosMinimos
      ? [`Experiencia relevante comprobable: ${describirMeses(meses)} de ${vacante.aniosMinimos} ${vacante.aniosMinimos === 1 ? "año requerido" : "años requeridos"}`]
      : []),
    ...(vacante.nivelEstudiosMinimo !== "NINGUNO" &&
    (estudios.encontrado === "NO_ESPECIFICADO" ||
      NIVELES_ESTUDIO.indexOf(estudios.encontrado) < NIVELES_ESTUDIO.indexOf(vacante.nivelEstudiosMinimo))
      ? [`Estudios: se requiere ${ETIQUETA_ESTUDIO[vacante.nivelEstudiosMinimo]}`]
      : []),
    ...idiomas
      .filter((i) => i.encontrado === "NO_ESPECIFICADO" || NIVELES_IDIOMA.indexOf(i.encontrado) < NIVELES_IDIOMA.indexOf(i.requerido))
      .map((i) => `${i.idioma}: se requiere nivel ${ETIQUETA_IDIOMA[i.requerido]}`),
  ];
  // Se omiten las brechas de la IA que repiten con otras palabras un requisito que ya tiene brecha base.
  const conBrecha = requisitos.filter((q) => q.nivel < 2).map((q) => palabrasClave(q.texto));
  const brechasIa = extraccion.brechas
    .map(textoLibreSeguro)
    .filter((t): t is string => !!t)
    .filter((t) => {
      const palabras = new Set(palabrasClave(t));
      return !conBrecha.some((clave) => clave.length > 0 && clave.every((c) => palabras.has(c)));
    });

  const nombreVerificado =
    extraccion.nombreCandidato.valor &&
    !extraccion.nombreCandidato.valor.includes("[") &&
    existe(extraccion.nombreCandidato.cita) &&
    normalizarParaCita(extraccion.nombreCandidato.cita!).includes(normalizarParaCita(extraccion.nombreCandidato.valor)) &&
    coincidenciasProtegidas(extraccion.nombreCandidato.valor).length === 0;

  return {
    nombreCandidato: nombreVerificado ? extraccion.nombreCandidato.valor!.trim() : null,
    requisitos,
    experiencia: {
      anios,
      meses,
      minimo: vacante.aniosMinimos,
      puestos: relevantes.map((p) => ({
        puesto: p.puesto,
        empresa: p.empresa,
        tipo: p.tipo,
        inicio: formatoMes(p.periodo.inicio),
        fin: formatoMes(p.periodo.fin),
        anios: aniosDePeriodo(p.periodo),
        fechasSinMes: p.periodo.sinMes,
        justificacion: textoLibreSeguro(p.justificacion) ?? "",
        cita: citaSegura(p.cita),
      })),
      puestosNoRelevantes: noRelevantes.map((p) => ({
        puesto: p.puesto,
        empresa: p.empresa,
        inicio: formatoMes(p.periodo.inicio),
        fin: formatoMes(p.periodo.fin),
        meses: p.periodo.fin - p.periodo.inicio + 1,
        justificacion: textoLibreSeguro(p.justificacion) ?? "Sin justificación",
        cita: citaSegura(p.cita),
      })),
      puestosDescartados: extraccion.puestos.length - puestos.length,
      descartes,
      fechaAnalisis: fechaCdmx(fechaAnalisis).iso,
    },
    estudios,
    idiomas,
    cualidades: cualidades.map((c) => ({ ...c, cita: citaSegura(c.cita) })),
    cualidadesDescartadas: extraccion.cualidades.length - cualidades.length,
    brechas: [...brechasBase, ...brechasIa.filter((b) => !brechasBase.includes(b))],
    preguntas: extraccion.preguntas.map(textoLibreSeguro).filter((t): t is string => !!t),
    alertas: [
      ...descartes.map((d) => `Puesto no sumado — ${d.puesto} · ${d.empresa}: ${d.motivo}.`),
      ...(extraccion.alertas ?? []).map(textoLibreSeguro).filter((t): t is string => !!t),
    ],
  };
}
