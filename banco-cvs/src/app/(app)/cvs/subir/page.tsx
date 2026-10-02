import { Aviso } from "@/components/Aviso";
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
      <Aviso tipo="info">
        Sube solo CVs de candidatos que recibieron el aviso de privacidad de la empresa. El análisis automático envía el
        texto del CV, incluido el nombre, a servicios de IA externos; antes se retiran el correo, los teléfonos y los
        identificadores oficiales. Si el candidato se opuso al análisis con IA, súbelo sin analizar.
      </Aviso>
      <CargaCvs vacantes={vacantes} vacanteInicial={vacantes.some((v) => v.id === vacante) ? vacante! : null} />
    </div>
  );
}
