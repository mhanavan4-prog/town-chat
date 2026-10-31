// ---------------------------------------------------------------------------
// Thornreach custom UI icon set (replaces raw emoji in the interface).
//
// One cohesive carved-talisman language: warm bone/parchment strokes, torch
// amber + teal moon-glow + ember red + violet shadow — the same palette the
// world is lit with. Each icon is a self-contained inline <svg> string drawn
// on a 0 0 44 44 grid, so it reads cleanly from ~28px (float above a head) up
// to ~52px (a thumb button). No external assets, no fonts — just vectors.
//
// Batch 1 covers the always-on-screen glyphs: the emote wheel + the mobile
// action cluster. Items / HUD / menus follow the same system in later batches.
// ---------------------------------------------------------------------------

// Shared palette — kept here so the whole set shifts together if we re-grade.
const C = {
  bone:  '#f3e7cb', // parchment / carved-bone stroke + light fill
  bone2: '#e4d2a7', // shaded bone
  amber: '#ffb44a', // torch
  amber2:'#e68a2c', // deep torch
  teal:  '#78e8c8', // moon-glow
  teal2: '#3fb79a', // deep glow
  red:   '#ef5d72', // ember heart
  red2:  '#bf3350', // deep ember
  blue:  '#a9c8ff', // moonlit tear
  blue2: '#6f9ee8',
  plum:  '#3a2850', // violet shadow
};

// Every icon shares the same open/close + default stroke so the set reads as
// one hand. `b` = body stroke, round-joined; fills are set per-shape.
const S = (inner) =>
  `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" ` +
  `stroke-linejoin="round" stroke-linecap="round" class="uiIcon">${inner}</svg>`;

// ── Emotes ──────────────────────────────────────────────────────────────────
// Reimagined as little witch-town tokens, but each keeps a legible emotion.

const WAVE = S(`
  <rect x="14" y="19" width="16" height="16" rx="6" fill="${C.bone}"/>
  <path d="M18 23 L17 11 M22 23 L22 8 M26 23 L27 10 M30 23 L31 14" stroke="${C.bone}" stroke-width="5.2"/>
  <path d="M15 24 L9.5 18.5" stroke="${C.bone}" stroke-width="5.2"/>
  <path d="M35 9 l3 -2 M37 14 l3 -1 M34 4 l1 -3" stroke="${C.amber}" stroke-width="2.2"/>`);

const LAUGH = S(`
  <path d="M33 10 A15 15 0 1 0 33 34 A19 19 0 0 1 33 10 Z" fill="${C.bone}" stroke="${C.bone}" stroke-width="1.5"/>
  <path d="M15 20 q2.5 3 5 0 M15 20 q2.5 3 5 0" stroke="${C.plum}" stroke-width="2.4"/>
  <path d="M13 25 q6 8 13 2 q-2 7 -7 7 q-5 0 -6 -9 Z" fill="${C.plum}" stroke="${C.plum}" stroke-width="1.5"/>
  <path d="M36 16 l2 -3 M39 21 l3 -1" stroke="${C.amber}" stroke-width="2.2"/>`);

const HEART = S(`
  <path d="M22 35 C8 26 8 14 15 12 C20 10.5 22 15 22 15 C22 15 24 10.5 29 12 C36 14 36 26 22 35 Z"
    fill="${C.red}" stroke="${C.red2}" stroke-width="2"/>
  <path d="M19 19 C16 20 16 25 20 29" stroke="${C.amber}" stroke-width="2.2" opacity="0.9"/>`);

const WOW = S(`
  <path d="M11 24 C11 13 33 13 33 24 L33 37 L29 34 L26 37 L22 34 L18 37 L15 34 L11 37 Z"
    fill="${C.bone}" stroke="${C.bone}" stroke-width="1.5"/>
  <circle cx="18" cy="23" r="2.6" fill="${C.plum}"/>
  <circle cx="26" cy="23" r="2.6" fill="${C.plum}"/>
  <ellipse cx="22" cy="30" rx="2.4" ry="3.2" fill="${C.plum}"/>`);

const CRY = S(`
  <path d="M33 11 A15 15 0 1 0 33 33 A19 19 0 0 1 33 11 Z" fill="${C.bone}" stroke="${C.bone}" stroke-width="1.5"/>
  <path d="M15 19 l5 2 M15 21 l5 -2" stroke="${C.plum}" stroke-width="2.2"/>
  <path d="M13 29 q5 -4 10 -1" stroke="${C.plum}" stroke-width="2.4"/>
  <path d="M17 24 C13 30 13 34 16 34 C19 34 19 30 17 24 Z" fill="${C.blue}" stroke="${C.blue2}" stroke-width="1.6"/>`);

const ANGRY = S(`
  <path d="M33 11 A15 15 0 1 0 33 33 A19 19 0 0 1 33 11 Z" fill="${C.bone}" stroke="${C.bone}" stroke-width="1.5"/>
  <path d="M13 17 l7 3 M31 17 l-7 3" stroke="${C.red2}" stroke-width="2.4"/>
  <circle cx="17" cy="24" r="2.2" fill="${C.red2}"/>
  <circle cx="27" cy="24" r="2.2" fill="${C.red2}"/>
  <path d="M24 26 l-5 5 l4 0 l-3 5 l7 -7 l-4 0 l3 -3 Z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="1.2"/>`);

const THUMB = S(`
  <path d="M15 20 L20 13 Q22 9 24 10 Q26 11 25 16 L24 20 L32 20 Q35 20 35 23 L33 33 Q32 36 29 36 L18 36 L15 36 Z"
    fill="${C.bone}" stroke="${C.bone}" stroke-width="2"/>
  <rect x="9" y="20" width="7" height="16" rx="2.5" fill="${C.bone2}" stroke="${C.bone}" stroke-width="1.6"/>
  <path d="M27 14 l3 -2 M33 15 l3 -1" stroke="${C.amber}" stroke-width="2"/>`);

const DANCE = S(`
  <path d="M28 6 L15 33" stroke="${C.bone2}" stroke-width="2.6"/>
  <path d="M10 36 C9 30 13 27 20 28 C27 29 30 33 28 38 C22 32 15 33 10 36 Z"
    fill="${C.amber}" stroke="${C.amber2}" stroke-width="1.6"/>
  <path d="M30 5 l4 1 l-1 4" stroke="${C.bone}" stroke-width="2.2"/>
  <path d="M33 14 C37 16 38 20 36 24 M35 10 C40 12 41 18 38 23" stroke="${C.teal}" stroke-width="2"/>`);

// ── Action cluster ──────────────────────────────────────────────────────────

const ATTACK = S(`
  <path d="M22 4 L26 10 L24 28 L20 28 L18 10 Z" fill="${C.bone}" stroke="${C.bone}" stroke-width="1.6"/>
  <path d="M22 5 L22 27" stroke="${C.amber}" stroke-width="1.6" opacity="0.8"/>
  <path d="M13 28 L31 28" stroke="${C.amber2}" stroke-width="3.4"/>
  <path d="M22 28 L22 40" stroke="${C.bone2}" stroke-width="3.4"/>
  <circle cx="22" cy="40" r="2.6" fill="${C.amber}" stroke="${C.amber2}" stroke-width="1.2"/>`);

const JUMP = S(`
  <path d="M9 26 Q22 8 35 26" stroke="${C.teal}" stroke-width="2.6"/>
  <path d="M15 18 L22 10 L29 18" stroke="${C.teal}" stroke-width="3"/>
  <path d="M15 26 L22 18 L29 26" stroke="${C.teal2}" stroke-width="3"/>
  <path d="M12 34 L18 34 M26 34 L32 34 M20 37 L24 37" stroke="${C.bone2}" stroke-width="2.4"/>`);

const EMOTE = S(`
  <path d="M10 14 Q22 10 34 14 Q35 26 28 34 Q22 39 16 34 Q9 26 10 14 Z"
    fill="${C.bone}" stroke="${C.bone}" stroke-width="1.6"/>
  <path d="M14 20 q4 -3 7 0 M23 20 q4 -3 7 0" stroke="${C.plum}" stroke-width="2.2"/>
  <path d="M16 28 q6 5 12 0" stroke="${C.plum}" stroke-width="2.4"/>
  <path d="M22 10 L22 5 M22 5 l-3 2 M22 5 l3 2" stroke="${C.amber}" stroke-width="2"/>`);

const CALLOUT = S(`
  <path d="M10 19 L24 19 L33 12 L33 32 L24 25 L10 25 Z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="2"/>
  <path d="M13 25 L13 31 L18 31 L17 25" fill="${C.bone2}" stroke="${C.amber2}" stroke-width="1.6"/>
  <path d="M37 16 C40 19 40 25 37 28 M40 12 C45 17 45 27 40 32" stroke="${C.teal}" stroke-width="2.2"/>`);

const KIT = S(`
  <path d="M22 11 C17 8 10 8 7 10 L7 33 C10 31 17 31 22 34 C27 31 34 31 37 33 L37 10 C34 8 27 8 22 11 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M22 11 L22 34" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M29 16 l2.3 5 5.2 0 -4.2 3.3 1.6 5 -4.5 -3 -4.5 3 1.6 -5 -4.2 -3.3 5.2 0 Z"
    fill="${C.teal}" stroke="${C.teal2}" stroke-width="1" transform="translate(-0.5 0) scale(0.92) translate(1 1)"/>
  <path d="M12 17 l6 0 M12 22 l6 0 M12 27 l4 0" stroke="${C.amber2}" stroke-width="1.8" opacity="0.8"/>`);

// ── HUD chrome ──────────────────────────────────────────────────────────────
// (the vitals heart reuses the emote HEART above.)

const SUN = S(`
  <circle cx="22" cy="22" r="8.5" fill="${C.amber}" stroke="${C.amber2}" stroke-width="2"/>
  <path d="M22 4 L22 9 M22 35 L22 40 M4 22 L9 22 M35 22 L40 22
           M9 9 L12.5 12.5 M31.5 31.5 L35 35 M35 9 L31.5 12.5 M9 35 L12.5 31.5"
    stroke="${C.amber}" stroke-width="2.6"/>`);

const MOON = S(`
  <path d="M26 6 A17 17 0 1 0 38 30 A20 20 0 0 1 26 6 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <circle cx="17" cy="20" r="2.4" fill="${C.bone2}" opacity="0.7"/>
  <circle cx="23" cy="28" r="3" fill="${C.bone2}" opacity="0.6"/>
  <circle cx="14" cy="28" r="1.6" fill="${C.bone2}" opacity="0.6"/>
  <path d="M33 11 l2 -3 M37 17 l3 -1" stroke="${C.teal}" stroke-width="2" opacity="0.8"/>`);

const MOONSTONE = S(`
  <path d="M22 5 L35 17 L22 39 L9 17 Z" fill="${C.teal}" stroke="${C.teal2}" stroke-width="2"/>
  <path d="M22 5 L22 39 M9 17 L35 17 M15 17 L22 5 L29 17 L22 39 Z" stroke="${C.bone}" stroke-width="1.4" opacity="0.65" fill="none"/>
  <path d="M13 13 L17 15" stroke="#ffffff" stroke-width="1.6" opacity="0.8"/>`);

const CHAT = S(`
  <path d="M7 11 L37 11 Q39 11 39 14 L39 28 Q39 31 37 31 L19 31 L12 37 L13 31 L7 31 Q5 31 5 28 L5 14 Q5 11 7 11 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.8"/>
  <path d="M12 18 l20 0 M12 24 l14 0" stroke="${C.amber2}" stroke-width="2.2" opacity="0.85"/>`);

const BELL = S(`
  <path d="M22 6 Q23.5 6 23.5 8 L23.5 9.5 Q31 11.5 31 22 Q31 29 35 31 L9 31 Q13 29 13 22 Q13 11.5 20.5 9.5 L20.5 8 Q20.5 6 22 6 Z"
    fill="${C.amber}" stroke="${C.amber2}" stroke-width="2"/>
  <path d="M18 31 Q18 36 22 36 Q26 36 26 31" fill="${C.amber2}" stroke="${C.amber2}" stroke-width="1.6"/>
  <path d="M20 16 Q19 20 19.5 24" stroke="${C.bone}" stroke-width="1.6" opacity="0.7"/>`);

// Moon-phase disc for the HUD moon tag — real terminator geometry in the
// game palette (lit bone / shadow violet), waxing lit on the right, waning on
// the left. `k` is illuminated fraction (0 new … 1 full); blood = red full moon.
function moonDisc(k, waxing, blood) {
  const cx = 22, cy = 22, r = 15;
  const lit = blood ? '#d2556a' : C.bone;
  const litEdge = blood ? '#9a3048' : C.bone2;
  let g = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${lit}" stroke="${litEdge}" stroke-width="1.2"/>`;
  g += `<circle cx="18" cy="18" r="2.2" fill="${litEdge}" opacity="0.5"/><circle cx="25" cy="25" r="2.8" fill="${litEdge}" opacity="0.45"/><circle cx="16" cy="27" r="1.5" fill="${litEdge}" opacity="0.45"/>`;
  if (k <= 0.001) {
    g += `<circle cx="${cx}" cy="${cy}" r="${r - 0.5}" fill="${C.plum}"/>`;
  } else if (k < 0.999) {
    const rx = r * Math.abs(1 - 2 * k);
    if (waxing) {
      const t = k < 0.5 ? `A ${rx} ${r} 0 0 1 ${cx} ${cy - r}` : `A ${rx} ${r} 0 0 0 ${cx} ${cy - r}`;
      g += `<path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} ${t} Z" fill="${C.plum}"/>`;
    } else {
      const t = k < 0.5 ? `A ${rx} ${r} 0 0 0 ${cx} ${cy - r}` : `A ${rx} ${r} 0 0 1 ${cx} ${cy - r}`;
      g += `<path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} ${t} Z" fill="${C.plum}"/>`;
    }
  }
  return S(g);
}
const MOONPHASE = {
  new: moonDisc(0, true), waxing_crescent: moonDisc(0.25, true), first_quarter: moonDisc(0.5, true),
  waxing_gibbous: moonDisc(0.75, true), full: moonDisc(1, true), waning_gibbous: moonDisc(0.75, false),
  last_quarter: moonDisc(0.5, false), waning_crescent: moonDisc(0.25, false),
};
const MOON_BLOOD = moonDisc(1, true, true);
// Returns the inline <svg> for a phase key (blood → red full moon).
export function moonPhaseIcon(key, blood) {
  if (blood) return MOON_BLOOD;
  return MOONPHASE[key] || MOONPHASE.full;
}

// ── Status effects (buffs / curses / wards) ──────────────────────────────────
// Keys match STATUS_FX in main.js. Debuffs lean red/plum, buffs teal/amber.

const WITHER = S(`
  <path d="M22 7 C13 7 9 13 9 20 C9 25 12 27 12 30 L14 30 L14 33 L17 33 L17 30 L20 30 L20 33 L24 33 L24 30 L27 30 L27 33 L30 33 L30 30 L32 30 C32 27 35 25 35 20 C35 13 31 7 22 7 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M15 19 l5 4 M20 19 l-5 4 M24 19 l5 4 M29 19 l-5 4" stroke="${C.red2}" stroke-width="2.2"/>
  <path d="M20 27 l4 0" stroke="${C.red2}" stroke-width="2"/>`);

const STUMBLE = S(`
  <path d="M22 22 m0 -13 a13 13 0 1 1 -11 20 a9 9 0 1 0 9 -15 a5 5 0 1 1 3 7"
    stroke="${C.plum}" stroke-width="3" fill="none"/>
  <circle cx="22" cy="22" r="2.4" fill="${C.amber}"/>`);

