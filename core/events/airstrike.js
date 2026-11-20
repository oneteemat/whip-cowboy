/* Event: ✈️ Luftangriff anfordern
 * Radio call → "ACHTUNG!!!" → a cartoon fighter jet streaks diagonally (speed lines + smoke trail)
 * and drops green missiles that hit the response area → explosions + shake. The cowboy ducks. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;

  WC.events.register({
    id: 'airstrike',
    label: 'airstrike',
    random: true,
    weight: 2,
    async play(ctx) {
      const { cowboy: c, U, stage } = ctx;
      const fx = WC.fx;
      const P = WC.StickFigure.POSES;
      await WC.fx.radioCall(ctx);

      c.face.mouth = 'o';
      c.face.brows = 1;
      ctx.say(c, ctx.line('alarm'), { variant: 'alarm', ms: 2400 });
      await ctx.wait(500);
      await c.poseTo(P.duck, 300, ctx.signal);

      const a = ctx.anchorRect();
      const targets = [0, 1, 2].map((i) => [
        U.lerp(a.left + 40, a.right - 40, (i + 0.5) / 3 + U.rand(-0.08, 0.08)),
        U.clamp(U.rand(a.top + 30, a.bottom - 20), 90, stage.vh - 120),
      ]);

      const ltr = c.x > stage.vw / 2; // always flies away from the cowboy's side
      const ps = fx.particles(ctx);
      const strikes = [];
      const dark = ctx.settings().darkHumor;
      if (dark) {
        // WWII dive bomber: screaming dive, drops bombs at the bottom, pulls up and away.
        const plane = ctx.creature(WC.DiveBomber, { scale: 1.1 });
        const midX = (targets[0][0] + targets[2][0]) / 2;
        const P0 = [ltr ? -160 : stage.vw + 160, -120];
        const P1 = [midX, stage.vh * 0.95];
        const P2 = [ltr ? stage.vw + 220 : -220, stage.vh * 0.05];
        plane.dir = ltr ? 1 : -1;
        ctx.sfx.play('siren', { ms: 1700 });
        const dropped = [false, false, false];
        await ctx.tween(2500, (t) => {
          const u = 1 - t;
          plane.x = u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0];
          plane.y = u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1];
          const vx = 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
          const vy = 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
          plane.rot = ltr ? (Math.atan2(vy, vx) * 180) / Math.PI : (-Math.atan2(vy, -vx) * 180) / Math.PI;
          if (!ctx.reduced() && Math.random() < 0.6) {
            const tp = plane.tail();
            ps.puff(tp[0], tp[1], { r0: 4, r1: U.rand(16, 26), life: 1000, vy: -0.005, color: '#bdbdbd' });
          }
          for (let i = 0; i < 3; i++) {
            if (!dropped[i] && t >= 0.36 + i * 0.07) {
              dropped[i] = true;
              strikes.push(missile(ctx, [plane.x, plane.y + 14], targets[i], ps, WC.Bomb, 800));
            }
          }
        }, U.ease.inOut);
      } else {
        const jet = ctx.creature(WC.Jet, { scale: 1.15 });
        const sx = ltr ? -220 : stage.vw + 220, ex = ltr ? stage.vw + 260 : -260;
        const sy = stage.vh * 0.08, ey = stage.vh * 0.42;
        jet.dir = ltr ? 1 : -1;
        jet.rot = (Math.atan2(ey - sy, Math.abs(ex - sx)) * 180) / Math.PI * (ltr ? 1 : -1);
        jet.el.style.filter = ctx.reduced() ? '' : 'blur(.4px)';
        ctx.sfx.play('whoosh', { ms: 1800 });
        const dropped = [false, false, false];
        await ctx.tween(1800, (t) => {
          jet.x = U.lerp(sx, ex, t);
          jet.y = U.lerp(sy, ey, t);
          if (!ctx.reduced() && Math.random() < 0.7) {
            const tp = jet.tail();
            ps.puff(tp[0], tp[1], { r0: 5, r1: U.rand(18, 30), life: 1100, vy: -0.005, color: '#e4e4e4' });
          }
          for (let i = 0; i < 3; i++) {
            if (!dropped[i] && t >= 0.22 + i * 0.13) {
              dropped[i] = true;
              strikes.push(missile(ctx, [jet.x, jet.y + 10], targets[i], ps));
            }
          }
        });
      }
      await Promise.all(strikes);
      await ctx.wait(500);
      c.face.brows = 0;
      c.face.mouth = 'grin';
      await c.poseTo(P.stand, 300, ctx.signal);
      const d = ctx.settings().darkHumor ? ctx.line(U.chance(0.5) ? 'bomberDark' : 'darkAfter') : null;
      ctx.say(c, d || ctx.line('yeehaw'), { variant: d ? 'dark' : '', ms: 2600 });
      await c.celebrate(ctx.signal, 1);
    },
  });

  async function missile(ctx, from, to, ps, Cls = WC.Missile, ms = 650) {
    const { U } = ctx;
    const m = ctx.creature(Cls, { scale: 1 });
    const dx = to[0] - from[0], dy = to[1] - from[1];
    m.dir = 1;
    m.rot = (Math.atan2(dy, dx) * 180) / Math.PI;
    await ctx.tween(ms, (t) => {
      m.x = from[0] + dx * t;
      m.y = from[1] + dy * t;
      if (!ctx.reduced()) {
        const tp = m.tail();
        ps.puff(tp[0], tp[1], { r0: 3, r1: 12, life: 700, vy: -0.01, color: '#f0f0f0' });
      }
    }, U.ease.inQuad);
    m.unmount();
    ctx.sfx.play('boom');
    WC.fx.explosion(ctx, to[0], to[1], { size: 0.9 });
    ctx.shake(280, 9);
  }
})();
