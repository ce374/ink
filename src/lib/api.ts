import type {
  SheetContent,
} from "@/lib/types";

export interface WorkspaceDTO {
  id: string;
  name: string;
  profileMediaId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { nodes: number };
}

export interface NodeDTO {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  type: "FOLDER" | "FILE";
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAssetDTO {
  id: string;
  workspaceId: string;
  filename: string;
  mimeType: string;
  size: number;
  ext: string;
  createdAt: string;
}

async function jfetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // workspaces
  listWorkspaces: () =>
    jfetch<{ workspaces: WorkspaceDTO[] }>("/api/workspaces").then(
      (r) => r.workspaces
    ),
  createWorkspace: (name: string, profileMediaId?: string | null) =>
    jfetch<{ workspace: WorkspaceDTO }>("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, profileMediaId: profileMediaId ?? null }),
    }).then((r) => r.workspace),
  updateWorkspace: (
    id: string,
    data: { name?: string; profileMediaId?: string | null }
  ) =>
    jfetch<{ workspace: WorkspaceDTO }>(`/api/workspaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.workspace),
  deleteWorkspace: (id: string) =>
    jfetch(`/api/workspaces?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // nodes
  createNode: (data: {
    workspaceId: string;
    parentId: string | null;
    type: "FOLDER" | "FILE";
    name: string;
  }) =>
    jfetch<{ node: NodeDTO }>("/api/nodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.node),
  getNode: (id: string) =>
    jfetch<{
      node: NodeDTO;
      content: SheetContent | null;
      children: NodeDTO[] | null;
    }>(`/api/nodes/${id}?children=1`),
  updateNode: (
    id: string,
    data: { name?: string; parentId?: string | null; content?: SheetContent }
  ) =>
    jfetch<{
      node: NodeDTO;
      content: SheetContent | null;
    }>(`/api/nodes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteNode: (id: string) =>
    jfetch(`/api/nodes/${id}`, { method: "DELETE" }),

  // media
  uploadMedia: (workspaceId: string, file: File) => {
    const fd = new FormData();
    fd.append("workspaceId", workspaceId);
    fd.append("file", file);
    return jfetch<{ asset: MediaAssetDTO }>("/api/media", {
      method: "POST",
      body: fd,
    }).then((r) => r.asset);
  },
  mediaUrl: (id: string) => `/api/media/${id}`,
  mediaDownloadUrl: (id: string) => `/api/media/${id}?download=1`,
  deleteMedia: (id: string) =>
    jfetch(`/api/media/${id}`, { method: "DELETE" }),

  // link preview
  linkPreview: (url: string) =>
    jfetch<{
      url: string;
      finalUrl?: string;
      title: string;
      description?: string;
      image: string | null;
      error?: string;
    }>(`/api/link-preview?url=${encodeURIComponent(url)}`),

  // export / import
  workspaceExportUrl: (id: string) => `/api/workspaces/${id}/export`,
  dbExportUrl: () => "/api/db/export",
  importWorkspace: async (file: File) => {
    const res = await fetch("/api/workspaces/import", {
      method: "POST",
      body: file,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `Import failed (${res.status})`);
    }
    return res.json() as Promise<{ workspaceId: string }>;
  },
  importDb: async (file: File) => {
    const res = await fetch("/api/db/import", {
      method: "POST",
      body: file,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `Import failed (${res.status})`);
    }
    return res.json() as Promise<{ imported: number; ids: string[] }>;
  },

  // seed example workspace (iTunes + LRCLIB)
  seedExample: async (artist?: string) => {
    const q = artist ? `?artist=${encodeURIComponent(artist)}` : "";
    const res = await fetch(`/api/seed/example${q}`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || `Seed failed (${res.status})`);
    }
    return res.json() as Promise<{
      workspaceId: string;
      artistName: string;
      albums: number;
      songs: number;
    }>;
  },
};
