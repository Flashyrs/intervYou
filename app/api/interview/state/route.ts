import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { getInterviewState, updateInterviewState } from "@/lib/interviewStateStore";

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

    const result = await getInterviewState(sessionId, userId);
    return NextResponse.json(result.response, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string | undefined;
    const body = await req.json();
    const sessionId = body?.sessionId as string | undefined;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const patch: Record<string, any> = {};

    if (typeof body.language === "string") patch.language = body.language;
    if (typeof body.code === "string") patch.code = body.code;
    if (typeof body.problemText === "string") patch.problemText = body.problemText;
    if (typeof body.sampleTests === "string") patch.sampleTests = body.sampleTests;
    if (typeof body.driver === "string") patch.driver = body.driver;
    if (typeof body.problemTitle === "string") patch.problemTitle = body.problemTitle;
    if (typeof body.privateTests === "string") patch.privateTests = body.privateTests;
    if (typeof body.problemId === "string") patch.problemId = body.problemId;
    if (typeof body.interviewerNotes === "string") patch.interviewerNotes = body.interviewerNotes;
    if (body.codeMap) patch.codeMap = body.codeMap;
    if (body.driverMap) patch.driverMap = body.driverMap;
    if (body.lastOutput !== undefined) patch.lastOutput = body.lastOutput;
    if (body.timerState) patch.timerState = body.timerState;
    if (body.isFrozen !== undefined) patch.isFrozen = body.isFrozen;

    const result = await updateInterviewState({
      sessionId,
      userId,
      patch,
      baseVersion: typeof body.baseVersion === "number" ? body.baseVersion : undefined,
    });

    return NextResponse.json(result.response, { status: result.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
