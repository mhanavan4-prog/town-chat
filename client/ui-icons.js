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

// ── Registry + lookup ───────────────────────────────────────────────────────

export const UI_ICONS = {
  // emotes
  wave: WAVE, laugh: LAUGH, heart: HEART, wow: WOW,
  cry: CRY, angry: ANGRY, thumb: THUMB, dance: DANCE,
  // action cluster
  attack: ATTACK, jump: JUMP, emote: EMOTE, callout: CALLOUT, kit: KIT,
  // HUD chrome (vitals heart reuses the emote `heart` above)
  sun: SUN, moon: MOON, moonstone: MOONSTONE, chat: CHAT, bell: BELL,
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
