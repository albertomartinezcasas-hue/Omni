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
    ["requisitosObligatorios", "SQL\nDe 25 a 35 años"],
    ["requisitosObligatorios", "Rango 25-40 años"],
    ["requisitosDeseables", "Mayor de 30"],
    ["requisitosDeseables", "Sin tatuajes visibles"],
    ["descripcion", "Sexo indistinto, buen estado de salud."],
  ])("rechaza %s = %s", (campo, valor) => {
    const r = esquemaVacante.safeParse({ ...base, [campo]: valor });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/Por ley no se puede seleccionar/);
  });

  it("acepta una vacante sin atributos protegidos", () => {
    expect(esquemaVacante.safeParse(base).success).toBe(true);
  });

  it("muestra el renglón y el fragmento que provocó el rechazo", () => {
    const r = esquemaVacante.safeParse({ ...base, requisitosObligatorios: "SQL\nExcel\nDe 25 a 35 años" });
    expect(r.error?.issues[0].message).toContain("(renglón 3) menciona «25 a 35 años» (edad)");
    expect(r.error?.issues[0].path).toEqual(["requisitosObligatorios"]);
  });

  it.each([
    "Repartidor a domicilio con licencia vigente",
    "Vacante incluyente para personas con discapacidad",
    "Programa Jóvenes Construyendo el Futuro",
    "Especialista en igualdad de género",
    "De 3 a 5 años de experiencia en SQL",
    "20 a 25 años de experiencia en auditoría",
    "Mayor de 5 años de experiencia",
  ])("acepta el contexto legítimo: %s", (texto) => {
    expect(atributosProtegidosEn(texto)).toEqual([]);
  });

  it("no confunde palabras que solo contienen el término", () => {
    expect(atributosProtegidosEn("Seguridad de la información, generar reportes, fotógrafo de producto")).toEqual([]);
    expect(atributosProtegidosEn("Edad: 30")).toEqual(["edad"]);
  });
});
