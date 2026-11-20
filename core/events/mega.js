/* Event: 💥 MEGA ULTRA GIGA PEITSCHENSCHLAG
 * Crouch + glowing charge ("Ultra...") → huge crack → explosion, overlay shake, glass cracks
 * → "MEGA ULTRA GIGA KNALL!!!" → "Das war für dich, {ai}!" */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;

  WC.events.register({
    id: 'mega',
    label: 'mega',
    random: true,
    weight: 3,
    async play(ctx) {
      const { cowboy: c, U, fx } = Object.assign({ fx: WC.fx }, ctx);
      const P = WC.StickFigure.POSES;
      const reduced = ctx.reduced();
      c.face.brows = 1;
      c.face.mouth = 'grit';

      // 1) charge up
      ctx.say(c, ctx.line('megaCharge'), { ms: 2300 });
      ctx.sfx.play('charge', { ms: 2200 });
      const glow = fx.glow(ctx, c);
      const ps = fx.particles(ctx);
      await c.poseTo(P.charge, 380, ctx.signal);
      let acc = 0;
      await ctx.tween(2200, (t, raw) => {
        glow.set(t);
        c.pose.x = -2 + (reduced ? 0 : U.rand(-1.5, 1.5) * t);
        c.face.mouth = raw > 0.6 ? 'shout' : 'grit';
        acc += 1;
        if (!reduced && acc % 2 === 0) {
          const hp = c.toPage([0, -70]);
          const a = Math.random() * Math.PI * 2, r = U.rand(90, 160);
          ps.spark(hp[0] + Math.cos(a) * r, hp[1] + Math.sin(a) * r, { vx: (-Math.cos(a) * r) / 380, vy: (-Math.sin(a) * r) / 380, len: 12, life: 380, color: U.pick(['#ffd23f', '#ff8a1c', '#fff2a8']) });
        }
      });

      // 2) the crack
      await ctx.crack(c, {
        lenMul: 1.35,
        throwMs: 170,
        hold: 300,
        onSnap: (p) => {
          ctx.sfx.play('crack');
          ctx.sfx.play('boom');
          glow.set(0);
          fx.flash(ctx, 'rgba(255,236,190,.55)', 240);
          fx.explosion(ctx, p[0], p[1], { size: 1.7, ms: 1000 });
          ctx.shake(700, 16);
          fx.cracks(ctx, p[0], p[1], { radius: Math.max(ctx.stage.vw, ctx.stage.vh) * 0.55, rays: 13, rings: 5, drawMs: 600, holdMs: 2600, fadeMs: 700 });
          c.face.mouth = 'shout';
          ctx.say(c, ctx.line('megaHit'), { variant: 'mega', ms: 2200 });
        },
      });
      glow.remove();

      // 3) satisfaction
      await ctx.wait(1500);
      c.face.brows = 0;
      c.face.mouth = 'grin';
      ctx.say(c, ctx.userName() && U.chance(0.5) ? ctx.line('megaAfterUser') : ctx.line('megaAfter'), { ms: 2500 });
      await c.celebrate(ctx.signal, 2);
      const d = ctx.dark('darkAfter');
      if (d) {
        await ctx.say(c, d, { variant: 'dark', ms: 2400 });
      }
    },
  });
})();
