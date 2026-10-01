"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/Aviso";
import { boton, campo, etiqueta } from "@/components/estilos";
import { iniciarSesionAccion } from "@/lib/auth/acciones";

export function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(iniciarSesionAccion, undefined);
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div>
        <label htmlFor="correo" className={etiqueta}>
          Correo
        </label>
        <input id="correo" name="correo" type="email" autoComplete="username" required className={campo} />
      </div>
      <div>
        <label htmlFor="contrasena" className={etiqueta}>
          Contraseña
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          required
          className={campo}
        />
      </div>
      <button type="submit" className={`${boton.primario} w-full`} disabled={pendiente}>
        {pendiente ? "Verificando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
