import { beforeAll, describe, expect, it } from "vitest";
import { purgarCvsVencidos } from "@/lib/archivos/conservacion";
import { subirCv } from "@/lib/archivos/servicio";
import { ajustarCategoria } from "@/lib/analisis/ajustes";
import { db } from "@/lib/db";
import { eliminarCv } from "@/lib/archivos/servicio";
import { celdaCsv, historialACsv, registrosDelHistorial, resumirHistorial } from "@/lib/historial";
import { crearPdf, crearUsuario, textoCv } from "./ayuda";

let usuario: Awaited<ReturnType<typeof crearUsuario>>;
const DIA = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  usuario = await crearUsuario();
});

let n = 0;
async function registro(datos: {
  cvId: string; vacanteId: string; area: string; categoriaFinal: string; fecha?: Date; ajustada?: boolean;
  categoria?: string; motivoAjuste?: string; horasHastaAjuste?: number; fechaAjuste?: Date;
}) {
  n += 1;
  return db.registroAnalisis.create({
    data: {
      analisisId: `a${n}-${Math.random()}`,
      cvId: datos.cvId,
      vacanteId: datos.vacanteId,
      vacanteTitulo: `Vacante ${datos.vacanteId}`,
      area: datos.area,
      fecha: datos.fecha ?? new Date(),
      veredicto: datos.categoriaFinal === "NO_VIABLE" ? "NO_VIABLE" : "VIABLE",
      puntaje: 70,
      categoria: datos.categoria ?? datos.categoriaFinal,
      categoriaFinal: datos.categoriaFinal,
      ajustada: datos.ajustada ?? false,
      motivoAjuste: datos.motivoAjuste,
      horasHastaAjuste: datos.horasHastaAjuste,
      fechaAjuste: datos.fechaAjuste,
      modelo: "groq:m",
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
    },
  });
}

