// Dungeon catalogs & spawn geometry (Session L). Extracted verbatim from
// server.js (Tier 3.4 Phase A). Pure data — the dungeonMobs build loop
// stays in server.js and reads DUNGEON_MOB_KEYS_BY_TIER from here.

const DUNGEON_LORE = {
  1: {
    name: 'The Rootcellar', epithet: 'beneath the oldest house in Thornreach',
    bossKey: 'boss_rat_king',
    plaque: '“Every town buries something. Thornreach dug a cellar for it. The roots grew down from above and the rats grew up from below, and in the dark where they meet, Old Gnawbone wears a crown of tarnished spoons. Feed him your courage — or your bones.”'
  },
  2: {
    name: 'The Weeping Crypts', epithet: 'where the old covens laid their debts',
    bossKey: 'boss_crypt_weaver',
    plaque: '“The stones down here sweat a cold water the gravediggers called crypt-tears. Widow Silk spins beneath the drowned chapel, and her web is strung with wedding rings. Mind the strands. She knows the weight of every visitor by heart.”'
  },
  3: {
    name: 'The Howling Forge', epithet: 'the mountain’s furnace that never went out',
    bossKey: 'boss_forge_tyrant',
    plaque: '“Dwarrow-work or giant-work, the masons still argue — the Forge doesn’t care. It breathes through the floor grates and it remembers being a volcano. Cindermaw stokes the heart-coal with a shovel beaten from dead men’s shields. Bring water. Bring friends.”'
  },
  4: {
    name: 'The Starless Deep', epithet: 'the dark below the dark',
    bossKey: 'boss_pale_sovereign',
    plaque: '“Lanterns gutter here not from wind but from doubt. This is the sea-floor of the night sky, where fallen constellations settle like silt. The Pale Sovereign holds court over everything the stars forgot — and it is always listening for new names.”'
  }
};

