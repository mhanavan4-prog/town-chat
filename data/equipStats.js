// Equipment stat contributions by item id. Legendaries merged in at load.
// Extracted verbatim from server.js (Tier 3.4 Phase A).
module.exports = {
  // ── basic shop gear (weak, early) ──
  iron_sword:    { power: 0.10 },
  holly_wand:    { power: 0.07, haste: 0.04 },  // crafted from 5 Holly Wood; its real prize is the light it casts
  bloodmoon_circlet: { power: 0.05, leech: 0.03 }, // 5 Blood Moon shards; an event trophy you wear (within relic caps)
  spell_tome:    { power: 0.08, haste: 0.05 },
  steel_shield:  { guard: 0.10, vitality: 10 },
  wizard_hat:    { haste: 0.06, xp: 0.05 },
  leather_boots: { swift: 0.06 },
  silver_ring:   { xp: 0.05, leech: 0.03 },
  // ── Witch starter set ──
  witch_robe:  { guard: 0.06, vitality: 8 },
  hexed_boots: { swift: 0.05, haste: 0.03 },
  hex_amulet:  { power: 0.06, leech: 0.04 },
  // ── Werewolf starter set ──
  beast_crown: { power: 0.06, vitality: 8 },
  beast_hide:  { guard: 0.08, vitality: 12 },
  paw_boots:   { swift: 0.08 },
  // ── Mystic starter set ──
  spirit_veil: { haste: 0.06, xp: 0.05 },
  spirit_robe: { guard: 0.06, vitality: 10 },
  spirit_ring: { power: 0.05, leech: 0.05 },
  // ── Knight starter set ──
  knights_helm: { guard: 0.06, vitality: 10 },
  order_signet: { guard: 0.05, xp: 0.05 },
  // ── Wanderer starter set ──
  travelers_hood: { swift: 0.05, forage: 0.10 },
  travelers_vest: { guard: 0.06, vitality: 8 },
  trail_ring:     { forage: 0.15, xp: 0.05 },
  // ── Witch cave / relic exclusives (strong) ──
  cursed_blade: { power: 0.18, leech: 0.05 },
  shadow_staff: { power: 0.16, haste: 0.10 },              // Witch relic
  bone_armor:   { guard: 0.12, vitality: 20 },
  shadow_cloak: { guard: 0.10, swift: 0.08, vitality: 15 }, // Mystic relic
  witches_boon: { power: 0.08, leech: 0.06, haste: 0.05 },
  dread_helm:   { power: 0.08, guard: 0.08, vitality: 15 }, // Knight relic
  soul_treads:  { swift: 0.12, haste: 0.06 },               // Wanderer relic
  void_staff:   { power: 0.20, haste: 0.08 },
  shadow_crown: { power: 0.10, xp: 0.10, vitality: 12 },
  abyssal_armor:{ guard: 0.14, vitality: 25 },
  death_ring:   { power: 0.10, leech: 0.08 },
  wraith_treads:{ swift: 0.14, haste: 0.06 },
  // ── Werewolf howl-trade exclusives ──
  moonhowl_pelt:   { guard: 0.10, vitality: 18 },
  alpha_fang:      { power: 0.18, leech: 0.06 },  // Werewolf relic
  packbound_ring:  { leech: 0.06, xp: 0.08 },
  nightfang_boots: { swift: 0.12, power: 0.05 }
};
