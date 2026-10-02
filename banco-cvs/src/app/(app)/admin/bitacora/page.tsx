import Link from "next/link";
import { boton, campo, celda, celdaEncabezado, etiqueta, tabla, tarjeta, titulo } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import { ETIQUETA_ACCION, type Accion } from "@/lib/bitacora";
import { consultarActores, consultarBitacora } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Bitácora · Banco de CVs" };

const ENLACE: Record<string, (id: string) => string> = {
  CV: (id) => `/cvs/${id}`,
  ANALISIS: (id) => `/analisis/${id}`,
  VACANTE: (id) => `/vacantes/${id}`,
};
const TIPO: Record<string, string> = { USUARIO: "Usuario", CV: "CV", ANALISIS: "Análisis", VACANTE: "Vacante", UMBRALES: "Umbrales" };

type Filtros = { accion?: string; actor?: string; desde?: string; hasta?: string };

export default async function PaginaBitacora({ searchParams }: { searchParams: Promise<Filtros> }) {
  await protegerPagina("ADMIN");
  const f = await searchParams;
  const [eventos, actores] = await Promise.all([
    consultarBitacora({ accion: f.accion || undefined, actorId: f.actor || undefined, desde: f.desde, hasta: f.hasta }),
    consultarActores(),
  ]);
  const hayFiltros = Object.values(f).some(Boolean);
  return (
    <div className="space-y-6">
      <div>
        <h1 className={titulo}>Bitácora de auditoría</h1>
        <p className="text-sm text-slate-700">Últimos 200 eventos que cumplen los filtros. Solo lectura: no se puede editar ni borrar.</p>
      </div>

      <form method="get" className={`${tarjeta} grid gap-4 md:grid-cols-5`} aria-label="Filtrar bitácora">
        <div>
          <label htmlFor="accion" className={etiqueta}>Acción</label>
          <select id="accion" name="accion" defaultValue={f.accion ?? ""} className={campo}>
            <option value="">Todas</option>
            {(Object.keys(ETIQUETA_ACCION) as Accion[]).map((a) => <option key={a} value={a}>{ETIQUETA_ACCION[a]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="actor" className={etiqueta}>Usuario</label>
          <select id="actor" name="actor" defaultValue={f.actor ?? ""} className={campo}>
            <option value="">Todos</option>
            {actores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="desde" className={etiqueta}>Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={f.desde ?? ""} className={campo} />
        </div>
        <div>
          <label htmlFor="hasta" className={etiqueta}>Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={f.hasta ?? ""} className={campo} />
        </div>
        <div className="flex items-end gap-3">
          <button type="submit" className={boton.primario}>Filtrar</button>
          {hayFiltros && <Link href="/admin/bitacora" className={boton.secundario}>Limpiar</Link>}
        </div>
      </form>

      {eventos.length === 0 ? (
        <div className={`${tarjeta} text-center text-sm text-slate-700`}>{hayFiltros ? "Ningún evento cumple los filtros." : "Aún no hay eventos."}</div>
      ) : (
        <div className={`${tarjeta} overflow-x-auto p-0`}>
          <table className={tabla}>
            <thead>
              <tr>
                <th scope="col" className={celdaEncabezado}>Fecha</th>
                <th scope="col" className={celdaEncabezado}>Quién</th>
                <th scope="col" className={celdaEncabezado}>Qué</th>
                <th scope="col" className={celdaEncabezado}>Sobre qué</th>
                <th scope="col" className={celdaEncabezado}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                const enlace = e.entidadTipo && e.entidadId && e.accion !== "CV_ELIMINADO" ? ENLACE[e.entidadTipo]?.(e.entidadId) : undefined;
                return (
                  <tr key={e.id}>
                    <td className={`${celda} whitespace-nowrap`}>{formatearFecha(e.fecha)}</td>
                    <td className={celda}>
                      {e.actorNombre}
                      <span className="block text-xs text-slate-600">{e.actorCorreo}</span>
                    </td>
                    <td className={celda}>{ETIQUETA_ACCION[e.accion as Accion] ?? e.accion}</td>
                    <td className={celda}>
                      {e.entidadTipo ? (
                        enlace ? (
                          <Link href={enlace} className="text-blue-700 hover:underline">{TIPO[e.entidadTipo] ?? e.entidadTipo}</Link>
                        ) : (
                          TIPO[e.entidadTipo] ?? e.entidadTipo
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${celda} max-w-md break-words font-mono text-xs`}>{e.detalle ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
