/* Whip Cowboy — core/figure.js
 * StickFigure: a poseable, hand-drawn SVG stick figure with an optional whip.
 * Used for the cowboy and (later) reinforcements / the rival. Coordinates are local:
 * origin = between the feet, +x = the direction he faces, +y = down. The whole figure is
 * placed/flipped/scaled with one CSS transform on its wrapper (compositor-friendly). */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const U = WC.U, A = WC.art;
  const D2R = Math.PI / 180;
  const N = 16; // whip segments
  const WHIP_LEN = 140;
  const dv = (a) => [Math.sin(a * D2R), Math.cos(a * D2R)]; // 0 = down, 90 = forward, 180/-180 = up
  const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];
  const r1 = A.r1;

  // Pose: arm angles [upper, forearm-relative], feet = target positions (legs solved with IK).
  const POSES = {
    stand: { x: 0, crouch: 0, bob: 0, lean: 0, head: 0, armF: [18, 28], armB: [-14, -10], footF: [9, 0], footB: [-9, 0] },
    windup: { x: -3, crouch: 3, bob: 0, lean: -10, head: -6, armF: [-150, -25], armB: [35, 40], footF: [17, 0], footB: [-14, 0] },
    crack: { x: 4, crouch: 6, bob: 0, lean: 14, head: 6, armF: [96, -6], armB: [-40, -30], footF: [19, 0], footB: [-13, 0] },
    follow: { x: 5, crouch: 7, bob: 0, lean: 17, head: 8, armF: [72, 8], armB: [-42, -30], footF: [19, 0], footB: [-13, 0] },
    celebrate: { x: 0, crouch: 0, bob: 6, lean: -4, head: -10, armF: [160, 15], armB: [-160, -15], footF: [10, -3], footB: [-10, -3] },
    duck: { x: -2, crouch: 22, bob: 0, lean: 30, head: 20, armF: [150, 70], armB: [-165, -60], footF: [15, 0], footB: [-12, 0] },
    dangle: { x: 0, crouch: -8, bob: 0, lean: 0, head: -8, armF: [150, 25], armB: [-150, -25], footF: [6, 8], footB: [-5, 10] },
    radio: { x: 0, crouch: 0, bob: 0, lean: 2, head: 6, armF: [18, 28], armB: [30, 153], footF: [9, 0], footB: [-9, 0] },
    charge: { x: -2, crouch: 14, bob: 0, lean: -6, head: -8, armF: [-125, -40], armB: [45, 60], footF: [19, 0], footB: [-17, 0] },
    ride: { x: 0, crouch: 0, bob: 0, lean: 6, head: 0, armF: [40, 35], armB: [55, 25], footF: [13, -14], footB: [4, -12] },
    lie: { x: 0, crouch: 0, bob: 0, lean: 0, head: 0, armF: [120, 20], armB: [-120, -20], footF: [12, 0], footB: [-12, 0] },
  };

  const MOUTHS = {
    neutral: ['M1.5 5.5 Q5 6.5 8.5 5', ''],
    smile: ['M1 4 Q5 9.5 9 4', ''],
    grin: ['M0.5 3.5 Q5 11.5 9.5 3.5 Z', 'fill'],
    frown: ['M1.5 8 Q5 3.5 8.5 8', ''],
    shout: ['M3 2.5 Q8 2.5 8 6.5 Q7 11 3.8 9.5 Q1.2 6.5 3 2.5 Z', 'fill'],
    o: ['M3.2 6.2 Q3.2 3.2 5.2 3.2 Q7.2 3.2 7.2 6.2 Q7.2 9 5.2 9 Q3.2 9 3.2 6.2 Z', 'fill'],
    grit: ['M0.8 3.8 L9.2 3.6 L9 7.8 L1 7.8 Z M3.6 3.8 L3.6 7.8 M6.4 3.7 L6.4 7.8', 'teeth'],
  };

  function ik(a, target, l1, l2) {
    const dx = target[0] - a[0], dy = target[1] - a[1];
    let d = Math.hypot(dx, dy);
    d = U.clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
    const base = Math.atan2(dy, dx);
    const ang = Math.acos(U.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const k = base - ang; // knee bends forward (+x)
    const knee = [a[0] + Math.cos(k) * l1, a[1] + Math.sin(k) * l1];
    const kd = Math.atan2(target[1] - knee[1], target[0] - knee[0]);
    return [knee, [knee[0] + Math.cos(kd) * l2, knee[1] + Math.sin(kd) * l2]];
  }

  class StickFigure {
    constructor(clock, opts = {}) {
      this.clock = clock;
      this.o = Object.assign({ hat: 'cowboy', hatColor: undefined, scale: 1, whip: true, seed: Math.floor(Math.random() * 1000) }, opts);
      this.x = -300;
      this.y = 0;
      this.dir = 1;
      this.scale = this.o.scale;
      this.opacity = 1;
      this.shades = 0; // 0 = off, 1 = on the face (they drop down from above)
      this.rot = 0; // degrees, around the feet
      this.seated = false; // riding: poses don't move the legs
      this.held = null; // 'radio'
      this.breath = 1;
      this.pose = U.clone(POSES.stand);
      this.face = { mouth: 'smile', brows: 0, blink: 0 };
      this._nextBlink = U.rand(1500, 4000);
      this.whip = { mode: 'coil', len: WHIP_LEN, angles: new Array(N).fill(15), spark: 0, sparkAt: [0, 0] };
      this.headC = [0, -102];
      this.hand = [0, -60];
      this.tip = [0, 0];
      this.mounted = false;
      this.onRender = null; // optional hook(fig, time) for extra fx
      this._build();
    }

    _build() {
      const el = (this.el = document.createElement('div'));
      el.className = 'wc-fig';
      const s = (this.svg = A.svg('svg', { class: 'wc-svg', viewBox: '-220 -330 440 380', width: 440, height: 380 }));
      el.appendChild(s);
      this.back = A.svg('g', { class: 'wc-back' }, s); // fx behind the body (glow etc.)
      const P = (this.parts = {});
      const pair = (name, w, cls = '') => {
        const g = A.svg('g', { class: cls }, s);
        P[name] = [A.svg('path', { class: 'o', 'stroke-width': w + 5 }, g), A.svg('path', { class: 'i', 'stroke-width': w }, g)];
        return g;
      };
      pair('legB', 5);
      pair('armB', 4.8);
      pair('torso', 5.4);
      pair('legF', 5);
      // Head
      const hg = (this.headG = A.svg('g', {}, s));
      this.headO = A.svg('path', { class: 'o', 'stroke-width': 8.5 }, hg);
      this.headI = A.svg('path', { class: 'i wc-headfill', 'stroke-width': 3.6 }, hg);
      this.eyes = A.svg('g', { class: 'wc-eyes' }, hg);
      A.svg('circle', { cx: 2.6, cy: -2, r: 1.9 }, this.eyes);
      A.svg('circle', { cx: 8, cy: -2, r: 1.9 }, this.eyes);
      this.brows = A.svg('path', { class: 'i', 'stroke-width': 1.8, d: 'M-0.5 -8.5 L4.5 -5.6 M6.2 -5.6 L10.8 -8.6' }, hg);
      this.mouth = A.svg('path', { class: 'i', 'stroke-width': 1.9 }, hg);
      // Face accessories (cowboy only): stubble, eye bags, mustache, cigar, shades.
      this.acc = A.svg('g', {}, hg);
      if (this.o.face) this.acc.insertAdjacentHTML('beforeend', this.o.face); // costume (crew.js)
      if (this.o.rugged) {
        A.svg('path', { d: 'M1.5 7.6h.1M4 8.6h.1M6.5 8.4h.1M9 7.2h.1M2.6 9.8h.1M5.3 10.4h.1M8 9.6h.1M10.4 5.6h.1', stroke: '#151515', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, this.acc);
        A.svg('path', { d: 'M1.2 0.6 Q2.6 1.6 4 0.6 M6.6 0.6 Q8 1.6 9.4 0.6', fill: 'none', stroke: '#151515', 'stroke-width': 0.9, opacity: 0.7 }, this.acc);
        this.lids = A.svg('path', { d: 'M0.4 -3.6 L4.8 -2.4 M5.8 -2.4 L10.4 -3.8', stroke: '#151515', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, this.acc);
        A.svg('path', { d: 'M0.6 3.6 Q2.8 1.2 5.4 2.8 Q8 1.2 10.6 3.8 Q8.6 5.2 5.4 3.9 Q2.6 5.2 0.6 3.6 Z', fill: '#2a1a0c', stroke: '#151515', 'stroke-width': 0.8 }, this.acc);
        this.cigar = A.svg('g', {}, hg);
        A.svg('path', { d: 'M7.5 6.2 L17 7.8', stroke: '#151515', 'stroke-width': 4.2, 'stroke-linecap': 'round' }, this.cigar);
        A.svg('path', { d: 'M7.5 6.2 L17 7.8', stroke: '#8a5a2e', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, this.cigar);
        this.ember = A.svg('circle', { cx: 17.6, cy: 7.9, r: 1.5, fill: '#ff5a1f' }, this.cigar);
        this.smoke = A.svg('path', { fill: 'none', stroke: 'rgba(150,150,150,.75)', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, this.cigar);
        this.shadesG = A.svg('g', { opacity: 0 }, hg);
        A.svg('path', { d: 'M-7 -3.6 L-1 -3.8 M10.6 -3.8 L12.6 -4', stroke: '#151515', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, this.shadesG);
        A.svg('path', { d: 'M-1.4 -5 L4.6 -5 L4.2 -0.4 Q1.2 0.4 -0.6 -1.4 Z M5.8 -5 L11.8 -5 L11.2 -0.6 Q8.2 0.4 6.4 -1.4 Z M4.6 -4.4 L5.8 -4.4', fill: '#111', stroke: '#111', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, this.shadesG);
        A.svg('path', { d: 'M0.4 -4 L2 -2 M7.4 -4 L9 -2', stroke: '#fff', 'stroke-width': 0.9, 'stroke-linecap': 'round', opacity: 0.85 }, this.shadesG);
      }
      this.hatG = A.svg('g', {}, hg);
      if (this.o.head && this.o.head.type === 'sun') {
        this.headI.style.fill = this.o.head.fill || '#e8632b';
        this.headI.setAttribute('stroke-width', '2.6');
        hg.insertBefore(this.headI, this.eyes);
      }
      this.setHat(this.o.hat, this.o.hatColor);
      // Whip + front arm (drawn over body and head)
      if (this.o.whip) {
        pair('whip', 2.6, 'wc-whip');
        pair('handle', 5.2, 'wc-handle');
      }
      this.prop = A.svg('g', { style: 'display:none' }, s); // held item (walkie-talkie)
      this.prop.innerHTML =
        '<path d="M-1 -16 L-1 -27" stroke="#151515" stroke-width="2.2" stroke-linecap="round"/>' +
        '<rect x="-5" y="-17" width="10" height="17" rx="2.5" fill="#3d4148" stroke="#151515" stroke-width="2.2"/>' +
        '<rect x="-3" y="-14" width="6" height="4" rx="1" fill="#9be37a"/>' +
        '<path d="M-3 -6 H3 M-3 -3.5 H3" stroke="#151515" stroke-width="1"/>';
      pair('armF', 4.8);
      // Spark at the whip tip
      this.sparkG = A.svg('g', { class: 'wc-spark', opacity: 0 }, s);
      A.svg('path', { d: A.star(0, 0, 15, 6, 8, 3, 0.3), fill: '#ffd23f', stroke: A.INK, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, this.sparkG);
      A.svg('path', { d: 'M0 -20 L0 -30 M15 -14 L23 -21 M20 2 L31 3 M-15 -14 L-22 -21 M13 14 L20 22 M-12 15 L-18 22', stroke: A.INK, 'stroke-width': 2.6, 'stroke-linecap': 'round', fill: 'none' }, this.sparkG);
      this.front = A.svg('g', { class: 'wc-front' }, s); // fx in front of the body
      // Hit area: only this rect receives pointer events.
      this.hit = A.svg('rect', { class: 'wc-hit', x: -26, y: -152, width: 52, height: 156, rx: 14, fill: 'transparent' }, s);
    }

    setHat(type, color) {
      const fn = A.HATS[type] || A.HATS.none;
      this.hatG.innerHTML = fn(color);
    }

    mount(layer) {
      if (this.mounted) return;
      this.mounted = true;
      layer.appendChild(this.el);
      this._off = this.clock.add((dt, time) => {
        this.update(dt);
        this.render(time);
      });
      this.render(this.clock.time);
    }
    unmount() {
      if (!this.mounted) return;
      this.mounted = false;
      if (this._off) this._off();
      this.el.remove();
    }

    toPage(p) {
      return [this.x + this.dir * this.scale * p[0], this.y + this.scale * p[1]];
    }
    bubbleAnchor() {
      return this.toPage([this.headC[0] + 3, this.headC[1] - 28]);
    }

    update(dt) {
      const f = this.face;
      this._nextBlink -= dt;
      if (this._nextBlink <= 0) {
        f.blink = 130;
        this._nextBlink = U.rand(2200, 5200);
      }
      if (f.blink > 0) f.blink -= dt;
      const W = this.whip;
      if (W.spark > 0) W.spark = Math.max(0, W.spark - dt / 280);
    }

    _set(name, d) {
      const pr = this.parts[name];
      pr[0].setAttribute('d', d);
      pr[1].setAttribute('d', d);
    }

    render(time) {
      const p = this.pose, W = this.whip;
      const tr = `translate3d(${r1(this.x)}px,${r1(this.y)}px,0)${this.rot ? ` rotate(${r1(this.rot)}deg)` : ''} scale(${this.dir * this.scale},${this.scale})`;
      if (tr !== this._lastT) {
        this.el.style.transform = tr;
        this._lastT = tr;
      }
      if (this.opacity !== this._lastO) {
        this.el.style.opacity = String(this.opacity);
        this._lastO = this.opacity;
      }
      const seed = this.o.seed + Math.floor(time / 120) * 17; // jittery "line boil" every ~120ms
      const br = Math.sin(time / 650) * 1.2 * this.breath;
      const hip = [p.x, -52 + p.crouch - p.bob];
      const up = [Math.sin(p.lean * D2R), -Math.cos(p.lean * D2R)];
      const neck = add(hip, up, 37 + br);
      const sh = add(hip, up, 30 + br);
      const ha = p.lean + p.head;
      const headC = (this.headC = add(neck, [Math.sin(ha * D2R), -Math.cos(ha * D2R)], 13));
      const arm = (a) => {
        const e = add(sh, dv(a[0]), 19);
        return [sh, e, add(e, dv(a[0] + a[1]), 18)];
      };
      const leg = (f) => {
        const [knee, foot] = ik(hip, [p.x + f[0], f[1] - p.bob * 0.6], 27, 27);
        return [hip, knee, foot];
      };
      const aF = arm(p.armF), aB = arm(p.armB);
      this.hand = aF[2];
      this.handB = aB[2];
      this._set('legB', A.wobLine(leg(p.footB), seed + 1, 0.13));
      this._set('armB', A.wobLine(aB, seed + 2, 0.13));
      this._set('torso', A.wobLine([hip, neck], seed + 3, 0.09));
      this._set('legF', A.wobLine(leg(p.footF), seed + 4, 0.13));
      this._set('armF', A.wobLine(aF, seed + 5, 0.13));

      this.headG.setAttribute('transform', `translate(${r1(headC[0])} ${r1(headC[1])}) rotate(${r1(ha)})`);
      if (seed !== this._hs) {
        this._hs = seed;
        const H = this.o.head;
        const d = H && H.type === 'sun' ? A.star(0, 0, 17, 17 * (H.rIn || 0.62), H.rays || 12, seed + 9, H.jitter === undefined ? 0.12 : H.jitter) : A.wobCircle(0, 0, 12, seed + 9, 0.08, 8);
        this.headO.setAttribute('d', d);
        this.headI.setAttribute('d', d);
      }
      const f = this.face;
      const mk = f.mouth in MOUTHS ? f.mouth : 'neutral';
      if (mk !== this._mk) {
        this._mk = mk;
        this.mouth.setAttribute('d', MOUTHS[mk][0]);
        this.mouth.setAttribute('class', 'i ' + MOUTHS[mk][1]);
      }
      const blink = f.blink > 0 ? 1 : 0;
      if (blink !== this._bl) {
        this._bl = blink;
        this.eyes.setAttribute('transform', blink ? 'translate(0 -1.7) scale(1 0.15)' : '');
      }
      const brows = f.brows ? 1 : 0;
      if (brows !== this._br) {
        this._br = brows;
        this.brows.style.display = brows ? '' : 'none';
      }

      if (this.o.rugged) {
        const open = mk === 'shout' || mk === 'o' || mk === 'grin';
        if (open !== this._open) {
          this._open = open;
          this.cigar.style.display = open ? 'none' : '';
        }
        if (!open) {
          const w = time / 260;
          this.smoke.setAttribute('d', `M18 6 Q${r1(20 + Math.sin(w) * 3)} 1 ${r1(18 + Math.sin(w + 1) * 3)} -4 Q${r1(16 + Math.sin(w + 2) * 4)} -9 ${r1(19 + Math.sin(w + 3) * 4)} -14`);
          this.ember.setAttribute('r', r1(1.2 + Math.abs(Math.sin(time / 300)) * 0.8));
        }
        this.lids.style.display = f.brows || mk === 'grit' || mk === 'neutral' ? '' : 'none';
        const sh = this.shades;
        if (sh !== this._sh) {
          this._sh = sh;
          this.shadesG.setAttribute('opacity', sh > 0 ? '1' : '0');
          this.shadesG.setAttribute('transform', `translate(0 ${r1(-(1 - sh) * 70)})`);
        }
      }
      if (this.o.whip) this._renderWhip(aF, seed);
      if (this.held !== this._held) {
        this._held = this.held;
        this.prop.style.display = this.held === 'radio' ? '' : 'none';
      }
      if (this.held === 'radio') {
        const fa = p.armB[0] + p.armB[1];
        this.prop.setAttribute('transform', `translate(${r1(aB[2][0])} ${r1(aB[2][1] + 4)}) rotate(${r1(180 - fa + 10)})`);
      }
      if (this.onRender) this.onRender(this, time);
    }

    _renderWhip(aF, seed) {
      const W = this.whip, p = this.pose;
      const hand = aF[2];
      const hd = dv(p.armF[0] + p.armF[1]);
      const butt = add(hand, hd, -6), hEnd = add(hand, hd, 9);
      this._set('handle', `M${r1(butt[0])} ${r1(butt[1])}L${r1(hEnd[0])} ${r1(hEnd[1])}`);
      let d;
      if (W.mode === 'coil') {
        const cx = hand[0] + 2, cy = hand[1] + 10;
        d =
          A.wobEllipse(cx, cy, 6, 9.5, seed + 21, 0.08, 7) +
          A.wobEllipse(cx + 2.5, cy + 1.5, 7, 9, seed + 22, 0.08, 7) +
          A.wobLine([[cx + 3, cy + 10], [cx + 6, cy + 19], [cx + 3, cy + 27]], seed + 23, 0.2);
        this.tip = [cx + 3, cy + 27];
      } else {
        const pts = [hEnd];
        let cur = hEnd;
        const sl = W.len / N;
        for (let i = 0; i < N; i++) {
          cur = add(cur, dv(W.angles[i]), sl);
          pts.push(cur);
        }
        this.tip = cur;
        d = A.smooth(pts);
      }
      this._set('whip', d);
      if (W.spark > 0) {
        const k = 0.45 + (1 - W.spark) * 0.9;
        this.sparkG.setAttribute('transform', `translate(${r1(W.sparkAt[0])} ${r1(W.sparkAt[1])}) scale(${r1(k * 100) / 100}) rotate(${r1(W.spark * 40)})`);
        this.sparkG.setAttribute('opacity', String(Math.min(1, W.spark * 1.6)));
        this._sparkOn = true;
      } else if (this._sparkOn) {
        this._sparkOn = false;
        this.sparkG.setAttribute('opacity', '0');
      }
    }

    // ---------- actions (all async, abortable via signal) ----------

    _poseT(target) {
      const tg = Object.assign({}, target);
      if (this.seated) for (const k of ['footF', 'footB', 'crouch', 'bob', 'x']) delete tg[k];
      return tg;
    }

    async poseTo(target, ms, signal, ease = U.ease.inOut) {
      const from = U.clone(this.pose);
      const tg = Object.assign({}, target);
      if (this.seated) for (const k of ['footF', 'footB', 'crouch', 'bob', 'x']) delete tg[k];
      const to = Object.assign(U.clone(this.pose), tg);
      await this.clock.tween(ms, (t) => U.lerpInto(this.pose, from, to, t), signal, ease);
    }

    coilWhip() {
      this.whip.mode = 'coil';
    }

    /** Walk (or run) to page coords. */
    async walkTo(tx, ty, signal, o = {}) {
      const run = !!o.run;
      const speed = o.speed || (run ? 0.34 : 0.13); // px per ms
      const sx = this.x, sy = this.y, dx = tx - sx, dy = ty - sy;
      const dist = Math.hypot(dx, dy);
      if (dist < 1.5) return;
      if (o.face !== false && Math.abs(dx) > 2) this.dir = dx > 0 ? 1 : -1;
      if (this.o.whip && !o.keepWhip) this.coilWhip();
      const S = run ? 15 : 10, L = run ? 10 : 6;
      const ph0 = this._ph || 0;
      const foot = (ph) => {
        const q = ((ph % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        return q < Math.PI ? [S * Math.cos(q), 0] : [S * Math.cos(q), -L * Math.sin(q - Math.PI)];
      };
      const P = this.pose;
      const lean0 = P.lean;
      const holdsWhip = this.o.whip;
      await this.clock.tween(dist / speed, (t) => {
        this.x = sx + dx * t;
        this.y = sy + dy * t;
        const ph = (this._ph = ph0 + ((t * dist) / (2 * S)) * Math.PI);
        P.footF = foot(ph);
        P.footB = foot(ph + Math.PI);
        P.bob = Math.abs(Math.sin(ph)) * (run ? 4 : 2.2);
        P.lean = U.lerp(lean0, run ? 14 : 4, Math.min(1, t * 8));
        P.crouch = run ? 4 : 1;
        P.head = run ? -6 : 0;
        const c = Math.cos(ph);
        P.armB = run ? [-35 * c, -70] : [-24 * c, -12];
        P.armF = holdsWhip ? [18 + 10 * c, 30] : run ? [35 * c, 70] : [24 * c, 12];
      }, signal);
      if (o.settle !== false) await this.poseTo({ footF: [9, 0], footB: [-9, 0], bob: 0, lean: 0, crouch: 0, head: 0, armF: POSES.stand.armF, armB: POSES.stand.armB }, 170, signal);
    }

    /** One full whip crack: wind-up → whip curls out → snap with spark at the tip. */
    async crack(signal, o = {}) {
      const W = this.whip;
      const lenMul = o.lenMul || 1;
      const hang = (u) => 14 + 10 * u;
      if (W.mode === 'coil') {
        W.mode = 'line';
        W.len = 45;
        for (let i = 0; i < N; i++) W.angles[i] = hang((i + 1) / N);
      }
      const a0 = W.angles.slice(), len0 = W.len;
      const trail = (u) => -110 + 52 * u * u;
      // 1) wind-up
      await Promise.all([
        this.poseTo(POSES.windup, 260, signal, U.ease.outQuad),
        this.clock.tween(260, (t) => {
          W.len = U.lerp(len0, WHIP_LEN * lenMul, t);
          for (let i = 0; i < N; i++) W.angles[i] = U.lerp(a0[i], trail((i + 1) / N), t);
        }, signal, U.ease.inOut),
      ]);
      if (o.onWindup) o.onWindup();
      // 2) throw: the handle swings over the head; each segment follows with a delay → traveling loop
      const from = U.clone(this.pose), to = Object.assign(U.clone(this.pose), this._poseT(POSES.crack));
      await this.clock.tween(o.throwMs || 210, (t) => {
        U.lerpInto(this.pose, from, to, U.ease.inCubic(Math.min(1, t / 0.55)));
        for (let i = 0; i < N; i++) {
          const u = (i + 1) / N;
          const tau = t - 0.42 * u;
          const k = U.clamp(tau / 0.58, 0, 1);
          const H = U.lerp(-110, -270, U.ease.inOutCubic(k));
          const droop = 52 * u * u * (1 - U.smoothstep(0, 0.6, t));
          const curl = Math.sin(k * Math.PI) * -40 * u;
          W.angles[i] = H + droop + curl;
        }
      }, signal);
      // 3) snap!
      for (let i = 0; i < N; i++) W.angles[i] = -270 + 360; // straight forward (normalized to 90)
      W.sparkAt = this.tip.slice();
      this.render(this.clock.time);
      W.sparkAt = this.tip.slice();
      W.spark = 1;
      if (o.onSnap) o.onSnap(this.toPage(this.tip));
      await this.poseTo(POSES.follow, 90, signal, U.ease.outQuad);
      if (o.hold) await this.clock.wait(o.hold, signal);
      // 4) recover: whip drops and is pulled back into a coil
      const a1 = W.angles.slice(), l1 = W.len;
      await Promise.all([
        this.poseTo(POSES.stand, 380, signal),
        this.clock.tween(380, (t) => {
          W.len = U.lerp(l1, 45, t);
          for (let i = 0; i < N; i++) {
            const u = (i + 1) / N;
            W.angles[i] = U.lerp(a1[i], hang(u), t) + 25 * u * Math.sin(t * Math.PI);
          }
        }, signal, U.ease.inOut),
      ]);
      W.mode = 'coil';
    }

    /** Shades drop down from the sky onto his face. */
    async shadesOn(signal) {
      if (!this.o.rugged) return;
      await this.clock.tween(650, (t) => (this.shades = t), signal, U.ease.outBack);
    }
    shadesOff() {
      this.shades = 0;
    }

    async nod(signal, times = 2) {
      for (let i = 0; i < times; i++) {
        await this.poseTo({ head: 17 }, 150, signal);
        await this.poseTo({ head: -2 }, 150, signal);
      }
      await this.poseTo({ head: 0 }, 140, signal);
    }

    async celebrate(signal, jumps = 2) {
      await this.poseTo(Object.assign({}, POSES.celebrate, { bob: 0 }), 180, signal);
      for (let i = 0; i < jumps; i++) {
        await this.poseTo({ bob: 14, footF: [10, -14], footB: [-10, -14] }, 170, signal, U.ease.outQuad);
        await this.poseTo({ bob: 0, footF: [10, 0], footB: [-10, 0] }, 170, signal, U.ease.inQuad);
      }
      await this.poseTo(POSES.stand, 220, signal);
    }
  }

  StickFigure.POSES = POSES;
  StickFigure.WHIP_SEGMENTS = N;
  WC.StickFigure = StickFigure;
})();
