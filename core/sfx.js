/* Whip Cowboy — core/sfx.js : every sound is synthesized with the Web Audio API (no audio files).
 * Off by default ("Knall-Ton"). The AudioContext is created lazily and unlocked on the first
 * click/keypress in the page (browser autoplay policy). play(name, opts) is always safe to call. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const U = WC.U;

  WC.createSfx = function createSfx(scope, getSettings) {
    let ac = null, master = null, noiseBuf = null;

    function ensure() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
          ac = new AC();
        } catch (_) {
          return null;
        }
        master = ac.createGain();
        master.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      return ac;
    }
    const unlock = () => {
      if (getSettings().sound) ensure();
    };
    scope.listen(window, 'pointerdown', unlock, true);
    scope.listen(window, 'keydown', unlock, true);
    scope.add(() => {
      if (ac) ac.close().catch(() => {});
      ac = null;
    });

    // ---- building blocks ----
    const gain = (t, a, peak, d, dest = master) => {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
      g.connect(dest);
      return g;
    };
    const noise = (t, dur, dest) => {
      const s = ac.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      s.connect(dest);
      s.start(t, Math.random() * 1.5);
      s.stop(t + dur + 0.05);
      return s;
    };
    const filter = (type, f, q, dest) => {
      const b = ac.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      if (q) b.Q.value = q;
      b.connect(dest);
      return b;
    };
    const osc = (type, f, t, dur, dest) => {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      o.connect(dest);
      o.start(t);
      o.stop(t + dur + 0.05);
      return o;
    };

    const SOUNDS = {
      crack(t) {
        const g = gain(t, 0.002, 0.9, 0.1);
        const hp = filter('highpass', 900, 0.7, g);
        hp.frequency.setValueAtTime(900, t);
        hp.frequency.exponentialRampToValueAtTime(6500, t + 0.06);
        noise(t, 0.12, hp);
        osc('square', 2600, t, 0.012, gain(t, 0.001, 0.35, 0.012));
      },
      boom(t) {
        const g = gain(t, 0.01, 1, 1.4);
        const lp = filter('lowpass', 900, 0.8, g);
        lp.frequency.setValueAtTime(900, t);
        lp.frequency.exponentialRampToValueAtTime(60, t + 1.3);
        noise(t, 1.5, lp);
        const o = osc('sine', 75, t, 0.7, gain(t, 0.005, 0.9, 0.6));
        o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
      },
      whoosh(t, o) {
        const dur = (o.ms || 1400) / 1000;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.55, t + dur * 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        g.connect(master);
        const bp = filter('bandpass', 300, 1.1, g);
        bp.frequency.setValueAtTime(250, t);
        bp.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.45);
        bp.frequency.exponentialRampToValueAtTime(350, t + dur);
        noise(t, dur, bp);
      },
      beep(t, o) {
        osc('sine', o.freq || 880, t, 0.2, gain(t, 0.005, 0.4, 0.18));
      },
      bang(t) {
        const lp = filter('lowpass', 3500, 0.7, gain(t, 0.002, 1, 0.28));
        lp.frequency.exponentialRampToValueAtTime(300, t + 0.25);
        noise(t, 0.3, lp);
        const o = osc('sine', 140, t, 0.25, gain(t, 0.002, 0.8, 0.22));
        o.frequency.exponentialRampToValueAtTime(45, t + 0.22);
      },
      roar(t) {
        const out = gain(t, 0.12, 0.6, 1.5);
        const lp = filter('lowpass', 1100, 1, out);
        const ws = ac.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
          const x = (i / 255) * 2 - 1;
          curve[i] = Math.tanh(x * 4);
        }
        ws.curve = curve;
        ws.connect(lp);
        for (const f of [92, 69, 131]) {
          const o = osc('sawtooth', f, t, 1.6, ws);
          o.frequency.linearRampToValueAtTime(f * 0.8, t + 1.6);
          const lfo = osc('sine', 9, t, 1.6, (() => { const lg = ac.createGain(); lg.gain.value = f * 0.12; lg.connect(o.frequency); return lg; })());
          void lfo;
        }
        noise(t, 1.6, filter('lowpass', 700, 0.6, gain(t, 0.1, 0.35, 1.4)));
      },
      stomp(t) {
        const o = osc('sine', 65, t, 0.3, gain(t, 0.004, 0.9, 0.28));
        o.frequency.exponentialRampToValueAtTime(28, t + 0.28);
        noise(t, 0.2, filter('lowpass', 220, 0.7, gain(t, 0.004, 0.6, 0.18)));
      },
      radio(t) {
        noise(t, 0.35, filter('bandpass', 1600, 0.9, gain(t, 0.01, 0.25, 0.32)));
        osc('sine', 1850, t + 0.4, 0.06, gain(t + 0.4, 0.004, 0.2, 0.06));
        osc('sine', 2450, t + 0.5, 0.07, gain(t + 0.5, 0.004, 0.2, 0.07));
      },
      charge(t, o) {
        const dur = (o.ms || 2000) / 1000;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.28, t + dur * 0.95);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
        g.connect(master);
        const lp = filter('lowpass', 2400, 1, g);
        for (const det of [0, 7]) {
          const v = osc('sawtooth', 110 + det, t, dur, lp);
          v.frequency.exponentialRampToValueAtTime(950 + det * 10, t + dur);
        }
      },
      glass(t) {
        noise(t, 0.6, filter('highpass', 3200, 0.7, gain(t, 0.002, 0.55, 0.5)));
        for (let i = 0; i < 8; i++) {
          const tt = t + Math.random() * 0.35;
          osc('sine', U.rand(2500, 6500), tt, 0.25, gain(tt, 0.002, 0.12, 0.22));
        }
      },
      siren(t, o) {
        // dive-bomber wail: rising howl
        const dur = (o.ms || 2000) / 1000;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        g.connect(master);
        const bp = filter('bandpass', 1200, 2, g);
        for (const det of [0, 4]) {
          const v = osc('sawtooth', 380 + det, t, dur, bp);
          v.frequency.exponentialRampToValueAtTime(1500 + det * 8, t + dur * 0.85);
        }
      },
      chomp(t) {
        noise(t, 0.09, filter('lowpass', 1400, 0.8, gain(t, 0.002, 0.8, 0.09)));
        const v = osc('sine', 190, t, 0.12, gain(t, 0.002, 0.7, 0.12));
        v.frequency.exponentialRampToValueAtTime(55, t + 0.11);
      },
      gallop(t, o) {
        const dur = (o.ms || 2000) / 1000;
        for (let b = 0; b < dur; b += 0.36) {
          for (const off of [0, 0.07, 0.15]) {
            const tt = t + b + off;
            const v = osc('sine', 320, tt, 0.06, gain(tt, 0.002, 0.3, 0.06));
            v.frequency.exponentialRampToValueAtTime(110, tt + 0.05);
            noise(tt, 0.04, filter('bandpass', 900, 1.2, gain(tt, 0.002, 0.15, 0.04)));
          }
        }
      },
    };

    return {
      play(name, o = {}) {
        const S = getSettings();
        if (!S.sound || !SOUNDS[name]) return;
        if (!ensure()) return;
        master.gain.value = U.clamp(Number(S.volume), 0, 1);
        try {
          SOUNDS[name](ac.currentTime + 0.01, o);
        } catch (e) {
          if (S.debug) console.warn('[WhipCowboy] sfx', name, e);
        }
      },
    };
  };
})();
