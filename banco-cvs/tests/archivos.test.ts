import { readdirSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as subir } from "@/app/api/cvs/route";
import { esTextoLegible, extraerContenido, paginasConPocoTexto } from "@/lib/archivos/extraer";
import { detectarTipo } from "@/lib/archivos/firma";
import { errorTransitorio } from "@/lib/errores";
import { subirCv } from "@/lib/archivos/servicio";
import { db } from "@/lib/db";
import { crearDocx, crearPdf, crearUsuario, crearZip, simularSesion, textoCv } from "./ayuda";

let usuario: Awaited<ReturnType<typeof crearUsuario>>;

beforeAll(async () => {
  usuario = await crearUsuario();
});

function peticion(archivo: Buffer, nombre: string, extra: Record<string, string> = {}, origen = "http://localhost:3000") {
  const datos = new FormData();
  datos.append("archivo", new File([new Uint8Array(archivo)], nombre));
  for (const [k, v] of Object.entries(extra)) datos.append(k, v);
  return new Request("http://localhost:3000/api/cvs", {
    method: "POST",
    body: datos,
    headers: { origin: origen, host: "localhost:3000" },
  });
}

describe("Validación y almacenamiento de archivos", () => {
  it("detecta el tipo por firma, no por extensión", () => {
    expect(detectarTipo(crearPdf(["hola"]))).toBe("PDF");
    expect(detectarTipo(crearDocx(["hola"]))).toBe("DOCX");
    expect(detectarTipo(Buffer.from("MZ ejecutable disfrazado"))).toBeNull();
    expect(detectarTipo(crearZip([{ nombre: "otro.txt", contenido: "zip que no es docx" }]))).toBeNull();
  });

  it("rechaza un archivo con extensión .pdf que no es PDF", async () => {
    await simularSesion(usuario);
    const r = await subir(peticion(Buffer.from("<html>no soy pdf</html>"), "cv.pdf"));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "Formato no válido: solo se aceptan PDF y DOCX." });
  });

  it("rechaza archivos de más de 10 MB", async () => {
    await simularSesion(usuario);
    const apenasMayor = Buffer.concat([crearPdf(["x"]), Buffer.alloc(10 * 1024 * 1024 + 10, 32)]);
    const r = await subir(peticion(apenasMayor, "grande.pdf"));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "El archivo supera 10 MB." });

    // Muy grande: se corta la lectura del cuerpo sin cargarlo completo.
    const enorme = Buffer.concat([crearPdf(["x"]), Buffer.alloc(11 * 1024 * 1024, 32)]);
    expect((await subir(peticion(enorme, "enorme.pdf"))).status).toBe(413);
  });

  it("rechaza peticiones de otro origen (CSRF)", async () => {
    await simularSesion(usuario);
    const r = await subir(peticion(crearPdf(textoCv("A", "a@b.mx")), "cv.pdf", {}, "https://sitio-malicioso.example"));
    expect(r.status).toBe(403);
  });

  it("guarda con nombre UUID en storage/ y el nombre original solo en la base de datos", async () => {
    await simularSesion(usuario);
    const r = await subir(peticion(crearPdf(textoCv("Laura Ficticia", "laura@correo-ficticio.mx")), "../../CV Laura.pdf"));
    expect(r.status).toBe(201);
    const { id } = (await r.json()) as { id: string };
    const cv = await db.cv.findUniqueOrThrow({ where: { id } });
    expect(cv.nombreArchivo).toBe("CV Laura.pdf");
    expect(cv.archivoId).toMatch(/^[0-9a-f-]{36}$/);
    expect(cv.estado).toBe("CON_TEXTO");
    expect(cv.textoExtraido).toContain("Analista de datos");
    expect(cv.correoCandidato).toBe("laura@correo-ficticio.mx");
    const archivos = readdirSync(path.join(process.cwd(), "storage"));
    expect(archivos).toContain(cv.archivoId);
    expect(archivos.some((a) => a.includes("Laura"))).toBe(false);
  });

  it("un CV breve con texto real es legible; un escaneo con marca de agua o números sueltos no", async () => {
    const breve = [
      "Juan Pérez Ficticio",
      "Correo: juan@correo-ficticio.mx · Tel. 55 1234 5678",
      "Experiencia: Cajero en Tienda Ficticia (2023 - 2025).",
      "Estudios: Bachillerato. Disponibilidad inmediata.",
    ];
    expect(esTextoLegible(breve.join("\n"))).toBe(true);
    const r = await subirCv(usuario, { nombreArchivo: "breve.pdf", contenido: crearPdf(breve), forzar: true });
    expect(r).toMatchObject({ estado: "GUARDADO", sinTexto: false });

    expect(esTextoLegible("Escaneado con CamScanner\n1\n2")).toBe(false);
    expect(esTextoLegible("0123456789 ".repeat(20))).toBe(false); // muchos caracteres, ninguna palabra
    expect(esTextoLegible("Hoja escaneada\n[TEXTO OCULTO OMITIDO: 5000 caracteres en letra diminuta]")).toBe(false);
  });

  it("un PDF de 3 páginas con solo el encabezado como texto queda «sin texto legible»; un CV de 1 página no", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const fuente = await pdf.embedFont(StandardFonts.Helvetica);
    const encabezado = [
      "Mariana Ficticia Gómez · Licenciada en Administración de Empresas",
      "Correo: mariana@correo-ficticio.mx · Teléfono: 55 1234 5678 · Ciudad de México",
      "Perfil: profesional con experiencia en compras, inventarios y atención a proveedores.",
    ];
    for (let i = 0; i < 3; i++) {
      const pagina = pdf.addPage([612, 792]);
      // El cuerpo sería una imagen escaneada: solo la primera página tiene texto real.
      if (i === 0) encabezado.forEach((l, j) => pagina.drawText(l, { x: 50, y: 740 - j * 14, size: 10, font: fuente }));
    }
    const escaneado = await subirCv(usuario, { nombreArchivo: "mitad.pdf", contenido: Buffer.from(await pdf.save()), forzar: true });
    expect(escaneado).toMatchObject({ estado: "GUARDADO", sinTexto: true });
    // El mismo encabezado en 1 página pasa el mínimo global: la densidad por página es lo que lo detecta.
    expect(esTextoLegible(encabezado.join("\n"), 1)).toBe(true);
    expect(esTextoLegible(encabezado.join("\n"), 3)).toBe(false);

    const real = await subirCv(usuario, {
      nombreArchivo: "real.pdf",
      contenido: crearPdf([...textoCv("Rocío Ficticia", "rocio@correo-ficticio.mx"), "Manejo de inventarios y compras.", "Disponibilidad inmediata."]),
      forzar: true,
    });
    expect(real).toMatchObject({ estado: "GUARDADO", sinTexto: false });
  });

  it("marca las páginas con poco texto: una página-imagen en medio y un PDF de 1 página escaso", async () => {
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const fuente = await pdf.embedFont(StandardFonts.Helvetica);
    const renglon = "Analista de datos con experiencia en SQL, Excel avanzado, Power BI y reportes de ventas semanales.";
    for (let i = 0; i < 3; i++) {
      const pagina = pdf.addPage([612, 792]);
      // La página 2 sería una imagen: sin texto. El promedio (más de 250 por página) la escondería.
      if (i !== 1) for (let j = 0; j < 8; j++) pagina.drawText(renglon, { x: 40, y: 740 - j * 14, size: 9, font: fuente });
    }
    const { texto, paginas } = await extraerContenido(Buffer.from(await pdf.save()), "PDF");
    expect(esTextoLegible(texto, paginas)).toBe(true);
    expect(paginasConPocoTexto(texto)).toEqual([2]);

    // 1 página con más de 100 caracteres pero menos de 600: el cuerpo podría ser una imagen.
    const breve = await extraerContenido(crearPdf(textoCv("Pita Ficticia", "pita@correo-ficticio.mx")), "PDF");
    expect(esTextoLegible(breve.texto, breve.paginas)).toBe(true);
    expect(paginasConPocoTexto(breve.texto)).toEqual([1]);

    // Un CV de 1 página con texto suficiente no se marca.
    const completo = await extraerContenido(crearPdf(Array.from({ length: 10 }, () => renglon)), "PDF");
    expect(paginasConPocoTexto(completo.texto)).toEqual([]);
  });

  it("marca 'Sin texto legible' si casi no hay texto", async () => {
    const r = await subirCv(usuario, { nombreArchivo: "escaneado.pdf", contenido: crearPdf(["Hoja escaneada"]), forzar: false });
    expect(r.estado).toBe("GUARDADO");
    if (r.estado !== "GUARDADO") return;
    expect(r.sinTexto).toBe(true);
    expect((await db.cv.findUniqueOrThrow({ where: { id: r.id } })).estado).toBe("SIN_TEXTO_LEGIBLE");
  });

  it("detecta duplicados por correo o por texto y solo guarda con 'Guardar de todos modos'", async () => {
    const texto = textoCv("Mario Ficticio", "mario@correo-ficticio.mx");
    const primero = await subirCv(usuario, { nombreArchivo: "mario.pdf", contenido: crearPdf(texto), forzar: false });
    expect(primero.estado).toBe("GUARDADO");

    // Mismo texto en otro formato → duplicado por texto.
    const mismoTexto = await subirCv(usuario, { nombreArchivo: "mario.docx", contenido: crearDocx(texto), forzar: false });
    expect(mismoTexto.estado).toBe("DUPLICADO");

    // Otro CV con el mismo correo → duplicado por correo.
    const otroTexto = [...textoCv("Mario Ficticio", "MARIO@correo-ficticio.mx"), "Curso de Python 2025."];
    const mismoCorreo = await subirCv(usuario, { nombreArchivo: "mario-2.pdf", contenido: crearPdf(otroTexto), forzar: false });
    expect(mismoCorreo.estado).toBe("DUPLICADO");
    if (mismoCorreo.estado === "DUPLICADO") expect(mismoCorreo.duplicados[0].coincidencia).toBe("correo");

    const antes = await db.cv.count();
    const forzado = await subirCv(usuario, { nombreArchivo: "mario-2.pdf", contenido: crearPdf(otroTexto), forzar: true });
    expect(forzado.estado).toBe("GUARDADO");
    expect(await db.cv.count()).toBe(antes + 1);
  });

  it("la ruta devuelve 409 con los CVs existentes cuando hay duplicado", async () => {
    await simularSesion(usuario);
    const texto = textoCv("Sofía Ficticia", "sofia@correo-ficticio.mx");
    expect((await subir(peticion(crearPdf(texto), "sofia.pdf"))).status).toBe(201);
    const r = await subir(peticion(crearPdf(texto), "sofia-copia.pdf"));
    expect(r.status).toBe(409);
    const cuerpo = (await r.json()) as { estado: string; duplicados: { nombre: string }[] };
    expect(cuerpo.estado).toBe("DUPLICADO");
    expect(cuerpo.duplicados[0].nombre).toBe("sofia.pdf");
    expect((await subir(peticion(crearPdf(texto), "sofia-copia.pdf", { forzar: "1" }))).status).toBe(201);
  });
});

