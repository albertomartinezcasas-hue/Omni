export const ROLES = ["ADMIN", "USUARIO"] as const;
export type Rol = (typeof ROLES)[number];
export const ETIQUETA_ROL: Record<Rol, string> = { ADMIN: "Admin", USUARIO: "Usuario" };

export const NIVELES_ESTUDIO = [
  "NINGUNO",
  "SECUNDARIA",
  "BACHILLERATO",
  "TECNICO",
  "LICENCIATURA",
  "MAESTRIA",
  "DOCTORADO",
] as const;
export type NivelEstudio = (typeof NIVELES_ESTUDIO)[number];
export const ETIQUETA_ESTUDIO: Record<NivelEstudio, string> = {
  NINGUNO: "Sin requisito",
  SECUNDARIA: "Secundaria",
  BACHILLERATO: "Bachillerato / Preparatoria",
  TECNICO: "Técnico / TSU",
  LICENCIATURA: "Licenciatura / Ingeniería",
  MAESTRIA: "Maestría / Especialidad",
  DOCTORADO: "Doctorado",
};

export const NIVELES_IDIOMA = ["BASICO", "INTERMEDIO", "AVANZADO", "NATIVO"] as const;
export type NivelIdioma = (typeof NIVELES_IDIOMA)[number];
export const ETIQUETA_IDIOMA: Record<NivelIdioma, string> = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
  NATIVO: "Nativo",
};

export const MODALIDADES = ["PRESENCIAL", "HIBRIDO", "REMOTO"] as const;
export type Modalidad = (typeof MODALIDADES)[number];
export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrido",
  REMOTO: "Remoto",
};

export const CATEGORIAS = ["EXCELENTE", "BUENO", "PASABLE", "REVISION", "NO_VIABLE"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
/** Al ajustar manualmente se decide una categoría final: «Pendiente de revisión» no es una opción. */
export const CATEGORIAS_AJUSTE = ["EXCELENTE", "BUENO", "PASABLE", "NO_VIABLE"] as const;
export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  EXCELENTE: "Excelente",
  BUENO: "Bueno",
  PASABLE: "Pasable",
  REVISION: "Pendiente de revisión",
  NO_VIABLE: "No viable",
};
