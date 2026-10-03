# Guía de despliegue a producción

Banco de CVs corre en un solo servidor: Node.js 22 y SQLite, detrás de un proxy inverso con HTTPS. Hay dos formas de instalarlo: **Docker** (recomendada) o **directo en una VM con systemd**. En las dos, los datos viven en tres carpetas que deben estar en disco persistente:

| Carpeta | Contenido | Respaldo |
|---|---|---|
| `data/` | Base de datos SQLite (`banco.db`) | Sí, con `npm run respaldo` |
| `storage/` (o `STORAGE_DIR`) | Archivos de CVs (nombres UUID, nunca públicos) | Sí, va dentro del respaldo |
| `respaldos/` | Copias generadas por `npm run respaldo` (completas y permanentes, ver §6) | Fuera del servidor, si TI lo requiere |

## 1. Antes del primer despliegue (lista de verificación)

- [ ] **Revocar** las claves de IA que se compartieron durante el desarrollo y generar claves nuevas.
- [ ] **Aviso de privacidad** revisado por el área jurídica (`AVISO_PRIVACIDAD_BORRADOR.md`) y publicado.
- [ ] **Plan de los proveedores de IA:** los planes gratuitos de Gemini y Groq tienen límites bajos, y el de Gemini puede usar los datos para entrenar. Para producción se recomiendan planes de pago.
- [ ] **Dominio y certificado HTTPS** (por ejemplo `cvs.empresa.mx`).
- [ ] **Respaldo** de cualquier `data/` y `storage/` existentes. La purga de 1 día se ejecuta al arrancar y borra lo que tenga más de 1 día de inactividad.
- [ ] **Probar la purga en un entorno de prueba** antes de producción: con una copia de la base y de `storage/`, ejecuta `npm run purgar` y revisa que borre solo lo vencido y que el conteo de huérfanos sea el esperado.
- [ ] **Responsable de los pendientes de revisión:** nombra a una persona que revise cada día los candidatos «Pendiente de revisión». Revisarlos no amplía el plazo: si no se decide la categoría a tiempo, el CV se elimina y queda en el historial como «expiró sin revisión».
- [ ] **Aviso de privacidad simplificado al candidato:** define cómo lo recibe antes de que se suba su CV (por ejemplo, en la convocatoria, en el correo con el que envía su CV o en el formulario de la bolsa de trabajo) y quién lo verifica. La app no lo muestra.

## 2. Variables de entorno

Se definen en el servidor, nunca en el repositorio. Parte de `.env.example`.

| Variable | Obligatoria | Ejemplo / nota |
|---|---|---|
| `AUTH_SECRET` | Sí | `openssl rand -base64 32` (mínimo 32 caracteres) |
| `AUTH_URL` | Sí | `https://cvs.empresa.mx` (https obligatorio; en producción, también en localhost) |
| `ALLOWED_DOMAINS` | Sí | `empresa.mx` (dominios de correo permitidos, separados por coma) |
| `DATABASE_URL` | No | `file:./data/banco.db` (valor por defecto) |
| `STORAGE_DIR` | No | Carpeta de los archivos de CVs, absoluta o relativa a la carpeta de ejecución (por defecto `./storage`). La usan la app, `npm run purgar` y `npm run respaldo`; en una VM conviene una ruta absoluta para que no dependa de desde dónde se ejecutan |
| `CONSERVACION_DIAS` | No | `1` (entero ≥ 1; días que se conservan los CVs) |
| `IA_PROVEEDORES` | No | `groq,gemini` (orden de respaldo) |
| `GROQ_API_KEY`, `GEMINI_API_KEY` | Para analizar | Sin ninguna clave, el repositorio funciona pero el análisis no |
| `GEMINI_MODEL` | No | Lista de modelos separados por coma (ver `.env.example`) |
| `IA_MODELOS_LIGEROS` | No | Modelos menos precisos (por defecto, los que contienen «lite») |
| `RESPALDO_DIR` | No | Carpeta de los respaldos (por defecto `./respaldos`) |
| `RESPALDO_DIAS` | No | Días que se conserva el respaldo **completo** (base y CVs). Por defecto, el mismo plazo que los CVs |
| `RESPALDO_PERMANENTE_DIAS` | No | Días que se conserva el respaldo **permanente** (sin datos de candidatos). Por defecto, `30` |

**Validación al arrancar:** en producción, si falta una variable obligatoria o tiene un valor inválido, el servidor **no arranca** y el registro explica por qué. Los valores secretos nunca se imprimen.

## 3. Opción A: Docker (recomendada)

