import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { BotonEliminarCv } from "@/components/BotonEliminarCv";
import { boton, tarjeta, titulo } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import { FormularioNombreCandidato } from "@/components/FormularioNombreCandidato";
import { ESTADO_SIN_TEXTO, ETIQUETA_ESTADO_CV } from "@/lib/archivos/servicio";
import { consultarCv } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "CV · Banco de CVs" };

export default async function PaginaCv({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await protegerPagina("USUARIO");
  const { id } = await params;
  const cv = await consultarCv(id);
  if (!cv) notFound();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className={`${titulo} break-words`}>{cv.nombreCandidato ?? cv.nombreArchivo}</h1>
        <div className="flex flex-wrap gap-3">
          {/* Enlace normal: la descarga pasa por la ruta autenticada. */}
          <a href={`/api/cvs/${cv.id}/descargar`} className={boton.secundario}>Descargar</a>
          {usuario.rol === "ADMIN" && <BotonEliminarCv id={cv.id} nombre={cv.nombreArchivo} />}
        </div>
      </div>
      {cv.estado === ESTADO_SIN_TEXTO && (
        <Aviso tipo="info">
          Sin texto legible (posible PDF escaneado): este CV no se puede analizar. Pide al candidato
          una versión en PDF con texto o en DOCX.
        </Aviso>
      )}
      <div className={tarjeta}>
        <FormularioNombreCandidato cvId={cv.id} nombre={cv.nombreCandidato} />
      </div>
      <dl className={`${tarjeta} grid gap-2 text-sm md:grid-cols-[12rem_1fr]`}>
        <dt className="font-semibold text-slate-700">Archivo original</dt>
        <dd className="break-words">{cv.nombreArchivo}</dd>
        <dt className="font-semibold text-slate-700">Tipo</dt>
        <dd>{cv.tipo} · {(cv.tamanoBytes / 1024).toFixed(0)} KB</dd>
        <dt className="font-semibold text-slate-700">Estado</dt>
        <dd>{ETIQUETA_ESTADO_CV[cv.estado]}</dd>
        <dt className="font-semibold text-slate-700">Subido por</dt>
        <dd>{cv.subidoPor.nombre} · {formatearFecha(cv.creadoEn)}</dd>
      </dl>
    </div>
  );
}
