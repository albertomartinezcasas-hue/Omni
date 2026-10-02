import Link from "next/link";

export default function NoEncontradoGlobal() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Página no encontrada</h1>
        <Link href="/" className="font-semibold text-blue-700 underline">Volver al inicio</Link>
      </div>
    </main>
  );
}
