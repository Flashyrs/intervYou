import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  const dbUrl = process.env.DATABASE_URL;
  console.log("DB_URL Status:", dbUrl ? `Found (Length: ${dbUrl.length})` : "NOT FOUND or UNDEFINED");

  
  const { Pool } = require("pg");
  const { PrismaPg } = require("@prisma/adapter-pg");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export { prisma };

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}


export function getPrisma() {
  return prisma;
}
