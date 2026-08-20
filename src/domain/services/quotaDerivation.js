export function deriveEffectiveState(provider) {
  if (provider.isManuallyPaused) return "paused";
  if (provider.cooldownUntil) {
    const cooldownMs = new Date(provider.cooldownUntil).getTime() - Date.now();
    if (cooldownMs > 0) return "cooling";
  }
  for (const policy of provider.policies) {
    if (policy.used >= policy.budget) return "depleted";
  }
  return "active";
}

export function deriveSecondsUntilActive(provider) {
  if (provider.cooldownUntil) {
    const ms = new Date(provider.cooldownUntil).getTime() - Date.now();
    if (ms > 0) return Math.ceil(ms / 1000);
  }
  return null;
}

export function deriveSecondsToReset(policy) {
  if (policy.secondsToReset != null) return policy.secondsToReset;
  if (policy.windowEnd) {
    const ms = new Date(policy.windowEnd).getTime() - Date.now();
    if (ms > 0) return Math.ceil(ms / 1000);
  }
  return null;
}

export function formatSeconds(seconds) {
  if (seconds == null || seconds < 0) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

export function computeUsageRatio(policy) {
  if (!policy.budget || policy.budget <= 0) return 0;
  return Math.min(policy.used / policy.budget, 1);
}
