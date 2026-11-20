/* Whip Cowboy — core/bubbles.js : comic speech bubbles that follow their speaker. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const U = WC.U;
  const TAIL = '<svg class="wc-tail" viewBox="0 0 26 22"><path d="M1 1 Q9 9 7 21 Q15 10 25 1" fill="#fff" stroke="#151515" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>';

  class Bubbles {
    constructor(stage, clock, scope, getSettings) {
      this.stage = stage;
      this.clock = clock;
      this.scope = scope;
      this.getSettings = getSettings;
      this.map = new Map(); // speaker -> entry
      scope.add(() => {
        for (const sp of Array.from(this.map.keys())) this.hide(sp, true);
      });
    }

    /** speaker: anything with bubbleAnchor() → [x,y] page point (top of the head).
     *  Resolves when the bubble disappears (immediately if bubbles are off). */
    say(speaker, text, o = {}) {
      const S = this.getSettings();
      if (!text || (!S.bubbles && !o.force)) return Promise.resolve();
      this.hide(speaker, true);
      const el = document.createElement('div');
      el.className = 'wc-bubble' + (o.variant ? ' ' + o.variant : '');
      const inner = document.createElement('div');
      inner.className = 'wc-bubble-inner';
      const txt = document.createElement('span');
      txt.className = 'wc-txt';
      txt.textContent = text;
      inner.appendChild(txt);
      inner.insertAdjacentHTML('beforeend', TAIL);
      if (o.variant === 'alarm') inner.querySelector('path').setAttribute('stroke', '#d10000');
      if (o.variant === 'mega') inner.querySelector('path').setAttribute('fill', '#fff4c2');
      if (o.variant === 'shout') inner.querySelector('path').setAttribute('fill', '#ffe14d');
      if (o.variant === 'dark') {
        const tp = inner.querySelector('path');
        tp.setAttribute('fill', '#141414');
        tp.setAttribute('stroke', '#f4f4f4');
      }
      inner.style.rotate = (Math.random() * 3 - 1.5).toFixed(1) + 'deg';
      el.appendChild(inner);
      this.stage.layers.bubbles.appendChild(el);
      const entry = { el, inner, w: inner.offsetWidth, h: inner.offsetHeight, tx: -1, res: null, timer: 0 };
      this.map.set(speaker, entry);
      const place = () => this._place(entry, speaker);
      place();
      entry.off = this.clock.add(place);
      const ms = o.ms || Math.max(2000, 900 + text.length * 55);
      return new Promise((res) => {
        entry.res = res;
        entry.timer = this.scope.timeout(() => this.hide(speaker), ms);
      });
    }

    _place(e, speaker) {
      let p;
      try {
        p = speaker.bubbleAnchor();
      } catch (_) {
        return;
      }
      const { vw, vh } = this.stage;
      const left = U.clamp(p[0] - e.w * 0.3, 6, Math.max(6, vw - e.w - 6));
      const top = U.clamp(p[1] - e.h - 20, 6, Math.max(6, vh - e.h - 26));
      const tx = Math.round(U.clamp(p[0] - left, 18, e.w - 18));
      if (tx !== e.tx) {
        e.tx = tx;
        e.inner.style.setProperty('--tx', tx + 'px');
      }
      e.el.style.transform = `translate3d(${Math.round(left)}px,${Math.round(top)}px,0)`;
    }

    hide(speaker, instant) {
      const e = this.map.get(speaker);
      if (!e) return;
      this.map.delete(speaker);
      if (e.off) e.off();
      this.scope.clearTimeout(e.timer);
      if (instant) e.el.remove();
      else {
        e.el.classList.add('out');
        this.scope.timeout(() => e.el.remove(), 200);
      }
      if (e.res) e.res();
    }
  }

  WC.Bubbles = Bubbles;
})();
