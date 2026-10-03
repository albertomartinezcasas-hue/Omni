// Validación de la configuración al arrancar el servidor. En producción, un error impide iniciar:
// es mejor no arrancar que funcionar con una sesión insegura o sin borrar los CVs a tiempo.
import { proveedoresConfigurados } from "@/lib/analizador/proveedores";
import { diasDeConservacion } from "@/lib/archivos/conservacion";

export type Revision = { errores: string[]; avisos: string[] };

/** Revisa las variables de entorno. Nunca incluye valores secretos en los mensajes. */
export function revisarConfiguracion(env: Record<string, string | undefined> = process.env): Revision {
  const errores: string[] = [];
  const avisos: string[] = [];

  const secreto = env.AUTH_SECRET?.trim() ?? "";
  if (secreto.length < 32) errores.push("AUTH_SECRET falta o es muy corto (mínimo 32 caracteres; genera uno con `openssl rand -base64 32`).");

  const url = env.AUTH_URL?.trim();
  if (!url) {
    errores.push("AUTH_URL falta (la dirección pública de la app, p. ej. https://cvs.empresa.mx).");
  } else {
    try {
      const u = new URL(url);
      const local = ["localhost", "127.0.0.1"].includes(u.hostname);
      if (u.protocol !== "https:" && !local) errores.push("AUTH_URL debe usar https://.");
    } catch {
      errores.push("AUTH_URL no es una URL válida.");
    }
  }

  if (!env.ALLOWED_DOMAINS?.split(",").some((d) => d.trim())) {
    errores.push("ALLOWED_DOMAINS falta (dominios de correo permitidos, separados por coma).");
  }

  const db = env.DATABASE_URL?.trim();
  if (db && !db.startsWith("file:")) errores.push("DATABASE_URL debe ser un archivo SQLite (file:...).");
  if (!db) avisos.push("DATABASE_URL no está definida: se usa file:./data/banco.db.");

  if (diasDeConservacion(env) === null) errores.push("CONSERVACION_DIAS debe ser un entero mayor o igual a 1.");

  if (proveedoresConfigurados(env).length === 0) {
    avisos.push("No hay proveedores de IA con clave (*_API_KEY): el repositorio funciona, pero el análisis no.");
  }
  return { errores, avisos };
}

/**
 * Al arrancar el servidor (solo Node): registra avisos y errores. En producción, un error termina el proceso
 * (Next.js no lo hace solo), para que Docker/systemd lo detecten y no quede un servidor a medias.
 * En desarrollo solo avisa, salvo un plazo de conservación inválido, que siempre impide arrancar.
 */
export function validarAlArrancar() {
  const { errores, avisos } = revisarConfiguracion();
  for (const aviso of avisos) console.warn(`[configuracion] ${aviso}`);
  if (errores.length === 0) return;
  for (const error of errores) console.error(`[configuracion] ${error}`);
  if (process.env.NODE_ENV === "production" || errores.some((e) => e.startsWith("CONSERVACION_DIAS"))) {
    console.error(`[configuracion] Configuración inválida: ${errores.length} problema(s). El servidor no arranca.`);
    process.exit(1);
  }
}
