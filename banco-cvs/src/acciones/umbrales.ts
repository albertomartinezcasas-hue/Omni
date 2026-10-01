"use server";

import { revalidatePath } from "next/cache";
import { ejecutarAccion, formDataAObjeto } from "@/lib/acciones";
import { actualizarUmbrales } from "@/lib/umbrales/servicio";

export async function actualizarUmbralesAccion(_previo: unknown, formData: FormData) {
  const resultado = await ejecutarAccion("ADMIN", (actor) =>
    actualizarUmbrales(actor, formDataAObjeto(formData)),
  );
  if (resultado.ok) revalidatePath("/", "layout");
  return resultado;
}
