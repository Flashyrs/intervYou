import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");

    if (secret !== process.env.PERF_TEST_SECRET && secret !== process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Run a query on PostgreSQL using prisma to keep the database connection alive.
    // SELECT 1 is standard for pinging database and keeps the connection warm.
    const result = await prisma.$queryRaw`SELECT 1 as ping`;

    return NextResponse.json({
      message: "Supabase PostgreSQL pinged successfully to prevent sleep.",
      result,
    });
  } catch (error) {
    console.error("Failed to ping Supabase PostgreSQL:", error);
    return NextResponse.json({ error: "Failed to ping database." }, { status: 500 });
  }
}
