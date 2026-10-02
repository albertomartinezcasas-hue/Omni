"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { analizarCvAccion } from "@/acciones/analisis";
import { boton } from "./estilos";

/** Analiza (o re-analiza) un CV contra una vacante y abre el resultado. */
export function BotonAnalizar({
  cvId,
  vacanteId,
  texto = "Analizar",
  clase,
}: {
  cvId: string;
  vacanteId: string;
  texto?: string;
  clase?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={clase ?? boton.secundario}
        disabled={pendiente || !vacanteId}
        onClick={() => {
          setError(null);
          iniciar(async () => {
            const r = await analizarCvAccion(cvId, vacanteId);
            if (r.ok) router.push(`/analisis/${r.datos.id}`);
            else setError(r.error);
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
