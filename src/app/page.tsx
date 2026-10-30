"use client";

import { useEffect } from "react";
import { useApp } from "@/store/app";
import { AppShell } from "@/components/ink/AppShell";

export default function Page() {
  const boot = useApp((s) => s.boot);
  useEffect(() => {
    void boot();
  }, [boot]);
  return <AppShell />;
}
