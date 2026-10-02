"use client";

import { boton, tarjeta } from "@/components/estilos";

export default function ErrorApp({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className={`${tarjeta} mx-auto max-w-lg space-y-4 text-center`}>
      <h1 className="text-2xl font-bold text-slate-900">Algo salió mal</h1>
      <p className="text-sm text-slate-700">No pudimos cargar esta página. Intenta de nuevo; si el problema sigue, avisa a un Admin.</p>
      <button type="button" className={boton.primario} onClick={reset}>Intentar de nuevo</button>
    </div>
  );
}
