import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // La autenticación vive solo en src/lib/auth/ (preparación para Microsoft Entra ID).
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/lib/auth/**", "tests/**", "src/app/api/auth/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "bcryptjs", message: "Usa src/lib/auth/." },
            { name: "next-auth", message: "Usa src/lib/auth/." },
          ],
          patterns: [
            { group: ["next-auth/*"], message: "Usa src/lib/auth/." },
            {
              group: ["@/lib/auth/*", "!@/lib/auth/acciones", "!@/lib/auth/administracion"],
              message: "Fuera de src/lib/auth/ usa solo @/lib/auth (obtenerUsuarioActual, requerirRol).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"]),
]);

export default eslintConfig;
