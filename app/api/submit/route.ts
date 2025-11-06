import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

const EXEMPT_EMAILS = new Set([
  "roshanshuklayt@gmail.com",
  "shilpachaurasiya1205@gmail.com",
]);

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string | undefined;
    const email = session.user?.email || "";
    const { sessionId, problemId } = await req.json();
    if (!sessionId || !problemId) {
      return NextResponse.json({ error: "sessionId and problemId required" }, { status: 400 });
    }

    if (!EXEMPT_EMAILS.has(email)) {
      const count = await prisma.executionLog.count({ where: { sessionId, userId: userId!, problemId } });
      if (count >= 2) {
        return NextResponse.json({ error: "submission limit reached (2 per problem)" }, { status: 429 });
      }
    }

    // Record a submission event using ExecutionLog as minimal persistence (no code/result storage here)
    await prisma.executionLog.create({ data: { sessionId, userId: userId!, problemId } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