const SHRINK = S(`
  <path d="M10 10 L18 10 M10 10 L10 18 M34 10 L26 10 M34 10 L34 18 M10 34 L18 34 M10 34 L10 26 M34 34 L26 34 M34 34 L34 26"
    stroke="${C.red2}" stroke-width="2.6"/>
  <rect x="17" y="17" width="10" height="10" rx="2" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>`);

const TOAD = S(`
  <path d="M8 26 C8 16 16 13 22 13 C28 13 36 16 36 26 C36 32 30 34 22 34 C14 34 8 32 8 26 Z"
    fill="#6fae52" stroke="#4e7d38" stroke-width="2"/>
  <circle cx="15" cy="13" r="5" fill="#6fae52" stroke="#4e7d38" stroke-width="2"/>
  <circle cx="29" cy="13" r="5" fill="#6fae52" stroke="#4e7d38" stroke-width="2"/>
  <circle cx="15" cy="12.5" r="2" fill="${C.amber}"/><circle cx="29" cy="12.5" r="2" fill="${C.amber}"/>
  <path d="M14 28 q8 4 16 0" stroke="#3c6029" stroke-width="2"/>`);

const GIBBERISH = S(`
  <path d="M7 12 L37 12 Q39 12 39 15 L39 27 Q39 30 37 30 L19 30 L12 36 L13 30 L7 30 Q5 30 5 27 L5 15 Q5 12 7 12 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.8"/>
  <path d="M12 20 q3 -4 5 0 t5 0 M26 17 l0 6 M26 26 l0 0.5" stroke="${C.red2}" stroke-width="2.4"/>`);

const WOLFMARK = S(`
  <path d="M11 11 L15 20 L10 30 C10 34 16 36 22 36 C28 36 34 34 34 30 L29 20 L33 11 L26 16 L18 16 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <circle cx="18" cy="24" r="1.8" fill="${C.plum}"/><circle cx="26" cy="24" r="1.8" fill="${C.plum}"/>
  <path d="M19 30 l3 2 l3 -2" stroke="${C.plum}" stroke-width="1.8"/>
  <path d="M30 8 l-5 7 M34 11 l-5 6 M37 15 l-5 5" stroke="${C.red}" stroke-width="2.2"/>`);

const ROOTED = S(`
  <path d="M22 6 L22 22" stroke="${C.bone2}" stroke-width="2.6"/>
  <path d="M22 22 C16 24 12 30 10 38 M22 22 C28 24 32 30 34 38 M22 22 L22 38 M16 30 L12 34 M28 30 L32 34"
    stroke="#8a6b3f" stroke-width="2.6" fill="none"/>
  <circle cx="22" cy="10" r="4" fill="${C.amber}" stroke="${C.amber2}" stroke-width="1.6"/>`);

const REVERSED = S(`
  <path d="M12 16 C12 10 22 9 26 14 L23 14 M26 14 L26 11" stroke="${C.plum}" stroke-width="2.8" fill="none"/>
  <path d="M32 28 C32 34 22 35 18 30 L21 30 M18 30 L18 33" stroke="${C.amber}" stroke-width="2.8" fill="none"/>`);

const BLOODCURSE = S(`
  <path d="M22 7 C22 7 12 21 12 28 A10 10 0 0 0 32 28 C32 21 22 7 22 7 Z"
    fill="${C.red}" stroke="${C.red2}" stroke-width="2"/>
  <path d="M22 16 L19 24 L24 24 L21 32" stroke="${C.bone}" stroke-width="2" fill="none"/>`);

const PUMPKIN = S(`
  <path d="M22 11 C14 11 8 16 8 24 C8 32 14 36 22 36 C30 36 36 32 36 24 C36 16 30 11 22 11 Z"
    fill="${C.amber}" stroke="${C.amber2}" stroke-width="2"/>
  <path d="M22 11 L22 36 M14 13 L14 35 M30 13 L30 35" stroke="${C.amber2}" stroke-width="1.4" opacity="0.6"/>
  <path d="M21 7 Q24 8 23 11" stroke="#5c7d3a" stroke-width="2.4"/>
  <path d="M14 21 l4 4 l-4 0 Z M30 21 l-4 4 l4 0 Z" fill="${C.plum}"/>
  <path d="M15 30 q7 5 14 0 l-3 -3 -4 2 -4 -2 Z" fill="${C.plum}"/>`);

const REGEN = S(`
  <path d="M22 35 C22 35 12 28 12 19 C12 13 17 12 20 15 C21 16 22 18 22 18 C22 18 23 16 24 15 C27 12 32 13 32 19 C32 28 22 35 22 35 Z"
    fill="none" stroke="${C.teal2}" stroke-width="2"/>
  <path d="M22 13 L22 25 M16 19 L28 19" stroke="${C.teal}" stroke-width="2.8"/>`);

const SPEEDFX = S(`
  <path d="M8 16 L30 16 M6 22 L34 22 M10 28 L26 28" stroke="${C.teal}" stroke-width="3"/>
  <path d="M30 16 l6 0 M34 22 l4 0 M26 28 l5 0" stroke="${C.amber}" stroke-width="3"/>`);

const RAVENCLOAK = S(`
  <path d="M8 16 Q22 12 36 16 Q30 22 34 30 Q22 26 10 30 Q14 22 8 16 Z"
    fill="${C.plum}" stroke="#20142f" stroke-width="1.6"/>
  <path d="M22 14 L22 30 M15 17 L16 28 M29 17 L28 28" stroke="#20142f" stroke-width="1.4" opacity="0.7"/>
  <path d="M33 11 l2 -3 M36 16 l3 -1" stroke="${C.teal}" stroke-width="2" opacity="0.8"/>`);

const GIANT = S(`
  <circle cx="22" cy="12" r="5.5" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M12 37 L14 22 Q22 17 30 22 L32 37 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M9 19 L9 11 L17 11 M9 11 L15 17" stroke="${C.teal}" stroke-width="2.6" fill="none"/>
  <path d="M35 19 L35 11 L27 11 M35 11 L29 17" stroke="${C.teal}" stroke-width="2.6" fill="none"/>`);

const BATS = S(`
  <path d="M22 16 C19 12 15 11 11 13 C13 14 13 17 11 19 C15 18 17 20 18 23 C19 20 20 19 22 19 C24 19 25 20 26 23 C27 20 29 18 33 19 C31 17 31 14 33 13 C29 11 25 12 22 16 Z"
    fill="${C.plum}" stroke="#20142f" stroke-width="1.4"/>
  <path d="M22 19 L22 24" stroke="#20142f" stroke-width="2"/>
  <circle cx="34" cy="28" r="2" fill="${C.plum}"/><circle cx="12" cy="30" r="1.6" fill="${C.plum}"/>`);

const MEDITATE = S(`
  <path d="M22 30 C22 30 10 26 10 18 C14 18 18 22 22 30 Z M22 30 C22 30 34 26 34 18 C30 18 26 22 22 30 Z
           M22 30 C18 22 18 14 22 10 C26 14 26 22 22 30 Z M22 30 C16 26 12 24 8 24 C12 30 18 31 22 30 Z
           M22 30 C28 26 32 24 36 24 C32 30 26 31 22 30 Z"
    fill="${C.teal}" stroke="${C.teal2}" stroke-width="1.4"/>
  <circle cx="22" cy="31" r="2.4" fill="${C.amber}"/>`);

const WOLFPACT = S(`
  <path d="M11 11 L15 20 L10 30 C10 34 16 36 22 36 C28 36 34 34 34 30 L29 20 L33 11 L26 16 L18 16 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <circle cx="18" cy="24" r="1.8" fill="${C.teal2}"/><circle cx="26" cy="24" r="1.8" fill="${C.teal2}"/>
  <path d="M19 30 l3 2 l3 -2" stroke="${C.teal2}" stroke-width="1.8"/>
  <path d="M34 9 l2 -3 M8 12 l-2 -3" stroke="${C.teal}" stroke-width="2"/>`);

const FEATHER = S(`
  <path d="M32 9 C20 11 12 20 11 33 C11 33 16 30 20 30 C19 27 21 24 25 22 C22 23 21 23 20 25 C23 19 28 15 32 9 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M30 12 C24 16 19 22 15 30" stroke="${C.teal2}" stroke-width="1.6" opacity="0.8"/>`);

const WARD = S(`
  <path d="M22 6 L35 11 C35 24 30 33 22 38 C14 33 9 24 9 11 Z"
    fill="${C.bone}" stroke="${C.amber2}" stroke-width="2"/>
  <path d="M22 13 L22 31 M14 15 L30 15" stroke="${C.amber}" stroke-width="2.6"/>
  <path d="M22 6 L35 11 C35 24 30 33 22 38" fill="none" stroke="${C.amber}" stroke-width="1.6" opacity="0.6"/>`);

const COLORCYCLE = S(`
  <path d="M9 30 A13 13 0 0 1 35 30" stroke="${C.red}" stroke-width="3" fill="none"/>
  <path d="M13 30 A9 9 0 0 1 31 30" stroke="${C.amber}" stroke-width="3" fill="none"/>
  <path d="M17 30 A5 5 0 0 1 27 30" stroke="${C.teal}" stroke-width="3" fill="none"/>
  <path d="M33 30 l2 -4 M11 30 l-2 -4" stroke="${C.plum}" stroke-width="2"/>`);

const SALT = S(`
  <path d="M17 8 L27 8 L28 15 L16 15 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M16 15 L28 15 L30 22 L14 22 Z" fill="${C.bone2}" stroke="${C.bone2}" stroke-width="1.4"/>
  <path d="M19 10 l1 0 M23 11 l1 0" stroke="${C.bone2}" stroke-width="1.4"/>
  <circle cx="13" cy="30" r="1.6" fill="${C.bone}"/><circle cx="19" cy="33" r="1.6" fill="${C.bone}"/>
  <circle cx="25" cy="33" r="1.6" fill="${C.bone}"/><circle cx="31" cy="30" r="1.6" fill="${C.bone}"/>
  <circle cx="22" cy="35" r="1.6" fill="${C.bone}"/>`);

// ── Items: weapons ───────────────────────────────────────────────────────────

const I_IRON_SWORD = S(`
  <path d="M22 4 L26 9 L24 27 L20 27 L18 9 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M22 5 L22 26" stroke="#c9d2dc" stroke-width="1.4" opacity="0.9"/>
  <path d="M13 28 L31 28" stroke="${C.amber2}" stroke-width="3.6"/>
  <path d="M22 28 L22 39" stroke="${C.bone2}" stroke-width="3.4"/>
  <circle cx="22" cy="39" r="2.4" fill="${C.amber}" stroke="${C.amber2}" stroke-width="1.2"/>`);

const I_SPELL_TOME = S(`
  <path d="M9 9 L31 9 Q34 9 34 12 L34 34 Q34 36 31 36 L9 36 Q7 36 7 33 L7 11 Q7 9 9 9 Z"
    fill="${C.red2}" stroke="#7a1f36" stroke-width="2"/>
  <path d="M11 9 L11 36" stroke="#7a1f36" stroke-width="2"/>
  <path d="M20 15 l1.8 4 4.2 0 -3.4 2.7 1.3 4 -3.9 -2.4 -3.9 2.4 1.3 -4 -3.4 -2.7 4.2 0 Z"
    fill="${C.amber}" stroke="${C.amber2}" stroke-width="0.8"/>`);

const I_HOLLY_WAND = S(`
  <path d="M14 34 L30 11" stroke="#8a5a30" stroke-width="3" stroke-linecap="round"/>
  <path d="M30 11 l2 -5 3 2 -1 4 Z" fill="${C.teal}" stroke="${C.teal2}" stroke-width="1"/>
  <path d="M12 30 q-5 -1 -6 -6 q5 1 6 6 Z M14 33 q-1 5 -6 6 q1 -5 6 -6 Z" fill="#4e8c3a" stroke="#3c6e2c" stroke-width="1"/>
  <circle cx="31" cy="8" r="2.4" fill="${C.bone}"/>
  <path d="M27 6 l-2 -3 M35 12 l3 -1" stroke="${C.teal}" stroke-width="1.8"/>`);

const I_CURSED_BLADE = S(`
  <path d="M22 4 L26 10 L25 20 L27 24 L23 27 L21 27 L17 24 L19 20 L18 10 Z"
    fill="#3a2850" stroke="#1f1430" stroke-width="1.6"/>
  <path d="M22 6 L22 25" stroke="${C.red}" stroke-width="1.6"/>
  <path d="M13 28 L31 28" stroke="#5a3a2a" stroke-width="3.4"/>
  <path d="M22 28 L22 39" stroke="#2a1d40" stroke-width="3.4"/>
  <circle cx="22" cy="39" r="2.4" fill="${C.red}" stroke="${C.red2}" stroke-width="1"/>`);

const I_SHADOW_STAFF = S(`
  <path d="M20 38 L24 12" stroke="#4a3368" stroke-width="3" stroke-linecap="round"/>
  <circle cx="25" cy="10" r="7" fill="#241836" stroke="#4a3368" stroke-width="2"/>
  <path d="M25 10 m-4 0 a4 4 0 0 0 7 2.5" fill="${C.plum}"/>
  <path d="M30 5 l3 -2 M18 7 l-3 -1" stroke="${C.plum}" stroke-width="1.8"/>`);

const I_VOID_STAFF = S(`
  <path d="M19 38 L25 12" stroke="#2a1d40" stroke-width="3" stroke-linecap="round"/>
  <path d="M26 10 m0 -7 a7 7 0 1 1 -6 11 a4 4 0 1 0 5 -7" fill="none" stroke="${C.teal}" stroke-width="2.4"/>
  <circle cx="26" cy="10" r="1.8" fill="${C.amber}"/>`);

const I_ALPHA_FANG = S(`
  <path d="M16 6 Q30 8 30 22 Q30 34 22 38 Q20 30 18 24 Q15 14 16 6 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.8"/>
  <path d="M19 12 Q24 16 24 24" stroke="${C.bone2}" stroke-width="1.4" opacity="0.7"/>
  <path d="M14 8 L18 12 M14 11 L17 15" stroke="${C.amber2}" stroke-width="2.2"/>`);

// ── Items: starter gear ──────────────────────────────────────────────────────

const I_STEEL_SHIELD = S(`
  <path d="M22 5 L35 10 C35 24 30 33 22 38 C14 33 9 24 9 10 Z"
    fill="#aeb8c4" stroke="#6f7a88" stroke-width="2"/>
  <path d="M22 5 L22 38 M9 15 L35 15" stroke="#6f7a88" stroke-width="1.6" opacity="0.7"/>
  <path d="M22 5 L35 10 C35 20 32 27 22 33" fill="#c7d0da" opacity="0.5"/>`);

const I_WIZARD_HAT = S(`
  <path d="M22 4 L33 32 L11 32 Z" fill="#3a2a60" stroke="#241840" stroke-width="2"/>
  <path d="M6 32 L38 32 L36 37 L8 37 Z" fill="#2a1d48" stroke="#241840" stroke-width="2"/>
  <path d="M24 18 l1.2 3 3.3 0 -2.7 2 1 3.2 -2.8 -1.9 -2.8 1.9 1 -3.2 -2.7 -2 3.3 0 Z"
    fill="${C.amber}" stroke="${C.amber2}" stroke-width="0.7"/>`);

const I_LEATHER_BOOTS = S(`
  <path d="M15 6 L22 6 L23 22 L32 24 Q36 25 36 30 L36 35 L12 35 L12 10 Q12 6 15 6 Z"
    fill="#8a5a34" stroke="#5e3c22" stroke-width="2"/>
  <path d="M12 30 L36 30" stroke="#5e3c22" stroke-width="2"/>
  <path d="M16 12 L19 12 M16 17 L19 17" stroke="#5e3c22" stroke-width="1.6"/>`);

