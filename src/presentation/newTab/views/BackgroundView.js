import { BackgroundKind } from "../../../domain/valueObjects/BackgroundConfig.js";

export class BackgroundView {
  constructor({ settings, sanitizer }) {
    this.settings = settings;
    this.sanitizer = sanitizer;
    this.objectUrl = "";
    this.objectUrlSource = "";
  }

  update(settings) {
    const bg = settings.background || { kind: BackgroundKind.SOLID_COLOR, value: '#000000' };
    const blur = settings.backgroundBlur;
    const overlay = settings.backgroundOverlay;
    const tintColor = settings.backgroundTintColor || "#000000";
    const buttonRoundness = settings.buttonRoundness ?? 8;

    if (settings.themePreset !== undefined) {
      document.documentElement.setAttribute("data-theme-preset", settings.themePreset || "minimal");
    }

    const style = document.body.style;
    const rootStyle = document.documentElement.style;
    const setVar = (name, value) => {
      style.setProperty(name, value);
      rootStyle.setProperty(name, value);
    };
    setVar("--bg-blur", `${blur}px`);
    setVar("--bg-scale", blur > 0 ? "1.04" : "1");
    const isImage = bg.kind === BackgroundKind.LOCAL_IMAGE || bg.kind === BackgroundKind.REMOTE_IMAGE;
    const effectiveOverlay = isImage ? Math.max(overlay, 0.20) : overlay;
    setVar("--bg-overlay", `${effectiveOverlay}`);
    setVar("--bg-overlay-color", tintColor);
    setVar("--bg-solid", "transparent");
    setVar("--button-radius", `${buttonRoundness}px`);
    setVar("--bg-grayscale", `${settings.bgGrayscale || 0}%`);
    setVar("--bg-hue", `${settings.bgHueRotate || 0}deg`);

    setVar("--bg-pixel-right", "0");
    setVar("--bg-pixel-bottom", "0");
    setVar("--bg-pixel-width", "100%");
    setVar("--bg-pixel-height", "100%");
    setVar("--bg-pixel-scale", "1");
    setVar("--bg-image-rendering", "auto");

    let effectsLayer = document.getElementById("bg-effects-layer");
    if (!effectsLayer) {
      effectsLayer = document.createElement("div");
      effectsLayer.id = "bg-effects-layer";
      effectsLayer.style.cssText = "position: fixed; inset: 0; pointer-events: none; z-index: 2;";
      document.body.insertBefore(effectsLayer, document.body.firstChild);
    }
    // Vignette removed — the flat OLED redesign forbids edge darkening.
    effectsLayer.style.backgroundImage = "none";

    switch (bg.kind) {
      case BackgroundKind.LOCAL_IMAGE: {
        const val = bg.value || "";
        let image;
        if (val.startsWith("data:")) {
          image = `url("${this.objectUrlFor(val)}")`;
        } else {
          this.clearObjectUrl();
          const safeName = this.sanitizer.text(val);
          image = `url("img/${safeName}")`;
        }
        setVar("--bg-image", image);
        setVar("--bg-solid", "transparent");
        style.backgroundImage = "none";
        style.backgroundColor = "transparent";
        setVar("--bg-size", "cover");
        setVar("--bg-position", "center");
        break;
      }
      case BackgroundKind.REMOTE_IMAGE: {
        this.clearObjectUrl();
        const safeUrl = this.sanitizer.url(bg.value || "");
        const image = safeUrl ? `url("${safeUrl}")` : "none";
        setVar("--bg-image", image);
        setVar("--bg-solid", "transparent");
        style.backgroundImage = "none";
        style.backgroundColor = "transparent";
        if (safeUrl) {
          setVar("--bg-image", image);
        } else {
          setVar("--bg-image", "none");
        }
        setVar("--bg-size", "cover");
        setVar("--bg-position", "center");
        break;
      }
      case BackgroundKind.SOLID_COLOR: {
        this.clearObjectUrl();
        const safe = this.sanitizer.text(bg.value || "#1f2937");
        setVar("--bg-image", "none");
        setVar("--bg-solid", safe);
        style.backgroundImage = "none";
        style.backgroundColor = safe;
        break;
      }
      case BackgroundKind.GRADIENT: {
        this.clearObjectUrl();
        const safe = this.sanitizer.text(bg.value || "");
        setVar("--bg-image", safe || "none");
        setVar("--bg-solid", "transparent");
        style.backgroundImage = "none";
        style.backgroundColor = "transparent";
        setVar("--bg-size", "auto");
        setVar("--bg-position", "center");
        break;
      }
      default:
        this.clearObjectUrl();
        setVar("--bg-image", "none");
    }
  }

  objectUrlFor(dataUrl) {
    if (this.objectUrl && this.objectUrlSource === dataUrl) return this.objectUrl;
    this.clearObjectUrl();
    const [header, payload] = dataUrl.split(",");
    const mime = header.match(/^data:([^;]+)/)?.[1] || "image/png";
    const binary = atob(payload || "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    this.objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    this.objectUrlSource = dataUrl;
    return this.objectUrl;
  }

  clearObjectUrl() {
    if (!this.objectUrl) return;
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = "";
    this.objectUrlSource = "";
  }
}
