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
# Cachés de npm y Prisma en /tmp: con --read-only, /tmp es un tmpfs (ver DESPLIEGUE.md).
ENV NODE_ENV=production \
    PORT=3000 \
    NPM_CONFIG_CACHE=/tmp/.npm \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    CHECKPOINT_DISABLE=1
# Prisma necesita OpenSSL para detectar y usar su motor de migraciones (ya incluido en node_modules).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 1001 app
# La app queda como root (solo lectura para `app`): el usuario del servicio solo escribe en los datos y en la
# caché de Next.js (.next/cache, que `next start` usa para su caché en disco).
COPY --from=build /app ./
RUN mkdir -p data storage respaldos .next/cache \
 && chown app:app data storage respaldos .next/cache
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Aplica las migraciones pendientes y arranca. La configuración se valida al iniciar (src/instrumentation.ts).
# Binarios locales (sin npx): no necesitan escribir en la caché de npm.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/next start"]
