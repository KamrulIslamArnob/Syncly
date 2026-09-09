/**
 * Syncly — 50 monochrome background gradients (design board source of truth)
 * ---------------------------------------------------------------------------
 * Each entry maps 1:1 onto the app's existing aura contract:
 *   base          -> html[data-color-mode=x] background-color
 *   layers[0..2]  -> .focus-aura-1 / .focus-aura-2 / .focus-aura-3
 *   grain         -> .focus-aura-grain opacity (feTurbulence overlay)
 *
 * Layer fields mirror the manifest shape used in
 * src/presentation/shared/theme/manifests/*.js — `bg` is `background`,
 * `blend` is `mixBlendMode`, `size` is `backgroundSize`.
 *
 * All 50 are strictly monochrome: near-black bases lifted by white at
 * varying alpha. No hue anywhere.
 */

const SCREEN = "screen";
const MULT = "multiply";

/** @type {Array<object>} */
export const GRADIENTS = [
  // ─────────────────────────────── VAPOR ───────────────────────────────
  {
    n: 1, id: "vapor-rise", name: "Vapor Rise", fam: "Vapor",
    note: "Bottom bloom, deep top falloff",
    grain: 0.34,
    dark: {
      base: "#0B0B0D",
      layers: [
        { bg: "radial-gradient(60% 55% at 50% 108%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "radial-gradient(40% 30% at 50% 100%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(30px)" },
        { bg: "radial-gradient(120% 90% at 50% 0%, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 60%)", blend: MULT },
      ],
    },
    light: {
      base: "#F5F5F2",
      layers: [
        { bg: "radial-gradient(60% 55% at 50% 108%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(50px)" },
        { bg: "radial-gradient(120% 85% at 50% 0%, rgba(28,28,32,0.20) 0%, rgba(28,28,32,0) 62%)", blend: MULT, filter: "blur(30px)" },
      ],
    },
  },
  {
    n: 2, id: "vapor-twin", name: "Vapor Twin", fam: "Vapor",
    note: "Opposing corner blooms, centre vignette",
    grain: 0.32,
    dark: {
      base: "#0C0D10",
      layers: [
        { bg: "radial-gradient(45% 45% at 18% 12%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(50% 50% at 84% 88%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(80px)" },
        { bg: "radial-gradient(90% 90% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F4F4F1",
      layers: [
        { bg: "radial-gradient(45% 45% at 18% 12%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "radial-gradient(55% 55% at 84% 88%, rgba(30,30,34,0.16) 0%, rgba(30,30,34,0) 100%)", blend: MULT, filter: "blur(60px)" },
      ],
    },
  },
  {
    n: 3, id: "vapor-band", name: "Vapor Band", fam: "Vapor",
    note: "Horizontal light band through the midline",
    grain: 0.3,
    dark: {
      base: "#0A0A0C",
      layers: [
        { bg: "linear-gradient(180deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.30) 50%, rgba(255,255,255,0) 80%)", blend: SCREEN, filter: "blur(90px)" },
        { bg: "radial-gradient(80% 40% at 50% 50%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(40px)" },
      ],
    },
    light: {
      base: "#F6F6F3",
      layers: [
        { bg: "linear-gradient(180deg, rgba(255,255,255,0) 18%, rgba(255,255,255,1) 50%, rgba(255,255,255,0) 82%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "linear-gradient(180deg, rgba(26,26,30,0.18) 0%, rgba(26,26,30,0) 34%, rgba(26,26,30,0) 66%, rgba(26,26,30,0.18) 100%)", blend: MULT, filter: "blur(40px)" },
      ],
    },
  },
  {
    n: 4, id: "vapor-corner", name: "Vapor Corner", fam: "Vapor",
    note: "Tight top-right source, diagonal shadow",
    grain: 0.33,
    dark: {
      base: "#0E0F12",
      layers: [
        { bg: "radial-gradient(70% 70% at 100% 0%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 70%)", blend: SCREEN, filter: "blur(50px)" },
        { bg: "radial-gradient(30% 30% at 96% 6%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(24px)" },
        { bg: "linear-gradient(200deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F3F3F0",
      layers: [
        { bg: "radial-gradient(70% 70% at 100% 0%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 72%)", blend: SCREEN, filter: "blur(45px)" },
        { bg: "linear-gradient(200deg, rgba(24,24,28,0) 32%, rgba(24,24,28,0.22) 100%)", blend: MULT, filter: "blur(40px)" },
      ],
    },
  },
  {
    n: 5, id: "vapor-field", name: "Vapor Field", fam: "Vapor",
    note: "Two wide diffuse fields, very low contrast",
    grain: 0.31,
    dark: {
      base: "#101114",
      layers: [
        { bg: "radial-gradient(100% 80% at 30% 30%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(100px)" },
        { bg: "radial-gradient(80% 70% at 75% 70%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(110px)" },
        { bg: "radial-gradient(120% 100% at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F4F4F2",
      layers: [
        { bg: "radial-gradient(100% 80% at 30% 30%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(90px)" },
        { bg: "radial-gradient(90% 80% at 75% 72%, rgba(28,28,32,0.14) 0%, rgba(28,28,32,0) 100%)", blend: MULT, filter: "blur(80px)" },
      ],
    },
  },

  // ─────────────────────────────── BEAMS ───────────────────────────────
  {
    n: 6, id: "beam-drift", name: "Beam Drift", fam: "Beams",
    note: "Monochrome aurora — twin blurred streak sets",
    grain: 0.34,
    dark: {
      base: "#0B0B0D",
      layers: [
        { bg: "repeating-linear-gradient(100deg, #1a1a1c 0%, #1a1a1c 3%, rgba(255,255,255,0.55) 5%, rgba(26,26,28,0.7) 7%, transparent 10%, transparent 12%, rgba(26,26,28,0.7) 14%, #1a1a1c 16%)", blend: SCREEN, filter: "blur(100px)", opacity: 0.75, size: "300% 200%" },
        { bg: "repeating-linear-gradient(100deg, #f5f5f5 0%, #f5f5f5 1.5%, rgba(200,200,200,0.8) 2%, #727272 3%, #727272 4%, rgba(200,200,200,0.8) 4.5%, #f5f5f5 5%)", blend: SCREEN, filter: "blur(90px)", opacity: 0.35, size: "200% 200%" },
        { bg: "radial-gradient(ellipse at 50% 120%, #d8d8d8 15%, #0a0a0a 78%)", blend: MULT },
      ],
    },
    light: {
      base: "#F4F4F1",
      layers: [
        { bg: "repeating-linear-gradient(100deg, #ffffff 0%, #ffffff 3%, rgba(120,120,126,0.5) 5%, rgba(255,255,255,0.8) 7%, transparent 10%, transparent 12%, #ffffff 16%)", blend: MULT, filter: "blur(90px)", opacity: 0.7, size: "300% 200%" },
        { bg: "radial-gradient(ellipse at 50% 120%, rgba(255,255,255,1) 15%, rgba(255,255,255,0) 80%)", blend: SCREEN, filter: "blur(50px)" },
      ],
    },
  },
  {
    n: 7, id: "beam-rake", name: "Beam Rake", fam: "Beams",
    note: "Steeper rake, light pooling bottom-left",
    grain: 0.35,
    dark: {
      base: "#0A0A0B",
      layers: [
        { bg: "repeating-linear-gradient(70deg, #131316 0%, #131316 2%, rgba(255,255,255,0.5) 3.5%, rgba(19,19,22,0.6) 5%, transparent 8%, transparent 11%, #131316 13%)", blend: SCREEN, filter: "blur(80px)", opacity: 0.8, size: "250% 200%" },
        { bg: "radial-gradient(60% 60% at 20% 100%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "radial-gradient(ellipse at 30% 110%, #cfcfcf 12%, #08080a 80%)", blend: MULT },
      ],
    },
    light: {
      base: "#F3F3F0",
      layers: [
        { bg: "repeating-linear-gradient(70deg, #ffffff 0%, #ffffff 2%, rgba(126,126,132,0.45) 3.5%, rgba(255,255,255,0.9) 5%, transparent 8%, transparent 11%, #ffffff 13%)", blend: MULT, filter: "blur(80px)", opacity: 0.72, size: "250% 200%" },
        { bg: "radial-gradient(65% 60% at 20% 100%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)", blend: SCREEN, filter: "blur(55px)" },
      ],
    },
  },
  {
    n: 8, id: "beam-vertical", name: "Beam Vertical", fam: "Beams",
    note: "Vertical light columns, top wash",
    grain: 0.32,
    dark: {
      base: "#0C0C0E",
      layers: [
        { bg: "repeating-linear-gradient(90deg, transparent 0%, transparent 4%, rgba(255,255,255,0.35) 6%, transparent 8%, transparent 14%)", blend: SCREEN, filter: "blur(70px)", opacity: 0.7, size: "200% 100%" },
        { bg: "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%)", blend: SCREEN, filter: "blur(40px)" },
        { bg: "radial-gradient(100% 70% at 50% 0%, #c8c8c8 10%, #0a0a0c 75%)", blend: MULT },
      ],
    },
    light: {
      base: "#F5F5F2",
      layers: [
        { bg: "repeating-linear-gradient(90deg, transparent 0%, transparent 4%, rgba(120,120,126,0.28) 6%, transparent 8%, transparent 14%)", blend: MULT, filter: "blur(60px)", opacity: 0.8, size: "200% 100%" },
        { bg: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 50%)", blend: SCREEN, filter: "blur(40px)" },
      ],
    },
  },
  {
    n: 9, id: "beam-cross", name: "Beam Cross", fam: "Beams",
    note: "Two beam sets crossing at opposing angles",
    grain: 0.33,
    dark: {
      base: "#0B0C0E",
      layers: [
        { bg: "repeating-linear-gradient(115deg, transparent 0%, transparent 5%, rgba(255,255,255,0.30) 7%, transparent 9%, transparent 16%)", blend: SCREEN, filter: "blur(85px)", opacity: 0.7, size: "300% 200%" },
        { bg: "repeating-linear-gradient(65deg, transparent 0%, transparent 6%, rgba(255,255,255,0.22) 8%, transparent 10%, transparent 18%)", blend: SCREEN, filter: "blur(95px)", opacity: 0.6, size: "300% 200%" },
        { bg: "radial-gradient(90% 90% at 50% 60%, #bdbdbd 8%, #09090b 78%)", blend: MULT },
      ],
    },
    light: {
      base: "#F4F4F1",
      layers: [
        { bg: "repeating-linear-gradient(115deg, transparent 0%, transparent 5%, rgba(118,118,124,0.24) 7%, transparent 9%, transparent 16%)", blend: MULT, filter: "blur(75px)", opacity: 0.85, size: "300% 200%" },
        { bg: "repeating-linear-gradient(65deg, transparent 0%, transparent 6%, rgba(118,118,124,0.18) 8%, transparent 10%, transparent 18%)", blend: MULT, filter: "blur(85px)", opacity: 0.7, size: "300% 200%" },
      ],
    },
  },
  {
    n: 10, id: "beam-wash", name: "Beam Wash", fam: "Beams",
    note: "Widest, softest beams — nearly a haze",
    grain: 0.3,
    dark: {
      base: "#0E0E11",
      layers: [
        { bg: "repeating-linear-gradient(105deg, #1c1c20 0%, #1c1c20 6%, rgba(255,255,255,0.4) 9%, rgba(28,28,32,0.5) 12%, transparent 18%, transparent 22%)", blend: SCREEN, filter: "blur(130px)", opacity: 0.85, size: "320% 220%" },
        { bg: "linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 60%)", blend: SCREEN, filter: "blur(50px)" },
      ],
    },
    light: {
      base: "#F5F5F3",
      layers: [
        { bg: "repeating-linear-gradient(105deg, #ffffff 0%, #ffffff 6%, rgba(122,122,128,0.3) 9%, rgba(255,255,255,0.9) 12%, transparent 18%, transparent 22%)", blend: MULT, filter: "blur(110px)", opacity: 0.8, size: "320% 220%" },
        { bg: "linear-gradient(160deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 55%)", blend: SCREEN, filter: "blur(50px)" },
      ],
    },
  },

  // ──────────────────────────────── MESH ───────────────────────────────
  {
    n: 11, id: "mesh-quiet", name: "Mesh Quiet", fam: "Mesh",
    note: "Three balanced nodes, no vignette",
    grain: 0.32,
    dark: {
      base: "#0C0D0F",
      layers: [
        { bg: "radial-gradient(40% 40% at 20% 25%, rgba(255,255,255,0.26) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "radial-gradient(45% 45% at 78% 30%, rgba(255,255,255,0.20) 0%, transparent 100%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(50% 50% at 50% 92%, rgba(255,255,255,0.24) 0%, transparent 100%)", blend: SCREEN, filter: "blur(80px)" },
      ],
    },
    light: {
      base: "#F5F5F2",
      layers: [
        { bg: "radial-gradient(42% 42% at 20% 25%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(55px)" },
        { bg: "radial-gradient(48% 48% at 78% 30%, rgba(30,30,34,0.13) 0%, transparent 100%)", blend: MULT, filter: "blur(65px)" },
      ],
    },
  },
  {
    n: 12, id: "mesh-diagonal", name: "Mesh Diagonal", fam: "Mesh",
    note: "Corner-to-corner nodes with cross shadow",
    grain: 0.33,
    dark: {
      base: "#0A0B0D",
      layers: [
        { bg: "radial-gradient(55% 45% at 8% 92%, rgba(255,255,255,0.32) 0%, transparent 100%)", blend: SCREEN, filter: "blur(75px)" },
        { bg: "radial-gradient(50% 40% at 92% 8%, rgba(255,255,255,0.28) 0%, transparent 100%)", blend: SCREEN, filter: "blur(75px)" },
        { bg: "linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.5) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F4F4F1",
      layers: [
        { bg: "radial-gradient(58% 48% at 8% 92%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(65px)" },
        { bg: "linear-gradient(135deg, rgba(26,26,30,0.16) 0%, rgba(26,26,30,0) 45%, rgba(26,26,30,0.16) 100%)", blend: MULT, filter: "blur(50px)" },
      ],
    },
  },
  {
    n: 13, id: "mesh-cluster", name: "Mesh Cluster", fam: "Mesh",
    note: "Tight central cluster, hard outer falloff",
    grain: 0.34,
    dark: {
      base: "#101115",
      layers: [
        { bg: "radial-gradient(35% 35% at 35% 40%, rgba(255,255,255,0.30) 0%, transparent 100%)", blend: SCREEN, filter: "blur(55px)" },
        { bg: "radial-gradient(30% 30% at 58% 55%, rgba(255,255,255,0.24) 0%, transparent 100%)", blend: SCREEN, filter: "blur(45px)" },
        { bg: "radial-gradient(120% 110% at 50% 50%, transparent 35%, rgba(0,0,0,0.7) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F3F3F0",
      layers: [
        { bg: "radial-gradient(38% 38% at 35% 40%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(50px)" },
        { bg: "radial-gradient(120% 110% at 50% 50%, transparent 32%, rgba(26,26,30,0.2) 100%)", blend: MULT, filter: "blur(40px)" },
      ],
    },
  },
  {
    n: 14, id: "mesh-horizon", name: "Mesh Horizon", fam: "Mesh",
    note: "Low wide node reading as a horizon line",
    grain: 0.33,
    dark: {
      base: "#0B0B0E",
      layers: [
        { bg: "radial-gradient(90% 35% at 50% 78%, rgba(255,255,255,0.34) 0%, transparent 100%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(60% 25% at 25% 84%, rgba(255,255,255,0.22) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%)", blend: MULT },
      ],
    },
    light: {
      base: "#F5F5F2",
      layers: [
        { bg: "radial-gradient(95% 38% at 50% 78%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "linear-gradient(180deg, rgba(26,26,30,0.22) 0%, rgba(26,26,30,0) 52%)", blend: MULT, filter: "blur(45px)" },
      ],
    },
  },
  {
    n: 15, id: "mesh-scatter", name: "Mesh Scatter", fam: "Mesh",
    note: "Three loose nodes, uneven rhythm",
    grain: 0.32,
    dark: {
      base: "#0D0E11",
      layers: [
        { bg: "radial-gradient(28% 28% at 15% 18%, rgba(255,255,255,0.24) 0%, transparent 100%)", blend: SCREEN, filter: "blur(50px)" },
        { bg: "radial-gradient(32% 32% at 85% 40%, rgba(255,255,255,0.20) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "radial-gradient(36% 36% at 45% 88%, rgba(255,255,255,0.26) 0%, transparent 100%)", blend: SCREEN, filter: "blur(65px)" },
      ],
    },
    light: {
      base: "#F4F4F2",
      layers: [
        { bg: "radial-gradient(30% 30% at 15% 18%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(45px)" },
        { bg: "radial-gradient(38% 38% at 45% 88%, rgba(28,28,32,0.15) 0%, transparent 100%)", blend: MULT, filter: "blur(60px)" },
      ],
    },
  },

  // ───────────────────────────── DUOTONE ───────────────────────────────
  {
    n: 16, id: "duotone-split", name: "Duotone Split", fam: "Duotone",
    note: "Hard horizontal split, light mass low",
    flag: "Large light field — check text contrast",
    grain: 0.28,
    dark: {
      base: "#0A0A0A",
      layers: [
        { bg: "linear-gradient(180deg, rgba(236,236,232,0) 68.5%, #ECECE8 70%)", blend: "normal" },
        { bg: "radial-gradient(70% 30% at 50% 70%, rgba(255,255,255,0.35) 0%, transparent 100%)", blend: SCREEN, filter: "blur(40px)" },
        { bg: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 40%)", blend: MULT },
      ],
    },
    light: {
      base: "#EFEFEC",
      layers: [
        { bg: "linear-gradient(180deg, rgba(12,12,14,0) 68.5%, #101012 70%)", blend: "normal" },
        { bg: "radial-gradient(70% 26% at 50% 70%, rgba(255,255,255,0.7) 0%, transparent 100%)", blend: SCREEN, filter: "blur(36px)" },
      ],
    },
  },
  {
    n: 17, id: "duotone-diagonal", name: "Duotone Diagonal", fam: "Duotone",
    note: "Light wedge from the bottom-left corner",
    flag: "Large light field — check text contrast",
    grain: 0.29,
    dark: {
      base: "#0B0B0C",
      layers: [
        { bg: "linear-gradient(298deg, rgba(239,239,236,0) 70%, #EFEFEC 71.5%)", blend: "normal" },
        { bg: "radial-gradient(50% 50% at 12% 88%, rgba(255,255,255,0.3) 0%, transparent 100%)", blend: SCREEN, filter: "blur(55px)" },
        { bg: "linear-gradient(118deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 45%)", blend: MULT },
      ],
    },
    light: {
      base: "#F0F0ED",
      layers: [
        { bg: "linear-gradient(298deg, rgba(14,14,16,0) 70%, #0E0E10 71.5%)", blend: "normal" },
        { bg: "radial-gradient(46% 46% at 12% 88%, rgba(255,255,255,0.6) 0%, transparent 100%)", blend: SCREEN, filter: "blur(50px)" },
      ],
    },
  },
  {
    n: 18, id: "duotone-ramp", name: "Duotone Ramp", fam: "Duotone",
    note: "Continuous black-to-white ramp, light at the floor",
    flag: "Large light field — check text contrast",
    grain: 0.3,
    dark: {
      base: "#0A0A0B",
      layers: [
        { bg: "linear-gradient(180deg, #0A0A0B 0%, #232327 42%, #6E6E74 72%, #DCDCD8 100%)", blend: "normal" },
        { bg: "radial-gradient(80% 30% at 50% 100%, rgba(255,255,255,0.4) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
      ],
    },
    light: {
      base: "#F4F4F1",
      layers: [
        { bg: "linear-gradient(180deg, #FFFFFF 0%, #E8E8E4 45%, #A8A8A4 78%, #4A4A4E 100%)", blend: "normal" },
        { bg: "radial-gradient(80% 30% at 50% 0%, rgba(255,255,255,0.9) 0%, transparent 100%)", blend: SCREEN, filter: "blur(50px)" },
      ],
    },
  },
  {
    n: 19, id: "duotone-side", name: "Duotone Side", fam: "Duotone",
    note: "Light mass on the right edge, clear of the sidebar",
    flag: "Large light field — check text contrast",
    grain: 0.29,
    dark: {
      base: "#0C0C0E",
      layers: [
        { bg: "linear-gradient(90deg, rgba(238,238,234,0) 74.5%, #EEEEEA 76%)", blend: "normal" },
        { bg: "radial-gradient(30% 80% at 88% 50%, rgba(255,255,255,0.30) 0%, transparent 100%)", blend: SCREEN, filter: "blur(50px)" },
        { bg: "linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 40%)", blend: MULT },
      ],
    },
    light: {
      base: "#F1F1EE",
      layers: [
        { bg: "linear-gradient(90deg, rgba(14,14,16,0) 74.5%, #0E0E10 76%)", blend: "normal" },
        { bg: "radial-gradient(28% 80% at 88% 50%, rgba(255,255,255,0.6) 0%, transparent 100%)", blend: SCREEN, filter: "blur(45px)" },
      ],
    },
  },
  {
    n: 20, id: "duotone-horizon", name: "Duotone Horizon", fam: "Duotone",
    note: "Soft-edged split with a bloom on the seam",
    flag: "Large light field — check text contrast",
    grain: 0.31,
    dark: {
      base: "#0A0A0C",
      layers: [
        { bg: "linear-gradient(180deg, rgba(214,214,210,0) 60%, rgba(214,214,210,0.9) 66%, #D6D6D2 100%)", blend: "normal" },
        { bg: "radial-gradient(75% 18% at 50% 63%, rgba(255,255,255,0.5) 0%, transparent 100%)", blend: SCREEN, filter: "blur(40px)" },
        { bg: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 45%)", blend: MULT },
      ],
    },
    light: {
      base: "#F2F2EF",
      layers: [
        { bg: "linear-gradient(180deg, rgba(20,20,24,0) 60%, rgba(20,20,24,0.85) 68%, #16161A 100%)", blend: "normal" },
        { bg: "radial-gradient(75% 16% at 50% 63%, rgba(255,255,255,0.8) 0%, transparent 100%)", blend: SCREEN, filter: "blur(36px)" },
      ],
    },
  },

  // ──────────────────────────── SPOTLIGHT ──────────────────────────────
  {
    n: 21, id: "spot-center", name: "Spot Center", fam: "Spotlight",
    note: "Centred source with a hot core and deep vignette",
    grain: 0.34,
    dark: {
      base: "#08080A",
      layers: [
        { bg: "radial-gradient(50% 50% at 50% 45%, rgba(255,255,255,0.40) 0%, transparent 100%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(20% 20% at 50% 45%, rgba(255,255,255,0.5) 0%, transparent 100%)", blend: SCREEN, filter: "blur(30px)" },
        { bg: "radial-gradient(80% 80% at 50% 45%, transparent 20%, rgba(0,0,0,0.85) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#EFEFEC",
      layers: [
        { bg: "radial-gradient(45% 45% at 50% 45%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "radial-gradient(85% 85% at 50% 45%, transparent 18%, rgba(24,24,28,0.24) 100%)", blend: MULT, filter: "blur(40px)" },
      ],
    },
  },
  {
    n: 22, id: "spot-high", name: "Spot High", fam: "Spotlight",
    note: "Overhead source washing down from the top edge",
    grain: 0.33,
    dark: {
      base: "#090A0C",
      layers: [
        { bg: "radial-gradient(55% 45% at 50% 0%, rgba(255,255,255,0.45) 0%, transparent 100%)", blend: SCREEN, filter: "blur(65px)" },
        { bg: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 40%)", blend: SCREEN },
        { bg: "radial-gradient(100% 90% at 50% 0%, transparent 25%, rgba(0,0,0,0.8) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F0F0ED",
      layers: [
        { bg: "radial-gradient(55% 45% at 50% 0%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(55px)" },
        { bg: "radial-gradient(105% 92% at 50% 0%, transparent 22%, rgba(24,24,28,0.24) 100%)", blend: MULT, filter: "blur(40px)" },
      ],
    },
  },
  {
    n: 23, id: "spot-low", name: "Spot Low", fam: "Spotlight",
    note: "Uplight from below the frame — stage-lit",
    grain: 0.35,
    dark: {
      base: "#0A0A0C",
      layers: [
        { bg: "radial-gradient(60% 50% at 50% 105%, rgba(255,255,255,0.48) 0%, transparent 100%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(28% 22% at 50% 100%, rgba(255,255,255,0.55) 0%, transparent 100%)", blend: SCREEN, filter: "blur(35px)" },
        { bg: "radial-gradient(110% 95% at 50% 100%, transparent 22%, rgba(0,0,0,0.82) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#EFEFEC",
      layers: [
        { bg: "radial-gradient(58% 48% at 50% 105%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "radial-gradient(112% 96% at 50% 100%, transparent 20%, rgba(24,24,28,0.26) 100%)", blend: MULT, filter: "blur(40px)" },
      ],
    },
  },
  {
    n: 24, id: "spot-raking", name: "Spot Raking", fam: "Spotlight",
    note: "Low side light raking across the field",
    grain: 0.34,
    dark: {
      base: "#08090B",
      layers: [
        { bg: "radial-gradient(70% 60% at 6% 82%, rgba(255,255,255,0.42) 0%, transparent 100%)", blend: SCREEN, filter: "blur(80px)" },
        { bg: "linear-gradient(75deg, rgba(255,255,255,0.16) 0%, transparent 45%)", blend: SCREEN, filter: "blur(40px)" },
        { bg: "radial-gradient(120% 110% at 6% 82%, transparent 18%, rgba(0,0,0,0.8) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F0F0ED",
      layers: [
        { bg: "radial-gradient(70% 60% at 6% 82%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(125% 112% at 6% 82%, transparent 16%, rgba(24,24,28,0.25) 100%)", blend: MULT, filter: "blur(45px)" },
      ],
    },
  },
  {
    n: 25, id: "spot-slit", name: "Spot Slit", fam: "Spotlight",
    note: "Narrow shaft of light through a dark field",
    grain: 0.34,
    dark: {
      base: "#08080A",
      layers: [
        { bg: "linear-gradient(102deg, transparent 40%, rgba(255,255,255,0.5) 49%, rgba(255,255,255,0.5) 51%, transparent 60%)", blend: SCREEN, filter: "blur(55px)" },
        { bg: "radial-gradient(45% 60% at 50% 50%, rgba(255,255,255,0.20) 0%, transparent 100%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(90% 90% at 50% 50%, transparent 25%, rgba(0,0,0,0.85) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#EEEEEB",
      layers: [
        { bg: "linear-gradient(102deg, transparent 40%, rgba(255,255,255,1) 49%, rgba(255,255,255,1) 51%, transparent 60%)", blend: SCREEN, filter: "blur(45px)" },
        { bg: "radial-gradient(95% 92% at 50% 50%, transparent 24%, rgba(24,24,28,0.24) 100%)", blend: MULT, filter: "blur(40px)" },
      ],
    },
  },

  // ──────────────────────────────── HALO ───────────────────────────────
  {
    n: 26, id: "halo-sweep", name: "Halo Sweep", fam: "Halo",
    note: "Conic sweep rising from below the frame",
    grain: 0.33,
    dark: {
      base: "#0B0B0E",
      layers: [
        { bg: "conic-gradient(from 210deg at 50% 110%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.45) 60deg, rgba(255,255,255,0) 120deg)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "radial-gradient(50% 30% at 50% 105%, rgba(255,255,255,0.35) 0%, transparent 100%)", blend: SCREEN, filter: "blur(40px)" },
        { bg: "radial-gradient(110% 100% at 50% 110%, transparent 25%, rgba(0,0,0,0.75) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F1F1EE",
      layers: [
        { bg: "conic-gradient(from 210deg at 50% 110%, rgba(255,255,255,0) 0deg, rgba(255,255,255,1) 60deg, rgba(255,255,255,0) 120deg)", blend: SCREEN, filter: "blur(55px)" },
        { bg: "radial-gradient(115% 100% at 50% 110%, transparent 24%, rgba(26,26,30,0.22) 100%)", blend: MULT, filter: "blur(45px)" },
      ],
    },
  },
  {
    n: 27, id: "halo-ring", name: "Halo Ring", fam: "Halo",
    note: "Thin luminous ring with an interior glow",
    grain: 0.33,
    dark: {
      base: "#0A0A0C",
      layers: [
        { bg: "radial-gradient(closest-side circle at 50% 48%, transparent 58%, rgba(255,255,255,0.42) 66%, transparent 74%)", blend: SCREEN, filter: "blur(30px)" },
        { bg: "radial-gradient(closest-side circle at 50% 48%, rgba(255,255,255,0.14) 0%, transparent 60%)", blend: SCREEN, filter: "blur(50px)" },
        { bg: "radial-gradient(100% 100% at 50% 48%, transparent 45%, rgba(0,0,0,0.8) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F0F0ED",
      layers: [
        { bg: "radial-gradient(closest-side circle at 50% 48%, transparent 58%, rgba(255,255,255,1) 66%, transparent 74%)", blend: SCREEN, filter: "blur(26px)" },
        { bg: "radial-gradient(closest-side circle at 50% 48%, transparent 60%, rgba(26,26,30,0.2) 78%, transparent 92%)", blend: MULT, filter: "blur(30px)" },
      ],
    },
  },
  {
    n: 28, id: "halo-quarter", name: "Halo Quarter", fam: "Halo",
    note: "Quarter sweep anchored bottom-right",
    grain: 0.32,
    dark: {
      base: "#0C0C0F",
      layers: [
        { bg: "conic-gradient(from 300deg at 100% 100%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.40) 45deg, rgba(255,255,255,0) 95deg)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(60% 60% at 100% 100%, rgba(255,255,255,0.22) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "linear-gradient(315deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.6) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F2F2EF",
      layers: [
        { bg: "conic-gradient(from 300deg at 100% 100%, rgba(255,255,255,0) 0deg, rgba(255,255,255,1) 45deg, rgba(255,255,255,0) 95deg)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "linear-gradient(315deg, rgba(26,26,30,0) 38%, rgba(26,26,30,0.2) 100%)", blend: MULT, filter: "blur(50px)" },
      ],
    },
  },
  {
    n: 29, id: "halo-double", name: "Halo Double", fam: "Halo",
    note: "Opposed sweeps with a dark centre",
    grain: 0.33,
    dark: {
      base: "#09090C",
      layers: [
        { bg: "conic-gradient(from 150deg at 20% 20%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.32) 50deg, rgba(255,255,255,0) 100deg)", blend: SCREEN, filter: "blur(65px)" },
        { bg: "conic-gradient(from 330deg at 80% 80%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.32) 50deg, rgba(255,255,255,0) 100deg)", blend: SCREEN, filter: "blur(65px)" },
        { bg: "radial-gradient(120% 120% at 50% 50%, transparent 35%, rgba(0,0,0,0.7) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F1F1EE",
      layers: [
        { bg: "conic-gradient(from 150deg at 20% 20%, rgba(255,255,255,0) 0deg, rgba(255,255,255,1) 50deg, rgba(255,255,255,0) 100deg)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "conic-gradient(from 330deg at 80% 80%, rgba(26,26,30,0) 0deg, rgba(26,26,30,0.18) 50deg, rgba(26,26,30,0) 100deg)", blend: MULT, filter: "blur(60px)" },
      ],
    },
  },
  {
    n: 30, id: "halo-iris", name: "Halo Iris", fam: "Halo",
    note: "Full conic rotation, heavily blurred to an iris",
    grain: 0.32,
    dark: {
      base: "#0A0B0D",
      layers: [
        { bg: "conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.05) 0deg, rgba(255,255,255,0.34) 90deg, rgba(255,255,255,0.05) 180deg, rgba(255,255,255,0.30) 270deg, rgba(255,255,255,0.05) 360deg)", blend: SCREEN, filter: "blur(90px)" },
        { bg: "radial-gradient(40% 40% at 50% 50%, rgba(255,255,255,0.18) 0%, transparent 100%)", blend: SCREEN, filter: "blur(40px)" },
        { bg: "radial-gradient(95% 95% at 50% 50%, transparent 30%, rgba(0,0,0,0.78) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F2F2EF",
      layers: [
        { bg: "conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,0.2) 0deg, rgba(255,255,255,1) 90deg, rgba(255,255,255,0.2) 180deg, rgba(255,255,255,1) 270deg, rgba(255,255,255,0.2) 360deg)", blend: SCREEN, filter: "blur(80px)" },
        { bg: "radial-gradient(100% 100% at 50% 50%, transparent 30%, rgba(26,26,30,0.22) 100%)", blend: MULT, filter: "blur(50px)" },
      ],
    },
  },

  // ──────────────────────────────── FOG ────────────────────────────────
  {
    n: 31, id: "fog-layers", name: "Fog Layers", fam: "Fog",
    note: "Opposed vertical washes, dark side rails",
    grain: 0.34,
    dark: {
      base: "#0D0E10",
      layers: [
        { bg: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 35%)", blend: SCREEN, filter: "blur(30px)" },
        { bg: "linear-gradient(0deg, rgba(255,255,255,0.14) 0%, transparent 40%)", blend: SCREEN, filter: "blur(45px)" },
        { bg: "linear-gradient(90deg, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F5F5F2",
      layers: [
        { bg: "linear-gradient(0deg, rgba(255,255,255,1) 0%, transparent 40%)", blend: SCREEN, filter: "blur(40px)" },
        { bg: "linear-gradient(90deg, rgba(26,26,30,0.15) 0%, transparent 30%, transparent 70%, rgba(26,26,30,0.15) 100%)", blend: MULT, filter: "blur(30px)" },
      ],
    },
  },
  {
    n: 32, id: "fog-deep", name: "Fog Deep", fam: "Fog",
    note: "Two long diagonal washes, soft outer vignette",
    grain: 0.33,
    dark: {
      base: "#0A0B0C",
      layers: [
        { bg: "linear-gradient(195deg, rgba(255,255,255,0.16) 0%, transparent 45%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "linear-gradient(15deg, rgba(255,255,255,0.12) 0%, transparent 50%)", blend: SCREEN, filter: "blur(80px)" },
        { bg: "radial-gradient(130% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F4F4F1",
      layers: [
        { bg: "linear-gradient(195deg, rgba(255,255,255,1) 0%, transparent 45%)", blend: SCREEN, filter: "blur(65px)" },
        { bg: "radial-gradient(130% 100% at 50% 50%, transparent 38%, rgba(26,26,30,0.18) 100%)", blend: MULT, filter: "blur(50px)" },
      ],
    },
  },
  {
    n: 33, id: "fog-bank", name: "Fog Bank", fam: "Fog",
    note: "Dense mid-height bank with capped top and floor",
    grain: 0.35,
    dark: {
      base: "#0C0C0E",
      layers: [
        { bg: "linear-gradient(180deg, transparent 25%, rgba(255,255,255,0.20) 55%, transparent 85%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "linear-gradient(180deg, transparent 45%, rgba(255,255,255,0.12) 62%, transparent 78%)", blend: SCREEN, filter: "blur(25px)" },
        { bg: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.65) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F3F3F0",
      layers: [
        { bg: "linear-gradient(180deg, transparent 25%, rgba(255,255,255,1) 55%, transparent 85%)", blend: SCREEN, filter: "blur(55px)" },
        { bg: "linear-gradient(180deg, rgba(26,26,30,0.18) 0%, transparent 32%, transparent 68%, rgba(26,26,30,0.2) 100%)", blend: MULT, filter: "blur(40px)" },
      ],
    },
  },
  {
    n: 34, id: "fog-drift", name: "Fog Drift", fam: "Fog",
    note: "Single drifting wash with an offset node",
    grain: 0.33,
    dark: {
      base: "#0B0C0F",
      layers: [
        { bg: "linear-gradient(160deg, rgba(255,255,255,0.18) 0%, transparent 40%)", blend: SCREEN, filter: "blur(90px)" },
        { bg: "radial-gradient(70% 50% at 30% 60%, rgba(255,255,255,0.14) 0%, transparent 100%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "linear-gradient(160deg, transparent 40%, rgba(0,0,0,0.55) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F4F4F2",
      layers: [
        { bg: "linear-gradient(160deg, rgba(255,255,255,1) 0%, transparent 42%)", blend: SCREEN, filter: "blur(80px)" },
        { bg: "linear-gradient(160deg, transparent 40%, rgba(26,26,30,0.18) 100%)", blend: MULT, filter: "blur(60px)" },
      ],
    },
  },
  {
    n: 35, id: "fog-pale", name: "Fog Pale", fam: "Fog",
    note: "Lightest of the fogs — raised floor, gentle vignette",
    grain: 0.31,
    dark: {
      base: "#131417",
      layers: [
        { bg: "linear-gradient(180deg, rgba(255,255,255,0.20) 0%, transparent 60%)", blend: SCREEN, filter: "blur(80px)" },
        { bg: "linear-gradient(90deg, rgba(255,255,255,0.10) 0%, transparent 55%)", blend: SCREEN, filter: "blur(90px)" },
        { bg: "radial-gradient(140% 110% at 50% 30%, transparent 45%, rgba(0,0,0,0.5) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F7F7F4",
      layers: [
        { bg: "linear-gradient(180deg, rgba(255,255,255,1) 0%, transparent 58%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(140% 110% at 50% 30%, transparent 46%, rgba(26,26,30,0.14) 100%)", blend: MULT, filter: "blur(50px)" },
      ],
    },
  },

  // ─────────────────────────────── SHEEN ───────────────────────────────
  {
    n: 36, id: "sheen-brushed", name: "Sheen Brushed", fam: "Sheen",
    note: "Fine vertical brush over a conic metal sweep",
    grain: 0.3,
    dark: {
      base: "#0E0E10",
      layers: [
        { bg: "repeating-linear-gradient(90deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 3px)", blend: SCREEN },
        { bg: "conic-gradient(from 200deg at 50% 50%, rgba(255,255,255,0.02) 0deg, rgba(255,255,255,0.30) 90deg, rgba(255,255,255,0.02) 180deg, rgba(255,255,255,0.26) 270deg, rgba(255,255,255,0.02) 360deg)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "radial-gradient(110% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F1F1EE",
      layers: [
        { bg: "repeating-linear-gradient(90deg, rgba(26,26,30,0.045) 0px, rgba(26,26,30,0.045) 1px, transparent 1px, transparent 3px)", blend: MULT },
        { bg: "conic-gradient(from 200deg at 50% 50%, rgba(255,255,255,0.2) 0deg, rgba(255,255,255,1) 90deg, rgba(255,255,255,0.2) 180deg, rgba(255,255,255,1) 270deg, rgba(255,255,255,0.2) 360deg)", blend: SCREEN, filter: "blur(55px)" },
      ],
    },
  },
  {
    n: 37, id: "sheen-satin", name: "Sheen Satin", fam: "Sheen",
    note: "Single satin highlight raking across a ribbed field",
    grain: 0.31,
    dark: {
      base: "#101013",
      layers: [
        { bg: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.30) 48%, rgba(255,255,255,0.05) 56%, transparent 70%)", blend: SCREEN, filter: "blur(40px)" },
        { bg: "repeating-linear-gradient(105deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 6px)", blend: SCREEN },
        { bg: "linear-gradient(105deg, rgba(0,0,0,0.5) 0%, transparent 40%, transparent 65%, rgba(0,0,0,0.55) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F2F2EF",
      layers: [
        { bg: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,1) 48%, rgba(255,255,255,0.4) 56%, transparent 70%)", blend: SCREEN, filter: "blur(36px)" },
        { bg: "linear-gradient(105deg, rgba(26,26,30,0.18) 0%, transparent 40%, transparent 65%, rgba(26,26,30,0.2) 100%)", blend: MULT, filter: "blur(30px)" },
      ],
    },
  },
  {
    n: 38, id: "sheen-foil", name: "Sheen Foil", fam: "Sheen",
    note: "Multi-lobe conic foil, off-centre anchor",
    grain: 0.32,
    dark: {
      base: "#0C0C0E",
      layers: [
        { bg: "conic-gradient(from 45deg at 30% 70%, rgba(255,255,255,0.34) 0deg, rgba(255,255,255,0.02) 70deg, rgba(255,255,255,0.28) 150deg, rgba(255,255,255,0.02) 220deg, rgba(255,255,255,0.30) 310deg, rgba(255,255,255,0.02) 360deg)", blend: SCREEN, filter: "blur(45px)" },
        { bg: "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 4px)", blend: SCREEN },
        { bg: "radial-gradient(120% 110% at 30% 70%, transparent 30%, rgba(0,0,0,0.72) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F1F1EE",
      layers: [
        { bg: "conic-gradient(from 45deg at 30% 70%, rgba(255,255,255,1) 0deg, rgba(255,255,255,0.1) 70deg, rgba(255,255,255,1) 150deg, rgba(255,255,255,0.1) 220deg, rgba(255,255,255,1) 310deg, rgba(255,255,255,0.1) 360deg)", blend: SCREEN, filter: "blur(42px)" },
        { bg: "radial-gradient(125% 112% at 30% 70%, transparent 28%, rgba(26,26,30,0.22) 100%)", blend: MULT, filter: "blur(40px)" },
      ],
    },
  },
  {
    n: 39, id: "sheen-blade", name: "Sheen Blade", fam: "Sheen",
    note: "Hard specular edge with a wide soft echo",
    grain: 0.32,
    dark: {
      base: "#0A0A0C",
      layers: [
        { bg: "linear-gradient(78deg, transparent 42%, rgba(255,255,255,0.55) 50%, transparent 58%)", blend: SCREEN, filter: "blur(20px)" },
        { bg: "linear-gradient(78deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 72%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(100% 100% at 50% 50%, transparent 30%, rgba(0,0,0,0.78) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F0F0ED",
      layers: [
        { bg: "linear-gradient(78deg, transparent 42%, rgba(255,255,255,1) 50%, transparent 58%)", blend: SCREEN, filter: "blur(18px)" },
        { bg: "radial-gradient(105% 105% at 50% 50%, transparent 30%, rgba(26,26,30,0.22) 100%)", blend: MULT, filter: "blur(45px)" },
      ],
    },
  },
  {
    n: 40, id: "sheen-pearl", name: "Sheen Pearl", fam: "Sheen",
    note: "Softest metal — pearlescent, no hard edge",
    grain: 0.3,
    dark: {
      base: "#121316",
      layers: [
        { bg: "conic-gradient(from 120deg at 50% 40%, rgba(255,255,255,0.22) 0deg, rgba(255,255,255,0.04) 120deg, rgba(255,255,255,0.20) 240deg, rgba(255,255,255,0.04) 360deg)", blend: SCREEN, filter: "blur(80px)" },
        { bg: "radial-gradient(50% 40% at 50% 30%, rgba(255,255,255,0.20) 0%, transparent 100%)", blend: SCREEN, filter: "blur(50px)" },
        { bg: "radial-gradient(120% 110% at 50% 40%, transparent 45%, rgba(0,0,0,0.55) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F6F6F3",
      layers: [
        { bg: "conic-gradient(from 120deg at 50% 40%, rgba(255,255,255,1) 0deg, rgba(255,255,255,0.2) 120deg, rgba(255,255,255,1) 240deg, rgba(255,255,255,0.2) 360deg)", blend: SCREEN, filter: "blur(75px)" },
        { bg: "radial-gradient(125% 112% at 50% 40%, transparent 46%, rgba(26,26,30,0.15) 100%)", blend: MULT, filter: "blur(50px)" },
      ],
    },
  },

  // ─────────────────────────────── PLASTER ─────────────────────────────
  {
    n: 41, id: "plaster-matte", name: "Plaster Matte", fam: "Plaster",
    note: "Matte charcoal, texture forward, grain lifted",
    grain: 0.45,
    dark: {
      base: "#131315",
      layers: [
        { bg: "radial-gradient(80% 70% at 40% 30%, rgba(255,255,255,0.10) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
        { bg: "repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 2px, transparent 2px, transparent 5px)", blend: SCREEN },
        { bg: "radial-gradient(130% 120% at 40% 30%, transparent 40%, rgba(0,0,0,0.5) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F0EFEB",
      layers: [
        { bg: "radial-gradient(80% 70% at 40% 30%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(55px)" },
        { bg: "radial-gradient(130% 120% at 40% 30%, transparent 40%, rgba(30,30,28,0.16) 100%)", blend: MULT, filter: "blur(45px)" },
      ],
    },
  },
  {
    n: 42, id: "plaster-raw", name: "Plaster Raw", fam: "Plaster",
    note: "Diagonal trowel ribbing under a soft wash",
    grain: 0.5,
    dark: {
      base: "#101012",
      layers: [
        { bg: "linear-gradient(170deg, rgba(255,255,255,0.12) 0%, transparent 55%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 3px, transparent 3px, transparent 7px)", blend: SCREEN },
        { bg: "linear-gradient(170deg, transparent 45%, rgba(0,0,0,0.55) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#EFEEEA",
      layers: [
        { bg: "linear-gradient(170deg, rgba(255,255,255,1) 0%, transparent 55%)", blend: SCREEN, filter: "blur(65px)" },
        { bg: "repeating-linear-gradient(45deg, rgba(30,30,28,0.02) 0px, rgba(30,30,28,0.02) 3px, transparent 3px, transparent 7px)", blend: MULT },
      ],
    },
  },
  {
    n: 43, id: "plaster-wash", name: "Plaster Wash", fam: "Plaster",
    note: "Two soft washes, mottled, no hard structure",
    grain: 0.42,
    dark: {
      base: "#141416",
      layers: [
        { bg: "radial-gradient(60% 50% at 70% 25%, rgba(255,255,255,0.16) 0%, transparent 100%)", blend: SCREEN, filter: "blur(75px)" },
        { bg: "radial-gradient(50% 45% at 25% 80%, rgba(255,255,255,0.10) 0%, transparent 100%)", blend: SCREEN, filter: "blur(65px)" },
        { bg: "radial-gradient(120% 110% at 50% 50%, transparent 45%, rgba(0,0,0,0.5) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F1F0EC",
      layers: [
        { bg: "radial-gradient(60% 50% at 70% 25%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(70px)" },
        { bg: "radial-gradient(55% 50% at 25% 80%, rgba(30,30,28,0.14) 0%, transparent 100%)", blend: MULT, filter: "blur(60px)" },
      ],
    },
  },
  {
    n: 44, id: "plaster-seam", name: "Plaster Seam", fam: "Plaster",
    note: "Horizontal seam lines with a mid-height glow",
    grain: 0.48,
    dark: {
      base: "#0F0F11",
      layers: [
        { bg: "linear-gradient(180deg, transparent 40%, rgba(255,255,255,0.14) 50%, transparent 60%)", blend: SCREEN, filter: "blur(50px)" },
        { bg: "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 9px)", blend: SCREEN },
        { bg: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.5) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#EFEEEA",
      layers: [
        { bg: "linear-gradient(180deg, transparent 40%, rgba(255,255,255,1) 50%, transparent 60%)", blend: SCREEN, filter: "blur(45px)" },
        { bg: "repeating-linear-gradient(0deg, rgba(30,30,28,0.03) 0px, rgba(30,30,28,0.03) 1px, transparent 1px, transparent 9px)", blend: MULT },
      ],
    },
  },
  {
    n: 45, id: "plaster-dust", name: "Plaster Dust", fam: "Plaster",
    note: "Heaviest grain, light pooling at the floor",
    grain: 0.52,
    dark: {
      base: "#121214",
      layers: [
        { bg: "radial-gradient(100% 80% at 50% 100%, rgba(255,255,255,0.14) 0%, transparent 100%)", blend: SCREEN, filter: "blur(85px)" },
        { bg: "repeating-radial-gradient(circle at 60% 70%, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 4px)", blend: SCREEN },
        { bg: "radial-gradient(130% 100% at 50% 100%, transparent 35%, rgba(0,0,0,0.6) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F0EFEB",
      layers: [
        { bg: "radial-gradient(100% 80% at 50% 100%, rgba(255,255,255,1) 0%, transparent 100%)", blend: SCREEN, filter: "blur(80px)" },
        { bg: "radial-gradient(130% 100% at 50% 100%, transparent 35%, rgba(30,30,28,0.18) 100%)", blend: MULT, filter: "blur(55px)" },
      ],
    },
  },

  // ──────────────────────────────── NOIR ───────────────────────────────
  {
    n: 46, id: "noir-whisper", name: "Noir Whisper", fam: "Noir",
    note: "Near-black with the faintest floor lift",
    grain: 0.22,
    dark: {
      base: "#050506",
      layers: [
        { bg: "radial-gradient(60% 45% at 50% 100%, rgba(255,255,255,0.16) 0%, transparent 100%)", blend: SCREEN, filter: "blur(80px)" },
        { bg: "radial-gradient(120% 100% at 50% 100%, transparent 30%, rgba(0,0,0,0.9) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#FAFAF7",
      layers: [
        { bg: "radial-gradient(60% 45% at 50% 100%, rgba(26,26,30,0.1) 0%, transparent 100%)", blend: MULT, filter: "blur(70px)" },
      ],
    },
  },
  {
    n: 47, id: "noir-edge", name: "Noir Edge", fam: "Noir",
    note: "Light only on the two vertical edges",
    grain: 0.2,
    dark: {
      base: "#060607",
      layers: [
        { bg: "linear-gradient(90deg, rgba(255,255,255,0.14) 0%, transparent 22%)", blend: SCREEN, filter: "blur(50px)" },
        { bg: "linear-gradient(270deg, rgba(255,255,255,0.08) 0%, transparent 18%)", blend: SCREEN, filter: "blur(50px)" },
      ],
    },
    light: {
      base: "#FAFAF7",
      layers: [
        { bg: "linear-gradient(90deg, rgba(26,26,30,0.12) 0%, transparent 22%)", blend: MULT, filter: "blur(45px)" },
        { bg: "linear-gradient(270deg, rgba(26,26,30,0.08) 0%, transparent 18%)", blend: MULT, filter: "blur(45px)" },
      ],
    },
  },
  {
    n: 48, id: "noir-arc", name: "Noir Arc", fam: "Noir",
    note: "A single thin arc rising off the bottom edge",
    grain: 0.24,
    dark: {
      base: "#050507",
      layers: [
        { bg: "radial-gradient(closest-side circle at 50% 105%, transparent 62%, rgba(255,255,255,0.22) 70%, transparent 80%)", blend: SCREEN, filter: "blur(35px)" },
        { bg: "radial-gradient(55% 35% at 50% 105%, rgba(255,255,255,0.10) 0%, transparent 100%)", blend: SCREEN, filter: "blur(60px)" },
      ],
    },
    light: {
      base: "#F9F9F6",
      layers: [
        { bg: "radial-gradient(closest-side circle at 50% 105%, transparent 62%, rgba(26,26,30,0.16) 70%, transparent 80%)", blend: MULT, filter: "blur(32px)" },
      ],
    },
  },
  {
    n: 49, id: "noir-grain", name: "Noir Grain", fam: "Noir",
    note: "Grain is the subject — barely any gradient at all",
    grain: 0.6,
    dark: {
      base: "#070708",
      layers: [
        { bg: "radial-gradient(90% 70% at 50% 40%, rgba(255,255,255,0.09) 0%, transparent 100%)", blend: SCREEN, filter: "blur(90px)" },
        { bg: "radial-gradient(120% 110% at 50% 40%, transparent 45%, rgba(0,0,0,0.85) 100%)", blend: MULT },
      ],
    },
    light: {
      base: "#F8F8F5",
      layers: [
        { bg: "radial-gradient(120% 110% at 50% 40%, transparent 45%, rgba(26,26,30,0.14) 100%)", blend: MULT, filter: "blur(60px)" },
      ],
    },
  },
  {
    n: 50, id: "noir-void", name: "Noir Void", fam: "Noir",
    note: "True OLED black with one corner lift",
    grain: 0.18,
    dark: {
      base: "#030304",
      layers: [
        { bg: "radial-gradient(70% 60% at 100% 0%, rgba(255,255,255,0.10) 0%, transparent 100%)", blend: SCREEN, filter: "blur(70px)" },
      ],
    },
    light: {
      base: "#FCFCF9",
      layers: [
        { bg: "radial-gradient(70% 60% at 100% 0%, rgba(26,26,30,0.09) 0%, transparent 100%)", blend: MULT, filter: "blur(60px)" },
      ],
    },
  },
];

/** Family display order, used to group sheets. */
export const FAMILIES = [
  { key: "Vapor", blurb: "Soft radial blooms, heavy blur, low contrast" },
  { key: "Beams", blurb: "Blurred repeating-linear streaks" },
  { key: "Mesh", blurb: "Offset radial nodes blended into a mesh" },
  { key: "Duotone", blurb: "Editorial splits between black and white" },
  { key: "Spotlight", blurb: "One light source, deep vignette falloff" },
  { key: "Halo", blurb: "Conic sweeps, rings and arcs" },
  { key: "Fog", blurb: "Stacked low-opacity washes, atmospheric depth" },
  { key: "Sheen", blurb: "Conic and ribbed fields — brushed metal" },
  { key: "Plaster", blurb: "Grain-dominant matte texture" },
  { key: "Noir", blurb: "Near-black, a single faint light" },
];

export const byFamily = (key) => GRADIENTS.filter((g) => g.fam === key);
