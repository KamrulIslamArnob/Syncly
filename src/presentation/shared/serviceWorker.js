/* ============================================================
   serviceWorker.js — MV3 background service worker

   Handles the `nt` omnibox keyword: quick-add tasks, quick notes,
   and fallback search navigation.

   ARCHITECTURAL NOTE — why this file talks to chrome.storage.local
   directly instead of going through the DI container / use cases:

   buildContainer() instantiates the full dependency graph, including
   AutoBackupService (which uses the File System Access API —
   `window.showSaveFilePicker`, unavailable in the service-worker
   context) and HttpWeatherService.  Constructing the container here
   would throw and break the omnibox feature.  The service worker is
   also a minimal, ephemeral context where building ~35 use cases is
   unwarranted.

   Cross-tab propagation still works: when this worker writes to
   chrome.storage.local, the newTab page's container (which wires
   `storage.onChanged` for `area === "local"`) invalidates its repo
   cache and re-emits the domain event, so the UI refreshes.

   REMAINING GAP: input sanitization is handled inline below (mirrors
   BasicSanitizer.text — strips control chars and angle brackets)
   rather than through the SanitizerPort, and task objects are built
   directly instead of via CreateTaskUseCase.  This is an accepted
   trade-off to keep the omnibox handler self-contained and resilient.
   ============================================================ */

const SEARCH_ENGINES = {
  google: "https://www.google.com/search?q=",
  youtube: "https://www.youtube.com/results?search_query=",
  duckduckgo: "https://duckduckgo.com/?q=",
  bing: "https://www.bing.com/search?q=",
};

// Inline sanitizer mirroring BasicSanitizer.text():
function sanitizeText(input) {
  if (typeof input !== "string") return "";
  return input.replace(/[\u0000-\u001F\u007F<>]/g, "").trim();
}

function escapeXml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// ── Omnibox ─────────────────────────────────────────────────────────────────
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  try {
    const raw = (text || "").trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    const suggestions = [];

    if (lower.startsWith("todo ")) {
      const taskText = escapeXml(raw.slice(5).trim());
      if (taskText) {
        suggestions.push({ content: raw, description: `<match>Add todo:</match> <dim>${taskText}</dim>` });
      }
    } else if (lower.startsWith("note ")) {
      const noteText = escapeXml(raw.slice(5).trim());
      if (noteText) {
        suggestions.push({ content: raw, description: `<match>Save note:</match> <dim>${noteText}</dim>` });
      }
    } else {
      const escaped = escapeXml(raw);
      suggestions.push({ content: `todo ${raw}`, description: `<match>todo</match> ${escaped} — add as task` });
      suggestions.push({ content: `note ${raw}`, description: `<match>note</match> ${escaped} — save as quick note` });
    }

    suggest(suggestions);
  } catch (err) {
    console.warn("[Omnibox] suggest error:", err);
  }
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  try {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();

    if (lower.startsWith("todo ")) {
      const taskText = sanitizeText(trimmed.slice(5).trim()).slice(0, 200);
      if (!taskText) return;
      try {
        const stored = await chrome.storage.local.get("tasks").catch(() => ({ tasks: [] }));
        const tasks = Array.isArray(stored.tasks) ? stored.tasks : [];
        const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order ?? 0), -1);
        const newTask = {
          id: crypto.randomUUID(),
          title: taskText,
          completed: false,
          order: maxOrder + 1,
          scheduledTime: "",
          durationMinutes: null,
        };
        tasks.push(newTask);
        await chrome.storage.local.set({ tasks });
      } catch (err) {
        console.error("[Omnibox] Failed to add task:", err);
      }
      return;
    }

    if (lower.startsWith("note ")) {
      const noteText = sanitizeText(trimmed.slice(5).trim());
      if (!noteText) return;
      try {
        const stored = await chrome.storage.local.get("quickNote").catch(() => ({}));
        const existing = stored.quickNote ?? "";
        const separator = existing ? "\n" : "";
        await chrome.storage.local.set({ quickNote: existing + separator + noteText });
      } catch (err) {
        console.error("[Omnibox] Failed to save note:", err);
      }
      return;
    }

    let url;
    try {
      const isHttp = trimmed.startsWith("http://") || trimmed.startsWith("https://");
      const isDomain = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(trimmed);
      if (isHttp || isDomain) {
        url = isHttp ? trimmed : `https://${trimmed}`;
      } else {
        throw new Error("search");
      }
    } catch {
      const stored = await chrome.storage.local.get("settings").catch(() => ({}));
      const engine = stored.settings?.searchEngine ?? "google";
      const base = SEARCH_ENGINES[engine] ?? SEARCH_ENGINES.google;
      url = base + encodeURIComponent(trimmed);
    }

    if (disposition === "currentTab") {
      if (chrome.tabs && chrome.tabs.update) {
        chrome.tabs.update({ url });
      }
    } else {
      if (chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url });
      }
    }
  } catch (err) {
    console.warn("[Omnibox] onInputEntered error:", err);
  }
});

// ── Init ────────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  // Service worker initialization
});
