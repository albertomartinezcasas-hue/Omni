import { titulo } from "@/components/estilos";
import { formatearFecha } from "@/components/Fecha";
import { GestionUsuarios } from "@/components/GestionUsuarios";
import type { Rol } from "@/lib/catalogos";
import { consultarUsuarios } from "@/lib/consultas";
import { protegerPagina } from "@/lib/paginas";

export const metadata = { title: "Usuarios · Banco de CVs" };

export default async function PaginaUsuarios() {
  const actual = await protegerPagina("ADMIN");
  const usuarios = await consultarUsuarios();
  const ahora = new Date();
  return (
    <div className="space-y-6">
      <h1 className={titulo}>Usuarios</h1>
      <GestionUsuarios
        actualId={actual.id}
        usuarios={usuarios.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          correo: u.correo,
          rol: u.rol as Rol,
          activo: u.activo,
          debeCambiarContrasena: u.debeCambiarContrasena,
          bloqueado: !!u.bloqueadoHasta && u.bloqueadoHasta > ahora,
          alta: `${formatearFecha(u.creadoEn)} · ${u.creadoPor?.nombre ?? "crear-admin"}`,
        }))}
      />
    </div>
  );
}
