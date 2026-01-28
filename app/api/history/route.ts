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

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(new Date().getFullYear() - 1);

        const sessions = await prisma.interviewSession.findMany({
            where: {
                AND: [
                    { createdAt: { gte: oneYearAgo } }, // DB-level date filter
                    {
                        OR: [
                            { createdBy: userId },
                            { participants: { some: { id: userId } } },
                            { inviteeEmail: email },
                        ],
                    }
                ]
            },
            orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }], // Most recent first
            take: 15, // Optimization: Fetch only top 15 (buffer for limit 10)
            select: {
                id: true,
                status: true,
                createdAt: true,
                scheduledFor: true,
                startedAt: true,
                endedAt: true,
                inviteeName: true,
                inviteeEmail: true,
                participants: { select: { name: true, email: true } },
            }
        });

        const now = new Date();
        const upcoming: any[] = [];
        const past: any[] = [];

        for (const s of sessions) {
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

            if (sessions.indexOf(s) >= 10 && (isEnded || past.length >= 10)) {
                // Hard limit 10 for display if needed, but let's process 15 and just slice at end if we want strict 10
                // For now, let's just categorize all 15 fetched
            }

            if (isEnded) {
                past.push(sessionWithCorrectName);
            } else {
                // Determine effective expiry logic (simplified for speed, kept same logic)
                const scheduledTime = s.scheduledFor ? new Date(s.scheduledFor).getTime() : 0;
                const createdTime = new Date(s.createdAt).getTime();
                const startTime = s.startedAt ? new Date(s.startedAt).getTime() : 0;

                const twoHoursAgo = now.getTime() - 2 * 60 * 60 * 1000;
                const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;
                let isExpired = false;

                if (scheduledTime > 0) {
                    if (scheduledTime < twoHoursAgo && !s.startedAt) isExpired = true;
                } else {
                    if (createdTime < twoHoursAgo && !s.startedAt) isExpired = true;
                }
                if (startTime > 0 && startTime < twentyFourHoursAgo) isExpired = true;
                if (createdTime < twentyFourHoursAgo && (!scheduledTime || scheduledTime < now.getTime())) {
                    isExpired = true;
                }

                if (isExpired) {
                    past.push({ ...sessionWithCorrectName, status: 'expired' });
                } else {
                    upcoming.push(sessionWithCorrectName);
                }
            }
        }

        // Ensure we strictly return max 10 total or per category if desired. 
        // User said "max 10 entries in history". History usually means 'past'.
        // We will slice 'past' to 10 just in case.
        return NextResponse.json({ upcoming, past: past.slice(0, 10) });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Failed to fetch history" }, { status: 500 });
    }
}
