export type ThemeMode = "dark" | "light" | "system";

const STORAGE_KEY = "rextflex-theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : "system";
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (mode !== "system") {
    root.classList.add(mode);
  }
  window.localStorage.setItem(STORAGE_KEY, mode);
}

/**
 * Inlined into <head> in app/layout.tsx so the right theme class is set
 * before first paint (no flash of the wrong theme).
 */
export const themeInitScript = `
(function () {
  try {
    var mode = window.localStorage.getItem("${STORAGE_KEY}");
    if (mode === "dark" || mode === "light") {
      document.documentElement.classList.add(mode);
    }
  } catch (e) {}
})();
`;
