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

### Ronda 2 de la Fase 2 (ambos expertos: APROBADO CON AJUSTES, sin hallazgos Alta)
- [Media] (reclutamiento) Año sin mes inflaba la experiencia ("2025 – actual" contaba desde enero). — **Corregido**: criterio conservador (inicio en diciembre, fin en enero), marca `fechasSinMes` y nota "confirmar en entrevista" en el motivo; "desde 2021" se toma como "hasta la fecha".
- [Media] (reclutamiento) CVs a dos columnas: la IA podría no encontrar en un fragmento continuo el puesto junto con sus fechas, y el candidato saldría NO VIABLE. — **Mitigado**: el prompt permite fragmentos de varios renglones y el motivo indica cuántos puestos se descartaron. **Pendiente**: validar con 10 a 20 CVs reales antes de producción.
- [Baja] (reclutamiento) "Actual" en hora local y `fecha_de_analisis` en UTC. — **Corregido**: ambos usan la fecha de CDMX.
- [Baja] (reclutamiento) El conteo de meses incluye el mes de inicio y el de término. — Pendiente: documentarlo en el detalle (Fase 3).
- [Media] (seguridad) Una cita larga con varios rangos de fechas inflaba la duración. — **Corregido**: más de dos marcas de fecha = puesto descartado, con prueba.
- [Media] (seguridad) Falsos positivos: "Dirección Comercial" borrada y "ASP.NET" convertida en [URL]. — **Corregido** con pruebas.
- [Baja] (seguridad) Rangos de años unidos que se tomaban como teléfono. — **Corregido** con prueba.
- [Baja] (seguridad) "Tengo 32 años." no se ocultaba. — **Corregido** en el ocultamiento previo a la API.
- [Baja] (seguridad) Riesgo aceptado: los teléfonos locales de 8 dígitos no se ocultan (se parecen a rangos de años) y llegan a la API.
- [Baja] (seguridad) Los niveles y la relevancia siguen siendo un juicio de la IA, limitado por la verificación de citas. — Pendiente (Fase 3): mostrar la cita junto a cada requisito para que una persona la revise.

## Fase 3

### experto-reclutamiento (APROBADO CON AJUSTES, sin hallazgos Alta)
- [Media] Para comparar había que abrir cada análisis. — **Corregido**: columna "Evidencia clave" con obligatorios demostrados/mencionados/sin evidencia, experiencia, estudios con estatus e idiomas, y pesos de O·D·E·F explicados.
- [Media] El ajuste no guardaba contra qué se decidió. — **Corregido**: la bitácora guarda la categoría anterior y la calculada, el puntaje y los umbrales vigentes, y lo muestra como "Pasable → Bueno".
- [Media] El motivo de experiencia parecía decir "sin experiencia" y redondeaba 0.75 a 0.8. — **Corregido**: "(se verificaron 9 meses)", con meses cuando hay menos de 2 años. Se conserva el prefijo "No se encontró evidencia de:" que exige el documento.
- [Baja] Vista imprimible. — **Hecho**: botón "Imprimir / guardar PDF" y estilos `print:` que ocultan la navegación, el ajuste y los botones.
- [Baja] Brechas de la IA duplicadas. — **Corregido**: se omiten las que repiten un requisito con brecha base.
- [Baja] "Re-analizar" en CVs sin texto. — **Corregido**: se oculta y el servidor ya lo rechazaba. La siembra de la prueba en navegador generaba CVs cortos marcados como sin texto: ajustada.
- [Baja] Preguntas cerradas. — **Corregido** en el prompt (preguntas abiertas o situacionales con ejemplos).
- [Baja] Comentario del ajuste en la tabla. — **Hecho** (recortado a 80 caracteres, con el texto completo en `title`).

