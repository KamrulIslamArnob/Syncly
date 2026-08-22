"use client";

import { createContext, useContext, useEffect, useState } from "react";

const AuraPresets = {
  purple: {
    name: "Purple",
    desc: "Syncly signature purple",
    dark: ["rgba(124,58,237,0.08)", "rgba(139,92,246,0.06)", "rgba(124,58,237,0.04)"],
    light: ["rgba(124,58,237,0.05)", "rgba(139,92,246,0.04)", "rgba(124,58,237,0.02)"],
  },
};

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}

export { AuraPresets };

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("dark");
  const [aura, setAura] = useState("purple");
  const [pattern, setPattern] = useState("dots");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("syncly-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(savedTheme || (prefersDark ? "dark" : "dark"));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-aura", aura);
    document.documentElement.setAttribute("data-pattern", pattern);
    localStorage.setItem("syncly-theme", theme);
  }, [theme, aura, pattern, mounted]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, aura, pattern, setTheme, setAura, setPattern, toggleTheme, mounted, AuraPresets }}>
      {children}
    </ThemeContext.Provider>
  );
}
