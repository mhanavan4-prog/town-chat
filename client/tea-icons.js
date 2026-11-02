// ---------------------------------------------------------------------------
// Tea icons — The Hearth Path. Hand-drawn SVGs (no emoji) in the same carved-
// talisman language as the plant icons: a bone witch's-teacup, tinted to each
// brew, with rising steam and a signature motif — the herb that made it, or the
// sabbat it belongs to. Drawn on a 0 0 44 44 grid; keyed by tea id and merged
// into UI_ICONS so uiIcon('chamomile_tea') resolves everywhere.
// ---------------------------------------------------------------------------

const tiS = (inner) =>
  `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" ` +
  `stroke-linejoin="round" stroke-linecap="round" class="uiIcon">${inner}</svg>`;

// The shared cup: steam, the rising motif (the brew's essence), a saucer, a
// handle and a bone cup with a tinted liquid surface. `motif` sits above the cup.
const tiCup = (liquid, motif, rim) => tiS(`
  <path d="M16.5 18 Q14.5 15 16.3 12 Q18 9.3 16.5 6.6" stroke="#e4d2a7" stroke-width="1.3" fill="none" opacity="0.65"/>
  <path d="M27.5 18 Q29.5 15 27.7 12 Q26 9.3 27.5 6.6" stroke="#e4d2a7" stroke-width="1.3" fill="none" opacity="0.65"/>
  ${motif}
  <ellipse cx="22" cy="38" rx="13.5" ry="3" fill="#e4d2a7" stroke="#c9b488" stroke-width="1"/>
  <path d="M31.5 25 Q39.5 25 38.3 30.5 Q37.2 34 31 33.6" fill="none" stroke="#e4d2a7" stroke-width="2.4"/>
  <path d="M11.4 22 L32.6 22 Q32 35.5 22 35.5 Q12 35.5 11.4 22 Z" fill="#f3e7cb" stroke="#d9c49a" stroke-width="1.2"/>
  <ellipse cx="22" cy="22.2" rx="10.2" ry="2.9" fill="${liquid}" stroke="${rim || 'rgba(60,40,24,0.35)'}" stroke-width="0.8"/>
  <path d="M13.5 23.5 Q22 27.5 30.5 23.5" fill="none" stroke="rgba(60,40,24,0.14)" stroke-width="1"/>
`);

// A rounder teapot for the "greater" two-herb draughts — reads as a bigger brew.
const tiPot = (liquid, motif) => tiS(`
  <path d="M18 15 Q16 12.5 17.6 10 Q19 7.8 17.8 5.6" stroke="#e4d2a7" stroke-width="1.2" fill="none" opacity="0.6"/>
  <path d="M26 15 Q28 12.5 26.4 10 Q25 7.8 26.2 5.6" stroke="#e4d2a7" stroke-width="1.2" fill="none" opacity="0.6"/>
  ${motif}
  <ellipse cx="22" cy="39" rx="12" ry="2.6" fill="#e4d2a7" stroke="#c9b488" stroke-width="0.9"/>
  <path d="M30 26 Q38 25 37.5 31 Q37 35 30 34.5" fill="none" stroke="#e4d2a7" stroke-width="2.3"/>
  <path d="M14 26 Q8 25.5 8.5 23 L13 24" fill="none" stroke="#e4d2a7" stroke-width="2.2"/>
  <path d="M13 24.5 Q13 36 22 36 Q31 36 31 24.5 Q31 20 22 20 Q13 20 13 24.5 Z" fill="#f3e7cb" stroke="#d9c49a" stroke-width="1.2"/>
  <path d="M15 24.5 Q22 28 29 24.5" fill="none" stroke="${liquid}" stroke-width="2.4" opacity="0.9"/>
  <rect x="19" y="16.5" width="6" height="2.6" rx="1.2" fill="#e4d2a7" stroke="#c9b488" stroke-width="0.7"/>
`);

