/**
 * Fase 4 — Analiza los 7 CVs ficticios contra "Analista de Datos Jr." con la API real
 * y muestra la tabla de resultado esperado vs. obtenido.
 * Usa una base de datos y un storage temporales (nunca los de la app).
 * Requiere al menos un proveedor configurado (p. ej. GROQ_API_KEY y/o GEMINI_API_KEY) en el entorno.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CVS_FASE4, VACANTE_FASE4 } from "./cvs";

const { proveedoresConfigurados } = await import("@/lib/analizador/proveedores");
if (proveedoresConfigurados().length === 0) {
  console.error("No hay proveedores de IA configurados (faltan claves *_API_KEY). Revisa .env.example.");
  process.exit(1);
}

const proyecto = process.cwd();
const temporal = mkdtempSync(path.join(tmpdir(), "banco-cvs-fase4-"));
process.env.DATABASE_URL = `file:${path.join(temporal, "fase4.db")}`;
// Al proceso hijo solo se le pasan las variables necesarias (nunca la clave de la API).
execFileSync("npx", ["prisma", "migrate", "deploy"], {
  env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: process.env.DATABASE_URL } as unknown as NodeJS.ProcessEnv,
  stdio: "ignore",
});
process.on("exit", () => rmSync(temporal, { recursive: true, force: true }));
process.chdir(temporal); // storage/ temporal
delete process.env.STORAGE_DIR; // aunque .env defina otra carpeta, se usa la temporal

const { db } = await import("@/lib/db");
const { crearVacante } = await import("@/lib/vacantes/servicio");
const { subirCv } = await import("@/lib/archivos/servicio");
const { analizarCv } = await import("@/lib/analizador/servicio");
const { calcularCategoria } = await import("@/lib/analizador/categoria");
const { obtenerUmbrales } = await import("@/lib/umbrales/servicio");
const { ETIQUETA_CATEGORIA } = await import("@/lib/catalogos");

const admin = await db.usuario.create({
  data: { correo: "validacion@empresa-ficticia.mx", nombre: "Validación Fase 4", rol: "ADMIN", debeCambiarContrasena: false },
});
const actor = { id: admin.id, nombre: admin.nombre, correo: admin.correo };
const vacante = await crearVacante(actor, VACANTE_FASE4);
const umbrales = await obtenerUmbrales();

const filas: string[] = [];
let aciertos = 0;
for (const cv of CVS_FASE4) {
  const contenido = readFileSync(path.join(proyecto, "tests", "fixtures", "fase4", cv.archivo));
  const carga = await subirCv(actor, { nombreArchivo: cv.archivo, contenido, forzar: true });
  if (carga.estado !== "GUARDADO") throw new Error(`No se guardó ${cv.archivo}`);
  let obtenido = "ERROR";
  let detalle = "";
  try {
    // El plan gratuito de Groq limita los tokens por minuto: ante "saturado" se espera y se reintenta.
    let id: string | undefined;
    for (let intento = 1; !id; intento++) {
      try {
        id = await analizarCv(actor, carga.id, vacante.id);
      } catch (error) {
        if (intento >= 6 || !(error instanceof Error) || !/saturad|no están disponibles|tardó más/.test(error.message)) throw error;
        console.error(`   límite de uso alcanzado; reintento ${intento} en 30 s…`);
        await new Promise((r) => setTimeout(r, 30_000));
      }
    }
    const a = await db.analisis.findUniqueOrThrow({ where: { id } });
    const r = JSON.parse(a.resultado);
    obtenido = calcularCategoria(a.veredicto, a.puntaje, umbrales);
    const niveles = r.requisitos.map((q: { id: string; nivel: number }) => `${q.id}:${q.nivel}`).join(" ");
    detalle = `[${a.modelo}] ${a.puntaje} (O ${Math.round(a.puntajeO)} · D ${a.puntajeD === null ? "—" : Math.round(a.puntajeD)} · E ${Math.round(a.puntajeE)} · F ${Math.round(a.puntajeF)}) · ${niveles} · exp ${r.experiencia.meses} meses${r.instruccionesOmitidas ? ` · instrucciones ignoradas: ${r.instruccionesOmitidas}` : ""}${a.veredicto === "NO_VIABLE" ? ` · ${JSON.parse(a.motivosNoViable).join("; ")}` : ""}${(r.experiencia.descartes ?? []).map((d: { puesto: string; motivo: string; cita: string }) => ` · descartado «${d.puesto}»: ${d.motivo} (cita: «${d.cita}»)`).join("")}${r.textoOcultoOmitido ? ` · texto oculto omitido: ${r.textoOcultoOmitido} caracteres` : ""}`;
  } catch (error) {
    detalle = error instanceof Error ? error.message : String(error);
  }
  const ok = obtenido === cv.esperado;
  if (ok) aciertos += 1;
  filas.push(
    `| ${cv.archivo} | ${ETIQUETA_CATEGORIA[cv.esperado]} | ${ETIQUETA_CATEGORIA[obtenido as keyof typeof ETIQUETA_CATEGORIA] ?? obtenido} | ${ok ? "✅" : "❌"} | ${detalle} |`,
  );
  console.error(`${ok ? "✅" : "❌"} ${cv.archivo}`);
  await new Promise((r) => setTimeout(r, 10_000)); // espaciar llamadas por el límite de uso
}

console.log(`Proveedores: ${proveedoresConfigurados().map((p) => `${p.nombre} (${p.modelo})`).join(" → ")} · Umbrales: ${JSON.stringify(umbrales)}\n`);
console.log("| CV | Esperado | Obtenido | ¿Coincide? | Puntaje y evidencia |");
console.log("|---|---|---|---|---|");
console.log(filas.join("\n"));
console.log(`\nCoincidencias: ${aciertos}/${CVS_FASE4.length}`);
await db.$disconnect();
