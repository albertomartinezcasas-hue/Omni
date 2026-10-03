import Link from "next/link";
import type { FilaCandidato } from "@/lib/analisis/consultas";
import { describirMeses } from "@/lib/analizador/fechas";
import { tiempoRestante } from "@/lib/archivos/conservacion";
import {
  CATEGORIAS,
  ETIQUETA_CATEGORIA,
  ETIQUETA_ESTUDIO,
  ETIQUETA_IDIOMA,
  type Categoria,
  type NivelEstudio,
  type NivelIdioma,
} from "@/lib/catalogos";
import { BadgeCategoria, BadgeDesactualizado } from "./BadgeCategoria";
import { BotonAnalizar } from "./BotonAnalizar";
import { celda, celdaEncabezado, tabla, tarjetaTabla } from "./estilos";
import { formatearFecha } from "./Fecha";

const fmt = (n: number | null) => (n === null ? "—" : Math.round(n).toString());
const ESTATUS: Record<string, string> = { TITULADO: "titulado", CONCLUIDO: "concluido", EN_CURSO: "en curso", TRUNCO: "trunco" };
const recortar = (t: string, n = 80) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function EvidenciaClave({ c }: { c: FilaCandidato["clave"] }) {
  const o = c.obligatorios;
  const total = o.demostrados + o.mencionados + o.sin;
  return (
    <ul className="space-y-0.5 text-xs text-slate-800">
      <li>
        <span className="font-semibold">Obligatorios:</span> {o.demostrados}/{total} demostrados
        {o.mencionados > 0 && `, ${o.mencionados} solo mencionado${o.mencionados > 1 ? "s" : ""}`}
        {o.sin > 0 && `, ${o.sin} sin evidencia`}
      </li>
      <li>
        <span className="font-semibold">Experiencia:</span> {describirMeses(c.meses)}{" "}
        <span className="text-slate-600">(mín. {c.minimo})</span>
      </li>
      <li>
        <span className="font-semibold">Estudios:</span>{" "}
        {c.estudios.encontrado === "NO_ESPECIFICADO"
          ? "no especificado"
          : `${ETIQUETA_ESTUDIO[c.estudios.encontrado as NivelEstudio]}${ESTATUS[c.estudios.estatus] ? ` (${ESTATUS[c.estudios.estatus]})` : ""}`}
      </li>
      {c.idiomas.map((i) => (
        <li key={i.idioma}>
          <span className="font-semibold">{i.idioma}:</span>{" "}
          {i.encontrado === "NO_ESPECIFICADO" ? "no especificado" : ETIQUETA_IDIOMA[i.encontrado as NivelIdioma]}
        </li>
      ))}
    </ul>
  );
}

