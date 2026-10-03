// Purga manual de CVs vencidos: npm run purgar
// El servidor ya la ejecuta cada hora; este script sirve para hacerlo a mano o desde un cron externo.
import { diasDeConservacion, purgarCvsVencidos } from "../src/lib/archivos/conservacion";

const { cvs, huerfanos } = await purgarCvsVencidos();
console.log(`CVs eliminados: ${cvs} (plazo: ${diasDeConservacion()} día(s)). Archivos huérfanos eliminados: ${huerfanos}.`);
process.exit(0);