const I_SILVER_RING = S(`
  <circle cx="22" cy="25" r="11" fill="none" stroke="#c9d2dc" stroke-width="4"/>
  <circle cx="22" cy="25" r="11" fill="none" stroke="#eef3f8" stroke-width="1.4" opacity="0.6"/>
  <path d="M22 14 L26 8 L22 4 L18 8 Z" fill="${C.teal}" stroke="${C.teal2}" stroke-width="1.4"/>`);

// ── Items: the wardrobe ──────────────────────────────────────────────────────
// Shared bases keep the gear cohesive; per-item accents make each distinct.

const BOOT = (fill, stroke, accent) => S(`
  <path d="M16 6 L22 6 L23 22 L32 24 Q36 25 36 30 L36 35 L12 35 L12 10 Q12 6 16 6 Z"
    fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <path d="M12 30 L36 30" stroke="${stroke}" stroke-width="2"/>
  ${accent || ''}`);

const CHESTPC = (fill, stroke, accent) => S(`
  <path d="M9 13 L16 11 L22 14 L28 11 L35 13 L32 22 L34 35 L10 35 L12 22 Z"
    fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  <path d="M22 14 L22 35" stroke="${stroke}" stroke-width="1.1" opacity="0.5"/>
  ${accent || ''}`);

const RINGPC = (band, hi, gem) => S(`
  <circle cx="22" cy="27" r="10" fill="none" stroke="${band}" stroke-width="4"/>
  <circle cx="22" cy="27" r="10" fill="none" stroke="${hi}" stroke-width="1.2" opacity="0.55"/>
  ${gem}`);

// heads
const I_BLOODMOON_CIRCLET = S(`
  <path d="M8 26 Q22 17 36 26" fill="none" stroke="${C.red2}" stroke-width="3.6"/>
  <path d="M9 25 Q22 19 35 25" fill="none" stroke="${C.red}" stroke-width="1.4" opacity="0.7"/>
  <path d="M22 19 L27 25 L22 32 L17 25 Z" fill="${C.red}" stroke="#7a1f36" stroke-width="1.6"/>
  <circle cx="10" cy="25" r="2" fill="${C.red2}"/><circle cx="34" cy="25" r="2" fill="${C.red2}"/>`);

const I_BEAST_CROWN = S(`
  <path d="M7 33 L9 17 L14 25 L18 12 L22 23 L26 12 L30 25 L35 17 L37 33 Z"
    fill="#6b4f2e" stroke="#453219" stroke-width="1.8"/>
  <circle cx="22" cy="29" r="2.2" fill="${C.amber}"/>
  <circle cx="14" cy="29" r="1.6" fill="${C.red2}"/><circle cx="30" cy="29" r="1.6" fill="${C.red2}"/>`);

const I_SPIRIT_VEIL = S(`
  <path d="M22 6 C12 6 8 16 9 28 L9 35 L35 35 L35 28 C36 16 32 6 22 6 Z"
    fill="#a9c8ff" opacity="0.45" stroke="#7f9fe0" stroke-width="1.6"/>
  <path d="M22 7 C15 7 12 13 12 21" fill="none" stroke="#7f9fe0" stroke-width="1.4" opacity="0.8"/>
  <path d="M17 16 l0.8 2 2 0 -1.6 1.3 .6 2 -1.8 -1.2 -1.8 1.2 .6 -2 -1.6 -1.3 2 0 Z" fill="${C.bone}"/>
  <circle cx="28" cy="20" r="1.4" fill="${C.bone}"/><circle cx="25" cy="28" r="1.2" fill="${C.bone}"/>`);

const I_DREAD_HELM = S(`
  <path d="M10 21 C10 10 34 10 34 21 L34 30 Q34 34 30 34 L27 34 L27 29 L25 34 L19 34 L17 29 L17 34 L14 34 Q10 34 10 30 Z"
    fill="#2a2234" stroke="#15101c" stroke-width="2"/>
  <path d="M14 20 L20 23 M30 20 L24 23" stroke="${C.red}" stroke-width="2.6"/>
  <path d="M22 24 L22 33" stroke="#15101c" stroke-width="2"/>`);

const I_SHADOW_CROWN = S(`
  <path d="M8 33 L8 17 L15 24 L22 13 L29 24 L36 17 L36 33 Z"
    fill="#241836" stroke="#120b22" stroke-width="1.8"/>
  <path d="M19 9 A4 4 0 1 0 25 9 A5 5 0 0 1 19 9 Z" fill="${C.teal}" stroke="${C.teal2}" stroke-width="1"/>
  <circle cx="15" cy="27" r="1.6" fill="${C.plum}"/><circle cx="29" cy="27" r="1.6" fill="${C.plum}"/>`);

const I_KNIGHTS_HELM = S(`
  <path d="M12 11 L32 11 Q34 11 34 15 L34 31 Q34 35 30 35 L14 35 Q10 35 10 31 L10 15 Q10 11 12 11 Z"
    fill="#aeb8c4" stroke="#6f7a88" stroke-width="2"/>
  <path d="M13 19 L31 19 M13 23 L31 23" stroke="#6f7a88" stroke-width="2.2"/>
  <path d="M22 11 L22 6 L27 4 L25 9" fill="${C.amber}" stroke="${C.amber2}" stroke-width="1.2"/>`);

const I_TRAVELERS_HOOD = S(`
  <path d="M22 6 C12 6 8 16 10 29 L14 26 Q15 32 22 33 Q29 32 30 26 L34 29 C36 16 32 6 22 6 Z"
    fill="#7a6a4a" stroke="#564a33" stroke-width="2"/>
  <path d="M22 11 C17 11 15 16 16 23 Q19 26 22 26 Q25 26 28 23 C29 16 27 11 22 11 Z"
    fill="#3a3326" stroke="#564a33" stroke-width="1.4"/>`);

// chest
const I_BEAST_HIDE = CHESTPC('#8a6240', '#5e3f26', `
  <path d="M10 34 l3 -4 3 4 3 -4 3 4 3 -4 3 4 3 -4 3 4" fill="none" stroke="#5e3f26" stroke-width="1.6"/>
  <path d="M16 18 l3 3 M26 18 l-3 3" stroke="#5e3f26" stroke-width="1.6"/>`);
const I_SPIRIT_ROBE = CHESTPC('#2a2d5e', '#191b3e', `
  <circle cx="17" cy="21" r="1.2" fill="${C.bone}"/><circle cx="27" cy="19" r="1.4" fill="${C.bone}"/>
  <circle cx="22" cy="27" r="1.1" fill="${C.bone}"/><circle cx="30" cy="28" r="1.1" fill="${C.teal}"/>
  <path d="M14 30 l0.7 1.6 1.7 0 -1.4 1.1 .5 1.7 -1.5 -1 -1.5 1 .5 -1.7 -1.4 -1.1 1.7 0 Z" fill="${C.bone}"/>`);
const I_BONE_ARMOR = CHESTPC(C.bone, C.bone2, `
  <path d="M22 16 L22 33 M15 20 Q22 23 29 20 M14 25 Q22 28 30 25 M15 30 Q22 32 29 30"
    fill="none" stroke="${C.bone2}" stroke-width="1.8"/>`);
const I_SHADOW_CLOAK = CHESTPC('#241836', '#140d24', `
  <path d="M9 13 L22 18 L35 13" fill="none" stroke="#4a3368" stroke-width="2"/>
  <circle cx="22" cy="17" r="2.4" fill="${C.plum}" stroke="#4a3368" stroke-width="1.2"/>`);
const I_ABYSSAL_ARMOR = CHESTPC('#161022', '#0a0612', `
  <circle cx="22" cy="24" r="5" fill="none" stroke="${C.teal}" stroke-width="2"/>
  <circle cx="22" cy="24" r="1.6" fill="${C.teal}"/>`);
const I_MOONHOWL_PELT = CHESTPC('#d8d2c4', '#a39a86', `
  <circle cx="22" cy="23" r="5" fill="${C.bone}" stroke="#a39a86" stroke-width="1.4"/>
  <circle cx="24" cy="22" r="4" fill="#d8d2c4"/>
  <path d="M13 19 l3 3 M31 19 l-3 3" stroke="#a39a86" stroke-width="1.6"/>`);
const I_WITCH_ROBE = CHESTPC('#4a2f6e', '#301d49', `
  <path d="M22 14 L22 35" stroke="#2a1a44" stroke-width="2"/>
  <path d="M12 22 L10 35 M32 22 L34 35" fill="none" stroke="${C.amber2}" stroke-width="1.6" opacity="0.8"/>`);
const I_TRAVELERS_VEST = CHESTPC('#6a5a3c', '#473a26', `
  <path d="M22 14 L22 35" stroke="#473a26" stroke-width="2"/>
  <rect x="14" y="24" width="5" height="6" rx="1" fill="none" stroke="#473a26" stroke-width="1.6"/>
  <rect x="25" y="24" width="5" height="6" rx="1" fill="none" stroke="#473a26" stroke-width="1.6"/>`);

// feet
const I_HEXED_BOOTS = BOOT('#3a2a56', '#241836', `<path d="M27 12 A4.5 4.5 0 1 0 33 12 A5.5 5.5 0 0 1 27 12 Z" fill="${C.teal}" stroke="${C.teal2}" stroke-width="1"/>`);
const I_PAW_BOOTS = BOOT('#8a5a34', '#5e3c22', `
  <circle cx="22" cy="24" r="2.6" fill="${C.bone}"/>
  <circle cx="18" cy="20" r="1.3" fill="${C.bone}"/><circle cx="22" cy="18.5" r="1.3" fill="${C.bone}"/><circle cx="26" cy="20" r="1.3" fill="${C.bone}"/>`);
const I_SOUL_TREADS = BOOT('#2c2238', '#181020', `
  <path d="M19 22 Q24 18 29 22 Q24 26 19 22 Z" fill="${C.bone}" stroke="#181020" stroke-width="1"/>
  <circle cx="24" cy="22" r="1.8" fill="${C.teal}"/>`);
const I_WRAITH_TREADS = BOOT('#8690a0', '#59606e', `
  <path d="M14 20 q6 -3 12 0 M12 25 q8 -3 16 0" fill="none" stroke="${C.bone}" stroke-width="1.6" opacity="0.8"/>`);
const I_NIGHTFANG_BOOTS = BOOT('#201a2e', '#100b1a', `<path d="M22 16 Q26 17 26 22 Q26 27 23 30 Q21 24 20 20 Q20 18 22 16 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1"/>`);

// rings / amulets
const I_HEX_AMULET = RINGPC('#5a3f7a', '#8a6ab0', `<circle cx="22" cy="12" r="6" fill="#6a4a95" stroke="#3a2456" stroke-width="1.6"/><circle cx="20" cy="10" r="2" fill="#c9a8ef"/>`);
const I_SPIRIT_RING = RINGPC('#8a78c0', '#b9a8ef', `<path d="M22 14 L27 8 L22 3 L17 8 Z" fill="#9a6ae0" stroke="#6a4aa0" stroke-width="1.4"/>`);
const I_TRAIL_RING = RINGPC('#9a8456', '#c9b87e', `<path d="M22 13 C17 13 16 8 18 5 C19 8 22 9 22 9 C22 9 25 8 26 5 C28 8 27 13 22 13 Z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="1.2"/><circle cx="22" cy="9" r="1.4" fill="${C.bone}"/>`);
const I_DEATH_RING = RINGPC('#2a2234', '#5a4a68', `<path d="M22 4 C17 4 14 7 14 11 C14 13 15 14 16 15 L16 17 L28 17 L28 15 C29 14 30 13 30 11 C30 7 27 4 22 4 Z" fill="${C.bone}" stroke="#c9bca0" stroke-width="1"/><circle cx="19" cy="10" r="1.2" fill="#2a2234"/><circle cx="25" cy="10" r="1.2" fill="#2a2234"/>`);
const I_PACKBOUND_RING = RINGPC('#7a5a38', '#a9824e', `<path d="M18 9 Q22 4 26 9 Q30 13 26 15 Q22 10 18 15 Q14 13 18 9 Z" fill="none" stroke="${C.amber2}" stroke-width="2.4"/>`);
const I_ORDER_SIGNET = RINGPC('#c9a83e', '#eed47a', `<circle cx="22" cy="12" r="7" fill="#d9b84e" stroke="#a9842c" stroke-width="1.6"/><path d="M22 8 L24 11 L27 11 L24.5 13 L25.5 16 L22 14 L18.5 16 L19.5 13 L17 11 L20 11 Z" fill="#8a6a1e"/>`);
const I_WITCHES_BOON = RINGPC('#4a6a9a', '#7f9fcf', `<circle cx="22" cy="12" r="7" fill="#2a5a9a" stroke="#1a3a6a" stroke-width="1.4"/><circle cx="22" cy="12" r="4" fill="#a9c8ff"/><circle cx="22" cy="12" r="1.8" fill="#1a2a4a"/>`);

// ── Items: consumables, potions & brews ──────────────────────────────────────
// A shared flask/jar language; distinct liquid colors + effect motifs per item.

const POTION = (liquid, lo, accent) => S(`
  <path d="M19 4 L25 4 L25 10 L29 17 Q33 23 33 30 Q33 38 22 38 Q11 38 11 30 Q11 23 15 17 L19 10 Z"
    fill="#1c1630" stroke="${C.bone}" stroke-width="2"/>
  <path d="M14 23 Q11 30 22 35.5 Q33 30 30 23 Z" fill="${liquid}" stroke="${lo}" stroke-width="1"/>
  <rect x="17.5" y="2.5" width="9" height="4.5" rx="1.5" fill="#8a6a4a" stroke="#5e442c" stroke-width="1"/>
  ${accent || ''}`);

const JAR = (fill, lo, accent) => S(`
  <rect x="11" y="16" width="22" height="20" rx="4" fill="${fill}" stroke="${lo}" stroke-width="2"/>
  <rect x="9" y="10" width="26" height="7" rx="3" fill="${C.bone2}" stroke="${lo}" stroke-width="1.6"/>
  ${accent || ''}`);

const I_HEALING_POTION   = POTION('#e2566a', '#b8324e', `<path d="M22 26 l0 7 M18.5 29.5 l7 0" stroke="${C.bone}" stroke-width="2.4"/>`);
const I_HEALTH_POTION_II = POTION('#e2566a', '#b8324e', `<path d="M22 24 l-2.5 5 2.5 -1 -1 5 3 -6 -2.5 1 z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="0.8"/>`);
const I_MOONWELL_DRAUGHT = POTION('#6f9ee8', '#3f66b0', `<path d="M25 25 A4 4 0 1 0 25 33 A5 5 0 0 1 25 25 Z" fill="${C.bone}"/>`);
const I_REGEN_BREW        = POTION('#5fbf7a', '#3a8c52', `<circle cx="20" cy="28" r="1.6" fill="${C.bone}"/><circle cx="25" cy="31" r="1.2" fill="${C.bone}"/><circle cx="23" cy="26" r="1" fill="${C.bone}"/>`);
const I_SWIFT_BREW        = POTION('#78e8c8', '#3fb79a', `<path d="M16 27 l10 0 M17 30 l8 0 M18 33 l6 0" stroke="${C.bone}" stroke-width="1.6"/>`);
const I_SHADOW_DRAUGHT    = POTION('#2a1d40', '#140d24', `<path d="M26 24 A4.5 4.5 0 1 0 26 33 A5.5 5.5 0 0 1 26 24 Z" fill="${C.plum}"/>`);
const I_GIANTS_ELIXIR     = POTION('#b98a52', '#8a5f32', `<path d="M22 33 L22 25 M18 28 L22 24 L26 28" stroke="${C.bone}" stroke-width="2" fill="none"/>`);
const I_BAT_SWARM_POTION  = POTION('#4a3368', '#2a1d40', `<path d="M18 29 q2 -3 4 0 q2 -3 4 0 l-1 3 q-3 -2 -3 0 q0 -2 -3 0 z" fill="${C.bone}"/>`);
const I_CLARITY_DRAUGHT   = POTION('#d9e6ff', '#9fb8e0', `<path d="M22 24 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1 z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="0.7"/>`);
const I_CHAOS_BREW        = POTION('#b56ad0', '#7a3f95', `<path d="M18 27 q4 -3 8 0 q-2 4 -8 2 q4 3 8 1" fill="none" stroke="${C.amber}" stroke-width="1.6"/>`);
const I_WOLF_PACT_BREW    = POTION('#c98a3a', '#9a6424', `<circle cx="22" cy="30" r="1.8" fill="${C.bone}"/><circle cx="19" cy="27" r="1" fill="${C.bone}"/><circle cx="22" cy="26" r="1" fill="${C.bone}"/><circle cx="25" cy="27" r="1" fill="${C.bone}"/>`);
const I_MOON_WATER        = POTION('#a9c8ff', '#6f9ee8', `<circle cx="24" cy="29" r="3.4" fill="${C.bone}"/><circle cx="25.6" cy="28" r="2.6" fill="#a9c8ff"/>`);
const I_GLASS_VIAL        = S(`
  <path d="M19 4 L25 4 L25 10 L29 17 Q33 23 33 30 Q33 38 22 38 Q11 38 11 30 Q11 23 15 17 L19 10 Z"
    fill="none" stroke="${C.bone}" stroke-width="2"/>
  <path d="M17 7 L27 7" stroke="${C.bone2}" stroke-width="2.4"/>
  <path d="M20 14 Q18 18 19 22" stroke="${C.bone2}" stroke-width="1.4" opacity="0.6"/>`);