export function TablaCandidatos({
  grupos,
  vacanteId,
  soloLectura,
}: {
  grupos: Record<Categoria, FilaCandidato[]>;
  vacanteId: string;
  soloLectura: boolean;
}) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-700">
        <abbr title="Obligatorios · Deseables · Experiencia · Formación e idiomas" className="font-semibold no-underline">
          O · D · E · F
        </abbr>{" "}
        = Obligatorios (40 %) · Deseables (25 %) · Experiencia (20 %) · Formación e idiomas (15 %), cada uno de 0 a 100.
      </p>
      {/* En pantallas angostas las tablas se desplazan de lado y no siempre se nota. */}
      <p className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 lg:hidden">
        Desliza la tabla para ver más columnas <span aria-hidden="true">→</span>
      </p>
      {CATEGORIAS.map((categoria) => {
        const filas = grupos[categoria];
        return (
          <section key={categoria} className={tarjetaTabla} aria-labelledby={`grupo-${categoria}`}>
            <h3 id={`grupo-${categoria}`} className="flex items-center gap-3 px-4 pt-4 text-base font-bold text-slate-900">
              <BadgeCategoria categoria={categoria} />
              <span>{filas.length} {filas.length === 1 ? "candidato" : "candidatos"}</span>
            </h3>
            {categoria === "REVISION" && filas.length > 0 && (
              <p className="px-4 pt-1 text-sm text-slate-700">
                Requieren tu confirmación: revisa la evidencia en el CV y elige la categoría final con «Cambiar categoría».
                El CV se elimina al cumplirse el plazo de conservación aunque ya lo hayas revisado: solo una subida o un
                análisis nuevo lo extienden. Si se elimina antes de que elijas la categoría, quedará en el historial como
                «expiró sin revisión».
              </p>
            )}
            {filas.length === 0 ? (
              <p className="px-4 pb-4 pt-2 text-sm text-slate-600">Sin candidatos en {ETIQUETA_CATEGORIA[categoria]}.</p>
            ) : (
              <table className={`${tabla} mt-2 min-w-[56rem] table-fixed`}>
                {/* Mismos anchos en todos los grupos para comparar de un vistazo. */}
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[8%]" />
                  <col className="w-[20%]" />
                  <col className="w-[26%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className={celdaEncabezado}>Candidato</th>
                    <th scope="col" className={`${celdaEncabezado} text-right`}>Puntaje</th>
                    <th scope="col" className={celdaEncabezado}>Categoría</th>
                    <th scope="col" className={celdaEncabezado}>Evidencia clave</th>
                    <th scope="col" className={celdaEncabezado}>
                      <abbr title="Obligatorios · Deseables · Experiencia · Formación e idiomas" className="no-underline">O·D·E·F</abbr>
                    </th>
                    <th scope="col" className={celdaEncabezado}>Análisis</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.analisisId}>
                      <td className={`${celda} break-words`}>
                        <Link href={`/analisis/${f.analisisId}`} className="font-semibold text-blue-700 hover:underline">
                          {f.candidato}
                        </Link>
                        {f.clave.posibleManipulacion && (
                          <span className="mt-1 block w-fit rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">
                            ⚠ Posible manipulación del CV
                          </span>
                        )}
                        {f.motivos.length > 0 && (
                          <span className="mt-1 block text-xs text-slate-700">
                            {f.motivos[0]}
                            {f.motivos.length > 1 ? ` (+${f.motivos.length - 1})` : ""}
                          </span>
                        )}
                        {f.categoria.final === "REVISION" && f.seElimina && (
                          <span className="mt-1 block text-xs font-semibold text-red-800">{tiempoRestante(f.seElimina)}</span>
                        )}
                      </td>
                      <td className={`${celda} text-right text-lg font-bold`}>{f.puntaje}</td>
                      <td className={celda}>
                        <BadgeCategoria categoria={f.categoria.final} causa={f.categoria.ajustadaPor ? null : f.categoria.causaNoViable} siSeConfirma={f.categoria.ajustadaPor ? null : f.categoria.siSeConfirma} />
                        {f.categoria.ajustadaPor && f.categoria.ajuste && (
                          <span className="mt-1 block text-xs text-slate-700" title={f.categoria.ajuste.comentario}>
                            Ajustada por {f.categoria.ajustadaPor} · calculada: {ETIQUETA_CATEGORIA[f.categoria.calculada]}
                            <span className="block italic">«{recortar(f.categoria.ajuste.comentario)}»</span>
                          </span>
                        )}
                      </td>
                      <td className={celda}><EvidenciaClave c={f.clave} /></td>
                      <td className={`${celda} font-mono text-xs`}>
                        {fmt(f.O)}·{fmt(f.D)}·{fmt(f.E)}·{fmt(f.F)}
                      </td>
                      <td className={celda}>
                        <span className="block text-xs text-slate-700">{formatearFecha(f.creadoEn)}</span>
                        {f.desactualizado && (
                          <div className="mt-1 space-y-1">
                            <BadgeDesactualizado />
                            {!soloLectura && !f.sinAnalisisIA && (
                              <BotonAnalizar
                                cvId={f.cvId}
                                vacanteId={vacanteId}
                                texto="Re-analizar"
                                aviso={f.categoria.ajustadaPor ? `El ajuste manual de ${f.categoria.ajustadaPor} no se copiará al nuevo análisis (quedará visible como ajuste previo).` : undefined}
                              />
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
