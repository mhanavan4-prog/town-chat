'use strict';
// Wardrobe (Session N) — the per-class cosmetic appearance system. Phase 1:
// base-character customization, decoupled from stat gear. A player's look is a
// small profile { weapon, <toggles> } the model honors at build time; it is NOT
// an inventory item and carries NO stats — pure fashion.
//
// The content is meshes ALREADY bundled in each KayKit character model: every
// class ships a hidden armory of props (staff/wand/axes/shields/etc.) plus
// toggleable headwear and capes. In-game, client/humanoid.js normally shows only
// a fixed KEEP set; the wardrobe lets the player choose which of those built-in
// props to show. Defaults reproduce the current look exactly, so nothing changes
// until a player customizes.
//
// `show` lists the KayKit NODE names to make visible for a weapon look (the rest
// of that class's props are hidden). '__SKEL_STAFF__' is special: the Lich's
// Skeleton Mage body ships no weapon mesh, so its staff is a separately-socketed
// model — the marker tells the client to attach (or not) that staff.
//
// Shared by the server (validation + persistence + broadcast) and the client
// (apply + the Wardrobe UI). Keep weapon/toggle ids stable — they persist on
// accounts.

const WARDROBE = {
  0: { // Witch (Mage)
    weapons: [
      { id: 'staff', label: 'Staff', show: ['2H_Staff'] },
      { id: 'wand', label: 'Wand', show: ['1H_Wand'] },
      { id: 'tome', label: 'Spellbook', show: ['Spellbook'] }
    ],
    defaultWeapon: 'staff',
    toggles: [ { id: 'hat', label: 'Hat', mesh: 'Mage_Hat' }, { id: 'cape', label: 'Cape', mesh: 'Mage_Cape' } ]
  },
  1: { // Werewolf (Barbarian)
    weapons: [
      { id: 'claws', label: 'Claws', show: [] },
      { id: 'axe', label: 'Axe', show: ['1H_Axe'] },
      { id: 'axe_shield', label: 'Axe & Shield', show: ['1H_Axe', 'Barbarian_Round_Shield'] },
      { id: 'greataxe', label: 'Great Axe', show: ['2H_Axe'] },
      { id: 'tankard', label: 'Tankard', show: ['Mug'] }
    ],
    defaultWeapon: 'claws',
    toggles: [ { id: 'hat', label: 'Hat', mesh: 'Barbarian_Hat' }, { id: 'cape', label: 'Cape', mesh: 'Barbarian_Cape' } ]
  },
  2: { // Mystic (Rogue_Hooded) — the hood IS its head mesh, so no hood toggle.
    weapons: [
      { id: 'none', label: 'Bare (spirits)', show: [] },
      { id: 'dagger', label: 'Dagger', show: ['Knife'] },
      { id: 'dual', label: 'Dual Daggers', show: ['Knife', 'Knife_Offhand'] },
      { id: 'crossbow', label: 'Crossbow', show: ['2H_Crossbow'] }
    ],
    defaultWeapon: 'none',
    toggles: [ { id: 'cape', label: 'Cape', mesh: 'Rogue_Cape' } ]
  },
  3: { // Knight
    weapons: [
      { id: 'sword_crest', label: 'Sword & Crest', show: ['1H_Sword', 'Badge_Shield'] },
      { id: 'sword_round', label: 'Sword & Round Shield', show: ['1H_Sword', 'Round_Shield'] },
      { id: 'sword_kite', label: 'Sword & Kite Shield', show: ['1H_Sword', 'Rectangle_Shield'] },
      { id: 'sword_spike', label: 'Sword & Spiked Shield', show: ['1H_Sword', 'Spike_Shield'] },
      { id: 'greatsword', label: 'Greatsword', show: ['2H_Sword'] },
      { id: 'dual_swords', label: 'Dual Swords', show: ['1H_Sword', '1H_Sword_Offhand'] }
    ],
    defaultWeapon: 'sword_crest',
    toggles: [ { id: 'helmet', label: 'Helmet', mesh: 'Knight_Helmet' }, { id: 'cape', label: 'Cape', mesh: 'Knight_Cape' } ]
  },
  4: { // Wanderer (Rogue)
    weapons: [
      { id: 'dagger', label: 'Dagger', show: ['Knife'] },
      { id: 'dual', label: 'Dual Daggers', show: ['Knife', 'Knife_Offhand'] },
      { id: 'crossbow', label: 'Crossbow', show: ['2H_Crossbow'] },
      { id: 'throwing', label: 'Throwing Knife', show: ['Throwable'] }
    ],
    defaultWeapon: 'dagger',
    toggles: [ { id: 'cape', label: 'Cape', mesh: 'Rogue_Cape' } ]
  },
  5: { // Lich (Skeleton Mage) — staff is a separately-socketed model.
    weapons: [
      { id: 'staff', label: 'Bone Staff', show: ['__SKEL_STAFF__'] },
      { id: 'none', label: 'Bare Hands', show: [] }
    ],
    defaultWeapon: 'staff',
    toggles: [ { id: 'hat', label: 'Hat', mesh: 'Skeleton_Mage_Hat' } ]
  }
};