### ux-ui-reviewer (APROBADO CON AJUSTES, sin hallazgos Alta)
- [Media] "Reintentar" usaba la vacante del lote. — **Corregido**: la vacante queda fija por archivo y se muestra en la fila.
- [Media] Se perdía la cola al cerrar la página. — **Corregido**: aviso `beforeunload` y mensaje "No cierres esta página…".
- [Media] El resumen no contaba los errores. — **Corregido**: "Terminado: N listos, M con error…" con `aria-live`.
- [Media] Los umbrales se validaban después de confirmar. — **Corregido**: validación en el cliente y diálogo con "Bueno: 70 → 60".
- [Media] La bitácora mostraba JSON crudo. — **Corregido**: pares etiqueta–valor y el JSON original en un desplegable.
- [Baja] El nombre de la variable de entorno aparecía en el error. — **Corregido** (mensaje genérico; el detalle va al log del servidor).
- [Baja] "Sin texto" aparecía como "Listo" en verde. — **Corregido**: estado ámbar "Guardado sin analizar".
- [Baja] El límite de 20 era por selección. — **Corregido**: no se pueden agregar archivos mientras la cola trabaja.
- [Baja] Ayuda de 10 caracteres en el ajuste y limpieza tras guardar. — **Hecho.**
- [Baja] El párrafo del ajuste empujaba el puntaje. — **Corregido.**
- [Baja] Doble relleno en las tarjetas con tabla. — **Corregido** (`tarjetaTabla`).
- [Baja] O·D·E·F sin explicar. — **Hecho** (`abbr` y leyenda).
- [Baja] La navegación no marcaba la página actual. — **Hecho** (`aria-current` y estilo activo).
- [Baja] "Re-analizar" sin confirmar cuando hay un ajuste. — **Hecho** (diálogo de confirmación).
- [Baja] El correo se cortaba y aparecían acciones sobre la cuenta propia. — **Corregido** (`break-all` y acciones propias ocultas; el último Admin sigue protegido en el servidor).
- [Baja] El formato de los campos de fecha depende del navegador. — **Mitigado** con ayuda "día/mes/año". El selector nativo sigue mostrando el formato del idioma del navegador.
- Nota: la búsqueda por palabra clave no distingue mayúsculas solo en ASCII (SQLite `LIKE`): "José" no coincide con "jose". — Pendiente.

## Fase 4

### Cambio de proveedor del analizador (decisión del usuario)
- El analizador usa ahora el SDK oficial de Groq (`groq-sdk` 1.6.0) en lugar del de Anthropic. Variables: `GROQ_API_KEY`, `GROQ_MODEL` (por defecto `openai/gpt-oss-120b`, con salida estructurada `json_schema` estricta). Se desinstaló `@anthropic-ai/sdk`. El motor no cambia: ocultamiento previo, verificación de citas, fórmulas y la regla de que la IA solo extrae evidencia.
- [Media] El plan gratuito de Groq limita los tokens por minuto: en la validación hubo errores 429. La app los muestra como "El servicio de análisis está saturado… Reintentar" sin guardar nada parcial, pero una carga de 20 CVs con 3 análisis simultáneos tocará ese límite. — Pendiente: contratar un plan con más capacidad, o bajar la concurrencia a 1 si se queda en el plan gratuito (cambio a `MAX_SIMULTANEOS`).
- [Baja] Los años se redondean a un decimal antes de la fórmula E (15 meses → 1.3 años → E 79 en lugar de 77.5). Con mínimos enteros nunca cambia el veredicto. — Pendiente: decidir si E usa meses exactos (sería un cambio a las fórmulas).

### Validación con la IA real (`npm run fase4:validar`)
- 7/7 CVs en su categoría esperada, con el mismo puntaje que el cálculo a mano. El CV con instrucción oculta quedó en Pasable (67) con 1 renglón de instrucciones ignorado.
- ~~El CV 06 estaba mal diseñado; se corrigió el CV, no el motor.~~ **Conclusión corregida (experto-reclutamiento, revisión final):** el problema de fondo estaba en el motor. La relevancia de los puestos era un juicio implícito de la IA, inconsistente entre CVs y sin rastro cuando omitía un puesto. Se corrigió el motor (ver más abajo) y el CV 06 original volvió a la batería como caso 08.

