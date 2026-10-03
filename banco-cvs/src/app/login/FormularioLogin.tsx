"use client";

import { startTransition, useActionState, useRef } from "react";
import { Aviso } from "@/components/Aviso";
import { boton, campo, etiqueta } from "@/components/estilos";
import { iniciarSesionAccion, type EstadoFormulario } from "@/lib/auth/acciones";

export function FormularioLogin() {
  const contrasena = useRef<HTMLInputElement>(null);
  const [estado, accion, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    const r = await iniciarSesionAccion(previo, datos);
    // Tras un error se conserva el correo; la contraseña se vacía por seguridad.
    if (r?.error && contrasena.current) contrasena.current.value = "";
    return r;
  }, undefined);
  return (
    <form
      action={accion}
      // Envío manual: React no vacía el formulario tras un error.
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => accion(datos));
      }}
      className="space-y-4"
      noValidate
    >
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
          ref={contrasena}
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
