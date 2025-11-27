import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { buildHarness } from "@/lib/interviewUtils";

export async function POST(req: Request) {
    try {
        await requireAuth();

        const { language, userCode, driver, tests } = await req.json();

        if (!language || !userCode) {
            return NextResponse.json(
                { error: "language and userCode required" },
                { status: 400 }
            );
        }

        // Build the test harness using our utility function
        const harnessCode = buildHarness(
            language,
            userCode,
            driver || "",
            Array.isArray(tests) ? tests : []
        );

        return NextResponse.json({ harnessCode }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json(
            { error: e?.message || "Failed to build harness" },
            { status: 500 }
        );
    }
}
