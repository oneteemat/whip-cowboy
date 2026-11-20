/* Whip Cowboy — core/stage.js
 * One full-viewport overlay (position:fixed, max z-index, pointer-events:none) hosting a Shadow DOM.
 * claude.ai's CSS can't reach in, ours can't leak out. Layers:
 *   world (shakeable): back → figures → fx → bubbles
 *   ui (never shaken): context menu */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const U = WC.U;

  const CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
.wc-world, .wc-ui, .wc-layer { position: absolute; inset: 0; pointer-events: none; }
.wc-world { overflow: hidden; will-change: transform; }
.wc-fig { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; will-change: transform; pointer-events: none; }
.wc-svg { position: absolute; left: -220px; top: -330px; overflow: visible; pointer-events: none; }
.wc-svg .o { fill: none; stroke: rgba(255,255,255,.93); stroke-linecap: round; stroke-linejoin: round; }
.wc-svg .i { fill: none; stroke: #151515; stroke-linecap: round; stroke-linejoin: round; }
.wc-svg .i.fill { fill: #151515; }
.wc-svg .i.teeth { fill: #fff; }
.wc-svg .wc-headfill { fill: #fff; }
.wc-svg .wc-eyes circle { fill: #151515; }
.wc-svg .wc-whip .i { stroke: #2b1a0c; }
.wc-svg .wc-handle .i { stroke: #5a3517; }
.wc-hit { pointer-events: all; cursor: grab; }
.wc-dragging .wc-hit { cursor: grabbing; }

/* ---------- speech bubbles ---------- */
.wc-bubble { position: absolute; left: 0; top: 0; pointer-events: none; will-change: transform; }
.wc-bubble-inner {
  position: relative; background: #fff; color: #151515; border: 3px solid #151515; border-radius: 18px 20px 17px 19px;
  padding: 7px 14px 8px; max-width: 280px; width: max-content; text-align: center;
  font: 700 16px/1.22 "Comic Sans MS", "Comic Neue", "Chalkboard SE", "Marker Felt", "Segoe Print", "Bradley Hand", cursive;
  box-shadow: 3px 4px 0 rgba(0,0,0,.18);
  transform-origin: var(--tx, 30%) 110%;
  animation: wc-pop .42s cubic-bezier(.2, 1.7, .4, 1) both;
}
.wc-tail { position: absolute; bottom: -20px; left: calc(var(--tx, 30%) - 13px); width: 26px; height: 22px; overflow: visible; }
.wc-bubble.out .wc-bubble-inner { animation: wc-unpop .18s ease-in forwards; }
.wc-bubble.alarm .wc-bubble-inner { color: #d10000; font-size: 28px; letter-spacing: 1px; border-color: #d10000; }
.wc-bubble.alarm .wc-txt { display: inline-block; animation: wc-jitter .09s steps(2) infinite; }
.wc-bubble.mega .wc-bubble-inner { font-size: 24px; background: #fff4c2; color: #b3200b; }
.wc-bubble.mega .wc-txt { display: inline-block; animation: wc-jitter .11s steps(2) infinite; }
@keyframes wc-pop { 0% { transform: scale(.2); opacity: 0; } 60% { opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes wc-unpop { to { transform: scale(.6); opacity: 0; } }
@keyframes wc-jitter { 0% { transform: translate(-1px, 1px) rotate(-1deg); } 50% { transform: translate(1.5px, -1px) rotate(1deg); } 100% { transform: translate(-1px, -1px); } }

/* ---------- context menu (macOS style) ---------- */
.wc-menu {
  position: absolute; left: 0; top: 0; min-width: 250px; padding: 5px; border-radius: 10px;
  background: rgba(246, 246, 246, .78); color: #1d1d1f;
  -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%);
  border: .5px solid rgba(0, 0, 0, .22);
  box-shadow: 0 12px 34px rgba(0,0,0,.28), 0 0 0 .5px rgba(255,255,255,.5) inset;
  font: 13px/1.2 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  pointer-events: auto; user-select: none; -webkit-user-select: none; cursor: default;
  animation: wc-menu-in .1s ease-out;
}
.wc-menu.dark { background: rgba(38, 38, 40, .76); color: #f2f2f4; border-color: rgba(255,255,255,.16); box-shadow: 0 12px 34px rgba(0,0,0,.5), 0 0 0 .5px rgba(255,255,255,.08) inset; }
.wc-mi { display: flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px 0 4px; border-radius: 5px; white-space: nowrap; }
.wc-mi .wc-check { width: 16px; text-align: center; font-size: 12px; }
.wc-mi .wc-emoji { width: 20px; text-align: center; font-size: 14px; }
.wc-mi .wc-label { flex: 1; padding-right: 18px; }
.wc-mi .wc-hint { opacity: .5; font-size: 12px; }
.wc-mi .wc-arrow { opacity: .7; font-size: 11px; }
.wc-mi.disabled { opacity: .38; }
.wc-mi:not(.disabled):hover, .wc-mi.open { background: #2ea043; color: #fff; }
.wc-mi:not(.disabled):hover .wc-hint, .wc-mi.open .wc-hint { opacity: .85; }
.wc-sep { height: 1px; margin: 5px 9px; background: rgba(0,0,0,.13); }
.wc-menu.dark .wc-sep { background: rgba(255,255,255,.14); }
.wc-badge { font-size: 10px; padding: 1px 5px; border-radius: 6px; background: rgba(127,127,127,.22); }
@keyframes wc-menu-in { from { opacity: 0; transform: scale(.98); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .wc-bubble-inner, .wc-menu { animation: none !important; }
  .wc-bubble.alarm .wc-txt, .wc-bubble.mega .wc-txt { animation: none !important; }
}
`;

  class Stage {
    constructor(scope) {
      this.scope = scope;
      const host = (this.host = document.createElement('whip-cowboy-overlay'));
      host.setAttribute(
        'style',
        'all:initial !important;position:fixed !important;inset:0 !important;width:100vw !important;height:100vh !important;' +
          'z-index:2147483647 !important;pointer-events:none !important;display:block !important;contain:strict !important;'
      );
      this.root = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = CSS + (WC.extraCSS || []).join('\n');
      this.root.appendChild(style);
      const div = (cls, parent) => {
        const d = document.createElement('div');
        d.className = cls;
        parent.appendChild(d);
        return d;
      };
      this.world = div('wc-world', this.root);
      this.layers = {
        back: div('wc-layer wc-back-layer', this.world),
        figures: div('wc-layer wc-figures', this.world),
        fx: div('wc-layer wc-fx', this.world),
        bubbles: div('wc-layer wc-bubbles', this.world),
      };
      this.ui = div('wc-ui', this.root);
      this.vw = window.innerWidth;
      this.vh = window.innerHeight;
      scope.listen(window, 'resize', () => {
        this.vw = window.innerWidth;
        this.vh = window.innerHeight;
      });
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = mq.matches;
      scope.listen(mq, 'change', (e) => (this.reduced = e.matches));
      this.ensureAttached();
      scope.add(() => host.remove());
    }

    /** claude.ai is a SPA; if anything ever detaches us, re-attach. */
    ensureAttached() {
      if (!this.host.isConnected) (document.documentElement || document.body).appendChild(this.host);
    }

    /** Shake the overlay only (never the real page). No-op with prefers-reduced-motion. */
    shake(clock, ms = 450, amp = 10, signal) {
      if (this.reduced) return Promise.resolve();
      const w = this.world;
      return clock
        .tween(ms, (t) => {
          const a = amp * (1 - t);
          w.style.transform = `translate3d(${U.r1(U.rand(-a, a))}px,${U.r1(U.rand(-a, a))}px,0)`;
        }, signal)
        .catch(() => {})
        .finally(() => (w.style.transform = ''));
    }

    isDarkPage() {
      try {
        const de = document.documentElement;
        if (de.classList.contains('dark') || de.dataset.mode === 'dark' || de.dataset.theme === 'dark') return true;
        const bg = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g);
        if (bg && bg.length >= 3 && !(bg.length >= 4 && Number(bg[3]) === 0)) {
          const [r, g, b] = bg.map(Number);
          return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
        }
      } catch (_) { /* ignore */ }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  }

  WC.Stage = Stage;
})();
