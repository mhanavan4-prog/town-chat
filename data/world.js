// World geometry (town + wilds + plant catalog). Extracted verbatim from
// server.js (Tier 3.4 Phase A). Pure data. WORLD2.natureDecor and
// PLANT_KEYS / PLANT_POSITIONS are computed in server.js and stay there.

const WORLD = {
  width: 3200,
  height: 2200,
  spawn: { x: 1600, y: 1100 },
  // Widened from the original 64 — a narrow gap on a map this size made
  // walking back in after leaving feel needlessly fiddly (see also the
  // camera-orbit reset in client.js enterBuilding()/exitBuilding()).
  doorWidth: 100,
  wallThickness: 14,
  // "door" picks which wall the entrance/exit gap is cut into ('south' if
  // omitted). Every building's door faces whichever wall points back toward
  // the spawn hub at (1600, 1100), so walking out always faces the town square.
  buildings: [
    { id: 'cafe',    name: '☕ The Cafe',          x: 300,  y: 375,  w: 500, h: 340, color: '#d98a4f', door: 'east' },
    { id: 'library', name: '📚 The Library',       x: 2330, y: 375,  w: 400, h: 260, color: '#6f8fae', door: 'west' },
    { id: 'arcade',  name: '🎮 Starlight Arcade',  x: 295,  y: 1530, w: 400, h: 270, color: '#9b5fc0', door: 'east' },
    { id: 'lounge',  name: '👻 The Phantom Parlor', x: 2335, y: 1530, w: 400, h: 270, color: '#5a8a72', door: 'west' },
    { id: 'hall',    name: '🏛️ Town Hall',        x: 1360, y: 110,  w: 480, h: 290, color: '#8a9a5b', door: 'south' },
    // South of spawn, centered like Town Hall is to the north — spawn is
    // north of this one, so its door faces north (a code path that exists
    // but, until now, no other building actually used).
    { id: 'bank',    name: '🏦 The Bank',          x: 1380, y: 1810, w: 440, h: 280, color: '#c9a227', door: 'north' }
  ]
};
// Nature decor — trees/shrubs/rocks/flowers scattered around the outdoor
// map. Used to live purely client-side as static decoration; now lives
// here instead (with stable ids) so harvesting can be server-authoritative
// and every client agrees on which ones are currently picked clean. Only
// tree/shrub/flower types are harvestable — rocks are still just scenery.
// Positions/scales copied over unchanged from the old client.js constant.
// Tree scales are ~3x their original values — makeTree()'s whole geometry
// (trunk + foliage cones, and the collision radius derived from the same
// scale in addNatureDecor) grows uniformly with it, so at this scale a town
// tree stands several times taller than a player character instead of just
// slightly taller. Shrub/rock/flower scales are untouched.
WORLD.natureDecor = [
  { id: 'decor_0',  type: 'tree',   x: 80,   y: 935,  scale: 3.3 },  { id: 'decor_1',  type: 'tree',   x: 145,  y: 1175, scale: 2.7 },
  { id: 'decor_2',  type: 'tree',   x: 65,   y: 1360, scale: 3.0 },  { id: 'decor_3',  type: 'shrub',  x: 175,  y: 1015, scale: 1.0 },
  { id: 'decor_4',  type: 'shrub',  x: 120,  y: 1280, scale: 0.8 },  { id: 'decor_5',  type: 'tree',   x: 935,  y: 80,   scale: 3.0 },
  { id: 'decor_6',  type: 'tree',   x: 1160, y: 55,   scale: 2.55 }, { id: 'decor_7',  type: 'shrub',  x: 1040, y: 120,  scale: 1.0 },
  { id: 'decor_8',  type: 'tree',   x: 3065, y: 935,  scale: 3.0 },  { id: 'decor_9',  type: 'tree',   x: 3135, y: 1175, scale: 2.7 },
  { id: 'decor_10', type: 'tree',   x: 3080, y: 1360, scale: 3.15 }, { id: 'decor_11', type: 'shrub',  x: 2985, y: 1025, scale: 0.9 },
  { id: 'decor_12', type: 'shrub',  x: 3040, y: 1265, scale: 1.0 },  { id: 'decor_13', type: 'tree',   x: 935,  y: 2135, scale: 3.0 },
  { id: 'decor_14', type: 'tree',   x: 1200, y: 2160, scale: 2.85 }, { id: 'decor_15', type: 'tree',   x: 2000, y: 2145, scale: 3.0 },
  { id: 'decor_16', type: 'tree',   x: 2265, y: 2120, scale: 2.7 },  { id: 'decor_17', type: 'shrub',  x: 1065, y: 2095, scale: 1.0 },
  { id: 'decor_18', type: 'shrub',  x: 2135, y: 2080, scale: 0.85 }, { id: 'decor_19', type: 'tree',   x: 1975, y: 80,   scale: 2.7 },
  { id: 'decor_20', type: 'tree',   x: 2160, y: 105,  scale: 3.0 },  { id: 'decor_21', type: 'shrub',  x: 2065, y: 55,   scale: 0.9 },
  { id: 'decor_22', type: 'tree',   x: 105,  y: 335,  scale: 2.85 }, { id: 'decor_23', type: 'tree',   x: 3105, y: 335,  scale: 2.85 },
  { id: 'decor_24', type: 'shrub',  x: 80,   y: 1865, scale: 1.0 },  { id: 'decor_25', type: 'shrub',  x: 3120, y: 1865, scale: 1.0 },
  // (decor_27/30/31 removed — they sat in the temple, bank, and cafe
  // walking lanes; the meadow rocks well off the paths remain.)
  { id: 'decor_26', type: 'rock',   x: 500,  y: 1100, scale: 1.0 },
  { id: 'decor_28', type: 'rock',   x: 2100, y: 1700, scale: 1.1 },  { id: 'decor_29', type: 'rock',   x: 2700, y: 1100, scale: 0.9 },
  { id: 'decor_32', type: 'flower', x: 950,  y: 1200, scale: 1.0 },  { id: 'decor_33', type: 'flower', x: 1700, y: 750,  scale: 1.0 },
  { id: 'decor_34', type: 'flower', x: 2450, y: 1300, scale: 1.0 },  { id: 'decor_35', type: 'flower', x: 1300, y: 900,  scale: 0.9 },
  { id: 'decor_36', type: 'flower', x: 2000, y: 1500, scale: 1.0 },  { id: 'decor_37', type: 'flower', x: 600,  y: 1400, scale: 0.95 },
  // —— Scenery expansion (decor_38+): the town square used to feel like an
  // empty field between buildings. Lampposts line every lane (lit at night
  // by the client, same clock as the moon), a well + market stalls + benches
  // dress the plaza ring, a fenced flower garden and hay/crate/barrel work
  // clusters fill the meadows, and more trees/shrubs/rocks/flowers thicken
  // the edges and corners. Every placement machine-validated clear of
  // buildings, walking lanes, doors, the spawn plaza, torches, portals, the
  // temple platform, NPCs, and mob/animal spawns — see test/gen-scenery.cjs
  // (the generator+validator that emitted this list; rerun it after ANY
  // town-layout change). New non-nature types (bench/lamppost/well/stall/…)
  // are pure scenery: not in HARVEST_TYPES, so they refuse harvesting, and
  // older clients that don't know a type simply skip it.
// (7 lampposts removed from the spawn plaza ring — the 4 ritual torches
  // light it; only the far lane posts below remain.)
  { id: 'decor_38', type: 'lamppost', x: 1021, y: 739 },
  { id: 'decor_40', type: 'lamppost', x: 2132, y: 710 },
  { id: 'decor_42', type: 'lamppost', x: 985, y: 1524 },
  { id: 'decor_44', type: 'lamppost', x: 2094, y: 1522 },
  // decor_46/57/58 used to sit stacked in one ~110-unit patch right behind
  // the Wilds portal (1600,700) — spread out: the lamp lights the lane's
  // east side, the noticeboard stands by Town Hall's door, and the bench
  // keeps the flower patch at (1700,750) company. All ≥200 from the portal.
  { id: 'decor_46', type: 'lamppost', x: 1720, y: 540 },
  { id: 'decor_48', type: 'lamppost', x: 1566, y: 1597 },
  { id: 'decor_51', type: 'well', x: 1502, y: 928 },
  { id: 'decor_52', type: 'stall', x: 1745, y: 850, rot: 1.5708, variant: 0 },
  { id: 'decor_53', type: 'stall', x: 1745, y: 1350, rot: 1.5708, variant: 1 },
  { id: 'decor_54', type: 'bench', x: 1470, y: 872, rot: 0.6 },
  { id: 'decor_55', type: 'bench', x: 1500, y: 1345, rot: -0.6 },
  { id: 'decor_56', type: 'bench', x: 1900, y: 1105, rot: 1.571 },
  { id: 'decor_57', type: 'noticeboard', x: 1480, y: 430, rot: 0 },
  { id: 'decor_58', type: 'bench', x: 1795, y: 760, rot: -0.5 },
  { id: 'decor_59', type: 'tree', x: 365, y: 914, scale: 2.6 },
  { id: 'decor_60', type: 'tree', x: 568, y: 1074, scale: 3 },
  { id: 'decor_61', type: 'tree', x: 424, y: 1353, scale: 2.8 },
  { id: 'decor_62', type: 'tree', x: 796, y: 1369, scale: 2.5 },
  { id: 'decor_63', type: 'stump', x: 656, y: 903 },
  { id: 'decor_64', type: 'stump', x: 888, y: 1335 },
  { id: 'decor_65', type: 'log', x: 700, y: 1310, rot: 0.5 },
  { id: 'decor_66', type: 'shrub', x: 304, y: 1020, scale: 1 },
  { id: 'decor_67', type: 'shrub', x: 736, y: 995, scale: 1 },
  { id: 'decor_68', type: 'shrub', x: 913, y: 1237, scale: 1 },
  { id: 'decor_69', type: 'rock', x: 855, y: 875, scale: 0.9 },
  { id: 'decor_70', type: 'flower', x: 531, y: 1213, scale: 1 },
  { id: 'decor_71', type: 'flower', x: 981, y: 927, scale: 1 },
  { id: 'decor_72', type: 'haybale', x: 620, y: 1265, rot: 0 },
  { id: 'decor_73', type: 'haybale', x: 630, y: 1330, rot: 0.9 },
  { id: 'decor_74', type: 'fence', x: 705, y: 1120, rot: 0 },
  { id: 'decor_75', type: 'fence', x: 775, y: 1120, rot: 0 },
  { id: 'decor_76', type: 'fence', x: 705, y: 1220, rot: 0 },
  { id: 'decor_77', type: 'fence', x: 775, y: 1220, rot: 0 },
  { id: 'decor_78', type: 'fence', x: 675, y: 1150, rot: 1.571 },
  { id: 'decor_79', type: 'fence', x: 675, y: 1190, rot: 1.571 },
  { id: 'decor_80', type: 'fence', x: 805, y: 1150, rot: 1.571 },
  { id: 'decor_81', type: 'fence', x: 805, y: 1190, rot: 1.571 },
  { id: 'decor_82', type: 'flower', x: 720, y: 1170, scale: 1.1 },
  { id: 'decor_83', type: 'flower', x: 762, y: 1170, scale: 1.1 },
  { id: 'decor_84', type: 'tree', x: 2280, y: 872, scale: 2.7 },
  { id: 'decor_85', type: 'tree', x: 2640, y: 942, scale: 3 },
  { id: 'decor_86', type: 'tree', x: 2879, y: 1239, scale: 2.6 },
  { id: 'decor_87', type: 'tree', x: 2438, y: 1411, scale: 2.4 },
  { id: 'decor_88', type: 'shrub', x: 2192, y: 991, scale: 1 },
  { id: 'decor_89', type: 'shrub', x: 2746, y: 1050, scale: 1 },
  { id: 'decor_90', type: 'shrub', x: 2550, y: 1186, scale: 1 },
  { id: 'decor_91', type: 'rock', x: 2340, y: 1180, scale: 0.9 },
  { id: 'decor_92', type: 'rock', x: 2940, y: 1000, scale: 1.1 },
  { id: 'decor_93', type: 'flower', x: 2234, y: 1318, scale: 1 },
  { id: 'decor_94', type: 'flower', x: 2830, y: 871, scale: 1 },
  { id: 'decor_95', type: 'crate', x: 2150, y: 1275, rot: 0 },
  { id: 'decor_96', type: 'crate', x: 2178, y: 1300, rot: 0.5 },
  { id: 'decor_97', type: 'barrel', x: 2205, y: 1270 },
  { id: 'decor_98', type: 'tree', x: 966, y: 229, scale: 2.5 },
  { id: 'decor_99', type: 'tree', x: 1181, y: 294, scale: 2.3 },
  { id: 'decor_100', type: 'shrub', x: 1080, y: 175, scale: 1 },
  { id: 'decor_101', type: 'tree', x: 1997, y: 244, scale: 2.4 },
  { id: 'decor_102', type: 'tree', x: 2202, y: 282, scale: 2.6 },
  { id: 'decor_103', type: 'shrub', x: 2105, y: 180, scale: 0.9 },
  { id: 'decor_104', type: 'flower', x: 930, y: 330, scale: 0.9 },
  { id: 'decor_105', type: 'flower', x: 2280, y: 200, scale: 0.9 },
  { id: 'decor_106', type: 'tree', x: 798, y: 1951, scale: 2.6 },
  { id: 'decor_107', type: 'tree', x: 822, y: 2104, scale: 2.4 },
  { id: 'decor_108', type: 'shrub', x: 745, y: 1840, scale: 1 },
  { id: 'decor_109', type: 'haybale', x: 1275, y: 2105, rot: 0.4 },
  { id: 'decor_110', type: 'tree', x: 1984, y: 1921, scale: 2.7 },
  { id: 'decor_111', type: 'tree', x: 2240, y: 2008, scale: 2.4 },
  { id: 'decor_112', type: 'crate', x: 2090, y: 1935, rot: 0.3 },
  { id: 'decor_113', type: 'crate', x: 2118, y: 1962, rot: 1.3 },
  { id: 'decor_114', type: 'barrel', x: 2060, y: 1975 },
  { id: 'decor_115', type: 'shrub', x: 1900, y: 2080, scale: 1 },
  { id: 'decor_116', type: 'flower', x: 2250, y: 1880, scale: 1 },
  { id: 'decor_117', type: 'tree', x: 210, y: 200, scale: 2.8 },
  { id: 'decor_118', type: 'tree', x: 420, y: 145, scale: 2.5 },
  { id: 'decor_119', type: 'rock', x: 330, y: 300, scale: 1.1 },
  { id: 'decor_120', type: 'tree', x: 2870, y: 175, scale: 2.7 },
  { id: 'decor_121', type: 'tree', x: 3010, y: 300, scale: 2.4 },
  { id: 'decor_122', type: 'shrub', x: 2930, y: 240, scale: 1 },
  { id: 'decor_123', type: 'tree', x: 240, y: 1965, scale: 2.7 },
  { id: 'decor_124', type: 'tree', x: 420, y: 2080, scale: 2.5 },
  { id: 'decor_125', type: 'log', x: 330, y: 1900, rot: 2.2 },
  { id: 'decor_126', type: 'tree', x: 2900, y: 1960, scale: 2.8 },
  { id: 'decor_127', type: 'tree', x: 3060, y: 2075, scale: 2.5 },
  { id: 'decor_128', type: 'rock', x: 2985, y: 1900, scale: 1 },
  { id: 'decor_129', type: 'barrel', x: 830, y: 420 },
  { id: 'decor_130', type: 'crate', x: 858, y: 445, rot: 0.4 },
  { id: 'decor_131', type: 'barrel', x: 2300, y: 660 },
  { id: 'decor_132', type: 'haybale', x: 760, y: 1470, rot: 1.2 },
  { id: 'decor_133', type: 'crate', x: 2305, y: 1500, rot: 0.2 },
  { id: 'decor_134', type: 'bench', x: 1652, y: 1560, rot: 0 }
];

