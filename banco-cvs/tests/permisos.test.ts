import { beforeAll, describe, expect, it } from "vitest";
import { ajustarCategoriaAccion } from "@/acciones/analisis";
import { eliminarCvAccion } from "@/acciones/cvs";
import { actualizarUmbralesAccion } from "@/acciones/umbrales";
import {
  cambiarRolAccion,
  crearUsuarioAccion,
  desactivarUsuarioAccion,
  reactivarUsuarioAccion,
  restablecerContrasenaAccion,
} from "@/acciones/usuarios";
import { archivarVacanteAccion, crearVacanteAccion, editarVacanteAccion } from "@/acciones/vacantes";
import { GET as descargar } from "@/app/api/cvs/[id]/descargar/route";
import { POST as subir } from "@/app/api/cvs/route";
import { subirCv } from "@/lib/archivos/servicio";
import { consultarBitacora, consultarCvs, consultarUsuarios, consultarVacantes } from "@/lib/consultas";
import { db } from "@/lib/db";
import { protegerPagina } from "@/lib/paginas";
import { crearDocx, crearPdf, crearUsuario, simularSesion, textoCv } from "./ayuda";

type Usuario = Awaited<ReturnType<typeof crearUsuario>>;
let admin: Usuario;
let usuario: Usuario;
let otro: Usuario;

const SIN_PERMISO = { ok: false, error: "No tienes permiso para realizar esta acción." };

function formVacante(titulo = "Analista de Datos Jr.") {
  const d = new FormData();
  d.set("titulo", titulo);
  d.set("area", "Inteligencia de Negocios");
  d.set("descripcion", "Elaborar reportes y tableros para el área comercial.");
  d.set("requisitosObligatorios", "SQL\nExcel avanzado");
  d.set("requisitosDeseables", "Power BI");
  d.set("aniosMinimos", "1");
  d.set("nivelEstudiosMinimo", "LICENCIATURA");
  d.set("idioma_0", "Inglés");
  d.set("nivelIdioma_0", "INTERMEDIO");
  d.set("modalidad", "HIBRIDO");
  d.set("ubicacion", "Ciudad de México");
  return d;
}

async function crearVacanteComo(u: Usuario) {
  await simularSesion(u);
  const r = await crearVacanteAccion(undefined, formVacante());
  if (!r.ok) throw new Error(r.error);
  return r.datos.id;
}

async function crearCv(u: Usuario, nombre: string) {
  const r = await subirCv(u, {
    nombreArchivo: `${nombre}.pdf`,
    contenido: crearPdf(textoCv(nombre, `${nombre.toLowerCase()}@correo-ficticio.mx`)),
    forzar: true,
  });
  if (r.estado !== "GUARDADO") throw new Error("no guardado");
  return r.id;
}

async function crearAnalisis(cvId: string, vacanteId: string, autor: Usuario) {
  const a = await db.analisis.create({
    data: {
      cvId,
      vacanteId,
      vacanteVersion: 1,
      vacanteSnapshot: "{}",
      modelo: "prueba",
      creadoPorId: autor.id,
      veredicto: "VIABLE",
      motivosNoViable: "[]",
      puntaje: 72,
      puntajeO: 80,
      puntajeD: 60,
      puntajeE: 70,
      puntajeF: 50,
      resultado: "{}",
    },
  });
  return a.id;
}

