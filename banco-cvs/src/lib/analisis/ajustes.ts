import { z } from "zod";
import { registrarEvento, type Actor } from "@/lib/bitacora";
import { calcularCategoria } from "@/lib/analizador/categoria";
import { CATEGORIAS_AJUSTE } from "@/lib/catalogos";
import { db } from "@/lib/db";
import { ErrorNegocio } from "@/lib/errores";
import { obtenerUmbrales } from "@/lib/umbrales/servicio";

export const esquemaAjuste = z.object({
  categoria: z.enum(CATEGORIAS_AJUSTE, { error: "Selecciona una categoría." }),
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
    include: {
      vacante: true,
      cv: true,
      ajustes: { orderBy: { creadoEn: "desc" }, take: 1 },
    },
  });
  if (!analisis) throw new ErrorNegocio("El análisis no existe.");
  if (analisis.vacante.estado === "ARCHIVADA") {
    throw new ErrorNegocio("La vacante está archivada y es de solo lectura.");
  }
  // Contexto de la decisión: contra qué se ajustó (la calculada depende de los umbrales vigentes).
  const umbrales = await obtenerUmbrales();
  const categoriaCalculada = calcularCategoria(analisis.veredicto, analisis.puntaje, umbrales);
  const categoriaAnterior = analisis.ajustes[0]?.categoria ?? categoriaCalculada;
  return db.$transaction(async (tx) => {
    const ajuste = await tx.ajusteCategoria.create({
      data: { analisisId, categoria: datos.categoria, comentario: datos.comentario, autorId: actor.id },
    });
    // El historial refleja la categoría vigente (la calculada al analizar se conserva aparte).
    await tx.registroAnalisis.updateMany({
      where: { analisisId },
      data: { categoriaFinal: datos.categoria, ajustada: true },
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
          categoriaAnterior,
          categoria: datos.categoria,
          categoriaCalculada,
          puntaje: analisis.puntaje,
          umbrales,
          comentario: datos.comentario,
        },
      },
      tx,
    );
    return ajuste;
  });
}
