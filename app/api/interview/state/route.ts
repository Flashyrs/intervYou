import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    const state = await prisma.interviewState.findUnique({ where: { sessionId } });
    return NextResponse.json(state || {}, { status: 200 });
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

    const saved = await prisma.interviewState.upsert({
      where: { sessionId },
      create: { sessionId, ...data },
      update: data,
    });
    return NextResponse.json(saved, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
