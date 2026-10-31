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
