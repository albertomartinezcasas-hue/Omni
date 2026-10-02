"use server";

import { revalidatePath } from "next/cache";
import { ejecutarAccion } from "@/lib/acciones";
import { corregirNombreCandidato, eliminarCv, marcarOposicionIA } from "@/lib/archivos/servicio";

export async function eliminarCvAccion(cvId: string) {
  const resultado = await ejecutarAccion("ADMIN", (actor) => eliminarCv(actor, cvId));
  if (resultado.ok) revalidatePath("/cvs");
  return resultado;
}

export async function corregirNombreAccion(cvId: string, _previo: unknown, formData: FormData) {
  const resultado = await ejecutarAccion("USUARIO", (actor) =>
    corregirNombreCandidato(actor, cvId, formData.get("nombreCandidato")),
  );
  if (resultado.ok) revalidatePath(`/cvs/${cvId}`);
  return resultado;
}

export async function marcarOposicionIAAccion(cvId: string, seOpone: boolean) {
  const resultado = await ejecutarAccion("USUARIO", (actor) => marcarOposicionIA(actor, cvId, seOpone === true));
  if (resultado.ok) revalidatePath(`/cvs/${cvId}`);
  return resultado;
}
