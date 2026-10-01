import { redirect } from "next/navigation";
import { Aviso } from "@/components/Aviso";
import { BotonCerrarSesion } from "@/components/BotonCerrarSesion";
import { boton, tarjeta } from "@/components/estilos";
import { FormularioContrasena } from "@/components/FormularioContrasena";
import { obtenerUsuarioActual } from "@/lib/auth";

export const metadata = { title: "Cambiar contraseña · Banco de CVs" };

/** Cambio obligatorio de la contraseña temporal. Sin menú: solo cambiar o cerrar sesión. */
export default async function PaginaCambiarContrasena() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/login");
  if (!usuario.debeCambiarContrasena) redirect("/cuenta");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className={`${tarjeta} w-full max-w-md space-y-4`}>
        <h1 className="text-2xl font-bold text-slate-900">Cambia tu contraseña temporal</h1>
        <Aviso tipo="info">
          Hola, {usuario.nombre}. Antes de continuar debes elegir una contraseña nueva. En
          &quot;Contraseña actual&quot; escribe la temporal que te dio el Admin.
        </Aviso>
        <FormularioContrasena textoBoton="Guardar y continuar" />
        <div className="border-t border-slate-200 pt-4">
          <BotonCerrarSesion className={boton.secundario} />
        </div>
      </div>
    </main>
  );
}
