import { describe, expect, it } from "vitest";
import { corregirNombreAccion } from "@/acciones/cvs";
import { crearVacanteAccion, editarVacanteAccion } from "@/acciones/vacantes";
import { subirCv } from "@/lib/archivos/servicio";
import { db } from "@/lib/db";
import { crearPdf, crearUsuario, simularSesion, textoCv } from "./ayuda";

function form(campos: Record<string, string>) {
  const d = new FormData();
  for (const [k, v] of Object.entries(campos)) d.set(k, v);
  return d;
}
const BASE = {
  titulo: "Analista de Datos Jr.",
  area: "Inteligencia de Negocios",
  descripcion: "Reportes y tableros para el área comercial.",
  requisitosObligatorios: "SQL\nExcel avanzado",
  requisitosDeseables: "Power BI",
  aniosMinimos: "1",
  nivelEstudiosMinimo: "LICENCIATURA",
  modalidad: "HIBRIDO",
  ubicacion: "Ciudad de México",
};

describe("Edición de vacantes", () => {
  it("sin cambios no sube la versión ni registra; con cambios registra qué cambió", async () => {
    const admin = await crearUsuario({ rol: "ADMIN" });
    await simularSesion(admin);
    const creada = await crearVacanteAccion(undefined, form(BASE));
    if (!creada.ok) throw new Error(creada.error);
    const id = creada.datos.id;

    expect((await editarVacanteAccion(id, undefined, form(BASE))).ok).toBe(true);
    expect((await db.vacante.findUniqueOrThrow({ where: { id } })).version).toBe(1);
    expect(await db.eventoBitacora.count({ where: { accion: "VACANTE_EDITADA", entidadId: id } })).toBe(0);

    await editarVacanteAccion(id, undefined, form({ ...BASE, aniosMinimos: "2" }));
    expect((await db.vacante.findUniqueOrThrow({ where: { id } })).version).toBe(2);
    const evento = await db.eventoBitacora.findFirstOrThrow({ where: { accion: "VACANTE_EDITADA", entidadId: id } });
    expect(JSON.parse(evento.detalle!).cambios).toEqual([{ campo: "años mínimos", anterior: 1, nuevo: 2 }]);
  });
});

describe("Corrección del nombre del candidato", () => {
  it("Usuario puede corregirlo y queda en la bitácora con el valor anterior y el nuevo", async () => {
    const usuario = await crearUsuario();
    const cv = await subirCv(usuario, {
      nombreArchivo: "cv_final2.pdf",
      contenido: crearPdf(textoCv("Mario Ficticio", "mario@correo-ficticio.mx")),
      forzar: true,
    });
    if (cv.estado !== "GUARDADO") throw new Error();
    await simularSesion(usuario);
    expect((await corregirNombreAccion(cv.id, undefined, form({ nombreCandidato: " " }))).ok).toBe(false);
    expect((await corregirNombreAccion(cv.id, undefined, form({ nombreCandidato: "Mario Ficticio López" }))).ok).toBe(true);
    expect((await db.cv.findUniqueOrThrow({ where: { id: cv.id } })).nombreCandidato).toBe("Mario Ficticio López");
    const evento = await db.eventoBitacora.findFirstOrThrow({ where: { accion: "CV_NOMBRE_CORREGIDO", entidadId: cv.id } });
    expect(evento.actorId).toBe(usuario.id);
    expect(JSON.parse(evento.detalle!)).toMatchObject({ anterior: null, nuevo: "Mario Ficticio López" });
    await simularSesion(null);
    expect((await corregirNombreAccion(cv.id, undefined, form({ nombreCandidato: "Otro" }))).ok).toBe(false);
  });
});
