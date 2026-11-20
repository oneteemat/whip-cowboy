/* Whip Cowboy — core/app.js
 * The orchestrator: state machine (IDLE → WORKING → DONE → IDLE), cowboy behaviour scripts,
 * drag, context menu, keyboard shortcut, random events. Host-agnostic:
 *   createApp(host, settings) where host = { save(partialSettings): Promise }
 *   returns { update(settings), handleMessage(msg), dispose() } */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;

  WC.createApp = function createApp(host, initialSettings) {
    const U = WC.U, cfg = WC.config;
    const scope = new U.Scope();
    let S = Object.assign({}, cfg.defaults, initialSettings);
    const log = (...a) => {
      if (S.debug) console.log('%c[WhipCowboy]', 'color:#a0522d;font-weight:bold', ...a);
    };

    const clock = new U.Clock(scope, () => S.speed);
    const stage = new WC.Stage(scope);
    const bubbles = new WC.Bubbles(stage, clock, scope, () => S);
    const sfx = WC.createSfx(scope, () => S);
    const menu = new WC.Menu(stage, scope);
    const cowboy = new WC.StickFigure(clock, { hat: 'cowboy', rugged: true, scale: cfg.cowboyScale });
    scope.add(() => cowboy.unmount());

    const site = WC.site;
    // ---- user name (only kept in memory on this page; never stored or sent anywhere) ----
    let detectedName = null;
    const userName = () => (S.nameMode === 'off' ? null : S.nameMode === 'custom' ? WC.cleanName(S.customName) : detectedName);
    async function detectName(attempt) {
      if (scope.disposed || S.nameMode !== 'auto' || detectedName) return;
      try {
        detectedName = WC.cleanName(await site.detectName());
      } catch (_) {
        detectedName = null;
      }
      if (detectedName) log('user name detected:', detectedName);
      else if (attempt < 3) scope.timeout(() => detectName(attempt + 1), [4000, 12000, 30000][attempt]);
      else log('could not detect a user name on', site.name, '- set one in the popup if you like');
    }
    const fmt = (text) => String(text).replace(/\{ai\}/g, site.name).replace(/\{user\}/g, userName() || site.name + '-Fan');
    const line = (k, i) => fmt(WC.i18n.line(S.lang, k, i));
    const mt = (k) => fmt(WC.i18n.menu(S.lang, k));

    let mode = 'IDLE'; // IDLE | WORKING | DONE
    let workStart = 0;
    let onStage = false;
    let mainCtl = null;
    let eventCtl = null;
    let busyEvent = null;
    let drag = null;

    // ---------------- positioning ----------------
    const detector = new WC.WorkDetector(scope, cfg, {
      onStart,
      onDone,
      onNavigate,
      log,
    });

    function anchorRect() {
      const el = detector.findAnchor();
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 8) return null;
      return { left: r.left, right: r.right, top: Math.max(0, r.top), bottom: Math.min(stage.vh, r.bottom) };
    }

    function home() {
      const vw = stage.vw, vh = stage.vh, s = cowboy.scale;
      const r = anchorRect() || { left: vw * 0.22, right: vw * 0.78, top: 80, bottom: vh * 0.7 };
      const cx = (r.left + r.right) / 2;
      if (S.position) {
        const x = U.clamp(S.position.x * vw, 30, vw - 30);
        const y = U.clamp(S.position.y * vh, 160 * s, vh - 6);
        return { x, y, dir: cx >= x ? 1 : -1 };
      }
      const reach = 165 * s;
      const y = U.clamp(Math.min(r.bottom + 40, vh - 150), 200 * s, vh - 30);
      if (vw - r.right > reach * 0.7 + 30) return { x: Math.min(vw - 45, r.right + reach - 15), y, dir: -1 };
      if (r.left > reach * 0.7 + 30) return { x: Math.max(45, r.left - reach + 15), y, dir: 1 };
      return { x: vw - 60, y, dir: -1 };
    }

    // ---------------- scripts ----------------
    function runMain(fn) {
      if (mainCtl) mainCtl.abort();
      const ctl = (mainCtl = new AbortController());
      Promise.resolve()
        .then(() => fn(ctl.signal))
        .catch((e) => {
          if (!U.isAbort(e)) console.error('[WhipCowboy]', e);
        });
      return ctl;
    }
    scope.add(() => {
      if (mainCtl) mainCtl.abort();
      if (eventCtl) eventCtl.abort();
    });

    function resumeDefault() {
      if (drag && drag.active) return;
      if (mode === 'WORKING') runMain(workLoop);
      else if (mode === 'DONE') runMain(doneScript);
      else runMain(idleScript);
    }

    async function enter(signal) {
      stage.ensureAttached();
      const h = home();
      if (onStage) {
        // Left offscreen by an event (rode/stomped away)? Come back in from the edge nearest home.
        if (cowboy.x < -20 || cowboy.x > stage.vw + 20) {
          cowboy.x = h.x < stage.vw / 2 ? -70 : stage.vw + 70;
          cowboy.y = h.y;
        }
        if (Math.hypot(h.x - cowboy.x, h.y - cowboy.y) > 30) await cowboy.walkTo(h.x, h.y, signal);
        cowboy.dir = h.dir;
        return;
      }
      onStage = true;
      cowboy.face.mouth = 'smile';
      cowboy.face.brows = 0;
      cowboy.pose = U.clone(WC.StickFigure.POSES.stand);
      cowboy.coilWhip();
      cowboy.mount(stage.layers.figures);
      if (stage.reduced) {
        Object.assign(cowboy, { x: h.x, y: h.y, dir: h.dir, opacity: 0 });
        await clock.tween(300, (t) => (cowboy.opacity = t), signal);
        return;
      }
      cowboy.opacity = 1;
      cowboy.x = h.x < stage.vw / 2 ? -70 : stage.vw + 70;
      cowboy.y = h.y;
      await cowboy.walkTo(h.x, h.y, signal);
      cowboy.dir = h.dir;
    }

    async function exit(signal) {
      if (!onStage) return;
      bubbles.hide(cowboy);
      if (stage.reduced) await clock.tween(300, (t) => (cowboy.opacity = 1 - t), signal);
      else await cowboy.walkTo(cowboy.x < stage.vw / 2 ? -80 : stage.vw + 80, cowboy.y, signal);
      cowboy.unmount();
      onStage = false;
    }

    const juiceEnv = { stage, clock, scope };
    let combo = 0;
    const bump = (k, n = 1) => {
      if (host.bump) host.bump(k, n);
    };

    async function crackOnce(signal, power) {
      await cowboy.crack(signal, {
        onSnap: (tip) => {
          sfx.play('crack');
          combo++;
          bump('cracks');
          WC.juice.hit(juiceEnv, tip, { lang: S.lang, esc: power > 1, big: power > 1, combo, comboAt: cowboy.toPage([cowboy.headC[0], cowboy.headC[1] - 70]) });
        },
        lenMul: power > 1 ? 1.1 : 1,
      });
    }

    /** Picks what he yells: { text, variant }. Dark humor gets the noir bubble, escalation shouts. */
    function whipLine(first, esc) {
      if (first) return { text: line('whip'), variant: esc ? 'shout' : '' };
      if (S.darkHumor && U.chance(esc ? 0.45 : 0.3)) return { text: line('dark'), variant: 'dark' };
      if (userName() && U.chance(0.35)) return { text: line('userTaunts'), variant: esc ? 'shout' : '' };
      return { text: U.chance(0.4) ? line('whip') : line('taunts'), variant: esc ? 'shout' : '' };
    }
    const yell = (l, o) => bubbles.say(cowboy, l.text, Object.assign({ variant: l.variant }, o));

    async function workLoop(signal) {
      await enter(signal);
      let first = true;
      let nextRoll = U.now() + cfg.timing.eventRollMs;
      while (!signal.aborted) {
        const elapsed = U.now() - workStart;
        const esc = elapsed > S.escalateAfter * 1000;
        cowboy.face.brows = esc ? 1 : 0;
        cowboy.face.mouth = esc ? 'shout' : 'grit';
        await crackOnce(signal, esc ? 1.5 : 1);
        if (esc && U.chance(0.4)) await crackOnce(signal, 1.5); // double crack when escalated
        cowboy.face.mouth = esc ? 'grit' : 'neutral';
        if (first || U.chance(esc ? 0.6 : 0.35)) yell(whipLine(first, esc));
        first = false;

        if (U.now() >= nextRoll) {
          nextRoll = U.now() + cfg.timing.eventRollMs;
          if (maybeRandomEvent(elapsed)) return; // event takes over and resumes us afterwards
        }
        const t = cfg.timing;
        await clock.wait(esc ? U.rand(t.whipEscMinMs, t.whipEscMaxMs) : U.rand(t.whipMinMs, t.whipMaxMs), signal);
        if (!drag) {
          const h = home();
          if (Math.hypot(h.x - cowboy.x, h.y - cowboy.y) > 40) await cowboy.walkTo(h.x, h.y, signal);
          cowboy.dir = h.dir;
        }
      }
    }

    async function doneScript(signal) {
      if (!onStage) {
        mode = 'IDLE';
        return idleScript(signal);
      }
      cowboy.face.brows = 0;
      cowboy.face.mouth = 'smile';
      await cowboy.poseTo(WC.StickFigure.POSES.stand, 200, signal);
      await cowboy.nod(signal);
      if (!stage.reduced) await cowboy.shadesOn(signal); // deal with it
      if (S.darkHumor && U.chance(0.45)) bubbles.say(cowboy, line('darkDone'), { variant: 'dark' });
      else bubbles.say(cowboy, userName() && U.chance(0.4) ? line('doneUser') : line('done'));
      if (combo >= 3) WC.juice.popText(juiceEnv, stage.vw / 2, stage.vh * 0.3, `${combo} HITS!`, { size: 64, rot: -6, rise: 10, ms: 1600, grow: true });
      await clock.wait(1900, signal);
      // Long task? Ride into the sunset.
      if (S.randomEvents && lastDuration > cfg.timing.sunsetAfterMs && WC.events.has('scene-sunset')) {
        mode = 'IDLE';
        runEvent('scene-sunset', { auto: true, afterLongTask: true });
        return;
      }
      await exit(signal);
      mode = 'IDLE';
      if (S.stayOnStage) {
        await clock.wait(cfg.timing.backAfterDoneMs, signal);
        await enter(signal);
      }
    }

    async function idleScript(signal) {
      if (S.stayOnStage) {
        await enter(signal);
        cowboy.face.mouth = 'smile';
        cowboy.face.brows = 0;
      } else await exit(signal);
    }

    // ---------------- events ----------------
    function maybeRandomEvent(elapsed) {
      if (!S.randomEvents || busyEvent) return false;
      const pool = WC.events.list().filter((e) => e.random !== false);
      if (!pool.length) return false;
      const escMs = S.escalateAfter * 1000;
      const p = elapsed < escMs ? 0.12 : Math.min(0.6, 0.22 + 0.08 * ((elapsed - escMs) / cfg.timing.eventRollMs));
      log('random event roll, chance', p.toFixed(2));
      if (!U.chance(p)) return false;
      const total = pool.reduce((s, e) => s + (e.weight || 1), 0);
      let r = Math.random() * total;
      const ev = pool.find((e) => (r -= e.weight || 1) <= 0) || pool[0];
      runEvent(ev.id, { auto: true });
      return true;
    }

    function makeCtx(evScope, signal, opts) {
      const pending = [];
      return {
        WC, U, cfg, stage, clock, cowboy, bubbles, sfx, signal, scope: evScope, opts, site, fmt, userName,
        _pending: pending,
        /** Register a fire-and-forget effect: the event waits for it before ending. */
        bg: (p) => {
          const q = Promise.resolve(p).catch((e) => {
            if (!U.isAbort(e)) console.error('[WhipCowboy] fx', e);
          });
          pending.push(q);
          return q;
        },
        /** Mount a creature (WC.Horse, WC.TRex, WC.Jet, WC.Missile); removed when the event ends. */
        creature: (Cls, o) => {
          const c = new Cls(clock, o);
          c.mount(stage.layers.figures);
          evScope.add(() => {
            if (c.rider) c.detach();
            bubbles.hide(c, true);
            c.unmount();
          });
          return c;
        },
        settings: () => S,
        line,
        /** A dark-humor line for key (dark / darkAfter / darkCrew), or null if dark humor is off. */
        dark: (k = 'dark') => (S.darkHumor ? line(k) : null),
        juice: juiceEnv,
        log,
        say: (fig, text, o) => bubbles.say(fig, text, o),
        wait: (ms) => clock.wait(ms, signal),
        tween: (ms, fn, ease) => clock.tween(ms, fn, signal, ease),
        anchorRect: () => anchorRect() || { left: stage.vw * 0.25, right: stage.vw * 0.75, top: 100, bottom: stage.vh * 0.7 },
        home,
        enter: () => enter(signal),
        exit: () => exit(signal),
        reduced: () => stage.reduced,
        shake: (ms, amp) => stage.shake(clock, ms, amp, signal),
        crack: (fig, o) => fig.crack(signal, Object.assign({ onSnap: (tip) => { sfx.play('crack'); WC.juice.hit(juiceEnv, tip, { lang: S.lang }); } }, o)),
        spawn: (o) => {
          const f = new WC.StickFigure(clock, o);
          f.mount(stage.layers.figures);
          evScope.add(() => {
            bubbles.hide(f, true);
            f.unmount();
          });
          return f;
        },
        el: (tag, cls, layer = 'fx') => {
          const n = document.createElement(tag);
          if (cls) n.className = cls;
          stage.layers[layer].appendChild(n);
          evScope.add(() => n.remove());
          return n;
        },
        svgEl: (layer = 'fx') => {
          const s = WC.art.svg('svg', { class: 'wc-fullsvg', width: stage.vw, height: stage.vh, viewBox: `0 0 ${stage.vw} ${stage.vh}` });
          s.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';
          stage.layers[layer].appendChild(s);
          evScope.add(() => s.remove());
          return s;
        },
        elapsed: () => (mode === 'WORKING' ? U.now() - workStart : 0),
        mode: () => mode,
      };
    }

    async function runEvent(id, opts = {}) {
      const def = WC.events.get(id);
      if (!def || busyEvent || scope.disposed) return;
      busyEvent = id;
      bump('events');
      log('event start:', id, opts.auto ? '(random)' : '');
      if (mainCtl) mainCtl.abort();
      mainCtl = null;
      const ctl = (eventCtl = new AbortController());
      const evScope = scope.child();
      const ctx = makeCtx(evScope, ctl.signal, opts);
      try {
        if (def.needsStage !== false) await enter(ctl.signal);
        await def.play(ctx);
        await Promise.all(ctx._pending);
      } catch (e) {
        if (!U.isAbort(e)) console.error('[WhipCowboy] event', id, e);
      } finally {
        try {
          if (def.cleanup) def.cleanup(ctx);
        } catch (e) {
          console.warn('[WhipCowboy] cleanup', id, e);
        }
        evScope.dispose();
        stage.world.style.transform = '';
        // Reset anything an event may have changed on the cowboy.
        Object.assign(cowboy, { rot: 0, seated: false, held: null, opacity: 1, scale: cfg.cowboyScale, shades: 0 });
        cowboy.face.brows = 0;
        cowboy.face.mouth = 'smile';
        if (cowboy.el.parentNode !== stage.layers.figures && onStage) stage.layers.figures.appendChild(cowboy.el);
        cowboy.pose = Object.assign(cowboy.pose, U.clone(WC.StickFigure.POSES.stand));
        if (eventCtl === ctl) eventCtl = null;
        busyEvent = null;
        log('event end:', id);
        if (!ctl.signal.aborted && !scope.disposed) {
          cowboy.coilWhip();
          resumeDefault();
        }
      }
    }

    // ---------------- detector callbacks ----------------
    function onStart() {
      mode = 'WORKING';
      workStart = U.now();
      combo = 0;
      cowboy.shadesOff();
      if (busyEvent || (drag && drag.active)) return;
      runMain(workLoop);
    }
    let lastDuration = 0;
    function onDone(info) {
      if (mode !== 'WORKING') return;
      mode = 'DONE';
      lastDuration = info.duration;
      bump('waitedMs', Math.round(info.duration));
      bump('responses');
      log('done after', Math.round(info.duration / 1000) + 's');
      if (busyEvent || (drag && drag.active)) return;
      runMain(doneScript);
    }
    function onNavigate() {
      stage.ensureAttached();
      menu.close();
      if (onStage && !busyEvent && !drag) scope.timeout(() => { if (!busyEvent && !drag) resumeDefault(); }, 900);
    }

    // ---------------- interaction: drag + context menu ----------------
    const hit = cowboy.hit;
    const stopFocus = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    scope.listen(hit, 'mousedown', stopFocus);
    scope.listen(hit, 'pointerdown', (e) => {
      stopFocus(e);
      if (e.button !== 0 || busyEvent) return;
      menu.close();
      try { hit.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      drag = { id: e.pointerId, px: e.clientX, py: e.clientY, x: cowboy.x, y: cowboy.y, active: false };
    });
    scope.listen(hit, 'pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
      if (!drag.active && Math.hypot(dx, dy) > 4) {
        drag.active = true;
        if (mainCtl) mainCtl.abort();
        cowboy.coilWhip();
        cowboy.face.mouth = 'o';
        bubbles.hide(cowboy, true);
        cowboy.el.classList.add('wc-dragging');
        cowboy.poseTo(WC.StickFigure.POSES.dangle, 160).catch(() => {});
      }
      if (drag.active) {
        cowboy.x = U.clamp(drag.x + dx, 10, stage.vw - 10);
        cowboy.y = U.clamp(drag.y + dy, 140, stage.vh - 4);
      }
    });
    const endDrag = (e) => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      const wasActive = drag.active;
      drag = null;
      cowboy.el.classList.remove('wc-dragging');
      if (!wasActive) return;
      cowboy.face.mouth = 'smile';
      S.position = { x: cowboy.x / stage.vw, y: cowboy.y / stage.vh };
      host.save({ position: S.position });
      log('position saved', S.position);
      runMain(async (signal) => {
        await cowboy.poseTo(Object.assign({}, WC.StickFigure.POSES.stand), 200, signal);
        cowboy.dir = home().dir;
        resumeDefault();
      });
    };
    scope.listen(hit, 'pointerup', endDrag);
    scope.listen(hit, 'pointercancel', endDrag);
    scope.listen(hit, 'contextmenu', (e) => {
      stopFocus(e);
      menu.open(e.clientX, e.clientY, buildMenu());
    });

    function setSetting(partial) {
      Object.assign(S, partial);
      host.save(partial);
    }

    function buildMenu() {
      const ev = (m) => {
        const has = WC.events.has(m.id);
        return {
          emoji: m.emoji,
          label: mt(m.label),
          disabled: !has || !!busyEvent,
          badge: has ? '' : mt('soon'),
          action: () => runEvent(m.id),
        };
      };
      const speedTxt = (v) => (Math.round(v * 100) / 100).toString().replace('.', S.lang === 'de' ? ',' : '.') + '×';
      return [
        ...WC.EVENT_MENU.map(ev),
        { emoji: '🎬', label: mt('scenes'), submenu: WC.SCENE_MENU.map(ev) },
        { sep: true },
        { label: mt('random'), checked: S.randomEvents, action: () => setSetting({ randomEvents: !S.randomEvents }) },
        { label: mt('bubbles'), checked: S.bubbles, action: () => setSetting({ bubbles: !S.bubbles }) },
        { label: mt('dark'), checked: S.darkHumor, action: () => setSetting({ darkHumor: !S.darkHumor }) },
        { label: mt('sound'), checked: S.sound, action: () => setSetting({ sound: !S.sound }) },
        { label: mt('faster'), hint: speedTxt(S.speed), action: () => setSetting({ speed: U.clamp(Math.round(S.speed * 1.25 * 100) / 100, 0.25, 4) }) },
        { label: mt('slower'), hint: speedTxt(S.speed), action: () => setSetting({ speed: U.clamp(Math.round(S.speed * 0.75 * 100) / 100, 0.25, 4) }) },
        { sep: true },
        { label: mt('quit'), action: quit },
      ];
    }

    function quit() {
      menu.close();
      if (eventCtl) eventCtl.abort();
      runMain(async (signal) => {
        if (onStage) {
          cowboy.face.mouth = 'smile';
          bubbles.say(cowboy, line('bye'));
          await clock.wait(700, signal);
          await exit(signal);
        }
        host.save({ enabled: false });
      });
    }

    function manualWhip() {
      if (busyEvent || (drag && drag.active)) return;
      runMain(async (signal) => {
        await enter(signal);
        cowboy.face.mouth = 'grit';
        await crackOnce(signal, 1);
        cowboy.face.mouth = 'smile';
        yell(whipLine(U.chance(0.5), false));
        queueMicrotask(resumeDefault);
      });
    }

    // Alt+W → whip (use e.code so it works on every keyboard layout, incl. macOS Option+W = "∑").
    scope.listen(window, 'keydown', (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyW' && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        manualWhip();
      }
    }, true);

    let resizeT = 0;
    scope.listen(window, 'resize', () => {
      scope.clearTimeout(resizeT);
      resizeT = scope.timeout(() => {
        if (onStage && !busyEvent && !drag) resumeDefault();
      }, 350);
    });

    // ---------------- boot ----------------
    detector.start();
    if (!detector.working) resumeDefault();
    detectName(0);
    log('started', Object.assign({}, S));

    return {
      update(next) {
        const prev = S;
        S = Object.assign({}, cfg.defaults, next);
        const posChanged = JSON.stringify(prev.position) !== JSON.stringify(S.position);
        if ((posChanged || prev.stayOnStage !== S.stayOnStage) && !busyEvent && !(drag && drag.active)) resumeDefault();
        if (prev.debug !== S.debug && S.debug) log('debug on — site:', site.id, 'mode:', mode, 'name:', userName());
        if (prev.nameMode !== S.nameMode && S.nameMode === 'auto') detectName(0);
      },
      handleMessage(msg) {
        switch (msg && msg.type) {
          case 'wc:test':
            detector.simulate(cfg.timing.testMs);
            return { ok: true };
          case 'wc:stopTest':
            detector.stopSimulation();
            return { ok: true };
          case 'wc:whip':
            manualWhip();
            return { ok: true };
          case 'wc:event':
            runEvent(msg.id);
            return { ok: WC.events.has(msg.id) };
          case 'wc:state':
            return { ok: true, mode, onStage, busyEvent };
          default:
            return { ok: false };
        }
      },
      dispose() {
        scope.dispose();
      },
      // exposed for the dev playground / future desktop port
      _internals: { stage, clock, cowboy, bubbles, detector, runEvent, get mode() { return mode; } },
    };
  };
})();
