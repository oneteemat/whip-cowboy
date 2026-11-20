/* Event: 🦖 Jurassic Peitsche
 * Distant footsteps shake the screen → a T-rex stomps in and roars in the cowboy's face →
 * he jumps on and whips it → it chomps the chat (bite marks) → stomps off carrying him.
 * Dark humor: a meteor hits right where they went; the cowboy staggers back out, smoking. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;

  WC.events.register({
    id: 'jurassic',
    label: 'jurassic',
    random: true,
    weight: 1,
    async play(ctx) {
      const { cowboy: c, stage, U } = ctx;
      const juice = (x, y, text, o) => WC.juice.popText(ctx.juice, x, y, text, o);
      const dark = ctx.settings().darkHumor;
      const ground = stage.vh - 6;
      const fromLeft = c.x > stage.vw / 2; // it comes from the far side, toward him
      const rex = ctx.creature(WC.TRex, { scale: U.clamp(stage.vh / 720, 0.7, 1.05) });
      rex.x = fromLeft ? -320 : stage.vw + 320;
      rex.y = ground;
      rex.dir = fromLeft ? 1 : -1;
      const ps = WC.fx.particles(ctx);
      const edgeX = fromLeft ? 70 : stage.vw - 70;

      // 1) Something big is coming…
      c.face.mouth = 'o';
      for (let i = 0; i < 3; i++) {
        ctx.sfx.play('stomp');
        ctx.shake(180, 3 + i * 2);
        juice(edgeX + U.rand(-20, 20), ground - 60 - i * 20, ctx.line('rexStomp'), { size: 22 + i * 8, fill: '#e2d3a8', rot: U.rand(-10, 10) });
        await ctx.wait(520);
      }
      ctx.say(c, ctx.line('rexIncoming'), { ms: 1500 });
      // he drops down to ground level to face whatever it is
      await WC.fx.jumpTo(ctx, c, c.x, ground, 520, 40);
      c.dir = fromLeft ? -1 : 1;

      // 2) Stomp in
      let steps = 0;
      rex.onStep = () => {
        ctx.sfx.play('stomp');
        ctx.shake(160, 5);
        const fx = rex.x + rex.dir * U.rand(-30, 20) * rex.scale;
        if (!ctx.reduced()) for (let i = 0; i < 3; i++) ps.puff(fx + U.rand(-18, 18), ground - 4, { r0: 6, r1: U.rand(18, 30), color: '#d9c7a3', life: 750, vy: -0.012 });
        if (steps++ % 2 === 0) juice(fx, ground - 30, ctx.line('rexStomp'), { size: 26, fill: '#e2d3a8' });
      };
      const stopX = c.x - rex.dir * (130 * rex.scale + 40); // mouth right in his face
      await rex.moveTo(stopX, ground, ctx.signal, 0.24);
      rex.onStep = null;

      // 3) Roar in his face
      c.dir = -rex.dir;
      ctx.sfx.play('roar');
      const mp = rex.mouthPage();
      juice(mp[0] + rex.dir * 40, mp[1] - 30, ctx.line('rexRoar'), { size: 48, fill: '#ff4d2e', rise: 14, ms: 1300, grow: true });
      ctx.shake(700, 9);
      c.face.mouth = 'o';
      const roarDone = rex.roar(ctx.signal, 1100);
      await c.poseTo({ lean: -22, head: -14, armF: [150, 40], armB: [-150, -40] }, 250, ctx.signal);
      await roarDone;
      c.face.mouth = 'grit';
      if (dark) await ctx.say(c, ctx.line('rexGood'), { ms: 1600 });

      // 4) Saddle up and whip it
      await c.poseTo(WC.StickFigure.POSES.stand, 150, ctx.signal);
      const sp = rex.toPage(rex.saddle());
      await WC.fx.jumpTo(ctx, c, sp[0], sp[1] + 52 * c.scale, 560, 90);
      rex.attach(c);
      ctx.say(c, ctx.line('horse'), { ms: 1300 });
      c.face.brows = 1;
      await ctx.crack(c);
      ctx.sfx.play('roar');
      rex.roar(ctx.signal, 700);
      ctx.shake(500, 7);
      await ctx.wait(1000);

      // 5) It eats the chat
      for (let i = 0; i < 2; i++) {
        await rex.chomp(ctx.signal, (p) => {
          ctx.sfx.play('chomp');
          ctx.shake(160, 6);
          WC.fx.biteMark(ctx, p[0] + rex.dir * 10, p[1], { r: 30 + i * 6 });
          juice(p[0], p[1] - 40, ctx.line('rexBite'), { size: 36, fill: '#ffffff', rot: U.rand(-14, 14) });
        });
        await ctx.wait(180);
      }
      await ctx.say(c, dark ? ctx.line('rexChomp') : ctx.line('rexChompClean'), { variant: dark ? 'dark' : '', ms: 1900 });
      if (dark) ctx.say(rex, ctx.line('rexDark', 0), { variant: 'dark', ms: 2400 });
      c.face.brows = 0;
      c.face.mouth = 'grin';

      // 6) Stomp off with the cowboy aboard
      const exitX = fromLeft ? stage.vw + 340 : -340;
      rex.onStep = () => {
        ctx.sfx.play('stomp');
        ctx.shake(140, 4);
      };
      await rex.moveTo(exitX, ground, ctx.signal, 0.34);
      rex.onStep = null;
      rex.detach();
      c.x = fromLeft ? stage.vw + 90 : -90;
      c.y = U.clamp(c.y, 150, stage.vh - 10);

      if (!dark) return;
      // 7) …the meteor did come after all.
      const hitX = fromLeft ? stage.vw - 30 : 30;
      await WC.fx.meteor(ctx, fromLeft ? stage.vw * 0.35 : stage.vw * 0.65, -80, hitX, ground - 30, 950);
      ctx.sfx.play('boom');
      WC.fx.flash(ctx, 'rgba(255,200,120,.6)', 350);
      WC.fx.explosion(ctx, hitX, ground - 40, { size: 2.3, ms: 1100 });
      ctx.shake(900, 18);
      juice(fromLeft ? stage.vw - 180 : 180, ground - 170, ctx.line('meteorBoom'), { size: 64, fill: '#ffd23f', rot: -8, rise: 10, ms: 1400, grow: true });
      await ctx.wait(1400);

      // He staggers back in, smoking.
      const h = ctx.home();
      c.face.mouth = 'o';
      c.face.brows = 0;
      c.y = h.y;
      const smoke = ctx.clock.add(() => {
        if (!ctx.reduced() && Math.random() < 0.3) {
          const p = c.toPage([c.headC[0], c.headC[1] - 26]);
          ps.puff(p[0], p[1], { r0: 4, r1: 16, color: '#7a7a7a', life: 900, vy: -0.04 });
        }
      });
      ctx.scope.add(smoke);
      await c.walkTo(fromLeft ? stage.vw - 110 : 110, h.y, ctx.signal, { speed: 0.12 });
      await ctx.say(c, ctx.line('meteorFine'), { ms: 2000 });
      smoke();
    },
  });
})();
