import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Cliente de Prisma para una base SQLite (`file:...`). La app usa `db`; los respaldos abren copias con esto. */
export function crearClienteDb(url: string) {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

export const db = globalParaPrisma.prisma ?? crearClienteDb(process.env.DATABASE_URL ?? "file:./data/banco.db");

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = db;

export type ClienteDb = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
