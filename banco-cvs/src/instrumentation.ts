// Se ejecuta una vez al iniciar el servidor de Next.js.
export async function register() {
  // Solo en el servidor Node (no en Edge) y no durante `next build`.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { validarAlArrancar } = await import("./lib/configuracion");
  validarAlArrancar();
  const { iniciarPurgaPeriodica } = await import("./lib/archivos/conservacion");
  iniciarPurgaPeriodica();
}
