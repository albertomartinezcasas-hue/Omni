-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vacante" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "requisitosObligatorios" TEXT NOT NULL,
    "requisitosDeseables" TEXT NOT NULL,
    "aniosMinimos" INTEGER NOT NULL,
    "cuentanPracticas" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_Vacante" ("actualizadoEn", "actualizadoPorId", "aniosMinimos", "archivadaEn", "area", "creadoEn", "creadoPorId", "descripcion", "estado", "id", "idiomas", "modalidad", "nivelEstudiosMinimo", "requisitosDeseables", "requisitosObligatorios", "titulo", "ubicacion", "version") SELECT "actualizadoEn", "actualizadoPorId", "aniosMinimos", "archivadaEn", "area", "creadoEn", "creadoPorId", "descripcion", "estado", "id", "idiomas", "modalidad", "nivelEstudiosMinimo", "requisitosDeseables", "requisitosObligatorios", "titulo", "ubicacion", "version" FROM "Vacante";
DROP TABLE "Vacante";
ALTER TABLE "new_Vacante" RENAME TO "Vacante";
CREATE INDEX "Vacante_estado_idx" ON "Vacante"("estado");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
