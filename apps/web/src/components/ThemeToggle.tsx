"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const ORDER: Theme[] = ["system", "light", "dark"];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      setTheme((localStorage.getItem("otto-theme") as Theme) || "system");
    } catch {}
  }, []);

  const apply = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem("otto-theme", t);
    } catch {}
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = t;
  };

  return (
    <button
      type="button"
      onClick={() => apply(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
      className="flex items-center gap-2 text-xs text-muted hover:text-fg"
      aria-label="Theme"
    >
      <span className="inline-block size-3 rounded-full border border-current [background:linear-gradient(90deg,currentColor_50%,transparent_50%)]" />
      {theme}
    </button>
  );
}
