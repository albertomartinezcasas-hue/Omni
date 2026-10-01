# Banco de CVs — Plan (Fase 0)

> Estado: **propuesta en espera de aprobación**. Ningún código de la app se ha escrito todavía.
> Supuesto de despliegue a confirmar: **un único servidor Node.js (VM o contenedor) con disco persistente**, administrado por el equipo; **no** hosting serverless (SQLite + archivos locales).

---

## 1. Esquema de base de datos (Prisma + SQLite)

Convenciones:
- SQLite no maneja bien enums ni JSON nativo en todas las versiones de Prisma; los campos de catálogo se guardan como `String` y se validan con zod + tipos TypeScript (`"ADMIN" | "USUARIO"`, etc.). Las listas (requisitos, idiomas, resultado del análisis) se guardan como `String` con JSON validado por zod al leer y al escribir.
- Fechas en UTC; se muestran en hora de la Ciudad de México.
- Ningún registro de usuario se borra. Los CVs solo los borra un Admin (definitivo).

```prisma
model Usuario {
  id                     String    @id @default(cuid())
  correo                 String    @unique            // identificador único (normalizado a minúsculas)
  nombre                 String
  rol                    String                       // "ADMIN" | "USUARIO"
  activo                 Boolean   @default(true)
  hashContrasena         String?                      // bcryptjs costo 12; null solo tras migrar a Microsoft
  debeCambiarContrasena  Boolean   @default(true)     // contraseña temporal pendiente de cambio
  intentosFallidos       Int       @default(0)
  bloqueadoHasta         DateTime?
  versionSesion          Int       @default(0)        // se incrementa al desactivar, cambiar rol o contraseña → invalida JWT
  oid                    String?   @unique            // Microsoft Entra ID (vacío por ahora)
  creadoEn               DateTime  @default(now())
  actualizadoEn          DateTime  @updatedAt
  creadoPorId            String?
  creadoPor              Usuario?  @relation("UsuarioCreador", fields: [creadoPorId], references: [id])
  // relaciones inversas: usuarios creados, vacantes, cvs, analisis, ajustes, eventos de bitácora
}

model Vacante {
  id                      String   @id @default(cuid())
  titulo                  String
  area                    String
  descripcion             String
  requisitosObligatorios  String   // JSON: [{ id, texto }]
  requisitosDeseables     String   // JSON: [{ id, texto }] (puede ser [])
  aniosMinimos            Int      // años mínimos de experiencia relevante (≥ 0)
  nivelEstudiosMinimo     String   // NINGUNO | SECUNDARIA | BACHILLERATO | TECNICO | LICENCIATURA | MAESTRIA | DOCTORADO
  idiomas                 String   // JSON: [{ idioma, nivel: BASICO|INTERMEDIO|AVANZADO|NATIVO }]
  modalidad               String   // PRESENCIAL | HIBRIDO | REMOTO
  ubicacion               String
  estado                  String   @default("ACTIVA") // ACTIVA | ARCHIVADA
  version                 Int      @default(1)        // +1 en cada edición → análisis "Desactualizado"
  creadoPorId             String
  actualizadoPorId        String
  creadoEn                DateTime @default(now())
  actualizadoEn           DateTime @updatedAt
  archivadaEn             DateTime?
  analisis                Analisis[]
}

model Cv {
  id                  String   @id @default(cuid())
  nombreCandidato     String?  // obtenido del análisis (cita verificada) o capturado/corregido por el reclutador
  nombreArchivo       String   // nombre original, solo en BD
  archivoId           String   @unique // UUID = nombre del archivo en ./storage (sin extensión)
  tipo                String   // PDF | DOCX (detectado por firma)
  tamanoBytes         Int
  textoExtraido       String   // texto completo (búsqueda por palabra clave y verificación de citas)
  hashTexto           String   // SHA-256 del texto normalizado (duplicados)
  correoCandidato     String?  // primer correo encontrado por regex, minúsculas (duplicados)
  estado              String   // CON_TEXTO | SIN_TEXTO_LEGIBLE
  subidoPorId         String
  creadoEn            DateTime @default(now())
  analisis            Analisis[]
  @@index([hashTexto])
  @@index([correoCandidato])
  @@index([creadoEn])
}

model Analisis {
  id                 String   @id @default(cuid())
  cvId               String   // onDelete: Cascade (al borrar el CV)
  vacanteId          String
  vacanteVersion     Int      // versión de la vacante analizada (≠ actual → "Desactualizado")
  modelo             String   // valor de ANTHROPIC_MODEL usado
  creadoPorId        String
  creadoEn           DateTime @default(now())
  veredicto          String   // VIABLE | NO_VIABLE (calculado en código)
  motivosNoViable    String   // JSON: ["No se encontró evidencia de: …"]
  puntaje            Int      // 0–100 (calculado en código)
  puntajeO           Float
  puntajeD           Float?   // null si la vacante no tiene deseables
  puntajeE           Float
  puntajeF           Float
  resultado          String   // JSON verificado: evidencias por requisito, años y puestos, estudios, idiomas,
                              // cualidades (con cita), brechas, preguntas de entrevista
  ajustes            AjusteCategoria[]
  @@index([vacanteId, puntaje])
  @@index([cvId])
}

model AjusteCategoria {          // historial de cambios manuales; el más reciente prevalece
  id           String   @id @default(cuid())
  analisisId   String   // onDelete: Cascade
  categoria    String   // EXCELENTE | BUENO | PASABLE | NO_VIABLE
  comentario   String   // obligatorio
  autorId      String
  creadoEn     DateTime @default(now())
}

model ConfiguracionUmbrales {    // una sola fila (id = 1)
  id               Int      @id @default(1)
  excelente        Int      @default(85)
  bueno            Int      @default(70)
  pasable          Int      @default(55)
  actualizadoPorId String?
  actualizadoEn    DateTime @updatedAt
}

model EventoBitacora {           // solo inserción
  id           String   @id @default(cuid())
  fecha        DateTime @default(now())
  actorId      String?  // null en intentos de inicio de sesión con correo inexistente
  actorNombre  String   // copia al momento del evento
  actorCorreo  String   // copia al momento del evento (o correo intentado)
  accion       String   // p. ej. LOGIN_OK, LOGIN_FALLIDO, CUENTA_BLOQUEADA, CONTRASENA_CAMBIADA, CONTRASENA_RESTABLECIDA,
                        // USUARIO_CREADO, USUARIO_ROL_CAMBIADO, USUARIO_DESACTIVADO, USUARIO_REACTIVADO,
                        // CV_SUBIDO, CV_DESCARGADO, CV_ELIMINADO, ANALISIS_REALIZADO, CATEGORIA_AJUSTADA,
                        // VACANTE_CREADA, VACANTE_EDITADA, VACANTE_ARCHIVADA, UMBRALES_CAMBIADOS
  entidadTipo  String?  // USUARIO | CV | ANALISIS | VACANTE | UMBRALES
  entidadId    String?
  detalle      String?  // JSON sin contraseñas ni texto del CV (p. ej. rol anterior → nuevo, nombre del archivo)
  @@index([fecha])
  @@index([actorId])
}
```

