import Link from "next/link";
import { boton, celda, celdaEncabezado, tabla, tarjeta, titulo } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import { ETIQUETA_ESTADO_CV } from "@/lib/archivos/servicio";
import { consultarCvs } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Repositorio · Banco de CVs" };

export default async function PaginaRepositorio() {
  await protegerPagina("USUARIO");
  const cvs = await consultarCvs();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={titulo}>Repositorio de CVs</h1>
        <Link href="/cvs/subir" className={boton.primario}>Subir CVs</Link>
      </div>
      {cvs.length === 0 ? (
        <div className={`${tarjeta} text-center text-sm text-slate-700`}>
          Aún no hay CVs. Súbelos desde «Subir CVs».
        </div>
      ) : (
        <div className={`${tarjeta} overflow-x-auto p-0`}>
          <table className={tabla}>
            <thead>
              <tr>
                <th scope="col" className={celdaEncabezado}>Candidato / archivo</th>
                <th scope="col" className={celdaEncabezado}>Tipo</th>
                <th scope="col" className={celdaEncabezado}>Estado</th>
                <th scope="col" className={celdaEncabezado}>Subido por</th>
                <th scope="col" className={celdaEncabezado}>Fecha de carga</th>
                <th scope="col" className={celdaEncabezado}>Análisis</th>
              </tr>
            </thead>
            <tbody>
              {cvs.map((cv) => (
                <tr key={cv.id}>
                  <td className={`${celda} max-w-sm break-words`}>
                    <Link href={`/cvs/${cv.id}`} className="font-semibold text-blue-700 hover:underline">
                      {cv.nombreCandidato ?? cv.nombreArchivo}
                    </Link>
                  </td>
                  <td className={celda}>{cv.tipo}</td>
                  <td className={celda}>{ETIQUETA_ESTADO_CV[cv.estado]}</td>
                  <td className={celda}>{cv.subidoPor.nombre}</td>
                  <td className={celda}>{formatearFecha(cv.creadoEn)}</td>
                  <td className={celda}>{cv._count.analisis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
