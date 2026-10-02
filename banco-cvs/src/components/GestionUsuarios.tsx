"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import {
  cambiarRolAccion,
  crearUsuarioAccion,
  desactivarUsuarioAccion,
  reactivarUsuarioAccion,
  restablecerContrasenaAccion,
} from "@/acciones/usuarios";
import { ETIQUETA_ROL, ROLES, type Rol } from "@/lib/catalogos";
import { Aviso } from "./Aviso";
import { ContrasenaTemporal } from "./ContrasenaTemporal";
import { DialogoConfirmacion } from "./DialogoConfirmacion";
import { boton, campo, celda, celdaEncabezado, etiqueta, tabla, tarjeta, tarjetaTabla } from "./estilos";

export type FilaUsuario = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  debeCambiarContrasena: boolean;
  bloqueado: boolean;
  alta: string;
};

export function GestionUsuarios({ usuarios, actualId }: { usuarios: FilaUsuario[]; actualId: string }) {
  const formulario = useRef<HTMLFormElement>(null);
  const [temporal, setTemporal] = useState<{ correo: string; contrasena: string } | null>(null);
  const [estado, crear, pendiente] = useActionState(
    async (previo: { error?: string } | undefined, formData: FormData) => {
      const resultado = await crearUsuarioAccion(previo, formData);
      if (!resultado.ok) return { error: resultado.error };
      formulario.current?.reset();
      // La contraseña temporal solo vive en este estado hasta que el Admin la oculta.
      setTemporal({ correo: resultado.datos.correo, contrasena: resultado.datos.contrasenaTemporal });
      return undefined;
    },
    undefined,
  );

  return (
    <div className="space-y-6">
      {temporal && (
        <ContrasenaTemporal correo={temporal.correo} contrasena={temporal.contrasena} alCerrar={() => setTemporal(null)} />
      )}

      <section className={`${tarjeta} space-y-4`} aria-labelledby="alta">
        <h2 id="alta" className="text-lg font-bold text-slate-900">Dar de alta</h2>
        {estado?.error && <Aviso tipo="error">{estado.error}</Aviso>}
        <form
          ref={formulario}
          // Envío manual: con `action` React 19 vacía el formulario aunque haya errores.
          onSubmit={(e) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            startTransition(() => crear(datos));
          }}
          className="grid items-end gap-4 md:grid-cols-[1fr_1fr_10rem_auto]">
          <div>
            <label htmlFor="nombre" className={etiqueta}>Nombre completo</label>
            <input id="nombre" name="nombre" required className={campo} />
          </div>
          <div>
            <label htmlFor="correo" className={etiqueta}>Correo de la empresa</label>
            <input id="correo" name="correo" type="email" required className={campo} />
          </div>
          <div>
            <label htmlFor="rol" className={etiqueta}>Rol</label>
            <select id="rol" name="rol" defaultValue="USUARIO" className={campo}>
              {ROLES.map((r) => <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>)}
            </select>
          </div>
          <button type="submit" className={boton.primario} disabled={pendiente}>
            {pendiente ? "Creando…" : "Crear cuenta"}
          </button>
        </form>
      </section>

      <section className={`${tarjetaTabla}`} aria-labelledby="lista">
        <h2 id="lista" className="px-6 pt-6 text-lg font-bold text-slate-900">Cuentas</h2>
        <table className={`${tabla} mt-4`}>
          <thead>
            <tr>
              <th scope="col" className={celdaEncabezado}>Nombre</th>
              <th scope="col" className={celdaEncabezado}>Correo</th>
              <th scope="col" className={celdaEncabezado}>Rol</th>
              <th scope="col" className={celdaEncabezado}>Estado</th>
              <th scope="col" className={celdaEncabezado}>Alta</th>
              <th scope="col" className={celdaEncabezado}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className={celda}>
                  {u.nombre}
                  {u.id === actualId && <span className="ml-1 text-xs text-slate-600">(tú)</span>}
                </td>
                <td className={`${celda} break-all`}>{u.correo}</td>
                <td className={celda}>{ETIQUETA_ROL[u.rol]}</td>
                <td className={celda}>
                  {u.activo ? "Activo" : "Desactivado"}
                  {u.activo && u.debeCambiarContrasena && (
                    <span className="block text-xs text-slate-600">Contraseña temporal pendiente</span>
                  )}
                  {u.activo && u.bloqueado && (
                    <span className="block text-xs text-red-800">Bloqueado temporalmente</span>
                  )}
                </td>
                <td className={`${celda} text-xs text-slate-700`}>{u.alta}</td>
                <td className={celda}>
                  {u.id === actualId ? (
                    <span className="text-xs text-slate-700">
                      Tu cuenta: cambia tu contraseña en «Mi cuenta». Para cambiar tu rol o desactivarte, pide a otro Admin.
                    </span>
                  ) : (
                    <AccionesUsuario usuario={u} alRestablecer={setTemporal} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function AccionesUsuario({
  usuario: u,
  alRestablecer,
}: {
  usuario: FilaUsuario;
  alRestablecer: (t: { correo: string; contrasena: string }) => void;
}) {
  const otroRol: Rol = u.rol === "ADMIN" ? "USUARIO" : "ADMIN";
  return (
    <div className="flex flex-wrap gap-2">
      {u.activo && (
        <DialogoConfirmacion
          textoBoton={u.rol === "ADMIN" ? "Cambiar a Usuario" : "Cambiar a Admin"}
          titulo="¿Cambiar el rol?"
          mensaje={<p>{u.nombre} pasará a tener el rol {ETIQUETA_ROL[otroRol]}. Su sesión abierta se cerrará.</p>}
          textoConfirmar="Cambiar rol"
          alConfirmar={() => cambiarRolAccion(u.id, otroRol)}
        />
      )}
      {u.activo && (
        <DialogoConfirmacion
          textoBoton="Restablecer contraseña"
          titulo="¿Restablecer la contraseña?"
          mensaje={<p>Se generará una contraseña temporal para {u.nombre} y su sesión abierta se cerrará.</p>}
          textoConfirmar="Restablecer"
          alConfirmar={async () => {
            const r = await restablecerContrasenaAccion(u.id);
            if (r.ok) alRestablecer({ correo: u.correo, contrasena: r.datos });
            return r;
          }}
        />
      )}
      {u.activo ? (
        <DialogoConfirmacion
          textoBoton="Desactivar"
          titulo="¿Desactivar la cuenta?"
          mensaje={<p>{u.nombre} ya no podrá entrar y su sesión abierta se cerrará de inmediato. La cuenta no se borra.</p>}
          textoConfirmar="Desactivar"
          peligro
          alConfirmar={() => desactivarUsuarioAccion(u.id)}
        />
      ) : (
        <DialogoConfirmacion
          textoBoton="Reactivar"
          titulo="¿Reactivar la cuenta?"
          mensaje={<p>{u.nombre} podrá volver a iniciar sesión con su contraseña actual.</p>}
          textoConfirmar="Reactivar"
          alConfirmar={() => reactivarUsuarioAccion(u.id)}
        />
      )}
    </div>
  );
}
