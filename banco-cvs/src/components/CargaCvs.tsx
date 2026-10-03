"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { analizarCvAccion } from "@/acciones/analisis";
import type { CvDuplicado, ResultadoCarga } from "@/lib/archivos/servicio";
import { errorTransitorio } from "@/lib/errores";
import { ayuda, boton, campo, celda, celdaEncabezado, etiqueta, tabla, tarjeta, tarjetaTabla } from "./estilos";
import { formatearFecha } from "./Fecha";

const MAX_ARCHIVOS = 20;
const MAX_SIMULTANEOS = 3;
const TAMANO_MAXIMO = 10 * 1024 * 1024;

type Estado =
  | { tipo: "EN_COLA" }
  | { tipo: "PROCESANDO"; paso: "Subiendo" | "Analizando" }
  | { tipo: "LISTO"; cvId: string; analisisId?: string }
  | { tipo: "SIN_TEXTO"; cvId: string }
  | { tipo: "SIN_IA"; cvId: string; heredada: boolean }
  | { tipo: "DUPLICADO"; duplicados: CvDuplicado[] }
  | { tipo: "CANCELADO" }
  // reintentable: false si reintentar no cambia nada (formato, tamaño, archivo vacío o dañado).
  | { tipo: "ERROR"; motivo: string; cvId?: string; reintentable: boolean };

type Fila = { clave: string; archivo: File; estado: Estado; vacante: { id: string; titulo: string } | null };
type Tarea = { clave: string; forzar: boolean; cvId?: string };

const ETIQUETA: Record<Estado["tipo"], string> = {
  EN_COLA: "En cola",
  PROCESANDO: "Procesando",
  LISTO: "Listo",
  SIN_TEXTO: "Guardado sin analizar",
  SIN_IA: "Guardado sin analizar",
  DUPLICADO: "Posible duplicado",
  CANCELADO: "Cancelado",
  ERROR: "Error",
};

const COLOR: Record<Estado["tipo"], string> = {
  EN_COLA: "bg-slate-100 text-slate-800",
  PROCESANDO: "bg-blue-100 text-blue-900",
  LISTO: "bg-green-100 text-green-900",
  SIN_TEXTO: "bg-amber-100 text-amber-900",
  SIN_IA: "bg-slate-100 text-slate-800",
  DUPLICADO: "bg-amber-100 text-amber-900",
  CANCELADO: "bg-slate-100 text-slate-800",
  ERROR: "bg-red-100 text-red-900",
};

