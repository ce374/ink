import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildWorkspaceBackup } from "@/lib/backup";
import { createReadStream, existsSync } from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const maxDuration = 600;

// Export a workspace as a ZIP stream
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ws = await db.workspace.findUnique({ where: { id } });
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { backup, mediaFiles } = await buildWorkspaceBackup(id);

  const archiverMod: any = await import("archiver");
  const ZipArchive = archiverMod.ZipArchive;
  const archive = new ZipArchive({ zlib: { level: 1 } });
  const chunks: Buffer[] = [];
  archive.on("data", (c: Buffer) => chunks.push(c));

  archive.append(JSON.stringify(backup, null, 2), { name: "workspace.json" });

  for (const [zipPath, absPath] of mediaFiles) {
    if (existsSync(absPath)) {
      archive.append(createReadStream(absPath), { name: zipPath });
    }
  }

  await archive.finalize();
  const buf = Buffer.concat(chunks);

  const safe = ws.name.replace(/[^a-z0-9-_]+/gi, "_");
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safe}.zip"`,
      "Content-Length": String(buf.length),
    },
  });
}
