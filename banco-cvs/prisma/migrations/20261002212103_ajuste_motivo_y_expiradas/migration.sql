-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AjusteCategoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analisisId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT 'OTRO',
    "comentario" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AjusteCategoria_analisisId_fkey" FOREIGN KEY ("analisisId") REFERENCES "Analisis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AjusteCategoria_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AjusteCategoria" ("analisisId", "autorId", "categoria", "comentario", "creadoEn", "id") SELECT "analisisId", "autorId", "categoria", "comentario", "creadoEn", "id" FROM "AjusteCategoria";
DROP TABLE "AjusteCategoria";
ALTER TABLE "new_AjusteCategoria" RENAME TO "AjusteCategoria";
CREATE INDEX "AjusteCategoria_analisisId_idx" ON "AjusteCategoria"("analisisId");
CREATE TABLE "new_RegistroAnalisis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analisisId" TEXT,
    "cvId" TEXT NOT NULL,
    "vacanteId" TEXT NOT NULL,
    "vacanteTitulo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "veredicto" TEXT NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "categoriaFinal" TEXT NOT NULL,
    "ajustada" BOOLEAN NOT NULL DEFAULT false,
    "ajustadaPor" TEXT,
    "fechaAjuste" DATETIME,
    "motivoAjuste" TEXT,
    "horasHastaAjuste" REAL,
    "expiroSinRevision" BOOLEAN NOT NULL DEFAULT false,
    "posibleManipulacion" BOOLEAN NOT NULL DEFAULT false,
    "modelo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL
);
INSERT INTO "new_RegistroAnalisis" ("ajustada", "ajustadaPor", "analisisId", "area", "categoria", "categoriaFinal", "cvId", "fecha", "fechaAjuste", "id", "modelo", "posibleManipulacion", "puntaje", "usuarioId", "usuarioNombre", "vacanteId", "vacanteTitulo", "veredicto") SELECT "ajustada", "ajustadaPor", "analisisId", "area", "categoria", "categoriaFinal", "cvId", "fecha", "fechaAjuste", "id", "modelo", "posibleManipulacion", "puntaje", "usuarioId", "usuarioNombre", "vacanteId", "vacanteTitulo", "veredicto" FROM "RegistroAnalisis";
DROP TABLE "RegistroAnalisis";
ALTER TABLE "new_RegistroAnalisis" RENAME TO "RegistroAnalisis";
CREATE UNIQUE INDEX "RegistroAnalisis_analisisId_key" ON "RegistroAnalisis"("analisisId");
CREATE INDEX "RegistroAnalisis_fecha_idx" ON "RegistroAnalisis"("fecha");
CREATE INDEX "RegistroAnalisis_area_idx" ON "RegistroAnalisis"("area");
CREATE INDEX "RegistroAnalisis_vacanteId_idx" ON "RegistroAnalisis"("vacanteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Horas hasta el último ajuste, para los registros que ya tenían uno.
UPDATE "RegistroAnalisis"
SET "horasHastaAjuste" = ROUND((julianday("fechaAjuste") - julianday("fecha")) * 24)
WHERE "fechaAjuste" IS NOT NULL;

-- Registros de CVs que ya se eliminaron antes de existir el seudónimo: se desligan igual que en la purga.
-- Un seudónimo por CV (para seguir contando CVs distintos), análisis en nulo, fechas redondeadas al día (CDMX)
-- y los que seguían pendientes de revisión quedan como «expiró sin revisión».
CREATE TEMP TABLE "SeudonimoCv" AS
SELECT "cvId", 'seudonimo-' || lower(hex(randomblob(16))) AS "nuevo"
FROM (
    SELECT DISTINCT "cvId" FROM "RegistroAnalisis"
    WHERE "analisisId" IS NOT NULL AND "analisisId" NOT IN (SELECT "id" FROM "Analisis")
);

UPDATE "RegistroAnalisis"
SET
    "expiroSinRevision" = ("categoriaFinal" = 'REVISION'),
    "analisisId" = NULL,
    "fecha" = date("fecha", '-6 hours') || 'T06:00:00.000+00:00',
    "fechaAjuste" = CASE WHEN "fechaAjuste" IS NULL THEN NULL ELSE date("fechaAjuste", '-6 hours') || 'T06:00:00.000+00:00' END,
    "cvId" = (SELECT s."nuevo" FROM "SeudonimoCv" s WHERE s."cvId" = "RegistroAnalisis"."cvId")
WHERE "cvId" IN (SELECT "cvId" FROM "SeudonimoCv")
  AND "analisisId" IS NOT NULL AND "analisisId" NOT IN (SELECT "id" FROM "Analisis");

DROP TABLE "SeudonimoCv";
