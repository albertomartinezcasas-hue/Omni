"use server";

import { revalidatePath } from "next/cache";
import { ejecutarAccion } from "@/lib/acciones";
import { eliminarCv } from "@/lib/archivos/servicio";

export async function eliminarCvAccion(cvId: string) {
  const resultado = await ejecutarAccion("ADMIN", (actor) => eliminarCv(actor, cvId));
  if (resultado.ok) revalidatePath("/cvs");
  return resultado;
}
