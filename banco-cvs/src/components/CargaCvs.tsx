"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { analizarCvAccion } from "@/acciones/analisis";
import type { CvDuplicado, ResultadoCarga } from "@/lib/archivos/servicio";
import { ayuda, boton, campo, celda, celdaEncabezado, etiqueta, tabla, tarjeta } from "./estilos";
import { formatearFecha } from "./Fecha";

const MAX_ARCHIVOS = 20;
const MAX_SIMULTANEOS = 3;
const TAMANO_MAXIMO = 10 * 1024 * 1024;

type Estado =
  | { tipo: "EN_COLA" }
  | { tipo: "PROCESANDO"; paso: "Subiendo" | "Analizando" }
  | { tipo: "LISTO"; cvId: string; analisisId?: string; sinTexto: boolean }
  | { tipo: "DUPLICADO"; duplicados: CvDuplicado[] }
  | { tipo: "CANCELADO" }
  | { tipo: "ERROR"; motivo: string; cvId?: string };

type Fila = { clave: string; archivo: File; estado: Estado };
type Tarea = { clave: string; forzar: boolean; cvId?: string };

const ETIQUETA: Record<Estado["tipo"], string> = {
  EN_COLA: "En cola",
  PROCESANDO: "Procesando",
  LISTO: "Listo",
  DUPLICADO: "Posible duplicado",
  CANCELADO: "Cancelado",
  ERROR: "Error",
};

const COLOR: Record<Estado["tipo"], string> = {
  EN_COLA: "bg-slate-100 text-slate-800",
  PROCESANDO: "bg-blue-100 text-blue-900",
  LISTO: "bg-green-100 text-green-900",
  DUPLICADO: "bg-amber-100 text-amber-900",
  CANCELADO: "bg-slate-100 text-slate-800",
  ERROR: "bg-red-100 text-red-900",
};

async function subir(archivo: File, forzar: boolean): Promise<Estado | { tipo: "SUBIDO"; cvId: string; sinTexto: boolean }> {
  if (archivo.size > TAMANO_MAXIMO) return { tipo: "ERROR", motivo: "El archivo supera 10 MB." };
  const datos = new FormData();
  datos.append("archivo", archivo);
  if (forzar) datos.append("forzar", "1");
  try {
    const respuesta = await fetch("/api/cvs", { method: "POST", body: datos });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as ResultadoCarga | { estado?: undefined; error?: string };
    if (respuesta.status === 401) return { tipo: "ERROR", motivo: "Tu sesión expiró. Vuelve a iniciar sesión." };
    if (cuerpo.estado === "GUARDADO") return { tipo: "SUBIDO", cvId: cuerpo.id, sinTexto: cuerpo.sinTexto };
    if (cuerpo.estado === "DUPLICADO") return { tipo: "DUPLICADO", duplicados: cuerpo.duplicados };
    return { tipo: "ERROR", motivo: ("error" in cuerpo && cuerpo.error) || "No se pudo subir el archivo." };
  } catch {
    return { tipo: "ERROR", motivo: "Sin conexión con el servidor." };
  }
}

