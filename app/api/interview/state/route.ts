import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    const stateStr = await redis.get(`session:${sessionId}:state`);
    const state = stateStr ? JSON.parse(stateStr) : {};
    return NextResponse.json(state, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAuth();
    const body = await req.json();
    const { sessionId, language, code, problemText, sampleTests, driver } = body || {};
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const data: any = {};
    if (typeof language === "string") data.language = language;
    if (typeof code === "string") data.code = code;
    if (typeof problemText === "string") data.problemText = problemText;
    if (typeof sampleTests === "string") data.sampleTests = sampleTests;
    if (typeof driver === "string") data.driver = driver;
    if (typeof body.problemTitle === "string") data.problemTitle = body.problemTitle;
    if (typeof body.privateTests === "string") data.privateTests = body.privateTests;
    if (body.codeMap) data.codeMap = body.codeMap;
    if (body.driverMap) data.driverMap = body.driverMap;
    if (body.lastOutput) data.lastOutput = body.lastOutput;
    if (body.timerState) data.timerState = body.timerState;

    const stateStr = await redis.get(`session:${sessionId}:state`);
    const currentState = stateStr ? JSON.parse(stateStr) : {};
    const newState = { ...currentState, sessionId, ...data };
    
    await redis.set(`session:${sessionId}:state`, JSON.stringify(newState), 'EX', 86400);

    return NextResponse.json(newState, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
