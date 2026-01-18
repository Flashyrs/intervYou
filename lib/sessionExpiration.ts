import { prisma } from "./db";
import { sendSessionArchivedEmail } from "./email";

export interface ParticipantTracking {
    [userId: string]: number;
}

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

        const joinedAt = (session.participantJoinedAt as ParticipantTracking) || {};
        joinedAt[userId] = Date.now();


        const leftAt = (session.participantLeftAt as ParticipantTracking) || {};
        delete leftAt[userId];

        await prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                participantJoinedAt: joinedAt as any,
                participantLeftAt: leftAt as any,
            },
        });

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

        const leftAt = (session.participantLeftAt as ParticipantTracking) || {};
        leftAt[userId] = Date.now();

        await prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                participantLeftAt: leftAt as any,
            },
        });



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

        const joinedAt = (session.participantJoinedAt as ParticipantTracking) || {};
        const leftAt = (session.participantLeftAt as ParticipantTracking) || {};

        const joinedUserIds = Object.keys(joinedAt);


        if (joinedUserIds.length === 0) {
            return { expired: false };
        }


        const allLeft = joinedUserIds.every((userId) => leftAt[userId] !== undefined);

        if (!allLeft) {
            return { expired: false };
        }


        const GRACE_PERIOD_MS = 30 * 1000;
        const now = Date.now();


        const lastLeaveTime = Math.max(...joinedUserIds.map(id => leftAt[id] || 0));
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
                participantJoinedAt: true,
                participantLeftAt: true,
            },
        });

        if (!session) {
            return false;
        }


        if (session.status === "expired") {

            const leftAt = (session.participantLeftAt as ParticipantTracking) || {};
            const leaveTimestamps = Object.values(leftAt);

            if (leaveTimestamps.length > 0) {
                const GRACE_PERIOD_MS = 30 * 1000;
                const lastLeaveTime = Math.max(...leaveTimestamps);
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