// ── Motifs (centred ~22,11) ────────────────────────────────────────────────
const tiM = {
  sun: `<circle cx="22" cy="11" r="3.4" fill="#ffb44a" stroke="#e68a2c" stroke-width="0.8"/>
    <path d="M22 4.5V2 M22 20V17.5 M14.8 11h-2.4 M31.6 11h-2.4 M16.9 5.9l-1.7-1.7 M28.8 17.8l-1.7-1.7 M27.1 5.9l1.7-1.7 M15.2 17.8l1.7-1.7" stroke="#ffb44a" stroke-width="1.3"/>`,
  daisy: `<g fill="#fbfae8" stroke="#e7e1c0" stroke-width="0.5"><ellipse cx="22" cy="6.4" rx="1.3" ry="2.9"/><ellipse cx="22" cy="6.4" rx="1.3" ry="2.9" transform="rotate(45 22 11)"/><ellipse cx="22" cy="6.4" rx="1.3" ry="2.9" transform="rotate(90 22 11)"/><ellipse cx="22" cy="6.4" rx="1.3" ry="2.9" transform="rotate(135 22 11)"/><ellipse cx="22" cy="6.4" rx="1.3" ry="2.9" transform="rotate(180 22 11)"/><ellipse cx="22" cy="6.4" rx="1.3" ry="2.9" transform="rotate(225 22 11)"/><ellipse cx="22" cy="6.4" rx="1.3" ry="2.9" transform="rotate(270 22 11)"/><ellipse cx="22" cy="6.4" rx="1.3" ry="2.9" transform="rotate(315 22 11)"/></g><circle cx="22" cy="11" r="2.4" fill="#f4c430" stroke="#d89a1e" stroke-width="0.6"/>`,
  marigold: `<g fill="#ffa23a" stroke="#e07a1e" stroke-width="0.5"><ellipse cx="22" cy="6.6" rx="1.5" ry="3"/><ellipse cx="22" cy="6.6" rx="1.5" ry="3" transform="rotate(40 22 11)"/><ellipse cx="22" cy="6.6" rx="1.5" ry="3" transform="rotate(80 22 11)"/><ellipse cx="22" cy="6.6" rx="1.5" ry="3" transform="rotate(120 22 11)"/><ellipse cx="22" cy="6.6" rx="1.5" ry="3" transform="rotate(160 22 11)"/><ellipse cx="22" cy="6.6" rx="1.5" ry="3" transform="rotate(200 22 11)"/><ellipse cx="22" cy="6.6" rx="1.5" ry="3" transform="rotate(240 22 11)"/><ellipse cx="22" cy="6.6" rx="1.5" ry="3" transform="rotate(280 22 11)"/><ellipse cx="22" cy="6.6" rx="1.5" ry="3" transform="rotate(320 22 11)"/></g><circle cx="22" cy="11" r="2" fill="#d96a1e"/>`,
  moon: `<path d="M26 5 A6.4 6.4 0 1 0 26 17.8 A5 5 0 1 1 26 5 Z" fill="#78e8c8" stroke="#3fb79a" stroke-width="0.7"/>`,
  lavender: `<path d="M22 18 V11" stroke="#6f9960" stroke-width="1.2"/><g fill="#9a7bc8" stroke="#6f52a8" stroke-width="0.4"><ellipse cx="22" cy="10.5" rx="1.9" ry="1.5"/><ellipse cx="22" cy="8.2" rx="1.6" ry="1.4"/><ellipse cx="22" cy="6.2" rx="1.3" ry="1.2"/><ellipse cx="22" cy="4.6" rx="1" ry="1"/></g>`,
  lemon: `<ellipse cx="22" cy="11" rx="4.6" ry="3.4" fill="#f4d64a" stroke="#d6b028" stroke-width="0.8"/><path d="M26.4 9.6 l2 -1" stroke="#d6b028" stroke-width="0.9"/><path d="M15.6 8.4 Q13 7.4 12 9.4 Q14 10 15.8 9.4 Z" fill="#6f9960" stroke="#4e8f3a" stroke-width="0.4"/>`,
  yarrowcluster: `<path d="M22 18 V12" stroke="#6f9960" stroke-width="1.1"/><g fill="#ef8ca0" stroke="#d05a74" stroke-width="0.4"><circle cx="19" cy="9" r="1.3"/><circle cx="22" cy="7.6" r="1.3"/><circle cx="25" cy="9" r="1.3"/><circle cx="20.4" cy="11" r="1.2"/><circle cx="23.6" cy="11" r="1.2"/></g>`,
  wormwood: `<path d="M22 18 Q22 12 22 7 M22 14 Q19 12 17 9 M22 14 Q25 12 27 9 M22 10 Q20 8.5 19 6.5 M22 10 Q24 8.5 25 6.5" stroke="#9fb08a" stroke-width="1.2" fill="none"/>`,
  ginger: `<path d="M16 11 Q16 7 20 7 Q23 7 23 10 Q27 9 28 12.5 Q28 15.5 24 15 Q24 18 20 17.5 Q16 17 16 13.5 Z" fill="#e8b878" stroke="#c48a44" stroke-width="0.8"/>`,
  vervain: `<path d="M22 18 V6 M22 12 Q18 10 16 7 M22 10 Q26 8 28 6" stroke="#8fae7a" stroke-width="0.9" fill="none"/><g fill="#c3a3de"><circle cx="16" cy="7" r="1.1"/><circle cx="28" cy="6" r="1.1"/><circle cx="22" cy="5.4" r="1.1"/></g>`,
  clover: `<g fill="#5aa84a" stroke="#3f8a34" stroke-width="0.5"><path d="M22 11 Q18 7 21 5 Q23 7 22 11Z"/><path d="M22 11 Q26 7 23 5 Q21 7 22 11Z"/><path d="M22 11 Q18 15 21 17 Q23 15 22 11Z"/><path d="M22 11 Q26 15 23 17 Q21 15 22 11Z"/></g><path d="M22 11 V18" stroke="#3f8a34" stroke-width="0.9"/>`,
  starflower: `<g fill="#f4c430" stroke="#d89a1e" stroke-width="0.5"><ellipse cx="22" cy="6.6" rx="1.4" ry="3"/><ellipse cx="22" cy="6.6" rx="1.4" ry="3" transform="rotate(72 22 11)"/><ellipse cx="22" cy="6.6" rx="1.4" ry="3" transform="rotate(144 22 11)"/><ellipse cx="22" cy="6.6" rx="1.4" ry="3" transform="rotate(216 22 11)"/><ellipse cx="22" cy="6.6" rx="1.4" ry="3" transform="rotate(288 22 11)"/></g><circle cx="22" cy="11" r="1.6" fill="#e68a2c"/>`,
  berries: `<path d="M22 18 V13 M22 15 L18.5 12 M22 15 L25.5 12" stroke="#6f9960" stroke-width="1"/><g fill="#ef5d72" stroke="#bf3350" stroke-width="0.5"><circle cx="18" cy="10.5" r="2"/><circle cx="22" cy="9.4" r="2"/><circle cx="26" cy="10.5" r="2"/></g>`,
  bells: `<path d="M22 18 V8" stroke="#6f9960" stroke-width="1"/><g fill="#efe7d2" stroke="#cbbf9e" stroke-width="0.5"><path d="M17 8 Q17 12 19 12.5 Q21 12 21 8 Z"/><path d="M23 7 Q23 11 25 11.5 Q27 11 27 7 Z"/></g>`,
  smalldaisies: `<g fill="#fbfae8" stroke="#e7e1c0" stroke-width="0.4"><circle cx="17" cy="9" r="2.6"/><circle cx="26" cy="10" r="2.6"/><circle cx="22" cy="6" r="2.6"/></g><g fill="#f4c430"><circle cx="17" cy="9" r="1"/><circle cx="26" cy="10" r="1"/><circle cx="22" cy="6" r="1"/></g>`,
  ruleaf: `<path d="M22 18 Q22 12 22 7" stroke="#5a8a6a" stroke-width="1" fill="none"/><g fill="#8fc8a8" stroke="#5a9a7a" stroke-width="0.5"><ellipse cx="18" cy="9" rx="2.2" ry="1.7"/><ellipse cx="26" cy="9" rx="2.2" ry="1.7"/><ellipse cx="22" cy="6" rx="2.2" ry="1.7"/></g>`,
  // sabbats
  snowdrop: `<path d="M22 18 V9" stroke="#6f9960" stroke-width="1"/><path d="M19 9 Q19 13 22 13.5 Q25 13 25 9 Q25 7 22 7 Q19 7 19 9 Z" fill="#fbfae8" stroke="#cbbf9e" stroke-width="0.6"/><path d="M22 6 L22 9" stroke="#6f9960" stroke-width="0.8"/>`,
  egg: `<ellipse cx="22" cy="11" rx="4.2" ry="5.4" fill="#bfe6d0" stroke="#7fbf9a" stroke-width="0.8"/><path d="M17.8 10 Q20 11.4 22 10 Q24 8.6 26.2 10" stroke="#ef8ca0" stroke-width="0.9" fill="none"/><path d="M18 13 Q20 14.2 22 13 Q24 11.8 26 13" stroke="#9a7bc8" stroke-width="0.9" fill="none"/>`,
  bonfire: `<path d="M22 17 Q16 13 19 8 Q20 11 22 10 Q22 6 25 4 Q24 9 27 10 Q29 13 26 16 Q24 18 22 17 Z" fill="#ff7a24" stroke="#e05a1e" stroke-width="0.7"/><path d="M22 15 Q20 13 21.5 10 Q22 12 23 11 Q23.5 13 22 15 Z" fill="#ffd257"/>`,
  fullsun: `<circle cx="22" cy="11" r="3.8" fill="#ffd257" stroke="#e6a92c" stroke-width="0.9"/><path d="M22 3.4V1.2 M22 20.8V18.6 M13.4 11h-2.2 M32.8 11h-2.2 M15.9 4.9l-1.6-1.6 M29.7 17.7l-1.6-1.6 M28.1 4.9l1.6-1.6 M14.3 17.7l1.6-1.6" stroke="#ffd257" stroke-width="1.2"/>`,
  wheat: `<path d="M22 18 V6" stroke="#c89a44" stroke-width="1.2"/><g fill="#e8c05a" stroke="#c89a44" stroke-width="0.4"><ellipse cx="22" cy="6" rx="1.3" ry="2"/><ellipse cx="19" cy="9" rx="1.2" ry="1.9" transform="rotate(-28 19 9)"/><ellipse cx="25" cy="9" rx="1.2" ry="1.9" transform="rotate(28 25 9)"/><ellipse cx="19.3" cy="12.4" rx="1.2" ry="1.9" transform="rotate(-28 19.3 12.4)"/><ellipse cx="24.7" cy="12.4" rx="1.2" ry="1.9" transform="rotate(28 24.7 12.4)"/></g>`,
  mapleleaf: `<path d="M22 18 V13 M22 13 L22 5 M22 8 L17 6 M22 8 L27 6 M22 11 L16.5 10.5 M22 11 L27.5 10.5" stroke="#c86a2e" stroke-width="0.8" fill="none"/><path d="M22 4.5 L19 7 L15.5 6.5 L18 9.5 L15 11 L19.5 11.5 L18 15 L22 12.5 L26 15 L24.5 11.5 L29 11 L26 9.5 L28.5 6.5 L25 7 Z" fill="#e0812e" stroke="#c0611e" stroke-width="0.5"/>`,
  candleflame: `<path d="M22 14 Q19 11 21 7.5 Q22 10 22.6 8.5 Q24 11 23.5 13 Q23 15 22 14 Z" fill="#ffd27a" stroke="#e8a93a" stroke-width="0.6"/><rect x="20.5" y="14" width="3" height="4.5" rx="0.6" fill="#efe7d2" stroke="#cbbf9e" stroke-width="0.5"/>`,
  snowflake: `<g stroke="#a9c8ff" stroke-width="1.2"><path d="M22 4V18 M15.5 7.2 L28.5 14.8 M28.5 7.2 L15.5 14.8"/><path d="M22 7 L20 5 M22 7 L24 5 M22 15 L20 17 M22 15 L24 17 M17.6 9 L15 8.6 M26.4 13 L29 13.4 M26.4 9 L29 8.6 M17.6 13 L15 13.4"/></g>`,
  // greater + capstone
  sunflower: `<g fill="#ffb44a" stroke="#e68a2c" stroke-width="0.5"><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1"/><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1" transform="rotate(36 22 11)"/><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1" transform="rotate(72 22 11)"/><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1" transform="rotate(108 22 11)"/><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1" transform="rotate(144 22 11)"/><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1" transform="rotate(180 22 11)"/><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1" transform="rotate(216 22 11)"/><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1" transform="rotate(252 22 11)"/><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1" transform="rotate(288 22 11)"/><ellipse cx="22" cy="5.4" rx="1.5" ry="3.1" transform="rotate(324 22 11)"/></g><circle cx="22" cy="11" r="2.8" fill="#8a5a2a" stroke="#6a401a" stroke-width="0.6"/>`,
  moonlav: `<path d="M24.5 5 A5.4 5.4 0 1 0 24.5 15.6 A4.2 4.2 0 1 1 24.5 5 Z" fill="#78e8c8" stroke="#3fb79a" stroke-width="0.6"/><g fill="#9a7bc8"><ellipse cx="16" cy="12" rx="1.4" ry="1.2"/><ellipse cx="16.3" cy="9.8" rx="1.2" ry="1.1"/><ellipse cx="16.6" cy="8" rx="1" ry="0.9"/></g>`,
  swords: `<path d="M16 6 L27 17 M28 6 L17 17" stroke="#c9d2dc" stroke-width="1.8"/><path d="M14.5 7.5 L17.5 4.5 M29.5 7.5 L26.5 4.5" stroke="#8a97a4" stroke-width="1.6"/>`,
  orb: `<circle cx="22" cy="11" r="5.4" fill="#2a1d3e" stroke="#b096fc" stroke-width="1"/><path d="M22 5.6 L23.3 9.4 L27.2 9.4 L24 11.8 L25.2 15.6 L22 13.3 L18.8 15.6 L20 11.8 L16.8 9.4 L20.7 9.4 Z" fill="#b096fc" opacity="0.9"/><circle cx="20" cy="9" r="1.1" fill="#ece7f7" opacity="0.8"/>`,
};