const DUNGEON_MOB_TYPES = {
  // Tier 1 — levels 1-5
  cave_rat:         { name: 'Cave Rat',         tier: 1, xp: 8,  color: 0x6b4c2a, scale: 0.55, maxHealth: 20,  speed: 70,  aggroRadius: 150, strikeRange: 45, dmgMin: 3,  dmgMax: 6,  hitCooldownMs: 1400 },
  stone_bat:        { name: 'Stone Bat',         tier: 1, xp: 8,  color: 0x5a5a6e, scale: 0.6,  maxHealth: 18,  speed: 85,  aggroRadius: 180, strikeRange: 40, dmgMin: 2,  dmgMax: 5,  hitCooldownMs: 1200 },
  moss_crawler:     { name: 'Moss Crawler',      tier: 1, xp: 8,  color: 0x3d5c2a, scale: 0.75, maxHealth: 35,  speed: 35,  aggroRadius: 100, strikeRange: 50, dmgMin: 4,  dmgMax: 7,  hitCooldownMs: 1800 },
  fungal_grunt:     { name: 'Fungal Grunt',      tier: 1, xp: 8,  color: 0x7a5f3a, scale: 1.0,  maxHealth: 45,  speed: 30,  aggroRadius: 120, strikeRange: 55, dmgMin: 5,  dmgMax: 8,  hitCooldownMs: 2000 },
  mud_slinger:      { name: 'Mud Slinger',       tier: 1, xp: 8,  color: 0x5a4a2e, scale: 0.85, maxHealth: 30,  speed: 45,  aggroRadius: 140, strikeRange: 48, dmgMin: 4,  dmgMax: 7,  hitCooldownMs: 1600 },
  tunnel_rat:       { name: 'Tunnel Rat',        tier: 1, xp: 8,  color: 0x7a5a3a, scale: 0.65, maxHealth: 25,  speed: 75,  aggroRadius: 160, strikeRange: 42, dmgMin: 3,  dmgMax: 6,  hitCooldownMs: 1300 },
  rock_beetle:      { name: 'Rock Beetle',       tier: 1, xp: 8,  color: 0x4a4a4a, scale: 0.9,  maxHealth: 50,  speed: 22,  aggroRadius: 90,  strikeRange: 52, dmgMin: 6,  dmgMax: 9,  hitCooldownMs: 2200 },
  pale_sprite:      { name: 'Pale Sprite',       tier: 1, xp: 8,  color: 0xd4c8ff, scale: 0.5,  maxHealth: 15,  speed: 90,  aggroRadius: 170, strikeRange: 38, dmgMin: 2,  dmgMax: 4,  hitCooldownMs: 1100 },
  // Tier 2 — levels 6-10
  shadow_wolf:      { name: 'Shadow Wolf',       tier: 2, xp: 18, color: 0x2a2a3a, scale: 1.05, maxHealth: 65,  speed: 80,  aggroRadius: 200, strikeRange: 52, dmgMin: 10, dmgMax: 15, hitCooldownMs: 1500 },
  dark_adder:       { name: 'Dark Adder',        tier: 2, xp: 18, color: 0x1e2b1e, scale: 0.75, maxHealth: 55,  speed: 65,  aggroRadius: 160, strikeRange: 45, dmgMin: 8,  dmgMax: 14, hitCooldownMs: 1400 },
  crypt_spider:     { name: 'Crypt Spider',      tier: 2, xp: 18, color: 0x3a1a3a, scale: 0.85, maxHealth: 60,  speed: 90,  aggroRadius: 175, strikeRange: 44, dmgMin: 9,  dmgMax: 13, hitCooldownMs: 1300 },
  bone_hound:       { name: 'Bone Hound',        tier: 2, xp: 18, color: 0xd8d0b8, scale: 1.0,  maxHealth: 80,  speed: 55,  aggroRadius: 180, strikeRange: 50, dmgMin: 12, dmgMax: 16, hitCooldownMs: 1700 },
  venom_crawler:    { name: 'Venom Crawler',     tier: 2, xp: 18, color: 0x2a4a1a, scale: 0.9,  maxHealth: 70,  speed: 40,  aggroRadius: 130, strikeRange: 54, dmgMin: 14, dmgMax: 18, hitCooldownMs: 2000 },
  swamp_lurker:     { name: 'Swamp Lurker',      tier: 2, xp: 18, color: 0x2e4a2a, scale: 1.15, maxHealth: 90,  speed: 28,  aggroRadius: 110, strikeRange: 58, dmgMin: 13, dmgMax: 17, hitCooldownMs: 2200 },
  cave_troll:       { name: 'Cave Troll',        tier: 2, xp: 18, color: 0x4a5a3a, scale: 1.4,  maxHealth: 120, speed: 18,  aggroRadius: 100, strikeRange: 62, dmgMin: 16, dmgMax: 20, hitCooldownMs: 2500 },
  marsh_specter:    { name: 'Marsh Specter',     tier: 2, xp: 18, color: 0x6aafcc, scale: 0.7,  maxHealth: 45,  speed: 100, aggroRadius: 190, strikeRange: 42, dmgMin: 11, dmgMax: 15, hitCooldownMs: 1200 },
  // Tier 3 — levels 11-15
  blood_bat:        { name: 'Blood Bat',         tier: 3, xp: 35, color: 0x8a0020, scale: 0.8,  maxHealth: 130, speed: 105, aggroRadius: 220, strikeRange: 44, dmgMin: 18, dmgMax: 24, hitCooldownMs: 1300 },
  iron_golem:       { name: 'Iron Golem',        tier: 3, xp: 35, color: 0x5a6070, scale: 1.7,  maxHealth: 220, speed: 12,  aggroRadius: 90,  strikeRange: 70, dmgMin: 25, dmgMax: 32, hitCooldownMs: 2800 },
  feral_warden:     { name: 'Feral Warden',      tier: 3, xp: 35, color: 0x6a2020, scale: 1.1,  maxHealth: 160, speed: 60,  aggroRadius: 195, strikeRange: 54, dmgMin: 20, dmgMax: 27, hitCooldownMs: 1800 },
  chaos_imp:        { name: 'Chaos Imp',         tier: 3, xp: 35, color: 0xcc4400, scale: 0.65, maxHealth: 100, speed: 120, aggroRadius: 200, strikeRange: 40, dmgMin: 18, dmgMax: 26, hitCooldownMs: 1200 },
  plague_hound:     { name: 'Plague Hound',      tier: 3, xp: 35, color: 0x4a5a1a, scale: 1.05, maxHealth: 145, speed: 80,  aggroRadius: 210, strikeRange: 50, dmgMin: 22, dmgMax: 28, hitCooldownMs: 1600 },
  void_walker:      { name: 'Void Walker',       tier: 3, xp: 35, color: 0x1a0a2a, scale: 0.75, maxHealth: 90,  speed: 95,  aggroRadius: 230, strikeRange: 42, dmgMin: 22, dmgMax: 30, hitCooldownMs: 1300 },
  stone_giant:      { name: 'Stone Giant',       tier: 3, xp: 35, color: 0x6a6a5a, scale: 1.8,  maxHealth: 210, speed: 10,  aggroRadius: 85,  strikeRange: 72, dmgMin: 28, dmgMax: 36, hitCooldownMs: 3000 },
  dusk_wraith:      { name: 'Dusk Wraith',       tier: 3, xp: 35, color: 0x4a2060, scale: 0.9,  maxHealth: 120, speed: 85,  aggroRadius: 240, strikeRange: 46, dmgMin: 24, dmgMax: 31, hitCooldownMs: 1400 },
  // Tier 4 — levels 16-20
  nightmare_beast:  { name: 'Nightmare Beast',   tier: 4, xp: 65, color: 0x1a0022, scale: 1.3,  maxHealth: 280, speed: 100, aggroRadius: 250, strikeRange: 56, dmgMin: 32, dmgMax: 42, hitCooldownMs: 1400 },
  shadow_titan:     { name: 'Shadow Titan',      tier: 4, xp: 65, color: 0x0a0010, scale: 1.9,  maxHealth: 400, speed: 14,  aggroRadius: 100, strikeRange: 72, dmgMin: 40, dmgMax: 52, hitCooldownMs: 2600 },
  void_serpent:     { name: 'Void Serpent',      tier: 4, xp: 65, color: 0x220033, scale: 0.85, maxHealth: 240, speed: 90,  aggroRadius: 230, strikeRange: 50, dmgMin: 34, dmgMax: 44, hitCooldownMs: 1500 },
  abyssal_hound:    { name: 'Abyssal Hound',     tier: 4, xp: 65, color: 0x1a0030, scale: 1.15, maxHealth: 300, speed: 95,  aggroRadius: 260, strikeRange: 54, dmgMin: 36, dmgMax: 46, hitCooldownMs: 1500 },
  infernal_brute:   { name: 'Infernal Brute',    tier: 4, xp: 65, color: 0x8a1a00, scale: 1.6,  maxHealth: 360, speed: 20,  aggroRadius: 110, strikeRange: 68, dmgMin: 42, dmgMax: 54, hitCooldownMs: 2800 },
  death_knight:     { name: 'Death Knight',      tier: 4, xp: 65, color: 0x1a1a2a, scale: 1.2,  maxHealth: 320, speed: 55,  aggroRadius: 220, strikeRange: 58, dmgMin: 38, dmgMax: 48, hitCooldownMs: 1800 },
  chaos_dragon:     { name: 'Chaos Dragon',      tier: 4, xp: 65, color: 0x660000, scale: 1.5,  maxHealth: 350, speed: 80,  aggroRadius: 270, strikeRange: 60, dmgMin: 44, dmgMax: 56, hitCooldownMs: 1500 },
  void_leviathan:   { name: 'Void Leviathan',    tier: 4, xp: 65, color: 0x000022, scale: 2.0,  maxHealth: 450, speed: 10,  aggroRadius: 95,  strikeRange: 80, dmgMin: 50, dmgMax: 65, hitCooldownMs: 3200 },
  // ── Signature bosses (Session L) — one per named dungeon. NOT in
  // DUNGEON_MOB_KEYS_BY_TIER (the 2-instance spawn loop skips them); they
  // spawn once each below, respawn slowly, scale with the party in the room
  // (see bossEngagedScale), double-roll their own tier's loot table, and
  // share kill XP with everyone present — the party-boss loop the top-10
  // review said the dungeons were missing.
  boss_rat_king:       { name: 'Old Gnawbone, the Rat King',   tier: 1, xp: 45,  boss: true, color: 0x8a6a3a, scale: 1.5,  maxHealth: 170,  speed: 62, aggroRadius: 215, strikeRange: 55, dmgMin: 6,  dmgMax: 10, hitCooldownMs: 1500 },
  boss_crypt_weaver:   { name: 'Widow Silk, the Crypt Weaver', tier: 2, xp: 100, boss: true, color: 0x5a2a5a, scale: 1.65, maxHealth: 400,  speed: 72, aggroRadius: 235, strikeRange: 58, dmgMin: 14, dmgMax: 20, hitCooldownMs: 1600 },
  boss_forge_tyrant:   { name: 'Cindermaw, the Forge-Tyrant',  tier: 3, xp: 200, boss: true, color: 0xb84a10, scale: 1.95, maxHealth: 720,  speed: 46, aggroRadius: 245, strikeRange: 66, dmgMin: 26, dmgMax: 34, hitCooldownMs: 1900 },
  boss_pale_sovereign: { name: 'The Pale Sovereign',           tier: 4, xp: 400, boss: true, color: 0xd8d8ea, scale: 2.1,  maxHealth: 1350, speed: 66, aggroRadius: 260, strikeRange: 64, dmgMin: 40, dmgMax: 52, hitCooldownMs: 1700 }
};

