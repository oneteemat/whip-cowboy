/* Whip Cowboy — core/config.js
 * Timings and default settings. DOM selectors per site live in core/sites.js. */
(() => {
  'use strict';
  const WC = (globalThis.WhipCowboy = globalThis.WhipCowboy || {});

  WC.config = {
    // Selectors come from the active site profile in core/sites.js.
    get selectors() {
      return WC.site.selectors;
    },
    // If no selector above matches but the last response's text keeps growing, treat that as "working".
    useTextGrowthFallback: true,

    timing: {
      pollMs: 700, // safety poll in addition to the MutationObserver
      mutationThrottleMs: 150,
      settleDoneMs: 1300, // must be "not working" this long before DONE (stop button flickers)
      stallDoneMs: 20000, // safety net: 'working' but no page change for this long → DONE (0 = off)
      whipMinMs: 2400, // pause between cracks (normal)
      whipMaxMs: 3400,
      whipEscMinMs: 1000, // pause between cracks once escalated
      whipEscMaxMs: 1600,
      eventRollMs: 15000, // how often a random event may be rolled while working
      testMs: 25000, // popup "Test" button duration
      backAfterDoneMs: 4500, // with "stay on stage": walk back in this long after leaving
      sunsetAfterMs: 60000, // a task longer than this ends with the Sunset scene (if random events are on)
    },

    cowboyScale: 1.1,

    // Settings stored in chrome.storage.sync (or any host storage).
    defaults: {
      enabled: true,
      lang: 'de',
      randomEvents: true,
      bubbles: true,
      sound: false,
      volume: 0.6,
      speed: 1,
      escalateAfter: 20,
      stayOnStage: true,
      debug: false,
      position: null, // {x, y} as fractions of the viewport, or null = auto
      darkHumor: true,
      nameMode: 'auto', // 'auto' (read from the site), 'custom', 'off'
      customName: '',
      sites: { claude: true, chatgpt: true, gemini: true },
    },
  };
})();
