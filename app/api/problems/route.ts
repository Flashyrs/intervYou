import { NextResponse } from "next/server";
import { problems } from "@/lib/problems";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const p = problems.find((x) => x.id === id);
    if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(p, { status: 200 });
  }
  return NextResponse.json(problems, { status: 200 });
}