const I_BARKBIND_SALVE   = JAR('#8a6a44', '#5e442c', `<path d="M15 26 q7 -4 14 0" stroke="${C.bone}" stroke-width="2" fill="none"/>`);
const I_CAPWOOD_ELIXIR   = POTION('#a9724a', '#7a4e2e', `<path d="M17 27 q5 -5 10 0 q-1 4 -5 4 q-4 0 -5 -4 z M22 23 l0 4" fill="${C.bone}" stroke="#7a4e2e" stroke-width="0.8"/>`);
const I_NIGHTSIGHT_DRAUGHT = POTION('#2c2238', '#181020', `<path d="M18 29 q4 -4 8 0 q-4 4 -8 0 z" fill="${C.bone}"/><circle cx="22" cy="29" r="1.6" fill="${C.teal}"/>`);
const I_FERNSTEP_PHILTRE = POTION('#5fb0a0', '#3a8072', `<path d="M18 27 q4 -3 7 1 q-3 3 -6 0 q2 2 4 1" fill="none" stroke="${C.bone}" stroke-width="1.6"/>`);
const I_BRAMBLE_POULTICE = JAR('#4e7d4a', '#355833', `<path d="M22 24 C22 24 17 28 22 32 C27 28 22 24 22 24 Z" fill="${C.bone}"/>`);
const I_WITCHWOOD_BALM   = JAR('#7a6a4a', '#564a33', `<path d="M22 24 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1 z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="0.7"/>`);
const I_TRAIL_REMEDY     = S(`
  <path d="M11 17 L31 17 L30 27 Q30 33 21 33 Q12 33 12 27 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="2"/>
  <path d="M31 19 Q37 20 36 25 Q35 28 31 28" fill="none" stroke="${C.bone2}" stroke-width="2"/>
  <path d="M19 9 Q17 12 19 14 M24 9 Q22 12 24 14" stroke="${C.bone2}" stroke-width="1.6" opacity="0.7"/>`);

// special consumables / valuables
const I_MAGIC_SCROLL = S(`
  <path d="M12 10 Q9 10 9 13 Q9 16 12 16 L30 16 Q33 16 33 13 Q33 10 30 10 Z" fill="${C.bone2}" stroke="#a39a86" stroke-width="1.4"/>
  <path d="M12 16 L12 32 Q12 34 14 34 L30 34 L30 16" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M30 28 Q35 28 35 31 Q35 34 31 34" fill="none" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M16 21 l11 0 M16 25 l9 0" stroke="${C.amber2}" stroke-width="1.6" opacity="0.8"/>`);
const I_DRAGON_SCALE = S(`
  <path d="M22 5 Q34 11 32 24 Q30 35 22 38 Q14 35 12 24 Q10 11 22 5 Z" fill="#3a8c6a" stroke="#246048" stroke-width="2"/>
  <path d="M22 12 Q28 15 27 23 M22 12 Q16 15 17 23 M22 20 Q27 23 26 30 M22 20 Q17 23 18 30"
    fill="none" stroke="#246048" stroke-width="1.6"/>
  <path d="M19 10 l3 2 l3 -2" stroke="${C.teal}" stroke-width="1.6" opacity="0.7"/>`);
const I_ENCHANTED_GEM = S(`
  <path d="M22 5 L34 16 L22 39 L10 16 Z" fill="#b56ad0" stroke="#7a3f95" stroke-width="2"/>
  <path d="M22 5 L22 39 M10 16 L34 16 M15 16 L22 5 L29 16" stroke="#e0b8f0" stroke-width="1.3" opacity="0.6" fill="none"/>
  <path d="M13 12 L17 14" stroke="#ffffff" stroke-width="1.6" opacity="0.8"/>`);
const I_ANCIENT_COIN = S(`
  <circle cx="22" cy="22" r="15" fill="#d9b84e" stroke="#a9842c" stroke-width="2"/>
  <circle cx="22" cy="22" r="11" fill="none" stroke="#a9842c" stroke-width="1.2"/>
  <path d="M22 14 A4 4 0 1 0 22 22 A5.5 5.5 0 0 1 22 14 Z" fill="#a9842c"/>
  <path d="M20 26 l4 0" stroke="#a9842c" stroke-width="2"/>`);
const I_GOLDEN_CHALICE = S(`
  <path d="M13 9 L31 9 Q31 20 22 22 Q13 20 13 9 Z" fill="#d9b84e" stroke="#a9842c" stroke-width="2"/>
  <path d="M22 22 L22 32 M15 34 L29 34 Q29 31 22 31 Q15 31 15 34 Z" fill="#d9b84e" stroke="#a9842c" stroke-width="2"/>
  <path d="M16 12 L28 12" stroke="#eed47a" stroke-width="1.6" opacity="0.7"/>`);
const I_HARD_DRIVE = S(`
  <rect x="9" y="11" width="26" height="22" rx="3" fill="#2a2a36" stroke="#14141c" stroke-width="2"/>
  <circle cx="22" cy="22" r="7" fill="none" stroke="#6f7a88" stroke-width="2"/>
  <circle cx="22" cy="22" r="2" fill="${C.amber}"/>
  <path d="M22 22 L28 16" stroke="${C.amber2}" stroke-width="1.8"/>
  <path d="M30 29 l2 0" stroke="${C.teal}" stroke-width="2"/>`);
const I_BLOODMOON_SHARD = S(`
  <path d="M20 4 L27 16 L24 38 L19 24 L15 14 Z" fill="${C.red}" stroke="${C.red2}" stroke-width="1.8"/>
  <path d="M20 8 L22 22" stroke="#ff9aa8" stroke-width="1.4" opacity="0.7"/>`);
const I_BERRIES = S(`
  <circle cx="17" cy="27" r="7" fill="#c23050" stroke="#8a1e38" stroke-width="1.6"/>
  <circle cx="27" cy="29" r="6" fill="#d8405e" stroke="#8a1e38" stroke-width="1.6"/>
  <circle cx="15" cy="25" r="1.4" fill="#ff9aa8"/><circle cx="25" cy="27" r="1.2" fill="#ff9aa8"/>
  <path d="M17 20 L20 10 L25 9 M20 10 L28 14" stroke="#4e8c3a" stroke-width="2" fill="none"/>`);

// ── Items: crafting materials ────────────────────────────────────────────────

const MUSH = (cap, capLo, stem, spots) => S(`
  <path d="M8 22 Q8 11 22 11 Q36 11 36 22 Q36 25 22 25 Q8 25 8 22 Z" fill="${cap}" stroke="${capLo}" stroke-width="1.8"/>
  <path d="M18 25 L17 35 Q22 37 27 35 L26 25 Z" fill="${stem}" stroke="${capLo}" stroke-width="1.6"/>
  ${spots || ''}`);

const I_WOOD        = S(`<path d="M10 14 L30 14 Q36 14 36 22 Q36 30 30 30 L10 30 Q4 30 4 22 Q4 14 10 14 Z" fill="#9a6e42" stroke="#6b4a28" stroke-width="2"/><ellipse cx="30" cy="22" rx="4" ry="8" fill="#b98a56" stroke="#6b4a28" stroke-width="1.4"/><ellipse cx="30" cy="22" rx="1.6" ry="4" fill="#6b4a28"/>`);
const I_WITCHWOOD   = S(`<path d="M10 14 L30 14 Q36 14 36 22 Q36 30 30 30 L10 30 Q4 30 4 22 Q4 14 10 14 Z" fill="#3a2d50" stroke="#20142f" stroke-width="2"/><ellipse cx="30" cy="22" rx="4" ry="8" fill="#4a3368" stroke="#20142f" stroke-width="1.4"/><ellipse cx="30" cy="22" rx="1.6" ry="4" fill="${C.teal}"/>`);
const I_LUMBER_BUNDLE = S(`<rect x="7" y="12" width="30" height="6" rx="2" fill="#b98a56" stroke="#6b4a28" stroke-width="1.6"/><rect x="7" y="20" width="30" height="6" rx="2" fill="#a97c48" stroke="#6b4a28" stroke-width="1.6"/><rect x="7" y="28" width="30" height="6" rx="2" fill="#b98a56" stroke="#6b4a28" stroke-width="1.6"/><path d="M14 10 L14 36 M30 10 L30 36" stroke="#5e3f22" stroke-width="2"/>`);
const I_STONE_BLOCK = S(`<path d="M10 14 L34 14 L34 32 Q34 34 32 34 L10 34 Q8 34 8 32 L8 16 Z" fill="#9aa0a8" stroke="#636973" stroke-width="2"/><path d="M8 16 L34 14 M20 14 L20 34 M8 24 L34 24" stroke="#636973" stroke-width="1.4" opacity="0.6"/>`);
const I_IRON_ORE    = S(`<path d="M9 24 L15 13 L28 11 L36 20 L32 33 L18 35 Z" fill="#7a7f88" stroke="#4e525a" stroke-width="2"/><path d="M18 18 l3 3 M26 22 l3 2 M20 27 l2 2" stroke="#c9d2dc" stroke-width="2.2"/>`);
const I_IRON_INGOT  = S(`<path d="M8 24 L12 18 L32 18 L36 24 L36 30 Q36 32 34 32 L10 32 Q8 32 8 30 Z" fill="#aeb8c4" stroke="#6f7a88" stroke-width="2"/><path d="M12 18 L36 24 M8 24 L32 18" stroke="#6f7a88" stroke-width="1.4" opacity="0.5"/><path d="M14 22 L22 22" stroke="#eef3f8" stroke-width="1.4" opacity="0.7"/>`);
const I_DRUID_STONE = S(`<path d="M15 6 Q22 4 29 6 L31 34 Q22 37 13 34 Z" fill="#8a8f98" stroke="#5a5f68" stroke-width="2"/><path d="M22 13 A4 4 0 1 0 22 21 A5 5 0 0 1 22 13 Z" fill="${C.teal}" stroke="${C.teal2}" stroke-width="1"/><path d="M18 26 l8 0 M19 30 l6 0" stroke="#5a5f68" stroke-width="1.6"/>`);
const I_PINE_PITCH  = S(`<path d="M22 6 L29 16 L26 16 L32 26 L28 26 L34 34 L10 34 L16 26 L12 26 L18 16 L15 16 Z" fill="#2e6e4a" stroke="#1e4a30" stroke-width="1.8"/><circle cx="22" cy="30" r="2.4" fill="${C.amber}" opacity="0.85"/>`);
const I_BIRCH_BARK  = S(`<path d="M14 8 Q10 20 14 36 Q22 33 30 36 Q26 20 30 8 Q22 11 14 8 Z" fill="#e8e2d4" stroke="#b0a890" stroke-width="1.8"/><path d="M17 15 l5 0 M18 22 l6 0 M17 29 l5 0" stroke="#5a5244" stroke-width="2"/>`);
const I_BRAMBLE_VINE = S(`<path d="M8 32 Q16 24 20 28 Q24 32 30 22 Q34 16 36 10" fill="none" stroke="#3a6e34" stroke-width="2.6"/><path d="M16 27 l-3 -3 M24 27 l3 -3 M30 20 l3 2 M14 30 l2 3" stroke="#2a5226" stroke-width="2"/><circle cx="36" cy="10" r="2" fill="#5a2a44"/>`);
const I_WILLOW_FROND = S(`<path d="M22 5 L22 36" stroke="#6b8a3a" stroke-width="2"/><path d="M22 10 Q12 14 10 26 M22 14 Q14 18 13 30 M22 10 Q32 14 34 26 M22 14 Q30 18 31 30" fill="none" stroke="#7faa44" stroke-width="2"/>`);
const I_FERN_FROND  = S(`<path d="M22 37 L22 8" stroke="#4e8c3a" stroke-width="2"/><path d="M22 12 q-8 -2 -11 -7 M22 17 q-7 -1 -10 -5 M22 22 q-6 0 -9 -4 M22 12 q8 -2 11 -7 M22 17 q7 -1 10 -5 M22 22 q6 0 9 -4" fill="none" stroke="#5faa48" stroke-width="1.8"/>`);
const I_BLACKTHORN  = S(`<path d="M10 34 Q18 20 22 6" fill="none" stroke="#2a2030" stroke-width="2.6"/><path d="M16 22 l-4 -2 M19 15 l4 -1 M14 28 l-4 0" stroke="#1a1420" stroke-width="2"/><path d="M22 6 C19 8 20 12 22 12 C24 12 25 8 22 6 Z" fill="#5a2a44" stroke="#3a1a2c" stroke-width="1"/>`);
const I_NIGHTBERRY  = S(`<circle cx="16" cy="26" r="6" fill="#3a4a8a" stroke="#242f5e" stroke-width="1.6"/><circle cx="26" cy="28" r="5.5" fill="#4a5a9a" stroke="#242f5e" stroke-width="1.6"/><circle cx="22" cy="19" r="5" fill="#3a4a8a" stroke="#242f5e" stroke-width="1.6"/><circle cx="14" cy="24" r="1.3" fill="#9aacff"/><path d="M22 14 L24 8" stroke="#4e8c3a" stroke-width="2"/>`);
const I_HEX_ACORN   = S(`<path d="M12 20 Q22 14 32 20 Q30 24 22 24 Q14 24 12 20 Z" fill="#8a6a3a" stroke="#5e4624" stroke-width="1.6"/><path d="M14 20 Q22 36 30 20 Q30 33 22 35 Q14 33 14 20 Z" fill="#c99a56" stroke="#8a6230" stroke-width="1.8"/><path d="M22 12 L22 15" stroke="#5e4624" stroke-width="2.2"/>`);
const I_TOADCAP     = MUSH('#9a6e42', '#6b4a28', '#d8c8a8', `<circle cx="16" cy="18" r="1.6" fill="#d8c8a8"/><circle cx="24" cy="16" r="2" fill="#d8c8a8"/><circle cx="29" cy="19" r="1.4" fill="#d8c8a8"/>`);
const I_RING_CAP    = MUSH('#c99a56', '#8a6230', C.bone, `<path d="M17 29 q5 2 10 0" stroke="#8a6230" stroke-width="1.6" fill="none"/>`);
const I_FUR_SCRAP   = S(`<path d="M10 24 Q8 16 16 15 Q18 9 25 12 Q33 10 34 18 Q38 22 33 27 Q34 34 26 33 Q20 37 15 31 Q9 30 10 24 Z" fill="#b89a6a" stroke="#8a714a" stroke-width="1.8"/><path d="M16 20 l2 3 M24 18 l2 3 M22 26 l2 3 M29 22 l2 2" stroke="#8a714a" stroke-width="1.4"/>`);
const I_ANIMAL_PELT = S(`<path d="M12 8 Q8 10 10 15 L10 30 Q10 36 16 35 L28 35 Q34 36 34 30 L34 15 Q36 10 32 8 Q28 12 22 11 Q16 12 12 8 Z" fill="#9a6e48" stroke="#6b4a2c" stroke-width="2"/><path d="M22 14 L22 33" stroke="#6b4a2c" stroke-width="1.2" opacity="0.5"/><circle cx="18" cy="20" r="1.4" fill="#6b4a2c"/><circle cx="26" cy="22" r="1.4" fill="#6b4a2c"/>`);
const I_LEATHER_HIDE = S(`<path d="M9 12 L33 10 Q36 14 34 20 L35 32 Q30 35 22 34 Q14 35 9 32 L10 20 Q7 15 9 12 Z" fill="#a9743e" stroke="#744a24" stroke-width="2"/><path d="M14 16 l0 14 M28 15 l0 15" stroke="#744a24" stroke-width="1.2" opacity="0.5"/>`);
const I_BONE_SHARD  = S(`<path d="M12 9 Q9 9 9 12 Q9 15 12 15 Q13 18 11 21 L20 30 Q23 32 25 34 Q25 37 28 37 Q31 37 31 34 Q34 34 34 31 Q34 28 31 28 Q29 26 27 24 L18 15 Q16 13 15 11 Q15 9 12 9 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.8"/>`);
const I_ENCHANTED_FUR = S(`<path d="M10 24 Q8 16 16 15 Q18 9 25 12 Q33 10 34 18 Q38 22 33 27 Q34 34 26 33 Q20 37 15 31 Q9 30 10 24 Z" fill="#9a8ac0" stroke="#6a5a95" stroke-width="1.8"/><path d="M24 14 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1 z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="0.6"/>`);
const I_SHADOW_ESSENCE = S(`<path d="M22 7 C13 9 11 18 14 24 C10 27 11 33 17 33 C19 37 26 37 28 33 C34 33 35 27 31 24 C34 18 32 9 22 7 Z" fill="#241836" stroke="#140d24" stroke-width="1.8" opacity="0.92"/><circle cx="19" cy="21" r="1.6" fill="${C.plum}"/><circle cx="26" cy="24" r="1.4" fill="${C.plum}"/>`);
const I_GLIMMERDUST = S(`<path d="M14 30 Q12 18 22 12 Q20 20 26 22 Q22 25 24 32 Q18 28 14 30 Z" fill="#c9b86a" stroke="#9a8440" stroke-width="1.4"/><path d="M28 12 l1 3 3 1 -3 1 -1 3 -1 -3 -3 -1 3 -1 z" fill="${C.amber}"/><circle cx="16" cy="16" r="1.4" fill="${C.bone}"/><circle cx="31" cy="28" r="1.4" fill="${C.bone}"/>`);
const I_HOLLOW_SHARD = S(`<path d="M22 5 L34 16 L22 39 L10 16 Z" fill="#4a7f9a" stroke="#2e5a70" stroke-width="2" opacity="0.85"/><path d="M22 5 L22 39 M10 16 L34 16" stroke="#a9d8ef" stroke-width="1.3" opacity="0.6"/><path d="M22 14 A4 4 0 1 0 22 22 A5 5 0 0 1 22 14 Z" fill="#1c2a34"/>`);