// Phase 2 unlocks — which weapon looks cost something to use. Absent = free, and
// toggles (hat/cape/hood) are ALWAYS free. { lvl } and { chapter } unlock
// automatically once earned through play; { ms } is a Moonstone purchase (account
// only), recorded in progress.wardrobeUnlocks[charId]. Tunable here — this is the
// whole monetization/earn surface. Keep weapon ids in sync with WARDROBE above.
const UNLOCKS = {
  0: { tome: { chapter: 3 } },
  1: { axe_shield: { lvl: 5 }, greataxe: { lvl: 10 }, tankard: { ms: 300 } },
  2: { dual: { lvl: 5 }, crossbow: { lvl: 10 } },
  3: { sword_kite: { lvl: 5 }, sword_spike: { lvl: 10 }, greatsword: { ms: 400 }, dual_swords: { ms: 400 } },
  4: { crossbow: { lvl: 5 }, throwing: { lvl: 10 } },
  5: {}
};
function weaponUnlock(charId, weaponId) { return (UNLOCKS[charId] && UNLOCKS[charId][weaponId]) || null; }

// Phase 3 — DYES. A second cosmetic axis on top of the weapon look: a player can
// tint their OUTFIT (body + sleeves + legs) and their ACCENT (hat/helmet + cape)
// with a color. The tint is a multiply over the KayKit atlas texture, so detail
// survives — `hex: null` ('none') means the natural, untinted look. Dyes are
// account-wide (not per-class) and shared by every character the account plays;
// head / face / skin and held props are never tinted. Keep ids stable — they
// persist on accounts. The same palette serves both the outfit and accent slots.
const DYES = [
  { id: 'none',    label: 'Natural',  hex: null },
  { id: 'ash',     label: 'Ash',      hex: 0x9aa0a8 },
  { id: 'sienna',  label: 'Sienna',   hex: 0xb5794a },
  { id: 'crimson', label: 'Crimson',  hex: 0xc83232 },
  { id: 'forest',  label: 'Forest',   hex: 0x4f9d55 },
  { id: 'cobalt',  label: 'Cobalt',   hex: 0x4a73c8 },
  { id: 'royal',   label: 'Royal',    hex: 0x9a5cc8 },
  { id: 'rose',    label: 'Rose',     hex: 0xe58ab0 },
  { id: 'gold',    label: 'Gold',     hex: 0xe0b84a },
  { id: 'void',    label: 'Void',     hex: 0x6a4a9a },
  { id: 'arcane',  label: 'Arcane',   hex: 0x45c8c0 },
  { id: 'ember',   label: 'Ember',    hex: 0xd9531e },
  // ── The Finery line (roadmap #7) — a premium palette bought with GOLD, a
  // sink for engaged players. Account-wide and visible to everyone, so it
  // reads as the show-off tier. Priced in dyeUnlocks below ({ gold }).
  { id: 'obsidian', label: 'Obsidian', hex: 0x1b1d2a },
  { id: 'bone',     label: 'Bone',     hex: 0xe8e0cf },
  { id: 'oxblood',  label: 'Oxblood',  hex: 0x6e1f2a },
  { id: 'viridian', label: 'Viridian', hex: 0x1f7a6a },
  { id: 'amethyst', label: 'Amethyst', hex: 0x8e44c8 },
  { id: 'pearl',    label: 'Pearl',    hex: 0xdfe6f0 }
];
const DYE_BY_ID = DYES.reduce((o, d) => { o[d.id] = d; return o; }, {});

// Dye unlocks — absent = free (none/ash/sienna). { lvl } / { chapter } unlock
// through play; { ms } is a Moonstone purchase recorded (account-wide) in
// progress.dyeUnlocks. Tunable here — the whole dye earn/monetization surface.
const DYE_UNLOCKS = {
  crimson: { lvl: 3 },
  forest:  { lvl: 6 },
  cobalt:  { lvl: 9 },
  royal:   { chapter: 2 },
  rose:    { ms: 150 },
  gold:    { ms: 250 },
  void:    { ms: 200 },
  arcane:  { ms: 300 },
  // Earned, not bought: unlocks when the Ashblood Trials arc is completed
  // (its final quest recorded in progress.questsDone). See dyeUnlocked().
  ember:   { quest: 'ashblood_ascension' },
  // The Finery line — a GOLD sink (roadmap #7). Once bought, ownership is
  // recorded in progress.dyeUnlocks (same as the Moonstone dyes). See
  // dyeUnlocked() + the buy_dye handler, which charges the bank for { gold }.
  obsidian: { gold: 500 },
  bone:     { gold: 500 },
  oxblood:  { gold: 700 },
  viridian: { gold: 700 },
  amethyst: { gold: 900 },
  pearl:    { gold: 1200 }
};
function dyeUnlock(dyeId) { return DYE_UNLOCKS[dyeId] || null; }
function dyeHex(dyeId) { const d = DYE_BY_ID[dyeId]; return d ? d.hex : null; }

