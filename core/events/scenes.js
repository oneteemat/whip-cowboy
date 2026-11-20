/* Scenes ▸ — Ausritt (horse ride), Stampede, Sonnenuntergang (sunset). "Duell" reuses the duel event.
 * Sunset also plays automatically when a long task finishes (see app.js doneScript). */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const COLORS = [['#8b5a2b', '#3b2412'], ['#ececec', '#9a9a9a'], ['#2b2b2b', '#111'], ['#b5651d', '#5a2e0c'], ['#d9b38c', '#7a5230'], ['#6e4b3a', '#2d1d14']];

  // 🐎 Horse ride: saddle up and gallop across the screen.
  WC.events.register({
    id: 'scene-horse',
    label: 'sceneHorse',
    random: true,
    weight: 1,
    async play(ctx) {
      const { cowboy: c, stage } = ctx;
      const horse = await WC.duelHelpers.mountCowboy(ctx);
      const toRight = c.x < stage.vw / 2;
      c.face.mouth = 'grin';
      ctx.sfx.play('gallop', { ms: 3200 });
      const ps = WC.fx.particles(ctx);
      const dust = ctx.clock.add(() => {
        if (!ctx.reduced() && Math.random() < 0.25) ps.puff(horse.x - horse.dir * 30, horse.y - 4, { r0: 5, r1: 20, color: '#d9c7a3', life: 700, vy: -0.01 });
      });
      ctx.scope.add(dust);
      await horse.moveTo(toRight ? stage.vw + 180 : -180, horse.y, ctx.signal, 0.42);
      horse.detach();
      c.x = toRight ? stage.vw + 80 : -80;
    },
  });

  // 🐴 Stampede: a herd thunders across the bottom of the screen.
  WC.events.register({
    id: 'scene-stampede',
    label: 'sceneStampede',
    random: true,
    weight: 1,
    async play(ctx) {
      const { cowboy: c, stage, U } = ctx;
      const ltr = Math.random() < 0.5;
      const n = Math.floor(U.rand(5, 8));
      c.face.mouth = 'o';
      c.face.brows = 1;
      ctx.say(c, ctx.line('stampede'), { variant: 'alarm', ms: 2000 });
      await c.poseTo(WC.StickFigure.POSES.duck, 300, ctx.signal);
      ctx.sfx.play('gallop', { ms: 4200 });
      const ps = WC.fx.particles(ctx);
      const rows = [];
      for (let i = 0; i < n; i++) rows.push({ y: stage.vh - 10 - U.rand(0, 120), s: U.rand(0.75, 1.2) });
      rows.sort((a, b) => a.y - b.y); // farther (higher) ones first → drawn behind
      const herd = rows.map((r, i) => {
        const [col, mane] = COLORS[i % COLORS.length];
        const h = ctx.creature(WC.Horse, { color: col, mane, saddle: false, attitude: ctx.settings().darkHumor, scale: r.s * (0.75 + (r.y / stage.vh) * 0.35) });
        h.x = ltr ? -200 - U.rand(0, 300) : stage.vw + 200 + U.rand(0, 300);
        h.y = r.y;
        return h;
      });
      const rumble = ctx.clock.add(() => {
        if (ctx.reduced()) return;
        if (Math.random() < 0.08) ctx.shake(120, 3);
        const h = U.pick(herd);
        if (h.x > -50 && h.x < stage.vw + 50 && Math.random() < 0.5) ps.puff(h.x - h.dir * 30, h.y - 4, { r0: 6, r1: 26, color: '#d9c7a3', life: 900, vy: -0.015 });
      });
      ctx.scope.add(rumble);
      if (ctx.settings().darkHumor) {
        // the one in front panics about its future
        const loud = herd[herd.length - 1];
        ctx.scope.timeout(() => ctx.say(loud, ctx.line('stampedeHorse'), { variant: 'shout', ms: 1800 }), 900);
      }
      await Promise.all(herd.map((h) => h.moveTo(ltr ? stage.vw + 260 : -260, h.y, ctx.signal, U.rand(0.42, 0.62))));
      rumble();
      c.face.brows = 0;
      c.face.mouth = 'smile';
      await c.poseTo(WC.StickFigure.POSES.stand, 300, ctx.signal);
      ctx.say(c, ctx.line('yeehaw'), { ms: 1500 });
      await ctx.wait(800);
    },
  });

  // 🌅 Sunset: ride off into a sunset gradient (auto-plays after long tasks).
  WC.events.register({
    id: 'scene-sunset',
    label: 'sceneSunset',
    random: false,
    async play(ctx) {
      const { cowboy: c, stage, U } = ctx;
      const vw = stage.vw, vh = stage.vh;
      const horizon = vh * 0.8;
      const toRight = c.x < vw / 2;
      const sunX = toRight ? vw * 0.78 : vw * 0.22;
      const sky = WC.fx.tint(ctx, `linear-gradient(to bottom, rgba(40,20,70,0) 0%, rgba(120,40,110,.55) 40%, rgba(240,110,60,.85) 72%, rgba(255,190,90,.95) 80%, rgba(60,25,40,.97) 80.2%, rgba(30,12,24,.98) 100%)`);
      const sun = ctx.el('div', '', 'back');
      sun.style.cssText = `position:absolute;left:${sunX - 110}px;top:${horizon - 110}px;width:220px;height:220px;border-radius:50%;` +
        'background:radial-gradient(circle,#fff3b0 0%,#ffcf4a 45%,#ff8a3d 75%,rgba(255,120,60,0) 100%);opacity:0;' +
        `clip-path:inset(0 0 50% 0);will-change:transform`;
      await sky.in(1200, 1);
      sun.style.opacity = '1';
      const horse = await WC.duelHelpers.mountCowboy(ctx, { talk: false });
      c.face.mouth = 'smile';
      ctx.say(c, ctx.settings().darkHumor ? ctx.line('sunsetDark') : ctx.line('done'), { ms: 2600, variant: ctx.settings().darkHumor ? 'dark' : '' });
      // ride into the distance: smaller, toward the horizon, fading
      const sx = horse.x, sy = horse.y, s0 = horse.scale, cs0 = c.scale;
      ctx.sfx.play('gallop', { ms: 4000 });
      horse.moving = true;
      horse.speed = 0.3;
      await ctx.tween(4200, (t) => {
        const e = U.ease.inOut(t);
        horse.x = U.lerp(sx, sunX, e);
        horse.y = U.lerp(sy, horizon + 4, e);
        horse.scale = s0 * (1 - 0.8 * e);
        c.scale = cs0 * (1 - 0.8 * e);
        horse.opacity = c.opacity = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
        sun.style.transform = `translateY(${(t * 50).toFixed(1)}px)`;
      });
      horse.moving = false;
      horse.detach();
      await Promise.all([sky.out(1200), ctx.tween(1200, (t) => (sun.style.opacity = String(1 - t)))]);
      c.opacity = 1;
      c.scale = cs0;
      c.x = toRight ? vw + 80 : -80;
      c.y = U.clamp(sy, 150, vh - 10);
      if (ctx.opts && ctx.opts.afterLongTask) await ctx.wait(ctx.cfg.timing.backAfterDoneMs);
    },
  });
})();