// ── Items: garden herbs ──────────────────────────────────────────────────────

const FLOWER = (petal, lo, center, stem) => S(`
  <path d="M22 34 L22 20" stroke="${stem || '#4e8c3a'}" stroke-width="2"/>
  <path d="M30 26 Q26 24 22 25 M14 26 Q18 24 22 25" fill="none" stroke="${stem || '#4e8c3a'}" stroke-width="1.8"/>
  <g fill="${petal}" stroke="${lo}" stroke-width="1.2">
    <ellipse cx="22" cy="11" rx="3.4" ry="6"/>
    <ellipse cx="22" cy="11" rx="3.4" ry="6" transform="rotate(72 22 16)"/>
    <ellipse cx="22" cy="11" rx="3.4" ry="6" transform="rotate(144 22 16)"/>
    <ellipse cx="22" cy="11" rx="3.4" ry="6" transform="rotate(216 22 16)"/>
    <ellipse cx="22" cy="11" rx="3.4" ry="6" transform="rotate(288 22 16)"/>
  </g>
  <circle cx="22" cy="16" r="3" fill="${center}"/>`);

const I_SWIFT_ROOT   = S(`<path d="M24 10 Q32 18 26 32 Q22 40 18 32 Q12 18 20 10 Q22 8 24 10 Z" fill="#e08a3a" stroke="#b0641e" stroke-width="1.8"/><path d="M20 15 l8 0 M19 20 l9 0 M20 25 l7 0" stroke="#b0641e" stroke-width="1.2"/><path d="M22 10 Q18 4 14 5 M22 10 Q26 4 30 5 M22 10 L22 3" stroke="${C.teal}" stroke-width="2" fill="none"/>`);
const I_FEATHERLEAF  = S(`<path d="M30 8 Q14 12 12 34 Q18 30 22 30 Q20 24 24 22 Q28 16 30 8 Z" fill="#6faa5a" stroke="#4a7d3c" stroke-width="1.6"/><path d="M28 12 Q20 18 15 29" stroke="#4a7d3c" stroke-width="1.4"/>`);
const I_GIANTS_CAP   = MUSH('#c86a4a', '#9a4a30', C.bone, `<circle cx="16" cy="18" r="2" fill="${C.bone}"/><circle cx="24" cy="16" r="2.4" fill="${C.bone}"/><circle cx="30" cy="19" r="1.8" fill="${C.bone}"/><path d="M20 30 L22 24 L24 30" fill="none" stroke="#9a4a30" stroke-width="1.6"/>`);
const I_SHRINKING_VIOLET = FLOWER('#9a6ad0', '#6a4aa0', '#e0c850', '#4e8c3a');
const I_PUMPKIN_BLOSSOM  = FLOWER('#e89a3a', '#b86a1e', '#8a5a1e', '#5c7d3a');
const I_BATS_BREATH  = S(`<path d="M22 34 L22 20" stroke="#5a5a6a" stroke-width="2"/><path d="M14 14 q4 -5 8 0 q4 -5 8 0 q0 5 -8 9 q-8 -4 -8 -9 z" fill="#3a3a4e" stroke="#242432" stroke-width="1.4"/><circle cx="18" cy="15" r="1.2" fill="${C.plum}"/><circle cx="26" cy="15" r="1.2" fill="${C.plum}"/>`);
const I_RAINBOW_PETAL = S(`<path d="M22 34 L22 22" stroke="#4e8c3a" stroke-width="2"/><g stroke-width="1.1"><ellipse cx="22" cy="11" rx="3.4" ry="6" fill="#e2566a" stroke="#b8324e"/><ellipse cx="22" cy="11" rx="3.4" ry="6" transform="rotate(72 22 16)" fill="#e8a53a" stroke="#b87a1e"/><ellipse cx="22" cy="11" rx="3.4" ry="6" transform="rotate(144 22 16)" fill="#5fbf7a" stroke="#3a8c52"/><ellipse cx="22" cy="11" rx="3.4" ry="6" transform="rotate(216 22 16)" fill="#5a9ae8" stroke="#3a6ab0"/><ellipse cx="22" cy="11" rx="3.4" ry="6" transform="rotate(288 22 16)" fill="#9a6ad0" stroke="#6a4aa0"/></g><circle cx="22" cy="16" r="2.6" fill="${C.bone}"/>`);
const I_RAVENS_FEATHER_PLANT = S(`<path d="M22 36 L22 10" stroke="#3a3a4e" stroke-width="2"/><path d="M22 14 Q14 16 11 26 Q18 24 22 20 M22 20 Q30 22 33 30 Q26 28 22 24" fill="#2a2a3e" stroke="#16161f" stroke-width="1.4"/><path d="M19 8 l2 -4 M25 8 l-2 -4" stroke="${C.teal}" stroke-width="1.6"/>`);
const I_STUMBLEWEED  = S(`<circle cx="22" cy="23" r="13" fill="none" stroke="#b09a56" stroke-width="2"/><path d="M12 18 Q22 24 32 16 M10 26 Q22 20 34 28 M16 12 Q20 24 26 34 M28 12 Q22 24 16 34" fill="none" stroke="#9a8440" stroke-width="1.6"/>`);
const I_GIBBERISH_ROOT = S(`<path d="M14 12 Q10 18 14 22 Q8 24 12 30 Q16 36 22 32 Q28 37 31 30 Q37 27 32 22 Q36 16 30 14 Q26 8 20 12 Q17 9 14 12 Z" fill="#c99a6a" stroke="#9a6e42" stroke-width="1.8"/><path d="M20 18 l0 10 M26 20 l0 8" stroke="#9a6e42" stroke-width="1.2"/>`);
const I_TOADSTOOL    = MUSH('#d23a3a', '#9a1e1e', C.bone, `<circle cx="16" cy="18" r="2" fill="${C.bone}"/><circle cx="24" cy="16" r="2.4" fill="${C.bone}"/><circle cx="30" cy="19" r="1.6" fill="${C.bone}"/>`);
const I_WOLFSBANE_BLOOM = S(`<path d="M22 36 L22 18" stroke="#3a6e34" stroke-width="2"/><path d="M14 24 Q18 20 22 22 M30 24 Q26 20 22 22" fill="none" stroke="#3a6e34" stroke-width="1.8"/><path d="M22 6 Q16 8 17 16 Q22 14 22 14 Q22 14 27 16 Q28 8 22 6 Z" fill="#6a4ab0" stroke="#4a3080" stroke-width="1.6"/><path d="M22 9 L22 15" stroke="#9a7ad8" stroke-width="1.4"/>`);
const I_MEDITATION_LOTUS = S(`<path d="M22 32 C22 32 10 28 10 20 C14 20 18 24 22 32 Z M22 32 C22 32 34 28 34 20 C30 20 26 24 22 32 Z M22 32 C18 24 18 16 22 12 C26 16 26 24 22 32 Z M22 32 C16 28 12 26 8 26 C12 32 18 33 22 32 Z M22 32 C28 28 32 26 36 26 C32 32 26 33 22 32 Z" fill="#f0a0c8" stroke="#c86a9a" stroke-width="1.4"/><circle cx="22" cy="31" r="2.4" fill="${C.amber}"/>`);
const I_HEALING_HERB = S(`<path d="M22 37 L22 12" stroke="#3a7d2e" stroke-width="2"/><path d="M22 20 Q13 18 10 9 Q19 10 22 18 M22 26 Q31 24 34 15 Q25 16 22 24" fill="#5faa44" stroke="#3a7d2e" stroke-width="1.4"/>`);
const I_REGEN_ROOT   = S(`<path d="M16 12 Q10 20 16 26 Q12 34 20 34 Q24 38 28 33 Q35 31 30 24 Q35 18 28 15 Q26 9 20 12 Q18 9 16 12 Z" fill="#8aae5a" stroke="#5e7d3a" stroke-width="1.8"/><path d="M22 18 l0 10" stroke="#5e7d3a" stroke-width="1.4"/><path d="M20 9 Q22 4 24 9" stroke="#3a7d2e" stroke-width="2" fill="none"/>`);
const I_CLEANSING_CLOVER = S(`<g fill="#4e9c3a" stroke="#357028" stroke-width="1.2"><path d="M22 20 C18 14 12 16 14 21 C16 24 20 23 22 20 Z"/><path d="M22 20 C26 14 32 16 30 21 C28 24 24 23 22 20 Z"/><path d="M22 20 C16 22 15 28 20 28 C23 28 23 24 22 20 Z"/><path d="M22 20 C28 22 29 28 24 28 C21 28 21 24 22 20 Z"/></g><path d="M22 22 L23 36" stroke="#357028" stroke-width="2"/>`);

// ── Abilities: Witch / Mage spells ───────────────────────────────────────────

const A_OPEN_THIRD_EYE = S(`
  <path d="M6 22 Q22 10 38 22 Q22 34 6 22 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.8"/>
  <circle cx="22" cy="22" r="5.5" fill="#6a4aa0"/><ellipse cx="22" cy="22" rx="2" ry="5" fill="#1a1030"/>
  <path d="M22 9 L22 4 M13 12 L10 8 M31 12 L34 8" stroke="${C.amber}" stroke-width="2"/>`);
const A_TOADS_TONGUE = S(`
  <path d="M8 24 Q8 14 22 14 Q36 14 36 24 Q36 30 22 30 Q8 30 8 24 Z" fill="#6fae52" stroke="#4e7d38" stroke-width="2"/>
  <circle cx="15" cy="14" r="4.5" fill="#6fae52" stroke="#4e7d38" stroke-width="1.8"/><circle cx="29" cy="14" r="4.5" fill="#6fae52" stroke="#4e7d38" stroke-width="1.8"/>
  <circle cx="15" cy="13.5" r="1.8" fill="${C.amber}"/><circle cx="29" cy="13.5" r="1.8" fill="${C.amber}"/>
  <path d="M19 26 q3 8 6 0" fill="${C.red}" stroke="#9a1e38" stroke-width="1.2"/>`);
const A_STUMBLE_HEX = S(`
  <path d="M14 10 Q22 14 20 22 Q18 30 26 34 L30 32 L28 38 L22 36 L25 35 Q17 31 16 23 Q15 15 11 12 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M30 14 q4 2 3 7 M33 11 q6 3 4 10" fill="none" stroke="${C.plum}" stroke-width="2"/>`);
const A_FIREBALL = S(`
  <path d="M22 4 C26 12 32 13 30 22 C34 20 34 16 34 16 C38 24 34 38 22 38 C10 38 6 26 12 18 C12 22 14 24 16 23 C13 15 18 10 22 4 Z"
    fill="#ff8a3a" stroke="#d95f1e" stroke-width="1.8"/>
  <path d="M22 18 C25 22 25 28 22 32 C19 28 19 22 22 18 Z" fill="${C.amber}"/>`);
const A_WITHERING_HEX = S(`
  <path d="M22 38 L22 20" stroke="#5a6e3a" stroke-width="2"/>
  <path d="M22 24 Q14 24 11 31 Q18 31 22 26" fill="#6e7d4a" stroke="#4e5a2e" stroke-width="1.4"/>
  <path d="M24 10 Q32 12 31 20 Q26 24 21 20 Q16 14 18 9 Q21 12 24 10 Z" fill="#8a5a7a" stroke="#5e3a52" stroke-width="1.6"/>
  <path d="M28 20 l3 4 M30 16 l4 2" stroke="#5e3a52" stroke-width="1.6"/>`);
const A_LEECH_HEX = S(`
  <path d="M22 7 C22 7 12 21 12 28 A10 10 0 0 0 32 28 C32 21 22 7 22 7 Z" fill="${C.red}" stroke="${C.red2}" stroke-width="2"/>
  <path d="M22 30 m0 -5 a5 5 0 1 1 -4 8" fill="none" stroke="${C.bone}" stroke-width="2"/>`);
