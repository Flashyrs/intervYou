import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

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

    
    const userExists = await prisma.user.count({ where: { id: userId } });
    const initiatorExists = await prisma.user.count({ where: { id: initiatorId } });

    if (userExists === 0 || initiatorExists === 0) {
      return NextResponse.json({ error: 'One or both users not found in DB' }, { status: 400 });
    }

    if (!EXEMPT_EMAILS.has(email)) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const todayCount = await prisma.interviewSession.count({
        where: { createdAt: { gte: since }, createdBy: userId },
      });
      if (todayCount >= 1) {
        return NextResponse.json({ error: 'daily interview limit reached' }, { status: 429 });
      }
    }

    const created = await prisma.interviewSession.create({
      data: {
        createdBy: userId!, 
        participants: {
          connect: [
            { id: userId! }, 
            { id: initiatorId }, 
          ],
        },
      },
    });

    return NextResponse.json({ sessionId: created.id }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
