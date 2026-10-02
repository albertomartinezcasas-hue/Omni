# Pendientes (hallazgos Media y Baja)

Formato: [Prioridad] (Fase · Experto) descripción — estado

## Fase 0

### experto-reclutamiento
- [Media] Si se cambian los umbrales, cambia hacia atrás la categoría calculada de análisis y ajustes ya hechos; guardar en `AjusteCategoria` la categoría calculada previa y los umbrales aplicados, o mostrar "calculada con umbrales vigentes". — Pendiente (la regla actual del documento dice calcular al mostrar; requiere tu decisión).
- [Media] Al re-analizar, el ajuste manual previo queda oculto: mostrar en el análisis nuevo el aviso "Existe un ajuste previo de [nombre] en [fecha]…" con enlace. — Pendiente (Fase 3).
- [Media] Guardar una copia de la vacante en el análisis. — **Incorporado al plan** (`Analisis.vacanteSnapshot`).
- [Media] Declarar las relaciones Prisma con `@relation` y `onDelete`. — **Incorporado al plan.**
- [Baja] Registrar en la bitácora la corrección de `nombreCandidato` (`CV_NOMBRE_CORREGIDO`). — **Fase 2: hecho.**
- [Baja] Guardar en `detalle` de la bitácora identificadores legibles (archivo, candidato, vacante, categorías, comentario). — **Fase 1: hecho.**
- [Baja] Definir si un ajuste puede sacar a un candidato de NO VIABLE: agrupar por la categoría ajustada y mostrar siempre "Veredicto calculado: NO VIABLE (motivos)". — Pendiente (Fase 3).

### ux-ui-reviewer
- [Media] Confirmación al eliminar un CV y al archivar una vacante. — **Incorporado al plan.**
- [Media] Detallar la cola de carga: estados por fila, más de 20 archivos, textos de los motivos de error y aviso de duplicado dentro de la fila sin bloquear la cola. — Pendiente (Fase 3).
- [Media] Tras el cambio obligatorio de contraseña, emitir un token nuevo; en `/cambiar-contrasena`, mostrar las reglas y solo "Cerrar sesión". — **Fase 1: hecho.**
- [Media] Estado vacío y "Re-analizar" por fila en la vista por vacante. — **Incorporado al plan.**
- [Media] Criterios de accesibilidad: WCAG AA (insignias ámbar y gris), foco visible, teclado, 1366/1920 px sin scroll horizontal. — Pendiente (Fase 3).
- [Baja] `/cuenta` con los mismos campos y reglas que `/cambiar-contrasena`. — **Fase 1: hecho.**
- [Baja] Contraseña temporal con botón "Copiar" y el aviso "No volverá a mostrarse"; error claro al intentar desactivar o degradar al último Admin. — **Fase 1: hecho.**
- [Baja] Ambigüedad del filtro por categoría en `/cvs` con varios análisis: exigir elegir vacante o usar el análisis más reciente. — Pendiente (Fase 3).
- [Baja] Confirmación al guardar umbrales. — **Incorporado al plan.**

### revisor-seguridad
- [Media] Concentrar todo el manejo de contraseñas y sesión en `src/lib/auth/`, con exportaciones de infraestructura declaradas y regla ESLint `no-restricted-imports`. — **Incorporado al plan.**
- [Media] Cerrar sesión no revoca el JWT. — **Incorporado al plan** (`versionSesion + 1` al cerrar sesión).
- [Media] Restablecer debe poner `debeCambiarContrasena = true` en la misma transacción. — **Incorporado al plan.**
- [Media] Política de logs: `debug: false` en Auth.js; nunca registrar cuerpos de petición, contraseñas, texto del CV ni prompts; errores genéricos; `Cache-Control: no-store` en la respuesta con la contraseña temporal. — **Fase 1: hecho** (`debug: false`, `mensajeDeError` sin detalles internos, sin logs de cuerpos ni contraseñas); revisar prompts en la Fase 2.
- [Media] Protección contra DoS en la carga: corte por streaming a 10 MB, límite en el reverse proxy y en `serverActions.bodySizeLimit`, límite de tamaño descomprimido y de entradas del ZIP del DOCX, y timeout de extracción. — **Fase 1: hecho** (corte por streaming, límite declarado del ZIP, timeout); ver el hallazgo de seguridad de la Fase 1 sobre el aislamiento real.
- [Media] Límite de 72 bytes de bcrypt y normalización NFC. — **Incorporado al plan.**
- [Baja] Bloqueo atómico (`increment`) y `bcrypt.compare` también con cuentas bloqueadas o desactivadas. — **Fase 1: hecho.**
- [Baja] En la bitácora, guardar el correo intentado solo si tiene formato de correo; si no, "[inválido]". — **Fase 1: hecho.**
- [Baja] `.gitignore` con `.env*` y la excepción `!.env.example`. — **Fase 1: hecho.**
- [Baja] Encabezados de descarga: `Cache-Control: private, no-store`, `Content-Type` fijo y `filename*=` (RFC 5987) saneado. — **Fase 1: hecho.**
- [Baja] `AUTH_URL` con https, comparar `Origin` contra ese valor, cookies `__Secure-`, HSTS, `frame-ancestors 'none'` y CSP básica. — **Fase 1: hecho** (`AUTH_URL` aprobada).
- [Baja] `crear-admin` genera la contraseña con CSPRNG, la imprime una sola vez en stdout y deja `debeCambiarContrasena = true`. — **Incorporado al plan.**