Notas:
- **Autoría de cada acción**: `creadoPorId`/`actualizadoPorId`/`subidoPorId`/`autorId` en cada tabla + `EventoBitacora` con copia de nombre y correo (sobrevive a cambios del usuario).
- **Bitácora inmutable**: la app no expone ninguna operación de actualización o borrado sobre `EventoBitacora`; además la migración agrega triggers de SQLite que abortan `UPDATE` y `DELETE` en esa tabla.
- **Análisis múltiples**: un `Cv` tiene N `Analisis` (uno por vacante y por re-análisis). La vista por vacante muestra el más reciente de cada CV.
- **Categoría**: no se guarda; se calcula al mostrar con `puntaje` + `ConfiguracionUmbrales` vigente. Si `veredicto = NO_VIABLE` la categoría es NO VIABLE. Si existe `AjusteCategoria`, prevalece y se muestra "Ajustada por [nombre]" junto a la calculada.
- **Escolaridad** (orden): Ninguno < Secundaria < Bachillerato < Técnico/TSU < Licenciatura/Ingeniería < Maestría/Especialidad < Doctorado. **Idiomas**: Básico < Intermedio < Avanzado < Nativo.

---

## 2. Pantallas por rol

| Ruta | Pantalla | Usuario | Admin |
|---|---|---|---|
| `/login` | Iniciar sesión (público) | ✅ | ✅ |
| `/cambiar-contrasena` | Cambio obligatorio de contraseña temporal. Mientras `debeCambiarContrasena = true`, **toda** página, acción o API redirige/rechaza hacia aquí | ✅ | ✅ |
| `/cuenta` | Cambiar mi contraseña | ✅ | ✅ |
| `/` → `/vacantes` | Lista de vacantes (activas y archivadas en pestaña aparte, solo lectura) | ✅ | ✅ + botones Crear / Editar / Archivar |
| `/vacantes/[id]` | Vista por vacante: candidatos agrupados Excelente / Bueno / Pasable / No viable, ordenados por puntaje; marca "Desactualizado"; botón **"Subir y analizar CVs"** | ✅ | ✅ |
| `/vacantes/nueva`, `/vacantes/[id]/editar` | Formulario de vacante | ❌ | ✅ |
| `/cvs` | Repositorio: búsqueda (nombre, palabra clave) y filtros (vacante, categoría, fecha de carga, quién subió) | ✅ | ✅ |
| `/cvs/subir?vacante=…` | Carga múltiple (≤ 20) con cola visible, aviso de duplicados y "Reintentar" | ✅ | ✅ |
| `/cvs/[id]` | Detalle del CV: descargar, análisis existentes, "Analizar contra otra vacante" | ✅ | ✅ + "Eliminar definitivamente" |
| `/analisis/[id]` | Resultado: veredicto, categoría, puntaje, desglose O/D/E/F, evidencia por requisito, cualidades con cita, brechas, preguntas, modelo y fecha; "Cambiar categoría" (con comentario); "Re-analizar" | ✅ | ✅ |
| `/admin/usuarios` | Alta, cambio de rol, desactivar/reactivar, restablecer contraseña (con confirmación; contraseña temporal mostrada una vez) | ❌ | ✅ |
| `/admin/umbrales` | Editar umbrales de categoría | ❌ | ✅ |
| `/admin/bitacora` | Bitácora (solo lectura, filtros por fecha, usuario y acción) | ❌ | ✅ |

