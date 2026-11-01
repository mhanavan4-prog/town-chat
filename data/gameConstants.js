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
  // The Green Path's first brew — a kitchen-witch tea from the chamomile you
  // grow in Chapter 1 (the Cottage Garden band).
  { id: 'chamomile_tisane', result: 'chamomile_tisane',
    ingredients: [{ id: 'chamomile', qty: 2 }],
    desc: '2× Chamomile → Chamomile Tisane (restores 90 HP)' },
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
  // --- Wilds-flora crafts: brewed from the new trees' & bushes' harvest materials ---
  { id: 'barkbind_salve', result: 'barkbind_salve',
    ingredients: [{ id: 'birch_bark', qty: 2 }, { id: 'pine_pitch', qty: 1 }],
    desc: '2× Birch Bark + Pine Pitch → Barkbind Salve (regenerates HP over 45s)' },
  { id: 'capwood_elixir', result: 'capwood_elixir',
    ingredients: [{ id: 'toadcap', qty: 2 }, { id: 'ring_cap', qty: 1 }],
    desc: '2× Toadcap + Ring Cap → Capwood Elixir (giant form 45s)' },
  { id: 'nightsight_draught', result: 'nightsight_draught',
    ingredients: [{ id: 'nightberry', qty: 2 }, { id: 'willow_frond', qty: 1 }],
    desc: '2× Nightberry + Willow Frond → Nightsight Draught (raven cloak 60s)' },
  { id: 'fernstep_philtre', result: 'fernstep_philtre',
    ingredients: [{ id: 'fern_frond', qty: 2 }, { id: 'blackthorn', qty: 1 }],
    desc: '2× Fern Frond + Blackthorn → Fernstep Philtre (swiftness 45s)' },
  { id: 'bramble_poultice', result: 'bramble_poultice',
    ingredients: [{ id: 'bramble_vine', qty: 2 }, { id: 'hex_acorn', qty: 1 }],
    desc: '2× Bramble Vine + Hex Acorn → Bramble Poultice (heals 50 HP)' },
  { id: 'witchwood_balm', result: 'witchwood_balm',
    ingredients: [{ id: 'witchwood', qty: 2 }, { id: 'hex_acorn', qty: 1 }],
    desc: '2× Witchwood + Hex Acorn → Witchwood Balm (cleanses all effects)' },
  // --- Moon water (Tier 3.5): the full-moon ritual. `requiresMoon:'full'` gates
  // the brew to a full-moon (or blood-moon) night; the handler checks the live
  // phase. Glass vials come from the apothecary; moon water then brews the
  // strongest heal in the game, the Moonwell Draught. ---
  { id: 'moon_water', result: 'moon_water', requiresMoon: 'full',
    ingredients: [{ id: 'glass_vial', qty: 1 }],
    desc: 'Glass Vial → Moon Water — only under the full moon' },
  { id: 'moonwell_draught', result: 'moonwell_draught',
    ingredients: [{ id: 'moon_water', qty: 1 }, { id: 'healing_herb', qty: 2 }],
    desc: 'Moon Water + 2× Healing Herb → Moonwell Draught (heals 120 HP)' },
  // ── Green Path (Hedge & Wild band): brews from the drop-only herbs ──
  { id: 'yarrow_salve', result: 'yarrow_salve',
    ingredients: [{ id: 'yarrow', qty: 2 }],
    desc: '2× Yarrow → Yarrow Salve (staunches wounds — heals 70 HP)' },
  { id: 'mugwort_draught', result: 'mugwort_draught',
    ingredients: [{ id: 'mugwort', qty: 2 }],
    desc: "2× Mugwort → Mugwort Dream-Draught (cross the hedge unseen — Raven's Cloak for 60s)" },
  // ── Green Path (Cottage Garden band): the hearth-and-healing remedies ──
  { id: 'comfrey_salve', result: 'comfrey_salve',
    ingredients: [{ id: 'comfrey', qty: 2 }],
    desc: '2× Comfrey → Comfrey Salve (knitbone — heals 85 HP)' },
  { id: 'lemon_balm_cordial', result: 'lemon_balm_cordial',
    ingredients: [{ id: 'lemon_balm', qty: 2 }],
    desc: '2× Lemon Balm → Lemon Balm Cordial (a calming restorative — regen for 45s)' },
  { id: 'feverfew_tincture', result: 'feverfew_tincture',
    ingredients: [{ id: 'feverfew', qty: 2 }],
    desc: '2× Feverfew → Feverfew Tincture (wards off sickness — curse immunity for 45s)' },
  { id: 'lavender_oil', result: 'lavender_oil',
    ingredients: [{ id: 'lavender', qty: 2 }],
    desc: '2× Lavender → Lavender Oil (deep calm — regen for 60s)' },
  // ── Green Path (Hedge & Wild band): warding & visionary charms ──
  { id: 'vervain_charm', result: 'vervain_charm',
    ingredients: [{ id: 'vervain', qty: 2 }],
    desc: '2× Vervain → Vervain Charm (a ward of protection — curse immunity 45s)' },
  { id: 'wormwood_bitters', result: 'wormwood_bitters',
    ingredients: [{ id: 'wormwood', qty: 2 }],
    desc: "2× Wormwood → Wormwood Bitters (the bitter sight — Raven's Cloak 60s)" },
  { id: 'rue_water', result: 'rue_water',
    ingredients: [{ id: 'rue', qty: 2 }],
    desc: '2× Rue → Rue Water (banishes ill — curse immunity 45s)' },
  { id: 'st_johns_oil', result: 'st_johns_oil',
    ingredients: [{ id: 'st_johns_wort', qty: 2 }],
    desc: "2× St. John's Wort → St. John's Oil (the sun's guard — heals 90 HP)" },
  { id: 'rowan_charm', result: 'rowan_charm',
    ingredients: [{ id: 'rowan_berry', qty: 2 }],
    desc: '2× Rowan Berry → Rowan Charm (the witch-tree ward — curse immunity 60s)' },
  // ── Green Path (Poison Path band): baneful draughts & the flying ointment ──
  // Trance / warding effects only — the folklore, never anything depicting harm.
  { id: 'flying_ointment', result: 'flying_ointment',
    ingredients: [{ id: 'belladonna', qty: 2 }],
    desc: "2× Belladonna → Flying Ointment (the witch's flight — Raven's Cloak 90s)" },
  { id: 'henbane_smoke', result: 'henbane_smoke',
    ingredients: [{ id: 'henbane', qty: 2 }],
    desc: '2× Henbane → Henbane Smoke (oracular madness — a 60s haze)' },
  { id: 'mandrake_draught', result: 'mandrake_draught',
    ingredients: [{ id: 'mandrake', qty: 2 }],
    desc: "2× Mandrake → Mandrake Draught (the screaming root's power — Giant form 45s)" },
  { id: 'wolfsbane_draught', result: 'wolfsbane_draught',
    ingredients: [{ id: 'wolfsbane', qty: 2 }],
    desc: "2× Wolfsbane → Wolfsbane Draught (the shapeshifter's herb — Wolf's Pact 60s)" },
  { id: 'datura_trance', result: 'datura_trance',
    ingredients: [{ id: 'datura', qty: 2 }],
    desc: "2× Datura → Datura Trance (the devil's trumpet — a 75s trance)" },
  { id: 'hemlock_philter', result: 'hemlock_philter',
    ingredients: [{ id: 'hemlock', qty: 2 }],
    desc: '2× Hemlock → Hemlock Philter (a stilling ward — curse immunity 60s)' },
  { id: 'foxglove_cordial', result: 'foxglove_cordial',
    ingredients: [{ id: 'foxglove', qty: 2 }],
    desc: "2× Foxglove → Foxglove Cordial (digitalis, for the heart — heals 100 HP)" },
  { id: 'hellebore_ward', result: 'hellebore_ward',
    ingredients: [{ id: 'black_hellebore', qty: 2 }],
    desc: '2× Black Hellebore → Hellebore Ward (banishes the underworld — curse immunity 75s)' },
  // The capstone: the signature draught that crowns the whole Green Path.
  { id: 'draught_of_the_green_path', result: 'draught_of_the_green_path',
    ingredients: [{ id: 'belladonna', qty: 1 }, { id: 'henbane', qty: 1 }, { id: 'mandrake', qty: 1 }],
    desc: 'Belladonna + Henbane + Mandrake → Draught of the Green Path (the green witch sees all — Raven’s Cloak 5 min)' },
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
  barrow_wight: [
    { itemId: 'shadow_essence', qty: 1, chance: 0.55 },
    { gold: true, min: 5, max: 16, chance: 0.60 },
    { itemId: 'enchanted_gem',  qty: 1, chance: 0.05 }, // rare grave-treasure
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

// ── Green Path: rare seed drops (hunting the Wilds feeds your garden) ──────────
// Low-odds Hedge & Wild herb cuttings dropped by Wilds creatures, so a found
// seed feels like a real find and chasing mobs has a reason beyond gold/XP. Only
// the overworld Wilds pools get them — never town mobs, never dungeon chests
// (dungeons already drip their own tiered loot). Each herb is drop-only
// elsewhere (NON_WILD_CONSUMABLES), so this is the one way into the garden.
const WILDS_SEED_DROPS = [
  { itemId: 'mugwort', qty: 1, chance: 0.03 },
  { itemId: 'yarrow',  qty: 1, chance: 0.03 },
];
const WILDS_SEED_DROP_MOBS = [
  'shade_stalker', 'bog_brute', 'night_howler', 'barrow_wight', 'will_o_wisp',
  'embermoth', 'thistlehog', 'duskfawn', 'mirefowl', 'bramble_boar',
  'mossback_tortoise', 'gravewing_crow', 'fen_hexer', 'rot_swarm', 'barrow_maw',
  'gloom_bat', 'old_marrowe',
];
// Tier 2 — the Hedge & Wild herbs. Rarer, and only from the tougher night-hunt
// Wilds creatures and the lower dungeon floors, so the harder you hunt, the
// rarer the cuttings you turn up.
const HEDGE_SEED_DROPS = [
  { itemId: 'vervain', qty: 1, chance: 0.012 },
  { itemId: 'wormwood', qty: 1, chance: 0.012 },
  { itemId: 'rue', qty: 1, chance: 0.012 },
  { itemId: 'st_johns_wort', qty: 1, chance: 0.012 },
  { itemId: 'rowan_berry', qty: 1, chance: 0.012 },
];
const HEDGE_SEED_DROP_MOBS = ['fen_hexer', 'rot_swarm', 'barrow_maw', 'gloom_bat', 'dungeon_t1', 'dungeon_t2'];
// Tier 3 — the baneful Poison Path herbs. The rarest, from elites and the deep
// dungeon floors only: the dark art is earned in the dark places.
const BANE_SEED_DROPS = [
  { itemId: 'belladonna', qty: 1, chance: 0.006 },
  { itemId: 'henbane', qty: 1, chance: 0.006 },
  { itemId: 'mandrake', qty: 1, chance: 0.006 },
  { itemId: 'wolfsbane', qty: 1, chance: 0.006 },
  { itemId: 'datura', qty: 1, chance: 0.006 },
  { itemId: 'hemlock', qty: 1, chance: 0.006 },
  { itemId: 'foxglove', qty: 1, chance: 0.006 },
  { itemId: 'black_hellebore', qty: 1, chance: 0.006 },
];
const BANE_SEED_DROP_MOBS = ['old_marrowe', 'dungeon_t3', 'dungeon_t4'];
for (const _m of WILDS_SEED_DROP_MOBS) {
  if (Array.isArray(LOOT_TABLES[_m])) LOOT_TABLES[_m].push(...WILDS_SEED_DROPS.map((d) => ({ ...d })));
}
for (const _m of HEDGE_SEED_DROP_MOBS) {
  if (Array.isArray(LOOT_TABLES[_m])) LOOT_TABLES[_m].push(...HEDGE_SEED_DROPS.map((d) => ({ ...d })));
}
for (const _m of BANE_SEED_DROP_MOBS) {
  if (Array.isArray(LOOT_TABLES[_m])) LOOT_TABLES[_m].push(...BANE_SEED_DROPS.map((d) => ({ ...d })));
}

const STARTER_GEAR = {
  0: { weapon: 'spell_tome',  head: 'wizard_hat',    chest: 'witch_robe',    feet: 'hexed_boots',    ring: 'hex_amulet'   },
  1: { weapon: 'iron_sword',  head: 'beast_crown',   chest: 'beast_hide',    feet: 'paw_boots',      ring: 'silver_ring'  },
  2: { weapon: 'spell_tome',  head: 'spirit_veil',   chest: 'spirit_robe',   feet: 'leather_boots',  ring: 'spirit_ring'  },
  3: { weapon: 'iron_sword',  head: 'knights_helm',  chest: 'steel_shield',  feet: 'leather_boots',  ring: 'order_signet' },
  4: { weapon: 'iron_sword',  head: 'travelers_hood',chest: 'travelers_vest',feet: 'leather_boots',  ring: 'trail_ring'   },
  5: { weapon: 'spell_tome',  head: 'wizard_hat',    chest: 'bone_armor',    feet: 'hexed_boots',    ring: 'hex_amulet'   }
};

const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000,
                        8200, 11000, 14500, 19000, 25000, 32500, 42000, 54000, 69000, 87000];

// Keyed emotes (client renders each as a custom carved-talisman icon). Legacy
// glyphs kept accepted so an older client / in-flight emote still validates.
const EMOTE_SET = [
  'wave', 'laugh', 'heart', 'wow', 'cry', 'angry', 'thumb', 'dance',
  '👋', '😂', '❤️', '😮', '😢', '😡', '👍', '💃',
];

module.exports = { MS_PACKS, COLORS, POTION_RECIPES, LOOT_TABLES, STARTER_GEAR, XP_THRESHOLDS, EMOTE_SET, WILDS_SEED_DROPS, WILDS_SEED_DROP_MOBS, HEDGE_SEED_DROPS, HEDGE_SEED_DROP_MOBS, BANE_SEED_DROPS, BANE_SEED_DROP_MOBS };
