import { readdirSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as subir } from "@/app/api/cvs/route";
import { detectarTipo } from "@/lib/archivos/firma";
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

  it("marca 'Sin texto legible' si hay menos de 200 caracteres", async () => {
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

describe("Bitácora de solo lectura", () => {
  it("la base de datos impide modificar o borrar eventos", async () => {
    const evento = await db.eventoBitacora.findFirstOrThrow();
    await expect(db.eventoBitacora.update({ where: { id: evento.id }, data: { accion: "X" } })).rejects.toThrow();
    await expect(db.eventoBitacora.delete({ where: { id: evento.id } })).rejects.toThrow();
  });
});
