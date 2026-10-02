import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { BadgeCategoria, BadgeDesactualizado } from "@/components/BadgeCategoria";
import { BotonAnalizar } from "@/components/BotonAnalizar";
import { BotonImprimir } from "@/components/BotonImprimir";
import { boton, celda, celdaEncabezado, tabla, tarjeta, tarjetaTabla } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import { FormularioAjuste } from "@/components/FormularioAjuste";
import { describirMeses } from "@/lib/analizador/fechas";
import { ETIQUETA_TIPO_PUESTO } from "@/lib/analizador/tipos";
import { ETIQUETA_CATEGORIA, ETIQUETA_ESTUDIO, ETIQUETA_IDIOMA, type Categoria, type NivelEstudio } from "@/lib/catalogos";
import { consultarAnalisis } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Análisis · Banco de CVs" };

const NIVEL = ["Sin evidencia", "Mencionado", "Demostrado"] as const;
const ESTILO_NIVEL = [
  "bg-slate-200 text-slate-800",
  "bg-amber-100 text-amber-900",
  "bg-green-100 text-green-900",
] as const;
const ESTATUS: Record<string, string> = {
  CONCLUIDO: "concluido",
  TITULADO: "titulado",
  EN_CURSO: "en curso",
  TRUNCO: "trunco",
  NO_ESPECIFICADO: "estatus no especificado",
};

const fmt = (n: number | null) => (n === null ? "—" : Math.round(n).toString());

