// Se ejecuta una vez al iniciar el servidor de Next.js.
export async function register() {
  // Solo en el servidor Node (no en Edge) y no durante `next build`.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { diasDeConservacion, iniciarPurgaPeriodica } = await import("./lib/archivos/conservacion");
  // Un plazo inválido impide arrancar: los CVs no deben conservarse más allá del aviso de privacidad.
  if (diasDeConservacion() === null) {
    throw new Error("CONSERVACION_DIAS debe ser un entero mayor o igual a 1.");
  }
  iniciarPurgaPeriodica();
}
