export default function Cargando() {
  return (
    <div role="status" className="space-y-4">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
      <p className="text-sm text-slate-700">Cargando…</p>
    </div>
  );
}
