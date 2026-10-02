import Link from "next/link";
import { BadgeCategoria } from "@/components/BadgeCategoria";
import { ayuda, boton, campo, celda, celdaEncabezado, etiqueta, tabla, tarjeta, tarjetaTabla, titulo } from "@/components/estilos";
import { CATEGORIAS, ETIQUETA_CATEGORIA } from "@/lib/catalogos";
import { consultarHistorial } from "@/lib/consultas";
import type { Segmento } from "@/lib/historial";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Historial · Banco de CVs" };

type Filtros = { desde?: string; hasta?: string; area?: string; vacante?: string };

const porcentaje = (parte: number, total: number) => (total ? `${Math.round((parte / total) * 100)} %` : "—");

function TablaSegmentos({ id, titulo: tituloTabla, filas, conArea = false }: { id: string; titulo: string; filas: (Segmento & { area?: string })[]; conArea?: boolean }) {
  const primera = "sticky left-0 z-10 bg-white";
  return (
    // Desplazable en móvil: recibe el foco para poder moverse con el teclado.
    <section className={tarjetaTabla} aria-labelledby={id} tabIndex={0}>
      <h2 id={id} className="px-4 pt-4 text-base font-bold text-slate-900">{tituloTabla}</h2>
      <table className={`${tabla} mt-2 min-w-[52rem]`}>
        <thead>
          <tr>
            <th scope="col" className={`${celdaEncabezado} ${primera}`}>{conArea ? "Vacante" : "Área"}</th>
            {conArea && <th scope="col" className={celdaEncabezado}>Área</th>}
            <th scope="col" className={`${celdaEncabezado} text-right`}>CVs</th>
            <th scope="col" className={`${celdaEncabezado} text-right`}>Resultados</th>
            <th scope="col" className={`${celdaEncabezado} text-right`}>Análisis</th>
            {CATEGORIAS.map((c) => (
              <th key={c} scope="col" className={`${celdaEncabezado} text-right`}>{ETIQUETA_CATEGORIA[c]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((s) => (
            <tr key={s.clave}>
              <th scope="row" className={`${celda} ${primera} break-words text-left font-semibold`}>{s.etiqueta}</th>
              {conArea && <td className={celda}>{s.area}</td>}
              <td className={`${celda} text-right font-bold`}>{s.cvs}</td>
              <td className={`${celda} text-right`}>{s.resultados}</td>
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

function Dato({ etiqueta: texto, valor }: { etiqueta: string; valor: string | number }) {
  return (
    <div>
      <dt className="text-sm text-slate-700">{texto}</dt>
      <dd className="text-3xl font-bold text-slate-900">{valor}</dd>
    </div>
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
        <div className="text-right">
          <a href={`/api/historial${consulta ? `?${consulta}` : ""}`} className={boton.secundario}>Descargar CSV</a>
          <p className={`${ayuda} mt-1`}>La descarga queda registrada en la bitácora.</p>
        </div>
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
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Dato etiqueta="CVs analizados" valor={total.cvs} />
              <Dato etiqueta="Resultados (CV × vacante)" valor={total.resultados} />
              <Dato etiqueta="Análisis realizados (incluye re-análisis)" valor={total.analisis} />
              <Dato etiqueta="Categorías ajustadas a mano" valor={resumen.ajustadas} />
            </dl>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Por categoría ({total.resultados} resultados)</h3>
              <ul className="mt-2 flex flex-wrap gap-4">
                {CATEGORIAS.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-sm">
                    <BadgeCategoria categoria={c} />
                    <span className="font-bold text-slate-900">{total.porCategoria[c]}</span>
                    <span className="text-slate-700">({porcentaje(total.porCategoria[c], total.resultados)})</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className={`${tarjeta} space-y-4`} aria-labelledby="auditoria-historial">
            <h2 id="auditoria-historial" className="text-base font-bold text-slate-900">Auditoría</h2>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[18rem_1fr]">
              <dt className="font-semibold text-slate-700">Pendientes de revisión sin resolver</dt>
              <dd>{resumen.pendientesRevision}</dd>
              <dt className="font-semibold text-slate-700">Tiempo promedio para resolver una revisión</dt>
              <dd>{resumen.horasPromedioRevision === null ? "—" : `${resumen.horasPromedioRevision.toFixed(1)} horas`}</dd>
              <dt className="font-semibold text-slate-700">Análisis con un modelo de IA ligero</dt>
              <dd>{resumen.conModeloLigero} ({porcentaje(resumen.conModeloLigero, total.analisis)})</dd>
              <dt className="font-semibold text-slate-700">Análisis de CVs con posible manipulación</dt>
              <dd>{resumen.conManipulacion}</dd>
              <dt className="font-semibold text-slate-700">Cambios manuales de categoría</dt>
              <dd>
                {resumen.cambiosManuales.length === 0 ? (
                  "Ninguno"
                ) : (
                  <ul className="space-y-0.5">
                    {resumen.cambiosManuales.map((c) => (
                      <li key={`${c.de}-${c.a}`}>
                        {ETIQUETA_CATEGORIA[c.de]} → {ETIQUETA_CATEGORIA[c.a]}: <span className="font-semibold">{c.cantidad}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </dl>
          </section>

          <TablaSegmentos id="tabla-area" titulo="Por área" filas={resumen.porArea} />
          <TablaSegmentos id="tabla-vacante" titulo="Por vacante" filas={resumen.porVacante} conArea />
          <p className="text-xs text-slate-600">
            «CVs» cuenta cada CV una vez por segmento. «Resultados» es uno por CV y vacante; las categorías suman ese
            número y usan el análisis más reciente de cada CV en cada vacante dentro del periodo filtrado, con los
            ajustes manuales. Un mismo candidato subido de nuevo después de eliminarse cuenta como otro CV. Los análisis
            anteriores a este historial usan los umbrales vigentes al instalarlo.
          </p>
        </>
      )}
    </div>
  );
}
