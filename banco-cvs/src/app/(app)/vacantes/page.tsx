import Link from "next/link";
import { Aviso } from "@/components/Aviso";
import { boton, celda, celdaEncabezado, tabla, tarjeta, titulo } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import { ETIQUETA_MODALIDAD, type Modalidad } from "@/lib/catalogos";
import { consultarVacantes } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Vacantes · Banco de CVs" };

export default async function PaginaVacantes({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; contrasena?: string }>;
}) {
  const usuario = await protegerPagina("USUARIO");
  const { estado, contrasena } = await searchParams;
  const archivadas = estado === "archivadas";
  const vacantes = await consultarVacantes(archivadas ? "ARCHIVADA" : "ACTIVA");
  const pestana = (activa: boolean) =>
    `rounded-t-md border-b-2 px-4 py-2 text-sm font-semibold ${
      activa ? "border-blue-700 text-blue-800" : "border-transparent text-slate-600 hover:text-slate-900"
    }`;

  return (
    <div className="space-y-6">
      {contrasena === "actualizada" && <Aviso tipo="exito">Tu contraseña se actualizó correctamente.</Aviso>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={titulo}>Vacantes</h1>
        {usuario.rol === "ADMIN" && (
          <Link href="/vacantes/nueva" className={boton.primario}>Nueva vacante</Link>
        )}
      </div>
      <nav aria-label="Estado de vacantes" className="flex gap-2 border-b border-slate-200">
        <Link href="/vacantes" className={pestana(!archivadas)} aria-current={!archivadas ? "page" : undefined}>
          Activas
        </Link>
        <Link href="/vacantes?estado=archivadas" className={pestana(archivadas)} aria-current={archivadas ? "page" : undefined}>
          Archivadas
        </Link>
      </nav>

      {vacantes.length === 0 ? (
        <div className={`${tarjeta} text-center text-sm text-slate-700`}>
          {archivadas
            ? "No hay vacantes archivadas."
            : usuario.rol === "ADMIN"
              ? "Aún no hay vacantes activas. Crea la primera con «Nueva vacante»."
              : "Aún no hay vacantes activas. Un Admin debe crearlas."}
        </div>
      ) : (
        <div className={`${tarjeta} overflow-x-auto p-0`}>
          <table className={tabla}>
            <thead>
              <tr>
                <th scope="col" className={celdaEncabezado}>Vacante</th>
                <th scope="col" className={celdaEncabezado}>Área</th>
                <th scope="col" className={celdaEncabezado}>Modalidad</th>
                <th scope="col" className={celdaEncabezado}>Ubicación</th>
                <th scope="col" className={celdaEncabezado}>Análisis</th>
                <th scope="col" className={celdaEncabezado}>Actualizada</th>
              </tr>
            </thead>
            <tbody>
              {vacantes.map((v) => (
                <tr key={v.id}>
                  <td className={celda}>
                    <Link href={`/vacantes/${v.id}`} className="font-semibold text-blue-700 hover:underline">
                      {v.titulo}
                    </Link>
                  </td>
                  <td className={celda}>{v.area}</td>
                  <td className={celda}>{ETIQUETA_MODALIDAD[v.modalidad as Modalidad]}</td>
                  <td className={celda}>{v.ubicacion}</td>
                  <td className={celda}>{v._count.analisis}</td>
                  <td className={celda}>{formatearFecha(v.actualizadoEn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
