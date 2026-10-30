"use client";

export function BootScreen() {
  return (
    <div className="app-root">
      <main className="app-main center">
        <div className="col" style={{ alignItems: "center", gap: 10 }}>
          <div
            className="spin"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: "2px solid var(--line)",
              borderTopColor: "var(--ink)",
            }}
          />
          <span className="tiny muted">Loading</span>
        </div>
      </main>
    </div>
  );
}
