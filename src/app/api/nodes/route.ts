import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emptySheet, FILE_EXTENSION } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Create a folder or file
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { workspaceId, parentId, type, name } = body as {
    workspaceId?: string;
    parentId?: string | null;
    type?: string;
    name?: string;
  };
  if (!workspaceId || !type || !name?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const t = type === "FILE" ? "FILE" : "FOLDER";
  let finalName = name.trim();
  let content: string | null = null;
  if (t === "FILE") {
    if (!finalName.endsWith(FILE_EXTENSION)) {
      finalName = finalName + FILE_EXTENSION;
    }
    content = JSON.stringify(emptySheet());
  }
  const node = await db.node.create({
    data: {
      workspaceId,
      parentId: parentId || null,
      name: finalName,
      type: t,
      content,
    },
  });
  return NextResponse.json({ node });
}