function peticionCarga(archivo: Buffer, nombre: string) {
  const datos = new FormData();
  datos.append("archivo", new File([new Uint8Array(archivo)], nombre));
  return new Request("http://localhost:3000/api/cvs", {
    method: "POST",
    body: datos,
    headers: { origin: "http://localhost:3000", host: "localhost:3000" },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  admin = await crearUsuario({ rol: "ADMIN" });
  usuario = await crearUsuario({ rol: "USUARIO" });
  otro = await crearUsuario({ rol: "USUARIO" });
});

describe("Matriz de permisos", () => {
  it("Ver repositorio, buscar, filtrar y descargar CVs: Usuario ✅ Admin ✅", async () => {
    const cvId = await crearCv(admin, "Candidata Uno");
    for (const u of [usuario, admin]) {
      await simularSesion(u);
      expect((await consultarCvs()).some((c) => c.id === cvId)).toBe(true);
      expect((await consultarVacantes("ACTIVA")).length).toBeGreaterThanOrEqual(0);
      const respuesta = await descargar(new Request("http://localhost:3000/"), params(cvId));
      expect(respuesta.status).toBe(200);
      expect(respuesta.headers.get("content-type")).toBe("application/pdf");
      expect(respuesta.headers.get("cache-control")).toBe("private, no-store");
      expect(respuesta.headers.get("content-disposition")).toContain("attachment");
    }
    expect(await db.eventoBitacora.count({ where: { accion: "CV_DESCARGADO", entidadId: cvId } })).toBe(2);
  });

  it("Subir CVs: Usuario ✅ Admin ✅ (analizar se prueba en la Fase 2)", async () => {
    for (const [i, u] of [usuario, admin].entries()) {
      await simularSesion(u);
      const r = await subir(peticionCarga(crearDocx(textoCv(`Persona Docx ${i}`, `docx${i}@correo-ficticio.mx`)), `cv${i}.docx`));
      expect(r.status).toBe(201);
    }
  });

  it("Cambiar categoría manualmente con comentario: Usuario ✅ Admin ✅", async () => {
    const vacanteId = await crearVacanteComo(admin);
    const cvId = await crearCv(admin, "Candidato Ajuste");
    const analisisId = await crearAnalisis(cvId, vacanteId, admin);
    for (const u of [usuario, admin]) {
      await simularSesion(u);
      const d = new FormData();
      d.set("categoria", "BUENO");
      d.set("comentario", "La experiencia en ventas compensa el nivel de inglés.");
      expect((await ajustarCategoriaAccion(analisisId, undefined, d)).ok).toBe(true);
    }
    expect(await db.ajusteCategoria.count({ where: { analisisId } })).toBe(2);
  });

  it("Crear, editar y archivar vacantes: Usuario ❌ Admin ✅", async () => {
    await simularSesion(usuario);
    expect(await crearVacanteAccion(undefined, formVacante())).toEqual(SIN_PERMISO);
    const vacanteId = await crearVacanteComo(admin);
    await simularSesion(usuario);
    expect(await editarVacanteAccion(vacanteId, undefined, formVacante("Otro"))).toEqual(SIN_PERMISO);
    expect(await archivarVacanteAccion(vacanteId)).toEqual(SIN_PERMISO);
    await expect(protegerPagina("ADMIN")).rejects.toMatchObject({ digest: expect.stringContaining("/sin-permiso") });

    await simularSesion(admin);
    expect((await editarVacanteAccion(vacanteId, undefined, formVacante("Analista de Datos Jr. (CDMX)"))).ok).toBe(true);
    const editada = await db.vacante.findUniqueOrThrow({ where: { id: vacanteId } });
    expect(editada.version).toBe(2);
    expect((await archivarVacanteAccion(vacanteId)).ok).toBe(true);
    // Archivada = solo lectura.
    expect(await editarVacanteAccion(vacanteId, undefined, formVacante())).toEqual({
      ok: false,
      error: "La vacante está archivada y es de solo lectura.",
    });
  });

  it("Editar umbrales de categorías: Usuario ❌ Admin ✅", async () => {
    const d = new FormData();
    d.set("excelente", "90");
    d.set("bueno", "75");
    d.set("pasable", "60");
    await simularSesion(usuario);
    expect(await actualizarUmbralesAccion(undefined, d)).toEqual(SIN_PERMISO);
    await simularSesion(admin);
    expect(await actualizarUmbralesAccion(undefined, d)).toEqual({
      ok: true,
      datos: { excelente: 90, bueno: 75, pasable: 60 },
    });
  });

  it("Eliminar CVs de forma definitiva: Usuario ❌ Admin ✅", async () => {
    const cvId = await crearCv(usuario, "Candidato Borrable");
    await simularSesion(usuario);
    expect(await eliminarCvAccion(cvId)).toEqual(SIN_PERMISO);
    await simularSesion(admin);
    expect((await eliminarCvAccion(cvId)).ok).toBe(true);
    expect(await db.cv.count({ where: { id: cvId } })).toBe(0);
    const evento = await db.eventoBitacora.findFirstOrThrow({ where: { accion: "CV_ELIMINADO", entidadId: cvId } });
    expect(evento.actorId).toBe(admin.id);
  });

  it("Gestionar usuarios: Usuario ❌ Admin ✅", async () => {
    await simularSesion(usuario);
    const alta = new FormData();
    alta.set("nombre", "Intruso Ficticio");
    alta.set("correo", "intruso@empresa-ficticia.mx");
    alta.set("rol", "ADMIN");
    expect(await crearUsuarioAccion(undefined, alta)).toEqual(SIN_PERMISO);
    expect(await cambiarRolAccion(usuario.id, "ADMIN")).toEqual(SIN_PERMISO);
    expect(await desactivarUsuarioAccion(otro.id)).toEqual(SIN_PERMISO);
    expect(await reactivarUsuarioAccion(otro.id)).toEqual(SIN_PERMISO);
    expect(await restablecerContrasenaAccion(otro.id)).toEqual(SIN_PERMISO);
    await expect(consultarUsuarios()).rejects.toMatchObject({ motivo: "SIN_PERMISO" });
    expect((await db.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).rol).toBe("USUARIO");

    await simularSesion(admin);
    expect((await consultarUsuarios()).length).toBeGreaterThanOrEqual(3);
    expect((await restablecerContrasenaAccion(otro.id)).ok).toBe(true);
  });

  it("Ver bitácora de auditoría: Usuario ❌ Admin ✅", async () => {
    await simularSesion(usuario);
    await expect(consultarBitacora()).rejects.toMatchObject({ motivo: "SIN_PERMISO" });
    await simularSesion(admin);
    expect((await consultarBitacora()).length).toBeGreaterThan(0);
  });

  it("Sin sesión: toda acción, consulta y ruta se rechaza", async () => {
    await simularSesion(null);
    const sesionExpirada = { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
    expect(await crearVacanteAccion(undefined, formVacante())).toEqual(sesionExpirada);
    expect(await eliminarCvAccion("x")).toEqual(sesionExpirada);
    await expect(consultarCvs()).rejects.toMatchObject({ motivo: "NO_AUTENTICADO" });
    expect((await descargar(new Request("http://localhost:3000/"), params("x"))).status).toBe(401);
    expect((await subir(peticionCarga(crearPdf(["x"]), "x.pdf"))).status).toBe(401);
    await expect(protegerPagina("USUARIO")).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
  });
});
