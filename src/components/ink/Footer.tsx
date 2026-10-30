"use client";

import { useApp } from "@/store/app";
import { Database, Download, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function Footer() {
  const view = useApp((s) => s.view);
  const workspace = useApp((s) => s.workspace);
  const refreshWorkspaces = useApp((s) => s.refreshWorkspaces);
  const children = useApp((s) => s.children);
  const [busy, setBusy] = useState<"" | "exp-ws" | "imp-ws" | "exp-db" | "imp-db">("");

  const count = children.length;

  async function exportWorkspace() {
    if (!workspace) return;
    setBusy("exp-ws");
    try {
      const url = api.workspaceExportUrl(workspace.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${workspace.name.replace(/[^a-z0-9-_]+/gi, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy("");
    }
  }

  async function exportDb() {
    setBusy("exp-db");
    try {
      const url = api.dbExportUrl();
      const a = document.createElement("a");
      a.href = url;
      a.download = `ink-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy("");
    }
  }

  function importPick(target: "ws" | "db") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(target === "ws" ? "imp-ws" : "imp-db");
      try {
        if (target === "ws") {
          const r = await api.importWorkspace(f);
          toast.success("Workspace imported");
          await refreshWorkspaces();
          void r;
        } else {
          const r = await api.importDb(f);
          toast.success(`${r.imported} workspace(s) imported`);
          await refreshWorkspaces();
        }
      } catch (e) {
        toast.error(String(e));
      } finally {
        setBusy("");
      }
    };
    input.click();
  }

  return (
    <footer className="app-foot">
      <Database size={11} />
      <span>
        {view === "home"
          ? `${useApp.getState().workspaces.length} workspaces`
          : view === "workspace"
          ? `${count} items`
          : "Sheet"}
      </span>
      <div className="foot-actions">
        {view !== "home" && workspace && (
          <button
            className="btn xs btn-ghost"
            onClick={exportWorkspace}
            disabled={!!busy}
          >
            <Download size={11} /> {busy === "exp-ws" ? "…" : "Export"}
          </button>
        )}
        {view !== "home" && (
          <button
            className="btn xs btn-ghost"
            onClick={() => importPick("ws")}
            disabled={!!busy}
          >
            <Upload size={11} /> {busy === "imp-ws" ? "…" : "Import"}
          </button>
        )}
        {view === "home" && (
          <>
            <button
              className="btn xs btn-ghost"
              onClick={() => importPick("ws")}
              disabled={!!busy}
            >
              <Upload size={11} /> {busy === "imp-ws" ? "…" : "Import Workspace"}
            </button>
            <button
              className="btn xs btn-ghost"
              onClick={exportDb}
              disabled={!!busy}
            >
              <Download size={11} /> {busy === "exp-db" ? "…" : "Backup All"}
            </button>
            <button
              className="btn xs btn-ghost"
              onClick={() => importPick("db")}
              disabled={!!busy}
            >
              <Upload size={11} /> {busy === "imp-db" ? "…" : "Restore All"}
            </button>
          </>
        )}
      </div>
    </footer>
  );
}
