import { NextRequest, NextResponse } from "next/server";
import {
  extractZip,
  importWorkspaceFromEntries,
  cleanupTmp,
} from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const maxDuration = 600;

// Import a single workspace from a ZIP (raw body)
export async function POST(req: NextRequest) {
  if (!req.body) {
    return NextResponse.json({ error: "No body" }, { status: 400 });
  }
  let tmpRoot: string | null = null;
  try {
    const { entries, tmpRoot: tr } = await extractZip(
      req.body as unknown as ReadableStream<Uint8Array>
    );
    tmpRoot = tr;
    const newId = await importWorkspaceFromEntries(entries);
    if (!newId) {
      return NextResponse.json(
        { error: "Invalid workspace zip (no workspace.json)" },
        { status: 400 }
      );
    }
    return NextResponse.json({ workspaceId: newId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    if (tmpRoot) cleanupTmp(tmpRoot);
  }
}
