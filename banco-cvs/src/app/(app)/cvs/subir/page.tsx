import { CargaCvs } from "@/components/CargaCvs";
import { titulo } from "@/components/estilos";
import { consultarVacantes } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Subir y analizar CVs · Banco de CVs" };

export default async function PaginaSubir({ searchParams }: { searchParams: Promise<{ vacante?: string }> }) {
  await protegerPagina("USUARIO");
  const { vacante } = await searchParams;
  // Solo vacantes activas: las archivadas son de solo lectura.
  const vacantes = (await consultarVacantes("ACTIVA")).map((v) => ({ id: v.id, titulo: v.titulo }));
  return (
    <div className="space-y-6">
      <h1 className={titulo}>Subir y analizar CVs</h1>
      <CargaCvs vacantes={vacantes} vacanteInicial={vacantes.some((v) => v.id === vacante) ? vacante! : null} />
    </div>
  );
}
