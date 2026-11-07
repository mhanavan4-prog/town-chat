// ---------------------------------------------------------------------------
// Tarot arcana icons — The Fool's Journey. Hand-drawn SVGs (no emoji) in the
// same carved-talisman language as the plant + tea icons: each of the 22 Major
// Arcana as a little parchment tarot card with a bold, legible motif, washed in
// its leg's colour (amber = the Worldly Road, teal = the Road of the Self,
// violet = the Road of the Spirit). Drawn on a 0 0 44 44 grid; keyed by card key
// and merged into UI_ICONS so uiIcon('fool') resolves everywhere.
// ---------------------------------------------------------------------------

const taS = (inner) =>
  `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" ` +
  `stroke-linejoin="round" stroke-linecap="round" class="uiIcon">${inner}</svg>`;

// The shared card plate: a rounded parchment card with a thin inner keyline,
// washed in its leg's tint. The arcana's motif sits centred on top (~22,22).
const taCard = (motif, tint) => taS(`
  <rect x="7" y="3.5" width="30" height="37" rx="4.2" fill="#efe3c4" stroke="#d2bd92" stroke-width="1.4"/>
  <rect x="9.4" y="5.9" width="25.2" height="32.2" rx="2.6" fill="${tint}" stroke="#c9b488" stroke-width="0.8"/>
  ${motif}
`);

// Leg tints — the three roads read apart at a glance.
const WORLDLY = 'rgba(255,180,74,0.10)';
const SELF = 'rgba(120,232,200,0.11)';
const SPIRIT = 'rgba(169,154,255,0.13)';