describe("Historial segmentado por CVs, área y categoría", () => {
  it("cuenta CVs distintos, análisis y categorías por área y vacante; el re-análisis no duplica al CV", async () => {
    const ayer = new Date(Date.now() - DIA);
    await registro({ cvId: "cv1", vacanteId: "v1", area: "Datos", categoriaFinal: "PASABLE", fecha: ayer });
    await registro({ cvId: "cv1", vacanteId: "v1", area: "Datos", categoriaFinal: "BUENO" }); // re-análisis: vigente
    await registro({ cvId: "cv2", vacanteId: "v1", area: "Datos", categoriaFinal: "NO_VIABLE" });
    await registro({ cvId: "cv3", vacanteId: "v2", area: "Ventas", categoriaFinal: "EXCELENTE", ajustada: true });
    await registro({ cvId: "cv1", vacanteId: "v2", area: "Ventas", categoriaFinal: "REVISION" });

    const r = resumirHistorial(await registrosDelHistorial());
    expect(r.total.cvs).toBe(3);
    expect(r.total.resultados).toBe(4);
    expect(r.total.analisis).toBe(5);
    expect(r.pendientesRevision).toBe(1);
    expect(r.cambiosManuales).toEqual([{ de: "EXCELENTE", a: "EXCELENTE", cantidad: 1 }]);
    expect(r.total.porCategoria).toMatchObject({ EXCELENTE: 1, BUENO: 1, PASABLE: 0, REVISION: 1, NO_VIABLE: 1 });
    expect(r.ajustadas).toBe(1);
    const datos = r.porArea.find((a) => a.etiqueta === "Datos")!;
    expect(datos).toMatchObject({ cvs: 2, analisis: 3 });
    expect(datos.porCategoria).toMatchObject({ BUENO: 1, NO_VIABLE: 1, PASABLE: 0 });
    expect(r.porArea.find((a) => a.etiqueta === "Ventas")).toMatchObject({ cvs: 2, analisis: 2 });

    const soloVentas = resumirHistorial(await registrosDelHistorial({ area: "Ventas" }));
    expect(soloVentas.total.cvs).toBe(2);
  });

  it("el CSV no incluye datos de candidatos ni ids, usa etiquetas en español y neutraliza fórmulas", async () => {
    const r = await registro({ cvId: "cv9", vacanteId: "v9", area: "=HYPERLINK(\"x\")", categoriaFinal: "REVISION" });
    const csv = historialACsv([r]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("Pendiente de revisión");
    expect(csv).not.toContain("cv9");
    expect(csv).not.toContain(r.analisisId!);
    expect(celdaCsv(" \n=1+1")).toBe(`"' \n=1+1"`);
  });
});

describe("Ajustes manuales y re-análisis", () => {
  it("un ajuste sigue contando en el resumen aunque el CV se re-analice; las categorías usan el resultado vigente", async () => {
    const antes = new Date(Date.now() - DIA);
    await registro({
      cvId: "cvR", vacanteId: "vR", area: "Reanalisis", categoria: "REVISION", categoriaFinal: "BUENO", fecha: antes,
      ajustada: true, motivoAjuste: "ENTREVISTA", horasHastaAjuste: 5,
    });
    await registro({ cvId: "cvR", vacanteId: "vR", area: "Reanalisis", categoriaFinal: "PASABLE" }); // re-análisis sin ajuste

    const r = resumirHistorial(await registrosDelHistorial({ area: "Reanalisis" }));
    expect(r.total).toMatchObject({ cvs: 1, resultados: 1, analisis: 2 });
    expect(r.total.porCategoria).toMatchObject({ PASABLE: 1, BUENO: 0, REVISION: 0 });
    expect(r.ajustadas).toBe(1);
    expect(r.cambiosManuales).toEqual([{ de: "REVISION", a: "BUENO", cantidad: 1 }]);
    expect(r.motivosAjuste).toEqual([{ motivo: expect.any(String), cantidad: 1 }]);
    expect(r).toMatchObject({ revisionesResueltas: 1, horasPromedioRevision: 5, pendientesRevision: 0 });
  });

  it("el CSV llama a la columna «Categoría final (al analizar o por ajuste)» y no recalcula con los umbrales", async () => {
    const r = await registro({ cvId: "cvU", vacanteId: "vU", area: "Umbrales", categoria: "BUENO", categoriaFinal: "BUENO" });
    await db.configuracionUmbrales.upsert({ where: { id: 1 }, update: { bueno: 99, excelente: 100 }, create: { bueno: 99, excelente: 100 } });
    const csv = historialACsv(await registrosDelHistorial({ area: "Umbrales" }));
    expect(csv).toContain("Categoría final (al analizar o por ajuste)");
    expect(csv).not.toContain("Categoría vigente");
    expect(csv.split("\r\n")[1]).toContain(`"Bueno","Bueno"`);
    await db.configuracionUmbrales.update({ where: { id: 1 }, data: { bueno: 70, excelente: 85 } });
    expect((await db.registroAnalisis.findUniqueOrThrow({ where: { id: r.id } })).categoriaFinal).toBe("BUENO");
  });

  it("en el CSV, los registros de CVs eliminados muestran solo la fecha (sin hora)", async () => {
    const dia = new Date("2026-03-15T06:00:00.000Z"); // 15/03/26 00:00 en CDMX
    const vivo = await registro({ cvId: "cvVivo", vacanteId: "vF", area: "Fechas", categoriaFinal: "BUENO", fecha: new Date("2026-03-15T18:30:00.000Z") });
    const eliminado = await registro({
      cvId: "seudonimo-123", vacanteId: "vF", area: "Fechas", categoriaFinal: "BUENO", fecha: dia, ajustada: true, fechaAjuste: dia,
    });
    const [, filaVivo] = historialACsv([vivo]).split("\r\n");
    const [, filaEliminado] = historialACsv([eliminado]).split("\r\n");
    expect(filaVivo).toMatch(/^"15\/03\/(20)?26,? \d{1,2}:\d{2}/); // con hora
    expect(filaEliminado).toMatch(/^"15\/03\/(20)?26",/); // fecha del análisis, sin hora
    expect(filaEliminado).toMatch(/"Sí","[^"]*","15\/03\/(20)?26",/); // fecha del ajuste, sin hora
    expect(filaEliminado).not.toMatch(/\d:\d{2}/);
  });
});

describe("El historial sobrevive a la purga y refleja los ajustes", () => {
  it("al eliminar el CV por plazo, su registro se conserva; el ajuste manual actualiza la categoría vigente", async () => {
    const subida = await subirCv(usuario, { nombreArchivo: "h.pdf", contenido: crearPdf(textoCv("Hugo", "hugo@correo.mx")), forzar: true });
    if (subida.estado !== "GUARDADO") throw new Error("no se guardó");
    const vacante = await db.vacante.create({
      data: {
        titulo: "Analista", area: "Datos", descripcion: "x", requisitosObligatorios: "[]", requisitosDeseables: "[]",
        aniosMinimos: 0, nivelEstudiosMinimo: "NINGUNO", idiomas: "[]", modalidad: "REMOTO", ubicacion: "CDMX",
        creadoPorId: usuario.id, actualizadoPorId: usuario.id,
      },
    });
    const analisis = await db.analisis.create({
      data: {
        cvId: subida.id, vacanteId: vacante.id, vacanteVersion: 1, vacanteSnapshot: "{}", modelo: "m", creadoPorId: usuario.id,
        veredicto: "VIABLE", motivosNoViable: "[]", puntaje: 60, puntajeO: 60, puntajeE: 60, puntajeF: 60, resultado: "{}",
        creadoEn: new Date(Date.now() - 3 * DIA),
      },
    });
    await db.registroAnalisis.create({
      data: {
        analisisId: analisis.id, cvId: subida.id, vacanteId: vacante.id, vacanteTitulo: vacante.titulo, area: vacante.area,
        veredicto: "VIABLE", puntaje: 60, categoria: "PASABLE", categoriaFinal: "PASABLE", modelo: "m",
        usuarioId: usuario.id, usuarioNombre: usuario.nombre,
      },
    });

    await ajustarCategoria(usuario, analisis.id, { categoria: "BUENO", motivo: "ENTREVISTA", comentario: "Experiencia confirmada en entrevista" });
    expect(await db.registroAnalisis.findUniqueOrThrow({ where: { analisisId: analisis.id } })).toMatchObject({
      categoria: "PASABLE",
      categoriaFinal: "BUENO",
      ajustada: true,
    });

    const ajustado = await db.registroAnalisis.findUniqueOrThrow({ where: { analisisId: analisis.id } });
    expect(ajustado.ajustadaPor).toBe(usuario.nombre);
    expect(ajustado.fechaAjuste).not.toBeNull();

    await db.cv.update({ where: { id: subida.id }, data: { creadoEn: new Date(Date.now() - 3 * DIA) } });
    await purgarCvsVencidos(new Date(), 1);
    expect(await db.cv.findUnique({ where: { id: subida.id } })).toBeNull();

    // El registro se conserva, pero ya no se puede ligar al CV ni al análisis.
    const conservado = await db.registroAnalisis.findUniqueOrThrow({ where: { id: ajustado.id } });
    expect(conservado).toMatchObject({ analisisId: null, categoriaFinal: "BUENO", area: "Datos" });
    expect(conservado.cvId).not.toBe(subida.id);
    expect(conservado.cvId).toMatch(/^seudonimo-/);
    // Fechas redondeadas al día (CDMX) y motivo de catálogo conservado.
    expect(conservado.fecha.toISOString()).toMatch(/T06:00:00\.000Z$/);
    expect(conservado.motivoAjuste).toBe("ENTREVISTA");
    expect(conservado.horasHastaAjuste).toBeGreaterThan(0);
    // La bitácora (solo inserción) conserva los eventos y nunca guardó datos del candidato.
    const eventos = await db.eventoBitacora.findMany({ where: { OR: [{ entidadId: subida.id }, { entidadId: analisis.id }] } });
    expect(eventos.length).toBeGreaterThanOrEqual(2);
    for (const e of eventos) {
      expect(e.detalle ?? "").not.toContain("Hugo");
      expect(e.detalle ?? "").not.toContain("h.pdf");
      expect(e.detalle ?? "").not.toContain("Experiencia confirmada");
    }
  });
});

describe("Eliminación manual", () => {
  it("también aplica el seudónimo y limpia la bitácora", async () => {
    const subida = await subirCv(usuario, { nombreArchivo: "Irma_Ficticia.pdf", contenido: crearPdf(textoCv("Irma", "irma@correo.mx")), forzar: true });
    if (subida.estado !== "GUARDADO") throw new Error("no se guardó");
    const r = await registro({ cvId: subida.id, vacanteId: "v5", area: "Datos", categoriaFinal: "BUENO" });
    await eliminarCv(usuario, subida.id);
    expect((await db.registroAnalisis.findUniqueOrThrow({ where: { id: r.id } })).cvId).toMatch(/^seudonimo-/);
    const eventos = await db.eventoBitacora.findMany({ where: { entidadId: subida.id } });
    for (const e of eventos) expect(e.detalle ?? "").not.toContain("Irma");
  });
});

describe("Pendientes de revisión que expiran", () => {
  it("al purgar un CV pendiente de revisión, el historial lo marca como «expiró sin revisión»", async () => {
    const subida = await subirCv(usuario, { nombreArchivo: "p.pdf", contenido: crearPdf(textoCv("Paz", "paz@correo.mx")), forzar: true });
    if (subida.estado !== "GUARDADO") throw new Error("no se guardó");
    const r = await registro({ cvId: subida.id, vacanteId: "v7", area: "Finanzas", categoriaFinal: "REVISION" });
    await db.cv.update({ where: { id: subida.id }, data: { creadoEn: new Date(Date.now() - 3 * DIA) } });
    await purgarCvsVencidos(new Date(), 1);
    expect((await db.registroAnalisis.findUniqueOrThrow({ where: { id: r.id } })).expiroSinRevision).toBe(true);
    const resumen = resumirHistorial(await registrosDelHistorial({ area: "Finanzas" }));
    expect(resumen).toMatchObject({ expiradasSinRevision: 1, pendientesRevision: 0 });
  });
});
