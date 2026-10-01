import { CargaCvs } from "@/components/CargaCvs";
import { titulo } from "@/components/estilos";
import { consultarVacante } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Subir CVs · Banco de CVs" };

export default async function PaginaSubir({ searchParams }: { searchParams: Promise<{ vacante?: string }> }) {
  await protegerPagina("USUARIO");
  const { vacante: vacanteId } = await searchParams;
  const vacante = vacanteId ? await consultarVacante(vacanteId) : null;
  return (
    <div className="space-y-6">
      <h1 className={titulo}>Subir CVs</h1>
      <CargaCvs
        vacante={vacante && vacante.estado === "ACTIVA" ? { id: vacante.id, titulo: vacante.titulo } : null}
      />
    </div>
  );
}
