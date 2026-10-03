// Respaldo en caliente: npm run respaldo. Pensado para un cron diario (ver DESPLIEGUE.md).
// Crea dos niveles (src/lib/respaldo.ts):
// - completo (base + CVs), que se conserva RESPALDO_DIAS (por defecto, el mismo plazo que CONSERVACION_DIAS);
// - permanente (solo la base, sin datos de candidatos), que se conserva RESPALDO_PERMANENTE_DIAS (por defecto, 30).
import path from "node:path";
import { diasDeConservacion } from "../src/lib/archivos/conservacion";
import { db } from "../src/lib/db";
import { crearRespaldos, diasDeRespaldo, RESPALDO_PERMANENTE_DIAS_POR_DEFECTO } from "../src/lib/respaldo";

async function principal() {
  const diasCompleto = diasDeRespaldo(process.env.RESPALDO_DIAS, diasDeConservacion() ?? 1);
  const diasPermanente = diasDeRespaldo(process.env.RESPALDO_PERMANENTE_DIAS, RESPALDO_PERMANENTE_DIAS_POR_DEFECTO);
  if (diasCompleto === null || diasPermanente === null) {
    console.error("Error: RESPALDO_DIAS y RESPALDO_PERMANENTE_DIAS deben ser enteros mayores o iguales a 1.");
    return 1;
  }
  const r = await crearRespaldos({ destino: path.resolve(process.env.RESPALDO_DIR ?? "./respaldos"), diasCompleto, diasPermanente });
  await db.$disconnect();
  console.log(`Respaldo completo (base y CVs) en ${r.completo}; se conservan ${diasCompleto} día(s). Antiguos eliminados: ${r.borradosCompletos}.`);
  console.log(
    `Respaldo permanente (sin datos de candidatos) en ${r.permanente}; se conservan ${diasPermanente} día(s). Antiguos eliminados: ${r.borradosPermanentes}.`,
  );
  return 0;
}

principal().then(
  (codigo) => process.exit(codigo),
  (error) => {
    console.error(`Error al respaldar: ${error instanceof Error ? error.message : "desconocido"}`);
    process.exit(1);
  },
);