describe("Errores de carga: permanentes y transitorios", () => {
  it("solo se ofrece «Reintentar» si el error puede cambiar al reintentar", () => {
    for (const permanente of [400, 403, 413]) expect(errorTransitorio(permanente)).toBe(false);
    for (const transitorio of [401, 408, 429, 500, 502, 503]) expect(errorTransitorio(transitorio)).toBe(true);
  });
});

describe("Bitácora de solo lectura", () => {
  it("la base de datos impide modificar o borrar eventos", async () => {
    const evento = await db.eventoBitacora.findFirstOrThrow();
    await expect(db.eventoBitacora.update({ where: { id: evento.id }, data: { accion: "X" } })).rejects.toThrow();
    await expect(db.eventoBitacora.delete({ where: { id: evento.id } })).rejects.toThrow();
  });
});

describe("Texto oculto en PDF", () => {
  it("omite la letra diminuta al extraer y deja una marca visible", async () => {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const { extraerTexto } = await import("@/lib/archivos/extraer");
    const pdf = await PDFDocument.create();
    const pagina = pdf.addPage([612, 792]);
    const fuente = await pdf.embedFont(StandardFonts.Helvetica);
    pagina.drawText("Auxiliar Administrativo en Empresa Ficticia (2024 - actual)", { x: 50, y: 700, size: 11, font: fuente });
    pagina.drawText("Analista de Datos Senior (2019 - actual) con SQL y Power BI", { x: 50, y: 20, size: 1, font: fuente, color: rgb(1, 1, 1) });
    const texto = await extraerTexto(Buffer.from(await pdf.save()), "PDF");
    expect(texto).toContain("Auxiliar Administrativo");
    expect(texto).not.toContain("Analista de Datos Senior");
    expect(texto).toMatch(/\[TEXTO OCULTO OMITIDO: \d+ caracteres en letra diminuta\]/);
  });
});
