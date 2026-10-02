import { describe, expect, it } from "vitest";
import { calcularCategoria, categoriaMostrada } from "@/lib/analizador/categoria";
import { calificar, puntajeEstudios, puntajeExperiencia, puntajeIdioma } from "@/lib/analizador/puntaje";
import type { ResultadoVerificado } from "@/lib/analizador/tipos";
import { esquemaUmbrales, UMBRALES_POR_DEFECTO } from "@/lib/umbrales/servicio";

function resultado(parcial: {
  obligatorios: (0 | 1 | 2)[];
  deseables?: (0 | 1 | 2)[];
  anios: number;
  minimo: number;
  estudios?: ResultadoVerificado["estudios"];
  idiomas?: ResultadoVerificado["idiomas"];
}): ResultadoVerificado {
  return {
    nombreCandidato: null,
    requisitos: [
      ...parcial.obligatorios.map((nivel, i) => ({
        id: `O${i + 1}`, tipo: "OBLIGATORIO" as const, texto: ["SQL", "Excel avanzado", "Power BI"][i] ?? `Obligatorio ${i + 1}`,
        nivel, cita: nivel ? "cita" : null, citaNoVerificada: false,
      })),
      ...(parcial.deseables ?? []).map((nivel, i) => ({
        id: `D${i + 1}`, tipo: "DESEABLE" as const, texto: `Deseable ${i + 1}`, nivel, cita: nivel ? "cita" : null, citaNoVerificada: false,
      })),
    ],
    experiencia: { anios: parcial.anios, meses: Math.round(parcial.anios * 12), minimo: parcial.minimo, puestos: [], puestosDescartados: 0, fechaAnalisis: "2026-10-02" },
    estudios: parcial.estudios ?? { requerido: "LICENCIATURA", encontrado: "LICENCIATURA", estatus: "TITULADO", cita: "Licenciatura" },
    idiomas: parcial.idiomas ?? [],
    cualidades: [],
    cualidadesDescartadas: 0,
    brechas: [],
    preguntas: [],
  };
}

describe("Fórmula E (experiencia)", () => {
  it.each([
    [2, 2, 70],
    [3, 2, 85],
    [4, 2, 100],
    [10, 2, 100], // tope en 100
    [1, 2, 0], // años < mínimo → E = 0
    [0, 0, 70],
    [0.5, 0, 85], // máx(mínimo, 1) evita dividir entre 0
    [2, 0, 100],
    [0, 5, 0], // años < mínimo → E = 0
  ])("años=%s, mínimo=%s → %s", (anios, minimo, esperado) => {
    expect(puntajeExperiencia(anios, minimo)).toBeCloseTo(esperado, 6);
  });
});

describe("Fórmula F (formación e idiomas)", () => {
  it("estudios: cumple o supera = 100; inferior o no especificado = 0", () => {
    expect(puntajeEstudios("LICENCIATURA", "LICENCIATURA")).toBe(100);
    expect(puntajeEstudios("LICENCIATURA", "MAESTRIA")).toBe(100);
    expect(puntajeEstudios("LICENCIATURA", "TECNICO")).toBe(0);
    expect(puntajeEstudios("LICENCIATURA", "NO_ESPECIFICADO")).toBe(0);
    expect(puntajeEstudios("NINGUNO", "NO_ESPECIFICADO")).toBe(100);
  });

  it("idioma: cumple = 100; un nivel abajo = 50; más abajo o no especificado = 0", () => {
    expect(puntajeIdioma("INTERMEDIO", "NATIVO")).toBe(100);
    expect(puntajeIdioma("INTERMEDIO", "INTERMEDIO")).toBe(100);
    expect(puntajeIdioma("INTERMEDIO", "BASICO")).toBe(50);
    expect(puntajeIdioma("AVANZADO", "BASICO")).toBe(0);
    expect(puntajeIdioma("BASICO", "NO_ESPECIFICADO")).toBe(0);
  });

  it("F es el promedio de estudios y cada idioma", () => {
    const c = calificar(resultado({
      obligatorios: [2], anios: 2, minimo: 2,
      idiomas: [
        { idioma: "Inglés", requerido: "INTERMEDIO", encontrado: "BASICO", cita: "x" },
        { idioma: "Francés", requerido: "BASICO", encontrado: "NO_ESPECIFICADO", cita: null },
      ],
    }));
    expect(c.F).toBeCloseTo((100 + 50 + 0) / 3, 6);
  });
});

describe("Puntaje total, O y D", () => {
  it("valores por nivel 0/60/100 y ponderación 40/25/20/15 (calculado a mano: 73)", () => {
    // O = (100 + 60)/2 = 80; D = (100 + 0)/2 = 50; E(3,2) = 85; F = (100 + 50)/2 = 75
    // 0.40·80 + 0.25·50 + 0.20·85 + 0.15·75 = 32 + 12.5 + 17 + 11.25 = 72.75 → 73
    const c = calificar(resultado({
      obligatorios: [2, 1], deseables: [2, 0], anios: 3, minimo: 2,
      idiomas: [{ idioma: "Inglés", requerido: "INTERMEDIO", encontrado: "BASICO", cita: "x" }],
    }));
    expect([c.O, c.D, c.E, c.F]).toEqual([80, 50, 85, 75]);
    expect(c.puntaje).toBe(73);
    expect(c.veredicto).toBe("VIABLE");
  });

  it("sin deseables, el 25 % se reparte proporcionalmente (calculado a mano: 80)", () => {
    // (0.40·80 + 0.20·85 + 0.15·75) / 0.75 = 60.25 / 0.75 = 80.33 → 80
    const c = calificar(resultado({
      obligatorios: [2, 1], anios: 3, minimo: 2,
      idiomas: [{ idioma: "Inglés", requerido: "INTERMEDIO", encontrado: "BASICO", cita: "x" }],
    }));
    expect(c.D).toBeNull();
    expect(c.pesos.O + c.pesos.E + c.pesos.F).toBeCloseTo(1, 10);
    expect(c.pesos.O).toBeCloseTo(0.4 / 0.75, 10);
    expect(c.pesos.E).toBeCloseTo(0.2 / 0.75, 10);
    expect(c.pesos.F).toBeCloseTo(0.15 / 0.75, 10);
    expect(c.puntaje).toBe(80);
  });

  it("perfil completo da 100", () => {
    expect(calificar(resultado({ obligatorios: [2, 2], deseables: [2], anios: 5, minimo: 2 })).puntaje).toBe(100);
  });
});

