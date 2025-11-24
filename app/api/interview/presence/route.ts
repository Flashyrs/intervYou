import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils";
import { trackParticipantJoin, trackParticipantLeave, endSession } from "@/lib/sessionExpiration";

export async function POST(req: Request) {
    try {
        const session = await requireAuth();
        const userId = (session.user as any)?.id as string | undefined;

        if (!userId) {
            return NextResponse.json({ error: "User ID required" }, { status: 400 });
        }

        const { sessionId, action } = await req.json();

        if (!sessionId || !action) {
            return NextResponse.json({ error: "sessionId and action required" }, { status: 400 });
        }

        if (action === "join") {
            await trackParticipantJoin(sessionId, userId);
            return NextResponse.json({ success: true, message: "Join tracked" });
        } else if (action === "leave") {
            const result = await trackParticipantLeave(sessionId, userId);
            return NextResponse.json({ success: true, message: "Leave tracked" });
        } else if (action === "end") {
            
            const result = await endSession(sessionId, userId);
            return NextResponse.json(result);
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
    } catch (e: any) {
        console.error("Presence tracking error:", e);
        return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
    }
}
