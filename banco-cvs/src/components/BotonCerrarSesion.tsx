import { cerrarSesionAccion } from "@/lib/auth/acciones";

export function BotonCerrarSesion({ className }: { className?: string }) {
  return (
    <form action={cerrarSesionAccion}>
      <button type="submit" className={className}>
        Cerrar sesión
      </button>
    </form>
  );
}
