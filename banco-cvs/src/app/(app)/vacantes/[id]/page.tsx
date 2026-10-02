import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { BotonArchivarVacante } from "@/components/BotonArchivarVacante";
import { boton, tarjeta, titulo } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import {
  ETIQUETA_ESTUDIO,
  ETIQUETA_IDIOMA,
  ETIQUETA_MODALIDAD,
  type Modalidad,
  type NivelEstudio,
} from "@/lib/catalogos";
import { consultarCandidatos, consultarVacante } from "@/lib/consultas";
import { TablaCandidatos } from "@/components/TablaCandidatos";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Vacante · Banco de CVs" };

export default async function PaginaVacante({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await protegerPagina("USUARIO");
  const { id } = await params;
  const vacante = await consultarVacante(id);
  if (!vacante) notFound();
  const archivada = vacante.estado === "ARCHIVADA";
  const { grupos, total, pendientesLigeros } = await consultarCandidatos(vacante.id, vacante.version);
  const esAdmin = usuario.rol === "ADMIN";

  return (
    <div className="space-y-6">
      {archivada && (
        <Aviso tipo="info">
          Vacante archivada · solo lectura
          {vacante.archivadaEn ? ` (desde ${formatearFecha(vacante.archivadaEn)})` : ""}.
        </Aviso>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={titulo}>{vacante.titulo}</h1>
          <p className="text-sm text-slate-700">
            {vacante.area} · {ETIQUETA_MODALIDAD[vacante.modalidad as Modalidad]} · {vacante.ubicacion}
          </p>
        </div>
        {!archivada && (
          <div className="flex flex-wrap gap-3">
            <Link href={`/cvs/subir?vacante=${vacante.id}`} className={boton.primario}>
              Subir y analizar CVs
            </Link>
            {esAdmin && (
              <>
                <Link href={`/vacantes/${vacante.id}/editar`} className={boton.secundario}>Editar</Link>
                <BotonArchivarVacante id={vacante.id} titulo={vacante.titulo} />
              </>
            )}
          </div>
        )}
      </div>

      <section className="space-y-4" aria-labelledby="candidatos">
        <h2 id="candidatos" className="text-lg font-bold text-slate-900">
          Candidatos {total > 0 && <span className="font-normal text-slate-700">({total}, ordenados por puntaje)</span>}
        </h2>
        {pendientesLigeros > 0 && (
          <Aviso tipo="info">
            {pendientesLigeros === 1
              ? "1 análisis quedó «Pendiente de revisión» porque"
              : `${pendientesLigeros} análisis quedaron «Pendiente de revisión» porque`}{" "}
            se hicieron con un modelo ligero (los modelos completos estaban saturados). Re-analízalos más tarde o
            confirma la evidencia en el CV.
          </Aviso>
        )}
        {total === 0 ? (
          <div className={`${tarjeta} space-y-3 text-center text-sm text-slate-700`}>
            <p>Aún no hay CVs analizados para esta vacante.</p>
            {!archivada && (
              <Link href={`/cvs/subir?vacante=${vacante.id}`} className={boton.primario}>
                Subir y analizar CVs
              </Link>
            )}
          </div>
        ) : (
          <TablaCandidatos grupos={grupos} vacanteId={vacante.id} soloLectura={archivada} />
        )}
      </section>

      <section className={`${tarjeta} space-y-4`} aria-labelledby="perfil">
        <h2 id="perfil" className="text-lg font-bold text-slate-900">Perfil de la vacante</h2>
        <p className="whitespace-pre-line text-sm text-slate-800">{vacante.descripcion}</p>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Requisitos obligatorios</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {vacante.obligatorios.map((r) => <li key={r.id}>{r.texto}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Requisitos deseables</h3>
            {vacante.deseables.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {vacante.deseables.map((r) => <li key={r.id}>{r.texto}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Sin requisitos deseables.</p>
            )}
          </div>
        </div>
        <dl className="grid gap-2 text-sm md:grid-cols-[14rem_1fr]">
          <dt className="font-semibold text-slate-700">Experiencia relevante mínima</dt>
          <dd>{vacante.aniosMinimos} {vacante.aniosMinimos === 1 ? "año" : "años"}</dd>
          <dt className="font-semibold text-slate-700">Prácticas y servicio social</dt>
          <dd>{vacante.cuentanPracticas ? "Cuentan como experiencia" : "No cuentan como experiencia"}</dd>
          <dt className="font-semibold text-slate-700">Estudios mínimos</dt>
          <dd>{ETIQUETA_ESTUDIO[vacante.nivelEstudiosMinimo as NivelEstudio]}</dd>
          <dt className="font-semibold text-slate-700">Idiomas</dt>
          <dd>
            {vacante.listaIdiomas.length
              ? vacante.listaIdiomas.map((i) => `${i.idioma} (${ETIQUETA_IDIOMA[i.nivel]})`).join(", ")
              : "Sin idiomas requeridos"}
          </dd>
          <dt className="font-semibold text-slate-700">Creada por</dt>
          <dd>{vacante.creadoPor.nombre} · {formatearFecha(vacante.creadoEn)}</dd>
          <dt className="font-semibold text-slate-700">Última edición</dt>
          <dd>{vacante.actualizadoPor.nombre} · {formatearFecha(vacante.actualizadoEn)} (versión {vacante.version})</dd>
        </dl>
      </section>
    </div>
  );
}