export function CargaCvs({
  vacantes,
  vacanteInicial,
}: {
  vacantes: { id: string; titulo: string }[];
  vacanteInicial: string | null;
}) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vacanteId, setVacanteId] = useState(vacanteInicial ?? "");
  const entrada = useRef<HTMLInputElement>(null);
  const cola = useRef<Tarea[]>([]);
  const activos = useRef(0);
  const archivos = useRef(new Map<string, File>());
  const vacanteActual = useRef(vacanteId);

  function actualizar(clave: string, estado: Estado) {
    setFilas((previas) => previas.map((f) => (f.clave === clave ? { ...f, estado } : f)));
  }

  async function procesar(tarea: Tarea) {
    const archivo = archivos.current.get(tarea.clave)!;
    const vacante = vacanteActual.current;
    let cvId = tarea.cvId;
    let sinTexto = false;
    if (!cvId) {
      actualizar(tarea.clave, { tipo: "PROCESANDO", paso: "Subiendo" });
      const subida = await subir(archivo, tarea.forzar);
      if (subida.tipo !== "SUBIDO") return actualizar(tarea.clave, subida);
      cvId = subida.cvId;
      sinTexto = subida.sinTexto;
    }
    if (!vacante || sinTexto) return actualizar(tarea.clave, { tipo: "LISTO", cvId, sinTexto });
    actualizar(tarea.clave, { tipo: "PROCESANDO", paso: "Analizando" });
    try {
      const r = await analizarCvAccion(cvId, vacante);
      actualizar(tarea.clave, r.ok ? { tipo: "LISTO", cvId, analisisId: r.datos.id, sinTexto } : { tipo: "ERROR", motivo: r.error, cvId });
    } catch {
      actualizar(tarea.clave, { tipo: "ERROR", motivo: "Sin conexión con el servidor.", cvId });
    }
  }

  function siguiente() {
    while (activos.current < MAX_SIMULTANEOS && cola.current.length > 0) {
      const tarea = cola.current.shift()!;
      activos.current += 1;
      void procesar(tarea).finally(() => {
        activos.current -= 1;
        siguiente();
      });
    }
  }

  function encolar(tarea: Tarea) {
    actualizar(tarea.clave, { tipo: "EN_COLA" });
    cola.current.push(tarea);
    siguiente();
  }

  function alSeleccionar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    let seleccion = Array.from(lista);
    setAviso(null);
    if (seleccion.length > MAX_ARCHIVOS) {
      setAviso(`Solo se pueden subir ${MAX_ARCHIVOS} archivos a la vez. Se tomaron los primeros ${MAX_ARCHIVOS}.`);
      seleccion = seleccion.slice(0, MAX_ARCHIVOS);
    }
    vacanteActual.current = vacanteId;
    const nuevas: Fila[] = seleccion.map((archivo) => ({ clave: crypto.randomUUID(), archivo, estado: { tipo: "EN_COLA" } }));
    nuevas.forEach((f) => archivos.current.set(f.clave, f.archivo));
    setFilas((previas) => [...nuevas, ...previas]);
    nuevas.forEach((f) => cola.current.push({ clave: f.clave, forzar: false }));
    siguiente();
    if (entrada.current) entrada.current.value = "";
  }

  const pendientes = filas.filter((f) => f.estado.tipo === "EN_COLA" || f.estado.tipo === "PROCESANDO").length;

  return (
    <div className="space-y-6">
      <div className={`${tarjeta} space-y-4`}>
        <div className="max-w-xl">
          <label htmlFor="vacante" className={etiqueta}>Analizar contra la vacante</label>
          <select
            id="vacante"
            value={vacanteId}
            onChange={(e) => setVacanteId(e.target.value)}
            className={campo}
            disabled={pendientes > 0}
          >
            <option value="">Solo guardar en el repositorio (sin analizar)</option>
            {vacantes.map((v) => (
              <option key={v.id} value={v.id}>{v.titulo}</option>
            ))}
          </select>
        </div>

        <div>
          <span className={etiqueta} id="etiqueta-archivos">Archivos</span>
          {/* Botón propio en español; el control nativo queda accesible para teclado y lectores de pantalla. */}
          <label className={`${boton.primario} mt-1 cursor-pointer focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-blue-700`}>
            Seleccionar CVs
            <input
              ref={entrada}
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => alSeleccionar(e.target.files)}
              aria-labelledby="etiqueta-archivos"
              aria-describedby="ayuda-archivos"
              className="sr-only"
            />
          </label>
          <p id="ayuda-archivos" className={ayuda}>
            PDF o DOCX, máximo 10 MB cada uno y hasta {MAX_ARCHIVOS} archivos a la vez. La carga y el análisis inician en
            cuanto los seleccionas (máximo {MAX_SIMULTANEOS} análisis al mismo tiempo; cada uno tarda hasta 60 s).
          </p>
        </div>
        {aviso && (
          <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>
        )}
      </div>

      {filas.length > 0 && (
        <div className={`${tarjeta} overflow-x-auto p-0`}>
          <p className="px-6 pt-5 text-sm text-slate-700" aria-live="polite">
            {pendientes > 0 ? `Procesando ${pendientes} de ${filas.length} archivo(s)…` : `Terminado: ${filas.length} archivo(s).`}
          </p>
          <table className={`${tabla} mt-3`}>
            <caption className="sr-only">Estado de la carga por archivo</caption>
            <thead>
              <tr>
                <th scope="col" className={celdaEncabezado}>Archivo</th>
                <th scope="col" className={celdaEncabezado}>Estado</th>
                <th scope="col" className={celdaEncabezado}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave}>
                  <td className={`${celda} max-w-xs break-words`}>{f.archivo.name}</td>
                  <td className={celda}>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR[f.estado.tipo]}`}>
                      {ETIQUETA[f.estado.tipo]}
                    </span>
                    {f.estado.tipo === "PROCESANDO" && <span className="mt-1 block text-xs text-slate-700">{f.estado.paso}…</span>}
                  </td>
                  <td className={`${celda} space-y-2`}>
                    <DetalleFila
                      fila={f}
                      reintentar={(t) => encolar(t)}
                      cancelar={(c) => actualizar(c, { tipo: "CANCELADO" })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DetalleFila({
  fila,
  reintentar,
  cancelar,
}: {
  fila: Fila;
  reintentar: (t: Tarea) => void;
  cancelar: (clave: string) => void;
}) {
  const { estado, clave } = fila;
  switch (estado.tipo) {
    case "LISTO":
      return (
        <div className="flex flex-wrap items-center gap-3">
          {estado.sinTexto && <span className="text-amber-900">Sin texto legible (posible PDF escaneado): no se puede analizar.</span>}
          {estado.analisisId ? (
            <Link href={`/analisis/${estado.analisisId}`} className={boton.primario}>Ver resultado</Link>
          ) : (
            <Link href={`/cvs/${estado.cvId}`} className={boton.enlace}>Ver CV</Link>
          )}
        </div>
      );
    case "DUPLICADO":
      return (
        <div className="space-y-2">
          <p>Ya existe un CV que coincide:</p>
          <ul className="list-disc pl-5">
            {estado.duplicados.map((d) => (
              <li key={d.id}>
                <Link href={`/cvs/${d.id}`} className={boton.enlace} target="_blank">{d.nombre}</Link> — subido por{" "}
                {d.subidoPor} el {formatearFecha(d.creadoEn)} (coincide {d.coincidencia === "texto" ? "el contenido" : "el correo del candidato"})
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" className={boton.secundario} onClick={() => cancelar(clave)}>Cancelar</button>
            <button type="button" className={boton.primario} onClick={() => reintentar({ clave, forzar: true })}>
              Guardar de todos modos
            </button>
          </div>
        </div>
      );
    case "ERROR":
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-red-800">{estado.motivo}</span>
          <button type="button" className={boton.secundario} onClick={() => reintentar({ clave, forzar: false, cvId: estado.cvId })}>
            Reintentar
          </button>
        </div>
      );
    default:
      return null;
  }
}
