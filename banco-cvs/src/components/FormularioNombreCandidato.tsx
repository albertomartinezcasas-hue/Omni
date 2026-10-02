"use client";

import { startTransition, useActionState } from "react";
import { corregirNombreAccion } from "@/acciones/cvs";
import { Aviso } from "./Aviso";
import { boton, campo, etiqueta } from "./estilos";

export function FormularioNombreCandidato({ cvId, nombre }: { cvId: string; nombre: string | null }) {
  const [estado, enviar, pendiente] = useActionState(corregirNombreAccion.bind(null, cvId), undefined);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => enviar(datos));
      }}
      className="space-y-2"
    >
      <label htmlFor="nombreCandidato" className={etiqueta}>
        Nombre del candidato
      </label>
      <div className="flex flex-wrap gap-3">
        <input
          id="nombreCandidato"
          name="nombreCandidato"
          defaultValue={nombre ?? ""}
          placeholder="Se completa al analizar; puedes corregirlo"
          className={`${campo} mt-0 max-w-md`}
        />
        <button type="submit" className={boton.secundario} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar nombre"}
        </button>
      </div>
      {estado && !estado.ok && <Aviso tipo="error">{estado.error}</Aviso>}
      {estado?.ok && <Aviso tipo="exito">Nombre actualizado.</Aviso>}
    </form>
  );
}
