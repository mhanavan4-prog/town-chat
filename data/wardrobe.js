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
  return out;
}

// Resolve an appearance into concrete render instructions for the client:
//   showProps    — KayKit prop NODE names to make visible (all others hidden)
//   hideCosmetic — headwear/cape mesh names to HIDE (toggled off)
//   staff        — whether to attach the Lich's separate staff model
function resolveLook(charId, ap) {
  const def = WARDROBE[charId];
  if (!def) return { showProps: [], hideCosmetic: [], staff: false };
  ap = ap || {};
  const w = def.weapons.find((x) => x.id === ap.weapon) || def.weapons.find((x) => x.id === def.defaultWeapon) || def.weapons[0];
  const show = (w && w.show) ? w.show : [];
  const staff = show.indexOf('__SKEL_STAFF__') !== -1;
  const hideCosmetic = [];
  for (const t of def.toggles) {
    const on = ap[t.id] === undefined ? true : !!ap[t.id];
    if (!on) hideCosmetic.push(t.mesh);
  }
  return { showProps: show.filter((m) => m !== '__SKEL_STAFF__'), hideCosmetic, staff };
}

module.exports = { WARDROBE, sanitizeAppearance, resolveLook };
