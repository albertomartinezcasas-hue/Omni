"use client";

import { useRef, useState, useTransition } from "react";
import { actualizarUmbralesAccion } from "@/acciones/umbrales";
import type { Umbrales } from "@/lib/umbrales/servicio";
import { Aviso } from "./Aviso";
import { BadgeCategoria } from "./BadgeCategoria";
import { ayuda, boton, campo, etiqueta } from "./estilos";

/** Edición de umbrales (solo Admin) con confirmación: recalcula las categorías que se muestran. */
export function FormularioUmbrales({ actuales }: { actuales: Umbrales }) {
  const formulario = useRef<HTMLFormElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar() {
    const datos = new FormData(formulario.current!);
    iniciar(async () => {
      const r = await actualizarUmbralesAccion(undefined, datos);
      dialogo.current?.close();
      setMensaje(r.ok ? { tipo: "exito", texto: "Umbrales guardados. Las categorías ya se muestran con los nuevos valores." } : { tipo: "error", texto: r.error });
    });
  }

  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        setMensaje(null);
        dialogo.current?.showModal();
      }}
      className="space-y-4"
    >
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}
      <div className="grid gap-4 md:grid-cols-3">
        {(
          [
            ["excelente", "EXCELENTE", actuales.excelente],
            ["bueno", "BUENO", actuales.bueno],
            ["pasable", "PASABLE", actuales.pasable],
          ] as const
        ).map(([nombre, categoria, valor]) => (
          <div key={nombre}>
            <label htmlFor={nombre} className={`${etiqueta} flex items-center gap-2`}>
              <BadgeCategoria categoria={categoria} /> desde
            </label>
            <input id={nombre} name={nombre} type="number" min={1} max={100} step={1} required defaultValue={valor} className={campo} />
          </div>
        ))}
      </div>
      <p className={ayuda}>
        Enteros con Excelente &gt; Bueno &gt; Pasable ≥ 1. Debajo del umbral de Pasable la categoría es No viable.
      </p>
      <button type="submit" className={boton.primario} disabled={pendiente}>Guardar umbrales</button>

      <dialog ref={dialogo} aria-labelledby="titulo-umbrales" className="m-auto w-full max-w-md rounded-lg p-0 shadow-xl">
        <div className="space-y-4 p-6">
          <h2 id="titulo-umbrales" className="text-lg font-bold text-slate-900">¿Guardar los nuevos umbrales?</h2>
          <p className="text-sm text-slate-700">
            Las categorías de todos los análisis se recalcularán con los nuevos umbrales (los puntajes no cambian y los
            ajustes manuales se conservan). El cambio queda en la bitácora.
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" className={boton.secundario} onClick={() => dialogo.current?.close()} disabled={pendiente}>
              Cancelar
            </button>
            <button type="button" className={boton.primario} onClick={guardar} disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
