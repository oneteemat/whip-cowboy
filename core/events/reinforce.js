/* Event: 📻 Verstärkung rufen
 * Walkie-talkie call → 5–8 stick figures with different hats run in from both sides, each with
 * a bubble → everyone whips in sync → they run off. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;

  const HATS = [
    ['redcap'], ['hardhat'], ['bluecap'], ['tophat'], ['beanie'], ['sombrero'],
    ['cowboy', '#4b4b4b'], ['beanie', '#8e44ad'], ['redcap', '#f39c12'],
  ];

  WC.events.register({
    id: 'reinforce',
    label: 'reinforce',
    random: true,
    weight: 2,
    async play(ctx) {
      const { cowboy: c, U, stage } = ctx;
      await WC.fx.radioCall(ctx);

      // Roster: with dark humor on, history's worst bosses report for duty (plus a grunt or two).
      const dark = ctx.settings().darkHumor;
      const hats = HATS.slice().sort(() => Math.random() - 0.5);
      const roster = [];
      if (dark) {
        for (const id of WC.CREW_ORDER) roster.push(Object.assign({ id }, WC.CREW[id]));
        for (let i = 0, k = Math.floor(U.rand(0, 3)); i < k; i++) roster.push({ hat: hats[i][0], hatColor: hats[i][1] });
      } else {
        for (let i = 0, k = Math.floor(U.rand(5, 9)); i < k; i++) roster.push({ hat: hats[i % hats.length][0], hatColor: hats[i % hats.length][1] });
      }
      const n = roster.length;
      const crewLine = (id, i) => ctx.fmt(WC.i18n.LINES[ctx.settings().lang === 'en' ? 'en' : 'de'].crew[id][i]);
      const a = ctx.anchorRect();
      const acx = (a.left + a.right) / 2;
      // Spread the crew across the whole screen in three staggered rows, keeping clear of the
      // cowboy. Rows further up the screen are "further back": smaller and drawn first.
      const margin = 55;
      const m = n + 1;
      let xs = Array.from({ length: m }, (_, i) => margin + ((stage.vw - 2 * margin) * (i + 0.5)) / m);
      xs.sort((p, q) => Math.abs(p - c.x) - Math.abs(q - c.x));
      xs = xs.slice(1).sort((p, q) => p - q); // drop the slot the cowboy is standing in
      // Rows from the cowboy's height down to the bottom of the screen.
      const top = U.clamp(c.y - 10, 210, stage.vh - 40), bottom = stage.vh - 12;
      const ROWS = [0, 0.5, 1].map((k) => U.lerp(top, bottom, k));
      const slots = xs.map((x, i) => {
        const row = [1, 0, 2][i % 3];
        if (Math.abs(x - c.x) < 60) x += x < c.x ? -45 : 45;
        return {
          x: U.clamp(x + U.rand(-12, 12), 30, stage.vw - 30),
          y: U.clamp(ROWS[row] + U.rand(-14, 14), 190, stage.vh - 8),
          back: row === 0,
        };
      });
      slots.sort((p, q) => p.y - q.y); // back (higher) ones mount first
      // keep the roster order mapped left→right-ish by shuffling assignment, but dictators stay recognizable
      const order = slots.map((_, i) => i).sort(() => Math.random() - 0.5);

      const crew = slots.map((s, i) => {
        const r = roster[order.indexOf(i)];
        const f = ctx.spawn({ hat: r.hat, hatColor: r.hatColor, face: r.face, scale: c.scale * (s.back ? U.rand(0.8, 0.88) : U.rand(0.92, 1)) });
        f.crewId = r.id;
        f.fromX = i % 2 ? -60 : stage.vw + 60;
        f.x = f.fromX;
        f.y = s.y;
        f.face.mouth = 'grin';
        f.slot = s;
        return f;
      });
      if (c.el.parentNode) c.el.parentNode.appendChild(c.el); // keep the boss in front

      // Run in, staggered, each reporting for duty.
      await Promise.all(
        crew.map((f, i) =>
          ctx.wait(i * 170).then(async () => {
            await f.walkTo(f.slot.x, f.slot.y, ctx.signal, { run: true });
            f.dir = acx >= f.x ? 1 : -1;
            if (f.crewId) return; // dictators speak in a roll call below
            {
              const d = ctx.dark('darkCrew');
              ctx.say(f, d || ctx.line('reinforce', i), { ms: 1900, variant: d ? 'dark' : '' });
            }
          })
        )
      );
      c.dir = acx >= c.x ? 1 : -1;
      // Roll call, one at a time so the bubbles don't pile up.
      for (const id of WC.CREW_ORDER) {
        const f = crew.find((x) => x.crewId === id);
        if (!f) continue;
        f.face.mouth = 'shout';
        ctx.say(f, crewLine(id, 0), { ms: 1600, variant: id === 'khamenei' ? 'shout' : '' });
        await ctx.wait(1150);
        f.face.mouth = 'grin';
      }
      await ctx.wait(500);

      // Synchronized whipping!
      c.face.mouth = 'shout';
      for (let v = 0; v < 3; v++) {
        let snapped = false;
        const team = [c, ...crew];
        team.forEach((f) => (f.face.mouth = 'grit'));
        await Promise.all(
          team.map((f) =>
            f.crack(ctx.signal, {
              onSnap: () => {
                if (!snapped) {
                  snapped = true;
                  ctx.sfx.play('crack');
                  if (v === 2) ctx.shake(250, 5);
                }
              },
            })
          )
        );
        if (v === 0) ctx.say(c, ctx.line('whip'));
        await ctx.wait(300);
      }
      crew.forEach((f) => (f.face.mouth = 'smile'));
      c.face.mouth = 'grin';
      await ctx.wait(400);
      if (dark) {
        const h = crew.find((f) => f.crewId === 'hitler');
        if (h) {
          h.face.mouth = 'shout';
          await ctx.say(h, crewLine('hitler', 1), { variant: 'shout', ms: 1700 });
        }
        ctx.say(c, ctx.line('crewEnd'), { variant: 'dark', ms: 3000 }); // while they run off
      }

      // Dismissed.
      await Promise.all(crew.map((f, i) => ctx.wait(i * 90).then(() => f.walkTo(f.fromX, f.y, ctx.signal, { run: true }))));
    },
  });
})();