## Fase 1

### experto-reclutamiento
- [Alta] Las vacantes aceptaban requisitos discriminatorios (edad, sexo, estado civil, apariencia, domicilio…). — **Corregido**: validación en `esquemaVacante` con `src/lib/analizador/atributosProtegidos.ts`, texto de ayuda y pruebas en `tests/no-discriminacion.test.ts`.
- [Media] Cualquier edición sube la versión (aunque sea una errata): subir `version` solo si cambian campos que se evalúan; no guardar si no cambió nada. — **Fase 2: parcial.** Si no cambió nada no se guarda; cualquier cambio real sube la versión, como pide el documento.
- [Media] `VACANTE_EDITADA` debe guardar los campos cambiados con su valor anterior y nuevo. — **Fase 2: hecho.**
- [Media] Los ids de requisitos (O1, O2…) se renumeran por posición al editar: conservar los ids o leer siempre la evidencia de `vacanteSnapshot`. — **Fase 2: hecho** (el resultado guarda el texto de cada requisito y la vacante completa en `vacanteSnapshot`).
- [Media] Estudios mínimos sin estatus (trunco, pasante, titulado) ni carrera. — Pendiente; por ahora se puede capturar como requisito obligatorio. Agregar un campo nuevo cambia el esquema y requiere tu aprobación.
- [Baja] Catálogo de idiomas (evitar "Inglés", "ingles" y "English" como distintos), rechazar repetidos y mostrar la equivalencia MCER. — Pendiente (Fase 3).
- [Baja] Gerente solicitante y reclutador responsable por vacante. — Pendiente (cambia el esquema; requiere tu aprobación).
- [Baja] Corrección manual de `nombreCandidato` con `CV_NOMBRE_CORREGIDO`. — **Fase 2: hecho.**
- [Baja] Columna "Alta: fecha · por" en la lista de usuarios. — Pendiente (Fase 3).
- [Baja] Mientras no exista el análisis, "Subir y analizar CVs" puede confundir. — Pendiente (se resuelve en la Fase 2).

- Ronda 2 (APROBADO CON AJUSTES):
  - [Media] Faltaban rangos de edad sin la palabra "edad" ("De 25 a 35 años", "Mayor de 30") y otros términos: orientación sexual, salud, VIH, tatuajes, "sexo indistinto". — **Corregido** con pruebas.
  - [Media] Falsos positivos: "a domicilio", "vacante incluyente para personas con discapacidad", "Jóvenes Construyendo el Futuro", "igualdad de género", "colonia". — **Corregido**: contextos permitidos y "colonia" retirada de la lista, con pruebas.
  - [Baja] El error no indicaba el renglón ni el fragmento. — **Corregido.**

### revisor-seguridad
- [Media] Carrera en el bloqueo con peticiones en paralelo. — **Corregido**: reserva atómica del intento con `updateMany` condicional, más una prueba de 12 intentos en paralelo.
- [Media] La protección contra bombas de descompresión confía en tamaños declarados, y `Promise.race` no cancela el trabajo: extraer en un `worker_thread` con `resourceLimits` y `terminate()`. — Pendiente (Fase 2 o 3, antes de producción).
- [Media] Sin limitación de ritmo por IP en el login (password spraying, gasto de CPU, crecimiento de la bitácora): `limit_req` en el proxy inverso o un contador por IP. — Pendiente (despliegue).
- [Baja] Diferencia de tiempo residual (trabajo de base de datos distinto) que podría permitir enumerar cuentas. — Pendiente.
- [Baja] Intentos de "contraseña actual" en el cambio de contraseña sin contador ni bloqueo. — Pendiente (cambia las reglas de inicio de sesión; requiere tu aprobación).
- [Baja] ESLint no impedía importar módulos internos de `src/lib/auth/`. — **Corregido** (`patterns` con excepciones `acciones` y `administracion`).
- [Baja] Fallar al arrancar en producción si `AUTH_URL` falta o no es https. — Pendiente.
- [Baja] CSP sin `script-src` ni `default-src` (requiere nonce en Next 16). — Pendiente.
- [Baja] Cerrar sesión cierra todas las sesiones del usuario (intencional); avisarlo en la interfaz. — Pendiente (Fase 3).