async function subir(
  archivo: File,
  forzar: boolean,
  sinAnalisisIA: boolean,
): Promise<Estado | { tipo: "SUBIDO"; cvId: string; sinTexto: boolean; sinAnalisisIA: boolean }> {
  if (archivo.size > TAMANO_MAXIMO) return { tipo: "ERROR", motivo: "El archivo supera 10 MB.", reintentable: false };
  const datos = new FormData();
  datos.append("archivo", archivo);
  if (forzar) datos.append("forzar", "1");
  if (sinAnalisisIA) datos.append("sinAnalisisIA", "1");
  try {
    const respuesta = await fetch("/api/cvs", { method: "POST", body: datos });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as ResultadoCarga | { estado?: undefined; error?: string };
    if (respuesta.status === 401) {
      return { tipo: "ERROR", motivo: "Tu sesión expiró. Inicia sesión en otra pestaña y usa «Reintentar».", reintentable: true };
    }
    if (cuerpo.estado === "GUARDADO") {
      return { tipo: "SUBIDO", cvId: cuerpo.id, sinTexto: cuerpo.sinTexto, sinAnalisisIA: cuerpo.sinAnalisisIA };
    }
    if (cuerpo.estado === "DUPLICADO") return { tipo: "DUPLICADO", duplicados: cuerpo.duplicados };
    return {
      tipo: "ERROR",
      motivo: ("error" in cuerpo && cuerpo.error) || "No se pudo subir el archivo.",
      reintentable: errorTransitorio(respuesta.status),
    };
  } catch {
    return { tipo: "ERROR", motivo: "Sin conexión con el servidor.", reintentable: true };
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
  // El candidato se opuso al análisis con IA: se guarda con la oposición registrada y sin analizar.
  const [oposicionIA, setOposicionIA] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const cola = useRef<Tarea[]>([]);
  const activos = useRef(0);
  const archivos = useRef(new Map<string, File>());
  // Vacante de cada archivo, fijada al seleccionarlo: «Reintentar» usa siempre la misma.
  const vacantePorArchivo = useRef(new Map<string, string>());
  const oposicionPorArchivo = useRef(new Map<string, boolean>());

  function actualizar(clave: string, estado: Estado) {
    setFilas((previas) => previas.map((f) => (f.clave === clave ? { ...f, estado } : f)));
  }

  async function procesar(tarea: Tarea) {
    const archivo = archivos.current.get(tarea.clave)!;
    const vacante = vacantePorArchivo.current.get(tarea.clave) ?? "";
    let cvId = tarea.cvId;
    let sinTexto = false;
    let sinAnalisisIA = false;
    if (!cvId) {
      actualizar(tarea.clave, { tipo: "PROCESANDO", paso: "Subiendo" });
      const subida = await subir(archivo, tarea.forzar, oposicionPorArchivo.current.get(tarea.clave) === true);
      if (subida.tipo !== "SUBIDO") return actualizar(tarea.clave, subida);
      cvId = subida.cvId;
      sinTexto = subida.sinTexto;
      sinAnalisisIA = subida.sinAnalisisIA;
    }
    if (sinTexto) return actualizar(tarea.clave, { tipo: "SIN_TEXTO", cvId });
    if (sinAnalisisIA) {
      // Con oposición registrada (marcada ahora o heredada de otro CV del mismo candidato) no se analiza.
      const heredada = oposicionPorArchivo.current.get(tarea.clave) !== true;
      return actualizar(tarea.clave, { tipo: "SIN_IA", cvId, heredada });
    }
    if (!vacante) return actualizar(tarea.clave, { tipo: "LISTO", cvId });
    actualizar(tarea.clave, { tipo: "PROCESANDO", paso: "Analizando" });
    try {
      const r = await analizarCvAccion(cvId, vacante);
      // Los errores del análisis (IA saturada, sin respuesta, sesión) se pueden reintentar sin volver a subir el archivo.
      actualizar(tarea.clave, r.ok ? { tipo: "LISTO", cvId, analisisId: r.datos.id } : { tipo: "ERROR", motivo: r.error, cvId, reintentable: true });
    } catch {
      actualizar(tarea.clave, { tipo: "ERROR", motivo: "Sin conexión con el servidor.", cvId, reintentable: true });
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
    const vacante = oposicionIA ? null : (vacantes.find((v) => v.id === vacanteId) ?? null);
    const nuevas: Fila[] = seleccion.map((archivo) => ({ clave: crypto.randomUUID(), archivo, estado: { tipo: "EN_COLA" }, vacante }));
    nuevas.forEach((f) => {
      archivos.current.set(f.clave, f.archivo);
      vacantePorArchivo.current.set(f.clave, vacante?.id ?? "");
      oposicionPorArchivo.current.set(f.clave, oposicionIA);
    });
    setFilas((previas) => [...nuevas, ...previas]);
    nuevas.forEach((f) => cola.current.push({ clave: f.clave, forzar: false }));
    siguiente();
    if (entrada.current) entrada.current.value = "";
    // La oposición vale solo para este lote (queda fijada por archivo): el siguiente lote empieza sin marcar.
    setOposicionIA(false);
  }

  const pendientes = filas.filter((f) => f.estado.tipo === "EN_COLA" || f.estado.tipo === "PROCESANDO").length;
  const cuenta = (tipo: Estado["tipo"]) => filas.filter((f) => f.estado.tipo === tipo).length;
  const resumen = [
    `${cuenta("LISTO")} listo${cuenta("LISTO") === 1 ? "" : "s"}`,
    ...(cuenta("ERROR") ? [`${cuenta("ERROR")} con error`] : []),
    ...(cuenta("DUPLICADO") ? [`${cuenta("DUPLICADO")} posible${cuenta("DUPLICADO") === 1 ? "" : "s"} duplicado${cuenta("DUPLICADO") === 1 ? "" : "s"} (elige qué hacer)`] : []),
    ...(cuenta("SIN_TEXTO") ? [`${cuenta("SIN_TEXTO")} sin texto legible`] : []),
    ...(cuenta("CANCELADO") ? [`${cuenta("CANCELADO")} cancelado${cuenta("CANCELADO") === 1 ? "" : "s"}`] : []),
  ].join(", ");

  // Evita perder en silencio los archivos que siguen en cola al cerrar o recargar la página.
  useEffect(() => {
    if (pendientes === 0) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [pendientes]);

  return (
    <div className="space-y-6">
      <div className={`${tarjeta} space-y-4`}>
        <div className="max-w-xl">
          <label htmlFor="vacante" className={etiqueta}>Analizar contra la vacante</label>
          <select
            id="vacante"
            value={oposicionIA ? "" : vacanteId}
            onChange={(e) => setVacanteId(e.target.value)}
            className={campo}
            disabled={pendientes > 0 || oposicionIA}
          >
            <option value="">Solo guardar en el repositorio (sin analizar)</option>
            {vacantes.map((v) => (
              <option key={v.id} value={v.id}>{v.titulo}</option>
            ))}
          </select>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={oposicionIA}
              onChange={(e) => setOposicionIA(e.target.checked)}
              disabled={pendientes > 0}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              El candidato se opuso al análisis con IA <span className="text-slate-700">(se guarda sin analizar y no se podrá analizar)</span>
            </span>
          </label>
        </div>

        <div>
          <span className={etiqueta} id="etiqueta-archivos">Archivos</span>
          {/* Botón propio en español; el control nativo queda accesible para teclado y lectores de pantalla. */}
          <label
            className={`${boton.primario} mt-1 focus-within:outline focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-blue-700 ${
              pendientes > 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
          >
            Seleccionar CVs
            <input
              ref={entrada}
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => alSeleccionar(e.target.files)}
              disabled={pendientes > 0}
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
        {pendientes > 0 && (
          <p role="status" className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
            No cierres ni recargues esta página hasta que termine la cola. Podrás agregar más archivos al terminar.
          </p>
        )}
        {aviso && (
          <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>
        )}
      </div>

      {filas.length > 0 && (
        <div className={`${tarjetaTabla}`}>
          <p className="px-4 pt-4 text-sm font-semibold text-slate-800" aria-live="polite">
            {pendientes > 0 ? `Procesando: faltan ${pendientes} de ${filas.length}. ${resumen}.` : `Terminado: ${resumen}.`}
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
                  <td className={`${celda} max-w-xs break-words`}>
                    {f.archivo.name}
                    <span className="block text-xs text-slate-600">{f.vacante ? `Vacante: ${f.vacante.titulo}` : "Solo repositorio"}</span>
                  </td>
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
    case "SIN_IA":
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span>
            {estado.heredada
              ? "El candidato ya se había opuesto al análisis con IA: se guardó sin analizar."
              : "Se guardó con la oposición al análisis con IA registrada."}
          </span>
          <Link href={`/cvs/${estado.cvId}`} className={boton.enlace}>Ver CV</Link>
        </div>
      );
    case "SIN_TEXTO":
      return (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-amber-900">Sin texto legible (posible PDF escaneado): se guardó, pero no se puede analizar.</span>
          <Link href={`/cvs/${estado.cvId}`} className={boton.enlace}>Ver CV</Link>
        </div>
      );
    case "LISTO":
      return (
        <div className="flex flex-wrap items-center gap-3">
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
          {estado.reintentable ? (
            <button type="button" className={boton.secundario} onClick={() => reintentar({ clave, forzar: false, cvId: estado.cvId })}>
              Reintentar
            </button>
          ) : (
            <span className="text-slate-700">Revisa el archivo y vuelve a seleccionarlo.</span>
          )}
        </div>
      );
    default:
      return null;
  }
}
