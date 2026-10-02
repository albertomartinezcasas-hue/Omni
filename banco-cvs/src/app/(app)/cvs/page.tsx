import Link from "next/link";
import { BadgeCategoria } from "@/components/BadgeCategoria";
import { boton, campo, celda, celdaEncabezado, etiqueta, tabla, tarjeta, titulo, tarjetaTabla } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import { ETIQUETA_ESTADO_CV } from "@/lib/archivos/servicio";
import { CATEGORIAS, ETIQUETA_CATEGORIA } from "@/lib/catalogos";
import { consultarPersonasQueSubieron, consultarRepositorio, consultarVacantes } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Repositorio · Banco de CVs" };

type Filtros = { q?: string; vacante?: string; categoria?: string; desde?: string; hasta?: string; subio?: string };

export default async function PaginaRepositorio({ searchParams }: { searchParams: Promise<Filtros> }) {
  await protegerPagina("USUARIO");
  const f = await searchParams;
  const [activas, archivadas, personas] = await Promise.all([
    consultarVacantes("ACTIVA"),
    consultarVacantes("ARCHIVADA"),
    consultarPersonasQueSubieron(),
  ]);
  const cvs = await consultarRepositorio({
    q: f.q,
    vacanteId: f.vacante || undefined,
    categoria: f.categoria || undefined,
    desde: f.desde,
    hasta: f.hasta,
    subidoPorId: f.subio || undefined,
  });
  const hayFiltros = Object.values(f).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={titulo}>Repositorio de CVs</h1>
        <Link href="/cvs/subir" className={boton.primario}>Subir y analizar CVs</Link>
      </div>

      <form method="get" className={`${tarjeta} grid gap-4 md:grid-cols-3 xl:grid-cols-6`} role="search" aria-label="Buscar CVs">
        <div className="md:col-span-3 xl:col-span-2">
          <label htmlFor="q" className={etiqueta}>Nombre o palabra clave</label>
          <input id="q" name="q" defaultValue={f.q ?? ""} placeholder="Ej. Laura, SQL, Power BI" className={campo} />
        </div>
        <div>
          <label htmlFor="vacante" className={etiqueta}>Vacante</label>
          <select id="vacante" name="vacante" defaultValue={f.vacante ?? ""} className={campo}>
            <option value="">Todas</option>
            {activas.map((v) => <option key={v.id} value={v.id}>{v.titulo}</option>)}
            {archivadas.length > 0 && (
              <optgroup label="Archivadas">
                {archivadas.map((v) => <option key={v.id} value={v.id}>{v.titulo}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div>
          <label htmlFor="categoria" className={etiqueta}>Categoría</label>
          <select id="categoria" name="categoria" defaultValue={f.categoria ?? ""} aria-describedby="ayuda-categoria" className={campo}>
            <option value="">Todas</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>)}
          </select>
          <p id="ayuda-categoria" className="mt-1 text-xs text-slate-600">Requiere elegir una vacante.</p>
        </div>
        <div>
          <label htmlFor="desde" className={etiqueta}>Cargado desde</label>
          <input id="desde" name="desde" type="date" defaultValue={f.desde ?? ""} aria-describedby="formato-fecha" className={campo} />
        </div>
        <div>
          <label htmlFor="hasta" className={etiqueta}>Cargado hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={f.hasta ?? ""} aria-describedby="formato-fecha" className={campo} />
          <p id="formato-fecha" className="mt-1 text-xs text-slate-600">Día/mes/año.</p>
        </div>
        <div>
          <label htmlFor="subio" className={etiqueta}>Subido por</label>
          <select id="subio" name="subio" defaultValue={f.subio ?? ""} className={campo}>
            <option value="">Cualquiera</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-3 md:col-span-2 xl:col-span-5">
          <button type="submit" className={boton.primario}>Buscar</button>
          {hayFiltros && <Link href="/cvs" className={boton.secundario}>Limpiar filtros</Link>}
        </div>
      </form>

      {f.categoria && !f.vacante && (
        <p role="status" className="text-sm text-amber-900">
          El filtro de categoría se aplica solo al elegir una vacante (un mismo CV puede tener categorías distintas en cada vacante).
        </p>
      )}

      {cvs.length === 0 ? (
        <div className={`${tarjeta} text-center text-sm text-slate-700`}>
          {hayFiltros ? "Ningún CV coincide con la búsqueda. Prueba con otros filtros." : "Aún no hay CVs. Súbelos desde «Subir y analizar CVs»."}
        </div>
      ) : (
        <div className={`${tarjetaTabla}`}>
          <p className="px-6 pt-5 text-sm text-slate-700">{cvs.length} {cvs.length === 1 ? "resultado" : "resultados"}</p>
          <table className={`${tabla} mt-3`}>
            <thead>
              <tr>
                <th scope="col" className={celdaEncabezado}>Candidato / archivo</th>
                <th scope="col" className={celdaEncabezado}>{f.vacante ? "Resultado en la vacante" : "Último análisis"}</th>
                <th scope="col" className={celdaEncabezado}>Estado</th>
                <th scope="col" className={celdaEncabezado}>Subido por</th>
                <th scope="col" className={celdaEncabezado}>Fecha de carga</th>
              </tr>
            </thead>
            <tbody>
              {cvs.map((cv) => (
                <tr key={cv.id}>
                  <td className={`${celda} max-w-sm break-words`}>
                    <Link href={`/cvs/${cv.id}`} className="font-semibold text-blue-700 hover:underline">
                      {cv.nombreCandidato ?? cv.nombreArchivo}
                    </Link>
                    {cv.nombreCandidato && <span className="block text-xs text-slate-600">{cv.nombreArchivo}</span>}
                  </td>
                  <td className={celda}>
                    {cv.ultimo ? (
                      <Link href={`/analisis/${cv.ultimo.id}`} className="flex flex-wrap items-center gap-2 hover:underline">
                        <BadgeCategoria categoria={cv.ultimo.categoria.final} causa={cv.ultimo.categoria.ajustadaPor ? null : cv.ultimo.categoria.causaNoViable} siSeConfirma={cv.ultimo.categoria.ajustadaPor ? null : cv.ultimo.categoria.siSeConfirma} />
                        <span className="font-semibold">{cv.ultimo.puntaje}</span>
                        {!f.vacante && <span className="text-xs text-slate-700">{cv.ultimo.vacante}</span>}
                      </Link>
                    ) : (
                      <span className="text-slate-600">Sin analizar</span>
                    )}
                    {cv._count.analisis > 1 && !f.vacante && (
                      <span className="block text-xs text-slate-600">{cv._count.analisis} análisis en total</span>
                    )}
                  </td>
                  <td className={celda}>{ETIQUETA_ESTADO_CV[cv.estado]}</td>
                  <td className={celda}>{cv.subidoPor.nombre}</td>
                  <td className={`${celda} whitespace-nowrap`}>{formatearFecha(cv.creadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