- El menú del Usuario no muestra enlaces de Admin; si entra por URL directa a `/admin/*` o a formularios de vacante, recibe una página "No tienes permiso" (403) generada en el servidor.
- **Carga → veredicto en 3 clics**: (1) en la vacante, clic en "Subir y analizar CVs"; (2) seleccionar archivos en el diálogo (al confirmarlo, la cola inicia sola); (3) clic en "Ver resultado" en la fila del archivo. Desde `/cvs/subir` sin vacante preseleccionada se agrega un paso (elegir vacante).
- Primer acceso: `/login` → `/cambiar-contrasena` (contraseña actual temporal + nueva + confirmación) → `/vacantes`.
- Colores semánticos con texto siempre visible: Excelente verde, Bueno azul, Pasable ámbar, No viable gris.

---

## 3. Estructura de carpetas

```
banco-cvs/
├── .claude/agents/              # experto-reclutamiento, ux-ui-reviewer, revisor-seguridad
├── .env.example                 # nombres de variables, sin secretos
├── .gitignore                   # .env, storage/, data/, *.db, .next, node_modules
├── MIGRACION_MICROSOFT.md
├── PENDIENTES.md
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── prisma.config.ts
├── scripts/
│   └── crear-admin.ts           # npm run crear-admin -- correo "Nombre"
├── storage/                     # archivos de CV (UUID), privado, fuera de /public
├── data/                        # banco.db (SQLite)
├── src/
│   ├── app/
│   │   ├── login/  cambiar-contrasena/  cuenta/
│   │   ├── (app)/               # layout autenticado: vacantes/, cvs/, analisis/, admin/
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── cvs/route.ts                 # POST carga (multipart, ≤10 MB)
│   │       ├── cvs/[id]/descargar/route.ts  # GET autenticado
│   │       └── analisis/route.ts            # POST analizar CV × vacante
│   ├── components/              # UI (badges de categoría, diálogos de confirmación, cola de carga…)
│   ├── lib/
│   │   ├── auth/                # TODO lo de autenticación: config Auth.js, credenciales, bloqueo,
│   │   │                        # contraseñas, sesión; exporta obtenerUsuarioActual() y requerirRol(rol)
│   │   ├── db.ts                # cliente Prisma
│   │   ├── bitacora.ts          # registrarEvento() (solo inserción)
│   │   ├── usuarios/            # alta, rol, activar, restablecer, protección último Admin
│   │   ├── vacantes/
│   │   ├── archivos/            # firma PDF/DOCX, extracción de texto, almacenamiento, duplicados
│   │   ├── analizador/          # ocultar.ts, prompt.ts, esquema.ts (zod), cliente.ts, verificar.ts,
│   │   │                        # puntaje.ts, categoria.ts, atributosProtegidos.ts
│   │   └── validacion/          # esquemas zod de formularios
│   └── proxy.ts                 # redirección gruesa a /login (la autorización real va en cada acción/ruta)
└── tests/                       # Vitest: auth, permisos, motor de evaluación, archivos
```

