import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  // Use different adapters based on environment
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    const dbUrl = process.env.DATABASE_URL;
    console.log("DB_URL Status:", dbUrl ? `Found (Length: ${dbUrl.length})` : "NOT FOUND or UNDEFINED");
    // For Vercel/production: use @neondatabase/serverless AND @prisma/adapter-neon
    const { Pool } = require("@neondatabase/serverless"); // Neon's Pool
    const { PrismaNeon } = require("@prisma/adapter-neon"); // 💡 Change to PrismaNeon
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool); // 💡 Use PrismaNeon
    
    return new PrismaClient({
      adapter,
      log: ["error"],
    });
  } else {
    // For local development: use standard 'pg' driver and PrismaPg adapter
    const { Pool } = require("pg"); // Standard 'pg' Pool
    const { PrismaPg } = require("@prisma/adapter-pg"); // 💡 Use PrismaPg for standard 'pg'
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool); // 💡 Use PrismaPg
    
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
