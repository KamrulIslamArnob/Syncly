import { el } from "../../shared/dom.js";
import { icon } from "../../shared/icons.js";
import { PomodoroService } from "./PomodoroService.js";

function getUtcOffset(timezone) {
  if (!timezone) return "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find(p => p.type === "timeZoneName")?.value ?? "UTC";
    return offset.replace("GMT", "UTC");
  } catch {
    return "UTC";
  }
}

function formatParts(date, { is24h, withSeconds, timeZone }) {
  const opts = { hour: "2-digit", minute: "2-digit", hour12: !is24h };
  if (withSeconds) opts.second = "2-digit";
  if (timeZone) opts.timeZone = timeZone;
  let text;
  try {
    text = new Intl.DateTimeFormat("en-US", opts).format(date);
  } catch {
    delete opts.timeZone;
    text = new Intl.DateTimeFormat("en-US", opts).format(date);
  }
  // "03:14:24 PM" → { time: "03:14:24", period: "PM" } ; 24h has no period
  const m = text.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*([AP]M)?$/i);
  return { time: m ? m[1] : text, period: m?.[2] ?? "" };
}

export class CombinedClockView {
  constructor({ clock }) {
    this.clock = clock;
    this.intervalId = null;
    this.root = null;
    this.settings = null;
    this.mode = "clock"; // "clock" | "pomodoro"
    this.pomodoro = new PomodoroService();
    this.unsubPomo = null;
  }

  render(settings) {
    this.settings = settings;
    if (this.root) {
      this._updateWorldMeta();
      this._updateText();
      return this.root;
    }

    this._localTimeEl = el("span", { className: "clock-time", id: "local-time", title: "Click to start a Timer" }, "");
    this._localPeriodEl = el("span", { className: "clock-period", id: "local-period" }, "");
    this._clockMain = el("div", { className: "clock-main", title: "Click to start a Timer" }, this._localTimeEl, this._localPeriodEl);
    this._clockMain.addEventListener("click", () => this._toggleMode());

    this._pomoLabel = el("div", { className: "pomo-label" }, "TIMER · 25 MIN");
    
    // Quick duration presets (1m, 5m, 15m, 25m)
    const makePreset = (min, label) => {
      const btn = el("button", { type: "button", className: "timer-preset-btn" }, label);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.pomodoro.setDuration?.(min * 60) || (this.pomodoro.timeLeft = min * 60);
        this.pomodoro.start();
        this._pomoStartBtn.textContent = "Pause";
        this._pomoLabel.textContent = `TIMER · ${min} MIN`;
        this._updateText();
      });
      return btn;
    };

    const presetRow = el("div", { className: "timer-preset-row" },
      makePreset(1, "1m"),
      makePreset(5, "5m"),
      makePreset(15, "15m"),
      makePreset(25, "25m")
    );

    const startBtn = el("button", { type: "button", className: "btn btn-primary timer-action-btn" }, "Start");
    startBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.pomodoro.toggle();
      startBtn.textContent = this.pomodoro.isRunning ? "Pause" : "Start";
    });

    const resetBtn = el("button", { type: "button", className: "btn timer-action-btn" }, "Reset");
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.pomodoro.reset();
      startBtn.textContent = "Start";
      this._updateText();
    });

    const exitBtn = el("button", { type: "button", className: "btn timer-action-btn" }, "Clock ✕");
    exitBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this._toggleMode();
    });

    this._pomoStartBtn = startBtn;
    this._pomoControls = el("div", { className: "pomo-controls" }, presetRow, el("div", { className: "timer-btn-group" }, startBtn, resetBtn, exitBtn));
    this._pomoControls.style.display = "none";
    this._pomoLabel.style.display = "none";

    // Geometric block secondary world-clock: [ • CITY | TIME | :: UTC+OFFSET ]
    this._worldLabel = el("span", { className: "world-label" }, "");
    this._worldTimeEl = el("span", { className: "world-time", id: "world-time" }, "");
    this._worldOffset = el("span", { className: "world-offset" }, "");
    const worldRow = el("div", { className: "world-row world-geometric-card" },
      el("div", { className: "world-card-segment world-seg-location" },
        el("span", { className: "world-pulse", "aria-hidden": "true" }),
        this._worldLabel
      ),
      el("div", { className: "world-card-divider", "aria-hidden": "true" }),
      el("div", { className: "world-card-segment world-seg-time" },
        this._worldTimeEl
      ),
      el("div", { className: "world-card-divider", "aria-hidden": "true" }),
      el("div", { className: "world-card-segment world-seg-offset" },
        el("span", { className: "world-grid-glyph", "aria-hidden": "true" }, "::"),
        this._worldOffset
      )
    );

    this.root = el("section", { className: "clock-block", "aria-label": "Clock" },
      this._pomoLabel, this._clockMain, this._pomoControls, worldRow);

    this._updateWorldMeta();
    this._updateText();
    this.intervalId = setInterval(() => this._updateText(), 1000);
    this.unsubPomo = this.pomodoro.onTick(() => { if (this.mode === "pomodoro") this._updateText(); });
    return this.root;
  }

  _worldClock() {
    const c = this.settings?.clocks?.[0];
    return c ? { label: c.label || c.city, timeZone: c.timeZone || c.iana } : { label: "London", timeZone: "Europe/London" };
  }

  _updateWorldMeta() {
    const c = this._worldClock();
    if (this._worldLabel) this._worldLabel.textContent = c.label;
    if (this._worldOffset) this._worldOffset.textContent = getUtcOffset(c.timeZone);
  }

  _toggleMode() {
    this.mode = this.mode === "clock" ? "pomodoro" : "clock";
    const pomo = this.mode === "pomodoro";
    this._pomoControls.style.display = pomo ? "flex" : "none";
    this._pomoLabel.style.display = pomo ? "" : "none";
    this._localTimeEl.classList.toggle("pomodoro-active", pomo);
    if (!pomo) { this.pomodoro.reset(); this._pomoStartBtn.textContent = "Start"; }
    this._updateText();
  }

  _updateText() {
    if (!this.root) return;
    if (this.mode === "pomodoro") {
      const p = this.pomodoro;
      this._localTimeEl.textContent = p.formatTime(p.mode === "idle" ? 25 * 60 : p.timeLeft);
      this._localPeriodEl.textContent = "";
      return;
    }
    const is24h = this.settings?.timeFormat?.value === "24h";
    const withSeconds = this.settings?.showSeconds === true;
    const now = this.clock.now();
    const local = formatParts(now, { is24h, withSeconds });
    this._localTimeEl.textContent = local.time;
    this._localPeriodEl.textContent = local.period;
    const c = this._worldClock();
    const world = formatParts(now, { is24h, withSeconds: false, timeZone: c.timeZone });
    this._worldTimeEl.textContent = world.period ? `${world.time} ${world.period}` : world.time;
  }

  destroy() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.unsubPomo?.();
    this.pomodoro.destroy();
    this.root = null;
  }
}
