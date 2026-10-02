import { ETIQUETA_CATEGORIA, ETIQUETA_ROL, type Categoria, type Rol } from "@/lib/catalogos";

const ETIQUETA_CAMPO: Record<string, string> = {
  motivo: "Motivo",
  intento: "Intento",
  hasta: "Bloqueada hasta",
  usuario: "Usuario",
  nombre: "Nombre",
  rol: "Rol",
  rolAnterior: "Rol anterior",
  rolNuevo: "Rol nuevo",
  origen: "Origen",
  eraTemporal: "Era temporal",
  archivo: "Archivo",
  tipo: "Tipo",
  sinTexto: "Sin texto legible",
  duplicadoConfirmado: "Duplicado confirmado",
  candidato: "Candidato",
  cv: "Candidato",
  vacante: "Vacante",
  titulo: "Vacante",
  version: "Versión",
  veredicto: "Veredicto",
  puntaje: "Puntaje",
  modelo: "Modelo",
  comentario: "Comentario",
  categoriaCalculada: "Categoría calculada",
  instruccionesOmitidas: "Renglones con instrucciones ignorados",
  textoOcultoOmitido: "Caracteres en letra diminuta omitidos",
  anterior: "Anterior",
  nuevo: "Nuevo",
};

const MOTIVOS: Record<string, string> = {
  CUENTA_INEXISTENTE: "Cuenta inexistente",
  CUENTA_DESACTIVADA: "Cuenta desactivada",
  CUENTA_BLOQUEADA: "Cuenta bloqueada",
  CONTRASENA_INCORRECTA: "Contraseña incorrecta",
};

const categoria = (c: unknown) => ETIQUETA_CATEGORIA[c as Categoria] ?? String(c);

function valor(clave: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (clave === "motivo") return MOTIVOS[String(v)] ?? String(v);
  if (clave.startsWith("rol")) return ETIQUETA_ROL[v as Rol] ?? String(v);
  if (clave === "categoriaCalculada") return categoria(v);
  if (clave === "hasta") return new Date(String(v)).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  if (clave === "veredicto") return v === "VIABLE" ? "Viable" : "No viable";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** Detalle de un evento como pares etiqueta–valor; el JSON original queda disponible en un desplegable. */
export function DetalleBitacora({ detalle }: { detalle: string | null }) {
  if (!detalle) return <span>—</span>;
  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(detalle);
  } catch {
    return <span className="font-mono text-xs">{detalle}</span>;
  }
  const filas: [string, string][] = [];
  if ("categoria" in datos) {
    filas.push(["Categoría", `${datos.categoriaAnterior ? `${categoria(datos.categoriaAnterior)} → ` : ""}${categoria(datos.categoria)}`]);
  }
  if ("anteriores" in datos && "nuevos" in datos) {
    const a = datos.anteriores as Record<string, number>;
    const n = datos.nuevos as Record<string, number>;
    for (const k of ["excelente", "bueno", "pasable"]) {
      filas.push([ETIQUETA_CATEGORIA[k.toUpperCase() as Categoria], `${a[k]} → ${n[k]}`]);
    }
  }
  if (Array.isArray(datos.cambios)) {
    for (const c of datos.cambios as { campo: string; anterior: unknown; nuevo: unknown }[]) {
      const corto = (x: unknown) => {
        const t = typeof x === "string" && x.startsWith("[") ? (JSON.parse(x) as { texto?: string; idioma?: string }[]).map((e) => e.texto ?? e.idioma).join("; ") : String(x);
        return t.length > 80 ? `${t.slice(0, 79)}…` : t;
      };
      filas.push([`Cambio: ${c.campo}`, `${corto(c.anterior)} → ${corto(c.nuevo)}`]);
    }
  }
  if ("umbrales" in datos) {
    const u = datos.umbrales as Record<string, number>;
    filas.push(["Umbrales vigentes", `Excelente ≥ ${u.excelente}, Bueno ≥ ${u.bueno}, Pasable ≥ ${u.pasable}`]);
  }
  for (const [k, v] of Object.entries(datos)) {
    if (["categoria", "categoriaAnterior", "anteriores", "nuevos", "cambios", "umbrales"].includes(k)) continue;
    filas.push([ETIQUETA_CAMPO[k] ?? k, valor(k, v)]);
  }
  return (
    <div className="space-y-1 text-xs">
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        {filas.map(([e, v], i) => (
          <div key={i} className="contents">
            <dt className="font-semibold text-slate-700">{e}:</dt>
            <dd className="break-words text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary className="cursor-pointer text-slate-600">Ver datos originales</summary>
        <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-slate-700">{detalle}</pre>
      </details>
    </div>
  );
}
