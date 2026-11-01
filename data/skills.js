// Skill & stat data (Tier 3.4 Phase A). Extracted verbatim from server.js.
// Self-contained: SKILL_FX arrows use only their arg `r`; no external state.

// The eight derived stats every character has, and where each pulls from.
// Skills contribute this-much-per-rank; gear contributes its EQUIP_STATS value.
const STAT_KEYS = ['power', 'guard', 'vitality', 'haste', 'swift', 'leech', 'xp', 'forage'];
const SKILL_STAT_PER_RANK = { power: 0.08, guard: 0.06, vitality: 12, haste: 0.10, swift: 0.06, leech: 0.06, xp: 0.10, forage: 0.15 };
// The skill tree uses effect id 'sage' for the XP stat; every other stat's
// skill-effect id matches the stat key directly.
const STAT_SKILL_EFFECT = { power: 'power', guard: 'guard', vitality: 'vitality', haste: 'haste', swift: 'swift', leech: 'leech', xp: 'sage', forage: 'forage' };

// effect key -> value contributed per rank
const SKILL_FX = {
  power:    (r) => 1 + 0.08 * r, // outgoing damage multiplier   (applyDamage)
  guard:    (r) => 1 - 0.06 * r, // incoming damage multiplier   (absorbIncomingDamage)
  vitality: (r) => 12 * r,       // + maximum health             (playerMaxHealth)
  haste:    (r) => 1 - 0.10 * r, // ability cooldown multiplier  (cast handlers)
  swift:    (r) => 1 + 0.06 * r, // movement speed multiplier    (client)
  leech:    (r) => 0.06 * r,     // heal this fraction of damage dealt (applyDamage)
  mending:  (r) => 0.6 * r,      // passive out-of-combat regen HP/s   (tick)
  forage:   (r) => 0.15 * r,     // chance of +1 harvest yield         (harvest)
  sage:     (r) => 0.10 * r      // + fraction of XP earned            (grantXP)
};
const SKILL_CATALOG = {
  0: [ // Witch — Coven Secrets
    { id: 'witch_power',    name: 'Witchfire Mastery', icon: '🔥',  effect: 'power',    desc: 'Spells and strikes scorch harder — +8% damage per rank.' },
    { id: 'witch_leech',    name: 'Blood Pact',        icon: '🩸',  effect: 'leech',    desc: 'Every blow drains life back into you — heal 6% of damage dealt per rank.' },
    { id: 'witch_guard',    name: 'Gourdskin Ward',    icon: '🎃',  effect: 'guard',    desc: 'Hollowed bones turn blows aside — take 6% less damage per rank.' },
    { id: 'witch_haste',    name: 'Quickened Casting', icon: '🕯️', effect: 'haste',    desc: 'The old words come faster — abilities recharge 10% quicker per rank.' },
    { id: 'witch_vitality', name: 'Moonwell Vitality', icon: '🌙',  effect: 'vitality', desc: 'Draw on the moonwell — +12 maximum health per rank.' },
    { id: 'witch_forage',   name: 'Hedgecraft',        icon: '🌿',  effect: 'forage',   desc: 'You know which stems give twice — +15% chance to harvest an extra herb per rank.' },
    // ── Trade-off ──────────────────────────────────────────────────────────
    { id: 'witch_overchannel', name: 'Overchannel',    icon: '🔮',  mods: { haste: 0.12, guard: -0.06 },
      desc: 'Rush the old words and they bite back — abilities recharge 12% faster but +6% damage taken per rank.' },
    // ── Sworn Pact (choose one) ────────────────────────────────────────────
    { id: 'witch_k_matriarch', name: 'Moonbound Matriarch', icon: '🌙', tier: 'keystone', maxRank: 1,
      mods: { guard: 0.15, vitality: 40, power: -0.10 },
      desc: 'PACT — The coven draws its strength around you. +15% defense and +40 max HP, but your spells land 10% softer.' },
    { id: 'witch_k_pyre',      name: 'Pyre Witch',      icon: '🔥', tier: 'keystone', maxRank: 1,
      mods: { power: 0.28, haste: 0.08, guard: -0.18 },
      desc: 'PACT — Everything, into the fire. +28% damage and 8% faster rites, but you take 18% more damage.' },
    { id: 'witch_k_green',     name: 'Green Witch',     icon: '🌿', tier: 'keystone', maxRank: 1,
      mods: { forage: 0.40, leech: 0.10, power: -0.08 },
      desc: 'PACT — The hedge keeps you. +40% harvest luck and +10% lifesteal, but −8% damage — you win slow.' }
  ],
  1: [ // Werewolf — Feral Instincts
    { id: 'wolf_power',    name: 'Rending Fangs',    icon: '🦷', effect: 'power',    desc: 'Teeth meant for bone — +8% damage per rank.' },
    { id: 'wolf_leech',    name: 'Bloodlust',        icon: '🩸', effect: 'leech',    desc: 'The kill mends the hunter — heal 6% of damage dealt per rank.' },
    { id: 'wolf_guard',    name: 'Thick Hide',       icon: '🐾', effect: 'guard',    desc: 'Matted fur turns the claw — take 6% less damage per rank.' },
    { id: 'wolf_swift',    name: "Predator's Pace",  icon: '💨', effect: 'swift',    desc: 'Run anything down — +6% movement speed per rank.' },
    { id: 'wolf_vitality', name: 'Lunar Endurance',  icon: '🌕', effect: 'vitality', desc: 'The moon lends its stamina — +12 maximum health per rank.' },
    { id: 'wolf_sage',     name: 'Keen Senses',      icon: '👁️', effect: 'sage',     desc: 'You read the whole hunt — +10% XP per rank.' },
    // ── Trade-off ──────────────────────────────────────────────────────────
    { id: 'wolf_frenzy',   name: 'Frenzy',           icon: '🩸', mods: { power: 0.10, guard: -0.06 },
      desc: 'Lose yourself in the kill — +10% damage but +6% damage taken per rank.' },
    // ── Sworn Pact (choose one) ────────────────────────────────────────────
    { id: 'wolf_k_alpha',  name: 'Alpha',            icon: '🐺', tier: 'keystone', maxRank: 1,
      mods: { vitality: 55, guard: 0.12, power: -0.08 },
      desc: 'PACT — The pack bends to the biggest beast. +55 max HP and +12% defense, but your blows land 8% softer.' },
    { id: 'wolf_k_bloodmoon', name: 'Bloodmoon Beast', icon: '🌕', tier: 'keystone', maxRank: 1,
      mods: { power: 0.26, leech: 0.12, guard: -0.18 },
      desc: 'PACT — All teeth, no caution. +26% damage and +12% lifesteal, but you take 18% more damage.' },
    { id: 'wolf_k_dire',   name: 'Dire Runner',      icon: '💨', tier: 'keystone', maxRank: 1,
      mods: { swift: 0.18, haste: 0.12, vitality: -30 },
      desc: 'PACT — Run it down and never stop. +18% move speed and 12% faster attacks, but −30 max HP.' }
  ],
  2: [ // Mystic — Spirit Communion
    { id: 'mystic_power',    name: 'Spectral Force',     icon: '👻',  effect: 'power',    desc: 'The dead strike alongside you — +8% damage per rank.' },
    { id: 'mystic_leech',    name: 'Soul Harvest',       icon: '💜',  effect: 'leech',    desc: 'Reap the spirit you spill — heal 6% of damage dealt per rank.' },
    { id: 'mystic_guard',    name: 'Ethereal Veil',      icon: '🌫️', effect: 'guard',    desc: 'Half a step out of the world — take 6% less damage per rank.' },
    { id: 'mystic_haste',    name: 'Attuned Channeling', icon: '🔮',  effect: 'haste',    desc: 'The veil answers faster — abilities recharge 10% quicker per rank.' },
    { id: 'mystic_vitality', name: 'Ancestral Vigor',    icon: '✨',  effect: 'vitality', desc: 'Generations stand behind you — +12 maximum health per rank.' },
    { id: 'mystic_mending',  name: 'Spirit Mending',     icon: '🕊️', effect: 'mending',  desc: 'The spirits close your wounds — regenerate out of combat, faster per rank.' },
    // ── Trade-off ──────────────────────────────────────────────────────────
    { id: 'mystic_spiritburn', name: 'Spirit Burn',      icon: '💥',  mods: { power: 0.11, guard: -0.06 },
      desc: 'Spend the spirits recklessly — +11% damage but +6% damage taken per rank.' },
    // ── Sworn Pact (choose one) ────────────────────────────────────────────
    { id: 'mystic_k_oracle',   name: 'Oracle',           icon: '🕊️', tier: 'keystone', maxRank: 1,
      mods: { guard: 0.15, vitality: 40, power: -0.10 },
      desc: 'PACT — You see the blow before it falls. +15% defense and +40 max HP, but your strikes land 10% softer.' },
    { id: 'mystic_k_wraith',   name: 'Wraithcaller',     icon: '👻', tier: 'keystone', maxRank: 1,
      mods: { power: 0.27, haste: 0.10, guard: -0.17 },
      desc: 'PACT — Call the angry dead and let them loose. +27% damage and 10% faster rites, but you take 17% more damage.' },
    { id: 'mystic_k_conduit',  name: 'Ancestral Conduit', icon: '✨', tier: 'keystone', maxRank: 1,
      mods: { xp: 0.20, leech: 0.12, guard: -0.08 },
      desc: 'PACT — Every spirit you spill teaches you. +20% XP and +12% lifesteal, but −8% defense.' }
  ],
  3: [ // Knight — Martial Discipline
    { id: 'knight_power',    name: 'Honed Edge',      icon: '⚔️',  effect: 'power',    desc: 'A blade kept sharp — +8% damage per rank.' },
    { id: 'knight_guard',    name: 'Bulwark',         icon: '🛡️', effect: 'guard',    desc: 'Trained to eat the blow — take 6% less damage per rank.' },
    { id: 'knight_vitality', name: 'Ironclad',        icon: '🏰',  effect: 'vitality', desc: 'Built to outlast the siege — +12 maximum health per rank.' },
    { id: 'knight_haste',    name: 'Battle Tempo',    icon: '⚡',  effect: 'haste',    desc: 'Drilled until it is reflex — abilities recharge 10% quicker per rank.' },
    { id: 'knight_mending',  name: 'Field Medicine',  icon: '❤️‍🩹', effect: 'mending', desc: 'A soldier who knows the kit — regenerate out of combat, faster per rank.' },
    { id: 'knight_sage',     name: "Veteran's Valor", icon: '🎖️', effect: 'sage',     desc: 'Every battle teaches — +10% XP per rank.' },
    // ── Trade-off ──────────────────────────────────────────────────────────
    { id: 'knight_reckless', name: 'Reckless Charge', icon: '⚔️',  mods: { power: 0.10, guard: -0.06 },
      desc: 'Drop your guard and commit — +10% damage but +6% damage taken per rank.' },
    // ── Sworn Pact (choose one) ────────────────────────────────────────────
    { id: 'knight_k_juggernaut', name: 'Juggernaut',  icon: '🏰', tier: 'keystone', maxRank: 1,
      mods: { guard: 0.18, vitality: 55, haste: -0.10 },
      desc: 'PACT — An immovable wall of steel. +18% defense and +55 max HP, but your heavy plate recharges 10% slower.' },
    { id: 'knight_k_duelist',    name: 'Duelist',     icon: '⚔️', tier: 'keystone', maxRank: 1,
      mods: { power: 0.26, swift: 0.10, guard: -0.16 },
      desc: 'PACT — Blade over shield. +26% damage and +10% move speed, but you take 16% more damage.' },
    { id: 'knight_k_warlord',    name: 'Warlord',     icon: '🎖️', tier: 'keystone', maxRank: 1,
      mods: { haste: 0.16, leech: 0.08, vitality: -25 },
      desc: 'PACT — Press the attack, always. 16% faster attacks and +8% lifesteal, but −25 max HP.' }
  ],
  4: [ // Wanderer — Road Wisdom
    { id: 'wanderer_power',    name: 'Deadly Aim',        icon: '🔪', effect: 'power',    desc: 'A thrown knife that means it — +8% damage per rank.' },
    { id: 'wanderer_swift',    name: 'Trailblazer',       icon: '🥾', effect: 'swift',    desc: 'Nobody covers ground like you — +6% movement speed per rank.' },
    { id: 'wanderer_vitality', name: 'Seasoned Traveler', icon: '🎒', effect: 'vitality', desc: 'Hardened by every mile — +12 maximum health per rank.' },
    { id: 'wanderer_haste',    name: 'Efficient Rest',    icon: '🧭', effect: 'haste',    desc: 'You waste no motion — abilities recharge 10% quicker per rank.' },
    { id: 'wanderer_forage',   name: "Forager's Lore",    icon: '🌿', effect: 'forage',   desc: 'The road feeds those who read it — +15% chance to harvest an extra plant per rank.' },
    { id: 'wanderer_sage',     name: 'Worldly Wisdom',    icon: '📜', effect: 'sage',     desc: 'Every road is a lesson — +10% XP per rank.' },
    // ── Trade-off ──────────────────────────────────────────────────────────
    { id: 'wanderer_allornothing', name: 'All or Nothing', icon: '🎯', mods: { power: 0.11, guard: -0.06 },
      desc: 'Put everything behind the throw — +11% damage but +6% damage taken per rank.' },
    // ── Sworn Pact (choose one) ────────────────────────────────────────────
    { id: 'wanderer_k_pathfinder', name: 'Pathfinder',  icon: '🎒', tier: 'keystone', maxRank: 1,
      mods: { vitality: 50, guard: 0.12, power: -0.08 },
      desc: 'PACT — Outlast any road. +50 max HP and +12% defense, but your strikes land 8% softer.' },
    { id: 'wanderer_k_assassin',   name: 'Assassin',    icon: '🔪', tier: 'keystone', maxRank: 1,
      mods: { power: 0.28, swift: 0.10, guard: -0.18 },
      desc: 'PACT — One strike, gone before they turn. +28% damage and +10% move speed, but you take 18% more damage.' },
    { id: 'wanderer_k_vagabond',   name: 'Vagabond',    icon: '🧭', tier: 'keystone', maxRank: 1,
      mods: { swift: 0.16, forage: 0.40, vitality: -25 },
      desc: 'PACT — The road provides for the quick. +16% move speed and +40% harvest luck, but −25 max HP.' }
  ],
  5: [ // Necromancer — Death Rites
    // ── Core (the familiar single-stat ranks every class has) ──────────────
    { id: 'necro_power',    name: 'Grave Might',      icon: '💀', effect: 'power',    desc: 'The dead strike with your hatred — +8% damage per rank.' },
    { id: 'necro_leech',    name: 'Soul Leech',       icon: '🩸', effect: 'leech',    desc: 'Every wound you open feeds you — heal 6% of damage dealt per rank.' },
    { id: 'necro_guard',    name: 'Bonewall',         icon: '🦴', effect: 'guard',    desc: 'A lattice of bone turns the blow — take 6% less damage per rank.' },
    { id: 'necro_haste',    name: 'Hastened Rites',   icon: '☠️', effect: 'haste',    desc: 'The grave answers quicker — abilities recharge 10% faster per rank.' },
    { id: 'necro_vitality', name: 'Deathless Flesh',  icon: '🖤', effect: 'vitality', desc: 'Half in the next world already — +12 maximum health per rank.' },
    { id: 'necro_sage',     name: 'Forbidden Lore',   icon: '📜', effect: 'sage',     desc: 'The dead keep their secrets for you — +10% XP per rank.' },
    // ── Trade-off (prototype): raw aggression bought with your own hide. ────
    // Uses explicit `mods` (per-stat per-rank deltas) instead of a single
    // `effect`, so one skill can push two stats at once — one up, one down.
    { id: 'necro_reckless', name: 'Reckless Rites',   icon: '🔥', mods: { power: 0.09, guard: -0.05 },
      desc: 'Spend your own flesh for the kill — +9% damage but +5% damage taken per rank.' },
    // ── Keystone pacts (prototype): swear ONE. Each remakes how the Lich ───
    // plays. tier:'keystone' + maxRank:1 → the client shows them as a
    // choose-one row and the server refuses a second pact until you respec.
    { id: 'necro_k_bonelord', name: 'Bonelord',     icon: '🦴', tier: 'keystone', maxRank: 1,
      mods: { guard: 0.16, vitality: 50, power: -0.10 },
      desc: 'PACT — The tyrant that will not fall. +16% defense and +50 max HP, but your blows land 10% softer.' },
    { id: 'necro_k_reaper',   name: 'Pale Reaper',  icon: '☠️', tier: 'keystone', maxRank: 1,
      mods: { power: 0.26, leech: 0.10, guard: -0.16 },
      desc: 'PACT — Death made swift and brittle. +26% damage and +10% lifesteal, but you take 16% more damage.' },
    { id: 'necro_k_plague',   name: 'Plaguelord',   icon: '🩸', tier: 'keystone', maxRank: 1,
      mods: { leech: 0.14, haste: 0.12, vitality: -25 },
      desc: 'PACT — Win by attrition. +14% lifesteal and 12% faster rites, but −25 max HP — you live on the edge.' }
  ]
};

// Per-skill rank cap: keystone pacts are a single binary choice (0/1); every
// other skill uses the shared SKILL_MAX_RANK. Kept here so server and payload
// agree on one definition.
function skillMaxRank(skill, fallback) { return (skill && skill.maxRank) || fallback; }

module.exports = { STAT_KEYS, SKILL_STAT_PER_RANK, STAT_SKILL_EFFECT, SKILL_FX, SKILL_CATALOG, skillMaxRank };
