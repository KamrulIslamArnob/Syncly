const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/* High-contrast: icons use currentColor so CSS can adapt to dark/light.
   Dark:  bright light color on dark canvas. Light: dark saturated on light canvas.
   Additional white inner highlights + dark outline ensure visibility in both modes. */

/** Morning — bold sunrise, solid sun, thick rays, strong horizon */
export function morningIcon() {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "28",
    height: "28",
    fill: "none",
    "aria-hidden": "true",
    class: "greeting-anim greeting-anim--morning",
  });

  // sun — solid currentColor with white core for pop in both modes
  const sunG = svgEl("g");
  const sunOuter = svgEl("circle", {
    cx: "12",
    cy: "10.8",
    r: "4.7",
    fill: "currentColor",
    stroke: "rgba(0,0,0,0.18)",
    "stroke-width": "1.1",
  });
  const sunInner = svgEl("circle", { cx: "11.2", cy: "10.0", r: "1.45", fill: "#fff", opacity: "0.95" });
  sunG.append(sunOuter, sunInner);
  sunG.append(svgEl("animateTransform", { attributeName: "transform", type: "translate", values: "0 0; 0 -0.7; 0 0", dur: "3.0s", repeatCount: "indefinite", additive: "sum" }));
  svg.append(sunG);

  // thick rays — 8, fully opaque, rotating
  const rays = svgEl("g", { stroke: "currentColor", "stroke-width": "1.55", "stroke-linecap": "round", opacity: "0.98" });
  const r = [
    ["12", "1.4", "12", "4.4"],
    ["12", "17.2", "12", "20.2"],
    ["1.4", "10.8", "4.4", "10.8"],
    ["19.6", "10.8", "22.6", "10.8"],
    ["4.9", "4.0", "6.9", "6.0"],
    ["17.1", "15.6", "19.1", "17.6"],
    ["4.9", "17.6", "6.9", "15.6"],
    ["17.1", "6.0", "19.1", "4.0"],
  ];
  for (const [x1, y1, x2, y2] of r) rays.append(svgEl("line", { x1, y1, x2, y2 }));
  // subtle pulse via opacity not needed — keep solid for contrast
  rays.append(svgEl("animateTransform", { attributeName: "transform", type: "rotate", from: "0 12 10.8", to: "360 12 10.8", dur: "22s", repeatCount: "indefinite" }));
  svg.append(rays);

  // horizon & hills — strong stroke
  const hillsStroke = svgEl("path", {
    d: "M1.8 17 L7.0 11.2 L9.8 14.3 L13.4 9.6 L18.0 14.6 L22.2 17 Z",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.45",
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
    opacity: "0.92",
  });
  svg.append(hillsStroke);
  const hillsFill = svgEl("path", {
    d: "M1.8 17 L7.0 11.2 L9.8 14.3 L13.4 9.6 L18.0 14.6 L22.2 17 L22.2 19 L1.8 19 Z",
    fill: "currentColor",
    opacity: "0.16",
  });
  svg.append(hillsFill);
  // base line
  svg.append(svgEl("line", { x1: "1.8", y1: "17", x2: "22.2", y2: "17", stroke: "currentColor", "stroke-width": "1.0", opacity: "0.55" }));

  return svg;
}

