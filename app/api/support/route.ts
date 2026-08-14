import { NextResponse } from "next/server";
import { sendSupportEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    await sendSupportEmail(name, email, message);

    return NextResponse.json({ message: "Thank you! Your issue report has been submitted." }, { status: 200 });
  } catch (error: any) {
    console.error("Error in /api/support:", error);
    return NextResponse.json({ error: error?.message || "Failed to submit issue report." }, { status: 500 });
  }
}
