import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deleteWorkspaceDir } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// List all workspaces
export async function GET() {
  const workspaces = await db.workspace.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { nodes: true } },
    },
  });
  return NextResponse.json({ workspaces });
}

// Create a workspace
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name as string)?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const profileMediaId = body.profileMediaId || null;
  const ws = await db.workspace.create({
    data: { name, profileMediaId: profileMediaId || null },
  });
  return NextResponse.json({ workspace: ws });
}

// Delete a workspace (and all its storage)
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.workspace.delete({ where: { id } });
  await deleteWorkspaceDir(id);
  return NextResponse.json({ ok: true });
}