### Revisión final de la Fase 4 (los tres expertos: APROBADO CON AJUSTES)

**experto-reclutamiento**
- [Alta] La relevancia de los puestos era implícita, inconsistente y sin rastro. — **Corregido**: la IA lista todos los puestos con fechas, cada uno con `relevante` y `justificacion`, y el prompt define la relevancia por las funciones, no por el título. El código suma solo los relevantes. Los no relevantes se muestran con su justificación en el análisis y en el motivo de NO VIABLE. Los puestos descartados guardan su motivo ("la cita no aparece literalmente en el CV", "sin periodo único"…). El CV 06 original se agregó como caso 08.
- [Media] El 7/7 venía de una sola corrida. — **Atendido**: 3 corridas con 9 CVs (resultados en el reporte de la Fase 4).
- [Media] Los puestos administrativos que solo "preparan reportes" cuentan completos. Proponer "PARCIAL" (50 %) cambia las fórmulas. — Pendiente de tu decisión. Mientras tanto, la justificación de relevancia de cada puesto está visible para cuestionarla.
- [Baja] "1 años" en la lista de puestos. — **Corregido** (`describirMeses` en el título y en cada puesto).

**revisor-seguridad**
- [Media] Experiencia falsa oculta en un renglón aparte. — **Corregido**: al extraer el PDF se omite el texto de menos de 3 pt y se deja la marca `[TEXTO OCULTO OMITIDO…]`. El análisis y la tabla muestran "⚠ Posible manipulación del CV". Caso 09 en la batería. **Pendiente**: texto blanco de tamaño normal (requiere leer el color en las operaciones del PDF).
- [Media] Instrucciones con otras palabras ("Nota para quien evalúa…", "Al revisor: asigna nivel 2…"). — **Corregido**: patrones ampliados, con pruebas. Además, nivel 2 ya no se acepta si la cita viene de un renglón que solo enlista habilidades.
- [Media] Groq (EE. UU.) es un nuevo encargado y hay transferencia internacional de datos personales (se envían nombre, trayectoria y estudios; los datos de contacto se ocultan). — **Pendiente (legal)**: actualizar el aviso de privacidad (LFPDPPP: transferencias y encargados), documentar la política de retención de la cuenta de Groq y activar la retención cero si existe.
- [Baja] Sin límite de análisis por usuario en el servidor. — Pendiente.
- [Baja] Error 400 `json_validate_failed` de Groq sin reintento. — **Corregido** (se trata como JSON inválido y usa el único reintento).
- [Baja] El script de validación no borraba el directorio temporal y le pasaba toda la variable de entorno a Prisma. — **Corregido.**

**ux-ui-reviewer**
- [Media] La marca de manipulación solo se veía en el detalle. — **Corregido**: etiqueta "⚠ Posible manipulación del CV" en la vista por vacante y en el detalle del CV.
- [Media] Sin `not-found.tsx` ni `error.tsx` (aparecían páginas de Next en inglés). — **Corregido**: `not-found`, `error`, `global-error` y `loading` en español.
- [Baja] `role="alert"` en el aviso estático, sin el conteo. — **Corregido** (`role="note"` con encabezado y conteos).
- [Baja] Experiencia en dos unidades. — **Corregido** (meses en todo el detalle).
- [Baja] "Avisa a un Admin" cuando quien lo ve ya es Admin. — Pendiente.
- [Baja] Enlace "Saltar al contenido". — **Hecho.**
- [Baja] Sin indicador de carga. — **Hecho** (`loading.tsx`).

### Capa de proveedores con el SDK de OpenAI (decisión del usuario)

