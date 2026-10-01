# Pendientes (hallazgos Media y Baja)

Formato: [Prioridad] (Fase · Experto) descripción — estado

## Fase 0

### experto-reclutamiento
- [Media] Si se cambian los umbrales, cambia hacia atrás la categoría calculada de análisis y ajustes ya hechos; guardar en `AjusteCategoria` la categoría calculada previa y los umbrales aplicados, o mostrar "calculada con umbrales vigentes". — Pendiente (la regla actual del documento dice calcular al mostrar; requiere tu decisión).
- [Media] Al re-analizar, el ajuste manual previo queda oculto: mostrar en el análisis nuevo el aviso "Existe un ajuste previo de [nombre] en [fecha]…" con enlace. — Pendiente (Fase 3).
- [Media] Guardar una copia de la vacante en el análisis. — **Incorporado al plan** (`Analisis.vacanteSnapshot`).
- [Media] Declarar las relaciones Prisma con `@relation` y `onDelete`. — **Incorporado al plan.**
- [Baja] Registrar en la bitácora la corrección de `nombreCandidato` (`CV_NOMBRE_CORREGIDO`). — Pendiente (Fase 1).
- [Baja] Guardar en `detalle` de la bitácora identificadores legibles (archivo, candidato, vacante, categorías, comentario). — Pendiente (Fase 1).
- [Baja] Definir si un ajuste puede sacar a un candidato de NO VIABLE: agrupar por la categoría ajustada y mostrar siempre "Veredicto calculado: NO VIABLE (motivos)". — Pendiente (Fase 3).

### ux-ui-reviewer
- [Media] Confirmación al eliminar un CV y al archivar una vacante. — **Incorporado al plan.**
- [Media] Detallar la cola de carga: estados por fila, más de 20 archivos, textos de los motivos de error y aviso de duplicado dentro de la fila sin bloquear la cola. — Pendiente (Fase 3).
- [Media] Tras el cambio obligatorio de contraseña, emitir un token nuevo; en `/cambiar-contrasena`, mostrar las reglas y solo "Cerrar sesión". — Token: **incorporado al plan**; la pantalla queda pendiente (Fase 1).
- [Media] Estado vacío y "Re-analizar" por fila en la vista por vacante. — **Incorporado al plan.**
- [Media] Criterios de accesibilidad: WCAG AA (insignias ámbar y gris), foco visible, teclado, 1366/1920 px sin scroll horizontal. — Pendiente (Fase 3).
- [Baja] `/cuenta` con los mismos campos y reglas que `/cambiar-contrasena`. — Pendiente (Fase 1).
- [Baja] Contraseña temporal con botón "Copiar" y el aviso "No volverá a mostrarse"; error claro al intentar desactivar o degradar al último Admin. — Pendiente (Fase 1).
- [Baja] Ambigüedad del filtro por categoría en `/cvs` con varios análisis: exigir elegir vacante o usar el análisis más reciente. — Pendiente (Fase 3).
- [Baja] Confirmación al guardar umbrales. — **Incorporado al plan.**

### revisor-seguridad
- [Media] Concentrar todo el manejo de contraseñas y sesión en `src/lib/auth/`, con exportaciones de infraestructura declaradas y regla ESLint `no-restricted-imports`. — **Incorporado al plan.**
- [Media] Cerrar sesión no revoca el JWT. — **Incorporado al plan** (`versionSesion + 1` al cerrar sesión).
- [Media] Restablecer debe poner `debeCambiarContrasena = true` en la misma transacción. — **Incorporado al plan.**
- [Media] Política de logs: `debug: false` en Auth.js; nunca registrar cuerpos de petición, contraseñas, texto del CV ni prompts; errores genéricos; `Cache-Control: no-store` en la respuesta con la contraseña temporal. — Pendiente (Fase 1/2).
- [Media] Protección contra DoS en la carga: corte por streaming a 10 MB, límite en el reverse proxy y en `serverActions.bodySizeLimit`, límite de tamaño descomprimido y de entradas del ZIP del DOCX, y timeout de extracción. — Pendiente (Fase 1).
- [Media] Límite de 72 bytes de bcrypt y normalización NFC. — **Incorporado al plan.**
- [Baja] Bloqueo atómico (`increment`) y `bcrypt.compare` también con cuentas bloqueadas o desactivadas. — Pendiente (Fase 1).
- [Baja] En la bitácora, guardar el correo intentado solo si tiene formato de correo; si no, "[inválido]". — Pendiente (Fase 1).
- [Baja] `.gitignore` con `.env*` y la excepción `!.env.example`. — Pendiente (Fase 1).
- [Baja] Encabezados de descarga: `Cache-Control: private, no-store`, `Content-Type` fijo y `filename*=` (RFC 5987) saneado. — Pendiente (Fase 1).
- [Baja] `AUTH_URL` con https, comparar `Origin` contra ese valor, cookies `__Secure-`, HSTS, `frame-ancestors 'none'` y CSP básica. — Pendiente (Fase 1; `AUTH_URL` sería otra variable de entorno, requiere tu aprobación).
- [Baja] `crear-admin` genera la contraseña con CSPRNG, la imprime una sola vez en stdout y deja `debeCambiarContrasena = true`. — **Incorporado al plan.**
