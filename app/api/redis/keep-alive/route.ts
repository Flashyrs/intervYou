import { redis } from "@/lib/redis";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");

    if (secret !== process.env.PERF_TEST_SECRET && secret !== process.env.NEXTAUTH_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await redis.ping();
    await redis.set("last_ping", new Date().toISOString());

    return NextResponse.json({ message: "Redis pinged successfully to prevent deletion." });
  } catch (error) {
    console.error("Failed to ping redis:", error);
    return NextResponse.json({ error: "Failed to ping redis cache." }, { status: 500 });
  }
}

