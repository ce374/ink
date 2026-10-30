"use client";

import { useApp } from "@/store/app";
import { HomeView } from "./HomeView";
import { BrowserView } from "./BrowserView";
import { SheetView } from "./SheetView";
import { RecordPanel } from "./RecordPanel";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";
import { BootScreen } from "./BootScreen";

export function AppShell() {
  const view = useApp((s) => s.view);
  const booting = useApp((s) => s.booting);
  const recordOpen = useApp((s) => s.recordOpen);

  if (booting) return <BootScreen />;

  return (
    <div className="app-root">
      <TopBar />
      <main className="app-main">
        {view === "home" && <HomeView />}
        {view === "workspace" && <BrowserView />}
        {view === "file" && <SheetView />}
      </main>
      <Footer />
      {recordOpen && <RecordPanel />}
    </div>
  );
}
