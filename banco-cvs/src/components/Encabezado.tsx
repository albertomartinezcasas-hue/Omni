import Link from "next/link";
import type { UsuarioActual } from "@/lib/auth";
import { ETIQUETA_ROL } from "@/lib/catalogos";
import { BotonCerrarSesion } from "./BotonCerrarSesion";
import { NavPrincipal } from "./NavPrincipal";

const enlace = "rounded-md px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100";

export function Encabezado({ usuario }: { usuario: UsuarioActual }) {
  const esAdmin = usuario.rol === "ADMIN";
  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/vacantes" className="text-lg font-bold text-blue-800">
            Banco de CVs
          </Link>
          <NavPrincipal esAdmin={esAdmin} />
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="mr-1 text-slate-700">
            {usuario.nombre} · <span className="font-semibold">{ETIQUETA_ROL[usuario.rol]}</span>
          </span>
          <Link href="/cuenta" className={enlace}>
            Mi cuenta
          </Link>
          <BotonCerrarSesion className={enlace} />
        </div>
      </div>
    </header>
  );
}
