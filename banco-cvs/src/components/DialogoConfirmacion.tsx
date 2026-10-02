"use client";

import { useId, useRef, useState, useTransition } from "react";
import { boton } from "./estilos";

type Resultado = { ok: boolean; error?: string } | void;

/** Botón que pide confirmación en un diálogo antes de ejecutar una acción. */
export function DialogoConfirmacion({
  textoBoton,
  titulo,
  mensaje,
  textoConfirmar,
  peligro = false,
  claseBoton,
  alConfirmar,
}: {
  textoBoton: string;
  titulo: string;
  mensaje: React.ReactNode;
  textoConfirmar: string;
  peligro?: boolean;
  claseBoton?: string;
  alConfirmar: () => Promise<Resultado>;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  // Id único: puede haber varios diálogos en la misma página.
  const idTitulo = useId();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function confirmar() {
    setError(null);
    iniciar(async () => {
      const resultado = await alConfirmar();
      if (resultado && !resultado.ok) {
        setError(resultado.error ?? "No se pudo completar la acción.");
        return;
      }
      dialogo.current?.close();
    });
  }

  return (
    <>
      <button
        type="button"
        className={claseBoton ?? (peligro ? boton.peligro : boton.secundario)}
        onClick={() => {
          setError(null);
          dialogo.current?.showModal();
        }}
      >
        {textoBoton}
      </button>
      <dialog
        ref={dialogo}
        aria-labelledby={idTitulo}
        className="m-auto w-full max-w-md rounded-lg p-0 shadow-xl"
      >
        <div className="space-y-4 p-6">
          <h2 id={idTitulo} className="text-lg font-bold text-slate-900">
            {titulo}
          </h2>
          <div className="text-sm text-slate-700">{mensaje}</div>
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={boton.secundario}
              onClick={() => dialogo.current?.close()}
              disabled={pendiente}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={peligro ? boton.peligro : boton.primario}
              onClick={confirmar}
              disabled={pendiente}
            >
              {pendiente ? "Procesando…" : textoConfirmar}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
