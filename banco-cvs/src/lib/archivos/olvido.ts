import { randomUUID } from "node:crypto";
import type { ClienteDb } from "@/lib/db";

// Minimización de datos (LFPDPPP): cuando un CV se elimina (por plazo o a mano), no debe quedar nada que permita
// volver a ligar su historial con el candidato. La bitácora (solo inserción) nunca guarda datos del candidato:
// solo ids, y el nombre se consulta mientras el CV exista.

/**
 * Debe llamarse dentro de la transacción que elimina los CVs, ANTES de borrarlos.
 * En el historial, el id del CV pasa a un seudónimo aleatorio (uno por CV, para seguir contando CVs distintos)
 * y el id del análisis queda en nulo: ya no se puede cruzar con los ids de la bitácora.
 */
export async function olvidarCvs(tx: ClienteDb, cvIds: string[]) {
  for (const cvId of cvIds) {
    await tx.registroAnalisis.updateMany({ where: { cvId }, data: { cvId: `seudonimo-${randomUUID()}`, analisisId: null } });
  }
}
