import Link from "next/link";
import { BadgeCategoria } from "@/components/BadgeCategoria";
import { boton, campo, celda, celdaEncabezado, etiqueta, tabla, tarjeta, tarjetaTabla, titulo } from "@/components/estilos";
import { CATEGORIAS, ETIQUETA_CATEGORIA } from "@/lib/catalogos";
import { consultarHistorial } from "@/lib/consultas";
import type { Segmento } from "@/lib/historial";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Historial · Banco de CVs" };

type Filtros = { desde?: string; hasta?: string; area?: string; vacante?: string };

const porcentaje = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)} %` : "—");

function TablaSegmentos({ titulo: tituloTabla, filas, conArea = false }: { titulo: string; filas: (Segmento & { area?: string })[]; conArea?: boolean }) {
  return (
    <section className={tarjetaTabla} aria-labelledby={`tabla-${tituloTabla}`}>
      <h2 id={`tabla-${tituloTabla}`} className="px-4 pt-4 text-base font-bold text-slate-900">{tituloTabla}</h2>
      <table className={`${tabla} mt-2 min-w-[48rem]`}>
        <thead>
          <tr>
            <th scope="col" className={celdaEncabezado}>{conArea ? "Vacante" : "Área"}</th>
            {conArea && <th scope="col" className={celdaEncabezado}>Área</th>}
            <th scope="col" className={`${celdaEncabezado} text-right`}>CVs</th>
            <th scope="col" className={`${celdaEncabezado} text-right`}>Análisis</th>
            {CATEGORIAS.map((c) => (
              <th key={c} scope="col" className={`${celdaEncabezado} text-right`}>{ETIQUETA_CATEGORIA[c]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((s) => (
            <tr key={s.clave}>
              <th scope="row" className={`${celda} break-words text-left font-semibold`}>{s.etiqueta}</th>
              {conArea && <td className={celda}>{s.area}</td>}
              <td className={`${celda} text-right font-bold`}>{s.cvs}</td>
              <td className={`${celda} text-right`}>{s.analisis}</td>
              {CATEGORIAS.map((c) => (
                <td key={c} className={`${celda} text-right`}>{s.porCategoria[c]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function PaginaHistorial({ searchParams }: { searchParams: Promise<Filtros> }) {
  await protegerPagina("ADMIN");
  const f = await searchParams;
  const { resumen, opciones } = await consultarHistorial({
    desde: f.desde,
    hasta: f.hasta,
    area: f.area || undefined,
    vacanteId: f.vacante || undefined,
  });
  const hayFiltros = Object.values(f).some(Boolean);
  const consulta = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const { total } = resumen;
  const resultados = resumen.resultados;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={titulo}>Historial de análisis</h1>
          <p className="text-sm text-slate-700">
            Cuántos CVs se analizaron y cómo se clasificaron, por área y vacante. Se conserva aunque los CVs se eliminen
            por el plazo de conservación, y no guarda datos de los candidatos.
          </p>
        </div>
        <a href={`/api/historial${consulta ? `?${consulta}` : ""}`} className={boton.secundario}>Descargar CSV</a>
      </div>

      <form method="get" className={`${tarjeta} grid gap-4 md:grid-cols-5`} aria-label="Filtrar historial">
        <div>
          <label htmlFor="area" className={etiqueta}>Área</label>
          <select id="area" name="area" defaultValue={f.area ?? ""} className={campo}>
            <option value="">Todas</option>
            {opciones.areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="vacante" className={etiqueta}>Vacante</label>
          <select id="vacante" name="vacante" defaultValue={f.vacante ?? ""} className={campo}>
            <option value="">Todas</option>
            {opciones.vacantes.map((v) => <option key={v.id} value={v.id}>{v.titulo} ({v.area})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="desde" className={etiqueta}>Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={f.desde ?? ""} aria-describedby="formato-fecha" className={campo} />
        </div>
        <div>
          <label htmlFor="hasta" className={etiqueta}>Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={f.hasta ?? ""} aria-describedby="formato-fecha" className={campo} />
          <p id="formato-fecha" className="mt-1 text-xs text-slate-600">Fechas día/mes/año (hora de CDMX).</p>
        </div>
        <div className="flex items-end gap-3">
          <button type="submit" className={boton.primario}>Filtrar</button>
          {hayFiltros && <Link href="/admin/historial" className={boton.secundario}>Limpiar</Link>}
        </div>
      </form>

      {total.analisis === 0 ? (
        <div className={`${tarjeta} text-center text-sm text-slate-700`}>
          {hayFiltros ? "Ningún análisis cumple los filtros." : "Aún no hay análisis registrados."}
        </div>
      ) : (
        <>
          <section className={`${tarjeta} space-y-4`} aria-labelledby="resumen-historial">
            <h2 id="resumen-historial" className="text-base font-bold text-slate-900">Resumen</h2>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-slate-700">CVs analizados</dt>
                <dd className="text-3xl font-bold text-slate-900">{total.cvs}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-700">Análisis realizados (incluye re-análisis)</dt>
                <dd className="text-3xl font-bold text-slate-900">{total.analisis}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-700">Categorías ajustadas a mano</dt>
                <dd className="text-3xl font-bold text-slate-900">{resumen.ajustadas}</dd>
              </div>
            </dl>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Por categoría (resultado vigente de cada CV en cada vacante)</h3>
              <ul className="mt-2 flex flex-wrap gap-4">
                {CATEGORIAS.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-sm">
                    <BadgeCategoria categoria={c} />
                    <span className="font-bold text-slate-900">{total.porCategoria[c]}</span>
                    <span className="text-slate-700">({porcentaje(total.porCategoria[c], resultados)})</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <TablaSegmentos titulo="Por área" filas={resumen.porArea} />
          <TablaSegmentos titulo="Por vacante" filas={resumen.porVacante} conArea />
          <p className="text-xs text-slate-600">
            «CVs» cuenta cada candidato una vez por segmento; las categorías usan el análisis más reciente de cada CV en
            cada vacante, con los ajustes manuales. Los análisis anteriores a este historial usan los umbrales vigentes al
            instalarlo.
          </p>
        </>
      )}
    </div>
  );
}
