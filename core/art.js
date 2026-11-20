/* Whip Cowboy — core/art.js : hand-drawn SVG helpers (wobbly lines, circles, stars) and hats. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const { hash } = WC.U;
  const NS = 'http://www.w3.org/2000/svg';
  const r1 = (n) => Math.round(n * 10) / 10;
  const INK = '#151515';

  function svg(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  /** Polyline drawn as slightly bent quadratic segments → "hand-drawn" look. */
  function wobLine(pts, seed = 0, amt = 0.08) {
    let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const off = (hash(seed + i * 13.7) - 0.5) * 2 * amt * len;
      const mx = (x1 + x2) / 2 - (dy / len) * off;
      const my = (y1 + y2) / 2 + (dx / len) * off;
      d += `Q${r1(mx)} ${r1(my)} ${r1(x2)} ${r1(y2)}`;
    }
    return d;
  }

  /** Smooth open curve through points (midpoint quadratic smoothing). */
  function smooth(pts) {
    if (pts.length < 3) return wobLine(pts, 0, 0);
    let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += `Q${r1(pts[i][0])} ${r1(pts[i][1])} ${r1(mx)} ${r1(my)}`;
    }
    const L = pts[pts.length - 1];
    return d + `L${r1(L[0])} ${r1(L[1])}`;
  }

  /** Smooth closed wobbly ellipse. */
  function wobEllipse(cx, cy, rx, ry, seed = 0, amt = 0.06, n = 9) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + hash(seed) * 0.5;
      const k = 1 + (hash(seed + i * 7.3) - 0.5) * 2 * amt;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(pts[n - 1], pts[0]);
    let d = `M${r1(m0[0])} ${r1(m0[1])}`;
    for (let i = 0; i < n; i++) {
      const p = pts[i], m = mid(p, pts[(i + 1) % n]);
      d += `Q${r1(p[0])} ${r1(p[1])} ${r1(m[0])} ${r1(m[1])}`;
    }
    return d + 'Z';
  }
  const wobCircle = (cx, cy, r, seed, amt, n) => wobEllipse(cx, cy, r, r, seed, amt, n);

  /** Star / starburst polygon. */
  function star(cx, cy, rOut, rIn, n, seed = 0, jitter = 0.25) {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const base = i % 2 === 0 ? rOut : rIn;
      const r = base * (1 + (hash(seed + i * 3.1) - 0.5) * 2 * jitter);
      d += (i ? 'L' : 'M') + r1(cx + Math.cos(a) * r) + ' ' + r1(cy + Math.sin(a) * r);
    }
    return d + 'Z';
  }

  // Hats in head-local coordinates: head is a circle r=12 at (0,0), face looks toward +x.
  const S = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  const HATS = {
    cowboy: (c = '#8b5a2b') => `
      <path ${S} fill="${c}" d="M-9 -10 Q-10.5 -19 -7.5 -25 Q-3.5 -21.5 0 -22.5 Q3.5 -21.5 7.5 -25 Q10.5 -19 9 -10 Z"/>
      <path ${S} fill="#4a2c12" d="M-9.3 -14 L9.3 -14 L9.2 -10.5 L-9.2 -10.5 Z"/>
      <path ${S} fill="${c}" d="M-23 -16 Q-17 -8.5 0 -9.5 Q17 -8.5 23 -16 Q19 -5 0 -5.5 Q-19 -5 -23 -16 Z"/>`,
    redcap: (c = '#d93a2b') => `
      <path ${S} fill="${c}" d="M-11.5 -6 Q-11 -17 0 -17 Q11 -17 11.5 -6 Z"/>
      <path ${S} fill="${c}" d="M9 -7.5 Q18 -9 22 -5.5 Q16 -3.5 9 -5 Z"/>`,
    bluecap: (c = '#2f6fd6') => HATS.redcap(c),
    hardhat: (c = '#f5c518') => `
      <path ${S} fill="${c}" d="M-12 -6 Q-12.5 -20 0 -20 Q12.5 -20 12 -6 Z"/>
      <path ${S} fill="${c}" d="M-15.5 -6.5 L15.5 -6.5 L15.5 -3 L-15.5 -3 Z"/>
      <path ${S} fill="none" d="M0 -20 L0 -7"/>`,
    tophat: (c = '#222') => `
      <path ${S} fill="${c}" d="M-8 -10 L-8.5 -33 L8.5 -33 L8 -10 Z"/>
      <path ${S} fill="#c0392b" d="M-8.2 -15 L8.2 -15 L8.1 -11.5 L-8.1 -11.5 Z"/>
      <path ${S} fill="${c}" d="M-15 -11.5 Q0 -7 15 -11.5 L15 -8 Q0 -3.5 -15 -8 Z"/>`,
    beanie: (c = '#2e9e4f') => `
      <path ${S} fill="${c}" d="M-12 -5 Q-12.5 -20 0 -20.5 Q12.5 -20 12 -5 Z"/>
      <path ${S} fill="${c}" d="M-12.8 -9 L12.8 -9 L12.6 -4 L-12.6 -4 Z"/>
      <circle ${S} fill="#f3f3f3" cx="0" cy="-23" r="4"/>`,
    sombrero: (c = '#e0b04a') => `
      <path ${S} fill="${c}" d="M-7 -10 Q-8 -24 0 -27 Q8 -24 7 -10 Z"/>
      <path ${S} fill="${c}" d="M-27 -10 Q-18 -14 0 -11 Q18 -14 27 -10 Q18 -4 0 -5 Q-18 -4 -27 -10 Z"/>`,
    none: () => '',
  };

  WC.art = { NS, INK, svg, wobLine, smooth, wobEllipse, wobCircle, star, HATS, r1 };
})();
