import Link from "next/link";
import type { FilaCandidato } from "@/lib/analisis/consultas";
import { CATEGORIAS, ETIQUETA_CATEGORIA, type Categoria } from "@/lib/catalogos";
import { BadgeCategoria, BadgeDesactualizado } from "./BadgeCategoria";
import { BotonAnalizar } from "./BotonAnalizar";
import { celda, celdaEncabezado, tabla, tarjeta } from "./estilos";
import { formatearFecha } from "./Fecha";

const fmt = (n: number | null) => (n === null ? "—" : Math.round(n).toString());

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
      {CATEGORIAS.map((categoria) => {
        const filas = grupos[categoria];
        return (
          <section key={categoria} className={`${tarjeta} overflow-x-auto p-0`} aria-labelledby={`grupo-${categoria}`}>
            <h3 id={`grupo-${categoria}`} className="flex items-center gap-3 px-6 pt-5 text-base font-bold text-slate-900">
              <BadgeCategoria categoria={categoria} />
              <span>{filas.length} {filas.length === 1 ? "candidato" : "candidatos"}</span>
            </h3>
            {filas.length === 0 ? (
              <p className="px-6 pb-5 pt-2 text-sm text-slate-600">Sin candidatos en {ETIQUETA_CATEGORIA[categoria]}.</p>
            ) : (
              <table className={`${tabla} mt-3`}>
                <thead>
                  <tr>
                    <th scope="col" className={celdaEncabezado}>Candidato</th>
                    <th scope="col" className={`${celdaEncabezado} text-right`}>Puntaje</th>
                    <th scope="col" className={celdaEncabezado}>Categoría</th>
                    <th scope="col" className={`${celdaEncabezado} whitespace-nowrap`}>O · D · E · F</th>
                    <th scope="col" className={celdaEncabezado}>Análisis</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.analisisId}>
                      <td className={`${celda} max-w-xs`}>
                        <Link href={`/analisis/${f.analisisId}`} className="font-semibold text-blue-700 hover:underline break-words">
                          {f.candidato}
                        </Link>
                        {f.motivos.length > 0 && (
                          <span className="mt-1 block text-xs text-slate-700">{f.motivos[0]}{f.motivos.length > 1 ? ` (+${f.motivos.length - 1})` : ""}</span>
                        )}
                      </td>
                      <td className={`${celda} text-right text-lg font-bold`}>{f.puntaje}</td>
                      <td className={celda}>
                        <BadgeCategoria categoria={f.categoria.final} causa={f.categoria.ajustadaPor ? null : f.categoria.causaNoViable} />
                        {f.categoria.ajustadaPor && (
                          <span className="mt-1 block text-xs text-slate-700">
                            Ajustada por {f.categoria.ajustadaPor} · calculada: {ETIQUETA_CATEGORIA[f.categoria.calculada]}
                          </span>
                        )}
                      </td>
                      <td className={`${celda} whitespace-nowrap font-mono text-xs`}>
                        {fmt(f.O)} · {fmt(f.D)} · {fmt(f.E)} · {fmt(f.F)}
                      </td>
                      <td className={celda}>
                        <span className="block text-xs text-slate-700">{formatearFecha(f.creadoEn)}</span>
                        {f.desactualizado && (
                          <div className="mt-1 space-y-1">
                            <BadgeDesactualizado />
                            {!soloLectura && <BotonAnalizar cvId={f.cvId} vacanteId={vacanteId} texto="Re-analizar" />}
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
