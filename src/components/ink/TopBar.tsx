"use client";

import { useApp } from "@/store/app";
import { Home, ChevronRight, Save, Cloud } from "lucide-react";

export function TopBar() {
  const view = useApp((s) => s.view);
  const workspace = useApp((s) => s.workspace);
  const breadcrumb = useApp((s) => s.breadcrumb);
  const file = useApp((s) => s.file);
  const goHome = useApp((s) => s.goHome);
  const navigateFolder = useApp((s) => s.navigateFolder);
  const saving = useApp((s) => s.saving);
  const dirty = useApp((s) => s.dirty);

  return (
    <header className="topbar">
      <button
        className="iconbtn"
        onClick={goHome}
        aria-label="Home"
        title="Home"
      >
        <Home size={15} />
      </button>
      <div className="crumb">
        {view === "home" && (
          <span className="crumb-item" style={{ cursor: "default", color: "var(--ink)", fontWeight: 600 }}>
            Workspaces
          </span>
        )}
        {view !== "home" && workspace && (
          <>
            <span
              className="crumb-item"
              onClick={() => navigateFolder({ id: null, name: workspace.name })}
            >
              {workspace.name}
            </span>
            {breadcrumb.slice(1).map((c, i) => (
              <span key={c.id ?? i} className="row" style={{ gap: 2 }}>
                <ChevronRight size={11} className="crumb-sep" />
                <span
                  className="crumb-item"
                  onClick={() => navigateFolder(c)}
                >
                  {c.name}
                </span>
              </span>
            ))}
            {view === "file" && file && (
              <span className="row" style={{ gap: 2 }}>
                <ChevronRight size={11} className="crumb-sep" />
                <span
                  className="crumb-item"
                  style={{ color: "var(--ink)", fontWeight: 600, cursor: "default" }}
                >
                  {file.name}
                </span>
              </span>
            )}
          </>
        )}
      </div>
      <div className="spacer" />
      <div className="topbar-actions">
        {view === "file" && (
          <span className="row" style={{ gap: 5, color: "var(--ink-4)" }}>
            {saving ? (
              <>
                <Save size={12} className="spin" />
                <span className="tiny">Saving…</span>
              </>
            ) : dirty ? (
              <>
                <Cloud size={12} />
                <span className="tiny">Unsaved</span>
              </>
            ) : (
              <>
                <Cloud size={12} />
                <span className="tiny">Saved</span>
              </>
            )}
          </span>
        )}
      </div>
    </header>
  );
}
