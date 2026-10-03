# Guía de despliegue a producción

Banco de CVs corre en un solo servidor: Node.js 22 y SQLite, detrás de un proxy inverso con HTTPS. Hay dos formas de instalarlo: **Docker** (recomendada) o **directo en una VM con systemd**. En las dos, los datos viven en tres carpetas que deben estar en disco persistente:

| Carpeta | Contenido | Respaldo |
|---|---|---|
| `data/` | Base de datos SQLite (`banco.db`) | Sí, con `npm run respaldo` |
| `storage/` (o `STORAGE_DIR`) | Archivos de CVs (nombres UUID, nunca públicos) | Sí, va dentro del respaldo |
| `respaldos/` | Copias generadas por `npm run respaldo` | Fuera del servidor, si TI lo requiere |

## 1. Antes del primer despliegue (lista de verificación)

- [ ] **Revocar** las claves de IA que se compartieron durante el desarrollo y generar claves nuevas.
- [ ] **Aviso de privacidad** revisado por el área jurídica (`AVISO_PRIVACIDAD_BORRADOR.md`) y publicado.
- [ ] **Plan de los proveedores de IA:** los planes gratuitos de Gemini y Groq tienen límites bajos, y el de Gemini puede usar los datos para entrenar. Para producción se recomiendan planes de pago.
- [ ] **Dominio y certificado HTTPS** (por ejemplo `cvs.empresa.mx`).
- [ ] **Respaldo** de cualquier `data/` y `storage/` existentes. La purga de 1 día se ejecuta al arrancar y borra lo que tenga más de 1 día de inactividad.

## 2. Variables de entorno

Se definen en el servidor, nunca en el repositorio. Parte de `.env.example`.

| Variable | Obligatoria | Ejemplo / nota |
|---|---|---|
| `AUTH_SECRET` | Sí | `openssl rand -base64 32` (mínimo 32 caracteres) |
| `AUTH_URL` | Sí | `https://cvs.empresa.mx` (https obligatorio, salvo en localhost) |
| `ALLOWED_DOMAINS` | Sí | `empresa.mx` (dominios de correo permitidos, separados por coma) |
| `DATABASE_URL` | No | `file:./data/banco.db` (valor por defecto) |
| `STORAGE_DIR` | No | Carpeta de los archivos de CVs, absoluta o relativa a la carpeta de ejecución (por defecto `./storage`). La usan la app, `npm run purgar` y `npm run respaldo`; en una VM conviene una ruta absoluta para que no dependa de desde dónde se ejecutan |
| `CONSERVACION_DIAS` | No | `1` (entero ≥ 1; días que se conservan los CVs) |
| `IA_PROVEEDORES` | No | `groq,gemini` (orden de respaldo) |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | Para analizar | Sin ninguna clave, el repositorio funciona pero el análisis no |
| `GEMINI_MODEL` | No | Lista de modelos separados por coma (ver `.env.example`) |
| `IA_MODELOS_LIGEROS` | No | Modelos menos precisos (por defecto, los que contienen «lite») |
| `RESPALDO_DIR`, `RESPALDO_DIAS` | No | Carpeta y días de conservación de los respaldos (por defecto `./respaldos` y el mismo plazo que los CVs) |

**Validación al arrancar:** en producción, si falta una variable obligatoria o tiene un valor inválido, el servidor **no arranca** y el registro explica por qué. Los valores secretos nunca se imprimen.

## 3. Opción A: Docker (recomendada)

```bash
docker build -t banco-cvs .
docker run -d --name banco-cvs --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --env-file /etc/banco-cvs/env \
  -v /srv/banco-cvs/data:/app/data \
  -v /srv/banco-cvs/storage:/app/storage \
  -v /srv/banco-cvs/respaldos:/app/respaldos \
  banco-cvs
```

