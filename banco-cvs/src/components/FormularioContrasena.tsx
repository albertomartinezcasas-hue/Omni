"use client";

import { useActionState } from "react";
import { cambiarContrasenaAccion } from "@/lib/auth/acciones";
import { Aviso } from "./Aviso";
import { ayuda, boton, campo, etiqueta } from "./estilos";

export function FormularioContrasena({ textoBoton }: { textoBoton: string }) {
  const [estado, accion, pendiente] = useActionState(cambiarContrasenaAccion, undefined);
  return (
    <form action={accion} className="space-y-4">
      {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <div>
        <label htmlFor="actual" className={etiqueta}>
          Contraseña actual
        </label>
        <input id="actual" name="actual" type="password" autoComplete="current-password" required className={campo} />
      </div>
      <div>
        <label htmlFor="nueva" className={etiqueta}>
          Nueva contraseña
        </label>
        <input
          id="nueva"
          name="nueva"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          aria-describedby="reglas-contrasena"
          className={campo}
        />
        <p id="reglas-contrasena" className={ayuda}>
          Mínimo 12 caracteres y distinta de la actual. Puedes usar una frase.
        </p>
      </div>
      <div>
        <label htmlFor="confirmacion" className={etiqueta}>
          Confirma la nueva contraseña
        </label>
        <input
          id="confirmacion"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          required
          className={campo}
        />
      </div>
      <button type="submit" className={boton.primario} disabled={pendiente}>
        {pendiente ? "Guardando…" : textoBoton}
      </button>
    </form>
  );
}
