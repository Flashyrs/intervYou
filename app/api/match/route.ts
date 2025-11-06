import { NextResponse } from "next/server";
import { enqueue, tryMatch } from "@/lib/matchmaker";
import { requireAuth } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any)?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    enqueue(userId);
    const match = tryMatch();
    if (match) {
      return NextResponse.json({ matched: true, users: match }, { status: 200 });
    }
    return NextResponse.json({ matched: false }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}