const A_MONSTROUS_FORM = S(`
  <path d="M9 16 L13 11 L15 16 M35 16 L31 11 L29 16" fill="#7a3a2a" stroke="#4e2418" stroke-width="1.6"/>
  <path d="M11 18 C11 10 33 10 33 18 C33 30 27 36 22 36 C17 36 11 30 11 18 Z" fill="#9a4a34" stroke="#6a2e1e" stroke-width="2"/>
  <path d="M15 20 l5 2 M29 20 l-5 2" stroke="#ffd43b" stroke-width="2.4"/>
  <path d="M16 28 l3 -2 2 2 2 -2 3 2" fill="none" stroke="${C.bone}" stroke-width="1.8"/>`);
const A_GOURD_WARD = S(`
  <circle cx="22" cy="23" r="16" fill="none" stroke="${C.teal}" stroke-width="1.6" opacity="0.55"/>
  <path d="M22 13 C15 13 10 17 10 24 C10 30 15 33 22 33 C29 33 34 30 34 24 C34 17 29 13 22 13 Z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="2"/>
  <path d="M14 21 l4 4 l-4 0 Z M30 21 l-4 4 l4 0 Z M16 28 q6 4 12 0 l-3 -2 -3 1 -3 -1 Z" fill="${C.plum}"/>`);
const A_RAVENS_CLOAK = S(`
  <path d="M34 10 C20 12 10 20 8 34 C14 30 18 30 21 31 C20 27 22 23 27 21 C23 22 22 22 20 24 C24 18 29 14 34 10 Z"
    fill="#2a2a3e" stroke="#15151f" stroke-width="1.6"/>
  <path d="M30 14 C22 18 16 25 12 32" stroke="${C.plum}" stroke-width="1.4"/>
  <path d="M32 7 l2 -3 M37 12 l3 -1" stroke="${C.teal}" stroke-width="1.8"/>`);
const A_BONE_KNIT = S(`
  <path d="M12 9 Q9 9 9 12 Q9 15 12 15 Q13 18 11 21 L31 33 Q33 36 36 36 Q39 36 39 33 Q39 30 36 30 Q35 27 37 24 L17 12 Q15 9 12 9 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M22 18 l0 8 M18 22 l8 0" stroke="${C.teal2}" stroke-width="2.4"/>`);
const A_SCRYING_ORB = S(`
  <circle cx="22" cy="19" r="12" fill="#6a9ad0" stroke="#3f6ab0" stroke-width="2"/>
  <path d="M17 14 Q15 18 17 22" stroke="${C.bone}" stroke-width="2" opacity="0.7"/>
  <circle cx="27" cy="15" r="2" fill="${C.bone}" opacity="0.8"/>
  <path d="M12 32 L32 32 Q34 36 22 37 Q10 36 12 32 Z" fill="#8a6a4a" stroke="#5e442c" stroke-width="1.6"/>`);
const A_NIGHTWING_AUGURY = S(`
  <path d="M34 12 A14 14 0 1 0 34 32 A17 17 0 0 1 34 12 Z" fill="none" stroke="${C.teal}" stroke-width="1.6" opacity="0.6"/>
  <path d="M22 18 q4 -5 8 0 q4 -5 8 0 q0 6 -8 10 q-8 -4 -8 -10 z" transform="translate(-8 0)" fill="${C.plum}" stroke="#20142f" stroke-width="1.4"/>
  <circle cx="18" cy="12" r="1.4" fill="${C.teal}"/><circle cx="12" cy="26" r="1.2" fill="${C.teal}"/>`);

// ── Abilities: Werewolf (beast) ──────────────────────────────────────────────

const A_SAVAGE_BITE = S(`
  <path d="M8 10 Q22 16 36 10 Q33 18 28 20 L31 30 L26 22 L24 31 L22 22 L20 31 L18 22 L13 30 L16 20 Q11 18 8 10 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M14 34 Q22 30 30 34" stroke="${C.red2}" stroke-width="2" fill="none"/>`);
const A_IRON_PELT = S(`
  <path d="M22 5 L35 10 C35 24 30 33 22 38 C14 33 9 24 9 10 Z" fill="#8a6244" stroke="#5e4028" stroke-width="2"/>
  <path d="M14 14 l3 3 M22 12 l0 4 M30 14 l-3 3 M16 22 l3 2 M28 22 l-3 2" stroke="#5e4028" stroke-width="1.6"/>
  <circle cx="22" cy="20" r="3" fill="#aeb8c4" stroke="#6f7a88" stroke-width="1.4"/>`);
const A_MOONLIT_MENDING = S(`
  <path d="M27 6 A15 15 0 1 0 38 28 A18 18 0 0 1 27 6 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M18 22 l0 9 M13.5 26.5 l9 0" stroke="${C.teal2}" stroke-width="2.6"/>`);
const A_RAPID_SWIPE = S(`
  <path d="M10 8 Q20 20 16 38 M19 6 Q29 18 25 36 M28 8 Q36 18 33 34" fill="none" stroke="${C.bone}" stroke-width="3" stroke-linecap="round"/>`);
const A_LUNAR_HOWL = S(`
  <circle cx="31" cy="12" r="6" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.4"/>
  <path d="M6 36 L10 20 L8 12 L14 16 L18 14 L16 22 Q22 24 20 32 Q16 38 10 36 Z" fill="#6a5a44" stroke="#453a28" stroke-width="1.8"/>
  <circle cx="12" cy="22" r="1.4" fill="${C.amber}"/>`);
const A_TERRIFYING_ROAR = S(`
  <path d="M11 14 Q22 8 33 14 Q33 26 26 32 L28 26 L24 28 L22 33 L20 28 L16 26 L18 32 Q11 26 11 14 Z"
    fill="#7a4a34" stroke="#4e2e1e" stroke-width="1.8"/>
  <path d="M16 18 l5 2 M28 18 l-5 2" stroke="#ffd43b" stroke-width="2"/>
  <path d="M34 10 l4 -2 M35 16 l4 0 M34 22 l4 2" stroke="${C.red}" stroke-width="2"/>`);
const A_ALPHA_BITE = S(`
  <path d="M11 10 L15 20 L10 30 C10 34 16 36 22 36 C28 36 34 34 34 30 L29 20 L33 10 L26 15 L18 15 Z"
    fill="#6a5a44" stroke="#453a28" stroke-width="1.6"/>
  <path d="M17 28 L19 33 L22 30 L25 33 L27 28" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1"/>
  <circle cx="18" cy="23" r="1.8" fill="${C.amber}"/><circle cx="26" cy="23" r="1.8" fill="${C.amber}"/>`);
const A_FERAL_DASH = S(`
  <circle cx="26" cy="26" r="4" fill="${C.bone}"/><circle cx="22" cy="20" r="2" fill="${C.bone}"/><circle cx="28" cy="19" r="2" fill="${C.bone}"/><circle cx="33" cy="22" r="1.8" fill="${C.bone}"/>
  <path d="M6 18 l10 0 M4 24 l10 0 M8 30 l8 0" stroke="${C.teal}" stroke-width="2.4"/>`);
const A_BLOOD_FRENZY = S(`
  <path d="M12 6 Q18 20 15 36 M20 5 Q26 19 23 35 M28 7 Q33 19 30 33" fill="none" stroke="${C.red}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="15" cy="37" r="1.6" fill="${C.red2}"/><circle cx="23" cy="36" r="1.6" fill="${C.red2}"/><circle cx="30" cy="34" r="1.4" fill="${C.red2}"/>`);
const A_BONE_CRUNCH = S(`
  <path d="M10 12 Q7 12 7 15 Q7 18 10 18 L18 26 L14 30 L18 30 L17 34 L22 31 L27 34 L26 30 L30 30 L26 26 L34 18 Q37 18 37 15 Q37 12 34 12 Q33 9 35 7 L28 13 L16 13 L9 7 Q11 9 10 12 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>`);
const A_SHADOW_CLAWS = S(`
  <path d="M10 8 Q20 20 16 38 M19 6 Q29 18 25 36 M28 8 Q36 18 33 34" fill="none" stroke="#3a2850" stroke-width="3" stroke-linecap="round"/>
  <path d="M10 8 Q20 20 16 38" stroke="${C.plum}" stroke-width="1.2" fill="none"/>`);
const A_WOLF_MARK = S(`
  <path d="M22 5 L35 22 L22 39 L9 22 Z" fill="#4a3826" stroke="#2e2016" stroke-width="2"/>
  <path d="M15 14 Q24 24 20 34 M21 12 Q30 22 26 32 M27 15 Q34 23 31 30" fill="none" stroke="${C.amber}" stroke-width="2" stroke-linecap="round"/>`);
const A_FERAL_HAZE = S(`
  <path d="M8 30 Q12 22 10 16 Q16 20 18 14 Q20 22 24 16 Q26 24 30 16 Q32 22 36 16 Q38 26 34 32 Q22 38 8 30 Z"
    fill="#c24a2a" stroke="#8a2e18" stroke-width="1.6" opacity="0.9"/>
  <path d="M16 26 Q20 22 24 26" stroke="${C.amber}" stroke-width="1.8" fill="none"/>`);
const A_SNARL = S(`
  <path d="M9 18 Q22 12 35 18 Q33 24 28 26 L30 22 L26 24 L24 28 L22 24 L20 28 L18 24 L14 22 L16 26 Q11 24 9 18 Z"
    fill="#6a5a44" stroke="#453a28" stroke-width="1.6"/>
  <path d="M12 16 l6 2 M32 16 l-6 2" stroke="${C.bone}" stroke-width="2"/>`);
const A_SCENT_TRAIL = S(`
  <path d="M14 22 Q10 16 16 14 Q22 12 22 18 Q22 12 28 14 Q34 16 30 22 Q28 26 22 27 Q16 26 14 22 Z" fill="#5a4a36" stroke="#3a2e20" stroke-width="1.6"/>
  <path d="M18 21 q-2 2 0 3 M26 21 q2 2 0 3" stroke="#2a2016" stroke-width="1.4"/>
  <circle cx="14" cy="32" r="1.8" fill="${C.teal}"/><circle cx="22" cy="35" r="1.6" fill="${C.teal}" opacity="0.7"/><circle cx="30" cy="33" r="1.4" fill="${C.teal}" opacity="0.5"/>`);
const A_HUNTERS_READ = S(`
  <path d="M8 20 Q14 14 20 20 Q14 26 8 20 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.4"/><circle cx="14" cy="20" r="2.6" fill="${C.amber}"/>
  <path d="M24 20 Q30 14 36 20 Q30 26 24 20 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.4"/><circle cx="30" cy="20" r="2.6" fill="${C.amber}"/>
  <path d="M10 30 l6 2 M34 30 l-6 2 M20 33 l4 0" stroke="#6a5a44" stroke-width="2"/>`);

// ── Abilities: Necromancer ───────────────────────────────────────────────────

const A_RAISE_SKELETON = S(`
  <path d="M22 9 C14 9 10 15 10 21 C10 25 12 27 12 29 L16 29 L16 32 L19 32 L19 29 L22 29 L22 32 L25 32 L25 29 L28 29 L28 29 C28 27 34 25 34 21 C34 15 30 9 22 9 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <circle cx="17" cy="20" r="2.4" fill="#2a2234"/><circle cx="27" cy="20" r="2.4" fill="#2a2234"/>
  <path d="M9 14 L5 10 M35 14 L39 10 M22 7 L22 3" stroke="${C.teal}" stroke-width="2"/>`);
const A_RAISE_BONEKNIGHT = S(`
  <path d="M12 12 L32 12 Q34 12 34 16 L34 28 Q34 32 30 32 L14 32 Q10 32 10 28 L10 16 Q10 12 12 12 Z"
    fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.8"/>
  <path d="M13 20 L31 20" stroke="#2a2234" stroke-width="2.4"/>
  <path d="M22 24 L22 32" stroke="#2a2234" stroke-width="2"/>
  <path d="M8 36 L36 30 M8 30 L36 36" stroke="${C.bone2}" stroke-width="2.4"/>`);
const A_RAISE_WIGHT = S(`
  <path d="M22 8 C13 8 9 15 11 25 C8 27 9 33 15 33 L15 29 L18 33 L22 29 L26 33 L29 29 L29 33 C35 33 36 27 33 25 C35 15 31 8 22 8 Z"
    fill="#2a3a30" stroke="#16241c" stroke-width="1.6" opacity="0.95"/>
  <circle cx="17" cy="20" r="2.4" fill="#5fe0a0"/><circle cx="27" cy="20" r="2.4" fill="#5fe0a0"/>
  <path d="M33 10 l3 -2 M11 10 l-3 -2" stroke="#5fe0a0" stroke-width="1.8"/>`);
const A_LIFE_SIPHON = S(`
  <path d="M12 10 C20 12 20 20 14 22 C8 24 10 32 18 33 C24 34 26 28 22 26" fill="none" stroke="${C.red}" stroke-width="2.6"/>
  <path d="M22 26 C28 24 32 28 30 34" fill="none" stroke="#5fbf7a" stroke-width="2.6"/>
  <circle cx="12" cy="10" r="2" fill="${C.red2}"/><circle cx="30" cy="34" r="2" fill="#3a8c52"/>`);
const A_BONE_WARD = S(`
  <path d="M22 5 L35 10 C35 24 30 33 22 38 C14 33 9 24 9 10 Z" fill="#2a2234" stroke="#15101c" stroke-width="2"/>
  <path d="M22 12 L22 31 M15 17 Q22 20 29 17 M14 23 Q22 26 30 23" fill="none" stroke="${C.bone}" stroke-width="2"/>`);
const A_GRAVE_CHILL = S(`
  <path d="M22 10 C15 10 11 15 11 20 C11 23 13 25 13 27 L17 27 L17 30 L20 30 L20 27 L24 27 L24 30 L27 30 L27 27 L31 27 C31 25 33 23 33 20 C33 15 29 10 22 10 Z"
    fill="${C.bone}" stroke="#a9c8d8" stroke-width="1.6"/>
  <circle cx="17" cy="19" r="2.2" fill="#3a5a6a"/><circle cx="27" cy="19" r="2.2" fill="#3a5a6a"/>
  <path d="M22 3 L22 9 M19 5 L22 8 L25 5 M8 14 l4 2 M36 14 l-4 2" stroke="#8ac8e8" stroke-width="1.8"/>`);

// ── Abilities: Wanderer (traveler) ───────────────────────────────────────────

const A_KNIFE_THROW = S(`
  <path d="M30 6 L36 8 L16 30 L12 32 L13 28 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M12 32 L8 36 M13 28 L9 27 M16 30 L17 34" stroke="#8a6a4a" stroke-width="2.2"/>
  <path d="M30 6 l-2 4 M34 10 l-4 1" stroke="${C.amber}" stroke-width="1.8"/>`);
const A_PACKMULE_GUARD = S(`
  <path d="M22 6 L34 10 C34 23 29 31 22 36 C15 31 10 23 10 10 Z" fill="#8a6a44" stroke="#5e442c" stroke-width="2"/>
  <rect x="16" y="15" width="12" height="11" rx="2" fill="#6a4e2e" stroke="#4a3420" stroke-width="1.4"/>
  <path d="M16 20 l12 0" stroke="#4a3420" stroke-width="1.6"/>`);
const A_SPY_GLASS = S(`
  <path d="M8 30 L24 14" stroke="#8a6a4a" stroke-width="5" stroke-linecap="round"/>
  <path d="M22 12 L32 8 Q36 10 34 16 L26 20 Z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="1.6"/>
  <circle cx="9" cy="31" r="3" fill="${C.bone}" stroke="#8a6a4a" stroke-width="1.4"/>`);
const A_SLEIGHT_OF_HAND = S(`
  <path d="M12 30 Q10 20 18 20 L26 20 Q30 20 30 24 L30 30 Q30 34 24 34 L18 34 Q13 34 12 30 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M18 20 L17 13 M22 20 L22 12 M26 20 L27 14" stroke="${C.bone}" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="30" cy="12" r="4.5" fill="#d9b84e" stroke="#a9842c" stroke-width="1.4"/>`);
