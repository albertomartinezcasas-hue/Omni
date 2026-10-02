"use client";

export default function ErrorGlobal({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es-MX">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Algo salió mal</h1>
        <p>No pudimos cargar Banco de CVs. Intenta de nuevo; si el problema sigue, avisa a un Admin.</p>
        <button type="button" onClick={reset}>Intentar de nuevo</button>
      </body>
    </html>
  );
}
