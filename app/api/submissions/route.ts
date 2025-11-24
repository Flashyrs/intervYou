import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

const EXEMPT_EMAILS = new Set([
  process.env.EXEMPT_EMAIL1 || "",
  process.env.EXEMPT_EMAIL2 || "",
].filter(Boolean));

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string;
    const rows = await prisma.submission.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(rows, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string;
    const email = session.user?.email || "";
    const { sessionId, problemId, language, code, results } = await req.json();
    if (!sessionId || !problemId || !language || typeof code !== 'string' || typeof results !== 'string') {
      return NextResponse.json({ error: "sessionId, problemId, language, code, results required" }, { status: 400 });
    }
    const parsed = (() => { try { return JSON.parse(results); } catch { return []; } })();
    const passed = Array.isArray(parsed) && parsed.length > 0 && parsed.every((r: any) => r && r.pass && !r.error);

    
    const existing = await prisma.submission.findUnique({ where: { sessionId_problemId_userId: { sessionId, problemId, userId } } });
    if (existing && !EXEMPT_EMAILS.has(email) && existing.attempts >= 2) {
      return NextResponse.json({ error: "submission limit reached (2 per problem)" }, { status: 429 });
    }

    const saved = await prisma.submission.upsert({
      where: { sessionId_problemId_userId: { sessionId, problemId, userId } },
      update: {
        language,
        code,
        results,
        passed,
        attempts: { increment: 1 },
      },
      create: {
        sessionId,
        problemId,
        userId,
        language,
        code,
        results,
        passed,
      },
    });

    return NextResponse.json(saved, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
