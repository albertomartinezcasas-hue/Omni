import { z } from "zod";
import { atributosProtegidosEn } from "@/lib/analizador/atributosProtegidos";
import { MODALIDADES, NIVELES_ESTUDIO, NIVELES_IDIOMA } from "@/lib/catalogos";

export const esquemaRequisito = z.object({ id: z.string(), texto: z.string() });
export type Requisito = z.infer<typeof esquemaRequisito>;

export const esquemaIdioma = z.object({
  idioma: z.string().trim().min(2, { error: "Escribe el idioma." }).max(40),
  nivel: z.enum(NIVELES_IDIOMA, { error: "Selecciona el nivel del idioma." }),
});
export type IdiomaRequerido = z.infer<typeof esquemaIdioma>;

/** Convierte un texto con un requisito por renglón en lista (sin vacíos ni viñetas). */
function renglones(texto: string) {
  return texto
    .split(/\r?\n/)
    .map((r) => r.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}

const listaRequisitos = (minimo: number, mensaje: string) =>
  z
    .string()
    .max(5000)
    .transform(renglones)
    .pipe(
      z
        .array(z.string().max(300, { error: "Cada requisito debe tener 300 caracteres o menos." }))
        .min(minimo, { error: mensaje })
        .max(20, { error: "Máximo 20 requisitos por lista." }),
    );

export const esquemaVacante = z
  .object({
  titulo: z.string().trim().min(3, { error: "Escribe el título de la vacante." }).max(120),
  area: z.string().trim().min(2, { error: "Escribe el área." }).max(80),
  descripcion: z.string().trim().min(10, { error: "Escribe una descripción." }).max(5000),
  requisitosObligatorios: listaRequisitos(1, "Agrega al menos un requisito obligatorio."),
  requisitosDeseables: listaRequisitos(0, ""),
  aniosMinimos: z.coerce
    .number({ error: "Escribe los años mínimos de experiencia." })
    .int({ error: "Los años deben ser un número entero." })
    .min(0, { error: "Los años no pueden ser negativos." })
    .max(40),
  nivelEstudiosMinimo: z.enum(NIVELES_ESTUDIO, { error: "Selecciona el nivel de estudios." }),
  idiomas: z.array(esquemaIdioma).max(5, { error: "Máximo 5 idiomas." }),
  modalidad: z.enum(MODALIDADES, { error: "Selecciona la modalidad." }),
  ubicacion: z.string().trim().min(2, { error: "Escribe la ubicación." }).max(120),
  })
  .superRefine((v, ctx) => {
    // No discriminación: ningún texto de la vacante puede pedir atributos protegidos.
    const campos: [string, string][] = [
      ["título", v.titulo],
      ["área", v.area],
      ["descripción", v.descripcion],
      ["requisitos obligatorios", v.requisitosObligatorios.join("\n")],
      ["requisitos deseables", v.requisitosDeseables.join("\n")],
    ];
    for (const [campo, texto] of campos) {
      const atributos = atributosProtegidosEn(texto);
      if (atributos.length) {
        ctx.addIssue({
          code: "custom",
          message: `El campo «${campo}» menciona: ${atributos.join(", ")}. Por ley no se puede seleccionar por edad, género, estado civil, embarazo, religión, origen étnico o nacional, discapacidad, apariencia ni domicilio; quita esa parte.`,
        });
        return;
      }
    }
  });

export type DatosVacante = z.infer<typeof esquemaVacante>;

/** Lee los idiomas de un formulario (campos idioma_i / nivelIdioma_i). */
export function idiomasDeFormulario(formData: FormData) {
  const idiomas: { idioma: string; nivel: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const idioma = String(formData.get(`idioma_${i}`) ?? "").trim();
    if (!idioma) continue;
    idiomas.push({ idioma, nivel: String(formData.get(`nivelIdioma_${i}`) ?? "") });
  }
  return idiomas;
}

export function aRequisitos(textos: string[], prefijo: "O" | "D"): Requisito[] {
  return textos.map((texto, i) => ({ id: `${prefijo}${i + 1}`, texto }));
}

export const leerRequisitos = (json: string) => z.array(esquemaRequisito).parse(JSON.parse(json));
export const leerIdiomas = (json: string) => z.array(esquemaIdioma).parse(JSON.parse(json));
