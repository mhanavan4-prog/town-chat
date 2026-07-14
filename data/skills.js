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
    { id: 'witch_forage',   name: 'Hedgecraft',        icon: '🌿',  effect: 'forage',   desc: 'You know which stems give twice — +15% chance to harvest an extra herb per rank.' }
  ],
  1: [ // Werewolf — Feral Instincts
    { id: 'wolf_power',    name: 'Rending Fangs',    icon: '🦷', effect: 'power',    desc: 'Teeth meant for bone — +8% damage per rank.' },
    { id: 'wolf_leech',    name: 'Bloodlust',        icon: '🩸', effect: 'leech',    desc: 'The kill mends the hunter — heal 6% of damage dealt per rank.' },
    { id: 'wolf_guard',    name: 'Thick Hide',       icon: '🐾', effect: 'guard',    desc: 'Matted fur turns the claw — take 6% less damage per rank.' },
    { id: 'wolf_swift',    name: "Predator's Pace",  icon: '💨', effect: 'swift',    desc: 'Run anything down — +6% movement speed per rank.' },
    { id: 'wolf_vitality', name: 'Lunar Endurance',  icon: '🌕', effect: 'vitality', desc: 'The moon lends its stamina — +12 maximum health per rank.' },
    { id: 'wolf_sage',     name: 'Keen Senses',      icon: '👁️', effect: 'sage',     desc: 'You read the whole hunt — +10% XP per rank.' }
  ],
  2: [ // Mystic — Spirit Communion
    { id: 'mystic_power',    name: 'Spectral Force',     icon: '👻',  effect: 'power',    desc: 'The dead strike alongside you — +8% damage per rank.' },
    { id: 'mystic_leech',    name: 'Soul Harvest',       icon: '💜',  effect: 'leech',    desc: 'Reap the spirit you spill — heal 6% of damage dealt per rank.' },
    { id: 'mystic_guard',    name: 'Ethereal Veil',      icon: '🌫️', effect: 'guard',    desc: 'Half a step out of the world — take 6% less damage per rank.' },
    { id: 'mystic_haste',    name: 'Attuned Channeling', icon: '🔮',  effect: 'haste',    desc: 'The veil answers faster — abilities recharge 10% quicker per rank.' },
    { id: 'mystic_vitality', name: 'Ancestral Vigor',    icon: '✨',  effect: 'vitality', desc: 'Generations stand behind you — +12 maximum health per rank.' },
    { id: 'mystic_mending',  name: 'Spirit Mending',     icon: '🕊️', effect: 'mending',  desc: 'The spirits close your wounds — regenerate out of combat, faster per rank.' }
  ],
  3: [ // Knight — Martial Discipline
    { id: 'knight_power',    name: 'Honed Edge',      icon: '⚔️',  effect: 'power',    desc: 'A blade kept sharp — +8% damage per rank.' },
    { id: 'knight_guard',    name: 'Bulwark',         icon: '🛡️', effect: 'guard',    desc: 'Trained to eat the blow — take 6% less damage per rank.' },
    { id: 'knight_vitality', name: 'Ironclad',        icon: '🏰',  effect: 'vitality', desc: 'Built to outlast the siege — +12 maximum health per rank.' },
    { id: 'knight_haste',    name: 'Battle Tempo',    icon: '⚡',  effect: 'haste',    desc: 'Drilled until it is reflex — abilities recharge 10% quicker per rank.' },
    { id: 'knight_mending',  name: 'Field Medicine',  icon: '❤️‍🩹', effect: 'mending', desc: 'A soldier who knows the kit — regenerate out of combat, faster per rank.' },
    { id: 'knight_sage',     name: "Veteran's Valor", icon: '🎖️', effect: 'sage',     desc: 'Every battle teaches — +10% XP per rank.' }
  ],
  4: [ // Wanderer — Road Wisdom
    { id: 'wanderer_power',    name: 'Deadly Aim',        icon: '🔪', effect: 'power',    desc: 'A thrown knife that means it — +8% damage per rank.' },
    { id: 'wanderer_swift',    name: 'Trailblazer',       icon: '🥾', effect: 'swift',    desc: 'Nobody covers ground like you — +6% movement speed per rank.' },
    { id: 'wanderer_vitality', name: 'Seasoned Traveler', icon: '🎒', effect: 'vitality', desc: 'Hardened by every mile — +12 maximum health per rank.' },
    { id: 'wanderer_haste',    name: 'Efficient Rest',    icon: '🧭', effect: 'haste',    desc: 'You waste no motion — abilities recharge 10% quicker per rank.' },
    { id: 'wanderer_forage',   name: "Forager's Lore",    icon: '🌿', effect: 'forage',   desc: 'The road feeds those who read it — +15% chance to harvest an extra plant per rank.' },
    { id: 'wanderer_sage',     name: 'Worldly Wisdom',    icon: '📜', effect: 'sage',     desc: 'Every road is a lesson — +10% XP per rank.' }
  ]
};

module.exports = { STAT_KEYS, SKILL_STAT_PER_RANK, STAT_SKILL_EFFECT, SKILL_FX, SKILL_CATALOG };