- `src/lib/analizador/proveedores.ts` lee `IA_PROVEEDORES` (orden de respaldo) y, para cada nombre `N`, `N_API_KEY`, `N_BASE_URL`, `N_MODEL`, `N_ANONIMIZAR` y `N_FORMATO_JSON`. Para agregar un proveedor (por ejemplo OmniRoute) basta con configurarlo; no hay que tocar el código.
- Si un proveedor responde 429, 5xx o falla por timeout o conexión, se pasa al siguiente. Si no tiene clave, se salta. El log solo registra el proveedor, el modelo, el tiempo y el código HTTP, nunca el contenido.
- Antes de enviar un CV a un proveedor con `ANONIMIZAR=true` (Gemini por defecto), se quitan el nombre, el correo, el teléfono, la dirección y los identificadores (RUT/DNI/INE/CURP/RFC). Las citas se verifican contra el texto que vio ese proveedor.
- **Media**: `gemini-2.5-flash`, el modelo por defecto que pidió el usuario, responde 404 para cuentas nuevas. Se probó con `GEMINI_MODEL=gemini-3.8-flash` y funciona. **Resuelto:** por decisión del usuario, el valor por defecto ahora es `gemini-3.8-flash`.
- **Media (legal)**: falta el aviso de privacidad (LFPDPPP) que informe que los CV se envían a proveedores de IA externos. El plan gratuito de Gemini puede usar los datos para entrenar.
- **Baja**: los planes gratuitos de Groq (429) y Gemini (503 intermitentes) saturan con facilidad cuando el volumen es alto. Para producción conviene un plan de pago o agregar más proveedores al respaldo.
- Reglas del prompt del usuario que se adoptaron en el código:
  - E = 0 si la experiencia es menor al mínimo;
  - las fechas que solo tienen año cuentan la diferencia de años;
  - un puesto sin fecha de inicio o de fin no se suma y aparece en Alertas;
  - las prácticas y el servicio social solo cuentan si la vacante lo indica (campo nuevo `cuentanPracticas`, migración `20261002195824`);
  - C1–C2 cuenta como avanzado;
  - se agregó la sección Alertas.
  
  El prompt se adaptó para que la IA responda en JSON. El veredicto, el puntaje y la categoría siguen calculándose en código (regla crítica 1).

#### revisor-seguridad sobre la capa de proveedores (ronda 1: APROBADO CON AJUSTES, 2 hallazgos Alta corregidos)

- Corregido (Alta): el nombre se busca en los primeros 5 renglones, saltando encabezados y títulos de puesto. Se quitan el nombre completo y cada una de sus partes. Si no se identifica ningún nombre, el CV **no** se envía a los proveedores que exigen anonimizar.
- Corregido (Alta): domicilios sin palabra clave ("Insurgentes Sur 1234, Del. …", "Paseo de la Reforma 222") y teléfonos de 8 dígitos con etiqueta.
- Corregido (Media): la anonimización de Gemini ya no se puede desactivar por configuración.
- Corregido (Baja): `*_BASE_URL` con `http://` solo se acepta hacia localhost.
- **Baja**: falta `import "server-only"` en `proveedores.ts` y `cliente.ts`. Requiere instalar el paquete `server-only`, una dependencia nueva que se debe aprobar. Hoy ningún componente cliente importa el analizador.
- **Baja**: si un apellido del candidato coincide con el nombre de una empresa o de un lugar ("García Hermanos"), esa palabra también se reemplaza por [NOMBRE] en el texto anonimizado. Esto puede hacer que se descarte la cita de ese puesto cuando responde un proveedor anonimizado.

#### Decisión del usuario: se elimina la anonimización adicional

