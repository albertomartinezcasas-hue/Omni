import { redirect } from "next/navigation";
import { protegerPagina } from "@/lib/paginas";

export default async function Inicio({
  searchParams,
}: {
  searchParams: Promise<{ contrasena?: string }>;
}) {
  await protegerPagina("USUARIO");
  const { contrasena } = await searchParams;
  redirect(contrasena === "actualizada" ? "/vacantes?contrasena=actualizada" : "/vacantes");
}
