"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { ResultadoAccion } from "@/lib/acciones";
import {
  ETIQUETA_ESTUDIO,
  ETIQUETA_IDIOMA,
  ETIQUETA_MODALIDAD,
  MODALIDADES,
  NIVELES_ESTUDIO,
  NIVELES_IDIOMA,
} from "@/lib/catalogos";
import { Aviso } from "./Aviso";
import { ayuda, boton, campo, etiqueta, tarjeta } from "./estilos";

export type ValoresVacante = {
  titulo: string;
  area: string;
  descripcion: string;
  requisitosObligatorios: string;
  requisitosDeseables: string;
  aniosMinimos: number;
  nivelEstudiosMinimo: string;
  idiomas: { idioma: string; nivel: string }[];
  modalidad: string;
  ubicacion: string;
};

const VACIA: ValoresVacante = {
  titulo: "",
  area: "",
  descripcion: "",
  requisitosObligatorios: "",
  requisitosDeseables: "",
  aniosMinimos: 0,
  nivelEstudiosMinimo: "LICENCIATURA",
  idiomas: [],
  modalidad: "HIBRIDO",
  ubicacion: "",
};

type Accion = (previo: unknown, formData: FormData) => Promise<ResultadoAccion<{ id: string }>>;

export function FormularioVacante({
  accion,
  valores = VACIA,
  textoBoton,
  aviso,
}: {
  accion: Accion;
  valores?: ValoresVacante;
  textoBoton: string;
  aviso?: string;
}) {
  const router = useRouter();
  const [estado, enviar, pendiente] = useActionState(accion, undefined);
  const [idiomas, setIdiomas] = useState(
    valores.idiomas.length ? valores.idiomas : [],
  );

  useEffect(() => {
    if (estado?.ok) router.push(`/vacantes/${estado.datos.id}`);
  }, [estado, router]);

  return (
    <form action={enviar} className={`${tarjeta} space-y-5`}>
      {aviso && <Aviso tipo="info">{aviso}</Aviso>}
      {estado && !estado.ok && <Aviso tipo="error">{estado.error}</Aviso>}

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="titulo" className={etiqueta}>Título de la vacante</label>
          <input id="titulo" name="titulo" required defaultValue={valores.titulo} className={campo} />
        </div>
        <div>
          <label htmlFor="area" className={etiqueta}>Área</label>
          <input id="area" name="area" required defaultValue={valores.area} className={campo} placeholder="Ej. Finanzas, Operaciones, TI" />
        </div>
      </div>

      <div>
        <label htmlFor="descripcion" className={etiqueta}>Descripción del puesto</label>
        <textarea id="descripcion" name="descripcion" rows={4} required defaultValue={valores.descripcion} className={campo} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="requisitosObligatorios" className={etiqueta}>Requisitos obligatorios</label>
          <textarea
            id="requisitosObligatorios"
            name="requisitosObligatorios"
            rows={6}
            required
            defaultValue={valores.requisitosObligatorios}
            aria-describedby="ayuda-obligatorios"
            className={campo}
          />
          <p id="ayuda-obligatorios" className={ayuda}>
            Uno por renglón. Si el CV no muestra evidencia de alguno, el candidato será NO VIABLE.
            Escríbelos de forma verificable (ej. &quot;Excel avanzado: tablas dinámicas&quot;). No
            incluyas edad, género, estado civil, apariencia, religión, nacionalidad ni domicilio.
          </p>
        </div>
        <div>
          <label htmlFor="requisitosDeseables" className={etiqueta}>Requisitos deseables (opcional)</label>
          <textarea
            id="requisitosDeseables"
            name="requisitosDeseables"
            rows={6}
            defaultValue={valores.requisitosDeseables}
            aria-describedby="ayuda-deseables"
            className={campo}
          />
          <p id="ayuda-deseables" className={ayuda}>Uno por renglón. Suman puntaje, pero no descartan.</p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <label htmlFor="aniosMinimos" className={etiqueta}>Años mínimos de experiencia relevante</label>
          <input id="aniosMinimos" name="aniosMinimos" type="number" min={0} max={40} required defaultValue={valores.aniosMinimos} className={campo} />
        </div>
        <div>
          <label htmlFor="nivelEstudiosMinimo" className={etiqueta}>Nivel de estudios mínimo</label>
          <select id="nivelEstudiosMinimo" name="nivelEstudiosMinimo" defaultValue={valores.nivelEstudiosMinimo} className={campo}>
            {NIVELES_ESTUDIO.map((n) => (
              <option key={n} value={n}>{ETIQUETA_ESTUDIO[n]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="modalidad" className={etiqueta}>Modalidad</label>
          <select id="modalidad" name="modalidad" defaultValue={valores.modalidad} className={campo}>
            {MODALIDADES.map((m) => (
              <option key={m} value={m}>{ETIQUETA_MODALIDAD[m]}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="ubicacion" className={etiqueta}>Ubicación</label>
        <input id="ubicacion" name="ubicacion" required defaultValue={valores.ubicacion} className={campo} placeholder="Ej. Ciudad de México (Polanco)" />
      </div>

      <fieldset className="space-y-3">
        <legend className={etiqueta}>Idiomas requeridos (opcional)</legend>
        {idiomas.length === 0 && <p className={ayuda}>Sin idiomas requeridos.</p>}
        {idiomas.map((fila, i) => (
          <div key={i} className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor={`idioma_${i}`} className="text-xs font-semibold text-slate-700">Idioma</label>
              <input
                id={`idioma_${i}`}
                name={`idioma_${i}`}
                value={fila.idioma}
                onChange={(e) => setIdiomas(idiomas.map((f, j) => (j === i ? { ...f, idioma: e.target.value } : f)))}
                className={campo}
              />
            </div>
            <div>
              <label htmlFor={`nivelIdioma_${i}`} className="text-xs font-semibold text-slate-700">Nivel mínimo</label>
              <select
                id={`nivelIdioma_${i}`}
                name={`nivelIdioma_${i}`}
                value={fila.nivel}
                onChange={(e) => setIdiomas(idiomas.map((f, j) => (j === i ? { ...f, nivel: e.target.value } : f)))}
                className={campo}
              >
                {NIVELES_IDIOMA.map((n) => (
                  <option key={n} value={n}>{ETIQUETA_IDIOMA[n]}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={boton.secundario}
              onClick={() => setIdiomas(idiomas.filter((_, j) => j !== i))}
              aria-label={`Quitar idioma ${fila.idioma || i + 1}`}
            >
              Quitar
            </button>
          </div>
        ))}
        {idiomas.length < 5 && (
          <button
            type="button"
            className={boton.secundario}
            onClick={() => setIdiomas([...idiomas, { idioma: "", nivel: "INTERMEDIO" }])}
          >
            Agregar idioma
          </button>
        )}
      </fieldset>

      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <button type="submit" className={boton.primario} disabled={pendiente}>
          {pendiente ? "Guardando…" : textoBoton}
        </button>
      </div>
    </form>
  );
}
