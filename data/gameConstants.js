// Small game-constant literals. Extracted verbatim from server.js (Tier 3.4
// Phase A). Pure data; MAX_LEVEL (= XP_THRESHOLDS.length-1) stays in server.js.

const MS_PACKS = {
  ms_pack_small:  { ms: 200,  cents: 199, name: 'Pouch of Moonstones' },
  ms_pack_medium: { ms: 550,  cents: 499, name: 'Casket of Moonstones' },
  ms_pack_large:  { ms: 1200, cents: 999, name: 'Reliquary of Moonstones' }
};

const COLORS = ['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#38d9a9','#4dabf7','#748ffc','#da77f2','#f783ac','#63e6be'];

const POTION_RECIPES = [
  { id: 'health_potion_ii', result: 'health_potion_ii',
    ingredients: [{ id: 'healing_herb', qty: 2 }],
    desc: '2× Healing Herb → Greater Healing Potion (restores 80 HP)' },
  { id: 'regen_brew', result: 'regen_brew',
    ingredients: [{ id: 'regen_root', qty: 1 }, { id: 'healing_herb', qty: 1 }],
    desc: 'Regen Root + Healing Herb → Regen Brew (regenerates HP over 45s)' },
  { id: 'swift_brew', result: 'swift_brew',
    ingredients: [{ id: 'swift_root', qty: 2 }],
    desc: '2× Swift Root → Swift Brew (speed boost for 45s)' },
  { id: 'shadow_draught', result: 'shadow_draught',
    ingredients: [{ id: 'wolfsbane_bloom', qty: 1 }, { id: 'ravens_feather_plant', qty: 1 }],
    desc: 'Wolfsbane Bloom + Raven\'s Feather → Shadow Draught (raven cloak 60s)' },
  { id: 'giants_elixir', result: 'giants_elixir',
    ingredients: [{ id: 'giants_cap', qty: 2 }],
    desc: "2× Giant's Cap → Giant's Elixir (giant form 45s)" },
  { id: 'bat_swarm_potion', result: 'bat_swarm_potion',
    ingredients: [{ id: 'bats_breath', qty: 2 }],
    desc: "2× Bat's Breath → Bat Swarm Potion (summon bats 45s)" },
  { id: 'clarity_draught', result: 'clarity_draught',
    ingredients: [{ id: 'meditation_lotus', qty: 1 }, { id: 'cleansing_clover', qty: 1 }],
    desc: 'Meditation Lotus + Cleansing Clover → Clarity Draught (cleanse all effects)' },
  { id: 'chaos_brew', result: 'chaos_brew',
    ingredients: [{ id: 'rainbow_petal', qty: 1 }, { id: 'pumpkin_blossom', qty: 1 }, { id: 'toadstool', qty: 1 }],
    desc: 'Rainbow Petal + Pumpkin Blossom + Toadstool → Chaos Brew (wild colour effects 60s)' },
];

