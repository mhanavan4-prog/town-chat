// Dungeon catalogs & spawn geometry (Session L). Extracted verbatim from
// server.js (Tier 3.4 Phase A). Pure data — the dungeonMobs build loop
// stays in server.js and reads DUNGEON_MOB_KEYS_BY_TIER from here.

const DUNGEON_LORE = {
  1: {
    name: 'The Rootcellar', epithet: 'beneath the oldest house in Thornreach',
    bossKey: 'boss_rat_king',
    // Some nights something else is down here besides the keeper (lib/dungeons.js, the wanderers).
    wanderer: { key: 'wander_rawhead',
      // what she brings up the first time it falls to her; it stands on a shelf in her cottage (the game's own invention)
      keepsake: { id: 'bone', model: 'wd_kbone', name: 'a bone from the heap', text: 'One small bone from the heap he sat on. You would rather not know whose.' },
      name: 'Rawhead-and-Bloody-Bones', tier: 'folk',
      lore: 'A bogey of the dark places of a house. The name is in print by about 1548, and John Locke complained in 1693 of servants who kept children quiet with "Raw-Head and Bloody-Bones, and such other Names". In Somerset, as Ruth Tongue heard it, he "lived in a dark cupboard, usually under the stairs", crouched on a heap of the bones of children who told lies; in Lancashire and Yorkshire he waited in ponds and old marl-pits.',
      source: 'J. Locke, Some Thoughts Concerning Education (1693); R. L. Tongue, Somerset Folklore (1965); E. M. Wright, Rustic Speech and Folk-Lore (1913); K. Briggs, A Dictionary of Fairies (1976).',
      note: 'The stories only ever threaten with him. That he can be met and fought is the game\'s.' },
    plaque: '“Every town buries something. Thornreach dug a cellar for it. The roots grew down from above and the rats grew up from below, and in the dark where they meet, Old Gnawbone wears a crown of tarnished spoons. Feed him your courage — or your bones.”'
  },
  2: {
    name: 'The Weeping Crypts', epithet: 'where the old covens laid their debts',
    bossKey: 'boss_crypt_weaver',
    wanderer: { key: 'wander_church_grim',
      // what she brings up the first time it falls to her; it stands on a shelf in her cottage (the game's own invention)
      keepsake: { id: 'rope', model: 'wd_krope', name: 'a hank of bell-rope', text: 'A length of the rope it tolled with, the sally still on it.' },
      name: 'The Church Grim', tier: 'folk',
      lore: 'In the north of England it was said that the first one buried in a new churchyard must watch it against the Devil ever after, and that to spare a Christian soul the duty a black dog was buried first, on the north side. Its ghost was the grim: a great black dog that kept the graves from thieves and witches, and tolled the bell at midnight before a death. The Swedes and Danes told the same of the kyrkogrim, an animal walled alive into the church\'s foundation.',
      source: 'W. Henderson, Notes on the Folk-Lore of the Northern Counties (1866; 2nd ed. 1879); B. Thorpe, Northern Mythology, vol. 2 (1851); K. Briggs, A Dictionary of Fairies (1976).',
      note: 'The grim was a guardian and harmed only those who came to rob. Down here the game makes you the one who has come to rob.' },
    plaque: '“The stones down here sweat a cold water the gravediggers called crypt-tears. Widow Silk spins beneath the drowned chapel, and her web is strung with wedding rings. Mind the strands. She knows the weight of every visitor by heart.”'
  },
  3: {
    name: 'The Howling Forge', epithet: 'the mountain’s furnace that never went out',
    bossKey: 'boss_forge_tyrant',
    wanderer: { key: 'wander_mine_demon',
      // what she brings up the first time it falls to her; it stands on a shelf in her cottage (the game's own invention)
      keepsake: { id: 'cobalt', model: 'wd_kcobalt', name: 'a lump of cobalt ore', text: 'Grey, heavy, and blue where it broke. The smelters would have cursed it.' },
      name: 'The Demon of the Rose-Garland Mine', tier: 'record',
      lore: 'Georgius Agricola, the first great writer on mining, held that spirits lived in mines and said so in print in 1549 and 1556. Most were the gentle kobel, dwarfs about two feet high and dressed like miners, who throw pebbles at the workmen "but they rarely injure them unless the workmen first ridicule or curse them". Others were deadly. He wrote of one at Annaberg, in the mine called the Rose-garland, that killed twelve labourers with its breath, so that the mine was given up though it was rich in silver, and he listed such demons among the reasons a mine may lawfully be abandoned. Cobalt ore is named for the kobel, who were blamed for ore that poisoned the smelters and yielded nothing.',
      source: 'G. Agricola, De animantibus subterraneis (1549) and De re metallica (1556), trans. H. C. and L. H. Hoover (1912).',
      note: 'Agricola gives the demon a mine in Saxony, not a forge. The game has moved it under the mountain.' },
    plaque: '“Dwarrow-work or giant-work, the masons still argue — the Forge doesn’t care. It breathes through the floor grates and it remembers being a volcano. Cindermaw stokes the heart-coal with a shovel beaten from dead men’s shields. Bring water. Bring friends.”'
  },
  4: {
    name: 'The Starless Deep', epithet: 'the dark below the dark',
    bossKey: 'boss_pale_sovereign',
    wanderer: { key: 'wander_black_annis',
      // what she brings up the first time it falls to her; it stands on a shelf in her cottage (the game's own invention)
      keepsake: { id: 'claw', model: 'wd_kclaw', name: 'an iron claw', text: 'One claw, long as your hand. There is sandstone still in the pitting.' },
      name: 'Black Annis', tier: 'folk',
      lore: 'A hag with a blue face and iron claws who lived in a cave in the Dane Hills outside Leicester, which she was said to have scratched out of the sandstone with her own nails. She took lambs and children, and hung their skins on the oak at the cave\'s mouth. The place is "Black Anny\'s Bower Close" in title deeds of May 1764, and John Heyrick put her "features livid blue" and "vast talons" into verse before the century was out. Until about that time a drag was hunted from her Bower to the Mayor\'s door every Easter Monday.',
      source: 'C. J. Billson, County Folk-Lore vol. 1: Leicestershire and Rutland (1895); K. Briggs, A Dictionary of Fairies (1976).',
      note: 'Her cave was in a field near Leicester and is built over now. The game has let her go deeper.' },
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
  boss_pale_sovereign: { name: 'The Pale Sovereign',           tier: 4, xp: 400, boss: true, color: 0xd8d8ea, scale: 2.1,  maxHealth: 1350, speed: 66, aggroRadius: 260, strikeRange: 64, dmgMin: 40, dmgMax: 52, hitCooldownMs: 1700 },
  // ── The wanderers ── a second, rarer boss in each dungeon, out of the
  // folklore of dark places (the lore is with DUNGEON_LORE above). One walks
  // its dungeon for a while, from chamber to chamber, and is gone again; they
  // are bosses in every other way (party scaling, shared XP, a key, the loot).
  wander_rawhead:      { name: 'Rawhead-and-Bloody-Bones',            tier: 1, xp: 30,  boss: true, wanderer: true, color: 0x8a2a22, scale: 1.2,  maxHealth: 110, speed: 70, aggroRadius: 200, strikeRange: 52, dmgMin: 5,  dmgMax: 9,  hitCooldownMs: 1400 },
  wander_church_grim:  { name: 'The Church Grim',                     tier: 2, xp: 65,  boss: true, wanderer: true, color: 0x14141a, scale: 1.3,  maxHealth: 260, speed: 88, aggroRadius: 240, strikeRange: 56, dmgMin: 12, dmgMax: 18, hitCooldownMs: 1500 },
  wander_mine_demon:   { name: 'The Demon of the Rose-Garland Mine',  tier: 3, xp: 130, boss: true, wanderer: true, color: 0x6a7078, scale: 1.5,  maxHealth: 470, speed: 58, aggroRadius: 240, strikeRange: 62, dmgMin: 22, dmgMax: 30, hitCooldownMs: 1700 },
  wander_black_annis:  { name: 'Black Annis',                         tier: 4, xp: 260, boss: true, wanderer: true, color: 0x2a3a6a, scale: 1.6,  maxHealth: 880, speed: 74, aggroRadius: 260, strikeRange: 62, dmgMin: 36, dmgMax: 46, hitCooldownMs: 1600 }
};

const DUNGEON_MOB_KEYS_BY_TIER = {
  1: ['cave_rat','stone_bat','moss_crawler','fungal_grunt','mud_slinger','tunnel_rat','rock_beetle','pale_sprite'],
  2: ['shadow_wolf','dark_adder','crypt_spider','bone_hound','venom_crawler','swamp_lurker','cave_troll','marsh_specter'],
  3: ['blood_bat','iron_golem','feral_warden','chaos_imp','plague_hound','void_walker','stone_giant','dusk_wraith'],
  4: ['nightmare_beast','shadow_titan','void_serpent','abyssal_hound','infernal_brute','death_knight','chaos_dragon','void_leviathan']
};

// Where creatures stand is worked out with each dungeon's shape (data/dungeonLayouts.js):
// four posts to a chamber, none in the chamber you arrive in.
const { DUNGEON_LAYOUTS } = require('./dungeonLayouts');
const DUNGEON_LANES_T1 = DUNGEON_LAYOUTS[1].lanes, DUNGEON_LANES_T2 = DUNGEON_LAYOUTS[2].lanes, DUNGEON_LANES_T3 = DUNGEON_LAYOUTS[3].lanes, DUNGEON_LANES_T4 = DUNGEON_LAYOUTS[4].lanes;
const DUNGEON_SPAWN_POSITIONS = DUNGEON_LANES_T1;
const DUNGEON_SPAWN_POSITIONS_BY_TIER = { 1: DUNGEON_LANES_T1, 2: DUNGEON_LANES_T2, 3: DUNGEON_LANES_T3, 4: DUNGEON_LANES_T4 };

module.exports = { DUNGEON_LORE, DUNGEON_MOB_TYPES, DUNGEON_MOB_KEYS_BY_TIER, DUNGEON_SPAWN_POSITIONS, DUNGEON_LANES_T1, DUNGEON_LANES_T2, DUNGEON_LANES_T3, DUNGEON_LANES_T4, DUNGEON_SPAWN_POSITIONS_BY_TIER };
