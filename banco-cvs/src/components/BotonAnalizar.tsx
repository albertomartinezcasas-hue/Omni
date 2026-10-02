"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { analizarCvAccion } from "@/acciones/analisis";
import { DialogoConfirmacion } from "./DialogoConfirmacion";
import { boton } from "./estilos";

/**
 * Analiza (o re-analiza) un CV contra una vacante y abre el resultado.
 * Con `aviso`, pide confirmación antes (p. ej. cuando hay un ajuste manual que no se copia).
 */
export function BotonAnalizar({
  cvId,
  vacanteId,
  texto = "Analizar",
  clase,
  aviso,
}: {
  cvId: string;
  vacanteId: string;
  texto?: string;
  clase?: string;
  aviso?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  async function analizar() {
    const r = await analizarCvAccion(cvId, vacanteId);
    if (r.ok) router.push(`/analisis/${r.datos.id}`);
    return r;
  }

  if (aviso) {
    return (
      <DialogoConfirmacion
        textoBoton={texto}
        titulo={`¿${texto}?`}
        mensaje={<p>{aviso} El análisis puede tardar hasta 60 segundos.</p>}
        textoConfirmar={texto}
        claseBoton={clase}
        alConfirmar={analizar}
      />
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={clase ?? boton.secundario}
        disabled={pendiente || !vacanteId}
        onClick={() => {
          setError(null);
          iniciar(async () => {
            const r = await analizar();
            if (!r.ok) setError(r.error);
          });
        }}
      >
        {pendiente ? "Analizando… (hasta 60 s)" : error ? "Reintentar" : texto}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
