import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  // Use different adapters based on environment
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    // For Vercel/production: use @neondatabase/serverless
    const { Pool } = require("@neondatabase/serverless");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    
    return new PrismaClient({
      adapter,
      log: ["error"],
    });
  } else {
    // For local development: use pg
    const { Pool } = require("pg");
    const { PrismaPg } = require("@prisma/adapter-pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export { prisma };

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

// Legacy function for backward compatibility
export function getPrisma() {
  return prisma;
}
