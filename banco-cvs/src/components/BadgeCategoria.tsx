import { ETIQUETA_CATEGORIA, type Categoria } from "@/lib/catalogos";

// Colores semánticos siempre acompañados de texto. Contraste AA (texto 900 sobre fondo 100).
const ESTILO: Record<Categoria, string> = {
  EXCELENTE: "bg-green-100 text-green-900 ring-green-700",
  BUENO: "bg-blue-100 text-blue-900 ring-blue-700",
  PASABLE: "bg-amber-100 text-amber-900 ring-amber-700",
  REVISION: "bg-violet-100 text-violet-900 ring-violet-700",
  NO_VIABLE: "bg-slate-200 text-slate-800 ring-slate-500",
};

export function BadgeCategoria({
  categoria,
  causa,
  grande = false,
}: {
  categoria: Categoria;
  causa?: "REQUISITO" | "PUNTAJE" | null;
  grande?: boolean;
}) {
  const sufijo = categoria === "NO_VIABLE" && causa ? (causa === "REQUISITO" ? " (requisito)" : " (puntaje)") : "";
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset ${ESTILO[categoria]} ${
        grande ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"
      }`}
    >
      {ETIQUETA_CATEGORIA[categoria]}
      {sufijo}
    </span>
  );
}

export function BadgeDesactualizado() {
  return (
    <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-900 ring-1 ring-inset ring-orange-700">
      Desactualizado
    </span>
  );
}

export function BadgeManipulacion() {
  return (
    <span className="inline-flex w-fit items-center rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">
      ⚠ Posible manipulación del CV
    </span>
  );
}
