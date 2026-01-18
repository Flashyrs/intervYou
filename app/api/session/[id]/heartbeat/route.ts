import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;

        const session = await prisma.interviewSession.findUnique({
            where: { id },
            select: {
                status: true,
                lastActiveAt: true,
                startedAt: true,
                endedAt: true
            },
        });

        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        if (session.status === 'completed' || session.status === 'expired' || session.endedAt) {
            return NextResponse.json({ error: "Session ended" }, { status: 410 }); // 410 Gone
        }

        const now = new Date();

        // Check for timeout if it has started and nobody was active for > 10 mins
        if (session.startedAt && session.lastActiveAt) {
            const diff = now.getTime() - new Date(session.lastActiveAt).getTime();
            const tenMinutes = 10 * 60 * 1000;

            if (diff > tenMinutes) {
                // Expire it
                await prisma.interviewSession.update({
                    where: { id },
                    data: { status: 'expired', endedAt: now }
                });
                return NextResponse.json({ error: "Session expired due to inactivity" }, { status: 410 });
            }
        }

        // Update heartbeat
        // Also set startedAt if not set (first heartbeat implies someone joined)
        await prisma.interviewSession.update({
            where: { id },
            data: {
                lastActiveAt: now,
                startedAt: session.startedAt ? undefined : now,
            },
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Heartbeat failed" }, { status: 500 });
    }
}