- Al arrancar, el contenedor aplica las migraciones pendientes (`prisma migrate deploy`) y luego inicia la app.
- `/etc/banco-cvs/env` debe tener permisos `600` y pertenecer a root.
- Las carpetas montadas deben poder escribirse por el usuario `1001` del contenedor: `chown -R 1001:1001 /srv/banco-cvs`.
- El contenedor tiene un `HEALTHCHECK` contra `/api/salud`.

**Crear el primer Admin (una sola vez):**

```bash
docker exec -it banco-cvs npm run crear-admin -- admin@empresa.mx "Nombre del Admin"
```

El comando imprime una contraseña temporal una sola vez. Al entrar por primera vez se pide cambiarla.

## 4. Opción B: VM con systemd (sin Docker)

1. Instala Node.js 22, `python3`, `make`, `g++` y `openssl`. Las herramientas de compilación son para `better-sqlite3`.
2. Clona el repositorio en `/opt/banco-cvs` con un usuario de servicio sin privilegios (`banco`).
3. Instala, compila y migra:
   ```bash
   npm ci && npm run build && npm run db:migrar
   ```
4. Crea `/etc/systemd/system/banco-cvs.service`:
   ```ini
   [Unit]
   Description=Banco de CVs
   After=network.target

   [Service]
   User=banco
   WorkingDirectory=/opt/banco-cvs
   EnvironmentFile=/etc/banco-cvs/env
   Environment=NODE_ENV=production PORT=3000
   ExecStart=/usr/bin/npx next start -H 127.0.0.1
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   ```
5. Activa el servicio y crea el Admin:
   ```bash
   systemctl enable --now banco-cvs
   npm run crear-admin -- admin@empresa.mx "Nombre"
   ```

## 5. Proxy inverso con HTTPS (Caddy, ejemplo)

```
cvs.empresa.mx {
    reverse_proxy 127.0.0.1:3000
    request_body {
        max_size 12MB
    }
}
```

Caddy obtiene y renueva el certificado solo. Con nginx, usa `client_max_body_size 12m;` y `proxy_set_header Host $host;`.

## 6. Tareas programadas

| Tarea | Cómo | Frecuencia |
|---|---|---|
| Purga de CVs vencidos | Automática dentro del servidor; también a mano con `npm run purgar` | Al arrancar y cada hora |
| Respaldo | `npm run respaldo` por cron (Docker: `docker exec banco-cvs npm run respaldo`) | Diario |
| Monitoreo | `GET /api/salud` → `{"ok":true}` | Cada minuto |

La purga también borra los archivos que ya no tienen un CV en la base («huérfanos»). Solo lo hace si al menos un archivo de la carpeta de CVs corresponde a un CV de la base; si ninguno coincide (por ejemplo, `DATABASE_URL` o `STORAGE_DIR` apuntan a otra instalación), no borra nada y deja un aviso en el registro.

Los respaldos contienen CVs. Por eso, por defecto se conservan el mismo plazo que los CVs (1 día). Si TI necesita respaldos más largos, ajusta `RESPALDO_DIAS` y declara ese plazo en el aviso de privacidad.

## 7. Actualizar a una versión nueva

1. Haz un respaldo: `npm run respaldo`.
2. Docker: `docker build` y vuelve a crear el contenedor, porque las migraciones se aplican solas.
3. VM: `git pull && npm ci && npm run build && npm run db:migrar && systemctl restart banco-cvs`.

## 8. Restaurar un respaldo

1. Detén la app.
2. Copia `respaldo-*/banco.db` a `data/banco.db` y `respaldo-*/storage/` a `storage/` (o a la carpeta de `STORAGE_DIR`).
3. Arranca la app.

La purga borrará al arrancar los CVs que ya hayan vencido.

## 9. Lo que no cubre esta guía

- **Inicio de sesión con Microsoft Entra ID:** ver `MIGRACION_MICROSOFT.md`.
- **Más de una instancia:** el límite de análisis y la purga viven en memoria de un solo proceso. Para escalar hay que llevarlos a la base de datos.
