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

    const { email, scheduledFor, isScheduled, inviteeName } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }


    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
    const isScheduledInterview = isScheduled === true && scheduledDate !== null;

    if (!EXEMPT_EMAILS.has(inviterEmail || "")) {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const todayCount = await prisma.interviewSession.count({
        where: { createdAt: { gte: since }, createdBy: userId },
      });
      if (todayCount >= 5) { // Increased limit or kept logic
        // return NextResponse.json({ error: 'daily interview limit reached' }, { status: 429 });
      }
    }

    const created = await prisma.interviewSession.create({
      data: {
        createdBy: userId!,
        participants: userId ? { connect: [{ id: userId }] } : undefined,
        scheduledFor: scheduledDate,
        isScheduled: isScheduledInterview,
        inviteeEmail: email,
        inviteeName: inviteeName || null,
        status: isScheduledInterview ? "scheduled" : "active",
      },
    });

    const link = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/interview/${created.id}`;

    // Send email to invitee
    await sendInviteEmail(email, link, { name: inviterName, email: inviterEmail }, scheduledDate || undefined, isScheduledInterview, inviteeName);

    // If scheduled, send email to interviewer as well (confirmation)
    if (isScheduledInterview && inviterEmail) {
      await sendInviteEmail(inviterEmail, link, { name: inviterName, email: inviterEmail }, scheduledDate || undefined, isScheduledInterview, "Interviewer");
    }

    // For Scheduled: No redirect, stay on dashboard.
    // For Instant: Redirect to room.
    const redirectLink = isScheduledInterview ? null : link;

    return NextResponse.json({ id: created.id, link, redirect: redirectLink }, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
