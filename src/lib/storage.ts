import fs from "fs/promises";
import { createReadStream, createWriteStream, existsSync } from "fs";
import path from "path";

export const STORAGE_DIR = path.join(process.cwd(), "storage");
export const TMP_DIR = path.join(STORAGE_DIR, ".tmp");

export function workspaceDir(workspaceId: string): string {
  return path.join(STORAGE_DIR, workspaceId);
}

export function mediaPath(workspaceId: string, mediaId: string, ext: string): string {
  return path.join(workspaceDir(workspaceId), `${mediaId}.${ext}`);
}

export async function ensureWorkspaceDir(workspaceId: string): Promise<void> {
  const dir = workspaceDir(workspaceId);
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function writeMedia(
  workspaceId: string,
  mediaId: string,
  ext: string,
  data: Buffer | Uint8Array
): Promise<string> {
  await ensureWorkspaceDir(workspaceId);
  const p = mediaPath(workspaceId, mediaId, ext);
  await fs.writeFile(p, data);
  return p;
}

// Copy a media file from a source path on disk to the workspace storage (streaming).
export async function copyMediaFromPath(
  workspaceId: string,
  mediaId: string,
  ext: string,
  srcPath: string
): Promise<string> {
  await ensureWorkspaceDir(workspaceId);
  const dest = mediaPath(workspaceId, mediaId, ext);
  await new Promise<void>((resolve, reject) => {
    const rs = createReadStream(srcPath);
    const ws = createWriteStream(dest);
    rs.on("error", reject);
    ws.on("error", reject);
    ws.on("finish", () => resolve());
    rs.pipe(ws);
  });
  return dest;
}

export async function readMedia(
  workspaceId: string,
  mediaId: string,
  ext: string
): Promise<Buffer> {
  const p = mediaPath(workspaceId, mediaId, ext);
  return fs.readFile(p);
}

export async function mediaExists(
  workspaceId: string,
  mediaId: string,
  ext: string
): Promise<boolean> {
  const p = mediaPath(workspaceId, mediaId, ext);
  return existsSync(p);
}

export async function deleteMedia(
  workspaceId: string,
  mediaId: string,
  ext: string
): Promise<void> {
  const p = mediaPath(workspaceId, mediaId, ext);
  if (existsSync(p)) {
    await fs.unlink(p);
  }
}

export async function deleteWorkspaceDir(workspaceId: string): Promise<void> {
  const dir = workspaceDir(workspaceId);
  if (existsSync(dir)) {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function listWorkspaceMediaFiles(
  workspaceId: string
): Promise<string[]> {
  const dir = workspaceDir(workspaceId);
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir);
  return entries.map((e) => path.join(dir, e));
}

export async function ensureTmpDir(): Promise<string> {
  if (!existsSync(TMP_DIR)) {
    await fs.mkdir(TMP_DIR, { recursive: true });
  }
  return TMP_DIR;
}

export async function cleanupTmpDir(): Promise<void> {
  if (existsSync(TMP_DIR)) {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
    await fs.mkdir(TMP_DIR, { recursive: true });
  }
}
