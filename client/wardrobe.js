// Wardrobe (client copy) — MUST STAY IN SYNC with data/wardrobe.js (the server's
// copy, used for validation/persistence). Same split as SPELL_CATALOG etc: the
// client bundles ESM, the server requires CJS, so the catalog lives in both.
//
// Phase 1 cosmetic appearance: a player's look is { weapon, <toggles> } the model
// honors at build time — pure fashion, no stats. `show` lists the KayKit NODE
// names a weapon look makes visible (the rest of that class's props are hidden).
// '__SKEL_STAFF__' marks the Lich's separately-socketed staff. Defaults
// reproduce the current in-game look, so unchanged players look exactly as before.

export const WARDROBE = {
  0: {
    weapons: [
      { id: 'staff', label: 'Staff', show: ['2H_Staff'] },
      { id: 'wand', label: 'Wand', show: ['1H_Wand'] },
      { id: 'tome', label: 'Spellbook', show: ['Spellbook'] }
    ],
    defaultWeapon: 'staff',
    toggles: [ { id: 'hat', label: 'Hat', mesh: 'Mage_Hat' }, { id: 'cape', label: 'Cape', mesh: 'Mage_Cape' } ]
  },
  1: {
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
  2: {
    weapons: [
      { id: 'none', label: 'Bare (spirits)', show: [] },
      { id: 'dagger', label: 'Dagger', show: ['Knife'] },
      { id: 'dual', label: 'Dual Daggers', show: ['Knife', 'Knife_Offhand'] },
      { id: 'crossbow', label: 'Crossbow', show: ['2H_Crossbow'] }
    ],
    defaultWeapon: 'none',
    toggles: [ { id: 'cape', label: 'Cape', mesh: 'Rogue_Cape' } ]
  },
  3: {
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
  4: {
    weapons: [
      { id: 'dagger', label: 'Dagger', show: ['Knife'] },
      { id: 'dual', label: 'Dual Daggers', show: ['Knife', 'Knife_Offhand'] },
      { id: 'crossbow', label: 'Crossbow', show: ['2H_Crossbow'] },
      { id: 'throwing', label: 'Throwing Knife', show: ['Throwable'] }
    ],
    defaultWeapon: 'dagger',
    toggles: [ { id: 'cape', label: 'Cape', mesh: 'Rogue_Cape' } ]
  },
  5: {
    weapons: [
      { id: 'staff', label: 'Bone Staff', show: ['__SKEL_STAFF__'] },
      { id: 'none', label: 'Bare Hands', show: [] }
    ],
    defaultWeapon: 'staff',
    toggles: [ { id: 'hat', label: 'Hat', mesh: 'Skeleton_Mage_Hat' } ]
  }
};

// Phase 2 unlocks — MUST STAY IN SYNC with data/wardrobe.js. Absent = free;
// { lvl } / { chapter } unlock through play; { ms } is a Moonstone purchase.
export const UNLOCKS = {
  0: { tome: { chapter: 3 } },
  1: { axe_shield: { lvl: 5 }, greataxe: { lvl: 10 }, tankard: { ms: 300 } },
  2: { dual: { lvl: 5 }, crossbow: { lvl: 10 } },
  3: { sword_kite: { lvl: 5 }, sword_spike: { lvl: 10 }, greatsword: { ms: 400 }, dual_swords: { ms: 400 } },
  4: { crossbow: { lvl: 5 }, throwing: { lvl: 10 } },
  5: {}
};
export function weaponUnlock(charId, weaponId) { return (UNLOCKS[charId] && UNLOCKS[charId][weaponId]) || null; }

// Phase 3 DYES — MUST STAY IN SYNC with data/wardrobe.js. A second cosmetic axis:
// tint the OUTFIT (body/arms/legs) and ACCENT (hat/helmet/cape) with a color
// multiplied over the KayKit atlas. `hex: null` is the natural look. Account-wide
// (shared across every class); head / face / skin and props are never tinted.
export const DYES = [
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
  { id: 'arcane',  label: 'Arcane',   hex: 0x45c8c0 }
];
const DYE_BY_ID = DYES.reduce((o, d) => { o[d.id] = d; return o; }, {});
export const DYE_UNLOCKS = {
  crimson: { lvl: 3 }, forest: { lvl: 6 }, cobalt: { lvl: 9 }, royal: { chapter: 2 },
  rose: { ms: 150 }, gold: { ms: 250 }, void: { ms: 200 }, arcane: { ms: 300 }
};
export function dyeUnlock(dyeId) { return DYE_UNLOCKS[dyeId] || null; }
export function dyeHex(dyeId) { const d = DYE_BY_ID[dyeId]; return d ? d.hex : null; }

// Resolve an appearance into concrete render instructions (see data/wardrobe.js).
export function resolveLook(charId, ap) {
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
