import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { DURACION_SESION_SEGUNDOS } from "./constantes";
import { verificarCredenciales } from "./credenciales";

const esquemaLogin = z.object({
  correo: z.string().max(320),
  contrasena: z.string().max(1024),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: false,
  session: { strategy: "jwt", maxAge: DURACION_SESION_SEGUNDOS },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { correo: {}, contrasena: {} },
      async authorize(credenciales) {
        const datos = esquemaLogin.safeParse(credenciales);
        if (!datos.success) return null;
        const resultado = await verificarCredenciales(datos.data.correo, datos.data.contrasena);
        if (!resultado) return null;
        return { id: resultado.id, versionSesion: resultado.versionSesion };
      },
    }),
  ],
  callbacks: {
    // El token solo guarda el id, la versión de sesión y la hora de inicio.
    // El rol y el estado se leen de la base de datos en cada petición.
    jwt({ token, user }) {
      if (user) {
        return {
          uid: user.id,
          ver: (user as { versionSesion: number }).versionSesion,
          inicio: Date.now(),
        };
      }
      return token;
    },
    session({ session, token }) {
      return {
        expires: session.expires,
        uid: token.uid,
        ver: token.ver,
        inicio: token.inicio,
      } as unknown as typeof session;
    },
  },
});
