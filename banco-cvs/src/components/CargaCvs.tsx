"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { CvDuplicado, ResultadoCarga } from "@/lib/archivos/servicio";
import { ayuda, boton, celda, celdaEncabezado, tabla, tarjeta } from "./estilos";
import { formatearFecha } from "./Fecha";

const MAX_ARCHIVOS = 20;
const TAMANO_MAXIMO = 10 * 1024 * 1024;

type Estado =
  | { tipo: "EN_COLA" }
  | { tipo: "PROCESANDO" }
  | { tipo: "LISTO"; id: string; sinTexto: boolean }
  | { tipo: "DUPLICADO"; duplicados: CvDuplicado[] }
  | { tipo: "CANCELADO" }
  | { tipo: "ERROR"; motivo: string };

type Fila = { clave: string; archivo: File; estado: Estado };

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

async function enviar(archivo: File, forzar: boolean): Promise<Estado> {
  if (archivo.size > TAMANO_MAXIMO) return { tipo: "ERROR", motivo: "El archivo supera 10 MB." };
  const datos = new FormData();
  datos.append("archivo", archivo);
  if (forzar) datos.append("forzar", "1");
  try {
    const respuesta = await fetch("/api/cvs", { method: "POST", body: datos });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as
      | ResultadoCarga
      | { estado?: undefined; error?: string };
    if (respuesta.status === 401) return { tipo: "ERROR", motivo: "Tu sesión expiró. Vuelve a iniciar sesión." };
    if (cuerpo.estado === "GUARDADO") return { tipo: "LISTO", id: cuerpo.id, sinTexto: cuerpo.sinTexto };
    if (cuerpo.estado === "DUPLICADO") return { tipo: "DUPLICADO", duplicados: cuerpo.duplicados };
    return { tipo: "ERROR", motivo: ("error" in cuerpo && cuerpo.error) || "No se pudo subir el archivo." };
  } catch {
    return { tipo: "ERROR", motivo: "Sin conexión con el servidor." };
  }
}

export function CargaCvs({ vacante }: { vacante: { id: string; titulo: string } | null }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const procesando = useRef(false);
  const cola = useRef<{ clave: string; forzar: boolean }[]>([]);
  const archivos = useRef(new Map<string, File>());

  function actualizar(clave: string, estado: Estado) {
    setFilas((previas) => previas.map((f) => (f.clave === clave ? { ...f, estado } : f)));
  }

  async function procesarCola() {
    if (procesando.current) return;
    procesando.current = true;
    while (cola.current.length > 0) {
      const { clave, forzar } = cola.current.shift()!;
      const archivo = archivos.current.get(clave);
      if (!archivo) continue;
      actualizar(clave, { tipo: "PROCESANDO" });
      actualizar(clave, await enviar(archivo, forzar));
    }
    procesando.current = false;
  }

  function encolar(clave: string, forzar = false) {
    actualizar(clave, { tipo: "EN_COLA" });
    cola.current.push({ clave, forzar });
    void procesarCola();
  }

  function alSeleccionar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    let seleccion = Array.from(lista);
    setAviso(null);
    if (seleccion.length > MAX_ARCHIVOS) {
      setAviso(`Solo se pueden subir ${MAX_ARCHIVOS} archivos a la vez. Se tomaron los primeros ${MAX_ARCHIVOS}.`);
      seleccion = seleccion.slice(0, MAX_ARCHIVOS);
    }
    const nuevas = seleccion.map((archivo) => ({
      clave: crypto.randomUUID(),
      archivo,
      estado: { tipo: "EN_COLA" } as Estado,
    }));
    nuevas.forEach((f) => archivos.current.set(f.clave, f.archivo));
    setFilas((previas) => [...nuevas, ...previas]);
    nuevas.forEach((f) => {
      cola.current.push({ clave: f.clave, forzar: false });
    });
    void procesarCola();
    if (entrada.current) entrada.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div className={`${tarjeta} space-y-3`}>
        {vacante && (
          <p className="text-sm text-slate-800">
            Vacante: <span className="font-semibold">{vacante.titulo}</span>
          </p>
        )}
        <label htmlFor="archivos" className="block text-sm font-semibold text-slate-800">
          Selecciona los CVs
        </label>
        <input
          ref={entrada}
          id="archivos"
          type="file"
          multiple
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => alSeleccionar(e.target.files)}
          aria-describedby="ayuda-archivos"
          className="block text-sm file:mr-4 file:rounded-md file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-blue-800"
        />
        <p id="ayuda-archivos" className={ayuda}>
          PDF o DOCX, máximo 10 MB cada uno y hasta {MAX_ARCHIVOS} archivos a la vez. La carga
          inicia en cuanto los seleccionas.
        </p>
        {aviso && (
          <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {aviso}
          </p>
        )}
      </div>

      {filas.length > 0 && (
        <div className={`${tarjeta} overflow-x-auto p-0`}>
          <table className={tabla}>
            <caption className="sr-only">Estado de la carga por archivo</caption>
            <thead>
              <tr>
                <th scope="col" className={celdaEncabezado}>Archivo</th>
                <th scope="col" className={celdaEncabezado}>Estado</th>
                <th scope="col" className={celdaEncabezado}>Detalle</th>
              </tr>
            </thead>
            <tbody aria-live="polite">
              {filas.map((f) => (
                <tr key={f.clave}>
                  <td className={`${celda} max-w-xs break-words`}>{f.archivo.name}</td>
                  <td className={celda}>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR[f.estado.tipo]}`}>
                      {ETIQUETA[f.estado.tipo]}
                    </span>
                  </td>
                  <td className={`${celda} space-y-2`}>
                    <DetalleFila fila={f} encolar={encolar} cancelar={(c) => actualizar(c, { tipo: "CANCELADO" })} />
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
  encolar,
  cancelar,
}: {
  fila: Fila;
  encolar: (clave: string, forzar?: boolean) => void;
  cancelar: (clave: string) => void;
}) {
  const { estado, clave } = fila;
  switch (estado.tipo) {
    case "LISTO":
      return (
        <div className="space-y-1">
          {estado.sinTexto && (
            <p className="text-amber-900">Sin texto legible (posible PDF escaneado). No se podrá analizar.</p>
          )}
          <Link href={`/cvs/${estado.id}`} className={boton.enlace}>Ver CV</Link>
        </div>
      );
    case "DUPLICADO":
      return (
        <div className="space-y-2">
          <p>Ya existe un CV que coincide:</p>
          <ul className="list-disc pl-5">
            {estado.duplicados.map((d) => (
              <li key={d.id}>
                <Link href={`/cvs/${d.id}`} className={boton.enlace} target="_blank">{d.nombre}</Link>{" "}
                — subido por {d.subidoPor} el {formatearFecha(d.creadoEn)} (coincide{" "}
                {d.coincidencia === "texto" ? "el contenido" : "el correo del candidato"})
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" className={boton.secundario} onClick={() => cancelar(clave)}>Cancelar</button>
            <button type="button" className={boton.primario} onClick={() => encolar(clave, true)}>
              Guardar de todos modos
            </button>
          </div>
        </div>
      );
    case "ERROR":
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-red-800">{estado.motivo}</span>
          <button type="button" className={boton.secundario} onClick={() => encolar(clave)}>Reintentar</button>
        </div>
      );
    default:
      return null;
  }
}
