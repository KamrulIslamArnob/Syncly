import { defineShader, layer, rgba, scaleAlpha } from "./kit.js";

/**
 * Vapor — soft radial blooms, heavy blur, low contrast.
 *
 * Ported from docs/design/gradient-board/gradients.mjs entries 1-3, with
 * literal colours replaced by roles and literal alphas routed through
 * scaleAlpha so the intensity dial reaches every light-emitting stop.
 */

export const vaporBloom = defineShader({
  id: "vapor-bloom",
  name: "Vapor Bloom",
  family: "Vapor",
  colorSlots: 2,
  defaults: { colors: ["#FFFFFF", "#0B0B0D"], noise: 0.5, intensity: 0.5 },
  build: ({ light, ground }, { intensity, mode }) => ({
    base: ground,
    layers: [
      layer({
        background: `radial-gradient(60% 55% at 50% 108%, ${rgba(light, scaleAlpha(0.42, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 60,
      }),
      layer({
        background: `radial-gradient(40% 30% at 50% 100%, ${rgba(light, scaleAlpha(0.28, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 30,
      }),
      mode === "dark"
        ? layer({
            background: `radial-gradient(120% 90% at 50% 0%, rgba(0, 0, 0, ${scaleAlpha(0.65, intensity)}) 0%, rgba(0, 0, 0, 0) 60%)`,
            blend: "multiply",
          })
        : layer({
            background: `radial-gradient(120% 85% at 50% 0%, ${rgba(ground, scaleAlpha(0.2, intensity))} 0%, ${rgba(ground, 0)} 62%)`,
            blend: "multiply",
            blur: 30,
          }),
    ],
  }),
});

export const vaporTwin = defineShader({
  id: "vapor-twin",
  name: "Vapor Twin",
  family: "Vapor",
  colorSlots: 2,
  defaults: { colors: ["#FFFFFF", "#0C0D10"], noise: 0.5, intensity: 0.5 },
  build: ({ light, ground }, { intensity, mode }) => ({
    base: ground,
    layers: [
      layer({
        background: `radial-gradient(45% 45% at 18% 12%, ${rgba(light, scaleAlpha(0.3, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 70,
      }),
      layer({
        background: `radial-gradient(50% 50% at 84% 88%, ${rgba(light, scaleAlpha(0.34, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 80,
      }),
      mode === "dark"
        ? layer({
            background: `radial-gradient(90% 90% at 50% 50%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, ${scaleAlpha(0.5, intensity)}) 100%)`,
            blend: "multiply",
          })
        : null,
    ],
  }),
});

export const vaporBand = defineShader({
  id: "vapor-band",
  name: "Vapor Band",
  family: "Vapor",
  colorSlots: 2,
  defaults: { colors: ["#FFFFFF", "#0A0A0C"], noise: 0.5, intensity: 0.5 },
  build: ({ light, ground }, { intensity }) => ({
    base: ground,
    layers: [
      layer({
        background: `linear-gradient(180deg, ${rgba(light, 0)} 20%, ${rgba(light, scaleAlpha(0.3, intensity))} 50%, ${rgba(light, 0)} 80%)`,
        blend: "screen",
        blur: 90,
      }),
      layer({
        background: `radial-gradient(80% 40% at 50% 50%, ${rgba(light, scaleAlpha(0.18, intensity))} 0%, ${rgba(light, 0)} 100%)`,
        blend: "screen",
        blur: 40,
      }),
      null,
    ],
  }),
});

export const VAPOR_SHADERS = [vaporBloom, vaporTwin, vaporBand];
