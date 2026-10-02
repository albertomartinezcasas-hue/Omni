-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "posibleManipulacion" BOOLEAN NOT NULL DEFAULT false,
    "modelo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL
);
INSERT INTO "new_RegistroAnalisis" ("ajustada", "analisisId", "area", "categoria", "categoriaFinal", "cvId", "fecha", "id", "modelo", "puntaje", "usuarioId", "usuarioNombre", "vacanteId", "vacanteTitulo", "veredicto") SELECT "ajustada", "analisisId", "area", "categoria", "categoriaFinal", "cvId", "fecha", "id", "modelo", "puntaje", "usuarioId", "usuarioNombre", "vacanteId", "vacanteTitulo", "veredicto" FROM "RegistroAnalisis";
DROP TABLE "RegistroAnalisis";
ALTER TABLE "new_RegistroAnalisis" RENAME TO "RegistroAnalisis";
CREATE UNIQUE INDEX "RegistroAnalisis_analisisId_key" ON "RegistroAnalisis"("analisisId");
CREATE INDEX "RegistroAnalisis_fecha_idx" ON "RegistroAnalisis"("fecha");
CREATE INDEX "RegistroAnalisis_area_idx" ON "RegistroAnalisis"("area");
CREATE INDEX "RegistroAnalisis_vacanteId_idx" ON "RegistroAnalisis"("vacanteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Correcciones a la carga inicial para los análisis que aún existen:
-- título de la vacante tal como estaba al analizar, posible manipulación y último ajuste (quién y cuándo).
UPDATE "RegistroAnalisis"
SET
    "vacanteTitulo" = COALESCE(
        (SELECT json_extract(a."vacanteSnapshot", '$.titulo') FROM "Analisis" a WHERE a."id" = "RegistroAnalisis"."analisisId"),
        "vacanteTitulo"
    ),
    "posibleManipulacion" = COALESCE(
        (SELECT COALESCE(json_extract(a."resultado", '$.instruccionesOmitidas'), 0) > 0
             OR COALESCE(json_extract(a."resultado", '$.textoOcultoOmitido'), 0) > 0
         FROM "Analisis" a WHERE a."id" = "RegistroAnalisis"."analisisId"),
        0
    ),
    "ajustadaPor" = (
        SELECT us."nombre" FROM "AjusteCategoria" aj JOIN "Usuario" us ON us."id" = aj."autorId"
        WHERE aj."analisisId" = "RegistroAnalisis"."analisisId" ORDER BY aj."creadoEn" DESC LIMIT 1
    ),
    "fechaAjuste" = (
        SELECT aj."creadoEn" FROM "AjusteCategoria" aj
        WHERE aj."analisisId" = "RegistroAnalisis"."analisisId" ORDER BY aj."creadoEn" DESC LIMIT 1
    );