---

## 4. Dependencias (versiones estables al 2026-10-01)

| Paquete | Uso | Justificación |
|---|---|---|
| `next` 16.x, `react`, `react-dom` 19.x | Framework | Exigido por el stack (App Router). |
| `typescript`, `@types/node`, `@types/react`, `@types/react-dom` | Tipado | Exigido; `tsc --noEmit`. |
| `tailwindcss` 4.x, `@tailwindcss/postcss` | Estilos | Exigido. |
| `eslint`, `eslint-config-next` | Lint | `npm run lint`. |
| `prisma` 7.10 (dev), `@prisma/client` 7.10 | ORM | Exigido. Se fija 7.10 (la etiqueta `latest` de npm apunta a un 8.0 RC, no estable). |
| `@prisma/adapter-better-sqlite3`, `better-sqlite3` | Driver SQLite | Prisma 7 requiere adaptador de driver para SQLite. |
| `next-auth` 5 (Auth.js, beta.32) | Sesión | Exigido ("Auth.js"). v5 es Auth.js; aún publicado como beta. Alternativa estable: v4.24 con la misma lógica en `src/lib/auth/`. **Recomiendo v5.** |
| `bcryptjs` 3.x | Hash de contraseñas | Exigido; costo 12; JS puro (sin compilación nativa). |
| `zod` 4.x | Validación | Exigido: formularios, JSON del analizador, JSON almacenado. |
| `@anthropic-ai/sdk` | Analizador | Exigido; soporta `timeout` y `maxRetries` para el límite de 60 s. |
| `unpdf` | Texto de PDF | Basado en pdf.js, sin dependencias nativas, funciona en Node sin configuración especial de bundling (a diferencia de `pdf-parse`). |
| `mammoth` | Texto de DOCX | `extractRawText`, estándar de facto, sin dependencias nativas. |
| `vitest` (dev) | Pruebas | Exigido. |
| `tsx` (dev) | Ejecutar `scripts/crear-admin.ts` | Ejecuta TypeScript sin compilación previa. |
| `pdf-lib` (dev) | Fase 4 | Generar los 7 CVs ficticios en PDF (incluido texto oculto). Solo desarrollo. |