```bash
docker build -t banco-cvs .
docker run -d --name banco-cvs --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /app/.next/cache:uid=1001,gid=1001 \
  --cap-drop=ALL \
  --security-opt no-new-privileges \
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
- **Endurecimiento:** el código de la app pertenece a root y el usuario `app` (1001) solo puede escribir en `data/`, `storage/`, `respaldos/` y `.next/cache`. Con `--read-only` el resto del sistema de archivos es de solo lectura:
  - `--tmpfs /tmp` es necesario para los archivos temporales (y las cachés de npm y de `tsx` al ejecutar `npm run respaldo` o `npm run purgar`);
  - `--tmpfs /app/.next/cache` es necesario porque `next start` guarda ahí su caché en disco. Es solo caché: se vuelve a generar si se pierde al reiniciar;
  - `--cap-drop=ALL` y `--security-opt no-new-privileges` quitan privilegios que la app no necesita.
  Pruébalo primero en el entorno de prueba: si algún comando falla por escritura, el registro dice en qué ruta.

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
4. Crea las carpetas de datos (`mkdir -p data storage respaldos .next/cache`, del usuario `banco`) y `/etc/systemd/system/banco-cvs.service`. Si usas `STORAGE_DIR` o `RESPALDO_DIR` fuera de `/opt/banco-cvs`, agrégalas a `ReadWritePaths`:
   ```ini
   [Unit]
   Description=Banco de CVs
   After=network.target

   [Service]
   User=banco
   WorkingDirectory=/opt/banco-cvs
   EnvironmentFile=/etc/banco-cvs/env
   Environment=NODE_ENV=production PORT=3000
   ExecStart=/opt/banco-cvs/node_modules/.bin/next start -H 127.0.0.1
   Restart=on-failure
   # Endurecimiento: solo puede escribir en sus datos y en la caché de Next.js.
   NoNewPrivileges=true
   ProtectSystem=strict
   ProtectHome=true
   PrivateTmp=true
   ReadWritePaths=/opt/banco-cvs/data /opt/banco-cvs/storage /opt/banco-cvs/respaldos /opt/banco-cvs/.next/cache

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

**Limita `/api/salud` a la red interna:** responde sin sesión, así que conviene que solo lo consulte el monitoreo. Con Caddy:

```
cvs.empresa.mx {
    @salud_externa {
        path /api/salud
        not remote_ip 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 127.0.0.1/8
    }
    respond @salud_externa 404
    reverse_proxy 127.0.0.1:3000
    request_body {
        max_size 12MB
    }
}
```

Ajusta los rangos a la red de tu monitoreo. Caddy obtiene y renueva el certificado solo. Con nginx, usa `client_max_body_size 12m;` y `proxy_set_header Host $host;`.

## 6. Tareas programadas

| Tarea | Cómo | Frecuencia |
|---|---|---|
| Purga de CVs vencidos | Automática dentro del servidor; también a mano con `npm run purgar` | Al arrancar y cada hora |
| Respaldo | `npm run respaldo` por cron (Docker: `docker exec banco-cvs npm run respaldo`) | Diario |
| Monitoreo | `GET /api/salud` → `{"ok":true}` | Cada minuto |

La purga también borra los archivos que ya no tienen un CV en la base («huérfanos»), con dos protecciones:

- solo barre si **la mayoría** (más del 50 %) de los archivos de la carpeta corresponde a CVs de la base. Si no (por ejemplo, `DATABASE_URL` o `STORAGE_DIR` apuntan a otra instalación, o se restauró una copia vieja de la base), no borra nada y deja un aviso en el registro;
- solo borra huérfanos más antiguos que el plazo de conservación más 2 horas: un CV legítimo nunca pasa del plazo sin actividad.

La cantidad de huérfanos borrados aparece en la salida de `npm run purgar` y en el evento «CV eliminado por plazo» de la bitácora.

**Respaldos en dos niveles.** Cada `npm run respaldo` crea, dentro de `RESPALDO_DIR`:

| Nivel | Carpeta | Contenido | Se conserva |
|---|---|---|---|
| Completo | `respaldo-<fecha>/` | `banco.db` y `storage/` (todos los datos, incluidos los CVs) | `RESPALDO_DIAS` (por defecto, el plazo de los CVs: 1 día) |
| Permanente | `permanente-<fecha>/` | Solo `banco.db`, sin CVs, análisis ni ajustes: historial, vacantes, usuarios, bitácora y umbrales | `RESPALDO_PERMANENTE_DIAS` (por defecto, 30 días) |

El respaldo completo contiene CVs: si TI necesita conservarlo más tiempo, ajusta `RESPALDO_DIAS` y declara ese plazo en el aviso de privacidad. El permanente no tiene datos de candidatos: el historial queda con seudónimos y la base se compacta (VACUUM) para no dejar restos. La rotación usa 1 hora de margen, para que con un cron diario el respaldo de ayer no sobreviva un día de más.

## 7. Actualizar a una versión nueva

1. Haz un respaldo: `npm run respaldo`.
2. Docker: `docker build` y vuelve a crear el contenedor, porque las migraciones se aplican solas.
3. VM: `git pull && npm ci && npm run build && npm run db:migrar && systemctl restart banco-cvs`.

## 8. Restaurar un respaldo

**Respaldo completo** (lo más reciente, con CVs):

1. Detén la app.
2. Copia `respaldo-*/banco.db` a `data/banco.db` y `respaldo-*/storage/` a `storage/` (o a la carpeta de `STORAGE_DIR`).
3. Arranca la app.

La purga borrará al arrancar los CVs que ya hayan vencido.

**Respaldo permanente** (cuando ya no hay un respaldo completo vigente, p. ej. tras perder el servidor):

1. Detén la app.
2. Copia `permanente-*/banco.db` a `data/banco.db`.
3. Vacía `storage/`: esa base no tiene CVs, así que sus archivos ya no corresponden a nada (la purga no los borra sola porque no coinciden con la base).
4. Arranca la app y aplica las migraciones si la versión cambió (`npm run db:migrar`; en Docker se aplican solas).

Se recuperan usuarios, vacantes, umbrales, historial y bitácora. Los CVs se vuelven a subir.

## 9. Lo que no cubre esta guía

- **Inicio de sesión con Microsoft Entra ID:** ver `MIGRACION_MICROSOFT.md`.
- **Más de una instancia:** el límite de análisis y la purga viven en memoria de un solo proceso. Para escalar hay que llevarlos a la base de datos.
