import { describe, expect, it } from "vitest";
import { revisarConfiguracion } from "@/lib/configuracion";

const VALIDA = {
  AUTH_SECRET: "x".repeat(44),
  AUTH_URL: "https://cvs.empresa-ficticia.mx",
  ALLOWED_DOMAINS: "empresa-ficticia.mx",
  DATABASE_URL: "file:./data/banco.db",
  GROQ_API_KEY: "clave-ficticia",
};

describe("Validación de la configuración al arrancar", () => {
  it("una configuración completa no tiene errores", () => {
    expect(revisarConfiguracion(VALIDA)).toEqual({ errores: [], avisos: [] });
  });

  it("detecta secreto corto, http público, dominios vacíos, base no SQLite y plazo inválido", () => {
    const { errores } = revisarConfiguracion({
      ...VALIDA,
      AUTH_SECRET: "corto",
      AUTH_URL: "http://cvs.empresa-ficticia.mx",
      ALLOWED_DOMAINS: " , ",
      DATABASE_URL: "postgres://x",
      CONSERVACION_DIAS: "0.5",
    });
    expect(errores).toHaveLength(5);
  });

  it("permite http solo en localhost y avisa (sin bloquear) si no hay proveedores de IA", () => {
    const r = revisarConfiguracion({ ...VALIDA, AUTH_URL: "http://localhost:3000", GROQ_API_KEY: undefined });
    expect(r.errores).toEqual([]);
    expect(r.avisos.join(" ")).toContain("proveedores de IA");
  });

  it("los mensajes nunca incluyen valores secretos", () => {
    const secreto = "secreto-que-no-debe-salir";
    const r = revisarConfiguracion({ ...VALIDA, AUTH_SECRET: secreto, AUTH_URL: "no es url" });
    expect(JSON.stringify(r)).not.toContain(secreto);
  });
});
