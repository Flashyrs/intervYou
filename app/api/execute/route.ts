import { NextResponse } from "next/server";
import { submitToJudge0 } from "@/lib/judge0";
import { requireAuth } from "@/lib/utils";
import { prisma } from "@/lib/db";

const ALLOWED_LANGS: Record<string, number> = {
  javascript: 63,
  java: 62,
  cpp: 54,
};

const EXEMPT_EMAILS = new Set(
  [process.env.EXEMPT_EMAIL1, process.env.EXEMPT_EMAIL2].filter(Boolean)
);

export async function POST(req: Request) {
  try {
    // Require authenticated user
    const session = await requireAuth();
    const userId = session.user.id;
    const email = session.user.email || "";

    const {
      language,
      source_code,
      stdin,
      sessionId,
      problemId,
      mode = "run",
      tests,
      sampleTestsVisible = true,
    } = await req.json();

    const langKey = typeof language === "string" ? language.toLowerCase() : "";
    const language_id = ALLOWED_LANGS[langKey];

    if (!language_id || !source_code) {
      return NextResponse.json(
        { error: "language (javascript/java/cpp) and source_code required" },
        { status: 400 }
      );
    }

    if (source_code.length > 100_000) {
      return NextResponse.json({ error: "source_code too large" }, { status: 413 });
    }

    // Enforce per-user per-interview limit of 2 distinct problems (unless exempt)
    if (sessionId && problemId && !EXEMPT_EMAILS.has(email)) {
      const existing = await prisma.executionLog.findFirst({
        where: { sessionId, userId, problemId },
        select: { id: true },
      });

      if (!existing) {
        const distinctCount = await prisma.executionLog.groupBy({
          by: ["problemId"],
          where: { sessionId, userId },
          _count: { _all: true },
        });

        if (distinctCount.length >= 2) {
          return NextResponse.json(
            { error: "problem limit reached for this interview" },
            { status: 429 }
          );
        }

        await prisma.executionLog.create({ data: { sessionId, userId, problemId } });
      }
    }

    // Run code using Judge0
    const result = await submitToJudge0({
      language_id,
      source_code,
      stdin: stdin ?? "",
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Execution failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
