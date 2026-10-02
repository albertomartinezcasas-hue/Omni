import { NextResponse } from "next/server";
import { requerirRol } from "@/lib/auth";
import { registrarEvento } from "@/lib/bitacora";
import { historialACsv, registrosDelHistorial } from "@/lib/historial";
import { db } from "@/lib/db";
import { origenPermitido, respuestaDeError } from "@/lib/seguridad";

/** Exporta el historial filtrado en CSV (solo Admin). La exportación queda en la bitácora. */
export async function GET(req: Request) {
  try {
    const usuario = await requerirRol("ADMIN");
    // Solo navegación propia: otro sitio no puede provocar una exportación (que escribe en la bitácora).
    const sitio = req.headers.get("sec-fetch-site");
    const propio = sitio ? sitio === "same-origin" || sitio === "none" : origenPermitido(req);
    if (!propio) {
      return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    }
    const p = new URL(req.url).searchParams;
    const filtros = {
      desde: p.get("desde") || undefined,
      hasta: p.get("hasta") || undefined,
      area: p.get("area") || undefined,
      vacanteId: p.get("vacante") || undefined,
    };
    const registros = await registrosDelHistorial(filtros);
    const vacante = filtros.vacanteId
      ? await db.vacante.findUnique({ where: { id: filtros.vacanteId }, select: { titulo: true } })
      : null;
    await registrarEvento({
      actor: usuario,
      accion: "HISTORIAL_EXPORTADO",
      detalle: { filtros: { ...filtros, ...(vacante ? { vacante: vacante.titulo } : {}) }, registros: registros.length },
    });
    return new NextResponse(historialACsv(registros), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="historial-analisis.csv"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
