import { randomUUID } from "node:crypto";
import type { ClienteDb } from "@/lib/db";

// Minimización de datos (LFPDPPP): cuando un CV se elimina (por plazo o a mano), no debe quedar nada que permita
// volver a ligar su historial con el candidato. La bitácora (solo inserción) nunca guarda datos del candidato:
// solo ids, y el nombre se consulta mientras el CV exista.

/** Inicio del día en hora de CDMX: quita la hora exacta, que permitiría cruzar el registro con la bitácora. */
export function inicioDelDiaCdmx(fecha: Date) {
  const dia = fecha.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }); // AAAA-MM-DD
  return new Date(`${dia}T00:00:00.000-06:00`);
}

/**
 * Debe llamarse dentro de la transacción que elimina los CVs, ANTES de borrarlos. En el historial:
 * - el id del CV pasa a un seudónimo aleatorio (uno por CV, para seguir contando CVs distintos);
 * - el id del análisis queda en nulo y las fechas se redondean al día, para no poder cruzarlo con la bitácora;
 * - si seguía «Pendiente de revisión», queda marcado como «expiró sin revisión».
 */
export async function olvidarCvs(tx: ClienteDb, cvIds: string[]) {
  for (const cvId of cvIds) {
    const seudonimo = `seudonimo-${randomUUID()}`;
    const registros = await tx.registroAnalisis.findMany({
      where: { cvId },
      select: { id: true, fecha: true, fechaAjuste: true, categoriaFinal: true },
    });
    for (const r of registros) {
      await tx.registroAnalisis.update({
        where: { id: r.id },
        data: {
          cvId: seudonimo,
          analisisId: null,
          fecha: inicioDelDiaCdmx(r.fecha),
          fechaAjuste: r.fechaAjuste ? inicioDelDiaCdmx(r.fechaAjuste) : null,
          expiroSinRevision: r.categoriaFinal === "REVISION",
        },
      });
    }
  }
}
