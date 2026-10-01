"use client";

import { useState } from "react";
import { boton } from "./estilos";

/** Muestra la contraseña temporal una sola vez, con botón para copiarla. */
export function ContrasenaTemporal({ correo, contrasena, alCerrar }: { correo: string; contrasena: string; alCerrar: () => void }) {
  const [copiada, setCopiada] = useState(false);
  return (
    <div role="status" className="space-y-3 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900">
      <p>
        Contraseña temporal de <span className="font-semibold">{correo}</span>:
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded bg-white px-3 py-2 font-mono text-base text-slate-900">{contrasena}</code>
        <button
          type="button"
          className={boton.secundario}
          onClick={async () => {
            await navigator.clipboard.writeText(contrasena);
            setCopiada(true);
          }}
        >
          {copiada ? "Copiada" : "Copiar"}
        </button>
      </div>
      <p className="font-semibold">
        No volverá a mostrarse. Entrégala por un medio seguro; la persona deberá cambiarla al iniciar sesión.
      </p>
      <button type="button" className={boton.secundario} onClick={alCerrar}>
        Ya la entregué, ocultar
      </button>
    </div>
  );
}
