"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

const modes: ThemeMode[] = ["light", "dark", "system"];

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;

  if (mode === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.dataset.theme = mode;
  }

  root.dataset.themeMode = mode;
}

export function ThemeModeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const saved = window.localStorage.getItem("codewalk-theme-mode") as ThemeMode | null;
    const nextMode = saved && modes.includes(saved) ? saved : "system";

    applyTheme(nextMode);
    queueMicrotask(() => setMode(nextMode));
  }, []);

  function selectMode(nextMode: ThemeMode) {
    setMode(nextMode);
    window.localStorage.setItem("codewalk-theme-mode", nextMode);
    applyTheme(nextMode);
  }

  return (
    <div
      aria-label="Theme mode"
      className="grid grid-cols-3 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel-subtle)] text-xs"
      role="group"
    >
      {modes.map((themeMode) => (
        <button
          aria-pressed={mode === themeMode}
          className="h-8 border-r border-[var(--border)] px-2 capitalize text-[var(--muted)] last:border-r-0 hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)] aria-pressed:bg-[var(--foreground)] aria-pressed:text-[var(--background)]"
          key={themeMode}
          onClick={() => selectMode(themeMode)}
          type="button"
        >
          {themeMode}
        </button>
      ))}
    </div>
  );
}
