/** Genera los 7 CVs ficticios de la Fase 4 en tests/fixtures/fase4/. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { CVS_FASE4 } from "./cvs";

const destino = path.join(process.cwd(), "tests", "fixtures", "fase4");
mkdirSync(destino, { recursive: true });

function partir(texto: string, ancho: number, medir: (t: string) => number) {
  const palabras = texto.split(" ");
  const renglones: string[] = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (medir(prueba) > ancho && actual) {
      renglones.push(actual);
      actual = p;
    } else actual = prueba;
  }
  renglones.push(actual);
  return renglones;
}

for (const cv of CVS_FASE4) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(cv.lineas[0]);
  const pagina = pdf.addPage([612, 792]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 740;
  cv.lineas.forEach((linea, i) => {
    const esTitulo = i === 0 || (linea === linea.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(linea) && !linea.includes("@"));
    const fuente = esTitulo ? negrita : normal;
    const tamano = i === 0 ? 16 : 10.5;
    if (!linea) {
      y -= 8;
      return;
    }
    for (const r of partir(linea, 512, (t) => fuente.widthOfTextAtSize(t, tamano))) {
      pagina.drawText(r, { x: 50, y, size: tamano, font: fuente, color: rgb(0.1, 0.1, 0.1) });
      y -= tamano + 5;
    }
  });
  if (cv.oculto) {
    // Texto blanco de 1 pt al pie de la página: no se ve, pero sí se extrae.
    let yo = 30;
    for (const r of partir(cv.oculto, 512, (t) => normal.widthOfTextAtSize(t, 1))) {
      pagina.drawText(r, { x: 50, y: yo, size: 1, font: normal, color: rgb(1, 1, 1) });
      yo -= 2;
    }
  }
  writeFileSync(path.join(destino, cv.archivo), await pdf.save());
  console.log("generado", cv.archivo);
}
