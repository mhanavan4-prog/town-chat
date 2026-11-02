// ---------------------------------------------------------------------------
// Panel icons — the stat / class / boon sigils that used to sit as raw emoji
// in the Stats tab, the Skills tree + Attack panels, and the Delve boon draft.
// Same carved-talisman language as the rest of the set: bone/parchment strokes
// over the world's torch-amber, moon-teal, ember-red and violet-shadow palette,
// drawn on a 0 0 44 44 grid. Keyed so uiIcon('stat_power') / uiIcon('class_witch')
// / uiIcon('boon_ember_heart') resolve everywhere, and merged into UI_ICONS.
// ---------------------------------------------------------------------------

const P = {
  bone: '#f3e7cb', bone2: '#e4d2a7', bone3: '#c9b488',
  amber: '#ffb44a', amber2: '#e68a2c',
  teal: '#78e8c8', teal2: '#3fb79a',
  red: '#ef5d72', red2: '#bf3350',
  blue: '#a9c8ff', blue2: '#6f9ee8',
  wood: '#b98a56', wood2: '#6b4a28',
  plum: '#3a2850', plum2: '#20142f',
};
const pS = (inner) =>
  `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" ` +
  `stroke-linejoin="round" stroke-linecap="round" class="uiIcon">${inner}</svg>`;

// ── Attribute sigils (the Stats tab + equip preview) ─────────────────────────
// Each reads as a single emblem for the attribute it names.

