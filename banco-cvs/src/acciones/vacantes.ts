"use server";

import { revalidatePath } from "next/cache";
import { ejecutarAccion, formDataAObjeto } from "@/lib/acciones";
import { idiomasDeFormulario } from "@/lib/vacantes/esquema";
import { archivarVacante, crearVacante, editarVacante } from "@/lib/vacantes/servicio";

function datosDeFormulario(formData: FormData) {
  return { ...formDataAObjeto(formData), idiomas: idiomasDeFormulario(formData) };
}

export async function crearVacanteAccion(_previo: unknown, formData: FormData) {
  const resultado = await ejecutarAccion("ADMIN", async (actor) => {
    const vacante = await crearVacante(actor, datosDeFormulario(formData));
    return { id: vacante.id };
  });
  if (resultado.ok) revalidatePath("/vacantes");
  return resultado;
}

export async function editarVacanteAccion(vacanteId: string, _previo: unknown, formData: FormData) {
  const resultado = await ejecutarAccion("ADMIN", async (actor) => {
    const vacante = await editarVacante(actor, vacanteId, datosDeFormulario(formData));
    return { id: vacante.id };
  });
  if (resultado.ok) revalidatePath("/vacantes", "layout");
  return resultado;
}

export async function archivarVacanteAccion(vacanteId: string) {
  const resultado = await ejecutarAccion("ADMIN", (actor) => archivarVacante(actor, vacanteId));
  if (resultado.ok) revalidatePath("/vacantes", "layout");
  return resultado;
}
