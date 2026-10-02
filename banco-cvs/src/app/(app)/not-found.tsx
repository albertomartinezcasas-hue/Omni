import Link from "next/link";
import { boton, tarjeta } from "@/components/estilos";

export default function NoEncontrado() {
  return (
    <div className={`${tarjeta} mx-auto max-w-lg space-y-4 text-center`}>
      <h1 className="text-2xl font-bold text-slate-900">No encontramos este registro</h1>
      <p className="text-sm text-slate-700">Puede que se haya eliminado o que el enlace esté incompleto.</p>
      <Link href="/vacantes" className={boton.primario}>Ir a Vacantes</Link>
    </div>
  );
}