const DUNGEON_MOB_KEYS_BY_TIER = {
  1: ['cave_rat','stone_bat','moss_crawler','fungal_grunt','mud_slinger','tunnel_rat','rock_beetle','pale_sprite'],
  2: ['shadow_wolf','dark_adder','crypt_spider','bone_hound','venom_crawler','swamp_lurker','cave_troll','marsh_specter'],
  3: ['blood_bat','iron_golem','feral_warden','chaos_imp','plague_hound','void_walker','stone_giant','dusk_wraith'],
  4: ['nightmare_beast','shadow_titan','void_serpent','abyssal_hound','infernal_brute','death_knight','chaos_dragon','void_leviathan']
};

const DUNGEON_SPAWN_POSITIONS = [
  { x: 225, y: 225 }, { x: 600, y: 180 }, { x: 975, y: 225 },
  { x: 180, y: 525 }, { x: 1020, y: 525 },
  { x: 180, y: 675 }, { x: 1020, y: 675 },
  { x: 225, y: 900 }, { x: 600, y: 870 }, { x: 975, y: 900 },
  { x: 375, y: 375 }, { x: 825, y: 375 },
  { x: 375, y: 750 }, { x: 825, y: 750 },
  { x: 300, y: 600 }, { x: 900, y: 600 }
];

