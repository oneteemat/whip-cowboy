/* Event: ☠️ ULTIMATIVER WELTZERSTÖRER
 * Screen tints red, the whip whirls overhead, comes down → white flash, full-screen shattered
 * glass spreading from the cowboy (stroke-dashoffset cracks), shards fall away, back to normal. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;

  WC.events.register({
    id: 'destroyer',
    label: 'destroyer',
    random: true,
    weight: 1,
    async play(ctx) {
      const { cowboy: c, U } = ctx;
      const fx = WC.fx;
      const P = WC.StickFigure.POSES;
      const N = WC.StickFigure.WHIP_SEGMENTS;
      const hp = c.toPage([0, -70]);
      const tint = fx.tint(ctx, `radial-gradient(circle at ${Math.round(hp[0])}px ${Math.round(hp[1])}px, rgba(255,60,0,.18), rgba(70,0,0,.62) 70%)`);
      c.face.brows = 1;
      c.face.mouth = 'shout';

      // 1) darkness falls, whip whirls overhead
      ctx.say(c, ctx.line('destroyer'), { variant: 'mega', ms: 2400 });
      ctx.sfx.play('charge', { ms: 2000 });
      const glow = fx.glow(ctx, c, '#ff3b1c');
      const W = c.whip;
      W.mode = 'line';
      await Promise.all([
        tint.in(700, 1),
        c.poseTo({ armF: [175, 0], armB: [-40, -30], lean: -6, head: -12, footF: [17, 0], footB: [-15, 0] }, 400, ctx.signal),
      ]);
      await ctx.tween(1700, (t) => {
        glow.set(0.3 + 0.7 * t);
        W.len = 70 + 50 * t;
        const spin = -t * 1440 * (0.6 + t);
        for (let i = 0; i < N; i++) {
          const u = (i + 1) / N;
          W.angles[i] = 180 + spin - 140 * u;
        }
      });

      // 2) the whip comes down
      await ctx.crack(c, {
        lenMul: 1.2,
        throwMs: 160,
        hold: 400,
        onSnap: (p) => {
          glow.set(0);
          ctx.sfx.play('boom');
          ctx.sfx.play('crack');
          fx.flash(ctx, 'rgba(255,255,255,.9)', 380);
          fx.explosion(ctx, p[0], p[1], { size: 1.2 });
          ctx.shake(1000, 24);
          c.face.mouth = 'grin';
          fx.cracks(ctx, p[0], p[1], {
            rays: 18,
            rings: 7,
            drawMs: 900,
            holdMs: 900,
            shatter: true,
            fallMs: 1800,
            shardFill: 'rgba(120,10,10,.28)',
          });
        },
      });
      glow.remove();
      // 3) tint fades as the shards fall
      await ctx.wait(1500);
      await tint.out(1200);
      c.face.brows = 0;
      const d = ctx.dark('darkAfter');
      if (d) ctx.say(c, d, { variant: 'dark', ms: 2600 });
      await c.poseTo(P.stand, 300, ctx.signal);
      await ctx.wait(1200);
    },
  });
})();
