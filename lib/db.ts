import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  let dbUrl = process.env.DATABASE_URL;
  console.log("DB_URL Status:", dbUrl ? `Found (Length: ${dbUrl.length})` : "NOT FOUND or UNDEFINED");

  // Auto-correct Supabase pooler username (Supavisor requires [user].[tenant])
  if (dbUrl && dbUrl.includes("pooler.supabase.com")) {
    try {
      const parsedUrl = new URL(dbUrl);
      if (!parsedUrl.username.includes(".")) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (supabaseUrl) {
          const supabaseHost = new URL(supabaseUrl).hostname;
          const projectId = supabaseHost.split(".")[0];
          parsedUrl.username = `${parsedUrl.username}.${projectId}`;
          dbUrl = parsedUrl.toString();
          console.log("Auto-corrected Supabase pooler URL username to include project ID.");
        }
      }
    } catch (e) {
      console.error("Failed to parse or auto-correct DATABASE_URL:", e);
    }
  }

  const { Pool } = require("pg");
  const { PrismaPg } = require("@prisma/adapter-pg");

  const pool = new Pool({ connectionString: dbUrl });
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
