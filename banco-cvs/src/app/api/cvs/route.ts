import { NextResponse } from "next/server";
import { requerirRol } from "@/lib/auth";
import { TAMANO_MAXIMO } from "@/lib/archivos/firma";
import { subirCv } from "@/lib/archivos/servicio";
import { leerCuerpoLimitado, origenPermitido, respuestaDeError } from "@/lib/seguridad";

const MARGEN_MULTIPART = 64 * 1024;

/** Carga de un CV (un archivo por petición; la interfaz envía varios en cola). */
export async function POST(req: Request) {
  try {
    const usuario = await requerirRol("USUARIO");
    if (!origenPermitido(req)) {
      return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    }

    const cuerpo = await leerCuerpoLimitado(req, TAMANO_MAXIMO + MARGEN_MULTIPART);
    if (!cuerpo) {
      return NextResponse.json({ error: "El archivo supera 10 MB." }, { status: 413 });
    }
    const formulario = await new Response(new Uint8Array(cuerpo), {
      headers: { "content-type": req.headers.get("content-type") ?? "" },
    }).formData();
    const archivo = formulario.get("archivo");
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
    }

    const resultado = await subirCv(usuario, {
      nombreArchivo: archivo.name,
      contenido: Buffer.from(await archivo.arrayBuffer()),
      forzar: formulario.get("forzar") === "1",
    });
    return NextResponse.json(resultado, { status: resultado.estado === "DUPLICADO" ? 409 : 201 });
  } catch (error) {
    return respuestaDeError(error);
  }
}