describe("Veredicto NO VIABLE", () => {
  it("si algún requisito obligatorio queda en nivel 0, con el motivo verificable", () => {
    const c = calificar(resultado({ obligatorios: [2, 0, 2], deseables: [2], anios: 5, minimo: 2 }));
    expect(c.veredicto).toBe("NO_VIABLE");
    expect(c.motivosNoViable).toEqual(["No se encontró evidencia de: Excel avanzado"]);
    expect(calcularCategoria(c.veredicto, c.puntaje, UMBRALES_POR_DEFECTO)).toBe("NO_VIABLE");
  });

  it("si los años relevantes son menores al mínimo", () => {
    const c = calificar(resultado({ obligatorios: [2], anios: 1.5, minimo: 2 }));
    expect(c.veredicto).toBe("NO_VIABLE");
    expect(c.motivosNoViable).toEqual([
      "Experiencia relevante: 1.5 años; mínimo requerido: 2",
    ]);
  });

  it("si es viable pero el puntaje queda bajo PASABLE, la categoría es NO VIABLE", () => {
    // O = 60; E(2,2) = 70; F = 0 → (0.4·60 + 0.2·70 + 0) / 0.75 = 38 / 0.75 = 50.67 → 51
    const c = calificar(resultado({
      obligatorios: [1], anios: 2, minimo: 2,
      estudios: { requerido: "LICENCIATURA", encontrado: "NO_ESPECIFICADO", estatus: "NO_ESPECIFICADO", cita: null },
    }));
    expect(c.veredicto).toBe("VIABLE");
    expect(c.puntaje).toBe(51);
    expect(calcularCategoria(c.veredicto, c.puntaje, UMBRALES_POR_DEFECTO)).toBe("NO_VIABLE");
  });
});

describe("Categoría y umbrales", () => {
  it.each([
    [100, "EXCELENTE"], [85, "EXCELENTE"], [84, "BUENO"], [70, "BUENO"],
    [69, "PASABLE"], [55, "PASABLE"], [54, "NO_VIABLE"], [0, "NO_VIABLE"],
  ])("puntaje %s → %s con umbrales por defecto", (puntaje, categoria) => {
    expect(calcularCategoria("VIABLE", puntaje, UMBRALES_POR_DEFECTO)).toBe(categoria);
  });

  it("se calcula con los umbrales vigentes al mostrarla", () => {
    expect(calcularCategoria("VIABLE", 80, { excelente: 80, bueno: 60, pasable: 40 })).toBe("EXCELENTE");
  });

  it("la categoría ajustada manualmente prevalece y conserva la calculada", () => {
    const m = categoriaMostrada({ veredicto: "VIABLE", puntaje: 72 }, UMBRALES_POR_DEFECTO, {
      categoria: "EXCELENTE", comentario: "Referencias excelentes", autor: "Reclutadora Ficticia", creadoEn: new Date(),
    });
    expect(m).toMatchObject({ calculada: "BUENO", final: "EXCELENTE", ajustadaPor: "Reclutadora Ficticia" });
  });

  it("distingue NO VIABLE por requisito y por puntaje", () => {
    expect(categoriaMostrada({ veredicto: "NO_VIABLE", puntaje: 81 }, UMBRALES_POR_DEFECTO, null).causaNoViable).toBe("REQUISITO");
    expect(categoriaMostrada({ veredicto: "VIABLE", puntaje: 49 }, UMBRALES_POR_DEFECTO, null).causaNoViable).toBe("PUNTAJE");
    expect(categoriaMostrada({ veredicto: "VIABLE", puntaje: 60 }, UMBRALES_POR_DEFECTO, null).causaNoViable).toBeNull();
  });

  it("valida enteros con EXCELENTE > BUENO > PASABLE ≥ 1", () => {
    expect(esquemaUmbrales.safeParse({ excelente: 85, bueno: 70, pasable: 55 }).success).toBe(true);
    expect(esquemaUmbrales.safeParse({ excelente: "90", bueno: "70", pasable: "1" }).success).toBe(true);
    for (const malo of [
      { excelente: 70, bueno: 70, pasable: 55 },
      { excelente: 85, bueno: 50, pasable: 55 },
      { excelente: 85, bueno: 70, pasable: 0 },
      { excelente: 85.5, bueno: 70, pasable: 55 },
      { excelente: 101, bueno: 70, pasable: 55 },
      { excelente: "", bueno: 70, pasable: 55 },
    ]) {
      expect(esquemaUmbrales.safeParse(malo).success, JSON.stringify(malo)).toBe(false);
    }
  });
});
