/* Whip Cowboy — core/detector.js
 * Watches claude.ai's DOM (read-only!) to decide whether Claude is generating.
 * MutationObserver (throttled) + a slow safety poll. Emits onStart / onDone / onNavigate. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;

  /** Strict visibility: sites often keep a hidden Stop button in the DOM after generation
   *  (opacity 0, zero size, aria-hidden, inert…). Those must NOT count as "working". */
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
    if (el.closest('[aria-hidden="true"], [inert], [hidden]')) return false;
    let n = el;
    for (let d = 0; n && n.nodeType === 1 && d < 8; d++, n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.2) return false;
    }
    return true;
  };
  const isTyping = (node) => {
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return !!(el && el.closest && el.closest('textarea, input, [contenteditable="true"], [contenteditable=""], whip-cowboy-overlay'));
  };

  class WorkDetector {
    constructor(scope, cfg, cb) {
      this.scope = scope;
      this.cfg = cfg;
      this.cb = cb; // { onStart(match), onDone({duration}), onNavigate(), log(...), debug() }
      this.working = false;
      this.lastWorkSeen = 0;
      this.startedAt = 0;
      this.simUntil = 0;
      this.lastSel = undefined;
      this.href = location.href;
      this.pending = false;
      this.growth = { el: null, len: -1, streak: 0, at: 0 };
    }

    start() {
      const mo = new MutationObserver((records) => {
        for (const r of records) {
          if (this.stallIgnore && r.target === this.stallIgnore) this._releaseStall('stale element changed');
          if (!isTyping(r.target)) {
            this.lastActivity = performance.now();
            break;
          }
        }
        this._schedule();
      });
      mo.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-label', 'data-is-streaming', 'aria-busy', 'disabled', 'data-testid'],
      });
      this.scope.add(() => mo.disconnect());
      this.scope.interval(() => this.check(), this.cfg.timing.pollMs);
      this.check();
    }

    _releaseStall(why) {
      if (!this.stallIgnore) return;
      this.cb.log('stall guard released (' + why + ')');
      this.stallIgnore = null;
    }

    _schedule() {
      if (this.pending) return;
      this.pending = true;
      this.scope.timeout(() => {
        this.pending = false;
        this.check();
      }, this.cfg.timing.mutationThrottleMs);
    }

    /** Test mode: pretend Claude is working for ms. */
    simulate(ms) {
      this.simUntil = performance.now() + ms;
      this.check();
    }
    stopSimulation() {
      this.simUntil = 0;
      this.lastWorkSeen = 0;
      this.check();
    }

    _first(list) {
      for (const sel of list) {
        let el = null;
        try {
          el = document.querySelector(sel);
        } catch (_) {
          continue; // invalid selector in config
        }
        if (el && el === this.stallIgnore) {
          // the stuck element: look for another match of the same selector
          let all = [];
          try { all = document.querySelectorAll(sel); } catch (_) { /* ignore */ }
          el = Array.from(all).find((n) => n !== this.stallIgnore && visible(n)) || null;
          if (el) return { selector: sel, el };
          continue;
        }
        if (visible(el)) return { selector: sel, el };
      }
      return null;
    }

    _last(list) {
      for (const sel of list) {
        let all;
        try {
          all = document.querySelectorAll(sel);
        } catch (_) {
          continue;
        }
        for (let i = all.length - 1; i >= 0; i--) if (visible(all[i])) return { selector: sel, el: all[i] };
      }
      return null;
    }

    match() {
      const S = this.cfg.selectors;
      let m = this._first(S.stopButton);
      if (m) return Object.assign(m, { group: 'stopButton' });
      m = this._first(S.streaming);
      if (m) return Object.assign(m, { group: 'streaming' });
      if (this.cfg.useTextGrowthFallback) {
        const g = this.growth, now = performance.now();
        if (now - g.at >= this.cfg.timing.pollMs * 0.9) {
          g.at = now;
          const r = this._last(S.response);
          const len = r ? r.el.textContent.length : -1;
          if (r && r.el === g.el && len > g.len) g.streak++;
          else g.streak = 0;
          g.el = r ? r.el : null;
          g.len = len;
        }
        if (g.streak >= 2) return { group: 'text-growth', selector: '(response text is growing)', el: g.el };
      }
      return null;
    }

    findAnchor() {
      const S = this.cfg.selectors;
      const m = this._first(S.taskProgress) || this._last(S.response) || this._first(S.chatColumn);
      return m ? m.el : null;
    }

    check() {
      const now = performance.now();
      if (location.href !== this.href) {
        this.href = location.href;
        this.growth = { el: null, len: -1, streak: 0, at: 0 };
        this.cb.log('navigation →', this.href);
        if (this.cb.onNavigate) this.cb.onNavigate();
      }
      let m = this.simUntil > now ? { group: 'test', selector: '(simulated by Test button)', el: null } : this.match();
      if (this.stallIgnore && !this.stallIgnore.isConnected) this._releaseStall('stale element removed');
      if (m && m.el && m.el === this.stallIgnore) m = null; // the element that got stuck earlier
      // Stall guard: "working" but nothing on the page changed for a while → it's really done.
      const stallMs = this.cfg.timing.stallDoneMs;
      if (m && m.group !== 'test' && this.working && stallMs && now - Math.max(this.lastActivity || 0, this.startedAt) > stallMs) {
        this.cb.log('stall guard: "' + m.selector + '" still matches but nothing changed for ' + Math.round(stallMs / 1000) + 's → treating as DONE. Stuck element:', m.el && m.el.outerHTML.slice(0, 300));
        this.stallIgnore = m.el;
        m = null;
        this.lastWorkSeen = 0;
      }
      const key = m ? m.group + ' | ' + m.selector : null;
      if (key !== this.lastSel) {
        if (m) this.cb.log('working signal matched:', m.group, '→', m.selector, m.el || '');
        else if (this.lastSel) this.cb.log('no working selector matches any more');
        this.lastSel = key;
      }
      if (m) {
        this.lastWorkSeen = now;
        if (!this.working) {
          this.working = true;
          this.startedAt = now;
          this.cb.log('state → WORKING');
          this.cb.onStart(m);
        }
      } else if (this.working && (now - this.lastWorkSeen > this.cfg.timing.settleDoneMs || this.lastWorkSeen === 0)) {
        this.working = false;
        this.cb.log('state → DONE after', Math.round((now - this.startedAt) / 1000) + 's');
        this.cb.onDone({ duration: now - this.startedAt });
      }
    }
  }

  WC.WorkDetector = WorkDetector;
})();
