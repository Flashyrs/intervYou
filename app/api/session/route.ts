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
        participants: userId ? { connect: [{ id: userId }] } : undefined,
      },
    });

    const link = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/interview/${created.id}`;
    return NextResponse.json({ id: created.id, link }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}
