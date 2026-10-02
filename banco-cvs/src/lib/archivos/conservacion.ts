import { registrarEvento } from "@/lib/bitacora";
import { db } from "@/lib/db";
import { eliminarArchivo } from "./almacenamiento";

// Plazo de conservación de CVs (aviso de privacidad): se eliminan, con sus análisis y ajustes, al cumplirse
// CONSERVACION_DIAS desde su última actividad (subida o análisis más reciente). Por defecto, 1 día.

export const CONSERVACION_DIAS_POR_DEFECTO = 1;
const CADA_MS = 60 * 60 * 1000; // revisión cada hora

export function diasDeConservacion(env: Record<string, string | undefined> = process.env) {
  const dias = Number(env.CONSERVACION_DIAS);
  return Number.isFinite(dias) && dias > 0 ? dias : CONSERVACION_DIAS_POR_DEFECTO;
}

/**
 * Elimina los CVs vencidos y sus archivos. Devuelve cuántos eliminó.
 * La bitácora registra solo la cantidad: no conserva nombres de candidatos ni de archivos.
 */
export async function purgarCvsVencidos(ahora: Date = new Date(), dias: number = diasDeConservacion()) {
  const limite = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
  const vencidos = await db.cv.findMany({
    where: { creadoEn: { lt: limite }, analisis: { none: { creadoEn: { gte: limite } } } },
    select: { id: true, archivoId: true },
  });
  if (vencidos.length === 0) return 0;

  await db.$transaction(async (tx) => {
    // Los análisis y ajustes se eliminan en cascada.
    await tx.cv.deleteMany({ where: { id: { in: vencidos.map((c) => c.id) } } });
    await registrarEvento(
      {
        actor: null,
        sistema: true,
        accion: "CV_ELIMINADO_POR_PLAZO",
        entidadTipo: "CV",
        detalle: { cantidad: vencidos.length, plazoDias: dias },
      },
      tx,
    );
  });
  for (const cv of vencidos) await eliminarArchivo(cv.archivoId);
  console.info(`[conservacion] Se eliminaron ${vencidos.length} CV(s) vencidos (plazo: ${dias} día(s)).`);
  return vencidos.length;
}

let iniciada = false;

/** Purga al arrancar el servidor y después cada hora. Un fallo se registra y se reintenta en la siguiente vuelta. */
export function iniciarPurgaPeriodica() {
  if (iniciada) return;
  iniciada = true;
  const ejecutar = () =>
    purgarCvsVencidos().catch((error) => {
      console.error(`[conservacion] No se pudo purgar: ${error instanceof Error ? error.name : "error"}`);
    });
  void ejecutar();
  setInterval(ejecutar, CADA_MS).unref();
}
