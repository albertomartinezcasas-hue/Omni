import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Banco de CVs",
  description: "Herramienta interna de reclutamiento",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
