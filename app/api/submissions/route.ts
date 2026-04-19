import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getInterviewerNotesForSessions } from "@/lib/interviewStateStore";

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
      take: 50,
      include: {
        testResults: true,
        session: {
          select: {
            id: true,
            createdAt: true,
            createdBy: true,
            participants: {
              select: { id: true, name: true, email: true }
            }
          },
        },
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    const notesBySessionId = await getInterviewerNotesForSessions(
      userId,
      rows.map((row) => row.sessionId)
    );

    const payload = rows.map((row: any) => ({
      ...row,
      // Backwards compat: reconstruct a "results" JSON string from testResults for consuming clients
      results: JSON.stringify(row.testResults.map((tr: any) => ({
        pass: tr.passed,
        got: tr.actualOutput,
        exp: tr.expectedOutput,
        error: tr.error,
        time: tr.time,
        memory: tr.memory,
      }))),
      interviewerNotes: row.session?.createdBy === userId ? (notesBySessionId[row.sessionId] || null) : null,
    }));

    return NextResponse.json(payload, { status: 200 });
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

    // Use a transaction: upsert the submission, then replace test results
    const saved = await prisma.$transaction(async (tx) => {
      const sub = await tx.submission.upsert({
        where: { sessionId_problemId_userId: { sessionId, problemId, userId } },
        update: {
          language,
          code,
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
          passed,
          time: time !== undefined ? time : undefined,
          memory: memory !== undefined ? memory : undefined,
          problemText: problemText || undefined,
        },
      });

      // Clear old test results and insert new ones
      await tx.testCaseResult.deleteMany({ where: { submissionId: sub.id } });
      if (Array.isArray(parsed) && parsed.length > 0) {
        await tx.testCaseResult.createMany({
          data: parsed.map((r: any) => ({
            submissionId: sub.id,
            passed: !!r.pass && !r.error,
            time: r.time ? parseFloat(r.time) : null,
            memory: r.memory ? parseFloat(r.memory) : null,
            stdout: r.got ? String(r.got) : null,
            error: r.error ? String(r.error) : null,
            expectedOutput: r.exp ? String(r.exp) : null,
            actualOutput: r.got ? String(r.got) : null,
          })),
        });
      }

      return sub;
    });

    return NextResponse.json(saved, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
