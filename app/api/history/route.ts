import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    try {
        const session = await requireAuth();
        const userId = (session.user as any)?.id as string | undefined;
        const email = session.user?.email || "";

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const sessions = await prisma.interviewSession.findMany({
            where: {
                OR: [
                    { createdBy: userId },
                    { participants: { some: { id: userId } } },
                    { inviteeEmail: email },
                ],
            },
            orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }], // Most recent first
            include: {
                participants: { select: { name: true, email: true } },
            }
        });

        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        const upcoming: any[] = [];
        const past: any[] = [];

        sessions.forEach((s) => {
            // 1 Year History Limit
            if (new Date(s.createdAt) < oneYearAgo) return;

            const isEnded = s.status === 'completed' || s.status === 'expired' || !!s.endedAt;

            // Resolve correct name for random interviews
            let displayInviteeName = s.inviteeName;

            // If random interview (no specific inviteeName and not scheduled with specific email)
            if (!displayInviteeName && s.participants.length > 0) {
                // Find the OTHER participant (not me)
                const other = s.participants.find((p) => p.email !== email);
                if (other) {
                    displayInviteeName = other.name || other.email || "Anonymous User";
                }
            }

            const sessionWithCorrectName = { ...s, inviteeName: displayInviteeName };

            if (isEnded) {
                past.push(sessionWithCorrectName);
            } else {
                // Determine effective expiry
                // 1. Scheduled: If > 2 hours past scheduled time -> Expired
                // 2. Instant: If > 2 hours past creation time -> Expired
                // 3. Zombie: If started > 24 hours ago -> Expired

                const scheduledTime = s.scheduledFor ? new Date(s.scheduledFor).getTime() : 0;
                const createdTime = new Date(s.createdAt).getTime();
                const startTime = s.startedAt ? new Date(s.startedAt).getTime() : 0;

                const twoHoursAgo = now.getTime() - 2 * 60 * 60 * 1000;
                const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;

                let isExpired = false;

                if (scheduledTime > 0) {
                    if (scheduledTime < twoHoursAgo && !s.startedAt) isExpired = true;
                } else {
                    // Instant interview check
                    if (createdTime < twoHoursAgo && !s.startedAt) isExpired = true;
                }

                if (startTime > 0 && startTime < twentyFourHoursAgo) isExpired = true;

                // Aggressive Zombie Check: If created > 24h ago and NOT scheduled for future, it's expired.
                if (createdTime < twentyFourHoursAgo && (!scheduledTime || scheduledTime < now.getTime())) {
                    isExpired = true;
                }

                if (isExpired) {
                    past.push({ ...sessionWithCorrectName, status: 'expired' });
                } else {
                    upcoming.push(sessionWithCorrectName);
                }
            }
        });

        return NextResponse.json({ upcoming, past });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to fetch history" }, { status: 500 });
    }
}