// Attack — a witch's athame (ritual dagger) raised, torch-lit edge.
const ST_POWER = pS(`
  <path d="M22 4 L26 10 L25 27 L19 27 L18 10 Z" fill="${P.bone}" stroke="${P.bone3}" stroke-width="1.6"/>
  <path d="M22 5 L22 26" stroke="${P.amber}" stroke-width="1.4" opacity="0.7"/>
  <path d="M13 28 L31 28 Q33 28 33 30 Q33 32 31 32 L13 32 Q11 32 11 30 Q11 28 13 28 Z" fill="${P.wood}" stroke="${P.wood2}" stroke-width="1.6"/>
  <path d="M22 32 L22 40" stroke="${P.wood}" stroke-width="3.4"/>
  <circle cx="22" cy="40.5" r="2.3" fill="${P.amber}" stroke="${P.amber2}" stroke-width="1"/>
`);
// Defense — a warded shield marked with a protective rune.
const ST_GUARD = pS(`
  <path d="M22 5 L35 10 Q35 26 22 39 Q9 26 9 10 Z" fill="${P.bone2}" stroke="${P.bone3}" stroke-width="2"/>
  <path d="M22 9 L31 12.5 Q31 24 22 34 Q13 24 13 12.5 Z" fill="none" stroke="${P.teal2}" stroke-width="1.4" opacity="0.8"/>
  <path d="M22 14 L22 29 M16 21.5 L28 21.5 M18 17 L26 26 M26 17 L18 26" stroke="${P.teal}" stroke-width="1.8"/>
`);
// Max Health — a sacred heart cradling a small life-flame.
const ST_VITALITY = pS(`
  <path d="M22 37 C10 27 7 20 7 15 Q7 8 13.5 8 Q19 8 22 14 Q25 8 30.5 8 Q37 8 37 15 C37 20 34 27 22 37 Z" fill="${P.red}" stroke="${P.red2}" stroke-width="2"/>
  <path d="M22 26 Q18 22 22 16 Q26 22 22 26 Z" fill="${P.amber}" stroke="${P.amber2}" stroke-width="1.2"/>
  <path d="M15 14 Q13 17 15 20" stroke="${P.bone}" stroke-width="1.3" opacity="0.6" fill="none"/>
`);
// Move Speed — a swift feather trailing motion-glow.
const ST_SWIFT = pS(`
  <path d="M34 8 Q20 10 13 24 Q10 30 11 36 Q17 34 24 28 Q33 20 34 8 Z" fill="${P.bone2}" stroke="${P.bone3}" stroke-width="1.8"/>
  <path d="M30 13 L16 30 M32 11 L30 13 M27 17 L21 17 M24 22 L18 22" stroke="${P.teal2}" stroke-width="1.3" opacity="0.8"/>
  <path d="M4 15 L13 15 M3 22 L10 22 M5 29 L12 29" stroke="${P.teal}" stroke-width="2" opacity="0.85"/>
`);
// Ability Haste — an hourglass running moon-sand (cooldown falling away).
const ST_HASTE = pS(`
  <path d="M12 6 L32 6 M12 38 L32 38" stroke="${P.bone3}" stroke-width="2.4"/>
  <path d="M13 7 Q13 18 22 22 Q31 18 31 7 Z" fill="${P.blue}" stroke="${P.blue2}" stroke-width="1.6" opacity="0.9"/>
  <path d="M13 37 Q13 26 22 22 Q31 26 31 37 Z" fill="none" stroke="${P.bone3}" stroke-width="1.8"/>
  <path d="M19 32 Q22 29 25 32 L25 35 Q22 33 19 35 Z" fill="${P.blue}" stroke="${P.blue2}" stroke-width="1"/>
  <circle cx="22" cy="24.5" r="1.3" fill="${P.blue}"/>
`);
// Lifesteal — a crescent drawing a crimson drop up into itself.
const ST_LEECH = pS(`
  <path d="M30 6 Q14 10 14 22 Q14 34 30 38 Q20 30 20 22 Q20 14 30 6 Z" fill="${P.bone2}" stroke="${P.bone3}" stroke-width="1.8"/>
  <path d="M27 26 Q23 30 27 34 Q31 30 27 26 Z" fill="${P.red}" stroke="${P.red2}" stroke-width="1.2"/>
  <path d="M26 15 L26 24 M23 19 L29 19" stroke="${P.red2}" stroke-width="1.6" opacity="0.7"/>
`);
// XP Bonus — a rising four-point star with ascending sparks.
const ST_XP = pS(`
  <path d="M24 10 L27 21 L38 24 L27 27 L24 38 L21 27 L10 24 L21 21 Z" fill="${P.amber}" stroke="${P.amber2}" stroke-width="1.8"/>
  <path d="M24 16 L24 32 M16 24 L32 24" stroke="${P.bone}" stroke-width="1.1" opacity="0.5"/>
  <path d="M9 9 L11 13 L15 11 L13 15 L9 9 Z" fill="${P.teal}" stroke="${P.teal2}" stroke-width="0.8"/>
  <circle cx="35" cy="12" r="1.8" fill="${P.teal}"/>
`);
// Harvest Luck — a bound herb sprig with a lucky clover leaf.
const ST_FORAGE = pS(`
  <path d="M22 39 L22 20" stroke="${P.teal2}" stroke-width="2.2"/>
  <path d="M22 24 Q13 22 9 14 Q18 13 22 20 M22 24 Q31 22 35 14 Q26 13 22 20 M22 19 Q20 11 24 5 Q28 11 22 19" fill="${P.teal}" stroke="${P.teal2}" stroke-width="1.5"/>
  <path d="M15 32 Q11 30 12 26 Q16 27 15 32 Z M15 32 Q19 30 18 26 Q14 27 15 32 Z" fill="${P.amber}" stroke="${P.amber2}" stroke-width="1.2"/>
  <path d="M28 34 Q25 28 29 30 Q33 32 28 34 Z" fill="${P.amber}" stroke="${P.amber2}" stroke-width="1.1"/>
`);

// ── Class sigils (Skills tree title + Attack-panel title, by charId 0–5) ──────

