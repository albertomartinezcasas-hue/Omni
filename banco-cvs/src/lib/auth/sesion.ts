import { auth } from "./config";

export type DatosSesion = { uid: string; ver: number; inicio: number };

/** Lee la sesión (JWT) de la petición actual. */
export async function leerSesion(): Promise<DatosSesion | null> {
  const sesion = (await auth()) as unknown as Partial<DatosSesion> | null;
  if (
    !sesion ||
    typeof sesion.uid !== "string" ||
    typeof sesion.ver !== "number" ||
    typeof sesion.inicio !== "number"
  ) {
    return null;
  }
  return { uid: sesion.uid, ver: sesion.ver, inicio: sesion.inicio };
}
