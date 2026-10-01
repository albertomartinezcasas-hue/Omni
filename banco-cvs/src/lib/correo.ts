import { z } from "zod";

export function normalizarCorreo(correo: string) {
  return correo.trim().toLowerCase();
}

export const esquemaCorreo = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "El correo no tiene un formato válido." }));

export function esCorreoValido(correo: string) {
  return esquemaCorreo.safeParse(correo).success;
}

/** Dominios permitidos para crear cuentas (variable ALLOWED_DOMAINS, separados por coma). */
export function dominiosPermitidos(): string[] {
  const valor = process.env.ALLOWED_DOMAINS;
  if (!valor || !valor.trim()) {
    throw new Error("ALLOWED_DOMAINS no está configurada.");
  }
  return valor
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function dominioPermitido(correo: string) {
  const dominio = normalizarCorreo(correo).split("@")[1] ?? "";
  return dominiosPermitidos().includes(dominio);
}
