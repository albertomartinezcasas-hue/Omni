import Link from "next/link";
import { redirect } from "next/navigation";
import { boton, tarjeta } from "@/components/estilos";
import { obtenerUsuarioActual } from "@/lib/auth";

export const metadata = { title: "Sin permiso · Banco de CVs" };

export default async function PaginaSinPermiso() {
  if (!(await obtenerUsuarioActual())) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className={`${tarjeta} max-w-md space-y-4`}>
        <h1 className="text-2xl font-bold text-slate-900">No tienes permiso</h1>
        <p className="text-sm text-slate-700">
          Esta sección es solo para Admins. Si crees que necesitas acceso, pídelo a un Admin
          del equipo.
        </p>
        <Link href="/vacantes" className={boton.primario}>
          Ir a Vacantes
        </Link>
      </div>
    </main>
  );
}
