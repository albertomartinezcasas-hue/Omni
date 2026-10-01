import { describe, expect, it } from "vitest";
import { atributosProtegidosEn } from "@/lib/analizador/atributosProtegidos";
import { esquemaVacante } from "@/lib/vacantes/esquema";

const base = {
  titulo: "Analista de Datos Jr.",
  area: "Inteligencia de Negocios",
  descripcion: "Elaborar reportes y tableros para el área comercial.",
  requisitosObligatorios: "SQL\nExcel avanzado",
  requisitosDeseables: "Power BI",
  aniosMinimos: "1",
  nivelEstudiosMinimo: "LICENCIATURA",
  idiomas: [],
  modalidad: "HIBRIDO",
  ubicacion: "Ciudad de México",
};

describe("Vacantes sin atributos protegidos", () => {
  it.each([
    ["requisitosObligatorios", "SQL\nEdad entre 25 y 35 años"],
    ["requisitosObligatorios", "Sexo masculino"],
    ["requisitosDeseables", "Soltero"],
    ["requisitosDeseables", "Buena presentación"],
    ["descripcion", "Buscamos a alguien que viva cerca de la oficina en Polanco."],
    ["requisitosObligatorios", "Enviar CV con fotografía"],
    ["titulo", "Analista mujer"],
  ])("rechaza %s = %s", (campo, valor) => {
    const r = esquemaVacante.safeParse({ ...base, [campo]: valor });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/Por ley no se puede seleccionar/);
  });

  it("acepta una vacante sin atributos protegidos", () => {
    expect(esquemaVacante.safeParse(base).success).toBe(true);
  });

  it("no confunde palabras que solo contienen el término", () => {
    expect(atributosProtegidosEn("Seguridad de la información, generar reportes, fotógrafo de producto")).toEqual([]);
    expect(atributosProtegidosEn("Edad: 30")).toEqual(["edad"]);
  });
});
