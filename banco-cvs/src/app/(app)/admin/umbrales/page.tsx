import { tarjeta, titulo } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import { FormularioUmbrales } from "@/components/FormularioUmbrales";
import { consultarUmbralesAdmin } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";
import { UMBRALES_POR_DEFECTO } from "@/lib/umbrales/servicio";

export const metadata = { title: "Umbrales · Banco de CVs" };

export default async function PaginaUmbrales() {
  await protegerPagina("ADMIN");
  const fila = await consultarUmbralesAdmin();
  const actuales = fila ? { excelente: fila.excelente, bueno: fila.bueno, pasable: fila.pasable } : UMBRALES_POR_DEFECTO;
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className={titulo}>Umbrales de categorías</h1>
        <p className="text-sm text-slate-700">
          Valores por defecto: Excelente 85–100, Bueno 70–84, Pasable 55–69; menos de 55 es No viable.
          {fila?.actualizadoPor && ` Última modificación: ${fila.actualizadoPor.nombre}, ${formatearFecha(fila.actualizadoEn)}.`}
        </p>
      </div>
      <section className={tarjeta}>
        <FormularioUmbrales actuales={actuales} />
      </section>
    </div>
  );
}
