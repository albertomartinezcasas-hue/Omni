"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const enlace = "rounded-md px-2.5 py-2 text-sm font-semibold hover:bg-slate-100";

export function NavPrincipal({ esAdmin }: { esAdmin: boolean }) {
  const ruta = usePathname();
  const items = [
    { href: "/vacantes", texto: "Vacantes", activo: ruta.startsWith("/vacantes") || ruta.startsWith("/analisis") },
    { href: "/cvs", texto: "Repositorio", activo: ruta === "/cvs" || (ruta.startsWith("/cvs/") && !ruta.startsWith("/cvs/subir")) },
    { href: "/cvs/subir", texto: "Subir y analizar", activo: ruta.startsWith("/cvs/subir") },
    ...(esAdmin
      ? [
          { href: "/admin/usuarios", texto: "Usuarios", activo: ruta.startsWith("/admin/usuarios") },
          { href: "/admin/umbrales", texto: "Umbrales", activo: ruta.startsWith("/admin/umbrales") },
          { href: "/admin/historial", texto: "Historial", activo: ruta.startsWith("/admin/historial") },
          { href: "/admin/bitacora", texto: "Bitácora", activo: ruta.startsWith("/admin/bitacora") },
        ]
      : []),
  ];
  return (
    <nav aria-label="Principal" className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.activo ? "page" : undefined}
          className={`${enlace} ${i.activo ? "bg-blue-50 text-blue-800 underline decoration-2 underline-offset-8" : "text-slate-700"}`}
        >
          {i.texto}
        </Link>
      ))}
    </nav>
  );
}
