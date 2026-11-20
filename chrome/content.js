/* Whip Cowboy — chrome/content.js
 * The ONLY Chrome-specific glue on the page side (runs on claude.ai, chatgpt.com, gemini.google.com): chrome.storage.sync ↔ app settings,
 * popup messages → app, and lifecycle (enable/disable, extension reload). */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  if (!WC || !WC.createApp) return;

  // If an older copy of this script is still alive (extension was reloaded), tell it to shut down.
  const TOKEN = Math.random().toString(36).slice(2);
  document.dispatchEvent(new CustomEvent('whipcowboy:takeover', { detail: TOKEN }));
  document.querySelectorAll('whip-cowboy-overlay').forEach((n) => n.remove());

  let app = null;
  let settings = null;
  let alive = true;

  const contextOk = () => {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  };

  const host = {
    save(partial) {
      if (!alive || !contextOk()) return Promise.resolve();
      return chrome.storage.sync.set(partial).catch((e) => console.warn('[WhipCowboy] could not save settings', e));
    },
    /** Lifetime stats for the popup's WANTED poster (local only, batched). */
    bump(key, n = 1) {
      pendingStats[key] = (pendingStats[key] || 0) + n;
      if (!statsTimer) statsTimer = setTimeout(flushStats, 4000);
    },
  };
  let pendingStats = {};
  let statsTimer = 0;
  function flushStats() {
    statsTimer = 0;
    const add = pendingStats;
    pendingStats = {};
    if (!contextOk()) return;
    chrome.storage.local
      .get({ stats: {} })
      .then(({ stats }) => {
        for (const k in add) stats[k] = (stats[k] || 0) + add[k];
        return chrome.storage.local.set({ stats });
      })
      .catch(() => {});
  }

  function apply(next) {
    settings = next;
    if (!alive) return;
    const on = next.enabled && !(next.sites && next.sites[WC.site.id] === false);
    if (on && !app) app = WC.createApp(host, next);
    else if (!on && app) {
      app.dispose();
      app = null;
    } else if (app) app.update(next);
  }

  function onStorage(changes, area) {
    if (area !== 'sync' || !alive || !settings) return;
    const next = Object.assign({}, settings);
    for (const k in changes) next[k] = changes[k].newValue === undefined ? WC.config.defaults[k] : changes[k].newValue;
    apply(next);
  }

  function onMessage(msg, _sender, sendResponse) {
    if (!alive || !msg || typeof msg.type !== 'string' || !msg.type.startsWith('wc:')) return;
    if (!app) sendResponse({ ok: false, reason: 'disabled' });
    else sendResponse(app.handleMessage(msg) || { ok: true });
  }

  function shutdown() {
    if (!alive) return;
    alive = false;
    if (statsTimer) {
      clearTimeout(statsTimer);
      flushStats();
    }
    if (app) app.dispose();
    app = null;
    document.removeEventListener('whipcowboy:takeover', onTakeover);
    clearInterval(watchdog);
    try {
      chrome.storage.onChanged.removeListener(onStorage);
      chrome.runtime.onMessage.removeListener(onMessage);
    } catch (_) { /* context already gone */ }
  }

  function onTakeover(e) {
    if (e.detail !== TOKEN) shutdown();
  }

  document.addEventListener('whipcowboy:takeover', onTakeover);
  chrome.storage.onChanged.addListener(onStorage);
  chrome.runtime.onMessage.addListener(onMessage);
  // Extension reloaded/removed → this script's chrome.* APIs die; clean up our overlay.
  const watchdog = setInterval(() => {
    if (!contextOk()) shutdown();
  }, 3000);

  chrome.storage.sync
    .get(WC.config.defaults)
    .then(apply)
    .catch((e) => {
      console.warn('[WhipCowboy] storage unavailable, using defaults', e);
      apply(Object.assign({}, WC.config.defaults));
    });
})();
