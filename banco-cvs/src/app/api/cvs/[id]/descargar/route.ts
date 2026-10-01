import { NextResponse } from "next/server";
import { requerirRol } from "@/lib/auth";
import { descargarCv } from "@/lib/archivos/servicio";
import { respuestaDeError } from "@/lib/seguridad";

const TIPOS_MIME = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

function disposicion(nombre: string) {
  const ascii = nombre.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

/** Descarga autenticada. storage/ nunca se sirve de forma pública. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const usuario = await requerirRol("USUARIO");
    const { id } = await params;
    const archivo = await descargarCv(usuario, id);
    if (!archivo) return NextResponse.json({ error: "El CV no existe." }, { status: 404 });
    return new NextResponse(new Uint8Array(archivo.contenido), {
      headers: {
        "Content-Type": TIPOS_MIME[archivo.tipo],
        "Content-Disposition": disposicion(archivo.nombreArchivo),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
