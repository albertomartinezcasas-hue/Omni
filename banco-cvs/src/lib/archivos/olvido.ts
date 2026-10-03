import { randomUUID } from "node:crypto";
import type { ClienteDb } from "@/lib/db";

// Minimización de datos (LFPDPPP): cuando un CV se elimina (por plazo o a mano), no debe quedar nada que permita
// volver a ligar su historial con el candidato. La bitácora (solo inserción) nunca guarda datos del candidato:
// solo ids, y el nombre se consulta mientras el CV exista.

/** Prefijo del id de CV en el historial cuando el CV ya se eliminó. */
export const PREFIJO_SEUDONIMO = "seudonimo-";

/** Inicio del día en hora de CDMX: quita la hora exacta, que permitiría cruzar el registro con la bitácora. */
export function inicioDelDiaCdmx(fecha: Date) {
  const dia = fecha.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }); // AAAA-MM-DD
  return new Date(`${dia}T00:00:00.000-06:00`);
}

/**
 * Debe llamarse dentro de la transacción que elimina los CVs, ANTES de borrarlos. En el historial:
 * - el id del CV pasa a un seudónimo aleatorio (uno por CV, para seguir contando CVs distintos);
 * - el id del análisis queda en nulo y las fechas se redondean al día, para no poder cruzarlo con la bitácora;
 * - si seguía «Pendiente de revisión» y se eliminó por plazo, queda marcado como «expiró sin revisión».
 * Motivos: PLAZO (purga), MANUAL (un Admin lo eliminó) y RESPALDO (solo en la copia permanente del respaldo).
 */
export async function olvidarCvs(tx: ClienteDb, cvIds: string[], motivo: "PLAZO" | "MANUAL" | "RESPALDO") {
  for (const cvId of cvIds) {
    const seudonimo = `${PREFIJO_SEUDONIMO}${randomUUID()}`;
    const registros = await tx.registroAnalisis.findMany({
      where: { cvId },
      select: { id: true, fecha: true, fechaAjuste: true, categoriaFinal: true, vacanteId: true },
    });
    // Solo el resultado vigente (el más reciente por vacante) puede «expirar sin revisión».
    const vigentePorVacante = new Map<string, string>();
    for (const r of [...registros].sort((a, b) => a.fecha.getTime() - b.fecha.getTime())) vigentePorVacante.set(r.vacanteId, r.id);
    for (const r of registros) {
      await tx.registroAnalisis.update({
        where: { id: r.id },
        data: {
          cvId: seudonimo,
          analisisId: null,
          fecha: inicioDelDiaCdmx(r.fecha),
          fechaAjuste: r.fechaAjuste ? inicioDelDiaCdmx(r.fechaAjuste) : null,
          // Solo una eliminación por plazo cuenta como «expiró sin revisión» (no la que hace un Admin a mano).
          // RESPALDO: el CV sigue vigente en la app y solo se quita de la copia permanente; sus pendientes quedan
          // abiertos. No hay un campo para distinguirlos sin cambiar el esquema: al restaurar un respaldo permanente,
          // esos «Pendiente de revisión» aparecen sin resolver (y ya no se pueden resolver, porque el CV no está).
          expiroSinRevision: motivo === "PLAZO" && r.categoriaFinal === "REVISION" && vigentePorVacante.get(r.vacanteId) === r.id,
        },
      });
    }
  }
}