const A_ECHO_CANYON = S(`
  <path d="M6 34 L15 16 L21 26 L27 10 L38 34 Z" fill="#8a6a4a" stroke="#5e442c" stroke-width="1.8"/>
  <path d="M30 8 C34 11 34 17 30 20 M33 5 C39 9 39 19 33 23" fill="none" stroke="${C.teal}" stroke-width="2"/>`);
const A_DEEP_MEDITATION = S(`
  <circle cx="22" cy="12" r="4.5" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.4"/>
  <path d="M10 34 Q12 20 22 20 Q32 20 34 34 Z" fill="${C.teal2}" stroke="#2e7d6a" stroke-width="1.8"/>
  <path d="M10 30 L34 30" stroke="#2e7d6a" stroke-width="1.6"/>
  <circle cx="22" cy="12" r="8" fill="none" stroke="${C.teal}" stroke-width="1.2" opacity="0.5"/>`);
const A_HEAVY_PACK = S(`
  <path d="M15 12 Q15 8 22 8 Q29 8 29 12 L29 16 Q33 17 33 22 L33 34 Q33 36 31 36 L13 36 Q11 36 11 34 L11 22 Q11 17 15 16 Z" fill="#7a5a38" stroke="#4e3820" stroke-width="2"/>
  <rect x="16" y="22" width="12" height="9" rx="2" fill="#5e4428" stroke="#4e3820" stroke-width="1.4"/>
  <path d="M18 12 L26 12" stroke="#4e3820" stroke-width="2"/>`);
const A_ENDLESS_ROAD = S(`
  <path d="M14 36 L19 20 Q20 14 26 14 Q32 14 30 22 L24 36" fill="#9a8a6a" stroke="#6a5a3e" stroke-width="2"/>
  <path d="M20 32 l2 0 M22 26 l1 0 M25 20 l1 0" stroke="${C.bone}" stroke-width="1.6"/>
  <path d="M26 10 l0 -4 M30 11 l3 -2" stroke="${C.amber}" stroke-width="1.8"/>`);
const A_FEATHERLIGHT_PACK = S(`
  <path d="M15 14 Q15 10 22 10 Q29 10 29 14 L29 34 Q29 36 27 36 L17 36 Q15 36 15 34 Z" fill="#6a7a8a" stroke="#45545e" stroke-width="1.8"/>
  <path d="M34 8 C26 10 20 17 19 28 C22 25 25 25 27 26 C26 23 28 20 32 18 C29 19 28 19 27 21 C30 16 32 12 34 8 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.2"/>`);
const A_SHADOW_OWLS = S(`
  <path d="M10 16 Q10 8 16 10 Q22 6 28 10 Q34 8 34 16 Q34 30 22 34 Q10 30 10 16 Z" fill="#3a3346" stroke="#1f1a2a" stroke-width="1.8"/>
  <circle cx="16" cy="18" r="3.4" fill="${C.amber}"/><circle cx="28" cy="18" r="3.4" fill="${C.amber}"/>
  <circle cx="16" cy="18" r="1.4" fill="#1f1a2a"/><circle cx="28" cy="18" r="1.4" fill="#1f1a2a"/>
  <path d="M20 22 L22 25 L24 22 Z" fill="${C.amber2}"/>`);
const A_WANDERLUST = S(`
  <path d="M14 8 L21 8 L22 22 L31 24 Q35 25 35 30 L35 33 L11 33 L11 12 Q11 8 14 8 Z" fill="#8a5a34" stroke="#5e3c22" stroke-width="2"/>
  <path d="M11 29 L35 29" stroke="#5e3c22" stroke-width="2"/>
  <path d="M8 37 Q22 33 38 37" stroke="${C.amber}" stroke-width="1.8" fill="none" opacity="0.8"/>`);
const A_CAMPFIRE_TALE = S(`
  <path d="M22 10 C25 16 30 17 28 24 C31 22 31 20 31 20 C34 26 30 32 22 32 C14 32 11 26 14 21 C14 24 16 24 17 23 C15 18 19 13 22 10 Z" fill="#ff8a3a" stroke="#d95f1e" stroke-width="1.6"/>
  <path d="M8 36 L20 30 M36 36 L24 30 M14 33 L30 33" stroke="#8a6a4a" stroke-width="2.4"/>`);
const A_NIGHTWATCH_CLOAK = S(`
  <path d="M22 6 C13 8 9 16 10 30 L15 27 Q16 33 22 34 Q28 33 29 27 L34 30 C35 16 31 8 22 6 Z" fill="#2a2d5a" stroke="#191b3e" stroke-width="2"/>
  <circle cx="17" cy="18" r="1.2" fill="${C.bone}"/><circle cx="27" cy="16" r="1.4" fill="${C.bone}"/><circle cx="22" cy="24" r="1.1" fill="${C.teal}"/><circle cx="29" cy="24" r="1" fill="${C.bone}"/>`);
const A_COMPASS_TRICK = S(`
  <circle cx="22" cy="22" r="15" fill="#c9b88a" stroke="#8a7646" stroke-width="2"/>
  <circle cx="22" cy="22" r="11" fill="#2a2338" stroke="#8a7646" stroke-width="1.2"/>
  <path d="M22 11 L26 22 L22 33 L18 22 Z" fill="${C.red}" stroke="${C.bone}" stroke-width="0.8"/>
  <path d="M22 11 L26 22 L22 22 Z" fill="${C.bone}"/>`);

// ── Abilities: Mystic (spirit) ───────────────────────────────────────────────

const A_SPIRIT_LASH = S(`
  <path d="M12 10 C7 10 7 20 11 24 C8 27 10 33 15 32 C17 36 22 36 23 31 L23 24 C23 18 20 10 12 10 Z" fill="#b9a8ef" opacity="0.85" stroke="#8a78c0" stroke-width="1.6"/>
  <circle cx="13" cy="18" r="1.8" fill="#3a2d56"/>
  <path d="M23 24 Q32 22 34 30 Q36 36 30 37" fill="none" stroke="${C.teal}" stroke-width="2.4"/>`);
const A_SOUL_SIPHON = S(`
  <path d="M22 32 C12 26 11 16 17 14 C21 12.5 22 17 22 17 C22 17 23 12.5 27 14 C33 16 32 26 22 32 Z" fill="#9a6ad0" stroke="#6a4aa0" stroke-width="1.8"/>
  <path d="M22 17 C19 22 19 27 22 30" stroke="#d9c0ef" stroke-width="1.8"/>
  <path d="M30 10 C34 14 34 10 36 8 M34 30 C36 34 38 32 40 32" stroke="#b9a8ef" stroke-width="1.6" opacity="0.7"/>`);
const A_BANSHEE_WAIL = S(`
  <path d="M11 14 C11 8 33 8 33 20 C33 30 27 34 24 30 Q22 36 20 30 C17 34 11 30 11 20 Z" fill="#c9d8ef" opacity="0.9" stroke="#8aa0c0" stroke-width="1.6"/>
  <circle cx="17" cy="18" r="2.2" fill="#3a4a6a"/><circle cx="27" cy="18" r="2.2" fill="#3a4a6a"/>
  <ellipse cx="22" cy="25" rx="2.4" ry="3.4" fill="#3a4a6a"/>
  <path d="M35 12 l3 -1 M36 18 l3 1" stroke="${C.teal}" stroke-width="1.8"/>`);
const A_ETHEREAL_VEIL = S(`
  <path d="M8 16 Q22 12 36 16 M6 23 Q22 18 38 23 M8 30 Q22 25 36 30 M10 36 Q22 32 34 36" fill="none" stroke="#a9c8e0" stroke-width="2.2" opacity="0.85" stroke-linecap="round"/>`);
const A_SPIRIT_WARD = S(`
  <path d="M19 36 L25 36 L24 24 L20 24 Z" fill="${C.bone2}" stroke="#a39a86" stroke-width="1.6"/>
  <rect x="20" y="20" width="4" height="5" fill="#8a7a5a"/>
  <path d="M22 20 C19 16 22 11 22 11 C22 11 25 16 22 20 Z" fill="${C.amber}" stroke="${C.amber2}" stroke-width="1.2"/>
  <circle cx="22" cy="18" r="9" fill="none" stroke="${C.teal}" stroke-width="1.4" opacity="0.5"/>`);
const A_GHOST_STEP = S(`
  <path d="M13 10 Q9 10 9 15 Q9 20 15 22 Q18 23 17 18 Q16 12 13 10 Z" fill="${C.bone}" opacity="0.85" stroke="${C.bone2}" stroke-width="1.2"/>
  <path d="M28 22 Q24 22 24 27 Q24 32 30 34 Q33 35 32 30 Q31 24 28 22 Z" fill="${C.teal}" opacity="0.7" stroke="${C.teal2}" stroke-width="1.2"/>
  <circle cx="10" cy="13" r="1" fill="${C.bone}"/><circle cx="33" cy="27" r="1" fill="${C.teal}"/>`);
const A_SEANCE_OF_MENDING = S(`
  <path d="M8 24 Q16 10 24 16 Q34 10 36 20 Q30 20 24 24 Q18 20 14 26 Q10 28 8 24 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.4"/>
  <path d="M24 16 L24 24" stroke="${C.bone2}" stroke-width="1.2"/>
  <path d="M22 30 l0 7 M18.5 33.5 l7 0" stroke="#5fbf7a" stroke-width="2.4"/>`);
const A_MENDING_SPIRITS = S(`
  <path d="M15 12 C9 14 10 24 16 26 C13 30 16 35 21 33 L21 20 C21 15 19 12 15 12 Z" fill="#9fe0b8" opacity="0.8" stroke="#5fbf7a" stroke-width="1.4"/>
  <circle cx="15" cy="18" r="1.4" fill="#2e6e4a"/>
  <path d="M30 14 l0 10 M25 19 l10 0" stroke="#3a8c52" stroke-width="2.6"/>`);
const A_WHISPERED_SECRET = S(`
  <path d="M11 14 C11 8 33 8 33 19 C33 29 27 33 24 30 Q22 35 20 30 C17 33 11 29 11 19 Z" fill="#c9c0e0" opacity="0.9" stroke="#9a8ac0" stroke-width="1.6"/>
  <circle cx="17" cy="17" r="1.8" fill="#4a3d66"/><circle cx="27" cy="17" r="1.8" fill="#4a3d66"/>
  <path d="M18 24 L26 24" stroke="#4a3d66" stroke-width="2.4"/>
  <path d="M22 24 L22 20" stroke="${C.amber}" stroke-width="2"/>`);
const A_SPIRIT_WALK = S(`
  <path d="M22 22 m0 -14 a14 14 0 1 1 -12 21 a9 9 0 1 0 9 -15 a5 5 0 1 1 3 7" fill="none" stroke="#9a8ac0" stroke-width="3"/>
  <circle cx="22" cy="22" r="2.4" fill="${C.teal}"/>`);
const A_HAUNTING = S(`
  <path d="M11 16 C11 9 33 9 33 18 L33 32 L28 28 L25 32 L22 28 L19 32 L16 28 L11 32 Z" fill="#8a7ab0" opacity="0.85" stroke="#5e4e8a" stroke-width="1.6"/>
  <circle cx="18" cy="18" r="2" fill="#2a2040"/><circle cx="26" cy="18" r="2" fill="#2a2040"/>
  <path d="M33 11 l3 -2 M11 11 l-3 -2" stroke="${C.plum}" stroke-width="1.8"/>`);
const A_GRAVEYARD_CHILL = S(`
  <path d="M14 36 L14 16 Q14 8 22 8 Q30 8 30 16 L30 36 Z" fill="#8a909a" stroke="#5a606a" stroke-width="2"/>
  <path d="M22 14 L22 26 M17 18 L27 18" stroke="#5a606a" stroke-width="2"/>
  <path d="M10 10 L13 13 M34 10 L31 13 M22 3 L22 7 M8 24 l3 1 M36 24 l-3 1" stroke="#9fd8ef" stroke-width="1.8"/>`);

// ── Abilities: Knight (order) ────────────────────────────────────────────────

const A_SMITE = S(`
  <path d="M22 3 L22 24 M15 9 L22 3 L29 9" stroke="${C.amber}" stroke-width="2.4" fill="none"/>
  <path d="M20 10 L24 10 L23 26 L21 26 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.4"/>
  <path d="M15 27 L29 27" stroke="#c9a83e" stroke-width="3.4"/>
  <path d="M22 27 L22 39" stroke="${C.bone2}" stroke-width="3.2"/>
  <path d="M8 20 l4 -2 M36 20 l-4 -2" stroke="${C.amber}" stroke-width="2"/>`);
const A_SHIELD_BASH = S(`
  <path d="M16 6 L31 10 C31 22 27 30 20 35 C13 30 10 22 10 10 Z" fill="#aeb8c4" stroke="#6f7a88" stroke-width="2"/>
  <circle cx="20" cy="18" r="3.4" fill="#c9a83e" stroke="#8a7020" stroke-width="1.4"/>
  <path d="M33 14 l5 -2 M34 22 l5 0 M33 29 l5 2" stroke="${C.amber}" stroke-width="2.2"/>`);
const A_RALLYING_WRATH = S(`
  <path d="M14 36 L14 7 L15 7 Q26 9 32 7 L28 15 L32 22 Q24 20 15 22" fill="#c23a2a" stroke="#8a2418" stroke-width="1.8"/>
  <path d="M19 14 C22 18 22 23 19 27 C16 23 16 18 19 14 Z" fill="${C.amber}" opacity="0.8"/>`);
const A_OATH_OF_IRON = S(`
  <circle cx="22" cy="22" r="13" fill="none" stroke="#8a929c" stroke-width="4"/>
  <g fill="#6f7a88"><rect x="20" y="4" width="4" height="6"/><rect x="20" y="34" width="4" height="6"/><rect x="4" y="20" width="6" height="4"/><rect x="34" y="20" width="6" height="4"/></g>
  <circle cx="22" cy="22" r="6" fill="none" stroke="${C.amber}" stroke-width="2.2"/>`);
const A_GUARDIANS_PLEDGE = S(`
  <path d="M6 20 L14 16 L22 20 L20 26 Q14 28 10 24 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M38 20 L30 16 L22 20 L24 26 Q30 28 34 24 Z" fill="${C.bone2}" stroke="#a39a86" stroke-width="1.6"/>
  <path d="M18 22 L26 22" stroke="#8a7a5a" stroke-width="2"/>
  <path d="M22 10 l1.5 3.5 3.5 .3 -2.7 2.3 .9 3.6 -3.2 -2 -3.2 2 .9 -3.6 -2.7 -2.3 3.5 -.3 Z" fill="${C.amber}" transform="translate(0 -2) scale(0.8) translate(5.5 4)"/>`);
const A_FIELD_DRESSING = S(`
  <rect x="7" y="18" width="30" height="9" rx="3" transform="rotate(-25 22 22)" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M22 18 l0 8 M18 22 l8 0" stroke="${C.red}" stroke-width="2.4" transform="rotate(-25 22 22)"/>`);
const A_LAY_ON_HANDS = S(`
  <path d="M12 32 Q10 22 18 22 L26 22 Q30 22 30 26 L30 32 Q30 36 24 36 L18 36 Q13 36 12 32 Z" fill="${C.bone}" stroke="${C.bone2}" stroke-width="1.6"/>
  <path d="M18 22 L17 15 M22 22 L22 14 M26 22 L27 16" stroke="${C.bone}" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M22 4 l0 8 M18 8 l8 0" stroke="#5fbf7a" stroke-width="2.8"/>`);
