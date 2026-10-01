const formato = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

export function formatearFecha(fecha: Date | string) {
  return formato.format(typeof fecha === "string" ? new Date(fecha) : fecha);
}
