-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "correo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "hashContrasena" TEXT,
    "debeCambiarContrasena" BOOLEAN NOT NULL DEFAULT true,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" DATETIME,
    "versionSesion" INTEGER NOT NULL DEFAULT 0,
    "oid" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    "creadoPorId" TEXT,
    CONSTRAINT "Usuario_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vacante" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "requisitosObligatorios" TEXT NOT NULL,
    "requisitosDeseables" TEXT NOT NULL,
    "aniosMinimos" INTEGER NOT NULL,
    "nivelEstudiosMinimo" TEXT NOT NULL,
    "idiomas" TEXT NOT NULL,
    "modalidad" TEXT NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "version" INTEGER NOT NULL DEFAULT 1,
    "creadoPorId" TEXT NOT NULL,
    "actualizadoPorId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    "archivadaEn" DATETIME,
    CONSTRAINT "Vacante_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vacante_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cv" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombreCandidato" TEXT,
    "nombreArchivo" TEXT NOT NULL,
    "archivoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "textoExtraido" TEXT NOT NULL,
    "hashTexto" TEXT NOT NULL,
    "correoCandidato" TEXT,
    "estado" TEXT NOT NULL,
    "subidoPorId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cv_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Analisis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cvId" TEXT NOT NULL,
    "vacanteId" TEXT NOT NULL,
    "vacanteVersion" INTEGER NOT NULL,
    "vacanteSnapshot" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "veredicto" TEXT NOT NULL,
    "motivosNoViable" TEXT NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "puntajeO" REAL NOT NULL,
    "puntajeD" REAL,
    "puntajeE" REAL NOT NULL,
    "puntajeF" REAL NOT NULL,
    "resultado" TEXT NOT NULL,
    CONSTRAINT "Analisis_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Analisis_vacanteId_fkey" FOREIGN KEY ("vacanteId") REFERENCES "Vacante" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Analisis_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AjusteCategoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analisisId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "comentario" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AjusteCategoria_analisisId_fkey" FOREIGN KEY ("analisisId") REFERENCES "Analisis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AjusteCategoria_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConfiguracionUmbrales" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "excelente" INTEGER NOT NULL DEFAULT 85,
    "bueno" INTEGER NOT NULL DEFAULT 70,
    "pasable" INTEGER NOT NULL DEFAULT 55,
    "actualizadoPorId" TEXT,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "ConfiguracionUmbrales_actualizadoPorId_fkey" FOREIGN KEY ("actualizadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventoBitacora" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorNombre" TEXT NOT NULL,
    "actorCorreo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidadTipo" TEXT,
    "entidadId" TEXT,
    "detalle" TEXT,
    CONSTRAINT "EventoBitacora_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "Usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_oid_key" ON "Usuario"("oid");

-- CreateIndex
CREATE INDEX "Vacante_estado_idx" ON "Vacante"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Cv_archivoId_key" ON "Cv"("archivoId");

-- CreateIndex
CREATE INDEX "Cv_hashTexto_idx" ON "Cv"("hashTexto");

-- CreateIndex
CREATE INDEX "Cv_correoCandidato_idx" ON "Cv"("correoCandidato");

-- CreateIndex
CREATE INDEX "Cv_creadoEn_idx" ON "Cv"("creadoEn");

-- CreateIndex
CREATE INDEX "Analisis_vacanteId_puntaje_idx" ON "Analisis"("vacanteId", "puntaje");

-- CreateIndex
CREATE INDEX "Analisis_cvId_idx" ON "Analisis"("cvId");

-- CreateIndex
CREATE INDEX "AjusteCategoria_analisisId_idx" ON "AjusteCategoria"("analisisId");

-- CreateIndex
CREATE INDEX "EventoBitacora_fecha_idx" ON "EventoBitacora"("fecha");

-- CreateIndex
CREATE INDEX "EventoBitacora_actorId_idx" ON "EventoBitacora"("actorId");

-- CreateIndex
CREATE INDEX "EventoBitacora_accion_idx" ON "EventoBitacora"("accion");

-- Bitácora de auditoría de solo inserción: se impide modificar o borrar eventos.
CREATE TRIGGER "EventoBitacora_no_update" BEFORE UPDATE ON "EventoBitacora"
BEGIN
  SELECT RAISE(ABORT, 'La bitácora es de solo lectura');
END;

CREATE TRIGGER "EventoBitacora_no_delete" BEFORE DELETE ON "EventoBitacora"
BEGIN
  SELECT RAISE(ABORT, 'La bitácora es de solo lectura');
END;


-- Umbrales por defecto.
INSERT INTO "ConfiguracionUmbrales" ("id", "excelente", "bueno", "pasable", "actualizadoEn") VALUES (1, 85, 70, 55, CURRENT_TIMESTAMP);
