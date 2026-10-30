import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readMedia, deleteMedia } from "@/lib/storage";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const maxDuration = 300;

// Serve media file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dl = req.nextUrl.searchParams.get("download") === "1";
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const buf = await readMedia(asset.workspaceId, asset.id, asset.ext);
    const headers = new Headers();
    headers.set("Content-Type", asset.mimeType);
    headers.set("Content-Length", String(buf.length));
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    if (dl) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(asset.filename)}"`
      );
    } else {
      headers.set(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(asset.filename)}"`
      );
    }
    return new NextResponse(buf as unknown as BodyInit, { headers });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}

// Delete a media asset
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const asset = await db.mediaAsset.findUnique({ where: { id } });
  if (!asset) return NextResponse.json({ ok: true });
  await deleteMedia(asset.workspaceId, asset.id, asset.ext);
  await db.mediaAsset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const _p = path;
