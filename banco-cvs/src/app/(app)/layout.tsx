import { Encabezado } from "@/components/Encabezado";
import { protegerPagina } from "@/lib/paginas";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await protegerPagina("USUARIO");
  return (
    <>
      <Encabezado usuario={usuario} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </>
  );
}
