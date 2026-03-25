import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string | undefined;
    const userEmail = session.user?.email?.toLowerCase() || null;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const item = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { participants: { select: { id: true } } },
    });

    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (item.status === "completed" || item.status === "expired" || item.endedAt) {
      return NextResponse.json({ error: "session ended" }, { status: 410 });
    }

    if (item.createdBy === userId)
      return NextResponse.json({ role: "interviewer" }, { status: 200 });

    const isExistingParticipant = item.participants.some((p: { id: string }) => p.id === userId);
    if (isExistingParticipant)
      return NextResponse.json({ role: "interviewee" }, { status: 200 });

    const nonCreatorParticipants = item.participants.filter((p: { id: string }) => p.id !== item.createdBy);
    const hasIntervieweeJoined = nonCreatorParticipants.length > 0;
    const matchesInviteeEmail = !!item.inviteeEmail && !!userEmail && item.inviteeEmail.toLowerCase() === userEmail;
    const canJoinAsFirstInterviewee =
      !hasIntervieweeJoined && (!item.isScheduled || !item.inviteeEmail || matchesInviteeEmail);

    if (canJoinAsFirstInterviewee) {
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          participants: { connect: { id: userId } },
          status: item.status === "scheduled" ? "active" : item.status,
          startedAt: item.startedAt ?? (item.status === "scheduled" ? new Date() : undefined),
        },
      });
      return NextResponse.json({ role: "interviewee" }, { status: 200 });
    }

    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