Sin dependencia extra para: firma de archivos (se verifica `%PDF-` y ZIP `PK\x03\x04` + `word/document.xml` en código), UUID y SHA-256 (`node:crypto`), contraseñas temporales (`crypto.randomInt`), cola de carga (cola propia en el cliente, máx. 3 simultáneos).

Variables de entorno (`.env.example`): `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-sonnet-5-5`, `AUTH_SECRET`, `ALLOWED_DOMAINS`, y además **`DATABASE_URL=file:./data/banco.db`** (Prisma la necesita; no es secreta). **Supuesto a confirmar.**

---

## 5. Diseño de acceso y seguridad (resumen)

- **Credenciales**: correo normalizado; si el correo no existe se ejecuta igualmente `bcrypt.compare` contra un hash ficticio (mismo tiempo de respuesta). Mensaje siempre "Correo o contraseña incorrectos" (también si la cuenta está bloqueada o desactivada).
- **Bloqueo**: al 5.º fallo consecutivo `bloqueadoHasta = ahora + 15 min` y evento `CUENTA_BLOQUEADA`; mientras dure, ni la contraseña correcta entra. Un inicio exitoso reinicia el contador. Restablecer contraseña también lo reinicia.
- **Sesión**: estrategia JWT de Auth.js (obligatoria con Credentials), cookie `httpOnly`, `secure`, `sameSite=lax`; `maxAge` 8 h **absoluto** (el token guarda la hora de inicio y se rechaza al pasar 8 h aunque haya actividad). El token solo contiene `id` y `versionSesion`.
- **Cada petición** (`obtenerUsuarioActual()`): lee el usuario en BD; rechaza si no existe, `activo = false`, `versionSesion` distinto o sesión > 8 h. El rol **siempre** viene de BD, nunca del token. `requerirRol(rol)` lanza 403. Si `debeCambiarContrasena`, todo salvo `/cambiar-contrasena` y cerrar sesión se rechaza.
- **Invalidación inmediata**: desactivar, cambiar rol, restablecer o cambiar contraseña → `versionSesion + 1`.
- **Último Admin**: desactivar o degradar se hace en transacción que cuenta Admins activos distintos del objetivo; si es 0, se rechaza.
- **Contraseñas temporales**: 16 caracteres aleatorios (CSPRNG, sin caracteres ambiguos); se devuelven una sola vez en la respuesta de la acción y no se guardan ni registran. Mínimo 12 caracteres para contraseñas nuevas; la nueva debe ser distinta de la actual.
- **CSRF**: server actions con verificación de origen de Next.js; route handlers `POST` validan el encabezado `Origin`.
- **Archivos**: límite de 10 MB verificado antes de leer el cuerpo completo; firma por contenido; nombre UUID; ruta construida solo con el UUID de BD (sin path traversal); descarga con `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` y evento `CV_DESCARGADO`.
- **Datos al modelo**: correos, teléfonos, URLs, CURP y RFC sustituidos antes de llamar a la API; el CV va dentro de `<cv>…</cv>` y el prompt de sistema indica que es solo un documento.
- **Atributos protegidos (regla crítica 4)**: el prompt prohíbe usarlos; además, en código, se descartan cualidades, brechas o preguntas que contengan términos protegidos (lista en `atributosProtegidos.ts`).
- **Secretos**: solo en `.env` (ignorado por git); la app no arranca el analizador si falta `ANTHROPIC_API_KEY`.
- **Sin bypass**: no hay usuarios semilla ni accesos alternos; el único modo de crear el primer Admin es `npm run crear-admin`, que se rechaza si ya existe un Admin activo. En pruebas, la sesión se simula solo dentro de `tests/`.

