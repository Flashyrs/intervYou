import { prisma } from "./db";
import { sendSessionArchivedEmail } from "./email";
import { persistFinalInterviewState } from "./interviewStateStore";

/**
 * Track when a participant joins an interview session
 */
export async function trackParticipantJoin(sessionId: string, userId: string) {
    try {
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
        });

        if (!session) {
            throw new Error("Session not found");
        }

        // Record the join event
        await prisma.participantEvent.create({
            data: {
                sessionId,
                userId,
                eventType: "JOINED",
            },
        });

        await persistFinalInterviewState(sessionId);

        return { success: true };
    } catch (error) {
        console.error("Error tracking participant join:", error);
        throw error;
    }
}

/**
 * Track when a participant leaves an interview session
 * NOTE: This is triggered on page unload, so it might be a refresh, not actual leave
 */
export async function trackParticipantLeave(sessionId: string, userId: string) {
    try {
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
        });

        if (!session) {
            throw new Error("Session not found");
        }

        // Record the leave event
        await prisma.participantEvent.create({
            data: {
                sessionId,
                userId,
                eventType: "LEFT",
            },
        });

        await persistFinalInterviewState(sessionId);

        scheduleExpirationCheck(sessionId);

        return { success: true };
    } catch (error) {
        console.error("Error tracking participant leave:", error);
        throw error;
    }
}

/**
 * Schedule a delayed expiration check to handle page refreshes
 * If users don't rejoin within 30 seconds, session expires
 */
function scheduleExpirationCheck(sessionId: string) {
    console.log(`Scheduled expiration check for session ${sessionId}`);
}

/**
 * Explicitly end a session (called by "End Interview" button)
 * This immediately expires the session
 */
export async function endSession(sessionId: string, userId: string) {
    try {
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
        });

        if (!session) {
            throw new Error("Session not found");
        }

        await prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                status: "expired",
                endedAt: new Date(),
            },
        });

        await cleanupExpiredSession(sessionId);

        return { success: true, expired: true };
    } catch (error) {
        console.error("Error ending session:", error);
        throw error;
    }
}

/**
 * Helper: get the latest event per user for a session
 * Returns a map of userId -> { eventType, timestamp }
 */
async function getLatestEventsPerUser(sessionId: string) {
    const events = await prisma.participantEvent.findMany({
        where: { sessionId },
        orderBy: { timestamp: "desc" },
    });

    // For each user, pick the most recent event
    const latestByUser: Record<string, { eventType: string; timestamp: Date }> = {};
    for (const event of events) {
        if (!latestByUser[event.userId]) {
            latestByUser[event.userId] = {
                eventType: event.eventType,
                timestamp: event.timestamp,
            };
        }
    }

    return latestByUser;
}

/**
 * Check if all participants have left and been gone for grace period
 * This prevents accidental expiration from page refreshes
 */
export async function checkAndExpireSession(sessionId: string) {
    try {
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                participants: true,
            },
        });

        if (!session || session.status === "expired") {
            return { expired: false };
        }

        const latestByUser = await getLatestEventsPerUser(sessionId);
        const userIds = Object.keys(latestByUser);

        if (userIds.length === 0) {
            return { expired: false };
        }

        // Check if all users who ever joined have "LEFT" as their latest event
        const allLeft = userIds.every((uid) => latestByUser[uid].eventType === "LEFT");

        if (!allLeft) {
            return { expired: false };
        }

        const GRACE_PERIOD_MS = 30 * 1000;
        const now = Date.now();

        // Find the most recent leave timestamp
        const lastLeaveTime = Math.max(
            ...userIds
                .filter((uid) => latestByUser[uid].eventType === "LEFT")
                .map((uid) => latestByUser[uid].timestamp.getTime())
        );
        const timeSinceLastLeave = now - lastLeaveTime;

        if (timeSinceLastLeave < GRACE_PERIOD_MS) {
            return { expired: false, gracePeriodRemaining: GRACE_PERIOD_MS - timeSinceLastLeave };
        }

        await prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                status: "expired",
                endedAt: new Date(),
            },
        });

        await cleanupExpiredSession(sessionId);

        return { expired: true };
    } catch (error) {
        console.error("Error checking session expiration:", error);
        throw error;
    }
}

/**
 * Archive expired session data and send notification emails
 */
export async function cleanupExpiredSession(sessionId: string) {
    try {
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                participants: true,
            },
        });

        if (!session) {
            return;
        }

        const emails = session.participants
            .map(p => p.email)
            .filter((email): email is string => !!email);

        if (emails.length > 0) {
            await sendSessionArchivedEmail(emails, sessionId, session.createdAt);
        }

        console.log(`Session ${sessionId} has been archived`);

        return { success: true };
    } catch (error) {
        console.error("Error cleaning up expired session:", error);
        throw error;
    }
}

/**
 * Check if a session is accessible (not expired, or within grace period)
 */
export async function isSessionAccessible(sessionId: string): Promise<boolean> {
    try {
        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            select: {
                status: true,
                scheduledFor: true,
            },
        });

        if (!session) {
            return false;
        }

        if (session.status === "expired") {
            // Check if within grace period using ParticipantEvent records
            const latestByUser = await getLatestEventsPerUser(sessionId);
            const leftTimestamps = Object.values(latestByUser)
                .filter((e) => e.eventType === "LEFT")
                .map((e) => e.timestamp.getTime());

            if (leftTimestamps.length > 0) {
                const GRACE_PERIOD_MS = 30 * 1000;
                const lastLeaveTime = Math.max(...leftTimestamps);
                const timeSinceLastLeave = Date.now() - lastLeaveTime;

                if (timeSinceLastLeave < GRACE_PERIOD_MS) {
                    return true;
                }
            }

            return false;
        }

        if (session.status === "scheduled" && session.scheduledFor) {
            const now = new Date();
            const allowedTime = new Date(session.scheduledFor.getTime() - 5 * 60 * 1000);
            if (now < allowedTime) {
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error("Error checking session accessibility:", error);
        return false;
    }
}
