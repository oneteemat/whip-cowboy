/* Whip Cowboy — core/events.js : registry for event modules (core/events/*.js).
 * An event module is: { id, label: menuKey, emoji, random: bool, weight, play(ctx): Promise, cleanup(ctx) }.
 * ctx (built in app.js) gives access to stage, clock, cowboy, bubbles, sfx, spawn(), shake(), etc.
 * Everything an event creates should be registered on ctx.scope so it's removed on abort/quit. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const registry = new Map();

  WC.events = {
    register(def) {
      if (!def || !def.id || typeof def.play !== 'function') throw new Error('Invalid event module');
      registry.set(def.id, def);
    },
    get: (id) => registry.get(id),
    has: (id) => registry.has(id),
    list: () => Array.from(registry.values()),
  };

  // Menu layout (ids may not be registered yet → shown disabled with a "soon" badge).
  WC.EVENT_MENU = [
    { id: 'mega', emoji: '💥', label: 'mega' },
    { id: 'destroyer', emoji: '☠️', label: 'destroyer' },
    { id: 'reinforce', emoji: '📻', label: 'reinforce' },
    { id: 'airstrike', emoji: '✈️', label: 'airstrike' },
    { id: 'duel', emoji: '🤠', label: 'duel' },
    { id: 'jurassic', emoji: '🦖', label: 'jurassic' },
  ];
  WC.SCENE_MENU = [
    { id: 'scene-horse', emoji: '🐎', label: 'sceneHorse' },
    { id: 'duel', emoji: '🤠', label: 'sceneDuel' },
    { id: 'scene-stampede', emoji: '🐴', label: 'sceneStampede' },
    { id: 'scene-sunset', emoji: '🌅', label: 'sceneSunset' },
  ];
})();
