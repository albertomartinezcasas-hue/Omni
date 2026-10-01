import Link from "next/link";
import { crearVacanteAccion } from "@/acciones/vacantes";
import { boton, titulo } from "@/components/estilos";
import { FormularioVacante } from "@/components/FormularioVacante";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Nueva vacante · Banco de CVs" };

export default async function PaginaNuevaVacante() {
  await protegerPagina("ADMIN");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={titulo}>Nueva vacante</h1>
        <Link href="/vacantes" className={boton.secundario}>Cancelar</Link>
      </div>
      <FormularioVacante accion={crearVacanteAccion} textoBoton="Crear vacante" />
    </div>
  );
}
