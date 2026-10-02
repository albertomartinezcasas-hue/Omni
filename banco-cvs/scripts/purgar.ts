// Purga manual de CVs vencidos: npm run purgar
// El servidor ya la ejecuta cada hora; este script sirve para hacerlo a mano o desde un cron externo.
import { diasDeConservacion, purgarCvsVencidos } from "../src/lib/archivos/conservacion";

const eliminados = await purgarCvsVencidos();
console.log(`CVs eliminados: ${eliminados} (plazo: ${diasDeConservacion()} día(s)).`);
process.exit(0);
