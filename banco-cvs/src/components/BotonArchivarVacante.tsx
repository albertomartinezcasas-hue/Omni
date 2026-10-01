"use client";

import { archivarVacanteAccion } from "@/acciones/vacantes";
import { DialogoConfirmacion } from "./DialogoConfirmacion";

export function BotonArchivarVacante({ id, titulo }: { id: string; titulo: string }) {
  return (
    <DialogoConfirmacion
      textoBoton="Archivar"
      titulo="¿Archivar la vacante?"
      mensaje={
        <p>
          «{titulo}» quedará en modo solo lectura: se conservan sus análisis, pero ya no se podrán
          subir ni analizar CVs contra ella, ni editarla.
        </p>
      }
      textoConfirmar="Archivar vacante"
      alConfirmar={() => archivarVacanteAccion(id)}
    />
  );
}
