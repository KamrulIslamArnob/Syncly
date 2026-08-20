// Deterministic color-from-string helpers shared by the bookmark deck
// (card cover tiles, collection-tree swatches) and the popup (cover
// picker) — same hash so a bookmark's "auto-match" color looks the
// same everywhere it's shown.

const THUMB_GRADIENTS = [
  "linear-gradient(135deg, #2D3748 0%, #1A202C 100%)",
  "linear-gradient(135deg, #312E81 0%, #1E1B4B 100%)",
  "linear-gradient(135deg, #1E3A8A 0%, #0F172A 100%)",
  "linear-gradient(135deg, #14532D 0%, #052E16 100%)",
  "linear-gradient(135deg, #701A75 0%, #3B0764 100%)",
  "linear-gradient(135deg, #7C2D12 0%, #431407 100%)",
  "linear-gradient(135deg, #831843 0%, #4C0519 100%)",
  "linear-gradient(135deg, #374151 0%, #1F2937 100%)",
];

// Swatch colors for the collections tree / tag pills.
const FOLDER_COLORS = ["#D2683F", "#6C6FD4", "#7E9B76", "#E0A33E", "#8A919C", "#C25A9E"];

function hashStr(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getThumbGradient(str = "") {
  return THUMB_GRADIENTS[hashStr(str) % THUMB_GRADIENTS.length];
}

export function getFolderColor(str = "") {
  return FOLDER_COLORS[hashStr(str) % FOLDER_COLORS.length];
}
