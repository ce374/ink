"use client";

import { useApp } from "@/store/app";
import { WorkspaceDTO } from "@/lib/api";
import { api } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";
import { FilePlus, MoreVertical, Trash2, Pencil, Upload, Sparkles } from "lucide-react";
import { PromptModal, Modal } from "./Modal";

export function HomeView() {
  const workspaces = useApp((s) => s.workspaces);
  const loading = useApp((s) => s.loadingWorkspaces);
  const openWorkspace = useApp((s) => s.openWorkspace);
  const refreshWorkspaces = useApp((s) => s.refreshWorkspaces);

  const [createOpen, setCreateOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<WorkspaceDTO | null>(null);
  const [renameWs, setRenameWs] = useState<WorkspaceDTO | null>(null);
  const [profileFor, setProfileFor] = useState<WorkspaceDTO | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  async function handleSeed() {
    if (seeding) return;
    setSeeding(true);
    const t = toast.loading("Seeding example artist (iTunes + LRCLIB)…");
    try {
      const r = await api.seedExample("Daft Punk");
      toast.success(`${r.artistName}: ${r.albums} albums, ${r.songs} songs`, {
        id: t,
      });
      await refreshWorkspaces();
      const ws = (await api.listWorkspaces()).find((w) => w.id === r.workspaceId);
      if (ws) openWorkspace(ws);
    } catch (e) {
      toast.error(String(e), { id: t });
    } finally {
      setSeeding(false);
    }
  }

  async function handleCreate(name: string) {
    try {
      const ws = await api.createWorkspace(name);
      setCreateOpen(false);
      await refreshWorkspaces();
      openWorkspace(ws);
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function handleRename(name: string) {
    if (!renameWs) return;
    try {
      await api.updateWorkspace(renameWs.id, { name });
      setRenameWs(null);
      await refreshWorkspaces();
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function handleDelete(ws: WorkspaceDTO) {
    if (
      !confirm(
        `Delete workspace "${ws.name}"? This removes all folders, files, and media.`
      )
    )
      return;
    try {
      await api.deleteWorkspace(ws.id);
      await refreshWorkspaces();
      toast.success("Workspace deleted");
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function handleProfilePick(file: File) {
    if (!profileFor) return;
    try {
      const asset = await api.uploadMedia(profileFor.id, file);
      await api.updateWorkspace(profileFor.id, { profileMediaId: asset.id });
      await refreshWorkspaces();
      setProfileFor(null);
      toast.success("Profile image set");
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <div className="home">
      <div className="home-head">
        <span className="home-title">Workspaces</span>
        <span className="home-sub">
          {loading ? "loading…" : `${workspaces.length} total`}
        </span>
      </div>
      <div className="ws-grid">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className="ws-card"
            onClick={() => openWorkspace(ws)}
          >
            <div className="ws-avatar">
              {ws.profileMediaId ? (
                <img
                  src={api.mediaUrl(ws.profileMediaId)}
                  alt=""
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                ws.name.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="ws-name">{ws.name}</div>
            <div className="ws-meta">
              {ws._count?.nodes ?? 0} item{ws._count?.nodes === 1 ? "" : "s"}
            </div>
            <div
              className="ws-actions"
              onClick={(e) => {
                e.stopPropagation();
                setMenuFor(ws);
              }}
            >
              <button className="iconbtn" style={{ width: 22, height: 22 }} aria-label="More">
                <MoreVertical size={14} />
              </button>
            </div>
          </div>
        ))}
        <button className="ws-new" onClick={() => setCreateOpen(true)}>
          <FilePlus size={16} />
          <span>New workspace</span>
        </button>
      </div>

      <div className="home-actions">
        <button
          className="btn sm"
          onClick={handleSeed}
          disabled={seeding}
        >
          <Sparkles size={13} />
          {seeding ? "Seeding…" : "Load example artist"}
        </button>
        <button className="btn sm btn-ghost" onClick={() => setCreditsOpen(true)}>
          Credits
        </button>
      </div>

      <PromptModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        title="New workspace"
        placeholder="e.g. Studio, Projects, Archive"
        submitLabel="Create"
        cancelLabel="Cancel"
      />

      <PromptModal
        open={!!renameWs}
        onClose={() => setRenameWs(null)}
        onSubmit={handleRename}
        title="Rename workspace"
        initialValue={renameWs?.name}
        submitLabel="Save"
        cancelLabel="Cancel"
      />

      <Modal
        open={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
      >
        <div className="col" style={{ gap: 4 }}>
          <button
            className="btn btn-ghost"
            style={{ justifyContent: "flex-start" }}
            onClick={() => {
              setRenameWs(menuFor);
              setMenuFor(null);
            }}
          >
            <Pencil size={13} /> Rename
          </button>
          <button
            className="btn btn-ghost"
            style={{ justifyContent: "flex-start" }}
            onClick={() => {
              setProfileFor(menuFor);
              setMenuFor(null);
            }}
          >
            <Upload size={13} /> Set profile image
          </button>
          <button
            className="btn btn-danger"
            style={{ justifyContent: "flex-start" }}
            onClick={() => {
              if (menuFor) handleDelete(menuFor);
              setMenuFor(null);
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </Modal>

      <Modal
        open={!!profileFor}
        onClose={() => setProfileFor(null)}
        title="Profile image"
        footer={
          <button className="btn btn-ghost" onClick={() => setProfileFor(null)}>
            Close
          </button>
        }
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && profileFor) handleProfilePick(f);
          }}
        />
      </Modal>

      <Modal
        open={creditsOpen}
        onClose={() => setCreditsOpen(false)}
        title="Credits"
        footer={
          <button className="btn btn-ghost" onClick={() => setCreditsOpen(false)}>
            Close
          </button>
        }
      >
        <div className="col" style={{ gap: 12 }}>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Example data</div>
            <p className="tiny" style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>
              The "Load example artist" workspace is seeded from the public
              iTunes Search API (album & track metadata, cover artwork) and
              lyrics are fetched from <strong>LRCLIB</strong> (lrclib.net).
            </p>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Artwork</div>
            <p className="tiny" style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>
              Cover images are © their respective rights holders, provided via
              Apple's iTunes Search API for demonstration purposes only.
            </p>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 4 }}>Lyrics</div>
            <p className="tiny" style={{ color: "var(--ink-2)", lineHeight: 1.5 }}>
              Lyrics via <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)" }}>LRCLIB</a> — an open, community-maintained lyrics database.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
