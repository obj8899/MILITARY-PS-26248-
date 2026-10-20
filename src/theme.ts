// One theme for the whole app (2D screens + 3D battleground). Stored as a per-viewer convenience only.
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "sudarshan-theme";

export function readTheme(): Theme {
  try { const v = localStorage.getItem(KEY); if (v === "light" || v === "dark") return v; } catch { /* storage unavailable */ }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("sudarshan-theme", { detail: t }));
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setT] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || readTheme());
  useEffect(() => {
    const on = (e: Event) => setT((e as CustomEvent<Theme>).detail);
    window.addEventListener("sudarshan-theme", on);
    if (!document.documentElement.dataset.theme) applyTheme(theme);
    return () => window.removeEventListener("sudarshan-theme", on);
  }, [theme]);
  return [theme, applyTheme];
}
