"use client";

import { boton } from "./estilos";

/** Imprimir o guardar como PDF (para compartir la justificación con quien no tiene cuenta). */
export function BotonImprimir() {
  return (
    <button type="button" className={boton.secundario} onClick={() => window.print()}>
      Imprimir / guardar PDF
    </button>
  );
}