// Witch — pentacle cradled by a crescent moon.
const CL_WITCH = pS(`
  <path d="M34 7 Q24 10 24 22 Q24 34 34 37 Q16 37 13 22 Q16 7 34 7 Z" fill="${P.plum}" stroke="${P.teal2}" stroke-width="1.4" opacity="0.9"/>
  <g transform="translate(23 22)">
    <path d="M0 -11 L3.4 1 L-6.5 -6 L6.5 -6 L-3.4 1 Z" fill="none" stroke="${P.teal}" stroke-width="1.8"/>
    <circle cx="0" cy="-3" r="10.5" fill="none" stroke="${P.teal}" stroke-width="1.3" opacity="0.7"/>
  </g>
`);
// Werewolf (Feral Instincts) — three claw slashes torn across the full moon.
// The unmistakable lycanthrope mark; sidesteps the owl-read of a front face.
const CL_WEREWOLF = pS(`
  <circle cx="22" cy="22" r="15" fill="${P.bone2}" stroke="${P.bone3}" stroke-width="2"/>
  <circle cx="16" cy="16" r="2.4" fill="${P.bone3}" opacity="0.55"/>
  <circle cx="28" cy="27" r="3.2" fill="${P.bone3}" opacity="0.45"/>
  <circle cx="26" cy="14" r="1.6" fill="${P.bone3}" opacity="0.5"/>
  <path d="M12 11 Q18 23 23 36" stroke="${P.plum2}" stroke-width="3" fill="none"/>
  <path d="M18 7 Q25 21 30 34" stroke="${P.plum2}" stroke-width="3.6" fill="none"/>
  <path d="M25 8 Q31 20 35 30" stroke="${P.plum2}" stroke-width="2.6" fill="none"/>
  <path d="M18 7 Q25 21 30 34" stroke="${P.amber}" stroke-width="1.1" fill="none" opacity="0.75"/>
  <path d="M12 11 Q18 23 23 36" stroke="${P.amber}" stroke-width="0.9" fill="none" opacity="0.6"/>
`);
// Mystic — a candle flame rising into a spirit wisp.
const CL_MYSTIC = pS(`
  <path d="M22 20 Q16 14 22 5 Q28 14 22 20 Z" fill="${P.teal}" stroke="${P.teal2}" stroke-width="1.5"/>
  <path d="M22 16 Q20 12 22 9 Q24 12 22 16 Z" fill="${P.bone}" opacity="0.85"/>
  <path d="M17 22 L27 22 L26 34 Q26 36 22 36 Q18 36 18 34 Z" fill="${P.bone2}" stroke="${P.bone3}" stroke-width="1.6"/>
  <path d="M30 28 Q35 30 33 35 Q31 38 27 37" fill="none" stroke="${P.teal}" stroke-width="1.3" opacity="0.7"/>
  <path d="M14 28 Q9 30 11 35 Q13 38 17 37" fill="none" stroke="${P.teal}" stroke-width="1.3" opacity="0.7"/>
`);
// Knight — a sword standing over a heater shield.
const CL_KNIGHT = pS(`
  <path d="M13 12 L22 9 L31 12 Q31 26 22 33 Q13 26 13 12 Z" fill="${P.bone2}" stroke="${P.bone3}" stroke-width="1.8"/>
  <path d="M22 6 L24.5 12 L23.5 28 L20.5 28 L19.5 12 Z" fill="#aeb8c4" stroke="#6f7a88" stroke-width="1.5"/>
  <path d="M16 30 L28 30 Q30 30 30 32 Q30 34 28 34 L16 34 Q14 34 14 32 Q14 30 16 30 Z" fill="${P.amber2}" stroke="${P.wood2}" stroke-width="1.4"/>
  <path d="M22 34 L22 40" stroke="${P.wood2}" stroke-width="3"/>
`);
// Wanderer — a traveller's staff crossing a winding road under a star.
const CL_WANDERER = pS(`
  <path d="M14 38 Q20 28 17 20 Q14 12 20 5" fill="none" stroke="${P.wood}" stroke-width="3"/>
  <circle cx="20" cy="5.5" r="2.6" fill="${P.amber}" stroke="${P.amber2}" stroke-width="1.1"/>
  <path d="M33 11 L34.5 15 L38 15.5 L35 18 L36 22 L33 19.5 L30 22 L31 18 L28 15.5 L31.5 15 Z" fill="${P.teal}" stroke="${P.teal2}" stroke-width="0.9"/>
  <path d="M8 40 Q16 34 22 36 Q30 38 36 31" fill="none" stroke="${P.bone3}" stroke-width="2" stroke-dasharray="1.5 3" opacity="0.8"/>
`);
// Lich — a crowned skull, death's rite.
const CL_LICH = pS(`
  <path d="M11 11 L15 6 L19 10 L22 5 L25 10 L29 6 L33 11 L30 14 Q33 17 33 22 Q33 28 27 30 L27 35 Q27 37 24 37 L20 37 Q17 37 17 35 L17 30 Q11 28 11 22 Q11 17 14 14 Z" fill="${P.bone}" stroke="${P.bone3}" stroke-width="1.8"/>
  <circle cx="18" cy="22" r="3.2" fill="${P.plum}"/>
  <circle cx="26" cy="22" r="3.2" fill="${P.plum}"/>
  <circle cx="18" cy="22" r="1.1" fill="${P.teal}"/>
  <circle cx="26" cy="22" r="1.1" fill="${P.teal}"/>
  <path d="M22 26 L20 30 L24 30 Z" fill="${P.plum}"/>
  <path d="M18 33 L18 36 M22 33 L22 37 M26 33 L26 36" stroke="${P.bone3}" stroke-width="1.3"/>
`);

