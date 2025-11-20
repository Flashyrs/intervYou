import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string | undefined;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const item = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { participants: { select: { id: true } } },
    });

    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (item.createdBy === userId)
      return NextResponse.json({ role: "interviewer" }, { status: 200 });
    type Participant = {
      id: string;
    };
    if (item.participants.some((p: { id: string }) => p.id === userId))
      return NextResponse.json({ role: "interviewee" }, { status: 200 });

    // Auto-join logic: if not full (1 interviewee max), add them
    if (item.participants.length === 0) {
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: { participants: { connect: { id: userId } } },
      });
      return NextResponse.json({ role: "interviewee" }, { status: 200 });
    }

    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
