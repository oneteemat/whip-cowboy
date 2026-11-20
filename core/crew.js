/* Whip Cowboy — core/crew.js : hand-drawn caricatures for the "dark humor" reinforcements.
 * Satire: history's worst bosses get bossed around by a stick-figure cowboy.
 * No party symbols or insignia — just hair, hats and facial hair (head-local coords: head r=12,
 * face toward +x, eyes at y≈-2, mouth at y≈4–8). Lines live in i18n.js under LINES[lang].crew. */
(() => {
  'use strict';
  const WC = globalThis.WhipCowboy;
  const INK = '#151515';
  const S = `stroke="${INK}" stroke-linejoin="round" stroke-linecap="round"`;

  WC.CREW = {
    hitler: {
      hat: 'none',
      face: `
        <path ${S} stroke-width="1.2" fill="#1b1b1b" d="M-11.5 -5 Q-12 -13 -2 -13.2 Q9 -13 11.6 -6 Q6 -10.5 1 -10 Q4 -6 6.5 -2.5 Q-1 -9 -11.5 -5 Z"/>
        <path fill="#1b1b1b" d="M3.6 2.1 L7.9 2.1 L7.7 4.7 L3.8 4.7 Z"/>`,
    },
    khamenei: {
      hat: 'turban',
      face: `
        <path ${S} stroke-width="1.2" fill="#ececec" d="M-3 1 Q-3.5 15 5 18 Q13.5 15 13 2 Q10 6.5 5 6 Q0 6.5 -3 1 Z"/>
        <path ${S} stroke-width="1" fill="#d4d4d4" d="M0.6 3.2 Q5 1.4 10 3.2 Q5 5.4 0.6 3.2 Z"/>
        <path ${S} stroke-width="0.9" fill="none" d="M0.2 -2 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M5.6 -2 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0"/>`,
    },
    stalin: {
      hat: 'none',
      face: `
        <path ${S} stroke-width="1.2" fill="#3a3a3a" d="M-11.5 -5 Q-11 -14.5 0 -14.2 Q10 -13.6 11.6 -7 Q5 -11.5 -11.5 -5 Z"/>
        <path ${S} stroke-width="0.8" fill="#222" d="M-0.2 2.6 Q5 -0.2 11.2 2.8 Q11.8 6.6 8.4 5 Q5 3.8 2.2 5.2 Q-1 5.8 -0.2 2.6 Z"/>`,
    },
    mussolini: {
      hat: 'fez',
      face: `
        <path ${S} stroke-width="1.6" fill="none" d="M0 -7.4 L4.6 -5.4 M6 -5.4 L10.8 -7.6"/>
        <path ${S} stroke-width="1.5" fill="none" d="M1 9 Q8 15.5 13.5 7"/>`,
    },
    kim: {
      hat: 'none',
      face: `
        <path ${S} stroke-width="1.2" fill="#141414" d="M-11 -6 Q-12 -14.5 -3 -15.8 Q8 -16.2 11.2 -9 L11.6 -6.4 Q8 -10.4 4 -10.8 Q-4 -11.2 -11 -6 Z"/>
        <path fill="#ff9a9a" opacity=".55" d="M6.5 3 a2.4 1.6 0 1 0 0.1 0 Z"/>`,
    },
    napoleon: {
      hat: 'bicorne',
      face: `<path ${S} stroke-width="1.3" fill="none" d="M3.5 -9.5 q3.2 1.6 0.8 4.2"/>`,
    },
  };
  // Order of appearance: the two the boss asked for first.
  WC.CREW_ORDER = ['hitler', 'khamenei', 'stalin', 'mussolini', 'kim', 'napoleon'];

  Object.assign(WC.art.HATS, {
    turban: () => `
      <path ${S} stroke-width="2.4" fill="#141414" d="M-13 -4 Q-14.5 -22 0 -23 Q14.5 -22 13 -4 Q6 -9 0 -9 Q-6 -9 -13 -4 Z"/>
      <path stroke="#4a4a4a" stroke-width="1.4" fill="none" d="M-11 -10 Q0 -16.5 11 -10 M-12 -15.5 Q0 -20 12 -15"/>`,
    fez: () => `
      <path ${S} stroke-width="2.4" fill="#1a1a1a" d="M-7.5 -10 L-6.5 -22 L6.5 -22 L7.5 -10 Z"/>
      <path ${S} stroke-width="1.6" fill="none" d="M0 -22 Q5 -23 6 -16"/>
      <circle cx="6" cy="-15" r="1.6" fill="#1a1a1a"/>`,
    bicorne: () => `
      <path ${S} stroke-width="2.4" fill="#141414" d="M-22 -8 Q-13 -28 0 -22.5 Q13 -28 22 -8 Q0 -13.5 -22 -8 Z"/>
      <circle cx="9" cy="-14" r="3.4" fill="#2f6fd6" stroke="#fff" stroke-width="1"/>
      <circle cx="9" cy="-14" r="1.4" fill="#d93a2b"/>`,
  });
})();
