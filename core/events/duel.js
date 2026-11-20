/* Event: 🤠 Duell gegen {ai}
 * Our cowboy rides in on a brown horse ("Hü!"), a rival "{ai} cowboy" with a sunburst head rides in
 * on a white horse ("Howdy, Peitschenmann."), countdown 3-2-1, both crack, smoke, banter,
 * a random loser falls off, then they ride off. Also used by the Scenes ▸ Duell entry. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;

  /** Shared helper: bring a horse to the cowboy and mount him. Returns the horse. */
  async function mountCowboy(ctx, o = {}) {
    const { cowboy: c, stage } = ctx;
    const ground = Math.min(stage.vh - 18, Math.max(c.y, stage.vh * 0.6));
    const horse = ctx.creature(WC.Horse, { color: o.color || '#8b5a2b', mane: '#3b2412', scale: c.scale, attitude: ctx.settings().darkHumor });
    const fromLeft = c.x < stage.vw / 2;
    horse.x = fromLeft ? -140 : stage.vw + 140;
    horse.y = ground;
    ctx.sfx.play('gallop', { ms: 1600 });
    const stopX = c.x + (fromLeft ? -10 : 10);
    await horse.moveTo(stopX, ground, ctx.signal, 0.45);
    horse.dir = c.dir;
    const sp = horse.toPage(horse.saddle());
    await WC.fx.jumpTo(ctx, c, sp[0], sp[1] + 52 * c.scale, 420, 60);
    horse.attach(c);
    ctx.say(c, ctx.line('horse'), { ms: 1500 });
    if (ctx.settings().darkHumor && o.talk !== false) {
      await ctx.wait(700);
      ctx.say(horse, ctx.line('horseDark'), { variant: 'dark', ms: 2400 });
    }
    return horse;
  }

  async function fall(ctx, rider, horse) {
    const { U } = ctx;
    horse.detach();
    rider.face.mouth = 'o';
    rider.face.brows = 0;
    const sx = rider.x, sy = rider.y, ground = horse.y;
    const back = -rider.dir;
    rider.pose = Object.assign(rider.pose, U.clone(WC.StickFigure.POSES.lie));
    await ctx.tween(520, (t) => {
      rider.x = sx + back * 55 * t;
      rider.y = U.lerp(sy, ground, U.ease.inQuad(t)) - Math.sin(t * Math.PI) * 30;
      rider.rot = -rider.dir * 88 * U.ease.outQuad(t);
    });
    ctx.sfx.play('stomp');
    ctx.shake(200, 5);
    WC.fx.particles(ctx).puff(rider.x, ground - 6, { r0: 8, r1: 30, color: '#d9c7a3', life: 900 });
    await ctx.wait(1100);
    rider.face.mouth = 'frown';
    // climb back on
    rider.rot = 0;
    const sp = horse.toPage(horse.saddle());
    await WC.fx.jumpTo(ctx, rider, sp[0], sp[1] + 52 * rider.scale, 450, 50);
    horse.attach(rider);
  }

  async function play(ctx) {
    const { cowboy: c, U, stage, site } = ctx;
    const fx = WC.fx;
    const ground = stage.vh - 18;
    const left = c.x < stage.vw / 2;
    const ourX = stage.vw * (left ? 0.28 : 0.72), rivalX = stage.vw * (left ? 0.72 : 0.28);

    // 1) our cowboy saddles up and rides to his mark
    const horse = await mountCowboy(ctx);
    ctx.sfx.play('gallop', { ms: 1400 });
    await horse.moveTo(ourX, ground, ctx.signal, 0.4);
    horse.dir = left ? 1 : -1;

    // 2) the rival
    const rv = site.rival;
    const rival = ctx.spawn({ hat: 'none', head: rv.head, scale: c.scale });
    rival.face.mouth = 'smile';
    const rHorse = ctx.creature(WC.Horse, { color: rv.horse, mane: rv.mane, blanket: '#2f6fd6', scale: c.scale, attitude: ctx.settings().darkHumor });
    rHorse.x = left ? stage.vw + 160 : -160;
    rHorse.y = ground;
    rHorse.attach(rival);
    ctx.sfx.play('gallop', { ms: 1800 });
    await rHorse.moveTo(rivalX, ground, ctx.signal, 0.42);
    rHorse.dir = left ? -1 : 1;
    await ctx.say(rival, ctx.line('duelHowdy'), { ms: 2000 });

    // 3) countdown
    c.face.brows = 1;
    c.face.mouth = 'grit';
    rival.face.brows = 1;
    for (const [n, f] of [['3', 660], ['2', 660], ['1', 990]]) {
      ctx.sfx.play('beep', { freq: f });
      await fx.bigText(ctx, n, { ms: 850, y: stage.vh * 0.36 });
    }

    // 4) draw!
    const ps = fx.particles(ctx);
    let bangs = 0;
    const boom = (p) => {
      ctx.sfx.play(bangs++ ? 'crack' : 'bang');
      for (let i = 0; i < 5; i++) ps.puff(p[0] + U.rand(-20, 20), p[1] + U.rand(-15, 15), { r0: 8, r1: U.rand(26, 44), life: U.rand(1200, 1800), vy: -0.015, color: U.pick(['#e9e9e9', '#d4d4d4']) });
    };
    await Promise.all([ctx.crack(c, { lenMul: 1.2, onSnap: boom }), ctx.crack(rival, { lenMul: 1.2, onSnap: boom })]);
    const mid = [(c.x + rival.x) / 2, ground - 110];
    for (let i = 0; i < 8; i++) ps.puff(mid[0] + U.rand(-60, 60), mid[1] + U.rand(-30, 30), { r0: 10, r1: U.rand(30, 55), life: U.rand(1500, 2200), vy: -0.012, color: '#e2e2e2' });
    ctx.shake(250, 6);
    await ctx.wait(500);

    // 5) banter
    c.face.mouth = 'neutral';
    await ctx.say(c, ctx.line('duelEnough'), { ms: 1900 });
    rival.face.mouth = 'frown';
    await ctx.say(rival, ctx.line('duelRules'), { ms: 2300 });

    // 6) somebody hits the dirt
    const weLose = Math.random() < 0.5;
    if (weLose) await fall(ctx, c, horse);
    else await fall(ctx, rival, rHorse);
    (weLose ? rival : c).face.mouth = 'grin';
    if (ctx.settings().darkHumor) await ctx.say(weLose ? rival : c, ctx.line(weLose ? 'duelLose' : 'duelWin'), { variant: 'dark', ms: 2600 });
    await ctx.wait(400);

    // 7) ride off into opposite directions
    c.face.brows = 0;
    rival.face.brows = 0;
    ctx.sfx.play('gallop', { ms: 2000 });
    await Promise.all([
      horse.moveTo(left ? -180 : stage.vw + 180, ground, ctx.signal, 0.5),
      rHorse.moveTo(left ? stage.vw + 180 : -180, ground, ctx.signal, 0.5),
    ]);
    horse.detach();
    c.x = left ? -80 : stage.vw + 80; // he'll walk back in from here
  }

  WC.duelHelpers = { mountCowboy, fall };
  WC.events.register({ id: 'duel', label: 'duel', random: true, weight: 1, play });
})();
