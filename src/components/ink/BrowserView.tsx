"use client";

import { useApp } from "@/store/app";
import { useState } from "react";
import { Folder, FileText, MoreVertical, Pencil, Trash2, FolderPlus, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { PromptModal, Modal } from "./Modal";
import { NodeDTO } from "@/lib/api";

export function BrowserView() {
  const children = useApp((s) => s.children);
  const loading = useApp((s) => s.loadingChildren);
  const openNode = useApp((s) => s.openNode);
  const createNode = useApp((s) => s.createNode);
  const renameNode = useApp((s) => s.renameNode);
  const deleteNode = useApp((s) => s.deleteNode);

  const [folderOpen, setFolderOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<NodeDTO | null>(null);
  const [renameNodeFor, setRenameNodeFor] = useState<NodeDTO | null>(null);

  async function handleCreateFolder(name: string) {
    try {
      await createNode("FOLDER", name);
      setFolderOpen(false);
    } catch (e) {
      toast.error(String(e));
    }
  }
  async function handleCreateFile(name: string) {
    try {
      await createNode("FILE", name);
      setFileOpen(false);
    } catch (e) {
      toast.error(String(e));
    }
  }
  async function handleRename(name: string) {
    if (!renameNodeFor) return;
    try {
      await renameNode(renameNodeFor.id, name);
      setRenameNodeFor(null);
    } catch (e) {
      toast.error(String(e));
    }
  }
  async function handleDelete(node: NodeDTO) {
    if (
      !confirm(
        node.type === "FOLDER"
          ? `Delete folder "${node.name}" and everything inside?`
          : `Delete file "${node.name}"?`
      )
    )
      return;
    try {
      await deleteNode(node.id);
      toast.success("Deleted");
    } catch (e) {
      toast.error(String(e));
    }
  }

  return (
    <div className="browser">
      <div className="browser-toolbar">
        <button className="btn sm" onClick={() => setFolderOpen(true)}>
          <FolderPlus size={13} /> Create Folder
        </button>
        <button className="btn sm" onClick={() => setFileOpen(true)}>
          <FilePlus size={13} /> Create File
        </button>
        <div className="spacer" style={{ flex: 1 }} />
        <span className="tiny muted nowrap">
          {loading ? "…" : `${children.length} items`}
        </span>
      </div>

      <div className="file-list">
        {children.length === 0 && !loading && (
          <div className="empty-state">
            <Folder size={26} style={{ opacity: 0.4 }} />
            <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Empty</div>
            <div className="tiny">Create a folder or file to begin</div>
          </div>
        )}
        {children.map((node) => (
          <div
            key={node.id}
            className="file-row"
            onClick={() => openNode(node)}
          >
            {node.type === "FOLDER" ? (
              <Folder size={16} className="fr-icon" />
            ) : (
              <FileText size={16} className="fr-icon" />
            )}
            <span className="fr-name">{node.name}</span>
            <span className="fr-meta">
              {node.type === "FOLDER" ? "folder" : "sheet"}
            </span>
            <div
              className="fr-actions"
              onClick={(e) => {
                e.stopPropagation();
                setMenuFor(node);
              }}
            >
              <button className="iconbtn" style={{ width: 22, height: 22 }} aria-label="More">
                <MoreVertical size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <PromptModal
        open={folderOpen}
        onClose={() => setFolderOpen(false)}
        onSubmit={handleCreateFolder}
        title="New folder"
        placeholder="Folder name"
        submitLabel="Create"
        cancelLabel="Cancel"
      />
      <PromptModal
        open={fileOpen}
        onClose={() => setFileOpen(false)}
        onSubmit={handleCreateFile}
        title="New file"
        placeholder="e.g. Tracklist, Roster"
        submitLabel="Create"
        cancelLabel="Cancel"
      />
      <PromptModal
        open={!!renameNodeFor}
        onClose={() => setRenameNodeFor(null)}
        onSubmit={handleRename}
        title="Rename"
        initialValue={renameNodeFor?.name.replace(/\.nt$/i, "")}
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
              setRenameNodeFor(menuFor);
              setMenuFor(null);
            }}
          >
            <Pencil size={13} /> Rename
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
    </div>
  );
}
