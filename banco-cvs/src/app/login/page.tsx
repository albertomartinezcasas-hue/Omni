import { redirect } from "next/navigation";
import { tarjeta } from "@/components/estilos";
import { obtenerUsuarioActual } from "@/lib/auth";
import { FormularioLogin } from "./FormularioLogin";

export const metadata = { title: "Iniciar sesión · Banco de CVs" };

export default async function PaginaLogin() {
  if (await obtenerUsuarioActual()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className={`${tarjeta} w-full max-w-sm`}>
        <h1 className="mb-1 text-2xl font-bold text-slate-900">Banco de CVs</h1>
        <p className="mb-6 text-sm text-slate-600">Inicia sesión con tu cuenta del equipo.</p>
        <FormularioLogin />
        <p className="mt-6 text-xs text-slate-600">
          ¿Olvidaste tu contraseña? Pide a un Admin del equipo que la restablezca.
        </p>
      </div>
    </main>
  );
}
