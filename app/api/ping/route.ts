import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        timestamp: Date.now(),
        message: 'pong'
    }, { status: 200 });
}
