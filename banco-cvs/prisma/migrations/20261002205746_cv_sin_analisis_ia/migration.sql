-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cv" (
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
    "sinAnalisisIA" BOOLEAN NOT NULL DEFAULT false,
    "subidoPorId" TEXT NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cv_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Cv" ("archivoId", "correoCandidato", "creadoEn", "estado", "hashTexto", "id", "nombreArchivo", "nombreCandidato", "subidoPorId", "tamanoBytes", "textoExtraido", "tipo") SELECT "archivoId", "correoCandidato", "creadoEn", "estado", "hashTexto", "id", "nombreArchivo", "nombreCandidato", "subidoPorId", "tamanoBytes", "textoExtraido", "tipo" FROM "Cv";
DROP TABLE "Cv";
ALTER TABLE "new_Cv" RENAME TO "Cv";
CREATE UNIQUE INDEX "Cv_archivoId_key" ON "Cv"("archivoId");
CREATE INDEX "Cv_hashTexto_idx" ON "Cv"("hashTexto");
CREATE INDEX "Cv_correoCandidato_idx" ON "Cv"("correoCandidato");
CREATE INDEX "Cv_creadoEn_idx" ON "Cv"("creadoEn");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
