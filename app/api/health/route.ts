import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    tieneApiKey: !!process.env.GOOGLE_API_KEY,
    timestamp: new Date().toISOString(),
  });
}
