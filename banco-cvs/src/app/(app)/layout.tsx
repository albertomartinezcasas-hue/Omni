import { Encabezado } from "@/components/Encabezado";
import { protegerPagina } from "@/lib/paginas";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await protegerPagina("USUARIO");
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-blue-800 focus:shadow"
      >
        Saltar al contenido
      </a>
      <Encabezado usuario={usuario} />
      <main id="contenido" className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </>
  );
}