const A_SENTINELS_WATCH = S(`
  <path d="M14 38 L14 18 L12 14 L18 16 L22 11 L26 16 L32 14 L30 18 L30 38 Z" fill="#8a929c" stroke="#5a606a" stroke-width="1.8"/>
  <rect x="19" y="24" width="6" height="14" fill="#2a2338"/>
  <circle cx="22" cy="11" r="2" fill="${C.amber}"/>`);
const A_HERALDS_MUSTER = S(`
  <path d="M8 16 L26 16 L34 10 L34 30 L26 24 L8 24 Z" fill="#c9a83e" stroke="#8a7020" stroke-width="2"/>
  <path d="M11 24 L11 30 L16 30 L15 24" fill="#a9842c" stroke="#8a7020" stroke-width="1.4"/>
  <path d="M37 14 C40 17 40 23 37 26 M40 10 C45 15 45 25 40 30" stroke="${C.amber}" stroke-width="2.2"/>`);
const A_CHALLENGE = S(`
  <path d="M14 34 L16 18 Q16 14 22 14 Q28 14 28 18 L30 34 Z" fill="#aeb8c4" stroke="#6f7a88" stroke-width="2"/>
  <path d="M19 20 L19 30 M25 20 L25 30" stroke="#6f7a88" stroke-width="1.4"/>
  <path d="M22 14 L22 4 M18 7 L22 4 L26 7" stroke="${C.red}" stroke-width="2.4" fill="none"/>`);
const A_STEADFAST_MARCH = S(`
  <path d="M10 10 L15 10 L16 24 L24 26 Q28 27 28 31 L28 34 L8 34 L8 14 Q8 10 10 10 Z" fill="#8a929c" stroke="#5a606a" stroke-width="1.8"/>
  <path d="M8 30 L28 30" stroke="#5a606a" stroke-width="1.8"/>
  <path d="M31 16 L37 16 M31 23 L37 23 M31 30 L37 30" stroke="${C.amber}" stroke-width="2.2"/>`);
const A_BANNER_OF_DREAD = S(`
  <path d="M12 4 L12 40" stroke="#5a606a" stroke-width="2.4"/>
  <path d="M12 6 L34 6 L30 14 L34 22 L12 22 Z" fill="#2a2234" stroke="#15101c" stroke-width="1.8"/>
  <path d="M22 11 C19 13 20 17 22 17 C24 17 25 13 22 11 Z" fill="${C.bone}"/>
  <path d="M19 18 l6 0" stroke="${C.bone}" stroke-width="1.6"/>`);
const A_GUARDIANS_VEIL = S(`
  <path d="M22 6 L34 10 C34 23 29 31 22 36 C15 31 10 23 10 10 Z" fill="${C.bone}" stroke="#a39a86" stroke-width="2" opacity="0.92"/>
  <path d="M22 6 L34 10 C34 23 29 31 22 36 Z" fill="${C.teal}" opacity="0.18"/>
  <circle cx="22" cy="19" r="8" fill="none" stroke="${C.teal}" stroke-width="1.6" opacity="0.6"/>
  <path d="M18 19 l3 3 l6 -6" stroke="${C.teal2}" stroke-width="2" fill="none"/>`);

// ── Registry + lookup ───────────────────────────────────────────────────────

export const UI_ICONS = {
  // emotes
  wave: WAVE, laugh: LAUGH, heart: HEART, wow: WOW,
  cry: CRY, angry: ANGRY, thumb: THUMB, dance: DANCE,
  // action cluster
  attack: ATTACK, jump: JUMP, emote: EMOTE, callout: CALLOUT, kit: KIT,
  // HUD chrome (vitals heart reuses the emote `heart` above)
  sun: SUN, moon: MOON, moonstone: MOONSTONE, chat: CHAT, bell: BELL,
  // status effects (keys match STATUS_FX)
  wither: WITHER, stumble: STUMBLE, shrink: SHRINK, toad: TOAD, gibberish: GIBBERISH,
  wolfmark: WOLFMARK, rooted: ROOTED, reversed: REVERSED, bloodcurse: BLOODCURSE, pumpkin: PUMPKIN,
  regen: REGEN, speedboost: SPEEDFX, ravencloak: RAVENCLOAK, giant: GIANT, bats: BATS,
  meditate: MEDITATE, wolfpact: WOLFPACT, feather: FEATHER, ward: WARD, colorcycle: COLORCYCLE,
  salt: SALT,
  // items — weapons
  iron_sword: I_IRON_SWORD, spell_tome: I_SPELL_TOME, holly_wand: I_HOLLY_WAND,
  cursed_blade: I_CURSED_BLADE, shadow_staff: I_SHADOW_STAFF, void_staff: I_VOID_STAFF,
  alpha_fang: I_ALPHA_FANG,
  // items — starter gear
  steel_shield: I_STEEL_SHIELD, wizard_hat: I_WIZARD_HAT,
  leather_boots: I_LEATHER_BOOTS, silver_ring: I_SILVER_RING,
  // items — wardrobe: heads
  bloodmoon_circlet: I_BLOODMOON_CIRCLET, beast_crown: I_BEAST_CROWN, spirit_veil: I_SPIRIT_VEIL,
  dread_helm: I_DREAD_HELM, shadow_crown: I_SHADOW_CROWN, knights_helm: I_KNIGHTS_HELM,
  travelers_hood: I_TRAVELERS_HOOD,
  // items — wardrobe: chest
  beast_hide: I_BEAST_HIDE, spirit_robe: I_SPIRIT_ROBE, bone_armor: I_BONE_ARMOR,
  shadow_cloak: I_SHADOW_CLOAK, abyssal_armor: I_ABYSSAL_ARMOR, moonhowl_pelt: I_MOONHOWL_PELT,
  witch_robe: I_WITCH_ROBE, travelers_vest: I_TRAVELERS_VEST,
  // items — wardrobe: feet
  hexed_boots: I_HEXED_BOOTS, paw_boots: I_PAW_BOOTS, soul_treads: I_SOUL_TREADS,
  wraith_treads: I_WRAITH_TREADS, nightfang_boots: I_NIGHTFANG_BOOTS,
  // items — wardrobe: rings / amulets
  hex_amulet: I_HEX_AMULET, spirit_ring: I_SPIRIT_RING, trail_ring: I_TRAIL_RING,
  death_ring: I_DEATH_RING, packbound_ring: I_PACKBOUND_RING, order_signet: I_ORDER_SIGNET,
  witches_boon: I_WITCHES_BOON,
  // items — consumables, potions & brews
  healing_potion: I_HEALING_POTION, health_potion_ii: I_HEALTH_POTION_II, moonwell_draught: I_MOONWELL_DRAUGHT,
  regen_brew: I_REGEN_BREW, swift_brew: I_SWIFT_BREW, shadow_draught: I_SHADOW_DRAUGHT,
  giants_elixir: I_GIANTS_ELIXIR, bat_swarm_potion: I_BAT_SWARM_POTION, clarity_draught: I_CLARITY_DRAUGHT,
  chaos_brew: I_CHAOS_BREW, wolf_pact_brew: I_WOLF_PACT_BREW, moon_water: I_MOON_WATER, glass_vial: I_GLASS_VIAL,
  barkbind_salve: I_BARKBIND_SALVE, capwood_elixir: I_CAPWOOD_ELIXIR, nightsight_draught: I_NIGHTSIGHT_DRAUGHT,
  fernstep_philtre: I_FERNSTEP_PHILTRE, bramble_poultice: I_BRAMBLE_POULTICE, witchwood_balm: I_WITCHWOOD_BALM,
  trail_remedy: I_TRAIL_REMEDY,
  // items — special consumables / valuables
  magic_scroll: I_MAGIC_SCROLL, dragon_scale: I_DRAGON_SCALE, enchanted_gem: I_ENCHANTED_GEM,
  ancient_coin: I_ANCIENT_COIN, golden_chalice: I_GOLDEN_CHALICE, hard_drive: I_HARD_DRIVE,
  bloodmoon_shard: I_BLOODMOON_SHARD, berries: I_BERRIES,
  // items — crafting materials
  wood: I_WOOD, witchwood: I_WITCHWOOD, lumber_bundle: I_LUMBER_BUNDLE, stone_block: I_STONE_BLOCK,
  iron_ore: I_IRON_ORE, iron_ingot: I_IRON_INGOT, druid_stone: I_DRUID_STONE, pine_pitch: I_PINE_PITCH,
  birch_bark: I_BIRCH_BARK, bramble_vine: I_BRAMBLE_VINE, willow_frond: I_WILLOW_FROND, fern_frond: I_FERN_FROND,
  blackthorn: I_BLACKTHORN, nightberry: I_NIGHTBERRY, hex_acorn: I_HEX_ACORN, toadcap: I_TOADCAP,
  ring_cap: I_RING_CAP, fur_scrap: I_FUR_SCRAP, animal_pelt: I_ANIMAL_PELT, leather_hide: I_LEATHER_HIDE,
  bone_shard: I_BONE_SHARD, enchanted_fur: I_ENCHANTED_FUR, shadow_essence: I_SHADOW_ESSENCE,
  glimmerdust: I_GLIMMERDUST, hollow_shard: I_HOLLOW_SHARD,
  // items — garden herbs
  swift_root: I_SWIFT_ROOT, featherleaf: I_FEATHERLEAF, giants_cap: I_GIANTS_CAP, shrinking_violet: I_SHRINKING_VIOLET,
  pumpkin_blossom: I_PUMPKIN_BLOSSOM, bats_breath: I_BATS_BREATH, rainbow_petal: I_RAINBOW_PETAL,
  ravens_feather_plant: I_RAVENS_FEATHER_PLANT, stumbleweed: I_STUMBLEWEED, gibberish_root: I_GIBBERISH_ROOT,
  toadstool: I_TOADSTOOL, wolfsbane_bloom: I_WOLFSBANE_BLOOM, meditation_lotus: I_MEDITATION_LOTUS,
  healing_herb: I_HEALING_HERB, regen_root: I_REGEN_ROOT, cleansing_clover: I_CLEANSING_CLOVER,
  // abilities — Witch / Mage spells
  open_third_eye: A_OPEN_THIRD_EYE, toads_tongue: A_TOADS_TONGUE, stumble_hex: A_STUMBLE_HEX,
  fireball: A_FIREBALL, withering_hex: A_WITHERING_HEX, leech_hex: A_LEECH_HEX,
  monstrous_form: A_MONSTROUS_FORM, gourd_ward: A_GOURD_WARD, ravens_cloak: A_RAVENS_CLOAK,
  bone_knit: A_BONE_KNIT, scrying_orb: A_SCRYING_ORB, nightwing_augury: A_NIGHTWING_AUGURY,
  // abilities — Werewolf (beast)
  savage_bite: A_SAVAGE_BITE, iron_pelt: A_IRON_PELT, moonlit_mending: A_MOONLIT_MENDING,
  rapid_swipe: A_RAPID_SWIPE, lunar_howl: A_LUNAR_HOWL, terrifying_roar: A_TERRIFYING_ROAR,
  alpha_bite: A_ALPHA_BITE, feral_dash: A_FERAL_DASH, blood_frenzy: A_BLOOD_FRENZY,
  bone_crunch: A_BONE_CRUNCH, shadow_claws: A_SHADOW_CLAWS, wolf_mark: A_WOLF_MARK,
  feral_haze: A_FERAL_HAZE, snarl: A_SNARL, scent_trail: A_SCENT_TRAIL, hunters_read: A_HUNTERS_READ,
  // abilities — Necromancer
  raise_skeleton: A_RAISE_SKELETON, raise_boneknight: A_RAISE_BONEKNIGHT, raise_wight: A_RAISE_WIGHT,
  life_siphon: A_LIFE_SIPHON, bone_ward: A_BONE_WARD, grave_chill: A_GRAVE_CHILL,
  // abilities — Wanderer (traveler)
  knife_throw: A_KNIFE_THROW, packmule_guard: A_PACKMULE_GUARD, spy_glass: A_SPY_GLASS,
  sleight_of_hand: A_SLEIGHT_OF_HAND, echo_canyon: A_ECHO_CANYON, deep_meditation: A_DEEP_MEDITATION,
  heavy_pack: A_HEAVY_PACK, endless_road: A_ENDLESS_ROAD, featherlight_pack: A_FEATHERLIGHT_PACK,
  shadow_owls: A_SHADOW_OWLS, wanderlust: A_WANDERLUST, campfire_tale: A_CAMPFIRE_TALE,
  nightwatch_cloak: A_NIGHTWATCH_CLOAK, compass_trick: A_COMPASS_TRICK,
  // abilities — Mystic (spirit)
  spirit_lash: A_SPIRIT_LASH, soul_siphon: A_SOUL_SIPHON, banshee_wail: A_BANSHEE_WAIL,
  ethereal_veil: A_ETHEREAL_VEIL, spirit_ward: A_SPIRIT_WARD, ghost_step: A_GHOST_STEP,
  seance_of_mending: A_SEANCE_OF_MENDING, mending_spirits: A_MENDING_SPIRITS, whispered_secret: A_WHISPERED_SECRET,
  spirit_walk: A_SPIRIT_WALK, haunting: A_HAUNTING, graveyard_chill: A_GRAVEYARD_CHILL,
  // abilities — Knight (order)
  smite: A_SMITE, shield_bash: A_SHIELD_BASH, rallying_wrath: A_RALLYING_WRATH,
  oath_of_iron: A_OATH_OF_IRON, guardians_pledge: A_GUARDIANS_PLEDGE, field_dressing: A_FIELD_DRESSING,
  lay_on_hands: A_LAY_ON_HANDS, sentinels_watch: A_SENTINELS_WATCH, heralds_muster: A_HERALDS_MUSTER,
  challenge: A_CHALLENGE, steadfast_march: A_STEADFAST_MARCH, banner_of_dread: A_BANNER_OF_DREAD,
  guardians_veil: A_GUARDIANS_VEIL,
};

// Replace emoji in any static markup: every element with [data-hudicon="key"]
// gets its inner SVG injected. Safe to call repeatedly (skips hydrated nodes).
export function hydrateIcons(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-hudicon]').forEach((el) => {
    if (el._iconDone) return;
    const svg = uiIcon(el.getAttribute('data-hudicon'));
    if (svg) { el.innerHTML = svg; el._iconDone = true; }
  });
}

// The emote wheel order + the key each one sends to the server.
export const EMOTE_DEFS = [
  { key: 'wave',  label: 'Wave'      },
  { key: 'laugh', label: 'Cackle'    },
  { key: 'heart', label: 'Adore'     },
  { key: 'wow',   label: 'Gasp'      },
  { key: 'cry',   label: 'Weep'      },
  { key: 'angry', label: 'Hex'       },
  { key: 'thumb', label: 'Approve'   },
  { key: 'dance', label: 'Dance'     },
];

// Legacy glyphs → new keys, so emotes already in flight (or from an older
// client) still float a real icon instead of a tofu box.
export const LEGACY_EMOTE = {
  '👋': 'wave', '😂': 'laugh', '❤️': 'heart', '😮': 'wow',
  '😢': 'cry', '😡': 'angry', '👍': 'thumb', '💃': 'dance',
};

// Returns an inline <svg> string for a key (or legacy glyph), else null.
export function uiIcon(key) {
  if (!key) return null;
  if (UI_ICONS[key]) return UI_ICONS[key];
  const mapped = LEGACY_EMOTE[key];
  return mapped ? UI_ICONS[mapped] : null;
}

export function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

// Inline HTML for a value that may be a custom-icon key OR a plain emoji/text.
// Known keys render as a sized SVG span; anything else falls through, escaped,
// so render sites can adopt this without needing every glyph converted first.
export function glyphHTML(value, cls) {
  const svg = uiIcon(value);
  if (svg) return `<span class="giWrap ${cls || ''}">${svg}</span>`;
  return escHtml(value);
}