// ── Delve boon relics (the boon-draft cards) ─────────────────────────────────

// Ember Heart — a heart wreathed in ember flame.
const BN_EMBER_HEART = pS(`
  <path d="M22 35 C12 27 10 21 10 16 Q10 10 15 10 Q19 10 22 15 Q25 10 29 10 Q34 10 34 16 C34 21 32 27 22 35 Z" fill="${P.red}" stroke="${P.red2}" stroke-width="2"/>
  <path d="M22 8 Q18 4 22 1 Q26 5 22 8 Z M12 12 Q8 9 9 5 Q14 8 12 12 Z M32 12 Q36 9 35 5 Q30 8 32 12 Z" fill="${P.amber}" stroke="${P.amber2}" stroke-width="1"/>
  <path d="M22 27 Q19 23 22 18 Q25 23 22 27 Z" fill="${P.amber}" opacity="0.9"/>
`);
// Bark Skin — a plated bark ward.
const BN_BARK_SKIN = pS(`
  <path d="M22 4 L34 9 Q34 26 22 40 Q10 26 10 9 Z" fill="${P.wood}" stroke="${P.wood2}" stroke-width="2"/>
  <path d="M16 9 Q14 22 17 36 M22 7 Q21 23 22 39 M28 9 Q30 22 27 36" stroke="${P.wood2}" stroke-width="1.5" opacity="0.8" fill="none"/>
  <ellipse cx="22" cy="20" rx="3" ry="5" fill="${P.wood2}" opacity="0.6"/>
  <path d="M19 14 L17 16 M26 26 L28 28" stroke="${P.bone2}" stroke-width="1.2" opacity="0.5"/>
`);
// Moon Blood — a full moon shedding a single crimson drop.
const BN_MOON_BLOOD = pS(`
  <circle cx="22" cy="18" r="13" fill="${P.blue}" stroke="${P.blue2}" stroke-width="1.8"/>
  <circle cx="17" cy="15" r="2.6" fill="${P.blue2}" opacity="0.6"/>
  <circle cx="27" cy="21" r="3.4" fill="${P.blue2}" opacity="0.5"/>
  <circle cx="25" cy="12" r="1.6" fill="${P.blue2}" opacity="0.6"/>
  <path d="M22 30 Q18 36 22 40 Q26 36 22 30 Z" fill="${P.red}" stroke="${P.red2}" stroke-width="1.4"/>
`);
// Quick Wick — a candle burning fast, speed-lines behind it.
const BN_QUICK_WICK = pS(`
  <path d="M26 17 Q20 11 26 3 Q32 11 26 17 Z" fill="${P.amber}" stroke="${P.amber2}" stroke-width="1.4"/>
  <path d="M26 14 Q24 10 26 7 Q28 10 26 14 Z" fill="${P.bone}" opacity="0.85"/>
  <path d="M21 19 L31 19 L30 38 Q30 40 26 40 Q22 40 22 38 Z" fill="${P.bone2}" stroke="${P.bone3}" stroke-width="1.6"/>
  <path d="M6 16 L16 16 M4 24 L14 24 M7 32 L15 32" stroke="${P.amber}" stroke-width="2" opacity="0.8"/>
`);
// Cat Step — a black cat's paw print.
const BN_CAT_STEP = pS(`
  <path d="M22 20 Q14 20 13 29 Q12 36 22 36 Q32 36 31 29 Q30 20 22 20 Z" fill="${P.plum}" stroke="${P.plum2}" stroke-width="1.6"/>
  <ellipse cx="12" cy="16" rx="3" ry="4.2" fill="${P.plum}" stroke="${P.plum2}" stroke-width="1.3"/>
  <ellipse cx="19" cy="11" rx="3" ry="4.4" fill="${P.plum}" stroke="${P.plum2}" stroke-width="1.3"/>
  <ellipse cx="25" cy="11" rx="3" ry="4.4" fill="${P.plum}" stroke="${P.plum2}" stroke-width="1.3"/>
  <ellipse cx="32" cy="16" rx="3" ry="4.2" fill="${P.plum}" stroke="${P.plum2}" stroke-width="1.3"/>
  <path d="M19 28 L22 30 L25 28" stroke="${P.teal}" stroke-width="1.1" opacity="0.6"/>
`);
// Red Thread — a bone spool wound with fate's crimson thread.
const BN_RED_THREAD = pS(`
  <path d="M13 9 L31 9 L31 35 L13 35 Z" fill="none" stroke="${P.bone3}" stroke-width="1.6"/>
  <path d="M9 7 L35 7 Q36 7 36 9 Q36 11 35 11 L9 11 Q8 11 8 9 Q8 7 9 7 Z" fill="${P.bone2}" stroke="${P.bone3}" stroke-width="1.4"/>
  <path d="M9 33 L35 33 Q36 33 36 35 Q36 37 35 37 L9 37 Q8 37 8 35 Q8 33 9 33 Z" fill="${P.bone2}" stroke="${P.bone3}" stroke-width="1.4"/>
  <path d="M14 15 L30 19 M30 15 L14 19 M14 23 L30 27 M30 23 L14 27" stroke="${P.red}" stroke-width="2"/>
  <path d="M30 19 Q39 21 36 27" fill="none" stroke="${P.red}" stroke-width="1.6"/>
`);
// Witch's Broth — a bubbling cauldron.
const BN_WITCHS_BROTH = pS(`
  <path d="M8 20 L36 20 Q34 36 22 36 Q10 36 8 20 Z" fill="${P.plum}" stroke="${P.plum2}" stroke-width="2"/>
  <ellipse cx="22" cy="20" rx="14" ry="3.4" fill="${P.teal2}" stroke="${P.plum2}" stroke-width="1.4"/>
  <circle cx="17" cy="19" r="2" fill="${P.teal}"/>
  <circle cx="26" cy="19.5" r="1.5" fill="${P.teal}"/>
  <path d="M15 14 Q13 11 15 8 M22 13 Q20 9 22 5 M29 14 Q31 11 29 8" stroke="${P.teal}" stroke-width="1.4" opacity="0.75" fill="none"/>
  <path d="M6 24 L10 26 M38 24 L34 26" stroke="${P.plum2}" stroke-width="2.4"/>
`);
// Wolf's Bargain — a fang bound with a blood-drop pact.
const BN_WOLFS_BARGAIN = pS(`
  <path d="M15 7 Q14 24 22 38 Q30 24 29 7 Q24 12 22 12 Q20 12 15 7 Z" fill="${P.bone}" stroke="${P.bone3}" stroke-width="1.8"/>
  <path d="M22 14 L22 30" stroke="${P.bone3}" stroke-width="1.2" opacity="0.6"/>
  <path d="M14 20 L30 20" stroke="${P.red2}" stroke-width="2.4"/>
  <path d="M22 30 Q19 34 22 37 Q25 34 22 30 Z" fill="${P.red}" stroke="${P.red2}" stroke-width="1"/>
`);
// Gravedigger — a spade struck into a grave mound.
const BN_GRAVEDIGGER = pS(`
  <path d="M26 5 L26 24 M22 24 L30 24" stroke="${P.wood}" stroke-width="3"/>
  <path d="M20 23 L32 23 L30 31 Q26 34 22 31 Z" fill="#9aa0a8" stroke="#636973" stroke-width="1.6"/>
  <path d="M6 38 Q22 30 40 38 Z" fill="${P.plum}" stroke="${P.plum2}" stroke-width="1.6"/>
  <path d="M12 36 L12 30 L17 30 L17 35 M27 35 L27 29 L32 29 L32 37" fill="none" stroke="${P.bone2}" stroke-width="1.6" opacity="0.7"/>
`);

export const PANEL_ICONS = {
  stat_power: ST_POWER, stat_guard: ST_GUARD, stat_vitality: ST_VITALITY, stat_swift: ST_SWIFT,
  stat_haste: ST_HASTE, stat_leech: ST_LEECH, stat_xp: ST_XP, stat_forage: ST_FORAGE,
  class_witch: CL_WITCH, class_werewolf: CL_WEREWOLF, class_mystic: CL_MYSTIC,
  class_knight: CL_KNIGHT, class_wanderer: CL_WANDERER, class_lich: CL_LICH,
  boon_ember_heart: BN_EMBER_HEART, boon_bark_skin: BN_BARK_SKIN, boon_moon_blood: BN_MOON_BLOOD,
  boon_quick_wick: BN_QUICK_WICK, boon_cat_step: BN_CAT_STEP, boon_red_thread: BN_RED_THREAD,
  boon_witchs_broth: BN_WITCHS_BROTH, boon_wolfs_bargain: BN_WOLFS_BARGAIN, boon_gravedigger: BN_GRAVEDIGGER,
};