// Clamp an arbitrary (possibly hostile) appearance object to a valid one for a
// class: a known weapon id (else the default) and boolean toggles (default on).
// Returns null for an unknown class. Used server-side before persisting.
function sanitizeAppearance(charId, ap) {
  const def = WARDROBE[charId];
  if (!def) return null;
  ap = (ap && typeof ap === 'object') ? ap : {};
  const weapon = def.weapons.some((w) => w.id === ap.weapon) ? ap.weapon : def.defaultWeapon;
  const out = { weapon };
  for (const t of def.toggles) out[t.id] = ap[t.id] === undefined ? true : !!ap[t.id];
  // Phase 3 dyes: a known dye id per slot, else 'none'. Unlock enforcement
  // (level/chapter/Moonstone) is the server's job, same as weapons.
  out.dyeBody = DYE_BY_ID[ap.dyeBody] ? ap.dyeBody : 'none';
  out.dyeAccent = DYE_BY_ID[ap.dyeAccent] ? ap.dyeAccent : 'none';
  return out;
}

// Resolve an appearance into concrete render instructions for the client:
//   showProps    — KayKit prop NODE names to make visible (all others hidden)
//   hideCosmetic — headwear/cape mesh names to HIDE (toggled off)
//   staff        — whether to attach the Lich's separate staff model
//   bodyTint     — hex to multiply onto outfit nodes (body/arms/legs), or null
//   accentTint   — hex to multiply onto accent nodes (hat/helmet/cape), or null
function resolveLook(charId, ap) {
  const def = WARDROBE[charId];
  if (!def) return { showProps: [], hideCosmetic: [], staff: false, bodyTint: null, accentTint: null };
  ap = ap || {};
  const w = def.weapons.find((x) => x.id === ap.weapon) || def.weapons.find((x) => x.id === def.defaultWeapon) || def.weapons[0];
  const show = (w && w.show) ? w.show : [];
  const staff = show.indexOf('__SKEL_STAFF__') !== -1;
  const hideCosmetic = [];
  for (const t of def.toggles) {
    const on = ap[t.id] === undefined ? true : !!ap[t.id];
    if (!on) hideCosmetic.push(t.mesh);
  }
  return {
    showProps: show.filter((m) => m !== '__SKEL_STAFF__'), hideCosmetic, staff,
    bodyTint: dyeHex(ap.dyeBody), accentTint: dyeHex(ap.dyeAccent)
  };
}

// ── Name colors (chat + nameplate flair) ────────────────────────────────────
// The most visible cosmetic — your name in every chat line and over your head.
// 'default' is your account's own assigned color (always free); the rest are
// account-wide Moonstone cosmetics. Pure flair: never touches stats.
const NAME_COLORS = [
  { id: 'default',  label: 'Natural',   hex: null },            // revert to the assigned color
  { id: 'rose',     label: 'Rose',      hex: 0xff6f91, ms: 12 },
  { id: 'amber',    label: 'Amber',     hex: 0xffb44a, ms: 12 },
  { id: 'gold',     label: 'Gold',      hex: 0xffd94a, ms: 12 },
  { id: 'jade',     label: 'Jade',      hex: 0x4ee6a8, ms: 12 },
  { id: 'teal',     label: 'Teal',      hex: 0x4bd6e6, ms: 12 },
  { id: 'sky',      label: 'Sky',       hex: 0x6fb3ff, ms: 12 },
  { id: 'violet',   label: 'Violet',    hex: 0xb07cff, ms: 12 },
  { id: 'magenta',  label: 'Magenta',   hex: 0xff6fe0, ms: 12 },
  { id: 'crimson',  label: 'Crimson',   hex: 0xff4d5e, ms: 15 },
  { id: 'spectral', label: 'Spectral',  hex: 0x9afff0, ms: 15 },
  { id: 'bone',     label: 'Bonelight', hex: 0xf3e7cb, ms: 15 },
];
const NAME_COLOR_BY_ID = NAME_COLORS.reduce((o, c) => { o[c.id] = c; return o; }, {});
// CSS hex for a palette id, or null for 'default' (caller substitutes the
// account's own assigned color).
function nameColorHexCss(id) { const c = NAME_COLOR_BY_ID[id]; return (c && c.hex != null) ? '#' + c.hex.toString(16).padStart(6, '0') : null; }

module.exports = { WARDROBE, UNLOCKS, weaponUnlock, DYES, DYE_UNLOCKS, dyeUnlock, dyeHex, sanitizeAppearance, resolveLook, NAME_COLORS, NAME_COLOR_BY_ID, nameColorHexCss };
