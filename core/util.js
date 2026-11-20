/* Whip Cowboy — core/util.js
 * Portable helpers: Scope (cleanup tracking), Clock (single rAF loop + tweens), math/easing.
 * No chrome.* APIs in core/ so it can be reused in a Claude Desktop mod. */
(() => {
  'use strict';
  const WC = (globalThis.WhipCowboy = globalThis.WhipCowboy || {});

  const abortError = () => {
    const e = new Error('Aborted');
    e.name = 'AbortError';
    return e;
  };
  const isAbort = (e) => !!e && e.name === 'AbortError';

  /** Tracks every timer, listener and teardown function so one dispose() cleans up everything. */
  class Scope {
    constructor() {
      this._fns = [];
      this._timers = new Set();
      this._intervals = new Set();
      this.disposed = false;
    }
    add(fn) {
      if (this.disposed) {
        try { fn(); } catch (_) { /* ignore */ }
        return fn;
      }
      this._fns.push(fn);
      return fn;
    }
    remove(fn) {
      const i = this._fns.indexOf(fn);
      if (i >= 0) this._fns.splice(i, 1);
    }
    timeout(fn, ms) {
      if (this.disposed) return 0;
      const id = setTimeout(() => {
        this._timers.delete(id);
        fn();
      }, ms);
      this._timers.add(id);
      return id;
    }
    clearTimeout(id) {
      clearTimeout(id);
      this._timers.delete(id);
    }
    interval(fn, ms) {
      if (this.disposed) return 0;
      const id = setInterval(fn, ms);
      this._intervals.add(id);
      return id;
    }
    listen(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      return this.add(() => target.removeEventListener(type, fn, opts));
    }
    child() {
      const c = new Scope();
      const off = this.add(() => c.dispose());
      c.add(() => this.remove(off));
      return c;
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      for (const id of this._timers) clearTimeout(id);
      for (const id of this._intervals) clearInterval(id);
      this._timers.clear();
      this._intervals.clear();
      const fns = this._fns.splice(0).reverse();
      for (const fn of fns) {
        try { fn(); } catch (e) { console.warn('[WhipCowboy] cleanup error', e); }
      }
    }
  }

  /** One requestAnimationFrame loop for everything. Stops itself when nothing is animating.
   *  dt passed to tickers is scaled by the speed setting, so "Faster/Slower" affects all animation. */
  class Clock {
    constructor(scope, getSpeed) {
      this.getSpeed = getSpeed || (() => 1);
      this.tickers = new Set();
      this.raf = 0;
      this.last = 0;
      this.time = 0;
      this.dead = false;
      this._frame = this._frame.bind(this);
      scope.add(() => {
        this.dead = true;
        if (this.raf) cancelAnimationFrame(this.raf);
        this.tickers.clear();
      });
    }
    add(fn) {
      this.tickers.add(fn);
      this._kick();
      return () => this.tickers.delete(fn);
    }
    _kick() {
      if (!this.raf && !this.dead) this.raf = requestAnimationFrame(this._frame);
    }
    _frame(now) {
      this.raf = 0;
      const real = this.last ? Math.min(50, now - this.last) : 16.7;
      this.last = now;
      const dt = real * this.getSpeed();
      this.time += dt;
      for (const fn of Array.from(this.tickers)) {
        try {
          fn(dt, this.time, real);
        } catch (e) {
          console.error('[WhipCowboy]', e);
          this.tickers.delete(fn);
        }
      }
      if (this.tickers.size) this._kick();
      else this.last = 0;
    }
    /** Animate over `ms` (speed-scaled). fn(easedT, rawT). Rejects with AbortError if signal aborts. */
    tween(ms, fn, signal, ease) {
      return new Promise((resolve, reject) => {
        if (this.dead || (signal && signal.aborted)) return reject(abortError());
        let el = 0;
        let off = null;
        const onAbort = () => {
          if (off) off();
          reject(abortError());
        };
        const done = () => {
          if (off) off();
          if (signal) signal.removeEventListener('abort', onAbort);
        };
        off = this.add((dt) => {
          el += dt;
          const t = ms <= 0 ? 1 : Math.min(1, el / ms);
          try {
            if (fn) fn(ease ? ease(t) : t, t);
          } catch (e) {
            done();
            reject(e);
            return;
          }
          if (t >= 1) {
            done();
            resolve();
          }
        });
        if (signal) signal.addEventListener('abort', onAbort, { once: true });
      });
    }
    wait(ms, signal) {
      return this.tween(ms, null, signal);
    }
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  /** out = lerp(a, b, t) for every numeric (or array of numeric) field; non-numbers switch at t=0.5. */
  const lerpInto = (out, a, b, t) => {
    for (const k in b) {
      const bv = b[k], av = a[k] === undefined ? bv : a[k];
      if (typeof bv === 'number') out[k] = av + (bv - av) * t;
      else if (Array.isArray(bv)) {
        if (!Array.isArray(out[k])) out[k] = bv.slice();
        for (let i = 0; i < bv.length; i++) {
          const x = Array.isArray(av) && av[i] !== undefined ? av[i] : bv[i];
          out[k][i] = x + (bv[i] - x) * t;
        }
      } else out[k] = t < 0.5 ? av : bv;
    }
    return out;
  };

  WC.U = {
    Scope, Clock, abortError, isAbort, clamp, lerp, smoothstep, ease, hash, clone, lerpInto,
    rand: (a = 0, b = 1) => a + Math.random() * (b - a),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    r1: (n) => Math.round(n * 10) / 10,
    now: () => performance.now(),
  };
})();
