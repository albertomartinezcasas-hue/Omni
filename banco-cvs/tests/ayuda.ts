import { crc32 } from "node:zlib";
import { vi } from "vitest";
import { hashContrasena } from "@/lib/auth/contrasenas";
import { leerSesion } from "@/lib/auth/sesion";
import type { Rol } from "@/lib/catalogos";
import { db } from "@/lib/db";

export const CONTRASENA = "Contraseña-de-prueba-123";
let contador = 0;

export async function crearUsuario(
  opciones: { rol?: Rol; activo?: boolean; debeCambiar?: boolean; contrasena?: string } = {},
) {
  contador += 1;
  return db.usuario.create({
    data: {
      correo: `persona${contador}-${Date.now()}@empresa-ficticia.mx`,
      nombre: `Persona Ficticia ${contador}`,
      rol: opciones.rol ?? "USUARIO",
      activo: opciones.activo ?? true,
      debeCambiarContrasena: opciones.debeCambiar ?? false,
      hashContrasena: await hashContrasena(opciones.contrasena ?? CONTRASENA),
    },
  });
}

/** Simula que `usuario` tiene una sesión abierta (token con su versión actual). */
export async function simularSesion(
  usuario: { id: string } | null,
  opciones: { inicio?: number; version?: number } = {},
) {
  if (!usuario) {
    vi.mocked(leerSesion).mockResolvedValue(null);
    return;
  }
  const actual = await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
  vi.mocked(leerSesion).mockResolvedValue({
    uid: usuario.id,
    ver: opciones.version ?? actual.versionSesion,
    inicio: opciones.inicio ?? Date.now(),
  });
}

/** Sesión con un token emitido antes (versión fija), para probar la invalidación. */
export function sesionCongelada(uid: string, ver: number) {
  vi.mocked(leerSesion).mockResolvedValue({ uid, ver, inicio: Date.now() });
}

// --- Archivos ficticios -------------------------------------------------------------

function escaparPdf(texto: string) {
  return texto.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** PDF mínimo válido con texto (Helvetica, WinAnsi). */
export function crearPdf(lineas: string[]): Buffer {
  const flujo = `BT /F1 11 Tf 14 TL 50 760 Td ${lineas.map((l) => `(${escaparPdf(l)}) '`).join(" ")} ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(flujo, "latin1")} >>\nstream\n${flujo}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n";
  const posiciones: number[] = [];
  objetos.forEach((o, i) => {
    posiciones.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const inicioXref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += posiciones.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

/** ZIP sin compresión. */
export function crearZip(entradas: { nombre: string; contenido: string }[]): Buffer {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const e of entradas) {
    const nombre = Buffer.from(e.nombre, "utf8");
    const datos = Buffer.from(e.contenido, "utf8");
    const crc = crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    locales.push(local, nombre, datos);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    centrales.push(central, nombre);
    desplazamiento += 30 + nombre.length + datos.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...locales, directorio, fin]);
}

function escaparXml(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** DOCX mínimo válido con un párrafo por línea. */
export function crearDocx(lineas: string[]): Buffer {
  const parrafos = lineas.map((l) => `<w:p><w:r><w:t xml:space="preserve">${escaparXml(l)}</w:t></w:r></w:p>`).join("");
  return crearZip([
    {
      nombre: "[Content_Types].xml",
      contenido:
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      nombre: "_rels/.rels",
      contenido:
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      nombre: "word/document.xml",
      contenido: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parrafos}</w:body></w:document>`,
    },
  ]);
}

/** Texto de CV ficticio de más de 200 caracteres. */
export function textoCv(nombre: string, correo: string) {
  return [
    nombre,
    `Correo: ${correo}`,
    "Analista de datos con experiencia en SQL, Excel avanzado y Power BI.",
    "Experiencia: Analista Jr. en Comercializadora Ficticia S.A. de C.V. (2022 - 2025).",
    "Elaboración de reportes semanales de ventas y tableros de indicadores.",
    "Educación: Licenciatura en Actuaría, Universidad Ficticia.",
    "Idiomas: Inglés intermedio.",
  ];
}
