/* Whip Cowboy — core/fx.js : reusable visual effects for event modules.
 * Every function takes the event ctx; elements are tied to ctx.scope (removed on abort/quit) and
 * long-running effects are registered with ctx.bg() so the event waits for them before ending. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const U = WC.U, A = WC.art;
  const r1 = A.r1;

  /** Lightweight particle system: puffs (smoke/dust), sparks (streaks), debris (tumbling bits). */
  function particles(ctx, layer = 'fx') {
    if (ctx._ps && ctx._ps[layer]) return ctx._ps[layer];
    const svg = ctx.svgEl(layer);
    const list = [];
    const off = ctx.clock.add((dt) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        const t = p.age / p.life;
        if (t >= 1) {
          p.el.remove();
          list.splice(i, 1);
          continue;
        }
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'puff') {
          const r = p.r0 + (p.r1 - p.r0) * U.ease.outQuad(t);
          p.el.setAttribute('transform', `translate(${r1(p.x)} ${r1(p.y)}) scale(${r1(r) / 10})`);
          p.el.setAttribute('opacity', r1((1 - t) * p.a * 100) / 100);
        } else if (p.kind === 'spark') {
          const len = p.len;
          const sp = Math.hypot(p.vx, p.vy) || 1;
          p.el.setAttribute('d', `M${r1(p.x)} ${r1(p.y)}L${r1(p.x - (p.vx / sp) * len)} ${r1(p.y - (p.vy / sp) * len)}`);
          p.el.setAttribute('opacity', r1(1 - t * t));
        } else {
          p.rot += p.vr * dt;
          p.el.setAttribute('transform', `translate(${r1(p.x)} ${r1(p.y)}) rotate(${r1(p.rot)})`);
          p.el.setAttribute('opacity', r1(t < 0.7 ? 1 : (1 - t) / 0.3));
        }
      }
    });
    ctx.scope.add(off);
    const api = {
      puff(x, y, o = {}) {
        const el = A.svg('path', { d: A.wobCircle(0, 0, 10, Math.random() * 99, 0.12, 7), fill: o.color || '#d8d8d8', stroke: o.stroke || 'rgba(60,60,60,.55)', 'stroke-width': 1.2 }, svg);
        list.push({ kind: 'puff', el, x, y, vx: o.vx || U.rand(-0.01, 0.01), vy: o.vy === undefined ? -0.02 : o.vy, r0: o.r0 || 6, r1: o.r1 || 22, a: o.alpha || 0.85, life: o.life || 900, age: 0 });
      },
      spark(x, y, o = {}) {
        const el = A.svg('path', { stroke: o.color || '#ffd23f', 'stroke-width': o.width || 3, 'stroke-linecap': 'round', fill: 'none' }, svg);
        list.push({ kind: 'spark', el, x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g || 0, len: o.len || 10, life: o.life || 500, age: 0 });
      },
      debris(x, y, o = {}) {
        const s = o.size || 6;
        const el = A.svg('path', { d: `M${-s} ${-s * 0.6}L${s} ${-s * 0.3}L${s * 0.4} ${s}L${-s * 0.7} ${s * 0.5}Z`, fill: o.color || '#ff8a1c', stroke: A.INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round' }, svg);
        list.push({ kind: 'debris', el, x, y, vx: o.vx || 0, vy: o.vy || 0, g: o.g === undefined ? 0.0012 : o.g, rot: U.rand(0, 360), vr: U.rand(-0.6, 0.6), life: o.life || 900, age: 0 });
      },
      get count() {
        return list.length;
      },
    };
    ctx._ps = ctx._ps || {};
    ctx._ps[layer] = api;
    return api;
  }

  /** Cartoon starburst explosion with debris and smoke. */
  function explosion(ctx, x, y, o = {}) {
    const size = o.size || 1;
    const reduced = ctx.reduced();
    const svg = ctx.svgEl('fx');
    const g = A.svg('g', {}, svg);
    const seed = Math.random() * 100;
    const R = 70 * size;
    [['#e8341c', 1], ['#ff8a1c', 0.74], ['#ffd23f', 0.48], ['#fff8dc', 0.22]].forEach(([c, k], i) =>
      A.svg('path', { d: A.star(0, 0, R * k, R * k * 0.55, 11 + i, seed + i, 0.3), fill: c, stroke: i === 0 ? A.INK : 'none', 'stroke-width': 3, 'stroke-linejoin': 'round' }, g)
    );
    const ps = particles(ctx);
    const n = reduced ? 5 : Math.round(14 * size);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(0.25, 0.6) * Math.sqrt(size);
      ps.debris(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.25, color: U.pick(['#e8341c', '#ff8a1c', '#ffd23f', '#555']), size: U.rand(3, 7) * Math.sqrt(size), life: U.rand(700, 1100) });
      if (!reduced) ps.spark(x, y, { vx: Math.cos(a) * sp * 1.3, vy: Math.sin(a) * sp * 1.3, len: 16 * size, life: 350, color: U.pick(['#ffd23f', '#fff'], 0) });
    }
    ctx.scope.timeout(() => {
      for (let i = 0; i < (reduced ? 3 : 7); i++) ps.puff(x + U.rand(-30, 30) * size, y + U.rand(-20, 20) * size, { r0: 10 * size, r1: U.rand(30, 48) * size, life: U.rand(900, 1500), vy: -0.03, color: U.pick(['#cfcfcf', '#b9b9b9', '#e2e2e2']) });
    }, 180);
    return ctx.bg(
      ctx.tween(o.ms || 850, (t) => {
        const sc = U.ease.outBack(Math.min(1, t / 0.22)) * (1 + 0.2 * t);
        g.setAttribute('transform', `translate(${r1(x)} ${r1(y)}) scale(${r1(sc * 100) / 100}) rotate(${r1(t * 25)})`);
        g.setAttribute('opacity', r1(t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5));
      }).finally(() => svg.remove())
    );
  }

  /** Full-screen color flash. */
  function flash(ctx, color = 'rgba(255,255,255,.7)', ms = 250) {
    if (ctx.reduced()) ms = Math.min(ms, 150);
    const d = ctx.el('div', '', 'fx');
    d.style.cssText = `position:absolute;inset:0;background:${color};pointer-events:none`;
    return ctx.bg(ctx.tween(ms, (t) => (d.style.opacity = String(1 - t))).finally(() => d.remove()));
  }

  /** Full-screen tint layer with in()/out() helpers. */
  function tint(ctx, background, layer = 'back') {
    const d = ctx.el('div', '', layer);
    d.style.cssText = `position:absolute;inset:0;background:${background};opacity:0;pointer-events:none`;
    return {
      el: d,
      in: (ms = 600, to = 1) => ctx.tween(ms, (t) => (d.style.opacity = String(t * to))),
      out: (ms = 600) => {
        const from = Number(d.style.opacity) || 1;
        return ctx.tween(ms, (t) => (d.style.opacity = String(from * (1 - t))));
      },
    };
  }

  /** Spider-web glass cracks radiating from (cx, cy), drawn with stroke-dashoffset.
   *  o: { radius, rays, rings, drawMs, holdMs, fadeMs, shatter } — shatter makes the glass fall away in shards. */
  function cracks(ctx, cx, cy, o = {}) {
    const vw = ctx.stage.vw, vh = ctx.stage.vh;
    const R = o.radius || Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy)) * 1.05;
    const rays = o.rays || 14, rings = o.rings || 6;
    const svg = ctx.svgEl('fx');
    // geometry
    const step = (Math.PI * 2) / rays;
    const base = Math.random() * step;
    const P = [];
    for (let i = 0; i < rays; i++) {
      const a0 = base + i * step + U.rand(-0.35, 0.35) * step;
      const row = [[cx, cy]];
      for (let k = 1; k <= rings; k++) {
        const r = R * Math.pow(k / rings, 1.45) * (k === rings ? 1.15 : U.rand(0.85, 1.12));
        const a = a0 + U.rand(-0.09, 0.09);
        row.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      P.push(row);
    }
    const pts = (arr) => arr.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L');
    const glass = A.svg('g', {}, svg);
    const lines = A.svg('g', {}, svg);
    const mk = (d, cls) => {
      const dark = A.svg('path', { d, fill: 'none', stroke: 'rgba(25,25,30,.78)', 'stroke-width': 1.7, 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, lines);
      const lite = A.svg('path', { d, fill: 'none', stroke: 'rgba(255,255,255,.9)', 'stroke-width': 1.1, 'stroke-linejoin': 'round', transform: 'translate(1.2 1)', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, lines);
      return { dark, lite, cls };
    };
    const rayPaths = P.map((row) => mk('M' + pts(row)));
    const ringPaths = [];
    for (let k = 1; k < rings; k++) {
      let d = '';
      for (let i = 0; i < rays; i++) {
        if (Math.random() < (o.shatter ? 0 : 0.18)) continue; // a web has gaps
        const p1 = P[i][k], p2 = P[(i + 1) % rays][k];
        const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
        const qx = cx + (mx - cx) * 0.9, qy = cy + (my - cy) * 0.9;
        d += `M${r1(p1[0])} ${r1(p1[1])}Q${r1(qx)} ${r1(qy)} ${r1(p2[0])} ${r1(p2[1])}`;
      }
      if (d) ringPaths.push({ k, p: mk(d) });
    }
    // impact hole
    A.svg('path', { d: A.star(cx, cy, 14, 6, 9, Math.random() * 50, 0.4), fill: 'rgba(255,255,255,.85)', stroke: 'rgba(25,25,30,.8)', 'stroke-width': 1.5 }, lines);

    const drawMs = o.drawMs || 700, holdMs = o.holdMs === undefined ? 2500 : o.holdMs, fadeMs = o.fadeMs || 600;
    const setOff = (pp, v) => {
      pp.dark.setAttribute('stroke-dashoffset', v);
      pp.lite.setAttribute('stroke-dashoffset', v);
    };
    ctx.sfx.play('glass');
    const run = (async () => {
      await ctx.tween(drawMs, (t) => {
        const tr = U.ease.outCubic(t);
        for (const rp of rayPaths) setOff(rp, r1((1 - tr) * 100) / 100);
        for (const { k, p } of ringPaths) {
          const start = (k / rings) * 0.75;
          const lt = U.clamp((t - start) / 0.3, 0, 1);
          setOff(p, r1((1 - lt) * 100) / 100);
        }
      });
      await ctx.wait(holdMs);
      if (!o.shatter) {
        await ctx.tween(fadeMs, (t) => (svg.style.opacity = String(1 - t)));
        return;
      }
      // Shatter: build shard polygons from the web cells; they fall and spin away.
      lines.remove();
      const shards = [];
      for (let i = 0; i < rays; i++) {
        for (let k = 0; k < rings; k++) {
          const a = P[i][k], b = P[(i + 1) % rays][k], c = P[(i + 1) % rays][k + 1], d = P[i][k + 1];
          const poly = k === 0 ? [a, c, d] : [a, b, c, d];
          const gx = poly.reduce((s, p) => s + p[0], 0) / poly.length, gy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
          const el = A.svg('path', {
            d: 'M' + poly.map((p) => `${r1(p[0] - gx)} ${r1(p[1] - gy)}`).join('L') + 'Z',
            fill: o.shardFill || 'rgba(200,225,255,.16)',
            stroke: 'rgba(255,255,255,.85)',
            'stroke-width': 1.4,
            transform: `translate(${r1(gx)} ${r1(gy)})`,
          }, glass);
          const dist = Math.hypot(gx - cx, gy - cy) / R;
          shards.push({ el, gx, gy, delay: dist * 0.35 + Math.random() * 0.12, vx: (gx - cx) / R * 0.25 + U.rand(-0.05, 0.05), vr: U.rand(-0.25, 0.25) });
        }
      }
      ctx.sfx.play('glass');
      const T = o.fallMs || 1700;
      await ctx.tween(T, (t) => {
        const ms = t * T;
        for (const s of shards) {
          const lt = Math.max(0, ms - s.delay * T) ;
          const y = 0.0011 * lt * lt;
          s.el.setAttribute('transform', `translate(${r1(s.gx + s.vx * lt)} ${r1(s.gy + y)}) rotate(${r1(s.vr * lt)})`);
          s.el.setAttribute('opacity', r1(U.clamp(1 - lt / (T * 0.7), 0, 1)));
        }
      });
    })().finally(() => svg.remove());
    return ctx.bg(run);
  }

  /** Big hand-drawn text in the middle of the screen (countdown etc.). */
  function bigText(ctx, text, o = {}) {
    const svg = ctx.svgEl('fx');
    const x = o.x || ctx.stage.vw / 2, y = o.y || ctx.stage.vh * 0.42;
    const tx = A.svg('text', {
      x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      fill: o.color || '#ffd23f', stroke: A.INK, 'stroke-width': 7, 'paint-order': 'stroke', 'stroke-linejoin': 'round',
      style: `font: 900 ${o.size || 170}px "Comic Sans MS","Chalkboard SE","Marker Felt",cursive`,
    }, svg);
    tx.textContent = text;
    const ms = o.ms || 800;
    return ctx.bg(
      ctx.tween(ms, (t) => {
        const sc = U.ease.outBack(Math.min(1, t / 0.3));
        const wob = Math.sin(t * 40) * 3 * (1 - t);
        tx.setAttribute('transform', `translate(${r1(x)} ${r1(y)}) scale(${r1(sc * 100) / 100}) rotate(${r1(wob - 4)})`);
        tx.setAttribute('opacity', r1(t < 0.75 ? 1 : (1 - t) / 0.25));
      }).finally(() => svg.remove())
    );
  }

  /** Glowing aura behind a figure (figure-local coords). Returns { set(level 0..1) }. */
  function glow(ctx, fig, color = '#ff9a1c') {
    const id = 'wcglow' + Math.floor(Math.random() * 1e9);
    const g = A.svg('g', {}, fig.back);
    g.innerHTML = `<defs><radialGradient id="${id}"><stop offset="0" stop-color="#fff6c8" stop-opacity=".95"/><stop offset=".35" stop-color="${color}" stop-opacity=".7"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>`;
    const c = A.svg('circle', { cx: 0, cy: -70, r: 1, fill: `url(#${id})` }, g);
    const ring = A.svg('circle', { cx: 0, cy: -70, r: 1, fill: 'none', stroke: '#ffd23f', 'stroke-width': 3, 'stroke-dasharray': '6 9' }, g);
    ctx.scope.add(() => g.remove());
    return {
      set(level) {
        const r = 20 + 95 * level;
        c.setAttribute('r', r1(r * U.rand(0.95, 1.05)));
        c.setAttribute('opacity', r1(Math.min(1, level * 1.3)));
        ring.setAttribute('r', r1(r * 0.75));
        ring.setAttribute('opacity', r1(level * 0.8));
        ring.setAttribute('transform', `rotate(${r1(ctx.clock.time / 6)} 0 -70)`);
      },
      remove: () => g.remove(),
    };
  }

  /** Cowboy talks into his walkie-talkie: "Hier Peitsche-1, bitte kommen." */
  async function radioCall(ctx, fig = ctx.cowboy) {
    fig.held = 'radio';
    fig.face.mouth = 'shout';
    await fig.poseTo(WC.StickFigure.POSES.radio, 260, ctx.signal);
    ctx.sfx.play('radio');
    ctx.say(fig, ctx.line('radio'), { ms: 2200 });
    for (let i = 0; i < 4; i++) {
      fig.face.mouth = i % 2 ? 'o' : 'shout';
      await ctx.wait(260);
    }
    await ctx.wait(900);
    ctx.sfx.play('radio');
    fig.held = null;
    fig.face.mouth = 'grin';
    await fig.poseTo(WC.StickFigure.POSES.stand, 220, ctx.signal);
  }

  /** Jump a figure along an arc to page point (x, y). */
  function jumpTo(ctx, fig, x, y, ms = 420, height = 70) {
    const sx = fig.x, sy = fig.y;
    if (Math.abs(x - sx) > 2) fig.dir = x > sx ? 1 : -1;
    return ctx.tween(ms, (t) => {
      fig.x = U.lerp(sx, x, t);
      fig.y = U.lerp(sy, y, t) - Math.sin(t * Math.PI) * height;
    }, U.ease.inOut);
  }

  /** Jagged bite marks (upper + lower tooth arcs) that fade after a few seconds. */
  function biteMark(ctx, x, y, o = {}) {
    const svg = ctx.svgEl('fx');
    const R = o.r || 34;
    const arc = (cy, from, to) => {
      let d = '';
      const n = 11;
      for (let i = 0; i <= n; i++) {
        const a = from + ((to - from) * i) / n;
        const r = i % 2 ? R - 8 : R;
        d += (i ? 'L' : 'M') + r1(x + Math.cos(a) * r) + ' ' + r1(cy + Math.sin(a) * r * 0.55);
      }
      return d;
    };
    const d = arc(y - 6, Math.PI * 1.05, Math.PI * 1.95) + arc(y + 6, Math.PI * 0.05, Math.PI * 0.95);
    A.svg('path', { d, fill: 'none', stroke: 'rgba(255,255,255,.9)', 'stroke-width': 5, 'stroke-linejoin': 'round' }, svg);
    A.svg('path', { d, fill: 'none', stroke: 'rgba(25,25,30,.85)', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, svg);
    return ctx.bg(
      ctx.wait(o.hold || 2600).then(() => ctx.tween(600, (t) => (svg.style.opacity = String(1 - t)))).finally(() => svg.remove())
    );
  }

  /** A flaming meteor from (x0,y0) to (x1,y1); resolves on impact. */
  async function meteor(ctx, x0, y0, x1, y1, ms = 900) {
    const svg = ctx.svgEl('fx');
    const g = A.svg('g', {}, svg);
    const ang = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    A.svg('path', { d: A.star(-18, 0, 40, 18, 9, 7, 0.35), fill: '#ff8a1c', stroke: '#e8341c', 'stroke-width': 2 }, g);
    A.svg('path', { d: A.star(-10, 0, 24, 12, 8, 3, 0.3), fill: '#ffd23f' }, g);
    A.svg('path', { d: A.wobCircle(6, 0, 15, 4, 0.18, 8), fill: '#5b4234', stroke: INKC, 'stroke-width': 3 }, g);
    A.svg('path', { d: 'M0 -5 l4 3 M9 4 l3 -2 M3 7 h.1', stroke: INKC, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    const ps = particles(ctx);
    ctx.sfx.play('whoosh', { ms });
    try {
      await ctx.tween(ms, (t) => {
        const x = U.lerp(x0, x1, t), y = U.lerp(y0, y1, t);
        g.setAttribute('transform', `translate(${r1(x)} ${r1(y)}) rotate(${r1(ang)})`);
        if (!ctx.reduced() && Math.random() < 0.8) ps.puff(x - Math.cos((ang * Math.PI) / 180) * 30, y - Math.sin((ang * Math.PI) / 180) * 30, { r0: 8, r1: U.rand(22, 36), life: 900, vy: -0.01, color: U.pick(['#ff9a3d', '#ffcf4a', '#9a9a9a', '#777']) });
      }, U.ease.inQuad);
    } finally {
      svg.remove();
    }
  }
  const INKC = A.INK;

  WC.fx = { particles, explosion, flash, tint, cracks, bigText, glow, radioCall, jumpTo, biteMark, meteor };
})();