const TAROT_ARCANA_ICONS = {
  // ── The Worldly Road (0–VII) ──────────────────────────────────────────────
  // 0 — The Fool: a wanderer's staff, a knotted bindle, a white rose.
  fool: taCard(`
    <path d="M16 33 L28 13.5" stroke="#bf9d6e" stroke-width="2.2"/>
    <circle cx="29" cy="11.8" r="3.9" fill="#e4d2a7" stroke="#c9b488" stroke-width="1"/>
    <path d="M26.3 9.4 L31.7 14.2" stroke="#c9b488" stroke-width="0.8"/>
    <g fill="#ef5d72" stroke="#bf3350" stroke-width="0.6"><circle cx="15" cy="31.4" r="1.4"/><circle cx="12.5" cy="32" r="1.4"/><circle cx="13.5" cy="29.6" r="1.4"/><circle cx="16.4" cy="33.4" r="1.4"/></g>
    <circle cx="14.4" cy="31.6" r="0.9" fill="#ffd76a"/>`, WORLDLY),
  // I — The Magician: an upraised wand crowned with a star, infinity beneath.
  magician: taCard(`
    <path d="M22 25 L22 12" stroke="#ffb44a" stroke-width="2.4"/>
    <path d="M22 7.6 l1.3 2.7 2.9 .4 -2.1 2 .5 2.9 -2.6 -1.4 -2.6 1.4 .5 -2.9 -2.1 -2 2.9 -.4 Z" fill="#ffd76a" stroke="#e68a2c" stroke-width="0.5"/>
    <circle cx="18.8" cy="30" r="2.7" fill="none" stroke="#78e8c8" stroke-width="1.7"/>
    <circle cx="25.2" cy="30" r="2.7" fill="none" stroke="#78e8c8" stroke-width="1.7"/>`, WORLDLY),
  // II — The High Priestess: a crescent moon between two temple pillars.
  priestess: taCard(`
    <rect x="12.6" y="14" width="3" height="19" rx="1" fill="#e4d2a7" stroke="#c9b488" stroke-width="0.8"/>
    <rect x="28.4" y="14" width="3" height="19" rx="1" fill="#e4d2a7" stroke="#c9b488" stroke-width="0.8"/>
    <path d="M12 13.4 h20 M12.6 33 h18.8" stroke="#c9b488" stroke-width="1.2"/>
    <path d="M25 8.4 a6 6 0 1 0 0.2 11.6 a4.5 4.5 0 1 1 -0.2 -11.6 Z" fill="#a9c8ff" stroke="#6f9ee8" stroke-width="0.8"/>`, WORLDLY),
  // III — The Empress: a crown of stars over a sheaf of wheat (fertility).
  empress: taCard(`
    <path d="M14 20 L16.5 12.6 L19.5 18 L22 11 L24.5 18 L27.5 12.6 L30 20 Z" fill="#ffb44a" stroke="#e68a2c" stroke-width="1"/>
    <g fill="#ffd76a"><circle cx="16.5" cy="12.6" r="1.3"/><circle cx="22" cy="11" r="1.5"/><circle cx="27.5" cy="12.6" r="1.3"/></g>
    <path d="M22 23 L22 34 M22 26 l-3.4 -1.6 M22 26 l3.4 -1.6 M22 29.5 l-3.4 -1.6 M22 29.5 l3.4 -1.6" stroke="#e8c05a" stroke-width="1.4"/>`, WORLDLY),
  // IV — The Emperor: a throne crowned with ram's-horn curls + an orb & cross.
  emperor: taCard(`
    <rect x="15.5" y="17" width="13" height="16" rx="1.4" fill="#e4d2a7" stroke="#c9b488" stroke-width="1"/>
    <path d="M16.5 17 q-3 -4 0 -6.2 q2.2 -1.4 2.6 1.4" fill="none" stroke="#bf9d6e" stroke-width="1.7"/>
    <path d="M27.5 17 q3 -4 0 -6.2 q-2.2 -1.4 -2.6 1.4" fill="none" stroke="#bf9d6e" stroke-width="1.7"/>
    <circle cx="22" cy="13.2" r="2.3" fill="#ffb44a" stroke="#e68a2c" stroke-width="0.8"/>
    <path d="M22 10.9 L22 8.4 M20.6 9.6 L23.4 9.6" stroke="#e68a2c" stroke-width="1.2"/>`, WORLDLY),
  // V — The Hierophant: the keys of wisdom over an open book.
  hierophant: taCard(`
    <circle cx="22" cy="12.6" r="3" fill="none" stroke="#ffb44a" stroke-width="1.8"/>
    <path d="M22 15.6 L22 22 M22 19.4 l2.6 0 M22 21.4 l2.2 0" stroke="#ffb44a" stroke-width="1.8"/>
    <path d="M12 25 q10 -3 10 0.4 q0 -3.4 10 -0.4 L32 33 q-10 -2.6 -10 0.4 q0 -3 -10 -0.4 Z" fill="#efe3c4" stroke="#c9b488" stroke-width="1"/>
    <path d="M22 25.4 L22 33.4" stroke="#c9b488" stroke-width="1"/>`, WORLDLY),
  // VI — The Lovers: two interlocked rings under a radiant blessing.
  lovers: taCard(`
    <g stroke="#ffd76a" stroke-width="1.3"><path d="M22 10 L22 6.6"/><path d="M16.4 11.6 L14.2 8.8"/><path d="M27.6 11.6 L29.8 8.8"/></g>
    <circle cx="18.8" cy="25" r="5.2" fill="none" stroke="#ef5d72" stroke-width="1.9"/>
    <circle cx="25.6" cy="25" r="5.2" fill="none" stroke="#a9c8ff" stroke-width="1.9"/>`, WORLDLY),
  // VII — The Chariot: a starry canopy over a wheeled car.
  chariot: taCard(`
    <path d="M13.5 23 L15.5 14.5 L28.5 14.5 L30.5 23" fill="none" stroke="#6f9ee8" stroke-width="1.5"/>
    <g fill="#ffd76a"><circle cx="19" cy="18.4" r="1"/><circle cx="25" cy="18.4" r="1"/><circle cx="22" cy="17" r="1"/></g>
    <rect x="14.5" y="23" width="15" height="7" rx="1" fill="#e4d2a7" stroke="#c9b488" stroke-width="1"/>
    <circle cx="22" cy="32" r="3.6" fill="none" stroke="#bf9d6e" stroke-width="1.5"/>
    <path d="M22 28.4 L22 35.6 M18.4 32 L25.6 32" stroke="#bf9d6e" stroke-width="1"/>`, WORLDLY),

  // ── The Road of the Self (VIII–XIV) ───────────────────────────────────────
  // VIII — Strength: a lion's maned head beneath the sign of infinity.
  strength: taCard(`
    <circle cx="22" cy="25.5" r="5.8" fill="#e4d2a7" stroke="#c9b488" stroke-width="1"/>
    <g stroke="#e68a2c" stroke-width="1.4"><path d="M22 19.7 L22 16.8"/><path d="M16.2 25.5 L13.4 25.5"/><path d="M27.8 25.5 L30.6 25.5"/><path d="M17.9 21.4 L15.6 19"/><path d="M26.1 21.4 L28.4 19"/><path d="M17.9 29.6 L15.6 32"/><path d="M26.1 29.6 L28.4 32"/><path d="M22 31.3 L22 34.2"/></g>
    <g fill="#3a2850"><circle cx="20" cy="24.8" r="0.8"/><circle cx="24" cy="24.8" r="0.8"/></g>
    <path d="M22 26.4 L22 28.2 M20.6 28.8 q1.4 1 2.8 0" stroke="#3a2850" stroke-width="0.9" fill="none"/>
    <circle cx="19.8" cy="12.4" r="2" fill="none" stroke="#ffd76a" stroke-width="1.3"/>
    <circle cx="24.2" cy="12.4" r="2" fill="none" stroke="#ffd76a" stroke-width="1.3"/>`, SELF),
  // IX — The Hermit: a lantern lit by a six-pointed star, a tall staff.
  hermit: taCard(`
    <path d="M30 11 L23.5 34" stroke="#bf9d6e" stroke-width="2"/>
    <path d="M14 18.5 L20 18.5 L21 27 L13 27 Z" fill="#efe3c4" stroke="#c9b488" stroke-width="1"/>
    <path d="M14.6 18.5 L17 14 L19.4 18.5 M17 14 L17 11.6" fill="none" stroke="#c9b488" stroke-width="1"/>
    <path d="M17 20.1 l0.9 1.8 2 .3 -1.45 1.4 .35 2 -1.8 -1 -1.8 1 .35 -2 -1.45 -1.4 2 -.3 Z" fill="#ffd76a"/>`, SELF),
  // X — Wheel of Fortune: the turning spoked wheel.
  wheel: taCard(`
    <circle cx="22" cy="22" r="10" fill="none" stroke="#e4d2a7" stroke-width="1.9"/>
    <circle cx="22" cy="22" r="3" fill="#e4d2a7" stroke="#c9b488" stroke-width="0.8"/>
    <g stroke="#c9b488" stroke-width="1.5"><path d="M22 12 L22 32"/><path d="M12 22 L32 22"/><path d="M14.9 14.9 L29.1 29.1"/><path d="M29.1 14.9 L14.9 29.1"/></g>
    <g fill="#ffd76a"><circle cx="22" cy="12" r="1.1"/><circle cx="32" cy="22" r="1.1"/></g>`, SELF),
  // XI — Justice: the balanced scales above an upright sword.
  justice: taCard(`
    <path d="M22 11 L22 31" stroke="#a9c8ff" stroke-width="1.6"/>
    <path d="M18 29 L26 29" stroke="#bf9d6e" stroke-width="2"/>
    <path d="M22 33.5 L22 31" stroke="#6f9ee8" stroke-width="1.6"/>
    <path d="M13 16 L31 16" stroke="#e4d2a7" stroke-width="1.6"/>
    <path d="M13 16 L13 19 M31 16 L31 19" stroke="#c9b488" stroke-width="1"/>
    <path d="M9.4 19 a3.6 2.2 0 0 0 7.2 0 Z" fill="none" stroke="#78e8c8" stroke-width="1.2"/>
    <path d="M27.4 19 a3.6 2.2 0 0 0 7.2 0 Z" fill="none" stroke="#78e8c8" stroke-width="1.2"/>
    <circle cx="22" cy="13.6" r="1.4" fill="#ffd76a"/>`, SELF),
  // XII — The Hanged Man: a figure suspended by one foot, haloed, serene.
  hanged: taCard(`
    <path d="M12 12.5 L32 12.5 M27 12.5 L27 16.5" stroke="#bf9d6e" stroke-width="2"/>
    <path d="M27 16.5 L22.5 18.5" stroke="#bf9d6e" stroke-width="1.4"/>
    <path d="M22.5 18.5 L22.5 27" stroke="#e4d2a7" stroke-width="2.2"/>
    <path d="M22.5 21 L18.6 18.2 M22.5 21 L26.4 18.2" stroke="#e4d2a7" stroke-width="2"/>
    <circle cx="22.5" cy="30" r="2.4" fill="#e4d2a7" stroke="#c9b488" stroke-width="0.9"/>
    <circle cx="22.5" cy="30" r="4.4" fill="none" stroke="#ffd76a" stroke-width="1.1" opacity="0.9"/>`, SELF),
  // XIII — Death: the reaper's scythe crossing a bone skull.
  death: taCard(`
    <path d="M27 34 L23 11.5" stroke="#bf9d6e" stroke-width="2"/>
    <path d="M23 11.5 q-10 -1.4 -12.5 6.4" fill="none" stroke="#a9c8ff" stroke-width="2.1"/>
    <path d="M14 23 a4.4 4.4 0 0 1 8.8 0 L22.8 27 L13.2 27 Z" fill="#efe3c4" stroke="#c9b488" stroke-width="1"/>
    <g fill="#3a2850"><circle cx="16.3" cy="23.2" r="1.1"/><circle cx="20.5" cy="23.2" r="1.1"/></g>
    <path d="M17 29.4 L19.8 29.4 M17.4 27 L17.4 29.4 M20.4 27 L20.4 29.4" stroke="#c9b488" stroke-width="0.9"/>`, SELF),
  // XIV — Temperance: water poured in an even stream between two vessels.
  temperance: taCard(`
    <path d="M14.5 12 L21 12 L19.3 18.5 L16.2 18.5 Z" fill="#efe3c4" stroke="#c9b488" stroke-width="1"/>
    <path d="M23.5 25.5 L30 25.5 L28.3 32 L25.2 32 Z" fill="#efe3c4" stroke="#c9b488" stroke-width="1"/>
    <path d="M18 18.5 Q20.5 23 26 25.6" fill="none" stroke="#a9c8ff" stroke-width="1.8"/>
    <g fill="#78e8c8"><circle cx="21.4" cy="21.6" r="0.9"/><circle cx="24" cy="23.6" r="0.9"/></g>`, SELF),

  // ── The Road of the Spirit (XV–XXI) ───────────────────────────────────────
  // XV — The Devil: a horned head over the chain that holds only if you let it.
  devil: taCard(`
    <circle cx="22" cy="19" r="9" fill="rgba(58,40,80,0.35)" stroke="#bf9d6e" stroke-width="1.2"/>
    <path d="M22 27.5 L17.3 12.8 L29.4 21.9 L14.6 21.9 L26.7 12.8 Z" fill="none" stroke="#ef5d72" stroke-width="1.7"/>
    <path d="M15.5 11.5 Q12 9 12.4 5.6 Q14.8 7.4 16.4 10.4 M28.5 11.5 Q32 9 31.6 5.6 Q29.2 7.4 27.6 10.4" fill="none" stroke="#bf3350" stroke-width="1.6"/>
    <g fill="none" stroke="#bf9d6e" stroke-width="1.3"><circle cx="18.4" cy="33.6" r="1.7"/><circle cx="22" cy="34.2" r="1.7"/><circle cx="25.6" cy="33.6" r="1.7"/></g>`, SPIRIT),
  // XVI — The Tower: the struck tower — lightning, flame, the crown cast down.
  tower: taCard(`
    <rect x="17.5" y="17" width="9" height="17" rx="0.5" fill="#e4d2a7" stroke="#c9b488" stroke-width="1"/>
    <path d="M17.5 21.5 h9" stroke="#c9b488" stroke-width="0.8"/>
    <rect x="20" y="25.5" width="4" height="8.5" rx="0.4" fill="#3a2850"/>
    <path d="M16.5 15 L18.8 11.6 L21 15 L23 11.6 L25.2 15 L27.5 15" fill="none" stroke="#ffb44a" stroke-width="1.5"/>
    <path d="M31 8 L24.5 16.5 L28.5 16.5 L22 24.5" fill="none" stroke="#ffd76a" stroke-width="2"/>
    <path d="M17.8 15 q1 -3 2.2 0 M25.8 15 q1 -3 2.2 0" fill="none" stroke="#ef5d72" stroke-width="1.3"/>`, SPIRIT),
  // XVII — The Star: the great star over the renewing waters — hope earned.
  star: taCard(`
    <path d="M22 7.5 L23.7 14.3 L30 16 L23.7 17.7 L22 24.5 L20.3 17.7 L14 16 L20.3 14.3 Z" fill="#ffd76a" stroke="#e68a2c" stroke-width="0.6"/>
    <g fill="#a9c8ff"><circle cx="13.6" cy="12" r="1.1"/><circle cx="30.4" cy="12" r="1.1"/></g>
    <path d="M16 28 q3 3.2 0 6.2 M22 28.5 q3 3.2 0 6.2 M28 28 q-3 3.2 0 6.2" fill="none" stroke="#a9c8ff" stroke-width="1.3"/>`, SPIRIT),
  // XVIII — The Moon: the moon over the two towers, dew falling on the path.
  moon: taCard(`
    <circle cx="22" cy="16.5" r="6.9" fill="#a9c8ff" opacity="0.28"/>
    <circle cx="22" cy="16.5" r="6.9" fill="none" stroke="#6f9ee8" stroke-width="1.4"/>
    <path d="M24.8 10.6 a6.9 6.9 0 0 1 0 11.8 a5 5 0 0 0 0 -11.8 Z" fill="#a9c8ff" opacity="0.7"/>
    <g fill="#6f9ee8" opacity="0.8"><circle cx="19.4" cy="15" r="1"/><circle cx="20.6" cy="19" r="0.7"/></g>
    <path d="M13.5 34 L13.5 27 L16 27 L16 34 M28 34 L28 27 L30.5 27 L30.5 34" fill="none" stroke="#c9b488" stroke-width="1.2"/>
    <g fill="#a9c8ff"><circle cx="22" cy="27.5" r="1"/><circle cx="18.8" cy="31" r="0.8"/><circle cx="25.2" cy="31" r="0.8"/></g>`, SPIRIT),
  // XIX — The Sun: the radiant sun, face open, warmth and plain good fortune.
  sun: taCard(`
    <g stroke="#ffb44a" stroke-width="1.6"><path d="M22 9.5 L22 6.5"/><path d="M22 34.5 L22 31.5"/><path d="M9.5 20.5 L6.5 20.5"/><path d="M34.5 20.5 L37.5 20.5"/><path d="M13.6 12.1 L11.5 10"/><path d="M30.4 12.1 L32.5 10"/><path d="M13.6 28.9 L11.5 31"/><path d="M30.4 28.9 L32.5 31"/></g>
    <circle cx="22" cy="20.5" r="7" fill="#ffd76a" stroke="#e68a2c" stroke-width="1"/>
    <g fill="#e68a2c"><circle cx="19.4" cy="19.4" r="0.9"/><circle cx="24.6" cy="19.4" r="0.9"/></g>
    <path d="M19.2 23 q2.8 2.2 5.6 0" fill="none" stroke="#e68a2c" stroke-width="1.1"/>`, SPIRIT),
  // XX — Judgement: the trumpet's call, a banner-cross and ringing sound.
  judgement: taCard(`
    <path d="M13 18 L27 14.5 L27 21.5 L13 23 Z" fill="#e4d2a7" stroke="#c9b488" stroke-width="1"/>
    <path d="M27 16.6 L31 17.6 L31 18.4 L27 19.4 Z" fill="#e4d2a7" stroke="#c9b488" stroke-width="0.8"/>
    <g stroke="#ffd76a" stroke-width="1.3"><path d="M11 13 L8 11"/><path d="M10.5 20.5 L7.3 20.5"/><path d="M11 28 L8 30"/></g>
    <path d="M18.5 15.5 L18.5 10.5 M16.2 12.6 L20.8 12.6" stroke="#ef5d72" stroke-width="1.3"/>`, SPIRIT),
  // XXI — The World: the laurel wreath closed whole, a star and the four corners.
  world: taCard(`
    <ellipse cx="22" cy="22" rx="8.2" ry="10.4" fill="none" stroke="#3fb79a" stroke-width="2.2" stroke-dasharray="1.1 2.6"/>
    <path d="M22 16.4 l1.4 4.2 4.4 .3 -3.4 2.7 1.1 4.3 -3.5 -2.4 -3.5 2.4 1.1 -4.3 -3.4 -2.7 4.4 -.3 Z" fill="#ffd76a" stroke="#e68a2c" stroke-width="0.5"/>
    <g fill="#a9c8ff"><circle cx="11.5" cy="11.5" r="1.3"/><circle cx="32.5" cy="11.5" r="1.3"/><circle cx="11.5" cy="32.5" r="1.3"/><circle cx="32.5" cy="32.5" r="1.3"/></g>`, SPIRIT),
};

export { TAROT_ARCANA_ICONS };
