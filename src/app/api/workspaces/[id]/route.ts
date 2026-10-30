import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteWorkspaceDir } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Get workspace detail (with root nodes)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ws = await db.workspace.findUnique({ where: { id } });
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rootNodes = await db.node.findMany({
    where: { workspaceId: id, parentId: null },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ workspace: ws, rootNodes });
}

// Update workspace (rename, profile image)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { name?: string; profileMediaId?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if ("profileMediaId" in body) data.profileMediaId = body.profileMediaId || null;
  const ws = await db.workspace.update({ where: { id }, data });
  return NextResponse.json({ workspace: ws });
}

// Delete workspace
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.workspace.delete({ where: { id } });
  await deleteWorkspaceDir(id);
  return NextResponse.json({ ok: true });
}
