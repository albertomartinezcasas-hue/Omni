import { z } from "zod";
import { registrarEvento, type Actor } from "@/lib/bitacora";
import { db } from "@/lib/db";

const entero = (nombre: string) =>
  z.coerce
    .number({ error: `Escribe el umbral de ${nombre}.` })
    .int({ error: `El umbral de ${nombre} debe ser un número entero.` })
    .max(100, { error: `El umbral de ${nombre} no puede ser mayor a 100.` });

export const esquemaUmbrales = z
  .object({ excelente: entero("Excelente"), bueno: entero("Bueno"), pasable: entero("Pasable") })
  .refine((u) => u.pasable >= 1, { error: "El umbral de Pasable debe ser al menos 1." })
  .refine((u) => u.excelente > u.bueno && u.bueno > u.pasable, {
    error: "Los umbrales deben cumplir Excelente > Bueno > Pasable.",
  });

export type Umbrales = z.infer<typeof esquemaUmbrales>;
export const UMBRALES_POR_DEFECTO: Umbrales = { excelente: 85, bueno: 70, pasable: 55 };

export async function obtenerUmbrales(): Promise<Umbrales> {
  const fila = await db.configuracionUmbrales.findUnique({ where: { id: 1 } });
  return fila
    ? { excelente: fila.excelente, bueno: fila.bueno, pasable: fila.pasable }
    : UMBRALES_POR_DEFECTO;
}

export async function actualizarUmbrales(actor: Actor, entrada: unknown) {
  const nuevos = esquemaUmbrales.parse(entrada);
  const anteriores = await obtenerUmbrales();
  await db.$transaction(async (tx) => {
    await tx.configuracionUmbrales.upsert({
      where: { id: 1 },
      create: { id: 1, ...nuevos, actualizadoPorId: actor.id },
      update: { ...nuevos, actualizadoPorId: actor.id },
    });
    await registrarEvento(
      { actor, accion: "UMBRALES_CAMBIADOS", entidadTipo: "UMBRALES", detalle: { anteriores, nuevos } },
      tx,
    );
  });
  return nuevos;
}