const DUNGEON_LANES_T1 = [ { x:70, y:1130 }, { x:1130, y:1130 }, { x:70, y:510 }, { x:1130, y:510 }, { x:590, y:850 }, { x:170, y:70 }, { x:1030, y:70 }, { x:770, y:550 }, { x:410, y:550 }, { x:930, y:850 }, { x:230, y:830 }, { x:410, y:1130 }, { x:750, y:1130 }, { x:330, y:290 }, { x:870, y:290 }, { x:410, y:70 } ];
const DUNGEON_LANES_T2 = [ { x:1130, y:70 }, { x:1130, y:1130 }, { x:530, y:70 }, { x:530, y:1130 }, { x:830, y:590 }, { x:70, y:150 }, { x:70, y:1050 }, { x:1130, y:770 }, { x:830, y:950 }, { x:530, y:770 }, { x:830, y:230 }, { x:530, y:410 }, { x:1130, y:410 }, { x:270, y:330 }, { x:270, y:870 }, { x:290, y:70 } ];
const DUNGEON_LANES_T3 = [ { x:70, y:70 }, { x:1130, y:70 }, { x:70, y:1130 }, { x:1130, y:1130 }, { x:590, y:70 }, { x:70, y:590 }, { x:1130, y:590 }, { x:490, y:1030 }, { x:830, y:930 }, { x:330, y:270 }, { x:850, y:270 }, { x:230, y:850 }, { x:870, y:670 }, { x:1090, y:850 }, { x:1110, y:330 }, { x:70, y:330 } ];
const DUNGEON_LANES_T4 = [ { x:70, y:70 }, { x:1130, y:70 }, { x:70, y:1130 }, { x:1130, y:1130 }, { x:590, y:70 }, { x:70, y:590 }, { x:1130, y:590 }, { x:490, y:1050 }, { x:830, y:890 }, { x:330, y:330 }, { x:850, y:330 }, { x:330, y:770 }, { x:870, y:630 }, { x:1090, y:850 }, { x:330, y:70 }, { x:850, y:70 } ];
// Each tier is now its own labyrinth (client DUNGEON_LAYOUTS, per-tier shape+colour).
const DUNGEON_SPAWN_POSITIONS_BY_TIER = { 1: DUNGEON_LANES_T1, 2: DUNGEON_LANES_T2, 3: DUNGEON_LANES_T3, 4: DUNGEON_LANES_T4 };

module.exports = { DUNGEON_LORE, DUNGEON_MOB_TYPES, DUNGEON_MOB_KEYS_BY_TIER, DUNGEON_SPAWN_POSITIONS, DUNGEON_LANES_T1, DUNGEON_LANES_T2, DUNGEON_LANES_T3, DUNGEON_LANES_T4, DUNGEON_SPAWN_POSITIONS_BY_TIER };