---

## 6. Motor de evaluación (cómo se implementará)

1. **Preparación** (código): sustituir `[CORREO]`, `[TELÉFONO]`, `[URL]`, `[CURP]`, `[RFC]` con expresiones regulares.
2. **Extracción** (IA): uso forzado de una herramienta con esquema JSON + validación zod; 1 reintento si es inválido; `timeout` 60 s; ante fallo no se guarda nada y se ofrece "Reintentar".
3. **Verificación** (código): cada cita se busca en el texto **ya ocultado** (el que vio el modelo) sin distinguir mayúsculas y con espacios normalizados (y normalización Unicode NFC). Cita inexistente → nivel 0 / cualidad descartada / puesto no contado. Los años relevantes se recalculan como la suma de los puestos con cita verificada.
4. **Veredicto y puntaje** (código) con las fórmulas exactas del documento; sin deseables, pesos 0.40/0.20/0.15 normalizados a 0.5333/0.2667/0.2000. E se acota a [0, 100].
5. **Categoría** al mostrar, con umbrales vigentes (validación: enteros, EXCELENTE > BUENO > PASABLE ≥ 1, máximo 100).
6. **Resultado** + modelo + fecha + `vacanteVersion` para "Desactualizado".

---

## 7. Opciones de servidor (un nodo Node.js + disco persistente)

Precios aproximados en USD/mes; **verificar en el portal de cada proveedor antes de contratar**.

| Opción | Configuración sugerida | Costo aprox. | Ventajas | Consideraciones |
|---|---|---|---|---|
| **A. Azure VM en región México Central** | B2s (2 vCPU, 4 GB) Ubuntu + disco administrado 32 GB + Azure Backup | ~US$35–50 | Datos en México (LFPDPPP); mismo ecosistema que Microsoft Entra ID (fase posterior); TI suele tener la suscripción | Más caro; requiere que TI dé acceso al grupo de recursos |
| **B. DigitalOcean Droplet** | 2 GB / 1 vCPU, 50 GB SSD + respaldos semanales | ~US$14–16 | Muy simple de operar; respaldos con un clic | Datos fuera de México (región más cercana: EE. UU.); revisar aviso de privacidad |
| **C. Servidor/VM interna de la empresa** | VM Linux existente con Docker o Node 22 + reverse proxy (Caddy/nginx) con HTTPS | ~US$0 incremental | Datos dentro de la red; sin contratos nuevos | Depende de TI para respaldos, parches y certificado HTTPS |

En todas: `next start` detrás de un reverse proxy con HTTPS, `storage/` y `data/` en disco persistente con respaldo diario. Costo adicional de la API de Anthropic según volumen (por análisis, no por servidor).

**Recomendación**: A si se priorizan residencia de datos e integración futura con Microsoft; B para validar rápido y barato con datos ficticios.

---

## 8. Supuestos y decisiones que necesitan tu confirmación

1. **Despliegue** en un único servidor Node.js con disco persistente (no serverless).
2. **`DATABASE_URL`** como variable adicional en `.env.example` (no secreta).
3. **Nombre del candidato**: la extracción de la IA incluirá `nombreCandidato` con cita verificada (necesario para "búsqueda por nombre"); el reclutador podrá corregirlo. Para CVs "Sin texto legible" se usa el nombre del archivo hasta que se capture.
4. **Ocultamiento adicional (regla 4)**: propongo además eliminar en el Paso 1 las líneas etiquetadas como edad, fecha de nacimiento, estado civil, sexo/género, nacionalidad y religión, y descartar en código salidas que mencionen atributos protegidos. Esto amplía el Paso 1; ¿lo apruebas?
5. **Auth.js v5 (beta)** en lugar de NextAuth v4 estable.
6. **Bitácora inmutable** reforzada con triggers de SQLite en la migración.
7. Para "Desactualizado" se usa un contador `version` en la vacante; archivar no cuenta como edición.
