import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

const EXEMPT_EMAILS = new Set([
  process.env.EXEMPT_EMAIL1 || "",
  process.env.EXEMPT_EMAIL2 || "",
].filter(Boolean));

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string;
    const { searchParams } = new URL(req.url);
    const filterSessionId = searchParams.get("sessionId");

    let where: any = { userId };

    // If querying by sessionId, allow viewing ALL submissions for that session IF user was a participant
    if (filterSessionId) {
      // Verify participation
      const sess = await prisma.interviewSession.findUnique({
        where: { id: filterSessionId },
        include: { participants: true }
      });
      if (!sess) return NextResponse.json({ error: "Session not found" }, { status: 404 });

      const isParticipant = sess.participants.some(p => p.id === userId);
      if (!isParticipant) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

      // Set filter to sessionId (removes userId constraint to see others)
      where = { sessionId: filterSessionId };
    }

    const rows = await prisma.submission.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        session: {
          include: {
            participants: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
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
    const { sessionId, problemId, language, code, results, time, memory, problemText } = await req.json();
    if (!sessionId || !problemId || !language || typeof code !== 'string' || typeof results !== 'string') {
      return NextResponse.json({ error: "sessionId, problemId, language, code, results required" }, { status: 400 });
    }
    const parsed = (() => { try { return JSON.parse(results); } catch { return []; } })();
    const passed = Array.isArray(parsed) && parsed.length > 0 && parsed.every((r: any) => r && r.pass && !r.error);


    const existing = await prisma.submission.findUnique({ where: { sessionId_problemId_userId: { sessionId, problemId, userId } } });
    if (existing && !EXEMPT_EMAILS.has(email) && existing.attempts >= 10) {
      return NextResponse.json({ error: "submission limit reached (10 per problem)" }, { status: 429 });
    }

    const saved = await prisma.submission.upsert({
      where: { sessionId_problemId_userId: { sessionId, problemId, userId } },
      update: {
        language,
        code,
        results,
        passed,
        attempts: { increment: 1 },
        time: time !== undefined ? time : undefined,
        memory: memory !== undefined ? memory : undefined,
        problemText: problemText || undefined,
      },
      create: {
        sessionId,
        problemId,
        userId,
        language,
        code,
        results,
        passed,
        time: time !== undefined ? time : undefined,
        memory: memory !== undefined ? memory : undefined,
        problemText: problemText || undefined,
      },
    });

    return NextResponse.json(saved, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
