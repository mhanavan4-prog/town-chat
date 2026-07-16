// Creature catalogs (Session M Wilds fauna). Extracted verbatim from
// server.js (Tier 3.4 Phase A). Pure data — the spawn arrays and the
// animals2/mobs2/mobs3 builders that consume these stay in server.js.

const CRITTER2_TYPES = {
  rabbit:    { name: 'Wild Rabbit', hp: 30, xp: 6,  loot: null },
  embermoth: { name: 'Embermoth',   hp: 22, xp: 8,  loot: 'embermoth',  fly: true },
  thistlehog:{ name: 'Thistlehog',  hp: 34, xp: 8,  loot: 'thistlehog' },
  duskfawn:  { name: 'Duskfawn',    hp: 40, xp: 12, loot: 'duskfawn' },
  mirefowl:  { name: 'Mirefowl',    hp: 26, xp: 9,  loot: 'mirefowl' },
};

const CRITTER2_ORDER = ['embermoth', 'thistlehog', 'duskfawn', 'mirefowl', 'rabbit', 'duskfawn', 'thistlehog', 'mirefowl', 'embermoth', 'rabbit'];

const MOB2_TYPES = {
  shade_stalker: { name: 'Shade Stalker', color: 0x3a1a4a, scale: 0.85, maxHealth: 35, speed: 70, aggroRadius: 160, strikeRange: 50, dmgMin: 6,  dmgMax: 10, hitCooldownMs: 1400 },
  bog_brute:     { name: 'Bog Brute',     color: 0x3a4a26, scale: 1.35, maxHealth: 90, speed: 16, aggroRadius: 120, strikeRange: 60, dmgMin: 12, dmgMax: 18, hitCooldownMs: 2200 },
  night_howler:  { name: 'Night Howler',  color: 0x1a1a22, scale: 1.0,  maxHealth: 55, speed: 36, aggroRadius: 200, strikeRange: 50, dmgMin: 8,  dmgMax: 13, hitCooldownMs: 1800 },
  will_o_wisp:   { name: "Will-o'-Wisp",  color: 0x6fd8ff, scale: 0.6,  maxHealth: 18, speed: 50, aggroRadius: 140, strikeRange: 45, dmgMin: 4,  dmgMax: 7,  hitCooldownMs: 1200 },
  // ── Session M horrors — the four archetypes the original quartet lacked ──
  // ranged | swarm | burrower/ambush | flyer/leech | rare Blood Moon elite.
  // xp overrides the default 15 for a mob2 kill (see applyDamage mob2 branch).
  fen_hexer:   { name: 'Fen Hexer',   color: 0x3a1a4a, scale: 0.9, maxHealth: 30, speed: 40, aggroRadius: 260, strikeRange: 210, dmgMin: 7, dmgMax: 12, hitCooldownMs: 1800, xp: 20, ranged: true, kiteRange: 150 },
  rot_swarm:   { name: 'Grave-Mite',  color: 0x3a4a26, scale: 0.42, maxHealth: 12, speed: 62, aggroRadius: 150, strikeRange: 34, dmgMin: 2, dmgMax: 5, hitCooldownMs: 1000, xp: 5, swarm: true },
  barrow_maw:  { name: 'Barrow Maw',  color: 0x6a5038, scale: 1.05, maxHealth: 75, speed: 30, aggroRadius: 150, strikeRange: 52, dmgMin: 11, dmgMax: 17, hitCooldownMs: 1900, xp: 24, buried: true, ambushRange: 150 },
  gloom_bat:   { name: 'Gloom Bat',   color: 0x1c1c26, scale: 0.7, maxHealth: 26, speed: 78, aggroRadius: 200, strikeRange: 44, dmgMin: 5, dmgMax: 9, hitCooldownMs: 1300, xp: 12, flyer: true, lifesteal: 0.5 },
  // A mid-tier undead risen from the barrows — relentless melee, a notch tougher
  // than the Night Howler but no elite. Uses the recolored base blob (no rig).
  barrow_wight:{ name: 'Barrow Wight', color: 0x6a7a6a, scale: 1.1, maxHealth: 60, speed: 46, aggroRadius: 210, strikeRange: 52, dmgMin: 9, dmgMax: 14, hitCooldownMs: 1700, xp: 18 },
  old_marrowe: { name: 'Old Marrowe, the Gallows Warden', color: 0x8a3a2a, scale: 1.7, maxHealth: 340, speed: 34, aggroRadius: 240, strikeRange: 62, dmgMin: 18, dmgMax: 28, hitCooldownMs: 2000, xp: 220, elite: true, bloodMoonOnly: true }
};

const MOB3_TYPES = {
  bramble_boar:      { name: 'Bramble Boar',      color: 0x494a2c, scale: 1.2,  maxHealth: 70,  wanderSpeed: 20, chaseSpeed: 92, strikeRange: 55, dmgMin: 10, dmgMax: 16, hitCooldownMs: 1800, xp: 16, provokeMs: 12000 },
  mossback_tortoise: { name: 'Mossback Tortoise', color: 0x46583a, scale: 1.3,  maxHealth: 170, wanderSpeed: 8,  chaseSpeed: 24, strikeRange: 46, dmgMin: 8,  dmgMax: 14, hitCooldownMs: 2400, xp: 22, provokeMs: 10000, armor: 0.45 },
  gravewing_crow:    { name: 'Gravewing Crow',    color: 0x1a1a24, scale: 0.8,  maxHealth: 30,  wanderSpeed: 30, chaseSpeed: 72, strikeRange: 40, dmgMin: 6,  dmgMax: 10, hitCooldownMs: 1500, xp: 12, provokeMs: 9000, flyer: true },
};

module.exports = { CRITTER2_TYPES, CRITTER2_ORDER, MOB2_TYPES, MOB3_TYPES };