// ── id → icon ───────────────────────────────────────────────────────────────
export const TEA_ICONS = {
  // ☉ Sun — vitality
  hearthmoon_tea: tiCup('#f0a94a', tiM.sun),
  chamomile_tea:  tiCup('#f4d66a', tiM.daisy),
  calendula_tea:  tiCup('#f09a3a', tiM.marigold),
  // ☽ Moon — forage
  mugwort_tea:    tiCup('#6fd0c0', tiM.moon),
  lavender_tea:   tiCup('#b79ae0', tiM.lavender),
  lemonbalm_tea:  tiCup('#d9e07a', tiM.lemon),
  // ♂ Mars — power
  yarrow_tea:     tiCup('#e68aa0', tiM.yarrowcluster),
  wormwood_tea:   tiCup('#aec49a', tiM.wormwood),
  // ☿ Mercury — swift
  gingerroot_tea: tiCup('#e8b060', tiM.ginger),
  vervain_tea:    tiCup('#c3a3de', tiM.vervain),
  // ♃ Jupiter — xp
  clovermint_tea:   tiCup('#8ad07a', tiM.clover),
  stjohnswort_tea:  tiCup('#f2c84a', tiM.starflower),
  rowan_tea:        tiCup('#e06a70', tiM.berries),
  // ♀ Venus — leech
  comfrey_tea:    tiCup('#ece0c2', tiM.bells),
  feverfew_tea:   tiCup('#f0e8cc', tiM.smalldaisies),
  // ♄ Saturn — guard
  rue_tea:        tiCup('#7fc0a0', tiM.ruleaf),
  // Greater brews (teapot)
  suns_blessing:    tiPot('#f0a94a', tiM.sunflower),
  dreamers_draught: tiPot('#b79ae0', tiM.moonlav),
  ironblood_tea:    tiPot('#d0606a', tiM.swords),
  // Capstone
  witches_brew:     tiCup('#6a4aa0', tiM.orb, 'rgba(176,150,252,0.6)'),
  // 🎡 Sabbat teas
  imbolc_tea:     tiCup('#c8e6c0', tiM.snowdrop),
  ostara_tea:     tiCup('#bfe6d0', tiM.egg),
  beltane_tea:    tiCup('#f0803a', tiM.bonfire),
  litha_tea:      tiCup('#ffcf5a', tiM.fullsun),
  lughnasadh_tea: tiCup('#e8c05a', tiM.wheat),
  mabon_tea:      tiCup('#e0892e', tiM.mapleleaf),
  samhain_tea:    tiCup('#8a6ac0', tiM.candleflame),
  yule_tea:       tiCup('#a9c8ff', tiM.snowflake),
};
