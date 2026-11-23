import React, { createContext, useContext, useEffect, useState } from "react";

/** What the person picked. "system" follows the phone/computer setting. */
export type ThemePreference = "light" | "dark" | "system";
type Theme = "light" | "dark";

interface ThemeContextType {
  /** The theme actually showing right now. */
  theme: Theme;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  toggleTheme: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const KEY = "theme";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch { /* storage can be blocked */ }
  return "system";
}
const systemDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
const resolve = (p: ThemePreference): Theme => (p === "system" ? (systemDark() ? "dark" : "light") : p);

export function ThemeProvider({ children }: { children: React.ReactNode; defaultTheme?: Theme; switchable?: boolean }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference);
  const [theme, setTheme] = useState<Theme>(() => resolve(readPreference()));

  // Follow the device while the preference is "system".
  useEffect(() => {
    setTheme(resolve(preference));
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [preference]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#14160f" : "#1d2128");
  }, [theme]);

  const setPreference = (p: ThemePreference) => {
    setPref(p);
    try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
  };

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, toggleTheme: () => setPreference(theme === "dark" ? "light" : "dark"), switchable: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
