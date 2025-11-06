import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";

const EXEMPT_EMAILS = new Set([
  process.env.EXEMPT_EMAIL1 || "",
  process.env.EXEMPT_EMAIL2 || "",
].filter(Boolean));

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string | undefined;
    const inviterName = session.user?.name || null;
    const inviterEmail = session.user?.email || null;

    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    if (!EXEMPT_EMAILS.has(inviterEmail || "")) {
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

    await sendInviteEmail(email, link, { name: inviterName, email: inviterEmail });

    // Provide immediate redirect hint for interviewer
    const res = NextResponse.json({ id: created.id, link, redirect: link }, { status: 200 });
    res.headers.set("X-Interview-Redirect", link);
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
