// The Artificer's Workshop (Session N) — a three-tier crafting TREE, as
// opposed to Witch Hazel's flat potion recipes. Raw mob/quest drops refine
// into components (Tier 1); components forge mid-tier gear (Tier 2); that gear
// plus a rare catalyst upgrades into the Starforged line (Tier 3). Each tier's
// outputs are the next tier's inputs — that dependency chain is the "tree".
//
// Design rules this file keeps (enforced by test/crafting-tree.test.js):
//  • Gives currently dead-end drops (fur, ore, essence, gems, scale, stone) a
//    purpose — every input is an item that already exists in the catalog.
//  • Crafted gear is MID-TIER: at or below campaign-relic parity in every
//    stat, so the tree rewards effort/gathering (prestige) without power-creep.
//    Relics stay the strongest gear in the game by design.
//
// CRAFT_ITEMS / CRAFT_EQUIP are merged into ITEM_CATALOG / EQUIP_STATS at load,
// exactly like the legendary catalog, so the client needs no hand-synced copy.

// New items the tree introduces (components + the two crafted gear lines).
const CRAFT_ITEMS = {
  // ── Tier 1: refined components (no slot — crafting inputs only) ──
  cured_leather:  { name: 'Cured Leather',  icon: '🟫', slot: null },
  tempered_ingot: { name: 'Tempered Ingot', icon: '🔩', slot: null },
  spirit_thread:  { name: 'Spirit Thread',  icon: '🧵', slot: null },
  // ── Tier 2: the Wayfarer set (mid-tier crafted gear) ──
  forged_cleaver:     { name: 'Forged Cleaver',     icon: '🪓', slot: 'weapon' },
  wayfarer_vestments: { name: 'Wayfarer Vestments', icon: '🧣', slot: 'chest'  },
  wayfarer_treads:    { name: 'Wayfarer Treads',    icon: '🥿', slot: 'feet'   },
  warded_band:        { name: 'Warded Band',        icon: '📿', slot: 'ring'   },
  seers_hood:         { name: "Seer's Hood",        icon: '🎓', slot: 'head'   },
  // ── Tier 3: the Starforged line (top of the crafted tree) ──
  starforged_blade:  { name: 'Starforged Blade',  icon: '🔪', slot: 'weapon' },
  starforged_aegis:  { name: 'Starforged Aegis',  icon: '🦺', slot: 'chest'  },
  starforged_signet: { name: 'Starforged Signet', icon: '💫', slot: 'ring'   },
};

// Stat contributions for the crafted gear (kept at/below relic parity).
const CRAFT_EQUIP = {
  forged_cleaver:     { power: 0.12, leech: 0.03 },
  wayfarer_vestments: { guard: 0.08, vitality: 12 },
  wayfarer_treads:    { swift: 0.08, haste: 0.03 },
  warded_band:        { power: 0.06, guard: 0.05, xp: 0.05 },
  seers_hood:         { haste: 0.07, xp: 0.07, vitality: 8 },
  starforged_blade:   { power: 0.15, leech: 0.05, haste: 0.04 },
  starforged_aegis:   { guard: 0.12, vitality: 20 },
  starforged_signet:  { power: 0.10, leech: 0.06, xp: 0.06 },
};

// The recipe tree, ordered by tier for the Workshop UI. `category` groups rows
// under a heading; `tier` drives the integrity tests. Every `result` is a
// CRAFT_ITEMS key; every ingredient id is an existing catalog item.
const CRAFT_RECIPES = [
  // ── Tier 1 — Refine raw drops into components ──
  { id: 'cured_leather', tier: 1, category: 'Components', result: 'cured_leather',
    ingredients: [{ id: 'fur_scrap', qty: 3 }, { id: 'animal_pelt', qty: 1 }],
    desc: '3× Fur Scrap + Animal Pelt → Cured Leather' },
  { id: 'tempered_ingot', tier: 1, category: 'Components', result: 'tempered_ingot',
    ingredients: [{ id: 'iron_ore', qty: 2 }, { id: 'bone_shard', qty: 1 }],
    desc: '2× Iron Ore + Bone Shard → Tempered Ingot' },
  { id: 'spirit_thread', tier: 1, category: 'Components', result: 'spirit_thread',
    ingredients: [{ id: 'shadow_essence', qty: 2 }, { id: 'glimmerdust', qty: 1 }],
    desc: "2× Shadow Essence + Glimmerdust → Spirit Thread" },

  // ── Tier 2 — Forge the Wayfarer set from components ──
  { id: 'forged_cleaver', tier: 2, category: 'Wayfarer Gear', result: 'forged_cleaver',
    ingredients: [{ id: 'tempered_ingot', qty: 2 }, { id: 'cured_leather', qty: 1 }],
    desc: '2× Tempered Ingot + Cured Leather → Forged Cleaver (weapon)' },
  { id: 'wayfarer_vestments', tier: 2, category: 'Wayfarer Gear', result: 'wayfarer_vestments',
    ingredients: [{ id: 'cured_leather', qty: 2 }, { id: 'tempered_ingot', qty: 1 }],
    desc: '2× Cured Leather + Tempered Ingot → Wayfarer Vestments (chest)' },
  { id: 'wayfarer_treads', tier: 2, category: 'Wayfarer Gear', result: 'wayfarer_treads',
    ingredients: [{ id: 'cured_leather', qty: 2 }, { id: 'spirit_thread', qty: 1 }],
    desc: '2× Cured Leather + Spirit Thread → Wayfarer Treads (feet)' },
  { id: 'warded_band', tier: 2, category: 'Wayfarer Gear', result: 'warded_band',
    ingredients: [{ id: 'spirit_thread', qty: 1 }, { id: 'tempered_ingot', qty: 1 }],
    desc: 'Spirit Thread + Tempered Ingot → Warded Band (ring)' },
  { id: 'seers_hood', tier: 2, category: 'Wayfarer Gear', result: 'seers_hood',
    ingredients: [{ id: 'spirit_thread', qty: 2 }, { id: 'cured_leather', qty: 1 }],
    desc: "2× Spirit Thread + Cured Leather → Seer's Hood (head)" },

  // ── Tier 3 — Upgrade Wayfarer gear + a rare catalyst into the Starforged line ──
  { id: 'starforged_blade', tier: 3, category: 'Starforged', result: 'starforged_blade',
    ingredients: [{ id: 'forged_cleaver', qty: 1 }, { id: 'tempered_ingot', qty: 2 }, { id: 'enchanted_gem', qty: 1 }],
    desc: 'Forged Cleaver + 2× Tempered Ingot + Enchanted Gem → Starforged Blade' },
  { id: 'starforged_aegis', tier: 3, category: 'Starforged', result: 'starforged_aegis',
    ingredients: [{ id: 'wayfarer_vestments', qty: 1 }, { id: 'spirit_thread', qty: 1 }, { id: 'dragon_scale', qty: 1 }],
    desc: 'Wayfarer Vestments + Spirit Thread + Dragon Scale → Starforged Aegis' },
  { id: 'starforged_signet', tier: 3, category: 'Starforged', result: 'starforged_signet',
    ingredients: [{ id: 'warded_band', qty: 1 }, { id: 'spirit_thread', qty: 1 }, { id: 'druid_stone', qty: 1 }],
    desc: 'Warded Band + Spirit Thread + Druid Stone → Starforged Signet' },
];

module.exports = { CRAFT_ITEMS, CRAFT_EQUIP, CRAFT_RECIPES };
