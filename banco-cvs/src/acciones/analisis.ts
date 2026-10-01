"use server";

import { revalidatePath } from "next/cache";
import { ejecutarAccion, formDataAObjeto } from "@/lib/acciones";
import { ajustarCategoria } from "@/lib/analisis/ajustes";

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
