import { db, type ClienteDb } from "@/lib/db";

export type Accion =
  | "LOGIN_OK"
  | "LOGIN_FALLIDO"
  | "CUENTA_BLOQUEADA"
  | "CONTRASENA_CAMBIADA"
  | "CONTRASENA_RESTABLECIDA"
  | "USUARIO_CREADO"
  | "USUARIO_ROL_CAMBIADO"
  | "USUARIO_DESACTIVADO"
  | "USUARIO_REACTIVADO"
  | "CV_SUBIDO"
  | "CV_DESCARGADO"
  | "CV_ELIMINADO"
  | "CV_ELIMINADO_POR_PLAZO"
  | "CV_OPOSICION_IA"
  | "CV_NOMBRE_CORREGIDO"
  | "ANALISIS_REALIZADO"
  | "CATEGORIA_AJUSTADA"
  | "VACANTE_CREADA"
  | "VACANTE_EDITADA"
  | "VACANTE_ARCHIVADA"
  | "UMBRALES_CAMBIADOS"
  | "HISTORIAL_EXPORTADO";

export const ETIQUETA_ACCION: Record<Accion, string> = {
  LOGIN_OK: "Inicio de sesión",
  LOGIN_FALLIDO: "Inicio de sesión fallido",
  CUENTA_BLOQUEADA: "Cuenta bloqueada",
  CONTRASENA_CAMBIADA: "Contraseña cambiada",
  CONTRASENA_RESTABLECIDA: "Contraseña restablecida",
  USUARIO_CREADO: "Usuario creado",
  USUARIO_ROL_CAMBIADO: "Rol cambiado",
  USUARIO_DESACTIVADO: "Usuario desactivado",
  USUARIO_REACTIVADO: "Usuario reactivado",
  CV_SUBIDO: "CV subido",
  CV_DESCARGADO: "CV descargado",
  CV_ELIMINADO: "CV eliminado",
  CV_ELIMINADO_POR_PLAZO: "CVs eliminados por plazo de conservación",
  CV_OPOSICION_IA: "Oposición al análisis con IA",
  CV_NOMBRE_CORREGIDO: "Nombre de candidato corregido",
  ANALISIS_REALIZADO: "Análisis realizado",
  CATEGORIA_AJUSTADA: "Categoría ajustada",
  VACANTE_CREADA: "Vacante creada",
  VACANTE_EDITADA: "Vacante editada",
  VACANTE_ARCHIVADA: "Vacante archivada",
  UMBRALES_CAMBIADOS: "Umbrales cambiados",
  HISTORIAL_EXPORTADO: "Historial exportado",
};

export type Actor = { id: string; nombre: string; correo: string };

type Evento = {
  actor: Actor | null;
  /** Solo cuando no hay actor (p. ej. inicio de sesión con un correo inexistente). */
  correoIntentado?: string;
  /** Acción automática del sistema (p. ej. la purga por plazo de conservación). */
  sistema?: boolean;
  accion: Accion;
  entidadTipo?: "USUARIO" | "CV" | "ANALISIS" | "VACANTE" | "UMBRALES";
  entidadId?: string;
  /** Nunca incluir contraseñas ni el texto del CV. */
  detalle?: Record<string, unknown>;
};

/** Registra un evento de auditoría. La bitácora es de solo inserción. */
export async function registrarEvento(evento: Evento, cliente: ClienteDb = db) {
  await cliente.eventoBitacora.create({
    data: {
      actorId: evento.actor?.id ?? null,
      actorNombre: evento.actor?.nombre ?? (evento.sistema ? "Sistema" : "(desconocido)"),
      actorCorreo: evento.actor?.correo ?? (evento.sistema ? "sistema" : (evento.correoIntentado ?? "[inválido]")),
      accion: evento.accion,
      entidadTipo: evento.entidadTipo ?? null,
      entidadId: evento.entidadId ?? null,
      detalle: evento.detalle ? JSON.stringify(evento.detalle) : null,
    },
  });
}
