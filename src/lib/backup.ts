import { db } from "@/lib/db";
import { ensureWorkspaceDir, copyMediaFromPath } from "@/lib/storage";
import { SheetContent, RecordData, Cell } from "@/lib/types";
import path from "path";

export interface WorkspaceBackup {
  workspace: {
    id: string;
    name: string;
    profileMediaId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  nodes: {
    id: string;
    parentId: string | null;
    name: string;
    type: string;
    content: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  media: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    ext: string;
    createdAt: string;
    // path within zip media folder
    file: string;
  }[];
}

export async function buildWorkspaceBackup(
  workspaceId: string
): Promise<{ backup: WorkspaceBackup; mediaFiles: Map<string, string> }> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) throw new Error("Workspace not found");
  const nodes = await db.node.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
  const media = await db.mediaAsset.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
  });
  const mediaFiles = new Map<string, string>();
  const backupMedia = media.map((m) => {
    const file = `media/${m.id}.${m.ext}`;
    const p = path.join(
      process.cwd(),
      "storage",
      workspaceId,
      `${m.id}.${m.ext}`
    );
    mediaFiles.set(file, p);
    return {
      id: m.id,
      filename: m.filename,
      mimeType: m.mimeType,
      size: m.size,
      ext: m.ext,
      createdAt: m.createdAt.toISOString(),
      file,
    };
  });
  const backup: WorkspaceBackup = {
    workspace: {
      id: ws.id,
      name: ws.name,
      profileMediaId: ws.profileMediaId,
      createdAt: ws.createdAt.toISOString(),
      updatedAt: ws.updatedAt.toISOString(),
    },
    nodes: nodes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      name: n.name,
      type: n.type,
      content: n.content,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
    media: backupMedia,
  };
  return { backup, mediaFiles };
}

// Remap media IDs inside a sheet content JSON string
export function remapSheetMediaIds(
  content: string | null,
  mediaMap: Map<string, string>
): string | null {
  if (!content) return content;
  try {
    const sheet = JSON.parse(content) as SheetContent;
    // cells
    for (const key in sheet.cells) {
      const cell = sheet.cells[key] as Cell;
      if (
        (cell.type === "image" || cell.type === "audio") &&
        (cell.data as { mediaId: string }).mediaId
      ) {
        const d = cell.data as { mediaId: string };
        d.mediaId = mediaMap.get(d.mediaId) || d.mediaId;
      }
    }
    // records
    for (const rid in sheet.records) {
      remapRecordMediaIds(sheet.records[rid], mediaMap);
    }
    return JSON.stringify(sheet);
  } catch {
    return content;
  }
}

function remapRecordMediaIds(rec: RecordData, mediaMap: Map<string, string>) {
  for (const f of rec.fields) {
    if (
      (f.kind === "image" || f.kind === "audio" || f.kind === "file") &&
      f.value
    ) {
      f.value = mediaMap.get(f.value) || f.value;
    }
  }
  if (rec.children) {
    for (const c of rec.children) remapRecordMediaIds(c, mediaMap);
  }
}

// Import a workspace backup, regenerating IDs to avoid conflicts.
// mediaPaths maps backup media `file` (e.g. "media/xxx.mp3") -> temp abs path on disk.
// Returns the new workspace id.
export async function importWorkspaceBackup(
  backup: WorkspaceBackup,
  mediaPaths: Map<string, string>
): Promise<string> {
  // Create new workspace
  const newWs = await db.workspace.create({
    data: {
      name: backup.workspace.name,
      profileMediaId: null, // set after media map
    },
  });
  const wsId = newWs.id;
  await ensureWorkspaceDir(wsId);

  // Media id map: old -> new
  const mediaMap = new Map<string, string>();
  for (const m of backup.media) {
    const srcPath = mediaPaths.get(m.file);
    if (!srcPath) continue;
    const newId = `m_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    await copyMediaFromPath(wsId, newId, m.ext, srcPath);
    await db.mediaAsset.create({
      data: {
        id: newId,
        workspaceId: wsId,
        filename: m.filename,
        mimeType: m.mimeType,
        size: m.size,
        ext: m.ext,
      },
    });
    mediaMap.set(m.id, newId);
  }

  // Profile media
  let newProfileMediaId: string | null = null;
  if (backup.workspace.profileMediaId) {
    newProfileMediaId =
      mediaMap.get(backup.workspace.profileMediaId) || null;
  }

  // Node id map: old -> new
  const nodeMap = new Map<string, string>();
  // First pass: create all nodes (order matters for parentId; do topological by parentId null first, then iterate)
  // Since nodes may be out of order, do multiple passes.
  const remaining = [...backup.nodes];
  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const n = remaining[i];
      if (n.parentId === null || nodeMap.has(n.parentId)) {
        const newId = `n_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 10)}_${i}`;
        const remappedContent = remapSheetMediaIds(n.content, mediaMap);
        const created = await db.node.create({
          data: {
            id: newId,
            workspaceId: wsId,
            parentId: n.parentId ? nodeMap.get(n.parentId)! : null,
            name: n.name,
            type: n.type,
            content: remappedContent,
          },
        });
        nodeMap.set(n.id, created.id);
        remaining.splice(i, 1);
        progress = true;
      }
    }
  }
  // any leftover (cyclic?) just attach to root
  for (const n of remaining) {
    const newId = `n_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const remappedContent = remapSheetMediaIds(n.content, mediaMap);
    await db.node.create({
      data: {
        id: newId,
        workspaceId: wsId,
        parentId: null,
        name: n.name,
        type: n.type,
        content: remappedContent,
      },
    });
    nodeMap.set(n.id, newId);
  }

  // set profile media
  await db.workspace.update({
    where: { id: wsId },
    data: { profileMediaId: newProfileMediaId },
  });

  return wsId;
}

