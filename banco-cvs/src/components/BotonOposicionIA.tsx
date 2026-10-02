"use client";

import { useRouter } from "next/navigation";
import { marcarOposicionIAAccion } from "@/acciones/cvs";
import { boton } from "./estilos";
import { DialogoConfirmacion } from "./DialogoConfirmacion";

/** Registra o retira la oposición del candidato al análisis con IA (queda en la bitácora). */
export function BotonOposicionIA({ id, seOpone }: { id: string; seOpone: boolean }) {
  const router = useRouter();
  return seOpone ? (
    <DialogoConfirmacion
      textoBoton="Retirar oposición"
      titulo="¿Retirar la oposición?"
      mensaje={<p>Hazlo solo si el candidato autorizó por escrito el análisis con IA. Quedará registrado en la bitácora.</p>}
      textoConfirmar="Retirar oposición"
      claseBoton={boton.secundario}
      alConfirmar={async () => {
        const resultado = await marcarOposicionIAAccion(id, false);
        if (resultado.ok) router.refresh();
        return resultado;
      }}
    />
  ) : (
    <DialogoConfirmacion
      textoBoton="Registrar oposición"
      titulo="¿Registrar la oposición al análisis con IA?"
      mensaje={
        <p>
          El CV se conservará, pero nadie podrá analizarlo con IA: solo podrá evaluarlo una persona. Los análisis
          anteriores no se borran. Quedará registrado en la bitácora.
        </p>
      }
      textoConfirmar="Registrar oposición"
      claseBoton={boton.secundario}
      alConfirmar={async () => {
        const resultado = await marcarOposicionIAAccion(id, true);
        if (resultado.ok) router.refresh();
        return resultado;
      }}
    />
  );
}
