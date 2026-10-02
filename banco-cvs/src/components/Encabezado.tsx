import Link from "next/link";
import type { UsuarioActual } from "@/lib/auth";
import { ETIQUETA_ROL } from "@/lib/catalogos";
import { BotonCerrarSesion } from "./BotonCerrarSesion";

const enlace = "rounded-md px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100";

export function Encabezado({ usuario }: { usuario: UsuarioActual }) {
  const esAdmin = usuario.rol === "ADMIN";
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/vacantes" className="text-lg font-bold text-blue-800">
            Banco de CVs
          </Link>
          <nav aria-label="Principal" className="flex flex-wrap gap-1">
            <Link href="/vacantes" className={enlace}>
              Vacantes
            </Link>
            <Link href="/cvs" className={enlace}>
              Repositorio
            </Link>
            <Link href="/cvs/subir" className={enlace}>
              Subir y analizar
            </Link>
            {esAdmin && (
              <>
                <Link href="/admin/usuarios" className={enlace}>
                  Usuarios
                </Link>
                <Link href="/admin/umbrales" className={enlace}>
                  Umbrales
                </Link>
                <Link href="/admin/bitacora" className={enlace}>
                  Bitácora
                </Link>
              </>
            )}
          </nav>
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
