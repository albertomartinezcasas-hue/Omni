import { beforeAll, describe, expect, it } from "vitest";
import { ajustarCategoriaAccion } from "@/acciones/analisis";
import { crearVacanteAccion, editarVacanteAccion } from "@/acciones/vacantes";
import { subirCv } from "@/lib/archivos/servicio";
import {
  consultarActores,
  consultarAnalisis,
  consultarCandidatos,
  consultarRepositorio,
  consultarUmbralesAdmin,
} from "@/lib/consultas";
import { db } from "@/lib/db";
import { crearPdf, crearUsuario, simularSesion, textoCv } from "./ayuda";

type Usuario = Awaited<ReturnType<typeof crearUsuario>>;
let admin: Usuario;
let reclutadora: Usuario;
let otra: Usuario;
let vacanteId: string;
const cvs: Record<string, string> = {};

const BASE = {
  titulo: "Analista de Datos Jr.",
  area: "BI",
  descripcion: "Reportes y tableros para el área comercial.",
  requisitosObligatorios: "SQL",
  requisitosDeseables: "",
  aniosMinimos: "1",
  nivelEstudiosMinimo: "LICENCIATURA",
  modalidad: "HIBRIDO",
  ubicacion: "CDMX",
};
const form = (c: Record<string, string>) => {
  const d = new FormData();
  for (const [k, v] of Object.entries(c)) d.set(k, v);
  return d;
};

async function analisis(cvId: string, puntaje: number, veredicto = "VIABLE", creadoEn = new Date()) {
  return db.analisis.create({
    data: {
      cvId, vacanteId, vacanteVersion: 1, vacanteSnapshot: "{}", modelo: "prueba", creadoPorId: admin.id, creadoEn,
      veredicto, motivosNoViable: veredicto === "VIABLE" ? "[]" : JSON.stringify(["No se encontró evidencia de: SQL"]),
      puntaje, puntajeO: puntaje, puntajeD: null, puntajeE: 70, puntajeF: 100,
      resultado: JSON.stringify({ requisitos: [], experiencia: { puestos: [] }, cualidades: [], brechas: [], preguntas: [] }),
    },
  });
}

beforeAll(async () => {
  admin = await crearUsuario({ rol: "ADMIN" });
  reclutadora = await crearUsuario();
  otra = await crearUsuario();
  await simularSesion(admin);
  const v = await crearVacanteAccion(undefined, form(BASE));
  if (!v.ok) throw new Error(v.error);
  vacanteId = v.datos.id;

  for (const [nombre, quien] of [["Ana Ficticia", reclutadora], ["Beto Ficticio", reclutadora], ["Carla Ficticia", otra], ["Dario Ficticio", otra]] as const) {
    const texto = [...textoCv(nombre, `${nombre.split(" ")[0].toLowerCase()}@correo-ficticio.mx`), nombre === "Dario Ficticio" ? "Experiencia con Tableau." : ""];
    const r = await subirCv(quien, { nombreArchivo: `${nombre}.pdf`, contenido: crearPdf(texto), forzar: true });
    if (r.estado !== "GUARDADO") throw new Error();
    await db.cv.update({ where: { id: r.id }, data: { nombreCandidato: nombre } });
    cvs[nombre] = r.id;
  }
  await analisis(cvs["Ana Ficticia"], 60, "VIABLE", new Date(Date.now() - 60_000)); // análisis viejo
  await analisis(cvs["Ana Ficticia"], 90); // el más reciente cuenta
  await analisis(cvs["Beto Ficticio"], 72);
  await analisis(cvs["Carla Ficticia"], 81, "NO_VIABLE");
  await analisis(cvs["Dario Ficticio"], 58);
});