// ---- Streaming ZIP import ----
import { Readable } from "stream";
import { createWriteStream, existsSync, mkdirSync, createReadStream, rmSync, statSync } from "fs";
import { ensureTmpDir } from "@/lib/storage";

interface ExtractedEntry {
  path: string; // normalized zip path (forward slashes, no leading slash)
  absPath: string | null; // null for small json (in-memory)
  text: string | null; // for json entries
}

export async function extractZip(body: ReadableStream<Uint8Array>): Promise<{
  entries: Map<string, ExtractedEntry>;
  tmpRoot: string;
}> {
  const tmpRoot = await ensureTmpDir();
  const entries = new Map<string, ExtractedEntry>();
  const nodeStream = Readable.fromWeb(body as any);
  const unzipperMod: any = await import("unzipper");
  const unzipper = unzipperMod.default ?? unzipperMod;
  const parser = unzipper.Parse();

  const pending: Promise<void>[] = [];

  await new Promise<void>((resolve, reject) => {
    nodeStream.pipe(parser);
    parser.on("error", reject);
    parser.on("close", () => {
      Promise.all(pending)
        .then(() => resolve())
        .catch(reject);
    });
    parser.on("entry", (entry: any) => {
      const rawPath: string = entry.path;
      const type: string = entry.type;
      const norm = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
      if (type === "Directory") {
        entry.autodrain();
        return;
      }
      const isJson = norm.endsWith(".json");
      if (isJson) {
        const chunks: Buffer[] = [];
        entry.on("data", (c: Buffer) => chunks.push(c));
        entry.on("error", reject);
        entry.on("end", () => {
          entries.set(norm, {
            path: norm,
            absPath: null,
            text: Buffer.concat(chunks).toString("utf8"),
          });
        });
      } else {
        const absPath = path.join(tmpRoot, norm);
        mkdirSync(path.dirname(absPath), { recursive: true });
        const ws = createWriteStream(absPath);
        pending.push(
          new Promise<void>((res, rej) => {
            entry.on("error", rej);
            ws.on("error", rej);
            ws.on("finish", () => res());
            entry.pipe(ws);
          })
        );
        entries.set(norm, { path: norm, absPath, text: null });
      }
    });
  });

  return { entries, tmpRoot };
}

// Given extracted entries, import a single workspace zip (has workspace.json at root).
export async function importWorkspaceFromEntries(
  entries: Map<string, ExtractedEntry>
): Promise<string | null> {
  const wsEntry = entries.get("workspace.json");
  if (!wsEntry?.text) return null;
  const backup = JSON.parse(wsEntry.text) as WorkspaceBackup;
  // collect media paths
  const mediaPaths = new Map<string, string>();
  for (const m of backup.media) {
    const e = entries.get(m.file);
    if (e?.absPath && existsSync(e.absPath)) {
      mediaPaths.set(m.file, e.absPath);
    }
  }
  return importWorkspaceBackup(backup, mediaPaths);
}

// Given extracted entries, import a full DB zip (has db.json + workspaces/{id}/workspace.json).
export async function importFullDbFromEntries(
  entries: Map<string, ExtractedEntry>
): Promise<string[]> {
  const dbEntry = entries.get("db.json");
  const imported: string[] = [];
  if (dbEntry?.text) {
    const manifest = JSON.parse(dbEntry.text) as { workspaces: { id: string; name: string }[] };
    for (const w of manifest.workspaces) {
      const wsJson = entries.get(`workspaces/${w.id}/workspace.json`);
      if (!wsJson?.text) continue;
      const backup = JSON.parse(wsJson.text) as WorkspaceBackup;
      // collect media paths for this workspace
      const mediaPaths = new Map<string, string>();
      for (const m of backup.media) {
        const e = entries.get(`workspaces/${w.id}/${m.file}`);
        if (e?.absPath && existsSync(e.absPath)) {
          mediaPaths.set(m.file, e.absPath);
        }
      }
      const newId = await importWorkspaceBackup(backup, mediaPaths);
      imported.push(newId);
    }
  } else {
    // Maybe it's actually a single workspace zip uploaded to the db endpoint; handle gracefully.
    const id = await importWorkspaceFromEntries(entries);
    if (id) imported.push(id);
  }
  return imported;
}

export function cleanupTmp(tmpRoot: string) {
  try {
    if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
    mkdirSync(tmpRoot, { recursive: true });
  } catch {
    /* ignore */
  }
}

export { createReadStream, statSync };
