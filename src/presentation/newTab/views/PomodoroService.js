/**
 * PomodoroService — manages a 25/5 Pomodoro cycle.
 * Lives in the presentation layer (stateful, not persisted between reloads).
 */
export class PomodoroService {
  #workMinutes = 25;
  #breakMinutes = 5;
  #timeLeft = 0;
  #mode = "idle"; // "idle" | "work" | "break"
  #intervalId = null;
  #listeners = new Set();
  #audioCtx = null;

  get timeLeft() { return this.#timeLeft; }
  set timeLeft(seconds) { this.#timeLeft = Math.max(0, seconds); this.#emit(); }
  get mode() { return this.#mode; }
  get isRunning() { return this.#intervalId !== null; }

  setDuration(seconds) {
    this.#timeLeft = Math.max(0, seconds);
    this.#mode = "work";
    this.#emit();
  }

  onTick(fn) {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit() {
    for (const fn of this.#listeners) {
      try { fn({ mode: this.#mode, timeLeft: this.#timeLeft, isRunning: this.isRunning }); } catch {}
    }
  }

  start() {
    if (this.#mode === "idle") {
      this.#mode = "work";
      this.#timeLeft = this.#workMinutes * 60;
    }
    if (this.#intervalId) return;
    this.#intervalId = setInterval(() => this.#tick(), 1000);
    this.#emit();
  }

  pause() {
    clearInterval(this.#intervalId);
    this.#intervalId = null;
    this.#emit();
  }

  reset() {
    clearInterval(this.#intervalId);
    this.#intervalId = null;
    this.#mode = "idle";
    this.#timeLeft = 0;
    this.#emit();
  }

  toggle() {
    if (this.isRunning) this.pause();
    else this.start();
  }

  #tick() {
    this.#timeLeft -= 1;
    if (this.#timeLeft <= 0) {
      this.#playAlert();
      if (this.#mode === "work") {
        this.#mode = "break";
        this.#timeLeft = this.#breakMinutes * 60;
      } else {
        this.#mode = "work";
        this.#timeLeft = this.#workMinutes * 60;
      }
    }
    this.#emit();
  }

  #playAlert() {
    try {
      if (!this.#audioCtx) {
        this.#audioCtx = new AudioContext();
      }
      const osc = this.#audioCtx.createOscillator();
      const gain = this.#audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.#audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, this.#audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.#audioCtx.currentTime + 0.8);
      osc.start();
      osc.stop(this.#audioCtx.currentTime + 0.8);
    } catch (err) {
      console.warn("[Pomodoro] Could not play alert:", err);
    }
  }

  destroy() {
    clearInterval(this.#intervalId);
    this.#intervalId = null;
    this.#listeners.clear();
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }
}
