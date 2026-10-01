# Migración del inicio de sesión a Microsoft Entra ID

Estado actual: correo y contraseña (proveedor Credentials de Auth.js), solo para la fase de validación.
Esta guía describe cómo cambiar a Microsoft Entra ID **sin migrar datos**.

## Por qué no hace falta migrar datos

- Toda la autenticación vive en `src/lib/auth/`. El resto de la app solo usa `obtenerUsuarioActual()` y `requerirRol(rol)` (`src/lib/auth/index.ts`); una regla de ESLint impide importar `next-auth` o `bcryptjs` fuera de esa carpeta.
- La tabla `Usuario` usa el **correo** como identificador único y ya tiene el campo opcional **`oid`** (único), vacío por ahora.
- Rol, estado (activo/desactivado) y `versionSesion` siguen viviendo en la base de datos y se consultan en cada petición: la gestión de usuarios, la protección del último Admin y la bitácora no cambian.

## 1. Lo que TI debe configurar en Entra ID

1. **Registro de aplicación** en el tenant de la empresa, tipo **single-tenant** ("Accounts in this organizational directory only").
2. **URI de redirección** (plataforma *Web*): `https://<dominio-de-la-app>/api/auth/callback/microsoft-entra-id`.
3. **Secreto de cliente** (o certificado) con fecha de caducidad registrada en el calendario de TI para rotarlo a tiempo.
4. **Permisos delegados de Microsoft Graph**: `openid`, `profile`, `email`, `User.Read`. Otorgar consentimiento de administrador.
5. Opcional, recomendado: en *Enterprise applications → Properties*, activar **"Assignment required"** y asignar solo al grupo del equipo de reclutamiento.
6. Entregar al equipo, por un canal seguro, estos datos: **Tenant ID**, **Client ID (Application ID)** y **Client secret**.
7. Confirmar que el atributo `mail` de los usuarios esté poblado (si no, se usará `preferred_username`).

## 2. Variables de entorno nuevas

```
AUTH_MICROSOFT_ENTRA_ID_ID=<Client ID>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<Client secret>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<Tenant ID>/v2.0
ENTRA_TENANT_ID=<Tenant ID>
```

Se mantienen `AUTH_SECRET`, `AUTH_URL` y `ALLOWED_DOMAINS`. Nunca se versionan.

## 3. Cambios de código (todos dentro de `src/lib/auth/`)

1. **Proveedor**: en `config.ts`, agregar `MicrosoftEntraID` de `next-auth/providers/microsoft-entra-id` con `issuer` del tenant (no `common` ni `organizations`) y `authorization: { params: { scope: "openid profile email User.Read" } }`.
2. **Validar el tenant**: en el callback `signIn`, rechazar si el claim `tid` del `id_token` (`profile.tid`) no es exactamente `ENTRA_TENANT_ID`.
3. **Obtener el correo**: usar `profile.email`; si no viene, `profile.preferred_username`. Normalizar a minúsculas y validar el formato.
4. **Validar el dominio** contra `ALLOWED_DOMAINS` (función `dominioPermitido()` de `src/lib/correo.ts`).
5. **Vincular y verificar `oid`** (claim `profile.oid`, inmutable por usuario y tenant):
   - Buscar el `Usuario` por correo. Si no existe o está desactivado → rechazar con un mensaje genérico. **No se crean cuentas automáticamente**: un Admin sigue dándolas de alta.
   - Si `oid` está vacío → guardarlo (primera vinculación) y registrar el evento en la bitácora.
   - Si `oid` ya existe y **no coincide** → rechazar y registrar `LOGIN_FALLIDO` con el motivo `OID_NO_COINCIDE`. Así se evita que otra persona tome la cuenta si un correo se reasigna.
   - Registrar `LOGIN_OK` con el mismo formato que hoy.
6. **Sesión**: en el callback `jwt`, al iniciar sesión, guardar `uid`, `ver` (`versionSesion`) e `inicio`, igual que hoy. `obtenerUsuarioActual()` no cambia.
7. **Desactivar el proveedor Credentials**: quitar `Credentials` de `providers` y borrar lo que ya no se usa:
   - `credenciales.ts`, la parte de contraseñas de `cuenta.ts`, `contrasenas.ts` y `restablecerContrasena`;
   - las pantallas `/cambiar-contrasena` y la sección de contraseña de `/cuenta`;
   - el botón "Restablecer contraseña" en Usuarios;
   - la opción de contraseña temporal de `crear-admin`, que pasa a crear el Admin sin contraseña para que entre con Microsoft.
8. **Datos**: poner `hashContrasena = null` y `debeCambiarContrasena = false` en todos los usuarios con un script de una sola vez. Las columnas pueden quedarse; ya son opcionales.
9. **Pantalla de inicio**: sustituir el formulario por el botón "Iniciar sesión con Microsoft".
10. **Pruebas**: reemplazar las de contraseña y bloqueo por pruebas de los callbacks: tenant incorrecto, dominio no permitido, cuenta inexistente o desactivada, `oid` distinto y primera vinculación. Las pruebas de la matriz de permisos, del último Admin y de la sesión invalidada no cambian.

## 4. Puesta en marcha sugerida

1. TI completa la sección 1 y entrega los datos.
2. Desplegar con ambos proveedores durante una semana como máximo. Cada usuario entra una vez con Microsoft para vincular su `oid`.
3. Verificar en la bitácora que todos los usuarios activos tengan `oid`.
4. Quitar Credentials (paso 3.7) y limpiar contraseñas (paso 3.8).

## 5. Lo que no cambia

La matriz de permisos, la gestión de usuarios y roles dentro de la app, la protección del último Admin, la invalidación inmediata de sesiones (`versionSesion`), la expiración a las 8 h y la bitácora.