const WORLD2 = {
  id: 'wilds',
  width: 10000,
  height: 10000,
  // Both ends of the portal: where you land stepping into the Wilds, and
  // the spot in town the portal occupies (used for the kiosk's position and
  // for nudging a returning player just outside it, same idea as
  // getDoorWorldPos for buildings).
  spawn: { x: 5000, y: 8800 },
  portalInTown: { x: 1600, y: 700 },
  buildings: []
};

const PLANT_CATALOG = {
  swift_root:           { name: 'Swift Root',           icon: '🥕', effect: 'status',  statusType: 'speedboost', durationMs: 12000 },
  featherleaf:           { name: 'Featherleaf',           icon: '🍃', effect: 'status',  statusType: 'feather',    durationMs: 20000 },
  giants_cap:             { name: "Giant's Cap",            icon: '🍄', effect: 'status',  statusType: 'giant',      durationMs: 15000 },
  shrinking_violet:       { name: 'Shrinking Violet',       icon: '🌷', effect: 'status',  statusType: 'shrink',     durationMs: 20000 },
  pumpkin_blossom:        { name: 'Pumpkin Blossom',        icon: '🎃', effect: 'status',  statusType: 'pumpkin',    durationMs: 30000 },
  bats_breath:            { name: "Bat's Breath Flower",    icon: '🦇', effect: 'status',  statusType: 'bats',       durationMs: 15000 },
  rainbow_petal:          { name: 'Rainbow Petal',          icon: '🌈', effect: 'status',  statusType: 'colorcycle', durationMs: 20000 },
  ravens_feather_plant:   { name: "Raven's Feather Plant",  icon: '🪶', effect: 'status',  statusType: 'ravencloak', durationMs: 30000 },
  stumbleweed:            { name: 'Stumbleweed',            icon: '🌾', effect: 'status',  statusType: 'stumble',    durationMs: 15000 },
  gibberish_root:         { name: 'Gibberish Root',         icon: '🫚', effect: 'status',  statusType: 'gibberish',  durationMs: 20000 },
  toadstool:              { name: 'Toadstool',              icon: '🐸', effect: 'status',  statusType: 'toad',       durationMs: 20000 },
  wolfsbane_bloom:        { name: 'Wolfsbane Bloom',        icon: '🌺', effect: 'status',  statusType: 'wolfmark',   durationMs: 30000 },
  meditation_lotus:       { name: 'Meditation Lotus',       icon: '🪷', effect: 'status',  statusType: 'meditate',   durationMs: 60000 },
  healing_herb:           { name: 'Healing Herb',           icon: '🌿', effect: 'heal',    amount: 40 },
  regen_root:             { name: 'Regen Root',             icon: '🫘', effect: 'status',  statusType: 'regen',      durationMs: 15000 },
  cleansing_clover:       { name: 'Cleansing Clover',       icon: '🍀', effect: 'cleanse' },
  // --- Witch-brewed potions (same use_item flow, enhanced durations) ---
  health_potion_ii:       { name: 'Greater Healing Potion', icon: '❤️‍🔥', effect: 'heal',   amount: 80 },
  regen_brew:             { name: 'Regen Brew',             icon: '🫧',  effect: 'status', statusType: 'regen',      durationMs: 45000 },
  swift_brew:             { name: 'Swift Brew',             icon: '💨',  effect: 'status', statusType: 'speedboost', durationMs: 45000 },
  shadow_draught:         { name: 'Shadow Draught',         icon: '🌘',  effect: 'status', statusType: 'ravencloak', durationMs: 60000 },
  giants_elixir:          { name: "Giant's Elixir",         icon: '🍄‍🟫', effect: 'status', statusType: 'giant',      durationMs: 45000 },
  bat_swarm_potion:       { name: 'Bat Swarm Potion',       icon: '🫙',  effect: 'status', statusType: 'bats',       durationMs: 45000 },
  clarity_draught:        { name: 'Clarity Draught',        icon: '✨',  effect: 'cleanse' },
  chaos_brew:             { name: 'Chaos Brew',             icon: '🌪️',  effect: 'status', statusType: 'colorcycle', durationMs: 60000 },
  wolf_pact_brew:         { name: "Wolf's Pact Brew",       icon: '🐺',  effect: 'status', statusType: 'wolfpact',   durationMs: 3600000 },
  // --- Wilds-flora brews (crafted at Witch Hazel's cauldron; reuse existing effects) ---
  barkbind_salve:         { name: 'Barkbind Salve',         icon: '🩹',  effect: 'status', statusType: 'regen',      durationMs: 45000 },
  capwood_elixir:         { name: 'Capwood Elixir',         icon: '🍄‍🟫', effect: 'status', statusType: 'giant',      durationMs: 45000 },
  nightsight_draught:     { name: 'Nightsight Draught',     icon: '🌘',  effect: 'status', statusType: 'ravencloak', durationMs: 60000 },
  fernstep_philtre:       { name: 'Fernstep Philtre',       icon: '🌀',  effect: 'status', statusType: 'speedboost', durationMs: 45000 },
  bramble_poultice:       { name: 'Bramble Poultice',       icon: '💚',  effect: 'heal',   amount: 50 },
  witchwood_balm:         { name: 'Witchwood Balm',         icon: '✨',  effect: 'cleanse' },
};

module.exports = { WORLD, WORLD2, PLANT_CATALOG };
