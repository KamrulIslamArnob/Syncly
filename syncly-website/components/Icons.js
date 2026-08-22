/* Syncly landing — inline SVG icon set.
   Line icons: 24px viewBox, stroke currentColor 1.5, round caps.
   Brand mark: geometric Chrome logo (recognizable on install CTAs). */

export function ChromeIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {/* top wedge */}
      <path d="M3.91 6.12 A10 10 0 0 1 20.09 6.12 L17.26 8.18 A6.5 6.5 0 0 0 6.74 8.18 Z" fill="#EA4335" />
      {/* right wedge */}
      <path d="M21.13 7.93 A10 10 0 0 1 10.95 21.95 L11.32 18.47 A6.5 6.5 0 0 0 17.94 9.36 Z" fill="#FBBC05" />
      {/* left wedge */}
      <path d="M7 20.66 A10 10 0 0 1 7 3.34 L8.75 6.37 A6.5 6.5 0 0 0 8.75 17.63 Z" fill="#34A853" />
      <circle cx="12" cy="12" r="7.25" fill="#fff" />
      <circle cx="12" cy="12" r="5.9" fill="#4285F4" />
    </svg>
  );
}

const line = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const IconWorkspaces = () => (
  <svg {...line}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const IconTag = () => (
  <svg {...line}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconBolt = () => (
  <svg {...line}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
);

export const IconSearch = () => (
  <svg {...line}>
    <circle cx="11" cy="11" r="7" />
    <path d="m16.5 16.5 4.5 4.5" />
  </svg>
);

export const IconKeyboard = () => (
  <svg {...line}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h-.01M8 14h8" />
  </svg>
);

export const IconSend = () => (
  <svg {...line}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
  </svg>
);

export const IconSync = () => (
  <svg {...line}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </svg>
);