describe("Vista por vacante", () => {
  it("usa el análisis más reciente de cada CV, agrupa por categoría y ordena por puntaje", async () => {
    await simularSesion(reclutadora);
    const { grupos, total } = await consultarCandidatos(vacanteId, 1);
    expect(total).toBe(4);
    expect(grupos.EXCELENTE.map((f) => f.candidato)).toEqual(["Ana Ficticia"]);
    expect(grupos.BUENO.map((f) => f.candidato)).toEqual(["Beto Ficticio"]);
    expect(grupos.PASABLE.map((f) => f.candidato)).toEqual(["Dario Ficticio"]);
    expect(grupos.NO_VIABLE[0]).toMatchObject({ candidato: "Carla Ficticia", puntaje: 81 });
    expect(grupos.NO_VIABLE[0].categoria.causaNoViable).toBe("REQUISITO");
  });

  it("el ajuste manual mueve al candidato de grupo y conserva la categoría calculada", async () => {
    await simularSesion(reclutadora);
    const { grupos } = await consultarCandidatos(vacanteId, 1);
    const id = grupos.PASABLE[0].analisisId;
    const r = await ajustarCategoriaAccion(id, undefined, form({ categoria: "BUENO", comentario: "Excelente referencia laboral verificada." }));
    expect(r.ok).toBe(true);
    const despues = await consultarCandidatos(vacanteId, 1);
    expect(despues.grupos.BUENO.map((f) => f.candidato)).toEqual(["Beto Ficticio", "Dario Ficticio"]);
    const dario = despues.grupos.BUENO[1];
    expect(dario.categoria).toMatchObject({ final: "BUENO", calculada: "PASABLE" });
    expect(dario.categoria.ajustadaPor).toBe(reclutadora.nombre);
  });

  it("al editar la vacante, los análisis quedan Desactualizados", async () => {
    await simularSesion(admin);
    await editarVacanteAccion(vacanteId, undefined, form({ ...BASE, aniosMinimos: "2" }));
    const v = await db.vacante.findUniqueOrThrow({ where: { id: vacanteId } });
    const { grupos } = await consultarCandidatos(vacanteId, v.version);
    expect(Object.values(grupos).flat().every((f) => f.desactualizado)).toBe(true);
  });

  it("el detalle avisa del ajuste hecho en un análisis anterior", async () => {
    await simularSesion(reclutadora);
    const viejo = await db.analisis.findFirstOrThrow({ where: { cvId: cvs["Beto Ficticio"] } });
    await ajustarCategoriaAccion(viejo.id, undefined, form({ categoria: "EXCELENTE", comentario: "Entrevista técnica sobresaliente." }));
    const nuevo = await analisis(cvs["Beto Ficticio"], 74);
    const detalle = await consultarAnalisis(nuevo.id);
    expect(detalle!.ajustesPrevios[0]).toMatchObject({ categoria: "EXCELENTE", comentario: "Entrevista técnica sobresaliente." });
  });
});

describe("Búsqueda y filtros del repositorio", () => {
  it("busca por nombre y por palabra clave del texto del CV", async () => {
    await simularSesion(reclutadora);
    expect((await consultarRepositorio({ q: "Carla" })).map((c) => c.nombreCandidato)).toEqual(["Carla Ficticia"]);
    expect((await consultarRepositorio({ q: "tableau" })).map((c) => c.nombreCandidato)).toEqual(["Dario Ficticio"]);
  });

  it("filtra por vacante y categoría, por persona que subió y por fecha de carga", async () => {
    await simularSesion(reclutadora);
    const excelentes = await consultarRepositorio({ vacanteId, categoria: "EXCELENTE" });
    expect(excelentes.map((c) => c.nombreCandidato).sort()).toEqual(["Ana Ficticia"]);
    const deOtra = await consultarRepositorio({ subidoPorId: otra.id });
    expect(deOtra.map((c) => c.nombreCandidato).sort()).toEqual(["Carla Ficticia", "Dario Ficticio"]);
    const manana = new Date(Date.now() + 86_400_000 * 2).toISOString().slice(0, 10);
    expect(await consultarRepositorio({ desde: manana })).toEqual([]);
  });
});

describe("Permisos de las pantallas de Admin", () => {
  it("umbrales y lista de usuarios de la bitácora: Usuario ❌ Admin ✅", async () => {
    await simularSesion(reclutadora);
    await expect(consultarUmbralesAdmin()).rejects.toMatchObject({ motivo: "SIN_PERMISO" });
    await expect(consultarActores()).rejects.toMatchObject({ motivo: "SIN_PERMISO" });
    await simularSesion(admin);
    expect((await consultarUmbralesAdmin())?.excelente).toBe(85);
    expect((await consultarActores()).length).toBeGreaterThanOrEqual(3);
  });
});
