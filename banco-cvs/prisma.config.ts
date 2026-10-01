import { defineConfig, env } from "prisma/config";

// Prisma 7 ya no carga .env automáticamente.
try {
  process.loadEnvFile(".env");
} catch {
  // Sin .env: se usan las variables del entorno del proceso.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
