import { z } from "zod";
import { registrarEvento, type Actor } from "@/lib/bitacora";
import { CATEGORIAS } from "@/lib/catalogos";
import { db } from "@/lib/db";
import { ErrorNegocio } from "@/lib/errores";

export const esquemaAjuste = z.object({
  categoria: z.enum(CATEGORIAS, { error: "Selecciona una categoría." }),
  comentario: z
    .string()
    .trim()
    .min(10, { error: "Explica el motivo del ajuste (mínimo 10 caracteres)." })
    .max(1000),
});

/** Cambio manual de categoría con comentario (Usuario y Admin). */
export async function ajustarCategoria(actor: Actor, analisisId: string, entrada: unknown) {
  const datos = esquemaAjuste.parse(entrada);
  const analisis = await db.analisis.findUnique({
    where: { id: analisisId },
    include: { vacante: true, cv: true },
  });
  if (!analisis) throw new ErrorNegocio("El análisis no existe.");
  if (analisis.vacante.estado === "ARCHIVADA") {
    throw new ErrorNegocio("La vacante está archivada y es de solo lectura.");
  }
  return db.$transaction(async (tx) => {
    const ajuste = await tx.ajusteCategoria.create({
      data: { analisisId, categoria: datos.categoria, comentario: datos.comentario, autorId: actor.id },
    });
    await registrarEvento(
      {
        actor,
        accion: "CATEGORIA_AJUSTADA",
        entidadTipo: "ANALISIS",
        entidadId: analisisId,
        detalle: {
          vacante: analisis.vacante.titulo,
          cv: analisis.cv.nombreCandidato ?? analisis.cv.nombreArchivo,
          categoria: datos.categoria,
          comentario: datos.comentario,
        },
      },
      tx,
    );
    return ajuste;
  });
}
