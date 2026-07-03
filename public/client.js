(function () {
"use strict";

const canvas = document.getElementById('game');
let W = 0, H = 0;
function resize(){
  W = window.innerWidth; H = window.innerHeight;
  if (renderer) renderer.setSize(W, H);
  if (activeCamera) {
    activeCamera.aspect = W / H;
    activeCamera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Networking  (unchanged protocol: server only ever sees plain x/y numbers —
// the 3D scene just renders that same x/y as a ground-plane x/z coordinate.
// Indoor coordinates reuse each building's own outdoor footprint rectangle
// so they stay inside the server's existing [0,width]/[0,height] clamp —
// no server-side changes were needed for movement.)
// ---------------------------------------------------------------------------
const proto = location.protocol === 'https:' ? 'wss' : 'ws';
let ws;
let lastJoinPayload = null;
let gameStarted = false;
let reconnectTimer = null;

let myId = null;
let world = null;       // whichever outdoor map is currently active (town's world, or world2) — see enterWilds()/exitWilds()
let TOWN_WORLD = null;  // stable reference to the town's world object, since `world` gets reassigned on map-switch
let world2 = null;      // The Wilds — see buildWildsScene()/enterWilds()
let TOWN_WALLS = [];    // snapshot of `walls` once initScene() finishes building the town (incl. tree colliders)
const WILDS_WALLS = []; // the Wilds has no collidable decor, so this just stays empty
let OUTDOOR_KIOSKS = []; // interact points in the town's outdoor scene — currently just the portal
let WILDS_KIOSKS = [];   // interact points in the Wilds scene

// ── Wildlands NPC factions ────────────────────────────────────────────────────
// The Unbound Circle: wandering druids in the western wilds (~2200, 5000)
// The Thornwarden Scouts: militant camp in the eastern wilds (~7800, 5000)
// Both factions tie into "The Thornreach Chronicles" storyline.
const WILDS_NPCS = [
  { id: 'npc_morvaine', name: 'Elder Morvaine',       charId: 2, x: 2200, y: 5100 },
  { id: 'npc_talwyn',   name: 'Sister Talwyn',         charId: 0, x: 2360, y: 5010 },
  { id: 'npc_caelum',   name: 'Brother Caelum',        charId: 3, x: 2210, y: 4890 },
  { id: 'npc_rhedyn',   name: 'Captain Rhedyn',        charId: 1, x: 7800, y: 4900 },
  { id: 'npc_brynn',    name: 'Quartermaster Brynn',   charId: 3, x: 7960, y: 5010 },
  { id: 'npc_elara',    name: 'Scout Elara',           charId: 4, x: 7800, y: 5110 },
];
let DUNGEON_KIOSKS = []; // interact points in the dungeon — the exit portal, rebuilt per-entry
const DUNGEON_WORLD = { width: 800, height: 800, buildings: [], spawn: { x: 400, y: 700 } };
let dungeonMobVisuals = {}; // id -> { mesh, x, y, targetX, targetY, facing, targetFacing, dead, initialized }
let walls = [];           // generated collision rects, derived from world.buildings
let players = {};         // id -> {id,name,color,x,y,room,targetX,targetY,...visual state}
let me = null;            // convenience pointer to players[myId]
let currentRoom = 'outside';
const messagesByRoom = {}; // room id -> array of {name,color,text,ts}

// Picked once on the join screen (and remembered in localStorage), sent to
// the server as charId, and echoed back on every player's record so every
// client renders the same look for everyone — see createHumanoid() far
// below for how each of these actually gets built into a 3D model.
// "color" (server-assigned, separate from this) still only drives the
// name-tag/chat-bubble color, unchanged from before this feature existed.
const CHARACTER_PRESETS = [
  // charId 0 is special: it's the only character that can open a Spellbook
  // and cast spells (see SPELL_CATALOG / the Spellbook button below) — the
  // hat is what reads "witch" at a glance, the green robe is unchanged from
  // when this preset was just "Adventurer."
  { name: 'Witch',     skin: 0xffd9b3, hair: 0x1a1410, hairStyle: 'witchhat', eye: 0x4a3320, shirt: 0x4caf50, pants: 0x2b2b3a },
  // charId 1: Werewolf — wolf ears + snout built in addHair('wolf',...); amber
  // fur skin, deep-orange shirt, chocolate pants. charId 1 is the only one
  // that can open the Wolf Attacks panel and use cast_attack.
  { name: 'Werewolf',  skin: 0xd4713c, hair: 0x8a3a10, hairStyle: 'wolf',    eye: 0xf5a623, shirt: 0xc4631a, pants: 0x5a2808 },
  { name: 'Mystic',     skin: 0xc98a5b, hair: 0x222222, hairStyle: 'long',     eye: 0x3c7a4f, shirt: 0x9b5fc0, pants: 0x1c1c2e },
  { name: 'Knight',     skin: 0xffe0c2, hair: 0xb0b0b0, hairStyle: 'buzz',     eye: 0x6f6f6f, shirt: 0x6f8fae, pants: 0x4a4a4a },
  { name: 'Wanderer',   skin: 0x7a4a2f, hair: 0xe0e0e0, hairStyle: 'mohawk',   eye: 0xa57b3c, shirt: 0xc0596f, pants: 0x2f2f2f }
];

// Must stay in sync with ITEM_CATALOG in server.js — the server is the
// source of truth for which itemIds are valid and equippable as what,
// this just supplies the icon/name/slot to render and to decide which
// "Equip as..." buttons to show for a given item.
const ITEM_CATALOG = {
  iron_sword:     { name: 'Iron Sword',     icon: '⚔️', slot: 'weapon', atk: 12, desc: 'A reliable blade forged from iron.' },
  spell_tome:     { name: 'Spell Tome',     icon: '📕', slot: 'weapon', atk: 10, desc: 'Channels arcane energy into strikes.' },
  steel_shield:   { name: 'Steel Shield',   icon: '🛡️', slot: 'chest',  def: 10, desc: 'Heavy protection for the torso.' },
  wizard_hat:     { name: 'Wizard Hat',     icon: '🎩', slot: 'head',   def: 5,  desc: 'Classic headwear for the studious mage.' },
  leather_boots:  { name: 'Leather Boots',  icon: '👢', slot: 'feet',   def: 4,  spd: 5,  desc: 'Light boots that let you move freely.' },
  silver_ring:    { name: 'Silver Ring',    icon: '💍', slot: 'ring',   def: 3,  desc: 'A finely crafted silver band.' },
  healing_potion: { name: 'Healing Potion', icon: '🧪', slot: null, desc: 'Restores 30 HP when used.' },
  magic_scroll:   { name: 'Magic Scroll',   icon: '📜', slot: null, desc: 'A scroll sealed with arcane energy.' },
  dragon_scale:   { name: 'Dragon Scale',   icon: '🐉', slot: null, desc: 'Rare scale from a fallen dragon.' },
  enchanted_gem:  { name: 'Enchanted Gem',  icon: '💎', slot: null, desc: 'Pulsing with raw magical potential.' },
  ancient_coin:   { name: 'Ancient Coin',   icon: '🪙', slot: null, desc: 'Currency from a forgotten kingdom.' },
  golden_chalice: { name: 'Golden Chalice', icon: '🏆', slot: null, desc: 'A ceremonial goblet of pure gold.' },
  hard_drive:     { name: 'Hard Drive',     icon: '💽', slot: null, desc: 'Holds 24 notes with password protection.' },
  wood:           { name: 'Wood',           icon: '🪵', slot: null, desc: 'Sturdy timber from the forest.' },
  berries:        { name: 'Berries',        icon: '🍓', slot: null, desc: 'Wild berries. Probably edible.' },
  flower_bloom:   { name: 'Flower',         icon: '🌸', slot: null, desc: 'A delicate wildflower.' },
  // Character starter sets
  witch_robe:     { name: "Witch's Robe",   icon: '🌑', slot: 'chest', def: 6,  desc: "Robes woven with shadow magic." },
  hexed_boots:    { name: 'Hexed Boots',    icon: '🌙', slot: 'feet',  def: 5,  desc: 'Boots cursed to never wear out.' },
  hex_amulet:     { name: 'Hex Amulet',     icon: '🔮', slot: 'ring',  def: 4,  desc: 'Amplifies the wearer\'s hex power.' },
  beast_crown:    { name: 'Beast Crown',    icon: '👑', slot: 'head',  def: 6,  desc: 'Thorned crown of the alpha.' },
  beast_hide:     { name: 'Beast Hide',     icon: '🐺', slot: 'chest', def: 8,  desc: 'Thick fur that shrugs off blows.' },
  paw_boots:      { name: 'Paw Boots',      icon: '🐾', slot: 'feet',  def: 6,  spd: 8, desc: 'Swift paws for the hunt.' },
  spirit_veil:    { name: 'Spirit Veil',    icon: '✨', slot: 'head',  def: 5,  desc: 'A veil woven from starlight.' },
  spirit_robe:    { name: 'Spirit Robe',    icon: '🌌', slot: 'chest', def: 6,  desc: 'Shimmering robes of the cosmos.' },
  spirit_ring:    { name: 'Spirit Ring',    icon: '💜', slot: 'ring',  def: 4,  desc: 'Resonates with ethereal forces.' },
  knights_helm:   { name: "Knight's Helm",  icon: '⛑️', slot: 'head',  def: 8,  desc: 'Forged for those who stand their ground.' },
  order_signet:   { name: "Order's Signet", icon: '🔰', slot: 'ring',  def: 5,  desc: 'Seal of an ancient knightly order.' },
  travelers_hood: { name: "Traveler's Hood",icon: '🧢', slot: 'head',  def: 5,  desc: 'Keeps the wind and eyes off you.' },
  travelers_vest: { name: "Traveler's Vest",icon: '🧥', slot: 'chest', def: 7,  desc: 'Many pockets. Well-worn leather.' },
  trail_ring:     { name: 'Trail Ring',     icon: '🪬', slot: 'ring',  def: 3,  spd: 3, desc: 'Keeps the road beneath your feet.' },
  // Witch Hazel's shop items — mirrored from server.js ITEM_CATALOG
  cursed_blade:   { name: 'Cursed Blade',   icon: '🗡️', slot: 'weapon', atk: 20, desc: 'A blade that hungers for shadow.' },
  shadow_staff:   { name: 'Shadow Staff',   icon: '🪄', slot: 'weapon', atk: 18, desc: 'Channels dark energy into spells.' },
  bone_armor:     { name: 'Bone Armor',     icon: '🦴', slot: 'chest',  def: 16, desc: 'Crafted from the bones of the fallen.' },
  shadow_cloak:   { name: 'Shadow Cloak',   icon: '🌑', slot: 'chest',  def: 14, desc: 'Wraps the wearer in living shadow.' },
  witches_boon:   { name: "Witch's Boon",   icon: '🔮', slot: 'ring',   def: 8,  desc: "Hazel's blessing sealed in glass." },
  dread_helm:     { name: 'Dread Helm',     icon: '💀', slot: 'head',   def: 12, desc: 'Inspires fear in all who see it.' },
  soul_treads:    { name: 'Soul Treads',    icon: '👁️', slot: 'feet',   def: 10, spd: 6, desc: 'The eyes on the soles watch your path.' },
  void_staff:     { name: 'Void Staff',     icon: '☄️', slot: 'weapon', atk: 24, desc: 'Tears holes in reality with each swing.' },
  shadow_crown:   { name: 'Shadow Crown',   icon: '🌙', slot: 'head',   def: 15, desc: 'Crown of the night, cold as midnight.' },
  abyssal_armor:  { name: 'Abyssal Armor',  icon: '⚫', slot: 'chest',  def: 20, desc: 'Forged in the deepest dark.' },
  death_ring:     { name: 'Death Ring',     icon: '💍', slot: 'ring',   def: 10, desc: 'Only the doomed dare to wear it.' },
  wraith_treads:  { name: 'Wraith Treads',  icon: '🌫️', slot: 'feet',   def: 12, spd: 10, desc: 'Step between shadows like a ghost.' },
  // The Wilds' 16 harvestable plants — name/icon mirrored from server.js's
  // PLANT_CATALOG. The actual effect (what happens when used) is resolved
  // server-side; the client only needs to know these exist and are usable.
  swift_root:           { name: 'Swift Root',          icon: '🥕', slot: null },
  featherleaf:           { name: 'Featherleaf',          icon: '🍃', slot: null },
  giants_cap:             { name: "Giant's Cap",           icon: '🍄', slot: null },
  shrinking_violet:       { name: 'Shrinking Violet',      icon: '🌷', slot: null },
  pumpkin_blossom:        { name: 'Pumpkin Blossom',       icon: '🎃', slot: null },
  bats_breath:            { name: "Bat's Breath Flower",   icon: '🦇', slot: null },
  rainbow_petal:          { name: 'Rainbow Petal',         icon: '🌈', slot: null },
  ravens_feather_plant:   { name: "Raven's Feather Plant", icon: '🪶', slot: null },
  stumbleweed:            { name: 'Stumbleweed',           icon: '🌾', slot: null },
  gibberish_root:         { name: 'Gibberish Root',        icon: '🫚', slot: null },
  toadstool:              { name: 'Toadstool',             icon: '🐸', slot: null },
  wolfsbane_bloom:        { name: 'Wolfsbane Bloom',       icon: '🌺', slot: null },
  meditation_lotus:       { name: 'Meditation Lotus',      icon: '🪷', slot: null },
  healing_herb:           { name: 'Healing Herb',          icon: '🌿', slot: null, desc: 'Restores 40 HP when consumed.' },
  regen_root:             { name: 'Regen Root',            icon: '🫘', slot: null, desc: 'Regenerates HP over 15 seconds.' },
  cleansing_clover:       { name: 'Cleansing Clover',      icon: '🍀', slot: null, desc: 'Removes all status effects.' },
  // --- Witch-brewed potions ---
  health_potion_ii:       { name: 'Greater Healing Potion', icon: '❤️‍🔥', slot: null, desc: 'Restores 80 HP. Brewed by Witch Hazel.' },
  regen_brew:             { name: 'Regen Brew',             icon: '🫧',  slot: null, desc: 'Regenerates HP over 45 seconds.' },
  swift_brew:             { name: 'Swift Brew',             icon: '💨',  slot: null, desc: 'Speed boost for 45 seconds.' },
  shadow_draught:         { name: 'Shadow Draught',         icon: '🌘',  slot: null, desc: 'Raven cloak for 60 seconds.' },
  giants_elixir:          { name: "Giant's Elixir",         icon: '🍄‍🟫', slot: null, desc: 'Giant form for 45 seconds.' },
  bat_swarm_potion:       { name: 'Bat Swarm Potion',       icon: '🦇',  slot: null, desc: 'Surrounds you with bats for 45 seconds.' },
  clarity_draught:        { name: 'Clarity Draught',        icon: '✨',  slot: null, desc: 'Cleanses all status effects.' },
  chaos_brew:             { name: 'Chaos Brew',             icon: '🌈',  slot: null, desc: 'Wild colour effects for 60 seconds.' },
  wolf_pact_brew:         { name: "Wolf's Pact Brew",       icon: '🐺',  slot: null, desc: 'Doubles all stats for 1 hour. A gift from Lexton Greyfur.' },
  // --- Loot materials ---
  fur_scrap:      { name: 'Fur Scrap',      icon: '🧶', slot: null, desc: 'Rough scraps of fur. Used in leatherworking.' },
  animal_pelt:    { name: 'Animal Pelt',    icon: '🐻', slot: null, desc: 'A cured pelt from a wilds creature.' },
  bone_shard:     { name: 'Bone Shard',     icon: '🦴', slot: null, desc: 'Jagged bone. Useful for crafting.' },
  leather_hide:   { name: 'Leather Hide',   icon: '🟤', slot: null, desc: 'Thick hide. Core material for armor.' },
  iron_ore:       { name: 'Iron Ore',       icon: '⛏️', slot: null, desc: 'Raw iron ore. Smelt it into weapons.' },
  enchanted_fur:  { name: 'Enchanted Fur',  icon: '🌟', slot: null, desc: 'Fur imbued with magical energy.' },
  shadow_essence: { name: 'Shadow Essence', icon: '🫥', slot: null, desc: 'Distilled darkness from shadow creatures.' },
};

const PLANT_EFFECTS = new Set([
  'swift_root', 'featherleaf', 'giants_cap', 'shrinking_violet', 'pumpkin_blossom',
  'bats_breath', 'rainbow_petal', 'ravens_feather_plant', 'stumbleweed', 'gibberish_root',
  'toadstool', 'wolfsbane_bloom', 'meditation_lotus', 'healing_herb', 'regen_root', 'cleansing_clover',
  // Witch-brewed potions use the same server-side plant handler
  'health_potion_ii', 'regen_brew', 'swift_brew', 'shadow_draught',
  'giants_elixir', 'bat_swarm_potion', 'clarity_draught', 'chaos_brew',
  'wolf_pact_brew',
]);

// A small hand-drawn flower (5 petals + center, on a short stem/leaf) used
// in place of the 🌸 emoji wherever a Flower item's icon is rendered as a
// real DOM element (inventory/bank grid cells) rather than plain text — the
// flat emoji read poorly at icon size, this reads as an actual bloom.
// Petal positions: each petal sits at (0,-4) relative to the flower center
// and is rotated 0/72/144/216/288° around that center to ring all five
// evenly (360°/5).
const FLOWER_ICON_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
  <path d="M11 22 L11 13" stroke="#3a7a3f" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  <path d="M11 18c-2-0.3-3.4-1.8-3.6-3.6 2 0.2 3.4 1.7 3.6 3.6z" fill="#3a7a3f"/>
  <g transform="translate(12,9)">
    <g fill="#ff8fb3">
      <ellipse cx="0" cy="-4" rx="2.6" ry="4" transform="rotate(0)"/>
      <ellipse cx="0" cy="-4" rx="2.6" ry="4" transform="rotate(72)"/>
      <ellipse cx="0" cy="-4" rx="2.6" ry="4" transform="rotate(144)"/>
      <ellipse cx="0" cy="-4" rx="2.6" ry="4" transform="rotate(216)"/>
      <ellipse cx="0" cy="-4" rx="2.6" ry="4" transform="rotate(288)"/>
    </g>
    <circle r="2.6" fill="#ffd43b"/>
  </g>
</svg>`;

// Used everywhere an item's icon needs to be a real DOM element (grid
// cells) rather than concatenated into a text label/title. Falls back to
// the plain emoji span for every item except the Flower, which gets the
// SVG above instead.
function buildItemIconEl(itemId) {
  if (itemId === 'flower_bloom') {
    const wrap = document.createElement('span');
    wrap.className = 'itemIconSvg';
    wrap.innerHTML = FLOWER_ICON_SVG;
    return wrap;
  }
  const item = ITEM_CATALOG[itemId];
  const span = document.createElement('span');
  span.textContent = item ? item.icon : '❓';
  return span;
}

// Must stay in sync with SPELL_CATALOG in server.js — the server enforces
// who can cast what and owns all the validation, this just supplies what
// the Spellbook UI displays and which target picker (or none) to show.
// kind 'self' spells never show a target picker; effect 'camera' is Open
// 3rd Eye, the one spell that doesn't apply an immediate status (see
// SPELL_STATUS_HANDLERS below for how the other 10 statuses render).
const SPELL_CATALOG = {
  open_third_eye:  { name: 'Open 3rd Eye',       icon: '👁️', kind: 'targeted', effect: 'camera',
    description: "Asks to peer through a target's own eyes — with their permission — and sends what it sees back to you as a note." },
  toads_tongue:    { name: "Toad's Tongue",      icon: '🐸', kind: 'targeted', effect: 'status',
    description: 'Curses the target to croak mid-sentence in chat for a while.' },
  stumble_hex:     { name: 'Stumble Hex',        icon: '🦶', kind: 'targeted', effect: 'status',
    description: "Hexes the target's feet — halves their walking speed." },
  featherfall:     { name: 'Featherfall Curse',  icon: '🪶', kind: 'targeted', effect: 'status',
    description: 'Fills the target with helium dread — they bounce absurdly high when they jump.' },
  shrinking_curse: { name: 'Shrinking Curse',    icon: '🔻', kind: 'targeted', effect: 'status',
    description: 'Shrinks the target down to half size.' },
  giants_folly:    { name: "Giant's Folly",      icon: '🔺', kind: 'targeted', effect: 'status',
    description: 'Swells the target up to twice their size.' },
  pumpkin_head:    { name: 'Pumpkin Head',       icon: '🎃', kind: 'targeted', effect: 'status',
    description: "Replaces the target's head with a jack-o'-lantern." },
  bat_swarm:       { name: 'Bat Swarm',          icon: '🦇', kind: 'targeted', effect: 'status',
    description: 'Summons a circling swarm of bats around the target.' },
  color_curse:     { name: 'Color Curse',        icon: '🌈', kind: 'targeted', effect: 'status',
    description: "Curses the target's clothes to cycle through every color." },
  silver_tongue:   { name: 'Silver Tongue Hex',  icon: '🗣️', kind: 'targeted', effect: 'status',
    description: "Tangles the target's words into nonsense in chat for a while." },
  ravens_cloak:    { name: "Raven's Cloak",      icon: '🪽', kind: 'self', effect: 'status',
    description: 'Wraps the caster in a swirl of dark feathers.' },
  glimpse_future:  { name: 'Glimpse the Future', icon: '🔮', kind: 'targeted', effect: 'reveal',
    description: "Reveals a target's current location to the caster." }
};

// Must stay in sync with WEREWOLF_ATTACK_CATALOG in server.js.
// kind: 'aoe' = hits every player within AOE_RADIUS (no target picker shown)
//       'self' = only affects the Werewolf themselves
//       'targeted' = single target picker required
// effect: 'note_steal' = Rapid Swipe's unique note theft
const WEREWOLF_ATTACK_CATALOG = {
  rapid_swipe:      { name: 'Rapid Swipe',       icon: '🐾', kind: 'targeted', effect: 'note_steal',
    description: "Lifts one undestroyed note straight out of the target's inbox before they can burn it — or comes up empty if they have none." },
  lunar_howl:       { name: 'Lunar Howl',       icon: '🌕', kind: 'aoe', effect: 'status', statusType: 'stumble',    durationMs: 15000,
    description: 'A moon-splitting howl halves the movement speed of everyone in range.' },
  terrifying_roar:  { name: 'Terrifying Roar',  icon: '😱', kind: 'aoe', effect: 'status', statusType: 'gibberish', durationMs: 20000,
    description: 'A roar so fearsome it scrambles nearby players\' words in chat.' },
  alpha_bite:       { name: 'Alpha Bite',        icon: '🐺', kind: 'targeted', effect: 'status', statusType: 'shrink',     durationMs: 25000,
    description: 'Chomps the target down to half their size.' },
  feral_dash:       { name: 'Feral Dash',        icon: '💨', kind: 'self', effect: 'status', statusType: 'speedboost', durationMs: 12000,
    description: 'Surges with wolf speed — doubles movement for a short burst.' },
  blood_frenzy:     { name: 'Blood Frenzy',      icon: '🩸', kind: 'self', effect: 'status', statusType: 'giant',      durationMs: 15000,
    description: 'Swells with feral rage — doubles the Werewolf\'s size.' },
  bone_crunch:      { name: 'Bone Crunch',       icon: '🦴', kind: 'targeted', effect: 'status', statusType: 'feather',    durationMs: 20000,
    description: 'Cracks the target\'s joints so they bounce absurdly high when they jump.' },
  shadow_claws:     { name: 'Shadow Claws',      icon: '🌑', kind: 'targeted', effect: 'status', statusType: 'pumpkin',    durationMs: 30000,
    description: "Mangles the target's face into a jack-o'-lantern." },
  wolf_mark:        { name: 'Wolf Mark',          icon: '🔶', kind: 'targeted', effect: 'status', statusType: 'wolfmark',   durationMs: 30000,
    description: 'Brands the target with a glowing amber wolf mark floating above their head.' },
  feral_haze:       { name: 'Feral Haze',        icon: '🔥', kind: 'targeted', effect: 'status', statusType: 'colorcycle', durationMs: 20000,
    description: "Drenches the target's clothing in shifting feral colors." },
  snarl:            { name: 'Snarl',             icon: '😤', kind: 'targeted', effect: 'status', statusType: 'bats',       durationMs: 15000,
    description: 'Summons a swarm of shadow-bats to circle the target.' },
  scent_trail:      { name: 'Scent Trail',       icon: '🎯', kind: 'targeted', effect: 'howl_location',
    description: "Howls at the target, inviting them to howl back. If they join in, their approximate real-world location (never exact) is sent to you privately — entirely their choice, and never posted anywhere." }
};

// Must stay in sync with WANDERER_ATTACK_CATALOG in server.js. charId 4 only.
// effect 'spyglass' is Spy Glass's unique one — kind 'building' shows a
// picker of every building (not the usual player target picker); casting
// opens a live spyglassPanel window into that room's chat for durationMs.
// Not covert: the server tells everyone actually in that room the moment
// it's cast (spyglass_notice), the same way every other attack notifies
// whoever it affects — see openSpyGlassPanel/spyglass_* handlers below.
const WANDERER_ATTACK_CATALOG = {
  spy_glass:          { name: 'Spy Glass',          icon: '🔭', kind: 'building', effect: 'spyglass', durationMs: 60000,
    description: "Peer into a building of your choice from anywhere — opens a live window into that room's chat for 60 seconds. Everyone in that room is told the moment you cast it." },
  sleight_of_hand:    { name: 'Sleight of Hand',    icon: '🤏', kind: 'targeted', effect: 'pickpocket', stealChance: 0.35,
    description: "Peek into a target's pockets and try to lift an item — about a 1-in-3 chance of actually taking something. They'll always know it happened." },
  echo_canyon:        { name: 'Echo Canyon',        icon: '🏞️', kind: 'aoe', effect: 'status', statusType: 'gibberish', durationMs: 20000,
    description: "A canyon echo scrambles everyone nearby's words in chat." },
  deep_meditation:    { name: 'Deep Meditation',    icon: '🧘', kind: 'self', effect: 'status', statusType: 'meditate', durationMs: 60000,
    description: 'Sit and meditate, then rise off the ground for a minute — you can still move freely while floating.' },
  heavy_pack:         { name: 'Heavy Pack',         icon: '🎒', kind: 'targeted', effect: 'status', statusType: 'shrink',     durationMs: 20000,
    description: "Stuffs the target's pack with stones, shrinking them under the weight." },
  endless_road:       { name: 'Endless Road',       icon: '🥿', kind: 'targeted', effect: 'status', statusType: 'stumble',    durationMs: 25000,
    description: "Curses the target's boots — the road stretches on forever, halving their speed." },
  featherlight_pack:  { name: 'Featherlight Pack',  icon: '🪶', kind: 'targeted', effect: 'status', statusType: 'feather',    durationMs: 20000,
    description: "Lightens the target's pack — they bounce absurdly high when they jump." },
  shadow_owls:        { name: 'Shadow Owls',        icon: '🦉', kind: 'targeted', effect: 'status', statusType: 'bats',       durationMs: 15000,
    description: 'Summons a circling swarm of night owls around the target.' },
  wanderlust:         { name: 'Wanderlust',         icon: '🥾', kind: 'self', effect: 'status', statusType: 'speedboost', durationMs: 12000,
    description: 'A surge of wanderlust quickens your pace for a short burst.' },
  campfire_tale:      { name: 'Campfire Tale',      icon: '🔥', kind: 'self', effect: 'status', statusType: 'giant',      durationMs: 15000,
    description: 'Tall tales by the campfire make you feel larger than life.' },
  nightwatch_cloak:   { name: 'Nightwatch Cloak',   icon: '🌌', kind: 'self', effect: 'status', statusType: 'ravencloak', durationMs: 30000,
    description: 'Wraps you in the hush of the night watch.' },
  compass_trick:      { name: 'Compass Trick',      icon: '🧭', kind: 'targeted', effect: 'reveal',
    description: "Bends the target's compass needle back toward you, revealing where they are." }
};

// charId -> attack catalog the player can use. Drives both which characters
// get the Attacks button at all and which catalog the panel renders from —
// adding a third attack-using character later is just one more entry here.
const ATTACK_CATALOGS = { 1: WEREWOLF_ATTACK_CATALOG, 4: WANDERER_ATTACK_CATALOG };

function setupWs() {
  ws = new WebSocket(proto + '://' + location.host);
  ws.addEventListener('open', onWsOpen);
  ws.addEventListener('close', onWsClose);
  ws.addEventListener('error', onWsError);
  ws.addEventListener('message', onWsMessage);
}
function onWsOpen() { setStatus(true); }
function onWsClose() {
  setStatus(false);
  if (gameStarted && lastJoinPayload && !reconnectTimer) {
    showReconnectBanner(true);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; setupWs(); }, 2000);
  }
}
function onWsError() { setStatus(false); }
function onWsMessage(ev) {
  let msg;
  try { msg = JSON.parse(ev.data); } catch (e) { return; }

  if (msg.type === 'init') {
    const wasStarted = gameStarted;
    myId = msg.id;
    world = msg.world;
    TOWN_WORLD = world;
    world2 = msg.world2 || world2;
    walls = buildWalls(world);
    // Clear all existing remote-player meshes before rebuilding the list,
    // whether this is the first join or a reconnect after a dropped connection.
    for (const id of Object.keys(players)) removePlayer(id);
    players = {};
    if (!wasStarted) {
      initScene(world);
    } else {
      // Reconnect: scene is already built. The server never remembers
      // where a connection was — every (re)connect lands fresh at the town
      // spawn — so if we were indoors, or out in the Wilds, force the
      // client's view back to outdoor/town to match.
      if (mode === 'indoor' || activeScene === wildsScene || activeScene === dungeonScene) {
        mode = 'outdoor';
        currentRoom = 'outside';
        swapToTownMap();
      }
    }
    for (const p of msg.players) addPlayer(p);
    me = players[myId];
    if (!wasStarted) {
      document.getElementById('joinScreen').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('healthHud').classList.remove('hidden');
      updateHealthHud();
      updateXPDisplay();
      document.getElementById('inventoryBtn').classList.remove('hidden');
      // Only the Witch (charId 0) gets a Spellbook — see SPELL_CATALOG.
      if (me && me.charId === 0) document.getElementById('spellbookBtn').classList.remove('hidden');
      // Any character with an entry in ATTACK_CATALOGS gets the Attacks button.
      myAttackCatalog = me ? ATTACK_CATALOGS[me.charId] || null : null;
      if (myAttackCatalog) document.getElementById('attackBtn').classList.remove('hidden');
      // The hotbar mirrors whichever 12-ability catalog this character has
      // (Witch's spells or Werewolf/Wanderer's attacks) so number/dash/equals
      // keys cast instantly without opening the Spellbook/Attacks modal.
      if (me && me.charId === 0) {
        myActionCatalog = SPELL_CATALOG; myActionMsgType = 'cast_spell'; myActionIdField = 'spellId';
      } else if (myAttackCatalog) {
        myActionCatalog = myAttackCatalog; myActionMsgType = 'cast_attack'; myActionIdField = 'attackId';
      } else {
        myActionCatalog = null; myActionMsgType = null; myActionIdField = null;
      }
      buildHotbar();
      if (isTouchDevice()) document.getElementById('joystick').classList.add('show');
      refreshUnlockUI();
      resize();
      last = performance.now();
      requestAnimationFrame(loop);
      gameStarted = true;
    } else {
      showReconnectBanner(false);
      setUnlockToast('Reconnected.');
      updateHealthHud();
    }
    return;
  }

  if (msg.type === 'join_error') {
    showJoinError(msg.message);
    return;
  }

  if (msg.type === 'player_joined') {
    addPlayer(msg.player);
    if (inventoryOpen) refreshNoteRecipients();
    return;
  }

  if (msg.type === 'player_left') {
    removePlayer(msg.id);
    if (inventoryOpen) refreshNoteRecipients();
    return;
  }

  if (msg.type === 'state') {
    for (const p of msg.players) {
      if (p.id === myId) {
        // Trust local prediction for our own position/room, but status
        // effects are cast by *other* players — there's no local
        // prediction for those, so they still need to flow in for us too.
        if (me) {
          me.activeStatus = p.activeStatus || null;
          applyStatusVisual(myId, me.activeStatus);
          if (typeof p.health === 'number' && p.health !== me.health) {
            me.health = p.health;
            updateHealthHud();
          }
        }
        continue;
      }
      const existing = players[p.id];
      if (existing) {
        existing.targetX = p.x; existing.targetY = p.y; existing.room = p.room; existing.name = p.name; existing.color = p.color;
        existing.equippedWeapon = p.equippedWeapon || null;
        existing.equippedHead   = p.equippedHead   || null;
        existing.equippedChest  = p.equippedChest  || null;
        existing.equippedFeet   = p.equippedFeet   || null;
        existing.equippedRing   = p.equippedRing   || null;
        applyEquipVisual(p.id, p);
        existing.activeStatus = p.activeStatus || null;
        applyStatusVisual(p.id, existing.activeStatus);
        existing.isDead = !!p.isDead;
      } else {
        addPlayer(p);
      }
    }
    return;
  }

  if (msg.type === 'wildlife_state') {
    lastWildlifeIsNight = !!msg.isNight;
    applyAnimalState(msg.animals);
    applyMobState(msg.mobs);
    if (msg.animals2) applyAnimal2State(msg.animals2);
    if (msg.mobs2) applyMob2State(msg.mobs2);
    if (msg.decor) applyDecorState(msg.decor);
    if (msg.dungeonMobs) applyDungeonMobState(msg.dungeonMobs);
    if (msg.villageNpcs) applyVillageNpcState(msg.villageNpcs);
    return;
  }

  if (msg.type === 'decor_state') {
    applyDecorState(msg.decor);
    return;
  }

  if (msg.type === 'harvest_result') {
    setUnlockToast('🌿 ' + msg.message);
    return;
  }

  if (msg.type === 'harvest_error') {
    setUnlockToast('🌿 ' + msg.message);
    return;
  }

  if (msg.type === 'use_result') {
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'use_error') {
    if (inventoryOpen && invItemsTabActive) document.getElementById('invModalErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'quest_offer') {
    if (msg.questId) {
      showQuestOffer(msg);
    } else {
      setUnlockToast(`💬 ${msg.npcName}: "${msg.message}"`);
    }
    return;
  }

  if (msg.type === 'quest_started') {
    closeQuestDialogue();
    setUnlockToast(`📜 Quest started: "${msg.questName}" — ${msg.description}`);
    updateQuestTracker(msg.questId, msg.questName, 0, msg.target);
    return;
  }

  if (msg.type === 'quest_update') {
    updateQuestTracker(msg.questId, msg.questName, msg.progress, msg.target);
    return;
  }

  if (msg.type === 'quest_complete') {
    clearQuestTracker();
    setUnlockToast(msg.message);
    // Refresh inventory so newly granted items appear immediately
    ws.send(JSON.stringify({ type: 'inventory_open' }));
    return;
  }

  if (msg.type === 'quest_cancelled') {
    clearQuestTracker();
    return;
  }

  if (msg.type === 'wolf_pact_result') {
    closeBloodPactModal();
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'xp_gain') {
    if (me) { me.xp = msg.xp; me.level = msg.level; me.skillPoints = msg.skillPoints; }
    updateXPDisplay();
    return;
  }

  if (msg.type === 'level_up') {
    if (me) { me.level = msg.level; me.skillPoints = msg.skillPoints; }
    updateXPDisplay();
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'struck') {
    setUnlockToast(`⚔️ ${msg.byName} hit you for ${msg.damage}!`);
    return;
  }

  if (msg.type === 'you_died') {
    if (me) { me.isDead = true; me.health = 0; }
    updateHealthHud();
    const v = visuals[myId];
    if (v) { v.deathAnimStartAt = performance.now(); }
    showGhostOverlay(msg.byName);
    setUnlockToast(`💀 Slain by ${msg.byName}. You are a ghost.`);
    return;
  }

  if (msg.type === 'you_respawned') {
    if (me) { me.isDead = false; me.health = 100; me.x = msg.x; me.y = msg.y; me.room = msg.room; }
    seatedAt = null;
    hideGhostOverlay();
    const v = visuals[myId];
    if (v) { v.deathAnimStartAt = null; v.group.rotation.x = 0; }
    if (msg.room === 'wilds') {
      mode = 'outdoor'; swapToWildsMap();
    } else if (msg.room === 'outside') {
      mode = 'outdoor'; swapToTownMap();
    }
    updateHealthHud();
    setUnlockToast('✨ You have respawned!');
    return;
  }

  if (msg.type === 'dungeon_entered') {
    if (me) { me.x = msg.spawn.x; me.y = msg.spawn.y; me.room = msg.room; }
    mode = 'outdoor';
    swapToDungeonMap();
    ws.send(JSON.stringify({ type: 'move', x: msg.spawn.x, y: msg.spawn.y, room: msg.room }));
    setUnlockToast(`⚡ Entered dungeon tier ${msg.tier} — Level ${msg.level} Wildlands`);
    return;
  }

  if (msg.type === 'dungeon_exited') {
    if (me) { me.x = msg.x; me.y = msg.y; me.room = msg.room; }
    mode = 'outdoor';
    if (msg.room === 'wilds') {
      swapToWildsMap();
    } else {
      swapToTownMap();
    }
    setUnlockToast('⚡ You exit the dungeon.');
    return;
  }

  if (msg.type === 'bank_state') {
    lastBankState = { balance: msg.balance, slots: msg.slots };
    renderBankModal();
    if (auctionModalOpen) populateAuctionItemSelect();
    if (sendMoneyModalOpen) {
      const bal = document.getElementById('sendMoneyBalance');
      if (bal) bal.textContent = String(msg.balance);
    }
    return;
  }

  if (msg.type === 'bank_error') {
    if (bankModalOpen) document.getElementById('bankModalErr').textContent = msg.message;
    else if (auctionModalOpen) document.getElementById('auctionModalErr').textContent = msg.message;
    else if (sendMoneyModalOpen) document.getElementById('sendMoneyErr').textContent = msg.message;
    else if (inventoryOpen && invItemsTabActive) document.getElementById('invModalErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'money_sent') {
    if (sendMoneyModalOpen) document.getElementById('sendMoneyErr').textContent = '';
    setUnlockToast(`💸 Sent ${msg.amount} gold to ${msg.toName}`);
    return;
  }

  if (msg.type === 'money_received') {
    setUnlockToast(`💰 ${msg.fromName} sent you ${msg.amount} gold!`);
    return;
  }

  if (msg.type === 'auction_state') {
    lastAuctionListings = msg.listings;
    renderAuctionModal();
    return;
  }

  if (msg.type === 'inventory_state') {
    lastInventoryState = {
      slots: msg.slots,
      equippedWeapon: msg.equippedWeapon || null,
      equippedHead:   msg.equippedHead   || null,
      equippedChest:  msg.equippedChest  || null,
      equippedFeet:   msg.equippedFeet   || null,
      equippedRing:   msg.equippedRing   || null
    };
    renderInventoryItemsPanel();
    if (bankModalOpen) populateBankDepositSelect();
    applyMyEquipVisual(msg);
    return;
  }

  if (msg.type === 'spell_result') {
    if (spellbookOpen) document.getElementById('spellbookErr').textContent = '';
    setUnlockToast(msg.message);
    if (msg.revealTargetId) showGlimpseBeacon(msg.revealTargetId);
    return;
  }

  if (msg.type === 'spell_error') {
    if (spellbookOpen) document.getElementById('spellbookErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'spell_consent_request') {
    if (thirdEyeOptIn) {
      autoGrantSpellConsent(msg.requestId, msg.casterName);
    } else {
      openSpellConsentPrompt(msg.requestId, msg.casterName, msg.spellName);
    }
    return;
  }

  if (msg.type === 'howl_consent_request') {
    openHowlConsentPrompt(msg.consentId, msg.casterName);
    return;
  }

  if (msg.type === 'attack_result') {
    if (attackPanelOpen) document.getElementById('attackErr').textContent = '';
    setUnlockToast(msg.message);
    if (msg.revealTargetId) showGlimpseBeacon(msg.revealTargetId);
    if (msg.itemsSeen) openPickpocketPanel(msg.pickpocketTargetName, msg.itemsSeen, msg.stolenItemId);
    return;
  }

  if (msg.type === 'attack_error') {
    if (attackPanelOpen) document.getElementById('attackErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'attack_hit') {
    showAttackHitNotification(msg.casterName, msg.attackName, msg.detail, msg.effect);
    return;
  }

  if (msg.type === 'spyglass_start') {
    openSpyGlassPanel(msg.buildingName, msg.log || [], msg.durationMs);
    return;
  }

  if (msg.type === 'spyglass_chat') {
    appendSpyGlassLine(msg.name, msg.color, msg.text, msg.image);
    return;
  }

  if (msg.type === 'spyglass_end') {
    closeSpyGlassPanel();
    return;
  }

  if (msg.type === 'spyglass_notice') {
    setUnlockToast(`🔭 ${msg.casterName} is watching this room through Spy Glass.`);
    return;
  }

  if (msg.type === 'chat') {
    const m = msg.message;
    if (!messagesByRoom[m.room]) messagesByRoom[m.room] = [];
    messagesByRoom[m.room].push(m);
    if (m.room === currentRoom) renderChatLog();
    return;
  }

  if (msg.type === 'note_received') {
    inbox.push({ ...msg.note, read: false });
    setUnlockToast(`📜 New note from ${msg.note.fromName}`);
    renderInventory();
    return;
  }

  if (msg.type === 'note_sent') {
    setUnlockToast(`✉️ Note sent to ${msg.toName}`);
    return;
  }

  if (msg.type === 'auction_payout') {
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'note_destroyed') {
    setUnlockToast(`🔥 Your note was read and destroyed by ${msg.byName}`);
    return;
  }

  if (msg.type === 'note_stolen') {
    const idx = inbox.findIndex(n => n.id === msg.id);
    if (idx !== -1) inbox.splice(idx, 1);
    renderInventory();
    return;
  }

  if (msg.type === 'harddrive_state') {
    lastHardDriveState = { hasPassword: msg.hasPassword, notes: msg.notes, capacity: msg.capacity };
    document.getElementById('hdErr').textContent = '';
    document.getElementById('hdLocked').classList.add('hidden');
    document.getElementById('hdUnlocked').classList.remove('hidden');
    document.getElementById('hdPasswordInput').value = '';
    document.getElementById('hdCurrentPasswordInput').value = '';
    document.getElementById('hdNewPasswordInput').value = '';
    renderHardDriveUnlocked();
    return;
  }

  if (msg.type === 'harddrive_error') {
    const hdTabVisible = !document.getElementById('invHardDriveView').classList.contains('hidden');
    if (!hdTabVisible) {
      setUnlockToast('💽 ' + (msg.message || 'Hard Drive error.'));
      return;
    }
    if (/password/i.test(msg.message || '')) {
      document.getElementById('hdLocked').classList.remove('hidden');
      document.getElementById('hdUnlocked').classList.add('hidden');
      pendingHdPassword = '';
    }
    document.getElementById('hdErr').textContent = msg.message || 'Hard Drive error.';
    return;
  }

  if (msg.type === 'note_error') {
    setUnlockToast('⚠️ ' + msg.message);
    return;
  }

  if (msg.type === 'clear_user_messages') {
    // Someone left a building — drop everything they said in that room's
    // log, for everyone, including us.
    const list = messagesByRoom[msg.room];
    if (list) messagesByRoom[msg.room] = list.filter(m => m.id !== msg.id);
    if (msg.room === currentRoom) renderChatLog();
    return;
  }

  if (msg.type === 'npc_shop_state') {
    renderNpcShop(msg);
    return;
  }

  if (msg.type === 'shop_error') {
    const errEl = document.getElementById('npcShopErr');
    if (errEl) errEl.textContent = msg.message;
    return;
  }

  if (msg.type === 'shop_bought') {
    setUnlockToast(`🛒 Bought ${msg.itemName} for ${msg.price} gold!`);
    // Refresh balance display next time shop is opened
    return;
  }

  if (msg.type === 'party_state') {
    myParty = { partyId: msg.partyId, leaderId: msg.leaderId, members: msg.members };
    renderPartyHud();
    return;
  }

  if (msg.type === 'party_disbanded') {
    myParty = null;
    renderPartyHud();
    const hud = document.getElementById('partyHud');
    if (hud) hud.classList.add('hidden');
    return;
  }

  if (msg.type === 'party_invite_received') {
    pendingPartyInvite = { fromId: msg.fromId, fromName: msg.fromName };
    const notif = document.getElementById('partyInviteNotif');
    const text = document.getElementById('partyInviteText');
    if (notif && text) {
      text.textContent = `⚔️ ${msg.fromName} invited you to their party!`;
      notif.classList.remove('hidden');
    }
    return;
  }

  if (msg.type === 'party_error' || msg.type === 'party_info') {
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'party_msg') {
    appendPartyChatLine(msg.fromName, msg.text);
    return;
  }

  if (msg.type === 'witch_cave_entered') {
    if (me) { me.room = 'witch_cave'; me.x = msg.spawn.x; me.y = msg.spawn.y; }
    swapToCaveMap();
    return;
  }

  if (msg.type === 'witch_cave_exited') {
    if (me) { me.room = 'wilds'; me.x = msg.x; me.y = msg.y; }
    swapToWildsMap();
    setUnlockToast('You leave the Witch\'s cave.');
    return;
  }

  if (msg.type === 'witch_dialogue') {
    openWitchModal(msg);
    return;
  }

  if (msg.type === 'witch_selfie_request') {
    openWitchSelfieConsent(msg.consentId, msg.itemName, msg.itemIcon);
    return;
  }

  if (msg.type === 'witch_purchase_complete') {
    closeWitchSelfieConsent();
    setUnlockToast(`🧙‍♀️ ${msg.itemIcon} ${msg.itemName} added to your inventory!`);
    return;
  }

  if (msg.type === 'witch_shop_error') {
    const errEl = document.getElementById('witchShopErr');
    if (errEl) errEl.textContent = msg.message;
    return;
  }

  if (msg.type === 'loot_drop') {
    if (msg.items && msg.items.length) {
      setUnlockToast('💀 Loot: ' + msg.items.join('  '));
    }
    return;
  }

  if (msg.type === 'witch_craft_result') {
    const errEl = document.getElementById('witchCraftErr');
    if (errEl) errEl.textContent = '';
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'witch_craft_error') {
    const errEl = document.getElementById('witchCraftErr');
    if (errEl) errEl.textContent = msg.message;
    return;
  }
}
setupWs();

function addPlayer(p) {
  if (players[p.id]) return;
  players[p.id] = {
    id: p.id, name: p.name, color: p.color, charId: p.charId || 0,
    x: p.x, y: p.y, targetX: p.x, targetY: p.y,
    renderPrevX: p.x, renderPrevY: p.y,
    room: p.room,
    equippedWeapon: p.equippedWeapon || null,
    equippedHead:   p.equippedHead   || null,
    equippedChest:  p.equippedChest  || null,
    equippedFeet:   p.equippedFeet   || null,
    equippedRing:   p.equippedRing   || null,
    activeStatus: p.activeStatus || null,
    health: typeof p.health === 'number' ? p.health : 100,
    level: p.level || 1, skillPoints: p.skillPoints || 0, xp: p.xp || 0,
    isDead: p.isDead || false,
    facing: Math.PI, walkPhase: Math.random() * 10
  };
  ensurePlayerVisual(players[p.id]);
}

function removePlayer(id) {
  destroyPlayerVisual(id);
  delete players[id];
}

function setStatus(ok) {
  const dot = document.getElementById('statusDot');
  if (dot) dot.style.background = ok ? '#5ee37d' : '#ff5e5e';
}

function showReconnectBanner(show) {
  const el = document.getElementById('reconnectBanner');
  if (el) el.classList.toggle('hidden', !show);
}

function showJoinError(text) {
  document.getElementById('joinErr').textContent = text;
}

function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

// ---------------------------------------------------------------------------
// Join flow — guest (just a name, never persisted) or account (username +
// password, verified server-side, same name/color every time you log back
// in). See server.js for the account model and its caveats (no durable
// database, file-based storage that won't survive a redeploy on hosts with
// an ephemeral filesystem).
// ---------------------------------------------------------------------------
const nameInput = document.getElementById('nameInput');
const passInput = document.getElementById('passInput');
const joinBtn = document.getElementById('joinBtn');

const joinModeGuestBtn = document.getElementById('joinModeGuestBtn');
const joinModeAccountBtn = document.getElementById('joinModeAccountBtn');
const guestFields = document.getElementById('guestFields');
const accountFields = document.getElementById('accountFields');
const accountUserInput = document.getElementById('accountUserInput');
const accountPassInput = document.getElementById('accountPassInput');
const accountLoginBtn = document.getElementById('accountLoginBtn');
const accountRegisterBtn = document.getElementById('accountRegisterBtn');
const accountStatusEl = document.getElementById('accountStatus');

let joinMode = 'guest';
let savedAccount = null; // { token, username, color }

function setJoinMode(mode) {
  joinMode = mode;
  joinModeGuestBtn.classList.toggle('active', mode === 'guest');
  joinModeAccountBtn.classList.toggle('active', mode === 'account');
  guestFields.classList.toggle('hidden', mode !== 'guest');
  accountFields.classList.toggle('hidden', mode !== 'account');
}
joinModeGuestBtn.addEventListener('click', () => setJoinMode('guest'));
joinModeAccountBtn.addEventListener('click', () => setJoinMode('account'));

function setAccountStatus(text, isError) {
  accountStatusEl.textContent = text;
  accountStatusEl.style.color = isError ? '#ff9b9b' : '#9bc49a';
}

function renderLoggedInStatus() {
  accountStatusEl.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = `Logged in as ${savedAccount.username} — `;
  accountStatusEl.style.color = '#9bc49a';
  accountStatusEl.appendChild(span);
  const logout = document.createElement('a');
  logout.href = '#';
  logout.textContent = 'log out';
  logout.addEventListener('click', (e) => { e.preventDefault(); logoutAccount(); });
  accountStatusEl.appendChild(logout);
}

function logoutAccount() {
  savedAccount = null;
  localStorage.removeItem('tc_account');
  setAccountStatus('');
}

(function loadSavedAccount() {
  try {
    const raw = localStorage.getItem('tc_account');
    if (raw) savedAccount = JSON.parse(raw);
  } catch (e) { savedAccount = null; }
  if (savedAccount && savedAccount.username && savedAccount.token) {
    setJoinMode('account');
    renderLoggedInStatus();
  }
})();

function submitAccount(endpoint) {
  const username = accountUserInput.value.trim();
  const password = accountPassInput.value;
  if (!username || !password) { setAccountStatus('Enter a username and password.', true); return; }
  setAccountStatus(endpoint === 'register' ? 'Creating account…' : 'Logging in…');
  fetch('/api/' + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
    .then(r => r.json().then(data => ({ ok: r.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) { setAccountStatus(data.error || 'Something went wrong.', true); return; }
      savedAccount = { token: data.token, username: data.username, color: data.color };
      localStorage.setItem('tc_account', JSON.stringify(savedAccount));
      accountPassInput.value = '';
      renderLoggedInStatus();
    })
    .catch(() => setAccountStatus('Could not reach the server.', true));
}
accountLoginBtn.addEventListener('click', () => submitAccount('login'));
accountRegisterBtn.addEventListener('click', () => submitAccount('register'));
accountPassInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAccount('login'); });

// Character picker — remembered per-browser like the other join-screen
// preferences, but re-pickable any time before hitting Enter Town.
let selectedCharId = parseInt(localStorage.getItem('tc_charid'), 10);
if (!Number.isInteger(selectedCharId) || selectedCharId < 0 || selectedCharId >= CHARACTER_PRESETS.length) {
  selectedCharId = Math.floor(Math.random() * CHARACTER_PRESETS.length);
}
function renderCharSelect() {
  document.querySelectorAll('.charOption').forEach((btn) => {
    btn.classList.toggle('selected', parseInt(btn.dataset.char, 10) === selectedCharId);
  });
}
document.querySelectorAll('.charOption').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedCharId = parseInt(btn.dataset.char, 10);
    localStorage.setItem('tc_charid', String(selectedCharId));
    renderCharSelect();
  });
});
renderCharSelect();

// Open 3rd Eye camera opt-in — entirely client-side and off by default.
// Server protocol doesn't change at all: it still always sends
// spell_consent_request and waits. This just controls whether THIS
// client shows the blocking Allow/Deny prompt when one arrives, or skips
// straight to capture because the player themselves pre-authorized it,
// in their own settings, ahead of time. Two checkboxes (join screen +
// in-game Settings tab) both read/write the same flag so it can be
// flipped without needing to rejoin to take effect.
let thirdEyeOptIn = localStorage.getItem('tc_thirdeye_optin') === '1';
function setThirdEyeOptIn(value) {
  thirdEyeOptIn = !!value;
  localStorage.setItem('tc_thirdeye_optin', thirdEyeOptIn ? '1' : '0');
  const a = document.getElementById('thirdEyeOptInCheckbox');
  const b = document.getElementById('thirdEyeOptInCheckboxInGame');
  if (a) a.checked = thirdEyeOptIn;
  if (b) b.checked = thirdEyeOptIn;
}
setThirdEyeOptIn(thirdEyeOptIn);
const thirdEyeOptInCheckbox = document.getElementById('thirdEyeOptInCheckbox');
if (thirdEyeOptInCheckbox) thirdEyeOptInCheckbox.addEventListener('change', (e) => setThirdEyeOptIn(e.target.checked));
const thirdEyeOptInCheckboxInGame = document.getElementById('thirdEyeOptInCheckboxInGame');
if (thirdEyeOptInCheckboxInGame) thirdEyeOptInCheckboxInGame.addEventListener('change', (e) => setThirdEyeOptIn(e.target.checked));

function attemptJoin() {
  let name;
  if (joinMode === 'account') {
    if (!savedAccount) { showJoinError('Log in or create an account first.'); return; }
    name = savedAccount.username;
  } else {
    name = nameInput.value.trim();
    if (!name) { showJoinError('Enter a name first.'); return; }
  }
  showJoinError('');
  ensureAudio(); // the click is a user gesture — set up Web Audio here so it's unblocked later
  const payload = { type: 'join', name, password: passInput.value, charId: selectedCharId };
  if (joinMode === 'account' && savedAccount) payload.accountToken = savedAccount.token;
  lastJoinPayload = payload;
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  } else {
    ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true });
  }
}
joinBtn.addEventListener('click', attemptJoin);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptJoin(); });
passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptJoin(); });

// ---------------------------------------------------------------------------
// World / collision — identical math to the 2D version. "y" here is treated
// as the ground-plane depth (Z) axis once it reaches the 3D renderer; the
// collision/room logic itself doesn't care, it's all plain numbers.
// ---------------------------------------------------------------------------
function buildWalls(w) {
  const list = [];
  for (const b of w.buildings) list.push(...buildWallsForOne(b, w));
  return list;
}

// Which wall a building's door is cut into. Defaults to 'south'; a building
// can override via a `door` field (e.g. the Cafe uses 'east' to face spawn).
function getDoorSide(b) {
  return (b && b.door) || 'south';
}

// World-space point just outside a building's door, used to anchor the dirt
// path that connects it back to the spawn hub.
function getDoorWorldPos(b) {
  const side = getDoorSide(b);
  if (side === 'east') return { x: b.x + b.w, y: b.y + b.h / 2 };
  if (side === 'west') return { x: b.x, y: b.y + b.h / 2 };
  if (side === 'north') return { x: b.x + b.w / 2, y: b.y };
  return { x: b.x + b.w / 2, y: b.y + b.h };
}

function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

const PLAYER_R = 14;
function collides(x, y) {
  const hw = PLAYER_R, hh = PLAYER_R;
  for (const wall of walls) {
    if (rectOverlap(x - hw, y - hh, hw * 2, hh * 2, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}

function collidesIndoor(x, y, wallsLocal) {
  const hw = PLAYER_R, hh = PLAYER_R;
  for (const wall of wallsLocal) {
    if (rectOverlap(x - hw, y - hh, hw * 2, hh * 2, wall.x, wall.y, wall.w, wall.h)) return true;
  }
  return false;
}

function roomAt(x, y) {
  for (const b of world.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return 'outside';
}

function roomLabel(roomId) {
  if (roomId === 'outside') return '📍 Town Square';
  if (roomId === 'wilds') return '🌲 The Wilds';
  if (roomId === 'dungeon_t1') return '⚔️ Dungeon — Tier 1 (Lv 1–5)';
  if (roomId === 'dungeon_t2') return '⚔️ Dungeon — Tier 2 (Lv 6–10)';
  if (roomId === 'dungeon_t3') return '⚔️ Dungeon — Tier 3 (Lv 11–15)';
  if (roomId === 'dungeon_t4') return '⚔️ Dungeon — Tier 4 (Lv 16–20)';
  const b = world && world.buildings.find(x => x.id === roomId);
  return b ? b.name : roomId;
}

// ---------------------------------------------------------------------------
// Premium gating — one building is free, the rest need a verified Stripe
// payment. Gating is enforced client-side only (no accounts/database in
// this project), persisted in localStorage once a payment is verified.
// ---------------------------------------------------------------------------
const FREE_BUILDING_ID = 'hall';
// Paywalls are off for now — every building is free to enter. The checks
// below are left in place (rather than deleted) so a future change can
// re-enable them without re-plumbing this logic.
const PAYWALLS_ENABLED = false;
let unlocked = localStorage.getItem('tc_unlocked') === '1';
let paymentsEnabled = false;
let premiumPriceCents = 300;
let roomPassPriceCents = 100;
let roomPassHours = 4;

// Single-room, time-limited passes (bought from the statue in the free
// building) — separate from the all-access Town Pass above. Stored as an
// expiry timestamp per room, same client-side-only trust model.
function roomPassKey(roomId) { return 'tc_room_pass_' + roomId + '_expiry'; }
function hasRoomPass(roomId) {
  const exp = parseInt(localStorage.getItem(roomPassKey(roomId)) || '0', 10);
  return Number.isFinite(exp) && Date.now() < exp;
}
function grantRoomPass(roomId, hours) {
  localStorage.setItem(roomPassKey(roomId), String(Date.now() + hours * 60 * 60 * 1000));
}

function isLockedRoom(roomId) {
  if (!PAYWALLS_ENABLED) return false;
  if (roomId === 'outside' || roomId === FREE_BUILDING_ID || unlocked) return false;
  return !hasRoomPass(roomId);
}

// Whether a building's outdoor signage/door should render in its "locked"
// look — same rule as isLockedRoom but as a per-building helper since
// buildings (not rooms) are what get rendered outdoors.
function isVisuallyLocked(b) {
  if (!PAYWALLS_ENABLED) return false;
  return b.id !== FREE_BUILDING_ID && !unlocked && !hasRoomPass(b.id);
}

// ---------------------------------------------------------------------------
// Music — a tiny procedural ambient tavern loop, synthesized entirely with
// the Web Audio API (no external audio files). Plays only while inside the
// Cafe; fades out everywhere else.
// ---------------------------------------------------------------------------
let audioCtx = null;
let musicGain = null;
let musicMuted = false;
let musicPlaying = false;
let musicTimer = null;
let musicStep = 0;

const TAVERN_SCALE = [196.00, 220.00, 246.94, 293.66, 329.63, 392.00]; // G3 pentatonic-ish run
const TAVERN_MELODY = [0, 2, 4, 2, 1, 3, 5, 3, 0, 4, 2, 0, 1, 3, 2, 0];

function ensureAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(audioCtx.destination);
  } catch (e) { /* Web Audio unavailable — music simply won't play */ }
}

function playNote(freq, time, dur, vol) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(vol, time + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}

function scheduleMusicStep() {
  if (!musicPlaying || !audioCtx) return;
  const now = audioCtx.currentTime;
  const note = TAVERN_MELODY[musicStep % TAVERN_MELODY.length];
  playNote(TAVERN_SCALE[note], now, 0.5, 0.18);
  if (musicStep % 4 === 0) playNote(TAVERN_SCALE[0] / 2, now, 0.9, 0.1); // soft bass drone
  musicStep++;
  musicTimer = setTimeout(scheduleMusicStep, 330);
}

function startMusic() {
  ensureAudio();
  if (!audioCtx || musicPlaying) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  musicPlaying = true;
  musicStep = 0;
  musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
  musicGain.gain.linearRampToValueAtTime(musicMuted ? 0 : 0.5, audioCtx.currentTime + 1.2);
  scheduleMusicStep();
}

function stopMusic() {
  if (!musicPlaying) return;
  musicPlaying = false;
  clearTimeout(musicTimer);
  if (audioCtx && musicGain) {
    musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
  }
}

function setMusicMuted(muted) {
  musicMuted = muted;
  if (audioCtx && musicGain && musicPlaying) {
    musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
    musicGain.gain.linearRampToValueAtTime(muted ? 0 : 0.5, audioCtx.currentTime + 0.3);
  }
}

const muteBtn = document.getElementById('muteBtn');
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    setMusicMuted(!musicMuted);
    muteBtn.textContent = musicMuted ? '🔇' : '🔈';
  });
}

// ---------------------------------------------------------------------------
// Inventory panel — two tabs. "Items" is the player's real 24-slot carried
// inventory + weapon/armor equip slots (server-authoritative, see
// inventory_state handling above and the Bank's deposit/withdraw, which is
// the only way items cross over from the separate bank-account slots).
// "Notes" is the original feature: private written notes, passed
// player-to-player, never stored server-side (see server.js) — the only
// copy that ever exists is sitting in the recipient's inbox array here
// until they read it, which removes it immediately and tells the server
// to let the sender know it's gone. No accounts/persistence, so notes stay
// purely in-memory for the current tab/session like before.
// ---------------------------------------------------------------------------
const inbox = []; // { id, fromId, fromName, text, read }

const inventoryBtn = document.getElementById('inventoryBtn');
const inventoryPanel = document.getElementById('inventoryPanel');
let inventoryOpen = false;
let invItemsTabActive = true;

function toggleInventory() {
  inventoryOpen = !inventoryOpen;
  inventoryPanel.classList.toggle('hidden', !inventoryOpen);
  if (inventoryOpen) {
    cancelTargeting();
    refreshNoteRecipients();
    ws.send(JSON.stringify({ type: 'inventory_open' }));
    const levelSpan = document.getElementById('dungeonTokenLevel');
    if (levelSpan && me) levelSpan.textContent = String(me.level || 1);
  }
}
if (inventoryBtn) inventoryBtn.addEventListener('click', toggleInventory);

const invTabItemsBtn = document.getElementById('invTabItems');
const invTabNotesBtn = document.getElementById('invTabNotes');
const invTabHardDriveBtn = document.getElementById('invTabHardDrive');
const invTabSettingsBtn = document.getElementById('invTabSettings');
const INV_VIEW_IDS = ['invItemsView', 'invNotesView', 'invHardDriveView', 'invSettingsView'];
const INV_TAB_BTNS = { invItemsView: invTabItemsBtn, invNotesView: invTabNotesBtn, invHardDriveView: invTabHardDriveBtn, invSettingsView: invTabSettingsBtn };
function showInvTab(viewId) {
  invItemsTabActive = viewId === 'invItemsView';
  for (const id of INV_VIEW_IDS) {
    document.getElementById(id).classList.toggle('hidden', id !== viewId);
    const btn = INV_TAB_BTNS[id];
    if (btn) btn.classList.toggle('active', id === viewId);
  }
  if (viewId === 'invHardDriveView') refreshHardDriveTab();
}
function showInvItemsTab() { showInvTab('invItemsView'); }
function showInvNotesTab() { showInvTab('invNotesView'); }
function showInvSettingsTab() { showInvTab('invSettingsView'); }
if (invTabItemsBtn) invTabItemsBtn.addEventListener('click', showInvItemsTab);
if (invTabNotesBtn) invTabNotesBtn.addEventListener('click', showInvNotesTab);
if (invTabHardDriveBtn) invTabHardDriveBtn.addEventListener('click', () => showInvTab('invHardDriveView'));
if (invTabSettingsBtn) invTabSettingsBtn.addEventListener('click', showInvSettingsTab);

const useDungeonTokenBtn = document.getElementById('useDungeonTokenBtn');
if (useDungeonTokenBtn) {
  useDungeonTokenBtn.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'use_dungeon_token' }));
    toggleInventory();
  });
}

// ---------------------------------------------------------------------------
// Items tab — equip slots + 24-slot grid. Click a slot to see what can be
// done with it (equip as weapon/armor if eligible); click an equip slot to
// immediately unequip. Deposit/withdraw between this and the bank's own 24
// slots lives in the Bank modal instead (see openBankModal()/bankWithdrawBtn
// above) since that's themed as something you do "at the bank."
// ---------------------------------------------------------------------------
function renderInventoryItemsPanel() {
  if (!lastInventoryState) return;
  renderEquipSlot('equipWeaponSlot', lastInventoryState.equippedWeapon, 'weapon');
  renderEquipSlot('equipHeadSlot',   lastInventoryState.equippedHead,   'head');
  renderEquipSlot('equipChestSlot',  lastInventoryState.equippedChest,  'chest');
  renderEquipSlot('equipFeetSlot',   lastInventoryState.equippedFeet,   'feet');
  renderEquipSlot('equipRingSlot',   lastInventoryState.equippedRing,   'ring');

  const grid = document.getElementById('invSlotsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  lastInventoryState.slots.forEach((slot, idx) => {
    const cell = document.createElement('div');
    cell.className = 'itemSlot' + (slot ? '' : ' empty') + (selectedInvSlotIdx === idx ? ' selected' : '');
    if (slot) {
      const item = ITEM_CATALOG[slot.itemId];
      const icon = buildItemIconEl(slot.itemId);
      const qty = document.createElement('span');
      qty.className = 'slotQty';
      qty.textContent = String(slot.qty);
      cell.appendChild(icon);
      cell.appendChild(qty);
      cell.title = '';
      cell.addEventListener('mouseenter', (e) => showItemTooltip(e, slot.itemId));
      cell.addEventListener('mouseleave', hideTooltip);
      cell.addEventListener('click', () => selectInvSlot(idx));
    }
    grid.appendChild(cell);
  });
}

function renderEquipSlot(elId, itemId, equipKind) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  el.classList.toggle('empty', !itemId);
  if (!itemId) { el.title = ''; el.onclick = null; return; }
  const item = ITEM_CATALOG[itemId];
  el.textContent = item ? item.icon : '❓';
  el.title = '';
  el.onmouseenter = (e) => showItemTooltip(e, itemId);
  el.onmouseleave = hideTooltip;
  el.onclick = () => {
    document.getElementById('invModalErr').textContent = '';
    ws.send(JSON.stringify({ type: 'inventory_unequip', equipSlot: equipKind }));
  };
}

function selectInvSlot(idx) {
  selectedInvSlotIdx = idx;
  renderInventoryItemsPanel();
  const slot = lastInventoryState.slots[idx];
  const panel = document.getElementById('invActionPanel');
  if (!slot) { panel.classList.add('hidden'); return; }
  const item = ITEM_CATALOG[slot.itemId];
  document.getElementById('invActionItemLabel').textContent =
    (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
  const buttons = document.getElementById('invActionButtons');
  buttons.innerHTML = '';
  const meta = item;
  if (meta && meta.slot) {
    const SLOT_LABELS = { weapon:'⚔️ Equip Weapon', head:'🎩 Equip Head', chest:'🛡️ Equip Chest', feet:'👢 Equip Feet', ring:'💍 Equip Ring' };
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = SLOT_LABELS[meta.slot] || '⚙️ Equip';
    btn.addEventListener('click', () => {
      document.getElementById('invModalErr').textContent = '';
      ws.send(JSON.stringify({ type: 'inventory_equip', slotIdx: idx, equipSlot: meta.slot }));
    });
    buttons.appendChild(btn);
  } else if (slot.itemId === 'hard_drive') {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '💽 Open Hard Drive';
    btn.addEventListener('click', () => {
      panel.classList.add('hidden');
      showInvTab('invHardDriveView');
    });
    buttons.appendChild(btn);
  } else if (PLANT_EFFECTS.has(slot.itemId)) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '🌿 Use ' + (item ? item.name : slot.itemId);
    btn.addEventListener('click', () => {
      document.getElementById('invModalErr').textContent = '';
      ws.send(JSON.stringify({ type: 'use_item', slotIdx: idx }));
    });
    buttons.appendChild(btn);
  } else {
    const note = document.createElement('div');
    note.id = 'invEquippableNote';
    note.textContent = "Can't be equipped — visit the Bank to deposit or auction it.";
    buttons.appendChild(note);
  }
  panel.classList.remove('hidden');
}

function refreshNoteRecipients() {
  const select = document.getElementById('noteRecipient');
  if (!select) return;
  const prev = select.value;
  select.innerHTML = '';
  const others = Object.values(players).filter(p => p.id !== myId);
  if (others.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = 'No one else is here';
    select.appendChild(opt);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const p of others) {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name;
    select.appendChild(opt);
  }
  if (others.some(p => p.id === prev)) select.value = prev;
}

const noteSendBtn = document.getElementById('noteSendBtn');
if (noteSendBtn) {
  noteSendBtn.addEventListener('click', () => {
    const select = document.getElementById('noteRecipient');
    const textEl = document.getElementById('noteText');
    const to = select.value;
    const text = textEl.value.trim();
    if (!to || !text) return;
    ws.send(JSON.stringify({ type: 'send_note', to, text }));
    textEl.value = '';
  });
}

// Opening a note just reveals its contents — it no longer starts a
// destruct timer on its own. The note sticks around (and the sender isn't
// told anything yet) until the recipient explicitly clicks the burn icon
// rendered below, which is destroyNote()'s job.
function openNote(noteId) {
  const note = inbox.find(n => n.id === noteId);
  if (!note || note.read) return;
  note.read = true;
  renderInventory();
}

function destroyNote(noteId) {
  const note = inbox.find(n => n.id === noteId);
  if (!note) return;
  ws.send(JSON.stringify({ type: 'destroy_note', id: note.id, fromId: note.fromId }));
  const idx = inbox.findIndex(n => n.id === noteId);
  if (idx !== -1) inbox.splice(idx, 1);
  renderInventory();
}

// ---------------------------------------------------------------------------
// Hard Drive — a separate, capped (24-note) vault layered on top of the
// regular inbox. Filing a note here pulls it out of the inbox entirely
// (server splices it from player.inbox), which is what makes it safe from
// Rapid Swipe — that attack only ever reads player.inbox. A password, if
// set, is required by the server for every operation including by the
// owner, and the locked Hard Drive item is hidden from Sleight of Hand's
// peek/steal entirely (see server.js cast_attack pickpocket branch).
// ---------------------------------------------------------------------------
let lastHardDriveState = null; // { hasPassword, notes, capacity } once unlocked/known
let hdUnlockAttempted = false;

function ownsHardDrive() {
  return !!(lastInventoryState && lastInventoryState.slots.some(s => s && s.itemId === 'hard_drive'));
}

function storeNoteOnHardDrive(noteId) {
  ws.send(JSON.stringify({ type: 'harddrive_store', noteId, password: pendingHdPassword }));
}

let pendingHdPassword = '';

function refreshHardDriveTab() {
  document.getElementById('hdErr').textContent = '';
  if (!ownsHardDrive()) {
    document.getElementById('hdNoItem').classList.remove('hidden');
    document.getElementById('hdLocked').classList.add('hidden');
    document.getElementById('hdUnlocked').classList.add('hidden');
    return;
  }
  document.getElementById('hdNoItem').classList.add('hidden');
  ws.send(JSON.stringify({ type: 'harddrive_open', password: pendingHdPassword }));
}

const hdUnlockBtn = document.getElementById('hdUnlockBtn');
if (hdUnlockBtn) hdUnlockBtn.addEventListener('click', () => {
  pendingHdPassword = document.getElementById('hdPasswordInput').value;
  ws.send(JSON.stringify({ type: 'harddrive_open', password: pendingHdPassword }));
});

const hdSetPasswordBtn = document.getElementById('hdSetPasswordBtn');
if (hdSetPasswordBtn) hdSetPasswordBtn.addEventListener('click', () => {
  const currentPassword = document.getElementById('hdCurrentPasswordInput').value;
  const newPassword = document.getElementById('hdNewPasswordInput').value;
  ws.send(JSON.stringify({ type: 'harddrive_set_password', currentPassword, newPassword }));
});

function renderHardDriveUnlocked() {
  const cap = document.getElementById('hdCapacityRow');
  cap.textContent = `${lastHardDriveState.notes.length} / ${lastHardDriveState.capacity} notes stored` +
    (lastHardDriveState.hasPassword ? ' — 🔒 password-protected' : ' — no password set');
  const list = document.getElementById('hdNotesList');
  const empty = document.getElementById('hdEmpty');
  list.innerHTML = '';
  empty.classList.toggle('hidden', lastHardDriveState.notes.length > 0);
  for (const note of lastHardDriveState.notes) {
    const div = document.createElement('div');
    div.className = 'noteItem';
    const from = document.createElement('span');
    from.className = 'noteFrom';
    from.textContent = 'From ' + note.fromName;
    div.appendChild(from);
    if (note.text) {
      const body = document.createElement('div');
      body.textContent = note.text;
      div.appendChild(body);
    }
    if (note.image) {
      const img = document.createElement('img');
      img.className = 'noteImage';
      img.src = note.image;
      div.appendChild(img);
    }
    const retrieveBtn = document.createElement('button');
    retrieveBtn.className = 'noteReadBtn';
    retrieveBtn.textContent = '📤 Move back to Inbox';
    retrieveBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'harddrive_retrieve', noteId: note.id, password: pendingHdPassword }));
    });
    div.appendChild(retrieveBtn);
    const destroyBtn = document.createElement('button');
    destroyBtn.className = 'noteDestroyBtn';
    destroyBtn.textContent = '🔥 Destroy this note';
    destroyBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'harddrive_destroy', noteId: note.id, password: pendingHdPassword }));
    });
    div.appendChild(destroyBtn);
    list.appendChild(div);
  }
}

function renderInventory() {
  const list = document.getElementById('inboxList');
  const empty = document.getElementById('inventoryEmpty');
  const badge = document.getElementById('inventoryBadge');
  if (!list) return;
  list.innerHTML = '';
  const unreadCount = inbox.filter(n => !n.read).length;
  if (badge) badge.textContent = unreadCount > 0 ? `(${unreadCount})` : '';
  if (empty) empty.style.display = inbox.length === 0 ? 'block' : 'none';
  for (const note of inbox) {
    const div = document.createElement('div');
    div.className = 'noteItem';
    const from = document.createElement('span');
    from.className = 'noteFrom';
    from.textContent = 'From ' + note.fromName;
    div.appendChild(from);
    if (note.read) {
      if (note.text) {
        const body = document.createElement('div');
        body.textContent = note.text;
        div.appendChild(body);
      }
      if (note.image) {
        const img = document.createElement('img');
        img.className = 'noteImage';
        img.src = note.image;
        div.appendChild(img);
      }
      // Always shown, even without a Hard Drive on hand — clicking it
      // without one just surfaces the server's "you need a Hard Drive"
      // error as a toast, which is more discoverable than hiding the
      // option entirely until you happen to own one.
      const storeBtn = document.createElement('button');
      storeBtn.className = 'noteReadBtn';
      storeBtn.textContent = '💽 Store on Hard Drive';
      storeBtn.addEventListener('click', () => storeNoteOnHardDrive(note.id));
      div.appendChild(storeBtn);
      const destroyBtn = document.createElement('button');
      destroyBtn.className = 'noteDestroyBtn';
      destroyBtn.textContent = '🔥 Destroy this note';
      destroyBtn.addEventListener('click', () => destroyNote(note.id));
      div.appendChild(destroyBtn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'noteReadBtn';
      btn.textContent = '📖 Read';
      btn.addEventListener('click', () => openNote(note.id));
      div.appendChild(btn);
    }
    list.appendChild(div);
  }
}

// ---------------------------------------------------------------------------
// Health HUD — a heart icon with the current percentage rendered inside it.
// Server is authoritative (player.health in server.js, synced the same way
// as activeStatus/equipped gear via publicPlayer()/the periodic 'state'
// broadcast); the client only ever displays whatever it's told. Nothing in
// the game currently drains health — this lays the readout down so a future
// damage source (an attack, a status effect, etc.) has somewhere to report
// to — so today it'll just sit at 100% for everyone.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Draggable panels — any fixed-position panel can be grabbed by its handle
// and freely repositioned. setDefaultFloatPos() sets the initial position
// once (respects any position the user already dragged it to).
// ---------------------------------------------------------------------------
function setDefaultFloatPos(el, defaultLeft, defaultTop) {
  if (el.dataset.dragged) return; // user already moved it — respect that
  el.style.left = Math.min(defaultLeft, window.innerWidth - el.offsetWidth - 8) + 'px';
  el.style.top  = Math.min(defaultTop,  window.innerHeight - 120) + 'px';
  el.style.right = 'auto';
  el.style.bottom = 'auto';
}

function makeDraggable(panel, handle) {
  if (!panel || !handle) return;
  let startPX, startPY, startLeft, startTop;
  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return; // left button only
    if (e.target.closest('button, a, input, select, textarea')) return; // let interactive children fire normally
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    startPX = e.clientX;
    startPY = e.clientY;
    startLeft = rect.left;
    startTop  = rect.top;
    handle.setPointerCapture(e.pointerId);
    handle.style.cursor = 'grabbing';
    const onMove = (ev) => {
      const dx = ev.clientX - startPX;
      const dy = ev.clientY - startPY;
      const maxL = window.innerWidth  - panel.offsetWidth  - 4;
      const maxT = window.innerHeight - 44;
      panel.style.left   = Math.max(0, Math.min(maxL, startLeft + dx)) + 'px';
      panel.style.top    = Math.max(0, Math.min(maxT, startTop  + dy)) + 'px';
      panel.style.right  = 'auto';
      panel.style.bottom = 'auto';
      panel.dataset.dragged = '1';
    };
    const onUp = () => {
      handle.style.cursor = 'grab';
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
}

// Wire up all draggable panels. inventoryPanel uses its tab row as handle;
// the floating attack/spellbook panels use their own floatPanelHandle.
// questTracker uses itself as its own handle.
(function initDraggables() {
  makeDraggable(document.getElementById('inventoryPanel'), document.getElementById('invTabs'));
  makeDraggable(document.getElementById('questTracker'), document.getElementById('questTracker'));
  makeDraggable(document.getElementById('attackModal'),    document.querySelector('#attackModal .floatPanelHandle'));
  makeDraggable(document.getElementById('spellbookModal'), document.querySelector('#spellbookModal .floatPanelHandle'));
})();

// ---------------------------------------------------------------------------
// Strike hotkey — Q quick-attacks the nearest visible enemy without needing
// to click on them. Uses the same strike WS message as a canvas click so
// cooldowns/range are still enforced by the server.
// ---------------------------------------------------------------------------
function strikeNearestEnemy() {
  if (!me || anyOverlayOpen()) return;
  const candidates = getRaycastCandidates();
  let nearest = null, nearestDist = 120; // max auto-strike range (world units)
  for (const obj of candidates) {
    const uid = obj.userData;
    if (!ATTACKABLE_KINDS.has(uid.kind)) continue;
    // Find world position from the mesh
    const pos = new THREE.Vector3();
    obj.getWorldPosition(pos);
    // Convert player position to 3D render coords
    const myRp = getRenderPos(me);
    const d = Math.hypot(pos.x - myRp.x, pos.z - myRp.z);
    if (d < nearestDist) { nearestDist = d; nearest = uid; }
  }
  if (nearest) {
    ws.send(JSON.stringify({ type: 'strike', targetType: nearest.kind, targetId: nearest.targetId }));
    flashCreatureHit(nearest.kind, nearest.targetId);
    triggerAttackAnim();
  } else {
    setUnlockToast('No enemies nearby to strike.');
  }
}

function updateHealthHud() {
  const path = document.getElementById('healthHeartPath');
  const text = document.getElementById('healthPercentText');
  if (!path || !text) return;
  const pct = me ? Math.max(0, Math.min(100, Math.round(me.health))) : 100;
  text.textContent = pct + '%';
  path.style.fill = pct > 60 ? '#e0455a' : pct > 30 ? '#e0a93f' : '#8a2030';
}

// ---------------------------------------------------------------------------
// XP / level strip
// ---------------------------------------------------------------------------
// XP thresholds mirror server's XP_THRESHOLDS for computing the bar fill —
// the server is authoritative; this is purely cosmetic interpolation.
const CLIENT_XP_THRESHOLDS = [0,100,250,500,900,1400,2100,3000,4200,6000,
                               8200,11000,14500,19000,25000,32500,42000,54000,69000,87000];
const CLIENT_MAX_LEVEL = CLIENT_XP_THRESHOLDS.length - 1;

function updateXPDisplay() {
  const strip = document.getElementById('xpStrip');
  if (!strip || !gameStarted) return;
  strip.classList.remove('hidden');
  const level = me ? (me.level || 1) : 1;
  const xp = me ? (me.xp || 0) : 0;
  const sp = me ? (me.skillPoints || 0) : 0;
  document.getElementById('xpStripLevel').textContent = `Lv ${level}`;
  document.getElementById('xpStripSP').textContent = `${sp} SP`;
  let pct = 0;
  if (level < CLIENT_MAX_LEVEL) {
    const lo = CLIENT_XP_THRESHOLDS[level - 1] || 0;
    const hi = CLIENT_XP_THRESHOLDS[level];
    pct = Math.min(100, Math.round(100 * (xp - lo) / Math.max(1, hi - lo)));
  } else {
    pct = 100;
  }
  document.getElementById('xpBarFill').style.width = pct + '%';
}

// ---------------------------------------------------------------------------
// Quest tracker (persistent progress panel)
// ---------------------------------------------------------------------------
let activeQuestId = null, activeQuestTarget = 0;

function updateQuestTracker(questId, questName, progress, target) {
  activeQuestId = questId;
  activeQuestTarget = target;
  const el = document.getElementById('questTracker');
  if (!el) return;
  el.classList.remove('hidden');
  document.getElementById('questTrackerName').textContent = questName;
  const pct = Math.min(100, Math.round(100 * progress / Math.max(1, target)));
  document.getElementById('questTrackerFill').style.width = pct + '%';
  document.getElementById('questTrackerCount').textContent = `${progress} / ${target}`;
}

function clearQuestTracker() {
  activeQuestId = null;
  const el = document.getElementById('questTracker');
  if (el) el.classList.add('hidden');
}

const questCancelBtn = document.getElementById('questCancelBtn');
if (questCancelBtn) questCancelBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'quest_cancel' }));
});

// ---------------------------------------------------------------------------
// Ghost helpers
// ---------------------------------------------------------------------------
function makeGhostMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xaaddff, transparent: true, opacity: 0.5, depthWrite: false });
  const body = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 10), mat.clone());
  body.scale.y = 1.5; body.position.y = 30; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 10), mat.clone());
  head.position.y = 55; g.add(head);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x4488ff, emissive: 0x2244aa });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6), eyeMat);
    eye.position.set(side * 3.5, 56, 8); g.add(eye);
  }
  return g;
}

function showGhostOverlay() {
  const el = document.getElementById('ghostOverlay');
  if (el) el.classList.remove('hidden');
}
function hideGhostOverlay() {
  const el = document.getElementById('ghostOverlay');
  if (el) el.classList.add('hidden');
}

const respawnBtn = document.getElementById('respawnBtn');
if (respawnBtn) respawnBtn.addEventListener('click', () => {
  if (me && me.isDead) ws.send(JSON.stringify({ type: 'respawn' }));
});

// ---------------------------------------------------------------------------
// NPC Shop
// ---------------------------------------------------------------------------
let npcShopOpen = false;
let currentShopNpcId = null;

function openNpcShopModal(npcId) {
  currentShopNpcId = npcId;
  ws.send(JSON.stringify({ type: 'npc_shop_open', npcId }));
}

function closeNpcShopModal() {
  npcShopOpen = false;
  currentShopNpcId = null;
  const el = document.getElementById('npcShopModal');
  if (el) el.classList.add('hidden');
}

function renderNpcShop(msg) {
  npcShopOpen = true;
  currentShopNpcId = msg.npcId;
  document.getElementById('npcShopTitle').textContent = `🛒 ${msg.npcName}`;
  const bal = lastBankState ? lastBankState.balance : '?';
  document.getElementById('npcShopBalance').textContent = `Balance: ${bal} 🪙`;
  const container = document.getElementById('npcShopItems');
  container.innerHTML = '';
  for (const item of msg.items) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:8px;';
    row.innerHTML = `<span style="font-size:20px;">${item.icon}</span>
      <span style="flex:1;color:#eafff0;">${item.name}</span>
      <span style="color:#ffd700;font-weight:700;">${item.price} 🪙</span>
      <button data-item="${item.id}" style="padding:5px 14px;background:#3366aa;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Buy</button>`;
    row.querySelector('button').addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'npc_buy_item', npcId: currentShopNpcId, itemId: item.id }));
    });
    container.appendChild(row);
  }
  document.getElementById('npcShopErr').textContent = '';
  document.getElementById('npcShopModal').classList.remove('hidden');
}

const npcShopCloseBtn = document.getElementById('npcShopCloseBtn');
if (npcShopCloseBtn) npcShopCloseBtn.addEventListener('click', closeNpcShopModal);

const npcShopQuestBtn = document.getElementById('npcShopQuestBtn');
if (npcShopQuestBtn) npcShopQuestBtn.addEventListener('click', () => {
  if (currentShopNpcId) {
    closeNpcShopModal();
    const npc = TOWN_NPCS.find(n => n.id === currentShopNpcId);
    openQuestDialogue(currentShopNpcId, npc ? npc.name : currentShopNpcId);
  }
});

// ---------------------------------------------------------------------------
// Party system
// ---------------------------------------------------------------------------
let myParty = null;
let pendingPartyInvite = null;

function renderPartyHud() {
  const hud = document.getElementById('partyHud');
  const list = document.getElementById('partyMemberList');
  if (!hud || !list) return;
  if (!myParty || myParty.members.length === 0) {
    hud.classList.add('hidden'); return;
  }
  hud.classList.remove('hidden');
  list.innerHTML = '';
  for (const m of myParty.members) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const crown = m.id === myParty.leaderId ? '👑 ' : '';
    const ghost = m.isDead ? ' 👻' : '';
    row.innerHTML = `<span style="color:${m.isDead ? '#88aacc' : '#aaddff'};">${crown}${m.name}${ghost}</span>`;
    if (m.id !== myId && !m.isDead && me && !me.isDead) {
      const invBtn = document.createElement('button');
      invBtn.textContent = '⚔️';
      invBtn.title = `Invite ${m.name}`;
      invBtn.style.cssText = 'padding:2px 6px;background:rgba(100,160,255,0.15);border:1px solid rgba(100,160,255,0.3);color:#aaddff;border-radius:4px;cursor:pointer;font-size:10px;';
      list.appendChild(row);
      continue;
    }
    list.appendChild(row);
  }
}

function inviteToParty(targetId) {
  ws.send(JSON.stringify({ type: 'party_invite', targetId }));
}

const partyLeaveBtn = document.getElementById('partyLeaveBtn');
if (partyLeaveBtn) partyLeaveBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'party_leave' }));
});

const partyAcceptBtn = document.getElementById('partyAcceptBtn');
if (partyAcceptBtn) partyAcceptBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'party_invite_accept' }));
  document.getElementById('partyInviteNotif').classList.add('hidden');
});

const partyDeclineBtn = document.getElementById('partyDeclineBtn');
if (partyDeclineBtn) partyDeclineBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'party_invite_decline' }));
  document.getElementById('partyInviteNotif').classList.add('hidden');
});

// ---------------------------------------------------------------------------
// Player context menu (appears on clicking another player)
// ---------------------------------------------------------------------------
const _playerCtxMenu = document.getElementById('playerContextMenu');
const _playerCtxAttackBtn = document.getElementById('playerContextAttack');
const _playerCtxInviteBtn = document.getElementById('playerContextInvite');
if (_playerCtxAttackBtn) _playerCtxAttackBtn.addEventListener('click', () => {
  if (!playerContextMenuId) return;
  const id = playerContextMenuId;
  hidePlayerContextMenu();
  ws.send(JSON.stringify({ type: 'strike', targetType: 'player', targetId: id }));
  triggerAttackAnim();
});
if (_playerCtxInviteBtn) _playerCtxInviteBtn.addEventListener('click', () => {
  if (!playerContextMenuId) return;
  inviteToParty(playerContextMenuId);
  hidePlayerContextMenu();
  setUnlockToast('Party invite sent!');
});
// Click anywhere else to dismiss the context menu
document.addEventListener('click', (e) => {
  if (_playerCtxMenu && !_playerCtxMenu.contains(e.target)) hidePlayerContextMenu();
});

// ---------------------------------------------------------------------------
// Party chat
// ---------------------------------------------------------------------------
const _partyChatLog = document.getElementById('partyChatLog');
const _partyChatInput = document.getElementById('partyChatInput');
const _partyChatSend = document.getElementById('partyChatSend');

function appendPartyChatLine(fromName, text) {
  if (!_partyChatLog) return;
  const line = document.createElement('div');
  line.style.cssText = 'padding:2px 0;border-bottom:1px solid rgba(100,160,255,0.08);font-size:11px;';
  const isMe = fromName === (me ? me.name : '');
  line.innerHTML = `<span style="color:${isMe ? '#88ccff' : '#ccaaff'};font-weight:700;">${fromName}:</span> <span style="color:#ddeeff;">${text}</span>`;
  _partyChatLog.appendChild(line);
  _partyChatLog.scrollTop = _partyChatLog.scrollHeight;
}

function sendPartyChatMsg() {
  if (!_partyChatInput) return;
  const text = _partyChatInput.value.trim();
  if (!text || !myParty) return;
  ws.send(JSON.stringify({ type: 'party_chat', text }));
  _partyChatInput.value = '';
}

if (_partyChatInput) {
  _partyChatInput.addEventListener('focus', () => { typing = true; });
  _partyChatInput.addEventListener('blur', () => { typing = false; });
  _partyChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendPartyChatMsg();
    e.stopPropagation();
  });
}
if (_partyChatSend) _partyChatSend.addEventListener('click', sendPartyChatMsg);

// ---------------------------------------------------------------------------
// Witch dialogue / shop modal
// ---------------------------------------------------------------------------
let witchShopOpen = false;
let witchShopItems = [];

const POTION_RECIPES_CLIENT = [
  { id: 'health_potion_ii', icon: '❤️‍🔥', name: 'Greater Healing Potion', desc: '2× Healing Herb',            ingredients: [{ id: 'healing_herb', qty: 2 }] },
  { id: 'regen_brew',       icon: '🫧',  name: 'Regen Brew',             desc: 'Regen Root + Healing Herb',   ingredients: [{ id: 'regen_root', qty: 1 }, { id: 'healing_herb', qty: 1 }] },
  { id: 'swift_brew',       icon: '💨',  name: 'Swift Brew',             desc: '2× Swift Root',               ingredients: [{ id: 'swift_root', qty: 2 }] },
  { id: 'shadow_draught',   icon: '🌘',  name: 'Shadow Draught',         desc: 'Wolfsbane + Raven\'s Feather',ingredients: [{ id: 'wolfsbane_bloom', qty: 1 }, { id: 'ravens_feather_plant', qty: 1 }] },
  { id: 'giants_elixir',    icon: '🍄‍🟫', name: "Giant's Elixir",         desc: "2× Giant's Cap",             ingredients: [{ id: 'giants_cap', qty: 2 }] },
  { id: 'bat_swarm_potion', icon: '🦇',  name: 'Bat Swarm Potion',       desc: "2× Bat's Breath",            ingredients: [{ id: 'bats_breath', qty: 2 }] },
  { id: 'clarity_draught',  icon: '✨',  name: 'Clarity Draught',        desc: 'Lotus + Cleansing Clover',    ingredients: [{ id: 'meditation_lotus', qty: 1 }, { id: 'cleansing_clover', qty: 1 }] },
  { id: 'chaos_brew',       icon: '🌈',  name: 'Chaos Brew',             desc: 'Rainbow + Pumpkin + Toadstool',ingredients: [{ id: 'rainbow_petal', qty: 1 }, { id: 'pumpkin_blossom', qty: 1 }, { id: 'toadstool', qty: 1 }] },
];

let _witchActiveTab = 'shop';

function openWitchModal(msg) {
  witchShopOpen = true;
  witchShopItems = msg.shopItems || [];
  const modal = document.getElementById('witchModal');
  if (!modal) return;
  document.getElementById('witchGreeting').textContent = msg.greeting || '';

  // Tab bar
  const tabBar = modal.querySelector('#witchTabBar');
  if (tabBar) {
    tabBar.querySelectorAll('button').forEach(btn => {
      btn.style.background = btn.dataset.tab === _witchActiveTab ? '#6622aa' : 'transparent';
    });
  }

  _renderWitchTab();
  document.getElementById('witchShopErr').textContent = '';
  modal.classList.remove('hidden');
}

function _renderWitchTab() {
  const shopPanel  = document.getElementById('witchShopPanel');
  const craftPanel = document.getElementById('witchCraftPanel');
  if (!shopPanel || !craftPanel) return;
  if (_witchActiveTab === 'shop') {
    shopPanel.style.display = '';
    craftPanel.style.display = 'none';
    const itemsEl = document.getElementById('witchShopItems');
    itemsEl.innerHTML = '';
    for (const item of witchShopItems) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(100,0,200,0.12);border-radius:8px;border:1px solid rgba(150,50,255,0.2);';
      row.innerHTML = `<span style="font-size:22px;">${item.icon}</span>
        <span style="flex:1;color:#e8d0ff;font-weight:600;">${item.name}</span>
        <span style="color:#cc88ff;font-size:12px;">📸 selfie</span>
        <button data-id="${item.id}" style="padding:5px 14px;background:#6622aa;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Buy</button>`;
      row.querySelector('button').addEventListener('click', () => {
        document.getElementById('witchShopErr').textContent = '';
        ws.send(JSON.stringify({ type: 'witch_buy_item', itemId: item.id }));
      });
      itemsEl.appendChild(row);
    }
  } else {
    shopPanel.style.display = 'none';
    craftPanel.style.display = '';
    const craftList = document.getElementById('witchCraftList');
    craftList.innerHTML = '';
    for (const recipe of POTION_RECIPES_CLIENT) {
      const ingText = recipe.ingredients.map(i => {
        const meta = ITEM_CATALOG[i.id];
        return `${meta?.icon || '?'} ${i.qty}× ${meta?.name || i.id}`;
      }).join(' + ');
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(100,0,200,0.12);border-radius:8px;border:1px solid rgba(150,50,255,0.2);flex-wrap:wrap;';
      row.innerHTML = `<span style="font-size:22px;">${recipe.icon}</span>
        <span style="flex:1;min-width:120px;color:#e8d0ff;font-weight:600;">${recipe.name}</span>
        <span style="color:#cc88ff;font-size:11px;flex-basis:100%;padding-left:36px;">${ingText}</span>
        <button data-rid="${recipe.id}" style="margin-left:auto;padding:5px 14px;background:#3a1866;color:#ddb0ff;border:1px solid #6622aa;border-radius:6px;cursor:pointer;font-size:12px;">Brew</button>`;
      row.querySelector('button').addEventListener('click', () => {
        document.getElementById('witchCraftErr').textContent = '';
        ws.send(JSON.stringify({ type: 'witch_craft', recipeId: recipe.id }));
      });
      craftList.appendChild(row);
    }
  }
}

function witchSwitchTab(tab) {
  _witchActiveTab = tab;
  const tabBar = document.getElementById('witchTabBar');
  if (tabBar) {
    tabBar.querySelectorAll('button').forEach(btn => {
      btn.style.background = btn.dataset.tab === tab ? '#6622aa' : 'transparent';
    });
  }
  _renderWitchTab();
}
window.witchSwitchTab = witchSwitchTab;

function closeWitchModal() {
  witchShopOpen = false;
  const modal = document.getElementById('witchModal');
  if (modal) modal.classList.add('hidden');
}

const witchModalCloseBtn = document.getElementById('witchModalClose');
if (witchModalCloseBtn) witchModalCloseBtn.addEventListener('click', closeWitchModal);

// ---------------------------------------------------------------------------
// Witch selfie consent — MUST be explicit, per memory constraint
// ---------------------------------------------------------------------------
let witchConsentOpen = false;
let activeWitchConsentId = null;

function openWitchSelfieConsent(consentId, itemName, itemIcon) {
  activeWitchConsentId = consentId;
  witchConsentOpen = true;
  closeWitchModal();
  const modal = document.getElementById('witchConsentModal');
  if (!modal) return;
  document.getElementById('witchConsentText').textContent =
    `Witch Hazel wants to take ONE photo of you right now using your camera, and list it on the Auction House for 25 gold as payment for ${itemIcon} ${itemName}. You can Allow or Decline — your camera will not open unless you click Allow.`;
  document.getElementById('witchConsentStatus').textContent = '';
  document.getElementById('witchConsentAllowBtn').disabled = false;
  document.getElementById('witchConsentDenyBtn').disabled = false;
  modal.classList.remove('hidden');
}

function closeWitchSelfieConsent() {
  witchConsentOpen = false;
  activeWitchConsentId = null;
  const modal = document.getElementById('witchConsentModal');
  if (modal) modal.classList.add('hidden');
}

const witchConsentDenyBtn = document.getElementById('witchConsentDenyBtn');
if (witchConsentDenyBtn) witchConsentDenyBtn.addEventListener('click', () => {
  if (!activeWitchConsentId) return;
  ws.send(JSON.stringify({ type: 'witch_selfie_payment', consentId: activeWitchConsentId, image: null }));
  closeWitchSelfieConsent();
  setUnlockToast('Purchase cancelled.');
});

const witchConsentAllowBtn = document.getElementById('witchConsentAllowBtn');
if (witchConsentAllowBtn) witchConsentAllowBtn.addEventListener('click', async () => {
  if (!activeWitchConsentId) return;
  const consentId = activeWitchConsentId;
  const statusEl = document.getElementById('witchConsentStatus');
  witchConsentAllowBtn.disabled = true;
  witchConsentDenyBtn.disabled = true;
  statusEl.textContent = 'Opening camera for one photo…';
  let image = null;
  try {
    image = await captureSelfiePhoto();
  } catch (e) {
    statusEl.textContent = 'Camera unavailable — purchase cancelled.';
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'witch_selfie_payment', consentId, image: null }));
      closeWitchSelfieConsent();
    }, 1600);
    return;
  }
  statusEl.textContent = 'Checking for a face…';
  const hasFace = await clientFaceCheck(image);
  if (!hasFace) {
    statusEl.textContent = 'No face detected — show your face and try again.';
    witchConsentAllowBtn.disabled = false;
    witchConsentDenyBtn.disabled = false;
    return;
  }
  statusEl.textContent = 'Photo taken. Completing your purchase…';
  ws.send(JSON.stringify({ type: 'witch_selfie_payment', consentId, image }));
  setTimeout(closeWitchSelfieConsent, 800);
});

// ---------------------------------------------------------------------------
// Quest dialogue (shown when talking to an NPC)
// ---------------------------------------------------------------------------
let pendingQuestNpcId = null;

function openQuestDialogue(npcId, npcName) {
  pendingQuestNpcId = npcId;
  ws.send(JSON.stringify({ type: 'quest_talk', npcId }));
}

function showQuestOffer(msg) {
  document.getElementById('questDialogueNpc').textContent = `💬 ${msg.npcName}`;
  document.getElementById('questDialogueName').textContent = msg.questName || '';
  document.getElementById('questDialogueDesc').textContent = msg.description || '';
  document.getElementById('questDialogueXP').textContent = msg.xpReward || 0;
  document.getElementById('questDialogue').classList.remove('hidden');
}

function closeQuestDialogue() {
  document.getElementById('questDialogue').classList.add('hidden');
  pendingQuestNpcId = null;
}

const questAcceptBtn = document.getElementById('questAcceptBtn');
if (questAcceptBtn) questAcceptBtn.addEventListener('click', () => {
  if (!pendingQuestNpcId) return;
  ws.send(JSON.stringify({ type: 'quest_accept', npcId: pendingQuestNpcId }));
  closeQuestDialogue();
});

const questDeclineBtn = document.getElementById('questDeclineBtn');
if (questDeclineBtn) questDeclineBtn.addEventListener('click', closeQuestDialogue);

// Blood Pact modal — Lexton Greyfur's deal
let bloodPactOpen = false;
function openBloodPactModal() {
  bloodPactOpen = true;
  document.getElementById('bloodPactModal').classList.remove('hidden');
}
function closeBloodPactModal() {
  bloodPactOpen = false;
  document.getElementById('bloodPactModal').classList.add('hidden');
}
const bpAcceptBtn = document.getElementById('bpAcceptBtn');
if (bpAcceptBtn) bpAcceptBtn.addEventListener('click', () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'wolf_pact' }));
  closeBloodPactModal();
});
const bpDeclineBtn = document.getElementById('bpDeclineBtn');
if (bpDeclineBtn) bpDeclineBtn.addEventListener('click', closeBloodPactModal);

function formatPrice(cents) { return '$' + (cents / 100).toFixed(2); }

function refreshUnlockUI() {
  const bar = document.getElementById('unlockBar');
  if (!bar) return;
  if (!PAYWALLS_ENABLED || unlocked || !paymentsEnabled) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  document.getElementById('unlockPrice').textContent = formatPrice(premiumPriceCents);
}

let toastTimer = null;
function setUnlockToast(text) {
  const wrap = document.getElementById('unlockToast');
  const span = document.getElementById('unlockToastText');
  if (!wrap || !span) return;
  span.textContent = text;
  wrap.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => wrap.classList.add('hidden'), 3200);
}

let lastLockMsgAt = 0;
function showLockMessage() {
  const now = Date.now();
  if (now - lastLockMsgAt < 2500) return;
  lastLockMsgAt = now;
  setUnlockToast('🔒 Locked — buy the Town Pass to enter this building.');
}

fetch('/api/config')
  .then(r => r.json())
  .then(cfg => {
    paymentsEnabled = !!cfg.paymentsEnabled;
    premiumPriceCents = cfg.premiumPriceCents || premiumPriceCents;
    roomPassPriceCents = cfg.roomPassPriceCents || roomPassPriceCents;
    roomPassHours = cfg.roomPassHours || roomPassHours;
    refreshUnlockUI();
  })
  .catch(() => {});

const unlockBtn = document.getElementById('unlockBtn');
if (unlockBtn) {
  unlockBtn.addEventListener('click', () => {
    unlockBtn.disabled = true;
    unlockBtn.textContent = 'Redirecting…';
    fetch('/api/checkout', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          setUnlockToast('⚠️ ' + (data.error || 'Could not start checkout.'));
          unlockBtn.disabled = false;
          unlockBtn.innerHTML = '🔓 Unlock all — <span id="unlockPrice">' + formatPrice(premiumPriceCents) + '</span>';
        }
      })
      .catch(() => {
        setUnlockToast('⚠️ Could not reach the server.');
        unlockBtn.disabled = false;
        unlockBtn.innerHTML = '🔓 Unlock all — <span id="unlockPrice">' + formatPrice(premiumPriceCents) + '</span>';
      });
  });
}

(function checkReturnFromCheckout() {
  const params = new URLSearchParams(location.search);
  const sessionId = params.get('unlock_session');
  const roomPassSessionId = params.get('room_pass_session');
  const passRoom = params.get('pass_room');

  if (sessionId) {
    history.replaceState(null, '', location.pathname);
    fetch('/api/verify-session?session_id=' + encodeURIComponent(sessionId))
      .then(r => r.json())
      .then(data => {
        if (data.unlocked) {
          unlocked = true;
          localStorage.setItem('tc_unlocked', '1');
          setUnlockToast('✅ Payment verified — every building is unlocked!');
          refreshUnlockUI();
          refreshBuildingLockVisuals();
        } else {
          setUnlockToast('⚠️ ' + (data.error || 'Payment was not completed.'));
        }
      })
      .catch(() => setUnlockToast('⚠️ Could not verify payment.'));
  } else if (roomPassSessionId && passRoom) {
    history.replaceState(null, '', location.pathname);
    fetch('/api/verify-session?session_id=' + encodeURIComponent(roomPassSessionId))
      .then(r => r.json())
      .then(data => {
        if (data.unlocked) {
          grantRoomPass(passRoom, roomPassHours);
          setUnlockToast(`✅ Arcade Pass active — ${roomPassHours}h of access unlocked!`);
          refreshBuildingLockVisuals();
        } else {
          setUnlockToast('⚠️ ' + (data.error || 'Payment was not completed.'));
        }
      })
      .catch(() => setUnlockToast('⚠️ Could not verify payment.'));
  }
})();

// ---------------------------------------------------------------------------
// Input — keyboard + touch joystick (unchanged)
// ---------------------------------------------------------------------------
const keys = { up:false, down:false, left:false, right:false, strafeLeft:false, strafeRight:false };
let typing = false;

// Catch-all so any text input/textarea anywhere (note composer, Hard Drive
// password fields, auction bid amounts, etc.) suppresses hotbar/movement
// keys while focused — without this, typing a digit into a password would
// also fire whatever ability is bound to that number key.
document.addEventListener('focusin', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') typing = true;
});
document.addEventListener('focusout', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') typing = false;
});

// Jump is a purely cosmetic vertical bounce on the local player's model —
// there's no gravity/physics system in this game, just an arc over a fixed
// duration (see syncVisuals()/update()).
const JUMP_DURATION = 0.45, JUMP_HEIGHT = 34;
let jumpActive = false, jumpT = 0;

function tryJump() {
  if (jumpActive || typing || passModalOpen || arcadeModalOpen || bankModalOpen || auctionModalOpen || sendMoneyModalOpen || spellConsentOpen || howlConsentOpen || npcShopOpen || witchShopOpen || witchConsentOpen || bloodPactOpen || seatedAt) return;
  jumpActive = true;
  jumpT = 0;
}

window.addEventListener('keydown', (e) => {
  if (typing || passModalOpen || arcadeModalOpen || bankModalOpen || auctionModalOpen || sendMoneyModalOpen || spellConsentOpen || howlConsentOpen || npcShopOpen || witchShopOpen || witchConsentOpen || bloodPactOpen) return;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
  if (e.key === 'q' || e.key === 'Q') keys.strafeRight = true;
  if (e.key === 'e' || e.key === 'E') keys.strafeLeft = true;
  if (e.key === ' ' && !e.repeat) { tryJump(); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
  if (e.key === 'q' || e.key === 'Q') keys.strafeRight = false;
  if (e.key === 'e' || e.key === 'E') keys.strafeLeft = false;
});

const joystickEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
let joyVec = { x: 0, y: 0 };
let joyActive = false, joyOrigin = { x: 0, y: 0 };

joystickEl.addEventListener('touchstart', (e) => {
  joyActive = true;
  const rect = joystickEl.getBoundingClientRect();
  joyOrigin = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  e.preventDefault();
}, { passive:false });
joystickEl.addEventListener('touchmove', (e) => {
  if (!joyActive) return;
  const t = e.touches[0];
  let dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y;
  const max = 40;
  const dist = Math.min(max, Math.hypot(dx, dy));
  const ang = Math.atan2(dy, dx);
  dx = Math.cos(ang) * dist; dy = Math.sin(ang) * dist;
  stickEl.style.left = (32 + dx) + 'px';
  stickEl.style.top = (32 + dy) + 'px';
  joyVec = { x: dx / max, y: dy / max };
  e.preventDefault();
}, { passive:false });
joystickEl.addEventListener('touchend', () => {
  joyActive = false; joyVec = { x: 0, y: 0 };
  stickEl.style.left = '32px'; stickEl.style.top = '32px';
});

// ---------------------------------------------------------------------------
// Mouse-drag camera orbit — click and drag on the game canvas to look
// around independently of which way the character is walking. This only
// ever offsets the CAMERA's angle (cameraYawOffset/cameraPitchOffset, used
// in updateCamera()); it never touches me.facing, so movement (driven by
// A/D and the joystick) and the character model's own rotation are
// completely unaffected.
// ---------------------------------------------------------------------------
let cameraYawOffset = 0;
let cameraPitchOffset = 0; // radians; +ve = looking up, -ve = looking down
const CAMERA_PITCH_LIMIT = 1.2; // ~69°, short of straight up/down to avoid a degenerate orbit
let dragging = false, lastDragX = 0, lastDragY = 0, dragMoved = 0;
const CLICK_DRAG_THRESHOLD = 6; // total px moved below which a mousedown+up counts as a click, not a look-drag

canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  dragMoved = 0;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  dragMoved += Math.abs(e.clientX - lastDragX) + Math.abs(e.clientY - lastDragY);
  cameraYawOffset -= (e.clientX - lastDragX) * 0.006;
  cameraPitchOffset -= (e.clientY - lastDragY) * 0.006; // drag up = look up
  cameraPitchOffset = Math.max(-CAMERA_PITCH_LIMIT, Math.min(CAMERA_PITCH_LIMIT, cameraPitchOffset));
  lastDragX = e.clientX;
  lastDragY = e.clientY;
});
window.addEventListener('mouseup', (e) => {
  dragging = false;
  if (dragMoved < CLICK_DRAG_THRESHOLD) handleCanvasClick(e.clientX, e.clientY);
});
window.addEventListener('mouseleave', () => { dragging = false; });

// ---------------------------------------------------------------------------
// Attack/harvest targeting — raycasts the mouse (or a tap) against whatever
// is actually rendered in the active scene right now (other players,
// wildlife, mobs, harvestable nature decor) and either fires a basic Strike
// at it or harvests it, depending on what got hit. A real click (see the
// drag-distance check above) is required, not just a mousedown, so this
// never fires while the player is dragging the camera to look around.
// Hovering an attackable target swaps the cursor to a sword so it's
// obvious what's a valid target before you click it.
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();

function ndcFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

// Mesh children don't carry userData themselves — only the root group does
// (see ensurePlayerVisual/getOrCreateAnimalVisual/getOrCreateMobVisual/
// addNatureDecor) — so a raycast hit on some child mesh has to walk back up
// to find it.
function findRaycastRoot(obj) {
  let o = obj;
  while (o) {
    if (o.userData && o.userData.kind) return o;
    o = o.parent;
  }
  return null;
}

function getRaycastCandidates() {
  const list = [];
  for (const id in visuals) {
    if (id === myId) continue;
    const v = visuals[id];
    if (v.inScene && v.parentScene === activeScene) list.push(v.group);
  }
  // mode stays 'outdoor' for both the town and the Wilds (the latter is
  // just a second free-roam map, not a different mode) — so which map's
  // wildlife/decor are valid targets depends on activeScene, not mode.
  if (activeScene === outdoorScene) {
    for (const id in animalVisuals) {
      const v = animalVisuals[id];
      if (!v.dead) list.push(v.mesh);
    }
    for (const id in mobVisuals) {
      const v = mobVisuals[id];
      if (v.mesh.visible) list.push(v.mesh);
    }
    for (const id in decorVisuals) {
      const v = decorVisuals[id];
      if (!v.harvested) list.push(v.group);
    }
  } else if (activeScene === wildsScene) {
    for (const id in animalVisuals2) {
      const v = animalVisuals2[id];
      if (!v.dead) list.push(v.mesh);
    }
    for (const id in mobVisuals2) {
      const v = mobVisuals2[id];
      if (v.mesh.visible) list.push(v.mesh);
    }
    for (const id in decorVisuals2) {
      const v = decorVisuals2[id];
      if (!v.harvested) list.push(v.group);
    }
  } else if (activeScene === dungeonScene) {
    for (const id in dungeonMobVisuals) {
      const v = dungeonMobVisuals[id];
      if (v.mesh.visible) list.push(v.mesh);
    }
  }
  return list;
}

function raycastHitAt(clientX, clientY) {
  if (!activeCamera) return null;
  ndcFromClient(clientX, clientY);
  raycaster.setFromCamera(pointerNDC, activeCamera);
  const hits = raycaster.intersectObjects(getRaycastCandidates(), true);
  if (hits.length === 0) return null;
  const root = findRaycastRoot(hits[0].object);
  return root ? root.userData : null;
}

// Same gate every other overlay/panel in the game uses to decide whether
// canvas input should be live right now — reused here so a click that
// lands on, say, the inventory panel doesn't also strike whatever's behind
// it on the canvas.
function anyOverlayOpen() {
  return typing || passModalOpen || arcadeModalOpen || bankModalOpen || auctionModalOpen ||
    sendMoneyModalOpen || spellConsentOpen || howlConsentOpen || inventoryOpen || npcShopOpen || witchShopOpen || witchConsentOpen || bloodPactOpen;
}

function buildEmojiCursor(emoji, size) {
  size = size || 32;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const cx = c.getContext('2d');
  cx.font = Math.floor(size * 0.82) + 'px serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(emoji, size / 2, size / 2 + 1);
  return `url(${c.toDataURL()}) ${Math.floor(size / 2)} ${Math.floor(size / 2)}, auto`;
}
const SWORD_CURSOR = buildEmojiCursor('⚔️');

// ---------------------------------------------------------------------------
// Armed targeting — picking a targeted attack/spell from the Attacks panel
// or Spellbook closes that panel and "arms" it instead of showing the old
// target dropdown; the next valid click/tap on another player in the world
// fires it at them, the same gesture as the universal Strike below. Escape
// (see the keydown chain) or clicking something that isn't a player cancels
// it. Only ever targets players — animals/mobs/decor aren't valid targets
// for curse-attacks/spells, so a click on one of those while armed is just
// ignored rather than falling through to a Strike/harvest.
// ---------------------------------------------------------------------------
let armedTarget = null; // { msgType, idField, attackId, name } or null

function armTargeting(msgType, idField, attackId, name) {
  armedTarget = { msgType, idField, attackId, name };
  const banner = document.getElementById('targetingBanner');
  if (banner) {
    document.getElementById('targetingBannerText').textContent = `🎯 ${name} — click a player to target (Esc to cancel)`;
    banner.classList.remove('hidden');
  }
}

function cancelTargeting() {
  armedTarget = null;
  const banner = document.getElementById('targetingBanner');
  if (banner) banner.classList.add('hidden');
}

const ATTACKABLE_KINDS = new Set(['player', 'animal', 'mob', 'animal2', 'mob2', 'dungeon']);

window.addEventListener('mousemove', (e) => {
  if (!gameStarted || anyOverlayOpen()) { canvas.style.cursor = 'default'; return; }
  const hit = raycastHitAt(e.clientX, e.clientY);
  if (armedTarget) {
    canvas.style.cursor = (hit && hit.kind === 'player') ? SWORD_CURSOR : 'default';
    return;
  }
  if (hit && ATTACKABLE_KINDS.has(hit.kind)) canvas.style.cursor = SWORD_CURSOR;
  else if (hit && hit.kind === 'decor') canvas.style.cursor = 'pointer';
  else canvas.style.cursor = 'default';
});

function triggerAttackAnim() {
  const v = visuals[myId];
  if (!v || !me) return;
  const weapon = me.equippedWeapon || null;
  let type = 'punch';
  if (weapon === 'iron_sword' || weapon === 'cursed_blade' || weapon === 'void_staff') type = 'slash';
  else if (weapon === 'spell_tome' || weapon === 'shadow_staff' || weapon === 'magic_scroll') type = 'cast';
  v.attackAnimStartAt = performance.now();
  v.attackAnimType = type;
}

let playerContextMenuId = null;
function showPlayerContextMenu(targetId, x, y) {
  playerContextMenuId = targetId;
  const menu = document.getElementById('playerContextMenu');
  const p = players[targetId];
  if (menu) {
    document.getElementById('playerContextName').textContent = p ? p.name : 'Player';
    // Position so it doesn't clip off screen
    menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
    menu.classList.remove('hidden');
  }
}
function hidePlayerContextMenu() {
  const menu = document.getElementById('playerContextMenu');
  if (menu) menu.classList.add('hidden');
  playerContextMenuId = null;
}

function handleCanvasClick(clientX, clientY) {
  if (!gameStarted || !me || anyOverlayOpen()) return;
  // Dismiss any open context menu first
  if (playerContextMenuId !== null) { hidePlayerContextMenu(); return; }
  const hit = raycastHitAt(clientX, clientY);
  if (armedTarget) {
    if (hit && hit.kind === 'player') {
      ws.send(JSON.stringify({ type: armedTarget.msgType, [armedTarget.idField]: armedTarget.attackId, targetId: hit.targetId }));
      cancelTargeting();
    }
    return;
  }
  if (!hit) return;
  // Clicking another player opens a context menu (attack / invite) instead of auto-striking
  if (hit.kind === 'player' && hit.targetId !== myId) {
    showPlayerContextMenu(hit.targetId, clientX, clientY);
    return;
  }
  if (ATTACKABLE_KINDS.has(hit.kind)) {
    ws.send(JSON.stringify({ type: 'strike', targetType: hit.kind, targetId: hit.targetId }));
    flashCreatureHit(hit.kind, hit.targetId);
    triggerAttackAnim();
  } else if (hit.kind === 'decor') {
    ws.send(JSON.stringify({ type: 'harvest', decorId: hit.decorId }));
  }
}

// Touch has no hover/drag-to-look distinction set up yet (see the joystick
// for movement instead), so a tap just needs its own small drag-threshold
// check the same way the mouse path does above.
let touchTapStartX = 0, touchTapStartY = 0, touchTapMoved = 0;
canvas.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  touchTapStartX = e.touches[0].clientX;
  touchTapStartY = e.touches[0].clientY;
  touchTapMoved = 0;
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (e.touches.length !== 1) return;
  touchTapMoved += Math.abs(e.touches[0].clientX - touchTapStartX) + Math.abs(e.touches[0].clientY - touchTapStartY);
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (touchTapMoved < CLICK_DRAG_THRESHOLD) handleCanvasClick(touchTapStartX, touchTapStartY);
}, { passive: true });

// ---------------------------------------------------------------------------
// Chat UI — chat only exists once you're inside a building; the open world
// ("outside") has no chat panel at all.
// ---------------------------------------------------------------------------
const chatInput = document.getElementById('chatInput');
const chatLog = document.getElementById('chatLog');
chatInput.addEventListener('focus', () => { typing = true; });
chatInput.addEventListener('blur', () => { typing = false; });
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (currentRoom === 'outside') { chatInput.value = ''; return; } // defense in depth
    sendChatMessage();
  } else if (e.key === 'Escape') {
    chatInput.blur();
  }
});

// ---------------------------------------------------------------------------
// Picture sharing — pick an image, shrink it client-side (no point sending a
// multi-megabyte phone photo over a chat socket), preview it, then send it
// alongside whatever text is in the box. Images are relayed by the server
// exactly like text, scoped to the same room.
// ---------------------------------------------------------------------------
const chatImageBtn = document.getElementById('chatImageBtn');
const chatImageFile = document.getElementById('chatImageFile');
const chatImagePreview = document.getElementById('chatImagePreview');
const chatImagePreviewImg = document.getElementById('chatImagePreviewImg');
const chatImageRemoveBtn = document.getElementById('chatImageRemoveBtn');
let pendingImage = null;

const MAX_IMAGE_DIM = 480;

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
        const scale = MAX_IMAGE_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL('image/jpeg', 0.72));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function clearPendingImage() {
  pendingImage = null;
  chatImagePreview.classList.remove('show');
  chatImagePreviewImg.src = '';
  chatImageFile.value = '';
}

if (chatImageBtn) {
  chatImageBtn.addEventListener('click', () => {
    if (currentRoom === 'outside') return;
    chatImageFile.click();
  });
}
if (chatImageFile) {
  chatImageFile.addEventListener('change', () => {
    const file = chatImageFile.files && chatImageFile.files[0];
    if (!file) return;
    resizeImageFile(file)
      .then(dataUrl => {
        pendingImage = dataUrl;
        chatImagePreviewImg.src = dataUrl;
        chatImagePreview.classList.add('show');
      })
      .catch(() => setUnlockToast('⚠️ Could not read that image.'));
  });
}
if (chatImageRemoveBtn) chatImageRemoveBtn.addEventListener('click', clearPendingImage);

// Toad's Tongue / Silver Tongue Hex are baked into the outgoing text right
// here at send time, rather than mangled for display later — that way a
// message already sent stays however it was cursed, even after the curse
// itself expires. Nothing in chat history silently "un-curses" itself.
function mangleToad(text) {
  const words = text.split(' ');
  const out = [];
  for (const w of words) {
    out.push(w);
    if (Math.random() < 0.35) out.push('*croak*');
  }
  return out.join(' ');
}

function mangleGibberish(text) {
  return text.split(' ').map(word => {
    if (word.length <= 3) return word;
    const letters = word.split('');
    const middle = letters.slice(1, -1);
    for (let i = middle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [middle[i], middle[j]] = [middle[j], middle[i]];
    }
    return letters[0] + middle.join('') + letters[letters.length - 1];
  }).join(' ');
}

function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text && !pendingImage) return;
  let outText = text;
  if (text && me && me.activeStatus) {
    if (me.activeStatus.type === 'toad') outText = mangleToad(text);
    else if (me.activeStatus.type === 'gibberish') outText = mangleGibberish(text);
  }
  const payload = { type: 'chat', text: outText };
  if (pendingImage) payload.image = pendingImage;
  ws.send(JSON.stringify(payload));
  chatInput.value = '';
  clearPendingImage();
}

function renderChatLog() {
  const msgs = messagesByRoom[currentRoom] || [];
  chatLog.innerHTML = '';
  for (const m of msgs.slice(-40)) {
    const div = document.createElement('div');
    div.className = 'chatLine';
    const b = document.createElement('b');
    b.style.color = m.color;
    b.textContent = m.name + ':';
    div.appendChild(b);
    if (m.text) div.appendChild(document.createTextNode(' ' + m.text));
    if (m.image) {
      const img = document.createElement('img');
      img.className = 'chatImg';
      img.src = m.image;
      img.title = 'Click to view full size';
      img.addEventListener('click', () => window.open(m.image, '_blank'));
      div.appendChild(img);
    }
    chatLog.appendChild(div);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ---------------------------------------------------------------------------
// Arcade-only: the (3x larger) chat panel can switch into a "send a text"
// mode. Unlike chat, this leaves the game entirely — each player logs in
// with their OWN Twilio account (not a shared one this game's operator
// pays for) and the server just relays one send request through to Twilio
// using those credentials. See server.js for what's validated/rate-limited
// there. The credentials themselves live only in this browser's
// localStorage — this client never sends them anywhere but to this game's
// own server, and the server never writes them to disk or keeps them
// beyond the single request that uses them.
// ---------------------------------------------------------------------------
const chatTabChatBtn = document.getElementById('chatTabChat');
const chatTabTextBtn = document.getElementById('chatTabText');
const chatLogView = document.getElementById('chatLogView');
const textView = document.getElementById('textView');
const twilioLoginFields = document.getElementById('twilioLoginFields');
const twilioAccountSidInput = document.getElementById('twilioAccountSid');
const twilioApiKeySidInput = document.getElementById('twilioApiKeySid');
const twilioSecretInput = document.getElementById('twilioSecret');
const twilioFromNumberInput = document.getElementById('twilioFromNumber');
const twilioSaveBtn = document.getElementById('twilioSaveBtn');
const twilioLoggedInRow = document.getElementById('twilioLoggedInRow');
const twilioLoggedInText = document.getElementById('twilioLoggedInText');
const twilioLogoutLink = document.getElementById('twilioLogoutLink');
const textSendFields = document.getElementById('textSendFields');
const textPhoneInput = document.getElementById('textPhoneInput');
const textBodyInput = document.getElementById('textBodyInput');
const textSendBtn = document.getElementById('textSendBtn');
const textStatusEl = document.getElementById('textStatus');

function setTextStatus(text, isError) {
  if (!textStatusEl) return;
  textStatusEl.textContent = text;
  textStatusEl.classList.toggle('err', !!isError);
}

let twilioCreds = null; // { accountSid, apiKeySid, secret, fromNumber }
(function loadTwilioCreds() {
  try {
    const raw = localStorage.getItem('tc_twilio');
    if (raw) twilioCreds = JSON.parse(raw);
  } catch (e) { twilioCreds = null; }
})();

function renderTwilioLoginState() {
  const loggedIn = !!(twilioCreds && twilioCreds.accountSid);
  twilioLoginFields.classList.toggle('hidden', loggedIn);
  twilioLoggedInRow.classList.toggle('hidden', !loggedIn);
  textSendFields.classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    const sid = twilioCreds.accountSid;
    twilioLoggedInText.textContent = `Twilio: ${sid.slice(0, 6)}…${sid.slice(-4)} / ${twilioCreds.fromNumber}`;
  }
}
renderTwilioLoginState();

function saveTwilioCreds(creds) {
  twilioCreds = creds;
  localStorage.setItem('tc_twilio', JSON.stringify(creds));
  renderTwilioLoginState();
}

function logoutTwilio() {
  twilioCreds = null;
  localStorage.removeItem('tc_twilio');
  renderTwilioLoginState();
  setTextStatus('Logged out of Twilio.');
}

function saveTwilioLogin() {
  const accountSid = twilioAccountSidInput.value.trim();
  const apiKeySid = twilioApiKeySidInput.value.trim();
  const secret = twilioSecretInput.value.trim();
  const fromNumber = twilioFromNumberInput.value.trim();
  if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) {
    setTextStatus('Account SID looks wrong — it should start with "AC" (34 characters total).', true);
    return;
  }
  if (apiKeySid && !/^SK[a-zA-Z0-9]{32}$/.test(apiKeySid)) {
    setTextStatus('API Key SID looks wrong — it should start with "SK" (34 characters total).', true);
    return;
  }
  if (!secret) { setTextStatus('Enter your Auth Token or API Key Secret.', true); return; }
  if (!/^\+[1-9]\d{6,14}$/.test(fromNumber)) {
    setTextStatus('Your Twilio number should look like +15551234567.', true);
    return;
  }
  saveTwilioCreds({ accountSid, apiKeySid, secret, fromNumber });
  twilioSecretInput.value = ''; // don't leave the secret sitting in the field after it's saved
  setTextStatus('Twilio account saved in this browser.');
}

function showChatTab() {
  chatLogView.classList.remove('hidden');
  textView.classList.add('hidden');
  if (chatTabChatBtn) chatTabChatBtn.classList.add('active');
  if (chatTabTextBtn) chatTabTextBtn.classList.remove('active');
}

function showTextTab() {
  chatLogView.classList.add('hidden');
  textView.classList.remove('hidden');
  if (chatTabChatBtn) chatTabChatBtn.classList.remove('active');
  if (chatTabTextBtn) chatTabTextBtn.classList.add('active');
}

function sendText() {
  if (!twilioCreds) { setTextStatus('Log in with your Twilio account first.', true); return; }
  const to = textPhoneInput.value.trim();
  const body = textBodyInput.value.trim();
  if (!to || !body) { setTextStatus('Enter a phone number and a message.', true); return; }
  setTextStatus('Sending…');
  textSendBtn.disabled = true;
  fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountSid: twilioCreds.accountSid,
      apiKeySid: twilioCreds.apiKeySid || '',
      secret: twilioCreds.secret,
      from: twilioCreds.fromNumber,
      to, body
    })
  })
    .then(r => r.json().then(data => ({ ok: r.ok, data })))
    .then(({ ok, data }) => {
      textSendBtn.disabled = false;
      if (!ok) { setTextStatus(data.error || 'Could not send that text.', true); return; }
      setTextStatus('Sent!');
      textBodyInput.value = '';
    })
    .catch(() => {
      textSendBtn.disabled = false;
      setTextStatus('Could not reach the server.', true);
    });
}

if (chatTabChatBtn) chatTabChatBtn.addEventListener('click', showChatTab);
if (chatTabTextBtn) chatTabTextBtn.addEventListener('click', showTextTab);
if (twilioSaveBtn) twilioSaveBtn.addEventListener('click', saveTwilioLogin);
if (twilioLogoutLink) twilioLogoutLink.addEventListener('click', (e) => { e.preventDefault(); logoutTwilio(); });
if (textSendBtn) textSendBtn.addEventListener('click', sendText);
for (const el of [twilioAccountSidInput, twilioApiKeySidInput, twilioSecretInput, twilioFromNumberInput, textPhoneInput, textBodyInput]) {
  if (!el) continue;
  el.addEventListener('focus', () => { typing = true; });
  el.addEventListener('blur', () => { typing = false; });
}
if (textBodyInput) {
  textBodyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') textBodyInput.blur();
  });
}

// Minimize collapses the panel down to just its header bar, so the room
// behind it (especially the Arcade's 3x-size panel) isn't blocked while
// walking around. Sticky across room changes until toggled back.
let chatMinimized = false;
const chatMinimizeBtn = document.getElementById('chatMinimizeBtn');
function setChatMinimized(min) {
  chatMinimized = min;
  document.getElementById('chatPanel').classList.toggle('minimized', chatMinimized);
  if (chatMinimizeBtn) {
    chatMinimizeBtn.textContent = chatMinimized ? '▢' : '–';
    chatMinimizeBtn.title = chatMinimized ? 'Restore chat' : 'Minimize';
  }
}
if (chatMinimizeBtn) chatMinimizeBtn.addEventListener('click', () => setChatMinimized(!chatMinimized));

let lastRoom = 'outside';
function maybeUpdateRoomUI(room) {
  if (room === lastRoom) return;
  lastRoom = room;
  currentRoom = room;
  document.getElementById('roomLabel').textContent = roomLabel(room);
  // The Wilds is open-world like the town square, not a private room — no chat panel there either.
  document.getElementById('chatPanel').classList.toggle('hidden', room === 'outside' || room === 'wilds' || room.startsWith('dungeon_'));
  document.getElementById('chatPanel').classList.toggle('arcadeMode', room === 'arcade');
  document.getElementById('chatTabs').classList.toggle('hidden', room !== 'arcade');
  if (room !== 'arcade') showChatTab(); // leaving the Arcade always lands back on plain chat
  const headerText = document.getElementById('chatHeaderText');
  if (headerText) headerText.textContent = '💬 ' + roomLabel(room);
  renderChatLog();
}

// ---------------------------------------------------------------------------
// 3D scene — Three.js (r128, loaded from CDN in index.html)
//
// Two parallel worlds share one renderer: an outdoor THREE.Scene/camera built
// once at join time, and a lazily-built interior THREE.Scene/camera per
// building (constructed the first time anyone local walks into it). Only one
// is ever rendered at a time ("activeScene"/"activeCamera"), and a player's
// humanoid model is only parented into whichever scene matches the room they
// are currently in — so buildings never leak into each other visually.
// ---------------------------------------------------------------------------
const CHAR = {
  legLen: 26, torsoH: 26, armLen: 22, headR: 8,
  get hipY() { return this.legLen; },
  get shoulderY() { return this.legLen + this.torsoH; },
  get headY() { return this.shoulderY + this.headR + 2; }
};
const WALL_HEIGHT = 110;
const OUTDOOR_CAM = { back: 165, height: 125, lookUp: 50 };
const INDOOR_CAM  = { back: 92,  height: 78,  lookUp: 42 };
const INDOOR_SEATED_CAM = { back: 55, height: 60, lookUp: 28 };
const INDOOR_SCALE = 1.8;
const INDOOR_WALL_HEIGHT = 150;

let renderer;
let outdoorScene, outdoorCamera;
let wildsScene, wildsCamera; // The Wilds — a second outdoor map reached via the portal, see buildWildsScene()/enterWilds()
let lextonNpc = null; // { armL, armR, head } refs for night howling animation
let dungeonScene = null, dungeonCamera = null; // Personal Dungeon — see buildDungeonScene()/swapToDungeonMap()
let activeScene, activeCamera;
let mode = 'outdoor';          // 'outdoor' | 'indoor'
let indoorBuildingId = null;
let currentInterior = null;    // { scene, camera, roomW, roomD, doorStart, doorEnd, wallsLocal }
let groundY = 0;
const visuals = {}; // id -> { group, armL, armR, legL, legR, nameEl, inScene, parentScene }

// Outdoor-only day/night lighting — set once in initScene(), then mutated
// every frame by updateDayNightCycle(). Indoor scenes are unaffected (each
// building's interior already has its own fixed lighting).
let outdoorAmbient = null;
let outdoorSun = null;
let outdoorMoonLight = null;
let moonMesh = null;
let dayNightWorldRadius = 1500; // how far out the sun/moon arc and ground span — set from world size
const interiorScenes = {};     // buildingId -> interior record
const lockVisuals = {};        // buildingId -> { door, lockSign }

const INTERIOR_THEMES = {
  cafe:    { label: 'Tavern',          wall: 0x8a6a4a, banner: 0xd98a4f, furniture: 'tavern',    floorTint: 0xffffff },
  library: { label: 'Scriptorium',     wall: 0x6f5a44, banner: 0x6f8fae, furniture: 'library',   floorTint: 0xb9c6ff },
  arcade:  { label: "Alchemist's Den", wall: 0x55506a, banner: 0x9b5fc0, furniture: 'alchemist',  floorTint: 0xd9b8ff },
  lounge:  { label: 'Noble Parlor & Terrace', wall: 0x7a4a52, banner: 0xc0596f, furniture: 'parlor', floorTint: 0xffc9d2 },
  hall:    { label: 'Great Hall',      wall: 0x6a6a48, banner: 0x8a9a5b, furniture: 'greathall',  floorTint: 0xd7e6a0 },
  bank:    { label: 'Grand Bank Hall', wall: 0x4a4538, banner: 0xd4af37, furniture: 'bank',       floorTint: 0xe8d9a0 }
};

// A building's visual/walkable interior can be larger than its literal
// outdoor footprint. Local-to-world conversion still anchors at the
// building's real outdoor x/y corner (see updateIndoor()), so this is safe
// as long as b.x+w and b.y+h stay within the world bounds.
//
// IMPORTANT constraints — both learned the hard way:
// 1) The player always walks in/out through the door cut into the *outdoor*
//    footprint (server.js WORLD.buildings), but collidesIndoor()/the exiting
//    check use the door gap computed from THIS override. For an east/west
//    door, that gap is derived from `h`; for a north/south door, from `w`.
//    If that one axis doesn't match the outdoor footprint's, the indoor
//    door gap is shifted relative to where the player actually enters —
//    they walk straight into what the engine thinks is solid wall and get
//    stuck unable to move (lounge's `h` didn't match). So that axis is
//    always copied from the outdoor footprint.
// 2) Local coordinates anchor at the building's outdoor (b.x, b.y) corner —
//    they don't recenter. If the door is on the *far* side of the other
//    axis (e.g. an 'east' door sits at the high-x end), the player's entry
//    point is near that footprint's far edge. Shrinking that axis below the
//    outdoor footprint's size in the override then puts the entry point
//    past the override's own far wall — outside the room entirely, which
//    immediately satisfies the "exiting" check and bounces them straight
//    back out (arcade's `w` did this). That axis must stay >= the outdoor
//    footprint's size when the door is on its far side; it's only safe to
//    shrink when the door is on the *near* (low-x/low-y) side instead.
const INTERIOR_SIZE_OVERRIDES = {
  cafe:    { w: 600, h: 340 },  // door axis (h) matches outdoor; wide sprawling tavern hall
  library: { w: 260, h: 260 },  // door axis (h) matches outdoor; door's on the near side, so narrower w is safe
  lounge:  { w: 760, h: 270 },  // door axis (h) matches outdoor; wide for stairs + terrace
  hall:    { w: 480, h: 500 },  // door axis (w) matches outdoor; deep great hall
  bank:    { w: 440, h: 600 }   // door axis (w) matches outdoor; door's on the near side (north), so deeper h is safe
};

// The Rooftop Lounge is the one two-story interior: ground floor on the west
// side (x: 0..stairs), a staircase ramping up through the middle, and an
// upstairs terrace on the east side (x: stairs..roomW) at a fixed height.
// There's no real verticality/physics engine here — a player's vertical
// position is just a function of their current local x (see getFloorHeight),
// recomputed every frame for every visible player, so walking up/down the
// stairs is just walking normally in x/z while this function makes their
// rendered Y rise and fall to match. Collision (collidesIndoor) doesn't
// change at all — it only ever cared about x/z.
const LOUNGE_STAIR_START_FRAC = 0.45;
const LOUNGE_STAIR_END_FRAC = 0.62;
const LOUNGE_PLATFORM_HEIGHT = 76;

function getFloorHeight(roomId, rx) {
  if (roomId !== 'lounge') return 0;
  const interior = interiorScenes.lounge;
  if (!interior) return 0;
  const stairStart = interior.roomW * LOUNGE_STAIR_START_FRAC;
  const stairEnd = interior.roomW * LOUNGE_STAIR_END_FRAC;
  if (rx <= stairStart) return 0;
  if (rx >= stairEnd) return LOUNGE_PLATFORM_HEIGHT;
  return LOUNGE_PLATFORM_HEIGHT * (rx - stairStart) / (stairEnd - stairStart);
}

let seatedAt = null; // {x,z,facing} in render-space coords, or null when standing

function setActiveContext(sceneObj, cameraObj, interiorRecord) {
  activeScene = sceneObj;
  activeCamera = cameraObj;
  currentInterior = interiorRecord;
  if (activeCamera) {
    activeCamera.aspect = W / H;
    activeCamera.updateProjectionMatrix();
  }
}

function getRenderPos(p) {
  if (p.room === 'outside' || p.room === 'wilds' || (p.room && p.room.startsWith('dungeon_')) || p.room === 'witch_cave' || !world) return { x: p.x, z: p.y };
  const b = world.buildings.find(bb => bb.id === p.room);
  if (!b) return { x: p.x, z: p.y };
  return { x: (p.x - b.x) * INDOOR_SCALE, z: (p.y - b.y) * INDOOR_SCALE };
}

function contextMatches(room) {
  if (mode === 'indoor') return room === indoorBuildingId;
  if (activeScene === dungeonScene) return me && room === me.room;
  if (activeScene === wildsScene) return room === 'wilds';
  if (activeScene === caveScene) return room === 'witch_cave';
  return room === 'outside';
}

function initScene(w) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0ef);
  scene.fog = new THREE.Fog(0x8fd0ef, 700, 2200);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 4000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  outdoorAmbient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(outdoorAmbient);
  outdoorSun = new THREE.DirectionalLight(0xfff3d6, 0.9);
  outdoorSun.position.set(400, 600, 300);
  scene.add(outdoorSun);

  // Moon: a separate, dimmer/cooler light plus a visible glowing sprite in
  // the sky, both only really active at night — see updateDayNightCycle().
  outdoorMoonLight = new THREE.DirectionalLight(0xcfd9ff, 0);
  outdoorMoonLight.position.set(-400, 500, -300);
  scene.add(outdoorMoonLight);

  moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(50, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xeaf2ff, transparent: true, opacity: 0 })
  );
  scene.add(moonMesh);

  dayNightWorldRadius = Math.max(w.width, w.height) * 0.9;

  const grassTex = makeGrassTexture();
  const groundSpan = Math.max(w.width, w.height) + 600;
  grassTex.repeat.set(groundSpan / 140, groundSpan / 140);
  const groundGeo = new THREE.PlaneGeometry(w.width + 600, w.height + 600);
  const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(w.width / 2, 0, w.height / 2);
  scene.add(ground);

  const dirtTex = makeDirtTexture();

  // Town-square hub: a circular dirt clearing at the spawn point that every
  // building's path connects back to.
  const hubRadius = 130;
  const hub = new THREE.Mesh(
    new THREE.CircleGeometry(hubRadius, 28),
    new THREE.MeshLambertMaterial({ map: dirtTex })
  );
  hub.rotation.x = -Math.PI / 2;
  hub.position.set(w.spawn.x, 0.22, w.spawn.y);
  scene.add(hub);

  for (const b of w.buildings) {
    scene.add(buildBuildingMesh(b, w));
    const doorPos = getDoorWorldPos(b);
    scene.add(buildPathSegment(doorPos.x, doorPos.y, w.spawn.x, w.spawn.y, 46, dirtTex, hubRadius));
  }

  addNatureDecor(scene, w, decorVisuals);
  addAnimals(scene);
  addMobs(scene);

  if (world2) {
    scene.add(buildPortalMesh(world2.portalInTown.x, world2.portalInTown.y));
    OUTDOOR_KIOSKS.push({ x: world2.portalInTown.x, z: world2.portalInTown.y, portal: 'wilds' });
  }

  buildTownNPCs(scene, w);

  outdoorScene = scene;
  outdoorCamera = camera;
  mode = 'outdoor';
  indoorBuildingId = null;
  setActiveContext(outdoorScene, outdoorCamera, null);
  refreshBuildingLockVisuals();
  TOWN_WALLS = walls; // snapshot now that tree colliders from addNatureDecor are in place

  if (world2) buildWildsScene(world2);
  buildDungeonScene();
  try { buildCaveScene(); } catch(e) { console.error('buildCaveScene failed:', e); }
}

// ---------------------------------------------------------------------------
// Crossing the portal — swaps which outdoor map is "active" the same way
// entering/exiting a building swaps scenes, just without the indoor-scaled
// coordinate system: the Wilds is its own free-roam map, not a room.
// swapToWildsMap()/swapToTownMap() do only the scene/lighting/bounds half
// (re-parenting the shared sun/moon/ambient lights into whichever scene is
// now active, swapping world/walls/dayNightWorldRadius to match) so the
// 'defeated' handler can reuse just that half without also re-sending a
// redundant move or popping a second "you stepped through the portal"
// toast on top of the defeat one.
// ---------------------------------------------------------------------------
function swapToWildsMap() {
  if (!wildsScene || !world2 || activeScene === wildsScene) return;
  for (const light of [outdoorAmbient, outdoorSun, outdoorMoonLight, moonMesh]) {
    outdoorScene.remove(light);
    wildsScene.add(light);
  }
  world = world2;
  walls = WILDS_WALLS;
  dayNightWorldRadius = Math.max(world2.width, world2.height) * 0.9;
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(wildsScene, wildsCamera, null);
}

function swapToTownMap() {
  if (!outdoorScene || !TOWN_WORLD || activeScene === outdoorScene) return;
  for (const light of [outdoorAmbient, outdoorSun, outdoorMoonLight, moonMesh]) {
    wildsScene.remove(light);
    outdoorScene.add(light);
  }
  world = TOWN_WORLD;
  walls = TOWN_WALLS;
  dayNightWorldRadius = Math.max(TOWN_WORLD.width, TOWN_WORLD.height) * 0.9;
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(outdoorScene, outdoorCamera, null);
  indoorBuildingId = null;
  const leaveBtn = document.getElementById('leaveBtn');
  if (leaveBtn) leaveBtn.classList.add('hidden');
}

function swapToDungeonMap() {
  if (!dungeonScene || activeScene === dungeonScene) return;
  world = DUNGEON_WORLD;
  walls = [];
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(dungeonScene, dungeonCamera, null);
}

function exitDungeon() {
  ws.send(JSON.stringify({ type: 'dungeon_exit' }));
}

function enterWilds() {
  if (!wildsScene || !world2 || !me) return;
  swapToWildsMap();
  cameraYawOffset = Math.PI;
  me.room = 'wilds';
  me.x = world2.spawn.x;
  me.y = world2.spawn.y;
  ws.send(JSON.stringify({ type: 'move', x: me.x, y: me.y, room: me.room }));
  setUnlockToast('🌀 You step through the portal into the Wilds.');
}

function exitWilds() {
  if (!outdoorScene || !TOWN_WORLD || !me || !world2) return;
  swapToTownMap();
  me.room = 'outside';
  // Nudge clear of the town-side portal kiosk so stepping back through
  // doesn't immediately re-trigger it (same idea as the Wilds-side return
  // portal's own offset in buildWildsScene()).
  me.x = world2.portalInTown.x;
  me.y = world2.portalInTown.y + 70;
  ws.send(JSON.stringify({ type: 'move', x: me.x, y: me.y, room: me.room }));
  setUnlockToast('🌀 You step back through the portal into town.');
}

// ---------------------------------------------------------------------------
// A standing ring with a glowing, slowly-spinning disc inside — used for
// both ends of the portal between town and the Wilds. Purely decorative;
// the actual teleport trigger is the proximity-based kiosk system (see
// OUTDOOR_KIOSKS/WILDS_KIOSKS, findNearestKiosk(), tryInteract()), exactly
// like every other walk-up-and-press-F interaction in this game.
// ---------------------------------------------------------------------------
let portalDiscs = [];
function buildPortalMesh(x, y) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(34, 6, 12, 28),
    new THREE.MeshLambertMaterial({ color: 0x4a2a8a })
  );
  ring.position.y = 38;
  g.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(30, 28),
    new THREE.MeshBasicMaterial({ color: 0x9b6fff, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
  );
  disc.position.y = 38;
  g.add(disc);
  const glow = new THREE.PointLight(0x9b6fff, 1.4, 160);
  glow.position.y = 38;
  g.add(glow);
  g.position.set(x, 0, y);
  portalDiscs.push(disc);
  return g;
}

function updatePortals(dt) {
  for (const disc of portalDiscs) disc.rotation.z += dt * 1.2;
}

// ---------------------------------------------------------------------------
// Town NPCs — 4 named quest-givers positioned around the spawn hub, each
// associated with one Wilds quest. Walk up and press F / tap to talk to
// them; the server dispatches a quest_offer in response to quest_talk.
// They're stationary (no AI wander) — the Wilds has plenty of movement.
// ---------------------------------------------------------------------------
const TOWN_NPCS = [
  { id: 'npc_mara', name: 'Ranger Mara',    charId: 3, x: 1350, y:  950 },
  { id: 'npc_finn', name: 'Herbalist Finn', charId: 0, x: 1850, y:  950 },
  { id: 'npc_dex',  name: 'Hunter Dex',     charId: 1, x: 1350, y: 1250 },
  { id: 'npc_lyra', name: 'Scholar Lyra',   charId: 2, x: 1850, y: 1250 }
];

function buildTownNPCs(scene) {
  for (const npc of TOWN_NPCS) {
    const mesh = createHumanoid(npc.charId).group;
    mesh.position.set(npc.x, 0, npc.y);
    // Face toward the spawn hub (1600, 1100) so they look natural
    mesh.rotation.y = Math.atan2(1600 - npc.x, 1100 - npc.y);
    scene.add(mesh);
    const label = makeNpcNameSprite(npc.name);
    label.position.set(npc.x, 90, npc.y);
    scene.add(label);
    OUTDOOR_KIOSKS.push({ x: npc.x, z: npc.y, npc: 'npc', npcId: npc.id, npcName: npc.name });
  }
}

// ---------------------------------------------------------------------------
// The Wilds — built once at startup right alongside the town (see the
// world2 check above), kept inactive (not the active scene/camera) until
// the player actually steps through the portal. Reuses the same sun/moon/
// ambient light objects as the town scene instead of duplicating a whole
// lighting rig — see enterWilds()/exitWilds(), which re-parent them between
// the two scenes, so updateDayNightCycle() keeps working unmodified no
// matter which one currently owns them.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Spooky wilds decor — twisted trees, graveyards, ruined buildings
// ---------------------------------------------------------------------------
function makeSpookyTree(x, z) {
  const g = new THREE.Group();
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x12080a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 6, 65, 5), darkMat);
  trunk.rotation.z = (Math.random() - 0.5) * 0.3;
  trunk.position.y = 32;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
    const len = 25 + Math.random() * 20;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(1, 2.5, len, 4), darkMat);
    br.rotation.z = Math.cos(angle) * 0.65 + (Math.random() - 0.5) * 0.2;
    br.rotation.x = Math.sin(angle) * 0.55;
    br.position.set(Math.cos(angle) * 14, 58 + Math.random() * 12, Math.sin(angle) * 14);
    g.add(br);
  }
  const foliageMat = new THREE.MeshLambertMaterial({ color: 0x1e0a30, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.ConeGeometry(9 - i * 1.5, 14, 5), foliageMat);
    c.position.set(Math.cos(a) * 9, 60 + i * 10, Math.sin(a) * 9);
    c.rotation.y = a;
    g.add(c);
  }
  g.position.set(x, 0, z);
  return g;
}

function makeGravestone(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x55555e });
  const stone = new THREE.Mesh(new THREE.BoxGeometry(14, 22, 5), mat);
  stone.position.y = 11;
  stone.rotation.y = (Math.random() - 0.5) * 0.5;
  stone.rotation.z = (Math.random() - 0.5) * 0.18;
  g.add(stone);
  const top = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  top.position.y = 22 + stone.position.y * 0;
  top.position.copy(stone.position);
  top.position.y = 22;
  g.add(top);
  const base = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 8), mat);
  base.position.y = 2;
  g.add(base);
  g.position.set(x, 0, z);
  return g;
}

function makeRuinedWall(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x3a3030 });
  const h = 25 + Math.random() * 45;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(55 + Math.random() * 50, h, 10), mat);
  wall.position.y = h / 2;
  wall.rotation.y = (Math.random() - 0.5) * 0.4;
  g.add(wall);
  // Notched top (missing chunks)
  for (let i = 0; i < 3; i++) {
    const notch = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 14), new THREE.MeshLambertMaterial({ color: 0x1a1010 }));
    notch.position.set((i - 1) * 20, h - 4, 0);
    g.add(notch);
  }
  // Rubble
  for (let i = 0; i < 4; i++) {
    const rb = new THREE.Mesh(new THREE.BoxGeometry(6 + Math.random() * 9, 5 + Math.random() * 5, 6 + Math.random() * 9), mat);
    rb.position.set((Math.random() - 0.5) * 80, 3, (Math.random() - 0.5) * 40);
    rb.rotation.y = Math.random() * Math.PI;
    g.add(rb);
  }
  g.position.set(x, 0, z);
  return g;
}

function addSpookyDecor(scene, w2) {
  const rng = (a, b) => a + Math.random() * (b - a);
  // Spooky trees — thick clusters near the cave and scattered throughout
  for (let i = 0; i < 90; i++) {
    scene.add(makeSpookyTree(rng(300, w2.width - 300), rng(300, w2.height - 300)));
  }
  // Graveyard clusters
  for (const [cx, cz] of [[1200,1500],[3500,2800],[6000,1200],[2000,7000],[7500,4000],[5000,8500]]) {
    for (let i = 0; i < 9; i++) {
      scene.add(makeGravestone(cx + rng(-110, 110), cz + rng(-110, 110)));
    }
    // Spooky trees around graveyard
    for (let i = 0; i < 5; i++) {
      scene.add(makeSpookyTree(cx + rng(-200, 200), cz + rng(-200, 200)));
    }
  }
  // Ruined buildings
  for (const [cx, cz] of [[3000,5000],[7000,7000],[1500,4000],[8500,2000]]) {
    for (let i = 0; i < 4; i++) {
      scene.add(makeRuinedWall(cx + rng(-160, 160), cz + rng(-160, 160)));
    }
  }
}

// ---------------------------------------------------------------------------
// Witch Cave scene — small dark stone room with purple crystal lights
// ---------------------------------------------------------------------------
let caveScene, caveCamera;
const CAVE_WORLD = { width: 800, height: 700, buildings: [], spawn: { x: 400, y: 450 } };
// Kiosks defined here so they work even if buildCaveScene() fails before reaching its end
const CAVE_KIOSKS = [
  { x: 400, z: 165, witch: 'hazel' },
  { x: 400, z: 640, portal: 'cave_exit' }
];

const WITCH_CAVE_ENTRANCE_X = 2000;
const WITCH_CAVE_ENTRANCE_Z = 2000;

function buildCaveScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0520);
  scene.fog = new THREE.Fog(0x0d0520, 350, 900);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 1400);
  // Assign early so swapToCaveMap works even if geometry building throws below
  caveScene = scene;
  caveCamera = camera;

  // Bright purple ambient so stone surfaces are actually visible
  scene.add(new THREE.AmbientLight(0xaa55dd, 2.5));
  // Soft fill from above so the witch/player aren't silhouettes
  const fillLight = new THREE.DirectionalLight(0xcc88ff, 0.9);
  fillLight.position.set(400, 300, 300);
  scene.add(fillLight);

  // Stone floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshLambertMaterial({ color: 0x2a1840 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(400, 0, 350);
  scene.add(floor);

  // Cave walls — pushed further out so the indoor camera (back=92) never clips them
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a1a55 });
  for (const [wx, wy, wz, ww, wh, wd] of [
    [400, 60, -20,  900, 240, 40],   // back wall (north)
    [400, 60, 730,  900, 240, 40],   // front wall (south) — pushed to 730 so camera at z≈540 can't reach it
    [-20, 60, 355,  40, 240, 800],   // left wall
    [820, 60, 355,  40, 240, 800],   // right wall
    [400, 240, 355, 1000, 40, 900],  // ceiling
  ]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, wd), wallMat);
    w.position.set(wx, wy, wz);
    scene.add(w);
  }

  // Purple crystal torch lights — brighter so the stone reads
  const crystalMat = new THREE.MeshLambertMaterial({ color: 0xdd66ff, emissive: 0x8800cc });
  for (const [tx, tz] of [[120, 100], [680, 100], [120, 490], [680, 490], [400, 280], [200, 300], [600, 300]]) {
    const light = new THREE.PointLight(0xaa33ff, 2.2, 420);
    light.position.set(tx, 90, tz);
    scene.add(light);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(10, 0), crystalMat);
    crystal.position.set(tx, 14, tz);
    scene.add(crystal);
  }

  // Witch NPC (charId 0) sitting at the back
  const witchMesh = createHumanoid(0).group;
  witchMesh.position.set(400, 0, 160);
  witchMesh.rotation.y = Math.PI;
  scene.add(witchMesh);

  // Cauldron
  const cauldron = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(18, 14, 22, 10), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  pot.position.y = 11;
  cauldron.add(pot);
  const brew = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 4, 10), new THREE.MeshLambertMaterial({ color: 0x228822, emissive: 0x115511 }));
  brew.position.y = 21;
  cauldron.add(brew);
  cauldron.position.set(400, 0, 200);
  scene.add(cauldron);

  // -------------------------------------------------------------------------
  // Tarot cards — painted canvas textures hung on cave walls
  // -------------------------------------------------------------------------
  const TAROT_CARDS = [
    { sym: '🌙', name: 'THE MOON',        num: 'XVIII' },
    { sym: '☀️', name: 'THE SUN',         num: 'XIX'  },
    { sym: '⭐', name: 'THE STAR',        num: 'XVII' },
    { sym: '💀', name: 'DEATH',           num: 'XIII' },
    { sym: '⚡', name: 'THE TOWER',       num: 'XVI'  },
    { sym: '🔮', name: 'HIGH PRIESTESS',  num: 'II'   },
    { sym: '💫', name: 'THE WORLD',       num: 'XXI'  },
    { sym: '🌑', name: 'THE DEVIL',       num: 'XV'   },
    { sym: '♾️', name: 'WHEEL OF FATE',   num: 'X'    },
    { sym: '🌿', name: 'THE HERMIT',      num: 'IX'   },
    { sym: '🔥', name: 'THE CHARIOT',     num: 'VII'  },
    { sym: '🌊', name: 'HANGED MAN',      num: 'XII'  },
  ];

  function makeTarotTexture(card) {
    const cw = 64, ch = 104;
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    // Card background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, '#120826'); grad.addColorStop(1, '#1e0a3c');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
    // Outer gold border
    ctx.strokeStyle = '#c8a000'; ctx.lineWidth = 2.5;
    ctx.strokeRect(3, 3, cw - 6, ch - 6);
    // Inner border
    ctx.strokeStyle = '#7a5500'; ctx.lineWidth = 1;
    ctx.strokeRect(7, 7, cw - 14, ch - 14);
    // Corner ornaments
    for (const [ox, oy] of [[10, 10], [cw-10, 10], [10, ch-10], [cw-10, ch-10]]) {
      ctx.fillStyle = '#c8a000'; ctx.beginPath();
      ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // Roman numeral
    ctx.fillStyle = '#aa8800'; ctx.font = '7px serif'; ctx.textAlign = 'center';
    ctx.fillText(card.num, cw / 2, 20);
    // Main symbol
    ctx.font = '30px serif'; ctx.textAlign = 'center';
    ctx.fillText(card.sym, cw / 2, 58);
    // Card name
    ctx.fillStyle = '#e0c060'; ctx.font = 'bold 6px sans-serif';
    ctx.fillText(card.name, cw / 2, 82);
    // Decorative dots
    ctx.fillStyle = '#7a5500';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(12 + i * 10, 90, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  }

  const cardW = 60, cardH = 96;

  // Back wall (north, z≈0) — 6 cards spread across x=100..700
  const backCardXs = [110, 230, 350, 470, 590, 710];
  backCardXs.forEach((cx, i) => {
    const card = TAROT_CARDS[i];
    const mat = new THREE.MeshLambertMaterial({ map: makeTarotTexture(card), emissive: 0x110022, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), mat);
    mesh.position.set(cx, 90, 2);   // just in front of back wall
    scene.add(mesh);
  });

  // Left wall (x≈0) — 3 cards facing right (+x)
  [{ z: 220, idx: 6 }, { z: 380, idx: 7 }, { z: 520, idx: 8 }].forEach(({ z, idx }) => {
    const mat = new THREE.MeshLambertMaterial({ map: makeTarotTexture(TAROT_CARDS[idx]), emissive: 0x110022, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), mat);
    mesh.position.set(2, 90, z);
    mesh.rotation.y = Math.PI / 2;
    scene.add(mesh);
  });

  // Right wall (x≈800) — 3 cards facing left (-x)
  [{ z: 220, idx: 9 }, { z: 380, idx: 10 }, { z: 520, idx: 11 }].forEach(({ z, idx }) => {
    const mat = new THREE.MeshLambertMaterial({ map: makeTarotTexture(TAROT_CARDS[idx]), emissive: 0x110022, emissiveIntensity: 0.5 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), mat);
    mesh.position.set(798, 90, z);
    mesh.rotation.y = -Math.PI / 2;
    scene.add(mesh);
  });

  // -------------------------------------------------------------------------
  // Rune circle painted on the floor under the cauldron
  // -------------------------------------------------------------------------
  (function() {
    const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256;
    const rx = rc.getContext('2d');
    // Faint circle
    rx.strokeStyle = 'rgba(180,80,255,0.6)'; rx.lineWidth = 3;
    rx.beginPath(); rx.arc(128, 128, 110, 0, Math.PI * 2); rx.stroke();
    rx.beginPath(); rx.arc(128, 128, 88, 0, Math.PI * 2); rx.stroke();
    // Inner star
    rx.strokeStyle = 'rgba(200,120,255,0.5)'; rx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + 3) / 6) * Math.PI * 2 - Math.PI / 2;
      rx.beginPath();
      rx.moveTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88);
      rx.lineTo(128 + Math.cos(a2) * 88, 128 + Math.sin(a2) * 88);
      rx.stroke();
    }
    // Rune glyphs around the ring
    rx.fillStyle = 'rgba(220,160,255,0.7)'; rx.font = '18px serif'; rx.textAlign = 'center';
    const runes = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ','ᛁ','ᛃ'];
    runes.forEach((r, i) => {
      const a = (i / runes.length) * Math.PI * 2 - Math.PI / 2;
      rx.fillText(r, 128 + Math.cos(a) * 102, 128 + Math.sin(a) * 102 + 6);
    });
    const runeTex = new THREE.CanvasTexture(rc);
    const runeCircle = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshLambertMaterial({ map: runeTex, transparent: true, opacity: 0.85 })
    );
    runeCircle.rotation.x = -Math.PI / 2;
    runeCircle.position.set(400, 1, 200);
    scene.add(runeCircle);
  })();

  // -------------------------------------------------------------------------
  // Alchemy table (northwest corner) with potion supplies
  // -------------------------------------------------------------------------
  (function() {
    const woodMat  = new THREE.MeshLambertMaterial({ color: 0x3a1800 });
    const darkWood = new THREE.MeshLambertMaterial({ color: 0x250e00 });
    const tableG = new THREE.Group();
    // Tabletop
    const top = new THREE.Mesh(new THREE.BoxGeometry(130, 8, 75), woodMat);
    top.position.y = 40; tableG.add(top);
    // Legs
    for (const [lx, lz] of [[-58, 32], [58, 32], [-58, -32], [58, -32]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(7, 40, 7), darkWood);
      leg.position.set(lx, 20, lz); tableG.add(leg);
    }
    tableG.position.set(180, 0, 260);
    scene.add(tableG);

    // Potion bottles on the table
    const bottleColors = [0xee2222, 0x2266ee, 0x22bb44, 0xddaa00, 0xaa22dd, 0x22cccc];
    bottleColors.forEach((col, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(4.5, 5.5, 16, 8),
        new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.25 })
      );
      body.position.y = 8; g.add(body);
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 3.5, 7, 8),
        new THREE.MeshLambertMaterial({ color: 0x334455 })
      );
      neck.position.y = 19.5; g.add(neck);
      const stopper = new THREE.Mesh(
        new THREE.SphereGeometry(2.5, 6, 6),
        new THREE.MeshLambertMaterial({ color: 0x222200 })
      );
      stopper.position.y = 23.5; g.add(stopper);
      g.position.set(120 + i * 18, 44, 244 + (i % 2 === 0 ? -8 : 8));
      scene.add(g);
    });

    // Mortar & pestle
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x556677 });
    const mortar = new THREE.Mesh(new THREE.CylinderGeometry(9, 8, 10, 10), stoneMat);
    mortar.position.set(228, 45, 280); scene.add(mortar);
    const pestle = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2, 18, 8), stoneMat);
    pestle.position.set(228, 55, 275); pestle.rotation.z = 0.4; scene.add(pestle);

    // Scattered herbs on the table
    const herbMat = new THREE.MeshLambertMaterial({ color: 0x226622 });
    for (let i = 0; i < 4; i++) {
      const herb = new THREE.Mesh(new THREE.SphereGeometry(3 + i * 0.5, 5, 4), herbMat);
      herb.scale.y = 0.4;
      herb.position.set(140 + i * 22, 45, 268);
      scene.add(herb);
    }

    // Glowing candle on table corner
    const candleMat = new THREE.MeshLambertMaterial({ color: 0xeecc88 });
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 20, 8), candleMat);
    candle.position.set(236, 50, 252); scene.add(candle);
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(3, 5, 5),
      new THREE.MeshLambertMaterial({ color: 0xff8800, emissive: 0xff5500, emissiveIntensity: 1 })
    );
    flame.position.set(236, 62, 252); scene.add(flame);
    const candleLight = new THREE.PointLight(0xff8822, 1.2, 160);
    candleLight.position.set(236, 65, 252); scene.add(candleLight);

    // A bookshelf on the left wall
    const shelfMat = new THREE.MeshLambertMaterial({ color: 0x2a1000 });
    for (let shelf = 0; shelf < 3; shelf++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(100, 6, 22), shelfMat);
      plank.position.set(55, 60 + shelf * 40, 350);
      scene.add(plank);
      // Books on shelf
      const bookCols = [0x883333, 0x334488, 0x338833, 0x884488, 0x888833];
      for (let b = 0; b < 5; b++) {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(10 + b * 2, 28 + b, 16),
          new THREE.MeshLambertMaterial({ color: bookCols[b] })
        );
        book.position.set(14 + b * 18, 78 + shelf * 40, 350);
        scene.add(book);
      }
    }
    // Shelf backing board
    const backBoard = new THREE.Mesh(new THREE.BoxGeometry(110, 135, 5), shelfMat);
    backBoard.position.set(55, 88, 363); scene.add(backBoard);
  })();

  addCaveWallShelves(scene);

  // Sign above witch
  const witchSign = makeNpcNameSprite('Witch Hazel', 'Queen of the Fifth Hand');
  witchSign.position.set(400, 118, 140);
  scene.add(witchSign);

  // Exit arch near south end of cave
  const exitMat = new THREE.MeshLambertMaterial({ color: 0x2a104a });
  const exitArch = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 30), exitMat);
  exitArch.position.set(400, 40, 650);
  scene.add(exitArch);
  const exitGlow = new THREE.PointLight(0x4488ff, 1.4, 180);
  exitGlow.position.set(400, 40, 630);
  scene.add(exitGlow);
  const exitSign = makeSignSprite('🌫️ Exit Cave — Press F to leave');
  exitSign.position.set(400, 110, 650);
  scene.add(exitSign);

}

function addCaveWallShelves(scene) {
  // Shelves line the SOUTH wall (interior face z=710) on both sides of the exit door.
  // Door is centred at x=400, so left shelves run x≈22–345, right x≈455–778.
  const WALL_Z  = 710;
  const SHELF_Z = WALL_Z - 11;   // shelf centre — protrudes 22 units into room

  const shelfMat  = new THREE.MeshLambertMaterial({ color: 0x2a1408 });
  const brktMat   = new THREE.MeshLambertMaterial({ color: 0x1a0c05 });
  const boneMat   = new THREE.MeshLambertMaterial({ color: 0xc8bba0 });
  const skullMat  = new THREE.MeshLambertMaterial({ color: 0xc4b898 });
  const eyeBlack  = new THREE.MeshLambertMaterial({ color: 0x110011 });
  const pageMat   = new THREE.MeshLambertMaterial({ color: 0xd4c89a });
  const corkMat   = new THREE.MeshLambertMaterial({ color: 0x4a2a10 });
  const baseMat   = new THREE.MeshLambertMaterial({ color: 0x1a0830 });
  const sandMat   = new THREE.MeshLambertMaterial({ color: 0xddaa44 });

  function makePotion(x, y, z, col) {
    const g = new THREE.Group();
    const bH = 10, bR = 3;
    const mat = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.22 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR + 0.8, bH, 7), mat);
    body.position.y = bH / 2; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.2, bR * 0.55, 4, 6), mat);
    neck.position.y = bH + 2; g.add(neck);
    const cork = new THREE.Mesh(new THREE.SphereGeometry(1.7, 6, 5), corkMat);
    cork.position.y = bH + 4.5; g.add(cork);
    g.position.set(x, y, z);
    g.rotation.z = Math.sin(x * 7 + z * 3) * 0.12;
    scene.add(g);
  }

  function makeSkull(x, y, z, sc) {
    sc = sc || 1;
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(5.5 * sc, 8, 8), skullMat);
    head.scale.set(1, 0.88, 1.1); head.position.y = 5.5 * sc; g.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(7 * sc, 2.5 * sc, 4.5 * sc), skullMat);
    jaw.position.set(0, 0.8 * sc, 2.5 * sc); g.add(jaw);
    for (const ex of [-2 * sc, 2 * sc]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1.5 * sc, 6, 6), eyeBlack);
      eye.position.set(ex, 6.5 * sc, 4.5 * sc); g.add(eye);
    }
    g.position.set(x, y, z);
    g.rotation.y = Math.sin(x * 5 + z) * Math.PI;
    scene.add(g);
  }

  let candleLights = 0;
  function makeCandle(x, y, z, col) {
    const g = new THREE.Group();
    const cH = 14 + Math.abs(Math.sin(x * 3 + z * 2)) * 10;
    const cMat = new THREE.MeshLambertMaterial({ color: col || 0x1a0a0a });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, cH, 7), cMat);
    body.position.y = cH / 2; g.add(body);
    const drip = new THREE.Mesh(new THREE.CylinderGeometry(3, 2.8, 2, 7), cMat);
    drip.position.y = 1; g.add(drip);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 1 }));
    flame.scale.y = 1.6; flame.position.y = cH + 2.5; g.add(flame);
    g.position.set(x, y, z);
    g.rotation.z = Math.sin(x * 9 + z) * 0.08;
    scene.add(g);
    if (candleLights < 8) {
      const light = new THREE.PointLight(0xff6600, 0.55, 100);
      light.position.set(x, y + cH + 3, z);
      scene.add(light);
      candleLights++;
    }
  }

  function makeCrystal(x, y, z, col) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.38, transparent: true, opacity: 0.72 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 10), mat);
    ball.position.y = 7.5; g.add(ball);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.5, 3, 8), baseMat);
    base.position.y = 1.5; g.add(base);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeBook(x, y, z, col) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: col });
    const book = new THREE.Mesh(new THREE.BoxGeometry(9, 12, 4.5), mat);
    book.position.y = 6; g.add(book);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(7.5, 10.5, 4), pageMat);
    pages.position.set(1.5, 6, 0); g.add(pages);
    g.position.set(x, y, z);
    g.rotation.z = Math.sin(x * 4 + z * 2.3) * 0.2;
    g.rotation.y = Math.sin(x * 3) * 0.12;
    scene.add(g);
  }

  function makeHourglass(x, y, z) {
    const g = new THREE.Group();
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x334455, transparent: true, opacity: 0.75 });
    const fMat = new THREE.MeshLambertMaterial({ color: 0x2a1a00 });
    const topCone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), glassMat);
    topCone.position.y = 13.5; topCone.rotation.z = Math.PI; g.add(topCone);
    const botCone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 8), glassMat);
    botCone.position.y = 4.5; g.add(botCone);
    const sand = new THREE.Mesh(new THREE.ConeGeometry(4, 5, 8), sandMat);
    sand.position.y = 2.5; sand.rotation.z = Math.PI; g.add(sand);
    for (const fz of [-3, 3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 19, 5), fMat);
      post.position.set(fz, 9, 0); g.add(post);
    }
    const disc1 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.5, 8), fMat);
    disc1.position.y = 18.5; g.add(disc1);
    const disc2 = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.5, 8), fMat);
    disc2.position.y = 0.75; g.add(disc2);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeEyeJar(x, y, z) {
    const g = new THREE.Group();
    const jMat = new THREE.MeshLambertMaterial({ color: 0x1a3322, transparent: true, opacity: 0.68 });
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 13, 9), jMat);
    jar.position.y = 6.5; g.add(jar);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 2.5, 9), brktMat);
    lid.position.y = 14; g.add(lid);
    const ew = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xeeeedd }));
    ew.position.y = 7; g.add(ew);
    const ep = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x880000, emissive: 0x440000, emissiveIntensity: 0.4 }));
    ep.position.set(0, 7, 3.2); g.add(ep);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeBone(x, y, z) {
    const g = new THREE.Group();
    const ang = Math.abs(Math.sin(x * 6 + z * 2)) * 0.5 + 0.2;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 18, 6), boneMat);
    shaft.position.y = 9; shaft.rotation.z = ang; g.add(shaft);
    const cosA = Math.cos(ang), sinA = Math.sin(ang);
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 6, 6), boneMat);
    e1.position.set(-sinA * 9, 9 + cosA * 9, 0); g.add(e1);
    const e2 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 6, 6), boneMat);
    e2.position.set(sinA * 9, 9 - cosA * 9, 0); g.add(e2);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeJar(x, y, z, col) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: col || 0x221133 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.5, 11, 9), mat);
    body.position.y = 5.5; g.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 3, 9), mat);
    neck.position.y = 12.5; g.add(neck);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 2.5, 9), brktMat);
    lid.position.y = 15.5; g.add(lid);
    const runeMat = new THREE.MeshLambertMaterial({ color: 0x8855aa });
    for (let ri = 0; ri < 3; ri++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.5, 0.6), runeMat);
      r.position.set(Math.cos(ri * 2.1) * 5.6, 5.5, Math.sin(ri * 2.1) * 5.6);
      g.add(r);
    }
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeMoon(x, y, z) {
    const g = new THREE.Group();
    const mMat = new THREE.MeshLambertMaterial({ color: 0xddcc66, emissive: 0x554411, emissiveIntensity: 0.5 });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 10), mMat);
    sphere.position.y = 11; g.add(sphere);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 10, 5), brktMat);
    post.position.y = 5; g.add(post);
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 5, 5), mMat);
    s1.position.set(7, 14, 0); g.add(s1);
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(1, 5, 5), mMat);
    s2.position.set(3, 17, 0); g.add(s2);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeMushroom(x, y, z, col) {
    const g = new THREE.Group();
    const stemMat = new THREE.MeshLambertMaterial({ color: 0xc8bfa8 });
    const capCol  = col || 0xcc2200;
    const capMat  = new THREE.MeshLambertMaterial({ color: capCol, emissive: capCol, emissiveIntensity: 0.12 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 8, 7), stemMat);
    stem.position.y = 4; g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(6, 9, 7), capMat);
    cap.scale.y = 0.6; cap.position.y = 10; g.add(cap);
    const spot = new THREE.Mesh(new THREE.SphereGeometry(1.2, 5, 5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    spot.position.set(3, 11, 0); g.add(spot);
    g.position.set(x, y, z);
    scene.add(g);
  }

  function makeFeatherBundle(x, y, z) {
    const g = new THREE.Group();
    const FCOLS = [0x2a2a44, 0x1a3a2a, 0x4a1a2a, 0x332244, 0x1a1a3a];
    const bind = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4, 8), brktMat);
    bind.position.y = 2; g.add(bind);
    for (let fi = 0; fi < 5; fi++) {
      const angle = (fi / 5) * Math.PI * 2;
      const fMat = new THREE.MeshLambertMaterial({ color: FCOLS[fi] });
      const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.3, 22, 5), fMat);
      quill.position.set(Math.cos(angle) * 2, 14, Math.sin(angle) * 2);
      quill.rotation.z = Math.cos(angle) * 0.28;
      quill.rotation.x = Math.sin(angle) * 0.28;
      g.add(quill);
    }
    g.position.set(x, y, z);
    scene.add(g);
  }

  // ── Shelf plank + wall brackets (south wall, runs along x) ──
  const TILTS_Z = [0.032, -0.041, 0.022, -0.037, 0.048, -0.026, 0.038, -0.052];
  const TILTS_X = [0.009, -0.007, 0.011, -0.008, 0.006, -0.010, 0.013, -0.005];

  function addShelfSegment(x0, x1, y, idx) {
    const len = x1 - x0;
    const cx  = (x0 + x1) / 2;
    const tz  = TILTS_Z[idx % TILTS_Z.length];  // tilts one x-end up/down (crooked)
    const tx  = TILTS_X[idx % TILTS_X.length];  // slight front/back lean
    const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 6, 22), shelfMat);
    plank.position.set(cx, y, SHELF_Z);
    plank.rotation.z = tz;
    plank.rotation.x = tx;
    scene.add(plank);
    // Bracket at each x-end: vertical post + horizontal arm toward room
    for (const bx of [x0 + 4, x1 - 4]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(3.5, y - 3, 3.5), brktMat);
      post.position.set(bx, (y - 3) / 2, WALL_Z - 2);
      scene.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3, 22), brktMat);
      arm.position.set(bx, y - 4.5, SHELF_Z);
      scene.add(arm);
    }
  }

  // ── Item sequences (left side of door / right side of door) ─
  const LEFT_SEQ = [
    (x,y,z) => makePotion(x,y,z,0x662288),
    (x,y,z) => makeSkull(x,y,z),
    (x,y,z) => makeCandle(x,y,z,0x110011),
    (x,y,z) => makeBone(x,y,z),
    (x,y,z) => makePotion(x,y,z,0x117733),
    (x,y,z) => makeEyeJar(x,y,z),
    (x,y,z) => makeMushroom(x,y,z,0xcc2200),
    (x,y,z) => makeBook(x,y,z,0x440022),
    (x,y,z) => makeHourglass(x,y,z),
    (x,y,z) => makeJar(x,y,z,0x221133),
    (x,y,z) => makeMoon(x,y,z),
    (x,y,z) => makeFeatherBundle(x,y,z),
    (x,y,z) => makePotion(x,y,z,0x884400),
    (x,y,z) => makeSkull(x,y,z,0.7),
    (x,y,z) => makeCandle(x,y,z,0x0a0a1a),
    (x,y,z) => makeBook(x,y,z,0x002244),
    (x,y,z) => makeCrystal(x,y,z,0x00cccc),
    (x,y,z) => makeJar(x,y,z,0x332200),
    (x,y,z) => makeMushroom(x,y,z,0x8800cc),
    (x,y,z) => makePotion(x,y,z,0xcc4488),
  ];
  const RIGHT_SEQ = [
    (x,y,z) => makeCrystal(x,y,z,0x4400cc),
    (x,y,z) => makeBook(x,y,z,0x110011),
    (x,y,z) => makeHourglass(x,y,z),
    (x,y,z) => makeMoon(x,y,z),
    (x,y,z) => makeJar(x,y,z,0x113322),
    (x,y,z) => makeCandle(x,y,z,0x1a001a),
    (x,y,z) => makeSkull(x,y,z),
    (x,y,z) => makeCrystal(x,y,z,0x880099),
    (x,y,z) => makeFeatherBundle(x,y,z),
    (x,y,z) => makePotion(x,y,z,0x991100),
    (x,y,z) => makeEyeJar(x,y,z),
    (x,y,z) => makeBook(x,y,z,0x1a0a2a),
    (x,y,z) => makeMushroom(x,y,z,0x440099),
    (x,y,z) => makeCandle(x,y,z,0x001a0a),
    (x,y,z) => makeBone(x,y,z),
    (x,y,z) => makeJar(x,y,z,0x113300),
    (x,y,z) => makeCrystal(x,y,z,0xddaa00),
    (x,y,z) => makeSkull(x,y,z,0.65),
    (x,y,z) => makePotion(x,y,z,0xcc44aa),
    (x,y,z) => makeMoon(x,y,z),
  ];

  // ── Build shelves + populate items ───────────────────────────
  // Door spans x=360–440 (80 wide, centred at 400). Leave 20-unit gap each side.
  const SHELF_LEVELS  = [38, 77, 116, 155];
  const LEFT_SEGS     = [[22, 130], [135, 245], [250, 340]];   // left of door
  const RIGHT_SEGS    = [[460, 555], [560, 665], [670, 778]];  // right of door
  const ITEM_SPACING  = 22;

  let li = 0, ri = 0;
  for (let lv = 0; lv < SHELF_LEVELS.length; lv++) {
    const shelfY = SHELF_LEVELS[lv];
    const surfY  = shelfY + 3;

    for (let si = 0; si < LEFT_SEGS.length; si++) {
      const [x0, x1] = LEFT_SEGS[si];
      addShelfSegment(x0, x1, shelfY, si * 4 + lv);
      for (let ix = x0 + 12; ix < x1 - 8; ix += ITEM_SPACING) {
        LEFT_SEQ[li % LEFT_SEQ.length](ix, surfY, SHELF_Z);
        li++;
      }
    }
    for (let si = 0; si < RIGHT_SEGS.length; si++) {
      const [x0, x1] = RIGHT_SEGS[si];
      addShelfSegment(x0, x1, shelfY, si * 4 + lv + 2);
      for (let ix = x0 + 12; ix < x1 - 8; ix += ITEM_SPACING) {
        RIGHT_SEQ[ri % RIGHT_SEQ.length](ix, surfY, SHELF_Z);
        ri++;
      }
    }
  }
}

function swapToCaveMap() {
  if (!caveScene || activeScene === caveScene) return;
  world = CAVE_WORLD;
  walls = [];
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(caveScene, caveCamera, null);
}

function enterWitchCave() {
  if (!me || me.isDead) return;
  swapToCaveMap();
  me.room = 'witch_cave';
  me.x = CAVE_WORLD.spawn.x;
  me.y = CAVE_WORLD.spawn.y;
  ws.send(JSON.stringify({ type: 'enter_witch_cave' }));
  setUnlockToast('🕯️ You enter the Witch\'s cave...');
}

function exitWitchCave() {
  ws.send(JSON.stringify({ type: 'exit_witch_cave' }));
}

function buildWildsScene(w2) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0ef);
  // Fog/camera-far tuned the same way the town's are — distances like this
  // don't need to scale with total map size, just with how far the
  // close-behind third-person camera can usefully see along the ground.
  scene.fog = new THREE.Fog(0x8fd0ef, 700, 2200);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 4000);

  const grassTex = makeGrassTexture();
  const groundSpan = Math.max(w2.width, w2.height) + 200;
  grassTex.repeat.set(groundSpan / 140, groundSpan / 140);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(w2.width + 200, w2.height + 200),
    new THREE.MeshLambertMaterial({ map: grassTex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(w2.width / 2, 0, w2.height / 2);
  scene.add(ground);

  addNatureDecor(scene, w2, decorVisuals2);
  addAnimals2(scene);
  addMobs2(scene);
  addSpookyDecor(scene, w2);
  addVillageBuildings(scene);
  addUnboundCircleSet(scene);
  addThornwardenCamp(scene);
  addGiantWerewolfTree(scene);
  buildWildsNPCs(scene);

  // The return portal back to town
  const returnPortalX = w2.spawn.x, returnPortalY = w2.spawn.y - 80;
  scene.add(buildPortalMesh(returnPortalX, returnPortalY));
  WILDS_KIOSKS.push({ x: returnPortalX, z: returnPortalY, portal: 'town' });

  // Witch cave entrance — a dark rocky arch
  const caveEntranceMat = new THREE.MeshLambertMaterial({ color: 0x1a0f1a });
  const archBase = new THREE.Mesh(new THREE.BoxGeometry(80, 80, 40), caveEntranceMat);
  archBase.position.set(WITCH_CAVE_ENTRANCE_X, 40, WITCH_CAVE_ENTRANCE_Z);
  scene.add(archBase);
  // Arch opening (dark inset)
  const opening = new THREE.Mesh(new THREE.BoxGeometry(40, 60, 50), new THREE.MeshLambertMaterial({ color: 0x040106 }));
  opening.position.set(WITCH_CAVE_ENTRANCE_X, 35, WITCH_CAVE_ENTRANCE_Z);
  scene.add(opening);
  // Purple glow from within
  const caveGlow = new THREE.PointLight(0x8822cc, 0.8, 200);
  caveGlow.position.set(WITCH_CAVE_ENTRANCE_X, 30, WITCH_CAVE_ENTRANCE_Z - 20);
  scene.add(caveGlow);
  const caveSign = makeSignSprite('🕯️ Witch\'s Cave — Press F to enter');
  caveSign.position.set(WITCH_CAVE_ENTRANCE_X, 100, WITCH_CAVE_ENTRANCE_Z);
  scene.add(caveSign);
  WILDS_KIOSKS.push({ x: WITCH_CAVE_ENTRANCE_X, z: WITCH_CAVE_ENTRANCE_Z, portal: 'cave_enter' });

  wildsScene = scene;
  wildsCamera = camera;
}

// ---------------------------------------------------------------------------
// Village buildings — placed in the wildlands scene at server-matching coords.
// All positions use world (x, z) → Three.js (x, 0, z). Called once from
// buildWildsScene(); no dynamic state — the NPCs are handled separately.
// ---------------------------------------------------------------------------
const VX = 5000, VZ = 3000; // village center (mirrors VILLAGE_CENTER on server)

function addVillageBuildings(scene) {
  const woodMat  = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x8a7c6e });
  const roofMat  = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  const thatchMat = new THREE.MeshLambertMaterial({ color: 0xb8933a });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x3d2410 });

  function box(w, h, d, mat, px, py, pz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    scene.add(m);
    return m;
  }

  // ── Longhouse (main hall) centered at village origin
  box(260, 85, 110, woodMat, VX, 42, VZ);
  // Roof — two sloped panels meeting at a ridge
  const roofA = new THREE.Mesh(new THREE.BoxGeometry(275, 12, 75), roofMat);
  roofA.rotation.z = 0.45; roofA.position.set(VX, 107, VZ - 22); scene.add(roofA);
  const roofB = new THREE.Mesh(new THREE.BoxGeometry(275, 12, 75), roofMat);
  roofB.rotation.z = -0.45; roofB.position.set(VX, 107, VZ + 22); scene.add(roofB);
  // Ridge cap
  box(280, 10, 10, darkWood, VX, 120, VZ);
  // Door opening (dark box slightly proud of front wall)
  box(32, 52, 8, darkWood, VX, 26, VZ - 57);
  // Label sprite above longhouse
  const lhSign = makeSignSprite('🏚️ Village Hall');
  lhSign.position.set(VX, 145, VZ); scene.add(lhSign);

  // ── Blacksmith/Workshop (east of hall)
  box(90, 70, 80, stoneMat, VX + 135, 35, VZ - 50);
  // Chimney
  box(22, 55, 22, stoneMat, VX + 145, 75, VZ - 40);
  // Chimney cap (slightly wider)
  box(28, 8, 28, darkWood, VX + 145, 105, VZ - 40);
  box(35, 52, 8, darkWood, VX + 135, 26, VZ - 93); // door

  // ── Barn (west of hall)
  box(130, 80, 95, woodMat, VX - 135, 40, VZ - 45);
  // Barn roof (gambrel-ish — two-section pitched)
  const barnRoofA = new THREE.Mesh(new THREE.BoxGeometry(142, 10, 60), roofMat);
  barnRoofA.rotation.z = 0.4; barnRoofA.position.set(VX - 135, 90, VZ - 67); scene.add(barnRoofA);
  const barnRoofB = new THREE.Mesh(new THREE.BoxGeometry(142, 10, 60), roofMat);
  barnRoofB.rotation.z = -0.4; barnRoofB.position.set(VX - 135, 90, VZ - 23); scene.add(barnRoofB);
  box(138, 8, 8, darkWood, VX - 135, 97, VZ - 45); // ridge

  // ── Guard Tower (north of hall)
  box(58, 150, 58, stoneMat, VX + 50, 75, VZ - 175);
  // Battlements (4 merlons on top)
  for (let i = -1; i <= 1; i += 2) {
    box(14, 22, 12, stoneMat, VX + 50 + i * 18, 162, VZ - 175 - 27);
    box(14, 22, 12, stoneMat, VX + 50 + i * 18, 162, VZ - 175 + 27);
    box(12, 22, 14, stoneMat, VX + 50 - 27, 162, VZ - 175 + i * 18);
    box(12, 22, 14, stoneMat, VX + 50 + 27, 162, VZ - 175 + i * 18);
  }
  // Tower door
  box(22, 45, 8, darkWood, VX + 50, 22, VZ - 175 + 32);

  // ── Well (south of hall center)
  const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 38, 10), stoneMat);
  wellBase.position.set(VX - 20, 19, VZ + 75); scene.add(wellBase);
  const wellTop = new THREE.Mesh(new THREE.CylinderGeometry(24, 22, 6, 10), darkWood);
  wellTop.position.set(VX - 20, 41, VZ + 75); scene.add(wellTop);
  // Well frame posts
  box(5, 50, 5, darkWood, VX - 20 - 18, 60, VZ + 75 - 18);
  box(5, 50, 5, darkWood, VX - 20 + 18, 60, VZ + 75 - 18);
  box(40, 5, 5, darkWood, VX - 20, 83, VZ + 75 - 18); // crossbar

  // ── Fire pit (southeast of hall)
  const emberMat = new THREE.MeshLambertMaterial({ color: 0xff5500, emissive: 0xff2200, emissiveIntensity: 0.8 });
  const fireMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 8, 6), emberMat);
  fireMesh.position.set(VX + 60, 8, VZ + 80); scene.add(fireMesh);
  // Stone ring around fire
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 10), stoneMat);
    stone.position.set(VX + 60 + Math.cos(a) * 22, 5, VZ + 80 + Math.sin(a) * 22);
    stone.rotation.y = a; scene.add(stone);
  }
  const fireLight = new THREE.PointLight(0xff6600, 1.4, 320);
  fireLight.position.set(VX + 60, 35, VZ + 80); scene.add(fireLight);

  // ── Cottage A (southwest)
  box(80, 58, 68, woodMat, VX - 105, 29, VZ + 115);
  const cotARoofA = new THREE.Mesh(new THREE.BoxGeometry(88, 8, 45), thatchMat);
  cotARoofA.rotation.z = 0.5; cotARoofA.position.set(VX - 105, 68, VZ + 115 - 16); scene.add(cotARoofA);
  const cotARoofB = new THREE.Mesh(new THREE.BoxGeometry(88, 8, 45), thatchMat);
  cotARoofB.rotation.z = -0.5; cotARoofB.position.set(VX - 105, 68, VZ + 115 + 16); scene.add(cotARoofB);
  box(90, 6, 6, darkWood, VX - 105, 78, VZ + 115); // ridge
  box(24, 40, 8, darkWood, VX - 105, 20, VZ + 115 - 37); // door

  // ── Cottage B (southeast)
  box(80, 58, 68, woodMat, VX + 105, 29, VZ + 115);
  const cotBRoofA = new THREE.Mesh(new THREE.BoxGeometry(88, 8, 45), thatchMat);
  cotBRoofA.rotation.z = 0.5; cotBRoofA.position.set(VX + 105, 68, VZ + 115 - 16); scene.add(cotBRoofA);
  const cotBRoofB = new THREE.Mesh(new THREE.BoxGeometry(88, 8, 45), thatchMat);
  cotBRoofB.rotation.z = -0.5; cotBRoofB.position.set(VX + 105, 68, VZ + 115 + 16); scene.add(cotBRoofB);
  box(90, 6, 6, darkWood, VX + 105, 78, VZ + 115); // ridge
  box(24, 40, 8, darkWood, VX + 105, 20, VZ + 115 - 37); // door

  // ── Construction site (north — half-built wall segments + scaffolding)
  const csMat = new THREE.MeshLambertMaterial({ color: 0x9a8a76 });
  // Partial foundation walls at varying heights
  box(90, 30, 10, csMat, VX - 40, 15, VZ - 120);
  box(10, 55, 80, csMat, VX - 85, 27, VZ - 120);
  box(10, 42, 80, csMat, VX + 5,  21, VZ - 120);
  // Wooden floor boards (flat)
  box(100, 4, 85, woodMat, VX - 40, 3, VZ - 120);
  // Scaffolding poles
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8b6330 });
  for (const [px, pz] of [[VX - 80, VZ - 80], [VX - 80, VZ - 160], [VX + 5, VZ - 80], [VX + 5, VZ - 160]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 90, 6), poleMat);
    pole.position.set(px, 45, pz); scene.add(pole);
  }
  // Horizontal scaffold planks
  box(92, 5, 8, woodMat, VX - 38, 72, VZ - 80);
  box(92, 5, 8, woodMat, VX - 38, 72, VZ - 160);
  box(8, 5, 88, woodMat, VX - 80, 72, VZ - 120);
  box(8, 5, 88, woodMat, VX + 5, 72, VZ - 120);

  // ── Dirt path from spawn toward village (just a flattened discolored strip)
  const pathMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const path = new THREE.Mesh(new THREE.PlaneGeometry(55, 4200), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(VX, 0.5, (VZ + 8800) / 2); // midpoint between village and spawn
  scene.add(path);

  // ── Village entrance sign (south approach)
  const entranceSign = makeSignSprite('🏘️ Wildlands Village');
  entranceSign.position.set(VX, 110, VZ + 240); scene.add(entranceSign);
}

// ---------------------------------------------------------------------------
// Wildlands NPC factions — set pieces + humanoid meshes + kiosk registration
// ---------------------------------------------------------------------------

// The Unbound Circle — standing-stone ritual site in the western wilds
function addUnboundCircleSet(scene) {
  const CX = 2200, CZ = 5000;   // world coords (Three.js x/z)
  const stoneMat  = new THREE.MeshLambertMaterial({ color: 0x4a4a5a });
  const altarMat  = new THREE.MeshLambertMaterial({ color: 0x2a2035 });
  const runeMat   = new THREE.MeshLambertMaterial({ color: 0x7722cc, emissive: 0x4411aa, emissiveIntensity: 0.6 });
  const fireMat   = new THREE.MeshLambertMaterial({ color: 0x8800ff, emissive: 0x5500cc, emissiveIntensity: 1 });

  // 8 standing megaliths arranged in a ring, radius 110
  const stoneHeights = [105, 88, 115, 78, 98, 120, 85, 95];
  const stoneWidths  = [22,  18, 25,  16, 20, 24,  17, 21];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const sx = CX + Math.sin(angle) * 110;
    const sz = CZ + Math.cos(angle) * 110;
    const h  = stoneHeights[i], w = stoneWidths[i];
    const stone = new THREE.Mesh(new THREE.BoxGeometry(w, h, 15), stoneMat);
    stone.position.set(sx, h / 2, sz);
    stone.rotation.y = angle + 0.08 * (i % 3 - 1);   // slight individual tilt
    stone.rotation.z = (Math.sin(i * 2.7) * 0.04);
    scene.add(stone);
    // Carved rune glyph on inner face
    const rune = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, h * 0.3, 1), runeMat);
    rune.position.set(sx - Math.sin(angle) * 8, h * 0.55, sz - Math.cos(angle) * 8);
    rune.rotation.y = angle;
    scene.add(rune);
  }

  // Flat central altar slab
  const altar = new THREE.Mesh(new THREE.BoxGeometry(70, 18, 45), altarMat);
  altar.position.set(CX, 9, CZ);
  scene.add(altar);
  // Glowing rune surface on top of altar
  const runeTop = new THREE.Mesh(new THREE.BoxGeometry(58, 1, 35), runeMat);
  runeTop.position.set(CX, 18.5, CZ);
  scene.add(runeTop);

  // Ritual fire above altar — two concentric spheres
  const outerFlame = new THREE.Mesh(new THREE.SphereGeometry(9, 9, 9), fireMat);
  outerFlame.position.set(CX, 32, CZ);
  scene.add(outerFlame);
  const innerFlame = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xcc44ff, emissive: 0xaa22ee, emissiveIntensity: 1 }));
  innerFlame.position.set(CX, 34, CZ);
  scene.add(innerFlame);

  // Arcane glow illuminating the whole circle
  const circleGlow = new THREE.PointLight(0x7700cc, 1.2, 350);
  circleGlow.position.set(CX, 40, CZ);
  scene.add(circleGlow);
  const ambientPurple = new THREE.PointLight(0x440088, 0.5, 600);
  ambientPurple.position.set(CX, 5, CZ);
  scene.add(ambientPurple);

  // 4 torch sticks around the perimeter (inside the ring)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const tx = CX + Math.sin(angle) * 70, tz = CZ + Math.cos(angle) * 70;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 55, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a2208 }));
    stick.position.set(tx, 27.5, tz);
    scene.add(stick);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(5, 7, 7),
      new THREE.MeshLambertMaterial({ color: 0xcc44ff, emissive: 0x8800bb, emissiveIntensity: 1 }));
    flame.scale.y = 1.5; flame.position.set(tx, 60, tz);
    scene.add(flame);
    const tLight = new THREE.PointLight(0xaa33cc, 0.7, 130);
    tLight.position.set(tx, 62, tz);
    scene.add(tLight);
  }

  // Scattered boundary stones (smaller, leaning markers outside the ring)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const bx = CX + Math.sin(angle) * 155, bz = CZ + Math.cos(angle) * 155;
    const bh = 20 + (i % 3) * 8;
    const bstone = new THREE.Mesh(new THREE.BoxGeometry(10, bh, 8), stoneMat);
    bstone.position.set(bx, bh / 2, bz);
    bstone.rotation.y = angle;
    bstone.rotation.z = Math.sin(i * 1.9) * 0.15;
    scene.add(bstone);
  }

  // Circle name sign
  const circleSign = makeNpcNameSprite('The Unbound Circle');
  circleSign.position.set(CX, 155, CZ);
  scene.add(circleSign);
}

// The Thornwarden Scouts — fortified camp in the eastern wilds
function addThornwardenCamp(scene) {
  const CX = 7800, CZ = 5000;
  const postMat   = new THREE.MeshLambertMaterial({ color: 0x2a1a08 });
  const tentMat   = new THREE.MeshLambertMaterial({ color: 0x7a5a28 });
  const tentDkMat = new THREE.MeshLambertMaterial({ color: 0x5a3e18 });
  const stoneMat  = new THREE.MeshLambertMaterial({ color: 0x4a4a44 });
  const metalMat  = new THREE.MeshLambertMaterial({ color: 0x6a6a74 });
  const fireMat   = new THREE.MeshLambertMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 1 });

  // Palisade perimeter: staked posts in a rough rectangle 320×240
  const pW = 320, pH = 240, postSpacing = 38;
  const perimeter = [];
  for (let x = -pW/2; x <= pW/2; x += postSpacing) perimeter.push([x, -pH/2], [x, pH/2]);
  for (let z = -pH/2 + postSpacing; z < pH/2; z += postSpacing) perimeter.push([-pW/2, z], [pW/2, z]);
  for (const [px, pz] of perimeter) {
    const h = 72 + Math.sin(px * 0.3 + pz * 0.2) * 12;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, h, 5), postMat);
    post.position.set(CX + px, h / 2, CZ + pz);
    post.rotation.y = Math.sin(px + pz) * 0.08;
    scene.add(post);
    // Sharpened top cap
    const tip = new THREE.Mesh(new THREE.ConeGeometry(5, 18, 5), postMat);
    tip.position.set(CX + px, h + 9, CZ + pz);
    scene.add(tip);
  }

  // Top crossbeam rails connecting posts on north/south edges
  for (const pz of [-pH/2, pH/2]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(pW, 10, 10), postMat);
    rail.position.set(CX, 70, CZ + pz);
    scene.add(rail);
  }

  // Tent 1 — western half (pyramid/cone tent)
  function addTent(tx, tz, rot) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(110, 4, 80), tentDkMat);
    base.position.set(tx, 2, tz);
    scene.add(base);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0, 64, 90, 4, 1), tentMat);
    body.position.set(tx, 47, tz);
    body.rotation.y = rot;
    scene.add(body);
    const opening = new THREE.Mesh(new THREE.BoxGeometry(28, 55, 6), tentDkMat);
    opening.position.set(tx, 28, tz + 42);
    opening.rotation.y = rot;
    scene.add(opening);
  }
  addTent(CX - 80, CZ - 60, Math.PI / 4);
  addTent(CX + 80, CZ - 60, Math.PI / 4);

  // Supply crates — stacked in corner
  for (let ci = 0; ci < 5; ci++) {
    const cw = 35 + (ci % 2) * 5, ch = 30 + (ci % 3) * 5;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, 30),
      new THREE.MeshLambertMaterial({ color: 0x5a3a18 }));
    const row = Math.floor(ci / 3), col = ci % 3;
    crate.position.set(CX - 110 + col * 38, ch / 2 + row * 32, CZ + 70);
    scene.add(crate);
    // Iron banding on crate
    const band = new THREE.Mesh(new THREE.BoxGeometry(cw + 2, 5, 32), metalMat);
    band.position.set(CX - 110 + col * 38, ch / 2 + row * 32, CZ + 70);
    scene.add(band);
  }

  // Watch tower — north-east corner
  const twX = CX + 120, twZ = CZ - 95;
  for (const [ox, oz] of [[-22,-22],[22,-22],[-22,22],[22,22]]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 130, 6), postMat);
    pillar.position.set(twX + ox, 65, twZ + oz);
    scene.add(pillar);
  }
  const platform = new THREE.Mesh(new THREE.BoxGeometry(80, 12, 80), postMat);
  platform.position.set(twX, 131, twZ);
  scene.add(platform);
  const railing = new THREE.Mesh(new THREE.BoxGeometry(84, 18, 84), postMat);
  railing.position.set(twX, 149, twZ);
  // Hollow it out with an inner box — use wireframe approximation with 4 thin planks
  for (const [rox, roz, rw, rd] of [
    [0, -42, 84, 6], [0, 42, 84, 6], [-42, 0, 6, 84], [42, 0, 6, 84]
  ]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(rw, 18, rd), postMat);
    plank.position.set(twX + rox, 149, twZ + roz);
    scene.add(plank);
  }
  // Ladder rungs on south face of tower
  for (let ri = 0; ri < 6; ri++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 38, 5), postMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(twX, 18 + ri * 18, twZ + 23);
    scene.add(rung);
  }

  // Central bonfire
  const fireRing = [0x888,0.85,0.5];
  const fireBase = new THREE.Mesh(new THREE.CylinderGeometry(24, 28, 8, 10),
    new THREE.MeshLambertMaterial({ color: 0x555544 }));
  fireBase.position.set(CX, 4, CZ + 55);
  scene.add(fireBase);
  for (let fi = 0; fi < 8; fi++) {
    const angle = (fi / 8) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 50, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a2208 }));
    log.rotation.z = Math.PI / 2 - 0.3;
    log.rotation.y = angle;
    log.position.set(CX + Math.sin(angle) * 12, 8, CZ + 55 + Math.cos(angle) * 12);
    scene.add(log);
  }
  const fireFlame = new THREE.Mesh(new THREE.SphereGeometry(14, 9, 9), fireMat);
  fireFlame.scale.y = 1.8; fireFlame.position.set(CX, 28, CZ + 55);
  scene.add(fireFlame);
  const campLight = new THREE.PointLight(0xff6600, 1.4, 320);
  campLight.position.set(CX, 35, CZ + 55);
  scene.add(campLight);

  // Weapon rack — crossed swords shape
  const rackX = CX + 90, rackZ = CZ + 40;
  const rackPost = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 80, 6), postMat);
  rackPost.position.set(rackX, 40, rackZ);
  scene.add(rackPost);
  const crossBar = new THREE.Mesh(new THREE.BoxGeometry(70, 8, 8), postMat);
  crossBar.position.set(rackX, 65, rackZ);
  scene.add(crossBar);
  for (const ox of [-28, -10, 10, 28]) {
    const sword = new THREE.Mesh(new THREE.BoxGeometry(7, 45, 4), metalMat);
    sword.position.set(rackX + ox, 43, rackZ);
    sword.rotation.z = (ox < 0 ? 1 : -1) * 0.15;
    scene.add(sword);
  }

  // Flag pole with pennant
  const flagX = CX, flagZ = CZ - 108;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 140, 5), metalMat);
  pole.position.set(flagX, 70, flagZ);
  scene.add(pole);
  const pennant = new THREE.Mesh(new THREE.BoxGeometry(50, 30, 2),
    new THREE.MeshLambertMaterial({ color: 0x8a1010 }));
  pennant.position.set(flagX + 25, 135, flagZ);
  scene.add(pennant);

  // Camp sign
  const campSign = makeNpcNameSprite('Thornwarden Scout Camp');
  campSign.position.set(CX, 160, CZ);
  scene.add(campSign);
}

// ---------------------------------------------------------------------------
// The Ancient One — a massive primordial oak at (6500, 6200) in the Wilds,
// with a treehouse platform where Lexton Greyfur (werewolf) lives. He offers
// the Wolf's Pact Brew in exchange for the player's "contact list" (flavor
// only). At night he howls at the moon, arms raised, head tilted back.
// ---------------------------------------------------------------------------
function addGiantWerewolfTree(scene) {
  const TX = 6500, TZ = 6200;
  const TRUNK_H = 400, TRUNK_TOP_Y = TRUNK_H / 2; // top face of trunk geometry
  const PLATFORM_Y = 180; // treehouse floor height

  const darkBark  = new THREE.MeshLambertMaterial({ color: 0x2d1a0a });
  const midBark   = new THREE.MeshLambertMaterial({ color: 0x3d2510 });
  const woodPlank = new THREE.MeshLambertMaterial({ color: 0x6b4226 });
  const darkWood  = new THREE.MeshLambertMaterial({ color: 0x3d2010 });
  const roofMat   = new THREE.MeshLambertMaterial({ color: 0x4a3520 });
  const leafMat   = new THREE.MeshLambertMaterial({ color: 0x1a3d0a });
  const leafMat2  = new THREE.MeshLambertMaterial({ color: 0x0f2d04 });
  const leafMat3  = new THREE.MeshLambertMaterial({ color: 0x243d10 });
  const ropeMat   = new THREE.MeshLambertMaterial({ color: 0x8a7040 });

  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  function cyl(rt, rb, h, seg, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }

  // ── Trunk — ancient, gnarled, widens at base
  cyl(60, 85, TRUNK_H, 14, darkBark, TX, TRUNK_H / 2, TZ);
  // Outer texture ring (lighter band)
  cyl(62, 87, TRUNK_H, 14, midBark,  TX, TRUNK_H / 2, TZ);

  // ── Surface roots — 6 large buttress wedges radiating from base
  const ROOT_ANGLES = [0, 60, 120, 180, 240, 300];
  for (const deg of ROOT_ANGLES) {
    const ang = deg * Math.PI / 180;
    const rx = TX + Math.cos(ang) * 90, rz = TZ + Math.sin(ang) * 90;
    const rootMesh = new THREE.Mesh(
      new THREE.BoxGeometry(30, 22, 60),
      darkBark
    );
    rootMesh.position.set(rx, 11, rz);
    rootMesh.rotation.y = ang;
    rootMesh.rotation.z = Math.PI * 0.08;
    scene.add(rootMesh);
    // Tapered knob at end
    const knob = new THREE.Mesh(new THREE.SphereGeometry(14, 7, 7), darkBark);
    knob.position.set(TX + Math.cos(ang) * 115, 5, TZ + Math.sin(ang) * 115);
    scene.add(knob);
  }

  // ── Foliage — stacked sphere clusters spanning y=320 to y=580
  const FOLIAGE = [
    { r: 130, y: 350, dx:  0,  dz:  0,  mat: leafMat  },
    { r: 110, y: 430, dx: 30,  dz:-20,  mat: leafMat2 },
    { r: 115, y: 395, dx:-40,  dz: 30,  mat: leafMat3 },
    { r: 120, y: 460, dx: 20,  dz: 40,  mat: leafMat  },
    { r:  95, y: 500, dx:-25,  dz:-35,  mat: leafMat2 },
    { r: 105, y: 525, dx: 10,  dz: 10,  mat: leafMat3 },
    { r:  80, y: 555, dx:-10,  dz: 20,  mat: leafMat  },
  ];
  for (const f of FOLIAGE) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(f.r, 9, 8), f.mat);
    m.position.set(TX + f.dx, f.y, TZ + f.dz);
    scene.add(m);
  }

  // ── Ladder — cylinder rungs on trunk's south-east face, y=20 to PLATFORM_Y
  const LADDER_ANG = Math.PI * 0.25; // SE side
  const ladderX = TX + Math.cos(LADDER_ANG) * 68;
  const ladderZ = TZ + Math.sin(LADDER_ANG) * 68;
  const sideX = Math.cos(LADDER_ANG + Math.PI / 2);
  const sideZ = Math.sin(LADDER_ANG + Math.PI / 2);
  for (let ry = 22; ry < PLATFORM_Y - 10; ry += 14) {
    // Left rail
    const rungL = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 6), ropeMat);
    rungL.position.set(ladderX + sideX * 8, ry, ladderZ + sideZ * 8);
    scene.add(rungL);
    // Right rail
    const rungR = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 6), ropeMat);
    rungR.position.set(ladderX - sideX * 8, ry, ladderZ - sideZ * 8);
    scene.add(rungR);
    // Rung crossbar
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 16, 5), darkWood);
    rung.rotation.z = Math.PI / 2;
    rung.rotation.y = LADDER_ANG;
    rung.position.set(ladderX, ry, ladderZ);
    scene.add(rung);
  }

  // ── Treehouse platform — circular ring around trunk at PLATFORM_Y
  // Represented as 8 planks forming a hexadecagonal deck
  const PLANK_COUNT = 12, PLANK_W = 38, PLANK_D = 50, PLANK_H = 6;
  const PLANK_R = 105; // distance from trunk center to plank center
  for (let i = 0; i < PLANK_COUNT; i++) {
    const ang = (i / PLANK_COUNT) * Math.PI * 2;
    const px = TX + Math.cos(ang) * PLANK_R;
    const pz = TZ + Math.sin(ang) * PLANK_R;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(PLANK_W, PLANK_H, PLANK_D), woodPlank);
    plank.position.set(px, PLATFORM_Y + PLANK_H / 2, pz);
    plank.rotation.y = ang;
    scene.add(plank);
  }
  // Center infill boards (cover the gap around trunk)
  box(120, PLANK_H, 120, woodPlank, TX, PLATFORM_Y + PLANK_H / 2, TZ);

  // Platform railing posts and rails
  for (let i = 0; i < PLANK_COUNT; i++) {
    const ang = (i / PLANK_COUNT) * Math.PI * 2;
    const rx = TX + Math.cos(ang) * 148;
    const rz = TZ + Math.sin(ang) * 148;
    cyl(2, 2, 26, 5, darkWood, rx, PLATFORM_Y + 19, rz);
  }
  // Two rail rings at different heights
  for (const yOff of [8, 18]) {
    for (let i = 0; i < PLANK_COUNT; i++) {
      const a0 = (i / PLANK_COUNT) * Math.PI * 2;
      const a1 = ((i + 1) / PLANK_COUNT) * Math.PI * 2;
      const x0 = TX + Math.cos(a0) * 148, z0 = TZ + Math.sin(a0) * 148;
      const x1 = TX + Math.cos(a1) * 148, z1 = TZ + Math.sin(a1) * 148;
      const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
      const span = Math.hypot(x1 - x0, z1 - z0);
      const railAng = Math.atan2(x1 - x0, z1 - z0);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 2, 3), ropeMat);
      rail.position.set(midX, PLATFORM_Y + PLANK_H + yOff, midZ);
      rail.rotation.y = railAng;
      scene.add(rail);
    }
  }

  // ── Treehouse cabin — small wooden hut on the north side of the platform
  const HX = TX, HZ = TZ - 80;
  const HOUSE_Y = PLATFORM_Y + PLANK_H;
  // Walls (four separate panels to avoid z-fighting)
  box(92, 60, 6, woodPlank, HX,       HOUSE_Y + 30, HZ - 33); // back wall
  box(92, 60, 6, woodPlank, HX,       HOUSE_Y + 30, HZ + 33); // front wall (with door gap below)
  box(6, 60, 66, woodPlank, HX - 46,  HOUSE_Y + 30, HZ);       // left wall
  box(6, 60, 66, woodPlank, HX + 46,  HOUSE_Y + 30, HZ);       // right wall
  box(92, 6, 66, woodPlank, HX,       HOUSE_Y + 57, HZ);        // ceiling
  // Door opening — black inset on front wall
  box(20, 36, 8, new THREE.MeshLambertMaterial({ color: 0x080408 }), HX, HOUSE_Y + 18, HZ + 33);
  // Glowing windows on side walls
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(8, 14, 8),
      new THREE.MeshLambertMaterial({ color: 0xffd06a, emissive: 0xffd06a, emissiveIntensity: 0.5 }));
    win.position.set(HX + side * 46, HOUSE_Y + 35, HZ);
    scene.add(win);
  }
  // Peaked roof
  const roofGeo = new THREE.CylinderGeometry(0, 60, 50, 4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(HX, HOUSE_Y + 60 + 25, HZ);
  roof.rotation.y = Math.PI / 4;
  scene.add(roof);

  // ── Point lights
  // Warm candle glow from inside the treehouse
  const houseLight = new THREE.PointLight(0xffcc66, 1.2, 320);
  houseLight.position.set(HX, HOUSE_Y + 35, HZ);
  scene.add(houseLight);
  // Eerie moonlit blue light at base of tree
  const treeGlow = new THREE.PointLight(0x3355aa, 0.5, 280);
  treeGlow.position.set(TX, 40, TZ);
  scene.add(treeGlow);

  // ── Tree sign
  const treeSign = makeNpcNameSprite('The Ancient One');
  treeSign.position.set(TX, 620, TZ);
  scene.add(treeSign);

  // ── Lexton Greyfur — werewolf NPC on the treehouse platform
  const lextonBuilt = createHumanoid(1); // charId 1 = Werewolf
  const lextonMesh = lextonBuilt.group;
  lextonMesh.position.set(TX, PLATFORM_Y + PLANK_H, TZ - 40);
  lextonMesh.rotation.y = Math.PI; // faces south (toward approaching players)
  scene.add(lextonMesh);

  const lextonLabel = makeNpcNameSprite('Lexton Greyfur', 'Keeper of the Blood Pact');
  lextonLabel.position.set(TX, PLATFORM_Y + PLANK_H + 95, TZ - 40);
  scene.add(lextonLabel);

  // Store arm/head refs for night-howl animation
  lextonNpc = {
    armL: lextonBuilt.armL,
    armR: lextonBuilt.armR,
    head: lextonBuilt.head,
    group: lextonMesh,
    lastHowlAt: 0,
  };

  // ── Register kiosk — 'wolf_pact' type. Large radius so players can interact
  // from anywhere around the wide trunk base without needing to clip into it.
  WILDS_KIOSKS.push({ x: TX, z: TZ, npc: 'wolf_pact', npcName: 'Lexton Greyfur', radius: 200 });
}

// Spawn humanoid NPCs for both factions and register quest kiosks
function buildWildsNPCs(scene) {
  for (const npc of WILDS_NPCS) {
    const mesh = createHumanoid(npc.charId).group;
    mesh.position.set(npc.x, 0, npc.y);
    // Face roughly toward the center of the map (spawn side)
    mesh.rotation.y = Math.atan2(5000 - npc.x, 8800 - npc.y);
    scene.add(mesh);
    const label = makeNpcNameSprite(npc.name);
    label.position.set(npc.x, 90, npc.y);
    scene.add(label);
    WILDS_KIOSKS.push({ x: npc.x, z: npc.y, npc: 'quest', npcId: npc.id, npcName: npc.name });
  }
}

// ---------------------------------------------------------------------------
// Personal Dungeon scene — built once at init, swapped in when the player
// uses the Wildlands Token. Uses its own lights so the shared sun/moon
// objects never need to be re-parented here. 800×800 dark stone arena with
// torch-style point lights and stone pillars.
// ---------------------------------------------------------------------------
function buildDungeonScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080410);
  scene.fog = new THREE.Fog(0x080410, 300, 950);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 2000);

  // Dark stone floor
  const floorGeo = new THREE.PlaneGeometry(800, 800);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x201828 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(400, 0, 400);
  scene.add(floor);

  // Dim red ambient
  scene.add(new THREE.AmbientLight(0x3a1020, 0.5));

  // Torch point lights with small torch posts
  const torchSpots = [[150, 150], [650, 150], [150, 650], [650, 650], [400, 380]];
  for (const [tx, tz] of torchSpots) {
    const tLight = new THREE.PointLight(0xff6600, 1.0, 320);
    tLight.position.set(tx, 80, tz);
    scene.add(tLight);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 40, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b5030 })
    );
    post.position.set(tx, 20, tz);
    scene.add(post);
  }

  // Stone pillars around the arena
  const pillarGeo = new THREE.CylinderGeometry(18, 22, 160, 8);
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x2e283a });
  for (const [px, pz] of [[80,80],[720,80],[80,720],[720,720],[80,400],[720,400],[400,80],[400,720]]) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(px, 80, pz);
    scene.add(pillar);
  }

  // Exit portal at the north end (top of the 800×800 space)
  scene.add(buildPortalMesh(400, 50));
  DUNGEON_KIOSKS = [{ x: 400, z: 50, portal: 'dungeon_exit' }];

  dungeonScene = scene;
  dungeonCamera = camera;
}

// ---------------------------------------------------------------------------
// Day/night cycle — 20 real-world minutes of day, 20 of night, derived
// purely from wall-clock time (Date.now()) rather than anything the server
// tracks. Every connected client computes the exact same phase independently
// just from agreeing on what time it is, the same way the self-destructing
// notes feature trusts each client's clock — no WS messages, no server
// state, and it survives a server restart without skipping a beat.
// ---------------------------------------------------------------------------
const DAY_MS = 20 * 60 * 1000;
const NIGHT_MS = 20 * 60 * 1000;
const CYCLE_MS = DAY_MS + NIGHT_MS;
const DAY_NIGHT_TRANSITION_MS = 90 * 1000; // dawn/dusk blend window, eats into the tail of each phase

const SKY_DAY = new THREE.Color(0x8fd0ef);
const SKY_NIGHT = new THREE.Color(0x0a1230);
const AMBIENT_DAY = new THREE.Color(0xffffff);
const AMBIENT_NIGHT = new THREE.Color(0x8fa0ff);
const _skyColor = new THREE.Color();
const _ambientColor = new THREE.Color();

// Returns a continuous 0..1 "how much daylight" value — 1 through most of
// the day, ramping down over the last DAY_NIGHT_TRANSITION_MS of daytime,
// 0 through most of the night, ramping back up over the last
// DAY_NIGHT_TRANSITION_MS of nighttime (i.e. dawn, right before it wraps
// back to a fresh day) — plus the raw cycle position, used to arc the sun
// and moon across the sky.
function getDayNightState() {
  const cyclePos = Date.now() % CYCLE_MS;
  let lightAmount;
  if (cyclePos < DAY_MS - DAY_NIGHT_TRANSITION_MS) {
    lightAmount = 1;
  } else if (cyclePos < DAY_MS) {
    lightAmount = 1 - (cyclePos - (DAY_MS - DAY_NIGHT_TRANSITION_MS)) / DAY_NIGHT_TRANSITION_MS;
  } else if (cyclePos < CYCLE_MS - DAY_NIGHT_TRANSITION_MS) {
    lightAmount = 0;
  } else {
    lightAmount = (cyclePos - (CYCLE_MS - DAY_NIGHT_TRANSITION_MS)) / DAY_NIGHT_TRANSITION_MS;
  }
  const dayProgress = Math.min(1, cyclePos / DAY_MS);
  const nightProgress = cyclePos > DAY_MS ? (cyclePos - DAY_MS) / NIGHT_MS : 0;
  return { cyclePos, lightAmount, isNight: cyclePos >= DAY_MS, dayProgress, nightProgress };
}

function updateDayNightCycle() {
  if (!outdoorScene || !outdoorAmbient || !outdoorSun) return;
  const { lightAmount, isNight, dayProgress, nightProgress } = getDayNightState();

  _skyColor.copy(SKY_NIGHT).lerp(SKY_DAY, lightAmount);
  outdoorScene.background.copy(_skyColor);
  if (outdoorScene.fog) outdoorScene.fog.color.copy(_skyColor);
  // Kept in sync even while inactive — the Wilds shares the same day/night
  // clock, so its sky shouldn't be stuck wherever it was at startup the
  // first time a player actually steps through the portal.
  if (wildsScene) {
    wildsScene.background.copy(_skyColor);
    if (wildsScene.fog) wildsScene.fog.color.copy(_skyColor);
  }

  _ambientColor.copy(AMBIENT_NIGHT).lerp(AMBIENT_DAY, lightAmount);
  outdoorAmbient.color.copy(_ambientColor);
  outdoorAmbient.intensity = 0.38 + lightAmount * 0.27;

  // Sun arcs from one horizon to the other across the day; moon mirrors it
  // across the night. Using sin() for height means both rise and set
  // smoothly rather than popping in at a fixed height.
  const r = dayNightWorldRadius;
  const sunAngle = Math.PI * dayProgress;
  outdoorSun.position.set(Math.cos(sunAngle) * r, Math.max(40, Math.sin(sunAngle) * r * 0.6), r * 0.4);
  outdoorSun.intensity = lightAmount * 0.9;

  const moonAngle = Math.PI * nightProgress;
  const moonY = Math.sin(moonAngle) * r * 0.6; // nightProgress in [0,1] -> angle in [0,π] -> always >= 0, horizon to horizon
  moonMesh.position.set(Math.cos(moonAngle) * -r, Math.max(-80, moonY), -r * 0.4);
  outdoorMoonLight.position.copy(moonMesh.position);
  const moonStrength = 1 - lightAmount;
  outdoorMoonLight.intensity = moonStrength * 0.55;
  moonMesh.material.opacity = moonStrength;
  moonMesh.visible = moonStrength > 0.02;

  updateDayNightHud(isNight);
}

// Whether mobs should currently be visible — set from the server's
// authoritative 'wildlife_state' broadcast (see ws message handler near
// the top of this file), not derived locally, so mob visibility agrees
// with the server's simulation even if a client's clock drifts slightly
// from the lighting-only getDayNightState() above.
let lastWildlifeIsNight = false;

let lastDayNightHudState = null;
function updateDayNightHud(isNight) {
  if (isNight === lastDayNightHudState) return;
  lastDayNightHudState = isNight;
  const tag = document.getElementById('dayNightTag');
  if (!tag) return;
  tag.textContent = isNight ? '🌕 Night' : '☀️ Day';
  tag.classList.toggle('nightTag', isNight);
}

// ---------------------------------------------------------------------------
// Night-only hostile mobs — ambient, wandering presence outside the
// buildings once night falls. Deliberately NOT aggressive yet: no chasing,
// no attacking, no fleeing either (that's what makes them read as
// "hostile" rather than timid like the rabbits) — just there, for now.
//
// Positions/behavior are server-authoritative (see server.js) so every
// player sees the same mob in the same place — this client only builds the
// mesh the first time it hears about a given mob id and then interpolates
// toward whatever position the server broadcasts in 'wildlife_state'
// messages, exactly like remote players' movement already works.
// ---------------------------------------------------------------------------
// Floating billboard health bar for creatures. Hidden at full health; becomes
// visible as soon as damage is taken and color-shifts green→orange→red.
function makeHealthBarSprite(yOffset) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = '#22cc55'; ctx.fillRect(1, 1, 62, 6);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.name = 'healthBar';
  sp.scale.set(24, 3, 1);
  sp.position.y = yOffset;
  sp.renderOrder = 100;
  sp.visible = false; // hidden until first damage
  sp._hpC = c; sp._hpCtx = ctx; sp._hpTex = tex;
  return sp;
}

function updateHealthBar(sprite, hp, maxHp) {
  const pct = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
  sprite.visible = pct < 0.999;
  if (!sprite.visible) return;
  const ctx = sprite._hpCtx;
  ctx.clearRect(0, 0, 64, 8);
  ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = pct > 0.5 ? '#22cc55' : pct > 0.25 ? '#ffaa00' : '#dd2222';
  ctx.fillRect(1, 1, Math.max(0, Math.floor(62 * pct)), 6);
  sprite._hpTex.needsUpdate = true;
}

// Briefly flash a struck creature's material red as hit confirmation.
function flashCreatureHit(kind, targetId) {
  let v;
  if (kind === 'mob')     v = mobVisuals[targetId];
  else if (kind === 'mob2')    v = mobVisuals2[targetId];
  else if (kind === 'animal')  v = animalVisuals[targetId];
  else if (kind === 'animal2') v = animalVisuals2[targetId];
  else if (kind === 'dungeon') v = dungeonMobVisuals[targetId];
  if (!v || !v.mesh) return;
  v.mesh.traverse(child => {
    if (child.isMesh && child.material && child.material.emissive) child.material.emissive.set(0xff2200);
  });
  setTimeout(() => {
    v.mesh.traverse(child => {
      if (child.isMesh && child.material && child.material.emissive) child.material.emissive.set(0x000000);
    });
  }, 180);
}

function makeMob() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a1a33 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(11, 8, 8), bodyMat);
  body.scale.set(1, 0.8, 1.1);
  body.position.y = 11;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(6.5, 8, 8), bodyMat);
  head.position.set(0, 20, 6);
  g.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1.3, 6, 6), eyeMat);
    eye.position.set(side * 2.6, 21, 11.5);
    g.add(eye);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 6), bodyMat);
    horn.position.set(side * 3.2, 26, 4);
    horn.rotation.z = side * 0.3;
    g.add(horn);
  }
  g.add(makeHealthBarSprite(35));
  return g;
}

let mobVisuals = {}; // id -> { mesh, x, y, targetX, targetY, facing, targetFacing, initialized }

function addMobs(scene) {
  for (const id in mobVisuals) scene.remove(mobVisuals[id].mesh);
  mobVisuals = {};
}

function getOrCreateMobVisual(id) {
  let v = mobVisuals[id];
  if (!v) {
    const mesh = makeMob();
    mesh.visible = false;
    mesh.userData = { kind: 'mob', targetId: id };
    outdoorScene.add(mesh);
    v = mobVisuals[id] = { mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0, initialized: false, dead: false };
  }
  return v;
}

function applyMobState(list) {
  if (!outdoorScene) return;
  for (const m of list) {
    const v = getOrCreateMobVisual(m.id);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
    if (m.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
    }
  }
}

function updateMobVisuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in mobVisuals) {
    const v = mobVisuals[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    v.mesh.position.set(v.x, 0, v.y);
    v.mesh.rotation.y = v.facing;
    v.mesh.visible = lastWildlifeIsNight && !v.dead;
  }
}

// ---------------------------------------------------------------------------
// The Wilds' 4 dangerous mob types — same base shape as a town mob, just
// recolored/rescaled per type (see MOB2_VISUALS) so the 4 read as distinct
// threats at a glance, matching their distinct stats from server.js.
// ---------------------------------------------------------------------------
const MOB2_VISUALS = {
  shade_stalker: { color: 0x3a1a4a, eyeColor: 0xb98aff, scale: 0.85 },
  bog_brute:     { color: 0x3a4a26, eyeColor: 0xd8ff6f, scale: 1.35 },
  night_howler:  { color: 0x1a1a22, eyeColor: 0xff2a2a, scale: 1.0 },
  will_o_wisp:   { color: 0x4fb8d8, eyeColor: 0xeafcff, scale: 0.6 }
};

// Visual data for all 32 dungeon mob types (color, eyeColor, scale match server's DUNGEON_MOB_TYPES)
const DUNGEON_MOB_VISUALS = {
  // Tier 1
  cave_rat:        { color: 0x6b4c2a, eyeColor: 0xff9944, scale: 0.55 },
  stone_bat:       { color: 0x5a5a6e, eyeColor: 0xccccff, scale: 0.6  },
  moss_crawler:    { color: 0x3d5c2a, eyeColor: 0x99ff44, scale: 0.75 },
  fungal_grunt:    { color: 0x7a5f3a, eyeColor: 0xffdd88, scale: 1.0  },
  mud_slinger:     { color: 0x5a4a2e, eyeColor: 0xaabb66, scale: 0.85 },
  tunnel_rat:      { color: 0x7a5a3a, eyeColor: 0xff8833, scale: 0.65 },
  rock_beetle:     { color: 0x4a4a4a, eyeColor: 0x88ff44, scale: 0.9  },
  pale_sprite:     { color: 0xd4c8ff, eyeColor: 0xffffff, scale: 0.5  },
  // Tier 2
  shadow_wolf:     { color: 0x2a2a3a, eyeColor: 0xff4444, scale: 1.05 },
  dark_adder:      { color: 0x1e2b1e, eyeColor: 0x44ff88, scale: 0.75 },
  crypt_spider:    { color: 0x3a1a3a, eyeColor: 0xdd44ff, scale: 0.85 },
  bone_hound:      { color: 0xd8d0b8, eyeColor: 0xff2222, scale: 1.0  },
  venom_crawler:   { color: 0x2a4a1a, eyeColor: 0x88ff22, scale: 0.9  },
  swamp_lurker:    { color: 0x2e4a2a, eyeColor: 0x66ff44, scale: 1.15 },
  cave_troll:      { color: 0x4a5a3a, eyeColor: 0xffaa00, scale: 1.4  },
  marsh_specter:   { color: 0x6aafcc, eyeColor: 0xeaffff, scale: 0.7  },
  // Tier 3
  blood_bat:       { color: 0x8a0020, eyeColor: 0xff0000, scale: 0.8  },
  iron_golem:      { color: 0x5a6070, eyeColor: 0x4488ff, scale: 1.7  },
  feral_warden:    { color: 0x6a2020, eyeColor: 0xff6600, scale: 1.1  },
  chaos_imp:       { color: 0xcc4400, eyeColor: 0xffdd00, scale: 0.65 },
  plague_hound:    { color: 0x4a5a1a, eyeColor: 0x88ff00, scale: 1.05 },
  void_walker:     { color: 0x1a0a2a, eyeColor: 0xaa44ff, scale: 0.75 },
  stone_giant:     { color: 0x6a6a5a, eyeColor: 0xffcc44, scale: 1.8  },
  dusk_wraith:     { color: 0x4a2060, eyeColor: 0xcc88ff, scale: 0.9  },
  // Tier 4
  nightmare_beast: { color: 0x1a0022, eyeColor: 0xff00ff, scale: 1.3  },
  shadow_titan:    { color: 0x0a0010, eyeColor: 0x8800ff, scale: 1.9  },
  void_serpent:    { color: 0x220033, eyeColor: 0xdd00ff, scale: 0.85 },
  abyssal_hound:   { color: 0x1a0030, eyeColor: 0xff22aa, scale: 1.15 },
  infernal_brute:  { color: 0x8a1a00, eyeColor: 0xff4400, scale: 1.6  },
  death_knight:    { color: 0x1a1a2a, eyeColor: 0x4444ff, scale: 1.2  },
  chaos_dragon:    { color: 0x660000, eyeColor: 0xff6600, scale: 1.5  },
  void_leviathan:  { color: 0x000022, eyeColor: 0x0066ff, scale: 2.0  }
};

function makeMob2(mobType) {
  const visual = MOB2_VISUALS[mobType] || MOB2_VISUALS.night_howler;
  const g = makeMob();
  g.traverse(child => {
    if (!child.isMesh) return;
    const isEye = child.geometry.type === 'SphereGeometry' && child.geometry.parameters.radius < 2;
    child.material = child.material.clone();
    child.material.color.set(isEye ? visual.eyeColor : visual.color);
  });
  g.scale.setScalar(visual.scale);
  return g;
}

let mobVisuals2 = {};
let villageNpcVisuals = {};

function addMobs2(scene) {
  for (const id in mobVisuals2) scene.remove(mobVisuals2[id].mesh);
  mobVisuals2 = {};
}

function getOrCreateMob2Visual(id, mobType) {
  let v = mobVisuals2[id];
  if (!v) {
    const mesh = makeMob2(mobType);
    mesh.visible = false;
    mesh.userData = { kind: 'mob2', targetId: id };
    wildsScene.add(mesh);
    v = mobVisuals2[id] = { mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0, initialized: false, dead: false };
  }
  return v;
}

function applyMob2State(list) {
  if (!wildsScene) return;
  for (const m of list) {
    const v = getOrCreateMob2Visual(m.id, m.mobType);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
    if (m.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
    }
  }
}

function updateMob2Visuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in mobVisuals2) {
    const v = mobVisuals2[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    v.mesh.position.set(v.x, 0, v.y);
    v.mesh.rotation.y = v.facing;
    v.mesh.visible = lastWildlifeIsNight && !v.dead;
  }
}

function getOrCreateVillageNpcVisual(id, charId) {
  if (!villageNpcVisuals[id]) {
    const built = createHumanoid(charId);
    built.group.visible = false;
    if (wildsScene) wildsScene.add(built.group);
    villageNpcVisuals[id] = {
      group: built.group, armL: built.armL, armR: built.armR, legL: built.legL, legR: built.legR,
      x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      working: false, walkPhase: 0, initialized: false
    };
  }
  return villageNpcVisuals[id];
}

function applyVillageNpcState(npcs) {
  if (!wildsScene) return;
  for (const n of npcs) {
    const v = getOrCreateVillageNpcVisual(n.id, n.charId);
    v.targetX = n.x; v.targetY = n.y; v.targetFacing = n.facing; v.working = n.working;
    if (!v.initialized) { v.x = n.x; v.y = n.y; v.facing = n.facing; v.initialized = true; }
  }
}

function updateVillageNpcVisuals(dt) {
  if (!wildsScene) return;
  const f = 1 - Math.exp(-dt * 8);
  for (const id in villageNpcVisuals) {
    const v = villageNpcVisuals[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    v.group.position.set(v.x, 0, v.y);
    v.group.rotation.y = v.facing;

    const moving = Math.hypot(v.targetX - v.x, v.targetY - v.y) > 3;
    v.walkPhase += dt * (moving ? 5.5 : v.working ? 4 : 0);

    if (moving) {
      const swing = Math.sin(v.walkPhase) * 0.45;
      v.armL.rotation.x = swing;
      v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing * 0.65;
      v.legR.rotation.x = swing * 0.65;
      v.group.position.y = Math.abs(Math.sin(v.walkPhase)) * 2;
    } else if (v.working) {
      // Hammering motion — arms pump down, slight body bob
      const hammer = Math.abs(Math.sin(v.walkPhase * 2)) * 0.65;
      v.armL.rotation.x = -hammer;
      v.armR.rotation.x = -hammer;
      v.legL.rotation.x = 0;
      v.legR.rotation.x = 0;
      v.group.position.y = Math.abs(Math.sin(v.walkPhase)) * 2.5;
    } else {
      v.armL.rotation.x *= 0.85;
      v.armR.rotation.x *= 0.85;
      v.legL.rotation.x *= 0.85;
      v.legR.rotation.x *= 0.85;
      v.group.position.y = 0;
    }
    v.group.visible = true;
  }
}

function makeDungeonMob(mobType) {
  const visual = DUNGEON_MOB_VISUALS[mobType] || { color: 0x2a1a33, eyeColor: 0xff2222, scale: 1.0 };
  const g = makeMob();
  g.traverse(child => {
    if (!child.isMesh) return;
    const isEye = child.geometry.type === 'SphereGeometry' && child.geometry.parameters.radius < 2;
    child.material = child.material.clone();
    child.material.color.set(isEye ? visual.eyeColor : visual.color);
  });
  g.scale.setScalar(visual.scale);
  return g;
}

function getOrCreateDungeonMobVisual(id, mobType) {
  let v = dungeonMobVisuals[id];
  if (!v) {
    const mesh = makeDungeonMob(mobType);
    mesh.visible = false;
    mesh.userData = { kind: 'dungeon', targetId: id };
    mesh.traverse(c => { if (c !== mesh) c.userData = mesh.userData; });
    if (dungeonScene) dungeonScene.add(mesh);
    v = dungeonMobVisuals[id] = { mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0, initialized: false, dead: false };
  }
  return v;
}

function applyDungeonMobState(list) {
  if (!dungeonScene) return;
  for (const m of list) {
    const v = getOrCreateDungeonMobVisual(m.id, m.mobType);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    v.room = m.room;
    if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
    if (m.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
    }
  }
}

function updateDungeonMobVisuals(dt) {
  const inDungeon = dungeonScene && activeScene === dungeonScene;
  const f = 1 - Math.exp(-dt * 8);
  for (const id in dungeonMobVisuals) {
    const v = dungeonMobVisuals[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    v.mesh.position.set(v.x, 0, v.y);
    v.mesh.rotation.y = v.facing;
    const shouldShow = inDungeon && !v.dead && me && v.room === me.room;
    v.mesh.visible = shouldShow;
  }
}

function makeGrassTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  cx.fillStyle = '#3c6b40';
  cx.fillRect(0, 0, 256, 256);
  // mottled patches of lighter/darker green underneath the blades
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 10 + Math.random() * 26;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(70,120,68,0.25)' : 'rgba(40,80,42,0.25)';
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  }
  // individual blade strokes for texture
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const len = 3 + Math.random() * 6;
    const ang = Math.random() * Math.PI * 2;
    const shade = 90 + Math.random() * 70;
    cx.strokeStyle = `rgba(${shade - 40}, ${shade + 30}, ${shade - 40}, 0.55)`;
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(x, y);
    cx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    cx.stroke();
  }
  // sparse dry/yellow blades for variation
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    cx.fillStyle = 'rgba(180,170,90,0.3)';
    cx.fillRect(x, y, 2, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeTree(x, z, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const trunkH = 42 * s;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(4 * s, 5.5 * s, trunkH, 6),
    new THREE.MeshLambertMaterial({ color: 0x5a3d24 })
  );
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const foliageColors = [0x2f6b35, 0x386f3c, 0x356633];
  for (let i = 0; i < 3; i++) {
    const r = (24 - i * 5) * s;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, 28 * s, 8),
      new THREE.MeshLambertMaterial({ color: foliageColors[i] })
    );
    cone.position.y = trunkH + i * 15 * s + 8 * s;
    g.add(cone);
  }
  g.position.set(x, 0, z);
  return g;
}

function makeShrub(x, z, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const colors = [0x3a7a3f, 0x2f6b35, 0x4a8a4f];
  for (let i = 0; i < 3; i++) {
    const r = (9 + Math.random() * 4) * s;
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(r, 8, 8),
      new THREE.MeshLambertMaterial({ color: colors[i] })
    );
    bush.position.set((Math.random() - 0.5) * 9 * s, r * 0.7, (Math.random() - 0.5) * 9 * s);
    g.add(bush);
  }
  g.position.set(x, 0, z);
  return g;
}

function makeRock(x, z, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const colors = [0x7a7a72, 0x6b6b63, 0x8a8a80];
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const r = (7 + Math.random() * 5) * s;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(r, 0),
      new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
    );
    rock.position.set((Math.random() - 0.5) * 10 * s, r * 0.55, (Math.random() - 0.5) * 10 * s);
    rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    g.add(rock);
  }
  g.position.set(x, 0, z);
  return g;
}

function makeFlowerPatch(x, z, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const colors = [0xff6b9b, 0xffd43b, 0xf783ac, 0xffa94d, 0xeebbff];
  for (let i = 0; i < 7; i++) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6 * s, 0.6 * s, 6 * s, 4),
      new THREE.MeshLambertMaterial({ color: 0x3a7a3f })
    );
    const px = (Math.random() - 0.5) * 16 * s, pz = (Math.random() - 0.5) * 16 * s;
    stem.position.set(px, 3 * s, pz);
    g.add(stem);
    const bloom = new THREE.Mesh(
      new THREE.SphereGeometry(2 * s, 6, 6),
      new THREE.MeshLambertMaterial({ color: colors[i % colors.length] })
    );
    bloom.position.set(px, 6.5 * s, pz);
    g.add(bloom);
  }
  g.position.set(x, 0, z);
  return g;
}

// ---------------------------------------------------------------------------
// The Wilds' 16 harvestable plants — each gets a distinct color and one of
// 3 simple shape families (bloom/mushroom/sprout) so all 16 read as
// different at a glance even without 16 fully bespoke models. Their actual
// gameplay differences (the 16 different effects) live server-side in
// PLANT_CATALOG; this is purely the look.
// ---------------------------------------------------------------------------
const PLANT_VISUALS = {
  swift_root:           { shape: 'sprout',   color: 0xff9f4d },
  featherleaf:           { shape: 'sprout',   color: 0x9fe3a0 },
  giants_cap:             { shape: 'mushroom', color: 0xc0392b },
  shrinking_violet:       { shape: 'bloom',    color: 0x8a5fc0 },
  pumpkin_blossom:        { shape: 'bloom',    color: 0xff8a1f },
  bats_breath:            { shape: 'bloom',    color: 0x4a2a5a },
  rainbow_petal:          { shape: 'bloom',    color: 0xff6b9b },
  ravens_feather_plant:   { shape: 'sprout',   color: 0x2a1a22 },
  stumbleweed:            { shape: 'sprout',   color: 0xc9a227 },
  gibberish_root:         { shape: 'sprout',   color: 0xe0c08a },
  toadstool:              { shape: 'mushroom', color: 0xd83a3a },
  wolfsbane_bloom:        { shape: 'bloom',    color: 0x9b59b6 },
  meditation_lotus:       { shape: 'bloom',    color: 0xf783ac },
  healing_herb:           { shape: 'sprout',   color: 0x4caf50 },
  regen_root:             { shape: 'sprout',   color: 0xffd43b },
  cleansing_clover:       { shape: 'sprout',   color: 0x6fcf60 }
};

function makePlantBloom(x, z, color) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 9, 5),
    new THREE.MeshLambertMaterial({ color: 0x3a7a3f })
  );
  stem.position.y = 4.5;
  g.add(stem);
  const bloomMat = new THREE.MeshLambertMaterial({ color });
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6), bloomMat);
    const ang = (i / 5) * Math.PI * 2;
    petal.position.set(Math.cos(ang) * 2, 10, Math.sin(ang) * 2);
    g.add(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 6, 6),
    new THREE.MeshLambertMaterial({ color: 0xffd43b })
  );
  center.position.y = 10;
  g.add(center);
  g.position.set(x, 0, z);
  return g;
}

function makePlantMushroom(x, z, capColor) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.8, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0xe8d8c0 })
  );
  stem.position.y = 3.5;
  g.add(stem);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: capColor })
  );
  cap.position.y = 7;
  g.add(cap);
  for (let i = 0; i < 4; i++) {
    const spot = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0xfff6e8 })
    );
    const ang = (i / 4) * Math.PI * 2;
    spot.position.set(Math.cos(ang) * 2.2, 8.2, Math.sin(ang) * 2.2);
    g.add(spot);
  }
  g.position.set(x, 0, z);
  return g;
}

function makePlantSprout(x, z, color) {
  const g = new THREE.Group();
  const leafMat = new THREE.MeshLambertMaterial({ color });
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 5), leafMat);
    const ang = (i / 4) * Math.PI * 2;
    leaf.position.set(Math.cos(ang) * 1.5, 3.5, Math.sin(ang) * 1.5);
    leaf.rotation.z = Math.cos(ang) * -0.4;
    leaf.rotation.x = Math.sin(ang) * 0.4;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}

function makePlant(type, x, z) {
  const v = PLANT_VISUALS[type] || PLANT_VISUALS.healing_herb;
  if (v.shape === 'bloom') return makePlantBloom(x, z, v.color);
  if (v.shape === 'mushroom') return makePlantMushroom(x, z, v.color);
  return makePlantSprout(x, z, v.color);
}

// Positions/types/scales are server-authoritative now (world.natureDecor,
// sent at init) so harvesting can be agreed on by every client — this used
// to be a fixed local array before harvesting existed. Trees get a small
// trunk collision box pushed into the same `walls` array buildings use, so
// you can't walk through them; shrubs, rocks, flower patches, and the
// Wilds' 16 plants are purely decorative ground cover (walk-through).
// tree/shrub/flower/(any plant key) are harvestable; rocks are scenery.
const HARVESTABLE_DECOR_TYPES = new Set(['tree', 'shrub', 'flower', ...Object.keys(PLANT_VISUALS)]);
let decorVisuals = {};  // town (world.natureDecor) decorId -> { group, type, harvested, originalMaterials }
let decorVisuals2 = {}; // Wilds (world2.natureDecor), same shape, separate pool/scene
let decorAvailability = {}; // decorId -> bool, from server's wildlife_state/decor_state — shared, ids are globally unique

function applyDecorHarvestedLook(v, harvested) {
  if (harvested) {
    v.group.scale.setScalar(0.42);
    for (const { mesh, material } of v.originalMaterials) {
      const dull = material.clone();
      dull.color.set(0x6b5a45);
      mesh.material = dull;
    }
  } else {
    v.group.scale.setScalar(1);
    for (const { mesh, material } of v.originalMaterials) mesh.material = material;
  }
}

function applyDecorState(list) {
  for (const d of list) {
    decorAvailability[d.id] = d.available;
    const v = decorVisuals[d.id] || decorVisuals2[d.id];
    if (!v) continue;
    const harvested = !d.available;
    if (v.harvested !== harvested) { v.harvested = harvested; applyDecorHarvestedLook(v, harvested); }
  }
}

// `pool` lets this build into either decorVisuals (town) or decorVisuals2
// (Wilds) without one call wiping the other's entries out.
function addNatureDecor(scene, w, pool) {
  for (const d of (w.natureDecor || [])) {
    let group;
    if (d.type === 'tree') {
      group = makeTree(d.x, d.y, d.scale);
      const r = 8 * (d.scale || 1);
      walls.push({ x: d.x - r, y: d.y - r, w: r * 2, h: r * 2 });
    } else if (d.type === 'shrub') {
      group = makeShrub(d.x, d.y, d.scale);
    } else if (d.type === 'rock') {
      group = makeRock(d.x, d.y, d.scale);
    } else if (d.type === 'flower') {
      group = makeFlowerPatch(d.x, d.y, d.scale);
    } else if (PLANT_VISUALS[d.type]) {
      group = makePlant(d.type, d.x, d.y);
    } else {
      continue;
    }
    scene.add(group);
    if (HARVESTABLE_DECOR_TYPES.has(d.type)) {
      const originalMaterials = [];
      group.traverse(child => { if (child.isMesh) originalMaterials.push({ mesh: child, material: child.material }); });
      group.userData = { kind: 'decor', decorId: d.id, decorType: d.type };
      const v = pool[d.id] = { group, type: d.type, harvested: false, originalMaterials };
      if (decorAvailability[d.id] === false) { v.harvested = true; applyDecorHarvestedLook(v, true); }
    }
  }
}

// ---------------------------------------------------------------------------
// Wildlife — a handful of rabbits wandering the open grass, purely cosmetic
// flavor. Positions/flee state are server-authoritative (see server.js) so
// every connected player sees the same rabbit doing the same thing — this
// client only builds the mesh the first time it hears about a given
// rabbit id and then interpolates toward whatever position the server
// broadcasts in 'wildlife_state' messages, exactly like remote players.
// ---------------------------------------------------------------------------
function makeRabbit() {
  const g = new THREE.Group();
  const furColors = [0xcfc2a8, 0xab8f6b, 0xe8e2d8];
  const fur = furColors[Math.floor(Math.random() * furColors.length)];
  const bodyMat = new THREE.MeshLambertMaterial({ color: fur });
  const body = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 8), bodyMat);
  body.scale.set(1.3, 0.85, 1);
  body.position.y = 6;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.2, 8, 8), bodyMat);
  head.position.set(0, 9, 7);
  g.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(1.2, 7, 6), bodyMat);
    ear.position.set(side * 2, 14, 7);
    ear.rotation.x = -0.3;
    g.add(ear);
  }
  const tail = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 6, 6),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  tail.position.set(0, 7, -7);
  g.add(tail);
  g.add(makeHealthBarSprite(22));
  return g;
}

let animalVisuals = {}; // id -> { mesh, x, y, targetX, targetY, facing, targetFacing, fleeing, hopPhase, initialized }

function addAnimals(scene) {
  for (const id in animalVisuals) scene.remove(animalVisuals[id].mesh);
  animalVisuals = {};
}

function getOrCreateAnimalVisual(id) {
  let v = animalVisuals[id];
  if (!v) {
    const mesh = makeRabbit();
    mesh.userData = { kind: 'animal', targetId: id };
    outdoorScene.add(mesh);
    v = animalVisuals[id] = {
      mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      fleeing: false, hopPhase: Math.random() * Math.PI * 2, initialized: false, dead: false
    };
  }
  return v;
}

function applyAnimalState(list) {
  if (!outdoorScene) return;
  for (const a of list) {
    const v = getOrCreateAnimalVisual(a.id);
    v.targetX = a.x; v.targetY = a.y; v.targetFacing = a.facing; v.fleeing = !!a.fleeing; v.dead = !!a.dead;
    if (!v.initialized) { v.x = a.x; v.y = a.y; v.facing = a.facing; v.initialized = true; }
    if (a.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, a.health, a.maxHealth);
    }
  }
}

function updateAnimalVisuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in animalVisuals) {
    const v = animalVisuals[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);

    const moving = Math.hypot(v.targetX - v.x, v.targetY - v.y) > 1;
    v.hopPhase += dt * (v.fleeing ? 14 : 5);
    const hop = moving ? Math.abs(Math.sin(v.hopPhase)) * (v.fleeing ? 6 : 2.5) : 0;

    v.mesh.position.set(v.x, hop, v.y);
    v.mesh.rotation.y = v.facing;
    v.mesh.visible = !v.dead;
  }
}

// The Wilds' friendly animals — same rabbit, separate pool/scene since
// they're a wholly different population from town's (different spawns,
// different ids from the server).
let animalVisuals2 = {};

function addAnimals2(scene) {
  for (const id in animalVisuals2) scene.remove(animalVisuals2[id].mesh);
  animalVisuals2 = {};
}

function getOrCreateAnimal2Visual(id) {
  let v = animalVisuals2[id];
  if (!v) {
    const mesh = makeRabbit();
    mesh.userData = { kind: 'animal2', targetId: id };
    wildsScene.add(mesh);
    v = animalVisuals2[id] = {
      mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      fleeing: false, hopPhase: Math.random() * Math.PI * 2, initialized: false, dead: false
    };
  }
  return v;
}

function applyAnimal2State(list) {
  if (!wildsScene) return;
  for (const a of list) {
    const v = getOrCreateAnimal2Visual(a.id);
    v.targetX = a.x; v.targetY = a.y; v.targetFacing = a.facing; v.fleeing = !!a.fleeing; v.dead = !!a.dead;
    if (!v.initialized) { v.x = a.x; v.y = a.y; v.facing = a.facing; v.initialized = true; }
    if (a.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, a.health, a.maxHealth);
    }
  }
}

function updateAnimal2Visuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in animalVisuals2) {
    const v = animalVisuals2[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);

    const moving = Math.hypot(v.targetX - v.x, v.targetY - v.y) > 1;
    v.hopPhase += dt * (v.fleeing ? 14 : 5);
    const hop = moving ? Math.abs(Math.sin(v.hopPhase)) * (v.fleeing ? 6 : 2.5) : 0;

    v.mesh.position.set(v.x, hop, v.y);
    v.mesh.rotation.y = v.facing;
    v.mesh.visible = !v.dead;
  }
}

function makeDirtTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#8a6b46';
  cx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 320; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    const r = 1 + Math.random() * 3;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(58,40,22,0.30)' : 'rgba(178,150,108,0.30)';
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    cx.fillStyle = 'rgba(40,28,16,0.4)';
    cx.fillRect(x, y, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeStoneTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#6b6862';
  cx.fillRect(0, 0, 128, 128);
  cx.strokeStyle = 'rgba(35,32,28,0.5)';
  cx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = i * 22 + (i % 2 ? 6 : 0);
    cx.beginPath(); cx.moveTo(0, y); cx.lineTo(128, y); cx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(95,92,86,0.4)' : 'rgba(35,32,28,0.4)';
    cx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildPathSegment(x1, y1, x2, y2, width, sharedTex, hubRadius) {
  const dx = x2 - x1, dz = y2 - y1;
  const fullLen = Math.hypot(dx, dz);
  const len = Math.max(10, fullLen - hubRadius * 0.55); // stop short, into the hub circle
  const tex = sharedTex.clone();
  tex.needsUpdate = true;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(width / 40, len / 40);
  const geo = new THREE.BoxGeometry(width, 0.55, len);
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.atan2(dx, dz);
  const midFrac = len / 2 / fullLen;
  mesh.position.set(x1 + dx * midFrac, 0.18, y1 + dz * midFrac);
  return mesh;
}

// A glowing rectangular window for an OUTDOOR building wall. `onEastWest`
// picks the long axis: false = wide along x (north/south wall), true = wide
// along z (east/west wall) — matching the inline pattern used for the
// building's first-floor windows.
function makeRectWindow(mat, wide, tall, x, y, z, onEastWest) {
  const geo = onEastWest ? new THREE.BoxGeometry(2, tall, wide) : new THREE.BoxGeometry(wide, tall, 2);
  const win = new THREE.Mesh(geo, mat);
  win.position.set(x, y, z);
  return win;
}

function buildBuildingMesh(b, w) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: b.color });
  // The Rooftop Lounge gets a taller exterior shell to read as two stories,
  // matching its two-story interior (see buildLoungeStructure()/getFloorHeight()).
  const wallH = b.id === 'lounge' ? WALL_HEIGHT * 1.8 : WALL_HEIGHT;
  const wallRects = buildWallsForOne(b, w);
  for (const r of wallRects) {
    if (r.w <= 0 || r.h <= 0) continue;
    const geo = new THREE.BoxGeometry(r.w, wallH, r.h);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(r.x + r.w / 2, wallH / 2, r.y + r.h / 2);
    group.add(mesh);
  }

  // foundation plinth — a low, dark base so the building looks grounded
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(b.w + 14, 6, b.h + 14),
    new THREE.MeshLambertMaterial({ color: 0x4a4a4a })
  );
  foundation.position.set(b.x + b.w / 2, 3, b.y + b.h / 2);
  group.add(foundation);

  // A second-story floor band — a darker trim strip wrapping the perimeter
  // partway up — plus an extra row of windows above it, so the Lounge reads
  // as two distinct stories rather than just one tall building.
  if (b.id === 'lounge') {
    const bandY = wallH * 0.52;
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 6, 8, b.h + 6),
      new THREE.MeshLambertMaterial({ color: 0x3c2616 })
    );
    band.position.set(b.x + b.w / 2, bandY, b.y + b.h / 2);
    group.add(band);

    const upperWinMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
    const upperWinY = wallH * 0.78;
    const side2 = getDoorSide(b);
    if (side2 !== 'north') group.add(makeRectWindow(upperWinMat, 26, 22, b.x + b.w / 2, upperWinY, b.y - 0.6, false));
    if (side2 !== 'south') group.add(makeRectWindow(upperWinMat, 26, 22, b.x + b.w / 2, upperWinY, b.y + b.h + 0.6, false));
    if (side2 !== 'west') group.add(makeRectWindow(upperWinMat, 26, 22, b.x - 0.6, upperWinY, b.y + b.h / 2, true));
    if (side2 !== 'east') group.add(makeRectWindow(upperWinMat, 26, 22, b.x + b.w + 0.6, upperWinY, b.y + b.h / 2, true));
  }

  // hip/pyramid roof — a 4-sided cone rotated 45° so its flat faces line up
  // with the building's walls, then scaled non-uniformly to match the
  // rectangular footprint (with a little overhang past the eaves).
  const overhang = 14, roofHeight = 58;
  const apothem = Math.cos(Math.PI / 4);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(1, roofHeight, 4),
    new THREE.MeshLambertMaterial({ color: 0x7a3c2c })
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.set((b.w / 2 + overhang) / apothem, 1, (b.h / 2 + overhang) / apothem);
  roof.position.set(b.x + b.w / 2, wallH + roofHeight / 2, b.y + b.h / 2);
  group.add(roof);

  // a visible door slab filling the gap in whichever wall faces the door —
  // locked buildings get a barred reddish door; the free building and
  // unlocked ones get a normal wooden door (kept in sync via
  // refreshBuildingLockVisuals()).
  const t = w.wallThickness, doorH = 72;
  const locked = isVisuallyLocked(b);
  const side = getDoorSide(b);
  const doorMat = new THREE.MeshLambertMaterial({ color: locked ? 0x5a1f1f : 0x3c2616 });
  let doorGeo, doorX, doorZ;
  if (side === 'east') {
    doorGeo = new THREE.BoxGeometry(t * 0.7, doorH, w.doorWidth - 6);
    doorX = b.x + b.w - t / 2; doorZ = b.y + b.h / 2;
  } else if (side === 'west') {
    doorGeo = new THREE.BoxGeometry(t * 0.7, doorH, w.doorWidth - 6);
    doorX = b.x + t / 2; doorZ = b.y + b.h / 2;
  } else if (side === 'north') {
    doorGeo = new THREE.BoxGeometry(w.doorWidth - 6, doorH, t * 0.7);
    doorX = b.x + b.w / 2; doorZ = b.y + t / 2;
  } else {
    doorGeo = new THREE.BoxGeometry(w.doorWidth - 6, doorH, t * 0.7);
    doorX = b.x + b.w / 2; doorZ = b.y + b.h - t / 2;
  }
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(doorX, doorH / 2, doorZ);
  group.add(door);

  // glowing windows on the three walls that don't have the door
  const winMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
  const winY = wallH * (b.id === 'lounge' ? 0.32 : 0.56);
  if (side !== 'north') {
    const win = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 2), winMat);
    win.position.set(b.x + b.w / 2, winY, b.y - 0.6);
    group.add(win);
  }
  if (side !== 'south') {
    const win = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 2), winMat);
    win.position.set(b.x + b.w / 2, winY, b.y + b.h + 0.6);
    group.add(win);
  }
  if (side !== 'west') {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 26), winMat);
    win.position.set(b.x - 0.6, winY, b.y + b.h / 2);
    group.add(win);
  }
  if (side !== 'east') {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 26), winMat);
    win.position.set(b.x + b.w + 0.6, winY, b.y + b.h / 2);
    group.add(win);
  }

  // floating sign with the building name, billboarded each frame
  const sign = makeSignSprite(b.name);
  sign.position.set(b.x + b.w / 2, wallH + roofHeight + 22, b.y + b.h / 2);
  group.add(sign);

  // a second sign disclosing free-vs-premium status
  const tag = locked
    ? makeSignSprite('🔒 Premium — Unlock to enter')
    : makeSignSprite('✓ Free to enter');
  tag.position.set(b.x + b.w / 2, wallH + roofHeight - 4, b.y + b.h / 2);
  group.add(tag);

  lockVisuals[b.id] = { door, lockSign: tag };

  return group;
}

// A real doorway at an interior wall gap: wooden jamb posts + a header beam
// framing the opening, plus a door panel hinged at the doorStart edge and
// swung ajar into the room (with a handle), so it reads as an actual door
// rather than an empty gap. Exit detection stays purely positional (see
// updateIndoor) — this mesh is cosmetic only.
function buildInteriorDoorway(side, doorStart, doorEnd, roomW, roomD, theme) {
  const g = new THREE.Group();
  const t = (world.wallThickness || 12) * INDOOR_SCALE;
  const dw = doorEnd - doorStart;
  const doorH = INDOOR_WALL_HEIGHT * 0.74;
  const jambW = 8, jambD = t * 1.3;
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x2a1a10 });
  const doorMat = new THREE.MeshLambertMaterial({ color: theme.doorColor || 0x3c2616 });
  const handleMat = new THREE.MeshLambertMaterial({ color: 0xd8b35c });

  const axisIsX = side === 'north' || side === 'south';
  let wallCoord, openAngle;
  if (side === 'north') { wallCoord = 0; openAngle = -0.9; }
  else if (side === 'south') { wallCoord = roomD; openAngle = 0.9; }
  else if (side === 'west') { wallCoord = 0; openAngle = 0.9; }
  else { wallCoord = roomW; openAngle = -0.9; }

  const header = new THREE.Mesh(
    axisIsX ? new THREE.BoxGeometry(dw + jambW * 2, 10, jambD) : new THREE.BoxGeometry(jambD, 10, dw + jambW * 2),
    frameMat
  );
  if (axisIsX) header.position.set((doorStart + doorEnd) / 2, doorH + 5, wallCoord);
  else header.position.set(wallCoord, doorH + 5, (doorStart + doorEnd) / 2);
  g.add(header);

  for (const pos of [doorStart, doorEnd]) {
    const jamb = new THREE.Mesh(
      axisIsX ? new THREE.BoxGeometry(jambW, doorH, jambD) : new THREE.BoxGeometry(jambD, doorH, jambW),
      frameMat
    );
    if (axisIsX) jamb.position.set(pos, doorH / 2, wallCoord);
    else jamb.position.set(wallCoord, doorH / 2, pos);
    g.add(jamb);
  }

  const panelW = dw - 12, panelT = 4;
  const panel = new THREE.Mesh(
    axisIsX ? new THREE.BoxGeometry(panelW, doorH - 8, panelT) : new THREE.BoxGeometry(panelT, doorH - 8, panelW),
    doorMat
  );
  panel.position.set(axisIsX ? panelW / 2 : 0, doorH / 2, axisIsX ? 0 : panelW / 2);
  const handle = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), handleMat);
  handle.position.set(
    axisIsX ? panelW - 8 : panelT / 2 + 2.5,
    0,
    axisIsX ? panelT / 2 + 2.5 : panelW - 8
  );
  panel.add(handle);

  const hinge = new THREE.Group();
  hinge.add(panel);
  hinge.rotation.y = openAngle;
  hinge.position.set(axisIsX ? doorStart : wallCoord, 0, axisIsX ? wallCoord : doorStart);
  g.add(hinge);

  return g;
}

function buildWallsForOne(b, w) {
  const t = w.wallThickness, dw = w.doorWidth;
  const side = getDoorSide(b);

  if (side === 'east' || side === 'west') {
    const doorStart = b.y + (b.h - dw) / 2;
    const doorEnd = doorStart + dw;
    const sideWallX = side === 'east' ? b.x + b.w - t : b.x;
    const otherWallX = side === 'east' ? b.x : b.x + b.w - t;
    return [
      { x: b.x, y: b.y, w: b.w, h: t },                                  // north
      { x: b.x, y: b.y + b.h - t, w: b.w, h: t },                        // south
      { x: otherWallX, y: b.y, w: t, h: b.h },                           // solid side wall
      { x: sideWallX, y: b.y, w: t, h: doorStart - b.y },                // door wall, above gap
      { x: sideWallX, y: doorEnd, w: t, h: (b.y + b.h) - doorEnd }       // door wall, below gap
    ];
  }

  if (side === 'north') {
    const doorStart = b.x + (b.w - dw) / 2;
    const doorEnd = doorStart + dw;
    return [
      { x: b.x, y: b.y + b.h - t, w: b.w, h: t },                        // south
      { x: b.x, y: b.y, w: t, h: b.h },                                  // west
      { x: b.x + b.w - t, y: b.y, w: t, h: b.h },                        // east
      { x: b.x, y: b.y, w: doorStart - b.x, h: t },                      // north, left of gap
      { x: doorEnd, y: b.y, w: (b.x + b.w) - doorEnd, h: t }             // north, right of gap
    ];
  }

  // south (default)
  const doorStart = b.x + (b.w - dw) / 2;
  const doorEnd = doorStart + dw;
  return [
    { x: b.x, y: b.y, w: b.w, h: t },
    { x: b.x, y: b.y, w: t, h: b.h },
    { x: b.x + b.w - t, y: b.y, w: t, h: b.h },
    { x: b.x, y: b.y + b.h - t, w: doorStart - b.x, h: t },
    { x: doorEnd, y: b.y + b.h - t, w: (b.x + b.w) - doorEnd, h: t }
  ];
}

function refreshBuildingLockVisuals() {
  if (!world) return;
  for (const b of world.buildings) {
    const lv = lockVisuals[b.id];
    if (!lv) continue;
    const locked = isVisuallyLocked(b);
    lv.door.material.color.set(locked ? 0x5a1f1f : 0x3c2616);
    lv.lockSign.visible = true; // sign texture already reflects current text at build time
  }
}

function makeSignSprite(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const cx = c.getContext('2d');
  cx.font = 'bold 30px sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillStyle = 'rgba(10,16,12,0.55)';
  cx.fillRect(0, 0, c.width, c.height);
  cx.fillStyle = '#eafff0';
  cx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(110, 28, 1);
  return sprite;
}

// Stylised two-line (or one-line) nameplate for NPC characters.
// name  — displayed large in warm gold on the top line
// title — optional smaller italic line below a thin rule
function makeNpcNameSprite(name, title) {
  const hasTtl = !!title;
  const W = hasTtl ? 360 : 240, H = hasTtl ? 80 : 52;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  ctx.fillStyle = 'rgba(8, 4, 18, 0.80)';
  ctx.fillRect(0, 0, W, H);

  // Outer border — two-tone: gold outer, purple inner
  ctx.strokeStyle = 'rgba(160, 120, 50, 0.50)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.strokeStyle = 'rgba(110, 60, 190, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (hasTtl) {
    // Name — warm gold, larger
    ctx.font = 'bold 26px Georgia, "Times New Roman", serif';
    ctx.shadowColor = 'rgba(210, 160, 30, 0.55)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#edd08a';
    ctx.fillText(name, W / 2, H * 0.30);

    // Thin rule
    ctx.shadowBlur = 0;
    const ry = Math.round(H / 2) - 1;
    ctx.strokeStyle = 'rgba(170, 130, 55, 0.38)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(26, ry); ctx.lineTo(W - 26, ry); ctx.stroke();

    // Small diamond glyphs at rule ends
    ctx.fillStyle = 'rgba(200, 160, 70, 0.45)';
    ctx.font = '10px sans-serif';
    ctx.fillText('◆', 18, ry + 1);
    ctx.fillText('◆', W - 18, ry + 1);

    // Title — soft lavender, italic
    ctx.font = 'italic 15px Georgia, "Times New Roman", serif';
    ctx.shadowColor = 'rgba(130, 70, 210, 0.45)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#bca0e0';
    ctx.fillText(title, W / 2, H * 0.73);
  } else {
    // Single line — warm cream
    ctx.font = 'bold 22px Georgia, "Times New Roman", serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.70)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#e0d4b2';
    ctx.fillText(name, W / 2, H / 2 + 1);
  }

  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(hasTtl ? 158 : 102, hasTtl ? 35 : 23, 1);
  return sprite;
}

// ---------------------------------------------------------------------------
// Building interiors — medieval decor, built lazily the first time anyone
// local walks into a given building. Local coordinate space is the
// building's own (unscaled) footprint, 0..b.w by 0..b.h, with INDOOR_SCALE
// applied only for rendering — see getRenderPos()/updateIndoor().
// ---------------------------------------------------------------------------
function getInteriorScene(buildingId) {
  if (interiorScenes[buildingId]) return interiorScenes[buildingId];

  const b = world.buildings.find(bb => bb.id === buildingId);
  const side = getDoorSide(b);
  const override = INTERIOR_SIZE_OVERRIDES[buildingId];
  const localW = override ? override.w : b.w;
  const localH = override ? override.h : b.h;
  const wallsLocal = buildWallsForOne({ x: 0, y: 0, w: localW, h: localH, door: side }, world);
  const roomW = localW * INDOOR_SCALE, roomD = localH * INDOOR_SCALE;
  const dw = world.doorWidth * INDOOR_SCALE;
  // South/north doors run along the room's width; east/west doors run along
  // its depth — match whichever axis that wall actually spans.
  let doorStart, doorEnd;
  if (side === 'east' || side === 'west') {
    doorStart = (roomD - dw) / 2; doorEnd = doorStart + dw;
  } else {
    doorStart = (roomW - dw) / 2; doorEnd = doorStart + dw;
  }
  const theme = INTERIOR_THEMES[buildingId] || INTERIOR_THEMES.cafe;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1410);
  scene.fog = new THREE.Fog(0x1c1410, 380, 900);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);

  scene.add(new THREE.AmbientLight(0xffd9a0, 0.5));
  const torch1 = new THREE.PointLight(0xffa85c, 1.2, 340);
  torch1.position.set(30, 70, 30);
  scene.add(torch1);
  const torch2 = new THREE.PointLight(0xffa85c, 1.2, 340);
  torch2.position.set(roomW - 30, 70, roomD - 30);
  scene.add(torch2);

  // stone floor, tinted per theme so each building's interior reads as its
  // own space rather than the same room repainted
  const floorTex = makeStoneTexture();
  floorTex.repeat.set(roomW / 60, roomD / 60);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshLambertMaterial({ map: floorTex, color: theme.floorTint || 0xffffff })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  scene.add(floor);

  // walls, scaled from the same local wall rects used for collision
  const wallMat = new THREE.MeshLambertMaterial({ color: theme.wall });
  for (const r of wallsLocal) {
    if (r.w <= 0 || r.h <= 0) continue;
    const geo = new THREE.BoxGeometry(r.w * INDOOR_SCALE, INDOOR_WALL_HEIGHT, r.h * INDOOR_SCALE);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set((r.x + r.w / 2) * INDOOR_SCALE, INDOOR_WALL_HEIGHT / 2, (r.y + r.h / 2) * INDOOR_SCALE);
    scene.add(mesh);
  }

  // exposed wood ceiling beams
  const beamMat = new THREE.MeshLambertMaterial({ color: 0x3c2a1a });
  for (let i = 1; i <= 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(roomW - 10, 8, 10), beamMat);
    beam.position.set(roomW / 2, INDOOR_WALL_HEIGHT - 12, (roomD / 4) * i);
    scene.add(beam);
  }

  // torches near the point lights
  scene.add(buildTorch(30, 30));
  scene.add(buildTorch(roomW - 30, roomD - 30));

  // a real doorway at the gap — wooden frame around the opening plus a door
  // panel hinged open against the inside wall, so it reads as an actual door
  // you're walking past rather than an empty gap with a floating label.
  scene.add(buildInteriorDoorway(side, doorStart, doorEnd, roomW, roomD, theme));

  const seats = [];
  const kiosks = [];
  buildFurniture(scene, theme.furniture, roomW, roomD, seats, kiosks);

  const record = { scene, camera, roomW, roomD, doorStart, doorEnd, wallsLocal, localW, localH, seats, kiosks };
  interiorScenes[buildingId] = record;
  return record;
}

function buildTorch(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 46, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a3320 })
  );
  pole.position.set(x, 40, z);
  g.add(pole);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(7, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9d3c })
  );
  flame.position.set(x, 68, z);
  g.add(flame);
  return g;
}

function makeTable(x, z, rotY) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(46, 4, 28), new THREE.MeshLambertMaterial({ color: 0x6b4a2e }));
  top.position.y = 26; g.add(top);
  const legGeo = new THREE.CylinderGeometry(2, 2, 26, 6);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
  [[-20, -11], [20, -11], [-20, 11], [20, 11]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 13, lz);
    g.add(leg);
  });
  g.position.set(x, 0, z); g.rotation.y = rotY || 0;
  return g;
}

function makeBench(x, z, rotY) {
  const seat = new THREE.Mesh(new THREE.BoxGeometry(40, 4, 12), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  seat.position.set(x, 14, z);
  seat.rotation.y = rotY || 0;
  return seat;
}

function makeBarrel(x, z) {
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 22, 10),
    new THREE.MeshLambertMaterial({ color: 0x6b4a2e })
  );
  barrel.position.set(x, 11, z);
  return barrel;
}

function makeBookshelf(x, z, rotY) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(36, 70, 12), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
  frame.position.y = 35; g.add(frame);
  const bookColors = [0x8a2e2e, 0x2e5a8a, 0x3a6b3a, 0x8a6b2e];
  for (let i = 0; i < 10; i++) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(3, 12 + Math.random() * 6, 9),
      new THREE.MeshLambertMaterial({ color: bookColors[i % bookColors.length] })
    );
    book.position.set(-15 + i * 3.2, 16 + (i % 3) * 16, 0);
    g.add(book);
  }
  g.position.set(x, 0, z); g.rotation.y = rotY || 0;
  return g;
}

function makeBanner(x, y, z, rotY, color) {
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 46),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
  );
  banner.position.set(x, y, z);
  banner.rotation.y = rotY || 0;
  return banner;
}

function makeFireplace(x, z, rotY) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(50, 60, 18), new THREE.MeshLambertMaterial({ color: 0x55504a }));
  body.position.y = 30; g.add(body);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(30, 34, 10), new THREE.MeshBasicMaterial({ color: 0xff7a30 }));
  hole.position.set(0, 20, 2); g.add(hole);
  g.position.set(x, 0, z); g.rotation.y = rotY || 0;
  return g;
}

function makeThrone(x, z, rotY) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(34, 6, 30), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
  seat.position.y = 24; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(34, 60, 6), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  back.position.set(0, 54, -13); g.add(back);
  const armGeo = new THREE.BoxGeometry(5, 16, 28);
  const armMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
  const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-15, 32, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(15, 32, 0); g.add(armR);
  g.position.set(x, 0, z); g.rotation.y = rotY || 0;
  return g;
}

function makeCauldron(x, z) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(13, 9, 16, 10), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
  pot.position.y = 10; g.add(pot);
  const brew = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 2, 10), new THREE.MeshBasicMaterial({ color: 0x6dff7a }));
  brew.position.y = 18; g.add(brew);
  g.position.set(x, 0, z);
  return g;
}

function makeRug(x, z, w, d, color) {
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(x, 0.3, z);
  return rug;
}

function makeBarCounter(x, z1, z2) {
  const g = new THREE.Group();
  const len = Math.abs(z2 - z1);
  const midZ = (z1 + z2) / 2;
  const counter = new THREE.Mesh(new THREE.BoxGeometry(20, 34, len), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  counter.position.set(x, 17, midZ);
  g.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(24, 3, len + 4), new THREE.MeshLambertMaterial({ color: 0x3c2616 }));
  top.position.set(x, 35, midZ);
  g.add(top);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(8, 50, len * 0.88), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
  shelf.position.set(x - 18, 25, midZ);
  g.add(shelf);
  const bottleColors = [0x4a8a3a, 0x8a2e2e, 0x2e5a8a, 0x6b4a2e, 0x8a6b2e];
  const count = Math.max(3, Math.floor(len / 12));
  for (let i = 0; i < count; i++) {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2, 7 + Math.random() * 3, 6),
      new THREE.MeshLambertMaterial({ color: bottleColors[i % bottleColors.length] })
    );
    bottle.position.set(x - 18, 52, z1 + (i + 0.5) * (len / count));
    g.add(bottle);
  }
  return g;
}

function makeChandelier(x, z) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16, 1.6, 6, 16), new THREE.MeshLambertMaterial({ color: 0x3c2a1a }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = INDOOR_WALL_HEIGHT - 38;
  g.add(ring);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 22, 5), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
  chain.position.y = INDOOR_WALL_HEIGHT - 22;
  g.add(chain);
  const candleCount = 6;
  for (let i = 0; i < candleCount; i++) {
    const ang = (i / candleCount) * Math.PI * 2;
    const cdx = Math.cos(ang) * 16, cdz = Math.sin(ang) * 16;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 6, 6), new THREE.MeshLambertMaterial({ color: 0xe8dcb0 }));
    candle.position.set(cdx, INDOOR_WALL_HEIGHT - 35, cdz);
    g.add(candle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4, 6), new THREE.MeshBasicMaterial({ color: 0xffb84c }));
    flame.position.set(cdx, INDOOR_WALL_HEIGHT - 31, cdz);
    g.add(flame);
  }
  const light = new THREE.PointLight(0xffb86c, 0.9, 220);
  light.position.y = INDOOR_WALL_HEIGHT - 36;
  g.add(light);
  g.position.set(x, 0, z);
  return g;
}

function makeShield(x, y, z, rotY, color) {
  const shield = new THREE.Mesh(
    new THREE.CircleGeometry(13, 8),
    new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
  );
  shield.position.set(x, y, z);
  shield.rotation.y = rotY || 0;
  return shield;
}

// A weathered stone statue holding out a plaque/seal — doubles as the
// physical "buy a Town Pass" object. Purely decorative geometry; the
// interaction itself is driven by the kiosk point registered alongside it.
function makeStatue(x, z) {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9a9a90 });
  const darkStoneMat = new THREE.MeshLambertMaterial({ color: 0x6e6e64 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(36, 10, 36), darkStoneMat);
  base.position.y = 5; g.add(base);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(24, 38, 24), stoneMat);
  plinth.position.y = 10 + 19; g.add(plinth);

  const figY = 10 + 38;
  const robe = new THREE.Mesh(new THREE.ConeGeometry(13, 46, 10), stoneMat);
  robe.position.y = figY + 23; g.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 10), stoneMat);
  head.position.y = figY + 50; g.add(head);

  const armGeo = new THREE.CylinderGeometry(2.4, 2.4, 20, 6);
  const armL = new THREE.Mesh(armGeo, stoneMat);
  armL.position.set(-11, figY + 28, 4); armL.rotation.z = 0.6; g.add(armL);
  const armR = new THREE.Mesh(armGeo, stoneMat);
  armR.position.set(11, figY + 28, 4); armR.rotation.z = -0.6; g.add(armR);

  // a plaque held out in front, representing the pass itself
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(16, 12, 1.5),
    new THREE.MeshLambertMaterial({ color: 0xd9c89a })
  );
  plaque.position.set(0, figY + 18, 15);
  g.add(plaque);
  const seal = new THREE.Mesh(
    new THREE.CircleGeometry(4, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd27a })
  );
  seal.position.set(0, figY + 18, 15.8);
  g.add(seal);

  const glow = new THREE.PointLight(0xfff1c0, 0.5, 90);
  glow.position.set(0, figY + 18, 30);
  g.add(glow);

  g.position.set(x, 0, z);
  return g;
}

// A playable arcade cabinet — the kiosk point registered alongside it (see
// the 'alchemist' branch of buildFurniture()) is what actually opens the
// mini-game; this is just the standing geometry.
function makeArcadeCabinet(x, z, rotY, screenColor) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(30, 64, 26),
    new THREE.MeshLambertMaterial({ color: 0x3a2a4a })
  );
  body.position.y = 32;
  g.add(body);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 18),
    new THREE.MeshBasicMaterial({ color: screenColor })
  );
  screen.position.set(0, 44, 13.1);
  g.add(screen);
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(32, 5, 28),
    new THREE.MeshLambertMaterial({ color: 0xffd27a })
  );
  trim.position.y = 64;
  g.add(trim);
  const glow = new THREE.PointLight(screenColor, 0.6, 60);
  glow.position.set(0, 44, 16);
  g.add(glow);
  g.position.set(x, 0, z);
  g.rotation.y = rotY || 0;
  return g;
}

function makeWindowGlow(x, y, z, rotY) {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 30),
    new THREE.MeshBasicMaterial({ color: 0xffd98a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  glow.position.set(x, y, z);
  glow.rotation.y = rotY || 0;
  return glow;
}

// A table + two benches at a fixed vertical offset, with no seats registered
// — used for the Rooftop Lounge's upstairs terrace, since the sit-down
// interaction (findNearestSeat()) only ever checks render-space x/z, not
// height, and isn't worth teaching about a second floor for purely
// decorative furniture.
function addElevatedTable(scene, tx, tz, baseY) {
  const table = makeTable(tx, tz);
  table.position.y += baseY;
  scene.add(table);
  const benchA = makeBench(tx, tz - 18, 0); benchA.position.y += baseY; scene.add(benchA);
  const benchB = makeBench(tx, tz + 18, 0); benchB.position.y += baseY; scene.add(benchB);
}

// The Rooftop Lounge's structural staircase + upstairs terrace: a row of
// rising steps from the ground floor up to a platform at
// LOUNGE_PLATFORM_HEIGHT, plus a couple of glowing "view" windows along the
// outer wall up there. No railing mesh — there's no collision physics in
// this engine, so a solid-looking railing you can walk straight through is
// worse than no railing at all. getFloorHeight() mirrors this same
// stairStart/stairEnd math to move the player's render Y.
function buildLoungeStructure(scene, roomW, roomD) {
  const stairStart = roomW * LOUNGE_STAIR_START_FRAC;
  const stairEnd = roomW * LOUNGE_STAIR_END_FRAC;
  const platformH = LOUNGE_PLATFORM_HEIGHT;

  const stepCount = 6;
  const stepWidth = (stairEnd - stairStart) / stepCount;
  const stepMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
  for (let i = 0; i < stepCount; i++) {
    const stepH = platformH * (i + 1) / stepCount;
    const stepX = stairStart + stepWidth * (i + 0.5);
    const step = new THREE.Mesh(new THREE.BoxGeometry(stepWidth + 0.5, stepH, roomD * 0.86), stepMat);
    step.position.set(stepX, stepH / 2, roomD / 2);
    scene.add(step);
  }

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(roomW - stairEnd, 8, roomD),
    new THREE.MeshLambertMaterial({ color: 0x8a6b46 })
  );
  platform.position.set((stairEnd + roomW) / 2, platformH - 4, roomD / 2);
  scene.add(platform);

  scene.add(makeWindowGlow(roomW - 6, platformH + 40, roomD * 0.25, -Math.PI / 2));
  scene.add(makeWindowGlow(roomW - 6, platformH + 40, roomD * 0.75, -Math.PI / 2));
  const lookoutSign = makeSignSprite('🌄 Lookout Terrace');
  lookoutSign.position.set((stairEnd + roomW) / 2, platformH + 60, roomD * 0.5);
  scene.add(lookoutSign);
}

// A dining set = one table + two benches + four registered seats (render-
// space coords), used for the sit-down interaction.
function addDiningSet(scene, seatsOut, tx, tz) {
  scene.add(makeTable(tx, tz));
  scene.add(makeBench(tx, tz - 18, 0));
  scene.add(makeBench(tx, tz + 18, 0));
  const seatOffsets = [
    { dx: -14, dz: -18, facing: Math.PI },
    { dx: 14,  dz: -18, facing: Math.PI },
    { dx: -14, dz: 18,  facing: 0 },
    { dx: 14,  dz: 18,  facing: 0 }
  ];
  for (const s of seatOffsets) {
    seatsOut.push({ x: tx + s.dx, z: tz + s.dz, facing: s.facing });
  }
}

function buildFurniture(scene, type, roomW, roomD, seatsOut, kiosksOut) {
  const cx = roomW / 2, cz = roomD / 2;
  if (type === 'tavern') {
    scene.add(makeRug(cx, cz, roomW * 0.6, roomD * 0.55, 0x7a2e2e));
    scene.add(makeFireplace(cx, 14, Math.PI));
    // bar runs along the west wall, clear of the (east-facing) doorway
    scene.add(makeBarCounter(50, 50, 210));
    // 3 columns x 2 rows of dining sets, in neat aligned rows, with a
    // chandelier hung centered above each row
    const colX = [roomW * 0.26, roomW * 0.5, roomW * 0.74];
    const rowZ = [roomD * 0.35, roomD * 0.68];
    for (const z of rowZ) {
      scene.add(makeChandelier(roomW * 0.5, z));
      for (const x of colX) {
        addDiningSet(scene, seatsOut, x, z);
      }
    }
    scene.add(makeBarrel(24, roomD - 28));
    scene.add(makeBarrel(24, roomD - 64));
    scene.add(makeBanner(28, 100, 8, 0, 0xd98a4f));
    scene.add(makeBanner(roomW - 28, 100, 8, 0, 0xd98a4f));
    scene.add(makeShield(60, 82, 6, 0, 0xb0392b));
    scene.add(makeShield(roomW - 90, 82, 6, 0, 0x3b5fb0));
    scene.add(makeWindowGlow(6, 80, roomD * 0.18, Math.PI / 2));
    scene.add(makeWindowGlow(roomW - 6, 80, roomD * 0.85, -Math.PI / 2));

    // The Town Pass statue — a free-standing corner near the entrance,
    // clear of the dining grid, the bar, and the doorway swing.
    if (kiosksOut) {
      const statueX = roomW * 0.9, statueZ = roomD * 0.12;
      scene.add(makeStatue(statueX, statueZ));
      const statueSign = makeSignSprite('🗿 Town Pass');
      statueSign.position.set(statueX, 108, statueZ);
      scene.add(statueSign);
      kiosksOut.push({ id: 'town_pass', x: statueX, z: statueZ });
    }
  } else if (type === 'library') {
    scene.add(makeRug(cx, cz, roomW * 0.5, roomD * 0.35, 0x3a4a6b));
    scene.add(makeBookshelf(20, cz - 40, Math.PI / 2));
    scene.add(makeBookshelf(20, cz + 10, Math.PI / 2));
    scene.add(makeBookshelf(roomW - 20, cz - 40, -Math.PI / 2));
    scene.add(makeBookshelf(roomW - 20, cz + 10, -Math.PI / 2));
    scene.add(makeTable(cx, cz - 10));
    scene.add(makeBanner(cx, 90, 8, 0, 0x6f8fae));
  } else if (type === 'alchemist') {
    scene.add(makeRug(cx, cz, roomW * 0.5, roomD * 0.35, 0x4a3a6b));
    scene.add(makeCauldron(cx, cz + 30));
    scene.add(makeBarrel(24, 24));
    scene.add(makeBarrel(roomW - 24, 24));
    scene.add(makeBanner(cx, 90, 8, 0, 0x9b5fc0));

    // Two playable arcade cabinets where the old table used to be — F to
    // play, opening the matching mini-game (see openArcadeGame()).
    if (kiosksOut) {
      const cabZ = cz - 15;
      const cab1X = cx - roomW * 0.2, cab2X = cx + roomW * 0.2;

      scene.add(makeArcadeCabinet(cab1X, cabZ, 0, 0x4cff7a));
      const sign1 = makeSignSprite('🐍 Snake');
      sign1.position.set(cab1X, 92, cabZ);
      scene.add(sign1);
      kiosksOut.push({ id: 'arcade_game_snake', x: cab1X, z: cabZ, game: 'snake' });

      scene.add(makeArcadeCabinet(cab2X, cabZ, 0, 0xff7a4c));
      const sign2 = makeSignSprite('🧱 Breakout');
      sign2.position.set(cab2X, 92, cabZ);
      scene.add(sign2);
      kiosksOut.push({ id: 'arcade_game_breakout', x: cab2X, z: cabZ, game: 'breakout' });
    }
  } else if (type === 'parlor') {
    // Two-story Rooftop Lounge: ground floor on the west side, a staircase,
    // and an upstairs terrace overlooking it on the east side.
    const stairStart = roomW * LOUNGE_STAIR_START_FRAC;
    const groundCx = stairStart / 2;

    scene.add(makeRug(groundCx, roomD * 0.42, stairStart * 0.5, roomD * 0.4, 0x8a5a64));
    scene.add(makeFireplace(groundCx, 14, Math.PI));
    scene.add(makeBench(groundCx - 40, roomD * 0.7, Math.PI / 2));
    scene.add(makeBench(groundCx + 40, roomD * 0.7, -Math.PI / 2));
    scene.add(makeTable(groundCx, roomD * 0.7));
    scene.add(makeBanner(30, 90, 8, 0, 0xc0596f));
    scene.add(makeBanner(stairStart - 30, 90, 8, 0, 0xc0596f));

    // 4 more dining tables downstairs, arranged in a neat 2x2 grid in the
    // rest of the ground floor.
    const groundColX = [stairStart * 0.28, stairStart * 0.78];
    const groundRowZ = [roomD * 0.22, roomD * 0.82];
    for (const z of groundRowZ) {
      for (const x of groundColX) {
        addDiningSet(scene, seatsOut, x, z);
      }
    }

    buildLoungeStructure(scene, roomW, roomD);

    // 3 tables up on the terrace, evenly spaced, overlooking the railing
    const stairEnd = roomW * LOUNGE_STAIR_END_FRAC;
    const platformWidth = roomW - stairEnd;
    const terraceXs = [stairEnd + platformWidth * 0.22, stairEnd + platformWidth * 0.52, stairEnd + platformWidth * 0.82];
    for (const x of terraceXs) {
      addElevatedTable(scene, x, roomD * 0.5, LOUNGE_PLATFORM_HEIGHT);
    }
  } else if (type === 'greathall') {
    scene.add(makeRug(cx, cz, roomW * 0.6, roomD * 0.6, 0x6a6a3a));
    scene.add(makeThrone(cx, 30, 0));
    scene.add(makeTable(cx, cz + 15));
    scene.add(makeBench(cx - 26, cz + 30, 0));
    scene.add(makeBench(cx + 26, cz + 30, 0));
    scene.add(makeBanner(20, 95, 6, 0, 0x8a9a5b));
    scene.add(makeBanner(roomW - 20, 95, 6, 0, 0x8a9a5b));
  } else { // bank — door is north, so "deeper into the room" means higher z
    scene.add(makeRug(cx, roomD * 0.38, roomW * 0.32, roomD * 0.5, 0x7a1f1f));
    scene.add(makeBanner(30, 100, 6, 0, 0xd4af37));
    scene.add(makeBanner(roomW - 30, 100, 6, 0, 0xd4af37));

    // Vault door, purely decorative, mounted flat on the back wall.
    const vault = new THREE.Mesh(
      new THREE.CylinderGeometry(70, 70, 8, 24),
      new THREE.MeshLambertMaterial({ color: 0x6b6b6b })
    );
    vault.rotation.x = Math.PI / 2;
    vault.position.set(cx, 95, roomD - 10);
    scene.add(vault);
    const vaultHub = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 16, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0xd4af37 })
    );
    vaultHub.rotation.x = Math.PI / 2;
    vaultHub.position.set(cx, 95, roomD - 6);
    scene.add(vaultHub);

    // Three service stations side by side, set well back from the door so
    // there's open floor to walk in on: a teller counter, an auctioneer's
    // podium, and a wire clerk's desk for sending gold to other players.
    // Each NPC stands just behind its counter/podium/desk; the kiosk
    // interact point sits just in front, where a player naturally ends up
    // walking up to it.
    const stationZ = roomD * 0.58;
    const tellerX = cx - roomW * 0.28;
    const courierX = cx;
    const auctioneerX = cx + roomW * 0.28;

    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(roomW * 0.22, 34, 22),
      new THREE.MeshLambertMaterial({ color: 0x3c3528 })
    );
    counter.position.set(tellerX, 17, stationZ);
    scene.add(counter);
    const counterTop = new THREE.Mesh(
      new THREE.BoxGeometry(roomW * 0.24, 3, 25),
      new THREE.MeshLambertMaterial({ color: 0xd4af37 })
    );
    counterTop.position.set(tellerX, 35, stationZ);
    scene.add(counterTop);

    const wireDesk = new THREE.Mesh(
      new THREE.BoxGeometry(roomW * 0.2, 30, 20),
      new THREE.MeshLambertMaterial({ color: 0x33424a })
    );
    wireDesk.position.set(courierX, 15, stationZ);
    scene.add(wireDesk);
    const wireDeskTop = new THREE.Mesh(
      new THREE.BoxGeometry(roomW * 0.22, 3, 23),
      new THREE.MeshLambertMaterial({ color: 0x8fb8c9 })
    );
    wireDeskTop.position.set(courierX, 31, stationZ);
    scene.add(wireDeskTop);

    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 24, 38, 8),
      new THREE.MeshLambertMaterial({ color: 0x4a3320 })
    );
    podium.position.set(auctioneerX, 19, stationZ);
    scene.add(podium);

    if (kiosksOut) {
      const npcZ = stationZ + 28, kioskZ = stationZ - 26;

      const teller = createHumanoid(3).group; // "Knight" preset — reads well as a uniform
      teller.position.set(tellerX, 0, npcZ);
      teller.rotation.y = Math.PI;
      scene.add(teller);
      const tellerSign = makeSignSprite('🏦 Bank Teller');
      tellerSign.position.set(tellerX, 92, npcZ);
      scene.add(tellerSign);
      kiosksOut.push({ id: 'bank_teller', x: tellerX, z: kioskZ, npc: 'teller' });

      const courier = createHumanoid(4).group; // "Wanderer" preset — distinct from teller/auctioneer
      courier.position.set(courierX, 0, npcZ);
      courier.rotation.y = Math.PI;
      scene.add(courier);
      const courierSign = makeSignSprite('💸 Wire Clerk');
      courierSign.position.set(courierX, 92, npcZ);
      scene.add(courierSign);
      kiosksOut.push({ id: 'bank_courier', x: courierX, z: kioskZ, npc: 'courier' });

      const auctioneer = createHumanoid(2).group; // "Mystic" — visually distinct from the teller
      auctioneer.position.set(auctioneerX, 0, npcZ);
      auctioneer.rotation.y = Math.PI;
      scene.add(auctioneer);
      const auctioneerSign = makeSignSprite('🔨 Auctioneer');
      auctioneerSign.position.set(auctioneerX, 92, npcZ);
      scene.add(auctioneerSign);
      kiosksOut.push({ id: 'bank_auctioneer', x: auctioneerX, z: kioskZ, npc: 'auctioneer' });
    }
  }
}

// ---------------------------------------------------------------------------
// Player visuals
// ---------------------------------------------------------------------------
// Eyes/brows/mouth, placed at a fixed local +Z offset on the head sphere —
// +Z is "forward" at rotation.y = 0 in this engine's convention (matches
// how facing angles are derived elsewhere, e.g. Math.atan2(dx, dz)), so
// these always end up on the front of the face once the whole group is
// rotated to the character's actual facing.
function addFace(group, headY, headR, eyeColor) {
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
  const browMat = new THREE.MeshLambertMaterial({ color: 0x2a1a12 });
  const mouthMat = new THREE.MeshLambertMaterial({ color: 0x6b3a3a });
  const eyeR = headR * 0.16;
  const eyeY = headY + headR * 0.08;
  const eyeZ = headR * 0.88;
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 8, 8), eyeMat);
    eye.position.set(side * headR * 0.38, eyeY, eyeZ);
    group.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.32, headR * 0.08, headR * 0.08), browMat);
    brow.position.set(side * headR * 0.38, eyeY + headR * 0.32, eyeZ - headR * 0.05);
    group.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.5, headR * 0.1, headR * 0.08), mouthMat);
  mouth.position.set(0, headY - headR * 0.42, eyeZ - headR * 0.02);
  group.add(mouth);
}

// Five distinct silhouettes (not just recolors) so characters read as
// different from across the room, not just up close.
function addHair(group, headY, headR, style, color) {
  if (style === 'bald') return;
  const mat = new THREE.MeshLambertMaterial({ color });
  if (style === 'short' || style === 'long' || style === 'ponytail') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 1.05, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      mat
    );
    cap.position.y = headY + headR * 0.15;
    group.add(cap);
  }
  if (style === 'buzz') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 1.02, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.4),
      mat
    );
    cap.position.y = headY + headR * 0.25;
    group.add(cap);
  }
  if (style === 'long') {
    const drape = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 0.9, headR * 0.6, headR * 1.8, 8),
      mat
    );
    drape.position.set(0, headY - headR * 0.6, -headR * 0.3);
    group.add(drape);
  }
  if (style === 'ponytail') {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.35, headR * 1.6, 8), mat);
    tail.position.set(0, headY - headR * 0.3, -headR * 1.1);
    tail.rotation.x = Math.PI * 0.55;
    group.add(tail);
  }
  if (style === 'mohawk') {
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.35, headR * 0.9, headR * 1.7), mat);
    ridge.position.y = headY + headR * 0.9;
    group.add(ridge);
  }
  if (style === 'witchhat') {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 1.6, headR * 1.6, headR * 0.18, 16),
      mat
    );
    brim.position.y = headY + headR * 0.5;
    group.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.8, headR * 2.4, 10), mat);
    cone.position.y = headY + headR * 0.5 + headR * 1.2;
    group.add(cone);
  }
  if (style === 'wolf') {
    // Pointed wolf ears — two upright cones on top of the head
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.28, headR * 0.9, 5), mat);
      ear.position.set(side * headR * 0.52, headY + headR * 0.85, -headR * 0.12);
      group.add(ear);
    }
    // Protruding snout / muzzle
    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(headR * 0.3, headR * 0.38, headR * 0.6, 8),
      mat
    );
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, headY - headR * 0.1, headR * 0.92);
    group.add(snout);
    // Dark nose at the tip
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 0.12, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x1a0a0a })
    );
    nose.position.set(0, headY - headR * 0.1, headR * 1.22);
    group.add(nose);
  }
}

function createHumanoid(charId) {
  const preset = CHARACTER_PRESETS[charId] || CHARACTER_PRESETS[0];
  const group = new THREE.Group();

  const skinMat  = () => new THREE.MeshLambertMaterial({ color: preset.skin });
  const shirtMat = () => new THREE.MeshLambertMaterial({ color: preset.shirt });
  const pantsMat = () => new THREE.MeshLambertMaterial({ color: preset.pants });

  // ── Torso: three stacked segments give waist, chest, and shoulder silhouette
  const hips = new THREE.Mesh(
    new THREE.CylinderGeometry(9.5, 10, 7, 8),
    pantsMat()
  );
  hips.position.y = CHAR.hipY + 3.5;
  group.add(hips);

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 8.5, 20, 8),
    shirtMat()
  );
  torso.position.y = CHAR.hipY + 7 + 10;
  group.add(torso);

  // Collar bone / neck ridge — a thin disc at shoulder level
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(10.5, 10.5, 2, 8),
    shirtMat()
  );
  collar.position.y = CHAR.shoulderY - 1;
  group.add(collar);

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 4.5, 5, 8),
    skinMat()
  );
  neck.position.y = CHAR.shoulderY + 2.5;
  group.add(neck);

  // ── Head: slightly taller than wide for a less "ball" feel
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(CHAR.headR, 16, 14),
    skinMat()
  );
  head.scale.y = 1.1;
  head.position.y = CHAR.headY;
  group.add(head);

  addFace(group, CHAR.headY, CHAR.headR, preset.eye);
  addHair(group, CHAR.headY, CHAR.headR, preset.hairStyle, preset.hair);

  // Shoulder caps — joint connectors between arm and torso; skin-toned so
  // they don't bleed the shirt color into a visible floating sphere.
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 8, 8),
      skinMat()
    );
    cap.scale.set(1, 0.6, 1);
    cap.position.set(side * 11, CHAR.shoulderY - 2, 0);
    group.add(cap);
  }

  // ── Arms: upper arm + elbow joint + forearm + hand
  function makeArm(side) {
    const pivot = new THREE.Group();

    // Upper arm (thicker near shoulder, tapers to elbow)
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 2.8, 12, 7),
      shirtMat()
    );
    upper.position.y = -6;
    pivot.add(upper);

    // Elbow joint sphere
    const elbow = new THREE.Mesh(
      new THREE.SphereGeometry(2.9, 8, 8),
      skinMat()
    );
    elbow.position.y = -12;
    pivot.add(elbow);

    // Forearm (slightly thinner)
    const lower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.2, 9, 7),
      skinMat()
    );
    lower.position.y = -12 - 4.5;
    pivot.add(lower);

    // Hand — a small rounded box
    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 3, 3),
      skinMat()
    );
    hand.position.y = -12 - 9 - 1.5;
    pivot.add(hand);

    pivot.position.set(side * 12, CHAR.shoulderY - 1, 0);
    return pivot;
  }

  // ── Legs: thigh + knee joint + calf + foot
  function makeLeg(side) {
    const pivot = new THREE.Group();

    // Thigh (wide at top, tapers to knee)
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 3.8, 14, 7),
      pantsMat()
    );
    thigh.position.y = -7;
    pivot.add(thigh);

    // Knee cap — a visible rounded sphere
    const knee = new THREE.Mesh(
      new THREE.SphereGeometry(3.9, 8, 8),
      pantsMat()
    );
    knee.position.y = -14;
    pivot.add(knee);

    // Calf (tapers toward ankle)
    const calf = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 2.5, 11, 7),
      pantsMat()
    );
    calf.position.y = -14 - 5.5;
    pivot.add(calf);

    // Foot — a wedge box: wider front-to-back than side, slightly angled
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(5, 2.5, 8),
      skinMat()
    );
    foot.position.set(0, -26, 2);  // slightly forward to read as a foot
    pivot.add(foot);

    pivot.position.set(side * 5.5, CHAR.hipY, 0);
    return pivot;
  }

  const armL = makeArm(-1), armR = makeArm(1);
  const legL = makeLeg(-1), legR = makeLeg(1);
  group.add(armL, armR, legL, legR);

  return { group, armL, armR, legL, legR, torso, head, baseShirtColor: preset.shirt };
}

// One generic blade for any equipped weapon and one generic chest overlay
// for any equipped armor — not a unique model per item. With only two
// equip slots and items otherwise differing just by name/icon, a per-item
// 3D model isn't worth the cost here; what matters for gameplay/visual
// feedback is just "this player has a weapon/armor equipped or doesn't."
function makeEquippedWeaponMesh() {
  const g = new THREE.Group();
  const metalMat = new THREE.MeshLambertMaterial({ color: 0xcfd6dd });
  const hiltMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 15, 0.6), metalMat);
  blade.position.y = -9;
  g.add(blade);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 1), new THREE.MeshLambertMaterial({ color: 0xb89a4a }));
  guard.position.y = -1.5;
  g.add(guard);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 4, 6), hiltMat);
  hilt.position.y = 0.5;
  g.add(hilt);
  return g;
}

// Per-item appearance palettes — each piece gets a distinct color so you
// can tell at a glance which character is wearing what. One entry per
// equippable item; falls back to a neutral default if the key is missing.
const EQUIP_COLORS = {
  // chest
  steel_shield:   0x8a8f99, witch_robe:  0x1a0a2a, beast_hide:    0x5a3a1a,
  spirit_robe:    0x3a2a5a, travelers_vest: 0x6b4a2a,
  // head  — cap color / brim color
  wizard_hat:     [0x1a1a22, 0x2a2a3a], knights_helm: [0x7a8a9a, 0x6a7a8a],
  beast_crown:    [0x2a1a0a, 0x4a2a0a], spirit_veil:  [0x3a1a5a, 0x5a2a8a],
  travelers_hood: [0x4a3a2a, 0x6a5a3a],
  // feet
  leather_boots:  0x5a3a24, hexed_boots: 0x1a0a2a, paw_boots: 0x3a2a1a,
  // ring (emissive glow color)
  silver_ring:    0xd8e0f0, hex_amulet:  0x8a3aff, spirit_ring: 0xb040ff,
  order_signet:   0xd4af37, trail_ring:  0x4a9a6a
};

function makeEquippedChestMesh(itemId) {
  const color = EQUIP_COLORS[itemId] || 0x8a8f99;
  return new THREE.Mesh(
    new THREE.CylinderGeometry(9.6, 11.6, CHAR.torsoH * 0.85, 8),
    new THREE.MeshLambertMaterial({ color })
  );
}

function makeEquippedHeadMesh(itemId) {
  const palette = EQUIP_COLORS[itemId] || [0x7a8a9a, 0x6a7a8a];
  const [capColor, brimColor] = Array.isArray(palette) ? palette : [palette, palette];
  const g = new THREE.Group();
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(CHAR.headR * 1.12, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: capColor })
  );
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(CHAR.headR * 1.28, CHAR.headR * 1.28, 1.5, 10),
    new THREE.MeshLambertMaterial({ color: brimColor })
  );
  brim.position.y = -CHAR.headR * 0.02;
  g.add(cap);
  g.add(brim);
  return g;
}

function makeEquippedFeetMesh(itemId) {
  const color = EQUIP_COLORS[itemId] || 0x5a3a24;
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  for (const side of [-1, 1]) {
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4, 4, 6), mat);
    boot.position.set(side * 4.5, 2, 0);
    g.add(boot);
  }
  return g;
}

function makeEquippedRingMesh(itemId) {
  const color = EQUIP_COLORS[itemId] || 0xffd43b;
  return new THREE.Mesh(
    new THREE.SphereGeometry(2, 6, 6),
    new THREE.MeshBasicMaterial({ color })
  );
}

// Reusable helper: remove the old mesh from parent if it changed or was
// cleared, build a fresh one with the current item's look, add it back.
function _reattachMesh(v, meshKey, parentKey, makeFn, itemId, positionFn) {
  const changed = v[meshKey + 'ItemId'] !== itemId;
  if (changed && v[meshKey]) {
    v[parentKey].remove(v[meshKey]);
    v[meshKey] = null;
    v[meshKey + 'ItemId'] = null;
  }
  if (itemId && !v[meshKey]) {
    v[meshKey] = makeFn(itemId);
    positionFn(v[meshKey]);
    v[parentKey].add(v[meshKey]);
    v[meshKey + 'ItemId'] = itemId;
  }
}

// Toggle helpers that attach/detach/swap one equip-slot mesh on a given
// visual. Now keyed by itemId (or null) instead of a plain boolean so that
// swapping pieces updates the mesh appearance instead of reusing the old one.
const EQUIP_ATTACH = {
  weapon: (v, itemId) => _reattachMesh(v, 'weaponMesh', 'armR',
    () => makeEquippedWeaponMesh(),
    itemId,
    m => m.position.set(0, -CHAR.armLen + 1, 1.2)),
  chest: (v, itemId) => _reattachMesh(v, 'chestMesh', 'group',
    id => makeEquippedChestMesh(id),
    itemId,
    m => { m.position.y = CHAR.hipY + CHAR.torsoH / 2; }),
  head: (v, itemId) => _reattachMesh(v, 'headMesh', 'group',
    id => makeEquippedHeadMesh(id),
    itemId,
    m => { m.position.y = CHAR.headY; }),
  feet: (v, itemId) => _reattachMesh(v, 'feetMesh', 'group',
    id => makeEquippedFeetMesh(id),
    itemId,
    m => { m.position.y = 0; }),
  ring: (v, itemId) => _reattachMesh(v, 'ringMesh', 'armL',
    id => makeEquippedRingMesh(id),
    itemId,
    m => m.position.set(5, -CHAR.armLen * 0.7, 1))
};

// Creates/removes equip-slot overlay meshes for a given visuals[] entry.
// `equipped` is any object with equippedWeapon/Head/Chest/Feet/Ring fields.
// Safe to call every periodic 'state' broadcast — only touches the scene
// graph on an actual equipped/unequipped transition.
function applyEquipVisual(id, equipped) {
  const v = visuals[id];
  if (!v) return;
  // Pass itemIds directly so each slot can pick the right color/look.
  EQUIP_ATTACH.weapon(v, equipped.equippedWeapon || null);
  EQUIP_ATTACH.chest (v, equipped.equippedChest  || null);
  EQUIP_ATTACH.head  (v, equipped.equippedHead   || null);
  EQUIP_ATTACH.feet  (v, equipped.equippedFeet   || null);
  EQUIP_ATTACH.ring  (v, equipped.equippedRing   || null);
}

// inventory_state only ever describes the local player — routes it into
// applyEquipVisual and also keeps players[myId] in sync.
function applyMyEquipVisual(msg) {
  if (!myId || !players[myId]) return;
  players[myId].equippedWeapon = msg.equippedWeapon || null;
  players[myId].equippedHead   = msg.equippedHead   || null;
  players[myId].equippedChest  = msg.equippedChest  || null;
  players[myId].equippedFeet   = msg.equippedFeet   || null;
  players[myId].equippedRing   = msg.equippedRing   || null;
  applyEquipVisual(myId, players[myId]);
}

// ---------------------------------------------------------------------------
// Spell status visuals — six of the ten curse/blessing statuses change how
// a player looks (shrink/giant/pumpkin/bats/colorcycle/ravencloak); the
// other four (toad/gibberish/stumble/feather) are pure gameplay/text
// effects handled elsewhere (chat send, movement/jump) and have no mesh
// here at all. Only one status — and so only one visual — can be active
// on a given player at a time, matching the server's single activeStatus
// slot.
// ---------------------------------------------------------------------------
function makePumpkinHeadMesh() {
  const g = new THREE.Group();
  const pumpkin = new THREE.Mesh(
    new THREE.SphereGeometry(CHAR.headR * 1.15, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xe87b1e })
  );
  pumpkin.scale.set(1, 0.85, 1);
  g.add(pumpkin);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.8, 4, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a7a2e })
  );
  stem.position.y = CHAR.headR * 0.9;
  g.add(stem);
  const faceMat = new THREE.MeshBasicMaterial({ color: 0x2a1505 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 4), faceMat);
    eye.rotation.x = Math.PI;
    eye.position.set(side * CHAR.headR * 0.38, CHAR.headR * 0.12, CHAR.headR * 0.95);
    g.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(CHAR.headR * 0.7, CHAR.headR * 0.18, 1.5), faceMat);
  mouth.position.set(0, -CHAR.headR * 0.35, CHAR.headR * 0.95);
  g.add(mouth);
  return g;
}

function makeBatSwarm() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x16131a });
  const count = 5;
  for (let i = 0; i < count; i++) {
    const bat = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.4, 4), mat);
    const angle = (i / count) * Math.PI * 2;
    bat.position.set(Math.cos(angle) * 16, CHAR.headY + 8, Math.sin(angle) * 16);
    bat.userData.offset = Math.random() * Math.PI * 2;
    g.add(bat);
  }
  return g;
}

function makeRavenCloak() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x1a1018, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 9), mat);
    wing.position.set(side * 9, CHAR.shoulderY - 4, -6);
    wing.rotation.z = side * 0.3;
    wing.rotation.y = side * 0.4;
    g.add(wing);
  }
  return g;
}

function makeWolfMarkMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xf5a623 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(CHAR.headR * 0.7, 1.5, 6, 16), mat);
  ring.position.y = CHAR.headY + CHAR.headR * 1.8;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const paw = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 4), mat);
    paw.position.set(Math.cos(angle) * CHAR.headR * 0.7, CHAR.headY + CHAR.headR * 1.8, Math.sin(angle) * CHAR.headR * 0.7);
    g.add(paw);
  }
  return g;
}

function makeWolfPactAura() {
  const g = new THREE.Group();
  // Spinning ring of golden wolf eyes — 8 small glowing spheres in a circle
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 7, 7),
      new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 1.0 })
    );
    s.position.set(Math.cos(ang) * 20, CHAR.headY + 18, Math.sin(ang) * 20);
    g.add(s);
  }
  // Outer golden ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(20, 1.5, 6, 20),
    new THREE.MeshLambertMaterial({ color: 0xffcc22, emissive: 0xffaa00, emissiveIntensity: 0.7 })
  );
  ring.position.y = CHAR.headY + 18;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return g;
}

function clearStatusVisual(v) {
  if (!v) return;
  v.group.scale.setScalar(1);
  if (v.pumpkinMesh) {
    v.group.remove(v.pumpkinMesh);
    v.pumpkinMesh = null;
    if (v.head) v.head.visible = true;
  }
  if (v.batsGroup)     { v.group.remove(v.batsGroup);     v.batsGroup     = null; }
  if (v.cloakMesh)     { v.group.remove(v.cloakMesh);     v.cloakMesh     = null; }
  if (v.wolfMarkMesh)  { v.group.remove(v.wolfMarkMesh);  v.wolfMarkMesh  = null; }
  if (v.wolfPactMesh)  { v.group.remove(v.wolfPactMesh);  v.wolfPactMesh  = null; }
  if (v.torso && v.baseShirtColor != null) v.torso.material.color.setHex(v.baseShirtColor);
  v.statusType = null;
}

function applyStatusVisual(id, status) {
  const v = visuals[id];
  if (!v) return;
  const newType = status ? status.type : null;
  if (v.statusType === newType) return;
  clearStatusVisual(v);
  v.statusType = newType;
  if (newType === 'shrink') {
    v.group.scale.setScalar(0.5);
  } else if (newType === 'giant') {
    v.group.scale.setScalar(2);
  } else if (newType === 'pumpkin') {
    if (v.head) v.head.visible = false;
    v.pumpkinMesh = makePumpkinHeadMesh();
    v.pumpkinMesh.position.y = CHAR.headY;
    v.group.add(v.pumpkinMesh);
  } else if (newType === 'bats') {
    v.batsGroup = makeBatSwarm();
    v.group.add(v.batsGroup);
  } else if (newType === 'ravencloak') {
    v.cloakMesh = makeRavenCloak();
    v.group.add(v.cloakMesh);
  } else if (newType === 'wolfmark') {
    v.wolfMarkMesh = makeWolfMarkMesh();
    v.group.add(v.wolfMarkMesh);
  } else if (newType === 'wolfpact') {
    v.wolfPactMesh = makeWolfPactAura();
    v.group.add(v.wolfPactMesh);
  } else if (newType === 'meditate') {
    // No mesh — just a timestamp so syncVisuals knows how far into the
    // sit-then-rise it is. The cross-legged pose and the rising Y offset
    // are both driven from there, every player who can see this player.
    v.meditateStartedAt = performance.now();
  }
  // 'colorcycle'/'speedboost'/'wolfpact' animate every frame in updateStatusVisuals.
  // 'toad'/'gibberish'/'stumble'/'feather'/'speedboost' have no 3D mesh.
}

function updateStatusVisuals(dt) {
  const now = performance.now();
  for (const id in visuals) {
    const v = visuals[id];
    if (v.statusType === 'bats' && v.batsGroup) {
      v.batsGroup.rotation.y += dt * 2.2;
      for (const bat of v.batsGroup.children) {
        bat.position.y = CHAR.headY + 8 + Math.sin(now * 0.004 + bat.userData.offset) * 4;
      }
    } else if (v.statusType === 'colorcycle' && v.torso) {
      v.torso.material.color.setHSL((now * 0.0006) % 1, 0.7, 0.55);
    } else if (v.statusType === 'ravencloak' && v.cloakMesh) {
      v.cloakMesh.rotation.z = Math.sin(now * 0.003) * 0.15;
    } else if (v.statusType === 'wolfmark' && v.wolfMarkMesh) {
      v.wolfMarkMesh.rotation.y += dt * 1.6;
    } else if (v.statusType === 'wolfpact' && v.wolfPactMesh) {
      v.wolfPactMesh.rotation.y += dt * 2.0;
    }
  }
}

// Animate Lexton Greyfur: arms raised and head tilted during night, idle by day.
// A "Awooooo!" chat bubble is shown near him every ~45 s at night.
let _lastLextonHowlNotice = 0;
function updateWerewolfNpc(dt) {
  if (!lextonNpc) return;
  const { isNight } = getDayNightState();
  const now = performance.now();
  // Smooth arm animation: raised (howling) at night, lowered in day
  const TARGET_ARM_Z = isNight ? -Math.PI * 0.72 : 0;
  const SPEED = 2.0;
  if (lextonNpc.armL) {
    lextonNpc.armL.rotation.z += (TARGET_ARM_Z - lextonNpc.armL.rotation.z) * Math.min(1, SPEED * dt);
  }
  if (lextonNpc.armR) {
    lextonNpc.armR.rotation.z += (-TARGET_ARM_Z - lextonNpc.armR.rotation.z) * Math.min(1, SPEED * dt);
  }
  // Head tilts back during howl
  if (lextonNpc.head) {
    const TARGET_HEAD_X = isNight ? -0.55 : 0;
    lextonNpc.head.rotation.x += (TARGET_HEAD_X - lextonNpc.head.rotation.x) * Math.min(1, SPEED * dt);
  }
  // Periodic howl notice — only visible while in the Wilds
  if (isNight && activeScene === wildsScene && now - _lastLextonHowlNotice > 45000) {
    _lastLextonHowlNotice = now;
    setUnlockToast('🌕 A mournful howl echoes from the Ancient One... "Awooooo!"');
  }
}

function ensurePlayerVisual(p) {
  if (visuals[p.id]) return;
  const built = createHumanoid(p.charId || 0);

  const nameEl = document.createElement('div');
  nameEl.className = 'nameTag';
  nameEl.textContent = p.name;
  document.body.appendChild(nameEl);

  const ghostGroup = makeGhostMesh();

  // Not parented into any scene yet — syncVisuals() adds/removes it from
  // whichever scene matches the player's current room each frame.
  // weaponMesh/armorMesh start null and are created/removed lazily by
  // applyEquipVisual() the first time this player actually has something
  // equipped, rather than built upfront for every character.
  visuals[p.id] = {
    ...built, nameEl, inScene: false, parentScene: null,
    ghostGroup, ghostInScene: false, ghostParentScene: null,
    deathAnimStartAt: null,
    attackAnimStartAt: null, attackAnimType: 'punch',
    weaponMesh: null, chestMesh: null, headMesh: null, feetMesh: null, ringMesh: null,
    statusType: null, pumpkinMesh: null, batsGroup: null, cloakMesh: null, wolfMarkMesh: null, wolfPactMesh: null
  };
  // Tags the root group so raycastHitAt() can identify what got clicked —
  // see the attack/harvest targeting section below.
  built.group.userData = { kind: 'player', targetId: p.id };
  applyEquipVisual(p.id, p);
  applyStatusVisual(p.id, p.activeStatus);
}

function destroyPlayerVisual(id) {
  const v = visuals[id];
  if (!v) return;
  if (v.inScene && v.parentScene) v.parentScene.remove(v.group);
  if (v.ghostInScene && v.ghostParentScene) v.ghostParentScene.remove(v.ghostGroup);
  v.nameEl.remove();
  delete visuals[id];
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function syncVisuals(dt) {
  for (const id in players) {
    const p = players[id];
    const v = visuals[id];
    if (!v) continue;

    const moveDx = p.x - p.renderPrevX, moveDy = p.y - p.renderPrevY;
    const moveDist = Math.hypot(moveDx, moveDy);
    const isMoving = moveDist > 0.08;

    // The local player's facing is driven directly by turn input (see update()).
    // Remote players never send us a facing angle over the wire — only x/y —
    // so for them we infer a facing from how their position is drifting.
    // (Uniform scaling for indoor rendering preserves this angle, so raw
    // world-space deltas work whether the player is indoors or outdoors.)
    if (id !== myId && isMoving) {
      const targetFacing = Math.atan2(moveDx, moveDy);
      p.facing = lerpAngle(p.facing, targetFacing, Math.min(1, dt * 10));
    }

    // Attack animation — overrides walk/idle arms for ~0.35s
    const ATTACK_DUR = 0.35;
    const attackElapsed = v.attackAnimStartAt ? (performance.now() - v.attackAnimStartAt) / 1000 : null;
    const attackActive = attackElapsed !== null && attackElapsed < ATTACK_DUR;
    if (attackActive) {
      const t = attackElapsed / ATTACK_DUR;
      v.legL.rotation.x = 0; v.legR.rotation.x = 0;
      if (v.attackAnimType === 'slash') {
        // Wind-up then overhead slam: arm sweeps back then cracks forward
        const ang = t < 0.35
          ? -Math.PI * 0.65 * (t / 0.35)           // swing back
          : -Math.PI * 0.65 + (t - 0.35) / 0.65 * Math.PI * 0.9; // crack forward
        v.armR.rotation.x = ang;
        v.armL.rotation.x = ang * 0.3;
        v.armR.rotation.z = -0.15;
      } else if (v.attackAnimType === 'cast') {
        // Both arms thrust forward, body follows
        const thrust = Math.sin(t * Math.PI) * -1.0;
        v.armR.rotation.x = thrust; v.armL.rotation.x = thrust;
        v.armR.rotation.z = 0; v.armL.rotation.z = 0;
        if (v.group) v.group.rotation.z = Math.sin(t * Math.PI) * 0.08;
      } else {
        // Punch: right jab forward
        const jab = Math.sin(t * Math.PI) * -0.85;
        v.armR.rotation.x = jab;
        v.armL.rotation.x = jab * 0.2;
        v.armR.rotation.z = 0;
      }
    } else if (!attackActive && attackElapsed !== null) {
      // Reset z-rotation after attack
      v.armR.rotation.z = 0;
      if (v.group) v.group.rotation.z = 0;
      v.attackAnimStartAt = null;
    }

    if (attackActive) {
      // skip walk/idle arm logic below
    } else if (v.statusType === 'meditate' || (id === myId && seatedAt)) {
      const ease = Math.min(1, dt * 8);
      const legBend = -Math.PI / 2.1, armBend = 0.15;
      v.legL.rotation.x += (legBend - v.legL.rotation.x) * ease;
      v.legR.rotation.x += (legBend - v.legR.rotation.x) * ease;
      v.armL.rotation.x += (armBend - v.armL.rotation.x) * ease;
      v.armR.rotation.x += (armBend - v.armR.rotation.x) * ease;
      v.group.position.y += (0 - v.group.position.y) * ease;
    } else if (isMoving) {
      p.walkPhase += dt * 9;
      const swing = Math.sin(p.walkPhase) * 0.6;
      v.armL.rotation.x = swing; v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing; v.legR.rotation.x = swing;
      // Bob the whole body up/down so feet visibly lift off the ground each step
      v.group.position.y = Math.abs(Math.sin(p.walkPhase)) * 3.5;
    } else {
      const ease = Math.min(1, dt * 8);
      v.armL.rotation.x += (0 - v.armL.rotation.x) * ease;
      v.armR.rotation.x += (0 - v.armR.rotation.x) * ease;
      v.legL.rotation.x += (0 - v.legL.rotation.x) * ease;
      v.legR.rotation.x += (0 - v.legR.rotation.x) * ease;
      v.group.position.y += (0 - v.group.position.y) * ease;
    }

    const isDead = !!p.isDead;
    const shouldShow = contextMatches(p.room);

    // Normal body — hidden when dead (for remote players, or after death anim completes for local)
    const bodyVisible = shouldShow && !isDead;
    if (bodyVisible && !v.inScene) {
      activeScene.add(v.group);
      v.inScene = true; v.parentScene = activeScene;
    } else if (!bodyVisible && v.inScene) {
      v.parentScene.remove(v.group);
      v.inScene = false; v.parentScene = null;
    } else if (bodyVisible && v.inScene && v.parentScene !== activeScene) {
      v.parentScene.remove(v.group);
      activeScene.add(v.group);
      v.parentScene = activeScene;
    }

    // Death animation for local player (tip forward over 0.8s)
    if (id === myId && isDead && v.deathAnimStartAt !== null) {
      const elapsed = (performance.now() - v.deathAnimStartAt) / 800;
      const t = Math.min(1, elapsed);
      v.group.rotation.x = -Math.PI / 2 * t;
      if (t >= 1) {
        // Body done falling — now hide the body, show ghost
        if (v.inScene && v.parentScene) { v.parentScene.remove(v.group); v.inScene = false; }
        v.deathAnimStartAt = null;
      }
    }

    // Ghost mesh — shown when dead and in the right room
    const ghostVisible = shouldShow && isDead && v.deathAnimStartAt === null;
    if (ghostVisible && !v.ghostInScene) {
      activeScene.add(v.ghostGroup);
      v.ghostInScene = true; v.ghostParentScene = activeScene;
    } else if (!ghostVisible && v.ghostInScene) {
      if (v.ghostParentScene) v.ghostParentScene.remove(v.ghostGroup);
      v.ghostInScene = false; v.ghostParentScene = null;
    } else if (ghostVisible && v.ghostInScene && v.ghostParentScene !== activeScene) {
      if (v.ghostParentScene) v.ghostParentScene.remove(v.ghostGroup);
      activeScene.add(v.ghostGroup);
      v.ghostParentScene = activeScene;
    }

    if (shouldShow) {
      const rp = getRenderPos(p);
      const seatedYOffset = (id === myId && seatedAt) ? -8 : 0;
      const featherMult = (id === myId && me.activeStatus && me.activeStatus.type === 'feather') ? 2.4 : 1;
      const jumpYOffset = (id === myId && jumpActive) ? Math.sin(Math.PI * jumpT / JUMP_DURATION) * JUMP_HEIGHT * featherMult : 0;
      const floorYOffset = getFloorHeight(p.room, rp.x);
      // Deep Meditation: sits at ground level, then rises into a hover over
      // the first couple seconds and gently bobs there for the rest of the
      // duration — x/z still track the player's real position every frame,
      // so they can walk/float around freely while up there.
      let meditateYOffset = 0;
      if (v.statusType === 'meditate') {
        const elapsedMs = performance.now() - (v.meditateStartedAt || performance.now());
        const riseT = Math.min(1, elapsedMs / 2000);
        const riseEase = riseT * riseT * (3 - 2 * riseT);
        const hoverHeight = 22;
        const bob = riseT >= 1 ? Math.sin(performance.now() * 0.0012) * 2 : 0;
        meditateYOffset = riseEase * hoverHeight + bob;
      }
      const posY = groundY + seatedYOffset + jumpYOffset + floorYOffset + meditateYOffset;
      if (!isDead || v.deathAnimStartAt !== null) {
        v.group.position.set(rp.x, posY, rp.z);
        v.group.rotation.y = p.facing;
      }
      // Ghost floats slightly above ground with a gentle bob
      if (ghostVisible) {
        const ghostBob = Math.sin(performance.now() * 0.002) * 6;
        v.ghostGroup.position.set(rp.x, posY + 10 + ghostBob, rp.z);
        v.ghostGroup.rotation.y = p.facing;
      }
    }

    p.renderPrevX = p.x; p.renderPrevY = p.y;
  }
}

function worldToScreen(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(activeCamera);
  return {
    x: (v.x * 0.5 + 0.5) * W,
    y: (-v.y * 0.5 + 0.5) * H,
    visible: v.z < 1
  };
}

function syncLabels() {
  for (const id in players) {
    const p = players[id];
    const v = visuals[id];
    if (!v) continue;
    if (!v.inScene) {
      v.nameEl.style.display = 'none';
      continue;
    }
    const rp = getRenderPos(p);
    const floorYOffset = getFloorHeight(p.room, rp.x);
    const headScreen = worldToScreen(rp.x, groundY + CHAR.headY + floorYOffset, rp.z);
    if (!headScreen.visible) {
      v.nameEl.style.display = 'none';
      continue;
    }
    v.nameEl.style.display = 'block';
    v.nameEl.style.left = headScreen.x + 'px';
    v.nameEl.style.top = (headScreen.y - 14) + 'px';
  }
}

function updateCamera(dt) {
  if (!me) return;
  const rp = getRenderPos(me);
  const f = me.facing + cameraYawOffset; // camera-only angle — drag-to-look never touches actual movement facing
  // Cave uses indoor camera params — the room is small enough that outdoor back=165 clips through the south wall.
  const cam = (mode === 'outdoor' && activeScene !== caveScene) ? OUTDOOR_CAM : (seatedAt ? INDOOR_SEATED_CAM : INDOOR_CAM);
  const dirX = -Math.sin(f), dirZ = -Math.cos(f); // unit vector pointing from the player back toward the camera

  // Indoors, rooms are small enough that a fixed pull-back distance can put
  // the camera past a wall. Rather than clamping the camera's x/z
  // independently (which can yank it off the behind-the-player line —
  // sometimes right on top of the character, or even past them, hiding
  // them entirely), shrink the pull-back distance along that same line so
  // the camera always stays directly behind the player, just closer when a
  // wall is near. This guarantees you can always see your own character.
  let back = cam.back;
  if (mode === 'indoor' && currentInterior) {
    const margin = 16;
    const maxX = dirX > 0.001 ? (currentInterior.roomW - margin - rp.x) / dirX
               : dirX < -0.001 ? (margin - rp.x) / dirX
               : Infinity;
    const maxZ = dirZ > 0.001 ? (currentInterior.roomD - margin - rp.z) / dirZ
               : dirZ < -0.001 ? (margin - rp.z) / dirZ
               : Infinity;
    back = Math.max(24, Math.min(back, maxX, maxZ));
  }

  // Pitch orbits the camera vertically around the same fixed look-at point:
  // shrink the horizontal pull-back by cos(pitch) and raise/lower the
  // camera by sin(pitch) of the (pre-shrink) distance, so it swings through
  // roughly the same radius whether looking flat ahead, up, or down.
  const pitch = cameraPitchOffset;
  const horizBack = back * Math.cos(pitch);
  const verticalRise = -Math.sin(pitch) * back;

  const floorYOffset = getFloorHeight(me.room, rp.x);
  const targetX = rp.x + dirX * horizBack;
  const targetZ = rp.z + dirZ * horizBack;
  const targetY = groundY + cam.height + floorYOffset + verticalRise;

  const ease = 1 - Math.exp(-dt * 6);
  activeCamera.position.x += (targetX - activeCamera.position.x) * ease;
  activeCamera.position.y += (targetY - activeCamera.position.y) * ease;
  activeCamera.position.z += (targetZ - activeCamera.position.z) * ease;

  activeCamera.lookAt(rp.x, groundY + cam.lookUp + floorYOffset, rp.z);
}

// ---------------------------------------------------------------------------
// Sit-down interaction — seats are registered in render-space coordinates
// (matching furniture placement) by addDiningSet(). Occupancy is inferred
// dynamically from other players' current render positions, no new network
// messages needed. Movement is fully locked while seated; only an explicit
// E-press stands back up.
// ---------------------------------------------------------------------------
function seatIsOccupied(seat) {
  for (const id in players) {
    if (id === myId) continue;
    const p = players[id];
    if (p.room !== indoorBuildingId) continue;
    const rp = getRenderPos(p);
    if (Math.hypot(rp.x - seat.x, rp.z - seat.z) < 14) return true;
  }
  return false;
}

function findNearestSeat() {
  if (!currentInterior || !currentInterior.seats || !me) return null;
  const rp = getRenderPos(me);
  let best = null, bestDist = 46;
  for (const seat of currentInterior.seats) {
    const d = Math.hypot(rp.x - seat.x, rp.z - seat.z);
    if (d < bestDist) { bestDist = d; best = seat; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Town Pass statue — a physical, walk-up-to-it kiosk inside the free
// building. Pressing E near it opens the purchase modal for the cheaper,
// single-room Arcade pass.
// ---------------------------------------------------------------------------
function nearestKioskIn(list, x, z, radius) {
  const defaultR = radius || 80;
  let best = null, bestDist = Infinity;
  for (const k of list) {
    const r = k.radius || defaultR;
    const d = Math.hypot(x - k.x, z - k.z);
    if (d < r && d < bestDist) { bestDist = d; best = k; }
  }
  return best;
}

// Indoor kiosks (bank/auctioneer/arcade/etc.) live on currentInterior, set
// per-room by getInteriorScene(); outdoor ones — currently just the portal,
// one on each side — aren't tied to any one room, so they're matched
// against whichever outdoor scene is actually active.
function findNearestKiosk() {
  if (!me) return null;
  if (mode === 'indoor') {
    if (!currentInterior || !currentInterior.kiosks) return null;
    const rp = getRenderPos(me);
    return nearestKioskIn(currentInterior.kiosks, rp.x, rp.z);
  }
  // Room-based check for cave comes first — covers the case where caveScene
  // failed to build (buildCaveScene threw before assigning caveScene) so
  // activeScene !== caveScene, but me.room is already 'witch_cave'.
  if (me.room === 'witch_cave') return nearestKioskIn(CAVE_KIOSKS, me.x, me.y);
  if (activeScene === outdoorScene) return nearestKioskIn(OUTDOOR_KIOSKS, me.x, me.y);
  if (activeScene === wildsScene) return nearestKioskIn(WILDS_KIOSKS, me.x, me.y);
  if (activeScene === dungeonScene) return nearestKioskIn(DUNGEON_KIOSKS, me.x, me.y);
  return null;
}

let passModalOpen = false;

function openPassModal() {
  const modal = document.getElementById('passModal');
  if (!modal) return;
  document.getElementById('roomPassPrice').textContent = formatPrice(roomPassPriceCents);
  document.getElementById('roomPassHours').textContent = String(roomPassHours);
  const err = document.getElementById('passModalErr');
  if (err) err.textContent = '';
  const buyBtn = document.getElementById('roomPassBuyBtn');
  if (buyBtn) { buyBtn.disabled = false; buyBtn.textContent = `Buy Arcade Pass — ${formatPrice(roomPassPriceCents)}`; }
  modal.classList.remove('hidden');
  passModalOpen = true;
}

function closePassModal() {
  const modal = document.getElementById('passModal');
  if (modal) modal.classList.add('hidden');
  passModalOpen = false;
}

const passModalCloseBtn = document.getElementById('passModalCloseBtn');
if (passModalCloseBtn) passModalCloseBtn.addEventListener('click', closePassModal);

// ---------------------------------------------------------------------------
// Bank & Auction House UI. Neither modal tracks its own copy of truth —
// they just render whatever the server last sent in bank_state/auction_state
// and fire off requests/actions, the same trust split as the rest of this
// client (server decides, client displays + asks).
// ---------------------------------------------------------------------------
let bankModalOpen = false;
let auctionModalOpen = false;
let sendMoneyModalOpen = false;
let lastBankState = null; // { balance, slots }
let lastInventoryState = null; // { slots, equippedWeapon, equippedHead, equippedChest, equippedFeet, equippedRing }
let selectedInvSlotIdx = null;
let lastAuctionListings = [];
let selectedBankSlotIdx = null;

function openBankModal() {
  cancelTargeting();
  if (auctionModalOpen) closeAuctionModal();
  if (sendMoneyModalOpen) closeSendMoneyModal();
  const modal = document.getElementById('bankModal');
  if (!modal) return;
  document.getElementById('bankModalErr').textContent = '';
  document.getElementById('bankListForm').classList.add('hidden');
  selectedBankSlotIdx = null;
  modal.classList.remove('hidden');
  bankModalOpen = true;
  ws.send(JSON.stringify({ type: 'bank_open' }));
  ws.send(JSON.stringify({ type: 'inventory_open' })); // populates the "Deposit from Inventory" dropdown
}

function closeBankModal() {
  const modal = document.getElementById('bankModal');
  if (modal) modal.classList.add('hidden');
  bankModalOpen = false;
}

const bankModalCloseBtn = document.getElementById('bankModalCloseBtn');
if (bankModalCloseBtn) bankModalCloseBtn.addEventListener('click', closeBankModal);

// ---------------------------------------------------------------------------
// Send Money modal — the Wire Clerk NPC's whole job. Recipient must be
// another currently-online player with their own bank account (the server
// enforces this; this just picks from whoever's visible right now). Pure
// request/response like the rest of the bank: ws.send the request, server
// validates balance/recipient and replies with bank_state or bank_error.
// ---------------------------------------------------------------------------
function openSendMoneyModal() {
  cancelTargeting();
  if (bankModalOpen) closeBankModal();
  if (auctionModalOpen) closeAuctionModal();
  const modal = document.getElementById('sendMoneyModal');
  if (!modal) return;
  document.getElementById('sendMoneyErr').textContent = '';
  document.getElementById('sendMoneyAmount').value = '';
  refreshSendMoneyRecipients();
  modal.classList.remove('hidden');
  sendMoneyModalOpen = true;
  ws.send(JSON.stringify({ type: 'bank_open' })); // populates the balance readout
}

function closeSendMoneyModal() {
  const modal = document.getElementById('sendMoneyModal');
  if (modal) modal.classList.add('hidden');
  sendMoneyModalOpen = false;
}

const sendMoneyModalCloseBtn = document.getElementById('sendMoneyModalCloseBtn');
if (sendMoneyModalCloseBtn) sendMoneyModalCloseBtn.addEventListener('click', closeSendMoneyModal);

function refreshSendMoneyRecipients() {
  const select = document.getElementById('sendMoneyRecipient');
  if (!select) return;
  const prev = select.value;
  select.innerHTML = '';
  const others = Object.values(players).filter(p => p.id !== myId);
  if (others.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.textContent = 'No one else is here';
    select.appendChild(opt);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (const p of others) {
    const opt = document.createElement('option');
    opt.value = p.id; opt.textContent = p.name;
    select.appendChild(opt);
  }
  if (others.some(p => p.id === prev)) select.value = prev;
}

const sendMoneySubmitBtn = document.getElementById('sendMoneySubmitBtn');
if (sendMoneySubmitBtn) sendMoneySubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('sendMoneyErr');
  const toId = document.getElementById('sendMoneyRecipient').value;
  const amount = parseInt(document.getElementById('sendMoneyAmount').value, 10);
  if (!toId) { err.textContent = 'Pick someone to send money to.'; return; }
  if (!Number.isInteger(amount) || amount < 1) { err.textContent = 'Enter a valid amount.'; return; }
  err.textContent = '';
  ws.send(JSON.stringify({ type: 'send_money', toId, amount }));
});

function renderBankModal() {
  if (!lastBankState) return;
  document.getElementById('bankBalance').textContent = String(lastBankState.balance);
  const grid = document.getElementById('bankSlotsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  lastBankState.slots.forEach((slot, idx) => {
    const cell = document.createElement('div');
    cell.className = 'itemSlot' + (slot ? '' : ' empty') + (selectedBankSlotIdx === idx ? ' selected' : '');
    if (slot) {
      const item = ITEM_CATALOG[slot.itemId];
      const icon = buildItemIconEl(slot.itemId);
      const qty = document.createElement('span');
      qty.className = 'slotQty';
      qty.textContent = String(slot.qty);
      cell.appendChild(icon);
      cell.appendChild(qty);
      cell.title = '';
      cell.addEventListener('mouseenter', (e) => showItemTooltip(e, slot.itemId));
      cell.addEventListener('mouseleave', hideTooltip);
      cell.addEventListener('click', () => selectBankSlot(idx));
    }
    grid.appendChild(cell);
  });
}

function selectBankSlot(idx) {
  selectedBankSlotIdx = idx;
  renderBankModal();
  const slot = lastBankState.slots[idx];
  const form = document.getElementById('bankListForm');
  if (!slot) { form.classList.add('hidden'); return; }
  const item = ITEM_CATALOG[slot.itemId];
  document.getElementById('bankListItemLabel').textContent =
    (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
  const qtyInput = document.getElementById('bankListQty');
  qtyInput.max = String(slot.qty);
  qtyInput.value = '1';
  document.getElementById('bankListStartBid').value = '';
  document.getElementById('bankListBuyout').value = '';
  form.classList.remove('hidden');
}

const bankListSubmitBtn = document.getElementById('bankListSubmitBtn');
if (bankListSubmitBtn) bankListSubmitBtn.addEventListener('click', () => {
  if (selectedBankSlotIdx === null || !lastBankState) return;
  const slot = lastBankState.slots[selectedBankSlotIdx];
  const err = document.getElementById('bankModalErr');
  if (!slot) { err.textContent = 'Pick an item first.'; return; }
  const qty = parseInt(document.getElementById('bankListQty').value, 10);
  const startingBid = parseInt(document.getElementById('bankListStartBid').value, 10);
  const buyoutRaw = document.getElementById('bankListBuyout').value;
  const buyoutPrice = buyoutRaw ? parseInt(buyoutRaw, 10) : null;
  const durationHours = parseInt(document.getElementById('bankListDuration').value, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > slot.qty) { err.textContent = 'Enter a valid quantity.'; return; }
  if (!Number.isInteger(startingBid) || startingBid < 1) { err.textContent = 'Enter a valid starting bid.'; return; }
  if (buyoutPrice !== null && (!Number.isInteger(buyoutPrice) || buyoutPrice <= startingBid)) {
    err.textContent = 'Buyout must be higher than the starting bid.';
    return;
  }
  err.textContent = '';
  ws.send(JSON.stringify({ type: 'auction_create', itemId: slot.itemId, qty, startingBid, buyoutPrice, durationHours }));
});

const bankWithdrawBtn = document.getElementById('bankWithdrawBtn');
if (bankWithdrawBtn) bankWithdrawBtn.addEventListener('click', () => {
  if (selectedBankSlotIdx === null || !lastBankState) return;
  const slot = lastBankState.slots[selectedBankSlotIdx];
  const err = document.getElementById('bankModalErr');
  if (!slot) { err.textContent = 'Pick an item first.'; return; }
  const qty = parseInt(document.getElementById('bankListQty').value, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > slot.qty) { err.textContent = 'Enter a valid quantity.'; return; }
  err.textContent = '';
  ws.send(JSON.stringify({ type: 'bank_withdraw', slotIdx: selectedBankSlotIdx, qty }));
});

function populateBankDepositSelect() {
  const select = document.getElementById('bankDepositItemSelect');
  if (!select || !lastInventoryState) return;
  select.innerHTML = '';
  lastInventoryState.slots.forEach((slot, idx) => {
    if (!slot) return;
    const item = ITEM_CATALOG[slot.itemId];
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
    select.appendChild(opt);
  });
}

const bankDepositSubmitBtn = document.getElementById('bankDepositSubmitBtn');
if (bankDepositSubmitBtn) bankDepositSubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('bankModalErr');
  const idx = parseInt(document.getElementById('bankDepositItemSelect').value, 10);
  if (!lastInventoryState || !Number.isInteger(idx) || !lastInventoryState.slots[idx]) { err.textContent = 'Pick an item first.'; return; }
  const slot = lastInventoryState.slots[idx];
  const qty = parseInt(document.getElementById('bankDepositQty').value, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > slot.qty) { err.textContent = 'Enter a valid quantity.'; return; }
  err.textContent = '';
  ws.send(JSON.stringify({ type: 'bank_deposit', slotIdx: idx, qty }));
});

function openAuctionModal() {
  cancelTargeting();
  if (bankModalOpen) closeBankModal();
  if (sendMoneyModalOpen) closeSendMoneyModal();
  const modal = document.getElementById('auctionModal');
  if (!modal) return;
  document.getElementById('auctionModalErr').textContent = '';
  document.getElementById('auctionCreateForm').classList.add('hidden');
  document.getElementById('auctionSelfieForm').classList.add('hidden');
  modal.classList.remove('hidden');
  auctionModalOpen = true;
  ws.send(JSON.stringify({ type: 'bank_open' }));
  ws.send(JSON.stringify({ type: 'auction_browse' }));
}

function closeAuctionModal() {
  const modal = document.getElementById('auctionModal');
  if (modal) modal.classList.add('hidden');
  auctionModalOpen = false;
}

const auctionModalCloseBtn = document.getElementById('auctionModalCloseBtn');
if (auctionModalCloseBtn) auctionModalCloseBtn.addEventListener('click', closeAuctionModal);

const auctionCreateToggleBtn = document.getElementById('auctionCreateToggleBtn');
if (auctionCreateToggleBtn) auctionCreateToggleBtn.addEventListener('click', () => {
  const form = document.getElementById('auctionCreateForm');
  if (!form) return;
  document.getElementById('auctionSelfieForm').classList.add('hidden');
  if (form.classList.contains('hidden')) populateAuctionItemSelect();
  form.classList.toggle('hidden');
});

let pendingSelfieImage = null;

const auctionSelfieToggleBtn = document.getElementById('auctionSelfieToggleBtn');
if (auctionSelfieToggleBtn) auctionSelfieToggleBtn.addEventListener('click', () => {
  const form = document.getElementById('auctionSelfieForm');
  if (!form) return;
  document.getElementById('auctionCreateForm').classList.add('hidden');
  form.classList.toggle('hidden');
});

const auctionSelfieCaptureBtn = document.getElementById('auctionSelfieCaptureBtn');
if (auctionSelfieCaptureBtn) auctionSelfieCaptureBtn.addEventListener('click', () => {
  const err = document.getElementById('auctionModalErr');
  err.textContent = '';
  auctionSelfieCaptureBtn.disabled = true;
  auctionSelfieCaptureBtn.textContent = 'Opening camera…';
  captureSelfiePhoto()
    .then(image => {
      pendingSelfieImage = image;
      const preview = document.getElementById('auctionSelfiePreview');
      preview.src = image;
      preview.classList.remove('hidden');
      auctionSelfieCaptureBtn.textContent = 'Retake selfie';
      auctionSelfieCaptureBtn.disabled = false;
    })
    .catch(() => {
      err.textContent = 'Could not access the camera.';
      auctionSelfieCaptureBtn.textContent = 'Take selfie';
      auctionSelfieCaptureBtn.disabled = false;
    });
});

const auctionSelfieSubmitBtn = document.getElementById('auctionSelfieSubmitBtn');
if (auctionSelfieSubmitBtn) auctionSelfieSubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('auctionModalErr');
  if (!pendingSelfieImage) { err.textContent = 'Take a selfie first.'; return; }
  const startingBid = parseInt(document.getElementById('auctionSelfieStartBid').value, 10);
  const buyoutRaw = document.getElementById('auctionSelfieBuyout').value;
  const buyoutPrice = buyoutRaw ? parseInt(buyoutRaw, 10) : null;
  const durationMinutes = parseInt(document.getElementById('auctionSelfieDuration').value, 10);
  if (!Number.isInteger(startingBid) || startingBid < 1) { err.textContent = 'Enter a valid starting bid.'; return; }
  if (buyoutPrice !== null && (!Number.isInteger(buyoutPrice) || buyoutPrice <= startingBid)) {
    err.textContent = 'Buyout must be higher than the starting bid.';
    return;
  }
  err.textContent = '';
  ws.send(JSON.stringify({ type: 'auction_list_selfie', image: pendingSelfieImage, startingBid, buyoutPrice, durationMinutes }));
  pendingSelfieImage = null;
  document.getElementById('auctionSelfiePreview').classList.add('hidden');
  document.getElementById('auctionSelfieCaptureBtn').textContent = 'Take selfie';
  document.getElementById('auctionSelfieForm').classList.add('hidden');
});

function populateAuctionItemSelect() {
  const select = document.getElementById('auctionItemSelect');
  if (!select || !lastBankState) return;
  select.innerHTML = '';
  lastBankState.slots.forEach((slot, idx) => {
    if (!slot) return;
    const item = ITEM_CATALOG[slot.itemId];
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
    select.appendChild(opt);
  });
}

const auctionCreateSubmitBtn = document.getElementById('auctionCreateSubmitBtn');
if (auctionCreateSubmitBtn) auctionCreateSubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('auctionModalErr');
  const idx = parseInt(document.getElementById('auctionItemSelect').value, 10);
  if (!lastBankState || !Number.isInteger(idx) || !lastBankState.slots[idx]) { err.textContent = 'Pick an item first.'; return; }
  const slot = lastBankState.slots[idx];
  const qty = parseInt(document.getElementById('auctionQty').value, 10);
  const startingBid = parseInt(document.getElementById('auctionStartBid').value, 10);
  const buyoutRaw = document.getElementById('auctionBuyout').value;
  const buyoutPrice = buyoutRaw ? parseInt(buyoutRaw, 10) : null;
  const durationHours = parseInt(document.getElementById('auctionDuration').value, 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > slot.qty) { err.textContent = 'Enter a valid quantity.'; return; }
  if (!Number.isInteger(startingBid) || startingBid < 1) { err.textContent = 'Enter a valid starting bid.'; return; }
  if (buyoutPrice !== null && (!Number.isInteger(buyoutPrice) || buyoutPrice <= startingBid)) {
    err.textContent = 'Buyout must be higher than the starting bid.';
    return;
  }
  err.textContent = '';
  ws.send(JSON.stringify({ type: 'auction_create', itemId: slot.itemId, qty, startingBid, buyoutPrice, durationHours }));
  document.getElementById('auctionCreateForm').classList.add('hidden');
});

function formatTimeRemaining(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'ending…';
  const mins = Math.floor(ms / 60000);
  const hrs = Math.floor(mins / 60);
  return hrs >= 1 ? (hrs + 'h ' + (mins % 60) + 'm left') : (mins + 'm left');
}

// Builds each row's text via .textContent (never innerHTML) specifically
// because sellerName/currentBidderName are other players' display names —
// arbitrary-ish user input. textContent never parses its string as markup
// no matter what's in it, so this is safe regardless of what characters a
// name contains, consistent with how chat messages render player names
// elsewhere in this file.
function renderAuctionModal() {
  const list = document.getElementById('auctionListings');
  const empty = document.getElementById('auctionEmptyMsg');
  if (!list || !empty) return;
  list.innerHTML = '';
  if (lastAuctionListings.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  for (const l of lastAuctionListings) {
    const item = ITEM_CATALOG[l.itemId];
    const row = document.createElement('div');
    row.className = 'auctionRow';

    if (l.isSelfie) {
      const thumb = document.createElement('img');
      thumb.className = 'auctionSelfieThumb';
      thumb.src = l.image;
      thumb.title = 'Click to view full size';
      thumb.addEventListener('click', () => window.open(l.image, '_blank'));
      row.appendChild(thumb);
      const itemLine = document.createElement('div');
      itemLine.className = 'auctionItemLine';
      itemLine.textContent = `📸 ${l.sellerName}'s Selfie`;
      row.appendChild(itemLine);
    } else {
      const itemLine = document.createElement('div');
      itemLine.className = 'auctionItemLine';
      itemLine.textContent = (item ? item.icon + ' ' + item.name : l.itemId) + ' x' + l.qty;
      row.appendChild(itemLine);
    }

    const bidLine = l.currentBid != null
      ? ('Current bid: ' + l.currentBid + ' 🪙 by ' + l.currentBidderName)
      : ('Starting bid: ' + l.startingBid + ' 🪙');
    const buyoutLine = l.buyoutPrice ? (' · Buyout: ' + l.buyoutPrice + ' 🪙') : '';
    const metaLine = document.createElement('div');
    metaLine.className = 'auctionMeta';
    metaLine.textContent = 'Seller: ' + l.sellerName + ' · ' + bidLine + buyoutLine + ' · ' + formatTimeRemaining(l.expiresAt);
    row.appendChild(metaLine);

    const bidRow = document.createElement('div');
    bidRow.className = 'auctionBidRow';
    const minBid = l.currentBid != null ? l.currentBid + 1 : l.startingBid;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(minBid);
    input.placeholder = String(minBid);
    const bidBtn = document.createElement('button');
    bidBtn.className = 'btn';
    bidBtn.textContent = 'Bid';
    bidBtn.addEventListener('click', () => {
      const amount = parseInt(input.value, 10);
      const err = document.getElementById('auctionModalErr');
      if (!Number.isInteger(amount)) { err.textContent = 'Enter a bid amount.'; return; }
      err.textContent = '';
      ws.send(JSON.stringify({ type: 'auction_bid', listingId: l.id, amount }));
    });
    bidRow.appendChild(input);
    bidRow.appendChild(bidBtn);

    if (l.buyoutPrice) {
      const buyoutBtn = document.createElement('button');
      buyoutBtn.className = 'btn';
      buyoutBtn.textContent = 'Buyout';
      buyoutBtn.addEventListener('click', () => {
        document.getElementById('auctionModalErr').textContent = '';
        ws.send(JSON.stringify({ type: 'auction_bid', listingId: l.id, amount: l.buyoutPrice }));
      });
      bidRow.appendChild(buyoutBtn);
    }

    row.appendChild(bidRow);
    list.appendChild(row);
  }
}

// Listings carry a live countdown ("Xh Ym left"); refresh the text once a
// minute so it doesn't go stale while the modal sits open without a bid
// changing anything (which would otherwise be the only thing triggering
// a re-render via auction_state).
setInterval(() => { if (auctionModalOpen) renderAuctionModal(); }, 60000);

// ---------------------------------------------------------------------------
// Spellbook UI — Witch-only (spellbookBtn is only ever unhidden for charId
// 0, see the 'init' handler above). Renders entirely from the local
// SPELL_CATALOG mirror, no server round-trip just to list spells — the
// catalog isn't per-player/dynamic. Casting is the only thing that talks
// to the server, which owns all real validation/cooldown/effects; this is
// just the menu and the request.
// ---------------------------------------------------------------------------
let spellbookOpen = false;
let selectedSpellId = null;

function openSpellbook() {
  cancelTargeting();
  const modal = document.getElementById('spellbookModal');
  if (!modal) return;
  document.getElementById('spellbookErr').textContent = '';
  selectedSpellId = null;
  document.getElementById('spellTargetPanel').classList.add('hidden');
  renderSpellList();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 370, 112);
  spellbookOpen = true;
}

function closeSpellbook() {
  const modal = document.getElementById('spellbookModal');
  if (modal) modal.classList.add('hidden');
  spellbookOpen = false;
}

const spellbookBtn = document.getElementById('spellbookBtn');
if (spellbookBtn) spellbookBtn.addEventListener('click', () => { if (spellbookOpen) closeSpellbook(); else openSpellbook(); });
const spellbookCloseBtn = document.getElementById('spellbookCloseBtn');
if (spellbookCloseBtn) spellbookCloseBtn.addEventListener('click', closeSpellbook);

function renderSpellList() {
  const list = document.getElementById('spellList');
  if (!list) return;
  list.innerHTML = '';
  for (const id in SPELL_CATALOG) {
    const spell = SPELL_CATALOG[id];
    const row = document.createElement('div');
    row.className = 'spellRow' + (selectedSpellId === id ? ' selected' : '');
    const name = document.createElement('div');
    name.className = 'spellName';
    name.textContent = spell.icon + ' ' + spell.name;
    const desc = document.createElement('div');
    desc.className = 'spellDesc';
    desc.textContent = spell.description;
    row.appendChild(name);
    row.appendChild(desc);
    row.addEventListener('click', () => selectSpell(id));
    list.appendChild(row);
  }
}

// Targeted spells skip the panel entirely now — picking one closes the
// Spellbook and arms targeting (see armTargeting() above), so the only
// kind that still shows this panel is 'self', which just needs the Cast
// button with no target picker at all.
function selectSpell(id) {
  selectedSpellId = id;
  renderSpellList();
  const spell = SPELL_CATALOG[id];
  document.getElementById('spellbookErr').textContent = '';
  if (spell.kind === 'targeted') {
    closeSpellbook();
    armTargeting('cast_spell', 'spellId', id, spell.name);
    return;
  }
  document.getElementById('spellTargetPanel').classList.remove('hidden');
}

const spellCastBtn = document.getElementById('spellCastBtn');
if (spellCastBtn) spellCastBtn.addEventListener('click', () => {
  if (!selectedSpellId) return;
  document.getElementById('spellbookErr').textContent = '';
  ws.send(JSON.stringify({ type: 'cast_spell', spellId: selectedSpellId }));
});

// A brief highlight on the target's existing name tag — Glimpse the
// Future's whole effect, since every player's position is already shared
// with everyone continuously (see the periodic 'state' broadcast); there's
// no new data to reveal, just a moment of "look, there" for the caster.
function showGlimpseBeacon(targetId) {
  const v = visuals[targetId];
  if (!v || !v.nameEl) return;
  v.nameEl.classList.add('glimpseHighlight');
  setTimeout(() => { if (v.nameEl) v.nameEl.classList.remove('glimpseHighlight'); }, 10000);
}

// ---------------------------------------------------------------------------
// Hotbar — a bottom action bar mirroring whichever 12-ability catalog the
// current character has (Witch's SPELL_CATALOG or a Werewolf/Wanderer
// ATTACK_CATALOGS entry), bound one-to-one to the keys 1234567890-=. This
// exists purely as a fast path: every slot resolves a target/building on
// its own (nearest other player in the same room, or nearest building) and
// fires the same cast_attack/cast_spell message the Attacks/Spellbook
// modals send — it never replaces those modals, which still exist for
// picking a *specific* target instead of "nearest."
// ---------------------------------------------------------------------------
let myActionCatalog = null;

// ---------------------------------------------------------------------------
// Item / action tooltip — shared floating panel, positioned near the cursor
// ---------------------------------------------------------------------------
const _tt = document.getElementById('itemTooltip');
const _ttName  = document.getElementById('ttName');
const _ttSlot  = document.getElementById('ttSlot');
const _ttStats = document.getElementById('ttStats');
const _ttDesc  = document.getElementById('ttDesc');
const SLOT_LABELS = { weapon: 'Weapon', head: 'Head', chest: 'Chest', feet: 'Feet', ring: 'Ring' };
const KIND_LABELS  = { targeted: 'Targeted', aoe: 'Area of Effect', self: 'Self', building: 'Building' };

function _positionTooltip(e) {
  if (!_tt) return;
  const margin = 14, w = _tt.offsetWidth || 180, h = _tt.offsetHeight || 80;
  let x = e.clientX + margin, y = e.clientY + margin;
  if (x + w > window.innerWidth)  x = e.clientX - w - margin;
  if (y + h > window.innerHeight) y = e.clientY - h - margin;
  _tt.style.left = x + 'px';
  _tt.style.top  = y + 'px';
}

function showItemTooltip(e, itemId) {
  if (!_tt) return;
  const item = ITEM_CATALOG[itemId];
  if (!item) return;
  _ttName.textContent  = item.icon + '  ' + item.name;
  _ttSlot.textContent  = item.slot ? (SLOT_LABELS[item.slot] || item.slot) : 'Item';
  const lines = [];
  if (item.atk) lines.push('⚔️ ATK  +' + item.atk);
  if (item.def) lines.push('🛡️ DEF  +' + item.def);
  if (item.spd) lines.push('⚡ SPD  +' + item.spd + '%');
  _ttStats.innerHTML = lines.join('<br>');
  _ttDesc.textContent = item.desc || '';
  _ttDesc.style.display = item.desc ? '' : 'none';
  _tt.classList.remove('hidden');
  _positionTooltip(e);
}

function showActionTooltip(e, action) {
  if (!_tt || !action) return;
  _ttName.textContent  = action.icon + '  ' + action.name;
  _ttSlot.textContent  = KIND_LABELS[action.kind] || (action.kind || '');
  _ttStats.innerHTML   = '';
  _ttDesc.textContent  = action.description || '';
  _ttDesc.style.display = action.description ? '' : 'none';
  _tt.classList.remove('hidden');
  _positionTooltip(e);
}

function hideTooltip() { if (_tt) _tt.classList.add('hidden'); }

document.addEventListener('mousemove', (e) => {
  if (_tt && !_tt.classList.contains('hidden')) _positionTooltip(e);
});

let myActionMsgType = null;
let myActionIdField = null;
const HOTBAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const HOTBAR_KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

function buildHotbar() {
  const bar = document.getElementById('hotbar');
  if (!bar) return;
  bar.innerHTML = '';
  bar.classList.toggle('mobile', isTouchDevice());
  if (!myActionCatalog) { bar.classList.add('hidden'); return; }
  const ids = Object.keys(myActionCatalog);
  ids.forEach((id, idx) => {
    if (idx >= HOTBAR_KEYS.length) return;
    const atk = myActionCatalog[id];
    const slot = document.createElement('div');
    slot.className = 'hotbarSlot';
    const icon = document.createElement('span');
    icon.className = 'hotbarIcon';
    icon.textContent = atk.icon;
    const key = document.createElement('span');
    key.className = 'hotbarKey';
    key.textContent = HOTBAR_KEY_LABELS[idx];
    slot.appendChild(icon);
    slot.appendChild(key);
    slot.addEventListener('mouseenter', (e) => showActionTooltip(e, atk));
    slot.addEventListener('mouseleave', hideTooltip);
    slot.addEventListener('click', () => castFromHotbar(id));
    bar.appendChild(slot);
  });
  bar.classList.remove('hidden');
}

function nearestOtherPlayer() {
  if (!me) return null;
  let best = null, bestDist = Infinity;
  for (const p of Object.values(players)) {
    if (p.id === myId || p.room !== me.room) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

function nearestBuilding() {
  if (!me || !world) return null;
  let best = null, bestDist = Infinity;
  for (const b of world.buildings) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const d = Math.hypot(cx - me.x, cy - me.y);
    if (d < bestDist) { bestDist = d; best = b; }
  }
  return best;
}

function castFromHotbar(id) {
  if (!myActionCatalog || !myActionMsgType) return;
  const atk = myActionCatalog[id];
  if (!atk) return;
  cancelTargeting(); // a hotbar press means "do this nearest-target cast now", not "wait for my next click"
  const payload = { type: myActionMsgType, [myActionIdField]: id };
  if (atk.kind === 'targeted' || atk.kind === 'reveal') {
    const target = nearestOtherPlayer();
    if (!target) { setUnlockToast('No one else is here to target.'); return; }
    payload.targetId = target.id;
  } else if (atk.kind === 'building') {
    const building = nearestBuilding();
    if (!building) { setUnlockToast('No building nearby.'); return; }
    payload.buildingId = building.id;
  }
  ws.send(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Attacks UI — generic across any charId with an entry in ATTACK_CATALOGS
// (currently Werewolf charId 1, Wanderer charId 4). AoE attacks (kind:'aoe')
// hit everyone within server-computed radius; the UI shows no target picker
// for those. Targeted attacks show a dropdown.
// ---------------------------------------------------------------------------
let myAttackCatalog = null;
let attackPanelOpen = false;
let selectedAttackId = null;

const ATTACK_PANEL_TITLES = { 1: '🐺 Wolf Attacks', 4: '🥾 Wanderer Skills' };

function openAttackPanel() {
  cancelTargeting();
  const modal = document.getElementById('attackModal');
  if (!modal || !myAttackCatalog) return;
  document.getElementById('attackErr').textContent = '';
  selectedAttackId = null;
  document.getElementById('attackTargetPanel').classList.add('hidden');
  const title = document.getElementById('attackModalTitle');
  if (title) title.textContent = (me && ATTACK_PANEL_TITLES[me.charId]) || '⚔️ Attacks';
  renderAttackList();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 370, 112);
  attackPanelOpen = true;
}

function closeAttackPanel() {
  const modal = document.getElementById('attackModal');
  if (modal) modal.classList.add('hidden');
  attackPanelOpen = false;
}

const attackBtn = document.getElementById('attackBtn');
if (attackBtn) attackBtn.addEventListener('click', () => { if (attackPanelOpen) closeAttackPanel(); else openAttackPanel(); });
const attackCloseBtn = document.getElementById('attackCloseBtn');
if (attackCloseBtn) attackCloseBtn.addEventListener('click', closeAttackPanel);

function renderAttackList() {
  const list = document.getElementById('attackList');
  if (!list || !myAttackCatalog) return;
  list.innerHTML = '';
  for (const id in myAttackCatalog) {
    const atk = myAttackCatalog[id];
    const row = document.createElement('div');
    row.className = 'attackRow' + (selectedAttackId === id ? ' selected' : '');
    const name = document.createElement('div');
    name.className = 'attackName';
    name.textContent = atk.icon + ' ' + atk.name + (atk.kind === 'aoe' ? ' (AoE)' : atk.kind === 'self' ? ' (self)' : atk.kind === 'building' ? ' (pick building)' : '');
    const desc = document.createElement('div');
    desc.className = 'attackDesc';
    desc.textContent = atk.description;
    row.appendChild(name);
    row.appendChild(desc);
    row.addEventListener('click', () => selectAttack(id));
    list.appendChild(row);
  }
}

// Targeted/reveal attacks skip the panel entirely now — picking one closes
// the Attacks panel and arms targeting (see armTargeting() above) so the
// next click in the world picks the target, instead of the old dropdown.
// 'building' still uses the dropdown (Spy Glass targets a building, not an
// entity you can click on); 'self'/'aoe' just need the bare Cast button.
function selectAttack(id) {
  selectedAttackId = id;
  renderAttackList();
  const atk = myAttackCatalog[id];
  document.getElementById('attackErr').textContent = '';
  if (atk.kind === 'targeted' || atk.kind === 'reveal') {
    closeAttackPanel();
    armTargeting('cast_attack', 'attackId', id, atk.name);
    return;
  }
  const select = document.getElementById('attackTargetSelect');
  const label = document.getElementById('attackTargetLabel');
  if (atk.kind === 'building') {
    label.textContent = 'Building';
    select.classList.remove('hidden');
    label.classList.remove('hidden');
    refreshAttackBuildings();
  } else {
    select.classList.add('hidden');
    label.classList.add('hidden');
  }
  document.getElementById('attackTargetPanel').classList.remove('hidden');
}

function refreshAttackBuildings() {
  const select = document.getElementById('attackTargetSelect');
  if (!select || !world) return;
  select.disabled = false;
  select.innerHTML = '';
  for (const b of world.buildings) {
    const opt = document.createElement('option');
    opt.value = b.id; opt.textContent = b.name;
    select.appendChild(opt);
  }
}

const attackCastBtn = document.getElementById('attackCastBtn');
if (attackCastBtn) attackCastBtn.addEventListener('click', () => {
  if (!selectedAttackId || !myAttackCatalog) return;
  const atk = myAttackCatalog[selectedAttackId];
  const err = document.getElementById('attackErr');
  const payload = { type: 'cast_attack', attackId: selectedAttackId };
  if (atk.kind === 'building') {
    const buildingId = document.getElementById('attackTargetSelect').value;
    if (!buildingId) { err.textContent = 'Pick a building first.'; return; }
    payload.buildingId = buildingId;
  }
  err.textContent = '';
  ws.send(JSON.stringify(payload));
  closeAttackPanel();
});

// ---------------------------------------------------------------------------
// Attack hit notification — non-blocking amber-themed banner shown to anyone
// caught in another player's attack. Auto-fades after 8s; also manually
// dismissable. Does NOT pause movement (it's an attack that already hit).
// ---------------------------------------------------------------------------
let attackHitTimer = null;

function showAttackHitNotification(casterName, attackName, detail, effect) {
  const el = document.getElementById('attackHitNotification');
  if (!el) return;
  document.getElementById('attackHitTitle').textContent = `💥 ${casterName}'s ${attackName} hit you`;
  document.getElementById('attackHitDetail').textContent = detail || '';
  // Sleight of Hand just needs a quick heads-up, not something the player
  // has to dismiss themselves — auto-close it fast and hide the button.
  const quick = effect === 'pickpocket';
  document.getElementById('attackHitDismiss').classList.toggle('hidden', quick);
  el.classList.add('show');
  clearTimeout(attackHitTimer);
  attackHitTimer = setTimeout(() => el.classList.remove('show'), quick ? 2000 : 8000);
}

const attackHitDismiss = document.getElementById('attackHitDismiss');
if (attackHitDismiss) attackHitDismiss.addEventListener('click', () => {
  clearTimeout(attackHitTimer);
  const el = document.getElementById('attackHitNotification');
  if (el) el.classList.remove('show');
});

// ---------------------------------------------------------------------------
// Spy Glass live window — Wanderer's spy_glass attack. Non-blocking floating
// panel that stays open for durationMs showing whatever's said in the chosen
// building, seeded with whatever was already in roomChatLogs server-side.
// Auto-closes on spyglass_end (or manual dismiss, which doesn't tell the
// server to stop early — the room notice already fired, so there's nothing
// extra to protect by closing it client-side sooner).
// ---------------------------------------------------------------------------
let spyGlassTimer = null;

function openSpyGlassPanel(buildingName, log, durationMs) {
  const panel = document.getElementById('spyGlassPanel');
  if (!panel) return;
  document.getElementById('spyGlassTitle').textContent = `🔭 Spying on ${buildingName}`;
  const logEl = document.getElementById('spyGlassLog');
  logEl.innerHTML = '';
  for (const e of log) appendSpyGlassLine(e.name, e.color, e.text, e.image);
  panel.classList.remove('hidden');
  clearTimeout(spyGlassTimer);
  spyGlassTimer = setTimeout(closeSpyGlassPanel, durationMs);
}

// Mirrors renderChatLog()'s line markup exactly (same .chatLine/.chatImg
// classes) so a spied-on room's chat looks identical here, images included.
function appendSpyGlassLine(name, color, text, image) {
  const logEl = document.getElementById('spyGlassLog');
  if (!logEl) return;
  const div = document.createElement('div');
  div.className = 'chatLine';
  const b = document.createElement('b');
  b.style.color = color;
  b.textContent = name + ':';
  div.appendChild(b);
  if (text) div.appendChild(document.createTextNode(' ' + text));
  if (image) {
    const img = document.createElement('img');
    img.className = 'chatImg';
    img.src = image;
    img.title = 'Click to view full size';
    img.addEventListener('click', () => window.open(image, '_blank'));
    div.appendChild(img);
  }
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function closeSpyGlassPanel() {
  clearTimeout(spyGlassTimer);
  const panel = document.getElementById('spyGlassPanel');
  if (panel) panel.classList.add('hidden');
}

const spyGlassCloseBtn = document.getElementById('spyGlassCloseBtn');
if (spyGlassCloseBtn) spyGlassCloseBtn.addEventListener('click', closeSpyGlassPanel);

// ---------------------------------------------------------------------------
// Sleight of Hand peek — shows the caster what was in the target's carried
// inventory at cast time (reuses the .itemSlot grid styling from the real
// Inventory panel), with whatever got stolen (if anything) highlighted.
// ---------------------------------------------------------------------------
function openPickpocketPanel(targetName, itemsSeen, stolenItemId) {
  const panel = document.getElementById('pickpocketPanel');
  if (!panel) return;
  document.getElementById('pickpocketTitle').textContent = `🤏 ${targetName}'s Pockets`;
  const grid = document.getElementById('pickpocketGrid');
  grid.innerHTML = '';
  if (itemsSeen.length === 0) {
    const empty = document.createElement('div');
    empty.id = 'pickpocketEmpty';
    empty.textContent = 'Their pockets were empty.';
    grid.appendChild(empty);
  } else {
    for (const item of itemsSeen) {
      const cell = document.createElement('div');
      cell.className = 'itemSlot' + (item.itemId === stolenItemId ? ' stolen' : '');
      const icon = document.createElement('span');
      icon.textContent = item.icon;
      const qty = document.createElement('span');
      qty.className = 'slotQty';
      qty.textContent = String(item.qty);
      cell.appendChild(icon);
      cell.appendChild(qty);
      cell.title = item.name + ' x' + item.qty + (item.itemId === stolenItemId ? ' — stolen!' : '');
      grid.appendChild(cell);
    }
  }
  panel.classList.remove('hidden');
}

function closePickpocketPanel() {
  const panel = document.getElementById('pickpocketPanel');
  if (panel) panel.classList.add('hidden');
}

const pickpocketCloseBtn = document.getElementById('pickpocketCloseBtn');
if (pickpocketCloseBtn) pickpocketCloseBtn.addEventListener('click', closePickpocketPanel);

// ---------------------------------------------------------------------------
// Open 3rd Eye — the per-cast prompt (shown when thirdEyeOptIn is false)
// and the auto-grant path (when it's true, because the player opted in to
// skip asking each time in their own Settings). Even on the auto path a
// brief toast fires after the fact so the player always knows it happened.
// ---------------------------------------------------------------------------

async function autoGrantSpellConsent(requestId, casterName) {
  let image = null;
  try {
    image = await captureSelfiePhoto();
  } catch (e) { /* camera unavailable/denied at OS level — still relay the fizzle */ }
  ws.send(JSON.stringify({ type: 'spell_photo', requestId, image }));
  setUnlockToast(image
    ? `👁️ ${casterName} peered through your eye just now.`
    : `👁️ ${casterName} tried to peer through your eye — camera wasn't available.`
  );
}

let spellConsentOpen = false;
let activeSpellConsent = null; // { requestId }

function openSpellConsentPrompt(requestId, casterName, spellName) {
  activeSpellConsent = { requestId };
  spellConsentOpen = true;
  // Themed framing, but the mechanical disclosure stays explicit and
  // unambiguous on purpose — camera, one photo, sent to a named person —
  // since that clarity is the entire reason this prompt exists.
  document.getElementById('spellConsentText').textContent =
    `${casterName} has turned the Witch's eye toward you, casting ${spellName}. Let it open, and your camera will capture one photo of you right now and send it to ${casterName} as a vision. The choice is yours.`;
  document.getElementById('spellConsentStatus').textContent = '';
  document.getElementById('spellConsentAllowBtn').disabled = false;
  document.getElementById('spellConsentDenyBtn').disabled = false;
  document.getElementById('spellConsentModal').classList.remove('hidden');
}

function closeSpellConsentPrompt() {
  document.getElementById('spellConsentModal').classList.add('hidden');
  spellConsentOpen = false;
  activeSpellConsent = null;
}

function denySpellConsent() {
  if (!activeSpellConsent) return;
  ws.send(JSON.stringify({ type: 'spell_consent_response', requestId: activeSpellConsent.requestId, allow: false }));
  closeSpellConsentPrompt();
}

const spellConsentDenyBtn = document.getElementById('spellConsentDenyBtn');
if (spellConsentDenyBtn) spellConsentDenyBtn.addEventListener('click', denySpellConsent);

const spellConsentAllowBtn = document.getElementById('spellConsentAllowBtn');
if (spellConsentAllowBtn) spellConsentAllowBtn.addEventListener('click', async () => {
  if (!activeSpellConsent) return;
  const requestId = activeSpellConsent.requestId;
  const statusEl = document.getElementById('spellConsentStatus');
  spellConsentAllowBtn.disabled = true;
  spellConsentDenyBtn.disabled = true;
  statusEl.textContent = 'The eye opens…';
  let image = null;
  try {
    image = await captureSelfiePhoto();
    statusEl.textContent = 'The vision is sent.';
  } catch (e) {
    statusEl.textContent = "The eye couldn't open (no camera access) — letting them know it fizzled.";
  }
  ws.send(JSON.stringify({ type: 'spell_photo', requestId, image }));
  setTimeout(closeSpellConsentPrompt, image ? 700 : 1600);
});

// Werewolf's Scent Trail — same consent-first shape as Open 3rd Eye above,
// but for location instead of the camera. Rounds to ~1km precision before
// this ever leaves the device (the server independently re-rounds too, and
// only ever sends a coarse city-level label back to the caster — never raw
// coordinates, never posted anywhere public).
function getRoughLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation not available')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: Math.round(pos.coords.latitude * 100) / 100,
        lon: Math.round(pos.coords.longitude * 100) / 100
      }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

let howlConsentOpen = false;
let activeHowlConsent = null; // { consentId }

function openHowlConsentPrompt(consentId, casterName) {
  activeHowlConsent = { consentId };
  howlConsentOpen = true;
  document.getElementById('howlConsentText').textContent =
    `${casterName} throws back their head and howls at the moon, inviting you to answer the call. Join the howl, and your device's approximate location (nearest city only, never an exact address) is sent privately to ${casterName} — never posted anywhere. The choice is yours.`;
  document.getElementById('howlConsentStatus').textContent = '';
  document.getElementById('howlConsentAllowBtn').disabled = false;
  document.getElementById('howlConsentDenyBtn').disabled = false;
  document.getElementById('howlConsentModal').classList.remove('hidden');
}

function closeHowlConsentPrompt() {
  document.getElementById('howlConsentModal').classList.add('hidden');
  howlConsentOpen = false;
  activeHowlConsent = null;
}

function denyHowlConsent() {
  if (!activeHowlConsent) return;
  ws.send(JSON.stringify({ type: 'howl_consent_response', consentId: activeHowlConsent.consentId, allow: false }));
  closeHowlConsentPrompt();
}

const howlConsentDenyBtn = document.getElementById('howlConsentDenyBtn');
if (howlConsentDenyBtn) howlConsentDenyBtn.addEventListener('click', denyHowlConsent);

const howlConsentAllowBtn = document.getElementById('howlConsentAllowBtn');
if (howlConsentAllowBtn) howlConsentAllowBtn.addEventListener('click', async () => {
  if (!activeHowlConsent) return;
  const consentId = activeHowlConsent.consentId;
  const statusEl = document.getElementById('howlConsentStatus');
  howlConsentAllowBtn.disabled = true;
  howlConsentDenyBtn.disabled = true;
  statusEl.textContent = 'Joining the howl…';
  let loc = null;
  try {
    loc = await getRoughLocation();
    statusEl.textContent = 'Your scent carries on the wind.';
  } catch (e) {
    statusEl.textContent = "Couldn't get your location — letting them know it fizzled.";
  }
  ws.send(JSON.stringify({
    type: 'howl_location_result', consentId,
    lat: loc ? loc.lat : null, lon: loc ? loc.lon : null
  }));
  setTimeout(closeHowlConsentPrompt, loc ? 700 : 1600);
});

// Opens the camera only after the Allow click above, grabs exactly one
// frame, then immediately stops the stream — nothing keeps recording or
// stays connected to the camera once the snapshot is taken.
// Loads the tiny face detector model once and caches it.
let _faceApiReady = false;
async function _ensureFaceApi() {
  if (_faceApiReady) return true;
  if (typeof faceapi === 'undefined') return false;
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    _faceApiReady = true;
    return true;
  } catch { return false; }
}
// Pre-warm the face detection model in the background so the first purchase is fast.
_ensureFaceApi();

// Returns true if a human face is detected in the data URL.
// Uses face-api.js tiny face detector (works in all browsers, no API key needed).
// Falls back to true only if the library itself failed to load.
async function clientFaceCheck(dataUrl) {
  const ready = await _ensureFaceApi();
  if (!ready) return true; // library not loaded — fall through to server check
  try {
    const img = new Image();
    img.src = dataUrl;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }));
    return detections.length > 0;
  } catch { return true; }
}

function captureSelfiePhoto() {
  return new Promise((resolve, reject) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      reject(new Error('Camera not available'));
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then(stream => {
        const video = document.getElementById('spellCaptureVideo');
        video.srcObject = stream;
        const stop = () => { stream.getTracks().forEach(t => t.stop()); video.srcObject = null; };
        video.onloadedmetadata = () => {
          video.play();
          // A short delay so the first (often dark/unfocused) frame isn't
          // what gets captured.
          setTimeout(() => {
            try {
              const w = video.videoWidth || MAX_IMAGE_DIM, h = video.videoHeight || MAX_IMAGE_DIM;
              const size = Math.min(w, h, MAX_IMAGE_DIM);
              const canvas = document.createElement('canvas');
              canvas.width = size; canvas.height = size;
              canvas.getContext('2d').drawImage(video, (w - Math.min(w, h)) / 2, (h - Math.min(w, h)) / 2, Math.min(w, h), Math.min(w, h), 0, 0, size, size);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
              stop();
              resolve(dataUrl);
            } catch (err) {
              stop();
              reject(err);
            }
          }, 250);
        };
      })
      .catch(reject);
  });
}

const roomPassBuyBtn = document.getElementById('roomPassBuyBtn');
if (roomPassBuyBtn) {
  roomPassBuyBtn.addEventListener('click', () => {
    const err = document.getElementById('passModalErr');
    if (!paymentsEnabled) {
      if (err) err.textContent = 'Payments are not set up on this server yet.';
      return;
    }
    roomPassBuyBtn.disabled = true;
    roomPassBuyBtn.textContent = 'Redirecting…';
    fetch('/api/checkout-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: 'arcade' })
    })
      .then(r => r.json())
      .then(data => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          if (err) err.textContent = data.error || 'Could not start checkout.';
          roomPassBuyBtn.disabled = false;
          roomPassBuyBtn.textContent = `Buy Arcade Pass — ${formatPrice(roomPassPriceCents)}`;
        }
      })
      .catch(() => {
        if (err) err.textContent = 'Could not reach the server.';
        roomPassBuyBtn.disabled = false;
        roomPassBuyBtn.textContent = `Buy Arcade Pass — ${formatPrice(roomPassPriceCents)}`;
      });
  });
}

// ---------------------------------------------------------------------------
// Playable arcade cabinets — two simple, fully client-side mini-games
// (Snake, Breakout) opened from a kiosk point (see findNearestKiosk()) with
// `game: 'snake'|'breakout'`. Runs its own requestAnimationFrame loop on a
// 320x320 2D canvas while the modal is open; movement/keys are fully gated
// off elsewhere (arcadeModalOpen) so this can freely use the arrow keys.
// ---------------------------------------------------------------------------
let arcadeModalOpen = false;
let arcadeGameType = null; // 'snake' | 'breakout'
let arcadeRAF = null;
let arcadeCtx = null;
let arcadeLast = 0;
let snakeState = null;
let breakoutState = null;

const ARCADE_GRID = 16, ARCADE_CELL = 20;

function resetSnake() {
  snakeState = {
    cells: [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }],
    dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
    food: { x: 12, y: 8 },
    tickAcc: 0, tickRate: 0.12,
    score: 0, gameOver: false
  };
}

function randomFoodCell(cells) {
  let fx, fy;
  do {
    fx = Math.floor(Math.random() * ARCADE_GRID);
    fy = Math.floor(Math.random() * ARCADE_GRID);
  } while (cells.some(c => c.x === fx && c.y === fy));
  return { x: fx, y: fy };
}

function updateSnake(dt) {
  const s = snakeState;
  if (s.gameOver) return;
  s.tickAcc += dt;
  if (s.tickAcc < s.tickRate) return;
  s.tickAcc = 0;
  s.dir = s.nextDir;
  const head = s.cells[0];
  const nx = head.x + s.dir.x, ny = head.y + s.dir.y;
  if (nx < 0 || nx >= ARCADE_GRID || ny < 0 || ny >= ARCADE_GRID || s.cells.some(c => c.x === nx && c.y === ny)) {
    s.gameOver = true;
    return;
  }
  s.cells.unshift({ x: nx, y: ny });
  if (nx === s.food.x && ny === s.food.y) {
    s.score++;
    s.food = randomFoodCell(s.cells);
  } else {
    s.cells.pop();
  }
}

function drawArcadeOverlay(ctx, lines) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 130, 320, 60);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '14px monospace';
  ctx.fillText(lines[0], 160, 155);
  ctx.fillText(lines[1], 160, 175);
  ctx.textAlign = 'left';
}

function renderSnake(ctx) {
  ctx.fillStyle = '#0a160c'; ctx.fillRect(0, 0, 320, 320);
  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(snakeState.food.x * ARCADE_CELL, snakeState.food.y * ARCADE_CELL, ARCADE_CELL - 1, ARCADE_CELL - 1);
  ctx.fillStyle = '#5ee37d';
  for (const c of snakeState.cells) ctx.fillRect(c.x * ARCADE_CELL, c.y * ARCADE_CELL, ARCADE_CELL - 1, ARCADE_CELL - 1);
  ctx.fillStyle = '#eafff0'; ctx.font = '14px monospace';
  ctx.fillText('Score: ' + snakeState.score, 8, 16);
  if (snakeState.gameOver) drawArcadeOverlay(ctx, ['Game Over — Score ' + snakeState.score, 'Press Space to retry']);
}

function resetBreakout() {
  const bricks = [];
  const rows = 5, cols = 10, bw = 30, bh = 12, gap = 2, top = 30;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({ x: c * (bw + gap) + 5, y: top + r * (bh + gap), w: bw, h: bh, alive: true });
    }
  }
  breakoutState = {
    paddleX: 140, paddleW: 50, paddleY: 300,
    ballX: 160, ballY: 290, ballVX: 90, ballVY: -140,
    bricks, score: 0, gameOver: false, won: false,
    leftHeld: false, rightHeld: false
  };
}

function updateBreakout(dt) {
  const s = breakoutState;
  if (s.gameOver || s.won) return;
  const speed = 220;
  if (s.leftHeld) s.paddleX -= speed * dt;
  if (s.rightHeld) s.paddleX += speed * dt;
  s.paddleX = Math.max(0, Math.min(320 - s.paddleW, s.paddleX));
  s.ballX += s.ballVX * dt; s.ballY += s.ballVY * dt;
  if (s.ballX < 4 || s.ballX > 316) s.ballVX *= -1;
  if (s.ballY < 4) s.ballVY *= -1;
  if (s.ballY > 320) { s.gameOver = true; return; }
  if (s.ballY > 290 && s.ballY < 300 && s.ballX > s.paddleX && s.ballX < s.paddleX + s.paddleW && s.ballVY > 0) {
    s.ballVY *= -1;
    const hitFrac = (s.ballX - (s.paddleX + s.paddleW / 2)) / (s.paddleW / 2);
    s.ballVX = hitFrac * 180;
  }
  for (const b of s.bricks) {
    if (!b.alive) continue;
    if (s.ballX > b.x && s.ballX < b.x + b.w && s.ballY > b.y && s.ballY < b.y + b.h) {
      b.alive = false; s.score++; s.ballVY *= -1; break;
    }
  }
  if (s.bricks.every(b => !b.alive)) s.won = true;
}

function renderBreakout(ctx) {
  const s = breakoutState;
  ctx.fillStyle = '#10101c'; ctx.fillRect(0, 0, 320, 320);
  ctx.fillStyle = '#7ad9ff';
  for (const b of s.bricks) if (b.alive) ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = '#ffd27a'; ctx.fillRect(s.paddleX, s.paddleY, s.paddleW, 8);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.ballX, s.ballY, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eafff0'; ctx.font = '14px monospace';
  ctx.fillText('Score: ' + s.score, 8, 16);
  if (s.gameOver || s.won) {
    drawArcadeOverlay(ctx, [s.won ? 'You win! Score ' + s.score : 'Game Over — Score ' + s.score, 'Press Space to retry']);
  }
}

function resetArcadeGame(type) {
  if (type === 'snake') resetSnake(); else resetBreakout();
}

function arcadeLoop(now) {
  if (!arcadeModalOpen) return;
  const dt = Math.min(0.05, (now - arcadeLast) / 1000);
  arcadeLast = now;
  if (arcadeGameType === 'snake') { updateSnake(dt); renderSnake(arcadeCtx); }
  else { updateBreakout(dt); renderBreakout(arcadeCtx); }
  arcadeRAF = requestAnimationFrame(arcadeLoop);
}

function openArcadeGame(type) {
  arcadeGameType = type;
  arcadeModalOpen = true;
  resetArcadeGame(type);
  document.getElementById('arcadeTitle').textContent = type === 'snake' ? '🐍 Snake' : '🧱 Breakout';
  document.getElementById('arcadeModal').classList.remove('hidden');
  arcadeCtx = document.getElementById('arcadeCanvas').getContext('2d');
  arcadeLast = performance.now();
  arcadeRAF = requestAnimationFrame(arcadeLoop);
}

function closeArcadeGame() {
  if (!arcadeModalOpen) return;
  arcadeModalOpen = false;
  if (arcadeRAF) cancelAnimationFrame(arcadeRAF);
  document.getElementById('arcadeModal').classList.add('hidden');
}

const arcadeCloseBtn = document.getElementById('arcadeCloseBtn');
if (arcadeCloseBtn) arcadeCloseBtn.addEventListener('click', closeArcadeGame);

window.addEventListener('keydown', (e) => {
  if (!arcadeModalOpen) return;
  if (e.key === 'Escape' && !e.repeat) { closeArcadeGame(); return; }
  if (arcadeGameType === 'snake') {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') snakeState.nextDir = { x: 0, y: -1 };
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') snakeState.nextDir = { x: 0, y: 1 };
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') snakeState.nextDir = { x: -1, y: 0 };
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') snakeState.nextDir = { x: 1, y: 0 };
    else if (snakeState.gameOver && (e.key === ' ' || e.key === 'Enter')) resetArcadeGame('snake');
  } else if (arcadeGameType === 'breakout') {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') breakoutState.leftHeld = true;
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') breakoutState.rightHeld = true;
    else if ((breakoutState.gameOver || breakoutState.won) && (e.key === ' ' || e.key === 'Enter')) resetArcadeGame('breakout');
  }
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  if (!arcadeModalOpen || arcadeGameType !== 'breakout' || !breakoutState) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') breakoutState.leftHeld = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') breakoutState.rightHeld = false;
});

function sitDown(seat) {
  const b = world.buildings.find(bb => bb.id === indoorBuildingId);
  seatedAt = seat;
  me.x = b.x + seat.x / INDOOR_SCALE;
  me.y = b.y + seat.z / INDOOR_SCALE;
  me.facing = seat.facing;
}

function standUp() {
  seatedAt = null;
}

// The on-screen interact prompt is a real tap target (not just decorative
// text) specifically so mobile players — who have no F key — have some way
// to reach the bank teller/auctioneer/wire clerk and every other kiosk.
// touchstart fires the action and prevents the default so a phantom click
// doesn't also fire a moment later.
const interactHintEl = document.getElementById('interactHint');
if (interactHintEl) {
  interactHintEl.addEventListener('touchstart', (e) => { e.preventDefault(); tryInteract(); }, { passive: false });
  interactHintEl.addEventListener('click', tryInteract);
}

function tryInteract() {
  if (!me) return;
  if (seatedAt) { standUp(); return; }
  const seat = findNearestSeat(); // null outdoors (currentInterior is null), so this is a no-op there
  if (seat) {
    if (seatIsOccupied(seat)) { setUnlockToast('That seat is taken.'); return; }
    sitDown(seat);
    return;
  }
  // Cave: zone-based — no kiosk distance needed
  if (me.room === 'witch_cave') {
    if (me.y < 300) { ws.send(JSON.stringify({ type: 'witch_talk' })); return; }
    exitWitchCave();
    return;
  }
  const kiosk = findNearestKiosk();
  if (kiosk && kiosk.game) { openArcadeGame(kiosk.game); return; }
  if (kiosk && kiosk.npc === 'teller') { openBankModal(); return; }
  if (kiosk && kiosk.npc === 'auctioneer') { openAuctionModal(); return; }
  if (kiosk && kiosk.npc === 'courier') { openSendMoneyModal(); return; }
  if (kiosk && kiosk.portal === 'wilds') { enterWilds(); return; }
  if (kiosk && kiosk.portal === 'town') { exitWilds(); return; }
  if (kiosk && kiosk.portal === 'dungeon_exit') { exitDungeon(); return; }
  if (kiosk && kiosk.portal === 'cave_enter') { enterWitchCave(); return; }
  if (kiosk && kiosk.portal === 'cave_exit') { exitWitchCave(); return; }
  if (kiosk && kiosk.witch === 'hazel') { ws.send(JSON.stringify({ type: 'witch_talk' })); return; }
  if (kiosk && kiosk.npc === 'npc') { openNpcShopModal(kiosk.npcId); return; }
  if (kiosk && kiosk.npc === 'quest') { openQuestDialogue(kiosk.npcId, kiosk.npcName); return; }
  if (kiosk && kiosk.npc === 'wolf_pact') { openBloodPactModal(); return; }
  if (PAYWALLS_ENABLED && kiosk && kiosk.id === 'town_pass') { openPassModal(); }
}

// The hint doubles as a tap target on touch devices — see the
// touchstart/click listeners below — since there's no F key to press on a
// phone. Walking up to a kiosk/seat/NPC is still required either way; this
// just gives touch players a physical-feeling button to tap once they have.
function interactVerb() {
  return isTouchDevice() ? 'Tap to' : 'Press F to';
}

function updateInteractHint() {
  const hint = document.getElementById('interactHint');
  if (!hint) return;
  if (!me || passModalOpen || arcadeModalOpen || bankModalOpen || auctionModalOpen || sendMoneyModalOpen || spellConsentOpen || howlConsentOpen || npcShopOpen || witchShopOpen || witchConsentOpen || bloodPactOpen) { hint.classList.add('hidden'); return; }
  if (seatedAt) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} stand`;
    return;
  }
  const seat = findNearestSeat();
  if (seat && !seatIsOccupied(seat)) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} sit`;
    return;
  }
  // Cave interactions bypass the kiosk distance system — zone-based on y position
  if (me.room === 'witch_cave') {
    if (me.y < 300) {
      hint.classList.remove('hidden');
      document.getElementById('interactHintText').textContent = `${interactVerb()} speak with Witch Hazel`;
    } else if (me.y > 560) {
      hint.classList.remove('hidden');
      document.getElementById('interactHintText').textContent = `${interactVerb()} leave the cave`;
    } else {
      hint.classList.add('hidden');
    }
    return;
  }
  const kiosk = findNearestKiosk();
  if (kiosk && kiosk.game) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} play ` + (kiosk.game === 'snake' ? 'Snake' : 'Breakout');
    return;
  }
  if (kiosk && kiosk.npc === 'teller') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} open your bank account`;
    return;
  }
  if (kiosk && kiosk.npc === 'auctioneer') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} visit the auction house`;
    return;
  }
  if (kiosk && kiosk.npc === 'courier') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} send money to another player`;
    return;
  }
  if (kiosk && kiosk.portal === 'wilds') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} step through the portal to the Wilds`;
    return;
  }
  if (kiosk && kiosk.portal === 'town') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} step through the portal back to town`;
    return;
  }
  if (kiosk && kiosk.portal === 'dungeon_exit') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} exit the dungeon`;
    return;
  }
  if (kiosk && kiosk.portal === 'cave_enter') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} enter the Witch's Cave`;
    return;
  }
  if (kiosk && kiosk.portal === 'cave_exit') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} leave the cave`;
    return;
  }
  if (kiosk && kiosk.witch === 'hazel') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} speak with Witch Hazel`;
    return;
  }
  if (kiosk && kiosk.npc === 'npc') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} browse the shop`;
    return;
  }
  if (kiosk && kiosk.npc === 'quest') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} talk to ${kiosk.npcName}`;
    return;
  }
  if (kiosk && kiosk.npc === 'wolf_pact') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} speak with Lexton Greyfur`;
    return;
  }
  if (PAYWALLS_ENABLED && kiosk && kiosk.id === 'town_pass') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} view Town Pass`;
    return;
  }
  hint.classList.add('hidden');
}

window.addEventListener('keydown', (e) => {
  if (typing) return;
  if (passModalOpen) {
    if (e.key === 'Escape' && !e.repeat) closePassModal();
    return;
  }
  if (bankModalOpen) {
    if (e.key === 'Escape' && !e.repeat) closeBankModal();
    return;
  }
  if (auctionModalOpen) {
    if (e.key === 'Escape' && !e.repeat) closeAuctionModal();
    return;
  }
  if (sendMoneyModalOpen) {
    if (e.key === 'Escape' && !e.repeat) closeSendMoneyModal();
    return;
  }
  if (spellbookOpen) {
    if (e.key === 'Escape' && !e.repeat) closeSpellbook();
    return;
  }
  if (spellConsentOpen) {
    if (e.key === 'Escape' && !e.repeat) denySpellConsent();
    return;
  }
  if (howlConsentOpen) {
    if (e.key === 'Escape' && !e.repeat) denyHowlConsent();
    return;
  }
  if (attackPanelOpen) {
    if (e.key === 'Escape' && !e.repeat) closeAttackPanel();
    return;
  }
  if (bloodPactOpen) {
    if (e.key === 'Escape' && !e.repeat) closeBloodPactModal();
    return;
  }
  if (npcShopOpen) {
    if (e.key === 'Escape' && !e.repeat) closeNpcShopModal();
    return;
  }
  if (witchConsentOpen) {
    if (e.key === 'Escape' && !e.repeat) {
      ws.send(JSON.stringify({ type: 'witch_selfie_payment', consentId: activeWitchConsentId, image: null }));
      closeWitchSelfieConsent();
    }
    return;
  }
  if (witchShopOpen) {
    if (e.key === 'Escape' && !e.repeat) closeWitchModal();
    return;
  }
  if (arcadeModalOpen) return; // the dedicated arcade-game keydown listener owns Escape/controls while playing
  if (inventoryOpen && e.key === 'Escape' && !e.repeat) { toggleInventory(); return; }
  if (armedTarget && e.key === 'Escape' && !e.repeat) { cancelTargeting(); return; }
  // R = quick-strike nearest enemy
  if ((e.key === 'r' || e.key === 'R') && !e.repeat && !armedTarget) { strikeNearestEnemy(); return; }
  if (myActionCatalog && !e.repeat) {
    const slot = HOTBAR_KEYS.indexOf(e.key);
    if (slot !== -1) {
      const id = Object.keys(myActionCatalog)[slot];
      if (id) { castFromHotbar(id); return; }
    }
  }
  if ((e.key === 'f' || e.key === 'F') && !e.repeat) {
    tryInteract();
  }
  if (e.key === 'Escape' && !e.repeat) {
    leaveCurrentBuilding();
  }
});

// ---------------------------------------------------------------------------
// Entering / leaving a building
// ---------------------------------------------------------------------------
function enterBuilding(roomId) {
  const interior = getInteriorScene(roomId);
  mode = 'indoor';
  indoorBuildingId = roomId;
  me.room = roomId;
  // Whatever direction you were looking outside (especially up/down, which
  // doesn't auto-reset on movement like the left/right orbit does) carries
  // no useful meaning indoors — start every room facing level and centered
  // behind the character.
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(interior.scene, interior.camera, interior);
  maybeUpdateRoomUI(roomId);
  if (roomId === FREE_BUILDING_ID) startMusic(); else stopMusic();
  const leaveBtn = document.getElementById('leaveBtn');
  if (leaveBtn) leaveBtn.classList.remove('hidden');
}

function exitBuilding(b) {
  mode = 'outdoor';
  indoorBuildingId = null;
  // Same reasoning as enterBuilding(): don't let a leftover look-angle from
  // inside make it confusing to see/walk back toward the door you just left.
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  const side = getDoorSide(b);
  // nudge just outside the door (whichever wall it's on) so they don't
  // immediately re-enter
  if (side === 'east') { me.x = b.x + b.w + 26; me.y = b.y + b.h / 2; }
  else if (side === 'west') { me.x = b.x - 26; me.y = b.y + b.h / 2; }
  else if (side === 'north') { me.x = b.x + b.w / 2; me.y = b.y - 26; }
  else { me.x = b.x + b.w / 2; me.y = b.y + b.h + 26; }
  me.room = 'outside';
  stopMusic();
  clearPendingImage();
  closeArcadeGame();
  // tell the server so it can wipe our messages from this room's chat for
  // everyone — leaving a building clears what we said in there.
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'leave_room', room: b.id }));
  }
  setActiveContext(outdoorScene, outdoorCamera, null);
  maybeUpdateRoomUI('outside');
  const leaveBtn = document.getElementById('leaveBtn');
  if (leaveBtn) leaveBtn.classList.add('hidden');
}

// Explicit "leave" action — a button/keypress that always works, regardless
// of where the player is standing or whether they're seated. Backstop for
// the walk-through-the-door exit, which can be easy to miss/get stuck near.
function leaveCurrentBuilding() {
  if (mode !== 'indoor' || !indoorBuildingId) return;
  const b = world.buildings.find(bb => bb.id === indoorBuildingId);
  if (!b) return;
  if (seatedAt) standUp();
  exitBuilding(b);
}

const leaveBtn = document.getElementById('leaveBtn');
if (leaveBtn) leaveBtn.addEventListener('click', leaveCurrentBuilding);

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now();
let moveSendTimer = 0;
const SPEED = 230;       // world units/sec, forward/back
const TURN_SPEED = 3.0;  // radians/sec

function updateOutdoor(stepX, stepY) {
  const nx = me.x + stepX, ny = me.y + stepY;

  // The Wilds has no buildings/locked rooms to detect — just move, clamp
  // to its (much smaller) bounds, and stay in room 'wilds'. Letting this
  // fall through to the town's door/lock logic below would, at best, do
  // nothing useful (world.buildings is empty there) and at worst stomp
  // me.room back to 'outside' every frame via the unconditional set at the
  // bottom of the town path.
  if (world === world2 || world === DUNGEON_WORLD || world === CAVE_WORLD || me.room === 'witch_cave') {
    if (!collides(nx, me.y)) me.x = nx;
    if (!collides(me.x, ny)) me.y = ny;
    const boundsW = (world === CAVE_WORLD || me.room === 'witch_cave') ? CAVE_WORLD.width : world.width;
    const boundsH = (world === CAVE_WORLD || me.room === 'witch_cave') ? CAVE_WORLD.height : world.height;
    me.x = Math.max(PLAYER_R, Math.min(boundsW - PLAYER_R, me.x));
    me.y = Math.max(PLAYER_R, Math.min(boundsH - PLAYER_R, me.y));
    if (world === CAVE_WORLD || me.room === 'witch_cave') { me.room = 'witch_cave'; }
    else if (world !== DUNGEON_WORLD) { me.room = 'wilds'; }
    maybeUpdateRoomUI(me.room);
    return;
  }

  const blockedX = isLockedRoom(roomAt(nx, me.y));
  const blockedY = isLockedRoom(roomAt(me.x, ny));
  if (blockedX) { showLockMessage(); } else if (!collides(nx, me.y)) { me.x = nx; }
  if (blockedY) { showLockMessage(); } else if (!collides(me.x, ny)) { me.y = ny; }

  me.x = Math.max(PLAYER_R, Math.min(world.width - PLAYER_R, me.x));
  me.y = Math.max(PLAYER_R, Math.min(world.height - PLAYER_R, me.y));

  const room = roomAt(me.x, me.y);
  if (room !== 'outside' && !isLockedRoom(room)) {
    enterBuilding(room);
    return;
  }
  me.room = 'outside';
  maybeUpdateRoomUI('outside');
}

function updateIndoor(stepX, stepY) {
  const b = world.buildings.find(bb => bb.id === indoorBuildingId);
  const interior = currentInterior;
  const side = getDoorSide(b);

  let localX = me.x - b.x, localY = me.y - b.y;
  const nx = localX + stepX, ny = localY + stepY;

  if (!collidesIndoor(nx, localY, interior.wallsLocal)) localX = nx;
  if (!collidesIndoor(localX, ny, interior.wallsLocal)) localY = ny;

  // Walking through the door gap (whichever wall it's on, local space) exits
  // the building. Uses the interior's own local bounds (which may be larger
  // than the building's literal outdoor footprint, see
  // INTERIOR_SIZE_OVERRIDES), not b.w/b.h directly.
  const localDoorStart = interior.doorStart / INDOOR_SCALE;
  const localDoorEnd = interior.doorEnd / INDOOR_SCALE;
  let exiting;
  if (side === 'east') {
    exiting = localX > interior.localW - PLAYER_R * 0.4 && localY > localDoorStart && localY < localDoorEnd;
  } else if (side === 'west') {
    exiting = localX < PLAYER_R * 0.4 && localY > localDoorStart && localY < localDoorEnd;
  } else if (side === 'north') {
    exiting = localY < PLAYER_R * 0.4 && localX > localDoorStart && localX < localDoorEnd;
  } else {
    exiting = localY > interior.localH - PLAYER_R * 0.4 && localX > localDoorStart && localX < localDoorEnd;
  }
  if (exiting) {
    exitBuilding(b);
    return;
  }

  localX = Math.max(PLAYER_R, Math.min(interior.localW - PLAYER_R, localX));
  localY = Math.max(PLAYER_R, Math.min(interior.localH - PLAYER_R, localY));
  me.x = b.x + localX;
  me.y = b.y + localY;
}

function update(dt) {
  if (!me) return;

  // Relative controls: W/up = walk forward in whatever direction you're
  // currently facing, S/down = walk backward, A/D or left/right = turn in
  // place, Q/E = strafe sideways without turning. Nothing here is bound to
  // map axes — "forward" always means "the way the character is currently
  // pointed." Identical indoors and out.
  let moveInput = 0, turnInput = 0, strafeInput = 0;
  if (!typing && !seatedAt && !passModalOpen && !arcadeModalOpen && !bankModalOpen && !auctionModalOpen && !sendMoneyModalOpen && !spellConsentOpen) {
    if (keys.up) moveInput += 1;
    if (keys.down) moveInput -= 1;
    if (keys.left) turnInput += 1;
    if (keys.right) turnInput -= 1;
    if (keys.strafeRight) strafeInput += 1;
    if (keys.strafeLeft) strafeInput -= 1;
    if (joyVec.x || joyVec.y) {
      moveInput += -joyVec.y; // push stick up = walk forward
      turnInput -= joyVec.x;  // push stick right = turn right (was inverted)
    }
  }
  moveInput = Math.max(-1, Math.min(1, moveInput));
  turnInput = Math.max(-1, Math.min(1, turnInput));
  strafeInput = Math.max(-1, Math.min(1, strafeInput));

  // The instant the player actually moves or turns, snap any mouse-drag
  // camera orbit back to normal (directly behind the character) — otherwise
  // "forward" on screen and "forward" for the character can point two
  // different ways, which is exactly the confusing case being avoided here.
  if (moveInput !== 0 || turnInput !== 0 || strafeInput !== 0) cameraYawOffset = 0;

  me.facing += turnInput * TURN_SPEED * dt;
  const fx = Math.sin(me.facing), fy = Math.cos(me.facing);
  const rx = Math.cos(me.facing), ry = -Math.sin(me.facing); // perpendicular "right" vector
  // Indoors is cramped and decorated with furniture underfoot, so movement
  // is throttled slightly compared to the open town square. Stumble Hex is
  // self-enforced client-side like everything else movement-related in
  // this game — there's no server-side anti-cheat anywhere to back it up.
  let speed = mode === 'indoor' ? SPEED * 0.9 : SPEED;
  if (me.activeStatus && me.activeStatus.type === 'stumble') speed *= 0.5;
  if (me.activeStatus && me.activeStatus.type === 'speedboost') speed *= 2;
  if (me.activeStatus && me.activeStatus.type === 'wolfpact') speed *= 2;
  const stepX = (fx * moveInput + rx * strafeInput) * speed * dt;
  const stepY = (fy * moveInput + ry * strafeInput) * speed * dt;

  if (jumpActive) {
    jumpT += dt;
    if (jumpT >= JUMP_DURATION) { jumpActive = false; jumpT = 0; }
  }

  // Runs regardless of indoor/outdoor so the lighting is already correct
  // the instant anyone steps back outside, not just for players currently
  // out there to see it change. Wildlife visuals interpolate unconditionally
  // too, same reasoning as remote players just below.
  updateDayNightCycle();
  updateAnimalVisuals(dt);
  updateMobVisuals(dt);
  updateAnimal2Visuals(dt);
  updateMob2Visuals(dt);
  updateVillageNpcVisuals(dt);
  updateDungeonMobVisuals(dt);
  updatePortals(dt);

  if (mode === 'outdoor') {
    updateOutdoor(stepX, stepY);
  } else {
    updateIndoor(stepX, stepY);
  }

  // interpolate remote players toward their latest known position
  for (const id in players) {
    if (id === myId) continue;
    const p = players[id];
    const f = 1 - Math.exp(-dt * 10);
    p.x += ((p.targetX ?? p.x) - p.x) * f;
    p.y += ((p.targetY ?? p.y) - p.y) * f;
  }

  syncVisuals(dt);
  updateStatusVisuals(dt);
  updateWerewolfNpc(dt);
  updateCamera(dt);
  updateInteractHint();

  moveSendTimer -= dt;
  if (moveSendTimer <= 0) {
    moveSendTimer = 0.05;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'move', x: me.x, y: me.y, room: me.room }));
    }
  }

  document.getElementById('peopleCount').textContent = Object.keys(players).length;
}

function render() {
  if (!me || !world || !renderer || !activeScene || !activeCamera) return;
  renderer.render(activeScene, activeCamera);
  syncLabels();
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

})();
