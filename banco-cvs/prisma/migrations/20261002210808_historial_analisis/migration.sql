-- CreateTable
CREATE TABLE "RegistroAnalisis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analisisId" TEXT NOT NULL,
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
    "modelo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistroAnalisis_analisisId_key" ON "RegistroAnalisis"("analisisId");

-- CreateIndex
CREATE INDEX "RegistroAnalisis_fecha_idx" ON "RegistroAnalisis"("fecha");

-- CreateIndex
CREATE INDEX "RegistroAnalisis_area_idx" ON "RegistroAnalisis"("area");

-- CreateIndex
CREATE INDEX "RegistroAnalisis_vacanteId_idx" ON "RegistroAnalisis"("vacanteId");

-- Carga inicial: los análisis existentes pasan al historial.
-- La categoría calculada usa los umbrales vigentes al migrar (o 85/70/55 si nunca se configuraron).
INSERT INTO "RegistroAnalisis" (
    "id", "analisisId", "cvId", "vacanteId", "vacanteTitulo", "area", "fecha", "veredicto", "puntaje",
    "categoria", "categoriaFinal", "ajustada", "modelo", "usuarioId", "usuarioNombre"
)
SELECT
    'hist_' || b."id", b."id", b."cvId", b."vacanteId", b."titulo", b."area", b."creadoEn", b."veredicto", b."puntaje",
    b."calculada",
    COALESCE(
        (SELECT aj."categoria" FROM "AjusteCategoria" aj WHERE aj."analisisId" = b."id" ORDER BY aj."creadoEn" DESC LIMIT 1),
        b."calculada"
    ),
    EXISTS (SELECT 1 FROM "AjusteCategoria" aj WHERE aj."analisisId" = b."id"),
    b."modelo", b."creadoPorId", b."usuarioNombre"
FROM (
    SELECT
        a."id", a."cvId", a."vacanteId", v."titulo", v."area", a."creadoEn", a."veredicto", a."puntaje", a."modelo",
        a."creadoPorId", us."nombre" AS "usuarioNombre",
        CASE
            WHEN a."veredicto" = 'REVISION' THEN 'REVISION'
            WHEN a."veredicto" = 'NO_VIABLE' OR a."puntaje" < COALESCE(u."pasable", 55) THEN 'NO_VIABLE'
            WHEN a."puntaje" >= COALESCE(u."excelente", 85) THEN 'EXCELENTE'
            WHEN a."puntaje" >= COALESCE(u."bueno", 70) THEN 'BUENO'
            ELSE 'PASABLE'
        END AS "calculada"
    FROM "Analisis" a
    JOIN "Vacante" v ON v."id" = a."vacanteId"
    JOIN "Usuario" us ON us."id" = a."creadoPorId"
    LEFT JOIN "ConfiguracionUmbrales" u ON u."id" = 1
) b;
