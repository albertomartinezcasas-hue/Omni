"use client";

import { useState } from "react";
import { BotonAnalizar } from "./BotonAnalizar";
import { boton, campo, etiqueta } from "./estilos";

export function AnalizarContraVacante({ cvId, vacantes }: { cvId: string; vacantes: { id: string; titulo: string }[] }) {
  const [vacanteId, setVacanteId] = useState("");
  if (vacantes.length === 0) {
    return <p className="text-sm text-slate-700">No hay vacantes activas para analizar este CV.</p>;
  }
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-64">
        <label htmlFor="vacante-analizar" className={etiqueta}>
          Analizar contra otra vacante
        </label>
        <select id="vacante-analizar" value={vacanteId} onChange={(e) => setVacanteId(e.target.value)} className={campo}>
          <option value="">Selecciona una vacante activa…</option>
          {vacantes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.titulo}
            </option>
          ))}
        </select>
      </div>
      <BotonAnalizar cvId={cvId} vacanteId={vacanteId} texto="Analizar" clase={boton.primario} />
    </div>
  );
}
