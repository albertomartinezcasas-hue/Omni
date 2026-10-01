import { NextResponse } from "next/server";
import { mensajeDeError } from "@/lib/acciones";
import { ErrorAutorizacion } from "@/lib/auth";

/** Protección CSRF para route handlers que modifican datos: el Origin debe ser el de la app. */
export function origenPermitido(req: Request) {
  const origen = req.headers.get("origin");
  if (!origen) return false;
  let origenUrl: URL;
  try {
    origenUrl = new URL(origen);
  } catch {
    return false;
  }
  if (process.env.AUTH_URL) return origenUrl.origin === new URL(process.env.AUTH_URL).origin;
  return origenUrl.host === req.headers.get("host");
}

/** Respuesta JSON de error para route handlers (401/403/400 sin detalles internos). */
export function respuestaDeError(error: unknown) {
  const estado =
    error instanceof ErrorAutorizacion ? (error.motivo === "SIN_PERMISO" ? 403 : 401) : 400;
  return NextResponse.json({ error: mensajeDeError(error) }, { status: estado });
}

/** Lee el cuerpo de la petición cortando en `limite` bytes (no lo carga completo si es mayor). */
export async function leerCuerpoLimitado(req: Request, limite: number): Promise<Buffer | null> {
  const declarado = Number(req.headers.get("content-length") ?? "0");
  if (declarado > limite) return null;
  if (!req.body) return Buffer.alloc(0);
  const lector = req.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await lector.cancel();
      return null;
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}
