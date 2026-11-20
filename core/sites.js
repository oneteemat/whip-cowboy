/* Whip Cowboy — core/sites.js
 * One profile per supported chatbot. ALL DOM selectors live here: when a site changes its markup,
 * this is the file to edit. Lists are tried in order; the first visible match wins
 * (turn on Debug mode in the popup to see which selector matched in the console).
 *
 * Name detection only reads data the page already shows you (or the site's own same-origin
 * account endpoint, using your existing session). The name stays in memory on this page —
 * it is never stored or sent anywhere. */
(() => {
  'use strict';
  const WC = (globalThis.WhipCowboy = globalThis.WhipCowboy || {});

  async function fetchJSON(path) {
    if (location.protocol !== 'https:') return null;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    try {
      const r = await fetch(path, { credentials: 'same-origin', signal: ctl.signal, headers: { accept: 'application/json' } });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
      return await r.json();
    } catch (_) {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  /** Visible text of an element → first line that looks like a name (not a plan label). */
  function nameFromText(el) {
    if (!el) return null;
    const lines = (el.innerText || el.textContent || '').split('\n').map((l) => l.trim());
    return lines.find((l) => l.length > 2 && !/\b(plan|free|pro|plus|max|team|enterprise|upgrade|settings)\b/i.test(l)) || null;
  }

  const SITES = {
    claude: {
      id: 'claude',
      name: 'Claude',
      hosts: /(^|\.)claude\.ai$/,
      rival: { head: { type: 'sun', fill: '#e8632b', rays: 12, rIn: 0.6 }, horse: '#ececec', mane: '#9a9a9a' },
      selectors: {
        stopButton: [
          'button[aria-label="Stop response"]',
          'button[aria-label="Stop Response"]',
          '[data-testid="stop-button"]',
          'button[aria-label*="stop" i][aria-label*="respon" i]',
          'fieldset button[aria-label^="Stop" i]',
        ],
        streaming: ['[data-is-streaming="true"]'],
        taskProgress: ['[data-testid*="task-progress" i]', '[data-testid*="progress-panel" i]', '[aria-label*="task progress" i]'],
        response: ['[data-is-streaming]', '[data-testid="assistant-message"]', '.font-claude-response', '.font-claude-message'],
        chatColumn: ['main', '[role="main"]'],
      },
      async detectName() {
        const j = await fetchJSON('/api/account');
        const n = j && (j.display_name || j.full_name || (j.account && (j.account.display_name || j.account.full_name)));
        return n || nameFromText(document.querySelector('[data-testid="user-menu-button"]'));
      },
    },

    chatgpt: {
      id: 'chatgpt',
      name: 'ChatGPT',
      hosts: /(^|\.)(chatgpt\.com|chat\.openai\.com)$/,
      rival: { head: { type: 'sun', fill: '#1fb39a', rays: 10, rIn: 0.8, jitter: 0.03 }, horse: '#d9d9d9', mane: '#6f6f6f' },
      selectors: {
        stopButton: [
          'button[data-testid="stop-button"]',
          'button[aria-label="Stop streaming"]',
          'button[aria-label="Stop generating"]',
          '#composer-submit-button[aria-label*="Stop" i]',
          'form button[aria-label*="stop" i]',
        ],
        streaming: ['.result-streaming', '[data-message-author-role="assistant"] .streaming-animation'],
        taskProgress: [],
        response: ['[data-message-author-role="assistant"]', 'article[data-testid^="conversation-turn"]'],
        chatColumn: ['main', '[role="main"]'],
      },
      async detectName() {
        const j = await fetchJSON('/api/auth/session');
        return (j && j.user && j.user.name) || nameFromText(document.querySelector('[data-testid="accounts-profile-button"]'));
      },
    },

    gemini: {
      id: 'gemini',
      name: 'Gemini',
      hosts: /^gemini\.google\.com$/,
      rival: { head: { type: 'sun', fill: '#6b7cff', rays: 6, rIn: 0.5, jitter: 0.06 }, horse: '#e2e2ea', mane: '#8a8aa0' },
      selectors: {
        stopButton: [
          'button[aria-label="Stop response"]',
          'button[aria-label*="Stop" i][aria-label*="respon" i]',
          'button.send-button.stop',
          'button mat-icon[fonticon="stop"]',
        ],
        streaming: ['model-response [aria-busy="true"]', 'pending-request', '.response-container .loading'],
        taskProgress: [],
        response: ['model-response', 'message-content.model-response-text', '.model-response-text'],
        chatColumn: ['main', 'chat-window', '[role="main"]'],
      },
      async detectName() {
        const a = document.querySelector('a[aria-label*="Google Account" i], a[aria-label*="Google-Konto" i], a[aria-label*="Google-account" i]');
        const m = a && (a.getAttribute('aria-label') || '').match(/:\s*([^\n(]+)/);
        return m ? m[1] : null;
      },
    },
  };

  function detectSite(hostname) {
    for (const k in SITES) if (SITES[k].hosts.test(hostname)) return SITES[k];
    return SITES.claude; // dev playground (file://) etc.
  }

  /** "Matin Maleki" → "Matin". Rejects emails and junk. */
  function cleanName(n) {
    if (!n || typeof n !== 'string' || n.includes('@')) return null;
    const first = n.trim().split(/\s+/)[0].replace(/[^\p{L}\p{M}'-]/gu, '');
    return first.length >= 2 && first.length <= 24 ? first : null;
  }

  WC.SITES = SITES;
  WC.site = detectSite(location.hostname);
  WC.cleanName = cleanName;
})();
