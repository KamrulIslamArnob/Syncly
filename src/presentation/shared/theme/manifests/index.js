import { ThemeRegistry } from "../../../../domain/services/ThemeRegistry.js";
import { auroraManifest } from "./aurora.js";
import { glacierMistManifest } from "./glacierMist.js";
import { orchidBloomManifest } from "./orchidBloom.js";
import { oceanPearlManifest } from "./oceanPearl.js";
import { retroGridManifest } from "./retroGrid.js";
import { diamondStormManifest } from "./diamondStorm.js";
import { graphiteFlowManifest } from "./graphiteFlow.js";
import { skyDeepSeaManifest } from "./skyDeepSea.js";
import { roseGoldManifest } from "./roseGold.js";
import { solidManifest } from "./solid.js";
import { minimalManifest } from "./minimal.js";
import { nordManifest } from "./nord.js";
import { cyberpunkManifest } from "./cyberpunk.js";
import { sageManifest } from "./sage.js";

export const BUILTIN_MANIFESTS = Object.freeze([
  auroraManifest,
  retroGridManifest,
  diamondStormManifest,
  graphiteFlowManifest,
  skyDeepSeaManifest,
  roseGoldManifest,
  solidManifest,
  minimalManifest,
  nordManifest,
  cyberpunkManifest,
  sageManifest,
]);

export const AURA_THEMES = Object.freeze([
  glacierMistManifest,
  orchidBloomManifest,
  oceanPearlManifest,
]);

// Initialize and register all manifests with ThemeRegistry
for (const manifest of [...BUILTIN_MANIFESTS, ...AURA_THEMES]) {
  ThemeRegistry.register(manifest);
}

export {
  auroraManifest,
  glacierMistManifest,
  orchidBloomManifest,
  oceanPearlManifest,
  retroGridManifest,
  diamondStormManifest,
  graphiteFlowManifest,
  skyDeepSeaManifest,
  roseGoldManifest,
  solidManifest,
  minimalManifest,
  nordManifest,
  cyberpunkManifest,
  sageManifest,
};
