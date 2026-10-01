"use client";

import { useRouter } from "next/navigation";
import { eliminarCvAccion } from "@/acciones/cvs";
import { DialogoConfirmacion } from "./DialogoConfirmacion";

export function BotonEliminarCv({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  return (
    <DialogoConfirmacion
      textoBoton="Eliminar definitivamente"
      titulo="¿Eliminar este CV?"
      mensaje={
        <p>
          Se eliminarán el archivo «{nombre}» y todos sus análisis. Esta acción no se puede deshacer.
        </p>
      }
      textoConfirmar="Eliminar"
      peligro
      alConfirmar={async () => {
        const resultado = await eliminarCvAccion(id);
        if (resultado.ok) router.push("/cvs");
        return resultado;
      }}
    />
  );
}
