import { celda, celdaEncabezado, tabla, tarjeta, titulo } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import { ETIQUETA_ACCION, type Accion } from "@/lib/bitacora";
import { consultarBitacora } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Bitácora · Banco de CVs" };

export default async function PaginaBitacora() {
  await protegerPagina("ADMIN");
  const eventos = await consultarBitacora();
  return (
    <div className="space-y-6">
      <div>
        <h1 className={titulo}>Bitácora de auditoría</h1>
        <p className="text-sm text-slate-700">Últimos 200 eventos. Solo lectura: no se puede editar ni borrar.</p>
      </div>
      {eventos.length === 0 ? (
        <div className={`${tarjeta} text-center text-sm text-slate-700`}>Aún no hay eventos.</div>
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
              {eventos.map((e) => (
                <tr key={e.id}>
                  <td className={`${celda} whitespace-nowrap`}>{formatearFecha(e.fecha)}</td>
                  <td className={celda}>
                    {e.actorNombre}
                    <span className="block text-xs text-slate-600">{e.actorCorreo}</span>
                  </td>
                  <td className={celda}>{ETIQUETA_ACCION[e.accion as Accion] ?? e.accion}</td>
                  <td className={celda}>
                    {e.entidadTipo ? `${e.entidadTipo.toLowerCase()} ${e.entidadId ?? ""}` : "—"}
                  </td>
                  <td className={`${celda} max-w-md break-words font-mono text-xs`}>{e.detalle ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
