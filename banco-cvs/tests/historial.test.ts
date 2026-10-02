import { beforeAll, describe, expect, it } from "vitest";
import { purgarCvsVencidos } from "@/lib/archivos/conservacion";
import { subirCv } from "@/lib/archivos/servicio";
import { ajustarCategoria } from "@/lib/analisis/ajustes";
import { db } from "@/lib/db";
import { historialACsv, registrosDelHistorial, resumirHistorial } from "@/lib/historial";
import { crearPdf, crearUsuario, textoCv } from "./ayuda";

let usuario: Awaited<ReturnType<typeof crearUsuario>>;
const DIA = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  usuario = await crearUsuario();
});

let n = 0;
async function registro(datos: { cvId: string; vacanteId: string; area: string; categoriaFinal: string; fecha?: Date; ajustada?: boolean }) {
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
      categoria: datos.categoriaFinal,
      categoriaFinal: datos.categoriaFinal,
      ajustada: datos.ajustada ?? false,
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
    expect(r.total.analisis).toBe(5);
    expect(r.total.porCategoria).toMatchObject({ EXCELENTE: 1, BUENO: 1, PASABLE: 0, REVISION: 1, NO_VIABLE: 1 });
    expect(r.ajustadas).toBe(1);
    const datos = r.porArea.find((a) => a.etiqueta === "Datos")!;
    expect(datos).toMatchObject({ cvs: 2, analisis: 3 });
    expect(datos.porCategoria).toMatchObject({ BUENO: 1, NO_VIABLE: 1, PASABLE: 0 });
    expect(r.porArea.find((a) => a.etiqueta === "Ventas")).toMatchObject({ cvs: 2, analisis: 2 });

    const soloVentas = resumirHistorial(await registrosDelHistorial({ area: "Ventas" }));
    expect(soloVentas.total.cvs).toBe(2);
  });

  it("el CSV no incluye datos de candidatos y neutraliza fórmulas", async () => {
    const r = await registro({ cvId: "cv9", vacanteId: "v9", area: "=HYPERLINK(\"x\")", categoriaFinal: "BUENO" });
    const csv = historialACsv([r]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv.split("\r\n")[0]).not.toMatch(/nombre del candidato|correo/i);
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

    await ajustarCategoria(usuario, analisis.id, { categoria: "BUENO", comentario: "Experiencia confirmada en entrevista" });
    expect(await db.registroAnalisis.findUniqueOrThrow({ where: { analisisId: analisis.id } })).toMatchObject({
      categoria: "PASABLE",
      categoriaFinal: "BUENO",
      ajustada: true,
    });

    await db.cv.update({ where: { id: subida.id }, data: { creadoEn: new Date(Date.now() - 3 * DIA) } });
    await purgarCvsVencidos(new Date(), 1);
    expect(await db.cv.findUnique({ where: { id: subida.id } })).toBeNull();
    expect(await db.registroAnalisis.findUnique({ where: { analisisId: analisis.id } })).not.toBeNull();
  });
});