/** Afternoon — high noon sun, 12-ray burst, crisp */
export function afternoonIcon() {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "28",
    height: "28",
    fill: "none",
    "aria-hidden": "true",
    class: "greeting-anim greeting-anim--afternoon",
  });

  // sun core — solid, white highlight
  const sun = svgEl("circle", { cx: "12", cy: "12", r: "4.9", fill: "currentColor", stroke: "rgba(0,0,0,0.18)", "stroke-width": "1.05" });
  const highlight = svgEl("circle", { cx: "11.0", cy: "10.6", r: "1.6", fill: "#fff", opacity: "0.92" });
  sun.append(svgEl("animate", { attributeName: "r", values: "4.9;5.05;4.9", dur: "2.2s", repeatCount: "indefinite" }));
  svg.append(sun, highlight);

  // 12 crisp rays
  const rays = svgEl("g", { stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", opacity: "1" });
  const pts = [
    ["12", "1.2", "12", "4.0"],
    ["12", "20.0", "12", "22.8"],
    ["1.2", "12", "4.0", "12"],
    ["20.0", "12", "22.8", "12"],
    ["4.6", "4.6", "6.6", "6.6"],
    ["17.4", "17.4", "19.4", "19.4"],
    ["4.6", "19.4", "6.6", "17.4"],
    ["17.4", "6.6", "19.4", "4.6"],
    ["7.0", "2.2", "8.2", "4.8"],
    ["17.0", "21.8", "15.8", "19.2"],
    ["2.2", "17.0", "4.8", "15.8"],
    ["21.8", "7.0", "19.2", "8.2"],
  ];
  for (const [x1, y1, x2, y2] of pts) rays.append(svgEl("line", { x1, y1, x2, y2 }));
  rays.append(svgEl("animateTransform", { attributeName: "transform", type: "rotate", from: "0 12 12", to: "360 12 12", dur: "16s", repeatCount: "indefinite" }));
  svg.append(rays);

  return svg;
}

/** Evening — sunset half-disc persisting above horizon, strong warm wash */
export function eveningIcon() {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "28",
    height: "28",
    fill: "none",
    "aria-hidden": "true",
    class: "greeting-anim greeting-anim--evening",
  });

  // horizon base
  svg.append(svgEl("line", { x1: "1.6", y1: "16.2", x2: "22.4", y2: "16.2", stroke: "currentColor", "stroke-width": "1.35", "stroke-linecap": "round", opacity: "0.88" }));
  // warm wash behind sun
  svg.append(svgEl("rect", { x: "3", y: "12.8", width: "18", height: "3.4", rx: "1", fill: "currentColor", opacity: "0.18" }));

  // clipped sun — half visible
  const defs = svgEl("defs");
  const clip = svgEl("clipPath", { id: "gm-evening-clip2" });
  clip.append(svgEl("rect", { x: "0", y: "0", width: "24", height: "16.2" }));
  defs.append(clip);
  svg.append(defs);

  const sunG = svgEl("g", { "clip-path": "url(#gm-evening-clip2)" });
  const sun = svgEl("circle", { cx: "12", cy: "16.2", r: "5.2", fill: "currentColor", stroke: "rgba(0,0,0,0.16)", "stroke-width": "1.0" });
  // white specular to guarantee pop on both backgrounds
  const spec = svgEl("ellipse", { cx: "11.0", cy: "14.2", rx: "1.5", ry: "1.0", fill: "#fff", opacity: "0.88" });
  sunG.append(sun, spec);
  sunG.append(svgEl("animateTransform", { attributeName: "transform", type: "translate", values: "0 0; 0 0.55; 0 0", dur: "3.4s", repeatCount: "indefinite" }));
  svg.append(sunG);

  // upper rays — short, thick
  const rays = svgEl("g", { stroke: "currentColor", "stroke-width": "1.35", "stroke-linecap": "round", opacity: "0.92" });
  rays.append(svgEl("line", { x1: "12", y1: "3.8", x2: "12", y2: "6.2" }));
  rays.append(svgEl("line", { x1: "7.2", y1: "5.6", x2: "8.6", y2: "7.3" }));
  rays.append(svgEl("line", { x1: "16.8", y1: "5.6", x2: "15.4", y2: "7.3" }));
  rays.append(svgEl("line", { x1: "4.8", y1: "9.6", x2: "6.9", y2: "10.4" }));
  rays.append(svgEl("line", { x1: "19.2", y1: "9.6", x2: "17.1", y2: "10.4" }));
  svg.append(rays);

  // first stars — solid, not faint
  const s1 = svgEl("circle", { cx: "5.0", cy: "5.2", r: "0.85", fill: "currentColor", opacity: "0.92" });
  s1.append(svgEl("animate", { attributeName: "opacity", values: "0.45;0.92;0.45", dur: "2.0s", repeatCount: "indefinite" }));
  const s2 = svgEl("circle", { cx: "19.0", cy: "4.6", r: "0.70", fill: "currentColor", opacity: "0.88" });
  s2.append(svgEl("animate", { attributeName: "opacity", values: "0.4;0.88;0.4", dur: "2.5s", repeatCount: "indefinite", begin: "0.6s" }));
  svg.append(s1, s2);

  return svg;
}

