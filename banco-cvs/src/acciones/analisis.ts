"use server";

import { revalidatePath } from "next/cache";
import { ejecutarAccion, formDataAObjeto } from "@/lib/acciones";
import { ajustarCategoria } from "@/lib/analisis/ajustes";
import { analizarCv } from "@/lib/analizador/servicio";

export async function ajustarCategoriaAccion(
  analisisId: string,
  _previo: unknown,
  formData: FormData,
) {
  const resultado = await ejecutarAccion("USUARIO", async (actor) => {
    const ajuste = await ajustarCategoria(actor, analisisId, formDataAObjeto(formData));
    return { id: ajuste.id };
  });
  if (resultado.ok) revalidatePath(`/analisis/${analisisId}`);
  return resultado;
}

export async function analizarCvAccion(cvId: string, vacanteId: string) {
  const resultado = await ejecutarAccion("USUARIO", async (actor) => ({
    id: await analizarCv(actor, cvId, vacanteId),
  }));
  if (resultado.ok) revalidatePath(`/vacantes/${vacanteId}`);
  return resultado;
}
