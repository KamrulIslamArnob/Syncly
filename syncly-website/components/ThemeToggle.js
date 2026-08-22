"use client";

import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, aura, pattern, setAura, setPattern, toggleTheme, AuraPresets } = useTheme();

  return (
    <div className="theme-controls">
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        <span className="theme-toggle-thumb">
          {theme === "dark" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          )}
        </span>
      </button>

      <div className="aura-picker" role="group" aria-label="Aura theme">
        {Object.entries(AuraPresets).map(([key, preset]) => {
          const bg = key === "aurora" ? "#d71921" : key === "tidal" ? "#0ea5e9" : key === "ember" ? "#f97316" : key === "void" ? "#8b5cf6" : "#22c55e";
          return (
            <button
              key={key}
              className={`aura-dot ${aura === key ? "active" : ""}`}
              style={{ background: bg }}
              onClick={() => setAura(key)}
              aria-label={`${preset.name} — ${preset.desc}`}
              title={`${preset.name} — ${preset.desc}`}
            />
          );
        })}
      </div>

      <div className="aura-picker" role="group" aria-label="Thinking pattern" style={{ marginLeft: 4, paddingLeft: 10, borderLeft: "1px solid var(--border)" }}>
        {[
          { id: "dots", label: "Dots", icon: "⠿" },
          { id: "grid", label: "Grid", icon: "⊞" },
          { id: "waves", label: "Waves", icon: "≋" },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPattern(p.id)}
            aria-label={`Pattern: ${p.label}`}
            title={p.label}
            style={{
              width: 22, height: 22, borderRadius: 6,
              border: pattern === p.id ? "1px solid var(--fg)" : "1px solid var(--border)",
              background: pattern === p.id ? "var(--surface-2)" : "transparent",
              color: pattern === p.id ? "var(--fg)" : "var(--fg-3)",
              display: "grid", placeItems: "center",
              fontSize: 11, cursor: "pointer",
              transition: "all 200ms ease",
            }}
          >
            {p.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
