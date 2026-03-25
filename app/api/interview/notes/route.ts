import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { getInterviewerNotes, updateInterviewerNotes } from "@/lib/interviewStateStore";

export async function GET(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string | undefined;
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notes = await getInterviewerNotes(sessionId, userId);
    return NextResponse.json({ notes }, { status: 200 });
  } catch (e: any) {
    const message = e?.message || "failed";
    const status = message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string | undefined;
    const body = await req.json();
    const sessionId = body?.sessionId as string | undefined;
    const notes = body?.notes;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    if (typeof notes !== "string") {
      return NextResponse.json({ error: "notes required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const saved = await updateInterviewerNotes(sessionId, userId, notes);
    return NextResponse.json({ notes: saved }, { status: 200 });
  } catch (e: any) {
    const message = e?.message || "failed";
    const status = message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
