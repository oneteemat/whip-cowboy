/* Whip Cowboy — core/juice.js : game-feel overlays that fire on every crack.
 * Comic onomatopoeia ("KNALL!"), floating damage numbers, and a combo counter.
 * Works with any { stage, clock, scope } (no event ctx needed). */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const U = WC.U, A = WC.art;
  const r1 = A.r1;
  const FONT = 'Impact, "Anton", "Haettenschweiler", "Arial Narrow Bold", "Arial Black", sans-serif';

  function layer(env) {
    if (env._juiceSvg && env._juiceSvg.isConnected) return env._juiceSvg;
    const s = A.svg('svg', { class: 'wc-juice' });
    s.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none';
    env.stage.layers.bubbles.appendChild(s);
    env.scope.add(() => s.remove());
    env._juiceSvg = s;
    return s;
  }

  /** Pop a chunky text at (x, y). o: { size, fill, stroke, rot, rise, ms, drift } */
  function popText(env, x, y, text, o = {}) {
    const s = layer(env);
    const g = A.svg('g', {}, s);
    const t = A.svg('text', {
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      fill: o.fill || '#ffd23f',
      stroke: o.stroke || '#151515',
      'stroke-width': o.strokeW || 6,
      'paint-order': 'stroke',
      'stroke-linejoin': 'round',
      style: `font: ${o.weight || 400} ${o.size || 34}px ${FONT}; letter-spacing: 1px`,
    }, g);
    t.textContent = text;
    const rot = o.rot === undefined ? U.rand(-16, 16) : o.rot;
    const rise = o.rise === undefined ? 28 : o.rise;
    const drift = o.drift || 0;
    const ms = o.ms || 750;
    return env.clock
      .tween(ms, (k) => {
        const sc = U.ease.outBack(Math.min(1, k / 0.25)) * (o.grow ? 1 + k * 0.25 : 1);
        g.setAttribute('transform', `translate(${r1(x + drift * k)} ${r1(y - rise * U.ease.outQuad(k))}) rotate(${r1(rot)}) scale(${r1(sc * 100) / 100})`);
        g.setAttribute('opacity', r1(k < 0.65 ? 1 : (1 - k) / 0.35));
      })
      .catch(() => {})
      .finally(() => g.remove());
  }

  /** Everything that happens when a whip connects. */
  function hit(env, tip, o = {}) {
    if (!tip) return;
    const lang = o.lang || 'de';
    popText(env, tip[0] + U.rand(-10, 10), tip[1] - 18, WC.i18n.line(lang, 'onoma'), { size: o.big ? 52 : 36, ms: 700 });
    const crit = Math.random() < (o.esc ? 0.3 : 0.12);
    const dmg = crit ? 'CRIT! -' + Math.floor(U.rand(120, 999)) : '-' + Math.floor(U.rand(8, 99)) + ' HP';
    popText(env, tip[0] + U.rand(-30, 10), tip[1] + 48, dmg, {
      size: crit ? 30 : 22,
      fill: crit ? '#ff2d2d' : '#ff5b5b',
      strokeW: 5,
      rot: U.rand(-6, 6),
      rise: 70,
      drift: U.rand(-25, 25),
      ms: 1100,
    });
    if (o.combo >= 3) {
      popText(env, o.comboAt[0], o.comboAt[1], `COMBO x${o.combo}`, {
        size: 18 + Math.min(18, o.combo * 1.2),
        fill: o.combo >= 10 ? '#ff2d2d' : '#ffffff',
        rot: -8,
        rise: 16,
        ms: 900,
        grow: true,
      });
    }
  }

  WC.juice = { popText, hit, FONT };

  // Extra bubble styles (injected into the overlay's shadow stylesheet by stage.js).
  (WC.extraCSS = WC.extraCSS || []).push(`
.wc-bubble.dark .wc-bubble-inner { background: #141414; color: #f4f4f4; border-color: #f4f4f4; box-shadow: 0 0 0 3px #141414, 4px 5px 0 rgba(0,0,0,.35); font-style: italic; }
.wc-bubble.shout .wc-bubble-inner { background: #ffe14d; color: #c01818; text-transform: uppercase; font: 400 20px/1.1 ${FONT}; letter-spacing: .5px; transform: rotate(-2.5deg); border-width: 4px; }
.wc-bubble.shout .wc-txt { display: inline-block; animation: wc-jitter .1s steps(2) infinite; }
.wc-bubble-inner { border-width: 3.5px; box-shadow: 4px 5px 0 rgba(0,0,0,.25); }
@media (prefers-reduced-motion: reduce) { .wc-bubble.shout .wc-txt { animation: none !important; } }
`);
})();