const LOOT_TABLES = {
  town_mob: [
    { itemId: 'fur_scrap',   qty: 1, chance: 0.40 },
    { itemId: 'bone_shard',  qty: 1, chance: 0.20 },
    { gold: true, min: 1, max: 3, chance: 0.45 },
  ],
  // Wilds mobs keyed by mobType
  shade_stalker: [
    { itemId: 'fur_scrap',      qty: 1, chance: 0.55 },
    { itemId: 'shadow_essence', qty: 1, chance: 0.15 },
    { gold: true, min: 2, max: 8, chance: 0.60 },
  ],
  bog_brute: [
    { itemId: 'animal_pelt',  qty: 1, chance: 0.65 },
    { itemId: 'leather_hide', qty: 1, chance: 0.30 },
    { gold: true, min: 4, max: 14, chance: 0.55 },
    { itemId: 'iron_sword',   qty: 1, chance: 0.04 },
  ],
  night_howler: [
    { itemId: 'fur_scrap',     qty: 1, chance: 0.60 },
    { itemId: 'enchanted_fur', qty: 1, chance: 0.12 },
    { gold: true, min: 3, max: 10, chance: 0.55 },
  ],
  will_o_wisp: [
    { itemId: 'shadow_essence', qty: 1, chance: 0.70 },
    { gold: true, min: 2, max: 6,  chance: 0.50 },
    { itemId: 'silver_ring',    qty: 1, chance: 0.06 },
  ],
  // ── Session M creatures ────────────────────────────────────────────────
  // Peaceful critters (animals2 pool) — light material drops, they're prey.
  embermoth: [
    { itemId: 'glimmerdust', qty: 1, chance: 0.55 },
    { itemId: 'fur_scrap',   qty: 1, chance: 0.20 },
    { gold: true, min: 1, max: 4, chance: 0.30 },
  ],
  thistlehog: [
    { itemId: 'fur_scrap',   qty: 1, chance: 0.55 },
    { itemId: 'bone_shard',  qty: 1, chance: 0.25 },
    { gold: true, min: 1, max: 4, chance: 0.35 },
  ],
  duskfawn: [
    { itemId: 'animal_pelt', qty: 1, chance: 0.55 },
    { itemId: 'fur_scrap',   qty: 1, chance: 0.35 },
    { gold: true, min: 2, max: 6, chance: 0.40 },
  ],
  mirefowl: [
    { itemId: 'leather_hide', qty: 1, chance: 0.45 },
    { itemId: 'fur_scrap',    qty: 1, chance: 0.30 },
    { gold: true, min: 1, max: 5, chance: 0.35 },
  ],
  // Neutral creatures (mobs3 pool) — sturdier, better mats since you had to
  // pick a fight to get them.
  bramble_boar: [
    { itemId: 'animal_pelt',  qty: 1, chance: 0.60 },
    { itemId: 'leather_hide', qty: 1, chance: 0.35 },
    { itemId: 'iron_ore',     qty: 1, chance: 0.15 },
    { gold: true, min: 4, max: 12, chance: 0.55 },
  ],
  mossback_tortoise: [
    { itemId: 'stone_block', qty: 1, chance: 0.55 },
    { itemId: 'druid_stone', qty: 1, chance: 0.14 },
    { gold: true, min: 3, max: 10, chance: 0.45 },
  ],
  gravewing_crow: [
    { itemId: 'bone_shard',     qty: 1, chance: 0.55 },
    { itemId: 'shadow_essence', qty: 1, chance: 0.22 },
    { gold: true, min: 2, max: 8, chance: 0.45 },
  ],
  // Hostile night-mobs (mobs2 pool) — filling the archetype gaps.
  fen_hexer: [
    { itemId: 'shadow_essence', qty: 1, chance: 0.60 },
    { itemId: 'hollow_shard',   qty: 1, chance: 0.14 },
    { gold: true, min: 3, max: 11, chance: 0.55 },
    { itemId: 'shadow_staff',   qty: 1, chance: 0.04 },
  ],
  rot_swarm: [
    { itemId: 'bone_shard', qty: 1, chance: 0.45 },
    { itemId: 'fur_scrap',  qty: 1, chance: 0.35 },
    { gold: true, min: 1, max: 5, chance: 0.40 },
  ],
  barrow_maw: [
    { itemId: 'bone_shard',   qty: 1, chance: 0.55 },
    { itemId: 'iron_ore',     qty: 1, chance: 0.30 },
    { itemId: 'hollow_shard', qty: 1, chance: 0.12 },
    { gold: true, min: 4, max: 14, chance: 0.55 },
  ],
  gloom_bat: [
    { itemId: 'fur_scrap',      qty: 1, chance: 0.55 },
    { itemId: 'shadow_essence', qty: 1, chance: 0.25 },
    { gold: true, min: 2, max: 8, chance: 0.50 },
  ],
  old_marrowe: [ // rare Blood Moon elite — the marquee drop table
    { itemId: 'enchanted_fur',  qty: 1, chance: 0.70 },
    { itemId: 'hollow_shard',   qty: 2, chance: 0.55 },
    { itemId: 'bloodmoon_shard', qty: 1, chance: 0.60 },
    { gold: true, min: 20, max: 55, chance: 0.85 },
    { itemId: 'dread_helm',     qty: 1, chance: 0.10 },
    { itemId: 'cursed_blade',   qty: 1, chance: 0.08 },
  ],
  // Dungeon keyed by xp tier
  dungeon_t1: [ // xp=8
    { itemId: 'bone_shard',  qty: 1, chance: 0.55 },
    { itemId: 'fur_scrap',   qty: 1, chance: 0.30 },
    { gold: true, min: 1, max: 4,  chance: 0.50 },
  ],
  dungeon_t2: [ // xp=18
    { itemId: 'leather_hide', qty: 1, chance: 0.45 },
    { itemId: 'bone_shard',   qty: 1, chance: 0.35 },
    { gold: true, min: 3, max: 10,  chance: 0.60 },
    { itemId: 'iron_sword',   qty: 1, chance: 0.05 },
    { itemId: 'steel_shield', qty: 1, chance: 0.04 },
  ],
  dungeon_t3: [ // xp=35
    { itemId: 'iron_ore',      qty: 1, chance: 0.50 },
    { itemId: 'enchanted_fur', qty: 1, chance: 0.25 },
    { gold: true, min: 8, max: 22,  chance: 0.65 },
    { itemId: 'cursed_blade',  qty: 1, chance: 0.05 },
    { itemId: 'bone_armor',    qty: 1, chance: 0.04 },
    { itemId: 'dread_helm',    qty: 1, chance: 0.04 },
  ],
  dungeon_t4: [ // xp=65
    { itemId: 'shadow_essence', qty: 1, chance: 0.60 },
    { itemId: 'dragon_scale',   qty: 1, chance: 0.20 },
    { gold: true, min: 18, max: 50, chance: 0.70 },
    { itemId: 'void_staff',     qty: 1, chance: 0.06 },
    { itemId: 'abyssal_armor',  qty: 1, chance: 0.05 },
    { itemId: 'shadow_crown',   qty: 1, chance: 0.04 },
    { itemId: 'wraith_treads',  qty: 1, chance: 0.04 },
  ],
};

const STARTER_GEAR = {
  0: { weapon: 'spell_tome',  head: 'wizard_hat',    chest: 'witch_robe',    feet: 'hexed_boots',    ring: 'hex_amulet'   },
  1: { weapon: 'iron_sword',  head: 'beast_crown',   chest: 'beast_hide',    feet: 'paw_boots',      ring: 'silver_ring'  },
  2: { weapon: 'spell_tome',  head: 'spirit_veil',   chest: 'spirit_robe',   feet: 'leather_boots',  ring: 'spirit_ring'  },
  3: { weapon: 'iron_sword',  head: 'knights_helm',  chest: 'steel_shield',  feet: 'leather_boots',  ring: 'order_signet' },
  4: { weapon: 'iron_sword',  head: 'travelers_hood',chest: 'travelers_vest',feet: 'leather_boots',  ring: 'trail_ring'   }
};

const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000,
                        8200, 11000, 14500, 19000, 25000, 32500, 42000, 54000, 69000, 87000];

const EMOTE_SET = ['👋', '😂', '❤️', '😮', '😢', '😡', '👍', '💃'];

module.exports = { MS_PACKS, COLORS, POTION_RECIPES, LOOT_TABLES, STARTER_GEAR, XP_THRESHOLDS, EMOTE_SET };
