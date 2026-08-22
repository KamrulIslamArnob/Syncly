"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";

export default function ParticleField() {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    let raf;
    let particles = [];
    const COUNT = 70;
    const mouse = { x: -1000, y: -1000 };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.2 + 0.3,
      }));
    };

    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMove);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      const dotColor = isLight ? "0,0,0" : "255,255,255";
      const lineColor = isLight ? "0,0,0" : "255,255,255";

      // update + draw dots
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140) {
          p.x += (dx / dist) * 0.4;
          p.y += (dy / dist) * 0.4;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${dotColor}, ${isLight ? 0.18 : 0.12})`;
        ctx.fill();
      }

      // lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            const o = (1 - d / 130) * (isLight ? 0.07 : 0.05);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${lineColor}, ${o})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
        // mouse connections
        const d = Math.hypot(particles[i].x - mouse.x, particles[i].y - mouse.y);
        if (d < 160) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(${lineColor}, ${(1 - d / 160) * 0.08})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: -1,
        opacity: 0.9,
      }}
      aria-hidden="true"
    />
  );
}
