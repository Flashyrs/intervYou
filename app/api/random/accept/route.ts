import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";

const EXEMPT_EMAILS = new Set([
  "roshanshuklayt@gmail.com",
  "shilpachaurasiya1205@gmail.com",
]);

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string | undefined;
    const email = session.user?.email || "";
    const { tempId, initiatorId } = await req.json();
    if (!tempId) return NextResponse.json({ error: 'tempId required' }, { status: 400 });
    if (!initiatorId) return NextResponse.json({ error: 'initiatorId required' }, { status: 400 });

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Missing user ID in session' }, { status: 401 });
    }

    if (userId === initiatorId) {
      return NextResponse.json({ error: 'You cannot accept your own matchmaking invite' }, { status: 400 });
    }

    const key = `random_match_claim:${tempId}`;
    const claimed = await redis.set(key, userId, "EX", 3600, "NX");
    if (!claimed) {
        return NextResponse.json({ error: 'Interview claim already accepted by another user' }, { status: 409 });
    }

    const userExists = await prisma.user.count({ where: { id: userId } });
    const initiatorExists = await prisma.user.count({ where: { id: initiatorId } });

    if (userExists === 0 || initiatorExists === 0) {
      await redis.del(key); // Unlock if invalid
      return NextResponse.json({ error: 'One or both users not found' }, { status: 400 });
    }

    const isExempt = EXEMPT_EMAILS.has(email) || 
                     email === process.env.EXEMPT_EMAIL1 || 
                     email === process.env.EXEMPT_EMAIL2;
    if (process.env.NODE_ENV !== 'development' && !isExempt) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const todayCount = await prisma.interviewSession.count({
        where: { createdAt: { gte: since }, createdBy: userId },
      });
      if (todayCount >= 1) {
        await redis.del(key); // Unlock if limit reached
        return NextResponse.json({ error: 'daily interview limit reached' }, { status: 429 });
      }
    }

    const created = await prisma.interviewSession.create({
      data: {
        createdBy: userId, 
        participants: {
          connect: [
            { id: userId }, 
            { id: initiatorId }, 
          ],
        },
      },
    });

    return NextResponse.json({ sessionId: created.id }, { status: 200 });
  } catch (e: any) {
    console.error("Error in /api/random/accept:", e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
