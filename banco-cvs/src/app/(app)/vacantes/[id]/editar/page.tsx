import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { editarVacanteAccion } from "@/acciones/vacantes";
import { boton, titulo } from "@/components/estilos";
import { FormularioVacante } from "@/components/FormularioVacante";
import { consultarVacante } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Editar vacante · Banco de CVs" };

export default async function PaginaEditarVacante({ params }: { params: Promise<{ id: string }> }) {
  await protegerPagina("ADMIN");
  const { id } = await params;
  const vacante = await consultarVacante(id);
  if (!vacante) notFound();
  if (vacante.estado === "ARCHIVADA") redirect(`/vacantes/${id}`);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={titulo}>Editar vacante</h1>
        <Link href={`/vacantes/${id}`} className={boton.secundario}>Cancelar</Link>
      </div>
      <FormularioVacante
        accion={editarVacanteAccion.bind(null, id)}
        textoBoton="Guardar cambios"
        aviso="Al guardar cambios, los análisis anteriores de esta vacante se marcarán como Desactualizados."
        valores={{
          titulo: vacante.titulo,
          area: vacante.area,
          descripcion: vacante.descripcion,
          requisitosObligatorios: vacante.obligatorios.map((r) => r.texto).join("\n"),
          requisitosDeseables: vacante.deseables.map((r) => r.texto).join("\n"),
          aniosMinimos: vacante.aniosMinimos,
          cuentanPracticas: vacante.cuentanPracticas,
          nivelEstudiosMinimo: vacante.nivelEstudiosMinimo,
          idiomas: vacante.listaIdiomas,
          modalidad: vacante.modalidad,
          ubicacion: vacante.ubicacion,
        }}
      />
    </div>
  );
}
