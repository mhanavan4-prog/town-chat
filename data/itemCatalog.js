// Base item catalog (name/icon/slot/desc per item). Legendaries are merged in
// at load. Extracted verbatim from server.js (Tier 3.4 Phase A).
module.exports = {
  iron_sword:     { name: 'Iron Sword',     icon: '⚔️', slot: 'weapon' },
  spell_tome:     { name: 'Spell Tome',     icon: '📕', slot: 'weapon' },
  steel_shield:   { name: 'Steel Shield',   icon: '🛡️', slot: 'chest' },
  wizard_hat:     { name: 'Wizard Hat',     icon: '🎩', slot: 'head'  },
  leather_boots:  { name: 'Leather Boots',  icon: '👢', slot: 'feet'  },
  silver_ring:    { name: 'Silver Ring',    icon: '💍', slot: 'ring'  },
  healing_potion: { name: 'Healing Potion', icon: '🧪', slot: null },
  magic_scroll:   { name: 'Magic Scroll',   icon: '📜', slot: null },
  dragon_scale:   { name: 'Dragon Scale',   icon: '🐉', slot: null },
  enchanted_gem:  { name: 'Enchanted Gem',  icon: '💎', slot: null },
  ancient_coin:   { name: 'Ancient Coin',   icon: '🪙', slot: null },
  golden_chalice: { name: 'Golden Chalice', icon: '🏆', slot: null },
  hard_drive:     { name: 'Hard Drive',     icon: '💽', slot: null },
  wood:           { name: 'Holly Wood',     icon: '🪵', slot: null },
  berries:        { name: 'Berries',        icon: '🍓', slot: null },
  flower_bloom:   { name: 'Flower',         icon: '🌸', slot: null },
  // Built (not found): 5 Holly Wood at the craft_wand handler. Equipping it
  // makes the bearer glow and light their way at night (client visual).
  holly_wand:     { name: 'Holly Wand',     icon: '🎇', slot: 'weapon' },
  bloodmoon_shard:   { name: 'Bloodmoon Shard',   icon: '🩸', slot: null },
  bloodmoon_circlet: { name: 'Bloodmoon Circlet', icon: '🔻', slot: 'head' },
  // ---- Witch starter set ----
  witch_robe:     { name: "Witch's Robe",   icon: '👘', slot: 'chest' },
  hexed_boots:    { name: 'Hexed Boots',    icon: '🌒', slot: 'feet'  },
  hex_amulet:     { name: 'Hex Amulet',     icon: '🔮', slot: 'ring'  },
  // ---- Werewolf starter set ----
  beast_crown:    { name: 'Beast Crown',    icon: '👑', slot: 'head'  },
  beast_hide:     { name: 'Beast Hide',     icon: '🦬', slot: 'chest' },
  paw_boots:      { name: 'Paw Boots',      icon: '🐾', slot: 'feet'  },
  // ---- Mystic starter set ----
  spirit_veil:    { name: 'Spirit Veil',    icon: '🌠', slot: 'head'  },
  spirit_robe:    { name: 'Spirit Robe',    icon: '🌌', slot: 'chest' },
  spirit_ring:    { name: 'Spirit Ring',    icon: '💜', slot: 'ring'  },
  // ---- Knight starter set ----
  knights_helm:   { name: "Knight's Helm",  icon: '⛑️', slot: 'head' },
  order_signet:   { name: "Order's Signet", icon: '🔰', slot: 'ring'  },
  // ---- Wanderer starter set ----
  travelers_hood: { name: "Traveler's Hood",icon: '🥷', slot: 'head'  },
  travelers_vest: { name: "Traveler's Vest",icon: '🧥', slot: 'chest' },
  trail_ring:     { name: 'Trail Ring',     icon: '🪬', slot: 'ring'  },
  // ---- Witch cave exclusive (selfie-gated) ----
  cursed_blade:   { name: 'Cursed Blade',   icon: '🗡️',  slot: 'weapon' },
  shadow_staff:   { name: 'Shadow Staff',   icon: '🪄',  slot: 'weapon' },
  bone_armor:     { name: 'Bone Armor',     icon: '🩻',  slot: 'chest'  },
  shadow_cloak:   { name: 'Shadow Cloak',   icon: '🌑',  slot: 'chest'  },
  witches_boon:   { name: "Witch's Boon",   icon: '🧿',  slot: 'ring'   },
  dread_helm:     { name: 'Dread Helm',     icon: '💀',  slot: 'head'   },
  soul_treads:    { name: 'Soul Treads',    icon: '👁️',  slot: 'feet'   },
  void_staff:     { name: 'Void Staff',     icon: '☄️',  slot: 'weapon' },
  shadow_crown:   { name: 'Shadow Crown',   icon: '🌙',  slot: 'head'   },
  abyssal_armor:  { name: 'Abyssal Armor',  icon: '⚫',  slot: 'chest'  },
  death_ring:     { name: 'Death Ring',     icon: '🖤',  slot: 'ring'   },
  wraith_treads:  { name: 'Wraith Treads',  icon: '🌫️',  slot: 'feet'   },
  // ---- Loot materials (mob drops) ----
  fur_scrap:      { name: 'Fur Scrap',       icon: '🧶', slot: null },
  animal_pelt:    { name: 'Animal Pelt',     icon: '🐻', slot: null },
  bone_shard:     { name: 'Bone Shard',      icon: '🦴', slot: null },
  leather_hide:   { name: 'Leather Hide',    icon: '🟤', slot: null },
  iron_ore:       { name: 'Iron Ore',        icon: '⛏️', slot: null },
  enchanted_fur:  { name: 'Enchanted Fur',   icon: '🌟', slot: null },
  shadow_essence: { name: 'Shadow Essence',  icon: '🫥', slot: null },
  glimmerdust:    { name: 'Glimmerdust',     icon: '✨', slot: null }, // Embermoth scale-dust (Session M critters)
  // ---- Wildlands quest rewards ----
  lumber_bundle:  { name: 'Lumber Bundle',   icon: '🪚', slot: null },
  stone_block:    { name: 'Stone Block',     icon: '🪨', slot: null },
  iron_ingot:     { name: 'Iron Ingot',      icon: '⚙️', slot: null },
  druid_stone:    { name: 'Druid Stone',     icon: '🗿', slot: null },
  hollow_shard:   { name: 'Hollow Shard',    icon: '💠', slot: null },
  // ---- Lexton's Howl Trade exclusive (voice-gated, see werewolf_buy_item) ----
  moonhowl_pelt:    { name: 'Moonhowl Pelt',    icon: '🌕', slot: 'chest'  },
  alpha_fang:       { name: 'Alpha Fang',       icon: '🦷', slot: 'weapon' },
  packbound_ring:   { name: 'Packbound Ring',   icon: '🪢', slot: 'ring'   },
  nightfang_boots:  { name: 'Nightfang Boots',  icon: '🥾', slot: 'feet'   },
  // ---- Wilds flora — tree & bush harvest materials ----
  pine_pitch:    { name: 'Pine Pitch',   icon: '🌲',   slot: null },
  witchwood:     { name: 'Witchwood',    icon: '🪵',   slot: null },
  willow_frond:  { name: 'Willow Frond', icon: '🍃',   slot: null },
  toadcap:       { name: 'Toadcap',      icon: '🍄‍🟫', slot: null },
  hex_acorn:     { name: 'Hex Acorn',    icon: '🌰',   slot: null },
  birch_bark:    { name: 'Birch Bark',   icon: '📜',   slot: null },
  bramble_vine:  { name: 'Bramble Vine', icon: '🌿',   slot: null },
  nightberry:    { name: 'Nightberry',   icon: '🫐',   slot: null },
  blackthorn:    { name: 'Blackthorn',   icon: '🥀',   slot: null },
  fern_frond:    { name: 'Fern Frond',   icon: '🌱',   slot: null },
  ring_cap:      { name: 'Ring Cap',     icon: '🍄',   slot: null },
};
