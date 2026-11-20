/* Whip Cowboy — core/creatures.js : hand-drawn horse, T-rex, fighter jet and missile.
 * All share the Sprite base (same coordinate system as StickFigure: origin on the ground,
 * +x = facing direction, placed with a single CSS transform). */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const U = WC.U, A = WC.art;
  const r1 = A.r1, INK = A.INK;
  const D2R = Math.PI / 180;
  const dv = (a) => [Math.sin(a * D2R), Math.cos(a * D2R)];
  const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];

  class Sprite {
    constructor(clock, o = {}) {
      this.clock = clock;
      this.o = o;
      this.x = -400;
      this.y = 0;
      this.dir = 1;
      this.scale = o.scale || 1;
      this.rot = 0;
      this.opacity = 1;
      this.seed = Math.floor(Math.random() * 1000);
      this.el = document.createElement('div');
      this.el.className = 'wc-fig';
      this.svg = A.svg('svg', { class: 'wc-svg', viewBox: '-220 -330 440 380', width: 440, height: 380 });
      this.el.appendChild(this.svg);
      this.mounted = false;
    }
    mount(layer) {
      if (this.mounted) return;
      this.mounted = true;
      layer.appendChild(this.el);
      this._off = this.clock.add((dt, time) => {
        this.update(dt, time);
        this._place();
        this.render(time);
        if (this.rider) this._carry(time);
      });
      this._place();
      this.render(this.clock.time);
    }
    unmount() {
      if (!this.mounted) return;
      this.mounted = false;
      if (this._off) this._off();
      this.el.remove();
    }
    _place() {
      const tr = `translate3d(${r1(this.x)}px,${r1(this.y)}px,0)${this.rot ? ` rotate(${r1(this.rot)}deg)` : ''} scale(${this.dir * this.scale},${this.scale})`;
      if (tr !== this._lt) this.el.style.transform = this._lt = tr;
      if (this.opacity !== this._lo) this.el.style.opacity = String((this._lo = this.opacity));
    }
    toPage(p) {
      return [this.x + this.dir * this.scale * p[0], this.y + this.scale * p[1]];
    }
    update() {}
    render() {}

    // ---- riders ----
    saddle() {
      return [0, -80];
    }
    /** Seat a StickFigure on this creature (it's re-parented above the creature in z-order). */
    attach(fig) {
      this.rider = fig;
      fig.seated = true;
      fig.pose = Object.assign(fig.pose, U.clone(WC.StickFigure.POSES.ride));
      fig.coilWhip();
      if (fig.el.parentNode && this.el.parentNode) this.el.parentNode.appendChild(fig.el);
      this._carry(this.clock.time);
    }
    detach() {
      const f = this.rider;
      this.rider = null;
      if (f) f.seated = false;
      return f;
    }
    _carry(time) {
      const f = this.rider;
      const sp = this.toPage(this.saddle());
      f.dir = this.dir;
      f.x = sp[0];
      f.y = sp[1] + 52 * f.scale;
      if (f.mounted) f.render(time);
    }

    /** Move to page coords; sets this.moving while travelling (drives leg animation). */
    async moveTo(tx, ty, signal, speed = 0.3) {
      const sx = this.x, sy = this.y, dx = tx - sx, dy = ty - sy;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return;
      if (Math.abs(dx) > 2) this.dir = dx > 0 ? 1 : -1;
      this.moving = true;
      this.speed = speed;
      try {
        await this.clock.tween(dist / speed, (t) => {
          this.x = sx + dx * t;
          this.y = sy + dy * t;
        }, signal);
      } finally {
        this.moving = false;
      }
    }
  }

  // ---------------------------------------------------------------- Horse
  class Horse extends Sprite {
    constructor(clock, o = {}) {
      super(clock, o);
      const color = o.color || '#8b5a2b', mane = o.mane || '#3b2412';
      this.phase = 0;
      const s = this.svg;
      const G = (attrs) => A.svg('g', attrs || {}, s);
      const legStyle = (g, far) => ({ fill: 'none', stroke: far ? '#2a2a2a' : INK, 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      this.farLegs = [A.svg('path', legStyle(0, 1), G()), A.svg('path', legStyle(0, 1), G())];
      this.tail = A.svg('path', { fill: 'none', stroke: mane, 'stroke-width': 7, 'stroke-linecap': 'round' }, G());
      this.tailInk = A.svg('path', { fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }, G());
      this.bodyG = G();
      this.body = A.svg('path', { fill: color, stroke: INK, 'stroke-width': 3.4, 'stroke-linejoin': 'round' }, this.bodyG);
      this.neck = A.svg('path', { fill: color, stroke: INK, 'stroke-width': 3.4, 'stroke-linejoin': 'round', d: 'M20 -76 Q30 -94 40 -108 L55 -100 Q46 -82 40 -60 Z' }, this.bodyG);
      this.headG = A.svg('g', {}, this.bodyG);
      A.svg('path', { fill: color, stroke: INK, 'stroke-width': 3.4, 'stroke-linejoin': 'round', d: 'M38 -108 Q50 -120 70 -104 Q79 -96 73 -90 Q62 -86 53 -92 Q45 -96 42 -98 Z' }, this.headG);
      A.svg('path', { fill: color, stroke: INK, 'stroke-width': 2.6, 'stroke-linejoin': 'round', d: 'M43 -110 L45 -121 L50 -110 Z' }, this.headG);
      A.svg('circle', { cx: 53, cy: -105, r: 2, fill: INK }, this.headG);
      A.svg('circle', { cx: 70, cy: -95, r: 1.3, fill: INK }, this.headG);
      A.svg('path', { fill: 'none', stroke: mane, 'stroke-width': 6, 'stroke-linecap': 'round', d: 'M41 -110 Q31 -98 22 -78' }, this.bodyG);
      if (o.saddle !== false) {
        A.svg('path', { fill: o.blanket || '#c0392b', stroke: INK, 'stroke-width': 2.4, 'stroke-linejoin': 'round', d: 'M-16 -80 Q-2 -84 12 -80 L10 -64 Q-2 -61 -14 -64 Z' }, this.bodyG);
      }
      this.nearLegs = [A.svg('path', legStyle(0, 0), G()), A.svg('path', legStyle(0, 0), G())];
      if (o.attitude) {
        // Dead-tired eyes, buck teeth and a cigarette: this horse has seen things.
        const h = this.headG;
        A.svg('path', { d: 'M49.5 -106.8 Q53 -108.6 56.6 -106.4', fill: color, stroke: INK, 'stroke-width': 1.8 }, h);
        A.svg('path', { d: 'M50 -101.8 Q53 -100.2 56 -101.6', fill: 'none', stroke: INK, 'stroke-width': 1, opacity: 0.7 }, h);
        A.svg('path', { d: 'M66 -91 L72.5 -90.6 L72.2 -87.6 L66.2 -88 Z M69.2 -90.8 L69.2 -87.8', fill: '#fff6c9', stroke: INK, 'stroke-width': 1.2 }, h);
        this.cig = A.svg('g', {}, h);
        A.svg('path', { d: 'M71 -88.5 L82 -85.5', stroke: INK, 'stroke-width': 3.4, 'stroke-linecap': 'round' }, this.cig);
        A.svg('path', { d: 'M71 -88.5 L82 -85.5', stroke: '#f4f4f4', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, this.cig);
        A.svg('circle', { cx: 82.6, cy: -85.3, r: 1.3, fill: '#ff5a1f' }, this.cig);
        this.cigSmoke = A.svg('path', { fill: 'none', stroke: 'rgba(150,150,150,.75)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, this.cig);
      }
    }
    bubbleAnchor() {
      return this.toPage([58, -132]);
    }
    saddle() {
      return [-2, -82 - (this.bob || 0)];
    }
    update(dt) {
      if (this.moving) this.phase += dt * 0.0035 * (this.speed / 0.3 + 0.6) * Math.PI * 2 * 0.25;
    }
    render(time) {
      const ph = this.phase, run = this.moving ? 1 : 0;
      this.bob = run ? Math.abs(Math.sin(ph)) * 4 : Math.sin(time / 700) * 0.8;
      const pitch = run ? Math.sin(ph) * 3 : 0;
      this.bodyG.setAttribute('transform', `translate(0 ${r1(-this.bob)}) rotate(${r1(pitch)} 0 -62)`);
      const seed = this.seed + Math.floor(time / 190) * 17;
      if (seed !== this._s) {
        this._s = seed;
        this.body.setAttribute('d', A.wobEllipse(0, -64, 40, 18, seed, 0.04, 10));
      }
      this.headG.setAttribute('transform', `rotate(${r1(run ? Math.sin(ph * 2) * 4 : Math.sin(time / 900) * 2)} 40 -100)`);
      if (this.cigSmoke) {
        const w = time / 240;
        this.cigSmoke.setAttribute('d', `M83 -87 Q${r1(85 + Math.sin(w) * 3)} -93 ${r1(83 + Math.sin(w + 1) * 3)} -98 Q${r1(81 + Math.sin(w + 2) * 4)} -103 ${r1(84 + Math.sin(w + 3) * 4)} -108`);
      }
      const sw = run ? Math.sin(ph) * 10 : Math.sin(time / 500) * 4;
      const td = `M-38 ${r1(-70 - this.bob)} Q${r1(-58 + sw * 0.3)} ${r1(-70 - this.bob)} ${r1(-60 + sw)} ${r1(-38 - this.bob)}`;
      this.tail.setAttribute('d', td);
      this.tailInk.setAttribute('d', td);
      const leg = (hx, off, front) => {
        const hip = [hx, -58 - this.bob];
        const a = run ? 38 * Math.sin(ph + off) : 0;
        const kneeBend = run ? (front ? -1 : 1) * 45 * Math.max(0, Math.sin(ph + off + 1.3)) : 0;
        const k = add(hip, dv(a), 30);
        const f = add(k, dv(a + kneeBend), 28);
        return A.wobLine([hip, k, f], seed + hx, 0.05) + `M${r1(f[0] - 1)} ${r1(f[1])}L${r1(f[0] + 5)} ${r1(f[1])}`;
      };
      this.farLegs[0].setAttribute('d', leg(24, 0.5, true));
      this.farLegs[1].setAttribute('d', leg(-30, Math.PI + 0.5, false));
      this.nearLegs[0].setAttribute('d', leg(30, 0, true));
      this.nearLegs[1].setAttribute('d', leg(-24, Math.PI, false));
    }
  }

  // ---------------------------------------------------------------- T-rex
  /** Capsule-ish tapered limb from p1 (width w1) to p2 (width w2). */
  function limb(p1, p2, w1, w2) {
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const a = [p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2], b = [p2[0] + nx * w2 / 2, p2[1] + ny * w2 / 2];
    const c = [p2[0] - nx * w2 / 2, p2[1] - ny * w2 / 2], d = [p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2];
    const tip = [p2[0] + ux * w2 * 0.8, p2[1] + uy * w2 * 0.8], base = [p1[0] - ux * w1 * 0.6, p1[1] - uy * w1 * 0.6];
    const P = (q) => `${r1(q[0])} ${r1(q[1])}`;
    return `M${P(a)}L${P(b)}Q${P(tip)} ${P(c)}L${P(d)}Q${P(base)} ${P(a)}Z`;
  }
  function ikFwd(a, t, l1, l2) {
    const dx = t[0] - a[0], dy = t[1] - a[1];
    const d = U.clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
    const base = Math.atan2(dy, dx);
    const ang = Math.acos(U.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const k = base - ang;
    return [a[0] + Math.cos(k) * l1, a[1] + Math.sin(k) * l1];
  }

  class TRex extends Sprite {
    constructor(clock, o = {}) {
      super(clock, o);
      const col = (this.col = o.color || '#5fa548');
      const dark = (this.dark = '#3d7a31');
      this.phase = 0;
      this.jaw = 0;
      this.lunge = 0;
      this.rage = 0; // 0..1 arm flailing / head shake
      this._blink = 0;
      this._nextBlink = 2500;
      this.onStep = null;
      const s = this.svg;
      const st = { stroke: INK, 'stroke-width': 3.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
      const legParts = (fill) => {
        const g = A.svg('g', {}, s);
        return {
          thigh: A.svg('path', Object.assign({ fill }, st), g),
          shin: A.svg('path', Object.assign({ fill }, st), g),
          foot: A.svg('path', Object.assign({ fill }, st, { 'stroke-width': 2.6 }), g),
        };
      };
      this.legFar = legParts(dark);
      this.armFarO = A.svg('path', { fill: 'none', stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
      this.armFar = A.svg('path', { fill: 'none', stroke: dark, 'stroke-width': 3.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
      this.bodyG = A.svg('g', {}, s);
      this.spikes = A.svg('path', Object.assign({ fill: dark }, st, { 'stroke-width': 2.2 }), this.bodyG);
      this.body = A.svg('path', Object.assign({ fill: col }, st), this.bodyG);
      A.svg('path', { fill: 'none', stroke: '#cfe6a8', 'stroke-width': 8, 'stroke-linecap': 'round', d: 'M-58 -100 Q-12 -84 44 -104' }, this.bodyG);
      A.svg('path', { fill: 'none', stroke: dark, 'stroke-width': 5, 'stroke-linecap': 'round', d: 'M-96 -146 Q-92 -138 -96 -130 M-62 -152 Q-57 -142 -62 -130 M-28 -164 Q-23 -152 -28 -140 M4 -166 Q9 -153 4 -142 M30 -160 Q34 -150 30 -142' }, this.bodyG);
      // head (pivot at the neck)
      this.headG = A.svg('g', {}, this.bodyG);
      A.svg('path', { fill: '#4a0d0d', d: 'M-2 6 L57 4 L50 15 L0 16 Z' }, this.headG); // mouth interior
      this.jawG = A.svg('g', {}, this.headG);
      A.svg('path', { fill: 'none', stroke: '#c0392b', 'stroke-width': 4, 'stroke-linecap': 'round', d: 'M2 11 Q22 6 40 12' }, this.jawG);
      A.svg('path', { fill: '#fffbe8', stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round', d: 'M8 6 L11 0 L14 6 L17 0 L20 6 L23 0 L26 6 L29 0 L32 6 L35 0 L38 6 L41 0 L44 6 L47 1 L50 6 Z' }, this.jawG);
      A.svg('path', Object.assign({ fill: col, d: 'M-10 6 L58 5 Q61 14 50 20 Q20 25 -6 21 Q-13 14 -10 6 Z' }, st), this.jawG);
      A.svg('path', { fill: '#fffbe8', stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round', d: 'M4 5 L7 12 L10 5 L13 12 L16 5 L19 12 L22 5 L25 12 L28 5 L31 12 L34 5 L37 12 L40 5 L43 11 L46 4 L49 10 L52 4 Z' }, this.headG);
      A.svg('path', Object.assign({ fill: col, d: 'M-12 8 Q-19 -20 10 -29 Q47 -35 67 -16 Q73 -4 62 4 Q30 9 -12 8 Z' }, st), this.headG);
      A.svg('path', { fill: 'none', stroke: dark, 'stroke-width': 4, 'stroke-linecap': 'round', d: 'M-4 -18 Q4 -24 12 -22' }, this.headG);
      A.svg('circle', { cx: 20, cy: -13, r: 5.6, fill: '#fff6b0', stroke: INK, 'stroke-width': 2.2 }, this.headG);
      this.pupil = A.svg('path', { d: 'M21.6 -17.6 L21.6 -8.4', stroke: INK, 'stroke-width': 3.2, 'stroke-linecap': 'round' }, this.headG); // reptile slit
      this.lid = A.svg('path', { fill: col, stroke: INK, 'stroke-width': 2, d: 'M13.8 -13 Q20 -21 26.2 -13 Q20 -9 13.8 -13 Z', style: 'display:none' }, this.headG);
      A.svg('path', { fill: 'none', stroke: INK, 'stroke-width': 4.4, 'stroke-linecap': 'round', d: 'M9 -24 L31 -18' }, this.headG); // angry brow
      A.svg('path', { fill: 'none', stroke: INK, 'stroke-width': 1.6, 'stroke-linecap': 'round', d: 'M34 -27 L42 -10 M34.5 -21.5 L40 -22.5 M36.5 -16 L41.5 -17' }, this.headG); // scar
      A.svg('path', { fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round', d: 'M56 -19 q3 -1.5 5 1' }, this.headG);
      this.legNear = legParts(col);
      this.armNearO = A.svg('path', { fill: 'none', stroke: INK, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
      this.armNear = A.svg('path', { fill: 'none', stroke: col, 'stroke-width': 3.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s);
    }
    saddle() {
      return [-22, -168 - (this.bob || 0)];
    }
    bubbleAnchor() {
      return this.toPage([96 + this.lunge * 28, -214 - (this.bob || 0)]);
    }
    /** Page point at the front of the mouth. */
    mouthPage() {
      return this.toPage([66 + this.lunge * 30 + 56, -170 + this.lunge * 16 + 8 - (this.bob || 0)]);
    }
    update(dt) {
      this._nextBlink -= dt;
      if (this._nextBlink <= 0) {
        this._blink = 140;
        this._nextBlink = U.rand(2000, 4500);
      }
      if (this._blink > 0) this._blink -= dt;
      if (this.moving) {
        const prev = this.phase;
        this.phase += dt * 0.0040 * (this.speed / 0.14);
        if (this.onStep && Math.floor(prev / Math.PI) !== Math.floor(this.phase / Math.PI)) this.onStep(this.phase);
      }
    }
    _body(sway) {
      const ty = -150 + sway * 16;
      return `M-182 ${r1(ty)} Q-124 ${r1(-153 + sway * 7)} -68 -151 Q-26 -173 24 -163 Q48 -161 62 -173 L82 -150 Q76 -118 54 -100 Q30 -80 -12 -84 Q-50 -88 -76 -120 Q-126 -138 -182 ${r1(ty)} Z`;
    }
    render(time) {
      const ph = this.phase, mv = !!this.moving;
      const bob = (this.bob = mv ? Math.abs(Math.cos(ph)) * 7 : Math.sin(time / 900) * 1.6);
      const sway = Math.sin(time / (mv ? 260 : 700)) * (mv ? 1 : 0.5);
      const shake = this.rage ? Math.sin(time / 30) * 2.5 * this.rage : 0;
      this.bodyG.setAttribute('transform', `translate(0 ${r1(-bob)}) rotate(${r1((mv ? Math.sin(ph) * 2 : 0) + shake * 0.4)} -10 -120)`);
      this.body.setAttribute('d', this._body(sway));
      if (!this._sp || Math.abs(this._sp - sway) > 0.08) {
        this._sp = sway;
        let d = '';
        for (const [x, y] of [[-150, -151 + sway * 9], [-124, -152 + sway * 6], [-98, -152 + sway * 3], [-72, -153], [-46, -162], [-20, -170], [6, -169], [32, -164]]) {
          d += `M${x - 7} ${r1(y + 3)}L${x} ${r1(y - 11)}L${x + 7} ${r1(y + 3)}Z`;
        }
        this.spikes.setAttribute('d', d);
      }
      const L = this.lunge;
      this.headG.setAttribute('transform', `translate(${r1(66 + L * 30)} ${r1(-170 + L * 16)}) rotate(${r1(-this.jaw * 0.38 + L * 14 + shake)})`);
      this.jawG.setAttribute('transform', `rotate(${r1(this.jaw)} -8 6)`);
      const bl = this._blink > 0;
      if (bl !== this._bl) {
        this._bl = bl;
        this.lid.style.display = bl ? '' : 'none';
      }
      // legs
      const S = 40, LIFT = 30;
      const foot = (p) => {
        const q = ((p % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        return q < Math.PI ? [-12 + S * Math.cos(q), 0] : [-12 + S * Math.cos(q), -LIFT * Math.sin(q - Math.PI)];
      };
      const leg = (parts, f) => {
        const hip = [-14, -112 - bob];
        const ankle = [f[0] - 6, f[1] - 12];
        const knee = ikFwd(hip, ankle, 56, 58);
        parts.thigh.setAttribute('d', limb(hip, knee, 40, 22));
        parts.shin.setAttribute('d', limb(knee, ankle, 18, 11));
        const [x, y] = [f[0], f[1]];
        parts.foot.setAttribute('d', `M${r1(x - 14)} ${r1(y - 14)} Q${r1(x - 2)} ${r1(y - 16)} ${r1(x + 8)} ${r1(y - 8)} L${r1(x + 26)} ${r1(y - 3)} L${r1(x + 27)} ${r1(y)} L${r1(x + 16)} ${r1(y)} L${r1(x + 18)} ${r1(y + 0.5)} L${r1(x + 4)} ${r1(y)} L${r1(x - 16)} ${r1(y)} Z`);
      };
      leg(this.legFar, mv ? foot(ph + Math.PI) : [6, 0]);
      leg(this.legNear, mv ? foot(ph) : [-30, 0]);
      // tiny useless arms
      const arm = (sx, sy, k) => {
        const w = Math.sin(time / (this.rage ? 45 : 380) + k) * (this.rage ? 10 : 3);
        const sh = [sx, sy - bob], el = [sx + 11, sy + 8 + w - bob], hd = [sx + 20, sy + 4 + w * 1.3 - bob];
        return `M${r1(sh[0])} ${r1(sh[1])}L${r1(el[0])} ${r1(el[1])}L${r1(hd[0])} ${r1(hd[1])}M${r1(hd[0])} ${r1(hd[1])}l4 3M${r1(hd[0])} ${r1(hd[1])}l5 -1`;
      };
      const aF = arm(40, -114, 1.3), aN = arm(48, -108, 0);
      this.armFarO.setAttribute('d', aF);
      this.armFar.setAttribute('d', aF);
      this.armNearO.setAttribute('d', aN);
      this.armNear.setAttribute('d', aN);
    }
    async roar(signal, ms = 1100) {
      await this.clock.tween(200, (t) => (this.jaw = 42 * t), signal, U.ease.outQuad);
      this.rage = 1;
      await this.clock.tween(ms, (t) => (this.jaw = 42 + Math.sin(t * 50) * 3), signal);
      this.rage = 0;
      await this.clock.tween(240, (t) => (this.jaw = 42 * (1 - t)), signal);
    }
    /** Lunge forward and snap the jaws shut. onChomp(mouthPagePoint) fires on the snap. */
    async chomp(signal, onChomp) {
      await this.clock.tween(240, (t) => {
        this.lunge = t;
        this.jaw = 36 * t;
      }, signal, U.ease.outQuad);
      await this.clock.tween(80, (t) => (this.jaw = 36 * (1 - t)), signal, U.ease.inQuad);
      if (onChomp) onChomp(this.mouthPage());
      await this.clock.tween(320, (t) => (this.lunge = 1 - t), signal, U.ease.inOut);
    }
  }

  // ---------------------------------------------------------------- Jet & missile
  class Jet extends Sprite {
    constructor(clock, o = {}) {
      super(clock, o);
      const s = this.svg;
      const st = { stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
      this.lines = A.svg('path', { fill: 'none', stroke: 'rgba(40,40,40,.45)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, s);
      this.flame = A.svg('path', { fill: '#ff8a1c', stroke: '#e8341c', 'stroke-width': 2 }, s);
      A.svg('path', Object.assign({ fill: '#7d8794', d: 'M-12 -4 L-48 -46 L-30 -47 L18 -6 Z' }, st), s);
      A.svg('path', Object.assign({ fill: '#7d8794', d: 'M-58 -4 L-78 -34 L-64 -35 L-42 -6 Z' }, st), s);
      A.svg('path', Object.assign({ fill: '#9aa4b1', d: 'M-74 0 Q-66 -11 28 -10 Q66 -9 92 0 Q66 9 28 10 Q-66 11 -74 0 Z' }, st), s);
      A.svg('path', Object.assign({ fill: '#7d8794', d: 'M-10 4 L-44 40 L-26 41 L20 6 Z' }, st), s);
      A.svg('path', Object.assign({ fill: '#7fd0ff', d: 'M28 -9 Q44 -22 62 -6 Z' }, st), s);
      A.svg('path', { fill: 'none', stroke: '#c0392b', 'stroke-width': 3, d: 'M-50 0 L10 0' }, s);
      A.svg('circle', { cx: -26, cy: -24, r: 5, fill: '#fff', stroke: INK, 'stroke-width': 2 }, s);
      A.svg('circle', { cx: -26, cy: -24, r: 2, fill: '#c0392b' }, s);
    }
    tail() {
      return this.toPage([-78, 0]);
    }
    render(time) {
      const f = 14 + Math.sin(time / 30) * 6;
      this.flame.setAttribute('d', `M-74 -5 L${r1(-74 - f)} 0 L-74 5 Z`);
      this.lines.setAttribute('d', 'M-90 -16 L-150 -16 M-95 0 L-185 0 M-90 16 L-140 16 M-60 -40 L-110 -40');
    }
  }

  class Missile extends Sprite {
    constructor(clock, o = {}) {
      super(clock, o);
      const s = this.svg;
      const st = { stroke: INK, 'stroke-width': 2.4, 'stroke-linejoin': 'round' };
      this.flame = A.svg('path', { fill: '#ffd23f', stroke: '#ff8a1c', 'stroke-width': 1.6 }, s);
      A.svg('path', Object.assign({ fill: '#2e8b3e', d: 'M-22 -5 L-30 -12 L-24 -12 L-14 -5 Z M-22 5 L-30 12 L-24 12 L-14 5 Z' }, st), s);
      A.svg('path', Object.assign({ fill: '#3fae4f', d: 'M-24 -5 L14 -5 Q26 -5 30 0 Q26 5 14 5 L-24 5 Z' }, st), s);
      A.svg('path', { fill: 'none', stroke: '#f5c518', 'stroke-width': 2.2, d: 'M4 -5 L4 5' }, s);
    }
    tail() {
      return this.toPage([-26, 0]);
    }
    render(time) {
      const f = 9 + Math.sin(time / 25) * 4;
      this.flame.setAttribute('d', `M-24 -3 L${r1(-24 - f)} 0 L-24 3 Z`);
    }
  }

  /** WWII-style dive bomber: gull wings, fixed spatted gear, spinning prop. No insignia. */
  class DiveBomber extends Sprite {
    constructor(clock, o = {}) {
      super(clock, o);
      const s = this.svg;
      const st = { stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
      const body = '#6f7a64', dark = '#56604d';
      A.svg('path', Object.assign({ fill: dark, d: 'M-64 -4 L-78 -30 L-64 -31 L-48 -7 Z' }, st), s);
      A.svg('path', Object.assign({ fill: 'none', d: 'M4 8 L-2 30 M16 8 L12 30' }, st), s);
      A.svg('path', Object.assign({ fill: dark, d: 'M-8 24 Q-1 17 8 24 Q9 34 0 34 Q-9 34 -8 24 Z' }, st), s);
      A.svg('path', Object.assign({ fill: body, d: 'M-74 -1 Q-62 -10 6 -12 Q40 -13 54 -5 L54 7 Q30 11 -64 6 Z' }, st), s);
      A.svg('path', Object.assign({ fill: '#a8d4e6', d: 'M-26 -11 Q-4 -26 26 -12 Z' }, st), s);
      A.svg('path', { fill: 'none', stroke: INK, 'stroke-width': 1.6, d: 'M-14 -12 L-12 -19 M0 -12 L0 -21 M13 -12 L11 -18' }, s);
      A.svg('path', Object.assign({ fill: dark, d: 'M-12 1 L-34 20 Q-14 25 12 21 L20 3 Z' }, st), s);
      A.svg('path', Object.assign({ fill: dark, d: 'M-68 2 L-84 7 L-62 7 Z' }, st), s);
      A.svg('path', { fill: 'none', stroke: 'rgba(30,30,30,.35)', 'stroke-width': 7, 'stroke-linecap': 'round', d: 'M-40 -6 Q-30 -9 -20 -6 M30 -6 Q38 -8 46 -4' }, s);
      A.svg('circle', Object.assign({ cx: 13, cy: 30, r: 3, fill: '#999' }, st, { 'stroke-width': 1.6 }), s); // the siren
      this.prop = A.svg('ellipse', { cx: 58, cy: 1, rx: 3, ry: 24, fill: 'rgba(70,70,70,.35)', stroke: 'rgba(30,30,30,.5)', 'stroke-width': 1.2 }, s);
      this.blade = A.svg('path', { d: 'M58 -22 L58 24', stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }, s);
      A.svg('path', Object.assign({ fill: '#3a3a3a', d: 'M54 -6 L66 1 L54 8 Z' }, st), s);
    }
    tail() {
      return this.toPage([-72, 2]);
    }
    render(time) {
      const k = Math.cos(time / 18);
      this.blade.setAttribute('d', `M58 ${r1(-22 * k)} L58 ${r1(24 * k)}`);
    }
  }

  class Bomb extends Sprite {
    constructor(clock, o = {}) {
      super(clock, o);
      const st = { stroke: INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' };
      A.svg('path', Object.assign({ fill: '#3a3a3a', d: 'M-14 -5 L-21 -11 L-21 11 L-14 5 Z' }, st), this.svg);
      A.svg('path', Object.assign({ fill: '#222', d: 'M-15 -6 L6 -6 Q18 -6 20 0 Q18 6 6 6 L-15 6 Z' }, st), this.svg);
      A.svg('path', { fill: 'none', stroke: '#c9a25a', 'stroke-width': 2, d: 'M2 -6 L2 6' }, this.svg);
    }
    tail() {
      return this.toPage([-18, 0]);
    }
  }

  WC.DiveBomber = DiveBomber;
  WC.Bomb = Bomb;
  WC.Sprite = Sprite;
  WC.Horse = Horse;
  WC.TRex = TRex;
  WC.Jet = Jet;
  WC.Missile = Missile;
})();
