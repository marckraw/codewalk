"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark" | "system";

const modes: Array<{ icon: ReactNode; label: ThemeMode }> = [
  { icon: <Sun aria-hidden="true" className="size-3.5" />, label: "light" },
  { icon: <Moon aria-hidden="true" className="size-3.5" />, label: "dark" },
  { icon: <Monitor aria-hidden="true" className="size-3.5" />, label: "system" },
];

const modeLabels = modes.map((mode) => mode.label);

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
    const nextMode = saved && modeLabels.includes(saved) ? saved : "system";

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
          aria-label={`${themeMode.label} theme`}
          aria-pressed={mode === themeMode.label}
          className="flex h-8 items-center justify-center gap-1.5 border-r border-[var(--border)] px-2 capitalize text-[var(--muted)] last:border-r-0 hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)] aria-pressed:bg-[var(--foreground)] aria-pressed:text-[var(--background)]"
          key={themeMode.label}
          onClick={() => selectMode(themeMode.label)}
          type="button"
        >
          {themeMode.icon}
          <span className="hidden sm:inline">{themeMode.label}</span>
        </button>
      ))}
    </div>
  );
}
