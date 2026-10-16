'use strict';
// Purchasable "Artisan" sidegrade recipes (Session O — gold sink). Gold in
// Thornreach had almost no sink: faucets (Ember, Delve, quests) poured it in,
// but the only drains were one-time starter gear + the Locksmith. This adds a
// LONG chase: ~40 recipes a player LEARNS with gold, then crafts from gathered
// materials. Buying every recipe costs on the order of ~1.4M gold — hundreds of
// days of income — so gold stays meaningful well past launch.
//
// Design guardrails (checked by test/crafting-tree.test.js):
//  • SIDEGRADES, not upgrades — every stat stays under the non-crafted relic
//    ceiling (power .2 / guard .14 / vitality 25 / swift .14 / haste .1 /
//    leech .08 / xp .1 / forage .15). These sit comfortably below. The point is
//    alternate stat SPREADS (a playstyle to chase), never more raw power.
//  • Tier 2 — each recipe is forged from a Tier-1 component, so it chains into
//    the existing Artificer tree rather than bypassing it.
//  • Generated deterministically from the tables below so the catalog stays
//    internally consistent and easy to retune (bump BASE_PRICES to re-pace it).

// Eight themed schools — a primary + secondary stat flavor each — in ascending
// price tiers. base = the ring (cheapest slot) price for that school.
const SCHOOLS = [
  { key: 'emberforged', name: 'Emberforged', primary: 'power',  secondary: 'leech',    comp: 'tempered_ingot', raw: 'emberbloom',     base: 1500 },
  { key: 'ironward',    name: 'Ironward',    primary: 'guard',  secondary: 'vitality', comp: 'tempered_ingot', raw: 'iron_ore',       base: 3000 },
  { key: 'windrunner',  name: 'Windrunner',  primary: 'swift',  secondary: 'haste',    comp: 'cured_leather',  raw: 'glimmerdust',    base: 6000 },
  { key: 'loreweave',   name: 'Loreweave',   primary: 'xp',     secondary: 'haste',    comp: 'spirit_thread',  raw: 'shadow_essence', base: 11000 },
  { key: 'thornwild',   name: 'Thornwild',   primary: 'forage', secondary: 'swift',    comp: 'cured_leather',  raw: 'fur_scrap',      base: 19000 },
  { key: 'sanguine',    name: 'Sanguine',    primary: 'leech',  secondary: 'vitality', comp: 'spirit_thread',  raw: 'bone_shard',     base: 32000 },
  { key: 'warden',      name: 'Warden',      primary: 'guard',  secondary: 'power',    comp: 'tempered_ingot', raw: 'enchanted_gem',  base: 52000 },
  { key: 'arcanist',    name: 'Arcanist',    primary: 'power',  secondary: 'xp',       comp: 'spirit_thread',  raw: 'dragon_scale',   base: 85000 },
];

// Five slots, cheapest → priciest, with a per-slot price multiplier and a
// "level" (0–4) that scales the stat values up the table below.
const SLOTS = [
  { slot: 'ring',   label: 'Band',   icon: '📿', mult: 1.00 },
  { slot: 'feet',   label: 'Treads', icon: '🥾', mult: 1.15 },
  { slot: 'head',   label: 'Cowl',   icon: '🎕', mult: 1.30 },
  { slot: 'chest',  label: 'Mantle', icon: '🧥', mult: 1.50 },
  { slot: 'weapon', label: 'Edge',   icon: '🗡️', mult: 1.80 },
];

// Per-stat value tables by slot level (0=ring … 4=weapon). Primary is the
// headline stat; secondary is a smaller support stat. vitality is a flat health
// number; everything else is a fraction (shown as a %). All values are capped
// well under the relic ceiling — these are sidegrades.
const PRIMARY = {
  power:    [0.07, 0.09, 0.11, 0.13, 0.15],
  guard:    [0.05, 0.06, 0.08, 0.10, 0.11],
  swift:    [0.05, 0.06, 0.08, 0.10, 0.11],
  haste:    [0.03, 0.04, 0.05, 0.06, 0.07],
  leech:    [0.03, 0.04, 0.05, 0.06, 0.07],
  xp:       [0.04, 0.05, 0.06, 0.07, 0.08],
  forage:   [0.05, 0.07, 0.09, 0.11, 0.12],
  vitality: [10, 12, 14, 16, 18],
};
const SECONDARY = {
  power:    [0.03, 0.03, 0.04, 0.04, 0.05],
  guard:    [0.03, 0.03, 0.04, 0.04, 0.05],
  swift:    [0.03, 0.03, 0.04, 0.04, 0.05],
  forage:   [0.03, 0.03, 0.04, 0.04, 0.05],
  haste:    [0.02, 0.03, 0.03, 0.04, 0.04],
  leech:    [0.02, 0.03, 0.03, 0.04, 0.04],
  xp:       [0.02, 0.03, 0.03, 0.04, 0.04],
  vitality: [6, 8, 8, 10, 12],
};

const CRAFT_SHOP_ITEMS = {};
const CRAFT_SHOP_EQUIP = {};
const CRAFT_SHOP_RECIPES = [];

for (const school of SCHOOLS) {
  SLOTS.forEach((slotDef, lvl) => {
    const id = 'cs_' + school.key + '_' + slotDef.slot;
    const name = school.name + ' ' + slotDef.label;
    CRAFT_SHOP_ITEMS[id] = { name, icon: slotDef.icon, slot: slotDef.slot };

    const stats = {};
    stats[school.primary] = PRIMARY[school.primary][lvl];
    // Don't let a secondary clobber a primary of the same key (none overlap in
    // SCHOOLS today, but stay defensive); add the secondary separately.
    if (school.secondary !== school.primary) stats[school.secondary] = SECONDARY[school.secondary][lvl];
    CRAFT_SHOP_EQUIP[id] = stats;

    // Forged from the school's Tier-1 component + its themed raw drop; the two
    // priciest schools also need an Ember Glass catalyst (a deeper material sink).
    const ingredients = [{ id: school.comp, qty: 2 }, { id: school.raw, qty: 2 }];
    if (school.base >= 52000) ingredients.push({ id: 'ember_glass', qty: 1 });

    const gold = Math.round(school.base * slotDef.mult);
    CRAFT_SHOP_RECIPES.push({
      id, tier: 2, category: 'Artisan — ' + school.name, result: id, gold,
      ingredients,
      desc: 'Learn for ' + gold + '🪙, then forge from ' + ingredients.map((i) => i.qty + '× ' + i.id).join(' + '),
    });
  });
}

module.exports = { CRAFT_SHOP_ITEMS, CRAFT_SHOP_EQUIP, CRAFT_SHOP_RECIPES };
