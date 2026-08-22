"use client";

import React from "react";
import Image from "next/image";

/**
 * WindowFrame Component
 * Reusable macOS window frame mockup with traffic lights, title pill,
 * glass specular reflection, and support for interactive children or Next.js Image.
 */
export default function WindowFrame({
  title = "syncly.app — Agency",
  url = "syncly.app — Agency",
  src,
  alt = "Syncly Interface Preview",
  width = 1200,
  height = 675,
  priority = false,
  aspectRatio = "16/9",
  badge,
  badgeStatus = "online",
  className = "",
  style = {},
  children,
}) {
  const displayTitle = url || title;

  return (
    <div className={`window-frame browser ${className}`} style={style}>
      {/* Window Titlebar */}
      <div className="window-header browser-bar">
        <div className="window-dots dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>

        <div className="window-title browser-url">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: badgeStatus === "online" ? "#22c55e" : "var(--accent)",
              display: "inline-block",
              boxShadow: badgeStatus === "online" ? "0 0 8px rgba(34, 197, 94, 0.6)" : "0 0 8px var(--accent-glow)",
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayTitle}
          </span>
        </div>

        {badge && (
          <div
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--fg-3)",
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            {badge}
          </div>
        )}
      </div>

      {/* Window Body */}
      <div className="window-body browser-body-wrap" style={{ position: "relative", overflow: "hidden" }}>
        {src ? (
          <div className="relative w-full aspect-video overflow-hidden rounded-b-xl" style={{ aspectRatio, background: "var(--surface)" }}>
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px"
              quality={90}
              priority={priority}
              className="mockup-img object-cover object-top transition-transform duration-500 hover:scale-[1.01]"
            />
            {/* Glass specular reflection overlay */}
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.05] via-transparent to-black/30"
              aria-hidden="true"
            />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
