import { NextRequest, NextResponse } from "next/server";
import { seedExampleWorkspace } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const maxDuration = 300;

// Create an example workspace seeded from iTunes + LRCLIB.
export async function POST(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist") || "Daft Punk";
  try {
    const result = await seedExampleWorkspace(artist, {
      albumLimit: 5,
      trackLimit: 10,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
