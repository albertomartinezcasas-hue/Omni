import { tarjeta, titulo } from "@/components/estilos";
import { FormularioContrasena } from "@/components/FormularioContrasena";
import { ETIQUETA_ROL } from "@/lib/catalogos";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Mi cuenta · Banco de CVs" };

export default async function PaginaCuenta() {
  const usuario = await protegerPagina("USUARIO");
  return (
    <div className="max-w-xl space-y-6">
      <h1 className={titulo}>Mi cuenta</h1>
      <dl className={`${tarjeta} grid grid-cols-[8rem_1fr] gap-2 text-sm`}>
        <dt className="font-semibold text-slate-700">Nombre</dt>
        <dd>{usuario.nombre}</dd>
        <dt className="font-semibold text-slate-700">Correo</dt>
        <dd>{usuario.correo}</dd>
        <dt className="font-semibold text-slate-700">Rol</dt>
        <dd>{ETIQUETA_ROL[usuario.rol]}</dd>
      </dl>
      <section className={`${tarjeta} space-y-4`}>
        <h2 className="text-lg font-bold text-slate-900">Cambiar contraseña</h2>
        <FormularioContrasena textoBoton="Cambiar contraseña" />
      </section>
    </div>
  );
}
