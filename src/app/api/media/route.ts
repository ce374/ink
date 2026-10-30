import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeMedia } from "@/lib/storage";
import { getExt, isImageExt, isAudioExt } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const maxDuration = 300;

// Upload a media file (multipart). Returns media asset row.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const workspaceId = form.get("workspaceId") as string;
  const file = form.get("file") as File | null;
  if (!workspaceId || !file) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const ext = getExt(file.name) || "bin";
  const mimeType = file.type || "application/octet-stream";
  const mediaId = `m_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeMedia(workspaceId, mediaId, ext, buf);
  const asset = await db.mediaAsset.create({
    data: {
      id: mediaId,
      workspaceId,
      filename: file.name,
      mimeType,
      size: buf.length,
      ext,
    },
  });
  return NextResponse.json({ asset });
}

export function GET() {
  return NextResponse.json({
    audio: true,
    image: true,
    note: "POST multipart with workspaceId + file",
  });
}

export const _helpers = { isImageExt, isAudioExt };
