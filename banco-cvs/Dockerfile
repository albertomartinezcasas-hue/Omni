# Imagen de producción de Banco de CVs (Next.js + SQLite).
# Los datos viven en volúmenes: /app/data (base), /app/storage (CVs) y /app/respaldos.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=file:./data/banco.db

# Dependencias (better-sqlite3 se compila: requiere python3, make y g++).
FROM base AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS run
ENV NODE_ENV=production \
    PORT=3000
# Prisma necesita OpenSSL para detectar y usar su motor de migraciones (ya incluido en node_modules).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 1001 app \
 && mkdir -p data storage respaldos \
 && chown app:app data storage respaldos
COPY --from=build --chown=app:app /app ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Aplica las migraciones pendientes y arranca. La configuración se valida al iniciar (src/instrumentation.ts).
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start"]
