"use client";

import { startTransition, useActionState, useRef } from "react";
import { ajustarCategoriaAccion } from "@/acciones/analisis";
import { CATEGORIAS, ETIQUETA_CATEGORIA, type Categoria } from "@/lib/catalogos";
import { Aviso } from "./Aviso";
import { ayuda, boton, campo, etiqueta } from "./estilos";

/** Cambio manual de categoría con comentario obligatorio. Prevalece sobre la calculada. */
export function FormularioAjuste({ analisisId, actual }: { analisisId: string; actual: Categoria }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, enviar, pendiente] = useActionState(async (previo: unknown, datos: FormData) => {
    const r = await ajustarCategoriaAccion(analisisId, previo, datos);
    if (r.ok) formulario.current?.reset();
    return r;
  }, undefined);
  return (
    <form
      ref={formulario}
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => enviar(datos));
      }}
      className="space-y-3"
    >
      {estado && !estado.ok && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado?.ok && <Aviso tipo="exito">Categoría ajustada.</Aviso>}
      <div>
        <label htmlFor="categoria" className={etiqueta}>Nueva categoría</label>
        <select id="categoria" name="categoria" defaultValue={actual} className={campo}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>{ETIQUETA_CATEGORIA[c]}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="comentario" className={etiqueta}>Motivo del ajuste</label>
        <textarea
          id="comentario"
          name="comentario"
          rows={3}
          required
          minLength={10}
          aria-describedby="ayuda-comentario"
          className={campo}
        />
        <p id="ayuda-comentario" className={ayuda}>
          Obligatorio, mínimo 10 caracteres. Queda visible junto con la categoría calculada y en la bitácora.
        </p>
      </div>
      <button type="submit" className={boton.primario} disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar ajuste"}
      </button>
    </form>
  );
}