### Dependencias
- [Media] `npm audit`: 4 vulnerabilidades altas en `mysql2`, que llega como dependencia transitiva del CLI `prisma` (solo desarrollo; la app usa SQLite y no carga `mysql2`). — Pendiente: actualizar cuando Prisma publique una corrección estable.

### Prueba en navegador (Playwright, fin de la Fase 1)
- [Alta] Tras un error de validación, React 19 vaciaba el formulario de vacante y el de alta de usuario, y se perdía lo capturado. — **Corregido** con envío manual vía `startTransition`, verificado en el navegador.
- [Baja] El botón nativo del selector de archivos dice "Choose Files" (texto del navegador, no de la app). — Pendiente (Fase 3: botón propio en español).
- [Baja] Auth.js escribe `[auth][error] CredentialsSignin` en el log del servidor en cada intento fallido (solo el código, sin correo ni contraseña). — Pendiente: silenciar con un `logger` propio si molesta en operación.

## Fase 2

### revisor-seguridad (ronda 1: RECHAZADO)
- [Alta] El filtro de datos protegidos no cubría citas, `puesto` ni `empresa`. — **Corregido**: `puesto` y `empresa` deben estar literalmente en su cita (se descartan puestos inyectados); todas las citas guardadas pasan por `enmascararProtegidos`; las brechas y preguntas con datos protegidos se descartan completas. Con pruebas.
- [Media] La IA decidía los años. — **Corregido**: la IA ya no da años; el código los calcula con las fechas de la cita ("actual" = fecha del análisis), sin traslapes ni citas repetidas, y descarta puestos sin año.
- [Media] Citas de 3 caracteres e instrucciones como evidencia. — **Corregido**: mínimo de 12 caracteres (el prompt pide 3 palabras) y se rechazan las citas que parecen instrucciones al sistema.
- [Media] Teléfonos por pares, "+52 1". — **Corregido** con pruebas. Los teléfonos locales de 8 dígitos no se ocultan, para no confundirlos con rangos de años como "2019-2022".
- [Media] Datos protegidos sin etiqueta ("Edad 32 años", "casado", direcciones). — **Corregido** con pruebas.
- [Baja] Plazo total de 60 s con el reintento. — **Corregido** (el reintento solo usa el tiempo restante).
- [Baja] Correos con [at], dominios sin ruta y usuarios de redes. — **Corregido.**
- [Baja] Etiquetas `<vacante>` falsas y de ancho completo. — **Corregido** (NFKC y neutralización).
- [Baja] Código HTTP en el mensaje al usuario. — **Corregido** (mensaje genérico; en el servidor solo se registran el nombre del error y el código).

### experto-reclutamiento (ronda 1: APROBADO CON AJUSTES)
- [Alta] El modelo no recibía la fecha del análisis. — **Corregido**: se envía `fecha_de_analisis` y el código calcula los periodos con ella.
- [Media] Años por puesto tomados de la IA. — **Corregido** (ver seguridad).
- [Media] Diferencias típicas de PDF provocaban falsos NO VIABLE, y no se distinguía una ausencia real de una cita no verificada. — **Corregido**: normalización NFKC con comillas, guiones y guion de corte, y motivo propio "(la cita del análisis no coincide con el CV; revisar manualmente)".
- [Media] Regla de prácticas y freelance. — **Implementado** como sugeriste: cuentan prácticas y freelance con fechas; no cuentan servicio social ni proyectos escolares; cada puesto lleva su tipo. **Requiere tu confirmación.**
- [Media] Brechas desligadas de la evidencia. — **Corregido**: las brechas base salen del código (requisitos en 0 o 1, años, estudios, idiomas) y las de la IA las complementan.
- [Media] Estudios en curso = concluidos. — **Parcial**: se extrae y guarda el estatus (`CONCLUIDO`, `TITULADO`, `EN_CURSO`, `TRUNCO`) para mostrarlo; la fórmula de F no cambia hasta que lo decidas.
- [Baja] Equivalencias MCER, cualidades ligadas a hechos y preguntas concretas en el prompt. — **Hecho.**
- [Baja] Distinguir "No viable (requisito)" de "No viable (puntaje)". — **Hecho** en `categoriaMostrada.causaNoViable`; se mostrará en la Fase 3.
- [Baja] Texto de ayuda: los deseables bajan el puntaje de quien no los tiene. — **Hecho.**
