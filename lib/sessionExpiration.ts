import { prisma } from "./db";

export interface ParticipantTracking {
    [userId: string]: number; // timestamp
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

        // Clear any previous "left" timestamp when rejoining (handle refreshes)
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

        // DON'T expire immediately - wait for grace period
        // This handles page refreshes without locking users out
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
    // In a real app, you'd use a job queue (Bull, BullMQ, etc.)
    // For now, this is just a placeholder
    // The actual check happens when users try to access the session
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

        // Immediately expire the session
        await prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                status: "expired",
                expiresAt: new Date(),
            },
        });

        // Cleanup (archive) the session data
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

        // Check if there are any participants who joined
        if (joinedUserIds.length === 0) {
            return { expired: false };
        }

        // Check if all participants have left
        const allLeft = joinedUserIds.every((userId) => leftAt[userId] !== undefined);

        if (!allLeft) {
            return { expired: false };
        }

        // Grace period: 30 seconds after last person left
        const GRACE_PERIOD_MS = 30 * 1000; // 30 seconds
        const now = Date.now();

        // Find the most recent leave time
        const lastLeaveTime = Math.max(...joinedUserIds.map(id => leftAt[id] || 0));
        const timeSinceLastLeave = now - lastLeaveTime;

        // Only expire if grace period has passed
        if (timeSinceLastLeave < GRACE_PERIOD_MS) {
            return { expired: false, gracePeriodRemaining: GRACE_PERIOD_MS - timeSinceLastLeave };
        }

        // Grace period passed - expire the session
        await prisma.interviewSession.update({
            where: { id: sessionId },
            data: {
                status: "expired",
                expiresAt: new Date(),
            },
        });

        // Cleanup and archive the session data
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

        // Archive the interview state (just mark it, don't delete)
        // The data remains in the database for reference

        // Optional: Send notification emails to participants
        // This can be implemented if needed

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

        // If session is expired, check if we're still in grace period
        if (session.status === "expired") {
            // Check grace period
            const leftAt = (session.participantLeftAt as ParticipantTracking) || {};
            const leaveTimestamps = Object.values(leftAt);

            if (leaveTimestamps.length > 0) {
                const GRACE_PERIOD_MS = 30 * 1000;
                const lastLeaveTime = Math.max(...leaveTimestamps);
                const timeSinceLastLeave = Date.now() - lastLeaveTime;

                // Allow access within grace period (for refreshes)
                if (timeSinceLastLeave < GRACE_PERIOD_MS) {
                    return true;
                }
            }

            return false;
        }

        // If session is scheduled, check if it's time yet
        if (session.status === "scheduled" && session.scheduledFor) {
            const now = new Date();
            // Allow joining 5 minutes before scheduled time
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

