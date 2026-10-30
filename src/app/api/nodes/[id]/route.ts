import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteMedia } from "@/lib/storage";
import {
  SheetContent,
  emptySheet,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseContent(raw: string | null): SheetContent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed as SheetContent;
  } catch {
    return null;
  }
}

// Get a node (with children if folder, or content if file)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const withChildren = req.nextUrl.searchParams.get("children") === "1";
  const node = await db.node.findUnique({ where: { id } });
  if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let children = null;
  if (withChildren && node.type === "FOLDER") {
    children = await db.node.findMany({
      where: { parentId: id },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  }
  return NextResponse.json({
    node,
    content: node.type === "FILE" ? parseContent(node.content) : null,
    children,
  });
}

// Update a node (rename, move parent, update content)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const node = await db.node.findUnique({ where: { id } });
  if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data: {
    name?: string;
    parentId?: string | null;
    content?: string;
  } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    let n = body.name.trim();
    if (node.type === "FILE" && !n.endsWith(".nt")) n = n + ".nt";
    data.name = n;
  }
  if ("parentId" in body) {
    // prevent making node a child of itself / descendant
    const newParent = body.parentId || null;
    if (newParent === id) {
      return NextResponse.json({ error: "Invalid move" }, { status: 400 });
    }
    data.parentId = newParent;
  }
  if (node.type === "FILE" && body.content !== undefined) {
    // validate it's a valid sheet
    try {
      const sheet = body.content as SheetContent;
      if (!sheet || !Array.isArray(sheet.columns) || !Array.isArray(sheet.rows)) {
        return NextResponse.json({ error: "Invalid content" }, { status: 400 });
      }
      data.content = JSON.stringify(sheet);
    } catch {
      return NextResponse.json({ error: "Invalid content" }, { status: 400 });
    }
  }
  const updated = await db.node.update({ where: { id }, data });
  return NextResponse.json({
    node: updated,
    content: updated.type === "FILE" ? parseContent(updated.content) : null,
  });
}

// Delete a node recursively (and any media referenced inside)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const node = await db.node.findUnique({ where: { id } });
  if (!node) return NextResponse.json({ ok: true });

  // collect all descendant node ids
  const toDelete: string[] = [];
  async function collect(parentId: string) {
    const kids = await db.node.findMany({
      where: { parentId },
      select: { id: true, type: true, content: true },
    });
    for (const k of kids) {
      toDelete.push(k.id);
      if (k.type === "FOLDER") {
        await collect(k.id);
      } else if (k.content) {
        // gather media ids to delete from storage
        try {
          const sheet = JSON.parse(k.content) as SheetContent;
          await purgeSheetMedia(sheet, node.workspaceId);
        } catch {
          /* ignore */
        }
      }
    }
  }
  await collect(id);
  // delete the node itself's media if file
  if (node.type === "FILE" && node.content) {
    try {
      const sheet = JSON.parse(node.content) as SheetContent;
      await purgeSheetMedia(sheet, node.workspaceId);
    } catch {
      /* ignore */
    }
  }
  toDelete.push(id);
  await db.node.deleteMany({ where: { id: { in: toDelete } } });
  return NextResponse.json({ ok: true });
}

async function purgeSheetMedia(sheet: SheetContent, workspaceId: string) {
  // delete media referenced by cells and record fields
  const mediaIds = new Set<string>();
  for (const key in sheet.cells) {
    const cell = sheet.cells[key];
    if (cell.type === "image" || cell.type === "audio") {
      const d = cell.data as { mediaId: string };
      if (d.mediaId) mediaIds.add(d.mediaId);
    }
  }
  for (const rid in sheet.records) {
    const rec = sheet.records[rid];
    for (const f of rec.fields) {
      if (f.kind === "image" || f.kind === "audio" || f.kind === "file") {
        if (f.value) mediaIds.add(f.value);
      }
    }
  }
  // need ext info from media table
  if (mediaIds.size > 0) {
    const assets = await db.mediaAsset.findMany({
      where: { id: { in: Array.from(mediaIds) } },
      select: { id: true, ext: true },
    });
    for (const a of assets) {
      await deleteMedia(workspaceId, a.id, a.ext);
    }
    await db.mediaAsset.deleteMany({
      where: { id: { in: assets.map((a) => a.id) } },
    });
  }
}