export default async function PaginaAnalisis({ params }: { params: Promise<{ id: string }> }) {
  await protegerPagina("USUARIO");
  const { id } = await params;
  const a = await consultarAnalisis(id);
  if (!a) notFound();

  const r = a.resultado;
  const archivada = a.vacante.estado === "ARCHIVADA";
  const puedeReanalizar = !archivada && a.cv.estado === "CON_TEXTO";
  const avisoAjuste = a.categoria.ajustadaPor
    ? `El ajuste manual de ${a.categoria.ajustadaPor} no se copiará al nuevo análisis (quedará visible como ajuste previo).`
    : undefined;
  const candidato = a.cv.nombreCandidato ?? a.cv.nombreArchivo;
  const sinDeseables = a.puntajeD === null;
  const pesos = sinDeseables
    ? { O: 53.3, D: 0, E: 26.7, F: 20 }
    : { O: 40, D: 25, E: 20, F: 15 };

  return (
    <div className="space-y-6">
      <nav aria-label="Ruta" className="text-sm text-slate-700 print:hidden">
        <Link href={`/vacantes/${a.vacante.id}`} className="font-semibold text-blue-700 hover:underline">
          {a.vacante.titulo}
        </Link>{" "}
        › {candidato}
      </nav>

      {archivada && <Aviso tipo="info">Vacante archivada · solo lectura.</Aviso>}
      {a.desactualizado && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <BadgeDesactualizado />
          <span>La vacante se editó después de este análisis (versión {a.vacanteVersion} → {a.vacante.version}).</span>
          {puedeReanalizar && <span className="print:hidden"><BotonAnalizar cvId={a.cv.id} vacanteId={a.vacante.id} texto="Re-analizar" aviso={avisoAjuste} /></span>}
        </div>
      )}
      {((r.instruccionesOmitidas ?? 0) > 0 || (r.textoOcultoOmitido ?? 0) > 0) && (
        <section role="note" aria-labelledby="aviso-manipulacion" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <h2 id="aviso-manipulacion" className="font-semibold">Posible intento de manipular el análisis</h2>
          <ul className="mt-1 list-disc pl-5">
            {(r.textoOcultoOmitido ?? 0) > 0 && (
              <li>El PDF tenía {r.textoOcultoOmitido} caracteres en letra diminuta (texto oculto); se omitieron y no cuentan como evidencia.</li>
            )}
            {(r.instruccionesOmitidas ?? 0) > 0 && (
              <li>
                Se ignoraron {r.instruccionesOmitidas} {r.instruccionesOmitidas === 1 ? "renglón" : "renglones"} con texto que parece una
                instrucción al sistema.
              </li>
            )}
          </ul>
          <p className="mt-1">Revisa el CV original antes de decidir.</p>
        </section>
      )}
      {a.ajustesPrevios.length > 0 && (
        <Aviso tipo="info">
          Hay un ajuste previo en un análisis anterior: {ETIQUETA_CATEGORIA[a.ajustesPrevios[0].categoria as Categoria]} por{" "}
          {a.ajustesPrevios[0].autor.nombre} el {formatearFecha(a.ajustesPrevios[0].creadoEn)} — «{a.ajustesPrevios[0].comentario}».{" "}
          <Link href={`/analisis/${a.ajustesPrevios[0].analisis.id}`} className="font-semibold underline">
            Ver análisis anterior
          </Link>
        </Aviso>
      )}

      {/* Resumen: veredicto, categoría y puntaje primero */}
      <section className={`${tarjeta} space-y-4`} aria-labelledby="resumen">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2">
            <h1 id="resumen" className="text-2xl font-bold text-slate-900 break-words">{candidato}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <BadgeCategoria categoria={a.categoria.final} causa={a.categoria.ajustadaPor ? null : a.categoria.causaNoViable} grande />
              <span className="text-sm font-semibold text-slate-800">
                Veredicto: {a.veredicto === "VIABLE" ? "VIABLE" : "NO VIABLE"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700">Puntaje</p>
            <p className="text-5xl font-bold text-slate-900">{a.puntaje}</p>
            <p className="text-xs text-slate-600">de 100</p>
          </div>
        </div>

        {a.categoria.ajustadaPor && a.categoria.ajuste && (
          <p className="text-sm text-slate-800">
            <span className="font-semibold">Ajustada por {a.categoria.ajustadaPor}</span> el{" "}
            {formatearFecha(a.categoria.ajuste.creadoEn)}: «{a.categoria.ajuste.comentario}». Categoría calculada:{" "}
            <BadgeCategoria categoria={a.categoria.calculada} causa={a.categoria.causaNoViable} />
          </p>
        )}

        {a.motivos.length > 0 && (
          <div className="rounded-md border border-slate-300 bg-slate-50 p-4">
            <h2 className="text-sm font-bold text-slate-900">Motivos de NO VIABLE (verifícalos en el CV)</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">
              {a.motivos.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {(
            [
              ["O", "Obligatorios", a.puntajeO, pesos.O],
              ["D", "Deseables", a.puntajeD, pesos.D],
              ["E", "Experiencia", a.puntajeE, pesos.E],
              ["F", "Formación e idiomas", a.puntajeF, pesos.F],
            ] as const
          ).map(([letra, nombre, valor, peso]) => (
            <div key={letra} className="rounded-md border border-slate-200 p-3">
              <dt className="font-semibold text-slate-700">{letra} · {nombre}</dt>
              <dd className="text-2xl font-bold text-slate-900">{fmt(valor)}</dd>
              <dd className="text-xs text-slate-600">
                {valor === null ? "Sin deseables: su 25 % se reparte" : `Peso ${peso} %`}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-slate-600">
          Analizado por {a.creadoPor.nombre} el {formatearFecha(a.creadoEn)} con el modelo {a.modelo}. Umbrales vigentes:
          Excelente ≥ {a.umbrales.excelente}, Bueno ≥ {a.umbrales.bueno}, Pasable ≥ {a.umbrales.pasable}.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className={`${tarjeta} space-y-3`} aria-labelledby="cualidades">
            <h2 id="cualidades" className="text-lg font-bold text-slate-900">Cualidades principales</h2>
            {r.cualidades.length === 0 ? (
              <p className="text-sm text-slate-700">No hubo cualidades con evidencia verificable en el CV.</p>
            ) : (
              <ul className="space-y-3">
                {r.cualidades.map((c) => (
                  <li key={c.cualidad} className="text-sm">
                    <p className="font-semibold text-slate-900">{c.cualidad}</p>
                    <blockquote className="mt-1 border-l-4 border-slate-300 pl-3 text-slate-700">«{c.cita}»</blockquote>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${tarjetaTabla}`} aria-labelledby="requisitos">
            <h2 id="requisitos" className="px-6 pt-6 text-lg font-bold text-slate-900">Evidencia por requisito</h2>
            <table className={`${tabla} mt-3`}>
              <thead>
                <tr>
                  <th scope="col" className={celdaEncabezado}>Requisito</th>
                  <th scope="col" className={celdaEncabezado}>Evidencia</th>
                  <th scope="col" className={celdaEncabezado}>Cita del CV</th>
                </tr>
              </thead>
              <tbody>
                {r.requisitos.map((q) => (
                  <tr key={q.id}>
                    <td className={celda}>
                      <span className="block text-xs font-semibold text-slate-600">
                        {q.tipo === "OBLIGATORIO" ? "Obligatorio" : "Deseable"}
                      </span>
                      {q.texto}
                    </td>
                    <td className={celda}>
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${ESTILO_NIVEL[q.nivel]}`}>
                        {NIVEL[q.nivel]}
                      </span>
                      {q.citaNoVerificada && (
                        <span className="mt-1 block text-xs text-red-800">La cita del análisis no coincide con el CV; revisar.</span>
                      )}
                    </td>
                    <td className={`${celda} text-slate-700`}>{q.cita ? `«${q.cita}»` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={`${tarjeta} space-y-3`} aria-labelledby="experiencia">
            <h2 id="experiencia" className="text-lg font-bold text-slate-900">
              Experiencia relevante: {describirMeses(r.experiencia.meses ?? Math.round(r.experiencia.anios * 12))} (mínimo{" "}
              {r.experiencia.minimo} {r.experiencia.minimo === 1 ? "año" : "años"})
            </h2>
            {r.experiencia.puestos.length === 0 ? (
              <p className="text-sm text-slate-700">No se encontraron puestos relevantes con fechas verificables.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {r.experiencia.puestos.map((p) => (
                  <li key={p.cita}>
                    <p className="font-semibold text-slate-900">
                      {p.puesto} · {p.empresa}{" "}
                      <span className="font-normal text-slate-700">
                        ({ETIQUETA_TIPO_PUESTO[p.tipo]}, {p.inicio} – {p.fin}, {describirMeses(Math.round(p.anios * 12))})
                      </span>
                    </p>
                    {p.justificacion && <p className="text-xs text-slate-700">Relevante: {p.justificacion}</p>}
                    {p.fechasSinMes && <p className="text-xs text-amber-900">Fechas sin mes: se contó de forma conservadora; confirmar en entrevista.</p>}
                    <blockquote className="mt-1 border-l-4 border-slate-300 pl-3 text-slate-700">«{p.cita}»</blockquote>
                  </li>
                ))}
              </ul>
            )}
            {(r.experiencia.puestosNoRelevantes?.length ?? 0) > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-semibold">Puestos no considerados relevantes (no suman experiencia; revisar):</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {r.experiencia.puestosNoRelevantes!.map((p) => (
                    <li key={p.cita}>
                      {p.puesto} · {p.empresa} ({p.inicio} – {p.fin}, {describirMeses(p.meses)}) — {p.justificacion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-slate-600">
              Total verificable: {describirMeses(r.experiencia.meses ?? Math.round(r.experiencia.anios * 12))}. Los años los calcula el sistema con las fechas citadas (meses de inicio y término incluidos, sin contar
              traslapes); «actual» = {r.experiencia.fechaAnalisis}.
              {r.experiencia.puestosDescartados > 0 &&
                ` ${r.experiencia.puestosDescartados} puesto(s) se descartaron por no tener fechas o cita verificable.`}
            </p>
            {(r.experiencia.descartes?.length ?? 0) > 0 && (
              <ul className="list-disc pl-5 text-xs text-slate-700">
                {r.experiencia.descartes!.map((d, i) => (
                  <li key={i}>
                    Descartado: {d.puesto} · {d.empresa} — {d.motivo}. Revisa el CV.
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${tarjeta} space-y-2 text-sm`} aria-labelledby="formacion">
            <h2 id="formacion" className="text-lg font-bold text-slate-900">Formación e idiomas</h2>
            <p>
              <span className="font-semibold">Estudios:</span> se requiere {ETIQUETA_ESTUDIO[r.estudios.requerido]}; se encontró{" "}
              {r.estudios.encontrado === "NO_ESPECIFICADO"
                ? "no especificado"
                : `${ETIQUETA_ESTUDIO[r.estudios.encontrado as NivelEstudio]} (${ESTATUS[r.estudios.estatus]})`}
              {r.estudios.cita && <span className="text-slate-700"> — «{r.estudios.cita}»</span>}
            </p>
            {r.idiomas.map((i) => (
              <p key={i.idioma}>
                <span className="font-semibold">{i.idioma}:</span> se requiere {ETIQUETA_IDIOMA[i.requerido]}; se encontró{" "}
                {i.encontrado === "NO_ESPECIFICADO" ? "no especificado" : ETIQUETA_IDIOMA[i.encontrado]}
                {i.cita && <span className="text-slate-700"> — «{i.cita}»</span>}
              </p>
            ))}
          </section>
        </div>

        <div className="space-y-6">
          <section className={`${tarjeta} space-y-2`} aria-labelledby="brechas">
            <h2 id="brechas" className="text-lg font-bold text-slate-900">Brechas</h2>
            {r.brechas.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">{r.brechas.map((b) => <li key={b}>{b}</li>)}</ul>
            ) : (
              <p className="text-sm text-slate-700">Sin brechas frente a la vacante.</p>
            )}
          </section>
          <section className={`${tarjeta} space-y-2`} aria-labelledby="preguntas">
            <h2 id="preguntas" className="text-lg font-bold text-slate-900">Preguntas para la entrevista</h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm">{r.preguntas.map((p) => <li key={p}>{p}</li>)}</ol>
          </section>
          {!archivada && (
            <section className={`${tarjeta} space-y-3 print:hidden`} aria-labelledby="ajuste">
              <h2 id="ajuste" className="text-lg font-bold text-slate-900">Cambiar categoría</h2>
              <FormularioAjuste analisisId={a.id} actual={a.categoria.final} />
            </section>
          )}
          {a.ajustes.length > 1 && (
            <section className={`${tarjeta} space-y-2`} aria-labelledby="historial">
              <h2 id="historial" className="text-lg font-bold text-slate-900">Historial de ajustes</h2>
              <ul className="space-y-2 text-sm">
                {a.ajustes.map((j) => (
                  <li key={j.id}>
                    {ETIQUETA_CATEGORIA[j.categoria as Categoria]} · {j.autor.nombre} · {formatearFecha(j.creadoEn)}
                    <span className="block text-slate-700">«{j.comentario}»</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="flex flex-wrap gap-3 print:hidden">
            <BotonImprimir />
            <Link href={`/cvs/${a.cv.id}`} className={boton.secundario}>Ver CV</Link>
            <a href={`/api/cvs/${a.cv.id}/descargar`} className={boton.secundario}>Descargar CV</a>
            {puedeReanalizar && !a.desactualizado && (
              <BotonAnalizar cvId={a.cv.id} vacanteId={a.vacante.id} texto="Re-analizar" aviso={avisoAjuste} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
