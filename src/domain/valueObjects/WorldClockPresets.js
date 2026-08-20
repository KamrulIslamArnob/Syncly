// Domain value object: WorldClockPresets
// Curated list of world-clock cities mapped to their IANA timezone names.
// Used by the Options UI to offer a preset city picker instead of free-form
// timezone text. Kept as a single source of truth so the Options select and
// any display logic can share one definition.
//
// Shape: { city: string, country: string, iana: string }
// Sorted alphabetically by city. Frozen to prevent accidental mutation.

/**
 * Preset world-clock entries.
 * Note: some cities share an IANA zone (e.g. San Francisco & Los Angeles both
 * use America/Los_Angeles) — both are kept as distinct entries so the picker
 * can autofill the correct city label.
 */
export const WORLD_CLOCK_PRESETS = Object.freeze([
  { city: "Berlin", country: "Germany", iana: "Europe/Berlin" },
  { city: "Chicago", country: "United States", iana: "America/Chicago" },
  { city: "Dhaka", country: "Bangladesh", iana: "Asia/Dhaka" },
  { city: "Dubai", country: "United Arab Emirates", iana: "Asia/Dubai" },
  { city: "Hong Kong", country: "China", iana: "Asia/Hong_Kong" },
  { city: "London", country: "United Kingdom", iana: "Europe/London" },
  { city: "Los Angeles", country: "United States", iana: "America/Los_Angeles" },
  { city: "Mumbai", country: "India", iana: "Asia/Kolkata" },
  { city: "New York", country: "United States", iana: "America/New_York" },
  { city: "Paris", country: "France", iana: "Europe/Paris" },
  { city: "San Francisco", country: "United States", iana: "America/Los_Angeles" },
  { city: "Singapore", country: "Singapore", iana: "Asia/Singapore" },
  { city: "Sydney", country: "Australia", iana: "Australia/Sydney" },
  { city: "Tokyo", country: "Japan", iana: "Asia/Tokyo" },
]);

/**
 * Sentinel value used by the Options select for the "Custom…" escape hatch.
 * A real IANA zone will never equal this.
 */
export const CUSTOM_TIMEZONE_VALUE = "__custom__";
