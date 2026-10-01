export function Aviso({
  tipo,
  children,
}: {
  tipo: "error" | "exito" | "info";
  children: React.ReactNode;
}) {
  const estilos = {
    error: "border-red-300 bg-red-50 text-red-800",
    exito: "border-green-300 bg-green-50 text-green-800",
    info: "border-blue-300 bg-blue-50 text-blue-900",
  }[tipo];
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-md border px-4 py-3 text-sm ${estilos}`}
    >
      {children}
    </div>
  );
}
