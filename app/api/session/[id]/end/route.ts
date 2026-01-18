import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const session = await requireAuth();
        const userId = (session.user as any)?.id as string | undefined;

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = params;

        // Verify ownership or participation? 
        // Usually only the creator (Interviewer) should be able to end it manually.
        const interviewSession = await prisma.interviewSession.findUnique({
            where: { id },
            select: { createdBy: true, status: true }
        });

        if (!interviewSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        if (interviewSession.createdBy !== userId) {
            return NextResponse.json({ error: "Only the interviewer can end the session" }, { status: 403 });
        }

        await prisma.interviewSession.update({
            where: { id },
            data: {
                status: "completed",
                endedAt: new Date(),
            },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to end session" }, { status: 500 });
    }
}
