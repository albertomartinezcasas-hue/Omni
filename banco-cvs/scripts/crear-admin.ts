/**
 * Crea el primer Admin: npm run crear-admin -- correo@dominio.com "Nombre"
 * Solo funciona si no existe ningún Admin activo. Imprime la contraseña temporal una sola vez.
 */
import { credencialInicial } from "@/lib/auth/administracion";
import { registrarEvento } from "@/lib/bitacora";
import { dominioPermitido, esquemaCorreo } from "@/lib/correo";
import { db } from "@/lib/db";

async function principal() {
  const [correoArg, nombreArg] = process.argv.slice(2);
  if (!correoArg || !nombreArg?.trim()) {
    console.error('Uso: npm run crear-admin -- correo@dominio.com "Nombre completo"');
    return 1;
  }
  if (!process.env.ALLOWED_DOMAINS) {
    console.error("Error: define ALLOWED_DOMAINS en .env antes de crear el Admin.");
    return 1;
  }
  const correo = esquemaCorreo.safeParse(correoArg);
  if (!correo.success) {
    console.error("Error: el correo no tiene un formato válido.");
    return 1;
  }
  if (!dominioPermitido(correo.data)) {
    console.error("Error: el dominio del correo no está en ALLOWED_DOMAINS.");
    return 1;
  }

  const adminsActivos = await db.usuario.count({ where: { rol: "ADMIN", activo: true } });
  if (adminsActivos > 0) {
    console.error("Rechazado: ya existe un Admin activo. Las cuentas se crean desde la pantalla Usuarios.");
    return 1;
  }
  if (await db.usuario.findUnique({ where: { correo: correo.data } })) {
    console.error("Rechazado: ya existe una cuenta con ese correo.");
    return 1;
  }

  const { temporal, datos } = await credencialInicial();
  const nombre = nombreArg.trim().slice(0, 120);
  await db.$transaction(async (tx) => {
    const admin = await tx.usuario.create({
      data: { correo: correo.data, nombre, rol: "ADMIN", ...datos },
    });
    await registrarEvento(
      {
        actor: { id: admin.id, nombre: admin.nombre, correo: admin.correo },
        accion: "USUARIO_CREADO",
        entidadTipo: "USUARIO",
        entidadId: admin.id,
        detalle: { usuario: admin.correo, rol: "ADMIN", origen: "crear-admin" },
      },
      tx,
    );
  });

  console.log(`Admin creado: ${nombre} <${correo.data}>`);
  console.log("Contraseña temporal (se muestra una sola vez; deberá cambiarse al iniciar sesión):");
  console.log(temporal);
  return 0;
}

principal()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch(() => {
    console.error("Error inesperado al crear el Admin.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