/** Night — crescent moon solid with white highlight, chunky stars, shooting trail */
export function nightIcon() {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "28",
    height: "28",
    fill: "none",
    "aria-hidden": "true",
    class: "greeting-anim greeting-anim--night",
  });

  // outer glow for legibility on dark
  svg.append(svgEl("circle", { cx: "13.8", cy: "12", r: "7.8", fill: "currentColor", opacity: "0.11" }));

  // crescent — solid currentColor, thick dark outline via filter, white crater highlight
  const moon = svgEl("path", {
    d: "M13.8 2.9 A7.4 7.4 0 1 0 13.8 21.1 A5.9 5.9 0 1 1 13.8 2.9 Z",
    fill: "currentColor",
    stroke: "rgba(0,0,0,0.22)",
    "stroke-width": "1.1",
  });
  moon.append(svgEl("animateTransform", { attributeName: "transform", type: "rotate", values: "-1.2 13.8 12; 1.2 13.8 12; -1.2 13.8 12", dur: "4.6s", repeatCount: "indefinite" }));
  svg.append(moon);

  // white highlight on moon for contrast on both themes
  const moonHi = svgEl("path", {
    d: "M13.2 4.2 A6.2 6.2 0 0 0 13.2 19.4 A4.2 4.2 0 0 1 13.2 4.2 Z",
    fill: "#fff",
    opacity: "0.18",
  });
  svg.append(moonHi);

  // craters — darker, opaque
  svg.append(svgEl("ellipse", { cx: "12.2", cy: "9.0", rx: "1.15", ry: "0.95", fill: "rgba(0,0,0,0.16)", stroke: "rgba(0,0,0,0.18)", "stroke-width": "0.6" }));
  svg.append(svgEl("ellipse", { cx: "14.6", cy: "13.8", rx: "0.85", ry: "0.70", fill: "rgba(0,0,0,0.14)", stroke: "rgba(0,0,0,0.14)", "stroke-width": "0.5" }));
  svg.append(svgEl("ellipse", { cx: "12.0", cy: "15.6", rx: "0.60", ry: "0.50", fill: "rgba(0,0,0,0.12)" }));

  // stars — solid 4-point, opaque, thick for visibility
  const stars = svgEl("g");
  const makeStar = (cx, cy, r, dur, begin) => {
    const g = svgEl("g", { transform: `translate(${cx} ${cy})` });
    const p = svgEl("path", {
      d: `M0 ${-r} L${r * 0.38} ${-r * 0.38} L${r} 0 L${r * 0.38} ${r * 0.38} L0 ${r} L${-r * 0.38} ${r * 0.38} L${-r} 0 L${-r * 0.38} ${-r * 0.38} Z`,
      fill: "#fff",
      stroke: "currentColor",
      "stroke-width": "0.55",
      "stroke-opacity": "0.9",
    });
    // keep stars bright — pulse opacity 0.75->1 not 0.25->1
    p.append(svgEl("animate", { attributeName: "opacity", values: "0.72;1;0.72", dur, repeatCount: "indefinite", begin }));
    g.append(p);
    return g;
  };
  // use white fill + currentColor stroke => visible on both dark and light
  stars.append(
    makeStar(4.6, 5.2, 1.45, "1.9s", "0s"),
    makeStar(19.2, 6.0, 1.25, "2.2s", "0.35s"),
    makeStar(3.6, 13.0, 1.10, "2.0s", "0.72s"),
    makeStar(20.0, 13.8, 0.95, "2.4s", "1.05s"),
    makeStar(6.4, 3.0, 0.80, "1.7s", "0.28s"),
  );
  // stars also have solid currentColor fill fallback for light mode (white stroke ensures dark bg pop)
  // add solid currentColor stars behind for light-mode contrast
  const solidStars = svgEl("g", { fill: "currentColor", opacity: "0.92" });
  solidStars.append(svgEl("circle", { cx: "4.6", cy: "5.2", r: "0.55" }), svgEl("circle", { cx: "19.2", cy: "6.0", r: "0.45" }), svgEl("circle", { cx: "3.6", cy: "13.0", r: "0.42" }));
  // keep them subtle
  svg.append(solidStars, stars);

  // shooting star — bright white trail with currentColor outline
  const shoot = svgEl("g", { opacity: "0" });
  const line = svgEl("line", { x1: "19.8", y1: "4.0", x2: "13.6", y2: "10.0", stroke: "#fff", "stroke-width": "1.15", "stroke-linecap": "round" });
  shoot.append(line);
  shoot.append(svgEl("animate", { attributeName: "opacity", values: "0;0;1;0", dur: "4.0s", repeatCount: "indefinite", begin: "2.6s" }));
  shoot.append(svgEl("animateTransform", { attributeName: "transform", type: "translate", values: "0 0; 1.4 -1.4; 4.0 -4.0", dur: "4.0s", repeatCount: "indefinite", begin: "2.6s" }));
  svg.append(shoot);

  return svg;
}

export function getGreetingIcon(part) {
  if (part === "morning") return morningIcon();
  if (part === "afternoon") return afternoonIcon();
  if (part === "evening") return eveningIcon();
  return nightIcon();
}