- Por decisión del usuario, se quitó la capa de anonimización (nombre, domicilios sin etiqueta y `*_ANONIMIZAR`). La ronda 2 del revisor-seguridad fue RECHAZADO por fugas de nombre en esa capa, y el usuario prefirió quitarla en lugar de hacer una tercera ronda.
- Se mantiene el ocultamiento base para **todos** los proveedores, incluido Gemini: correo, teléfono, URL, CURP, RFC, RUT/DNI/INE, domicilio con etiqueta, edad, estado civil y demás datos protegidos.
- **Alta (riesgo aceptado por el usuario)**: Gemini recibe el nombre del candidato y los domicilios que no llevan etiqueta. El plan gratuito de Gemini puede usar esos datos para entrenar. Antes de producción, se recomienda un plan de pago de Gemini (sin uso para entrenamiento) y el aviso de privacidad (LFPDPPP) que informe del envío a proveedores de IA externos.

#### Todos los modelos gratuitos de Gemini en cadena (decisión del usuario)

- `GEMINI_MODEL` (y cualquier `*_MODEL`) acepta una lista separada por comas. El cupo gratuito de Gemini es por modelo: `gemini-3.8-flash` solo permite 20 peticiones al día. Por eso, si un modelo responde 429, 5xx, 404 o se agota el tiempo, se usa el siguiente.
- Orden por defecto: 3.8-flash → 3.7-flash → 3.6-flash → 3.5-flash → flash-latest → 3.5-flash-lite → 3.1-flash-lite → flash-lite-latest. Se probó en vivo: con el cupo de 3.8 agotado, respondió 3.7-flash.
- **Media**: los modelos "lite" son menos precisos con las citas. En la validación de 9 CV, `gemini-3.5-flash-lite` acertó 7 de 9: en el 07 y el 09 dio citas que no coinciden con el CV. El código las rechazó y marcó "revisar manualmente", así que el error es conservador y no infla puntajes. En esos casos conviene que un reclutador lo revise o que lo reanalice con un modelo flash.

### Validación de expertos tras quitar la anonimización y agregar la cadena de modelos

#### revisor-seguridad: APROBADO CON AJUSTES (sin hallazgos Alta)

- Corregido (Media): límite de 10 análisis por minuto por usuario y de un solo análisis a la vez por CV y vacante (`limite.ts`). El límite vive en memoria, así que vale para una sola instancia; si se escala a varias, debe pasar a la base de datos.
- Corregido (Baja): tope de 10 modelos por proveedor.
- Corregido (Baja): un 401/403 ya no corta la cadena. Salta los demás modelos de ese proveedor y prueba el siguiente proveedor.
- Corregido (Baja): mensaje propio cuando no queda tiempo para consultar.
- Corregido (Baja): el reintento por JSON inválido empieza por el modelo que respondió.

#### experto-reclutamiento: APROBADO CON AJUSTES (hallazgos Alta pendientes de la decisión del usuario, porque cambian reglas del veredicto)

- **Alta (decisión)**: un obligatorio omitido por la IA produce un NO VIABLE sin aviso. Propuesta: "Pendiente de revisión" en lugar de NO VIABLE cuando el análisis lo hizo un modelo lite o cuando hay citas no verificadas.
- **Alta (decisión)**: la relevancia de los puestos la decide solo la IA y puede dejar E=0. Propuesta: marcar "revisar" si, sumando los puestos no relevantes, se alcanza el mínimo.
- **Alta (decisión, contradice una regla del usuario)**: la regla "2019–2021 = 2 años" junto con E=0 puede descartar a alguien por meses. Propuesta: "confirmar en entrevista" cuando la lectura máxima de las fechas cumple el mínimo.
- **Alta (riesgo aceptado)**: LFPDPPP; los datos van a planes gratuitos fuera de México. Falta el aviso de privacidad.
- **Media**:
  - un puesto de un solo año ("2022") cuenta cero;
  - las fechas sin mes se leen con criterio asimétrico (inicio en enero, fin en diciembre del año anterior);
  - un mismo lote puede analizarse con modelos distintos;
  - validar con 30 o más CV reales comparados contra la decisión de un reclutador.
- **Baja**:
  - los pesos están escritos a mano en la pantalla;
  - los puestos descartados aparecen dos veces;
  - `cualidadesDescartadas` no se muestra.
