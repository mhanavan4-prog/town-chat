(function () {
"use strict";

const canvas = document.getElementById('game');
let W = 0, H = 0;
function resize(){
  W = window.innerWidth; H = window.innerHeight;
  if (renderer) renderer.setSize(W, H);
  if (window.__gfxResize) window.__gfxResize(W, H); // set once GFX exists (TDZ-safe)
  if (activeCamera) {
    activeCamera.aspect = W / H;
    activeCamera.updateProjectionMatrix();
  }
  // Rotating a phone moves "the lower-left corner" — the resting joystick
  // hint is anchored to it, so re-anchor (unless a thumb is mid-drag,
  // where moving the ring under the finger would be worse).
  if (typeof MOBILE_UI !== 'undefined' && MOBILE_UI && typeof joyActive !== 'undefined' && !joyActive && typeof restJoystick === 'function') {
    restJoystick();
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
// Live resume token — arrives in every init. If the socket dies (phone
// screen off, network blip), the reconnect presents it and the server
// rebuilds this exact character in place. Mirrored to sessionStorage so
// even a killed-and-restored tab can resume (see maybeAutoResume()).
let liveResumeToken = null;

let myId = null;
let world = null;       // whichever outdoor map is currently active (town's world, or world2) — see enterWilds()/exitWilds()
let TOWN_WORLD = null;  // stable reference to the town's world object, since `world` gets reassigned on map-switch
let world2 = null;      // The Wilds — see buildWildsScene()/enterWilds()
let TOWN_WALLS = [];    // snapshot of `walls` once initScene() finishes building the town (incl. tree colliders)
const WILDS_WALLS = []; // populated by buildWildsScene's addNatureDecor call (trees + chunky props)
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

// ═══════════════════════════════════════════════════════════════════════════
// TIER-3 UPGRADE (Session F) — KayKit asset pipeline.
// Characters: KayKit "Adventurers" (CC0, Kay Lousberg, kaylousberg.com);
// buildings: KayKit Medieval Hexagon Pack; decor: KayKit Halloween Bits.
// Assets preload from /kk at page load; join waits briefly for them, and
// anything that fails to load falls back to the classic procedural builders.
// ═══════════════════════════════════════════════════════════════════════════
const KK = (() => {
  const MANIFEST = {
    char0: 'kk/Mage.glb',           // Witch
    char1: 'kk/Barbarian.glb',      // Werewolf
    char2: 'kk/Rogue_Hooded.glb',   // Mystic
    char3: 'kk/Knight.glb',         // Knight
    char4: 'kk/Rogue.glb',          // Wanderer
    bld_cafe:    'kk/bld/building_tavern_red.gltf',
    bld_library: 'kk/bld/building_church_blue.gltf',
    bld_arcade:  'kk/bld/building_home_B_yellow.gltf',
    bld_lounge:  'kk/bld/building_tower_A_green.gltf',
    bld_hall:    'kk/bld/building_castle_red.gltf',
    bld_bank:    'kk/bld/building_church_yellow.gltf',
    prop_bench:    'kk/props/bench_decorated.gltf',
    prop_lamppost: 'kk/props/post_lantern.gltf',
    prop_well:     'kk/bld/building_well_blue.gltf',
    prop_fence:    'kk/props/fence.gltf',
    prop_grave_a:  'kk/props/grave_A.gltf',
    prop_grave_b:  'kk/props/gravestone.gltf',
    prop_crypt:    'kk/props/crypt.gltf',
    prop_pumpkin:  'kk/props/pumpkin_orange_jackolantern.gltf',
    prop_pumpkin2: 'kk/props/pumpkin_orange.gltf',
    prop_shrine:   'kk/props/shrine_candles.gltf',
    prop_deadtree: 'kk/props/tree_dead_large.gltf',
    prop_deadtree2:'kk/props/tree_dead_medium.gltf',
    prop_arch:     'kk/props/arch_gate.gltf'
  };
  // Embedded hand-prop meshes present in the character GLBs; anything in
  // this list is hidden unless the class KEEP list names it.
  const PROP_MESHES = ['Spellbook','Spellbook_open','1H_Wand','2H_Staff','1H_Axe','1H_Axe_Offhand','2H_Axe','Mug',
    'Barbarian_Round_Shield','Knife','Knife_Offhand','1H_Crossbow','2H_Crossbow','Throwable',
    '1H_Sword','1H_Sword_Offhand','2H_Sword','Badge_Shield','Round_Shield','Rectangle_Shield','Spike_Shield'];
  const KEEP = {
    0: ['Mage_Hat', 'Mage_Cape', '2H_Staff'],
    1: ['Barbarian_Hat', 'Barbarian_Cape'],
    2: ['Rogue_Cape'],
    3: ['Knight_Helmet', 'Knight_Cape', '1H_Sword', 'Badge_Shield'],
    4: ['Rogue_Cape', 'Knife']
  };
  const WEAPONISH = ['2H_Staff', '1H_Sword', 'Badge_Shield', 'Knife'];

  const models = {};   // key → {scene, animations, size:{x,y,z}}
  const mixers = new Set();
  let pending = 0, settled = false, resolveReady;
  const promise = new Promise(res => { resolveReady = res; });

  function load() {
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) { settled = true; resolveReady(); return; }
    const loader = new THREE.GLTFLoader();
    const keys = Object.keys(MANIFEST);
    pending = keys.length;
    for (const key of keys) {
      loader.load(MANIFEST[key], (gltf) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        models[key] = { scene: gltf.scene, animations: gltf.animations || [],
          size: { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z },
          minY: box.min.y };
        if (--pending === 0) { settled = true; resolveReady(); }
      }, undefined, () => {
        console.warn('KK asset failed, using fallback:', key);
        if (--pending === 0) { settled = true; resolveReady(); }
      });
    }
  }

  function has(key) { return !!models[key]; }
  function charKey(charId) { return 'char' + charId; }
  function charReady(charId) { return settled && !!models[charKey(charId)]; }

  // Static (non-skinned) instance scaled so its LARGEST footprint side
  // equals targetSize ('fit') or its height equals targetSize ('height').
  function staticInstance(key, targetSize, mode) {
    const t = models[key];
    if (!t) return null;
    const inst = t.scene.clone(true);
    const native = mode === 'height' ? t.size.y : Math.max(t.size.x, t.size.z);
    const s = targetSize / Math.max(0.001, native);
    const g = new THREE.Group();
    inst.scale.setScalar(s);
    inst.position.y = -t.minY * s;
    g.add(inst);
    g.userData.kkHeight = t.size.y * s;
    return g;
  }

  return { MANIFEST, PROP_MESHES, KEEP, WEAPONISH, models, mixers, load, has, charKey, charReady, staticInstance,
    get settled() { return settled; }, promise,
    tick(dt) { for (const m of mixers) m.update(dt); } };
})();
KK.load();

// Must stay in sync with ITEM_CATALOG in server.js — the server is the
// source of truth for which itemIds are valid and equippable as what,
// this just supplies the icon/name/slot to render and to decide which
// "Equip as..." buttons to show for a given item.
const ITEM_CATALOG = {
  iron_sword:     { name: 'Iron Sword',     icon: '⚔️', slot: 'weapon', atk: 12, desc: "Plain, honest iron — the one metal the fae won't argue with." },
  spell_tome:     { name: 'Spell Tome',     icon: '📕', slot: 'weapon', atk: 10, desc: 'Third printing. The margins keep annotating themselves.' },
  steel_shield:   { name: 'Steel Shield',   icon: '🛡️', slot: 'chest',  def: 10, desc: 'Dented twice. Both owners buried with honors.' },
  wizard_hat:     { name: 'Wizard Hat',     icon: '🎩', slot: 'head',   def: 5,  desc: 'Points at the moon whether you mean it to or not.' },
  leather_boots:  { name: 'Leather Boots',  icon: '👢', slot: 'feet',   def: 4,  spd: 5,  desc: 'Broken in by somebody who always got away.' },
  silver_ring:    { name: 'Silver Ring',    icon: '💍', slot: 'ring',   def: 3,  desc: 'Plain silver — werewolves pretend not to mind it.' },
  healing_potion: { name: 'Healing Potion', icon: '🧪', slot: null, desc: 'Tastes of rosemary and regret. Restores 30 HP.' },
  magic_scroll:   { name: 'Magic Scroll',   icon: '📜', slot: null, desc: 'Sealed with wax that remembers who touched it.' },
  dragon_scale:   { name: 'Dragon Scale',   icon: '🐉', slot: null, desc: 'Still warm. Nobody asks where Hazel got it.' },
  enchanted_gem:  { name: 'Enchanted Gem',  icon: '💎', slot: null, desc: 'Hums a note only cats can hear.' },
  ancient_coin:   { name: 'Ancient Coin',   icon: '🪙', slot: null, desc: 'Minted for a kingdom the maps gave up on.' },
  golden_chalice: { name: 'Golden Chalice', icon: '🏆', slot: null, desc: 'Ceremonial. Do NOT drink what appears in it at midnight.' },
  hard_drive:     { name: 'Hard Drive',     icon: '💽', slot: null, desc: 'A box of trapped whispers — holds 24 notes, warded by password.' },
  wood:           { name: 'Holly Wood',     icon: '🪵', slot: null, desc: 'A heartwood cutting from the town trees. Five bind into a wand — the old way.' },
  holly_wand:     { name: 'Holly Wand',     icon: '🎇', slot: 'weapon', desc: 'Five holly hearts bound with moonthread. It remembers starlight, and shares it after dark.' },
  bloodmoon_shard:   { name: 'Bloodmoon Shard',   icon: '🩸', slot: null, desc: 'A splinter of red night, still warm. They only fall while the Blood Moon watches — five will bind a circlet.' },
  bloodmoon_circlet: { name: 'Bloodmoon Circlet', icon: '🔻', slot: 'head', desc: 'Five shards fused on a Blood Moon night. It beats faintly, like a second pulse. Proof you stood outside when the sky went red.' },
  berries:        { name: 'Berries',        icon: '🍓', slot: null, desc: 'Picked by moonlight. Probably edible. Probably.' },
  flower_bloom:   { name: 'Flower',         icon: '🌸', slot: null, desc: 'It turns to face you when you look away.' },
  // Character starter sets
  witch_robe:     { name: "Witch's Robe",   icon: '👘', slot: 'chest', def: 6,  desc: 'Woven at new moon; the hem drinks the light.' },
  hexed_boots:    { name: 'Hexed Boots',    icon: '🌒', slot: 'feet',  def: 5,  desc: 'Cursed to never wear out — the cobbler wants them back.' },
  hex_amulet:     { name: 'Hex Amulet',     icon: '🔮', slot: 'ring',  def: 4,  desc: "Warm when a hex is near. Warmer when it's yours." },
  beast_crown:    { name: 'Beast Crown',    icon: '👑', slot: 'head',  def: 6,  desc: 'A thorned crown that fits better on the wilder nights.' },
  beast_hide:     { name: 'Beast Hide',     icon: '🦬', slot: 'chest', def: 8,  desc: 'Shaggy, storm-smelling, stubborn as its first owner.' },
  paw_boots:      { name: 'Paw Boots',      icon: '🐾', slot: 'feet',  def: 6,  spd: 8, desc: "The prints they leave aren't quite yours." },
  spirit_veil:    { name: 'Spirit Veil',    icon: '🌠', slot: 'head',  def: 5,  desc: 'Woven from starlight the night sky misplaced.' },
  spirit_robe:    { name: 'Spirit Robe',    icon: '🌌', slot: 'chest', def: 6,  desc: 'Wear the cosmos; the hems trail stardust when you run.' },
  spirit_ring:    { name: 'Spirit Ring',    icon: '💜', slot: 'ring',  def: 4,  desc: 'Rings once, softly, when a ghost passes.' },
  knights_helm:   { name: "Knight's Helm",  icon: '⛑️', slot: 'head',  def: 8,  desc: 'Forged for those who hold the line after the lanterns fail.' },
  order_signet:   { name: "Order's Signet", icon: '🔰', slot: 'ring',  def: 5,  desc: 'Seal of the old Watch — the oath still counts.' },
  travelers_hood: { name: "Traveler's Hood",icon: '🥷', slot: 'head',  def: 5,  desc: 'Keeps the wind, the rain, and the questions off.' },
  travelers_vest: { name: "Traveler's Vest",icon: '🧥', slot: 'chest', def: 7,  desc: 'Nine pockets. Eleven if it likes you.' },
  trail_ring:     { name: 'Trail Ring',     icon: '🪬', slot: 'ring',  def: 3,  spd: 3, desc: 'Keeps the road under your feet even when the road disagrees.' },
  // Witch Hazel's shop items — mirrored from server.js ITEM_CATALOG
  cursed_blade:   { name: 'Cursed Blade',   icon: '🗡️', slot: 'weapon', atk: 20, desc: 'It hungers politely, like a good houseguest.' },
  shadow_staff:   { name: 'Shadow Staff',   icon: '🪄', slot: 'weapon', atk: 18, desc: 'Cut from a tree that grew in an eclipse.' },
  bone_armor:     { name: 'Bone Armor',     icon: '🩻', slot: 'chest',  def: 16, desc: "The ribs aren't decorative. They remember standing." },
  shadow_cloak:   { name: 'Shadow Cloak',   icon: '🌑', slot: 'chest',  def: 14, desc: 'Live shadow, tailored. Hold still while it settles.' },
  witches_boon:   { name: "Witch's Boon",   icon: '🧿', slot: 'ring',   def: 8,  desc: "Hazel's blessing, sealed under glass. Don't shake it." },
  dread_helm:     { name: 'Dread Helm',     icon: '💀', slot: 'head',   def: 12, desc: "The face it shows others isn't yours. That's the point." },
  soul_treads:    { name: 'Soul Treads',    icon: '👁️', slot: 'feet',   def: 10, spd: 6, desc: 'The eyes on the soles have seen every road home.' },
  void_staff:     { name: 'Void Staff',     icon: '☄️', slot: 'weapon', atk: 24, desc: 'Each swing borrows a little dark and forgets to return it.' },
  shadow_crown:   { name: 'Shadow Crown',   icon: '🌙', slot: 'head',   def: 15, desc: 'Cold as the far side of midnight; rules an empire of hush.' },
  abyssal_armor:  { name: 'Abyssal Armor',  icon: '⚫', slot: 'chest',  def: 20, desc: 'Forged where light owes money and never visits.' },
  death_ring:     { name: 'Death Ring',     icon: '🖤', slot: 'ring',   def: 10, desc: 'Fits every finger. Choosy about owners anyway.' },
  wraith_treads:  { name: 'Wraith Treads',  icon: '🌫️', slot: 'feet',   def: 12, spd: 10, desc: 'Step out of a shadow you never stepped into.' },
  // Lexton Greyfur's Howl Trade items — mirrored from server.js ITEM_CATALOG
  moonhowl_pelt:    { name: 'Moonhowl Pelt',   icon: '🌕', slot: 'chest',  def: 18, desc: 'Shimmers silver at full moon; growls faintly at silver rings.' },
  alpha_fang:       { name: 'Alpha Fang',      icon: '🦷', slot: 'weapon', atk: 22, desc: "Torn from the pack's first alpha. It still leads." },
  packbound_ring:   { name: 'Packbound Ring',  icon: '🪢', slot: 'ring',   def: 9,  desc: 'A knot tied by the whole pack — you never hunt alone.' },
  nightfang_boots:  { name: 'Nightfang Boots', icon: '🥾', slot: 'feet',   def: 11, spd: 8, desc: 'Silent steps, sharp turns, no apologies.' },
  // The Wilds' 16 harvestable plants — name/icon mirrored from server.js's
  // PLANT_CATALOG. The actual effect (what happens when used) is resolved
  // server-side; the client only needs to know these exist and are usable.
  swift_root:           { name: 'Swift Root',          icon: '🥕', slot: null, desc: "Pulled at dusk, still squirming — the road can't hold you (speed, 12s)." },
  featherleaf:           { name: 'Featherleaf',          icon: '🍃', slot: null, desc: 'Light as a lie; fall as soft as one (feather-fall, 20s).' },
  giants_cap:             { name: "Giant's Cap",           icon: '🍄', slot: null, desc: 'One bite and doorframes become a problem (giant, 15s).' },
  shrinking_violet:       { name: 'Shrinking Violet',      icon: '🌷', slot: null, desc: 'Modest flower, immodest results (shrink, 20s).' },
  pumpkin_blossom:        { name: 'Pumpkin Blossom',       icon: '🎃', slot: null, desc: 'Blooms in October, whenever it decides that is (pumpkin head, 30s).' },
  bats_breath:            { name: "Bat's Breath Flower",   icon: '🦇', slot: null, desc: 'Smells of belfries. Exhales a small night (bats, 15s).' },
  rainbow_petal:          { name: 'Rainbow Petal',         icon: '🌈', slot: null, desc: 'A pigment the rain forgot (color-cycle, 20s).' },
  ravens_feather_plant:   { name: "Raven's Feather Plant", icon: '🪶', slot: null, desc: 'Grows where a raven gossiped (raven cloak, 30s).' },
  stumbleweed:            { name: 'Stumbleweed',           icon: '🌾', slot: null, desc: 'Trips the unwary. That includes you (stumble, 15s).' },
  gibberish_root:         { name: 'Gibberish Root',        icon: '🫚', slot: null, desc: 'Chew, then try apologizing (gibberish, 20s).' },
  toadstool:              { name: 'Toadstool',             icon: '🐸', slot: null, desc: 'Exactly what the name warns (toad, 20s).' },
  wolfsbane_bloom:        { name: 'Wolfsbane Bloom',       icon: '🌺', slot: null, desc: 'Wolves mark whoever carries it (wolf-mark, 30s).' },
  meditation_lotus:       { name: 'Meditation Lotus',      icon: '🪷', slot: null, desc: 'Sit. The pond will wait (meditation, 60s).' },
  healing_herb:           { name: 'Healing Herb',          icon: '🌿', slot: null, desc: 'Bitter leaf, kind heart — restores 40 HP.' },
  regen_root:             { name: 'Regen Root',            icon: '🫘', slot: null, desc: 'Knits you back slowly, like good gossip (regen, 15s).' },
  cleansing_clover:       { name: 'Cleansing Clover',      icon: '🍀', slot: null, desc: 'Four leaves; each takes a curse with it (cleanses all).' },
  // --- Witch-brewed potions ---
  health_potion_ii:       { name: 'Greater Healing Potion', icon: '❤️‍🔥', slot: null, desc: "Hazel's own recipe — 80 HP and a warm ringing in the ears." },
  regen_brew:             { name: 'Regen Brew',             icon: '🫧',  slot: null, desc: 'Bottled patience; mends you for 45 seconds.' },
  swift_brew:             { name: 'Swift Brew',             icon: '💨',  slot: null, desc: 'Distilled hurry (speed, 45s).' },
  shadow_draught:         { name: 'Shadow Draught',         icon: '🌘',  slot: null, desc: 'Drink the dusk; wear the raven cloak (60s).' },
  giants_elixir:          { name: "Giant's Elixir",         icon: '🍄‍🟫', slot: null, desc: 'The ceiling becomes a rumor (giant, 45s).' },
  bat_swarm_potion:       { name: 'Bat Swarm Potion',       icon: '🫙',  slot: null, desc: 'A jar of night, uncorked (bats, 45s).' },
  clarity_draught:        { name: 'Clarity Draught',        icon: '✨',  slot: null, desc: 'One clean sip; every curse lets go.' },
  chaos_brew:             { name: 'Chaos Brew',             icon: '🌪️',  slot: null, desc: 'Shake well. Regret thoroughly (wild colors, 60s).' },
  wolf_pact_brew:         { name: "Wolf's Pact Brew",       icon: '🐺',  slot: null, desc: "Lexton's handshake in a bottle — double stats for 1 hour." },
  // --- Loot materials ---
  fur_scrap:      { name: 'Fur Scrap',      icon: '🧶', slot: null, desc: 'Shed by something that heard you coming.' },
  animal_pelt:    { name: 'Animal Pelt',    icon: '🐻', slot: null, desc: 'Cured under a waxing moon so it keeps.' },
  bone_shard:     { name: 'Bone Shard',     icon: '🦴', slot: null, desc: 'Jagged, and chatty in a bag with other bones.' },
  leather_hide:   { name: 'Leather Hide',   icon: '🟤', slot: null, desc: 'Thick enough to argue with claws.' },
  iron_ore:       { name: 'Iron Ore',       icon: '⛏️', slot: null, desc: 'Cold iron from the vein — the fae keep their distance.' },
  enchanted_fur:  { name: 'Enchanted Fur',  icon: '🌟', slot: null, desc: 'Glows faintly. Purrs if you fold it wrong.' },
  shadow_essence: { name: 'Shadow Essence', icon: '🫥', slot: null, desc: 'Distilled dark. Keep the stopper IN.' },
  // --- Wildlands quest rewards (were server-only before — the client
  //     couldn't render them at all if a player earned one) ---
  lumber_bundle:  { name: 'Lumber Bundle',  icon: '🪚', slot: null, desc: 'Thornwood planks, cut and cursed against rot.' },
  stone_block:    { name: 'Stone Block',    icon: '🪨', slot: null, desc: 'Quarried from the Wilds; the moss grew back overnight.' },
  iron_ingot:     { name: 'Iron Ingot',     icon: '⚙️', slot: null, desc: 'Smelted thrice — the third time for the superstition.' },
  druid_stone:    { name: 'Druid Stone',    icon: '🗿', slot: null, desc: 'A standing stone in miniature. It remembers rituals.' },
  hollow_shard:   { name: 'Hollow Shard',   icon: '💠', slot: null, desc: 'A splinter of the door under the Wilds. It weighs wrong.' },
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
  stumble_hex:     { name: 'Stumble Hex',        icon: '🦶', kind: 'ground', effect: 'trap',
    description: 'Draws a witchy sigil on the ground — anyone who steps into it gets hexed with halved walking speed.' },
  fireball:        { name: 'Fireball',           icon: '🔥', kind: 'targeted', effect: 'damage',
    description: 'Hurls a roaring ball of witchfire at the target for real damage.' },
  withering_hex:   { name: 'Withering Hex',      icon: '🥀', kind: 'targeted', effect: 'status',
    description: "Rots the target's vitality — their life withers away for ten dreadful seconds. It cannot kill, only carry them to the brink." },
  leech_hex:       { name: 'Leech Hex',          icon: '🩸', kind: 'targeted', effect: 'leech',
    description: 'Sinks phantom fangs into the target — the life it drains seeps back into your own veins.' },
  monstrous_form:  { name: 'Monstrous Form',     icon: '👹', kind: 'self', effect: 'status',
    description: 'Swell into a hulking horror — while transformed, your strikes and spells hit half again as hard.' },
  gourd_ward:      { name: 'Gourd Ward',         icon: '🎃', kind: 'self', effect: 'status',
    description: 'Hollow out your skull into a sacred ward-gourd — while it grins, all harm against you is halved.' },
  ravens_cloak:    { name: "Raven's Cloak",      icon: '🪽', kind: 'self', effect: 'status',
    description: 'Dissolve into a flurry of black feathers — your steps quicken to twice their pace, to flee or to chase.' },
  bone_knit:       { name: 'Bone-Knit Blessing', icon: '🦴', kind: 'self', effect: 'status',
    description: 'Whisper the old words over your own bones — wounds slowly knit themselves closed for twelve seconds.' },
  scrying_orb:     { name: 'Scrying Orb',        icon: '🔮', kind: 'targeted', effect: 'reveal',
    description: 'Peer into the orb at a chosen soul — learn where they are, how wounded, how seasoned, and what curse rides them.' },
  nightwing_augury:{ name: 'Nightwing Augury',   icon: '🦇', kind: 'self', effect: 'intel_sweep',
    description: 'Loose your bats across the whole realm — they return whispering every soul’s whereabouts and wounds.' }
};

// Must stay in sync with WEREWOLF_ATTACK_CATALOG in server.js.
// kind: 'aoe' = hits every player within AOE_RADIUS (no target picker shown)
//       'self' = only affects the Werewolf themselves
//       'targeted' = single target picker required
// effect: 'note_steal' = Rapid Swipe's unique note theft
const WEREWOLF_ATTACK_CATALOG = {
  savage_bite:      { name: 'Savage Bite',       icon: '🦷', kind: 'targeted', effect: 'damage',
    description: 'Sink your fangs in for real damage — players, animals, and mobs alike, same death/respawn/loot flow as a melee Strike.' },
  iron_pelt:        { name: 'Iron Pelt',         icon: '🛡️', kind: 'self', effect: 'status',
    description: 'Your fur bristles into iron — while it holds, ALL damage against you is halved.' },
  moonlit_mending:  { name: 'Moonlit Mending',   icon: '🌙', kind: 'self', effect: 'status',
    description: 'Moonlight seeps into your wounds — they slowly knit closed for twelve seconds.' },
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
  knife_throw:        { name: 'Knife Throw',        icon: '🔪', kind: 'targeted', effect: 'damage',
    description: 'A travel-worn blade thrown hard and true — real damage to players, animals, and mobs alike.' },
  trail_remedy:       { name: 'Trail Remedy',       icon: '🍵', kind: 'self', effect: 'status',
    description: 'An old road-tonic from the bottom of your pack — wounds slowly mend for twelve seconds.' },
  packmule_guard:     { name: "Packmule's Guard",   icon: '🛡️', kind: 'self', effect: 'status',
    description: 'Brace behind your pack like a seasoned road-fighter — while it holds, ALL damage against you is halved.' },
  spy_glass:          { name: 'Spy Glass',          icon: '🔭', kind: 'building', effect: 'spyglass', durationMs: 60000,
    description: "Peer into a building of your choice from anywhere — opens a live window into that room's chat for 60 seconds. Everyone in that room is told the moment you cast it." },
  sleight_of_hand:    { name: 'Sleight of Hand',    icon: '🤏', kind: 'targeted', effect: 'pickpocket', stealChance: 0.35,
    description: "Peek into a target's pockets and try to lift an item. They won't know if you're successful — only a failed attempt gives you away. Starts at a 35% success chance and grows the more you practice, up to 94% at max skill." },
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

// Must stay in sync with MYSTIC_ATTACK_CATALOG in server.js. charId 2 —
// the spirit-medium's kit: damage + leech, wards for self and allies, a
// self-regen and the game's targeted instant heal, plus the intel pair
// (single-soul reveal + realm-wide spirit walk).
const MYSTIC_ATTACK_CATALOG = {
  spirit_lash:       { name: 'Spirit Lash',        icon: '👻', kind: 'targeted', effect: 'damage',
    description: 'A whipcrack of furious spirits — real damage to players, animals, and mobs alike.' },
  soul_siphon:       { name: 'Soul Siphon',        icon: '💜', kind: 'targeted', effect: 'leech',
    description: 'Draw the living warmth out of the target — everything it drains flows back into your own veins.' },
  banshee_wail:      { name: 'Banshee Wail',       icon: '😱', kind: 'aoe', effect: 'status',
    description: 'A grave-cold shriek — everyone in range shrinks in terror to half their size.' },
  ethereal_veil:     { name: 'Ethereal Veil',      icon: '🌫️', kind: 'self', effect: 'status',
    description: 'Slip halfway behind the veil — while you shimmer, ALL damage against you is halved.' },
  spirit_ward:       { name: 'Spirit Ward',        icon: '🕯️', kind: 'targeted', effect: 'status',
    description: 'Set a protective spirit on another player — ALL damage against them is halved while it watches.' },
  ghost_step:        { name: 'Ghost Step',         icon: '👣', kind: 'self', effect: 'status',
    description: 'Walk the way the dead do — twice your pace, for slipping away or closing in.' },
  seance_of_mending: { name: 'Séance of Mending',  icon: '🕊️', kind: 'self', effect: 'status',
    description: 'Kindly spirits fuss over your wounds — they slowly knit closed for twelve seconds.' },
  mending_spirits:   { name: 'Mending Spirits',    icon: '💚', kind: 'targeted', effect: 'heal',
    description: 'Send your gentlest spirits to another player — they restore a solid chunk of health on the spot.' },
  whispered_secret:  { name: 'Whispered Secret',   icon: '🤫', kind: 'targeted', effect: 'reveal',
    description: 'The dead gossip terribly. Learn where a chosen soul is, how wounded, how seasoned, and what curse rides them.' },
  spirit_walk:       { name: 'Spirit Walk',        icon: '🌀', kind: 'self', effect: 'intel_sweep',
    description: 'Step out of your body and sweep the whole realm — return knowing every soul\'s whereabouts and wounds.' },
  haunting:          { name: 'Haunting',           icon: '🦇', kind: 'targeted', effect: 'status',
    description: 'Send restless spirits to circle the target like a personal storm cloud.' },
  graveyard_chill:   { name: 'Graveyard Chill',    icon: '🥶', kind: 'targeted', effect: 'status',
    description: 'The cold of the old yard seeps into the target\'s bones, halving their walking speed.' }
};

// Must stay in sync with KNIGHT_ATTACK_CATALOG in server.js. charId 3 —
// the oathbound order's kit: the hardest single hit in the game, crowd
// control, wards for self and allies, self-regen plus Lay on Hands, and
// knightly reconnaissance.
const KNIGHT_ATTACK_CATALOG = {
  smite:             { name: 'Smite',              icon: '⚔️', kind: 'targeted', effect: 'damage',
    description: 'Bring the order\'s judgment down in one blow — the hardest-hitting single attack any class owns.' },
  shield_bash:       { name: 'Shield Bash',        icon: '🛡️', kind: 'targeted', effect: 'status',
    description: 'Stagger the target with your shield — their walking speed is halved while their ears ring.' },
  rallying_wrath:    { name: 'Rallying Wrath',     icon: '🔥', kind: 'self', effect: 'status',
    description: 'Swell with righteous fury — while it burns, your strikes and attacks hit half again as hard.' },
  oath_of_iron:      { name: 'Oath of Iron',       icon: '⚙️', kind: 'self', effect: 'status',
    description: 'Recite the old vow — while it holds, ALL damage against you is halved.' },
  guardians_pledge:  { name: "Guardian's Pledge",  icon: '🤝', kind: 'targeted', effect: 'status',
    description: 'Swear your shield to another player — ALL damage against them is halved while your pledge stands.' },
  field_dressing:    { name: 'Field Dressing',     icon: '🩹', kind: 'self', effect: 'status',
    description: 'Bind your own wounds the way the garrison taught — they slowly close for twelve seconds.' },
  lay_on_hands:      { name: 'Lay on Hands',       icon: '💚', kind: 'targeted', effect: 'heal',
    description: 'The order\'s oldest mercy — restore a solid chunk of another player\'s health on the spot.' },
  sentinels_watch:   { name: "Sentinel's Watch",   icon: '🗼', kind: 'targeted', effect: 'reveal',
    description: 'A sentinel misses nothing. Learn where a chosen player is, how wounded, how seasoned, and what afflicts them.' },
  heralds_muster:    { name: "Herald's Muster",    icon: '📯', kind: 'self', effect: 'intel_sweep',
    description: 'Sound the muster and take the roll — one report naming every player\'s whereabouts and wounds.' },
  challenge:         { name: 'Challenge',          icon: '🔶', kind: 'targeted', effect: 'status',
    description: 'Brand the target with a glowing mark of challenge for all to see.' },
  steadfast_march:   { name: 'Steadfast March',    icon: '🥾', kind: 'self', effect: 'status',
    description: 'Fall into the old march cadence — twice your pace for a short burst.' },
  banner_of_dread:   { name: 'Banner of Dread',    icon: '🚩', kind: 'aoe', effect: 'status',
    description: 'Plant a banner so grim that everyone in range falters, their walking speed halved.' }
};

// charId -> attack catalog the player can use. Drives both which characters
// get the Attacks button at all and which catalog the panel renders from.
// Every non-Witch class has a full kit now (the Witch's is SPELL_CATALOG).
const ATTACK_CATALOGS = {
  1: WEREWOLF_ATTACK_CATALOG,
  2: MYSTIC_ATTACK_CATALOG,
  3: KNIGHT_ATTACK_CATALOG,
  4: WANDERER_ATTACK_CATALOG
};

function setupWs() {
  ws = new WebSocket(proto + '://' + location.host);
  ws.addEventListener('open', onWsOpen);
  ws.addEventListener('close', onWsClose);
  ws.addEventListener('error', onWsError);
  ws.addEventListener('message', onWsMessage);
}
function onWsOpen() {
  setStatus(true);
  // Mid-session socket open = a reconnect (first joins are sent by the join
  // screen / auto-resume, before gameStarted is ever true). Rejoin
  // immediately: with a live resume token the server rebuilds the exact
  // character in place — spot, XP, inventory, pass — and a resume miss
  // falls back to a plain rejoin in the join_error handler.
  if (gameStarted && lastJoinPayload) {
    ws.send(JSON.stringify(liveResumeToken ? buildLiveResumePayload() : lastJoinPayload));
  }
}
function buildLiveResumePayload() {
  const p = { type: 'join', resumeToken: liveResumeToken };
  try { const a = JSON.parse(localStorage.getItem('tc_account') || 'null'); if (a && a.token) p.accountToken = a.token; } catch (e) {}
  if (passSessionReceipt()) p.passSession = passSessionReceipt();
  return p;
}
function onWsClose() {
  setStatus(false);
  // Evicted by our own account joining elsewhere: never auto-reconnect —
  // the two devices would ping-pong evicting each other forever.
  if (sessionTakenOver) return;
  if (gameStarted && lastJoinPayload && !reconnectTimer) {
    showReconnectBanner(true);
    reconnectTimer = setTimeout(() => { reconnectTimer = null; setupWs(); }, 2000);
  }
}
// Phones drop the socket when the screen sleeps or the app is backgrounded,
// then sit out the retry timer after waking. Reconnect the instant the tab
// is visible/online again instead.
function maybeReconnectNow() {
  if (sessionTakenOver) return;
  if (!gameStarted || !lastJoinPayload) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  showReconnectBanner(true);
  setupWs();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) maybeReconnectNow(); });
window.addEventListener('online', maybeReconnectNow);
window.addEventListener('pageshow', (e) => {
  // A bfcache-revived page is a time traveler: its in-memory resume token
  // is stale, and a newer session for this character may exist (e.g. the
  // post-checkout page, if the player swipes Back afterward). Reload —
  // the fresh boot resumes cleanly from sessionStorage's latest token
  // instead of rejoining as a second copy of the character.
  if (e.persisted) { location.reload(); return; }
  maybeReconnectNow();
});
function onWsError() { setStatus(false); }
function onWsMessage(ev) {
  let msg;
  try { msg = JSON.parse(ev.data); } catch (e) { return; }

  if (msg.type === 'init') {
    const wasStarted = gameStarted;
    myId = msg.id;
    world = msg.world;
    TOWN_WORLD = world;
    // Equipment stat catalog — used to preview how a gear swap changes stats.
    if (msg.equipStats) equipStatsCatalog = msg.equipStats;
    // The Peddler's legendary catalog rides in on init (server-authoritative
    // — never hand-copied here). Merged into ITEM_CATALOG so bank/inventory/
    // auction UIs treat legendaries like any other item.
    if (msg.legendaryCatalog) {
      legendaryCatalogClient = msg.legendaryCatalog;
      for (const lgId in msg.legendaryCatalog) {
        const lg = msg.legendaryCatalog[lgId];
        ITEM_CATALOG[lgId] = { name: lg.name, icon: lg.icon, slot: lg.slot, desc: lg.desc, legendary: true, tier: lg.tier, fx: lg.fx };
      }
    }
    myMoonstones = msg.moonstones || 0;
    if (msg.msPacks) msPacksCatalog = msg.msPacks;
    if (msg.msAuctionFee != null) msAuctionFee = msg.msAuctionFee;
    refreshMsUI();
    // ── Session L: dungeon lore, the calendar, delve twists, push ──
    if (msg.dungeonLore) dungeonLoreCatalog = msg.dungeonLore;
    if (msg.calendar) applyCalendarState(msg.calendar);
    if (msg.delveMods) weeklyDelveModsClient = msg.delveMods;
    if (msg.covenSigils) covenSigilsCatalog = msg.covenSigils;
    pushPublicKey = msg.pushPublicKey || null;
    pushAvailable = !!msg.pushAvailable;
    if (msg.townPass) {
      townPass30Cents = msg.townPass.price30Cents || townPass30Cents;
      townPass30Product = msg.townPass.product30 || townPass30Product;
    }
    // 😴 Rested XP window (bonus XP for the first minutes of a session).
    restedUntil = msg.restedUntil || 0;
    if (restedUntil > Date.now() && !restedToastShown) {
      restedToastShown = true;
      setUnlockToast('😴 Rested! +50% XP for the next few minutes — welcome back.');
    }
    // Town Pass truth from the server — which rooms are locked, what a
    // pass costs, and whether THIS connection holds one right now.
    if (msg.townPass) {
      lockedRooms = new Set(msg.townPass.lockedRooms || []);
      townPassPriceCents = msg.townPass.priceCents || townPassPriceCents;
      townPassHours = msg.townPass.hours || townPassHours;
      paymentsEnabled = !!msg.townPass.paymentsEnabled;
      if (msg.townPass.passUntil > Date.now()) {
        passUntil = msg.townPass.passUntil;
        localStorage.setItem('tc_pass_until', String(passUntil));
      }
      refreshUnlockUI();
      refreshPassHud();
      if (typeof refreshBuildingLockVisuals === 'function') refreshBuildingLockVisuals();
    }
    world2 = msg.world2 || world2;
    walls = buildWalls(world);
    // Clear all existing remote-player meshes before rebuilding the list,
    // whether this is the first join or a reconnect after a dropped connection.
    for (const id of Object.keys(players)) removePlayer(id);
    players = {};
    if (!wasStarted) {
      initScene(world);
    } else {
      // Reconnect: scene is already built. Reset the view to the town map
      // first — a resumed player gets swapped back into their restored
      // room just below, and a plain rejoin really is back at the spawn.
      if (mode === 'indoor' || activeScene === wildsScene || activeScene === dungeonScene || activeScene === emberScene || activeScene === caveScene || activeScene === vaultScene) {
        mode = 'outdoor';
        currentRoom = 'outside';
        swapToTownMap();
      }
    }
    for (const p of msg.players) addPlayer(p);
    me = players[myId];
    // Live resume token for THIS connection — kept in memory for the
    // instant-reconnect path and mirrored to sessionStorage so a tab the
    // phone killed outright can still resume on its next load.
    if (msg.resumeToken) {
      liveResumeToken = msg.resumeToken;
      try {
        sessionStorage.setItem('tc_live_resume', JSON.stringify({ token: msg.resumeToken, name: me ? me.name : '', at: Date.now() }));
      } catch (e) {}
    }
    // Normalize the rejoin fallback to a plain join under our server-given
    // name — never a stale resume payload (those tokens are single-use).
    if (me) {
      const plain = { type: 'join', name: me.name, charId: me.charId };
      if (lastJoinPayload && lastJoinPayload.password) plain.password = lastJoinPayload.password;
      try { const a = JSON.parse(localStorage.getItem('tc_account') || 'null'); if (a && a.token) plain.accountToken = a.token; } catch (e) {}
      if (passSessionReceipt()) plain.passSession = passSessionReceipt();
      lastJoinPayload = plain;
    }
    // Resumed join (checkout return or live reconnect): the server rebuilt
    // us in the room we left from — swap the client's view to match
    // (interior scene, wilds map, etc.) instead of the town-spawn framing.
    if (msg.resumed && me && me.room && me.room !== 'outside') {
      restoreSceneForRoom(me.room);
    }
    if (!wasStarted) pokeRoomTag(); // start the location banner's fade clock on first join
    if (!wasStarted && pendingReturnToast) {
      setUnlockToast(pendingReturnToast);
      pendingReturnToast = '';
    }
    if (!wasStarted) claimPassOnConnection(true);
    if (!wasStarted) {
      document.getElementById('joinScreen').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      document.getElementById('healthHud').classList.remove('hidden');
      updateHealthHud();
      updateXPDisplay();
      document.getElementById('inventoryBtn').classList.remove('hidden');
      // Every character has a story campaign — the Journal is for everyone.
      document.getElementById('journalBtn').classList.remove('hidden');
      // 💾 Drive button (selfies/clips/notes vault) — for everyone too;
      // the panel itself explains the 💽 item requirement if you lack it.
      const driveBtn = document.getElementById('driveBtn');
      if (driveBtn) driveBtn.classList.remove('hidden');
      // 🌟 Skills button (class skill tree) — every class has one.
      const skillsBtn = document.getElementById('skillsBtn');
      if (skillsBtn) skillsBtn.classList.remove('hidden');
      // ☰ Menu — desktop's single HUD chip (CSS hides it in touchMode).
      const pcMenuBtn = document.getElementById('pcMenuBtn');
      if (pcMenuBtn) pcMenuBtn.classList.remove('hidden');
      requestCmState(); // load the countermeasure quick-list
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
      loadLoadout(); // per-class slot order, chosen by the player
      buildHotbar();
      maybeShowFirstRunControls();
      if (isTouchDevice()) {
        document.getElementById('joystick').classList.add('show');
        initMobileHud(); // joystick rest spot, action wheel, top bar, menu sheet
      }
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
    if (msg.code === 'resume_expired' && gameStarted && lastJoinPayload && ws && ws.readyState === WebSocket.OPEN) {
      // Mid-session resume miss (stash expired or the server restarted):
      // fall back to a plain rejoin under the same name instead of dumping
      // an in-game player onto the join screen.
      liveResumeToken = null;
      try { sessionStorage.removeItem('tc_live_resume'); } catch (e) {}
      ws.send(JSON.stringify(lastJoinPayload));
      return;
    }
    if (msg.code === 'resume_expired') {
      // The checkout took longer than the resume stash lives (or the
      // server restarted) — fall back to the normal join screen, name
      // prefilled, rather than silently becoming a fresh guest.
      showResumeUi(false);
      if (resumeFallbackName && !nameInput.value) nameInput.value = resumeFallbackName;
    }
    showJoinError(msg.message);
    // Warded towns: the passcode field stays hidden until the server
    // actually refuses a join over TOWN_PASSWORD — open towns never see it.
    if (/passcode/i.test(msg.message || '')) {
      const passRow = document.getElementById('passRow');
      if (passRow && passRow.classList.contains('hidden')) {
        passRow.classList.remove('hidden');
        showJoinError('This town is warded — enter its passcode below.');
      }
      if (passInput) { passInput.focus(); passInput.select(); }
    }
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
          if (typeof p.maxHealth === 'number') me.maxHealth = p.maxHealth;
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
        existing.hasLoot = !!p.hasLoot;
        existing.deathX = p.deathX; existing.deathY = p.deathY; existing.deathRoom = p.deathRoom;
        // Disguise identity rides the state stream by name; the mask image
        // arrives separately via 'disguise_state' and is cached. A name
        // change here without a cached image still swaps the nameplate.
        if ((p.disguiseName || null) !== (existing.disguiseName || null)) {
          existing.disguiseName = p.disguiseName || null;
          refreshDisguiseVisual(p.id);
        }
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
    if (msg.torchNpcs) applyTownTorchNpcState(msg.torchNpcs);
    if (msg.torches) applyTownTorchState(msg.torches);
    applyTemplePortalState(!!msg.templePortalOpen);
    if (msg.emberMobs) applyEmberMobState(msg.emberMobs);
    if (msg.groundTraps) applyGroundTrapsState(msg.groundTraps);
    return;
  }

  if (msg.type === 'torch_healed') {
    // Fires once when healing *starts* — health itself now climbs gradually
    // over the next few seconds via the regular 'state' broadcast (see
    // tickTorchHealing in server.js), not an instant jump carried in this message.
    setUnlockToast(msg.message);
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

  if (msg.type === 'craft_result') {
    setUnlockToast(msg.message);
    if (inventoryOpen && invItemsTabActive) renderInventory();
    return;
  }

  if (msg.type === 'craft_error') {
    if (inventoryOpen && invItemsTabActive) document.getElementById('invModalErr').textContent = msg.message;
    else setUnlockToast(msg.message);
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
    setUnlockToast(msg.message || `📜 Quest started: "${msg.questName}" — ${msg.description}`);
    appendSystemChatLine(msg.message || `📜 Quest started: "${msg.questName}"`);
    updateQuestTracker(msg.questId, msg.questName, 0, msg.target, msg.where);
    return;
  }

  if (msg.type === 'npc_hint_dialogue') {
    showNpcHintDialogue(msg);
    return;
  }

  if (msg.type === 'quest_update') {
    updateQuestTracker(msg.questId, msg.questName, msg.progress, msg.target, msg.where);
    // Side-quest ticks used to be silent — a progress beat you can feel
    // (and a louder one when you're one away) keeps the loop warm.
    if (msg.message) setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'quest_complete') {
    clearQuestTracker();
    setUnlockToast(msg.message);
    appendSystemChatLine(msg.message);
    // Refresh inventory so newly granted items appear immediately
    ws.send(JSON.stringify({ type: 'inventory_open' }));
    return;
  }

  if (msg.type === 'quest_cancelled') {
    clearQuestTracker();
    return;
  }

  // ── Story campaign messages — see the Journal section below ─────────────
  if (msg.type === 'story_state') {
    storyState = msg.storyline;
    updateStoryTracker();
    if (journalOpen) renderJournal();
    return;
  }

  if (msg.type === 'story_chapter_started') {
    storyLastOutro = null; // reading on — the previous chapter's ending leaves the desk
    setUnlockToast(msg.message);
    appendSystemChatLine(msg.message);
    return; // the refreshed story_state arrives right behind this
  }

  if (msg.type === 'story_update') {
    if (storyState) storyState.progress = msg.progress;
    updateStoryTracker();
    if (journalOpen) renderJournal();
    setUnlockToast(msg.message || `📖 ${msg.chapterTitle} — ${msg.progress}/${msg.target}`);
    return;
  }

  if (msg.type === 'story_chapter_complete') {
    storyLastOutro = { title: msg.chapterTitle, outro: msg.outro, rewards: msg.rewards, storyComplete: msg.storyComplete };
    setUnlockToast(msg.message);
    appendSystemChatLine(msg.message);
    // The ceremony beat — bigger for the finale.
    showChapterCeremony(
      msg.storyComplete ? '🏆 STORY COMPLETE' : `📖 Chapter ${msg.chapterIndex || ''} complete`,
      msg.storyComplete ? `"${msg.chapterTitle}" — the relic is yours.` : `"${msg.chapterTitle}" · ${msg.rewards || ''}`
    );
    // Refresh inventory so chapter item rewards appear immediately, same
    // as quest_complete above.
    ws.send(JSON.stringify({ type: 'inventory_open' }));
    return; // refreshed story_state follows
  }

  if (msg.type === 'xp_gain') {
    if (me) { me.xp = msg.xp; me.level = msg.level; me.skillPoints = msg.skillPoints; }
    updateXPDisplay();
    updateSkillsBadge();
    if (skillsOpen) renderSkills();
    return;
  }

  if (msg.type === 'level_up') {
    if (me) { me.level = msg.level; me.skillPoints = msg.skillPoints; }
    updateXPDisplay();
    updateSkillsBadge();
    if (skillsOpen) renderSkills();
    setUnlockToast(msg.message);
    appendSystemChatLine(msg.message);
    // Leveling matters more now (chapters gate on it) — give it a beat.
    showChapterCeremony(`⬆️ Level ${msg.level}`, 'A skill point earned — spend it in 🌟 Skills.');
    if (journalOpen) renderJournal();
    return;
  }

  // ── Class skill trees ──
  if (msg.type === 'skill_state') {
    mySkillState = msg;
    mySkillSpeedMult = msg.speedMult || 1;
    if (msg.statBlock) myStatBlock = msg.statBlock;
    if (me) { me.skillPoints = msg.skillPoints; me.maxHealth = msg.maxHealth || me.maxHealth || 100; }
    updateXPDisplay();
    updateSkillsBadge();
    updateHealthHud();
    if (skillsOpen) renderSkills();
    if (inventoryOpen) { renderStats(); refreshEquipPreview(); }
    return;
  }
  if (msg.type === 'skill_result') {
    if (mySkillState) { /* fresh skill_state follows with authoritative ranks */ }
    setUnlockToast(msg.message);
    appendSystemChatLine(msg.message);
    return;
  }
  if (msg.type === 'skill_error') {
    const errEl = document.getElementById('skillsErr');
    if (errEl && skillsOpen) { errEl.textContent = msg.message; setTimeout(() => { if (errEl.textContent === msg.message) errEl.textContent = ''; }, 3200); }
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'pickpocket_level_up') {
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'hard_drive_awarded') {
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'struck') {
    flashDamage();
    triggerMobAttackAnim(msg.mobId);
    setUnlockToast(`⚔️ ${msg.byName} hit you for ${msg.damage}!`);
    noteUnderAttack(); // arms the countermeasure prompt (V — play a clip)
    // Feel the hit: red number on yourself, a small shake, a short buzz.
    if (me && visuals[myId] && visuals[myId].inScene) {
      const rp = getRenderPos(me);
      const s = worldToScreen(rp.x, groundY + CHAR.headY + getFloorHeight(me.room, rp.x, rp.z), rp.z);
      if (s.visible) spawnDmgNum(s.x, s.y, msg.damage, 'selfHit');
    }
    shakeScreen('S');
    haptic(40);
    refreshMobileHud();
    return;
  }

  if (msg.type === 'room_locked') {
    // The server bounced our door prediction — hard truth from the gate.
    paymentsEnabled = !!msg.paymentsEnabled;
    if (me && lockedRooms.has(me.room)) { me.room = 'outside'; }
    showLockMessage(msg.room);
    refreshUnlockUI();
    return;
  }

  if (msg.type === 'pass_state') {
    // A pass arrived (bought on another device, or a receipt the server
    // just finished re-verifying with Stripe).
    if (msg.passUntil > Date.now()) {
      passUntil = msg.passUntil;
      localStorage.setItem('tc_pass_until', String(passUntil));
      setUnlockToast(`🎟️ Town Pass active — 👻 Phantom Parlor + 🎮 Starlight Arcade open for ${passTimeLeftLabel()}!`);
      refreshUnlockUI();
      refreshPassHud();
      refreshBuildingLockVisuals();
    }
    return;
  }

  if (msg.type === 'announce') {
    // Town-wide news (campaign finales, etc.) — banner + a system chat line.
    showAnnounceBanner(msg.message);
    appendSystemChatLine(msg.message);
    return;
  }

  // ── Session L messages ─────────────────────────────────────────────────
  if (msg.type === 'announce_soft') {
    // Personal event beats (delve floors, first steps) — toast, no banner.
    setUnlockToast(msg.message);
    appendSystemChatLine(msg.message);
    return;
  }

  if (msg.type === 'session_takeover') {
    // The same account just joined from another device — the server closed
    // THIS copy (one account, one body). Stop the auto-reconnect (it would
    // ping-pong the two devices evicting each other forever), burn the
    // local resume stashes, and say plainly what happened.
    sessionTakenOver = true;
    liveResumeToken = null;
    try { sessionStorage.removeItem('tc_live_resume'); } catch (e) {}
    try { sessionStorage.removeItem('tc_resume'); } catch (e) {}
    showSessionTakeover(msg.message);
    return;
  }

  if (msg.type === 'calendar_state') {
    applyCalendarState(msg.calendar);
    return;
  }

  if (msg.type === 'welcome_letter') {
    openLetterModal(msg);
    return;
  }

  if (msg.type === 'daily_streak') {
    setUnlockToast(msg.message);
    appendSystemChatLine(msg.message);
    return;
  }

  if (msg.type === 'first_steps') {
    firstStepsState = msg;
    // Show the full card briefly (join snapshot or a step landing), then
    // collapse back to the tiny pill so it never crowds a new thumb.
    fsSetExpanded(true, 8000);
    if (msg.justCompleted) {
      const step = (msg.steps || []).find(s => s.id === msg.justCompleted);
      if (step) setUnlockToast(`${step.icon} First Steps: ${step.label} ✓`);
    }
    return;
  }

  if (msg.type === 'board_state') {
    boardState = msg;
    if (boardModalOpen) renderBoardModal();
    return;
  }

  if (msg.type === 'delve_state') {
    delveState = msg;
    delveSpeedMult = msg.inRun ? (msg.speedMult || 1) : 1;
    renderDelveHud();
    if (delveModalOpen) renderDelveModal();
    renderBoonDraft();
    return;
  }

  if (msg.type === 'delve_over') {
    delveState = null;
    delveSpeedMult = 1;
    renderDelveHud();
    document.getElementById('boonDraft').classList.add('hidden');
    if (me) { me.room = msg.room; me.x = msg.x; me.y = msg.y; }
    mode = 'outdoor';
    if (msg.room === 'wilds') swapToWildsMap(); else swapToTownMap();
    ws.send(JSON.stringify({ type: 'move', x: msg.x, y: msg.y, room: msg.room }));
    const why = msg.reason === 'death' ? 'The Delve keeps your bones — ' : '';
    setUnlockToast(`🕳️ ${why}Depth ${msg.depth}${msg.gold ? ` · ${msg.gold} 🪙 banked` : ''}${msg.best && msg.best.rank ? ` · #${msg.best.rank} this week` : ''}`);
    appendSystemChatLine(`🕳️ Delve over — depth ${msg.depth}.`);
    return;
  }

  if (msg.type === 'delve_error') {
    if (delveModalOpen) document.getElementById('delveErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'coven_state') {
    covenState = msg.coven || null;
    refreshCovenMenuRow();
    if (covenModalOpen) renderCovenModal();
    return;
  }

  if (msg.type === 'coven_msg') {
    covenChatLines.push({ who: msg.fromName, sigil: msg.sigil, text: msg.text });
    if (covenChatLines.length > 60) covenChatLines = covenChatLines.slice(-60);
    const chatVisible = covenModalOpen && !document.getElementById('covenChatView').classList.contains('hidden');
    if (chatVisible) renderCovenChat();
    else {
      covenUnread++;
      refreshCovenMenuRow();
      if (!covenModalOpen) setUnlockToast(`${msg.sigil} ${msg.fromName}: ${msg.text.slice(0, 60)}`);
    }
    return;
  }

  if (msg.type === 'coven_invited') {
    openCovenInviteToast(msg);
    return;
  }

  if (msg.type === 'coven_error') {
    if (covenModalOpen) document.getElementById('covenErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'coven_table_state') {
    covenTableState = msg.table || null;
    refreshCovenTableVisual();
    return;
  }

  if (msg.type === 'trophy_bonus' || msg.type === 'cm_result') {
    setUnlockToast(msg.message);
    appendSystemChatLine(msg.message);
    return;
  }

  if (msg.type === 'cm_error' || msg.type === 'story_error') {
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'voice_cm') {
    playVoiceCountermeasure(msg);
    return;
  }

  if (msg.type === 'cm_state') {
    cmHasDrive = !!msg.hasDrive;
    cmClips = msg.clips || [];
    cmSelfies = msg.selfies || [];
    if (cmSelectedClipId && !cmClips.some(c => c.id === cmSelectedClipId)) cmSelectedClipId = null;
    if (typeof renderDriveMediaQuickState === 'function') renderDriveMediaQuickState(msg.disguise);
    return;
  }

  if (msg.type === 'hit_fx') {
    // Floating damage numbers for every landed blow in the room. My own
    // incoming PvP hits are skipped here — the 'struck' handler draws
    // those (red, with the shake), and mob hits only arrive that way.
    if (!(msg.targetType === 'player' && msg.targetId === myId)) {
      const s = screenPosForTarget(msg.targetType, msg.targetId);
      if (s && s.visible) spawnDmgNum(s.x, s.y, msg.dmg, msg.dead ? 'kill' : '');
    }
    if (msg.dead && msg.casterId === myId) {
      shakeScreen('S');
      haptic([12, 25, 20]);
    }
    return;
  }

  if (msg.type === 'streak') {
    showStreak(msg.count, msg.message, msg.bonus);
    return;
  }

  if (msg.type === 'emote_fx') {
    spawnEmoteFloat(msg.id, msg.emote);
    return;
  }

  if (msg.type === 'disguise_state') {
    applyDisguiseState(msg.id, msg.name, msg.image);
    return;
  }

  if (msg.type === 'you_died') {
    flashDamage();
    triggerMobAttackAnim(msg.mobId);
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
    if (msg.delve) {
      setUnlockToast(`🕳️ The Delve opens — Floor ${msg.floor || 1}. Clear it, draft, descend.`);
    } else {
      const lore = dungeonLoreCatalog && dungeonLoreCatalog[msg.tier];
      setUnlockToast(lore
        ? `🕳️ ${lore.name} — ${lore.epithet} (Tier ${msg.tier}). Read the plaque by the portal.`
        : `⚡ Entered dungeon tier ${msg.tier} — Level ${msg.level} Wildlands`);
    }
    pokeRoomTag();
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
    updateGoldReadouts();
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
    if (auctionModalOpen) populateAuctionItemSelect();
    applyMyEquipVisual(msg);
    return;
  }

  if (msg.type === 'spell_result') {
    if (spellbookOpen) document.getElementById('spellbookErr').textContent = '';
    setUnlockToast(msg.message);
    if (msg.revealTargetId) showGlimpseBeacon(msg.revealTargetId);
    return;
  }

  if (msg.type === 'spell_fx') {
    if (msg.spellId === 'fireball') spawnFireballFx(msg.casterId, msg.targetId, msg.targetType);
    // Leech Hex: same flight fx reversed — a crimson orb of stolen life
    // flying from the victim back into the Witch.
    else if (msg.spellId === 'leech_hex') spawnFireballFx(msg.casterId, msg.targetId, msg.targetType, { reverse: true, coreColor: 0xff8899, glowColor: 0xcc0033, lightColor: 0xff2244 });
    return;
  }

  // Class attack projectiles — same broadcast/flight FX as spell_fx above,
  // tinted per attack so each class's damage reads as its own thing:
  // Savage Bite amber, Knife Throw steel, Spirit Lash ghost-green, Soul
  // Siphon reversed violet (life flowing back into the Mystic), Smite gold.
  if (msg.type === 'attack_fx') {
    const ATTACK_FX_STYLES = {
      savage_bite: { coreColor: 0xffcc88, glowColor: 0xcc6600, lightColor: 0xff9933 },
      knife_throw: { coreColor: 0xdde4ee, glowColor: 0x8899bb, lightColor: 0xaabbdd },
      spirit_lash: { coreColor: 0xbbffdd, glowColor: 0x33aa77, lightColor: 0x55ddaa },
      soul_siphon: { reverse: true, coreColor: 0xddaaff, glowColor: 0x7733cc, lightColor: 0xaa66ff },
      smite:       { coreColor: 0xfff2aa, glowColor: 0xcc9900, lightColor: 0xffdd44 }
    };
    spawnFireballFx(msg.casterId, msg.targetId, msg.targetType, ATTACK_FX_STYLES[msg.attackId] || {});
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
    // A talker's nameplate surfaces for a few seconds (names are
    // otherwise distance-gated on mobile), and their words ride along:
    // an overhead speech bubble on desktop, a text-message-style banner
    // at the top of the screen on phones (there is no chat log there).
    if (m.id && players[m.id]) players[m.id].lastChatAt = Date.now();
    if (m.room === currentRoom) {
      if (!MOBILE_UI) setOverheadBubble(m.id, m.text, !!m.image);
      else spawnChatNotif({ name: m.name, color: m.color, text: m.text, image: m.image, self: m.id === myId });
    }
    return;
  }

  if (msg.type === 'note_received') {
    inbox.push({ ...msg.note, read: false });
    setUnlockToast(`📜 New note from ${msg.note.fromName}`);
    renderInventory();
    return;
  }

  if (msg.type === 'inbox_state') {
    // Sent once right after 'init' — restores notes an account holder had
    // sitting in their inbox from a previous session. Already-seen, so
    // marked read (no "NEW" badge just for reconnecting).
    inbox.length = 0;
    for (const n of (msg.notes || [])) inbox.push({ ...n, read: true });
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
    lastHardDriveState = {
      hasPassword: msg.hasPassword, notes: msg.notes, capacity: msg.capacity,
      selfies: msg.selfies || [], clips: msg.clips || [],
      selfieCapacity: msg.selfieCapacity || 8, clipCapacity: msg.clipCapacity || 6
    };
    document.getElementById('hdErr').textContent = '';
    document.getElementById('hdLocked').classList.add('hidden');
    document.getElementById('hdUnlocked').classList.remove('hidden');
    document.getElementById('hdPasswordInput').value = '';
    document.getElementById('hdCurrentPasswordInput').value = '';
    document.getElementById('hdNewPasswordInput').value = '';
    renderHardDriveUnlocked();
    requestCmState(); // media changed → refresh the V-key quick list too
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

  if (msg.type === 'ms_state') {
    myMoonstones = msg.balance || 0;
    refreshMsUI();
    return;
  }
  if (msg.type === 'ms_error') {
    const legendErr = document.getElementById('legendErr');
    const msErr = document.getElementById('msModalErr');
    if (legendModalOpen && legendErr) legendErr.textContent = '⚠️ ' + msg.message;
    else if (msModalOpen && msErr) msErr.textContent = '⚠️ ' + msg.message;
    else setUnlockToast('⚠️ ' + msg.message);
    return;
  }
  if (msg.type === 'legend_shop_state') {
    renderLegendShop(msg);
    return;
  }
  if (msg.type === 'legend_bought') {
    setUnlockToast(`✨ ${msg.icon} ${msg.name} is yours — it's in your pack.`);
    // refresh the open shop so the balance line updates
    if (legendModalOpen && ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'legend_shop_open' }));
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

  if (msg.type === 'vault_entered') {
    if (me) { me.room = 'bank_vault'; me.x = msg.spawn.x; me.y = msg.spawn.y; }
    swapToVaultMap();
    setUnlockToast('💰 You step into the vault...');
    return;
  }

  if (msg.type === 'vault_exited') {
    if (me) { me.room = 'bank'; me.x = msg.x; me.y = msg.y; }
    // Unlike leaving the cave (back out to the open Wilds), this returns
    // to a building interior — needs the full indoor context restored
    // (mode/indoorBuildingId/currentInterior/world), not just a scene
    // swap. world was still VAULT_WORLD (buildings: []) from swapToVaultMap
    // — updateIndoor() looks up world.buildings.find(id === indoorBuildingId)
    // to get the bank's b.x/b.y, which crashed on undefined without this.
    mode = 'indoor';
    indoorBuildingId = 'bank';
    world = TOWN_WORLD;
    const bankInterior = getInteriorScene('bank');
    setActiveContext(bankInterior.scene, bankInterior.camera, bankInterior);
    setUnlockToast('You step out of the vault.');
    return;
  }

  if (msg.type === 'ember_wastes_entered') {
    if (me) { me.room = 'ember_wastes'; me.x = msg.spawn.x; me.y = msg.spawn.y; }
    swapToEmberMap();
    return;
  }

  if (msg.type === 'ember_wastes_exited') {
    if (me) { me.room = 'outside'; me.x = msg.x; me.y = msg.y; }
    swapToTownMap();
    setUnlockToast('You step back through the portal into town.');
    return;
  }

  if (msg.type === 'ember_wastes_error') {
    setUnlockToast(msg.message);
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

  if (msg.type === 'werewolf_dialogue') {
    openWerewolfModal(msg);
    return;
  }

  if (msg.type === 'werewolf_voice_request') {
    openWerewolfVoiceConsent(msg.consentId, msg.itemName, msg.itemIcon);
    return;
  }

  if (msg.type === 'werewolf_purchase_complete') {
    closeWerewolfVoiceConsent();
    setUnlockToast(`🐺 ${msg.itemIcon} ${msg.itemName} added to your inventory!`);
    return;
  }

  if (msg.type === 'werewolf_shop_error') {
    // The shop modal (#werewolfShopErr lives inside it) is already closed
    // by the time this can arrive for a voice-payment failure — the player
    // is looking at the consent modal, or neither, at that point. A toast
    // makes sure the message is actually seen regardless of which modal
    // (if any) is open, in addition to the in-modal text for the case
    // where the shop itself is still open (e.g. picking an unknown item).
    const errEl = document.getElementById('werewolfShopErr');
    if (errEl) errEl.textContent = msg.message;
    setUnlockToast(`🐺 ${msg.message}`);
    return;
  }

  if (msg.type === 'loot_drop') {
    if (msg.items && msg.items.length) {
      setUnlockToast('💰 Looted: ' + msg.items.join('  '));
    }
    return;
  }

  if (msg.type === 'loot_error') {
    setUnlockToast(msg.message);
    return;
  }

  // Ember Wastes mob-vs-mob skirmish — no player was hit, so nothing else
  // would trigger the attacker's lunge animation. Broadcast to everyone
  // (same as wildlife_state) rather than scoped to the room, harmless
  // since triggerMobAttackAnim() is just a no-op lookup miss for anyone
  // who hasn't seen this particular mob yet.
  if (msg.type === 'ember_mob_attacked') {
    triggerMobAttackAnim(msg.mobId);
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
    maxHealth: typeof p.maxHealth === 'number' ? p.maxHealth : 100,
    level: p.level || 1, skillPoints: p.skillPoints || 0, xp: p.xp || 0,
    isDead: p.isDead || false,
    hasLoot: !!p.hasLoot, deathX: p.deathX, deathY: p.deathY, deathRoom: p.deathRoom,
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
  updateCharPickerVisibility();
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
  updateCharPickerVisibility();
}

function logoutAccount() {
  savedAccount = null;
  localStorage.removeItem('tc_account');
  setAccountStatus('');
  rosterData = null;
  newCharMode = false;
  renderCharRoster();
  updateCharPickerVisibility();
}

// ── Character roster — the returning-player select screen ──────────────────
// When a saved login exists (or right after logging in), /api/characters
// returns every class this account has played, newest first. Those become
// "continue as …" cards; "＋ New character" re-opens the classic class
// picker. Guests and never-played accounts just see the picker, unchanged.
const charRosterEl = document.getElementById('charRoster');
const charRosterListEl = document.getElementById('charRosterList');
const newCharBtn = document.getElementById('newCharBtn');
const charSelectLabelEl = document.getElementById('charSelectLabel');
const charSelectRowEl = document.getElementById('charSelectRow');
let rosterData = null;   // last /api/characters payload, or null
let newCharMode = false; // true while picking a class for a new character

function updateCharPickerVisibility() {
  const hasRoster = joinMode === 'account' && !!savedAccount && !!rosterData
    && Array.isArray(rosterData.characters) && rosterData.characters.length > 0;
  const showRoster = hasRoster && !newCharMode;
  // While logged in, the username/password form gives way to the roster —
  // the "log out" link in the status line brings it back.
  const loggedIn = !!savedAccount;
  if (accountUserInput) accountUserInput.classList.toggle('hidden', loggedIn);
  if (accountPassInput) accountPassInput.classList.toggle('hidden', loggedIn);
  const accountBtnRowEl = document.getElementById('accountBtnRow');
  if (accountBtnRowEl) accountBtnRowEl.classList.toggle('hidden', loggedIn);
  if (charRosterEl) charRosterEl.classList.toggle('hidden', !hasRoster);
  if (charRosterListEl) charRosterListEl.classList.toggle('hidden', !showRoster);
  if (charSelectRowEl) charSelectRowEl.classList.toggle('hidden', showRoster);
  if (charSelectLabelEl) {
    charSelectLabelEl.classList.toggle('hidden', showRoster);
    charSelectLabelEl.textContent = hasRoster && newCharMode
      ? 'Choose a calling for your new character'
      : 'Choose your calling';
  }
  if (newCharBtn) newCharBtn.textContent = newCharMode ? '← Back to your characters' : '＋ New character';
}

function charCssColor(n) { return '#' + n.toString(16).padStart(6, '0'); }

function renderCharRoster() {
  if (!charRosterListEl) return;
  charRosterListEl.innerHTML = '';
  if (!rosterData || !Array.isArray(rosterData.characters)) return;
  for (const c of rosterData.characters) {
    const preset = CHARACTER_PRESETS[c.charId];
    if (!preset) continue;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'rosterCard' + (c.charId === selectedCharId ? ' selected' : '');
    const av = document.createElement('span');
    av.className = 'rosterAvatar';
    for (const [cls, color] of [['charHair', preset.hair], ['charHead', preset.skin], ['charBody', preset.shirt]]) {
      const s = document.createElement('span');
      s.className = cls;
      s.style.background = charCssColor(color);
      av.appendChild(s);
    }
    const info = document.createElement('span');
    info.className = 'rosterInfo';
    const nm = document.createElement('span');
    nm.className = 'rosterName';
    nm.textContent = rosterData.username + ' the ' + preset.name;
    const sub = document.createElement('span');
    sub.className = 'rosterSub';
    sub.textContent = 'Level ' + (rosterData.level || 1) + (c.chapter > 0 ? ' · Chapter ' + c.chapter : '');
    info.appendChild(nm);
    info.appendChild(sub);
    card.appendChild(av);
    card.appendChild(info);
    if (c.charId === rosterData.lastCharId) {
      const tag = document.createElement('span');
      tag.className = 'rosterTag';
      tag.textContent = 'Last played';
      card.appendChild(tag);
    }
    card.addEventListener('click', () => {
      selectedCharId = c.charId;
      localStorage.setItem('tc_charid', String(selectedCharId));
      renderCharSelect();
      renderCharRoster();
    });
    charRosterListEl.appendChild(card);
  }
}

function fetchCharacterRoster() {
  if (!savedAccount || !savedAccount.token) return;
  fetch(apiUrlMaybe('/api/characters'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: savedAccount.token })
  })
    .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
    .then(({ ok, status, data }) => {
      if (!ok) {
        if (status === 401) {
          // Sessions live in server memory and don't survive a restart —
          // ask for a fresh login instead of silently joining as a guest.
          logoutAccount();
          setAccountStatus('Session expired — log in again to see your characters.', true);
        }
        return;
      }
      rosterData = data;
      newCharMode = false;
      if (Number.isInteger(data.lastCharId) && CHARACTER_PRESETS[data.lastCharId]) {
        selectedCharId = data.lastCharId;
        localStorage.setItem('tc_charid', String(selectedCharId));
        renderCharSelect();
      }
      renderCharRoster();
      updateCharPickerVisibility();
    })
    .catch(() => { /* server unreachable — the classic picker still works */ });
}
// The web build serves everything same-origin; the mobile builds override
// fetch targets via apiUrl() in their own copies. Use it when present.
function apiUrlMaybe(p) { return (typeof apiUrl === 'function') ? apiUrl(p) : p; }

if (newCharBtn) {
  newCharBtn.addEventListener('click', () => {
    newCharMode = !newCharMode;
    updateCharPickerVisibility();
  });
}

(function loadSavedAccount() {
  try {
    const raw = localStorage.getItem('tc_account');
    if (raw) savedAccount = JSON.parse(raw);
  } catch (e) { savedAccount = null; }
  if (savedAccount && savedAccount.username && savedAccount.token) {
    setJoinMode('account');
    renderLoggedInStatus();
    fetchCharacterRoster();
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
      fetchCharacterRoster();
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
    renderCharRoster(); // keep the roster cards' selected ring in sync
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
  // Tier-3 assets: hold the join until the preload settles (or 12s cap),
  // so the town builds with KayKit models instead of racing the loader.
  if (!KK.settled && !attemptJoin._waited) {
    attemptJoin._waited = true;
    const oldLabel = joinBtn.textContent;
    joinBtn.textContent = 'Summoning…';
    joinBtn.disabled = true;
    Promise.race([KK.promise, new Promise(r => setTimeout(r, 12000))]).then(() => {
      joinBtn.textContent = oldLabel;
      joinBtn.disabled = false;
      attemptJoin();
    });
    return;
  }
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
  // Present the Town Pass receipt (a Stripe Checkout session id) so the
  // server can restore a guest's pass — even across a server restart.
  if (passSessionReceipt()) payload.passSession = passSessionReceipt();
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

// The location pill ("Town Square" etc.) used to sit on screen forever —
// now it shows for a few seconds after every room change, then fades
// (user request, Session I). Any poke brings it back.
let roomTagFadeTimer = null;
function pokeRoomTag() {
  const tag = document.getElementById('roomTag');
  if (!tag) return;
  tag.classList.remove('tagFaded');
  clearTimeout(roomTagFadeTimer);
  roomTagFadeTimer = setTimeout(() => tag.classList.add('tagFaded'), 5000);
}

function roomLabel(roomId) {
  if (roomId === 'outside') return '📍 Town Square';
  if (roomId === 'wilds') return '🌲 The Wilds';
  if (roomId === 'ember_wastes') return '🔥 The Ember Wastes';
  // The named dungeons (Session L) — lore ships in init; the tier ranges
  // stay in the label so the gate is still legible at a glance.
  const dm = /^dungeon_t([1-4])$/.exec(roomId || '');
  if (dm) {
    const tier = Number(dm[1]);
    const lore = dungeonLoreCatalog && dungeonLoreCatalog[tier];
    const range = ['1–5', '6–10', '11–15', '16–20'][tier - 1];
    return lore ? `🕳️ ${lore.name} (Lv ${range})` : `⚔️ Dungeon — Tier ${tier} (Lv ${range})`;
  }
  if (typeof roomId === 'string' && roomId.startsWith('dungeon_delve_')) {
    return delveState && delveState.inRun ? `🕳️ The Delve — Floor ${delveState.floor}` : '🕳️ The Delve';
  }
  const b = world && world.buildings.find(x => x.id === roomId);
  return b ? b.name : roomId;
}

// ---------------------------------------------------------------------------
// The Town Pass — two buildings (the Phantom Parlor and the Starlight Arcade) are
// locked; one $0.99 Stripe Checkout purchase opens BOTH for 24 hours. The
// server is the real gate now (a move into a locked room bounces with
// 'room_locked' no matter what this client claims) — everything here is
// prediction and presentation. The browser keeps two things: the Stripe
// Checkout session id (the receipt it presents when joining) and the
// expiry the server reported, purely so the UI can count down.
// ---------------------------------------------------------------------------
const PAYWALLS_ENABLED = true;
let paymentsEnabled = false;
let townPassPriceCents = 99;
let townPassHours = 24;
let lockedRooms = new Set(['lounge', 'arcade']); // refreshed from init/config
let passUntil = parseInt(localStorage.getItem('tc_pass_until') || '0', 10) || 0;

function passSessionReceipt() { return localStorage.getItem('tc_pass_session') || ''; }
function hasTownPass() { return passUntil > Date.now(); }
function storePassReceipt(sessionId, expiresAt) {
  if (sessionId) localStorage.setItem('tc_pass_session', sessionId);
  if (expiresAt) {
    passUntil = expiresAt;
    localStorage.setItem('tc_pass_until', String(expiresAt));
  }
}
function passTimeLeftLabel() {
  const ms = passUntil - Date.now();
  if (ms <= 0) return '';
  // Floor the minutes (not round) so this never reads "23h 60m" — rounding the
  // remainder up could hit 60 and print an impossible minute count.
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function passPriceLabel() { return `$${(townPassPriceCents / 100).toFixed(2)}`; }

function isLockedRoom(roomId) {
  if (!PAYWALLS_ENABLED) return false;
  if (!lockedRooms.has(roomId)) return false;
  return !hasTownPass();
}

// Whether a building's outdoor signage/door should render in its "locked"
// look — same rule as isLockedRoom but as a per-building helper since
// buildings (not rooms) are what get rendered outdoors.
function isVisuallyLocked(b) {
  return isLockedRoom(b.id);
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
let musicTrackId = null;   // what's actually sounding right now
let musicChoice = 'off';   // the player's saved pick: 'off' | a track id
let musicIsRoomTune = false; // true when the cafe started it, not the player
try { musicChoice = localStorage.getItem('tc_music') || 'off'; } catch (e) {}

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

function playNote(freq, time, dur, vol, type) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(vol, time + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(time);
  osc.stop(time + dur + 0.05);
}
// A struck-bell voice: fundamental + a quiet octave partial, long-ish fade.
function playBell(freq, time, dur, vol) {
  playNote(freq, time, dur, vol, 'sine');
  playNote(freq * 2, time, dur * 0.6, vol * 0.3, 'sine');
}
// A plucked string with a fading echo — the harp of the kit.
function playPluck(freq, time, vol) {
  playNote(freq, time, 0.5, vol, 'triangle');
  playNote(freq, time + 0.34, 0.44, vol * 0.38, 'triangle');
}

// ── The witchy songbook — generative tracks the player cycles through ──────
// Each track is a tiny recipe: a step interval and a function that schedules
// the next beat's notes. All code, no audio files — the same client that
// draws the town also hums its tunes.
const MUSIC_TRACKS = [
  {
    id: 'moonrise', name: 'Moonrise', icon: '🌙', stepMs: 620,
    // Slow pentatonic-minor plucks over a breathing low drone — the town at
    // night, nothing hurried.
    scale: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25],
    melody: [0, 4, 2, -1, 5, 3, 6, -1, 1, 4, -1, 2, 6, 3, 2, -1],
    step(now, i) {
      const n = this.melody[i % this.melody.length];
      if (n >= 0) playPluck(this.scale[n], now, 0.13);
      if (i % 8 === 0) playNote(110.00, now, 3.6, 0.07, 'sine');            // A2 breath
      if (i % 8 === 4) playNote(164.81, now, 3.2, 0.055, 'sine');           // E3 answer
    },
  },
  {
    id: 'covens_waltz', name: "The Coven's Waltz", icon: '🔮', stepMs: 400,
    // A slow 3/4 turn through A harmonic minor — the G# is the witchcraft.
    scale: [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 415.30, 440.00],
    melody: [0, 2, 4, 7, 6, 4, 2, 4, 0, 3, 5, 3, 6, 4, 2, 0, 1, 2, 3, 4, 6, 7, 6, 4],
    step(now, i) {
      if (i % 3 === 0) playNote(i % 6 === 0 ? 110.00 : 82.41, now, 1.0, 0.11, 'sine'); // bass sway
      else playPluck(this.scale[this.melody[i % this.melody.length]], now, 0.12);
    },
  },
  {
    id: 'wilds_dusk', name: 'Wilds at Dusk', icon: '🌲', stepMs: 880,
    // Sparse bells over a deep drone; every seventh bar leans on the
    // tritone so the forest never feels quite safe.
    bells: [329.63, 392.00, 415.30, 311.13, 493.88, 392.00, 261.63],
    step(now, i) {
      if (i % 4 === 0) { playNote(55.00, now, 4.4, 0.06, 'triangle'); playNote(110.00, now, 4.4, 0.035, 'sine'); }
      if (i % 3 === 1) playBell(this.bells[(i * 5) % this.bells.length], now, 2.2, 0.09);
      if (i % 7 === 3) playBell(311.13, now, 2.6, 0.055); // D#4 — the unease
    },
  },
  {
    id: 'ember_jig', name: 'Ember Jig', icon: '🎻', stepMs: 300,
    // The Cauldron Café's own tune, quickened — dotted steps, warm bass.
    step(now, i) {
      const note = TAVERN_MELODY[i % TAVERN_MELODY.length];
      playNote(TAVERN_SCALE[note], now, i % 2 ? 0.28 : 0.5, 0.16);
      if (i % 4 === 0) playNote(TAVERN_SCALE[0] / 2, now, 0.9, 0.1);
      if (i % 8 === 6) playNote(TAVERN_SCALE[note] * 2, now, 0.22, 0.06);   // sparkle
    },
  },
];
function musicTrackById(id) { return MUSIC_TRACKS.find(t => t.id === id) || null; }

function scheduleMusicStep() {
  if (!musicPlaying || !audioCtx) return;
  const track = musicTrackById(musicTrackId);
  if (!track) return;
  track.step(audioCtx.currentTime, musicStep);
  musicStep++;
  musicTimer = setTimeout(scheduleMusicStep, track.stepMs);
}

// startMusic(trackId?, {roomTune}) — the cafe calls it as a room tune (only
// honored when the player hasn't picked their own track); the ☰ Music row
// calls it with an explicit pick.
function startMusic(trackId, opts) {
  const roomTune = !!(opts && opts.roomTune);
  if (roomTune && musicChoice !== 'off') return; // their playlist outranks the room's
  ensureAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const id = trackId || 'ember_jig';
  if (musicPlaying && musicTrackId === id) return;
  clearTimeout(musicTimer);
  musicPlaying = true;
  musicIsRoomTune = roomTune;
  musicTrackId = id;
  musicStep = 0;
  musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
  musicGain.gain.linearRampToValueAtTime(musicMuted ? 0 : 0.5, audioCtx.currentTime + 1.2);
  scheduleMusicStep();
}

// stopMusic({roomTune}) — a room-tune stop (leaving the cafe) never silences
// a track the player chose themselves.
function stopMusic(opts) {
  if (!musicPlaying) return;
  if (opts && opts.roomTune && !musicIsRoomTune) return;
  musicPlaying = false;
  musicIsRoomTune = false;
  musicTrackId = null;
  clearTimeout(musicTimer);
  if (audioCtx && musicGain) {
    musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
  }
}

// ── The ☰ Music row: tap to cycle Off → 🌙 → 🔮 → 🌲 → 🎻 → Off ──
function musicMenuLabel() {
  if (musicChoice === 'off') {
    return musicPlaying && musicIsRoomTune ? '🎶 Music: room tune (tap to pick)' : '🎶 Music: Off';
  }
  const t = musicTrackById(musicChoice);
  return t ? `🎶 Music: ${t.icon} ${t.name}` : '🎶 Music: Off';
}
function cycleMusic() {
  const order = ['off', ...MUSIC_TRACKS.map(t => t.id)];
  musicChoice = order[(order.indexOf(musicChoice) + 1) % order.length];
  try { localStorage.setItem('tc_music', musicChoice); } catch (e) {}
  if (musicChoice === 'off') {
    stopMusic();
    // If they're standing in the cafe, the house tune takes back over.
    if (me && me.room === 'cafe') startMusic('ember_jig', { roomTune: true });
    setUnlockToast('🔇 Music off');
  } else {
    musicIsRoomTune = false;
    startMusic(musicChoice);
    const t = musicTrackById(musicChoice);
    setUnlockToast(`${t.icon} Now playing: ${t.name}`);
  }
  const row = document.getElementById('menuMusic');
  if (row) row.textContent = musicMenuLabel();
}
// A saved track can't sound until the browser gets a gesture — the very
// first tap/click (usually the join button) unlocks it.
document.addEventListener('pointerdown', function musicUnlock() {
  document.removeEventListener('pointerdown', musicUnlock);
  if (musicChoice !== 'off') startMusic(musicChoice);
}, { once: true });

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
// ✕ in the tab row — on phones this is the ONLY way to close the panel
// (no Esc key, and the ☰ menu row deliberately only opens it), so it's a
// dedicated button rather than a re-tap of a toggle.
const invCloseBtn = document.getElementById('invCloseBtn');
if (invCloseBtn) invCloseBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // the tab row doubles as the drag handle — a close tap must never start a drag
  if (inventoryOpen) toggleInventory();
});

const invTabItemsBtn = document.getElementById('invTabItems');
const invTabStatsBtn = document.getElementById('invTabStats');
const invTabNotesBtn = document.getElementById('invTabNotes');
const invTabHardDriveBtn = document.getElementById('invTabHardDrive');
const invTabSettingsBtn = document.getElementById('invTabSettings');
const INV_VIEW_IDS = ['invItemsView', 'invStatsView', 'invNotesView', 'invHardDriveView', 'invSettingsView'];
const INV_TAB_BTNS = { invItemsView: invTabItemsBtn, invStatsView: invTabStatsBtn, invNotesView: invTabNotesBtn, invHardDriveView: invTabHardDriveBtn, invSettingsView: invTabSettingsBtn };
function showInvTab(viewId) {
  invItemsTabActive = viewId === 'invItemsView';
  for (const id of INV_VIEW_IDS) {
    document.getElementById(id).classList.toggle('hidden', id !== viewId);
    const btn = INV_TAB_BTNS[id];
    if (btn) btn.classList.toggle('active', id === viewId);
  }
  if (viewId === 'invHardDriveView') refreshHardDriveTab();
  if (viewId === 'invStatsView') { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'skill_state' })); renderStats(); }
}
function showInvItemsTab() { showInvTab('invItemsView'); }
function showInvStatsTab() { showInvTab('invStatsView'); }
function showInvNotesTab() { showInvTab('invNotesView'); }
function showInvSettingsTab() { showInvTab('invSettingsView'); }
if (invTabItemsBtn) invTabItemsBtn.addEventListener('click', showInvItemsTab);
if (invTabStatsBtn) invTabStatsBtn.addEventListener('click', showInvStatsTab);
if (invTabNotesBtn) invTabNotesBtn.addEventListener('click', showInvNotesTab);
if (invTabHardDriveBtn) invTabHardDriveBtn.addEventListener('click', () => showInvTab('invHardDriveView'));
if (invTabSettingsBtn) invTabSettingsBtn.addEventListener('click', showInvSettingsTab);

// ── Character stats panel (📊 Stats tab) ──
// The 8 derived stats, how each is displayed, and which items feed them.
const STAT_DISPLAY = [
  { key: 'power',    icon: '⚔️', name: 'Attack',        fmt: (b) => '+' + Math.round(b.stats.power.total * 100) + '%',    hint: 'more damage from strikes & abilities' },
  { key: 'guard',    icon: '🛡️', name: 'Defense',       fmt: (b) => Math.round(Math.min(0.75, b.stats.guard.total) * 100) + '% less dmg', hint: 'incoming damage reduced' },
  { key: 'vitality', icon: '❤️', name: 'Max Health',    fmt: (b) => String(Math.round(b.maxHealth)),                      hint: 'total health pool' },
  { key: 'swift',    icon: '💨', name: 'Move Speed',    fmt: (b) => '+' + Math.round(b.stats.swift.total * 100) + '%',    hint: 'walk/run speed' },
  { key: 'haste',    icon: '⏱️', name: 'Ability Haste', fmt: (b) => '-' + Math.round(Math.min(0.7, b.stats.haste.total) * 100) + '% cd', hint: 'shorter ability cooldowns' },
  { key: 'leech',    icon: '🩸', name: 'Lifesteal',     fmt: (b) => Math.round(b.stats.leech.total * 100) + '%',          hint: 'heal a share of damage dealt' },
  { key: 'xp',       icon: '✨', name: 'XP Bonus',       fmt: (b) => '+' + Math.round(b.stats.xp.total * 100) + '%',       hint: 'faster leveling' },
  { key: 'forage',   icon: '🌿', name: 'Harvest Luck',  fmt: (b) => '+' + Math.round(b.stats.forage.total * 100) + '%',   hint: 'chance of an extra harvest' }
];
function renderStats() {
  const list = document.getElementById('invStatsList');
  if (!list) return;
  const b = myStatBlock;
  if (!b) { list.textContent = 'Loading your stats…'; return; }
  list.innerHTML = '';
  for (const d of STAT_DISPLAY) {
    const st = b.stats[d.key] || { skill: 0, gear: 0, total: 0 };
    const row = document.createElement('div');
    row.className = 'statRow';
    const ic = document.createElement('div'); ic.className = 'statRowIcon'; ic.textContent = d.icon;
    const main = document.createElement('div'); main.className = 'statRowMain';
    const nm = document.createElement('div'); nm.className = 'statRowName'; nm.textContent = d.name;
    const sp = document.createElement('div'); sp.className = 'statRowSplit';
    // vitality is flat points; the rest are percentages
    const asPct = d.key !== 'vitality';
    const skillTxt = d.key === 'vitality' ? `+${Math.round(st.skill)}` : `+${Math.round(st.skill * 100)}%`;
    const gearTxt  = d.key === 'vitality' ? `+${Math.round(st.gear)}`  : `+${Math.round(st.gear * 100)}%`;
    sp.textContent = `${d.hint} · skills ${skillTxt} · gear ${gearTxt}`;
    main.appendChild(nm); main.appendChild(sp);
    const val = document.createElement('div');
    val.className = 'statRowVal' + ((st.total > 0 || (d.key === 'vitality' && b.maxHealth > 100)) ? ' buffed' : '');
    val.textContent = d.fmt(b);
    row.appendChild(ic); row.appendChild(main); row.appendChild(val);
    list.appendChild(row);
  }
}

// Which equipped item currently sits in a slot (from the inventory payload).
function equippedItemInSlot(slotKind) {
  const s = lastInventoryState || {};
  return ({ weapon: s.equippedWeapon, head: s.equippedHead, chest: s.equippedChest, feet: s.equippedFeet, ring: s.equippedRing })[slotKind] || null;
}
// Show, in the item action panel, how equipping `itemId` into `slotKind` would
// change each stat versus whatever's equipped there now — computed locally from
// the equip-stats catalog, no server round-trip.
const PREVIEW_STAT_META = {
  power:  { icon: '⚔️', name: 'Attack',  pct: true },
  guard:  { icon: '🛡️', name: 'Defense', pct: true },
  vitality:{ icon: '❤️', name: 'Health', pct: false },
  haste:  { icon: '⏱️', name: 'Haste',   pct: true },
  swift:  { icon: '💨', name: 'Speed',   pct: true },
  leech:  { icon: '🩸', name: 'Lifesteal', pct: true },
  xp:     { icon: '✨', name: 'XP',      pct: true },
  forage: { icon: '🌿', name: 'Harvest', pct: true }
};
function renderEquipPreview(itemId, slotKind) {
  const preview = document.getElementById('invEquipPreview');
  if (!preview) return;
  const incoming = equipStatsCatalog[itemId] || {};
  const current = equippedItemInSlot(slotKind);
  const outgoing = (current && equipStatsCatalog[current]) || {};
  const alreadyOn = current === itemId;
  const parts = [];
  for (const key of Object.keys(PREVIEW_STAT_META)) {
    const delta = (incoming[key] || 0) - (outgoing[key] || 0);
    if (Math.abs(delta) < 1e-9) continue;
    const m = PREVIEW_STAT_META[key];
    const val = m.pct ? Math.round(Math.abs(delta) * 100) + '%' : String(Math.round(Math.abs(delta)));
    const cls = delta > 0 ? 'up' : 'down';
    const arrow = delta > 0 ? '▲' : '▼';
    parts.push(`<span class="previewDelta">${m.icon} ${m.name} <span class="${cls}">${arrow}${val}</span></span>`);
  }
  const title = alreadyOn ? '✓ Currently equipped'
    : (current ? `Replaces ${(ITEM_CATALOG[current] || {}).icon || ''} ${(ITEM_CATALOG[current] || {}).name || current}` : 'Equipping this:');
  if (!parts.length) {
    preview.innerHTML = `<div class="previewTitle">${title}</div><span class="previewDelta same">No stat change.</span>`;
  } else {
    preview.innerHTML = `<div class="previewTitle">${title}</div>${parts.join('')}`;
  }
  preview.classList.remove('hidden');
}
// Re-run the preview for whatever slot is currently selected (after stats
// refresh, e.g. right after an equip changes the baseline).
function refreshEquipPreview() {
  if (selectedInvSlotIdx == null || !lastInventoryState || !lastInventoryState.slots) return;
  const slot = lastInventoryState.slots[selectedInvSlotIdx];
  if (!slot) return;
  const meta = ITEM_CATALOG[slot.itemId];
  if (meta && meta.slot) renderEquipPreview(slot.itemId, meta.slot);
}

// 💾 Drive — a first-class HUD shortcut straight to the Hard Drive tab
// (selfies, voice clips, note vault). Same panel the Inventory button
// reaches; this just opens it on the right tab in one click.
const driveBtn = document.getElementById('driveBtn');
if (driveBtn) driveBtn.addEventListener('click', () => {
  if (!inventoryOpen) toggleInventory();
  showInvTab('invHardDriveView');
});

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
  updateGoldReadouts(); // pack header purse strip stays current
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
  const preview = document.getElementById('invEquipPreview');
  if (preview) { preview.classList.add('hidden'); preview.innerHTML = ''; }
  if (!slot) { panel.classList.add('hidden'); return; }
  const item = ITEM_CATALOG[slot.itemId];
  document.getElementById('invActionItemLabel').textContent =
    (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
  const buttons = document.getElementById('invActionButtons');
  buttons.innerHTML = '';
  const meta = item;
  if (meta && meta.slot) {
    // Live stat preview: how does equipping this compare to what's in the slot?
    renderEquipPreview(slot.itemId, meta.slot);
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
  } else if (slot.itemId === 'bloodmoon_shard') {
    // Bloodmoon Shards → Circlet (5 shards; server re-validates) — Session L
    const total = lastInventoryState.slots.reduce((n, s) => n + (s && s.itemId === 'bloodmoon_shard' ? s.qty : 0), 0);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '🔻 Bind the Bloodmoon Circlet (5 shards)';
    if (total >= 5) {
      btn.addEventListener('click', () => {
        document.getElementById('invModalErr').textContent = '';
        ws.send(JSON.stringify({ type: 'craft_circlet' }));
      });
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.55';
      const note = document.createElement('div');
      note.id = 'invEquippableNote';
      note.textContent = `${total}/5 shards — they fall from night creatures under a Blood Moon.`;
      buttons.appendChild(note);
    }
    buttons.appendChild(btn);
  } else if (slot.itemId === 'wood') {
    // Holly Wood → Holly Wand crafting (5 pieces; server re-validates)
    const total = lastInventoryState.slots.reduce((n, s) => n + (s && s.itemId === 'wood' ? s.qty : 0), 0);
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = '🎇 Build Holly Wand (5 Holly Wood)';
    if (total >= 5) {
      btn.addEventListener('click', () => {
        document.getElementById('invModalErr').textContent = '';
        ws.send(JSON.stringify({ type: 'craft_wand' }));
      });
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.55';
      const note = document.createElement('div');
      note.id = 'invEquippableNote';
      note.textContent = `${total}/5 Holly Wood — harvest the town trees for more.`;
      buttons.appendChild(note);
    }
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
  renderHardDriveMedia();
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
    if (note.audio) {
      const player = document.createElement('audio');
      player.controls = true;
      player.src = note.audio;
      player.style.cssText = 'width:100%; height:32px; margin-top:6px;';
      div.appendChild(player);
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

// ── Hard Drive media: 📸 selfies & 🎙️ voice clips ──────────────────────────
// The drive's newest shelves. Selfies come from your own camera (you click,
// your browser asks, one frame is taken — the same consent-first pattern
// as Hazel's shop and the 3rd Eye) or copied off a picture someone sent
// you. Clips are 3-second mic recordings. Both are the ammunition for the
// countermeasure mechanics: V plays a clip to slip an attack (everyone
// nearby HEARS it), and wearing a selfie makes the town see that face.
let myWornDisguise = null; // { name } while the server says we're masked

function renderDriveMediaQuickState(disguise) {
  myWornDisguise = disguise || null;
  // If the drive panel is open, re-render so Wear/Mask-off buttons match.
  if (lastHardDriveState) renderHardDriveMedia();
}

function renderHardDriveMedia() {
  const wrap = document.getElementById('hdMediaWrap');
  if (!wrap || !lastHardDriveState) return;
  const st = lastHardDriveState;
  wrap.innerHTML = '';

  // ── Selfies ──
  const selfieHead = document.createElement('div');
  selfieHead.className = 'hdMediaHead';
  selfieHead.textContent = `📸 Selfies — ${ (st.selfies || []).length } / ${st.selfieCapacity}`;
  wrap.appendChild(selfieHead);

  const selfieRow = document.createElement('div');
  selfieRow.className = 'hdMediaRow';
  for (const s of st.selfies || []) {
    const cell = document.createElement('div');
    cell.className = 'hdSelfieCell';
    const img = document.createElement('img');
    img.src = s.image;
    img.title = `A picture of ${s.of}`;
    cell.appendChild(img);
    const label = document.createElement('div');
    label.className = 'hdMediaLabel';
    label.textContent = s.of;
    cell.appendChild(label);
    const wearing = myWornDisguise && myWornDisguise.name === s.of;
    const wearBtn = document.createElement('button');
    wearBtn.className = 'noteReadBtn';
    wearBtn.textContent = wearing ? '🎭 Mask off' : '🎭 Wear as disguise';
    wearBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'cm_disguise', selfieId: wearing ? null : s.id }));
      setTimeout(requestCmState, 300);
    });
    cell.appendChild(wearBtn);
    const delBtn = document.createElement('button');
    delBtn.className = 'noteDestroyBtn';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete this selfie';
    delBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'harddrive_delete_media', kind: 'selfie', mediaId: s.id, password: pendingHdPassword }));
    });
    cell.appendChild(delBtn);
    selfieRow.appendChild(cell);
  }
  if (!(st.selfies || []).length) {
    const none = document.createElement('div');
    none.className = 'hdMediaEmpty';
    none.textContent = 'No selfies yet — take one, or save a face off a picture someone sends you.';
    selfieRow.appendChild(none);
  }
  wrap.appendChild(selfieRow);

  const takeBtn = document.createElement('button');
  takeBtn.className = 'btn';
  takeBtn.textContent = '📸 Take a selfie (your camera, one frame)';
  takeBtn.addEventListener('click', async () => {
    takeBtn.disabled = true;
    takeBtn.textContent = '📸 Say cheese…';
    try {
      const image = await captureSelfiePhoto();
      if (image) ws.send(JSON.stringify({ type: 'harddrive_save_selfie', image, password: pendingHdPassword }));
      else setUnlockToast('📸 No camera available (or permission denied).');
    } catch (e) {
      setUnlockToast('📸 No camera available (or permission denied).');
    }
    takeBtn.disabled = false;
    takeBtn.textContent = '📸 Take a selfie (your camera, one frame)';
  });
  wrap.appendChild(takeBtn);

  // ── Voice clips ──
  const clipHead = document.createElement('div');
  clipHead.className = 'hdMediaHead';
  clipHead.textContent = `🎙️ Voice clips — ${ (st.clips || []).length } / ${st.clipCapacity}`;
  wrap.appendChild(clipHead);

  for (const c of st.clips || []) {
    const row = document.createElement('div');
    row.className = 'hdClipRow';
    const name = document.createElement('span');
    name.className = 'hdMediaLabel';
    name.textContent = (cmSelectedClipId === c.id ? '✔ ' : '') + c.label;
    row.appendChild(name);
    const useBtn = document.createElement('button');
    useBtn.className = 'noteReadBtn';
    useBtn.textContent = cmSelectedClipId === c.id ? '✔ Armed for V' : 'Arm for V';
    useBtn.title = 'This is the clip the V key plays when you get attacked';
    useBtn.addEventListener('click', () => { cmSelectedClipId = c.id; renderHardDriveMedia(); });
    row.appendChild(useBtn);
    const delBtn = document.createElement('button');
    delBtn.className = 'noteDestroyBtn';
    delBtn.textContent = '🗑️';
    delBtn.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'harddrive_delete_media', kind: 'clip', mediaId: c.id, password: pendingHdPassword }));
    });
    row.appendChild(delBtn);
    wrap.appendChild(row);
  }
  if (!(st.clips || []).length) {
    const none = document.createElement('div');
    none.className = 'hdMediaEmpty';
    none.textContent = 'No clips yet — record one. Played mid-fight (V), it startles everything in earshot.';
    wrap.appendChild(none);
  }

  const recBtn = document.createElement('button');
  recBtn.className = 'btn';
  recBtn.textContent = '🎙️ Record a 3s voice clip';
  recBtn.addEventListener('click', async () => {
    const label = (document.getElementById('hdClipLabelInput') || { value: '' }).value.trim() || 'Voice clip';
    recBtn.disabled = true;
    recBtn.textContent = '🎙️ Recording… (3s)';
    try {
      const audio = await captureHowlClip(3000);
      if (audio) ws.send(JSON.stringify({ type: 'harddrive_save_clip', audio, label, password: pendingHdPassword }));
    } catch (e) {
      setUnlockToast('🎙️ No microphone available (or permission denied).');
    }
    recBtn.disabled = false;
    recBtn.textContent = '🎙️ Record a 3s voice clip';
  });
  const labelInput = document.createElement('input');
  labelInput.id = 'hdClipLabelInput';
  labelInput.placeholder = 'Clip name (e.g. "BOO!", "my evil laugh")';
  labelInput.maxLength = 40;
  labelInput.className = 'hdClipLabelInput';
  wrap.appendChild(labelInput);
  wrap.appendChild(recBtn);
}

// Mini portrait for snapshot photo-cards of an UNMASKED player — drawn
// from their character preset (skin/hair/shirt colors) since no real
// photo of anyone exists unless they chose to share one. Cached per charId.
const _portraitCache = {};
function drawCharPortrait(charId) {
  if (_portraitCache[charId]) return _portraitCache[charId];
  const preset = CHARACTER_PRESETS[charId] || CHARACTER_PRESETS[0];
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2418'; ctx.fillRect(0, 0, 96, 96);           // backdrop
  ctx.fillStyle = preset.shirt; ctx.fillRect(24, 62, 48, 34);      // shoulders
  ctx.fillStyle = preset.skin;                                      // head
  ctx.beginPath(); ctx.arc(48, 40, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = preset.hair;                                      // hair cap
  ctx.beginPath(); ctx.arc(48, 33, 21, Math.PI, 0); ctx.fill();
  ctx.fillStyle = preset.eye;                                       // eyes
  ctx.beginPath(); ctx.arc(41, 42, 2.6, 0, Math.PI * 2); ctx.arc(55, 42, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b3a3a'; ctx.lineWidth = 2;                   // mouth
  ctx.beginPath(); ctx.moveTo(43, 51); ctx.lineTo(53, 51); ctx.stroke();
  _portraitCache[charId] = c.toDataURL('image/png');
  return _portraitCache[charId];
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
      } else if (note.isSnap && typeof note.snapCharId === 'number') {
        // Snapshot of an unmasked player — a drawn portrait card (their
        // avatar's look), never a real photo nobody shared.
        const img = document.createElement('img');
        img.className = 'noteImage snapPortrait';
        img.src = drawCharPortrait(note.snapCharId);
        div.appendChild(img);
      }
      if (note.audio) {
        const player = document.createElement('audio');
        player.controls = true;
        player.src = note.audio;
        player.style.cssText = 'width:100%; height:32px; margin-top:6px;';
        div.appendChild(player);
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
      if (note.image) {
        // A picture someone sent you can become a disguise — COPY its
        // face to the drive's selfie shelf (the note itself stays put).
        const faceBtn = document.createElement('button');
        faceBtn.className = 'noteReadBtn';
        faceBtn.textContent = '📸 Save face to Drive';
        faceBtn.title = 'Copies this picture to your Hard Drive selfies — wear it as a disguise from there';
        faceBtn.addEventListener('click', () => {
          ws.send(JSON.stringify({ type: 'harddrive_save_selfie_from_note', noteId: note.id, password: pendingHdPassword }));
          setUnlockToast('📸 Saved to your Hard Drive selfies (if the drive allows it).');
        });
        div.appendChild(faceBtn);
      }
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
  if (isTouchDevice()) return; // phones: panels are full-screen — nothing to drag
  makeDraggable(document.getElementById('inventoryPanel'), document.getElementById('invTabs'));
  makeDraggable(document.getElementById('questTracker'), document.getElementById('questTracker'));
  makeDraggable(document.getElementById('attackModal'),    document.querySelector('#attackModal .floatPanelHandle'));
  makeDraggable(document.getElementById('spellbookModal'), document.querySelector('#spellbookModal .floatPanelHandle'));
  makeDraggable(document.getElementById('journalModal'),   document.querySelector('#journalModal .floatPanelHandle'));
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

// Brief full-screen red flash whenever the player takes damage (see the
// 'struck'/'you_died' handlers) — a toast alone is easy to miss if a hit
// lands while looking elsewhere, so this makes it register at a glance
// regardless of where on screen the attacker actually is.
let _damageFlashTimeout = null;
function flashDamage() {
  const el = document.getElementById('damageFlash');
  if (!el) return;
  el.classList.add('show');
  clearTimeout(_damageFlashTimeout);
  _damageFlashTimeout = setTimeout(() => el.classList.remove('show'), 120);
}

function updateHealthHud() {
  const path = document.getElementById('healthHeartPath');
  const text = document.getElementById('healthPercentText');
  if (!path || !text) return;
  const maxHp = me ? (me.maxHealth || 100) : 100;
  const hp = me ? Math.max(0, Math.round(me.health)) : 100;
  const pct = Math.max(0, Math.min(100, Math.round(100 * hp / maxHp)));
  // Vitality skill raises max HP above 100 — show the actual pool (e.g.
  // "124/136") so the bonus is visible; a base-100 player keeps the tidy "%".
  text.textContent = maxHp > 100 ? `${hp}/${Math.round(maxHp)}` : pct + '%';
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
  // 😴 Rested countdown — fades out when the window closes.
  const restedEl = document.getElementById('xpStripRested');
  if (restedEl) {
    const remain = restedUntil - Date.now();
    if (remain > 0) {
      restedEl.classList.remove('hidden');
      document.getElementById('xpStripRestedTime').textContent = Math.ceil(remain / 60000) + 'm';
    } else restedEl.classList.add('hidden');
  }
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

function updateQuestTracker(questId, questName, progress, target, where) {
  activeQuestId = questId;
  activeQuestTarget = target;
  const el = document.getElementById('questTracker');
  if (!el) return;
  el.classList.remove('hidden');
  document.getElementById('questTrackerName').textContent = questName;
  const pct = Math.min(100, Math.round(100 * progress / Math.max(1, target)));
  const fill = document.getElementById('questTrackerFill');
  fill.style.width = pct + '%';
  fill.classList.toggle('nearlyDone', pct >= 75);
  document.getElementById('questTrackerCount').textContent = `${progress} / ${target}`;
  const whereEl = document.getElementById('questTrackerWhere');
  if (whereEl) {
    whereEl.textContent = where ? `🧭 ${where}` : '';
    whereEl.style.display = where ? 'block' : 'none';
  }
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
// Journal (📜) — the per-character story campaign. Every class has its own
// 6-chapter storyline (see STORYLINES in server.js); the server owns all
// progress and sends story_state snapshots — this panel just renders the
// latest one and offers a single "Begin Chapter" action. The storyTracker
// overlay mirrors the active chapter's objective the same way questTracker
// mirrors the active side quest.
// ---------------------------------------------------------------------------
let storyState = null;     // latest story_state.storyline payload (or null)
let storyLastOutro = null; // { title, outro, rewards, storyComplete } — shown until the next chapter begins
let journalOpen = false;

function openJournal() {
  const modal = document.getElementById('journalModal');
  if (!modal) return;
  renderJournal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 370, 112);
  journalOpen = true;
  // Ask for a fresh snapshot too, in case this client missed one.
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'story_state' }));
}

function closeJournal() {
  const modal = document.getElementById('journalModal');
  if (modal) modal.classList.add('hidden');
  journalOpen = false;
}

const journalBtn = document.getElementById('journalBtn');
if (journalBtn) journalBtn.addEventListener('click', () => { if (journalOpen) closeJournal(); else openJournal(); });
const journalCloseBtn = document.getElementById('journalCloseBtn');
if (journalCloseBtn) journalCloseBtn.addEventListener('click', closeJournal);

// ---------------------------------------------------------------------------
// Class skill tree (🌟 Skills / K key) — spend the skill points earned at
// every level-up on 6 class-themed bonus skills. The server owns the truth
// (validation, effects, persistence); this panel just renders skill_state and
// sends skill_allocate / skill_respec. mySkillSpeedMult is the one effect
// applied client-side (movement), consistent with the game's speed-status model.
// ---------------------------------------------------------------------------
let mySkillState = null;      // latest skill_state payload
let mySkillSpeedMult = 1;     // 'swift' skill — read by the movement loop
let skillsOpen = false;
let myStatBlock = null;       // latest computeStatBlock (skill+gear derived stats)
let equipStatsCatalog = {};   // itemId -> stat contributions, for swap previews
// 💎 Moonstones (Session I) — premium currency. Balance is server truth,
// mirrored here for display; ms_state pushes keep it fresh.
let myMoonstones = 0;
let msPacksCatalog = null;    // packId -> { ms, cents, name } from init
let msAuctionFee = 0.10;
let legendaryCatalogClient = {};  // merged into ITEM_CATALOG at init

// ── Session L state ──────────────────────────────────────────────────────────
let dungeonLoreCatalog = null;      // tier -> { name, epithet, bossKey, plaque } from init
let calendarState = null;           // { tourney, festival, bloodMoon, peddlerNextRotationAt }
let weeklyDelveModsClient = [];     // [{ id, name, icon, desc }]
let covenSigilsCatalog = ['🕯️', '🌙', '🦇', '🐈‍⬛', '🕸️', '🌿', '⭐', '🔮', '🗝️', '🥀'];
let covenState = null;              // server coven_state payload (.coven or null)
let covenUnread = 0;
let covenChatLines = [];            // [{ who, sigil, text }] (in-memory, last 60)
let delveState = null;              // last delve_state payload
let delveSpeedMult = 1;             // swift boons — applied only inside delve rooms
let boardState = null;
let firstStepsState = null;
let pushPublicKey = null;
let pushAvailable = false;
let townPass30Cents = 499;
let townPass30Product = 'town_pass_30d';
let boardModalOpen = false, delveModalOpen = false, covenModalOpen = false, notifModalOpen = false;
// Blood-moon night math mirrored from the server (same pure clock both ends).
const BLOOD_MOON_EVERY_NIGHTS = 13;
function bloodMoonActiveClient(now) {
  now = now == null ? Date.now() : now;
  const idx = Math.floor(now / CYCLE_MS);
  return (idx % BLOOD_MOON_EVERY_NIGHTS) === 0 && (now % CYCLE_MS) >= DAY_MS;
}
let restedUntil = 0;          // 😴 rested-XP window end (epoch ms), 0 = none
let restedToastShown = false;

function updateSkillsBadge() {
  const sp = me ? (me.skillPoints || 0) : 0;
  const badge = document.getElementById('skillsBadge');
  if (badge) badge.textContent = sp > 0 ? String(sp) : '';
  // Mirror the unspent-point count onto the ☰ chip (desktop) and the
  // menu sheet's Skills row (both platforms) so it's visible from anywhere.
  for (const id of ['pcMenuBadge', 'menuSkillsBadge']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.textContent = sp > 0 ? String(sp) : '';
    el.classList.toggle('show', sp > 0);
  }
}

function openSkills() {
  const modal = document.getElementById('skillsModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 370, 150);
  skillsOpen = true;
  renderSkills();
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'skill_state' }));
}
function closeSkills() {
  const modal = document.getElementById('skillsModal');
  if (modal) modal.classList.add('hidden');
  skillsOpen = false;
}

function renderSkills() {
  const list = document.getElementById('skillsList');
  const pts = document.getElementById('skillsPointsLabel');
  const titleEl = document.getElementById('skillsTitle');
  if (!list) return;
  const st = mySkillState;
  const CLASS_TREE_NAME = ['📖 Coven Secrets', '🐺 Feral Instincts', '🕯️ Spirit Communion', '⚔️ Martial Discipline', '🥾 Road Wisdom'];
  if (titleEl && st) titleEl.textContent = '🌟 ' + (CLASS_TREE_NAME[st.charId] || 'Skills');
  // me.skillPoints is the live count (kept fresh by xp_gain/level_up); the
  // skill_state snapshot can lag a level-up that didn't re-send it.
  const sp = me ? (me.skillPoints || 0) : (st ? st.skillPoints : 0);
  if (pts) pts.textContent = sp === 1 ? '1 skill point to spend' : `${sp} skill points to spend`;
  list.innerHTML = '';
  if (!st || !st.skills) { list.textContent = 'Loading your skills…'; return; }
  for (const sk of st.skills) {
    const row = document.createElement('div');
    row.className = 'skillRow' + (sk.rank >= sk.maxRank ? ' maxed' : '');
    const icon = document.createElement('div');
    icon.className = 'skillIcon'; icon.textContent = sk.icon;
    const main = document.createElement('div');
    main.className = 'skillMain';
    const nm = document.createElement('div');
    nm.className = 'skillName'; nm.textContent = `${sk.name} — rank ${sk.rank}/${sk.maxRank}`;
    const ds = document.createElement('div');
    ds.className = 'skillDesc'; ds.textContent = sk.desc;
    const pips = document.createElement('div');
    pips.className = 'skillPips';
    for (let i = 0; i < sk.maxRank; i++) {
      const pip = document.createElement('div');
      pip.className = 'skillPip' + (i < sk.rank ? ' filled' : '');
      pips.appendChild(pip);
    }
    main.appendChild(nm); main.appendChild(ds); main.appendChild(pips);
    const buy = document.createElement('button');
    buy.className = 'skillBuy';
    buy.textContent = '+';
    const canBuy = sk.rank < sk.maxRank && sp > 0;
    buy.disabled = !canBuy;
    buy.title = sk.rank >= sk.maxRank ? 'Maxed out' : (sp > 0 ? `Spend 1 point on ${sk.name}` : 'No skill points — level up to earn more');
    buy.addEventListener('click', () => {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'skill_allocate', skillId: sk.id }));
    });
    row.appendChild(icon); row.appendChild(main); row.appendChild(buy);
    list.appendChild(row);
  }
}

const skillsBtn = document.getElementById('skillsBtn');
if (skillsBtn) skillsBtn.addEventListener('click', () => { if (skillsOpen) closeSkills(); else openSkills(); });
const skillsCloseBtn = document.getElementById('skillsCloseBtn');
if (skillsCloseBtn) skillsCloseBtn.addEventListener('click', closeSkills);
const skillsRespecBtn = document.getElementById('skillsRespecBtn');
if (skillsRespecBtn) skillsRespecBtn.addEventListener('click', () => {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'skill_respec' }));
});

function journalDiv(className, text) {
  const el = document.createElement('div');
  el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function renderJournal() {
  const c = document.getElementById('journalContent');
  if (!c) return;
  c.innerHTML = '';
  const s = storyState;
  if (!s) {
    c.appendChild(journalDiv('journalDone', 'The pages are blank… no story has found you yet.'));
    return;
  }

  const titleEl = document.getElementById('journalTitle');
  if (titleEl) titleEl.textContent = `${s.icon} ${s.title}`;

  const header = journalDiv('journalHeader');
  header.appendChild(journalDiv('journalStoryTitle', `${s.icon} ${s.title}`));
  header.appendChild(journalDiv('journalTagline', s.tagline));
  header.appendChild(journalDiv('journalChapterNo',
    s.complete ? `All ${s.totalChapters} chapters complete` : `Chapter ${s.chapterIndex + 1} of ${s.totalChapters}`));
  c.appendChild(header);

  // The whole road, drawn: every chapter as a milestone — done ✓, current
  // ➤, or ahead (with its level gate). Seeing the full arc with your pin
  // on it is what makes the remaining distance feel walkable.
  if (Array.isArray(s.arc) && s.arc.length) {
    const arcBox = journalDiv('journalArc');
    s.arc.forEach((a, i) => {
      const row = journalDiv('journalArcRow ' + a.state);
      const mark = a.state === 'done' ? '✓' : (a.state === 'current' ? '➤' : '·');
      const gate = a.state === 'ahead' && a.requiresLevel > 1 ? `  (Lv ${a.requiresLevel})` : '';
      row.textContent = `${mark} ${i + 1}. ${a.title}${gate}`;
      arcBox.appendChild(row);
    });
    c.appendChild(arcBox);
  }

  // The just-finished chapter's ending, kept on the desk until the next
  // chapter is begun.
  if (storyLastOutro) {
    const outroBox = journalDiv('journalLetter');
    outroBox.appendChild(journalDiv('journalObjLabel', `✅ ${storyLastOutro.title}`));
    outroBox.appendChild(journalDiv('', storyLastOutro.outro));
    if (storyLastOutro.rewards) outroBox.appendChild(journalDiv('journalRewards', storyLastOutro.rewards));
    c.appendChild(outroBox);
  }

  if (s.complete) {
    c.appendChild(journalDiv('journalDone',
      `${s.icon} Your story is written, and Thornreach will tell it for a long time. (Side quests and the rest of the town are still out there.)`));
  } else if (s.chapter) {
    const ch = s.chapter;
    c.appendChild(journalDiv('journalStoryTitle', `${ch.title}`));
    c.appendChild(journalDiv('journalLetter', ch.intro));

    const obj = journalDiv('journalObjective');
    obj.appendChild(journalDiv('journalObjLabel', `🎯 ${ch.objectiveLabel}`));
    if (ch.where) obj.appendChild(journalDiv('journalWhere', `🧭 ${ch.where}`));
    if (s.active) {
      const barWrap = journalDiv('journalBarWrap');
      const fill = journalDiv('journalBarFill');
      fill.style.width = Math.min(100, Math.round(100 * s.progress / Math.max(1, ch.target))) + '%';
      barWrap.appendChild(fill);
      obj.appendChild(barWrap);
      obj.appendChild(journalDiv('', `${s.progress} / ${ch.target}`));
    }
    c.appendChild(obj);

    const rewardBits = [`+${ch.xpReward} XP`];
    if (ch.goldReward) rewardBits.push(`+${ch.goldReward}🪙`);
    for (const r of ch.itemRewards || []) rewardBits.push(`${r.icon} ${r.name}${r.qty > 1 ? ' ×' + r.qty : ''}`);
    c.appendChild(journalDiv('journalRewards', `Reward: ${rewardBits.join(' · ')}`));

    if (!s.active) {
      const begin = document.createElement('button');
      begin.className = 'btn';
      begin.id = 'journalBeginBtn';
      if (ch.levelOk === false) {
        // Gated — say exactly what opens it and where you stand, so the
        // locked button reads as a goal, not a wall.
        begin.disabled = true;
        begin.textContent = `🔒 Opens at Level ${ch.requiresLevel} — you're Level ${ch.playerLevel}`;
        begin.title = 'Side quests, night hunts, harvests and dungeons all pay XP.';
      } else {
        begin.textContent = `📖 Begin Chapter ${s.chapterIndex + 1}`;
        begin.addEventListener('click', () => {
          storyLastOutro = null;
          ws.send(JSON.stringify({ type: 'story_begin' }));
        });
      }
      c.appendChild(begin);
      if (ch.levelOk === false) {
        c.appendChild(journalDiv('journalGateHint',
          '💡 Fastest XP: side quests from any shopkeeper, night hunts outside, and the dungeons below the temple.'));
      }
    }
  }

  // Active side quest, mirrored from the quest tracker so the Journal is
  // the one place to check everything you're on.
  const sq = journalDiv('journalSideQuest');
  sq.appendChild(journalDiv('jsqTitle', 'Side quest'));
  const qt = document.getElementById('questTracker');
  if (qt && !qt.classList.contains('hidden')) {
    sq.appendChild(journalDiv('', `${document.getElementById('questTrackerName').textContent} — ${document.getElementById('questTrackerCount').textContent}`));
  } else {
    sq.appendChild(journalDiv('', 'None — the town\'s NPCs always have work for you.'));
  }
  c.appendChild(sq);
}

// The small always-on overlay for the active chapter (right side, under the
// quest tracker) — same pattern as updateQuestTracker/clearQuestTracker.
function updateStoryTracker() {
  const el = document.getElementById('storyTracker');
  if (!el) return;
  const s = storyState;
  if (!s || s.complete || !s.active || !s.chapter) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  document.getElementById('storyTrackerName').textContent = `${s.icon} ${s.chapter.title}`;
  const pct = Math.min(100, Math.round(100 * s.progress / Math.max(1, s.chapter.target)));
  const fill = document.getElementById('storyTrackerFill');
  fill.style.width = pct + '%';
  // Goal-gradient glow: the bar visibly heats up near the finish line.
  fill.classList.toggle('nearlyDone', pct >= 75);
  document.getElementById('storyTrackerCount').textContent = `${s.chapter.objectiveLabel} — ${s.progress} / ${s.chapter.target}`;
  const whereEl = document.getElementById('storyTrackerWhere');
  if (whereEl) {
    whereEl.textContent = s.chapter.where ? `🧭 ${s.chapter.where}` : '';
    whereEl.style.display = s.chapter.where ? 'block' : 'none';
  }
}

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
let currentShopNpcName = null;

function openNpcShopModal(npcId) {
  currentShopNpcId = npcId;
  ws.send(JSON.stringify({ type: 'npc_shop_open', npcId }));
}

function closeNpcShopModal() {
  npcShopOpen = false;
  currentShopNpcId = null;
  currentShopNpcName = null;
  const el = document.getElementById('npcShopModal');
  if (el) el.classList.add('hidden');
}

function renderNpcShop(msg) {
  npcShopOpen = true;
  currentShopNpcId = msg.npcId;
  currentShopNpcName = msg.npcName;
  document.getElementById('npcShopTitle').textContent = `🛒 ${msg.npcName}`;
  const bal = lastBankState ? lastBankState.balance : '?';
  const balEl = document.getElementById('npcShopBalance');
  // The keeper's greeting — if you're masked, they greet the FACE, and if
  // that face is one of their regulars, the discount comes with it.
  balEl.textContent = (msg.greeting ? `“${msg.greeting}”  ·  ` : '') + `Balance: ${bal} 🪙`;
  const container = document.getElementById('npcShopItems');
  container.innerHTML = '';
  for (const item of msg.items) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.06);border-radius:8px;';
    const priceHtml = item.basePrice && item.basePrice !== item.price
      ? `<span style="color:#8a9a8a;text-decoration:line-through;font-size:11px;">${item.basePrice}</span> <span style="color:#7ddc8f;font-weight:700;">${item.price} 🪙</span>`
      : `<span style="color:#ffd700;font-weight:700;">${item.price} 🪙</span>`;
    row.innerHTML = `<span style="font-size:20px;">${item.icon}</span>
      <span style="flex:1;color:#eafff0;">${item.name}</span>
      ${priceHtml}
      <button data-item="${item.id}" style="padding:5px 14px;background:#3366aa;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Buy</button>`;
    row.querySelector('button').addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'npc_buy_item', npcId: currentShopNpcId, itemId: item.id }));
    });
    // Same shared tooltip used for inventory/equip slots elsewhere — looks
    // up stats/description from the client's own ITEM_CATALOG by id.
    row.addEventListener('mouseenter', (e) => showItemTooltip(e, item.id));
    row.addEventListener('mouseleave', hideTooltip);
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
    const npcId = currentShopNpcId, npcName = currentShopNpcName || currentShopNpcId;
    closeNpcShopModal();
    openQuestDialogue(npcId, npcName);
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
  if (_partyChatLog) {
    const line = document.createElement('div');
    line.style.cssText = 'padding:2px 0;border-bottom:1px solid rgba(100,160,255,0.08);font-size:11px;';
    const isMe = fromName === (me ? me.name : '');
    // textContent, never innerHTML — party message text comes from another
    // player and must not be parsed as markup (stored-XSS otherwise).
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = `color:${isMe ? '#88ccff' : '#ccaaff'};font-weight:700;`;
    nameSpan.textContent = fromName + ':';
    const textSpan = document.createElement('span');
    textSpan.style.color = '#ddeeff';
    textSpan.textContent = ' ' + text;
    line.appendChild(nameSpan);
    line.appendChild(textSpan);
    _partyChatLog.appendChild(line);
    _partyChatLog.scrollTop = _partyChatLog.scrollHeight;
  }
  if (MOBILE_UI && fromName !== (me ? me.name : '')) {
    spawnChatNotif({ name: '🛡️ ' + fromName, color: '#a8d8ff', text, kind: 'party' });
  }
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
  // npcName only matters server-side as a display fallback for NPCs that
  // aren't quest-givers at all (see quest_talk) — quest-givers already
  // have their own name in QUEST_CATALOG and ignore this.
  ws.send(JSON.stringify({ type: 'quest_talk', npcId, npcName }));
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

// ---------------------------------------------------------------------------
// Generic building-interior NPC hint dialogue — one modal reused by every
// non-shop, non-quest-giving NPC across every building (see npc_hint_talk).
// ---------------------------------------------------------------------------
function openNpcHintTalk(npcId) {
  ws.send(JSON.stringify({ type: 'npc_hint_talk', npcId }));
}

let currentHintNpcId = null, currentHintNpcName = null;

function showNpcHintDialogue(msg) {
  currentHintNpcId = msg.npcId || null;
  currentHintNpcName = msg.npcName || null;
  const isStone = typeof msg.npcId === 'string' && msg.npcId.startsWith('way_');
  document.getElementById('npcHintName').textContent = isStone ? msg.npcName : `💬 ${msg.npcName}`;
  document.getElementById('npcHintText').textContent = msg.message || '';
  // A standing stone has lore, not errands — no quest button on waymarkers.
  const qBtn = document.getElementById('npcHintQuestBtn');
  if (qBtn) qBtn.classList.toggle('hidden', isStone);
  document.getElementById('npcHintModal').classList.remove('hidden');
}

function closeNpcHintModal() {
  document.getElementById('npcHintModal').classList.add('hidden');
}

const npcHintCloseBtn = document.getElementById('npcHintCloseBtn');
if (npcHintCloseBtn) npcHintCloseBtn.addEventListener('click', closeNpcHintModal);

// The building locals aren't just hint machines anymore — every one of them
// has a side quest of their own now (see QUEST_CATALOG wave two in
// server.js), reachable through the same Ask-for-a-Quest flow the shop
// NPCs already had.
const npcHintQuestBtn = document.getElementById('npcHintQuestBtn');
if (npcHintQuestBtn) npcHintQuestBtn.addEventListener('click', () => {
  if (currentHintNpcId) {
    const npcId = currentHintNpcId, npcName = currentHintNpcName || currentHintNpcId;
    closeNpcHintModal();
    openQuestDialogue(npcId, npcName);
  }
});

// Full-size image viewer (Auction House selfie thumbnails) — click anywhere
// to close. window.open(dataURL) used to show a blank tab since modern
// browsers block/mishandle navigating a new window straight to a data:
// URL; this just shows it in-page instead.
function openImageLightbox(src) {
  const img = document.getElementById('imageLightboxImg');
  if (img) img.src = src;
  const modal = document.getElementById('imageLightbox');
  if (modal) modal.classList.remove('hidden');
}
function closeImageLightbox() {
  const modal = document.getElementById('imageLightbox');
  if (modal) modal.classList.add('hidden');
}
const imageLightbox = document.getElementById('imageLightbox');
if (imageLightbox) imageLightbox.addEventListener('click', closeImageLightbox);

// Lexton Greyfur's Howl Trade — his one and only offer now (the old Blood
// Pact ritual is gone). Same shape as the Witch's shop modal (item list
// with Buy buttons), opened directly by talking to him in the Wilds.
let werewolfShopOpen = false;
let werewolfShopItems = [];

function openWerewolfModal(msg) {
  werewolfShopOpen = true;
  werewolfShopItems = msg.shopItems || [];
  const modal = document.getElementById('werewolfModal');
  if (!modal) return;
  document.getElementById('werewolfGreeting').textContent = msg.greeting || '';
  const itemsEl = document.getElementById('werewolfShopItems');
  itemsEl.innerHTML = '';
  for (const item of werewolfShopItems) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(80,50,20,0.18);border-radius:8px;border:1px solid rgba(200,140,80,0.25);';
    row.innerHTML = `<span style="font-size:22px;">${item.icon}</span>
      <span style="flex:1;color:#f0d8b8;font-weight:600;">${item.name}</span>
      <span style="color:#e0a060;font-size:12px;">🎤 howl</span>
      <button data-id="${item.id}" style="padding:5px 14px;background:#8a4a1a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">Trade</button>`;
    row.querySelector('button').addEventListener('click', () => {
      document.getElementById('werewolfShopErr').textContent = '';
      ws.send(JSON.stringify({ type: 'werewolf_buy_item', itemId: item.id }));
    });
    itemsEl.appendChild(row);
  }
  document.getElementById('werewolfShopErr').textContent = '';
  modal.classList.remove('hidden');
}

function closeWerewolfModal() {
  werewolfShopOpen = false;
  const modal = document.getElementById('werewolfModal');
  if (modal) modal.classList.add('hidden');
}

const werewolfModalClose = document.getElementById('werewolfModalClose');
if (werewolfModalClose) werewolfModalClose.addEventListener('click', closeWerewolfModal);

// Voice consent modal — same requirement as the Witch's selfie consent:
// mechanical disclosure (mic, recording, public Auction House listing) has
// to stay explicit no matter how it's themed.
let werewolfConsentOpen = false;
let activeWerewolfConsentId = null;

function openWerewolfVoiceConsent(consentId, itemName, itemIcon) {
  activeWerewolfConsentId = consentId;
  werewolfConsentOpen = true;
  closeWerewolfModal();
  const modal = document.getElementById('werewolfConsentModal');
  if (!modal) return;
  document.getElementById('werewolfConsentText').textContent =
    `Lexton wants you to howl with him — a few seconds of your own voice, recorded once, then listed on the Auction House for 25 gold as payment for ${itemIcon} ${itemName}. Anyone browsing the Auction House will be able to listen to it; it's never linked to your name there. You can Allow or Decline — your microphone will not open unless you click Allow.`;
  document.getElementById('werewolfConsentStatus').textContent = '';
  document.getElementById('werewolfConsentAllowBtn').disabled = false;
  document.getElementById('werewolfConsentDenyBtn').disabled = false;
  modal.classList.remove('hidden');
}

function closeWerewolfVoiceConsent() {
  werewolfConsentOpen = false;
  activeWerewolfConsentId = null;
  const modal = document.getElementById('werewolfConsentModal');
  if (modal) modal.classList.add('hidden');
}

const werewolfConsentDenyBtn = document.getElementById('werewolfConsentDenyBtn');
if (werewolfConsentDenyBtn) werewolfConsentDenyBtn.addEventListener('click', () => {
  if (!activeWerewolfConsentId) return;
  ws.send(JSON.stringify({ type: 'werewolf_voice_payment', consentId: activeWerewolfConsentId, audio: null }));
  closeWerewolfVoiceConsent();
  setUnlockToast('Trade cancelled.');
});

const werewolfConsentAllowBtn = document.getElementById('werewolfConsentAllowBtn');
if (werewolfConsentAllowBtn) werewolfConsentAllowBtn.addEventListener('click', async () => {
  if (!activeWerewolfConsentId) return;
  const consentId = activeWerewolfConsentId;
  const statusEl = document.getElementById('werewolfConsentStatus');
  werewolfConsentAllowBtn.disabled = true;
  werewolfConsentDenyBtn.disabled = true;
  statusEl.textContent = 'Opening the mic for one howl…';
  let audio = null;
  try {
    audio = await captureHowlClip();
  } catch (e) {
    statusEl.textContent = 'Microphone unavailable — trade cancelled.';
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'werewolf_voice_payment', consentId, audio: null }));
      closeWerewolfVoiceConsent();
    }, 1600);
    return;
  }
  statusEl.textContent = 'Howl captured. Completing the trade…';
  ws.send(JSON.stringify({ type: 'werewolf_voice_payment', consentId, audio }));
  setTimeout(closeWerewolfVoiceConsent, 800);
});

// Records ~3 seconds of mic audio, encoded as a data: URL — only ever
// called after the Allow click above. Stops the mic stream immediately
// once the recording ends; nothing keeps listening afterward.
function captureHowlClip(durationMs = 3000) {
  return new Promise((resolve, reject) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      reject(new Error('Microphone not available'));
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const stop = () => stream.getTracks().forEach(t => t.stop());
        let mimeType = '';
        for (const candidate of ['audio/webm', 'audio/mp4', 'audio/ogg']) {
          if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidate)) { mimeType = candidate; break; }
        }
        let recorder;
        try {
          recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        } catch (e) { stop(); reject(e); return; }
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.onerror = (e) => { stop(); reject(e.error || new Error('Recorder error')); };
        recorder.onstop = () => {
          stop();
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Could not encode audio'));
          reader.readAsDataURL(blob);
        };
        recorder.start();
        setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, durationMs);
      })
      .catch(reject);
  });
}

function formatPrice(cents) { return '$' + (cents / 100).toFixed(2); }

function refreshUnlockUI() {
  const bar = document.getElementById('unlockBar');
  if (!bar) return;
  if (!PAYWALLS_ENABLED || !paymentsEnabled || hasTownPass()) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const priceEl = document.getElementById('unlockPrice');
  if (priceEl) priceEl.textContent = formatPrice(townPassPriceCents);
}

// Small HUD line while a pass is live. It announces when the pass turns on
// (or gets extended), then fades out of the way after 6.5s — the same
// "announce, then get out of the way" manners as the event pill and the
// location tag (a live report: the always-on banner got tiring to look at).
// The fade is keyed on passUntil, NOT the ticking text, so the per-minute
// clock update doesn't keep re-surfacing it; the text still updates silently
// underneath so a tap-to-peek always shows the real time left.
let _passHudSig = null;
let _passHudFadeTimer = null;
function refreshPassHud() {
  const tag = document.getElementById('passTag');
  if (!tag) return;
  if (hasTownPass()) {
    tag.textContent = `🎟️ Town Pass — ${passTimeLeftLabel()} left`;
    tag.classList.remove('hidden');
    const sig = String(passUntil); // one announce per pass, not per minute tick
    if (sig !== _passHudSig) {
      _passHudSig = sig;
      tag.classList.remove('tagFaded');
      clearTimeout(_passHudFadeTimer);
      _passHudFadeTimer = setTimeout(() => tag.classList.add('tagFaded'), 6500);
    }
  } else {
    tag.classList.add('hidden');
    tag.classList.remove('tagFaded');
    _passHudSig = null;
    clearTimeout(_passHudFadeTimer);
  }
}
setInterval(refreshPassHud, 30000);
// Tap the pass tag to peek at the time remaining — it re-shows the current
// count, then fades back out after another 6.5s.
(function () {
  const tag = document.getElementById('passTag');
  if (!tag) return;
  tag.style.cursor = 'pointer';
  tag.addEventListener('click', () => {
    if (!hasTownPass()) return;
    tag.textContent = `🎟️ Town Pass — ${passTimeLeftLabel()} left`;
    tag.classList.remove('tagFaded');
    clearTimeout(_passHudFadeTimer);
    _passHudFadeTimer = setTimeout(() => tag.classList.add('tagFaded'), 6500);
  });
})();
// Keep the 😴 rested countdown ticking (and let it vanish when it lapses)
// even during a stretch with no XP events.
setInterval(() => { if (gameStarted && restedUntil) updateXPDisplay(); }, 15000);

let toastTimer = null;
let lastToastText = '', lastToastAt = 0; // shared with systemChatNotif's de-dupe
function setUnlockToast(text) {
  const wrap = document.getElementById('unlockToast');
  const span = document.getElementById('unlockToastText');
  if (!wrap || !span) return;
  span.textContent = text;
  wrap.classList.remove('hidden');
  // The mobile message banners duck out of the toast's lane while it's up
  // (body.toastVisible → #chatNotifStack shifts down), and remember what
  // the toast said so systemChatNotif() doesn't repeat it as a banner.
  lastToastText = text; lastToastAt = Date.now();
  document.body.classList.add('toastVisible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    wrap.classList.add('hidden');
    document.body.classList.remove('toastVisible');
  }, 3200);
}

let lastLockMsgAt = 0;
function showLockMessage(roomId) {
  const now = Date.now();
  if (now - lastLockMsgAt < 2500) return;
  lastLockMsgAt = now;
  const label = roomId ? roomLabel(roomId) : 'this building';
  setUnlockToast(paymentsEnabled
    ? `🔒 ${label} needs a 🎟️ Town Pass — ${passPriceLabel()} for ${townPassHours}h. Visit the 🗿 statue in the Cafe or the button up top.`
    : `🔒 ${label} is closed — Town Pass sales aren't set up on this server.`);
}

fetch('/api/config')
  .then(r => r.json())
  .then(cfg => {
    paymentsEnabled = !!cfg.paymentsEnabled;
    townPassPriceCents = cfg.townPassPriceCents || townPassPriceCents;
    townPassHours = cfg.townPassHours || townPassHours;
    if (Array.isArray(cfg.lockedRooms)) lockedRooms = new Set(cfg.lockedRooms);
    refreshUnlockUI();
  })
  .catch(() => {});

// Before leaving for Stripe, ask the server to remember this exact moment
// (position, room, XP, inventory, quest — see server.js resumeStashes).
// The one-time token rides sessionStorage across the redirect; on return
// the auto-resume path below rejoins as the same player in the same spot.
function requestResumeToken(timeoutMs = 900) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !gameStarted) return resolve('');
    let done = false;
    const onMsg = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === 'resume_token') {
          done = true;
          ws.removeEventListener('message', onMsg);
          resolve(d.token || '');
        }
      } catch (e) {}
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ type: 'checkout_departure' }));
    setTimeout(() => { if (!done) { ws.removeEventListener('message', onMsg); resolve(''); } }, timeoutMs);
  });
}

// Checkout failures must be VISIBLE where the player is looking. The toast
// alone isn't enough: with the statue modal open it used to render *behind*
// the overlay (toast z-index 6 vs overlay 20), so a failing /api/checkout
// looked like the Buy button silently doing nothing. Write the reason into
// the modal's own error line too (the server terminal logs the specifics —
// "Stripe checkout error: …" — e.g. a bad STRIPE_SECRET_KEY or no network).
function showCheckoutProblem(message) {
  setUnlockToast('⚠️ ' + message);
  const err = document.getElementById('passModalErr');
  if (err && passModalOpen) err.textContent = '⚠️ ' + message;
}

async function startPassCheckout(btn, product) {
  // In the mobile apps StoreKit / Play Billing handles digital goods (their
  // rules) — config.js + mobile-payments.js install this hook there. On the
  // web the hook is simply absent and Stripe Checkout proceeds below.
  if (window.TOWNCHAT_IAP) {
    if (product === 'pass30' && window.TOWNCHAT_IAP.buyProduct) return window.TOWNCHAT_IAP.buyProduct(townPass30Product, btn);
    if (window.TOWNCHAT_IAP.buyPass) return window.TOWNCHAT_IAP.buyPass(btn);
  }
  const restore = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  try {
    const token = await requestResumeToken();
    if (token) {
      sessionStorage.setItem('tc_resume', JSON.stringify({ token, name: me ? me.name : '', at: Date.now() }));
    }
  } catch (e) {} // no token just means the old return-to-join-screen behavior
  fetch(apiUrlMaybe('/api/checkout'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product: product === 'pass30' ? 'pass30' : 'pass' })
  })
    .then(r => r.json())
    .then(data => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        showCheckoutProblem(data.error || 'Could not start checkout.');
        if (btn) { btn.disabled = false; btn.textContent = restore; }
      }
    })
    .catch(() => {
      showCheckoutProblem('Could not reach the server — is it still running?');
      if (btn) { btn.disabled = false; btn.textContent = restore; }
    });
}

const unlockBtn = document.getElementById('unlockBtn');
if (unlockBtn) {
  unlockBtn.addEventListener('click', () => startPassCheckout(unlockBtn));
}

// State shared between the checkout-return check (runs at load, below) and
// the auto-resume + init paths further down: whether this page load IS a
// bounce-back from Stripe, a toast to show once the world exists, and a
// session id to re-claim on the live connection after verification.
let returnedFromCheckout = false;
let resumeFallbackName = '';
let pendingReturnToast = '';
let pendingPassClaim = '';
function claimPassOnConnection(force) {
  // Only send once actually joined (the server drops claims from
  // pre-join connections); the init handler calls with force=true at the
  // exact moment the join lands.
  if (pendingPassClaim && ws && ws.readyState === WebSocket.OPEN && (gameStarted || force)) {
    ws.send(JSON.stringify({ type: 'claim_pass', sessionId: pendingPassClaim }));
    pendingPassClaim = '';
  }
}

(function checkReturnFromCheckout() {
  const params = new URLSearchParams(location.search);
  // Legacy param names still land in the same place — one pass product now.
  const sessionId = params.get('pass_session') || params.get('unlock_session') || params.get('room_pass_session');
  const msSessionId = params.get('ms_session');
  const canceled = params.get('pass_cancel') === '1';
  if (msSessionId) {
    // Bounce-back from a Moonstone-pack checkout — verify with the server
    // (replay-proof there), toast the result once the world exists, and
    // resume the stashed session exactly like the pass flow below.
    returnedFromCheckout = true;
    history.replaceState(null, '', location.pathname + (params.get('testdrive') === '1' ? '?testdrive=1' : ''));
    let acctToken = '';
    try { const a = JSON.parse(localStorage.getItem('tc_account') || 'null'); if (a && a.token) acctToken = a.token; } catch (e) {}
    fetch(apiUrlMaybe('/api/verify-ms-session?session_id=' + encodeURIComponent(msSessionId)
          + (acctToken ? '&account_token=' + encodeURIComponent(acctToken) : '')))
      .then(r => r.json())
      .then(data => {
        if (data.granted) setUnlockToast('💎 +' + data.granted + ' Moonstones! You now carry ' + data.balance + '.');
        else if (data.balance != null) setUnlockToast('💎 That purchase was already credited — you carry ' + data.balance + '.');
        else setUnlockToast('⚠️ ' + (data.error || 'Could not verify the Moonstone purchase.'));
        myMoonstones = data.balance != null ? data.balance : myMoonstones;
        refreshMsUI();
      })
      .catch(() => setUnlockToast('⚠️ Could not verify the Moonstone purchase — it will retry next visit.'));
    // The verify fetch, the auto-resume join's init snapshot, and the
    // server's ms_state push can interleave in any order — re-ask after the
    // dust settles so the balance shown is always the server's last word.
    const askMsBalance = () => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ms_balance' })); };
    setTimeout(askMsBalance, 2500);
    setTimeout(askMsBalance, 6000);
    return;
  }
  if (!sessionId && !canceled) return;
  returnedFromCheckout = true;
  // Strip the checkout params but keep the harness seam alive if present.
  history.replaceState(null, '', location.pathname + (params.get('testdrive') === '1' ? '?testdrive=1' : ''));
  if (canceled) {
    pendingReturnToast = '↩️ Checkout canceled — no charge. Welcome back.';
    return;
  }
  let acctToken = '';
  try { const a = JSON.parse(localStorage.getItem('tc_account') || 'null'); if (a && a.token) acctToken = a.token; } catch (e) {}
  fetch('/api/verify-session?session_id=' + encodeURIComponent(sessionId)
        + (acctToken ? '&account_token=' + encodeURIComponent(acctToken) : ''))
    .then(r => r.json())
    .then(data => {
      if (data.unlocked) {
        storePassReceipt(sessionId, data.expiresAt || (Date.now() + townPassHours * 3600 * 1000));
        setUnlockToast(`✅ Town Pass active — 👻 Phantom Parlor + 🎮 Starlight Arcade open for ${passTimeLeftLabel()}!`);
        refreshUnlockUI();
        refreshPassHud();
        refreshBuildingLockVisuals();
        // Stamp the pass onto the LIVE connection too — the auto-resumed
        // join may have raced ahead of this verification.
        pendingPassClaim = sessionId;
        claimPassOnConnection();
      } else {
        setUnlockToast('⚠️ ' + (data.error || 'Payment was not completed.'));
      }
    })
    .catch(() => setUnlockToast('⚠️ Could not verify payment.'));
})();

// ---------------------------------------------------------------------------
// System chat lines + town-wide announcements. Toasts vanish in 3 seconds;
// these give story/quest/combat beats a persistent, scrollable history in
// the chat log (missed a toast? it's in the log), and campaign finales get
// a whole-town banner moment.
// ---------------------------------------------------------------------------
function appendSystemChatLine(text) {
  if (!currentRoom) return;
  if (!messagesByRoom[currentRoom]) messagesByRoom[currentRoom] = [];
  messagesByRoom[currentRoom].push({ system: true, text, ts: Date.now() });
  if (typeof renderChatLog === 'function') renderChatLog();
  systemChatNotif(text); // phones have no log — banner it (unless a toast just said it)
}

let announceTimer = null;
function showAnnounceBanner(text) {
  const el = document.getElementById('announceBanner');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.remove('announceIn'); void el.offsetWidth; // restart the animation
  el.classList.add('announceIn');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => el.classList.add('hidden'), 6000);
}

// A short center-screen ceremony for chapter completions — the peak-end
// beat. Pure presentation: shows, breathes, fades.
let ceremonyTimer = null;
function showChapterCeremony(title, subtitle) {
  const el = document.getElementById('ceremonyOverlay');
  if (!el) return;
  document.getElementById('ceremonyTitle').textContent = title;
  document.getElementById('ceremonySub').textContent = subtitle || '';
  el.classList.remove('hidden');
  el.classList.remove('ceremonyIn'); void el.offsetWidth;
  el.classList.add('ceremonyIn');
  clearTimeout(ceremonyTimer);
  ceremonyTimer = setTimeout(() => el.classList.add('hidden'), 3400);
}

// ---------------------------------------------------------------------------
// Countermeasures (client side) — the Hard Drive's selfies & voice clips
// as combat tools. The server owns all the rules (cm_voice / cm_disguise /
// snap_player handlers); this is capture, presentation, and two hotkeys:
//   V — play your selected voice clip to evade whatever's on you
//   P — snap a photo of the nearest player (what you get is what you SEE)
// ---------------------------------------------------------------------------
let cmClips = [];            // [{id,label}] — light list from cm_state
let cmSelfies = [];          // [{id,of}]
let cmSelectedClipId = null;
let cmHasDrive = false;
let lastAttackedClientAt = 0;
let myEvasionUntil = 0;
let cmPromptTimer = null;

function requestCmState() {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'cm_state' }));
}

function noteUnderAttack() {
  lastAttackedClientAt = Date.now();
  const prompt = document.getElementById('cmPrompt');
  if (!prompt) return;
  if (!cmHasDrive || !cmClips.length) return; // nothing to offer yet
  const clip = cmClips.find(c => c.id === cmSelectedClipId) || cmClips[0];
  document.getElementById('cmPromptText').textContent = `V — play "${clip.label}" to slip away`;
  prompt.classList.remove('hidden');
  clearTimeout(cmPromptTimer);
  cmPromptTimer = setTimeout(() => prompt.classList.add('hidden'), 6000);
}

function fireVoiceCountermeasure() {
  if (!me || me.isDead) return;
  if (!cmClips.length) {
    if (cmHasDrive) setUnlockToast('💽 No voice clips on your drive — record one in the Hard Drive panel.');
    return;
  }
  const clip = cmClips.find(c => c.id === cmSelectedClipId) || cmClips[0];
  ws.send(JSON.stringify({ type: 'cm_voice', clipId: clip.id }));
  const prompt = document.getElementById('cmPrompt');
  if (prompt) prompt.classList.add('hidden');
}

function snapNearestPlayer() {
  if (!me || me.isDead) return;
  let best = null, bestDist = Infinity;
  for (const id in players) {
    if (id === myId) continue;
    const p = players[id];
    if (p.room !== me.room || p.isDead) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  if (!best || bestDist > 140) {
    setUnlockToast('📷 No one close enough for a snapshot.');
    return;
  }
  ws.send(JSON.stringify({ type: 'snap_player', targetId: best.id }));
  setUnlockToast(`📷 *click* — ${best.disguiseName || best.name}`);
}

// Expanding sound-rings in the world where a clip went off, so the noise
// has a visible source even for players who miss the audio.
const activeVoiceRings = [];
function spawnVoiceRings(room, x, y) {
  const scene = sceneForRoom(room);
  if (!scene || !window.THREE) return;
  const pos = getRenderPos({ x, y, room });
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.RingGeometry(6, 8, 40);
    const mat = new THREE.MeshBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 3 + i * 1.5, pos.z);
    scene.add(ring);
    activeVoiceRings.push({ ring, scene, born: performance.now(), delay: i * 260 });
  }
}
function updateVoiceRings() {
  const now = performance.now();
  for (let i = activeVoiceRings.length - 1; i >= 0; i--) {
    const r = activeVoiceRings[i];
    const age = now - r.born - r.delay;
    if (age < 0) continue;
    const t = age / 1400;
    if (t >= 1) {
      r.scene.remove(r.ring);
      r.ring.geometry.dispose(); r.ring.material.dispose();
      activeVoiceRings.splice(i, 1);
      continue;
    }
    const s = 1 + t * 9;
    r.ring.scale.set(s, s, 1);
    r.ring.material.opacity = 0.85 * (1 - t);
  }
}

let cmAudioEl = null;
function playVoiceCountermeasure(msg) {
  // Hear it (one clip at a time — a new one replaces a still-playing one),
  // see it, and read it — whoever is nearby gets all three.
  try {
    if (cmAudioEl) { cmAudioEl.pause(); }
    cmAudioEl = new Audio(msg.audio);
    cmAudioEl.volume = 0.9;
    cmAudioEl.play().catch(() => {});
  } catch (e) {}
  // Proximity delivery means this only ever arrives for my own room.
  spawnVoiceRings(me ? me.room : 'outside', msg.x, msg.y);
  if (msg.playerId === myId) {
    myEvasionUntil = Date.now() + (msg.evadeMs || 4000);
  } else {
    setUnlockToast(`📢 ${msg.from}'s voice echoes: "${msg.label}"`);
  }
  appendSystemChatLine(`📢 ${msg.from} played "${msg.label}" — the night scattered.`);
}

// Ghosty shimmer on your own body while the evasion window is live, so
// "I'm untouchable right now" is legible without reading a timer.
function updateEvasionVisual() {
  const v = visuals[myId];
  if (!v || !v.group) return;
  const evading = myEvasionUntil > Date.now();
  v.group.traverse(o => {
    if (o.isMesh && o.material && o.material.transparent !== undefined) {
      if (evading) {
        if (o.userData._preEvadeOpacity === undefined) {
          o.userData._preEvadeOpacity = o.material.opacity;
          o.userData._preEvadeTransparent = o.material.transparent;
          o.material.transparent = true;
        }
        o.material.opacity = 0.35 + 0.25 * Math.sin(performance.now() / 90);
      } else if (o.userData._preEvadeOpacity !== undefined) {
        o.material.opacity = o.userData._preEvadeOpacity;
        o.material.transparent = o.userData._preEvadeTransparent;
        delete o.userData._preEvadeOpacity;
        delete o.userData._preEvadeTransparent;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Disguises (client side) — someone wearing a selfie renders with that
// picture as a paper-mask over their face, and their nameplate shows the
// borrowed name. The heavy image arrives once via 'disguise_state' and is
// cached here; the 70ms state stream only carries disguiseName.
// ---------------------------------------------------------------------------
const disguiseImages = {}; // playerId -> data URL (null/absent = unmasked)

function applyDisguiseState(id, name, image) {
  if (image) disguiseImages[id] = image; else delete disguiseImages[id];
  const p = players[id];
  if (p) p.disguiseName = name || null;
  if (id === myId) requestCmState(); // keep the drive panel's "wearing" state fresh
  refreshDisguiseVisual(id);
}

function refreshDisguiseVisual(id) {
  const v = visuals[id];
  if (!v || !v.group) return;
  const p = players[id];
  const image = disguiseImages[id];
  // Nameplate: borrowed name while masked (with a tiny 🎭 tell in the
  // tooltip position — the NAME is the deception, the tag stays subtle).
  if (v.nameEl && p) v.nameEl.textContent = p.disguiseName ? p.disguiseName : p.name;
  // Mask mesh
  if (v.maskMesh) {
    v.group.remove(v.maskMesh);
    if (v.maskMesh.material.map) v.maskMesh.material.map.dispose();
    v.maskMesh.geometry.dispose(); v.maskMesh.material.dispose();
    v.maskMesh = null;
  }
  if (!image || !p || !p.disguiseName) return;
  const img = new Image();
  img.onload = () => {
    if (!visuals[id] || disguiseImages[id] !== image) return; // stale by the time it loaded
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    // Circular crop with a paper-white rim — reads as a held-up photo, so
    // it's charming rather than uncanny, and clearly a MASK up close.
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2); ctx.clip();
    const scale = Math.max(size / img.width, size / img.height);
    ctx.drawImage(img, (size - img.width * scale) / 2, (size - img.height * scale) / 2, img.width * scale, img.height * scale);
    ctx.lineWidth = 7; ctx.strokeStyle = '#f4ead8';
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2); ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const r = CHAR.headR * 1.35;
    const mask = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat);
    mask.position.set(0, CHAR.headY, CHAR.headR * 0.98);
    const vNow = visuals[id];
    vNow.maskMesh = mask;
    vNow.group.add(mask);
  };
  img.src = image;
}

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
  if (jumpActive || typing || passModalOpen || msModalOpen || legendModalOpen || arcadeModalOpen || bankModalOpen || auctionModalOpen || sendMoneyModalOpen || spellConsentOpen || howlConsentOpen || npcShopOpen || witchShopOpen || witchConsentOpen || werewolfShopOpen || werewolfConsentOpen || seatedAt) return;
  jumpActive = true;
  jumpT = 0;
}

window.addEventListener('keydown', (e) => {
  if (typing || passModalOpen || msModalOpen || legendModalOpen || arcadeModalOpen || bankModalOpen || auctionModalOpen || sendMoneyModalOpen || spellConsentOpen || howlConsentOpen || npcShopOpen || witchShopOpen || witchConsentOpen || werewolfShopOpen || werewolfConsentOpen) return;
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

// ── Mobile mode ─────────────────────────────────────────────────────────────
// One switch, decided once at boot. Everything mobile hangs off the
// body.touchMode class (CSS) and this flag (behavior).
const MOBILE_UI = isTouchDevice();
if (MOBILE_UI) document.body.classList.add('touchMode');

// ── Movement: floating joystick (mobile) ───────────────────────────────────
// The old joystick was a fixed ring at the bottom-RIGHT — exactly where the
// ability bar and the door/portal button also lived, which is how taps
// kept landing on the wrong thing. Now the whole lower-left of the screen
// is the movement zone: touch anywhere there and the stick base appears
// under your thumb (the "floating joystick" every modern mobile title
// uses); lift and it ghosts back to a resting hint. The right side of the
// screen belongs to camera drags and the action wheel.
const joystickEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
let joyVec = { x: 0, y: 0 };
let joyActive = false, joyOrigin = { x: 0, y: 0 }, joyTouchId = null;

const JOY_BASE = MOBILE_UI ? 128 : 110;   // ring diameter (px)
const JOY_KNOB = MOBILE_UI ? 56 : 46;
const JOY_MAX = MOBILE_UI ? 48 : 40;      // knob travel radius

function placeJoystick(cx, cy) {
  joystickEl.style.left = (cx - JOY_BASE / 2) + 'px';
  joystickEl.style.top = (cy - JOY_BASE / 2) + 'px';
}
function centerStick() {
  stickEl.style.left = ((JOY_BASE - JOY_KNOB) / 2) + 'px';
  stickEl.style.top = ((JOY_BASE - JOY_KNOB) / 2) + 'px';
}
function joyRestingSpot() {
  return { x: Math.min(window.innerWidth * 0.22, 130), y: window.innerHeight - Math.max(120, window.innerHeight * 0.18) };
}
function restJoystick() {
  const r = joyRestingSpot();
  placeJoystick(r.x, r.y);
  centerStick();
  joystickEl.classList.add('resting');
}

const joyZone = document.getElementById('joyZone');
if (joyZone && MOBILE_UI) {
  joyZone.addEventListener('touchstart', (e) => {
    if (joyTouchId !== null) return;
    const t = e.changedTouches[0];
    joyTouchId = t.identifier;
    joyActive = true;
    joyOrigin = { x: t.clientX, y: t.clientY };
    placeJoystick(t.clientX, t.clientY);
    centerStick();
    joystickEl.classList.remove('resting');
    e.preventDefault();
  }, { passive: false });
  joyZone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      let dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y;
      const dist = Math.min(JOY_MAX, Math.hypot(dx, dy));
      const ang = Math.atan2(dy, dx);
      dx = Math.cos(ang) * dist; dy = Math.sin(ang) * dist;
      stickEl.style.left = ((JOY_BASE - JOY_KNOB) / 2 + dx) + 'px';
      stickEl.style.top = ((JOY_BASE - JOY_KNOB) / 2 + dy) + 'px';
      joyVec = { x: dx / JOY_MAX, y: dy / JOY_MAX };
    }
    e.preventDefault();
  }, { passive: false });
  const joyEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== joyTouchId) continue;
      joyTouchId = null;
      joyActive = false; joyVec = { x: 0, y: 0 };
      restJoystick();
    }
  };
  joyZone.addEventListener('touchend', joyEnd);
  joyZone.addEventListener('touchcancel', joyEnd);
} else {
  // Desktop with a touchscreen laptop etc. — the legacy fixed ring still
  // works if it's ever shown: touch it directly.
  joystickEl.addEventListener('touchstart', (e) => {
    joyActive = true;
    const rect = joystickEl.getBoundingClientRect();
    joyOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    e.preventDefault();
  }, { passive: false });
  joystickEl.addEventListener('touchmove', (e) => {
    if (!joyActive) return;
    const t = e.touches[0];
    let dx = t.clientX - joyOrigin.x, dy = t.clientY - joyOrigin.y;
    const dist = Math.min(JOY_MAX, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    dx = Math.cos(ang) * dist; dy = Math.sin(ang) * dist;
    stickEl.style.left = (32 + dx) + 'px';
    stickEl.style.top = (32 + dy) + 'px';
    joyVec = { x: dx / JOY_MAX, y: dy / JOY_MAX };
    e.preventDefault();
  }, { passive: false });
  joystickEl.addEventListener('touchend', () => {
    joyActive = false; joyVec = { x: 0, y: 0 };
    stickEl.style.left = '32px'; stickEl.style.top = '32px';
  });
}

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
// Only a mousedown that actually started on the canvas counts as a
// potential click — without this, a stray window-level mouseup (releasing
// a click on a HUD button, or a synthetic event) would also raycast into
// the 3D world and, for ground-targeted spells like Stumble Hex, place a
// sigil whereever that ray happened to hit — a UI button click has no
// on-canvas mousedown behind it, so it must never reach handleCanvasClick.
let clickOriginatedOnCanvas = false;

canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  clickOriginatedOnCanvas = true;
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
  if (clickOriginatedOnCanvas && dragMoved < CLICK_DRAG_THRESHOLD) handleCanvasClick(e.clientX, e.clientY);
  clickOriginatedOnCanvas = false;
});
window.addEventListener('mouseleave', () => { dragging = false; });

// ---------------------------------------------------------------------------
// Hover-only nameplates — with several players/NPCs standing close together
// the always-on labels got overwhelming, so both the DOM player tags (see
// syncLabels()) and the 3D NPC name sprites (see makeNpcNameSprite()) only
// show up while the mouse is over the character, not just always-on.
// Skipped on touch devices — there's no hover there, and hiding every name
// with no way to ever reveal one would be worse than the clutter this is
// fixing.
//
// The label itself floats above a character's head, but "hover over the
// character" should mean the whole body, not a tiny dot up there — so the
// hit zone is a tall rectangle anchored at the label's screen position and
// extending mostly downward (toward where the body actually renders) with
// a little headroom above, rather than a small circle centered on the label.
// ---------------------------------------------------------------------------
const NAME_HOVER_ENABLED = !isTouchDevice();
const NAME_HOVER_ZONE = { halfWidth: 40, above: 20, below: 170 };
// Mobile name labels announce on approach, then fade out of the way after a
// few seconds (live report: "Torchkeeper Ada has a persistent banner") — walk
// away and back to see one again. Same "announce, then get out of the way"
// manners as the event pill and the Town Pass tag.
const NAME_SHOW_MS = 6500, NAME_FADE_MS = 500;
const HOVER_NAME_SPRITES = []; // every sprite made by makeNpcNameSprite()
const _hoverTmpVec3 = new THREE.Vector3();
let hoverMouseX = -9999, hoverMouseY = -9999, hoverMouseActive = false;
if (NAME_HOVER_ENABLED) {
  window.addEventListener('mousemove', (e) => {
    hoverMouseX = e.clientX; hoverMouseY = e.clientY; hoverMouseActive = true;
  });
  window.addEventListener('mouseleave', () => { hoverMouseActive = false; });
}
function isScreenPosHovered(screenX, screenY) {
  if (!NAME_HOVER_ENABLED) return true;
  if (!hoverMouseActive || anyOverlayOpen()) return false;
  // While the camera is being dragged, the cursor isn't "pointing at"
  // anything — it's steering. Without this, orbiting past an NPC lights
  // their nameplate up mid-drag, right in the middle of the view.
  if (dragging && dragMoved >= CLICK_DRAG_THRESHOLD) return false;
  return Math.abs(hoverMouseX - screenX) < NAME_HOVER_ZONE.halfWidth
    && hoverMouseY > screenY - NAME_HOVER_ZONE.above
    && hoverMouseY < screenY + NAME_HOVER_ZONE.below;
}
// Walks all the way up to the THREE.Scene an object currently lives in, so
// a name sprite belonging to a scene that isn't being rendered right now
// (e.g. an indoor NPC while you're out in town) never gets screen-projected
// through the wrong camera and shown by coincidence.
function getRootScene(obj) {
  let o = obj;
  while (o.parent) o = o.parent;
  return o;
}
function updateNameLabelHover() {
  for (const sprite of HOVER_NAME_SPRITES) {
    if (!sprite.parent || !activeScene || getRootScene(sprite) !== activeScene) { sprite.visible = false; continue; }
    if (!NAME_HOVER_ENABLED) {
      // Mobile: NPC name signs used to be always-on (no hover on touch),
      // stacking a wall of banners over every busy area. Show them like
      // shop signs instead: only once you're close enough that they're
      // the thing you're walking toward.
      if (me) {
        sprite.getWorldPosition(_hoverTmpVec3);
        const rp = getRenderPos(me);
        const d = Math.hypot(_hoverTmpVec3.x - rp.x, _hoverTmpVec3.z - rp.z);
        // Near the camera, a scaled sprite becomes a screen-filling
        // banner — exactly what happens orbiting the camera past an NPC
        // at your back. If the camera is basically inside the sign,
        // hide it; it carries no information at that range anyway.
        let camTooClose = false;
        if (activeCamera) {
          const dx = _hoverTmpVec3.x - activeCamera.position.x;
          const dy = _hoverTmpVec3.y - activeCamera.position.y;
          const dz = _hoverTmpVec3.z - activeCamera.position.z;
          camTooClose = (dx * dx + dy * dy + dz * dz) < 110 * 110;
        }
        const inRange = d <= 190 && !camTooClose;
        if (!inRange) {
          sprite.visible = false;
          sprite.userData._nameSeenAt = 0; // out of range → re-approaching re-announces
        } else {
          // In range: hold the label for NAME_SHOW_MS, then fade it out so it
          // stops sitting on screen the whole time you're near the character.
          if (!sprite.userData._nameSeenAt) sprite.userData._nameSeenAt = performance.now();
          const elapsed = performance.now() - sprite.userData._nameSeenAt;
          const op = elapsed <= NAME_SHOW_MS ? 1 : Math.max(0, 1 - (elapsed - NAME_SHOW_MS) / NAME_FADE_MS);
          if (sprite.material) sprite.material.opacity = op;
          sprite.visible = op > 0.02;
        }
      } else {
        sprite.visible = false;
      }
      continue;
    }
    sprite.getWorldPosition(_hoverTmpVec3);
    const screen = worldToScreen(_hoverTmpVec3.x, _hoverTmpVec3.y, _hoverTmpVec3.z);
    sprite.visible = screen.visible && isScreenPosHovered(screen.x, screen.y);
  }
}

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
  } else if (activeScene === emberScene) {
    for (const id in emberMobVisuals) {
      const v = emberMobVisuals[id];
      if (v.group.visible) list.push(v.group);
    }
  }
  // Loot icons live in whichever scene their corpse belongs to (see
  // updateLootIcons()) — a flat scan works here since each sprite's own
  // .visible/.parent already narrow it down to "currently showing in the
  // scene we're about to raycast against".
  for (const key in lootIconVisuals) {
    const sprite = lootIconVisuals[key];
    if (sprite.visible && sprite.parent === activeScene) list.push(sprite);
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
    sendMoneyModalOpen || spellConsentOpen || howlConsentOpen || inventoryOpen || npcShopOpen || witchShopOpen || witchConsentOpen || werewolfShopOpen || werewolfConsentOpen;
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
// target dropdown; the next valid click/tap fires it at whatever's under
// the cursor, the same gesture as the universal Strike below. Escape (see
// the keydown chain) or clicking something invalid cancels it. Most
// curse-attacks/spells only ever target players; Fireball (the one
// damage-dealing spell) can also hit animals/mobs, same targets as Strike —
// see canTargetMobs below, driven off the same 'damage' effect flag the
// server checks.
// ---------------------------------------------------------------------------
let armedTarget = null; // { msgType, idField, attackId, name, canTargetMobs, groundTargeting, cursor } or null

function armTargeting(msgType, idField, attackId, name, canTargetMobs, cursor, groundTargeting) {
  armedTarget = { msgType, idField, attackId, name, canTargetMobs: !!canTargetMobs, groundTargeting: !!groundTargeting, cursor: cursor || SWORD_CURSOR };
  const banner = document.getElementById('targetingBanner');
  if (banner) {
    const what = groundTargeting ? 'the ground to place it' : canTargetMobs ? 'a player or creature' : 'a player';
    // Phones have no Esc key and no pointer cursor — the banner itself is
    // the cancel button there (wired below), and the copy says so.
    document.getElementById('targetingBannerText').textContent = MOBILE_UI
      ? `🎯 ${name} — tap ${what} · ✕ tap here to cancel`
      : `🎯 ${name} — click ${what} (Esc to cancel)`;
    banner.classList.remove('hidden');
  }
}
// Tapping/clicking the banner always disarms — the only cancel a phone
// has, and a handy big target on desktop too.
(function wireTargetingBannerCancel() {
  const banner = document.getElementById('targetingBanner');
  if (!banner) return;
  banner.addEventListener('click', cancelTargeting);
  banner.addEventListener('touchstart', (e) => { e.preventDefault(); cancelTargeting(); }, { passive: false });
})();

function cancelTargeting() {
  armedTarget = null;
  const banner = document.getElementById('targetingBanner');
  if (banner) banner.classList.add('hidden');
}

const ATTACKABLE_KINDS = new Set(['player', 'animal', 'mob', 'animal2', 'mob2', 'dungeon', 'ember_mob']);

function isValidArmedTarget(hit) {
  return !!hit && (hit.kind === 'player' || (armedTarget.canTargetMobs && ATTACKABLE_KINDS.has(hit.kind)));
}

// Ground-targeted spells (currently just Stumble Hex) resolve against the
// flat y=0 ground plane instead of an entity hit — a plain ray/plane
// intersection works the same in every scene (outdoor, wilds, indoors,
// dungeon) without needing each scene's actual ground mesh.
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _groundHitVec = new THREE.Vector3();
function raycastGroundAt(clientX, clientY) {
  if (!activeCamera) return null;
  ndcFromClient(clientX, clientY);
  raycaster.setFromCamera(pointerNDC, activeCamera);
  return raycaster.ray.intersectPlane(GROUND_PLANE, _groundHitVec) ? { x: _groundHitVec.x, z: _groundHitVec.z } : null;
}

// Inverse of getRenderPos() — scene-space {x,z} back to world-space {x,y}
// for whatever room the player is currently in, so a ground click can be
// sent to the server in the same coordinate space player.x/y already use.
function sceneToWorldPos(room, sceneX, sceneZ) {
  if (room === 'outside' || room === 'wilds' || (typeof room === 'string' && room.startsWith('dungeon_')) || room === 'witch_cave' || room === 'bank_vault' || room === 'ember_wastes' || !world) {
    return { x: sceneX, y: sceneZ };
  }
  const b = world.buildings.find(bb => bb.id === room);
  if (!b) return { x: sceneX, y: sceneZ };
  return { x: sceneX / INDOOR_SCALE + b.x, y: sceneZ / INDOOR_SCALE + b.y };
}

window.addEventListener('mousemove', (e) => {
  if (!gameStarted || anyOverlayOpen()) { canvas.style.cursor = 'default'; return; }
  if (armedTarget && armedTarget.groundTargeting) {
    canvas.style.cursor = raycastGroundAt(e.clientX, e.clientY) ? armedTarget.cursor : 'default';
    return;
  }
  const hit = raycastHitAt(e.clientX, e.clientY);
  if (armedTarget) {
    canvas.style.cursor = isValidArmedTarget(hit) ? armedTarget.cursor : 'default';
    return;
  }
  if (hit && ATTACKABLE_KINDS.has(hit.kind)) canvas.style.cursor = SWORD_CURSOR;
  else if (hit && (hit.kind === 'decor' || hit.kind === 'loot')) canvas.style.cursor = 'pointer';
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

// ---------------------------------------------------------------------------
// Fireball VFX — a lobbed glowing orb (matching the Ember Wastes portal/
// torch look: simple emissive spheres + a colored PointLight, no particle
// system, same low-poly style as the rest of this game) that flies caster
// to target on every 'spell_fx' broadcast, then bursts into a brief flash
// on arrival. Purely cosmetic — the server has already applied the damage
// by the time this plays; every client in the room (caster, target, and
// bystanders alike) gets the same broadcast, so everyone sees it land.
// ---------------------------------------------------------------------------
const FIREBALL_FLIGHT_MS = 450;
const FIREBALL_IMPACT_MS = 350;
const FIREBALL_ARC_HEIGHT = 40;
let activeFireballs = [];

function sceneForRoom(room) {
  if (room === 'outside') return outdoorScene || null;
  if (room === 'wilds') return wildsScene || null;
  if (room === 'witch_cave') return caveScene || null;
  if (room === 'bank_vault') return vaultScene || null;
  if (room === 'ember_wastes') return emberScene || null;
  if (typeof room === 'string' && room.startsWith('dungeon_')) return dungeonScene || null;
  if (!world || !world.buildings.find(b => b.id === room)) return null;
  const rec = getInteriorScene(room);
  return rec ? rec.scene : null;
}

// Mob/animal targets aren't in `players` — their visuals objects (built as
// each pool syncs in) already track render-space x/y directly (see e.g.
// updateDungeonMobVisuals: `v.mesh.position.set(v.x, 0, v.y)`), so no
// getRenderPos() conversion is needed for these, unlike a player target.
function mobRenderPos(targetType, targetId) {
  const visualsMap = {
    animal: animalVisuals, mob: mobVisuals,
    animal2: animalVisuals2, mob2: mobVisuals2,
    dungeon: dungeonMobVisuals, ember_mob: emberMobVisuals
  }[targetType];
  const v = visualsMap && visualsMap[targetId];
  return v ? { x: v.x, z: v.y } : null;
}

// opts: { reverse, coreColor, glowColor, lightColor } — Leech Hex reuses
// this with reverse:true (the orb flies target -> caster, stolen life
// returning home) and crimson colors instead of fire orange.
function spawnFireballFx(casterId, targetId, targetType, opts) {
  opts = opts || {};
  const caster = players[casterId];
  if (!caster) return;
  const scene = sceneForRoom(caster.room);
  if (!scene) return;
  let from = getRenderPos(caster);
  let to;
  if (!targetType || targetType === 'player') {
    const target = players[targetId];
    if (!target) return;
    to = getRenderPos(target);
  } else {
    to = mobRenderPos(targetType, targetId);
    if (!to) return;
  }
  if (opts.reverse) { const tmp = from; from = to; to = tmp; }

  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(9, 10, 8),
    new THREE.MeshBasicMaterial({ color: opts.coreColor || 0xffdd66 })
  );
  g.add(core);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(15, 10, 8),
    new THREE.MeshBasicMaterial({ color: opts.glowColor || 0xff5500, transparent: true, opacity: 0.55 })
  );
  g.add(glow);
  const light = new THREE.PointLight(opts.lightColor || 0xff6a00, 2.4, 260);
  g.add(light);
  g.position.set(from.x, CHAR.shoulderY, from.z);
  scene.add(g);

  activeFireballs.push({
    group: g, core, glow, light, scene,
    fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z,
    startAt: performance.now(), phase: 'flight'
  });
}

function updateFireballs() {
  if (!activeFireballs.length) return;
  const now = performance.now();
  for (let i = activeFireballs.length - 1; i >= 0; i--) {
    const fb = activeFireballs[i];
    if (fb.phase === 'flight') {
      const t = Math.min(1, (now - fb.startAt) / FIREBALL_FLIGHT_MS);
      fb.group.position.x = fb.fromX + (fb.toX - fb.fromX) * t;
      fb.group.position.z = fb.fromZ + (fb.toZ - fb.fromZ) * t;
      fb.group.position.y = CHAR.shoulderY + Math.sin(Math.PI * t) * FIREBALL_ARC_HEIGHT;
      fb.group.rotation.y += 0.3;
      fb.core.scale.setScalar(1 + Math.sin(now * 0.02) * 0.08);
      if (t >= 1) {
        fb.phase = 'impact';
        fb.impactStartAt = now;
        fb.core.visible = false;
      }
    } else {
      const t = (now - fb.impactStartAt) / FIREBALL_IMPACT_MS;
      if (t >= 1) {
        fb.scene.remove(fb.group);
        activeFireballs.splice(i, 1);
        continue;
      }
      fb.glow.scale.setScalar(1 + t * 3.2);
      fb.glow.material.opacity = 0.55 * (1 - t);
      fb.light.intensity = 2.4 * (1 - t);
    }
  }
}

// ---------------------------------------------------------------------------
// Stumble Hex sigils — ground decals synced from the periodic 'wildlife_state'
// broadcast's groundTraps list (server.js's groundTrapsPublicState()), the
// same reconcile-by-id pattern as ember mobs/village NPCs: build a visual
// the first time an id appears, drop it once the id stops being sent (the
// server already removes expired traps before that list goes out, so no
// separate "expired" message is needed). A canvas-drawn rune circle keeps
// the same low-poly, no-external-assets look as every other ground/portal
// decal in this game (see buildEmberPortal) rather than loading a texture.
// ---------------------------------------------------------------------------
let groundTrapVisuals = {}; // trapId -> { group, glow, radius }

function buildStumbleSigilTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const cx = c.getContext('2d');
  const mid = 128;
  cx.strokeStyle = 'rgba(178,90,255,0.95)';
  cx.lineWidth = 6;
  cx.beginPath(); cx.arc(mid, mid, 118, 0, Math.PI * 2); cx.stroke();
  cx.lineWidth = 3;
  cx.beginPath(); cx.arc(mid, mid, 96, 0, Math.PI * 2); cx.stroke();
  // Five-pointed star, the classic "hex circle" centerpiece.
  cx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const ang = -Math.PI / 2 + i * (Math.PI * 4 / 5);
    const px = mid + Math.cos(ang) * 100, py = mid + Math.sin(ang) * 100;
    if (i === 0) cx.moveTo(px, py); else cx.lineTo(px, py);
  }
  cx.stroke();
  // Runic ticks ringing the outer edge.
  cx.lineWidth = 4;
  for (let i = 0; i < 10; i++) {
    const ang = i * (Math.PI * 2 / 10);
    cx.beginPath();
    cx.moveTo(mid + Math.cos(ang) * 106, mid + Math.sin(ang) * 106);
    cx.lineTo(mid + Math.cos(ang) * 124, mid + Math.sin(ang) * 124);
    cx.stroke();
  }
  return new THREE.CanvasTexture(c);
}
const STUMBLE_SIGIL_TEXTURE = buildStumbleSigilTexture();

function buildStumbleSigil(radius) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshBasicMaterial({ map: STUMBLE_SIGIL_TEXTURE, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 1.5;
  g.add(disc);
  const glow = new THREE.PointLight(0xaa55ff, 1.0, radius * 3);
  glow.position.y = 24;
  g.add(glow);
  g.userData = { disc, glow, pulsePhase: Math.random() * Math.PI * 2 };
  return g;
}

function applyGroundTrapsState(list) {
  const seenIds = new Set();
  for (const t of list) {
    seenIds.add(t.id);
    if (groundTrapVisuals[t.id]) continue;
    const scene = sceneForRoom(t.room);
    if (!scene) continue;
    const b = world && world.buildings.find(bb => bb.id === t.room);
    const scale = b ? INDOOR_SCALE : 1;
    const rp = getRenderPos({ room: t.room, x: t.x, y: t.y });
    const group = buildStumbleSigil(t.radius * scale);
    group.position.set(rp.x, 0, rp.z);
    scene.add(group);
    groundTrapVisuals[t.id] = group;
  }
  for (const id in groundTrapVisuals) {
    if (seenIds.has(id)) continue;
    const group = groundTrapVisuals[id];
    if (group.parent) group.parent.remove(group);
    delete groundTrapVisuals[id];
  }
}

function updateGroundTrapVisuals() {
  const now = performance.now();
  for (const id in groundTrapVisuals) {
    const v = groundTrapVisuals[id].userData;
    const pulse = 0.8 + Math.sin(now * 0.003 + v.pulsePhase) * 0.2;
    v.disc.material.opacity = 0.9 * pulse;
    v.glow.intensity = 1.0 * pulse;
  }
}

let playerContextMenuId = null;
function showPlayerContextMenu(targetId, x, y) {
  playerContextMenuId = targetId;
  const menu = document.getElementById('playerContextMenu');
  const p = players[targetId];
  // Tapping someone is also how you ASK for their name on mobile (names
  // are distance-gated there) — surface it for a few seconds. The shown
  // name honors disguises, of course; that's the whole game of them.
  if (p) p.tapNameUntil = Date.now() + 4500;
  if (menu) {
    document.getElementById('playerContextName').textContent = p ? (p.disguiseName || p.name) : 'Player';
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
  if (armedTarget && armedTarget.groundTargeting) {
    const ground = raycastGroundAt(clientX, clientY);
    if (!ground) return;
    if (actionOnCooldown(armedTarget.attackId)) {
      setUnlockToast('Your magic needs to recharge a moment.');
      cancelTargeting();
      return;
    }
    const worldPos = sceneToWorldPos(me.room, ground.x, ground.z);
    const payload = { type: armedTarget.msgType, [armedTarget.idField]: armedTarget.attackId, x: worldPos.x, y: worldPos.y };
    ws.send(JSON.stringify(payload));
    triggerAttackAnim();
    startActionCooldown(armedTarget.attackId);
    cancelTargeting();
    return;
  }
  const hit = raycastHitAt(clientX, clientY);
  if (armedTarget) {
    if (isValidArmedTarget(hit)) {
      if (actionOnCooldown(armedTarget.attackId)) {
        setUnlockToast(armedTarget.msgType === 'cast_spell' ? 'Your magic needs to recharge a moment.' : 'Still recovering — wait a moment.');
        cancelTargeting();
        return;
      }
      const payload = { type: armedTarget.msgType, [armedTarget.idField]: armedTarget.attackId, targetId: hit.targetId };
      if (hit.kind !== 'player') payload.targetType = hit.kind;
      ws.send(JSON.stringify(payload));
      triggerAttackAnim();
      startActionCooldown(armedTarget.attackId);
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
  } else if (hit.kind === 'loot') {
    ws.send(JSON.stringify({ type: 'loot_corpse', targetType: hit.lootType, targetId: hit.targetId }));
  }
}

// Touch look-and-tap: any finger on the canvas (the joystick zone sits
// above the canvas on the left, so it never gets here) drags the camera
// exactly like the mouse path above — and a finger that barely moved is a
// tap, which targets/strikes/harvests just like a click. This is the
// second half of the two-thumb layout: left thumb walks, right thumb
// looks and acts.
const touchLooks = new Map(); // touch identifier -> {startX, startY, lastX, lastY, moved}
canvas.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    touchLooks.set(t.identifier, { startX: t.clientX, startY: t.clientY, lastX: t.clientX, lastY: t.clientY, moved: 0 });
  }
  camGlide.velYaw = 0; camGlide.velPitch = 0; // finger down = direct control again
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    const tl = touchLooks.get(t.identifier);
    if (!tl) continue;
    const dx = t.clientX - tl.lastX, dy = t.clientY - tl.lastY;
    tl.moved += Math.abs(dx) + Math.abs(dy);
    tl.lastX = t.clientX; tl.lastY = t.clientY;
    if (MOBILE_UI && tl.moved >= CLICK_DRAG_THRESHOLD) {
      // Faster than the first pass (+~50%) but fed through a short
      // smoothing buffer (see updateCameraGlide) so speed reads as
      // gliding, not twitching — plus flick inertia on release below.
      camGlide.pendingYaw += -dx * TOUCH_CAM_SENS_YAW;
      camGlide.pendingPitch += -dy * TOUCH_CAM_SENS_PITCH;
      const nowT = performance.now();
      camGlide.samples.push({ t: nowT, yaw: -dx * TOUCH_CAM_SENS_YAW, pitch: -dy * TOUCH_CAM_SENS_PITCH });
      while (camGlide.samples.length && nowT - camGlide.samples[0].t > 90) camGlide.samples.shift();
    }
  }
}, { passive: true });
const touchLookEnd = (e) => {
  for (const t of e.changedTouches) {
    const tl = touchLooks.get(t.identifier);
    touchLooks.delete(t.identifier);
    if (tl && tl.moved < CLICK_DRAG_THRESHOLD) {
      handleCanvasClick(tl.startX, tl.startY);
    } else if (tl && MOBILE_UI && camGlide.samples.length) {
      // Flick: whatever angular speed the thumb had over its last ~90ms
      // carries on and coasts to a stop (see updateCameraGlide). This is
      // the piece that makes fast look-arounds feel like a glide instead
      // of a hard stop at the edge of every swipe.
      const nowT = performance.now();
      const span = Math.max(30, nowT - camGlide.samples[0].t);
      let sy = 0, sp = 0;
      for (const s of camGlide.samples) { sy += s.yaw; sp += s.pitch; }
      camGlide.velYaw = clampAbs(sy / (span / 1000), TOUCH_CAM_MAX_FLICK);
      camGlide.velPitch = clampAbs(sp / (span / 1000), TOUCH_CAM_MAX_FLICK * 0.5);
      camGlide.samples.length = 0;
    }
  }
};
canvas.addEventListener('touchend', touchLookEnd, { passive: true });
canvas.addEventListener('touchcancel', (e) => { for (const t of e.changedTouches) touchLooks.delete(t.identifier); }, { passive: true });

// ── Touch camera feel ───────────────────────────────────────────────────────
// Three pieces tuned together: sensitivity (how far a drag turns you),
// a ~50ms smoothing buffer (thumb jitter never reaches the camera), and
// flick inertia (a released swipe coasts to a stop). Desktop mouse input
// bypasses all of this and keeps its 1:1 feel.
const TOUCH_CAM_SENS_YAW = 0.0095;   // was 0.0062 — "+50% speed"
const TOUCH_CAM_SENS_PITCH = 0.0072; // was 0.0048
const TOUCH_CAM_SMOOTH_RATE = 18;    // 1/s — buffer drains in ~60ms
const TOUCH_CAM_GLIDE_DECAY = 5;     // 1/s — a flick coasts ~0.4s
const TOUCH_CAM_MAX_FLICK = 3.6;     // rad/s cap so a wild swipe can't spin the room
const camGlide = { pendingYaw: 0, pendingPitch: 0, velYaw: 0, velPitch: 0, samples: [] };
function clampAbs(v, cap) { return Math.max(-cap, Math.min(cap, v)); }

function updateCameraGlide(dt) {
  if (!MOBILE_UI) return;
  // Drain the smoothing buffer…
  const k = 1 - Math.exp(-dt * TOUCH_CAM_SMOOTH_RATE);
  const stepYaw = camGlide.pendingYaw * k;
  const stepPitch = camGlide.pendingPitch * k;
  camGlide.pendingYaw -= stepYaw;
  camGlide.pendingPitch -= stepPitch;
  // …plus whatever inertia is still coasting. Inertia dies faster while
  // the joystick is held so a flick can re-aim a run without the view
  // slithering forever.
  const decay = Math.exp(-dt * (joyActive ? TOUCH_CAM_GLIDE_DECAY * 1.8 : TOUCH_CAM_GLIDE_DECAY));
  camGlide.velYaw *= decay;
  camGlide.velPitch *= decay;
  if (Math.abs(camGlide.velYaw) < 0.02) camGlide.velYaw = 0;
  if (Math.abs(camGlide.velPitch) < 0.02) camGlide.velPitch = 0;
  const dYaw = stepYaw + camGlide.velYaw * dt;
  const dPitch = stepPitch + camGlide.velPitch * dt;
  if (dYaw) cameraYawOffset += dYaw;
  if (dPitch) cameraPitchOffset = Math.max(-CAMERA_PITCH_LIMIT, Math.min(CAMERA_PITCH_LIMIT, cameraPitchOffset + dPitch));
}

// ═══════════════════════════════════════════════════════════════════════════
// Mobile HUD — the action wheel, the ☰ menu sheet, the compact vitals pill,
// the 💬 chat sheet toggle, and the shared juice systems (damage numbers,
// screen shake, haptics, emotes, streaks) that make the game feel alive on
// every platform but were tuned with a phone in hand.
// ═══════════════════════════════════════════════════════════════════════════
let mobileHudInited = false;
let mobileChatOpen = false;
let chatUnreadCount = 0;

function initMobileHud() {
  if (mobileHudInited || !MOBILE_UI) return;
  mobileHudInited = true;
  restJoystick();
  document.getElementById('actionCluster').classList.remove('hidden');
  document.getElementById('mobileTopBar').classList.remove('hidden');
  const cp = document.getElementById('chatPanel');
  if (cp) cp.classList.add('mobileClosed'); // chat starts as a 💬 toggle
  buildEmoteWheel();
  buildMobileQuickSlots();
  refreshMobileHud();
  setInterval(refreshMobileHud, 700);
}

// Everything periodic and cheap in one place: vitals text, contextual
// buttons, menu-sheet metadata. Values are only written when they change,
// so this never causes layout churn.
const _mv = {}; // last-written values
function setTextIfChanged(id, text) {
  if (_mv[id] === text) return;
  _mv[id] = text;
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function refreshMobileHud() {
  if (!MOBILE_UI || !me) return;
  setTextIfChanged('mvHeart', `❤️${Math.round(me.health ?? 100)}`);
  setTextIfChanged('mvLevel', `Lv ${me.level || 1}`);
  const night = document.getElementById('dayNightTag');
  setTextIfChanged('mvClock', night && night.classList.contains('nightTag') ? '🌕' : '☀️');
  // 📢 shows only once there's actually a clip to fire; pulses while the
  // countermeasure window is open.
  const cmBtn = document.getElementById('btnCm');
  if (cmBtn) {
    cmBtn.classList.toggle('hidden', !(cmHasDrive && cmClips.length));
    cmBtn.classList.toggle('armed', Date.now() - lastAttackedClientAt < 6000);
  }
  // 💬 exists only where chat exists (indoors). No unread badge anymore —
  // messages present themselves as banners, so there's nothing to "catch
  // up on"; the button is purely "compose".
  const chatBtn = document.getElementById('chatToggleBtn');
  const cp = document.getElementById('chatPanel');
  if (chatBtn && cp) {
    chatBtn.classList.toggle('hidden', cp.classList.contains('hidden'));
    const badge = document.getElementById('chatUnread');
    if (badge) badge.classList.add('hidden');
  }
  // Menu-sheet metadata + contextual rows
  setTextIfChanged('menuPeople', `${Object.keys(players).length} in town`);
  const dn = document.getElementById('dayNightTag');
  setTextIfChanged('menuDayNight', dn ? dn.textContent : '☀️ Day');
  setTextIfChanged('menuPassState', hasTownPass() ? `🎟️ Pass: ${passTimeLeftLabel()} left` : (paymentsEnabled ? `🎟️ Pass: ${passPriceLabel()}/day` : ''));
  const leaveRow = document.getElementById('menuLeave');
  if (leaveRow) leaveRow.classList.toggle('hidden', mode !== 'indoor');
  const kitRow = document.getElementById('menuKit');
  if (kitRow && me) kitRow.textContent = me.charId === 0 ? '📖 Spellbook' : '⚔️ Attacks';
}

function toggleMobileChat(open) {
  const cp = document.getElementById('chatPanel');
  if (!cp) return;
  mobileChatOpen = open === undefined ? !mobileChatOpen : open;
  cp.classList.toggle('mobileClosed', !mobileChatOpen);
  if (mobileChatOpen) {
    chatUnreadCount = 0;
    refreshMobileHud();
    // The 💬 button means "I want to say something" now — the panel is
    // just a compose bar (messages arrive as banners), so go straight to
    // the keyboard.
    const inp = document.getElementById('chatInput');
    if (inp) setTimeout(() => inp.focus(), 60);
  }
}

// ── Incoming-message banners (the mobile chat display) ─────────────────────
// Phones have no chat log: each message in your room pops in under the top
// bar like a text-message notification, lives ~9 s, then fades out on its
// own so the screen stays tidy. At most 4 ride the stack; older ones are
// pushed out early. Tapping a picture banner opens the full image.
const CHAT_NOTIF_LIFE_MS = 9000;
const CHAT_NOTIF_MAX = 4;
function spawnChatNotif(n) {
  const stack = document.getElementById('chatNotifStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'chatNotif' + (n.kind ? ' ' + n.kind : '');
  const body = document.createElement('div');
  body.className = 'cnBody';
  const nameEl = document.createElement('div');
  nameEl.className = 'cnName';
  nameEl.style.color = n.color || '#ffe9c2';
  nameEl.textContent = n.self ? 'You' : (n.name || '');
  const textEl = document.createElement('div');
  textEl.className = 'cnText';
  textEl.textContent = n.text || (n.image ? '📷 sent a picture' : '');
  if (nameEl.textContent) body.appendChild(nameEl);
  body.appendChild(textEl);
  el.appendChild(body);
  if (n.image) {
    const img = document.createElement('img');
    img.src = n.image;
    img.alt = 'shared picture';
    el.addEventListener('click', () => openImageLightbox(n.image));
    el.appendChild(img);
  }
  stack.appendChild(el);
  while (stack.children.length > CHAT_NOTIF_MAX) stack.firstChild.remove();
  const fade = () => { el.classList.add('fading'); setTimeout(() => el.remove(), 750); };
  setTimeout(fade, CHAT_NOTIF_LIFE_MS);
}

// System/story beats used to rely on the chat log as their paper trail —
// with no log on phones, any line that didn't already just toast the same
// words gets a banner instead, so a missed toast still isn't lost info.
function systemChatNotif(text) {
  if (!MOBILE_UI) return;
  if (text === lastToastText && Date.now() - lastToastAt < 3000) return; // the toast already said it
  spawnChatNotif({ name: '', text, kind: 'system' });
}

// ── Overhead speech bubbles (desktop) ───────────────────────────────────────
// The README always promised these; the mobile rebuild's banners now cover
// phones, and this covers desktop: whoever spoke gets their words in a
// little parchment bubble over their head for ~6s, fading at the end.
// Rendered/positioned by syncLabels() right alongside the name tags.
function setOverheadBubble(playerId, text, hasImage) {
  const p = players[playerId];
  if (!p) return;
  let t = (text || '').trim();
  if (hasImage) t = t ? t + ' 📷' : '📷 (sent a picture)';
  if (!t) return;
  if (t.length > 90) t = t.slice(0, 87) + '…';
  p.bubbleText = t;
  p.bubbleUntil = Date.now() + 6500;
}
function updateBubbleTag(p, v, headScreen, now) {
  const active = p.bubbleText && p.bubbleUntil > now && headScreen.visible;
  if (!active) {
    if (v.bubbleEl) v.bubbleEl.style.display = 'none';
    return;
  }
  if (!v.bubbleEl) {
    v.bubbleEl = document.createElement('div');
    v.bubbleEl.className = 'chatBubbleTag';
    document.body.appendChild(v.bubbleEl);
  }
  if (v.bubbleEl.textContent !== p.bubbleText) v.bubbleEl.textContent = p.bubbleText;
  v.bubbleEl.style.display = 'block';
  v.bubbleEl.style.left = headScreen.x + 'px';
  v.bubbleEl.style.top = (headScreen.y - 40) + 'px';
  const msLeft = p.bubbleUntil - now;
  v.bubbleEl.style.opacity = msLeft < 600 ? String(Math.max(0, msLeft / 600)) : '1';
}

// ── Action wheel wiring ──
(function wireActionCluster() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
  };
  on('btnStrike', () => { if (me && !me.isDead) strikeNearestEnemy(); });
  on('btnJump', tryJump);
  on('btnEmote', () => toggleEmoteWheel());
  on('btnCm', fireVoiceCountermeasure);
  on('btnKit', () => {
    if (me && me.charId === 0) { if (!spellbookOpen) openSpellbook(); }
    else if (myAttackCatalog) { if (!attackPanelOpen) openAttackPanel(); }
  });
  on('chatToggleBtn', () => toggleMobileChat());
  on('menuBtn', () => document.getElementById('menuSheet').classList.remove('hidden'));
  // Desktop's ☰ chip opens the very same sheet — one menu for both platforms.
  on('pcMenuBtn', () => document.getElementById('menuSheet').classList.remove('hidden'));
  on('menuCloseBtn', () => document.getElementById('menuSheet').classList.add('hidden'));
  const sheet = document.getElementById('menuSheet');
  if (sheet) sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.classList.add('hidden'); });
  const closeSheetAnd = (fn) => () => { document.getElementById('menuSheet').classList.add('hidden'); fn(); };
  on('menuInventory', closeSheetAnd(() => { if (!inventoryOpen) toggleInventory(); }));
  on('menuJournal', closeSheetAnd(() => { if (!journalOpen) openJournal(); }));
  on('menuSkills', closeSheetAnd(() => { if (!skillsOpen) openSkills(); }));
  on('menuKit', closeSheetAnd(() => {
    if (me && me.charId === 0) { if (!spellbookOpen) openSpellbook(); }
    else if (myAttackCatalog && !attackPanelOpen) openAttackPanel();
  }));
  on('menuDrive', closeSheetAnd(() => {
    if (!inventoryOpen) toggleInventory();
    showInvTab('invHardDriveView');
  }));
  on('menuPass', closeSheetAnd(openPassModal));
  on('menuMoonstones', closeSheetAnd(openMsModal));
  // ── Graphics quality: Auto → Low → Medium → High (persisted) ──
  const gfxLabel = () => {
    const el = document.getElementById('menuGraphicsVal');
    const G = window.__thornGfx;
    if (!el || !G) return;
    const p = G.pref;
    el.textContent = p === 'auto' ? ('Auto (' + G.quality + ')') : p[0].toUpperCase() + p.slice(1);
  };
  on('menuGraphics', () => {
    const G = window.__thornGfx;
    if (!G) return;
    const order = ['auto', 'low', 'medium', 'high'];
    const next = order[(order.indexOf(G.pref) + 1) % order.length];
    G.setQuality(next);
    gfxLabel();
  });
  const _menuBtnForGfx = document.getElementById('pcMenuBtn');
  if (_menuBtnForGfx) _menuBtnForGfx.addEventListener('click', gfxLabel);
  const _menuBtnForGfx2 = document.getElementById('menuBtn');
  if (_menuBtnForGfx2) _menuBtnForGfx2.addEventListener('click', gfxLabel);
  on('menuSnap', closeSheetAnd(snapNearestPlayer));
  // 🎶 Music cycles through the witchy songbook; the sheet stays open so
  // you can flip tracks and listen. (The cafe's 🔈 mute button still works.)
  on('menuMusic', cycleMusic);
  const musicLabel = () => { const r = document.getElementById('menuMusic'); if (r) r.textContent = musicMenuLabel(); };
  const _menuBtnForMusic = document.getElementById('pcMenuBtn');
  if (_menuBtnForMusic) _menuBtnForMusic.addEventListener('click', musicLabel);
  const _menuBtnForMusic2 = document.getElementById('menuBtn');
  if (_menuBtnForMusic2) _menuBtnForMusic2.addEventListener('click', musicLabel);
  on('menuLeave', closeSheetAnd(() => { const b = document.getElementById('leaveBtn'); if (b) b.click(); }));
  // ── Leave the town: back to the start screen ──
  // Two taps (arm, then confirm within 3s) so a stray tap can't yank someone
  // out of the world. Clears the live-resume stash first — otherwise the
  // fresh page would quietly resume straight back into town — then reloads,
  // which is the one guaranteed-clean way back to the join screen in a
  // client that was built to join once per page. The account (tc_account,
  // localStorage) survives, so returning players land on their character
  // roster, not the login form.
  let logoutArmedAt = 0;
  on('menuLogout', () => {
    const btn = document.getElementById('menuLogout');
    const now = Date.now();
    if (now - logoutArmedAt < 3000) {
      try { sessionStorage.removeItem('tc_live_resume'); } catch (e) {}
      try { sessionStorage.removeItem('tc_resume'); } catch (e) {}
      liveResumeToken = null;
      try { if (ws) ws.close(); } catch (e) {}
      location.reload();
      return;
    }
    logoutArmedAt = now;
    if (btn) {
      btn.textContent = '⚠️ Tap again to leave';
      btn.style.color = '#ff9b9b';
      setTimeout(() => {
        if (Date.now() - logoutArmedAt >= 2900) {
          btn.textContent = '🌒 Leave the town';
          btn.style.color = '';
        }
      }, 3000);
    }
  });
})();

// ── One thing on screen at a time ───────────────────────────────────────────
// The phone HUD (joystick, action wheel, XP strip, prompts, top bar) hides
// itself whenever any panel/menu/modal is open — see the panelOpen CSS in
// index.html. This watcher is the single source of truth: it observes the
// class attribute of every overlay and panel, so ANY open/close path —
// button, server push, Esc, backdrop tap — keeps body.panelOpen honest.
// New modals get this behavior for free as long as they use .overlay.
(function watchOpenPanels() {
  const isOpen = (el) => !!el && !el.classList.contains('hidden');
  const PANEL_IDS = ['menuSheet', 'inventoryPanel', 'spellbookModal', 'journalModal', 'skillsModal', 'attackModal'];
  const sync = () => {
    let open = PANEL_IDS.some((id) => isOpen(document.getElementById(id)));
    if (!open) {
      for (const el of document.querySelectorAll('.overlay')) {
        if (el.id === 'joinScreen') continue; // pre-join screen, HUD not up yet
        if (isOpen(el)) { open = true; break; }
      }
    }
    document.body.classList.toggle('panelOpen', open);
    // Chat compose is its own state: the top bar stays (💬 is how it closes).
    const cp = document.getElementById('chatPanel');
    document.body.classList.toggle('composeOpen',
      !!(MOBILE_UI && cp && !cp.classList.contains('hidden') && !cp.classList.contains('mobileClosed')));
  };
  const obs = new MutationObserver(sync);
  const seen = new Set();
  const watchEl = (el) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  };
  PANEL_IDS.forEach((id) => watchEl(document.getElementById(id)));
  document.querySelectorAll('.overlay').forEach(watchEl);
  watchEl(document.getElementById('chatPanel'));
  sync();
})();

// ── Small-screen wording: no keyboard, no "Esc", no "click" ──
(function mobileCopyPass() {
  if (!MOBILE_UI) return;
  for (const b of document.querySelectorAll('button')) {
    if (b.textContent.trim() === 'Close (Esc)') b.textContent = 'Close';
  }
})();

// ── Full-screen panel chrome (touch) ────────────────────────────────────────
// On phones the core panels take over the whole screen (CSS does the
// geometry); this injects the navigation: ‹ Menu top-left goes BACK to the
// ☰ sheet, and Close stays at the bottom, sticky. One mental model:
// game → ☰ menu → panel, and ‹ Menu walks you back the way you came.
(function mobileFullscreenPanels() {
  if (!MOBILE_UI) return;
  const openMenuSheet = () => document.getElementById('menuSheet').classList.remove('hidden');
  const makeBack = (label, onTap) => {
    const b = document.createElement('button');
    b.className = 'mobPanelBack';
    b.textContent = label;
    b.addEventListener('click', (e) => { e.preventDefault(); onTap(); });
    return b;
  };
  // The four float panels: back button rides the existing handle.
  const FLOATS = [
    ['spellbookModal', 'spellbookCloseBtn'],
    ['journalModal', 'journalCloseBtn'],
    ['skillsModal', 'skillsCloseBtn'],
    ['attackModal', 'attackCloseBtn'],
  ];
  for (const [panelId, closeId] of FLOATS) {
    const panel = document.getElementById(panelId);
    const handle = panel && panel.querySelector('.floatPanelHandle');
    const closeBtn = document.getElementById(closeId);
    if (!handle || !closeBtn) continue;
    handle.insertBefore(makeBack('‹ Menu', () => { closeBtn.click(); openMenuSheet(); }), handle.firstChild);
    // Keep error lines visible ABOVE the sticky Close, not lost beneath it.
    const err = panel.querySelector('.err');
    if (err && closeBtn.compareDocumentPosition(err) & Node.DOCUMENT_POSITION_FOLLOWING) {
      closeBtn.parentNode.insertBefore(err, closeBtn);
    }
  }
  // Inventory: gets the same header (it only had the ✕ in its tab row) +
  // a bottom Close like everything else.
  const inv = document.getElementById('inventoryPanel');
  const invClose = document.getElementById('invCloseBtn');
  if (inv && invClose) {
    const head = document.createElement('div');
    head.id = 'invMobHead';
    head.appendChild(makeBack('‹ Menu', () => { invClose.click(); openMenuSheet(); }));
    const ttl = document.createElement('span');
    ttl.textContent = '🎒 Inventory';
    head.appendChild(ttl);
    inv.insertBefore(head, inv.firstChild);
    const bottomClose = document.createElement('button');
    bottomClose.id = 'invMobCloseBtn';
    bottomClose.className = 'btn';
    bottomClose.textContent = 'Close';
    bottomClose.addEventListener('click', (e) => { e.preventDefault(); invClose.click(); });
    inv.appendChild(bottomClose);
  }
  // Loadout editor: ‹ Back returns to wherever you opened it from (the
  // Attacks/Spellbook panel stays open underneath, or the ☰ menu's world).
  const lc = document.getElementById('loadoutCard');
  if (lc) {
    const row = document.createElement('div');
    row.className = 'mobPanelHeadRow';
    row.appendChild(makeBack('‹ Back', () => closeLoadoutModal()));
    lc.insertBefore(row, lc.firstChild);
  }
})();

// ── Hold-to-read: press-and-hold an ability button to see what it does ─────
// The card follows the finger's hold and vanishes on release — and a hold
// NEVER casts (the release that ends a peek is swallowed). The threshold
// sits well above a combat tap (~80–250ms), so spamming abilities in a
// fight can't trip it.
const ABILITY_PEEK_MS = 475;
let abilityPeekTimer = null;
let abilityPeekShown = false;
let abilityPeekSwallowUntil = 0;

function showAbilityPeek(info, anchorEl) {
  const card = document.getElementById('abilityPeek');
  if (!card || !info) return;
  card.querySelector('.apName').textContent = `${info.icon || '✨'} ${info.name || ''}`;
  const KIND_LABELS = {
    targeted: '🎯 strikes the nearest enemy', aoe: '💥 hits everyone nearby',
    self: '🫧 affects you', ground: '🌀 placed at your feet',
    building: '🏠 works on the building you face', reveal: '👁 targets the nearest player',
    melee: '⚔️ basic attack — always ready', opener: '📖 opens a panel',
  };
  card.querySelector('.apKind').textContent = KIND_LABELS[info.kind] || '';
  card.querySelector('.apDesc').textContent = info.description || '';
  const cdEl = card.querySelector('.apCd');
  if (info.noCd) cdEl.textContent = '';
  else if (info.id && actionOnCooldown(info.id)) {
    cdEl.textContent = `⏳ recharging — ${Math.ceil(((actionCooldownEndAt[info.id] || 0) - performance.now()) / 1000)}s`;
  } else cdEl.textContent = info.id ? '✅ ready' : '';
  card.classList.remove('hidden');
  // Above the anchor, clamped on-screen (the anchor is under a thumb).
  const r = anchorEl.getBoundingClientRect();
  const cw = card.offsetWidth, ch = card.offsetHeight;
  let x = Math.min(Math.max(8, r.x + r.width / 2 - cw / 2), innerWidth - cw - 8);
  let y = r.y - ch - 14;
  if (y < 8) y = Math.min(innerHeight - ch - 8, r.bottom + 14);
  card.style.left = x + 'px';
  card.style.top = y + 'px';
}
function hideAbilityPeek() {
  const card = document.getElementById('abilityPeek');
  if (card) card.classList.add('hidden');
}
// getInfo is lazy so the card always reflects the CURRENT slot assignment.
function attachAbilityPeek(el, getInfo) {
  if (!el || el._peekWired) return;
  el._peekWired = true;
  let startX = 0, startY = 0;
  const begin = (x, y) => {
    startX = x; startY = y;
    clearTimeout(abilityPeekTimer);
    abilityPeekTimer = setTimeout(() => {
      const info = getInfo();
      if (!info) return;
      abilityPeekShown = true;
      showAbilityPeek(info, el);
      haptic(8);
    }, ABILITY_PEEK_MS);
  };
  const finish = (e) => {
    clearTimeout(abilityPeekTimer);
    if (abilityPeekShown) {
      abilityPeekShown = false;
      hideAbilityPeek();
      abilityPeekSwallowUntil = Date.now() + 300; // the release must not cast…
      if (e && e.cancelable) e.preventDefault();  // …and no synthetic click either
    }
  };
  const cancel = () => { clearTimeout(abilityPeekTimer); if (abilityPeekShown) { abilityPeekShown = false; hideAbilityPeek(); abilityPeekSwallowUntil = Date.now() + 300; } };
  el.addEventListener('touchstart', (e) => { const t = e.touches[0]; begin(t.clientX, t.clientY); }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t && Math.hypot(t.clientX - startX, t.clientY - startY) > 14) cancel(); // finger slid — not a hold
  }, { passive: true });
  el.addEventListener('touchend', finish);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('mousedown', (e) => begin(e.clientX, e.clientY)); // desktop parity: hold works there too
  el.addEventListener('mouseup', finish);
  el.addEventListener('mouseleave', cancel);
  // Capture-phase guard: after a peek, the click that follows the release
  // is dead on arrival — existing handlers never see it. One-shot + short
  // window, so the player's genuine NEXT tap is never eaten.
  el.addEventListener('click', (e) => {
    if (Date.now() < abilityPeekSwallowUntil) {
      abilityPeekSwallowUntil = 0;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
}

// Static wheel buttons get their peeks once, here (the quick slots get
// theirs in buildMobileQuickSlots, where their abilities are assigned).
(function wireClusterPeeks() {
  attachAbilityPeek(document.getElementById('btnStrike'), () => ({
    icon: '⚔️', name: 'Strike', kind: 'melee', noCd: true,
    description: "Swing at whoever's closest — your basic hit. Free, fast, always there.",
  }));
  attachAbilityPeek(document.getElementById('btnKit'), () => ({
    icon: me && me.charId === 0 ? '📖' : '✨',
    name: me && me.charId === 0 ? 'Spellbook' : 'Attacks',
    kind: 'opener', noCd: true,
    description: me && me.charId === 0
      ? 'Your full grimoire — every spell with what it does, plus slot customizing.'
      : 'Your full kit — every attack with what it does, plus slot customizing.',
  }));
  attachAbilityPeek(document.getElementById('btnCm'), () => ({
    icon: '📢', name: 'Countermeasure', kind: 'self', noCd: true,
    description: 'Blast your saved voice clip back at an attacker. It appears once a clip lives on your Drive, and pulses when an attack can be answered.',
  }));
})();

// ── Quick ability slots (first three of this class's kit) ──
// The full 12-slot keyboard hotbar is a desktop thing; on a phone the kit
// lives in the Attacks/Spellbook panel, with the three openers a thumb-tap
// away. Cooldowns reuse the same sweep the desktop hotbar draws.
function buildMobileQuickSlots() {
  if (!MOBILE_UI) return;
  // The kit opener is useful for every class (Spellbook for the Witch,
  // Attacks for everyone else) — show it as soon as the HUD exists.
  const kitBtn = document.getElementById('btnKit');
  if (kitBtn && me) {
    kitBtn.classList.remove('hidden');
    kitBtn.style.display = 'flex';
    kitBtn.textContent = me.charId === 0 ? '📖' : '✨';
    if (me.charId === 0 || myAttackCatalog) kitBtn.style.opacity = '1';
  }
  if (!myActionCatalog) return;
  const ids = orderedAbilityIds().slice(0, 3);
  ['qs1', 'qs2', 'qs3'].forEach((qid, i) => {
    const btn = document.getElementById(qid);
    if (!btn) return;
    const abilityId = ids[i];
    if (!abilityId) { btn.classList.add('hidden'); btn.style.display = 'none'; return; }
    const ab = myActionCatalog[abilityId];
    btn.innerHTML = '';
    btn.appendChild(document.createTextNode(ab.icon || '✨'));
    const cd = document.createElement('div');
    cd.className = 'hotbarCooldown';
    cd.style.borderRadius = '50%';
    const cdText = document.createElement('div');
    cdText.className = 'hotbarCooldownText acCdText';
    btn.appendChild(cd);
    btn.appendChild(cdText);
    btn.classList.remove('hidden');
    btn.style.display = 'flex';
    btn.title = ab.name || abilityId;
    btn.onclick = (e) => { e.preventDefault(); castFromHotbar(abilityId); };
    // Hold-to-read: the peek always reflects the CURRENT assignment (the
    // element is re-tagged on every rebuild; the wiring itself is once).
    btn._peekAbilityId = abilityId;
    attachAbilityPeek(btn, () => {
      const cur = btn._peekAbilityId;
      const a = myActionCatalog && myActionCatalog[cur];
      return a ? { id: cur, icon: a.icon, name: a.name, kind: a.kind, description: a.description } : null;
    });
    // Register into the shared cooldown ticker alongside desktop slots.
    hotbarSlotEls.push({ id: abilityId, slot: btn, cooldown: cd, cooldownText: cdText });
  });
}

// ── Emote wheel ─────────────────────────────────────────────────────────────
// Eight emotes in a ring (mobile: around the 😀 button; desktop: center
// screen on T). The cheapest social mechanic there is — and unlike chat it
// works outdoors, which is exactly where you pass people.
const EMOTES = ['👋', '😂', '❤️', '😮', '😢', '😡', '👍', '💃'];
let emoteWheelOpen = false;
let emoteWheelTimer = null;

function buildEmoteWheel() {
  const wheel = document.getElementById('emoteWheel');
  if (!wheel || wheel.childElementCount) return;
  const R = 88, cx = 115, cy = 115;
  EMOTES.forEach((em, i) => {
    const ang = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
    const b = document.createElement('button');
    b.className = 'emoteBtn';
    b.textContent = em;
    b.style.left = (cx + Math.cos(ang) * R - 26) + 'px';
    b.style.top = (cy + Math.sin(ang) * R - 26) + 'px';
    b.style.animationDelay = (i * 0.02) + 's';
    b.addEventListener('click', (e) => {
      e.preventDefault();
      ws.send(JSON.stringify({ type: 'emote', emote: em }));
      toggleEmoteWheel(false);
    });
    wheel.appendChild(b);
  });
}

function toggleEmoteWheel(open) {
  const wheel = document.getElementById('emoteWheel');
  if (!wheel) return;
  buildEmoteWheel();
  emoteWheelOpen = open === undefined ? !emoteWheelOpen : open;
  wheel.classList.toggle('hidden', !emoteWheelOpen);
  const cluster = document.getElementById('actionCluster');
  if (cluster) cluster.classList.toggle('wheelOpen', emoteWheelOpen);
  // While the wheel is up, the hint/XP strip/joystick ring step back too —
  // same "one thing under the thumb" rule the cluster buttons follow.
  document.body.classList.toggle('emoteWheelOpen', emoteWheelOpen);
  clearTimeout(emoteWheelTimer);
  if (emoteWheelOpen) emoteWheelTimer = setTimeout(() => toggleEmoteWheel(false), 4000);
}

// Emote floats — the emoji bounces above the sender's head for a couple of
// seconds, tracked to their moving position each frame.
const activeEmoteFloats = [];
function spawnEmoteFloat(playerId, emote) {
  const layer = document.getElementById('fxLayer');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = 'emoteFloat';
  el.textContent = emote;
  layer.appendChild(el);
  activeEmoteFloats.push({ el, playerId, until: performance.now() + 2350 });
}
function updateEmoteFloats() {
  const now = performance.now();
  for (let i = activeEmoteFloats.length - 1; i >= 0; i--) {
    const f = activeEmoteFloats[i];
    const p = players[f.playerId];
    if (now > f.until || !p || !visuals[f.playerId] || !visuals[f.playerId].inScene) {
      f.el.remove();
      activeEmoteFloats.splice(i, 1);
      continue;
    }
    const rp = getRenderPos(p);
    const vv = visuals[f.playerId];
    const floorYOffset = (vv && vv.floorYS !== undefined && vv.floorRoomS === p.room) ? vv.floorYS : getFloorHeight(p.room, rp.x, rp.z);
    const s = worldToScreen(rp.x, groundY + CHAR.headY + floorYOffset + 16, rp.z);
    if (!s.visible) { f.el.style.opacity = '0'; continue; }
    f.el.style.left = s.x + 'px';
    f.el.style.top = s.y + 'px';
  }
}

// ── Damage numbers ──────────────────────────────────────────────────────────
// Every landed hit in the room draws its number over the target: white for
// hits, gold for kills, red for damage YOU take. Fire-and-forget DOM nodes
// riding a CSS animation; no per-frame tracking needed at 0.85s lifetime.
function spawnDmgNum(screenX, screenY, dmg, kind) {
  const layer = document.getElementById('fxLayer');
  if (!layer || !Number.isFinite(screenX)) return;
  const el = document.createElement('div');
  el.className = 'dmgNum' + (kind ? ' ' + kind : '');
  el.textContent = kind === 'selfHit' ? `-${dmg}` : String(dmg);
  // A little scatter so rapid hits don't stack into one unreadable blob.
  el.style.left = (screenX + (Math.random() * 30 - 15)) + 'px';
  el.style.top = (screenY + (Math.random() * 12 - 6)) + 'px';
  layer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  setTimeout(() => el.remove(), 1200); // belt and braces if the animation never fires
}
function screenPosForTarget(targetType, targetId) {
  if (targetType === 'player') {
    const p = players[targetId];
    if (!p || !visuals[targetId] || !visuals[targetId].inScene) return null;
    const rp = getRenderPos(p);
    const floorYOffset = getFloorHeight(p.room, rp.x, rp.z);
    return worldToScreen(rp.x, groundY + CHAR.headY + floorYOffset, rp.z);
  }
  const mp = mobRenderPos(targetType, targetId);
  if (!mp) return null;
  return worldToScreen(mp.x, groundY + 30, mp.z);
}

// ── Screen shake + haptics ──────────────────────────────────────────────────
// Small and rotationless-adjacent (tenths of a degree) so it reads as
// impact, not malfunction; the CSS honors prefers-reduced-motion.
function shakeScreen(size) {
  const cls = size === 'M' ? 'shakeM' : 'shakeS';
  canvas.classList.remove('shakeS', 'shakeM');
  void canvas.offsetWidth; // restart the animation
  canvas.classList.add(cls);
}
function haptic(pattern) {
  if (MOBILE_UI && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

// ── Hunt streak display ─────────────────────────────────────────────────────
let streakHideTimer = null;
function showStreak(count, message, bonus) {
  const tag = document.getElementById('streakTag');
  if (tag) {
    tag.textContent = `🔥 ×${count}`;
    tag.style.fontSize = Math.min(34, 18 + count * 1.5) + 'px';
    tag.classList.remove('show'); void tag.offsetWidth;
    tag.classList.add('show');
    clearTimeout(streakHideTimer);
    streakHideTimer = setTimeout(() => tag.classList.remove('show'), 8000);
  }
  if (bonus) {
    setUnlockToast(message);
    appendSystemChatLine(message);
  }
  if (count === 10) showChapterCeremony('🔥 ×10 STREAK', 'The night itself is impressed.');
  haptic(count >= 5 ? [15, 30, 25] : 15);
}

// ── Loadout editor ──────────────────────────────────────────────────────────
// Tap a slot, tap an ability: the two swap places. Live-saves on every
// swap, so the wheel/hotbar underneath is already rearranged by the time
// the panel closes. Ownership of your controls, two taps at a time.
let loadoutSelectedSlot = null;

function openLoadoutModal() {
  if (!myActionCatalog) { setUnlockToast('Join with a class kit first.'); return; }
  loadoutSelectedSlot = null;
  renderLoadoutModal();
  document.getElementById('loadoutModal').classList.remove('hidden');
}
function closeLoadoutModal() {
  document.getElementById('loadoutModal').classList.add('hidden');
}

function loadoutPeekInfo(id) {
  const a = myActionCatalog && myActionCatalog[id];
  return a ? { id, icon: a.icon, name: a.name, kind: a.kind, description: a.description } : null;
}
// Shared place-an-ability step: tap a slot, then tap the ability (they swap).
function loadoutPlaceAbility(id, ids) {
  const ab = myActionCatalog[id];
  if (loadoutSelectedSlot === null) {
    setUnlockToast(MOBILE_UI
      ? `${ab.icon} ${ab.name || id} — first tap the wheel slot you want it in.`
      : `${ab.icon} ${ab.name || id} — pick a slot first, then click this.`);
    return;
  }
  const next = ids.slice();
  const from = next.indexOf(id);
  const to = loadoutSelectedSlot;
  if (from === -1 || from === to) { loadoutSelectedSlot = null; renderLoadoutModal(); return; }
  [next[to], next[from]] = [next[from], next[to]]; // swap — always a clean permutation
  saveLoadout(next);
  loadoutSelectedSlot = null;
  renderLoadoutModal();
  haptic(12);
}
function renderLoadoutModal() {
  const ids = orderedAbilityIds();
  const slotsEl = document.getElementById('loadoutSlots');
  const absEl = document.getElementById('loadoutAbilities');
  const wheelEl = document.getElementById('loadoutWheelRow');
  const restLabel = document.getElementById('loadoutRestLabel');
  if (!slotsEl || !absEl) return;
  slotsEl.innerHTML = '';
  absEl.innerHTML = '';
  if (wheelEl) wheelEl.innerHTML = '';
  const slotCount = Math.min(ids.length, HOTBAR_KEYS.length);

  // ── Phones: the three WHEEL slots are the headline — big, labeled, named.
  if (MOBILE_UI && wheelEl) {
    for (let i = 0; i < Math.min(3, slotCount); i++) {
      const id = ids[i];
      const ab = myActionCatalog[id];
      const cell = document.createElement('div');
      cell.className = 'loBig' + (loadoutSelectedSlot === i ? ' selected' : '');
      const tag = document.createElement('div');
      tag.className = 'loBigTag';
      tag.textContent = `Wheel ${i + 1}`;
      const icon = document.createElement('div');
      icon.className = 'loBigIcon';
      icon.textContent = ab ? ab.icon : '·';
      const nm = document.createElement('div');
      nm.className = 'loBigName';
      nm.textContent = ab ? (ab.name || id) : '—';
      cell.appendChild(tag); cell.appendChild(icon); cell.appendChild(nm);
      cell.addEventListener('click', () => {
        loadoutSelectedSlot = loadoutSelectedSlot === i ? null : i;
        renderLoadoutModal();
      });
      attachAbilityPeek(cell, () => loadoutPeekInfo(ids[i]));
      wheelEl.appendChild(cell);
    }
  }

  // Remaining slots: desktop draws all 12 keyed tiles; phones draw 4+ as a
  // small "panel order" row under its own label.
  const firstTile = MOBILE_UI ? 3 : 0;
  if (restLabel) restLabel.classList.toggle('hidden', !MOBILE_UI || slotCount <= 3);
  for (let i = firstTile; i < slotCount; i++) {
    const id = ids[i];
    const ab = myActionCatalog[id];
    const cell = document.createElement('div');
    cell.className = 'loSlot' + (loadoutSelectedSlot === i ? ' selected' : '');
    cell.textContent = ab ? ab.icon : '·';
    const key = document.createElement('span');
    key.className = 'loKey';
    key.textContent = MOBILE_UI ? String(i + 1) : HOTBAR_KEY_LABELS[i];
    cell.appendChild(key);
    cell.title = ab ? (ab.name || id) : '';
    cell.addEventListener('click', () => {
      loadoutSelectedSlot = loadoutSelectedSlot === i ? null : i;
      renderLoadoutModal();
    });
    attachAbilityPeek(cell, () => loadoutPeekInfo(ids[i]));
    slotsEl.appendChild(cell);
  }

  const hint = document.getElementById('loadoutHint');
  if (hint) {
    if (loadoutSelectedSlot === null) {
      hint.textContent = MOBILE_UI
        ? 'The wheel slots are your in-game buttons. Tap one, then tap the ability you want on it. Hold anything to read what it does.'
        : 'Click a slot (the key it answers to is in the corner), then click an ability.';
    } else if (MOBILE_UI && loadoutSelectedSlot < 3) {
      hint.textContent = `Wheel slot ${loadoutSelectedSlot + 1} — now tap the ability to put there.`;
    } else {
      hint.textContent = `Slot ${loadoutSelectedSlot + 1} selected — now pick the ability for it.`;
    }
  }

  // ── The kit itself. Phones get rows with names (a grid of bare emoji is
  // a guessing game); desktop keeps its compact icon grid with hover titles.
  for (const id of Object.keys(myActionCatalog)) {
    const ab = myActionCatalog[id];
    const idx = ids.indexOf(id);
    const onWheel = idx > -1 && idx < 3;
    let cell;
    if (MOBILE_UI) {
      cell = document.createElement('div');
      cell.className = 'loAbRow' + (onWheel ? ' inSlots' : '');
      const icon = document.createElement('span');
      icon.className = 'loAbIcon';
      icon.textContent = ab.icon;
      const nm = document.createElement('span');
      nm.className = 'loAbName';
      nm.textContent = ab.name || id;
      cell.appendChild(icon); cell.appendChild(nm);
      if (onWheel) {
        const where = document.createElement('span');
        where.className = 'loAbWhere';
        where.textContent = `Wheel ${idx + 1}`;
        cell.appendChild(where);
      }
    } else {
      cell = document.createElement('div');
      cell.className = 'loAb' + (onWheel && MOBILE_UI ? ' inSlots' : '');
      cell.textContent = ab.icon;
      cell.title = ab.name || id;
    }
    cell.addEventListener('click', () => loadoutPlaceAbility(id, ids));
    attachAbilityPeek(cell, () => loadoutPeekInfo(id));
    absEl.appendChild(cell);
  }
}

(function wireLoadoutModal() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  on('loadoutCloseBtn', closeLoadoutModal);
  on('loadoutResetBtn', () => {
    try { localStorage.removeItem(loadoutStorageKey()); } catch (e) {}
    myLoadout = null;
    buildHotbar();
    loadoutSelectedSlot = null;
    renderLoadoutModal();
    setUnlockToast('↩️ Slots back to the default order.');
  });
  on('spellLoadoutBtn', openLoadoutModal);
  on('attackLoadoutBtn', openLoadoutModal);
  on('controlsLoadoutBtn', () => { closeControlsModal(); openLoadoutModal(); });
  on('menuLoadout', () => { document.getElementById('menuSheet').classList.add('hidden'); openLoadoutModal(); });
  const overlay = document.getElementById('loadoutModal');
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLoadoutModal(); });
})();

// ── Controls guide ──────────────────────────────────────────────────────────
// Auto-shows exactly once (per browser) on a player's first-ever join, and
// is always one tap/keypress away after that (☰ → Controls, or H).
function openControlsModal() {
  document.getElementById('controlsMobile').classList.toggle('hidden', !MOBILE_UI);
  document.getElementById('controlsDesktop').classList.toggle('hidden', MOBILE_UI);
  document.getElementById('controlsModal').classList.remove('hidden');
}
function closeControlsModal() {
  document.getElementById('controlsModal').classList.add('hidden');
  try { localStorage.setItem('tc_controls_seen', '1'); } catch (e) {}
}
function toggleControlsModal() {
  const el = document.getElementById('controlsModal');
  if (el.classList.contains('hidden')) openControlsModal(); else closeControlsModal();
}
function maybeShowFirstRunControls() {
  // First-ever visit: lead with the Welcome guide (the "what do I do" throughline),
  // which then hands off to the controls reference. Returning players (who've
  // seen the welcome) just get nothing — controls stay one keypress away (H).
  let welcomeSeen = null, controlsSeen = null;
  try { welcomeSeen = localStorage.getItem('tc_welcome_seen'); controlsSeen = localStorage.getItem('tc_controls_seen'); } catch (e) {}
  if (!welcomeSeen) { setTimeout(openWelcomeModal, 900); return; }
  if (!controlsSeen) setTimeout(openControlsModal, 900); // let the world land first
}
function openWelcomeModal() {
  // Step 2's "talk to townsfolk" instruction, in the platform's own words:
  // desktop players press F, touch players tap the glowing interact prompt.
  const qd = document.getElementById('welcomeQuestDesktop');
  const qm = document.getElementById('welcomeQuestMobile');
  if (qd) qd.classList.toggle('hidden', MOBILE_UI);
  if (qm) qm.classList.toggle('hidden', !MOBILE_UI);
  const el = document.getElementById('welcomeModal');
  if (el) el.classList.remove('hidden');
}
function closeWelcomeModal(thenControls) {
  const el = document.getElementById('welcomeModal');
  if (el) el.classList.add('hidden');
  try { localStorage.setItem('tc_welcome_seen', '1'); } catch (e) {}
  // Offer the full controls once, right after, so new players get both the
  // "why" (welcome) and the "how" (controls) on their first run.
  if (thenControls) {
    let controlsSeen = null;
    try { controlsSeen = localStorage.getItem('tc_controls_seen'); } catch (e) {}
    if (!controlsSeen) setTimeout(openControlsModal, 250);
  }
}
(function wireControlsModal() {
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  on('controlsCloseBtn', closeControlsModal);
  on('menuControls', () => { document.getElementById('menuSheet').classList.add('hidden'); openControlsModal(); });
  on('welcomeStartBtn', () => closeWelcomeModal(true));
  const overlay = document.getElementById('controlsModal');
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeControlsModal(); });
  const welcome = document.getElementById('welcomeModal');
  if (welcome) welcome.addEventListener('click', (e) => { if (e.target === welcome) closeWelcomeModal(true); });
})();

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
// ➤ Send — the tap path phones need (no reliable Enter key on a software
// keyboard) and a nicety on desktop. Same guard as the Enter path.
const chatSendBtn = document.getElementById('chatSendBtn');
if (chatSendBtn) chatSendBtn.addEventListener('click', () => {
  if (currentRoom === 'outside') { chatInput.value = ''; return; }
  sendChatMessage();
  if (MOBILE_UI) chatInput.focus(); // keep the keyboard up for a follow-up
});
// Keep the compose bar above a software keyboard: visualViewport tracks
// the keyboard-shrunk viewport, so translate the bar up by the overlap.
if (window.visualViewport) {
  const vv = window.visualViewport;
  const fitComposeBar = () => {
    const cp = document.getElementById('chatPanel');
    if (!cp || !MOBILE_UI) return;
    const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    cp.style.transform = overlap > 0 ? `translateY(${-overlap}px)` : '';
  };
  vv.addEventListener('resize', fitComposeBar);
  vv.addEventListener('scroll', fitComposeBar);
}

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

// Chat-mangling statuses (Toad's Tongue's 'toad', and the 'gibberish' the
// Werewolf's Terrifying Roar / Wanderer's Echo Canyon inflict) are baked
// into the outgoing text right here at send time, rather than mangled for
// display later — that way a message already sent stays however it was
// cursed, even after the curse itself expires. Nothing in chat history
// silently "un-curses" itself.
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
    if (m.system) {
      // Story/quest/combat beats — persistent history for what the toasts
      // only flashed. Styled as parchment lines, no author.
      div.className = 'chatLine systemLine';
      div.textContent = m.text;
      chatLog.appendChild(div);
      continue;
    }
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
      // In-game lightbox — window.open(dataURL) is blocked by modern
      // browsers and landed on a blank white tab (user-reported in the
      // arcade, which shares this chat renderer).
      img.addEventListener('click', () => openImageLightbox(m.image));
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
  pokeRoomTag();
  // The Wilds is open-world like the town square, not a private room — no chat panel there either.
  document.getElementById('chatPanel').classList.toggle('hidden', room === 'outside' || room === 'wilds' || room === 'ember_wastes' || room.startsWith('dungeon_'));
  document.getElementById('chatPanel').classList.toggle('arcadeMode', room === 'arcade');
  document.getElementById('chatTabs').classList.toggle('hidden', room !== 'arcade');
  if (room !== 'arcade') showChatTab(); // leaving the Arcade always lands back on plain chat
  const headerText = document.getElementById('chatHeaderText');
  if (headerText) headerText.textContent = '💬 ' + roomLabel(room);
  renderChatLog();
  // Session L: the coven table sprite lives only in the café, and the event
  // pill re-evaluates per room (it hides indoors-agnostically otherwise).
  try { refreshCovenTableVisual(); } catch (e) {}
  try { renderEventTag(); } catch (e) {}
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
// Outdoor follow camera — pulled back ~10% (was back:165 height:125) so
// more of the town/wilds is on screen at once. Indoor cams stay as-is:
// their rooms are small, and the cave's walls were tuned to the old
// distances (see updateCamera()'s clip notes).
const OUTDOOR_CAM = { back: 182, height: 138, lookUp: 50 };
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
  // Every interior is now part of the witchy set — each room gets its own
  // color identity and light style, same override machinery the Arcade and
  // Parlor pioneered (cave purple, arcade starlight blue, parlor ghost
  // green, café ember amber, archive violet, court crimson, vault gold).
  cafe:    { label: 'The Cauldron Café', wall: 0x4a2418, banner: 0xff9a3c, furniture: 'tavern',  floorTint: 0xd8a578,
             bg: 0x160b05, ambient: 0xffa060, ambientIntensity: 1.15, fill: 0xffc890,
             lightsStyle: 'lantern', lightColor: 0xff9a3c, beamColor: 0x2a1408 },
  library: { label: 'The Midnight Archive', wall: 0x2c2445, banner: 0x9a7ad9, furniture: 'library', floorTint: 0xa39ad0,
             bg: 0x0b0818, ambient: 0x9a8ae0, ambientIntensity: 1.45, fill: 0xd0c4ff,
             lightsStyle: 'candle', lightColor: 0xffd9a0, beamColor: 0x171030 },
  // The Arcade is the one interior styled like Witch Hazel's lair — same
  // tricks (glowing crystals for light, painted canvas cards on the walls,
  // a glyph ring on the floor), but cold starlight blue with a celestial
  // symbol set instead of tarot & runes. The extra fields are atmosphere
  // overrides only the arcade sets; every other room keeps the warm tavern
  // defaults (see getInteriorScene()).
  arcade:  { label: 'Starlight Arcade', wall: 0x22335e, banner: 0x4fa8ff, furniture: 'alchemist',  floorTint: 0x9db8f0,
             bg: 0x070f22, ambient: 0x4d6fd8, ambientIntensity: 1.7, fill: 0x8fb8ff,
             lightsStyle: 'crystal', beamColor: 0x16223f },
  // The Phantom Parlor — third of the witchy trilogy (cave purple, arcade
  // blue, parlor ghost-green): séance-parlor haunt lit by drifting spirit
  // wisps instead of crystals or fire.
  lounge:  { label: "Phantom Parlor & Widow's Watch", wall: 0x1f3a2e, banner: 0x54e8a8, furniture: 'parlor', floorTint: 0x9fd8b8,
             bg: 0x061410, ambient: 0x3fa87a, ambientIntensity: 1.55, fill: 0x9fffd0,
             lightsStyle: 'wisp', wispColor: 0x8fffbe, lightColor: 0x3fd98a, beamColor: 0x122921 },
  hall:    { label: 'The Coven Court', wall: 0x40202a, banner: 0xd84a5a, furniture: 'greathall', floorTint: 0xd0a0a8,
             bg: 0x140609, ambient: 0xe08070, ambientIntensity: 1.25, fill: 0xffb9a0,
             lightsStyle: 'brazier', lightColor: 0xff6a3c, beamColor: 0x200a10 },
  bank:    { label: 'The Gilded Vault', wall: 0x2a3320, banner: 0xd4af37, furniture: 'bank',      floorTint: 0xd0c890,
             bg: 0x0e1408, ambient: 0xb8c878, ambientIntensity: 1.25, fill: 0xffe9a0,
             lightsStyle: 'vaultlamp', lightColor: 0xffc84a, beamColor: 0x161c0c }
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

// The Temple's altar platform — a raised dais out in the open town square
// (room 'outside'), not tied to any building interior. Unlike the Lounge's
// stairs (a ramp along one axis), this is a rectangular footprint, so it
// needs both x and z; the height still ramps smoothly over the outer edge
// (TEMPLE_RAMP units) rather than snapping instantly, same "no real
// verticality, just a rendered Y function of position" approach. Shared
// with initScene()'s temple placement/collision so the numbers can't drift.
const TEMPLE_PLATFORM_X = 1060, TEMPLE_PLATFORM_Z = 1900;
const TEMPLE_PLATFORM_W = 360, TEMPLE_PLATFORM_D = 260, TEMPLE_PLATFORM_HEIGHT = 16;
const TEMPLE_RAMP = 24;

function getFloorHeight(roomId, rx, rz) {
  if (roomId === 'outside') {
    const halfW = TEMPLE_PLATFORM_W / 2, halfD = TEMPLE_PLATFORM_D / 2;
    const dx = Math.abs(rx - TEMPLE_PLATFORM_X), dz = Math.abs((rz ?? TEMPLE_PLATFORM_Z) - TEMPLE_PLATFORM_Z);
    if (dx <= halfW && dz <= halfD) {
      const depth = Math.min(halfW - dx, halfD - dz);
      return Math.min(TEMPLE_PLATFORM_HEIGHT, TEMPLE_PLATFORM_HEIGHT * (depth / TEMPLE_RAMP));
    }
    // KayKit building entrance stairs (see kkMeasureStairs). The profile is
    // already a smooth capped-slope ramp; here it just gets sampled, plus a
    // smooth lateral fade at the band's edges — the old hard lateral cutoff
    // teleported anyone crossing the zone's side edge up/down the full
    // stair height in one frame.
    const rz2 = rz ?? 0;
    for (let i = 0; i < KK_STAIR_ZONES.length; i++) {
      const z = KK_STAIR_ZONES[i];
      const ox = rx - z.cx, oz = rz2 - z.cz;
      const distOut = ox * z.out[0] + oz * z.out[1];        // how far out from the wall
      if (distOut < -14 || distOut > z.depth) continue;      // small inside overlap keeps the sill up to the threshold
      const lateral = Math.abs(ox * z.out[1] + oz * z.out[0]); // sideways offset from stoop center
      const fade = z.fade || 18;
      if (lateral > z.halfWidth + fade) continue;
      const f = Math.max(0, distOut) / z.step;
      const i0 = Math.min(z.profile.length - 1, Math.floor(f));
      const i1 = Math.min(z.profile.length - 1, i0 + 1);
      let h = z.profile[i0] + (z.profile[i1] - z.profile[i0]) * (f - i0);
      if (lateral > z.halfWidth) {
        const t = 1 - (lateral - z.halfWidth) / fade;       // 1 → 0 across the fade band
        h *= t * t * (3 - 2 * t);                            // smoothstep, no crease at the edge
      }
      return Math.max(0, h);
    }
    return 0;
  }
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
  if (p.room === 'outside' || p.room === 'wilds' || (p.room && p.room.startsWith('dungeon_')) || p.room === 'witch_cave' || p.room === 'bank_vault' || p.room === 'ember_wastes' || !world) return { x: p.x, z: p.y };
  const b = world.buildings.find(bb => bb.id === p.room);
  if (!b) return { x: p.x, z: p.y };
  return { x: (p.x - b.x) * INDOOR_SCALE, z: (p.y - b.y) * INDOOR_SCALE };
}

function contextMatches(room) {
  if (mode === 'indoor') return room === indoorBuildingId;
  if (activeScene === dungeonScene) return me && room === me.room;
  if (activeScene === wildsScene) return room === 'wilds';
  if (activeScene === caveScene) return room === 'witch_cave';
  if (activeScene === vaultScene) return room === 'bank_vault';
  if (activeScene === emberScene) return room === 'ember_wastes';
  return room === 'outside';
}


// ═══════════════════════════════════════════════════════════════════════════
// TIER-3 GRAPHICS (Session F) — lighting, shadows, post-processing, ambience.
// Quality tiers: low ≈ the classic pipeline, medium/high add PCFSoft shadows,
// ACES tone mapping, bloom/grade/FXAA and ambient particles. Persisted in
// localStorage 'tc_gfx' ('auto' resolves by device type).
// ═══════════════════════════════════════════════════════════════════════════
const GFX = (() => {
  let pref = 'auto';
  try { pref = localStorage.getItem('tc_gfx') || 'auto'; } catch (e) {}
  // URL override for QA and stubborn machines: ?gfx=low|medium|high|auto
  const mGfx = location.search.match(/[?&]gfx=(low|medium|high|auto)\b/);
  if (mGfx) pref = mGfx[1];
  const st = {
    pref, quality: 'high', composer: null, renderPass: null, bloomPass: null,
    gradePass: null, fxaaPass: null, gammaPass: null, ready: false,
    scenes: new Map(), skyGroup: null, stars: [], clouds: [], moonGlow: null,
    fireflies: [], lightAmount: 1, isNight: false
  };

  function resolveQuality() {
    if (st.pref === 'auto') return (typeof MOBILE_UI !== 'undefined' && MOBILE_UI) ? 'medium' : 'high';
    return st.pref;
  }

  function hasFX() { return typeof THREE.EffectComposer === 'function' && typeof THREE.UnrealBloomPass === 'function'; }

  function initRenderer() {
    st.quality = resolveQuality();
    applyRendererQuality();
    if (hasFX()) buildComposer();
    st.ready = true;
  }

  function applyRendererQuality() {
    const q = st.quality;
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // The palette was authored against the classic linear pipeline — keep it.
    // The tier-3 look comes from shadows, bloom, grade and ambience instead.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputEncoding = THREE.LinearEncoding;
    renderer.setPixelRatio(Math.min(q === 'low' ? 1 : q === 'medium' ? 1.5 : 2, window.devicePixelRatio || 1));
  }

  const GradeShader = {
    uniforms: { tDiffuse: { value: null }, saturation: { value: 1.07 }, vignette: { value: 0.34 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float saturation; uniform float vignette; varying vec2 vUv;',
      'void main(){',
      '  vec4 c = texture2D(tDiffuse, vUv);',
      '  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));',
      '  c.rgb = mix(vec3(l), c.rgb, saturation);',
      '  float d = distance(vUv, vec2(0.5));',
      '  c.rgb *= 1.0 - vignette * smoothstep(0.42, 0.95, d);',
      '  gl_FragColor = c;',
      '}'
    ].join('\n')
  };

  function buildComposer() {
    st.composer = new THREE.EffectComposer(renderer);
    st.renderPass = new THREE.RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    st.composer.addPass(st.renderPass);
    st.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(W || 1280, H || 720), 0.42, 0.55, 0.82);
    st.composer.addPass(st.bloomPass);
    st.gradePass = new THREE.ShaderPass(GradeShader);
    st.composer.addPass(st.gradePass);
    st.fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
    st.composer.addPass(st.fxaaPass);
    resize(W || window.innerWidth, H || window.innerHeight);
  }

  function composerActive() { return st.ready && st.quality !== 'low' && !!st.composer; }

  function resize(w, h) {
    if (!st.composer) return;
    const pr = renderer.getPixelRatio();
    st.composer.setSize(w, h);
    if (st.fxaaPass) st.fxaaPass.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  }

  // ── shadow tagging ────────────────────────────────────────────────────
  function tagObject(root) {
    root.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (!m) return;
      const glowy = m.transparent === true || (m.blending !== undefined && m.blending !== THREE.NormalBlending) || m.isMeshBasicMaterial;
      if (glowy) { o.castShadow = false; o.receiveShadow = false; return; }
      const g = o.geometry;
      const gt = g && g.type || '';
      const flat = gt.indexOf('Plane') === 0 || gt.indexOf('Circle') === 0;
      o.receiveShadow = true;
      o.castShadow = !flat;
    });
  }

  function sceneInfo(scene) {
    let info = st.scenes.get(scene);
    if (!info) {
      info = { lastCount: -1, tagged: new WeakSet(), sun: null, follow: false, sized: false };
      // outdoor sun/moon migrate between town & wilds; everything else keeps
      // whatever directional its builder gave it.
      if (scene === outdoorScene || scene === wildsScene) { info.sun = outdoorSun; info.follow = true; }
      else {
        scene.traverse(o => { if (!info.sun && o.isDirectionalLight) info.sun = o; });
        if (scene === emberScene) info.follow = true;
      }
      if (info.sun) configureShadow(info.sun, scene, info);
      st.scenes.set(scene, info);
    }
    return info;
  }

  function configureShadow(light, scene, info) {
    const q = st.quality;
    light.castShadow = q !== 'low';
    const mapSize = q === 'high' ? 2048 : 1024;
    light.shadow.mapSize.set(mapSize, mapSize);
    if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
    const span = info.follow ? 720 : 620;
    const c = light.shadow.camera;
    c.left = -span; c.right = span; c.top = span; c.bottom = -span;
    c.near = 40; c.far = 3200;
    light.shadow.bias = -0.00035;
    light.shadow.normalBias = 3;
    c.updateProjectionMatrix();
    if (!light.target.parent && light.parent) light.parent.add(light.target);
  }

  function ensureTagged(scene) {
    const info = sceneInfo(scene);
    const kids = scene.children;
    if (kids.length === info.lastCount) return;
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      if (info.tagged.has(k)) continue;
      tagObject(k);
      info.tagged.add(k);
    }
    info.lastCount = kids.length;
  }

  // ── the ambient sky: stars, clouds, moon halo (rides town↔wilds) ─────
  function softTex(color, inner) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const g2 = x.createRadialGradient(64, 64, inner || 4, 64, 64, 62);
    g2.addColorStop(0, color); g2.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g2; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function initSky(scene) {
    if (st.skyGroup) return;
    const grp = new THREE.Group();
    grp.name = 'gfxSky';
    // two star layers for cheap twinkle
    for (let layer = 0; layer < 2; layer++) {
      const n = layer ? 300 : 420;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const az = Math.random() * Math.PI * 2;
        const alt = Math.asin(Math.random() * 0.92 + 0.06);
        const r = 1900;
        pos[i * 3] = Math.cos(alt) * Math.cos(az) * r;
        pos[i * 3 + 1] = Math.sin(alt) * r;
        pos[i * 3 + 2] = Math.cos(alt) * Math.sin(az) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: layer ? 0xcfd8ff : 0xffffff, size: layer ? 1.6 : 2.3,
        sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      grp.add(pts);
      st.stars.push({ mat, phase: layer * 1.7 });
    }
    // slow clouds
    const cloudTex = softTex('rgba(255,255,255,0.85)', 18);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.32, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(m);
      const sc = 380 + Math.random() * 420;
      sp.scale.set(sc * (1.6 + Math.random() * 0.8), sc * 0.5, 1);
      sp.position.set((Math.random() - 0.5) * 3000, 620 + Math.random() * 260, (Math.random() - 0.5) * 3000);
      grp.add(sp);
      st.clouds.push({ sp, m, speed: 6 + Math.random() * 9, base: 0.22 + Math.random() * 0.16 });
    }
    scene.add(grp);
    st.skyGroup = grp;
    // moon halo, parented to the moon so it migrates with it
    if (moonMesh && !st.moonGlow) {
      const mg = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex('rgba(220,232,255,0.9)', 8), transparent: true, opacity: 0, depthWrite: false, fog: false }));
      mg.scale.set(340, 340, 1);
      moonMesh.add(mg);
      st.moonGlow = mg;
    }
  }

  // ── fireflies: per-scene clusters, alive at night ─────────────────────
  function addFireflies(scene, anchors, perAnchor) {
    const n = anchors.length * perAnchor;
    const pos = new Float32Array(n * 3);
    const base = new Float32Array(n * 3);
    const params = new Float32Array(n * 2);
    let k = 0;
    for (const a of anchors) {
      for (let i = 0; i < perAnchor; i++, k++) {
        const bx = a[0] + (Math.random() - 0.5) * 130;
        const by = 12 + Math.random() * 30;
        const bz = a[1] + (Math.random() - 0.5) * 130;
        base[k * 3] = bx; base[k * 3 + 1] = by; base[k * 3 + 2] = bz;
        pos[k * 3] = bx; pos[k * 3 + 1] = by; pos[k * 3 + 2] = bz;
        params[k * 2] = Math.random() * Math.PI * 2;
        params[k * 2 + 1] = 0.5 + Math.random() * 1.1;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xd8ffa0, size: 5.5, sizeAttenuation: true, transparent: true,
      opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    st.fireflies.push({ scene, pts, mat, base, params, n });
  }

  // ── per-frame ambience + shadow follow, called from updateDayNightCycle ──
  const _anchor = new THREE.Vector3();
  function cycleTick(lightAmount, isNight) {
    st.lightAmount = lightAmount; st.isNight = isNight;
    const t = performance.now() / 1000;
    const night = 1 - lightAmount;
    const q = st.quality;
    for (let i = 0; i < st.stars.length; i++) {
      const s2 = st.stars[i];
      s2.mat.opacity = night * (0.75 + Math.sin(t * 1.3 + s2.phase) * 0.22);
    }
    for (const c of st.clouds) {
      c.sp.position.x += c.speed * (1 / 60);
      if (c.sp.position.x > 2200) c.sp.position.x = -2200;
      c.m.opacity = c.base * (0.35 + lightAmount * 0.65);
      c.m.color.setHSL(0.7, 0.15, 0.35 + lightAmount * 0.55);
    }
    if (st.moonGlow) st.moonGlow.material.opacity = night * 0.5;
    if (st.bloomPass) st.bloomPass.strength = 0.34 + night * 0.42;
    // sky rides the camera so the dome never runs out from over the player
    if (st.skyGroup && activeCamera) {
      st.skyGroup.position.x = activeCamera.position.x;
      st.skyGroup.position.z = activeCamera.position.z;
    }
    // fireflies: only animate the active scene's cluster, at dusk/night
    if (q !== 'low' || true) {
      for (const f of st.fireflies) {
        if (f.scene !== activeScene) continue;
        f.mat.opacity = night * 0.85;
        if (night < 0.04) continue;
        const posAttr = f.pts.geometry.attributes.position;
        const step = q === 'high' ? 1 : 2; // halve the wiggle updates on medium/low
        for (let i = 0; i < f.n; i += step) {
          const ph = f.params[i * 2], sp2 = f.params[i * 2 + 1];
          posAttr.array[i * 3] = f.base[i * 3] + Math.sin(t * sp2 + ph) * 16;
          posAttr.array[i * 3 + 1] = f.base[i * 3 + 1] + Math.sin(t * sp2 * 1.4 + ph * 2.1) * 9;
          posAttr.array[i * 3 + 2] = f.base[i * 3 + 2] + Math.cos(t * sp2 * 0.8 + ph) * 16;
        }
        posAttr.needsUpdate = true;
      }
    }
  }

  // reposition the active scene's shadow rig around the player each frame
  const _snapRight = new THREE.Vector3(), _snapUp = new THREE.Vector3(), _snapDir = new THREE.Vector3();
  function beforeRender() {
    if (!activeScene) return;
    ensureTagged(activeScene);
    const info = st.scenes.get(activeScene);
    if (!info || !info.sun || st.quality === 'low') return;
    if (info.follow && me) {
      const rp = getRenderPos(me);
      _anchor.set(rp.x, 0, rp.z);
      // keep the light's direction, move its box to the player
      const dir = info.sun.position.clone().sub(info.sun.target.position);
      if (dir.lengthSq() < 1) dir.set(400, 600, 300);
      dir.normalize();
      // Texel-snap the shadow box. Sliding the ortho frustum continuously
      // with the player re-rasterizes the shadow map along a NEW texel grid
      // every frame — every shadow edge in view crawls/sparkles while you
      // walk (the reported "crackling"). Quantizing the anchor to whole
      // shadow-map texels in the light's own plane keeps the rasterization
      // grid fixed between steps, which is the standard stabilization.
      const sc = info.sun.shadow.camera;
      const texel = (sc.right - sc.left) / (info.sun.shadow.mapSize.x || 1024);
      _snapDir.copy(dir);
      // basis matching lookAt(): zAxis = dir (light → target reversed), up (0,1,0)
      _snapRight.set(0, 1, 0).cross(_snapDir);
      if (_snapRight.lengthSq() < 1e-6) _snapRight.set(1, 0, 0); else _snapRight.normalize();
      _snapUp.copy(_snapDir).cross(_snapRight).normalize();
      const ar = Math.round(_anchor.dot(_snapRight) / texel) * texel;
      const au = Math.round(_anchor.dot(_snapUp) / texel) * texel;
      const ad = _anchor.dot(_snapDir);
      _anchor.set(0, 0, 0).addScaledVector(_snapRight, ar).addScaledVector(_snapUp, au).addScaledVector(_snapDir, ad);
      info.sun.target.position.copy(_anchor);
      info.sun.position.copy(_anchor).addScaledVector(dir, 1150);
      info.sun.target.updateMatrixWorld();
    } else if (!info.sized) {
      // static scenes: one-time fit of the shadow box around the scene bounds
      info.sized = true;
      const box = new THREE.Box3().setFromObject(activeScene);
      const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
      const span = Math.min(900, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.62 + 60);
      const c = info.sun.shadow.camera;
      c.left = -span; c.right = span; c.top = span; c.bottom = -span;
      c.updateProjectionMatrix();
      info.sun.target.position.set(cx, 0, cz);
      const dir = info.sun.position.clone().normalize();
      info.sun.position.set(cx + dir.x * 800, Math.max(500, info.sun.position.y), cz + dir.z * 800);
      if (!info.sun.target.parent) activeScene.add(info.sun.target);
      info.sun.target.updateMatrixWorld();
    }
  }

  function setQuality(prefIn) {
    st.pref = prefIn;
    try { localStorage.setItem('tc_gfx', prefIn); } catch (e) {}
    st.quality = resolveQuality();
    if (!renderer) return;
    applyRendererQuality();
    for (const [scene, info] of st.scenes) {
      if (info.sun) configureShadow(info.sun, scene, info);
      scene.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true; });
    }
    resize(W || window.innerWidth, H || window.innerHeight);
  }

  window.__gfxResize = resize;
  const api = { st, initRenderer, initSky, addFireflies, cycleTick, beforeRender, composerActive, resize, setQuality,
    get quality() { return st.quality; }, get pref() { return st.pref; },
    get composer() { return st.composer; }, get renderPass() { return st.renderPass; } };
  window.__thornGfx = api;
  return api;
})();

function initScene(w) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0ef);
  scene.fog = new THREE.Fog(0x8fd0ef, 700, 2200);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 4000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  GFX.initRenderer();

  outdoorAmbient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(outdoorAmbient);
  outdoorSun = new THREE.DirectionalLight(0xffe2b8, 0.9); // low amber sun — perpetual witch-hour light
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

  // Fairy rings — circles of red-capped mushrooms in the town's quieter
  // corners, one of them fae-touched and faintly aglow. Pure walk-through
  // dressing (no colliders), part of the daytime witchification: they read
  // in full daylight, not just after dark.
  const FAIRY_RINGS = [
    { x: 640, y: 1210, glow: false }, { x: 2450, y: 820, glow: true },
    { x: 1040, y: 330, glow: false }, { x: 2080, y: 1930, glow: false },
    { x: 760, y: 1880, glow: false }, { x: 2620, y: 1290, glow: false }
  ];
  for (const ring of FAIRY_RINGS) {
    const g = new THREE.Group();
    const capMat = new THREE.MeshLambertMaterial(ring.glow
      ? { color: 0x8a5cf6, emissive: 0x5a2ad0, emissiveIntensity: 0.6 }
      : { color: 0xc23a2a });
    const stemMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc8 });
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n + ring.x * 0.01; // per-ring phase so they don't all align
      const mx = Math.cos(a) * 42, mz = Math.sin(a) * 42;
      const ms = 0.8 + ((i + Math.round(ring.x)) % 3) * 0.25;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.6 * ms, 2 * ms, 6 * ms, 5), stemMat);
      stem.position.set(mx, 3 * ms, mz);
      g.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(4.2 * ms, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
      cap.position.set(mx, 6 * ms, mz);
      g.add(cap);
    }
    if (ring.glow) {
      const fae = new THREE.PointLight(0x8a5cf6, 0.8, 130);
      fae.position.set(0, 14, 0);
      g.add(fae);
    }
    g.position.set(ring.x, 0, ring.y);
    scene.add(g);
  }

  addAnimals(scene);
  addMobs(scene);

  if (world2) {
    scene.add(buildPortalMesh(world2.portalInTown.x, world2.portalInTown.y));
    OUTDOOR_KIOSKS.push({ x: world2.portalInTown.x, z: world2.portalInTown.y, portal: 'wilds' });
  }

  buildTownNPCs(scene, w);

  // The nightly torch ritual's 4 torches — positions mirrored from
  // server.js's TOWN_TORCHES so the ids line up with the wildlife_state
  // broadcast (see applyTownTorchState). Start unlit; the ritual lights
  // them once night falls.
  for (const t of TOWN_TORCHES) {
    const torch = buildTownRitualTorch(t.x, t.y);
    scene.add(torch.group);
    townTorchVisuals[t.id] = torch;
  }

  // The Torchkeepers' temple — a landmark near the back tree line, not part
  // of w.buildings (no interior/door). Now that it's an open platform (no
  // roof to bump into), only the central altar itself blocks movement —
  // the rest of the platform is walkable (see getFloorHeight() for the
  // matching rendered-height ramp), same as addNatureDecor() adding tree
  // colliders by hand. Position/size shared with getFloorHeight() via the
  // TEMPLE_PLATFORM_* constants so the two can't drift apart.
  const templeCx = TEMPLE_PLATFORM_X, templeCz = TEMPLE_PLATFORM_Z, templeW = TEMPLE_PLATFORM_W, templeD = TEMPLE_PLATFORM_D;
  scene.add(buildTownTemple(templeCx, templeCz));
  const altarW = 64, altarD = 64;
  walls.push({ x: templeCx - altarW / 2, y: templeCz - altarD / 2, w: altarW, h: altarD });
  scene.add(buildPathSegment(templeCx, templeCz - templeD / 2 - 30, w.spawn.x, w.spawn.y, 40, dirtTex, hubRadius));

  // Ember Wastes portal — hovers over the altar, only visible/enterable
  // once all 4 torches are lit (see applyTemplePortalState, driven by
  // server.js's templePortalOpen in the wildlife_state broadcast).
  emberPortalVisual = buildEmberPortal(templeCx, templeCz);
  scene.add(emberPortalVisual.group);
  EMBER_PORTAL_KIOSK.x = templeCx; EMBER_PORTAL_KIOSK.z = templeCz;

  kkTownDressing(scene, w);
  GFX.initSky(scene);
  // fireflies cluster on the fairy rings, the plaza well and the portal
  GFX.addFireflies(scene, [[2450, 820], [w.spawn.x - 140, w.spawn.y - 120], [1600, 700], [900, 1500], [2200, 1500]], 22);
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
  try { buildVaultScene(); } catch(e) { console.error('buildVaultScene failed:', e); }
  try { buildEmberScene(); } catch(e) { console.error('buildEmberScene failed:', e); }
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
  for (const light of [outdoorAmbient, outdoorSun, outdoorMoonLight, moonMesh, outdoorSun.target, outdoorMoonLight.target, GFX.st.skyGroup].filter(Boolean)) {
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
  for (const light of [outdoorAmbient, outdoorSun, outdoorMoonLight, moonMesh, outdoorSun.target, outdoorMoonLight.target, GFX.st.skyGroup].filter(Boolean)) {
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

// Just-traversed grace: for a moment after stepping through either portal,
// portal kiosks neither trigger nor show their interact button. On phones
// the button appears exactly where a thumb is about to drag the camera, so
// without this a fresh arrival often tapped themselves straight back.
let portalCooldownUntil = 0;
const PORTAL_COOLDOWN_MS = 2500;

function enterWilds() {
  if (!wildsScene || !world2 || !me) return;
  swapToWildsMap();
  // Face toward the actual Wilds (facing=Math.PI is -Y), not just away
  // from the return portal. Spawn sits at y=8800 in a 10000-tall map —
  // only 1200 units from the southern edge — while everything worth
  // seeing (WILDS_NPCS, the giant tree, the ritual circle) clusters
  // around y≈5000, thousands of units north. facing=0 (+Y) faced the
  // player at that nearby empty edge instead of the Wilds itself. The
  // return portal sits off to the east (see buildWildsScene), out of both
  // the initial view and the walking line north. This also replaces a
  // temporary cameraYawOffset hack that only faked the initial view for
  // one frame — see git history for that fix.
  me.facing = Math.PI;
  me.room = 'wilds';
  me.x = world2.spawn.x;
  me.y = world2.spawn.y;
  portalCooldownUntil = Date.now() + PORTAL_COOLDOWN_MS;
  ws.send(JSON.stringify({ type: 'move', x: me.x, y: me.y, room: me.room }));
  setUnlockToast('🌀 You step through the portal into the Wilds.');
}

function exitWilds() {
  if (!outdoorScene || !TOWN_WORLD || !me || !world2) return;
  swapToTownMap();
  me.room = 'outside';
  // Land clear of the town-side portal kiosk — outside its 80-unit
  // interact radius (the old +70 nudge left the tap button already on
  // screen the moment you arrived), plus the traversal grace below.
  me.x = world2.portalInTown.x;
  me.y = world2.portalInTown.y + 115;
  portalCooldownUntil = Date.now() + PORTAL_COOLDOWN_MS;
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
// Ember Wastes portal — hovers over the Temple's altar, only visible/usable
// once all 4 torches are lit (see applyTemplePortalState(), driven by
// server.js's templePortalOpen field). Same spinning-ring/disc/glow shape as
// buildPortalMesh() but red-tinted and starts hidden, plus positioned well
// above ground to clear the altar it hovers over.
// ---------------------------------------------------------------------------
let emberPortalVisual = null; // { group, disc, glow } — built once in initScene()
let templePortalOpen = false;
const EMBER_PORTAL_KIOSK = { x: 0, z: 0, portal: 'ember_enter' }; // x/z filled in once the temple's built

function buildEmberPortal(cx, cz) {
  const g = new THREE.Group();
  const hoverY = 100; // clears the altar top (~58) with room to read as "floating above it"
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(38, 7, 12, 28),
    new THREE.MeshLambertMaterial({ color: 0x7a1010 })
  );
  ring.position.y = hoverY;
  g.add(ring);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 28),
    new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  disc.position.y = hoverY;
  g.add(disc);
  const glow = new THREE.PointLight(0xff2200, 2.2, 220);
  glow.position.y = hoverY;
  g.add(glow);
  g.position.set(cx, 0, cz);
  g.visible = false;
  portalDiscs.push(disc); // reuses the shared spin animation in updatePortals()
  return { group: g, disc, glow };
}

// Called from the wildlife_state handler whenever templePortalOpen flips —
// toggles the portal's visibility and adds/removes its kiosk from
// OUTDOOR_KIOSKS so "Press F" only ever shows while the portal actually exists.
function applyTemplePortalState(open) {
  if (open === templePortalOpen) return;
  templePortalOpen = open;
  if (emberPortalVisual) emberPortalVisual.group.visible = open;
  const idx = OUTDOOR_KIOSKS.indexOf(EMBER_PORTAL_KIOSK);
  if (open && idx === -1) OUTDOOR_KIOSKS.push(EMBER_PORTAL_KIOSK);
  else if (!open && idx !== -1) OUTDOOR_KIOSKS.splice(idx, 1);
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

// Positions mirrored from server.js's TOWN_TORCHES — must match exactly so
// the wildlife_state broadcast's torch ids line up with these instances
// (see applyTownTorchState).
const TOWN_TORCHES = [
  { id: 'torch_n', x: 1600, y: 880 },
  { id: 'torch_e', x: 1820, y: 1100 },
  { id: 'torch_s', x: 1600, y: 1320 },
  { id: 'torch_w', x: 1380, y: 1100 }
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
  buildMidnightPeddler(scene);
  buildTownBoard(scene);
  buildDelveStone(scene);
}

// ── The Town Board (Session L) — the leaderboards' physical home, a big
// noticeboard on the square. "Give the nightly trophy and hunt streaks a
// board in the town square." Client dressing + kiosk, data via board_state.
const BOARD_SPOT = { x: 2010, y: 1150 };
function buildTownBoard(scene) {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a3b2c });
  for (const px of [-30, 30]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 58, 6), wood);
    post.position.set(px, 29, 0);
    g.add(post);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(76, 44, 4), new THREE.MeshLambertMaterial({ color: 0x2c2340 }));
  panel.position.y = 40;
  g.add(panel);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(86, 4, 16), wood);
  roof.position.y = 65;
  roof.rotation.z = 0.03;
  g.add(roof);
  // Pinned "pages" — pale rectangles, one gold like a first-place sheet.
  const pages = [[-24, 46, 0xd8ccb8], [-2, 42, 0xd8ccb8], [20, 45, 0xffd9a0], [10, 32, 0xcfc3e8], [-16, 31, 0xd8ccb8]];
  for (const [px, py, c] of pages) {
    const page = new THREE.Mesh(new THREE.PlaneGeometry(14, 10 + Math.abs(px % 7)), new THREE.MeshBasicMaterial({ color: c }));
    page.position.set(px, py, 2.4);
    page.rotation.z = (px % 5) * 0.02;
    g.add(page);
  }
  g.position.set(BOARD_SPOT.x, 0, BOARD_SPOT.y);
  g.rotation.y = -0.4;
  scene.add(g);
  const label = makeNpcNameSprite('🏆 The Town Board');
  label.position.set(BOARD_SPOT.x, 80, BOARD_SPOT.y);
  scene.add(label);
  OUTDOOR_KIOSKS.push({ x: BOARD_SPOT.x, z: BOARD_SPOT.y, npc: 'board' });
}

// ── The Delve Stone (Session L) — the two-tap door down. A split standing
// stone breathing violet light on the square's south edge.
const DELVE_STONE_SPOT = { x: 1600, y: 1420 };
let delveStoneGroup = null;
function buildDelveStone(scene) {
  const g = new THREE.Group();
  const rock = new THREE.MeshLambertMaterial({ color: 0x2e283a });
  const left = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 64, 5), rock);
  left.position.set(-11, 32, 0);
  left.rotation.z = 0.12;
  g.add(left);
  const right = new THREE.Mesh(new THREE.CylinderGeometry(9, 13, 56, 5), rock);
  right.position.set(11, 28, 0);
  right.rotation.z = -0.14;
  g.add(right);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: LEGEND_FX.glowTexture(), color: 0x9a76ff, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  glow.scale.set(40, 52, 1);
  glow.position.set(0, 28, 0);
  g.add(glow);
  g.userData.tick = (t) => { glow.material.opacity = 0.4 + Math.sin(t * 1.4) * 0.18; };
  delveStoneGroup = g;
  g.position.set(DELVE_STONE_SPOT.x, 0, DELVE_STONE_SPOT.y);
  scene.add(g);
  const label = makeNpcNameSprite('🕳️ The Delve Stone');
  label.position.set(DELVE_STONE_SPOT.x, 76, DELVE_STONE_SPOT.y);
  scene.add(label);
  OUTDOOR_KIOSKS.push({ x: DELVE_STONE_SPOT.x, z: DELVE_STONE_SPOT.y, npc: 'delve' });
}

// ── The Midnight Peddler's stall (Session I) — a cloaked figure under a
// violet canopy, hung with a lantern; the town-side door to the weekly
// legendary shop. Client-only dressing (fairy-ring precedent: no collider);
// the kiosk entry is what makes it interactive.
const PEDDLER_SPOT = { x: 1350, y: 1180 };
function buildMidnightPeddler(scene) {
  const g = new THREE.Group();
  const post = new THREE.MeshLambertMaterial({ color: 0x3b2c4a });
  const cloth = new THREE.MeshLambertMaterial({ color: 0x241a3b });
  // canopy on four posts
  for (const [px, pz] of [[-26, -18], [26, -18], [-26, 18], [26, 18]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.2, 46, 6), post);
    p.position.set(px, 23, pz);
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(62, 3, 46), cloth);
  roof.position.y = 47;
  roof.rotation.z = 0.05;
  g.add(roof);
  // table
  const table = new THREE.Mesh(new THREE.BoxGeometry(46, 4, 20), new THREE.MeshLambertMaterial({ color: 0x4a3b2c }));
  table.position.set(0, 16, 8);
  g.add(table);
  // the peddler — hooded robe, faceless dark under the hood
  const robe = new THREE.Mesh(new THREE.ConeGeometry(9, 30, 8), new THREE.MeshLambertMaterial({ color: 0x2c2340 }));
  robe.position.set(0, 15, -8);
  g.add(robe);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(5.5, 8, 8), new THREE.MeshLambertMaterial({ color: 0x241c36 }));
  hood.position.set(0, 33, -8);
  g.add(hood);
  // hanging lantern + glow
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), new THREE.MeshBasicMaterial({ color: 0xd9b8ff }));
  lantern.position.set(20, 40, 0);
  g.add(lantern);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: LEGEND_FX.glowTexture(), color: 0xc9a8ff, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  glow.scale.set(34, 34, 1);
  glow.position.set(20, 40, 0);
  g.add(glow);
  // two slow moonstone motes drifting over the table
  const motes = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({
      map: LEGEND_FX.glowTexture(), color: 0xd0d0ff, transparent: true, opacity: 0.8,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    m.scale.set(7, 7, 1);
    g.add(m);
    motes.push(m);
  }
  g.userData.tick = (t) => motes.forEach((m, i) => {
    const a = t * 0.8 + i * Math.PI;
    m.position.set(Math.cos(a) * 14, 26 + Math.sin(t * 1.3 + i) * 4, 8 + Math.sin(a) * 6);
  });
  peddlerStallGroup = g;
  g.position.set(PEDDLER_SPOT.x, 0, PEDDLER_SPOT.y);
  scene.add(g);
  const label = makeNpcNameSprite('🌒 The Midnight Peddler');
  label.position.set(PEDDLER_SPOT.x, 62, PEDDLER_SPOT.y);
  scene.add(label);
  OUTDOOR_KIOSKS.push({ x: PEDDLER_SPOT.x, z: PEDDLER_SPOT.y, npc: 'legend', npcName: 'The Midnight Peddler' });
}
let peddlerStallGroup = null;

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

function makeBonePile(x, z) {
  const g = new THREE.Group();
  const boneMat = new THREE.MeshLambertMaterial({ color: 0xd8d2c0 });
  const oldBoneMat = new THREE.MeshLambertMaterial({ color: 0xb8b09a });
  for (let i = 0; i < 5; i++) {
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 14 + Math.random() * 10, 5), i % 2 ? boneMat : oldBoneMat);
    bone.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.5, Math.random() * Math.PI, 0);
    bone.position.set((Math.random() - 0.5) * 14, 2 + Math.random() * 2, (Math.random() - 0.5) * 14);
    g.add(bone);
  }
  const skullish = new THREE.Mesh(new THREE.SphereGeometry(4.5, 7, 6), boneMat);
  skullish.position.set(3, 4, -2);
  g.add(skullish);
  g.position.set(x, 0, z);
  return g;
}

// Session I: the Wilds forest is now DETERMINISTIC (seeded PRNG, mulberry32
// — the same approach the tier-3 plants use) so every client grows the SAME
// forest, and the chunky pieces finally collide (user report: "no collision
// in the Wilds"). Trees/gravestones/ruins register into WILDS_WALLS; bone
// piles stay walk-through (ankle-height).
function wildsCollide(x, z, r) {
  WILDS_WALLS.push({ x: x - r, y: z - r, w: r * 2, h: r * 2 });
}
function addSpookyDecor(scene, w2) {
  let seed = 0x517cc1b7 >>> 0;
  const rand = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = (a, b) => a + rand() * (b - a);
  const keepClear = [ // spawn + portal approach + campfires stay walkable
    { x: w2.spawn.x, y: w2.spawn.y, r: 320 },
    ...WILDS_CAMPFIRES.map((f) => ({ x: f.x, y: f.y, r: 120 }))
  ];
  const clearOf = (x, z) => keepClear.every((c) => Math.hypot(x - c.x, z - c.y) > c.r);
  // Spooky trees — thick clusters near the cave and scattered throughout.
  for (let i = 0; i < 150; i++) {
    const x = rng(300, w2.width - 300), z = rng(300, w2.height - 300);
    if (!clearOf(x, z)) continue;
    scene.add(makeSpookyTree(x, z));
    wildsCollide(x, z, 9);
  }
  // Graveyard clusters (two more than before, filling the SE and far west)
  for (const [cx, cz] of [[1200,1500],[3500,2800],[6000,1200],[2000,7000],[7500,4000],[5000,8500],[8200,8200],[900,6500]]) {
    for (let i = 0; i < 9; i++) {
      const x = cx + rng(-110, 110), z = cz + rng(-110, 110);
      scene.add(makeGravestone(x, z));
      wildsCollide(x, z, 6);
    }
    // Spooky trees around graveyard
    for (let i = 0; i < 5; i++) {
      const x = cx + rng(-200, 200), z = cz + rng(-200, 200);
      if (!clearOf(x, z)) continue;
      scene.add(makeSpookyTree(x, z));
      wildsCollide(x, z, 9);
    }
    // …and the remains of whatever visits graveyards at night
    for (let i = 0; i < 2; i++) {
      scene.add(makeBonePile(cx + rng(-170, 170), cz + rng(-170, 170)));
    }
  }
  // Ruined buildings (two more clusters)
  for (const [cx, cz] of [[3000,5000],[7000,7000],[1500,4000],[8500,2000],[4200,6600],[8600,5200]]) {
    for (let i = 0; i < 4; i++) {
      const x = cx + rng(-160, 160), z = cz + rng(-160, 160);
      scene.add(makeRuinedWall(x, z));
      wildsCollide(x, z, 16);
    }
    scene.add(makeBonePile(cx + rng(-120, 120), cz + rng(-120, 120)));
  }
  // fixed structures that were always ghost-walkable:
  for (const f of WILDS_CAMPFIRES) wildsCollide(f.x, f.y, 14);         // fire pit itself (heal radius is much larger)
  for (const m of WILDS_WAYMARKERS) wildsCollide(m.x, m.y, 9);          // standing lore stones
  wildsCollide(6500, 6200, 34);                                          // the giant werewolf tree's trunk
}

// ── Wilds campfires ─────────────────────────────────────────────────────────
// Always-lit rest stops (the server heals anyone standing in the glow —
// see WILDS_CAMPFIRES in server.js; keep these coordinates identical).
const WILDS_CAMPFIRES = [
  { x: 5000, y: 8450 },
  { x: 3400, y: 4300 },
  { x: 6300, y: 5300 },
  { x: 2650, y: 2650 },
  { x: 5000, y: 1600 }
];

function makeWildsCampfire(x, z) {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x6b6b63 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(5 + (i % 2), 0), stoneMat);
    stone.position.set(Math.cos(a) * 22, 3, Math.sin(a) * 22);
    stone.rotation.set(i, i * 2, 0);
    g.add(stone);
  }
  const logMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
  for (const rot of [0.4, 1.7, 2.9]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 30, 6), logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = rot;
    log.position.y = 4;
    g.add(log);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(10, 26, 8), new THREE.MeshBasicMaterial({ color: 0xff9d3c }));
  flame.position.y = 18;
  g.add(flame);
  const flameCore = new THREE.Mesh(new THREE.ConeGeometry(5, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  flameCore.position.y = 15;
  g.add(flameCore);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xff9d3c, transparent: true, opacity: 0.5, depthWrite: false }));
  glow.scale.set(90, 90, 1);
  glow.position.y = 20;
  g.add(glow);
  const light = new THREE.PointLight(0xff9d3c, 0.85, 300);
  light.position.y = 26;
  g.add(light);
  g.position.set(x, 0, z);
  return g;
}

// ── Wilds waymarkers — standing lore stones (read with F / the pill) ───────
// Positions mirrored from server.js's WAYMARKER_LORE keys.
const WILDS_WAYMARKERS = [
  { id: 'way_severance', x: 3800, y: 7300 },
  { id: 'way_hollow', x: 5900, y: 4300 },
  { id: 'way_factions', x: 2900, y: 5200 },
  { id: 'way_hazel', x: 2350, y: 2350 },
  { id: 'way_wastes', x: 7300, y: 3300 }
];

function makeWaymarkerStone(x, z) {
  const g = new THREE.Group();
  const stone = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 12, 74, 7),
    new THREE.MeshLambertMaterial({ color: 0x7a7a85 })
  );
  stone.position.y = 37;
  stone.rotation.z = 0.06;
  g.add(stone);
  const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(9, 0), new THREE.MeshLambertMaterial({ color: 0x6b6b78 }));
  cap.position.y = 76;
  g.add(cap);
  // Faintly glowing runes down the face
  const runeMat = new THREE.MeshBasicMaterial({ color: 0xb37ae0, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 4; i++) {
    const rune = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5, 0.8), runeMat);
    rune.position.set(i % 2 ? 3 : -2, 58 - i * 12, 10.5 - i * 0.8);
    rune.rotation.z = (i % 2 ? 1 : -1) * 0.3;
    g.add(rune);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 18, 6, 8), new THREE.MeshLambertMaterial({ color: 0x55554e }));
  base.position.y = 3;
  g.add(base);
  g.position.set(x, 0, z);
  return g;
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

// ---------------------------------------------------------------------------
// Bank Vault scene — a small sub-room reached from inside the Bank's own
// interior (not from the town/wilds directly), same architecture as the
// Witch's Cave above (own scene/camera, own small world bounds, own
// kiosk list, mode stays 'outdoor' the whole time it's active so none of
// the "am I inside a building" logic elsewhere mistakes it for one).
// ---------------------------------------------------------------------------
let vaultScene, vaultCamera;
const VAULT_WORLD = { width: 300, height: 300, buildings: [], spawn: { x: 150, y: 60 } };
const VAULT_KIOSKS = [
  { x: 150, z: 40, portal: 'vault_exit' }
];

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

// A small room behind the Bank's vault door — piles of coins, gold bars,
// loose gems and open chests, same props/materials as the peek visible
// through the open door in the Bank's main room (see buildFurniture's
// bank branch), just more of it since this is the actual destination now
// rather than a glimpse.
function buildVaultScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1408);
  scene.fog = new THREE.Fog(0x1a1408, 250, 700);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 1400);
  vaultScene = scene;
  vaultCamera = camera;

  const roomW = VAULT_WORLD.width, roomD = VAULT_WORLD.height, wallH = 150;
  scene.add(new THREE.AmbientLight(0xffd9a0, 0.55));

  const stoneTex = makeStoneTexture();
  stoneTex.repeat.set(roomW / 60, roomD / 60);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshLambertMaterial({ map: stoneTex, color: 0xc9a86a })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(roomW / 2, 0, roomD / 2);
  scene.add(floor);

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a3226 });
  const wallDefs = [
    [roomW, wallH, 8, roomW / 2, wallH / 2, 0],           // back (far from entrance)
    [8, wallH, roomD, 0, wallH / 2, roomD / 2],            // left
    [8, wallH, roomD, roomW, wallH / 2, roomD / 2],        // right
    [roomW, wallH, 8, roomW / 2, wallH / 2, roomD]         // near (entrance side)
  ];
  for (const [w, h, d, x, y, z] of wallDefs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    wall.position.set(x, y, z);
    scene.add(wall);
  }

  // EXIT sign and a faint glow near the entrance, matching the interior
  // door pattern used elsewhere (see buildInteriorDoorway).
  const exitSign = makeSignSprite('EXIT');
  exitSign.position.set(roomW / 2, wallH * 0.6, roomD - 6);
  scene.add(exitSign);

  const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4af37, emissive: 0x4a3a10, emissiveIntensity: 0.45 });
  // Several coin piles scattered across the room
  const pileSpots = [
    [roomW * 0.3, roomD * 0.35], [roomW * 0.7, roomD * 0.3], [roomW * 0.5, roomD * 0.55],
    [roomW * 0.22, roomD * 0.65], [roomW * 0.78, roomD * 0.6]
  ];
  for (const [px, pz] of pileSpots) {
    for (let i = 0; i < 4; i++) {
      const r = 24 - i * 4;
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 5, 16), goldMat);
      coin.position.set(px + (Math.random() - 0.5) * 6, 12 + i * 6, pz + (Math.random() - 0.5) * 6);
      coin.rotation.z = (Math.random() - 0.5) * 0.15;
      scene.add(coin);
    }
  }
  // Gold bars stacked near the back wall
  for (let i = 0; i < 6; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 12), goldMat);
    bar.position.set(roomW * 0.5 + (i % 3 - 1) * 26, 10 + Math.floor(i / 3) * 11, roomD * 0.15);
    scene.add(bar);
  }
  // Loose gems scattered among the piles
  const gemColors = [0xff3355, 0x33ccff, 0x66ff66, 0xcc66ff, 0xffaa33];
  for (let i = 0; i < 14; i++) {
    const color = gemColors[i % gemColors.length];
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(5 + Math.random() * 3),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35 })
    );
    gem.position.set(roomW * 0.1 + Math.random() * roomW * 0.8, 6 + Math.random() * 25, roomD * 0.15 + Math.random() * roomD * 0.6);
    scene.add(gem);
  }
  // A few open treasure chests along the side walls
  for (const [px, pz, rotY] of [[24, roomD * 0.3, Math.PI / 2], [roomW - 24, roomD * 0.3, -Math.PI / 2], [24, roomD * 0.7, Math.PI / 2]]) {
    const chest = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 20), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
    body.position.y = 8;
    chest.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(28, 10, 20), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
    lid.position.set(0, 18, -8);
    lid.rotation.x = -1.1;
    chest.add(lid);
    const spill = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 3, 12), goldMat);
    spill.position.y = 17;
    chest.add(spill);
    chest.position.set(px, 0, pz);
    chest.rotation.y = rotY;
    scene.add(chest);
  }

  // Warm glowing lights spread through the room so the treasure actually
  // shimmers instead of sitting in flat shadow.
  for (const [lx, lz] of [[roomW * 0.3, roomD * 0.35], [roomW * 0.7, roomD * 0.35], [roomW * 0.5, roomD * 0.6]]) {
    const glow = new THREE.PointLight(0xffcc66, 1.1, 180);
    glow.position.set(lx, 60, lz);
    scene.add(glow);
  }
}

// ---------------------------------------------------------------------------
// The Ember Wastes — a Wilds-styled PvP/hostile-mob map reached through the
// red portal over the Temple's altar once all 4 torches are lit (see
// applyTemplePortalState()). Same "outdoor sub-room" pattern as the Vault:
// mode stays 'outdoor' the whole time it's active. EMBER_KIOSKS is rebuilt
// fresh every wildlife_state tick from whichever ember mobs are currently
// alive (see applyEmberMobState) rather than built once like every other
// kiosk list — unlike everything else with a kiosk, these targets move.
// ---------------------------------------------------------------------------
let emberScene, emberCamera;
const EMBER_WORLD = { width: 4000, height: 4000, buildings: [], spawn: { x: 2000, y: 3650 } };
let EMBER_STATIC_KIOSKS = []; // the fixed exit portal, built once
let EMBER_KIOSKS = [];        // static + live mobs, rebuilt each tick

// Humanoid, not the blob-monster rig every other mob type uses — each gets
// its own custom preset (see createHumanoid's presetOverride) rather than
// one of the 5 playable looks, so they read as hostile at a glance instead
// of looking like another player. Glowing eye colors match the flavor each
// type already had (fire/ember, bone/death, molten-brute).
const EMBER_MOB_VISUALS = {
  ash_wraith:   { name: 'Ash Wraith',   scale: 0.95, preset: { skin: 0xb85a30, hair: 0x3a1810, hairStyle: 'mohawk', eye: 0xffcc66, shirt: 0x5a2015, pants: 0x2a1a15 } },
  bonecaller:   { name: 'Bonecaller',   scale: 1.0,  preset: { skin: 0xd8d0b8, hair: 0x1a1a1a, hairStyle: 'long',   eye: 0x66ffaa, shirt: 0x2a2418, pants: 0x1c1810 } },
  cinder_brute: { name: 'Cinder Brute', scale: 1.25, preset: { skin: 0x8a3a1a, hair: 0x1a0a00, hairStyle: 'buzz',   eye: 0xffaa00, shirt: 0x4a1a00, pants: 0x2a1000 } }
};

let emberMobVisuals = {};

function getOrCreateEmberMobVisual(id, mobType) {
  let v = emberMobVisuals[id];
  if (!v) {
    const visual = EMBER_MOB_VISUALS[mobType] || EMBER_MOB_VISUALS.ash_wraith;
    const built = createHumanoid(0, visual.preset);
    built.group.scale.setScalar(visual.scale);
    built.group.visible = false;
    built.group.userData = { kind: 'ember_mob', targetId: id };
    built.group.add(makeHealthBarSprite(78));
    const label = makeNpcNameSprite(visual.name);
    label.position.set(0, 96, 0);
    built.group.add(label);
    if (emberScene) emberScene.add(built.group);
    v = emberMobVisuals[id] = {
      group: built.group, armL: built.armL, armR: built.armR, legL: built.legL, legR: built.legR,
      x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      initialized: false, dead: false, hasLoot: false, attackAnimStartAt: null, walkPhase: Math.random() * 10
    };
  }
  return v;
}

function applyEmberMobState(list) {
  if (!emberScene) return;
  const aliveKiosks = [];
  for (const m of list) {
    const v = getOrCreateEmberMobVisual(m.id, m.mobType);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    v.hasLoot = !!m.hasLoot;
    if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
    if (m.health !== undefined) {
      const hpBar = v.group.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
    }
    if (!m.dead) aliveKiosks.push({ x: m.x, z: m.y, npc: 'ember_mob', targetId: m.id });
  }
  EMBER_KIOSKS = EMBER_STATIC_KIOSKS.concat(aliveKiosks);
}

// Same walk-cycle pattern as the Wilds' village NPCs, plus an arm-swing
// "punch" (reusing mobAttackLungeAmount's existing 0->1->0 timing, just
// applied to a limb instead of a whole-body lunge+pitch — that reads fine
// on the blob-monster rig but would look like a face-plant on a humanoid)
// and a much smaller forward step than the blob mobs get, for the same reason.
//
// Unlike every other humanoid in this game (players, village NPCs,
// Torchkeepers), ember mob TYPES move at wildly different speeds
// (24-85, vs. a player's constant 230) — a fixed walkPhase rate looked
// like the legs were pumping independently of how fast the body was
// actually covering ground ("robotic" foot-sliding, worst on the slow
// Cinder Brute). Deriving the rate from how far this mob's own rendered
// position actually moved this frame, using the same rad-per-unit ratio
// the player's fixed 9/230 already implies, scales the cadence to match
// whatever it's really doing (wandering slowly or sprinting at a rival).
const MOB_WALK_RADIANS_PER_UNIT = 9 / 230;

function updateEmberMobVisuals(dt) {
  const f = 1 - Math.exp(-dt * 8);
  for (const id in emberMobVisuals) {
    const v = emberMobVisuals[id];
    const prevX = v.x, prevY = v.y;
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);

    const actualSpeed = dt > 0 ? Math.hypot(v.x - prevX, v.y - prevY) / dt : 0;
    const atk = mobAttackLungeAmount(v);
    const moving = actualSpeed > 4;
    if (atk === 0) v.walkPhase += dt * actualSpeed * MOB_WALK_RADIANS_PER_UNIT;

    let bobY = 0;
    if (atk > 0) {
      v.armR.rotation.x = -atk * 0.9;
      v.armL.rotation.x = -atk * 0.2;
      v.legL.rotation.x = 0; v.legR.rotation.x = 0;
    } else if (moving) {
      const swing = Math.sin(v.walkPhase) * 0.45;
      v.armL.rotation.x = swing;
      v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing * 0.65;
      v.legR.rotation.x = swing * 0.65;
      bobY = Math.abs(Math.sin(v.walkPhase)) * 2;
    } else {
      v.armL.rotation.x *= 0.85;
      v.armR.rotation.x *= 0.85;
      v.legL.rotation.x *= 0.85;
      v.legR.rotation.x *= 0.85;
    }

    const lungeDist = atk * (MOB_ATTACK_LUNGE_DIST * 0.5);
    v.group.position.set(v.x + Math.sin(v.facing) * lungeDist, bobY, v.y + Math.cos(v.facing) * lungeDist);
    v.group.rotation.y = v.facing;
    v.group.visible = !v.dead;
  }
}

function buildEmberScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a0f0a);
  scene.fog = new THREE.Fog(0x2a0f0a, 500, 2200);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 4000);
  // Assign early so swapToEmberMap works even if geometry building throws below.
  emberScene = scene;
  emberCamera = camera;

  scene.add(new THREE.AmbientLight(0xff7755, 0.6));
  const emberSun = new THREE.DirectionalLight(0xff9966, 0.65);
  emberSun.position.set(300, 600, 200);
  scene.add(emberSun);

  const groundTex = makeGrassTexture();
  const groundSpan = Math.max(EMBER_WORLD.width, EMBER_WORLD.height) + 200;
  groundTex.repeat.set(groundSpan / 140, groundSpan / 140);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(EMBER_WORLD.width + 200, EMBER_WORLD.height + 200),
    new THREE.MeshLambertMaterial({ map: groundTex, color: 0xb87860 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(EMBER_WORLD.width / 2, 0, EMBER_WORLD.height / 2);
  scene.add(ground);

  // Scattered scorched-looking rocks/trees for atmosphere — purely cosmetic
  // (no harvesting, no collision), just breaking up the open field so it
  // reads as a wilder, wilds-like place rather than an empty box.
  const decorSpots = [
    [400, 400], [3600, 400], [400, 3600], [3600, 3600],
    [2000, 250], [2000, 3200], [250, 2000], [3750, 2000],
    [1200, 1000], [2800, 1000], [1200, 2800], [2800, 2800],
    [1500, 1900], [2500, 1900]
  ];
  decorSpots.forEach(([x, y], i) => {
    const group = (i % 2 === 0) ? makeRock(x, y, 1.1 + Math.random() * 0.5) : makeTree(x, y, 2.2 + Math.random() * 0.8);
    group.traverse(c => {
      if (c.isMesh && c.material && c.material.color) {
        c.material = c.material.clone();
        c.material.color.offsetHSL(0, 0, -0.08);
      }
    });
    scene.add(group);
  });

  // Return portal near spawn
  const exitX = EMBER_WORLD.spawn.x, exitY = EMBER_WORLD.spawn.y - 120;
  scene.add(buildPortalMesh(exitX, exitY));
  EMBER_STATIC_KIOSKS = [{ x: exitX, z: exitY, portal: 'ember_exit' }];
  EMBER_KIOSKS = EMBER_STATIC_KIOSKS.slice();

  for (const id in emberMobVisuals) scene.remove(emberMobVisuals[id].group);
  emberMobVisuals = {};
}

function swapToEmberMap() {
  if (!emberScene || activeScene === emberScene) return;
  world = EMBER_WORLD;
  walls = [];
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(emberScene, emberCamera, null);
}

function enterEmberWastes() {
  if (!me || me.isDead) return;
  mode = 'outdoor';
  indoorBuildingId = null;
  swapToEmberMap();
  me.room = 'ember_wastes';
  me.x = EMBER_WORLD.spawn.x;
  me.y = EMBER_WORLD.spawn.y;
  ws.send(JSON.stringify({ type: 'enter_ember_wastes' }));
  setUnlockToast('🔥 You step through the portal into the Ember Wastes...');
}

function exitEmberWastes() {
  ws.send(JSON.stringify({ type: 'exit_ember_wastes' }));
}

function swapToVaultMap() {
  if (!vaultScene || activeScene === vaultScene) return;
  world = VAULT_WORLD;
  walls = [];
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(vaultScene, vaultCamera, null);
}

function enterVault() {
  if (!me || me.isDead) return;
  // Treated the same as the Witch's Cave for state-tracking purposes even
  // though it's reached from inside a building: mode stays 'outdoor' (not
  // 'indoor') so none of the building-interior-specific logic elsewhere
  // (collision walls, currentInterior-based kiosk lookup, etc.) mistakes
  // this small standalone room for the Bank's own interior.
  mode = 'outdoor';
  indoorBuildingId = null;
  swapToVaultMap();
  me.room = 'bank_vault';
  me.x = VAULT_WORLD.spawn.x;
  me.y = VAULT_WORLD.spawn.y;
  ws.send(JSON.stringify({ type: 'enter_vault' }));
  setUnlockToast('💰 You step into the vault...');
}

function exitVault() {
  ws.send(JSON.stringify({ type: 'exit_vault' }));
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

  addNatureDecor(scene, w2, decorVisuals2, WILDS_WALLS);
  addAnimals2(scene);
  addMobs2(scene);
  addSpookyDecor(scene, w2);
  addVillageBuildings(scene);
  addUnboundCircleSet(scene);
  addThornwardenCamp(scene);
  addGiantWerewolfTree(scene);
  buildWildsNPCs(scene);

  // The return portal back to town — parked EAST of the arrival spot, not
  // north of it. It used to sit at spawn.y - 80, squarely in the walking
  // line toward everything worth seeing (all the content is north), so
  // players strolled straight into its interact radius and the mobile tap
  // button popped up right under the thumb that was about to turn the
  // camera — instant accidental bounce back to town. Off to the side, you
  // only reach it on purpose.
  const returnPortalX = w2.spawn.x + 170, returnPortalY = w2.spawn.y + 20;
  scene.add(buildPortalMesh(returnPortalX, returnPortalY));
  WILDS_KIOSKS.push({ x: returnPortalX, z: returnPortalY, portal: 'town' });

  // Witch cave entrance — a proper LARGE rock formation now: a mound of
  // huge weathered boulders shouldering each other around a dark maw,
  // mossy caps on top, rubble at the foot — not the old floating box.
  const CX = WITCH_CAVE_ENTRANCE_X, CZ = WITCH_CAVE_ENTRANCE_Z;
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4a4550 });
  const rockDark = new THREE.MeshLambertMaterial({ color: 0x38343f });
  const mossMat = new THREE.MeshLambertMaterial({ color: 0x2f4a30 });
  // [dx, y, dz, radius, material] — one great back boulder, two shoulders,
  // a capstone bridging the maw, and rubble by the mouth.
  const CAVE_BOULDERS = [
    [0, 55, -55, 105, rockMat],     // the mountain of the thing
    [-105, 42, -10, 70, rockDark],  // west shoulder
    [102, 40, -14, 66, rockMat],    // east shoulder
    [-2, 118, -30, 52, rockDark],   // capstone over the maw
    [-58, 14, 48, 26, rockMat],     // rubble, west of the mouth
    [60, 12, 50, 22, rockDark],     // rubble, east of the mouth
    [-150, 10, 45, 16, rockMat],    // outlying stone
    [148, 9, 40, 14, rockDark]      // outlying stone
  ];
  CAVE_BOULDERS.forEach(([dx, y, dz, r, mat], i) => {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat);
    b.position.set(CX + dx, y, CZ + dz);
    b.rotation.set(i * 0.7, i * 1.3, i * 0.5);
    scene.add(b);
  });
  // Moss caps draped on the high stones
  for (const [dx, y, dz, r] of [[-10, 148, -35, 30], [-95, 95, -20, 22], [95, 88, -25, 20]]) {
    const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mossMat);
    moss.scale.y = 0.45;
    moss.position.set(CX + dx, y, CZ + dz);
    scene.add(moss);
  }
  // The maw — a dark mouth low in the face, purple candlelight inside
  const maw = new THREE.Mesh(new THREE.CylinderGeometry(34, 40, 62, 10), new THREE.MeshLambertMaterial({ color: 0x040106 }));
  maw.position.set(CX, 30, CZ + 28);
  scene.add(maw);
  const caveGlow = new THREE.PointLight(0x8822cc, 0.9, 260);
  caveGlow.position.set(CX, 30, CZ + 10);
  scene.add(caveGlow);
  const mawGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0x8822cc, transparent: true, opacity: 0.35, depthWrite: false }));
  mawGlow.scale.set(80, 80, 1);
  mawGlow.position.set(CX, 34, CZ + 30);
  scene.add(mawGlow);
  // A pair of gnarled trees leaning over the formation
  scene.add(makeSpookyTree(CX - 175, CZ - 60));
  scene.add(makeSpookyTree(CX + 180, CZ - 45));
  const caveSign = makeSignSprite('🕯️ Witch\'s Cave — Press F to enter');
  caveSign.position.set(CX, 185, CZ);
  scene.add(caveSign);
  WILDS_KIOSKS.push({ x: CX, z: CZ, portal: 'cave_enter' });

  // Campfires (server-healing rest stops) + lore waymarkers
  for (const f of WILDS_CAMPFIRES) scene.add(makeWildsCampfire(f.x, f.y));
  for (const m of WILDS_WAYMARKERS) {
    scene.add(makeWaymarkerStone(m.x, m.y));
    WILDS_KIOSKS.push({ x: m.x, z: m.y, npc: 'waymark', markerId: m.id, radius: 95 });
  }

  kkWildsDressing(scene, w2);
  GFX.addFireflies(scene, [[w2.spawn.x, w2.spawn.y - 300], [w2.width * 0.3, w2.height * 0.42], [w2.width * 0.55, w2.height * 0.3], [w2.width * 0.71, w2.height * 0.6], [w2.width * 0.45, w2.height * 0.55]], 26);
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

  const lextonLabel = makeNpcNameSprite('Lexton Greyfur', 'Voice of the Howl');
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

  // The lore plaque (Session L) — a standing stone by the player spawn.
  // One mesh serves all four named dungeons AND delve floors; the text it
  // opens comes from dungeonLoreCatalog keyed by whichever room you're in.
  const plaque = new THREE.Group();
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(34, 44, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a3048 })
  );
  slab.position.y = 30;
  plaque.add(slab);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(42, 10, 12),
    new THREE.MeshLambertMaterial({ color: 0x2e283a })
  );
  base.position.y = 5;
  plaque.add(base);
  const rune = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 30),
    new THREE.MeshBasicMaterial({ color: 0x8a76c9, transparent: true, opacity: 0.35 })
  );
  rune.position.set(0, 30, 3.2);
  plaque.add(rune);
  plaque.position.set(466, 0, 700);
  plaque.rotation.y = -0.5;
  scene.add(plaque);
  DUNGEON_KIOSKS.push({ x: 466, z: 700, npc: 'plaque' });

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

// Witchlight daytime: no more postcard-blue noon. Day is a moody mauve —
// still clearly daylight (mobs stay asleep, lamps stay off), but the town
// reads as the kind of place where the Cauldron Café makes sense.
const SKY_DAY = new THREE.Color(0x9b93c9);
const SKY_NIGHT = new THREE.Color(0x0a1230);
const AMBIENT_DAY = new THREE.Color(0xe6dcf5);
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

const SKY_BLOOD = new THREE.Color(0x2a0812);
const AMBIENT_BLOOD = new THREE.Color(0xc06a6a);
const MOON_BLOOD_COLOR = new THREE.Color(0xff5a4a);
const MOON_PALE_COLOR = new THREE.Color(0xeaf2ff); // the moon's authored face
function updateDayNightCycle() {
  if (!outdoorScene || !outdoorAmbient || !outdoorSun) return;
  const { lightAmount, isNight, dayProgress, nightProgress } = getDayNightState();
  // 🔴 Blood Moon nights (Session L): every 13th night the sky goes red —
  // pure client-side clock math, the same cycle arithmetic the server uses.
  const bloodMoon = isNight && bloodMoonActiveClient();

  _skyColor.copy(bloodMoon ? SKY_BLOOD : SKY_NIGHT).lerp(SKY_DAY, lightAmount);
  outdoorScene.background.copy(_skyColor);
  if (outdoorScene.fog) outdoorScene.fog.color.copy(_skyColor);
  // Kept in sync even while inactive — the Wilds shares the same day/night
  // clock, so its sky shouldn't be stuck wherever it was at startup the
  // first time a player actually steps through the portal.
  if (wildsScene) {
    wildsScene.background.copy(_skyColor);
    if (wildsScene.fog) wildsScene.fog.color.copy(_skyColor);
  }

  _ambientColor.copy(bloodMoon ? AMBIENT_BLOOD : AMBIENT_NIGHT).lerp(AMBIENT_DAY, lightAmount);
  outdoorAmbient.color.copy(_ambientColor);
  outdoorAmbient.intensity = 0.38 + lightAmount * 0.27;

  // Sun arcs from one horizon to the other across the day; moon mirrors it
  // across the night. Using sin() for height means both rise and set
  // smoothly rather than popping in at a fixed height.
  const r = dayNightWorldRadius;
  const sunAngle = Math.PI * dayProgress;
  // Direction rides the same arc as before; position anchors near the player
  // (see GFX.beforeRender) so the shadow frustum stays tight. Pre-join, the
  // old absolute arc position still applies.
  const sunDir = { x: Math.cos(sunAngle), y: Math.max(0.1, Math.sin(sunAngle) * 0.6), z: 0.4 };
  outdoorSun.position.set(sunDir.x * 1150, sunDir.y * 1150, sunDir.z * 1150);
  if (outdoorSun.target) outdoorSun.target.position.set(0, 0, 0);
  outdoorSun.intensity = lightAmount * 0.9;

  const moonAngle = Math.PI * nightProgress;
  const moonY = Math.sin(moonAngle) * r * 0.6; // nightProgress in [0,1] -> angle in [0,π] -> always >= 0, horizon to horizon
  moonMesh.position.set(Math.cos(moonAngle) * -r, Math.max(-80, moonY), -r * 0.4);
  outdoorMoonLight.position.set(Math.cos(moonAngle) * -1150, Math.max(60, moonY / Math.max(1, r) * 1150), -460);
  const moonStrength = 1 - lightAmount;
  outdoorMoonLight.intensity = moonStrength * 0.55;
  // The moon itself blushes on blood nights, and its light follows.
  moonMesh.material.color.copy(bloodMoon ? MOON_BLOOD_COLOR : MOON_PALE_COLOR);
  outdoorMoonLight.color.copy(bloodMoon ? MOON_BLOOD_COLOR : MOON_PALE_COLOR);
  moonMesh.material.opacity = moonStrength;
  moonMesh.visible = moonStrength > 0.02;

  // Lane lampposts come on with the dark — a warm counterpoint to the cool
  // moonlight, riding the same lightAmount curve so they fade in through
  // dusk instead of snapping. (Cheap: material opacity only, no lights.)
  if (LAMP_GLOWS.length) {
    const glow = 1 - lightAmount;
    for (const l of LAMP_GLOWS) {
      l.glassMat.opacity = 0.22 + glow * 0.72;
      l.glowMat.opacity = glow * 0.55;
    }
  }

  GFX.cycleTick(lightAmount, isNight);
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
  else if (kind === 'ember_mob') v = emberMobVisuals[targetId];
  const root = v && (v.mesh || v.group); // ember mobs are humanoid (group), everything else is a bare mesh
  if (!root) return;
  root.traverse(child => {
    if (child.isMesh && child.material && child.material.emissive) child.material.emissive.set(0xff2200);
  });
  setTimeout(() => {
    root.traverse(child => {
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
    v.hasLoot = !!m.hasLoot;
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
  void_leviathan:  { color: 0x000022, eyeColor: 0x0066ff, scale: 2.0  },
  // ── The signature bosses (Session L) — one per named dungeon ──
  boss_rat_king:       { color: 0x8a6a3a, eyeColor: 0xffcc44, scale: 1.5,  boss: true },
  boss_crypt_weaver:   { color: 0x5a2a5a, eyeColor: 0xff88ff, scale: 1.65, boss: true },
  boss_forge_tyrant:   { color: 0xb84a10, eyeColor: 0xffee66, scale: 1.95, boss: true },
  boss_pale_sovereign: { color: 0xd8d8ea, eyeColor: 0xaaccff, scale: 2.1,  boss: true }
};
const DUNGEON_BOSS_NAMES = {
  boss_rat_king: 'Old Gnawbone, the Rat King',
  boss_crypt_weaver: 'Widow Silk, the Crypt Weaver',
  boss_forge_tyrant: 'Cindermaw, the Forge-Tyrant',
  boss_pale_sovereign: 'The Pale Sovereign'
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

// Mobs (Wilds mobs2 + dungeon mobs) have no limbs to swing like the player
// rig does, so "attacking" is shown as a whole-body lunge toward whatever
// they just hit, plus a forward pitch (like a snapping bite), then a spring
// back — triggered from the 'struck'/'you_died' handlers via mobId, which
// the server now includes alongside those messages.
const MOB_ATTACK_ANIM_MS = 380;
const MOB_ATTACK_LUNGE_DIST = 16;
function triggerMobAttackAnim(mobId) {
  if (!mobId) return;
  const v = mobVisuals2[mobId] || dungeonMobVisuals[mobId] || emberMobVisuals[mobId];
  if (v) v.attackAnimStartAt = performance.now();
}
// 0 -> 1 -> 0 over the animation's duration, or 0 once it's done/not attacking.
function mobAttackLungeAmount(v) {
  if (v.attackAnimStartAt == null) return 0;
  const t = (performance.now() - v.attackAnimStartAt) / MOB_ATTACK_ANIM_MS;
  if (t >= 1) { v.attackAnimStartAt = null; return 0; }
  return Math.sin(Math.min(1, t) * Math.PI);
}

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
    v = mobVisuals2[id] = { mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0, initialized: false, dead: false, attackAnimStartAt: null };
  }
  return v;
}

function applyMob2State(list) {
  if (!wildsScene) return;
  for (const m of list) {
    const v = getOrCreateMob2Visual(m.id, m.mobType);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    v.hasLoot = !!m.hasLoot;
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
    const lungeFactor = mobAttackLungeAmount(v);
    const lungeDist = lungeFactor * MOB_ATTACK_LUNGE_DIST;
    v.mesh.position.set(v.x + Math.sin(v.facing) * lungeDist, 0, v.y + Math.cos(v.facing) * lungeDist);
    v.mesh.rotation.y = v.facing;
    v.mesh.rotation.x = -0.5 * lungeFactor;
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
    if (v.kk) kkSetState(v.kk, moving ? 'Walking_A' : (v.working ? 'Interact' : 'Idle'));

    if (moving) {
      const swing = Math.sin(v.walkPhase) * 0.45;
      v.armL.rotation.x = swing;
      v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing * 0.65;
      v.legR.rotation.x = swing * 0.65;
      v.group.position.y = v.kk ? 0 : Math.abs(Math.sin(v.walkPhase)) * 2;
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

// ---------------------------------------------------------------------------
// Nightly torch-lighting ritual — same server-authoritative-position/
// client-interpolates-and-animates pattern as the Wilds' village NPCs
// above, just targeting the town's own outdoorScene instead. Torch
// lit/unlit state and each Torchkeeper's walk position both come from the
// same wildlife_state broadcast (see torchNpcs/torches, server.js).
// ---------------------------------------------------------------------------
let townTorchNpcVisuals = {};
const townTorchVisuals = {}; // id -> { flame, light } — populated in initScene()

function getOrCreateTownTorchNpcVisual(id, charId, name) {
  if (!townTorchNpcVisuals[id]) {
    const built = createHumanoid(charId);
    built.group.visible = false;
    // Local (0, 90, 0) — rotating the group around Y (facing) never moves
    // a point that sits exactly on the Y axis, so this stays put above
    // their head and doesn't swing around as they turn, without needing
    // to be repositioned every frame like a scene-level label would.
    const label = makeNpcNameSprite(name, 'Keeper of the Flame');
    label.position.set(0, 90, 0);
    built.group.add(label);
    if (outdoorScene) outdoorScene.add(built.group);
    townTorchNpcVisuals[id] = {
      group: built.group, armL: built.armL, armR: built.armR, legL: built.legL, legR: built.legR,
      x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0,
      working: false, praying: false, walkPhase: 0, initialized: false
    };
  }
  return townTorchNpcVisuals[id];
}

function applyTownTorchNpcState(npcs) {
  if (!outdoorScene) return;
  for (const n of npcs) {
    const v = getOrCreateTownTorchNpcVisual(n.id, n.charId, n.name);
    v.targetX = n.x; v.targetY = n.y; v.targetFacing = n.facing; v.working = n.working;
    v.praying = !!n.praying;
    if (!v.initialized) { v.x = n.x; v.y = n.y; v.facing = n.facing; v.initialized = true; }
  }
}

function updateTownTorchNpcVisuals(dt) {
  if (!outdoorScene) return;
  const f = 1 - Math.exp(-dt * 8);
  for (const id in townTorchNpcVisuals) {
    const v = townTorchNpcVisuals[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    v.group.rotation.y = v.facing;

    // Kneeling by day happens up on the Temple's raised platform now — same
    // ramped height a player standing there gets (see getFloorHeight);
    // everywhere else (out at the torches, walking between the two) is
    // ground level, same as before. Chased, not snapped, same as players —
    // their patrol lines can cross building stair ramps.
    const baseYT = getFloorHeight('outside', v.x, v.y);
    if (v.baseYS === undefined || Math.abs(baseYT - v.baseYS) > 34) v.baseYS = baseYT;
    else v.baseYS += (baseYT - v.baseYS) * f;
    const baseY = v.baseYS;

    const moving = Math.hypot(v.targetX - v.x, v.targetY - v.y) > 3;
    v.walkPhase += dt * (moving ? 5.5 : (v.working || v.praying) ? 3 : 0);
    if (v.kk) kkSetState(v.kk, moving ? 'Walking_A' : v.working ? 'Interact' : v.praying ? 'Sit_Floor_Idle' : 'Idle');

    let poseY = 0;
    if (moving) {
      const swing = Math.sin(v.walkPhase) * 0.45;
      v.armL.rotation.x = swing;
      v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing * 0.65;
      v.legR.rotation.x = swing * 0.65;
      poseY = Math.abs(Math.sin(v.walkPhase)) * 2;
    } else if (v.working) {
      // Slow reach-and-tend motion once they've arrived at their torch.
      const tend = Math.abs(Math.sin(v.walkPhase)) * 0.5;
      v.armL.rotation.x = -tend;
      v.armR.rotation.x = -tend * 0.7;
      v.legL.rotation.x = 0;
      v.legR.rotation.x = 0;
    } else if (v.praying) {
      // Kneeling at the altar by day — legs bent under, arms raised in a
      // slow chant-like sway, sunk down slightly to read as kneeling
      // rather than standing (still well clear of the ground below the
      // platform — see baseY above).
      const sway = Math.sin(v.walkPhase * 0.6) * 0.18;
      v.armL.rotation.x = -1.9 + sway;
      v.armR.rotation.x = -1.9 - sway;
      v.legL.rotation.x = -1.3;
      v.legR.rotation.x = -1.3;
      poseY = -9 + Math.sin(v.walkPhase * 0.6) * 1.2;
    } else {
      v.armL.rotation.x *= 0.85;
      v.armR.rotation.x *= 0.85;
      v.legL.rotation.x *= 0.85;
      v.legR.rotation.x *= 0.85;
    }

    v.group.position.set(v.x, baseY + poseY, v.y);
    v.group.visible = true;
  }
}

function applyTownTorchState(torches) {
  for (const t of torches) {
    const v = townTorchVisuals[t.id];
    if (!v) continue;
    v.flame.visible = t.lit;
    v.light.intensity = t.lit ? 1.3 : 0;
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
  // Signature bosses (Session L) wear their name and a low ember glow —
  // unmistakable across the arena.
  if (visual.boss && DUNGEON_BOSS_NAMES[mobType]) {
    const label = makeNpcNameSprite('⚔️ ' + DUNGEON_BOSS_NAMES[mobType]);
    label.position.set(0, 46 / visual.scale, 0);
    label.scale.multiplyScalar(1.5 / visual.scale);
    g.add(label);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: LEGEND_FX.glowTexture(), color: visual.eyeColor, transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    glow.scale.set(60 / visual.scale, 60 / visual.scale, 1);
    glow.position.set(0, 10, 0);
    g.add(glow);
  }
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
    v = dungeonMobVisuals[id] = { mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0, initialized: false, dead: false, attackAnimStartAt: null };
  }
  return v;
}

function applyDungeonMobState(list) {
  if (!dungeonScene) return;
  for (const m of list) {
    const v = getOrCreateDungeonMobVisual(m.id, m.mobType);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    v.hasLoot = !!m.hasLoot;
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
    const lungeFactor = mobAttackLungeAmount(v);
    const lungeDist = lungeFactor * MOB_ATTACK_LUNGE_DIST;
    v.mesh.position.set(v.x + Math.sin(v.facing) * lungeDist, 0, v.y + Math.cos(v.facing) * lungeDist);
    v.mesh.rotation.y = v.facing;
    v.mesh.rotation.x = -0.5 * lungeFactor;
    const shouldShow = inDungeon && !v.dead && me && v.room === me.room;
    v.mesh.visible = shouldShow;
  }
}

// ---------------------------------------------------------------------------
// Loot icons — a clickable floating icon over any defeated mob/animal/player
// that still has unclaimed loot (see hasLoot in wildlife_state/state,
// server.js's pendingLoot). Clicking one sends loot_corpse; only the killer
// can actually claim it (enforced server-side, see loot_error), everyone
// else just sees the icon exists. Reuses whatever position each entity's own
// visual already tracks (v.x/v.y for mobs; a fixed death-spot snapshot for
// players, since their ghost otherwise wanders off — see deathX/Y/Room)
// rather than maintaining any separate position state of its own.
// ---------------------------------------------------------------------------
let lootIconVisuals = {}; // key -> sprite
const LOOT_ICON_HEIGHT = 12; // sits low, just clear of the ground plane, reading as a dropped bag rather than a floating icon

function makeLootIconSprite() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const cx = c.getContext('2d');
  cx.font = '44px serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('💰', 32, 36);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(28, 28, 1);
  sprite.visible = false;
  return sprite;
}

function getOrCreateLootIcon(key) {
  if (!lootIconVisuals[key]) lootIconVisuals[key] = makeLootIconSprite();
  return lootIconVisuals[key];
}

function showLootIcon(key, scene, x, y, z, lootType, targetId) {
  const sprite = getOrCreateLootIcon(key);
  sprite.userData = { kind: 'loot', lootType, targetId };
  if (sprite.parent !== scene) {
    if (sprite.parent) sprite.parent.remove(sprite);
    scene.add(sprite);
  }
  sprite.position.set(x, y, z);
  sprite.visible = true;
}

function hideLootIcon(key) {
  const sprite = lootIconVisuals[key];
  if (sprite) sprite.visible = false;
}

function updateLootIcons() {
  for (const id in mobVisuals) {
    const key = 'mob:' + id;
    const v = mobVisuals[id];
    if (v.hasLoot && outdoorScene) showLootIcon(key, outdoorScene, v.x, LOOT_ICON_HEIGHT, v.y, 'mob', id);
    else hideLootIcon(key);
  }
  for (const id in mobVisuals2) {
    const key = 'mob2:' + id;
    const v = mobVisuals2[id];
    if (v.hasLoot && wildsScene) showLootIcon(key, wildsScene, v.x, LOOT_ICON_HEIGHT, v.y, 'mob2', id);
    else hideLootIcon(key);
  }
  for (const id in dungeonMobVisuals) {
    const key = 'dungeon:' + id;
    const v = dungeonMobVisuals[id];
    if (v.hasLoot && dungeonScene && me && v.room === me.room) showLootIcon(key, dungeonScene, v.x, LOOT_ICON_HEIGHT, v.y, 'dungeon', id);
    else hideLootIcon(key);
  }
  for (const id in emberMobVisuals) {
    const key = 'ember_mob:' + id;
    const v = emberMobVisuals[id];
    if (v.hasLoot && emberScene) showLootIcon(key, emberScene, v.x, LOOT_ICON_HEIGHT, v.y, 'ember_mob', id);
    else hideLootIcon(key);
  }
  for (const id in players) {
    const key = 'player:' + id;
    if (id === myId) { hideLootIcon(key); continue; }
    const p = players[id];
    if (p.hasLoot && activeScene && contextMatches(p.deathRoom)) {
      const rp = getRenderPos({ x: p.deathX, y: p.deathY, room: p.deathRoom });
      showLootIcon(key, activeScene, rp.x, LOOT_ICON_HEIGHT, rp.z, 'player', id);
    } else {
      hideLootIcon(key);
    }
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

// ---------------------------------------------------------------------------
// Town props — the scenery expansion. Same server-driven natureDecor flow as
// trees/shrubs (server.js decor_38+), just non-harvestable: benches and
// lampposts along the lanes, a well + market stalls on the plaza ring, a
// fenced flower garden, hay/crate/barrel work clusters, stumps and fallen
// logs. Lamppost lanterns are registered in LAMP_GLOWS and brighten with
// nightfall — see the hook at the end of updateDayNightCycle().
// ---------------------------------------------------------------------------
const LAMP_GLOWS = [];
let _glowTexCache = null;
function makeGlowTexture() {
  if (_glowTexCache) return _glowTexCache;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,220,150,0.5)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  _glowTexCache = new THREE.CanvasTexture(c);
  return _glowTexCache;
}

const PROP_WOOD = 0x6b4a2a, PROP_WOOD_DARK = 0x4a3320, PROP_STONE = 0x8a8a92;

// NOTE: named makeBenchProp (not makeBench) — a second `function makeBench(x, z, rotY)`
// exists below for interiors, and duplicate function declarations in the same scope
// silently shadow each other (the later one wins), which used to leave every outdoor
// bench rendered at NaN coordinates: invisible, but still colliding. Same story for
// makeBarrelProp below.
function makeBenchProp(d) {
  const kkG = KK.staticInstance('prop_bench', 44, 'fit');
  if (kkG) { kkG.rotation.y = d.rot || 0; kkG.position.set(d.x, 0, d.y); return kkG; }
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: PROP_WOOD });
  const dark = new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(44, 4, 16), wood);
  seat.position.y = 14; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(44, 14, 3), wood);
  back.position.set(0, 23, -7.5); g.add(back);
  for (const sx of [-18, 18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 14, 14), dark);
    leg.position.set(sx, 7, 0);
    g.add(leg);
  }
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeLamppost(d) {
  const kkG = KK.staticInstance('prop_lamppost', 78, 'height');
  if (kkG) {
    const glassMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffd9a0, transparent: true, opacity: 0.25, depthWrite: false });
    const glass = new THREE.Sprite(glassMat);
    glass.scale.set(16, 16, 1);
    glass.position.set(0, 58, 6);
    kkG.add(glass);
    const glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffc372, transparent: true, opacity: 0, depthWrite: false });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(48, 48, 1);
    glow.position.set(0, 58, 6);
    kkG.add(glow);
    LAMP_GLOWS.push({ glassMat, glowMat });
    kkG.rotation.y = d.rot || 0;
    kkG.position.set(d.x, 0, d.y);
    return kkG;
  }
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 74, 6), new THREE.MeshLambertMaterial({ color: 0x33333b }));
  pole.position.y = 37; g.add(pole);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(7, 8, 6), new THREE.MeshLambertMaterial({ color: 0x22222a }));
  cap.position.y = 83; g.add(cap);
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.25 });
  const glass = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 8), glassMat);
  glass.position.y = 75; g.add(glass);
  const glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xffc372, transparent: true, opacity: 0, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(48, 48, 1);
  glow.position.y = 75; g.add(glow);
  LAMP_GLOWS.push({ glassMat, glowMat });
  g.position.set(d.x, 0, d.y);
  return g;
}

function makeWell(d) {
  const kkG = KK.staticInstance('prop_well', 48, 'fit');
  if (kkG) { kkG.rotation.y = d.rot || 0; kkG.position.set(d.x, 0, d.y); return kkG; }
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 16, 10), new THREE.MeshLambertMaterial({ color: PROP_STONE }));
  ring.position.y = 8; g.add(ring);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 2, 10), new THREE.MeshLambertMaterial({ color: 0x1c3a4a }));
  water.position.y = 15; g.add(water);
  const dark = new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK });
  for (const sx of [-17, 17]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(3.5, 34, 3.5), dark);
    post.position.set(sx, 30, 0); g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 32, 6), dark);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 42; g.add(bar);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(4, 3.2, 6, 8), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  bucket.position.y = 32; g.add(bucket);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x7a3f2a });
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(46, 2.5, 16), roofMat);
    slab.position.set(0, 50 + 4 * 0, side * 7);
    slab.rotation.x = side * 0.5;
    slab.position.y = 50;
    g.add(slab);
  }
  g.position.set(d.x, 0, d.y);
  return g;
}

let _stallTexCache = {};
function makeStallCanopyTexture(variant) {
  if (_stallTexCache[variant]) return _stallTexCache[variant];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  const [a, b] = variant === 1 ? ['#3f7a4a', '#efe6cf'] : ['#a33b3b', '#efe6cf'];
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect(i * 16, 0, 16, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  _stallTexCache[variant] = tex;
  return tex;
}

function makeMarketStall(d) {
  const g = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(64, 22, 40), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  counter.position.y = 11; g.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(68, 3, 44), new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK }));
  top.position.y = 23.5; g.add(top);
  const poleMat = new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK });
  for (const [px, pz] of [[-32, -22], [32, -22], [-32, 22], [32, 22]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 56, 6), poleMat);
    pole.position.set(px, 28, pz); g.add(pole);
  }
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(76, 2.5, 54),
    new THREE.MeshLambertMaterial({ map: makeStallCanopyTexture(d.variant || 0) })
  );
  canopy.position.y = 58;
  canopy.rotation.z = 0.08;
  g.add(canopy);
  // a little merchandise on the counter
  const goodsA = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), new THREE.MeshLambertMaterial({ color: 0xc9a227 }));
  goodsA.position.set(-14, 25 + 1.5, 4); g.add(goodsA);
  const goodsB = new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 8), new THREE.MeshLambertMaterial({ color: 0xa33b3b }));
  goodsB.position.set(12, 28, -6); g.add(goodsB);
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeCrate(d) {
  const g = new THREE.Group();
  const crate = new THREE.Mesh(new THREE.BoxGeometry(17, 17, 17), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  crate.position.y = 8.5;
  g.add(crate);
  const band = new THREE.Mesh(new THREE.BoxGeometry(17.6, 3, 17.6), new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK }));
  band.position.y = 8.5;
  g.add(band);
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeBarrelProp(d) { // see makeBenchProp note — renamed to dodge the interior makeBarrel(x, z)
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 20, 10), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  body.position.y = 10;
  // slight barrel belly
  body.scale.set(1.12, 1, 1.12);
  g.add(body);
  const hoopMat = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });
  for (const hy of [4, 16]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(9.2, 9.2, 1.4, 10), hoopMat);
    hoop.position.y = hy;
    g.add(hoop);
  }
  g.position.set(d.x, 0, d.y);
  return g;
}

function makeHaybale(d) {
  const g = new THREE.Group();
  const bale = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 26, 10), new THREE.MeshLambertMaterial({ color: 0xd8b64e }));
  bale.rotation.z = Math.PI / 2;
  bale.position.y = 12;
  g.add(bale);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(4, 24.6, 24.6), new THREE.MeshLambertMaterial({ color: 0xb0913a }));
  strap.position.y = 12;
  g.add(strap);
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeFenceSeg(d) {
  const kkG = KK.staticInstance('prop_fence', 58, 'fit');
  if (kkG) { kkG.rotation.y = d.rot || 0; kkG.position.set(d.x, 0, d.y); return kkG; }
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a5a34 });
  for (const px of [-26, 26]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(3.5, 18, 3.5), wood);
    post.position.set(px, 9, 0); g.add(post);
  }
  for (const ry of [7, 13]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(56, 2.6, 2), wood);
    rail.position.y = ry; g.add(rail);
  }
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeStump(d) {
  const g = new THREE.Group();
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 10, 8), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  stump.position.y = 5; g.add(stump);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 1, 8), new THREE.MeshLambertMaterial({ color: 0xb08a5a }));
  top.position.y = 10.2; g.add(top);
  g.position.set(d.x, 0, d.y);
  return g;
}

function makeFallenLog(d) {
  const g = new THREE.Group();
  const log = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 48, 8), new THREE.MeshLambertMaterial({ color: 0x5a3d24 }));
  log.rotation.z = Math.PI / 2;
  log.position.y = 7.5;
  g.add(log);
  for (const ex of [-24, 24]) {
    const end = new THREE.Mesh(new THREE.CylinderGeometry(ex < 0 ? 7 : 8, ex < 0 ? 7 : 8, 1, 8), new THREE.MeshLambertMaterial({ color: 0xb08a5a }));
    end.rotation.z = Math.PI / 2;
    end.position.set(ex, 7.5, 0);
    g.add(end);
  }
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
}

function makeNoticeboard(d) {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: PROP_WOOD_DARK });
  for (const px of [-14, 14]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(3.5, 40, 3.5), dark);
    post.position.set(px, 20, 0); g.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(36, 24, 3), new THREE.MeshLambertMaterial({ color: PROP_WOOD }));
  board.position.y = 32; g.add(board);
  // parchment notices
  const paper = new THREE.MeshLambertMaterial({ color: 0xefe6cf });
  for (const [nx, ny, w, h] of [[-8, 34, 10, 12], [6, 31, 12, 10]]) {
    const note = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), paper);
    note.position.set(nx, ny, 1.9);
    note.rotation.z = nx < 0 ? 0.06 : -0.05;
    g.add(note);
  }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(42, 3, 6), dark);
  cap.position.y = 46; g.add(cap);
  g.position.set(d.x, 0, d.y);
  g.rotation.y = d.rot || 0;
  return g;
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
  // Every fifth-ish tree is a thornwood — plum-dark foliage, the trees the
  // town is named for. Deterministic from position so every client (and
  // every visit) grows the same forest.
  const thornwood = ((Math.abs(Math.round(x * 7)) + Math.abs(Math.round(z * 13))) % 5) === 0;
  const foliageColors = thornwood
    ? [0x4a2a5f, 0x543063, 0x3e2452]
    : [0x27543a, 0x2d5c40, 0x244d35];
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
  g.userData.camFade = true; // tall enough to swallow the chase camera — see updateCamObstructions
  return g;
}

function makeShrub(x, z, scale) {
  const g = new THREE.Group();
  const s = scale || 1;
  const colors = [0x2c5a3a, 0x27543a, 0x386947];
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

// ── Tier-3 plants: chunky, KayKit-flavored rebuilds of all three shapes.
// Same colors from PLANT_VISUALS, same anchor/scale contract (harvested
// look clones materials, so plain Lambert/emissive materials only), plus a
// faint emissive on the magical species so they breathe at night with the
// bloom pass. Deterministic per-position variation, no Math.random — every
// client grows the same plant.
function plantSeed(x, z) { return Math.abs(Math.sin(x * 12.9898 + z * 78.233)) % 1; }

function makePlantBloom(x, z, color, glowy) {
  const g = new THREE.Group();
  const r = plantSeed(x, z);
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x2f6b3a });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.5, 10, 6), stemMat);
  stem.position.y = 5;
  stem.rotation.z = (r - 0.5) * 0.16;
  g.add(stem);
  // paired chunky leaves at the base
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3d8a4a });
  for (const sgn of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(2.4, 7, 6), leafMat);
    leaf.scale.set(1.25, 0.35, 0.7);
    leaf.position.set(sgn * 2.6, 1.6, (r - 0.5) * 2);
    leaf.rotation.z = sgn * 0.35;
    g.add(leaf);
  }
  // fat petal crown around a glowing heart
  const bloomMat = new THREE.MeshLambertMaterial({ color });
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(2.6, 7, 6), bloomMat);
    const ang = (i / petals) * Math.PI * 2 + r;
    petal.scale.set(1, 0.45, 0.72);
    petal.position.set(Math.cos(ang) * 3.1, 10.6, Math.sin(ang) * 3.1);
    petal.rotation.y = -ang;
    petal.rotation.z = 0.35;
    g.add(petal);
  }
  const heartMat = new THREE.MeshLambertMaterial({ color: glowy ? color : 0xffd43b });
  if (glowy) { heartMat.emissive = new THREE.Color(color); heartMat.emissiveIntensity = 0.75; }
  const center = new THREE.Mesh(new THREE.SphereGeometry(2.0, 8, 7), heartMat);
  center.position.y = 11.2;
  g.add(center);
  g.rotation.y = r * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}

function makePlantMushroom(x, z, capColor, glowy) {
  const g = new THREE.Group();
  const r = plantSeed(x, z);
  const stemMat = new THREE.MeshLambertMaterial({ color: 0xf0e4cd });
  // fat kaykit-ish stem with a skirt ring
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.6, 6.5, 8), stemMat);
  stem.position.y = 3.2;
  g.add(stem);
  const skirt = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.55, 6, 10), stemMat);
  skirt.rotation.x = Math.PI / 2;
  skirt.position.y = 4.6;
  g.add(skirt);
  // big squashed cap with a chunky underside lip
  const capMat = new THREE.MeshLambertMaterial({ color: capColor });
  if (glowy) { capMat.emissive = new THREE.Color(capColor); capMat.emissiveIntensity = 0.4; }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(4.8, 10, 8), capMat);
  cap.scale.set(1, 0.68, 1);
  cap.position.y = 7.4;
  g.add(cap);
  const lipMat = new THREE.MeshLambertMaterial({ color: 0xe8dcc4 });
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.6, 1.1, 10), lipMat);
  lip.position.y = 6.1;
  g.add(lip);
  // dotted spots, deterministic ring
  const spotMat = new THREE.MeshLambertMaterial({ color: 0xfff6e8 });
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + r * 6;
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.62 + (i % 2) * 0.3, 6, 6), spotMat);
    spot.scale.y = 0.5;
    spot.position.set(Math.cos(ang) * 2.7, 8.6 + Math.sin(i * 2.1) * 0.5, Math.sin(ang) * 2.7);
    g.add(spot);
  }
  // a tiny sprout buddy leaning on the stem
  const babyCap = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), capMat);
  babyCap.scale.set(1, 0.7, 1);
  babyCap.position.set(3.4, 1.8, (r - 0.5) * 3);
  g.add(babyCap);
  const babyStem = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 1.8, 6), stemMat);
  babyStem.position.set(3.4, 0.9, (r - 0.5) * 3);
  g.add(babyStem);
  g.rotation.y = r * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}

function makePlantSprout(x, z, color, glowy) {
  const g = new THREE.Group();
  const r = plantSeed(x, z);
  const leafMat = new THREE.MeshLambertMaterial({ color });
  if (glowy) { leafMat.emissive = new THREE.Color(color); leafMat.emissiveIntensity = 0.35; }
  // chunky curled blades — flattened, bent cones ringed around a bud
  const blades = 5;
  for (let i = 0; i < blades; i++) {
    const ang = (i / blades) * Math.PI * 2 + r * 2;
    const h = 6.5 + ((i + 1) % 3) * 1.8;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.7, h, 6), leafMat);
    leaf.scale.z = 0.45;
    leaf.position.set(Math.cos(ang) * 2.1, h / 2 - 0.4, Math.sin(ang) * 2.1);
    leaf.rotation.y = -ang + Math.PI / 2;
    leaf.rotation.x = 0.18;
    leaf.rotation.z = Math.cos(ang) * -0.5;
    leaf.rotation.x += Math.sin(ang) * 0.5;
    g.add(leaf);
  }
  const budMat = new THREE.MeshLambertMaterial({ color: 0x2f6b3a });
  const bud = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), budMat);
  bud.scale.y = 0.8;
  bud.position.y = 1.2;
  g.add(bud);
  // little dirt mound so it sits planted, not floating
  const mound = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6), new THREE.MeshLambertMaterial({ color: 0x4a3423 }));
  mound.scale.set(1.15, 0.28, 1.15);
  mound.position.y = 0.15;
  g.add(mound);
  g.rotation.y = r * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}

// species with a faint magical glow (breathes with the night bloom pass)
const PLANT_GLOWY = new Set(['shrinking_violet', 'bats_breath', 'wolfsbane_bloom', 'meditation_lotus', 'rainbow_petal', 'featherleaf']);
function makePlant(type, x, z) {
  const v = PLANT_VISUALS[type] || PLANT_VISUALS.healing_herb;
  const glowy = PLANT_GLOWY.has(type);
  if (v.shape === 'bloom') return makePlantBloom(x, z, v.color, glowy);
  if (v.shape === 'mushroom') return makePlantMushroom(x, z, v.color, glowy);
  return makePlantSprout(x, z, v.color, glowy);
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
// Prop builders + their player-collision footprints. rot-aware where the
// prop is meaningfully oblong AND only ever placed axis-aligned (fences);
// diagonal-rotated props get a square that covers their core.
const PROP_BUILDERS = {
  bench: { make: makeBenchProp, collide: () => ({ w: 40, h: 40 }) },
  lamppost: { make: makeLamppost, collide: () => ({ w: 9, h: 9 }) },
  well: { make: makeWell, collide: () => ({ w: 46, h: 46 }) },
  stall: { make: makeMarketStall, collide: (d) => (Math.abs((d.rot || 0) % Math.PI) > 0.8 ? { w: 52, h: 76 } : { w: 76, h: 52 }) },
  crate: { make: makeCrate, collide: () => ({ w: 19, h: 19 }) },
  barrel: { make: makeBarrelProp, collide: () => ({ w: 19, h: 19 }) },
  haybale: { make: makeHaybale, collide: () => ({ w: 28, h: 28 }) },
  fence: { make: makeFenceSeg, collide: (d) => (Math.abs((d.rot || 0) % Math.PI) > 0.8 ? { w: 7, h: 58 } : { w: 58, h: 7 }) },
  stump: { make: makeStump, collide: () => ({ w: 17, h: 17 }) },
  log: { make: makeFallenLog, collide: () => ({ w: 34, h: 34 }) },
  noticeboard: { make: makeNoticeboard, collide: () => ({ w: 34, h: 12 }) }
};

function addNatureDecor(scene, w, pool, wallsOut) {
  // Which collision set the decor registers into. The Wilds scene is built
  // while `walls` still points at the TOWN array, so before Session I its
  // trees never collided in the Wilds AND left invisible colliders in town
  // wherever coordinates overlapped (user-reported as "no collision in the
  // Wilds"). Explicit is better than ambient.
  const wallsTarget = wallsOut || walls;
  for (const d of (w.natureDecor || [])) {
    let group;
    if (d.type === 'tree') {
      group = makeTree(d.x, d.y, d.scale);
      const r = 8 * (d.scale || 1);
      wallsTarget.push({ x: d.x - r, y: d.y - r, w: r * 2, h: r * 2 });
    } else if (d.type === 'shrub') {
      group = makeShrub(d.x, d.y, d.scale);
    } else if (d.type === 'rock') {
      group = makeRock(d.x, d.y, d.scale);
    } else if (d.type === 'flower') {
      group = makeFlowerPatch(d.x, d.y, d.scale);
    } else if (PROP_BUILDERS[d.type]) {
      const spec = PROP_BUILDERS[d.type];
      group = spec.make(d);
      const c = spec.collide(d);
      if (c) wallsTarget.push({ x: d.x - c.w / 2, y: d.y - c.h / 2, w: c.w, h: c.h });
    } else if (PLANT_VISUALS[d.type]) {
      group = makePlant(d.type, d.x, d.y);
    } else {
      continue;
    }
    scene.add(group);
    if (HARVESTABLE_DECOR_TYPES.has(d.type)) {
      const originalMaterials = [];
      group.traverse(child => { if (child.isMesh) originalMaterials.push({ mesh: child, material: child.material }); });
      // merge, don't replace — makeTree marks itself userData.camFade for
      // the camera-obstruction fader, and a wholesale overwrite here was
      // silently untagging every tree in town
      group.userData.kind = 'decor';
      group.userData.decorId = d.id;
      group.userData.decorType = d.type;
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

// Same block-and-mortar pattern as makeStoneTexture(), just with a light
// base fill instead of dark gray — bakes its own colors in rather than
// being a white-multiply texture, so a plain mesh.color tint alone can't
// turn the gray version white; this is the actual light-stone variant.
function makeWhiteStoneTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ece7d8';
  cx.fillRect(0, 0, 128, 128);
  cx.strokeStyle = 'rgba(170,162,140,0.45)';
  cx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = i * 22 + (i % 2 ? 6 : 0);
    cx.beginPath(); cx.moveTo(0, y); cx.lineTo(128, y); cx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.4)' : 'rgba(190,182,160,0.35)';
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

// White-based so it multiplies cleanly with a MeshLambertMaterial's own
// tint color (b.color) — same trick the interior floor texture uses with
// floorTint. Horizontal plank seams plus scattered grain streaks.
function makeWoodSidingTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, 128, 128);
  cx.strokeStyle = 'rgba(0,0,0,0.32)';
  cx.lineWidth = 2;
  const plankH = 16;
  for (let y = plankH; y < 128; y += plankH) {
    cx.beginPath(); cx.moveTo(0, y); cx.lineTo(128, y); cx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
    cx.fillRect(x, y, 1, 3 + Math.random() * 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Same white-based multiply trick as the siding texture above — rows of
// overlapping shingle arcs, offset every other row.
function makeShingleTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, 128, 128);
  const rowH = 14, tileW = 20;
  let row = 0;
  for (let y = 0; y < 128; y += rowH, row++) {
    const offset = (row % 2) * (tileW / 2);
    cx.strokeStyle = 'rgba(0,0,0,0.3)';
    cx.lineWidth = 1.5;
    for (let x = -tileW + offset; x < 128; x += tileW) {
      cx.beginPath();
      cx.moveTo(x, y + rowH);
      cx.lineTo(x + tileW / 2, y + 2);
      cx.lineTo(x + tileW, y + rowH);
      cx.stroke();
    }
    cx.strokeStyle = 'rgba(0,0,0,0.2)';
    cx.beginPath(); cx.moveTo(0, y + rowH); cx.lineTo(128, y + rowH); cx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}


// ── Tier-3 set dressing: KayKit Halloween Bits around town & the Wilds. ──
// Client-only visual flavor (no colliders), same precedent as fairy rings.
function kkPlace(scene, key, x, y, size, rot, mode) {
  const g = KK.staticInstance(key, size, mode || 'fit');
  if (!g) return null;
  g.rotation.y = rot || 0;
  g.position.set(x, 0, y);
  // Tall dressing swallows the chase camera the same way trees do — let it
  // ghost out when it comes between the camera and the player.
  if (key === 'prop_deadtree' || key === 'prop_deadtree2' || key === 'gate_arch' || key === 'building_crypt') g.userData.camFade = true;
  scene.add(g);
  return g;
}

function kkTownDressing(scene, w) {
  if (!KK.settled) return;
  // twin jack-o'-lanterns flanking every door
  for (const b of w.buildings) {
    const side = getDoorSide(b);
    const dp = getDoorWorldPos(b);
    const pw = (w.doorWidth || 64) * 0.85 + 22;
    const out = side === 'south' ? [0, 18] : side === 'north' ? [0, -18] : side === 'east' ? [18, 0] : [-18, 0];
    const perp = side === 'south' || side === 'north' ? [pw, 0] : [0, pw];
    kkPlace(scene, 'prop_pumpkin', dp.x + out[0] + perp[0], dp.y + out[1] + perp[1], 12, Math.PI * 0.15);
    kkPlace(scene, 'prop_pumpkin2', dp.x + out[0] - perp[0], dp.y + out[1] - perp[1], 10, -Math.PI * 0.2);
  }
  // a small fenced graveyard tucked behind the Town Hall
  const hall = w.buildings.find(b => b.id === 'hall');
  if (hall) {
    // A little churchyard in the wooded pocket beside the Town Hall — the
    // hall backs onto the map edge, so "behind" would be invisible (and
    // half off-world). Beside it reads from the plaza approach instead.
    const gx = Math.min(hall.x + hall.w + 150, (w.width || 3200) - 170);
    const gy = Math.max(150, hall.y + 60);
    kkPlace(scene, 'prop_crypt', gx, gy - 26, 52, Math.PI);
    kkPlace(scene, 'prop_grave_a', gx - 34, gy + 16, 20, 0.3);
    kkPlace(scene, 'prop_grave_b', gx - 8, gy + 22, 18, -0.15);
    kkPlace(scene, 'prop_grave_a', gx + 20, gy + 18, 19, 0.5);
    kkPlace(scene, 'prop_grave_b', gx + 44, gy + 10, 17, -0.4);
    kkPlace(scene, 'prop_fence', gx - 52, gy + 34, 52, 0);
    kkPlace(scene, 'prop_fence', gx + 52, gy + 34, 52, 0);
    kkPlace(scene, 'prop_deadtree2', gx + 66, gy - 18, 46, 0.7);
  }
  // a candle shrine at the fae-touched fairy ring
  kkPlace(scene, 'prop_shrine', 2450, 890, 24, -0.5);
}

function kkWildsDressing(scene, w) {
  if (!KK.settled) return;
  const W2 = w.width || 10000, H2 = w.height || 10000;
  // a crooked gate arch greeting arrivals from the portal
  if (w.spawn) kkPlace(scene, 'prop_arch', w.spawn.x, w.spawn.y - 260, 150, 0);
  // dead trees scattered through the midfield + near both camps
  const spots = [
    [W2 * 0.30, H2 * 0.42, 120, 0.4], [W2 * 0.45, H2 * 0.55, 140, -0.8],
    [W2 * 0.62, H2 * 0.38, 110, 1.7], [W2 * 0.71, H2 * 0.60, 130, -0.3],
    [W2 * 0.25, H2 * 0.58, 100, 2.2], [W2 * 0.55, H2 * 0.30, 125, 0.9],
    [W2 * 0.24, H2 * 0.49, 90, -1.2], [W2 * 0.76, H2 * 0.51, 95, 0.2]
  ];
  let i = 0;
  for (const [x, y, size, rot] of spots) {
    kkPlace(scene, (i++ % 2) ? 'prop_deadtree' : 'prop_deadtree2', x, y, size, rot);
    // trunks block movement now (Session I) — canopy stays overhead
    if (typeof wildsCollide === 'function') wildsCollide(x, y, 11);
  }
  // grave markers by the ritual circle's approach
  kkPlace(scene, 'prop_grave_b', W2 * 0.49, H2 * 0.47, 26, 0.4);
  kkPlace(scene, 'prop_grave_a', W2 * 0.51, H2 * 0.465, 28, -0.3);
}

// KayKit building models bring their own entrance stairs, which protrude
// past the collision footprint. Each build measures the real stair profile
// with downward raycasts and registers a door-approach "ramp zone"; the
// outside branch of getFloorHeight() walks players (and NPCs) up it — the
// same trick the Temple platform ramp already uses — so nobody clips
// through the steps.
const KK_STAIR_ZONES = [];
const KK_BLD_BOXES = {};   // b.id → world Box3 of the placed model
// Self-aligning building placement: these models bake their entrance
// (door + stoop/steps) into one face, and which face varies per model. At
// build time we try all four rotations, raycast for low structure (steps)
// just outside the wall at the game's door gap, keep the rotation with the
// most of it, then slide the model along the wall so the detected steps
// center on the door gap. Models with flush doors (no steps) tie at ~0 and
// keep the default facing.
function kkAutoAlign(kkBld, b, w) {
  const kside = getDoorSide(b);
  const dp = getDoorWorldPos(b);
  const out = kside === 'south' ? [0, 1] : kside === 'north' ? [0, -1] : kside === 'east' ? [1, 0] : [-1, 0];
  const along = [out[1], out[0]];
  const sideRot = kside === 'south' ? 0 : kside === 'north' ? Math.PI : kside === 'east' ? Math.PI / 2 : -Math.PI / 2;
  const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  const MAX_STAIR_H = 40;

  function stairMassAt(lateralOffset) {
    // structure height just outside the wall (4 depths — 44 reaches the
    // detached porches some models carry, e.g. the gold church), below cap
    let mass = 0;
    for (const d of [8, 20, 32, 44]) {
      origin.set(dp.x + out[0] * d + along[0] * lateralOffset, 60, dp.y + out[1] * d + along[1] * lateralOffset);
      ray.set(origin, down);
      const hits = ray.intersectObject(kkBld, true);
      for (const hit of hits) {
        if (hit.point.y <= MAX_STAIR_H) { mass += hit.point.y; break; }
      }
    }
    return mass;
  }

  // Flush the model's door face to the footprint's door wall for the
  // CURRENT rotation — needed both per-rotation (scoring a centered,
  // recessed model finds nothing outside the wall: that's why the tavern's
  // stoop never got centered on its door before) and as the final fit.
  function flushToWall() {
    const bb = new THREE.Box3().setFromObject(kkBld);
    const wallPlane = kside === 'south' ? b.y + b.h : kside === 'north' ? b.y : kside === 'east' ? b.x + b.w : b.x;
    const modelFront = kside === 'south' ? bb.max.z : kside === 'north' ? bb.min.z : kside === 'east' ? bb.max.x : bb.min.x;
    const delta = (wallPlane + (kside === 'south' || kside === 'east' ? 12 : -12)) - modelFront;
    kkBld.position.x += out[0] * delta;
    kkBld.position.z += out[1] * delta;
    kkBld.updateMatrixWorld(true);
  }

  let bestRot = 0, bestScore = -1;
  for (const extra of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    kkBld.rotation.y = sideRot + extra;
    kkBld.position.set(cx, 0, cz);
    kkBld.updateMatrixWorld(true);
    flushToWall(); // score what a player would actually meet outside the wall
    let score = 0;
    for (const lat of [-w.doorWidth, -w.doorWidth / 2, 0, w.doorWidth / 2, w.doorWidth]) score += stairMassAt(lat);
    if (score > bestScore + 0.5) { bestScore = score; bestRot = extra; }
  }
  kkBld.rotation.y = sideRot + bestRot;
  kkBld.position.set(cx, 0, cz);
  kkBld.updateMatrixWorld(true);

  // Fit-to-footprint: with the best rotation known, measure the model's
  // real extents along the door axis (depth) and across it (width), and
  // shrink until the depth genuinely fits the collision footprint (small
  // rear lip allowed) and the width bulge stays modest. The castle was
  // deeper than the Town Hall's footprint at any centered scale — players
  // could walk the camera inside its rear towers.
  {
    let bb = new THREE.Box3().setFromObject(kkBld);
    const alongDoor = (kside === 'south' || kside === 'north');
    const depthExtent = alongDoor ? (bb.max.z - bb.min.z) : (bb.max.x - bb.min.x);
    const widthExtent = alongDoor ? (bb.max.x - bb.min.x) : (bb.max.z - bb.min.z);
    const footDepth = alongDoor ? b.h : b.w;
    const footWidth = alongDoor ? b.w : b.h;
    const shrink = Math.min(1, (footDepth + 52) / Math.max(1, depthExtent), (footWidth * 1.18) / Math.max(1, widthExtent));
    if (shrink < 1) {
      kkBld.scale.multiplyScalar(shrink);
      kkBld.userData.kkHeight *= shrink;
      kkBld.updateMatrixWorld(true);
    }
    // Flush-to-door-wall: door face sits just past the footprint's door
    // wall; the (now small) rear lip tucks behind the building line.
    flushToWall();
  }

  // Center the detected steps on the door gap (skip flush-door models).
  // The gate score is measured fresh HERE, after the final flush — the old
  // code gated on the rotation-pass score, which was taken while the model
  // was still centered/recessed and often read ~0, silently skipping this
  // pass and leaving stoops ~50 units off the door (the tavern & arcade —
  // players got ramped into thin air at the actual door line).
  // Two passes: the first shift can expose more steps to the sampler.
  for (let pass = 0; pass < 2; pass++) {
    let postScore = 0;
    for (const lat of [-w.doorWidth, -w.doorWidth / 2, 0, w.doorWidth / 2, w.doorWidth]) postScore += stairMassAt(lat);
    const span = Math.max(b.w, b.h) * 0.42;
    let num = 0, den = 0;
    for (let lat = -span; lat <= span; lat += 12) {
      const m = stairMassAt(lat);
      num += m * lat; den += m;
    }
    if (postScore <= 4 && den <= 0) break;
    if (den > 0) {
      const centroid = num / den;
      if (Math.abs(centroid) < 2) break; // already centered
      const shift = Math.max(-span * 0.7, Math.min(span * 0.7, -centroid));
      kkBld.position.x += along[0] * shift;
      kkBld.position.z += along[1] * shift;
      kkBld.updateMatrixWorld(true);
    } else break;
  }
}

function kkMeasureStairs(kkBld, b, w) {
  const side = getDoorSide(b);
  const dp = getDoorWorldPos(b);
  const out = side === 'south' ? [0, 1] : side === 'north' ? [0, -1] : side === 'east' ? [1, 0] : [-1, 0];
  const along = [out[1], out[0]];
  kkBld.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  const STEP = 6, MAX_DEPTH = 120, MAX_STAIR_H = 40, PRESENT = 1.5;

  function heightAt(d, lat) {
    origin.set(dp.x + out[0] * d + along[0] * lat, 60, dp.y + out[1] * d + along[1] * lat);
    ray.set(origin, down);
    const hits = ray.intersectObject(kkBld, true);
    for (const hit of hits) { if (hit.point.y <= MAX_STAIR_H) return hit.point.y; }
    return 0;
  }

  // 1) Raw profile: widest/highest structure at each outward depth, sampled
  //    across the whole door corridor. The scan runs the FULL depth — the
  //    old version stopped at the first flat sample, which is exactly how
  //    the bank church's detached porch (a 26-unit slab ~30 units out, with
  //    flat ground between it and the wall) went unmeasured and walk-through.
  const lats = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1].map(f => f * w.doorWidth);
  const raw = [];
  let lastSolid = -1;
  let latNum = 0, latDen = 0;
  for (let d = 0, i = 0; d <= MAX_DEPTH; d += STEP, i++) {
    let h = 0;
    for (const lat of lats) {
      const hh = heightAt(d, lat);
      h = Math.max(h, hh);
      if (hh >= PRESENT) { latNum += lat; latDen++; }
    }
    raw.push(h);
    if (h >= PRESENT) lastSolid = i;
  }
  if (lastSolid < 0 || Math.max.apply(null, raw) < 2) return; // flush door — no zone needed
  const solidDepth = Math.min(MAX_DEPTH, (lastSolid + 1) * STEP);

  // Where the stoop actually sits laterally (≈0 once kkAutoAlign has
  // centered it; kept as a safety net so the ramp always hugs the geometry
  // rather than lifting players on air beside it).
  const latCenter = latDen > 0 ? Math.max(-w.doorWidth, Math.min(w.doorWidth, latNum / latDen)) : 0;

  // 2) Lateral reach of the stoop — flood outward from its center and stop
  //    at the first gap, so a CONNECTED stoop sets the band width while
  //    detached side dressing (the bank's flanking pillars) can't inflate
  //    it and leave players ramped up on thin air beside the real steps.
  const latStep = Math.max(6, w.doorWidth * 0.15);
  let reach = 0;
  for (const sign of [1, -1]) {
    for (let lat = latStep; lat <= w.doorWidth * 1.5; lat += latStep) {
      let solid = false;
      for (let d = 0; d <= solidDepth && !solid; d += STEP) {
        if (heightAt(d, latCenter + sign * lat) >= PRESENT) solid = true;
      }
      if (!solid) break;
      reach = Math.max(reach, lat);
    }
  }
  const stoopHalf = Math.max(w.doorWidth * 0.4, reach + 10);

  // 3) Walkable profile: monotone envelope of the geometry (never sink INTO
  //    a step; plateaus like porches survive), then a run-out long enough
  //    that the climb is a stroll, not a pop — slope capped ~1:3. The raw
  //    step-function this used to ship as is what read as "clunky": your Y
  //    snapped up half a body height across a couple of frames at the door.
  const mono = raw.slice(0, lastSolid + 2 <= raw.length ? lastSolid + 2 : raw.length);
  for (let i = mono.length - 2; i >= 0; i--) mono[i] = Math.max(mono[i], mono[i + 1]);
  const sill = mono[0];
  const MAX_SLOPE = 0.34;
  // The descent starts where the envelope leaves its door-level plateau
  // (porches hold the sill height for a stretch — the bank's holds ~36u),
  // so the gentle-slope budget is measured from THERE, not from the wall.
  let plateauEnd = 0;
  while (plateauEnd + 1 < mono.length && mono[plateauEnd + 1] > sill - 2) plateauEnd++;
  const rampLen = Math.min(168, Math.max(solidDepth, plateauEnd * STEP + Math.ceil((sill / MAX_SLOPE) / STEP) * STEP));
  const n = Math.floor(rampLen / STEP) + 1;
  const plateauD = plateauEnd * STEP;
  const profile = [];
  for (let i = 0; i < n; i++) {
    const d = i * STEP;
    const geom = i < mono.length ? mono[i] : 0;
    const ramp = d <= plateauD ? sill : sill * Math.max(0, 1 - (d - plateauD) / Math.max(STEP, rampLen - plateauD));
    profile.push(Math.max(geom, ramp));
  }
  profile[n - 1] = 0;
  // two gentle smoothing passes round the knees; the door end stays pinned
  // at the sill so there's no dip right where you cross the threshold
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < n - 1; i++) {
      profile[i] = Math.max((i < mono.length ? mono[i] : 0), profile[i - 1] * 0.25 + profile[i] * 0.5 + profile[i + 1] * 0.25);
    }
    profile[0] = sill;
  }

  KK_STAIR_ZONES.push({
    side, cx: dp.x + along[0] * latCenter, cz: dp.y + along[1] * latCenter, out, step: STEP,
    depth: rampLen, halfWidth: stoopHalf,
    // taller stoops fade out over a wider side band, so crossing the band's
    // edge stays a glide at any height (the Y-chase smooths the remainder)
    fade: Math.max(16, sill * 0.9), profile
  });
}

function buildBuildingMesh(b, w) {
  const group = new THREE.Group();
  // The Rooftop Lounge gets a taller exterior shell to read as two stories,
  // matching its two-story interior (see buildLoungeStructure()/getFloorHeight()).
  const wallH = b.id === 'lounge' ? WALL_HEIGHT * 1.8 : WALL_HEIGHT;
  const wallRects = buildWallsForOne(b, w);
  // Tier-3: a KayKit medieval building stands in for the box shell when its
  // model loaded. Collision stays on the same footprint rects either way.
  // Geometric-mean fit: pure max-dimension fit made models on elongated
  // footprints bulge far past their collision rect (you could walk the
  // camera inside the castle). The mean keeps big footprints imposing
  // without the walkable-overlap.
  const kkBld = KK.staticInstance('bld_' + b.id, Math.sqrt(b.w * b.h) * 1.16, 'fit');
  const useKK = !!kkBld;
  if (useKK) {
    kkAutoAlign(kkBld, b, w);
    group.add(kkBld);
    kkMeasureStairs(kkBld, b, w);
    // remember the placed model's ground box so dressing can stay clear of it
    kkBld.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(kkBld);
    KK_BLD_BOXES[b.id] = bb;
    // camera blocker: the COLLISION footprint (player can never be inside
    // it, unlike the model box whose stoop/bulge the player can stand in)
    // up to just under the model's roofline
    KK_CAM_BLOCKERS.push({ minX: b.x, minZ: b.y, maxX: b.x + b.w, maxZ: b.y + b.h, maxY: Math.max(60, bb.max.y * 0.96) });
  }
  // One siding texture per building, cloned per wall segment so each gets
  // its own repeat tuned to its own size — same pattern buildPathSegment()
  // uses for road tiles. White-based texture multiplies with b.color, so
  // every building keeps its own tint instead of one shared flat material.
  const sidingBase = useKK ? null : makeWoodSidingTexture();
  for (const r of (useKK ? [] : wallRects)) {
    if (r.w <= 0 || r.h <= 0) continue;
    const tex = sidingBase.clone();
    tex.needsUpdate = true;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, r.w / 40), Math.max(1, wallH / 40));
    const geo = new THREE.BoxGeometry(r.w, wallH, r.h);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, color: b.color }));
    mesh.position.set(r.x + r.w / 2, wallH / 2, r.y + r.h / 2);
    group.add(mesh);
  }

  if (!useKK) {
  // foundation plinth — a low, dark base so the building looks grounded
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(b.w + 14, 6, b.h + 14),
    new THREE.MeshLambertMaterial({ color: 0x4a4a4a })
  );
  foundation.position.set(b.x + b.w / 2, 3, b.y + b.h / 2);
  group.add(foundation);
  }

  // A second-story floor band — a darker trim strip wrapping the perimeter
  // partway up — plus an extra row of windows above it, so the Lounge reads
  // as two distinct stories rather than just one tall building.
  if (!useKK && b.id === 'lounge') {
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

  // hip/pyramid roof — a 4-sided cone whose flat faces need to line up with
  // the building's walls, then get scaled non-uniformly to match the
  // rectangular footprint (with a little overhang past the eaves).
  //
  // The 45° alignment rotation used to live on the MESH (roof.rotation.y),
  // applied *after* the non-uniform scale in Three.js's fixed scale→
  // rotate→translate transform order. Scaling a shape unevenly and then
  // rotating it distorts it — the roof only came out aligned for a
  // perfectly square building (b.w === b.h), which none of these are, so
  // every roof sat skewed relative to its own walls. Baking the rotation
  // into the geometry itself instead means the non-uniform scale (applied
  // via mesh.scale, still local-space) now runs on already-diagonal
  // vertices, landing on an actual axis-aligned rectangle every time.
  const overhang = 14, roofHeight = 58;
  if (!useKK) {
  const apothem = Math.cos(Math.PI / 4);
  const roofGeo = new THREE.ConeGeometry(1, roofHeight, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roofTex = makeShingleTexture();
  roofTex.repeat.set(Math.max(1, b.w / 60), Math.max(1, b.h / 60));
  const roof = new THREE.Mesh(
    roofGeo,
    new THREE.MeshLambertMaterial({ map: roofTex, color: 0x7a3c2c })
  );
  roof.scale.set((b.w / 2 + overhang) / apothem, 1, (b.h / 2 + overhang) / apothem);
  roof.position.set(b.x + b.w / 2, wallH + roofHeight / 2, b.y + b.h / 2);
  group.add(roof);
  }

  // a visible door slab filling the gap in whichever wall faces the door —
  // locked buildings get a barred reddish door; the free building and
  // unlocked ones get a normal wooden door (kept in sync via
  // refreshBuildingLockVisuals()). Full wall height (not a fixed 72, which
  // left a gap above the door you could see clean through into the
  // building) so the door slab actually covers the whole door-shaped hole
  // in the wall, floor to eaves.
  const t = w.wallThickness, doorH = wallH;
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
  if (useKK) door.visible = false; // the model brings its own door; lock state shows via the signs

  // glowing windows on the three walls that don't have the door
  const winMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
  if (!useKK) {
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
  } // end !useKK windows

  // floating sign with the building name, billboarded each frame
  const signY = useKK ? kkBld.userData.kkHeight + 26 : wallH + roofHeight + 22;
  const sign = makeSignSprite(b.name);
  sign.position.set(b.x + b.w / 2, signY, b.y + b.h / 2);
  group.add(sign);

  // a second sign disclosing free-vs-pass status. Both variants are built
  // up front and toggled by refreshBuildingLockVisuals(), so buying a
  // Town Pass mid-session flips every sign live — no rebuild needed.
  const lockedTag = makeSignSprite('🔒 Town Pass building');
  const freeTag = makeSignSprite('✓ Free to enter');
  for (const tag of [lockedTag, freeTag]) {
    tag.position.set(b.x + b.w / 2, signY - 26, b.y + b.h / 2);
    group.add(tag);
  }
  lockedTag.visible = locked;
  freeTag.visible = !locked;

  lockVisuals[b.id] = { door, lockSign: lockedTag, freeSign: freeTag, isPassBuilding: lockedRooms.has(b.id) };

  return group;
}

// A real doorway at an interior wall gap: wooden jamb posts + a header beam
// framing the opening, an EXIT sign above it, and a single door panel sized
// to the full gap and sitting flush in the wall plane — closed, not hinged
// ajar. The door used to swing open into the room (first at 0.9 rad, then
// 0.35 after an earlier fix), which always looked at least a little wrong
// no matter the angle since it's purely cosmetic geometry, not a real
// hinge simulation. A flush closed door reads correctly at any angle and
// fits an actual "press F to open/exit" interaction (see the exitDoor
// kiosk pushed in getInteriorScene, and tryInteract()/updateInteractHint())
// — collision at this gap now blocks the player like a real closed door;
// only interacting actually crosses it. Also fits the spooky theme better:
// a shut door you have to choose to open beats one already hanging ajar.
function buildInteriorDoorway(side, doorStart, doorEnd, roomW, roomD, theme) {
  const g = new THREE.Group();
  const t = (world.wallThickness || 12) * INDOOR_SCALE;
  const dw = doorEnd - doorStart;
  // Jambs+panel reach almost to the ceiling now (was 0.74x the wall height,
  // leaving a gap above the door you could see clean through) — the header
  // bar below fills in the last few units up to INDOOR_WALL_HEIGHT exactly.
  const doorH = INDOOR_WALL_HEIGHT - 10;
  const jambW = 8, jambD = t * 1.3;
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x160d08 });
  const doorMat = new THREE.MeshLambertMaterial({ color: theme.doorColor || 0x2a1a10 });
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x4a4238 });
  const ironMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });

  const axisIsX = side === 'north' || side === 'south';
  const wallCoord = side === 'north' ? 0 : side === 'south' ? roomD : side === 'west' ? 0 : roomW;
  const doorMid = (doorStart + doorEnd) / 2;

  const header = new THREE.Mesh(
    axisIsX ? new THREE.BoxGeometry(dw + jambW * 2, 10, jambD) : new THREE.BoxGeometry(jambD, 10, dw + jambW * 2),
    frameMat
  );
  if (axisIsX) header.position.set(doorMid, doorH + 5, wallCoord);
  else header.position.set(wallCoord, doorH + 5, doorMid);
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

  // EXIT sign centered above the header, facing into the room — a fixed
  // height just under the ceiling rather than doorH-relative, since doorH
  // now reaches almost all the way up itself (doorH + 26 would poke the
  // sign above the ceiling).
  const sign = makeSignSprite('EXIT');
  const signY = INDOOR_WALL_HEIGHT - 12;
  if (axisIsX) sign.position.set(doorMid, signY, wallCoord);
  else sign.position.set(wallCoord, signY, doorMid);
  g.add(sign);

  // Single flush panel filling the whole gap — no hinge, no swing.
  const panelT = 4;
  const panel = new THREE.Mesh(
    axisIsX ? new THREE.BoxGeometry(dw - 4, doorH - 8, panelT) : new THREE.BoxGeometry(panelT, doorH - 8, dw - 4),
    doorMat
  );
  if (axisIsX) panel.position.set(doorMid, doorH / 2, wallCoord);
  else panel.position.set(wallCoord, doorH / 2, doorMid);
  g.add(panel);

  const handle = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), handleMat);
  handle.position.set(
    axisIsX ? dw / 2 - 10 : panelT / 2 + 2.5,
    0,
    axisIsX ? panelT / 2 + 2.5 : dw / 2 - 10
  );
  panel.add(handle);

  // A couple of aged iron straps across the panel — reads as old ironwork.
  for (const hy of [doorH * 0.28, -doorH * 0.28]) {
    const strap = new THREE.Mesh(
      axisIsX ? new THREE.BoxGeometry(dw - 16, 4, panelT + 1.5) : new THREE.BoxGeometry(panelT + 1.5, 4, dw - 16),
      ironMat
    );
    strap.position.set(0, hy, 0);
    panel.add(strap);
  }

  // A faint sickly glow right at the door — just enough to suggest
  // something's lit beyond it, not a real light source.
  const glow = new THREE.PointLight(0x3a5a3a, 0.4, 60);
  glow.position.set(
    axisIsX ? doorMid : wallCoord,
    doorH * 0.4,
    axisIsX ? wallCoord : doorMid
  );
  g.add(glow);

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
    lv.lockSign.visible = locked;
    if (lv.freeSign) lv.freeSign.visible = !locked;
  }
}

function makeSignSprite(text) {
  const font = 'bold 30px sans-serif';
  // The canvas used to be a fixed 256px wide regardless of text length, so
  // anything longer than a short label (e.g. "⛩️ Temple of the Flame",
  // "🕯️ Witch's Cave — Press F to enter") got clipped at the edge instead
  // of shrinking or wrapping. Measure first and widen the canvas to fit.
  const measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  const textWidth = measureCtx.measureText(text).width;
  const paddingX = 24;
  const width = Math.max(256, Math.ceil(textWidth) + paddingX * 2);
  const height = 64;

  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const cx = c.getContext('2d');
  cx.font = font;
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillStyle = 'rgba(10,16,12,0.55)';
  cx.fillRect(0, 0, c.width, c.height);
  cx.fillStyle = '#eafff0';
  cx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  // Same world-units-per-canvas-pixel ratio the old fixed 256x64 -> 110x28
  // used, so every existing short sign renders at exactly the size it
  // always has — only text long enough to need a wider canvas gets wider.
  const scale = 110 / 256;
  sprite.scale.set(width * scale, height * scale, 1);
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
  // transparent so material.opacity can fade the whole label out — the mobile
  // "announce, then get out of the way" behavior in updateNameLabelHover().
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(hasTtl ? 158 : 102, hasTtl ? 35 : 23, 1);
  sprite.visible = false; // hover-only — see updateNameLabelHover()
  HOVER_NAME_SPRITES.push(sprite);
  return sprite;
}

// A framed canvas-texture picture for interior walls — same technique as
// the Witch's Cave's tarot cards (canvas gradient + border + a painted
// symbol/title), generalized with a color/text config so every building
// can hang a few without hand-rolling canvas art per theme. bg1/bg2 are
// the background gradient, border/accent are the frame + text colors.
function makeWallPainting(opts) {
  const { symbol, title, subtitle, bg1, bg2, border, accent, w = 60, h = 84 } = opts;
  const cw = 64, ch = 90;
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, ch);
  grad.addColorStop(0, bg1); grad.addColorStop(1, bg2);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = border; ctx.lineWidth = 2.5;
  ctx.strokeRect(3, 3, cw - 6, ch - 6);
  ctx.strokeStyle = accent; ctx.lineWidth = 1;
  ctx.strokeRect(7, 7, cw - 14, ch - 14);
  for (const [ox, oy] of [[10, 10], [cw - 10, 10], [10, ch - 10], [cw - 10, ch - 10]]) {
    ctx.fillStyle = border; ctx.beginPath(); ctx.arc(ox, oy, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textAlign = 'center';
  ctx.font = '26px serif';
  ctx.fillStyle = accent;
  ctx.fillText(symbol, cw / 2, ch * 0.5);
  if (title) {
    ctx.font = 'bold 7px sans-serif';
    ctx.fillStyle = border;
    ctx.fillText(title, cw / 2, ch * 0.73);
  }
  if (subtitle) {
    ctx.font = 'italic 5.5px serif';
    ctx.fillStyle = accent;
    ctx.fillText(subtitle, cw / 2, ch * 0.85);
  }
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0x000000, emissiveIntensity: 0.3 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
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

  // The door is now closed/flush rather than standing ajar (see
  // buildInteriorDoorway), so the gap buildWallsForOne leaves for it needs
  // a real collider too, or players would just walk straight through a
  // door that visually looks shut. isDoorCollider marks it so the wall
  // mesh loop below skips drawing a plain box on top of the nicer door
  // mesh — actually crossing it only happens via the exitDoor kiosk
  // pushed below (F key), same pattern as every other portal/NPC in the
  // game; collidesIndoor() doesn't care that it's tagged, so ordinary
  // movement is blocked here exactly like a real closed door.
  const wt = world.wallThickness;
  const localDoorStart = doorStart / INDOOR_SCALE, localDoorEnd = doorEnd / INDOOR_SCALE;
  let doorCollider;
  if (side === 'east') doorCollider = { x: localW - wt, y: localDoorStart, w: wt, h: localDoorEnd - localDoorStart, isDoorCollider: true };
  else if (side === 'west') doorCollider = { x: 0, y: localDoorStart, w: wt, h: localDoorEnd - localDoorStart, isDoorCollider: true };
  else if (side === 'north') doorCollider = { x: localDoorStart, y: 0, w: localDoorEnd - localDoorStart, h: wt, isDoorCollider: true };
  else doorCollider = { x: localDoorStart, y: localH - wt, w: localDoorEnd - localDoorStart, h: wt, isDoorCollider: true }; // south
  wallsLocal.push(doorCollider);

  const scene = new THREE.Scene();
  // Background/fog and lighting are theme-overridable so one room can go
  // full Witch-Hazel (the Arcade's cold starlight) while every other
  // interior keeps the warm torchlit defaults.
  const bgCol = theme.bg != null ? theme.bg : 0x1c1410;
  scene.background = new THREE.Color(bgCol);
  scene.fog = new THREE.Fog(bgCol, 380, 900);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);

  scene.add(new THREE.AmbientLight(
    theme.ambient != null ? theme.ambient : 0xffd9a0,
    theme.ambientIntensity != null ? theme.ambientIntensity : 0.5
  ));
  if (theme.lightsStyle === 'crystal') {
    // The Witch's Cave trick: cold point lights rising from emissive
    // crystal clusters instead of fire, plus a soft directional fill so
    // players don't read as silhouettes against the dark stone.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0x8fb8ff, 0.8);
    fill.position.set(roomW * 0.6, 260, roomD * 0.7);
    scene.add(fill);
    const crystalMat = new THREE.MeshLambertMaterial({
      color: theme.crystalColor != null ? theme.crystalColor : 0x9fd4ff,
      emissive: theme.crystalEmissive != null ? theme.crystalEmissive : 0x1d5ecc,
      emissiveIntensity: 0.9
    });
    const spots = [
      [34, 34], [roomW - 34, 34], [34, roomD - 34], [roomW - 34, roomD - 34],
      [roomW / 2, 40]
    ];
    for (const [sx, sz] of spots) {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0x3d8bff, 1.5, 380);
      light.position.set(sx, 85, sz);
      scene.add(light);
      const cluster = new THREE.Group();
      for (const [ox, oz, r, h] of [[0, 0, 7, 16], [9, 4, 4.5, 9], [-7, 6, 3.5, 7]]) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), crystalMat);
        shard.scale.y = h / (r * 2);
        shard.position.set(ox, h, oz);
        cluster.add(shard);
      }
      cluster.position.set(sx, 0, sz);
      scene.add(cluster);
    }
  } else if (theme.lightsStyle === 'wisp') {
    // Spirit-wisp lighting (the Phantom Parlor): no fixtures at all — just
    // hovering glow-orbs with a soft halo, each carrying its own cold
    // light. Heights vary so they read as drifting, not mounted.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0x9fffd0, 0.7);
    fill.position.set(roomW * 0.5, 260, roomD * 0.7);
    scene.add(fill);
    const wCol = theme.wispColor != null ? theme.wispColor : 0x8fffbe;
    const lCol = theme.lightColor != null ? theme.lightColor : 0x3fd98a;
    const spots = [
      [roomW * 0.12, roomD * 0.2], [roomW * 0.3, roomD * 0.78], [roomW * 0.52, roomD * 0.25],
      [roomW * 0.7, roomD * 0.7], [roomW * 0.88, roomD * 0.3]
    ];
    spots.forEach(([sx, sz], i) => {
      const light = new THREE.PointLight(lCol, 1.4, 400);
      light.position.set(sx, 96, sz);
      scene.add(light);
      const wispY = 92 + (i % 3) * 9;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(5 + (i % 3), 10, 10), new THREE.MeshBasicMaterial({ color: wCol, transparent: true, opacity: 0.85 }));
      orb.position.set(sx, wispY, sz);
      scene.add(orb);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(9 + (i % 3) * 1.5, 10, 10), new THREE.MeshBasicMaterial({ color: wCol, transparent: true, opacity: 0.16 }));
      halo.position.set(sx, wispY, sz);
      scene.add(halo);
    });
  } else if (theme.lightsStyle === 'lantern') {
    // Hanging witch-lanterns (the Cauldron Café): amber glass orbs in iron
    // fittings, chained down from the beams, each carrying a warm light.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0xffc890, 0.65);
    fill.position.set(roomW * 0.55, 260, roomD * 0.6);
    scene.add(fill);
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x1a120a });
    const spots = [
      [roomW * 0.2, roomD * 0.28], [roomW * 0.5, roomD * 0.22], [roomW * 0.8, roomD * 0.3],
      [roomW * 0.32, roomD * 0.72], [roomW * 0.68, roomD * 0.7]
    ];
    spots.forEach(([sx, sz], i) => {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0xff9a3c, 1.25, 380);
      light.position.set(sx, 100, sz);
      scene.add(light);
      const hangY = 104 + (i % 2) * 6;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, Math.max(6, INDOOR_WALL_HEIGHT - hangY - 6), 4), ironMat);
      chain.position.set(sx, (INDOOR_WALL_HEIGHT + hangY) / 2, sz);
      scene.add(chain);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 3, 6), ironMat);
      cap.position.set(sx, hangY + 9, sz);
      scene.add(cap);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffb96a, transparent: true, opacity: 0.95 }));
      orb.position.set(sx, hangY, sz);
      scene.add(orb);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(9.5, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.18 }));
      halo.position.set(sx, hangY, sz);
      scene.add(halo);
    });
  } else if (theme.lightsStyle === 'candle') {
    // Floating candles (the Midnight Archive): little wax clusters hovering
    // in mid-air, warm flames against the cool violet room.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0xd0c4ff, 0.75);
    fill.position.set(roomW * 0.5, 260, roomD * 0.65);
    scene.add(fill);
    const waxMat = new THREE.MeshLambertMaterial({ color: 0xf0e8d8 });
    const spots = [
      [roomW * 0.18, roomD * 0.25], [roomW * 0.5, roomD * 0.18], [roomW * 0.82, roomD * 0.3],
      [roomW * 0.3, roomD * 0.75], [roomW * 0.72, roomD * 0.72]
    ];
    spots.forEach(([sx, sz], i) => {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0xffd9a0, 1.15, 360);
      light.position.set(sx, 108, sz);
      scene.add(light);
      const baseY = 96 + (i % 3) * 8;
      for (const [ox, oz, h] of [[0, 0, 14], [7, 4, 9], [-6, 5, 7]]) {
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, h, 6), waxMat);
        candle.position.set(sx + ox, baseY + h / 2, sz + oz);
        scene.add(candle);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(1.7, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
        flame.scale.y = 1.7;
        flame.position.set(sx + ox, baseY + h + 2.5, sz + oz);
        scene.add(flame);
      }
    });
  } else if (theme.lightsStyle === 'brazier') {
    // Standing ritual braziers (the Coven Court): iron bowls on tripod
    // legs, burning low and red.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0xffb9a0, 0.6);
    fill.position.set(roomW * 0.5, 260, roomD * 0.7);
    scene.add(fill);
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x16100c });
    const spots = [
      [40, 44], [roomW - 40, 44], [40, roomD - 60], [roomW - 40, roomD - 60], [roomW / 2, roomD * 0.62]
    ];
    for (const [sx, sz] of spots) {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0xff6a3c, 1.3, 380);
      light.position.set(sx, 60, sz);
      scene.add(light);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(11, 6, 9, 8), ironMat);
      bowl.position.set(sx, 34, sz);
      scene.add(bowl);
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI * 2 / 3;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 34, 4), ironMat);
        leg.position.set(sx + Math.cos(a) * 7, 17, sz + Math.sin(a) * 7);
        leg.rotation.z = Math.cos(a) * 0.22;
        leg.rotation.x = -Math.sin(a) * 0.22;
        scene.add(leg);
      }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(7, 16, 6),
        new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.9 }));
      flame.position.set(sx, 46, sz);
      scene.add(flame);
      const flameCore = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      flameCore.position.set(sx, 44, sz);
      scene.add(flameCore);
    }
  } else if (theme.lightsStyle === 'vaultlamp') {
    // Gilded candelabra stands (the Gilded Vault): tall golden poles, three
    // pale-green flames apiece — counting-house light for cursed coin.
    const fill = new THREE.DirectionalLight(theme.fill != null ? theme.fill : 0xffe9a0, 0.65);
    fill.position.set(roomW * 0.5, 260, roomD * 0.55);
    scene.add(fill);
    const goldMatL = new THREE.MeshLambertMaterial({ color: 0xb8912a, emissive: 0x3a2c08, emissiveIntensity: 0.35 });
    const spots = [
      [44, roomD * 0.14], [roomW - 44, roomD * 0.14], [44, roomD * 0.5], [roomW - 44, roomD * 0.5], [roomW / 2, roomD * 0.32]
    ];
    for (const [sx, sz] of spots) {
      const light = new THREE.PointLight(theme.lightColor != null ? theme.lightColor : 0xffc84a, 1.25, 380);
      light.position.set(sx, 78, sz);
      scene.add(light);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 64, 6), goldMatL);
      pole.position.set(sx, 32, sz);
      scene.add(pole);
      const arms = new THREE.Mesh(new THREE.BoxGeometry(26, 2.2, 2.2), goldMatL);
      arms.position.set(sx, 62, sz);
      scene.add(arms);
      for (const [ox, oy] of [[-12, 0], [0, 3], [12, 0]]) {
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0xf0e8d8 }));
        candle.position.set(sx + ox, 66 + oy, sz);
        scene.add(candle);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xd8ffa0 }));
        flame.scale.y = 1.8;
        flame.position.set(sx + ox, 72 + oy, sz);
        scene.add(flame);
      }
    }
  } else {
    const torch1 = new THREE.PointLight(0xffa85c, 1.2, 340);
    torch1.position.set(30, 70, 30);
    scene.add(torch1);
    const torch2 = new THREE.PointLight(0xffa85c, 1.2, 340);
    torch2.position.set(roomW - 30, 70, roomD - 30);
    scene.add(torch2);
  }

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

  // walls, scaled from the same local wall rects used for collision — skip
  // the door's own collider here, it's rendered as an actual door instead
  // (buildInteriorDoorway below), not a plain box.
  const wallMat = new THREE.MeshLambertMaterial({ color: theme.wall });
  for (const r of wallsLocal) {
    if (r.w <= 0 || r.h <= 0 || r.isDoorCollider) continue;
    const geo = new THREE.BoxGeometry(r.w * INDOOR_SCALE, INDOOR_WALL_HEIGHT, r.h * INDOOR_SCALE);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set((r.x + r.w / 2) * INDOOR_SCALE, INDOOR_WALL_HEIGHT / 2, (r.y + r.h / 2) * INDOOR_SCALE);
    scene.add(mesh);
  }

  // exposed ceiling beams — dark wood by default, cold blue stone when the
  // theme overrides it (the arcade)
  const beamMat = new THREE.MeshLambertMaterial({ color: theme.beamColor != null ? theme.beamColor : 0x3c2a1a });
  for (let i = 1; i <= 3; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(roomW - 10, 8, 10), beamMat);
    beam.position.set(roomW / 2, INDOOR_WALL_HEIGHT - 12, (roomD / 4) * i);
    scene.add(beam);
  }

  // torches near the point lights (crystal- and wisp-lit rooms already got
  // their own glowing fixtures at every light spot — fire would clash)
  if (!theme.lightsStyle) {
    scene.add(buildTorch(30, 30));
    scene.add(buildTorch(roomW - 30, roomD - 30));
  }

  // a real doorway at the gap — wooden frame around the opening, an EXIT
  // sign, and a single closed panel flush with the wall (see
  // buildInteriorDoorway) instead of an empty gap or a swung-open panel.
  scene.add(buildInteriorDoorway(side, doorStart, doorEnd, roomW, roomD, theme));

  const seats = [];
  const kiosks = [];
  buildFurniture(scene, theme.furniture, roomW, roomD, seats, kiosks);
  // The door itself is an interact point too — same proximity+F pattern as
  // every portal/NPC in the game (see findNearestKiosk/tryInteract), rather
  // than the old purely-positional "walk into the gap" exit.
  const doorWallCoord = side === 'north' ? 0 : side === 'south' ? roomD : side === 'west' ? 0 : roomW;
  const doorMidScaled = (doorStart + doorEnd) / 2;
  kiosks.push({
    x: (side === 'north' || side === 'south') ? doorMidScaled : doorWallCoord,
    z: (side === 'north' || side === 'south') ? doorWallCoord : doorMidScaled,
    exitDoor: true,
    radius: 90
  });

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

// A torch that starts unlit (no flame, no light) and gets toggled lit by
// the nightly ritual (see applyTownTorchState) — unlike buildTorch() above,
// which is always-lit decor with no on/off state.
function buildTownRitualTorch(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4, 60, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a3320 })
  );
  pole.position.set(x, 30, z);
  g.add(pole);
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 6, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
  );
  bowl.position.set(x, 62, z);
  g.add(bowl);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(7, 18, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9d3c })
  );
  flame.position.set(x, 74, z);
  flame.visible = false;
  g.add(flame);
  const light = new THREE.PointLight(0xff9d3c, 0, 260);
  light.position.set(x, 74, z);
  g.add(light);
  return { group: g, flame, light };
}

// A bronze medallion etched with a circle + five-pointed star — solid
// background (unlike the floor sigil below), since this is a physical
// object resting on the altar, not a marking carved into existing stone.
function makePentacleTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  grad.addColorStop(0, '#7a6238');
  grad.addColorStop(1, '#3a2c18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const cxp = 128, cyp = 128, r = 104;
  ctx.strokeStyle = '#241a10';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cxp, cyp, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cxp, cyp, r - 16, 0, Math.PI * 2); ctx.stroke();

  const points = [];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    points.push([cxp + Math.cos(angle) * (r - 16), cyp + Math.sin(angle) * (r - 16)]);
  }
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#18110a';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i <= 5; i++) ctx.lineTo(points[(i * 2) % 5][0], points[(i * 2) % 5][1]);
  ctx.closePath();
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

// A ring of carved sigils meant to read as etched into the platform's own
// stone — fully transparent background (only the lines have any alpha) so
// the white stone texture underneath shows through everywhere else,
// instead of looking like a separate decal sitting on top of the floor.
function makeSigilFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 300; c.height = 300;
  const ctx = c.getContext('2d');
  const cxp = 150, cyp = 150;

  ctx.strokeStyle = 'rgba(70,60,48,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cxp, cyp, 128, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cxp, cyp, 100, 0, Math.PI * 2); ctx.stroke();

  // Two overlapping triangles (a hexagram) for the classic "ritual circle" look.
  function triangle(rot) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = rot + i * (Math.PI * 2 / 3);
      const x = cxp + Math.cos(angle) * 92, y = cyp + Math.sin(angle) * 92;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }
  ctx.lineWidth = 2.5;
  triangle(-Math.PI / 2);
  triangle(Math.PI / 2);

  // Small rune ticks spaced around the outer ring.
  for (let i = 0; i < 10; i++) {
    const angle = i * (Math.PI * 2 / 10);
    const x1 = cxp + Math.cos(angle) * 132, y1 = cyp + Math.sin(angle) * 132;
    const x2 = cxp + Math.cos(angle) * 146, y2 = cyp + Math.sin(angle) * 146;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  return new THREE.CanvasTexture(c);
}

function makeAltarSkull(x, y, z) {
  const g = new THREE.Group();
  const boneMat = new THREE.MeshLambertMaterial({ color: 0xe4dcc4 });
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), boneMat);
  cranium.scale.set(1, 0.9, 1.05);
  g.add(cranium);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.5, 4), boneMat);
  jaw.position.set(0, -4, 1);
  g.add(jaw);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0605 });
  for (const side of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(1.3, 6, 6), eyeMat);
    socket.position.set(side * 2, 0.5, 4.2);
    g.add(socket);
  }
  g.position.set(x, y, z);
  return g;
}

function makeAltarCandle(x, y, z) {
  const g = new THREE.Group();
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.5, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xf0e6c8 })
  );
  wax.position.y = 6;
  g.add(wax);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4, 8), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
  flame.position.y = 14;
  g.add(flame);
  const flicker = new THREE.PointLight(0xffaa44, 0.5, 50);
  flicker.position.y = 14;
  g.add(flicker);
  g.position.set(x, y, z);
  return g;
}

function makeAltarDagger(x, y, z, rotY) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.6, 16),
    new THREE.MeshLambertMaterial({ color: 0xc7ccd4 })
  );
  blade.position.z = -6;
  g.add(blade);
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, 7, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a2418 })
  );
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 5.5;
  g.add(handle);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), new THREE.MeshLambertMaterial({ color: 0x7a6238 }));
  pommel.position.z = 9.5;
  g.add(pommel);
  g.rotation.y = rotY || 0;
  g.position.set(x, y, z);
  return g;
}

function makeIncenseBowl(x, y, z) {
  const g = new THREE.Group();
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 3, 3, 12),
    new THREE.MeshLambertMaterial({ color: 0x4a3626 })
  );
  bowl.position.y = 1.5;
  g.add(bowl);
  const ashMat = new THREE.MeshLambertMaterial({ color: 0x2a2420 });
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.6, 12), ashMat);
  ash.position.y = 3;
  g.add(ash);
  // A thin rising wisp of smoke — a few small, slightly offset, tapering
  // translucent spheres rather than an actual particle system, since it
  // never needs to look like more than a lazy curl at this scale.
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0xcfd0d2, transparent: true, opacity: 0.35 });
  const smokeOffsets = [[0, 6, 0, 1.1], [0.8, 10, 0.4, 1.4], [0.2, 14, -0.6, 1.7], [-0.6, 18, 0.3, 2.0]];
  for (const [sx, sy, sz, sr] of smokeOffsets) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(sr, 6, 6), smokeMat);
    puff.position.set(sx, sy, sz);
    g.add(puff);
  }
  g.position.set(x, y, z);
  return g;
}

function makePentacleMedallion(x, y, z) {
  const tex = makePentacleTexture();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(15, 24),
    new THREE.MeshLambertMaterial({ map: tex })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, y, z);
  return disc;
}

// The Torchkeepers' home shrine — a small open-air ritual platform near the
// tree line at the back of town. Purely a landmark/gathering spot, not an
// enterable building: no interior, no door, no room id — see server.js's
// TOWN_TEMPLE (the gathering point just north/in-front of this structure
// the 4 NPCs walk to each morning). No roof anymore — just the flat white
// stone platform, a corner pillar at each edge, and a central altar, kept
// open so the nightly portal (see buildEmberPortal(), positioned above the
// altar in initScene) reads clearly against the sky instead of being boxed
// in. Pillars are purely decorative (no collision) — only the altar itself
// blocks movement (see the walls.push in initScene), so the rest of the
// platform is walkable; getFloorHeight() raises a standing player's
// rendered Y to match platformH so they read as standing on top of it
// instead of clipping through.
function buildTownTemple(cx, cz) {
  const g = new THREE.Group();
  const platformW = 360, platformD = 260, platformH = 16;
  const whiteStoneTex = makeWhiteStoneTexture();
  whiteStoneTex.repeat.set(platformW / 50, platformD / 50);

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(platformW, platformH, platformD),
    new THREE.MeshLambertMaterial({ map: whiteStoneTex, color: 0xffffff })
  );
  platform.position.set(cx, platformH / 2, cz);
  g.add(platform);

  // Ritual sigils carved into the platform floor, ringing the altar — a
  // flat transparent-background decal laid just above the stone surface so
  // it reads as etched into it rather than pasted on top. Drawn before the
  // altar/pillars so it never overdraws anything sitting on top of it.
  const sigilPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshBasicMaterial({ map: makeSigilFloorTexture(), transparent: true })
  );
  sigilPlane.rotation.x = -Math.PI / 2;
  sigilPlane.position.set(cx, platformH + 0.3, cz);
  g.add(sigilPlane);

  // Corner pillars — short, purely decorative, framing the platform now
  // that there's no roof for them to hold up. A simple capital cap on each
  // gives them a finished, "ruins" look rather than plain cylinders.
  const pillarH = 84;
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0xf5f2e6 });
  const pillarGeo = new THREE.CylinderGeometry(11, 13, pillarH, 8);
  const capGeo = new THREE.CylinderGeometry(16, 12, 9, 8);
  const marginX = 34, marginZ = 28;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const px = cx + sx * (platformW / 2 - marginX);
      const pz = cz + sz * (platformD / 2 - marginZ);
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, platformH + pillarH / 2, pz);
      g.add(pillar);
      const cap = new THREE.Mesh(capGeo, pillarMat);
      cap.position.set(px, platformH + pillarH + 4.5, pz);
      g.add(cap);
    }
  }

  // Altar — a two-tier stone pedestal at the platform's center, doubling as
  // the anchor point the portal hovers over once the torches are lit.
  const altarMat = new THREE.MeshLambertMaterial({ color: 0xefeade });
  const altarBase = new THREE.Mesh(new THREE.BoxGeometry(64, 30, 64), altarMat);
  altarBase.position.set(cx, platformH + 15, cz);
  g.add(altarBase);
  const altarTop = new THREE.Mesh(new THREE.BoxGeometry(40, 12, 40), altarMat);
  altarTop.position.set(cx, platformH + 36, cz);
  g.add(altarTop);
  // A faint permanent ember glow on the altar top hints at what happens at night.
  const emberGlow = new THREE.PointLight(0xff5522, 0.4, 90);
  emberGlow.position.set(cx, platformH + 46, cz);
  g.add(emberGlow);

  // Altar trinkets — the top surface sits at platformH + 42 (altarTop's
  // center 36 + half its 12 height). Pentacle medallion dead center, the
  // rest spread across the four corners of the 40x40 top with margin to spare.
  const topY = platformH + 42;
  g.add(makePentacleMedallion(cx, topY + 0.2, cz));
  g.add(makeIncenseBowl(cx - 12, topY, cz - 12));
  g.add(makeAltarSkull(cx + 12, topY + 5, cz - 12));
  g.add(makeAltarCandle(cx - 12, topY, cz + 12));
  g.add(makeAltarDagger(cx + 12, topY + 0.6, cz + 12, 0.6));

  const sign = makeSignSprite('⛩️ Temple of the Flame');
  sign.position.set(cx, platformH + pillarH + 40, cz);
  g.add(sign);

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
  // The unlit hole reads as bright regardless of scene lighting, but never
  // actually lit anything around it — a real hearth should throw warm light
  // across the room, not just glow in place.
  const glow = new THREE.PointLight(0xff8a3a, 1.1, 260);
  glow.position.set(0, 24, 12);
  g.add(glow);
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
  // Enchanted arcane machine — rune-etched night-blue body, crystal crown
  // where the wooden marquee used to be. Same footprint, same screen, same
  // kiosk interaction; only the dressing changed with the room.
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(30, 64, 26),
    new THREE.MeshLambertMaterial({ color: 0x141f3d, emissive: 0x060d1f, emissiveIntensity: 0.6 })
  );
  body.position.y = 32;
  g.add(body);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 18),
    new THREE.MeshBasicMaterial({ color: screenColor })
  );
  screen.position.set(0, 44, 13.1);
  g.add(screen);
  // Glowing rune etchings down the front panel, below the screen
  const runeMat = new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x2a6fe0, emissiveIntensity: 0.8 });
  for (let i = 0; i < 4; i++) {
    const etch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 0.8), runeMat);
    etch.position.set(-9 + i * 6, 24 - (i % 2) * 6, 13.2);
    g.add(etch);
  }
  // Crystal trim crown + a shard at each top corner
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(32, 5, 28),
    new THREE.MeshLambertMaterial({ color: 0xbfe2ff, emissive: 0x2f6fd0, emissiveIntensity: 0.55, transparent: true, opacity: 0.9 })
  );
  trim.position.y = 64;
  g.add(trim);
  const shardMat = new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x1d5ecc, emissiveIntensity: 0.9 });
  for (const sx of [-13, 13]) {
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(4, 0), shardMat);
    shard.scale.y = 1.8;
    shard.position.set(sx, 70, 0);
    g.add(shard);
  }
  const glow = new THREE.PointLight(screenColor, 0.6, 60);
  glow.position.set(0, 44, 16);
  g.add(glow);
  g.position.set(x, 0, z);
  g.rotation.y = rotY || 0;
  return g;
}

function makeWindowGlow(x, y, z, rotY, color) {
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 30),
    new THREE.MeshBasicMaterial({ color: color != null ? color : 0xffd98a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
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
  // Mossy stone for the Phantom Parlor (was warm wood in Lounge days)
  const stepMat = new THREE.MeshLambertMaterial({ color: 0x25443a });
  for (let i = 0; i < stepCount; i++) {
    const stepH = platformH * (i + 1) / stepCount;
    const stepX = stairStart + stepWidth * (i + 0.5);
    const step = new THREE.Mesh(new THREE.BoxGeometry(stepWidth + 0.5, stepH, roomD * 0.86), stepMat);
    step.position.set(stepX, stepH / 2, roomD / 2);
    scene.add(step);
  }

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(roomW - stairEnd, 8, roomD),
    new THREE.MeshLambertMaterial({ color: 0x2e5346 })
  );
  platform.position.set((stairEnd + roomW) / 2, platformH - 4, roomD / 2);
  scene.add(platform);

  // Ghostlight seeps in through the watch windows
  scene.add(makeWindowGlow(roomW - 6, platformH + 40, roomD * 0.25, -Math.PI / 2, 0xa8ffd0));
  scene.add(makeWindowGlow(roomW - 6, platformH + 40, roomD * 0.75, -Math.PI / 2, 0xa8ffd0));
  const lookoutSign = makeSignSprite("🌙 Widow's Watch");
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

// A free-floating glowing glyph — always-bright (Basic material), soft halo
// painted right into the canvas. Halo/ink tint per room: the Starlight
// Arcade hangs blue ones, the Phantom Parlor ghost-green.
function makeGlowGlyphMesh(glyph, size, halo, ink) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = halo || '#66baff'; ctx.shadowBlur = 14;
  ctx.fillStyle = ink || '#cfe8ff'; ctx.font = '38px serif';
  ctx.fillText(glyph, 32, 34);
  ctx.fillText(glyph, 32, 34); // twice = brighter core inside the halo
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  return new THREE.Mesh(new THREE.PlaneGeometry(size || 26, size || 26), mat);
}

// A relic on display: stone pedestal, glass dome, its own cold light.
// Items get added into the returned group at y≈34..46. opts tints the
// stone/dome/light per room; opts.baseY lifts the whole pedestal (the
// Parlor's terrace pedestal sits on the raised platform).
function makeDisplayPedestal(scene, x, z, opts) {
  const o = opts || {};
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 26, 10), new THREE.MeshLambertMaterial({ color: o.stone != null ? o.stone : 0x243761 }));
  base.position.y = 13; g.add(base);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 13.5, 2.5, 10), new THREE.MeshLambertMaterial({ color: o.cap != null ? o.cap : 0x2f4a7f }));
  cap.position.y = 27; g.add(cap);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(13, 12, 10), new THREE.MeshLambertMaterial({ color: o.dome != null ? o.dome : 0xbfe2ff, transparent: true, opacity: 0.22 }));
  dome.position.y = 40; g.add(dome);
  const light = new THREE.PointLight(o.light != null ? o.light : 0x66aaff, 0.5, 90);
  light.position.set(0, 46, 0); g.add(light);
  g.position.set(x, o.baseY || 0, z);
  scene.add(g);
  return g;
}

function buildFurniture(scene, type, roomW, roomD, seatsOut, kiosksOut) {
  const cx = roomW / 2, cz = roomD / 2;
  if (type === 'tavern') {
    scene.add(makeRug(cx, cz, roomW * 0.6, roomD * 0.55, 0x4a2440));
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
    scene.add(makeBanner(28, 100, 8, 0, 0xff9a3c));
    scene.add(makeBanner(roomW - 28, 100, 8, 0, 0xff9a3c));

    // ── Witchy dressing: the Cauldron Café earns its name ──
    // A bubbling cauldron beside the bar (decor only — Joss still runs the shop)
    const cauldron = new THREE.Group();
    const potMat = new THREE.MeshLambertMaterial({ color: 0x14100e });
    const pot = new THREE.Mesh(new THREE.SphereGeometry(16, 12, 10), potMat);
    pot.scale.y = 0.78; pot.position.y = 15;
    cauldron.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(13.5, 2.2, 8, 16), potMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = 26;
    cauldron.add(rim);
    const brew = new THREE.Mesh(new THREE.CircleGeometry(12.5, 16),
      new THREE.MeshBasicMaterial({ color: 0x6fe86a }));
    brew.rotation.x = -Math.PI / 2; brew.position.y = 25;
    cauldron.add(brew);
    for (const [bx, bz, br] of [[-4, 3, 2.2], [5, -2, 1.6], [1, 6, 1.3]]) {
      const bub = new THREE.Mesh(new THREE.SphereGeometry(br, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xa8ff9a, transparent: true, opacity: 0.85 }));
      bub.position.set(bx, 27 + br, bz);
      cauldron.add(bub);
    }
    const ladle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 34, 5),
      new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
    ladle.position.set(8, 34, 0); ladle.rotation.z = -0.5;
    cauldron.add(ladle);
    const brewGlow = new THREE.PointLight(0x6fe86a, 0.9, 160);
    brewGlow.position.y = 34;
    cauldron.add(brewGlow);
    cauldron.position.set(150, 0, 42);
    scene.add(cauldron);
    // Herb bundles drying from the beams
    const herbMat = new THREE.MeshLambertMaterial({ color: 0x4a6a2a });
    const twineMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
    for (const [hx, hz] of [[roomW * 0.35, roomD / 4], [roomW * 0.62, roomD / 4], [roomW * 0.45, roomD / 2], [roomW * 0.7, (roomD / 4) * 3]]) {
      const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 8, 4), twineMat);
      tie.position.set(hx, INDOOR_WALL_HEIGHT - 20, hz);
      scene.add(tie);
      const bundle = new THREE.Mesh(new THREE.ConeGeometry(5, 14, 6), herbMat);
      bundle.rotation.x = Math.PI; // hung tip-down
      bundle.position.set(hx, INDOOR_WALL_HEIGHT - 32, hz);
      scene.add(bundle);
    }
    // Pumpkins stacked in the far corner
    const pumpMat = new THREE.MeshLambertMaterial({ color: 0xd87a2a });
    for (const [px, pz, pr] of [[roomW - 30, roomD - 40, 9], [roomW - 46, roomD - 30, 6.5], [roomW - 30, roomD - 58, 5]]) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(pr, 10, 8), pumpMat);
      p.scale.y = 0.8; p.position.set(px, pr * 0.8, pz);
      scene.add(p);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 4, 5),
        new THREE.MeshLambertMaterial({ color: 0x4a6a2a }));
      stem.position.set(px, pr * 1.6 + 2, pz);
      scene.add(stem);
    }
    scene.add(makeShield(60, 82, 6, 0, 0xb0392b));
    scene.add(makeShield(roomW - 90, 82, 6, 0, 0x3b5fb0));
    scene.add(makeWindowGlow(6, 80, roomD * 0.18, Math.PI / 2));
    scene.add(makeWindowGlow(roomW - 6, 80, roomD * 0.85, -Math.PI / 2));

    // Framed paintings on the (otherwise bare) south wall, facing north
    // into the room.
    const tavernPaintings = [
      { symbol: '🫖', title: 'THE EVENING BREW', subtitle: 'don\'t ask what\'s in it' },
      { symbol: '🐈‍⬛', title: 'THE HOUSE CAT', subtitle: 'pays her tab in mice' },
      { symbol: '🍄', title: 'KNOW YOUR CAPS', subtitle: 'the safe ones (mostly)' }
    ];
    [roomW * 0.28, roomW * 0.5, roomW * 0.72].forEach((x, i) => {
      const p = makeWallPainting({
        ...tavernPaintings[i],
        bg1: '#2a140c', bg2: '#3c1e10', border: '#c87a3a', accent: '#ffb060'
      });
      p.position.set(x, 90, roomD - 4);
      p.rotation.y = Math.PI;
      scene.add(p);
    });

    // The Town Pass statue — a free-standing corner near the entrance,
    // clear of the dining grid, the bar, and the doorway swing.
    if (kiosksOut) {
      const statueX = roomW * 0.9, statueZ = roomD * 0.12;
      scene.add(makeStatue(statueX, statueZ));
      const statueSign = makeSignSprite('🗿 Town Pass');
      statueSign.position.set(statueX, 108, statueZ);
      scene.add(statueSign);
      kiosksOut.push({ id: 'town_pass', x: statueX, z: statueZ });

      // Two NPCs — same interact pattern as every other NPC in the game
      // (proximity + F, see tryInteract/updateInteractHint). Barkeep Joss
      // sells consumables (reuses the existing NPC_SHOPS/openNpcShopModal
      // flow, same as the outdoor town NPCs); Old Mabel doesn't sell
      // anything — she just gives a hint about whatever quest you're
      // currently on (npc_hint_talk), or tells you to come back once you
      // are on one.
      const bartender = createHumanoid(3).group;
      bartender.position.set(78, 0, 130);
      bartender.rotation.y = Math.atan2(cx - 78, cz - 130);
      scene.add(bartender);
      const bartenderLabel = makeNpcNameSprite('Barkeep Joss', 'Tavern Keeper');
      bartenderLabel.position.set(78, 90, 130);
      scene.add(bartenderLabel);
      kiosksOut.push({ x: 78, z: 130, npc: 'npc', npcId: 'npc_bartender', npcName: 'Barkeep Joss' });

      const patron = createHumanoid(0).group;
      patron.position.set(460, 0, 90);
      patron.rotation.y = Math.atan2(cx - 460, cz - 90);
      scene.add(patron);
      const patronLabel = makeNpcNameSprite('Old Mabel', 'Fireside Regular');
      patronLabel.position.set(460, 90, 90);
      scene.add(patronLabel);
      kiosksOut.push({ x: 460, z: 90, npc: 'hint', npcId: 'npc_patron', npcName: 'Old Mabel' });
    }
  } else if (type === 'library') {
    scene.add(makeRug(cx, cz, roomW * 0.5, roomD * 0.35, 0x3a2a5c));
    // The library's door is on the west wall (x=0 side), and its gap spans
    // roughly z=144..324 (centered on the room) — the two bookshelves that
    // used to sit at x=20 (right against that same wall) had z positions of
    // 194 and 244, both inside that range, so they sat almost exactly in
    // the entrance path. Removed rather than just moved; the two on the
    // east wall (away from the door) are enough for the room.
    scene.add(makeBookshelf(roomW - 20, cz - 40, -Math.PI / 2));
    scene.add(makeBookshelf(roomW - 20, cz + 10, -Math.PI / 2));
    scene.add(makeTable(cx, cz - 10));
    scene.add(makeBanner(cx, 90, 8, 0, 0x9a7ad9));

    // ── Witchy dressing: the Midnight Archive ──
    // Rune ring painted on the floor around the reading table
    (function () {
      const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256;
      const rx = rc.getContext('2d');
      rx.strokeStyle = 'rgba(190,150,255,0.7)'; rx.lineWidth = 3;
      rx.beginPath(); rx.arc(128, 128, 108, 0, Math.PI * 2); rx.stroke();
      rx.beginPath(); rx.arc(128, 128, 86, 0, Math.PI * 2); rx.stroke();
      rx.fillStyle = 'rgba(210,180,255,0.85)';
      rx.font = '16px serif'; rx.textAlign = 'center'; rx.textBaseline = 'middle';
      const runes = ['ᚠ', 'ᛒ', 'ᚱ', 'ᛗ', 'ᚹ', 'ᛉ', 'ᚦ', 'ᛟ', 'ᚨ', 'ᛚ', 'ᛞ', 'ᛝ'];
      runes.forEach((rn, i) => {
        const a = i * Math.PI * 2 / runes.length;
        rx.fillText(rn, 128 + Math.cos(a) * 97, 128 + Math.sin(a) * 97);
      });
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(190, 190),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(rc), transparent: true, opacity: 0.9 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx, 1.2, cz - 10);
      scene.add(ring);
    })();
    // Books that never learned to sit still
    [0x6a3a8a, 0x2a5a7a, 0x8a2a3a, 0x3a6a4a].forEach((col, i) => {
      const book = new THREE.Group();
      const cover = new THREE.Mesh(new THREE.BoxGeometry(13, 2.6, 9),
        new THREE.MeshLambertMaterial({ color: col }));
      book.add(cover);
      const pages = new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.6, 7.6),
        new THREE.MeshLambertMaterial({ color: 0xe8e0c8 }));
      pages.position.y = 0.4;
      book.add(pages);
      book.position.set([cx - 60, cx + 55, cx - 20, cx + 90][i],
        62 + (i % 3) * 16, [cz - 55, cz - 70, cz + 60, cz + 40][i]);
      book.rotation.set(0.15 * (i - 1.5), i * 1.3, 0.1 * (i % 2 ? 1 : -1));
      scene.add(book);
    });
    // A crystal ball on the reading table
    const orbGlass = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.55, emissive: 0x4a3a8a, emissiveIntensity: 0.5 }));
    orbGlass.position.set(cx, 40, cz - 10);
    scene.add(orbGlass);
    const orbBase = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
    orbBase.position.set(cx, 31, cz - 10);
    scene.add(orbBase);
    const orbLight = new THREE.PointLight(0xb98aff, 0.8, 140);
    orbLight.position.set(cx, 46, cz - 10);
    scene.add(orbLight);

    // Framed paintings on the south wall (bare — the door's on the west
    // wall, the bookshelves are on the east), facing north into the room.
    [
      { symbol: '👁️', title: 'THE UNBLINKING', subtitle: 'shelf 13 — do not read aloud', x: roomW * 0.3 },
      { symbol: '🌙', title: 'PHASES OF HER', subtitle: 'as above, so below', x: roomW * 0.7 }
    ].forEach(({ symbol, title, subtitle, x }) => {
      const p = makeWallPainting({ symbol, title, subtitle, bg1: '#160f2e', bg2: '#241a42', border: '#8a6ad0', accent: '#d0baff' });
      p.position.set(x, 90, roomD - 4);
      p.rotation.y = Math.PI;
      scene.add(p);
    });

    if (kiosksOut) {
      const scholar = createHumanoid(2).group;
      scholar.position.set(150, 0, 60);
      scholar.rotation.y = Math.atan2(cx - 150, cz - 60);
      scene.add(scholar);
      const scholarLabel = makeNpcNameSprite('Scholar Elior', 'Keeper of Robes');
      scholarLabel.position.set(150, 90, 60);
      scene.add(scholarLabel);
      kiosksOut.push({ x: 150, z: 60, npc: 'npc', npcId: 'npc_scholar', npcName: 'Scholar Elior' });

      const apprentice = createHumanoid(4).group;
      apprentice.position.set(320, 0, 60);
      apprentice.rotation.y = Math.atan2(cx - 320, cz - 60);
      scene.add(apprentice);
      const apprenticeLabel = makeNpcNameSprite('Apprentice Wren', 'Buried in Books');
      apprenticeLabel.position.set(320, 90, 60);
      scene.add(apprenticeLabel);
      kiosksOut.push({ x: 320, z: 60, npc: 'hint', npcId: 'npc_apprentice', npcName: 'Apprentice Wren' });
    }
  } else if (type === 'alchemist') {
    // ── The Starlit Arcade ──────────────────────────────────────────────
    // Witch Hazel's lair's decorating playbook (painted canvas cards on
    // every wall, a glyph ring on the floor, glowing crystals, occult
    // clutter) shifted to cold blue and a celestial symbol set:
    // constellation charts, moon phases, zodiac glyphs, and enchanted
    // relics under glass. The playable cabinets and both NPCs keep their
    // exact positions and kiosk ids — only the dressing changed.

    // A star chart in a silver frame — same canvas technique as the cave's
    // tarot cards: painted background, double border, then a scattering of
    // stars with a constellation line traced through them. Deterministic
    // per-name so charts differ from each other but never between visits.
    const makeStarChart = (glyph, name, seed) => {
      const cw = 96, ch = 128;
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, '#050b1e'); grad.addColorStop(1, '#0b1836');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#8fb0d8'; ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, cw - 8, ch - 8);
      ctx.strokeStyle = '#3a5a8a'; ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, cw - 20, ch - 20);
      for (const [ox, oy] of [[14, 14], [cw - 14, 14], [14, ch - 14], [cw - 14, ch - 14]]) {
        ctx.fillStyle = '#8fb0d8'; ctx.beginPath();
        ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      // Scattered stars + constellation line through the first few
      const pts = [];
      for (let i = 0; i < 14; i++) {
        const px = 20 + (Math.sin(seed * 13.7 + i * 7.3) * 0.5 + 0.5) * (cw - 40);
        const py = 30 + (Math.sin(seed * 5.1 + i * 11.9) * 0.5 + 0.5) * (ch - 70);
        pts.push([px, py]);
        const r = 0.8 + (Math.sin(seed + i * 3.3) * 0.5 + 0.5) * 1.6;
        ctx.fillStyle = `rgba(205,230,255,${0.55 + (i % 3) * 0.15})`;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(140,200,255,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath();
      pts.slice(0, 6).forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
      ctx.stroke();
      // Brighten the constellation's own stars
      for (const [px, py] of pts.slice(0, 6)) {
        ctx.fillStyle = '#e8f4ff';
        ctx.beginPath(); ctx.arc(px, py, 2.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.textAlign = 'center';
      ctx.font = '20px serif'; ctx.fillStyle = '#bfe0ff';
      ctx.fillText(glyph, cw / 2, 28);
      ctx.font = 'bold 8px sans-serif'; ctx.fillStyle = '#8fb0d8';
      ctx.fillText(name, cw / 2, ch - 16);
      const mat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x0d1f4a, emissiveIntensity: 0.55 });
      return new THREE.Mesh(new THREE.PlaneGeometry(62, 84), mat);
    };

    // A moon-phase plaque — silver disc, phase-shadowed, thin ring frame.
    const makeMoonPhase = (phase) => {
      const c = document.createElement('canvas'); c.width = 48; c.height = 48;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0b1836'; ctx.fillRect(0, 0, 48, 48);
      ctx.strokeStyle = '#6f92c8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(24, 24, 21, 0, Math.PI * 2); ctx.stroke();
      if (phase > 0) {
        ctx.fillStyle = '#d8e8ff';
        ctx.beginPath(); ctx.arc(24, 24, 17, 0, Math.PI * 2); ctx.fill();
        if (phase < 4) {
          // Shadow disc slides off to the left as the moon waxes
          ctx.fillStyle = '#0b1836';
          const dx = [-8, -14, -22, -30][phase - 1];
          ctx.beginPath(); ctx.arc(24 + dx, 24, 18, 0, Math.PI * 2); ctx.fill();
        }
      }
      const mat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x0a1a33, emissiveIntensity: 0.6 });
      return new THREE.Mesh(new THREE.PlaneGeometry(26, 26), mat);
    };

    const shardMat = new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x1d5ecc, emissiveIntensity: 0.9 });
    const makeShardCluster = (x, z) => {
      const g = new THREE.Group();
      for (const [ox, oz, r, h] of [[0, 0, 8, 18], [10, 5, 5, 10], [-8, 7, 4, 8], [4, -8, 3, 6]]) {
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), shardMat);
        shard.scale.y = h / (r * 2);
        shard.position.set(ox, h, oz);
        g.add(shard);
      }
      g.position.set(x, 0, z);
      scene.add(g);
    };

    scene.add(makeRug(cx, cz, roomW * 0.5, roomD * 0.35, 0x16244a));

    // Zodiac ring painted on the floor around the cauldron — the cave's
    // rune circle, celestial edition.
    (function() {
      const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256;
      const rx = rc.getContext('2d');
      rx.strokeStyle = 'rgba(110,180,255,0.65)'; rx.lineWidth = 3;
      rx.beginPath(); rx.arc(128, 128, 110, 0, Math.PI * 2); rx.stroke();
      rx.lineWidth = 2;
      rx.beginPath(); rx.arc(128, 128, 86, 0, Math.PI * 2); rx.stroke();
      // Eight-pointed star inside the inner ring
      rx.strokeStyle = 'rgba(140,200,255,0.5)'; rx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const a2 = ((i + 3) / 8) * Math.PI * 2 - Math.PI / 2;
        rx.beginPath();
        rx.moveTo(128 + Math.cos(a) * 86, 128 + Math.sin(a) * 86);
        rx.lineTo(128 + Math.cos(a2) * 86, 128 + Math.sin(a2) * 86);
        rx.stroke();
      }
      // Zodiac glyphs around the ring
      rx.fillStyle = 'rgba(190,225,255,0.85)'; rx.font = '17px serif'; rx.textAlign = 'center';
      const zodiac = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
      zodiac.forEach((zg, i) => {
        const a = (i / zodiac.length) * Math.PI * 2 - Math.PI / 2;
        rx.fillText(zg, 128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98 + 6);
      });
      // Dusting of tiny stars inside the circle
      for (let i = 0; i < 40; i++) {
        const a = Math.sin(i * 12.9) * Math.PI * 2, rr = (Math.sin(i * 7.7) * 0.5 + 0.5) * 78;
        rx.fillStyle = `rgba(190,225,255,${0.25 + (i % 4) * 0.12})`;
        rx.beginPath();
        rx.arc(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr, 0.8 + (i % 3) * 0.5, 0, Math.PI * 2);
        rx.fill();
      }
      const ringTex = new THREE.CanvasTexture(rc);
      const ring = new THREE.Mesh(
        new THREE.PlaneGeometry(250, 250),
        new THREE.MeshLambertMaterial({ map: ringTex, transparent: true, opacity: 0.9 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx, 1, cz + 30);
      scene.add(ring);
    })();

    // The alchemist's old cauldron, now brewing liquid night — cyan glow,
    // cold light, a few sparks hanging over the brew.
    (function() {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(13, 9, 16, 10), new THREE.MeshLambertMaterial({ color: 0x1c1c28 }));
      pot.position.y = 10; g.add(pot);
      const brew = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 2, 10), new THREE.MeshBasicMaterial({ color: 0x4fd8ff }));
      brew.position.y = 18; g.add(brew);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff });
      for (const [sx, sy, sz] of [[-6, 30, 4], [7, 38, -3], [-2, 46, -6]]) {
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(1.7, 0), sparkMat);
        spark.position.set(sx, sy, sz); g.add(spark);
      }
      const light = new THREE.PointLight(0x3fbfff, 1.3, 170);
      light.position.set(0, 30, 0); g.add(light);
      g.position.set(cx, 0, cz + 30);
      scene.add(g);
    })();

    scene.add(makeBanner(cx, 90, 8, 0, 0x4fa8ff));
    scene.add(makeBanner(roomW - 8, 95, 120, Math.PI / 2, 0x4fa8ff));
    scene.add(makeBanner(roomW - 8, 95, 366, Math.PI / 2, 0x4fa8ff));
    makeShardCluster(26, cz);
    makeShardCluster(roomW - 26, 420);

    // Two playable arcade cabinets where the old table used to be — F to
    // play, opening the matching mini-game (see openArcadeGame()).
    if (kiosksOut) {
      const cabZ = cz - 15;
      const cab1X = cx - roomW * 0.2, cab2X = cx + roomW * 0.2;

      scene.add(makeArcadeCabinet(cab1X, cabZ, 0, 0x35ffd0));
      const sign1 = makeSignSprite('🐍 Snake');
      sign1.position.set(cab1X, 92, cabZ);
      scene.add(sign1);
      kiosksOut.push({ id: 'arcade_game_snake', x: cab1X, z: cabZ, game: 'snake' });

      scene.add(makeArcadeCabinet(cab2X, cabZ, 0, 0x4f9dff));
      const sign2 = makeSignSprite('🧱 Breakout');
      sign2.position.set(cab2X, 92, cabZ);
      scene.add(sign2);
      kiosksOut.push({ id: 'arcade_game_breakout', x: cab2X, z: cabZ, game: 'breakout' });

      // ── Symbols and decorations all over the walls ────────────────────
      // North wall: four constellation charts flanking the banner
      [
        { glyph: '♈', name: 'THE RAM',      x: 90 },
        { glyph: '♏', name: 'THE SCORPION', x: 250 },
        { glyph: '♐', name: 'THE ARCHER',   x: 470 },
        { glyph: '♓', name: 'THE FISHES',   x: 630 }
      ].forEach(({ glyph, name, x }, i) => {
        const chart = makeStarChart(glyph, name, i + 1);
        chart.position.set(x, 92, 4);
        scene.add(chart);
      });
      // South wall: three more, facing back into the room
      [
        { glyph: '♌', name: 'THE LION',         x: 140 },
        { glyph: '♒', name: 'THE WATER-BEARER', x: 360 },
        { glyph: '♊', name: 'THE TWINS',        x: 580 }
      ].forEach(({ glyph, name, x }, i) => {
        const chart = makeStarChart(glyph, name, i + 5);
        chart.position.set(x, 92, roomD - 4);
        chart.rotation.y = Math.PI;
        scene.add(chart);
      });
      // East wall: one each side of the door
      [{ glyph: '♑', name: 'THE SEA-GOAT', z: 110 }, { glyph: '♋', name: 'THE CRAB', z: 376 }].forEach(({ glyph, name, z }, i) => {
        const chart = makeStarChart(glyph, name, i + 8);
        chart.position.set(roomW - 4, 92, z);
        chart.rotation.y = -Math.PI / 2;
        scene.add(chart);
      });
      // West wall: the moon's whole cycle, new to full
      [0, 1, 2, 3, 4].forEach((phase, i) => {
        const moon = makeMoonPhase(phase);
        moon.position.set(4, 100, 100 + i * 72);
        moon.rotation.y = Math.PI / 2;
        scene.add(moon);
      });
      // Free-floating glyphs scattered between everything
      [
        ['✶', 170, 122, 6, 0], ['☾', 410, 60, 6, 0], ['☄', 550, 122, 6, 0],
        ['⚝', 250, 125, roomD - 6, Math.PI], ['✷', 470, 125, roomD - 6, Math.PI],
        ['☿', 6, 60, 150, Math.PI / 2], ['✦', 6, 130, 243, Math.PI / 2], ['♄', 6, 60, 340, Math.PI / 2],
        ['☽', roomW - 6, 125, 90, -Math.PI / 2], ['✶', roomW - 6, 125, 400, -Math.PI / 2]
      ].forEach(([glyph, x, y, z, rotY]) => {
        const gl = makeGlowGlyphMesh(glyph, 24);
        gl.position.set(x, y, z);
        gl.rotation.y = rotY;
        scene.add(gl);
      });

      // ── Magical items on display, under glass ─────────────────────────
      // Scrying orb
      (function() {
        const p = makeDisplayPedestal(scene, 90, 120);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 12), new THREE.MeshLambertMaterial({ color: 0x66ccff, emissive: 0x2f7fff, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }));
        orb.position.y = 38; p.add(orb);
        const core = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), new THREE.MeshBasicMaterial({ color: 0xd8f2ff }));
        core.position.y = 38; p.add(core);
        const sign = makeSignSprite('🔮 Scrying Orb');
        sign.position.set(90, 74, 120); scene.add(sign);
      })();
      // Star grimoire — open book hovering above the pedestal
      (function() {
        const p = makeDisplayPedestal(scene, roomW - 90, 120);
        const coverMat = new THREE.MeshLambertMaterial({ color: 0x1a2f5e, emissive: 0x0a1830, emissiveIntensity: 0.5 });
        const pageMat = new THREE.MeshLambertMaterial({ color: 0xe8f0ff, emissive: 0x3355aa, emissiveIntensity: 0.25 });
        for (const s of [-1, 1]) {
          const cover = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 12), coverMat);
          cover.position.set(s * 4.4, 37, 0);
          cover.rotation.z = -s * 0.28;
          p.add(cover);
          const page = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 10.5), pageMat);
          page.position.set(s * 4.1, 37.9, 0);
          page.rotation.z = -s * 0.28;
          p.add(page);
        }
        const sign = makeSignSprite('📖 Star Grimoire');
        sign.position.set(roomW - 90, 74, 120); scene.add(sign);
      })();
      // Starforged blade — upright, point down
      (function() {
        const p = makeDisplayPedestal(scene, 90, 356);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(2.2, 24, 5), new THREE.MeshLambertMaterial({ color: 0xdfeaff, emissive: 0x6f9fe8, emissiveIntensity: 0.5 }));
        blade.position.y = 44; blade.rotation.z = 0.12; p.add(blade);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(9, 2, 3), new THREE.MeshLambertMaterial({ color: 0x2f4a7f }));
        guard.position.set(-0.7, 53.5, 0); guard.rotation.z = 0.12; p.add(guard);
        const pommel = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshLambertMaterial({ color: 0x9fd4ff, emissive: 0x1d5ecc, emissiveIntensity: 0.9 }));
        pommel.position.set(-1.4, 58.5, 0); p.add(pommel);
        const sign = makeSignSprite('🗡️ Starforged Blade');
        sign.position.set(90, 78, 356); scene.add(sign);
      })();
      // Moon relic — a silver crescent with two trailing motes
      (function() {
        const p = makeDisplayPedestal(scene, roomW - 90, 356);
        const moonMat = new THREE.MeshLambertMaterial({ color: 0xe4e9ff, emissive: 0x6a74c8, emissiveIntensity: 0.55 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(5.5, 10, 10), moonMat);
        body.position.y = 40; p.add(body);
        const bite = new THREE.Mesh(new THREE.SphereGeometry(4.6, 10, 10), new THREE.MeshLambertMaterial({ color: 0x070f22 }));
        bite.position.set(2.8, 41.5, 2.2); p.add(bite);
        const m1 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), moonMat);
        m1.position.set(-7, 46, 0); p.add(m1);
        const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 6), moonMat);
        m2.position.set(-4, 50, 2); p.add(m2);
        const sign = makeSignSprite('🌙 Moon Relic');
        sign.position.set(roomW - 90, 78, 356); scene.add(sign);
      })();

      const alchemist = createHumanoid(0).group;
      alchemist.position.set(150, 0, roomD - 90);
      alchemist.rotation.y = Math.atan2(cx - 150, cz - (roomD - 90));
      scene.add(alchemist);
      const alchemistLabel = makeNpcNameSprite('Apothecary Vex', 'Brews & Tonics');
      alchemistLabel.position.set(150, 90, roomD - 90);
      scene.add(alchemistLabel);
      kiosksOut.push({ x: 150, z: roomD - 90, npc: 'npc', npcId: 'npc_apothecary', npcName: 'Apothecary Vex' });

      const tinkerer = createHumanoid(4).group;
      tinkerer.position.set(roomW - 150, 0, roomD - 90);
      tinkerer.rotation.y = Math.atan2(cx - (roomW - 150), cz - (roomD - 90));
      scene.add(tinkerer);
      const tinkererLabel = makeNpcNameSprite('Tinkerer Oswin', 'Fiddles With Everything');
      tinkererLabel.position.set(roomW - 150, 90, roomD - 90);
      scene.add(tinkererLabel);
      kiosksOut.push({ x: roomW - 150, z: roomD - 90, npc: 'hint', npcId: 'npc_tinkerer', npcName: 'Tinkerer Oswin' });
    }
  } else if (type === 'parlor') {
    // ── The Phantom Parlor (ex-Rooftop Lounge) ──────────────────────────
    // Third room of the witchy trilogy — the cave is purple, the Starlight
    // Arcade blue, and this séance parlor ghost-green. Same decorating
    // playbook (painted canvas cards, a glyph ring on the floor, glowing
    // occult clutter, relics under glass), haunted-house symbol set: a
    // portrait gallery of the departed, drifting spirit wisps (see the
    // 'wisp' lightsStyle in getInteriorScene), witchfire in the hearth.
    // The two-story STRUCTURE is untouched: ground floor west, staircase,
    // terrace east — every dining seat and both NPCs keep their exact
    // positions and kiosk ids.
    const stairStart = roomW * LOUNGE_STAIR_START_FRAC;
    const groundCx = stairStart / 2;

    // A haunted portrait — the tarot-card technique grown up: ornate
    // silver-green frame, a pale hooded spirit painted inside, a memorial
    // plaque line. Each sitter gets their own hunch via the seed.
    const makeHauntedPortrait = (name, epitaph, seed) => {
      const cw = 96, ch = 128;
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, ch);
      grad.addColorStop(0, '#04120c'); grad.addColorStop(1, '#0a241a');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#7fc9a0'; ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, cw - 8, ch - 8);
      ctx.strokeStyle = '#2e5a44'; ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, cw - 20, ch - 20);
      for (const [ox, oy] of [[14, 14], [cw - 14, 14], [14, ch - 14], [cw - 14, ch - 14]]) {
        ctx.fillStyle = '#7fc9a0'; ctx.beginPath();
        ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      // The sitter: a translucent hooded figure, softly glowing, slightly
      // off-center and tilted per portrait so the gallery feels peopled.
      const px = cw / 2 + Math.sin(seed * 7.3) * 6;
      const tilt = Math.sin(seed * 3.1) * 0.18;
      ctx.save();
      ctx.translate(px, 62); ctx.rotate(tilt);
      ctx.shadowColor = '#8fffbe'; ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(190,255,220,0.5)';
      ctx.beginPath(); // hood + shoulders
      ctx.arc(0, -14, 13, Math.PI, 0);
      ctx.quadraticCurveTo(17, 8, 13, 26);
      // trailing wisp hem
      ctx.quadraticCurveTo(8, 20, 4, 28);
      ctx.quadraticCurveTo(0, 20, -4, 28);
      ctx.quadraticCurveTo(-8, 20, -13, 26);
      ctx.quadraticCurveTo(-17, 8, -13, -14);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(6,20,14,0.9)'; // the dark under the hood
      ctx.beginPath(); ctx.arc(0, -12, 8.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8ffd8'; // two faint eyes
      ctx.beginPath(); ctx.arc(-3, -13, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3, -13, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.font = 'bold 8px sans-serif'; ctx.fillStyle = '#7fc9a0';
      ctx.fillText(name, cw / 2, ch - 24);
      ctx.font = 'italic 6.5px serif'; ctx.fillStyle = '#5a9a78';
      ctx.fillText(epitaph, cw / 2, ch - 14);
      const mat = new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c), emissive: 0x0c2418, emissiveIntensity: 0.55 });
      return new THREE.Mesh(new THREE.PlaneGeometry(62, 84), mat);
    };

    // Ghost-green display pedestal shorthand
    const PARLOR_PED = { stone: 0x24463a, cap: 0x2e5a48, dome: 0xbfffe0, light: 0x5fe8a0 };

    // Séance rug + circle where the old parlor rug lay
    scene.add(makeRug(groundCx, roomD * 0.42, stairStart * 0.5, roomD * 0.4, 0x14332a));
    (function() {
      const rc = document.createElement('canvas'); rc.width = 256; rc.height = 256;
      const rx = rc.getContext('2d');
      rx.strokeStyle = 'rgba(120,255,180,0.6)'; rx.lineWidth = 3;
      rx.beginPath(); rx.arc(128, 128, 110, 0, Math.PI * 2); rx.stroke();
      rx.lineWidth = 2;
      rx.beginPath(); rx.arc(128, 128, 84, 0, Math.PI * 2); rx.stroke();
      // Candle marks around the outer ring — every other one "lit"
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        rx.fillStyle = i % 2 ? 'rgba(150,255,200,0.85)' : 'rgba(90,160,125,0.5)';
        rx.beginPath();
        rx.arc(128 + Math.cos(a) * 97, 128 + Math.sin(a) * 97, i % 2 ? 3.4 : 2.2, 0, Math.PI * 2);
        rx.fill();
      }
      // Spirit-board furniture: YES / NO across the middle ring, a moon and
      // sun mark, and a planchette outline resting dead center.
      rx.fillStyle = 'rgba(190,255,220,0.8)'; rx.textAlign = 'center';
      rx.font = 'bold 15px serif';
      rx.fillText('YES', 66, 134);
      rx.fillText('NO', 190, 134);
      rx.font = '16px serif';
      rx.fillText('☾', 128, 70);
      rx.fillText('✶', 128, 200);
      rx.strokeStyle = 'rgba(170,255,210,0.75)'; rx.lineWidth = 2;
      rx.beginPath(); // teardrop planchette
      rx.moveTo(128, 104);
      rx.quadraticCurveTo(152, 122, 128, 152);
      rx.quadraticCurveTo(104, 122, 128, 104);
      rx.closePath(); rx.stroke();
      rx.beginPath(); rx.arc(128, 126, 7, 0, Math.PI * 2); rx.stroke();
      const tex = new THREE.CanvasTexture(rc);
      const ring = new THREE.Mesh(
        new THREE.PlaneGeometry(230, 230),
        new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.9 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(groundCx, 1.2, roomD * 0.42);
      scene.add(ring);
    })();

    // The hearth, now burning witchfire — same footprint as the old
    // fireplace, green flame, cold green light, embers drifting up.
    (function() {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(50, 60, 18), new THREE.MeshLambertMaterial({ color: 0x2e4438 }));
      body.position.y = 30; g.add(body);
      const hole = new THREE.Mesh(new THREE.BoxGeometry(30, 34, 10), new THREE.MeshBasicMaterial({ color: 0x49ff9e }));
      hole.position.set(0, 20, 2); g.add(hole);
      const emberMat = new THREE.MeshBasicMaterial({ color: 0xb8ffd8 });
      for (const [ex, ey, ez, er] of [[-8, 66, 6, 1.8], [5, 74, 4, 1.3], [0, 82, 6, 0.9]]) {
        const ember = new THREE.Mesh(new THREE.SphereGeometry(er, 6, 6), emberMat);
        ember.position.set(ex, ey, ez); g.add(ember);
      }
      const glow = new THREE.PointLight(0x3fe88a, 1.2, 260);
      glow.position.set(0, 24, 12); g.add(glow);
      g.position.set(groundCx, 0, 14); g.rotation.y = Math.PI;
      scene.add(g);
    })();

    scene.add(makeBench(groundCx - 40, roomD * 0.7, Math.PI / 2));
    scene.add(makeBench(groundCx + 40, roomD * 0.7, -Math.PI / 2));
    scene.add(makeTable(groundCx, roomD * 0.7));
    scene.add(makeBanner(30, 90, 8, 0, 0x54e8a8));
    scene.add(makeBanner(stairStart - 30, 90, 8, 0, 0x54e8a8));

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

    // ── The portrait gallery of the departed, all over the walls ────────
    const PORTRAITS = [
      { name: 'LADY MIRTHWOOD', epitaph: 'departed 1802', x: 120, z: 4, rotY: 0 },
      { name: 'THE GREY EARL', epitaph: 'never left', x: 300, z: 4, rotY: 0 },
      { name: 'SISTER OPALINE', epitaph: 'still humming', x: 480, z: 4, rotY: 0 },
      { name: 'MASTER HOLLOWAY', epitaph: 'plays at midnight', x: 120, z: roomD - 4, rotY: Math.PI },
      { name: 'THE TWINS', epitaph: 'they watch the stairs', x: 300, z: roomD - 4, rotY: Math.PI },
      { name: 'UNKNOWN GUEST', epitaph: 'checked in forever', x: 480, z: roomD - 4, rotY: Math.PI }
    ];
    PORTRAITS.forEach(({ name, epitaph, x, z, rotY }, i) => {
      const p = makeHauntedPortrait(name, epitaph, i + 1);
      p.position.set(x, 92, z);
      p.rotation.y = rotY;
      scene.add(p);
    });
    // Two more watch over the terrace from the east wall
    [
      { name: 'THE WIDOW', epitaph: 'she keeps the watch', z: 200 },
      { name: 'CAPTAIN VANE', epitaph: 'lost at moonrise', z: 300 }
    ].forEach(({ name, epitaph, z }, i) => {
      const p = makeHauntedPortrait(name, epitaph, i + 7);
      p.position.set(roomW - 4, LOUNGE_PLATFORM_HEIGHT + 70, z);
      p.rotation.y = -Math.PI / 2;
      scene.add(p);
    });

    // Free-floating glyphs between the portraits, ghost-green
    [
      ['☾', 210, 125, 6, 0], ['🕯️', 390, 60, 6, 0],
      ['✧', 210, 128, roomD - 6, Math.PI], ['👻', 390, 128, roomD - 6, Math.PI],
      ['✦', 6, 120, 120, Math.PI / 2], ['☽', 6, 120, 366, Math.PI / 2],
      ['✶', 730, 125, roomD - 6, Math.PI], ['🕯️', roomW - 6, LOUNGE_PLATFORM_HEIGHT + 74, 245, -Math.PI / 2]
    ].forEach(([glyph, x, y, z, rotY]) => {
      const gl = makeGlowGlyphMesh(glyph, 24, '#5fffae', '#d8ffe8');
      gl.position.set(x, y, z);
      gl.rotation.y = rotY;
      scene.add(gl);
    });

    // ── Haunted relics on display, under glass ──────────────────────────
    // Phantom lantern — an iron cage holding a flame that never was
    (function() {
      const p = makeDisplayPedestal(scene, 150, 250, PARLOR_PED);
      const iron = new THREE.MeshLambertMaterial({ color: 0x1a2420 });
      const bot = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 1.6, 8), iron);
      bot.position.y = 33; p.add(bot);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6, 1.6, 8), iron);
      top.position.y = 48; p.add(top);
      for (let i = 0; i < 4; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 5), iron);
        post.position.set(Math.cos(i * Math.PI / 2) * 5.2, 40.5, Math.sin(i * Math.PI / 2) * 5.2);
        p.add(post);
      }
      const flame = new THREE.Mesh(new THREE.SphereGeometry(3.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0x6fffb0 }));
      flame.scale.y = 1.5; flame.position.y = 40.5; p.add(flame);
      const sign = makeSignSprite('🕯️ Phantom Lantern');
      sign.position.set(150, 74, 250); scene.add(sign);
    })();
    // Spirit bell — rings by itself, allegedly
    (function() {
      const p = makeDisplayPedestal(scene, groundCx, 95, PARLOR_PED);
      const bellMat = new THREE.MeshLambertMaterial({ color: 0xcfe8dc, emissive: 0x2e5a48, emissiveIntensity: 0.35 });
      const bell = new THREE.Mesh(new THREE.ConeGeometry(6.5, 11, 10), bellMat);
      bell.position.y = 41; p.add(bell);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6), bellMat);
      knob.position.y = 47.5; p.add(knob);
      const clapper = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 6), new THREE.MeshLambertMaterial({ color: 0x1a2420 }));
      clapper.position.set(1.2, 35, 0); p.add(clapper);
      const sign = makeSignSprite('🔔 Spirit Bell');
      sign.position.set(groundCx, 74, 95); scene.add(sign);
    })();
    // Bound spirit — a jar nobody should open
    (function() {
      const p = makeDisplayPedestal(scene, 520, 250, PARLOR_PED);
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.5, 13, 9), new THREE.MeshLambertMaterial({ color: 0x9fd8c0, transparent: true, opacity: 0.35 }));
      jar.position.y = 40; p.add(jar);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 2, 9), new THREE.MeshLambertMaterial({ color: 0x1a2420 }));
      lid.position.y = 47.5; p.add(lid);
      const wisp = new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 8), new THREE.MeshBasicMaterial({ color: 0x8fffbe }));
      wisp.position.set(-1, 39, 0.5); p.add(wisp);
      const mote = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xd8ffe8 }));
      mote.position.set(2, 43, -1); p.add(mote);
      const sign = makeSignSprite('🫙 Bound Spirit');
      sign.position.set(520, 74, 250); scene.add(sign);
    })();
    // Séance planchette — up on the Widow's Watch
    (function() {
      const px = stairEnd + platformWidth * 0.5, pz = roomD * 0.22;
      const p = makeDisplayPedestal(scene, px, pz, { ...PARLOR_PED, baseY: LOUNGE_PLATFORM_HEIGHT });
      const board = new THREE.Mesh(new THREE.BoxGeometry(13, 1.8, 17), new THREE.MeshLambertMaterial({ color: 0x2e4a3e }));
      board.position.y = 36; board.rotation.y = 0.5; p.add(board);
      const window_ = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2.2, 10), new THREE.MeshLambertMaterial({ color: 0xbfffe0, transparent: true, opacity: 0.6 }));
      window_.position.set(0, 36.6, 2); window_.rotation.y = 0.5; p.add(window_);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 6), new THREE.MeshLambertMaterial({ color: 0x2e4a3e }));
      tip.position.set(-2.6, 36.6, -7.2); tip.rotation.z = Math.PI / 2; tip.rotation.y = 0.5; p.add(tip);
      const sign = makeSignSprite('🔮 Séance Planchette');
      sign.position.set(px, LOUNGE_PLATFORM_HEIGHT + 74, pz); scene.add(sign);
    })();

    if (kiosksOut) {
      const tailor = createHumanoid(2).group;
      tailor.position.set(80, 0, roomD * 0.25);
      tailor.rotation.y = Math.atan2(groundCx - 80, roomD * 0.42 - roomD * 0.25);
      scene.add(tailor);
      const tailorLabel = makeNpcNameSprite('Tailor Ines', 'Fine Wearables');
      tailorLabel.position.set(80, 90, roomD * 0.25);
      scene.add(tailorLabel);
      kiosksOut.push({ x: 80, z: roomD * 0.25, npc: 'npc', npcId: 'npc_tailor', npcName: 'Tailor Ines' });

      const noble = createHumanoid(3).group;
      noble.position.set(stairStart - 60, 0, roomD * 0.25);
      noble.rotation.y = Math.atan2(groundCx - (stairStart - 60), roomD * 0.42 - roomD * 0.25);
      scene.add(noble);
      const nobleLabel = makeNpcNameSprite('Lady Corwin', 'Loves to Gossip');
      nobleLabel.position.set(stairStart - 60, 90, roomD * 0.25);
      scene.add(nobleLabel);
      kiosksOut.push({ x: stairStart - 60, z: roomD * 0.25, npc: 'hint', npcId: 'npc_noble', npcName: 'Lady Corwin' });
    }
  } else if (type === 'greathall') {
    scene.add(makeRug(cx, cz, roomW * 0.6, roomD * 0.6, 0x5c1f2a));
    scene.add(makeThrone(cx, 30, 0));
    scene.add(makeTable(cx, cz + 15));
    scene.add(makeBench(cx - 26, cz + 30, 0));
    scene.add(makeBench(cx + 26, cz + 30, 0));
    scene.add(makeBanner(20, 95, 6, 0, 0xd84a5a));
    scene.add(makeBanner(roomW - 20, 95, 6, 0, 0xd84a5a));

    // ── Witchy dressing: the Coven Court ──
    // A great pentacle inlaid in the floor, the council table set upon it
    (function () {
      const pc = document.createElement('canvas'); pc.width = 256; pc.height = 256;
      const px = pc.getContext('2d');
      px.strokeStyle = 'rgba(255,140,120,0.8)'; px.lineWidth = 4;
      px.beginPath(); px.arc(128, 128, 112, 0, Math.PI * 2); px.stroke();
      px.lineWidth = 3;
      px.beginPath();
      [0, 2, 4, 1, 3].forEach((k, i) => {
        const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
        const sx2 = 128 + Math.cos(a) * 112, sy2 = 128 + Math.sin(a) * 112;
        i === 0 ? px.moveTo(sx2, sy2) : px.lineTo(sx2, sy2);
      });
      px.closePath(); px.stroke();
      const inlay = new THREE.Mesh(new THREE.PlaneGeometry(230, 230),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pc), transparent: true, opacity: 0.85 }));
      inlay.rotation.x = -Math.PI / 2;
      inlay.position.set(cx, 1.2, cz + 40);
      scene.add(inlay);
    })();
    // Thirteen candles ring the pentacle — three burn, as tradition demands
    for (let i = 0; i < 13; i++) {
      const a = i * Math.PI * 2 / 13;
      const cxp = cx + Math.cos(a) * 128, czp = cz + 40 + Math.sin(a) * 128;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 10 + (i % 3) * 3, 6),
        new THREE.MeshLambertMaterial({ color: 0xe8dcc8 }));
      candle.position.set(cxp, 5 + (i % 3) * 1.5, czp);
      scene.add(candle);
      if (i % 4 === 0) {
        const fl = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
        fl.scale.y = 1.8;
        fl.position.set(cxp, 12 + (i % 3) * 3, czp);
        scene.add(fl);
      }
    }

    // Framed paintings on the west/east walls, clear of the throne/table.
    [
      { symbol: '🌙', title: 'THE FIRST COVEN', subtitle: 'thirteen chairs, one empty', x: 4, rotY: Math.PI / 2 },
      { symbol: '🕯️', title: 'THE ACCORD', subtitle: 'signed thrice, in wax', x: roomW - 4, rotY: -Math.PI / 2 }
    ].forEach(({ symbol, title, subtitle, x, rotY }) => {
      const p = makeWallPainting({ symbol, title, subtitle, bg1: '#2a1218', bg2: '#3c1a22', border: '#c8506a', accent: '#ffb9c8' });
      p.position.set(x, 90, cz);
      p.rotation.y = rotY;
      scene.add(p);
    });

    if (kiosksOut) {
      const armorer = createHumanoid(1).group;
      armorer.position.set(150, 0, roomD * 0.4);
      armorer.rotation.y = Math.atan2(cx - 150, cz - roomD * 0.4);
      scene.add(armorer);
      const armorerLabel = makeNpcNameSprite('Armorer Beck', 'Steel & Shields');
      armorerLabel.position.set(150, 90, roomD * 0.4);
      scene.add(armorerLabel);
      kiosksOut.push({ x: 150, z: roomD * 0.4, npc: 'npc', npcId: 'npc_armorer', npcName: 'Armorer Beck' });

      const knight = createHumanoid(3).group;
      knight.position.set(roomW - 150, 0, roomD * 0.4);
      knight.rotation.y = Math.atan2(cx - (roomW - 150), cz - roomD * 0.4);
      scene.add(knight);
      const knightLabel = makeNpcNameSprite('Sir Dorran', 'Hall Guard');
      knightLabel.position.set(roomW - 150, 90, roomD * 0.4);
      scene.add(knightLabel);
      kiosksOut.push({ x: roomW - 150, z: roomD * 0.4, npc: 'hint', npcId: 'npc_knight', npcName: 'Sir Dorran' });
    }
  } else { // bank — door is north, so "deeper into the room" means higher z
    scene.add(makeRug(cx, roomD * 0.38, roomW * 0.32, roomD * 0.5, 0x7a1f1f));
    scene.add(makeBanner(30, 100, 6, 0, 0xd4af37));
    scene.add(makeBanner(roomW - 30, 100, 6, 0, 0xd4af37));

    // The vault door used to just sit flush and closed on the back wall —
    // now it's swung open on a hinge at its left edge, revealing a
    // recessed treasure chamber behind it. The chamber itself sits just in
    // front of the room's actual back wall (not cut through it — this
    // interior is a flat solid slab like every other room's walls), so the
    // "depth" is an illusion of darker recessed panels rather than a real
    // hole, same trick as everything else stylized in this scene.
    const vaultHingeX = cx - 70;
    const vaultHinge = new THREE.Group();
    vaultHinge.position.set(vaultHingeX, 0, roomD - 10);
    // Positive, not negative: this swings the door out toward -Z (into the
    // room, where the player actually is) instead of +Z, which sends it
    // behind the room's own solid back wall — completely hidden from
    // inside, which is exactly why it looked like nothing happened.
    //
    // Angle: 1.1 rad swung a 70-unit-radius disc so far that its center
    // landed at z=1007.6 in this room — *behind* the treasure chamber's
    // own back panel (z~1021), meaning the door flew straight past its
    // own alcove and out into the open room, fully detached from its
    // frame. That's what read as "backwards"/wrong. 0.45 rad keeps it
    // near its frame (lands around z=1039.6, well inside the chamber's
    // depth) while still clearly standing ajar.
    vaultHinge.rotation.y = 0.45;
    const vault = new THREE.Mesh(
      new THREE.CylinderGeometry(70, 70, 8, 24),
      new THREE.MeshLambertMaterial({ color: 0x6b6b6b })
    );
    vault.rotation.x = Math.PI / 2;
    vault.position.set(70, 95, 0);
    vaultHinge.add(vault);
    const vaultHub = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 16, 12, 12),
      new THREE.MeshLambertMaterial({ color: 0xd4af37 })
    );
    vaultHub.rotation.x = Math.PI / 2;
    vaultHub.position.set(70, 95, 4);
    vaultHinge.add(vaultHub);
    scene.add(vaultHinge);

    // Recessed treasure chamber — dark panels framing the opening, filled
    // with coin piles, gold bars, gems, and a couple of chests, lit by a
    // warm glow so it actually reads as "full of treasure" rather than
    // just a dark box.
    const chamberMat = new THREE.MeshLambertMaterial({ color: 0x241f16 });
    const chamberW = 150, chamberH = 130, chamberD = 55;
    const chamberBack = new THREE.Mesh(new THREE.BoxGeometry(chamberW, chamberH, 8), chamberMat);
    chamberBack.position.set(cx, chamberH / 2 + 10, roomD - chamberD - 4);
    scene.add(chamberBack);
    const chamberSideL = new THREE.Mesh(new THREE.BoxGeometry(8, chamberH, chamberD), chamberMat);
    chamberSideL.position.set(cx - chamberW / 2, chamberH / 2 + 10, roomD - chamberD / 2 - 8);
    scene.add(chamberSideL);
    const chamberSideR = new THREE.Mesh(new THREE.BoxGeometry(8, chamberH, chamberD), chamberMat);
    chamberSideR.position.set(cx + chamberW / 2, chamberH / 2 + 10, roomD - chamberD / 2 - 8);
    scene.add(chamberSideR);
    const chamberTop = new THREE.Mesh(new THREE.BoxGeometry(chamberW, 8, chamberD), chamberMat);
    chamberTop.position.set(cx, chamberH + 10, roomD - chamberD / 2 - 8);
    scene.add(chamberTop);

    const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4af37, emissive: 0x4a3a10, emissiveIntensity: 0.4 });
    // Coin piles: a few short wide cylinders stacked slightly askew
    for (const [px, pz] of [[cx - 45, roomD - 20], [cx - 10, roomD - 15], [cx + 35, roomD - 22]]) {
      for (let i = 0; i < 3; i++) {
        const r = 20 - i * 3;
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 4, 14), goldMat);
        coin.position.set(px + (Math.random() - 0.5) * 4, 10 + i * 5, pz + (Math.random() - 0.5) * 4);
        coin.rotation.z = (Math.random() - 0.5) * 0.12;
        scene.add(coin);
      }
    }
    // Gold bars
    for (const [px, pz, rotY] of [[cx + 15, roomD - 35, 0.3], [cx - 25, roomD - 40, -0.4]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 11), goldMat);
      bar.position.set(px, 15, pz);
      bar.rotation.y = rotY;
      scene.add(bar);
    }
    // Loose gems — small colored octahedrons scattered among the coins
    const gemColors = [0xff3355, 0x33ccff, 0x66ff66, 0xcc66ff];
    for (let i = 0; i < 8; i++) {
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(4 + Math.random() * 2),
        new THREE.MeshLambertMaterial({ color: gemColors[i % gemColors.length], emissive: gemColors[i % gemColors.length], emissiveIntensity: 0.35 })
      );
      gem.position.set(cx + (Math.random() - 0.5) * 110, 8 + Math.random() * 20, roomD - 15 - Math.random() * 30);
      scene.add(gem);
    }
    // Two open treasure chests flanking the coin piles
    for (const [px, rotY] of [[cx - 60, 0.3], [cx + 60, -0.3]]) {
      const chest = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 20), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
      body.position.y = 8;
      chest.add(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(28, 10, 20), new THREE.MeshLambertMaterial({ color: 0x4a3320 }));
      lid.position.set(0, 18, -8);
      lid.rotation.x = -1.1; // propped open
      chest.add(lid);
      const spill = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 3, 12), goldMat);
      spill.position.y = 17;
      chest.add(spill);
      chest.position.set(px, 0, roomD - 30);
      chest.rotation.y = rotY;
      scene.add(chest);
    }
    // Warm glow from within the vault
    const vaultGlow = new THREE.PointLight(0xffcc66, 1.3, 220);
    vaultGlow.position.set(cx, 60, roomD - 30);
    scene.add(vaultGlow);

    // ── Witchy dressing: the Gilded Vault ──
    // The Auditor — a raven on a marble perch, watching every transaction
    const perch = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 42, 8),
      new THREE.MeshLambertMaterial({ color: 0x8a8a92 }));
    perch.position.set(roomW - 60, 21, roomD * 0.2);
    scene.add(perch);
    const raven = new THREE.Group();
    const ravenMat = new THREE.MeshLambertMaterial({ color: 0x0c0c12 });
    const rBody = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), ravenMat);
    rBody.scale.set(1, 0.9, 1.4);
    raven.add(rBody);
    const rHead = new THREE.Mesh(new THREE.SphereGeometry(4.2, 8, 8), ravenMat);
    rHead.position.set(0, 6.5, 6);
    raven.add(rHead);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 5),
      new THREE.MeshLambertMaterial({ color: 0x3a3a42 }));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 6, 11);
    raven.add(beak);
    const rTail = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10), ravenMat);
    rTail.position.set(0, 1, -10);
    rTail.rotation.x = -0.25;
    raven.add(rTail);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffd43b }));
      eye.position.set(2.2 * s, 7.5, 8.5);
      raven.add(eye);
    }
    raven.position.set(roomW - 60, 46, roomD * 0.2);
    raven.rotation.y = -Math.PI / 4;
    scene.add(raven);

    // The treasure chamber above is just a recessed alcove (a peek from
    // outside) — this kiosk is what actually lets the player walk into a
    // full separate vault room (see enterVault()/buildVaultScene()). Sits
    // well clear of the back wall's collision (which the player can't get
    // right up against anyway) rather than right at the door itself, and
    // uses a generous radius, so reachability doesn't depend on getting
    // the exact wall-collision math pixel-perfect.
    if (kiosksOut) {
      // roomD - 60 (used previously) sat at almost the exact same depth as
      // the chamber's own back panel (z~1021 vs the panel's z~1021) —
      // right at the recessed alcove, not clearly in the open room, and
      // close enough to the back wall's own collision that reachability
      // wasn't obvious. roomD*0.75 sits well clear of both the wall/
      // chamber and the service counters (stationZ = roomD*0.58) —
      // unambiguously open floor, no wall-collision math to get right.
      kiosksOut.push({ x: cx, z: roomD * 0.75, portal: 'vault_enter', radius: 140 });
    }

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

      // Framed paintings on the east wall, between the entrance and the
      // service counters.
      [
        { symbol: '💰', title: 'THE FIRST DEPOSIT', subtitle: 'do not ask whose' },
        { symbol: '🐦‍⬛', title: 'THE AUDITOR', subtitle: 'sees every ledger' }
      ].forEach(({ symbol, title, subtitle }, i) => {
        const p = makeWallPainting({ symbol, title, subtitle, bg1: '#2a2418', bg2: '#3a3220', border: '#d4af37', accent: '#e8d9a0' });
        p.position.set(roomW - 4, 90, roomD * (i === 0 ? 0.32 : 0.46));
        p.rotation.y = -Math.PI / 2;
        scene.add(p);
      });

      // The bank's "shop" is already the teller/auctioneer above — this one
      // just gives quest hints, same as every other building's hint-NPC.
      const guard = createHumanoid(1).group;
      guard.position.set(150, 0, 150);
      guard.rotation.y = Math.atan2(cx - 150, roomD * 0.38 - 150);
      scene.add(guard);
      const guardLabel = makeNpcNameSprite('Guard Petra', 'Keeps Watch');
      guardLabel.position.set(150, 90, 150);
      scene.add(guardLabel);
      kiosksOut.push({ x: 150, z: 150, npc: 'hint', npcId: 'npc_guard', npcName: 'Guard Petra' });
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

// presetOverride lets a caller supply a full custom {skin,hair,hairStyle,
// eye,shirt,pants} object instead of looking one up by charId — used for
// the Ember Wastes' hostile mobs, which need their own menacing color
// schemes rather than looking like one of the 5 playable characters.
function createHumanoidClassic(charId, presetOverride) {
  const preset = presetOverride || CHARACTER_PRESETS[charId] || CHARACTER_PRESETS[0];
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

// Tier-3 dispatcher: KayKit model when loaded, classic build otherwise.
// presetOverride callers (Ember Wastes mobs with custom palettes) always
// get the classic builder — their look is bespoke by design.
function createHumanoid(charId, presetOverride) {
  if (presetOverride || !KK.charReady(charId)) return createHumanoidClassic(charId, presetOverride);
  return createKayKitHumanoid(charId);
}

function createKayKitHumanoid(charId) {
  const preset = CHARACTER_PRESETS[charId] || CHARACTER_PRESETS[0];
  const t = KK.models[KK.charKey(charId)];
  const inst = THREE.SkeletonUtils.clone(t.scene);
  const s = 68 / t.size.y;
  inst.scale.setScalar(s);
  const group = new THREE.Group();
  group.add(inst);

  // curate the embedded hand props for this class
  const keep = KK.KEEP[charId] || [];
  const embeddedWeapons = [];
  inst.traverse(o => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (KK.PROP_MESHES.includes(o.name)) {
      o.visible = keep.includes(o.name);
      if (o.visible && KK.WEAPONISH.includes(o.name)) embeddedWeapons.push(o);
    }
    // the Mage's full hat brim fills the whole behind-the-shoulder camera
    // view — trim it so the witch's body stays visible
    if (o.name === 'Mage_Hat') { o.scale.multiplyScalar(0.8); o.position.y -= 0.03; }
  });

  // animation rig
  const mixer = new THREE.AnimationMixer(inst);
  KK.mixers.add(mixer);
  const actions = {};
  function act(name) {
    if (actions[name] !== undefined) return actions[name];
    const clip = t.animations.find(a => a.name === name) || null;
    actions[name] = clip ? mixer.clipAction(clip) : null;
    return actions[name];
  }
  const kk = {
    mixer, act, inst, baseScale: s, cur: null, busyUntil: 0, lastAttackAt: null,
    embeddedWeapons,
    handR: inst.getObjectByName('handslotr') || null,
    handL: inst.getObjectByName('handslotl') || null,
    headBone: inst.getObjectByName('head') || null,
    footL: inst.getObjectByName('footl') || null,
    footR: inst.getObjectByName('footr') || null,
    slots: {},
    setEmbeddedWeaponsVisible(vis) { for (const m of embeddedWeapons) m.visible = vis; }
  };
  kkSetState(kk, 'Idle');

  // Contract dummies: classic animation code (gated off for kk visuals)
  // and any stray callers still get groups at the classic pivot spots.
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-12, CHAR.shoulderY - 1, 0); armR.position.set(12, CHAR.shoulderY - 1, 0);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-5.5, CHAR.hipY, 0); legR.position.set(5.5, CHAR.hipY, 0);
  const torso = new THREE.Group(); torso.position.set(0, CHAR.hipY + 17, 0);
  const head = new THREE.Group(); head.position.set(0, CHAR.headY, 0);
  group.add(armL, armR, legL, legR, torso, head);

  return { group, armL, armR, legL, legR, torso, head, baseShirtColor: preset.shirt, kk };
}

// crossfade helper — `pose` clips hold their final frame
function kkSetState(kk, name) {
  if (kk.cur === name) return;
  const next = kk.act(name);
  if (!next) return;
  const prev = kk.cur ? kk.act(kk.cur) : null;
  next.reset();
  if (/Pose$|^Death/.test(name)) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; }
  next.fadeIn(0.16).play();
  if (prev) prev.fadeOut(0.16);
  kk.cur = name;
}

function kkOneShot(kk, name, opts) {
  const a = kk.act(name);
  if (!a) return;
  const cur = kk.cur ? kk.act(kk.cur) : null;
  a.reset().setLoop(THREE.LoopOnce, 1);
  a.clampWhenFinished = false;
  const scale = (opts && opts.timeScale) || 1.4;
  a.timeScale = scale;
  a.fadeIn(0.06).play();
  if (cur) cur.fadeOut(0.08);
  kk.cur = null; // force the state machine to re-blend after the one-shot
  kk.busyUntil = performance.now() + (a.getClip().duration / scale) * 1000 * 0.82;
}

// map the game's attack types onto class-flavored KayKit clips
function kkAttackClip(type, charId) {
  if (type === 'cast') return 'Spellcast_Shoot';
  if (type === 'slash') return charId === 0 ? '2H_Melee_Attack_Slice' : '1H_Melee_Attack_Slice_Diagonal';
  if (charId === 4) return '1H_Melee_Attack_Stab';        // wanderer's knife jab
  if (charId === 2) return 'Spellcast_Shoot';             // mystic strikes with magic
  return 'Unarmed_Melee_Attack_Punch_A';
}

// per-frame driver for a kk player visual (called from syncVisuals)
function kkDrivePlayer(v, p, id, dt, isMoving, moveDist) {
  const kk = v.kk;
  const now = performance.now();
  // attack one-shots ride on the same attackAnimStartAt contract
  if (v.attackAnimStartAt && kk.lastAttackAt !== v.attackAnimStartAt) {
    kk.lastAttackAt = v.attackAnimStartAt;
    kkOneShot(kk, kkAttackClip(v.attackAnimType, p.charId || 0));
  }
  if (v.attackAnimStartAt && now - v.attackAnimStartAt > 450) v.attackAnimStartAt = null;
  if (now < kk.busyUntil) return;
  let want = 'Idle';
  const isDead = (id === myId) ? !!(me && me.isDead) : !!p.isDead;
  if (isDead) want = 'Death_A_Pose';
  else if (id === myId && seatedAt) want = 'Sit_Chair_Idle';
  else if (v.statusType === 'meditate') want = 'Sit_Floor_Idle';
  else if (isMoving) {
    const spd = moveDist / Math.max(dt, 1e-4);
    want = spd > 200 ? 'Running_A' : 'Walking_A';
    const a = kk.act(want);
    if (a) a.timeScale = Math.max(0.7, Math.min(1.7, spd / 170));
  }
  kkSetState(kk, want);
  // classic walk-bob is baked into the clips; ease any leftover offset out
  v.group.position.y += (0 - v.group.position.y) * Math.min(1, dt * 8);
}

// One generic blade for any equipped weapon and one generic chest overlay
// for any equipped armor — not a unique model per item. With only two
// equip slots and items otherwise differing just by name/icon, a per-item
// 3D model isn't worth the cost here; what matters for gameplay/visual
// feedback is just "this player has a weapon/armor equipped or doesn't."
function makeEquippedWeaponMesh(itemId) {
  // The Holly Wand gets its own look — a crooked holly stick with a lit
  // tip. The tip sprite + the per-player point light (see wand light pool)
  // are what make it "glow and light the way at night".
  if (itemId === 'holly_wand') {
    const g = new THREE.Group();
    const barkMat = new THREE.MeshLambertMaterial({ color: 0x3a2417 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 9, 6), barkMat);
    shaft.position.y = -4.5;
    g.add(shaft);
    const crook = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 6, 6), barkMat);
    crook.position.set(0.9, -11.2, 0);
    crook.rotation.z = 0.3;
    g.add(crook);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1, 6), new THREE.MeshLambertMaterial({ color: 0x9ee37d }));
    band.position.y = -8.4;
    g.add(band);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff3c9 }));
    tip.position.set(1.6, -14.2, 0);
    g.add(tip);
    const tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0xffe9b0, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    tipGlow.scale.set(11, 11, 1);
    tipGlow.position.copy(tip.position);
    g.add(tipGlow);
    g.userData.wandTipGlow = tipGlow.material;
    return g;
  }
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

// One boot — called once per leg (see EQUIP_ATTACH.feet below) and
// attached to that leg's own pivot, so it walks with the leg instead of
// sitting fixed under the static torso group while the legs swing under it.
function makeEquippedFeetMesh(itemId) {
  const color = EQUIP_COLORS[itemId] || 0x5a3a24;
  const mat = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4, 4, 6), mat);
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
function _equipParent(v, parentKey) {
  // kk visuals: parent equip meshes to skeleton bones (via a scale-
  // compensating wrapper) so they ride the animations.
  if (!v.kk) return v[parentKey];
  const boneFor = { armR: v.kk.handR, armL: v.kk.handL, legL: v.kk.footL, legR: v.kk.footR, group: v.kk.headBone };
  const bone = boneFor[parentKey];
  if (!bone) return v[parentKey];
  const slotKey = 'slot_' + parentKey;
  if (!v.kk.slots[slotKey]) {
    const wrap = new THREE.Group();
    wrap.scale.setScalar(1 / v.kk.baseScale);
    if (parentKey === 'group') wrap.position.y = 0.1; // hats sit on the crown
    bone.add(wrap);
    v.kk.slots[slotKey] = wrap;
  }
  return v.kk.slots[slotKey];
}

function _reattachMesh(v, meshKey, parentKey, makeFn, itemId, positionFn) {
  const changed = v[meshKey + 'ItemId'] !== itemId;
  const parent = _equipParent(v, parentKey);
  if (changed && v[meshKey]) {
    parent.remove(v[meshKey]);
    v[meshKey] = null;
    v[meshKey + 'ItemId'] = null;
  }
  if (itemId && !v[meshKey]) {
    v[meshKey] = makeFn(itemId);
    if (v.kk) {
      // bone-space: rest at the slot origin; classic offsets don't apply
      if (parentKey === 'armR' || parentKey === 'armL') v[meshKey].position.set(0, 0, 0);
      else if (parentKey === 'group') v[meshKey].position.set(0, 4, 0);
      else v[meshKey].position.set(0, -1.5, 1);
    } else {
      positionFn(v[meshKey]);
    }
    parent.add(v[meshKey]);
    v[meshKey + 'ItemId'] = itemId;
  }
  // equipping a real weapon hides the class's embedded KayKit prop
  if (v.kk && meshKey === 'weaponMesh') v.kk.setEmbeddedWeaponsVisible(!itemId);
}

// Toggle helpers that attach/detach/swap one equip-slot mesh on a given
// visual. Now keyed by itemId (or null) instead of a plain boolean so that
// swapping pieces updates the mesh appearance instead of reusing the old one.
// ---------------------------------------------------------------------------
// LEGEND_FX — the legendaries' visible-to-everyone equipment effects
// (Session I). Every legendary item carries an fx spec { c1, c2, prims[] }
// (see server LEGENDARY_CATALOG); this module renders those specs as cheap
// additive sprites attached to any player visual wearing the item — same
// broadcast path as equipment itself, so every player in the room sees it.
// Budgets: ≤16 sprites per player, shared textures, zero per-frame allocs.
// On GFX 'low' the effect collapses to a single aura sprite.
// ---------------------------------------------------------------------------
const LEGEND_FX = (function () {
  let runeTexes = null;
  function glowTexture() { return makeGlowTexture(); }
  function runeTextures() {
    if (!runeTexes) {
      const RUNES = ['ᚠ', 'ᚨ', 'ᛉ', 'ᛟ', 'ᛞ', 'ᛗ'];
      runeTexes = RUNES.map((r) => {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const ctx = c.getContext('2d');
        ctx.font = 'bold 44px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 12;
        ctx.fillStyle = '#fff'; ctx.fillText(r, 32, 34);
        return new THREE.CanvasTexture(c);
      });
    }
    return runeTexes;
  }
  function sprite(tex, colorHex, scale, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: new THREE.Color(colorHex), transparent: true,
      opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    s.scale.set(scale, scale, 1);
    return s;
  }
  // Each primitive builds its sprites into `group` and returns an update
  // closure called every tick with (t seconds, moved distance this frame).
  const PRIMS = {
    aura(group, fx) {
      const s = sprite(glowTexture(), fx.c1, 44, 0.34);
      s.position.y = CHAR.hipY + CHAR.torsoH / 2;
      group.add(s);
      return (t) => { const b = 1 + Math.sin(t * 1.7) * 0.10; s.scale.set(44 * b, 50 * b, 1); };
    },
    orbit(group, fx) {
      const gems = [];
      for (let i = 0; i < 4; i++) { const s = sprite(glowTexture(), i % 2 ? fx.c2 : fx.c1, 9, 0.85); group.add(s); gems.push(s); }
      return (t) => gems.forEach((s, i) => {
        const a = t * 1.4 + i * Math.PI / 2;
        s.position.set(Math.cos(a) * 17, CHAR.hipY + 12 + Math.sin(t * 2 + i) * 5, Math.sin(a) * 17);
      });
    },
    runes(group, fx) {
      const texes = runeTextures(), rs = [];
      for (let i = 0; i < 5; i++) { const s = sprite(texes[i % texes.length], fx.c1, 8, 0); group.add(s); rs.push(s); }
      return (t) => rs.forEach((s, i) => {
        const ph = ((t * 0.35 + i / 5) % 1);              // 0→1 rise cycle
        const a = i * 2.4 + t * 0.4;
        s.position.set(Math.cos(a) * 11, 6 + ph * (CHAR.headY + 10), Math.sin(a) * 11);
        s.material.opacity = ph < 0.15 ? ph / 0.15 * 0.9 : (1 - ph) * 0.9;   // bubble up, fade out
      });
    },
    bubbles(group, fx) {
      const bs = [];
      for (let i = 0; i < 6; i++) { const s = sprite(glowTexture(), fx.c2, 5, 0.6); group.add(s); bs.push(s); }
      return (t) => bs.forEach((s, i) => {
        const ph = ((t * 0.25 + i / 6) % 1);
        const a = i * 1.9;
        s.position.set(Math.cos(a) * (9 + ph * 6), 4 + ph * (CHAR.headY + 6), Math.sin(a) * (9 + ph * 6));
        s.material.opacity = (1 - ph) * 0.55;
      });
    },
    wisps(group, fx) {
      const ws2 = [];
      for (let i = 0; i < 3; i++) { const s = sprite(glowTexture(), i ? fx.c2 : fx.c1, 12, 0.7); group.add(s); ws2.push(s); }
      return (t) => ws2.forEach((s, i) => {
        const a = t * (0.7 + i * 0.13) + i * 2.1;
        s.position.set(Math.sin(a) * 19, CHAR.hipY + 10 + Math.sin(a * 1.6 + i) * 14, Math.cos(a * 0.8) * 19);
      });
    },
    embers(group, fx) {
      const es = [];
      for (let i = 0; i < 8; i++) { const s = sprite(glowTexture(), i % 3 ? fx.c1 : fx.c2, 3.5, 0.8); group.add(s); es.push(s); }
      return (t) => es.forEach((s, i) => {
        const ph = ((t * 0.55 + i / 8) % 1);
        const a = i * 0.83 + t * 0.2;
        s.position.set(Math.cos(a) * (7 + ph * 9), 2 + ph * (CHAR.headY + 14), Math.sin(a) * (7 + ph * 9));
        s.material.opacity = (1 - ph) * (0.55 + Math.sin(t * 13 + i * 5) * 0.25);
      });
    },
    sigil(group, fx) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(13, 17, 28),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(fx.c1), transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.6;
      group.add(ring);
      return (t) => { ring.rotation.z = t * 0.7; ring.material.opacity = 0.3 + Math.sin(t * 2.2) * 0.12; };
    },
    crown(group, fx) {
      const cs = [];
      for (let i = 0; i < 5; i++) { const s = sprite(glowTexture(), fx.c1, 6, 0.9); group.add(s); cs.push(s); }
      return (t) => cs.forEach((s, i) => {
        const a = t * 1.1 + i * (Math.PI * 2 / 5);
        s.position.set(Math.cos(a) * 9, CHAR.headY + 12 + Math.sin(t * 2.5 + i) * 1.5, Math.sin(a) * 9);
      });
    },
    trail(group, fx, v) {
      const ts = [];
      for (let i = 0; i < 8; i++) { const s = sprite(glowTexture(), fx.c2, 10, 0); group.add(s); ts.push({ s, born: -1 }); }
      let nextDrop = 0;
      return (t, moved) => {
        if (moved > 0.5 && t > nextDrop) {
          nextDrop = t + 0.12;
          const slot = ts.reduce((a, b) => (a.born < b.born ? a : b));
          // drop at the visual's current WORLD spot, but sprites live in the
          // player-local group — record the offset and walk it backward.
          slot.born = t; slot.wx = v.group.position.x; slot.wz = v.group.position.z;
        }
        for (const o of ts) {
          if (o.born < 0) { o.s.material.opacity = 0; continue; }
          const age = t - o.born;
          if (age > 0.9) { o.s.material.opacity = 0; o.born = -1; continue; }
          o.s.position.set(o.wx - v.group.position.x, 4, o.wz - v.group.position.z);
          o.s.material.opacity = (1 - age / 0.9) * 0.5;
        }
      };
    },
    frost(group, fx) {
      const fs = [];
      for (let i = 0; i < 6; i++) { const s = sprite(glowTexture(), fx.c1, 4, 0.7); group.add(s); fs.push(s); }
      return (t) => fs.forEach((s, i) => {
        const ph = ((t * 0.18 + i / 6) % 1);
        const a = i * 1.3 + t * 0.35;
        s.position.set(Math.cos(a) * 14, (CHAR.headY + 8) * (1 - ph), Math.sin(a) * 14);
        s.material.opacity = Math.sin(ph * Math.PI) * 0.7;
      });
    }
  };
  function specsFor(equipped) {
    const out = [];
    for (const k of ['equippedWeapon', 'equippedHead', 'equippedChest', 'equippedFeet', 'equippedRing']) {
      const id = equipped[k];
      const it = id && ITEM_CATALOG[id];
      if (it && it.legendary && it.fx) out.push({ id, fx: it.fx });
    }
    return out;
  }
  function sync(v, equipped) {
    const specs = specsFor(equipped);
    const key = specs.map((s) => s.id).join('|');
    if (v.legendFxKey === key) return;
    if (v.legendFx) { v.group.remove(v.legendFx.group); v.legendFx = null; }
    v.legendFxKey = key;
    if (!specs.length) return;
    const group = new THREE.Group();
    const updaters = [];
    const lowTier = (typeof GFX !== 'undefined' && GFX.st && GFX.st.quality === 'low');
    for (const spec of specs) {
      const prims = lowTier ? spec.fx.prims.slice(0, 1) : spec.fx.prims;
      for (const p of prims) {
        if (PRIMS[p]) updaters.push(PRIMS[p](group, spec.fx, v));
      }
    }
    v.group.add(group);
    v.legendFx = { group, updaters, t: Math.random() * 10, lastX: v.group.position.x, lastZ: v.group.position.z };
  }
  function tick(dt) {
    for (const id in visuals) {
      const v = visuals[id];
      if (!v || !v.legendFx) continue;
      const fx2 = v.legendFx;
      fx2.t += dt;
      const moved = Math.hypot(v.group.position.x - fx2.lastX, v.group.position.z - fx2.lastZ);
      fx2.lastX = v.group.position.x; fx2.lastZ = v.group.position.z;
      for (const u of fx2.updaters) u(fx2.t, moved);
    }
  }
  // Human-readable line for the shop ("what will everyone see?").
  const PRIM_WORDS = {
    aura: 'a breathing aura', orbit: 'orbiting motes', runes: 'runes bubbling upward',
    bubbles: 'rising spectral bubbles', wisps: 'circling wisp-lights', embers: 'drifting embers',
    sigil: 'a turning ground-sigil', crown: 'a crown of lights', trail: 'a fading light-trail', frost: 'falling frost-motes'
  };
  function describe(fx) { return fx.prims.map((p) => PRIM_WORDS[p] || p).join(' · '); }
  return { sync, tick, glowTexture, describe };
})();

const EQUIP_ATTACH = {
  weapon: (v, itemId) => _reattachMesh(v, 'weaponMesh', 'armR',
    id => makeEquippedWeaponMesh(id),
    itemId,
    m => m.position.set(0, -CHAR.armLen + 1, 1.2)),
  chest: (v, itemId) => { if (v.kk) return; _reattachMesh(v, 'chestMesh', 'group',
    id => makeEquippedChestMesh(id),
    itemId,
    m => { m.position.y = CHAR.hipY + CHAR.torsoH / 2; }); },
  head: (v, itemId) => _reattachMesh(v, 'headMesh', 'group',
    id => makeEquippedHeadMesh(id),
    itemId,
    m => { m.position.y = CHAR.headY; }),
  // Two separate boots, one parented to each leg's own pivot (legL/legR)
  // instead of one pair parented to the static torso group — legL/legR
  // swing independently during the walk cycle, so a shared parent can't
  // follow both feet at once. y/z here mirror the bare foot's own local
  // offset inside makeLeg() so the boot sits right where the foot is.
  feet: (v, itemId) => {
    _reattachMesh(v, 'feetMeshL', 'legL', id => makeEquippedFeetMesh(id), itemId, m => m.position.set(0, -24, 2));
    _reattachMesh(v, 'feetMeshR', 'legR', id => makeEquippedFeetMesh(id), itemId, m => m.position.set(0, -24, 2));
  },
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
  // Legendary equipment effects — visible to everyone in the room.
  LEGEND_FX.sync(v, equipped);
  // Holly Wand bearers glow — a soft additive body aura (any player, any
  // scene), plus a real night light from the shared pool (updateWandLights).
  const hasWand = (equipped.equippedWeapon === 'holly_wand');
  if (hasWand && !v.wandAura) {
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0xffeec2, transparent: true, opacity: 0.2,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    aura.scale.set(46, 52, 1);
    aura.position.y = 20;
    v.group.add(aura);
    v.wandAura = aura;
  } else if (!hasWand && v.wandAura) {
    v.group.remove(v.wandAura);
    v.wandAura = null;
  }
  v.hasWand = hasWand;
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
  if (v.wardMesh)      { v.group.remove(v.wardMesh);      v.wardMesh      = null; }
  // KayKit rigs expose `torso` as a positioning Group (no material) — the
  // shirt tint only exists on classic procedural humanoids. Guarding here
  // fixes the TypeError every status apply/clear threw on KayKit visuals
  // (user-reported via Raven's Cloak, Session I).
  if (v.torso && v.torso.material && v.baseShirtColor != null) v.torso.material.color.setHex(v.baseShirtColor);
  if (v.colorcycleSprite) { v.group.remove(v.colorcycleSprite); v.colorcycleSprite = null; }
  v.statusType = null;
}

function applyStatusVisual(id, status) {
  const v = visuals[id];
  if (!v) return;
  const newType = status ? status.type : null;
  if (v.statusType === newType) return;
  clearStatusVisual(v);
  v.statusType = newType;
  if (newType === 'colorcycle' && !(v.torso && v.torso.material)) {
    // Classic rigs tint the shirt; KayKit rigs get a hue-cycling glow.
    v.colorcycleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: LEGEND_FX.glowTexture(), color: 0xffffff, transparent: true,
      opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    v.colorcycleSprite.scale.setScalar(46);
    v.colorcycleSprite.position.y = CHAR.hipY + CHAR.torsoH / 2;
    v.group.add(v.colorcycleSprite);
  }
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
  } else if (newType === 'ward') {
    // The class-neutral defensive ward (Iron Pelt / Ethereal Veil / Oath
    // of Iron / Packmule's Guard / Spirit Ward / Guardian's Pledge) — a
    // faint translucent dome, same halved-damage effect as the Witch's
    // pumpkin without the jack-o'-lantern head. Pulses in updateStatusVisuals.
    v.wardMesh = new THREE.Mesh(
      new THREE.SphereGeometry(CHAR.headY * 0.95, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.18, depthWrite: false })
    );
    v.wardMesh.position.y = CHAR.headY * 0.55;
    v.group.add(v.wardMesh);
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
    } else if (v.statusType === 'colorcycle' && v.torso && v.torso.material) {
      v.torso.material.color.setHSL((now * 0.0006) % 1, 0.7, 0.55);
    } else if (v.statusType === 'colorcycle' && v.colorcycleSprite) {
      // KayKit rigs can't tint the shared shirt material — hue-cycle the
      // aura sprite added in applyStatusVisual instead.
      v.colorcycleSprite.material.color.setHSL((now * 0.0006) % 1, 0.8, 0.6);
    } else if (v.statusType === 'ravencloak' && v.cloakMesh) {
      v.cloakMesh.rotation.z = Math.sin(now * 0.003) * 0.15;
    } else if (v.statusType === 'wolfmark' && v.wolfMarkMesh) {
      v.wolfMarkMesh.rotation.y += dt * 1.6;
    } else if (v.statusType === 'wolfpact' && v.wolfPactMesh) {
      v.wolfPactMesh.rotation.y += dt * 2.0;
    } else if (v.statusType === 'ward' && v.wardMesh) {
      v.wardMesh.material.opacity = 0.14 + Math.sin(now * 0.004) * 0.06;
      v.wardMesh.rotation.y += dt * 0.6;
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
    weaponMesh: null, chestMesh: null, headMesh: null, feetMeshL: null, feetMeshR: null, ringMesh: null,
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
  if (v.kk) KK.mixers.delete(v.kk.mixer);
  if (v.inScene && v.parentScene) v.parentScene.remove(v.group);
  if (v.ghostInScene && v.ghostParentScene) v.ghostParentScene.remove(v.ghostGroup);
  v.nameEl.remove();
  if (v.bubbleEl) v.bubbleEl.remove();
  delete visuals[id];
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function syncVisuals(dt) {
  // Holly Wand ambience, shared by every bearer this frame
  const _dn = getDayNightState();
  const wandNight = 1 - _dn.lightAmount;
  const wandPulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.0024);
  for (const id in players) {
    const p = players[id];
    const v = visuals[id];
    if (!v) continue;

    if (v.wandAura) v.wandAura.material.opacity = 0.15 + wandNight * 0.3 + wandPulse * 0.07;
    if (v.weaponMesh && v.weaponMesh.userData.wandTipGlow) {
      v.weaponMesh.userData.wandTipGlow.opacity = 0.38 + wandNight * 0.42 + wandPulse * 0.12;
    }

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

    if (v.kk) kkDrivePlayer(v, p, id, dt, isMoving, moveDist);
    // Attack animation — overrides walk/idle arms for ~0.35s
    const ATTACK_DUR = 0.35;
    if (!v.kk) {
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
    } // end classic (non-kk) animation block

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
      if (v.kk) { if (t === 0 || v.kk.cur !== 'Death_A') kkSetState(v.kk, 'Death_A'); }
      else v.group.rotation.x = -Math.PI / 2 * t;
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
      // Floor height rides a short critically-damped chase instead of
      // snapping — stray profile knees, ramp edges and zone boundaries all
      // land as a glide, not a pop. Room changes and teleports snap (you
      // should not visibly "rise" out of a door you just stepped through).
      const floorYTarget = getFloorHeight(p.room, rp.x, rp.z);
      if (v.floorYS === undefined || v.floorRoomS !== p.room || Math.abs(floorYTarget - v.floorYS) > 34) v.floorYS = floorYTarget;
      else v.floorYS += (floorYTarget - v.floorYS) * (1 - Math.exp(-dt * 13));
      v.floorRoomS = p.room;
      const floorYOffset = v.floorYS;
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
  const now = Date.now();
  for (const id in players) {
    const p = players[id];
    const v = visuals[id];
    if (!v) continue;
    if (!v.inScene) {
      v.nameEl.style.display = 'none';
      if (v.bubbleEl) v.bubbleEl.style.display = 'none';
      continue;
    }
    // Mobile: names used to be permanently on for everyone in sight —
    // with a few players around, the screen was mostly name banners.
    // Now a name shows only when it's information you'd actually want:
    // someone close to you (fading out with distance), someone who just
    // spoke, or someone you tapped. Desktop keeps its hover behavior.
    let mobileOpacity = 1;
    if (MOBILE_UI) {
      // Your own banner is pure clutter on a phone — you know who you are.
      if (id === myId) { v.nameEl.style.display = 'none'; continue; }
      const dist = (p.room === (me && me.room)) ? Math.hypot(p.x - me.x, p.y - me.y) : Infinity;
      const spoke = p.lastChatAt && now - p.lastChatAt < 6000;
      const tapped = p.tapNameUntil && p.tapNameUntil > now;
      if (!spoke && !tapped && dist > 150) {
        v.nameEl.style.display = 'none';
        continue;
      }
      mobileOpacity = (spoke || tapped || dist <= 105) ? 1 : Math.max(0.15, 1 - (dist - 105) / 45);
    }
    const rp = getRenderPos(p);
    const floorYOffset = (v.floorYS !== undefined && v.floorRoomS === p.room) ? v.floorYS : getFloorHeight(p.room, rp.x, rp.z);
    const headScreen = worldToScreen(rp.x, groundY + CHAR.headY + floorYOffset, rp.z);
    // Speech bubbles ride the same anchor but ignore the hover gate — the
    // whole point is seeing who spoke WITHOUT mousing over them.
    if (!MOBILE_UI) updateBubbleTag(p, v, headScreen, now);
    if (!headScreen.visible || !isScreenPosHovered(headScreen.x, headScreen.y)) {
      v.nameEl.style.display = 'none';
      continue;
    }
    v.nameEl.style.display = 'block';
    v.nameEl.style.opacity = MOBILE_UI ? String(mobileOpacity) : '';
    v.nameEl.style.left = headScreen.x + 'px';
    v.nameEl.style.top = (headScreen.y - 14) + 'px';
  }
}

// ---------------------------------------------------------------------------
// Camera obstruction handling (Session G) — two outdoor problems, two fixes:
//  1. BUILDINGS: the chase camera regularly swung inside the KayKit shells
//     when you walked past one — with backface culling that shows the town
//     *through* the building, popping in and out frame to frame (the
//     reported "seeing through them / crackling"). The camera now clips its
//     pull-back against every building's blocker box — the same "shrink
//     along the behind-the-player line" rule the indoor camera uses.
//  2. TREES & TALL DRESSING: pulling the camera in for every canopy would
//     make it lurch constantly in wooded lanes; instead, anything tagged
//     userData.camFade ghosts to ~25% opacity while it stands between the
//     camera and the player, and fades back the moment it doesn't.
// ---------------------------------------------------------------------------
const KK_CAM_BLOCKERS = []; // {minX,minZ,maxX,maxZ,maxY} per placed building (collision footprint × model height)
const camFadeState = new Map();      // fade root group → { amount }
const camFadeLists = new WeakMap();  // scene → cached mesh list
const camFadeWanted = new Set();
const _camRay = new THREE.Raycaster();
const _camRayO = new THREE.Vector3();
const _camRayD = new THREE.Vector3();

function camFadeablesFor(scene) {
  let list = camFadeLists.get(scene);
  if (!list) {
    list = [];
    scene.traverse(o => {
      if (o.userData && o.userData.camFade) {
        o.traverse(m => { if (m.isMesh) { m.userData.camFadeRoot = o; list.push(m); } });
      }
    });
    camFadeLists.set(scene, list);
  }
  return list;
}

// Entry parameter t∈[0,1] of the segment (ax,ay,az)→(bx,by,bz) into the box,
// or 1 if it never enters. Player collision keeps the anchor out of these
// footprints, so t is a clean "how far back the camera may sit" fraction.
function segBlockerT(ax, ay, az, bx, by, bz, k) {
  let t0 = 0, t1 = 1;
  const p = [ax, ay, az], q = [bx, by, bz];
  const mins = [k.minX, -20, k.minZ], maxs = [k.maxX, k.maxY, k.maxZ];
  for (let a = 0; a < 3; a++) {
    const d = q[a] - p[a];
    if (Math.abs(d) < 1e-6) { if (p[a] < mins[a] || p[a] > maxs[a]) return 1; continue; }
    let ta = (mins[a] - p[a]) / d, tb = (maxs[a] - p[a]) / d;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return 1;
  }
  return t0 > 0.001 ? t0 : 1; // t0≈0 means the anchor itself grazes the box — don't clamp to nothing
}

function setRootFade(root, amount) {
  root.traverse(m => {
    if (!m.isMesh) return;
    if (amount <= 0.001) {
      // restore only if nothing else (e.g. the harvested-tree look) swapped
      // the material while we were fading
      if (m.userData.cfOrig && m.material === m.userData.cfMat) m.material = m.userData.cfOrig;
      m.userData.cfOrig = null;
      m.userData.cfMat = null;
      return;
    }
    if (!m.userData.cfOrig || (m.material !== m.userData.cfMat && m.material !== m.userData.cfOrig)) {
      // Clone-on-(re)fade: KayKit instances share materials, so editing them
      // in place would ghost every copy in town at once. Re-cache if some
      // other system swapped the material since we last looked.
      m.userData.cfOrig = m.material;
      const mk = (mat) => { const c = mat.clone(); c.transparent = true; c.depthWrite = false; return c; };
      m.userData.cfMat = Array.isArray(m.material) ? m.material.map(mk) : mk(m.material);
    }
    const apply = (fm, om) => { fm.opacity = (om.transparent ? om.opacity : 1) * (1 - amount * 0.75); };
    if (Array.isArray(m.userData.cfMat)) m.userData.cfMat.forEach((fm, i) => apply(fm, m.userData.cfOrig[i]));
    else apply(m.userData.cfMat, m.userData.cfOrig);
    m.material = m.userData.cfMat;
  });
}

function updateCamObstructions(dt, ax, ay, az) {
  const fadeScene = (activeScene === outdoorScene || activeScene === wildsScene) ? activeScene : null;
  camFadeWanted.clear();
  if (fadeScene && activeCamera) {
    const meshes = camFadeablesFor(fadeScene);
    if (meshes.length) {
      _camRayD.set(activeCamera.position.x - ax, activeCamera.position.y - ay, activeCamera.position.z - az);
      const len = _camRayD.length();
      if (len > 24) {
        _camRayD.multiplyScalar(1 / len);
        _camRayO.set(ax, ay, az);
        _camRay.set(_camRayO, _camRayD);
        _camRay.near = 0;
        _camRay.far = len - 6;
        const hits = _camRay.intersectObjects(meshes, false);
        for (const h of hits) {
          const r = h.object.userData.camFadeRoot;
          if (r) camFadeWanted.add(r);
        }
      }
    }
  }
  for (const root of camFadeWanted) if (!camFadeState.has(root)) camFadeState.set(root, { amount: 0 });
  camFadeState.forEach((s, root) => {
    const target = camFadeWanted.has(root) ? 1 : 0;
    s.amount += (target - s.amount) * Math.min(1, dt * 7);
    if (target === 0 && s.amount < 0.04) { setRootFade(root, 0); camFadeState.delete(root); return; }
    setRootFade(root, s.amount);
  });
}

// ---------------------------------------------------------------------------
// Holly Wand night lights — a small FIXED pool of point lights per outdoor
// scene (fixed so the shader never recompiles as wands come and go),
// assigned each frame to the nearest wand bearers. This is the "provides
// them light at night time" half of the wand; the glow half is the aura +
// tip sprite in applyEquipVisual/syncVisuals.
// ---------------------------------------------------------------------------
const WAND_LIGHTS_PER_SCENE = 3;
const wandLightPools = new Map(); // scene → PointLight[]
function wandPoolFor(scene) {
  let pool = wandLightPools.get(scene);
  if (!pool) {
    pool = [];
    for (let i = 0; i < WAND_LIGHTS_PER_SCENE; i++) {
      const L = new THREE.PointLight(0xffe2a8, 0, 300, 2);
      L.position.set(0, -9999, 0);
      scene.add(L);
      pool.push(L);
    }
    wandLightPools.set(scene, pool);
  }
  return pool;
}
function updateWandLights() {
  const scene = (activeScene === outdoorScene || activeScene === wildsScene) ? activeScene : null;
  wandLightPools.forEach((pool, s) => { if (s !== scene) pool.forEach(L => { L.intensity = 0; }); });
  if (!scene) return;
  const roomForScene = scene === outdoorScene ? 'outside' : 'wilds';
  const night = 1 - getDayNightState().lightAmount;
  const bearers = [];
  for (const id in players) {
    const p = players[id];
    if (p.room !== roomForScene || p.equippedWeapon !== 'holly_wand') continue;
    const v = visuals[id];
    if (!v || !v.inScene) continue;
    const rp = getRenderPos(p);
    const d2 = me ? (rp.x - me.x) * (rp.x - me.x) + (rp.z - me.y) * (rp.z - me.y) : 0;
    bearers.push({ rp, d2, v });
  }
  bearers.sort((a, b) => a.d2 - b.d2);
  const pool = wandPoolFor(scene);
  for (let i = 0; i < pool.length; i++) {
    const L = pool[i], b = bearers[i];
    if (!b || night <= 0.03) { L.intensity += (0 - L.intensity) * 0.2; continue; }
    L.position.set(b.rp.x, groundY + 34 + (b.v.floorYS || 0), b.rp.z);
    L.intensity += (night * 1.25 - L.intensity) * 0.25;
  }
}

function updateCamera(dt) {
  if (!me) return;
  const rp = getRenderPos(me);
  const f = me.facing + cameraYawOffset; // camera-only angle — drag-to-look never touches actual movement facing
  // Cave uses indoor camera params — the room is small enough that outdoor back=165 clips through the south wall.
  const cam = (mode === 'outdoor' && activeScene !== caveScene && activeScene !== vaultScene) ? OUTDOOR_CAM : (seatedAt ? INDOOR_SEATED_CAM : INDOOR_CAM);
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

  // Use the SMOOTHED floor height the body is actually drawn at (see
  // syncVisuals) — lookAt() is applied instantly, so feeding it the raw
  // stair profile made the whole view pitch-bump on every profile knee
  // while climbing. The camera now glides exactly with the character.
  const vMe = visuals[myId];
  const floorYOffset = (vMe && vMe.floorYS !== undefined && vMe.floorRoomS === me.room) ? vMe.floorYS : getFloorHeight(me.room, rp.x, rp.z);
  let targetX = rp.x + dirX * horizBack;
  let targetZ = rp.z + dirZ * horizBack;
  let targetY = groundY + cam.height + floorYOffset + verticalRise;

  // Outdoors, never let the camera sink inside a building shell — clip the
  // player→camera segment against each building's blocker box and slide the
  // camera up the same line, exactly like the indoor wall rule above.
  const anchorY = groundY + floorYOffset + 42;
  if (activeScene === outdoorScene && KK_CAM_BLOCKERS.length) {
    let m = 1;
    for (let i = 0; i < KK_CAM_BLOCKERS.length; i++) {
      m = Math.min(m, segBlockerT(rp.x, anchorY, rp.z, targetX, targetY, targetZ, KK_CAM_BLOCKERS[i]));
    }
    if (m < 1) {
      m = Math.max(0.16, m - 0.05);
      targetX = rp.x + (targetX - rp.x) * m;
      targetY = anchorY + (targetY - anchorY) * m;
      targetZ = rp.z + (targetZ - rp.z) * m;
    }
  }

  const ease = 1 - Math.exp(-dt * 6);
  activeCamera.position.x += (targetX - activeCamera.position.x) * ease;
  activeCamera.position.y += (targetY - activeCamera.position.y) * ease;
  activeCamera.position.z += (targetZ - activeCamera.position.z) * ease;

  // Hard guarantee: the EASED position must also be outside every building —
  // a big teleport (door exit, portal) can leave the previous camera position
  // deep inside a shell, and the ease would otherwise glide it through the
  // walls for a few visible frames.
  if (activeScene === outdoorScene && KK_CAM_BLOCKERS.length) {
    let mNow = 1;
    for (let i = 0; i < KK_CAM_BLOCKERS.length; i++) {
      mNow = Math.min(mNow, segBlockerT(rp.x, anchorY, rp.z, activeCamera.position.x, activeCamera.position.y, activeCamera.position.z, KK_CAM_BLOCKERS[i]));
    }
    if (mNow < 1) {
      mNow = Math.max(0.12, mNow - 0.05);
      activeCamera.position.x = rp.x + (activeCamera.position.x - rp.x) * mNow;
      activeCamera.position.y = anchorY + (activeCamera.position.y - anchorY) * mNow;
      activeCamera.position.z = rp.z + (activeCamera.position.z - rp.z) * mNow;
    }
  }

  activeCamera.lookAt(rp.x, groundY + cam.lookUp + floorYOffset, rp.z);

  // Ghost out trees/props standing between the camera and the character.
  updateCamObstructions(dt, rp.x, anchorY, rp.z);
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
  if (me.room === 'bank_vault') return nearestKioskIn(VAULT_KIOSKS, me.x, me.y);
  if (me.room === 'ember_wastes') return nearestKioskIn(EMBER_KIOSKS, me.x, me.y);
  if (activeScene === outdoorScene) return nearestKioskIn(OUTDOOR_KIOSKS, me.x, me.y);
  if (activeScene === wildsScene) return nearestKioskIn(WILDS_KIOSKS, me.x, me.y);
  if (activeScene === dungeonScene) return nearestKioskIn(DUNGEON_KIOSKS, me.x, me.y);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION L UI — the town board, the Weekly Delve, covens, the welcome-back
// letter, First Steps, the event calendar pill, notifications, dungeon lore.
// ═══════════════════════════════════════════════════════════════════════════
// The saved login (localStorage tc_account) — parsed fresh each ask, the way
// the rest of the client treats it.
function accountAuth() {
  try { return JSON.parse(localStorage.getItem('tc_account') || 'null'); } catch (e) { return null; }
}

// ── One account, one body ────────────────────────────────────────────────────
// Set when the server evicts this connection because the same account logged
// in elsewhere; onWsClose checks it so this tab never auto-reconnects into a
// tug-of-war with the other device.
let sessionTakenOver = false;
function showSessionTakeover(message) {
  const wrap = document.createElement('div');
  wrap.id = 'takeoverOverlay';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:130;background:rgba(8,5,14,0.92);display:flex;align-items:center;justify-content:center;padding:22px;';
  const card = document.createElement('div');
  card.style.cssText = 'background:linear-gradient(180deg,#241a3b,#170f2a);border:1px solid #5ee7c0;border-radius:16px;max-width:380px;padding:24px 22px;text-align:center;color:#e8dcc8;font-size:14.5px;line-height:1.65;';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:19px;font-weight:800;color:#ffe9c2;margin-bottom:8px;';
  title.textContent = '🌒 Someone walked in as you';
  const body = document.createElement('div');
  body.textContent = message || 'Your account entered the town from another device, so this visit has been closed — there is only ever one of you in Thornreach.';
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.style.marginTop = '16px';
  btn.textContent = 'Back to the join screen';
  btn.addEventListener('click', () => location.reload());
  card.appendChild(title);
  card.appendChild(body);
  card.appendChild(btn);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
}

// ── Event calendar pill + countdowns ─────────────────────────────────────────
function applyCalendarState(cal) {
  calendarState = cal || calendarState;
  renderEventTag();
}
// The event pill announces, then gets out of the way (the Session I location-
// pill lesson, re-learned live on Michael's phone): it shows for a few seconds
// whenever the ACTIVE EVENT SET changes (an event starting or ending), then
// fades. Tapping it while visible opens the Town Board.
let _eventTagSig = null;
let _eventTagFadeTimer = null;
function renderEventTag() {
  const el = document.getElementById('eventTag');
  if (!el) return;
  if (!calendarState || !me) { el.classList.add('hidden'); _eventTagSig = null; return; }
  const now = Date.now();
  const parts = [];
  if (calendarState.bloodMoon && bloodMoonActiveClient(now)) parts.push('🔴 BLOOD MOON');
  if (calendarState.festival && now >= calendarState.festival.startsAt && now < calendarState.festival.endsAt) parts.push('🏮 Hearthmoon Festival — +25% XP');
  if (calendarState.tourney && now >= calendarState.tourney.startsAt && now < calendarState.tourney.endsAt) parts.push('🏹 Hunt Tournament');
  const sig = parts.join('|');
  if (!parts.length) { el.classList.add('hidden'); _eventTagSig = sig; return; }
  el.textContent = parts.join(' · ');
  el.classList.remove('hidden');
  if (sig !== _eventTagSig) {
    // The set changed — surface it fresh, then fade back out of the way.
    _eventTagSig = sig;
    el.classList.remove('tagFaded');
    clearTimeout(_eventTagFadeTimer);
    _eventTagFadeTimer = setTimeout(() => el.classList.add('tagFaded'), 6500);
  }
}
setInterval(renderEventTag, 20000);
(function () {
  const el = document.getElementById('eventTag');
  if (!el) return;
  el.addEventListener('click', () => {
    el.classList.add('tagFaded');
    openBoardModal(); // the board is where the tournament lives
  });
})();

// ── The while-you-were-gone letter ───────────────────────────────────────────
function openLetterModal(letter) {
  const modal = document.getElementById('letterModal');
  const body = document.getElementById('letterBody');
  if (!modal || !body) return;
  const lines = [];
  const days = Math.floor(letter.awayHours / 24);
  const awayLabel = days >= 2 ? `${days} days` : `${letter.awayHours} hours`;
  lines.push(['🌒', `The town kept a candle lit for the ${awayLabel} you were away.`]);
  if (letter.streak) {
    lines.push(['🔥', `Day ${letter.streak.count} in a row — <b>${letter.streak.gold + letter.streak.weeklyBonus} gold</b> paid to your bank${letter.streak.weeklyBonus ? ' (a full week!)' : ''}.`]);
  }
  if (letter.regrown > 0) lines.push(['🌿', `<b>${letter.regrown}</b> of your foraging patches ${letter.regrown === 1 ? 'has' : 'have'} regrown in the Wilds.`]);
  if (letter.questsReady > 0) lines.push(['📜', `<b>${letter.questsReady}</b> side ${letter.questsReady === 1 ? 'quest is' : 'quests are'} ready to take again.`]);
  if (letter.peddlerRotated) lines.push(['🌒', `The Midnight Peddler has turned his cart — <b>five new wonders</b> on the table.`]);
  const cal = letter.calendar || calendarState;
  if (cal) {
    const now = Date.now();
    if (now >= cal.tourney.startsAt && now < cal.tourney.endsAt) lines.push(['🏹', 'The Weekend Hunt Tournament is ON right now — every kill counts.']);
    else if (cal.tourney.startsAt > now) lines.push(['🏹', `Next hunt tournament: ${shortWhen(cal.tourney.startsAt)}.`]);
    if (now >= cal.festival.startsAt && now < cal.festival.endsAt) lines.push(['🏮', 'The Hearthmoon Festival fills the town today — +25% XP!']);
    if (bloodMoonActiveClient(now)) lines.push(['🔴', 'The BLOOD MOON is up at this very moment. Shards are falling.']);
  }
  body.innerHTML = '';
  for (const [ico, html] of lines) {
    const row = document.createElement('div');
    row.className = 'lLine';
    const i = document.createElement('span'); i.className = 'lIco'; i.textContent = ico;
    const t = document.createElement('span'); t.innerHTML = html; // authored above — no user text rides this
    row.appendChild(i); row.appendChild(t);
    body.appendChild(row);
  }
  modal.classList.remove('hidden');
}
function shortWhen(ts) {
  const ms = ts - Date.now();
  if (ms <= 0) return 'now';
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24;
  return d > 0 ? `in ${d}d ${h}h` : `in ${h}h ${Math.floor(ms / 60000) % 60}m`;
}
(function () {
  const b = document.getElementById('letterCloseBtn');
  if (b) b.addEventListener('click', () => document.getElementById('letterModal').classList.add('hidden'));
})();

// ── First Steps tracker ──────────────────────────────────────────────────────
// Announce-then-yield (live phone report: the always-on card sat in the
// joystick lane and could block a brand-new player's thumb). The full card
// shows for a few seconds at join, whenever a step completes, or on tap —
// otherwise it collapses to a tiny 🏮 n/3 pill docked out of every input zone.
let _fsExpanded = false;
let _fsCollapseTimer = null;
function fsSetExpanded(on, autoCollapseMs) {
  _fsExpanded = on;
  clearTimeout(_fsCollapseTimer);
  if (on && autoCollapseMs) {
    _fsCollapseTimer = setTimeout(() => { _fsExpanded = false; renderFirstSteps(); }, autoCollapseMs);
  }
  renderFirstSteps();
}
function renderFirstSteps() {
  const chip = document.getElementById('firstStepsChip');
  if (!chip) return;
  if (!firstStepsState || firstStepsState.done) { chip.classList.add('hidden'); return; }
  chip.innerHTML = '';
  const steps = firstStepsState.steps || [];
  const doneCount = steps.filter(s => s.done).length;
  // Desktop keeps the always-on full card at bottom-left (Michael: "the
  // placement on my laptop is perfect") — only touch collapses to the pill.
  if (MOBILE_UI && !_fsExpanded) {
    chip.classList.add('fsMini');
    chip.textContent = `🏮 ${doneCount}/${steps.length}`;
    chip.title = 'First Steps — tap to see';
    chip.classList.remove('hidden');
    return;
  }
  chip.classList.remove('fsMini');
  const title = document.createElement('div');
  title.className = 'fsTitle';
  title.textContent = '🏮 First Steps';
  chip.appendChild(title);
  for (const s of steps) {
    const row = document.createElement('div');
    if (s.done) row.className = 'fsDone';
    row.textContent = `${s.icon} ${s.label}`;
    chip.appendChild(row);
  }
  const note = document.createElement('div');
  note.style.cssText = 'color:#9a8ac0;font-size:11px;margin-top:2px;';
  note.textContent = `Finish all three: ${firstStepsState.rewardGold} gold`;
  chip.appendChild(note);
  chip.classList.remove('hidden');
}
(function () {
  const chip = document.getElementById('firstStepsChip');
  if (chip) chip.addEventListener('click', () => { if (MOBILE_UI) fsSetExpanded(!_fsExpanded, 8000); });
})();

// ── The Town Board ───────────────────────────────────────────────────────────
let boardActiveTab = 'hunt';
function openBoardModal() {
  boardModalOpen = true;
  document.getElementById('boardModal').classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'board_state' }));
  renderBoardModal();
}
function closeBoardModal() {
  boardModalOpen = false;
  document.getElementById('boardModal').classList.add('hidden');
}
function renderBoardModal() {
  if (!boardModalOpen) return;
  const list = document.getElementById('boardList');
  const weekNote = document.getElementById('boardWeekNote');
  const meNote = document.getElementById('boardMeNote');
  const tNote = document.getElementById('boardTourneyNote');
  if (!list) return;
  document.querySelectorAll('#boardTabs .slTab').forEach(b =>
    b.classList.toggle('active', b.dataset.board === boardActiveTab));
  list.innerHTML = '';
  if (!boardState) { list.innerHTML = '<div class="slNote">Consulting the board…</div>'; return; }
  weekNote.textContent = `This week's deeds — new page ${shortWhen(boardState.weekEndsAt)}`;
  const board = boardState.boards[boardActiveTab];
  tNote.classList.toggle('hidden', boardActiveTab !== 'tourney');
  if (boardActiveTab === 'tourney' && boardState.tourney) {
    tNote.textContent = boardState.tourney.active
      ? `🏹 LIVE — ends ${shortWhen(boardState.tourney.endsAt)}. Every creature felled counts.`
      : `Next tournament ${shortWhen(boardState.tourney.startsAt)} (Friday evening → Sunday night).`;
  }
  if (!board || !board.top.length) {
    list.innerHTML = '<div class="slNote">No deeds written on this page yet — be the first.</div>';
  } else {
    board.top.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'slRow' + (board.me && e.value === board.me.value && me && e.name === me.name ? ' slMe' : '');
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const rank = document.createElement('span'); rank.className = 'slRank'; rank.textContent = medal;
      const name = document.createElement('span'); name.className = 'slName'; name.textContent = e.name;
      const val = document.createElement('span'); val.className = 'slVal';
      val.textContent = boardActiveTab === 'delve' ? `depth ${e.value}` : `×${e.value}`;
      row.appendChild(rank); row.appendChild(name); row.appendChild(val);
      list.appendChild(row);
    });
  }
  meNote.textContent = boardState.isGuest
    ? 'Guests pass through unrecorded — log in and the board remembers you.'
    : (board && board.me ? `You: #${board.me.rank} with ${boardActiveTab === 'delve' ? 'depth ' + board.me.value : '×' + board.me.value}` : 'Nothing beside your name yet this week.');
  const honorsWrap = document.getElementById('boardHonors');
  const honorsList = document.getElementById('boardHonorsList');
  if (boardState.honors && boardState.honors.length) {
    honorsWrap.classList.remove('hidden');
    honorsList.innerHTML = '';
    for (const h of boardState.honors.slice().reverse()) {
      const row = document.createElement('div');
      row.className = 'slRow';
      row.textContent = `${h.place === 1 ? '🥇' : h.place === 2 ? '🥈' : '🥉'} ${h.board} board — ${h.week}`;
      honorsList.appendChild(row);
    }
  } else {
    honorsWrap.classList.add('hidden');
  }
}
(function () {
  const tabs = document.getElementById('boardTabs');
  if (tabs) tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.slTab');
    if (!b) return;
    boardActiveTab = b.dataset.board;
    renderBoardModal();
  });
  const close = document.getElementById('boardCloseBtn');
  if (close) close.addEventListener('click', closeBoardModal);
})();

// ── The Weekly Delve UI ──────────────────────────────────────────────────────
function openDelveModal() {
  delveModalOpen = true;
  document.getElementById('delveModal').classList.remove('hidden');
  document.getElementById('delveErr').textContent = '';
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'delve_state' }));
  renderDelveModal();
}
function closeDelveModal() {
  delveModalOpen = false;
  document.getElementById('delveModal').classList.add('hidden');
}
function renderDelveModal() {
  if (!delveModalOpen) return;
  const mods = document.getElementById('delveMods');
  const lobby = document.getElementById('delveLobby');
  const runView = document.getElementById('delveRunView');
  const modsList = (delveState && delveState.mods) || weeklyDelveModsClient || [];
  mods.innerHTML = '';
  for (const m of modsList) {
    const chip = document.createElement('span');
    chip.className = 'modChip';
    chip.textContent = `${m.icon} ${m.name} — ${m.desc}`;
    mods.appendChild(chip);
  }
  const inRun = delveState && delveState.inRun;
  lobby.classList.toggle('hidden', !!inRun);
  runView.classList.toggle('hidden', !inRun);
  if (inRun) {
    document.getElementById('delveRunNote').textContent =
      `Floor ${delveState.floor} — ${delveState.kills}/${delveState.killsNeeded} felled · depth so far ${Math.max(0, delveState.floor - 1)}`;
  } else if (delveState && !delveState.inRun) {
    const best = delveState.best || { rank: null, value: 0 };
    document.getElementById('delveBestNote').textContent = delveState.isGuest
      ? 'Guests may delve, but only named souls are written on the board — log in to be remembered.'
      : (best.value ? `Your deepest this week: ${best.value}${best.rank ? ` (#${best.rank})` : ''}` : 'You haven\'t delved this week.');
    const top = document.getElementById('delveTopList');
    top.innerHTML = '';
    if (delveState.top && delveState.top.length) {
      delveState.top.forEach((e, i) => {
        const row = document.createElement('div');
        row.className = 'slRow';
        row.innerHTML = `<span class="slRank">${i === 0 ? '🥇' : i + 1 + '.'}</span>`;
        const name = document.createElement('span'); name.className = 'slName'; name.textContent = e.name;
        const val = document.createElement('span'); val.className = 'slVal'; val.textContent = 'depth ' + e.value;
        row.appendChild(name); row.appendChild(val);
        top.appendChild(row);
      });
    } else {
      top.innerHTML = '<div class="slNote">Nobody has gone below this week.</div>';
    }
  }
}
function renderDelveHud() {
  const hud = document.getElementById('delveHud');
  if (!hud) return;
  if (!delveState || !delveState.inRun) { hud.classList.add('hidden'); return; }
  document.getElementById('delveHudFloor').textContent = `🕳️ Floor ${delveState.floor}`;
  document.getElementById('delveHudKills').textContent =
    delveState.state === 'draft' ? '✨ draft' : `${delveState.kills} / ${delveState.killsNeeded}`;
  const boons = document.getElementById('delveHudBoons');
  boons.textContent = Object.entries(delveState.myBoons || {})
    .map(([id, n]) => { const b = delveBoonMeta(id); return b ? b.icon.repeat(Math.min(n, 3)) : ''; }).join('');
  hud.classList.remove('hidden');
}
function delveBoonMeta(id) {
  if (delveState && delveState.myOffer) {
    const hit = delveState.myOffer.find(o => o.id === id);
    if (hit) return hit;
  }
  const FALLBACK = { ember_heart: '🔥', bark_skin: '🪵', moon_blood: '🌕', quick_wick: '🕯️', cat_step: '🐈‍⬛', red_thread: '🧵', witchs_broth: '🍲', wolfs_bargain: '🐺', gravedigger: '⚰️' };
  return FALLBACK[id] ? { icon: FALLBACK[id] } : null;
}
let boonDraftTimer = null;
function renderBoonDraft() {
  const overlay = document.getElementById('boonDraft');
  if (!overlay) return;
  const offer = delveState && delveState.inRun && delveState.state === 'draft' ? delveState.myOffer : null;
  if (!offer || !offer.length) {
    overlay.classList.add('hidden');
    clearInterval(boonDraftTimer);
    return;
  }
  const cards = document.getElementById('boonCards');
  cards.innerHTML = '';
  for (const b of offer) {
    const card = document.createElement('div');
    card.className = 'boonCard';
    card.innerHTML = `<div class="bIcon">${b.icon}</div><div class="bName">${b.name}</div>`;
    const desc = document.createElement('div'); desc.className = 'bDesc'; desc.textContent = b.desc;
    card.appendChild(desc);
    card.addEventListener('click', () => {
      ws.send(JSON.stringify({ type: 'delve_pick_boon', boonId: b.id }));
      overlay.classList.add('hidden');
    });
    cards.appendChild(card);
  }
  const timerEl = document.getElementById('boonTimer');
  clearInterval(boonDraftTimer);
  const paint = () => {
    const left = Math.max(0, Math.ceil(((delveState && delveState.draftEndsAt) || 0 - Date.now()) / 1000 - Date.now() / 1000 + ((delveState && delveState.draftEndsAt) || 0) / 1000));
    const secs = Math.max(0, Math.ceil((((delveState && delveState.draftEndsAt) || 0) - Date.now()) / 1000));
    timerEl.textContent = secs > 0 ? `The way down opens in ${secs}s — undecided delvers take the first boon.` : '…';
  };
  paint();
  boonDraftTimer = setInterval(paint, 1000);
  overlay.classList.remove('hidden');
}
(function () {
  const start = document.getElementById('delveStartBtn');
  if (start) start.addEventListener('click', () => {
    document.getElementById('delveErr').textContent = '';
    ws.send(JSON.stringify({ type: 'delve_start' }));
    closeDelveModal();
  });
  const exit = document.getElementById('delveExitBtn');
  if (exit) exit.addEventListener('click', () => {
    ws.send(JSON.stringify({ type: 'delve_exit' }));
    closeDelveModal();
  });
  const close = document.getElementById('delveCloseBtn');
  if (close) close.addEventListener('click', closeDelveModal);
})();

// ── Covens UI ────────────────────────────────────────────────────────────────
let covenTableState = null;
let covenActiveTab = 'members';
let covenPickedSigil = null;
function refreshCovenMenuRow() {
  const row = document.getElementById('menuCoven');
  const badge = document.getElementById('menuCovenBadge');
  if (row) {
    const label = covenState ? `${covenState.sigil} ${covenState.name}` : '🕸️ Coven';
    row.childNodes[0].nodeValue = label;
  }
  if (badge) {
    badge.textContent = String(covenUnread);
    badge.classList.toggle('hidden', covenUnread === 0);
  }
  const chatBadge = document.getElementById('covenChatBadge');
  if (chatBadge) {
    chatBadge.textContent = String(covenUnread);
    chatBadge.classList.toggle('hidden', covenUnread === 0);
  }
}
function openCovenModal() {
  covenModalOpen = true;
  document.getElementById('covenModal').classList.remove('hidden');
  document.getElementById('covenErr').textContent = '';
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'coven_state' }));
  renderCovenModal();
}
function closeCovenModal() {
  covenModalOpen = false;
  document.getElementById('covenModal').classList.add('hidden');
}
function renderCovenModal() {
  if (!covenModalOpen) return;
  const none = document.getElementById('covenNone');
  const main = document.getElementById('covenMain');
  const title = document.getElementById('covenTitle');
  const isGuest = !(accountAuth() && accountAuth().token);
  if (!covenState) {
    title.textContent = '🕸️ Coven';
    none.classList.remove('hidden');
    main.classList.add('hidden');
    if (isGuest) document.getElementById('covenErr').textContent = 'Covens are for townsfolk with an account — log in first.';
    // sigil picker
    const pick = document.getElementById('covenSigilPick');
    if (pick && !pick.childNodes.length) {
      for (const s of covenSigilsCatalog) {
        const b = document.createElement('button');
        b.textContent = s;
        b.addEventListener('click', () => {
          covenPickedSigil = s;
          pick.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
        });
        pick.appendChild(b);
      }
    }
    return;
  }
  title.textContent = `${covenState.sigil} ${covenState.name}`;
  none.classList.add('hidden');
  main.classList.remove('hidden');
  document.getElementById('covenMotd').textContent = covenState.motd || 'No words over the door yet.';
  document.querySelectorAll('#covenTabs .slTab').forEach(b =>
    b.classList.toggle('active', b.dataset.cv === covenActiveTab));
  document.getElementById('covenMembersView').classList.toggle('hidden', covenActiveTab !== 'members');
  document.getElementById('covenChatView').classList.toggle('hidden', covenActiveTab !== 'chat');
  document.getElementById('covenBankView').classList.toggle('hidden', covenActiveTab !== 'bank');
  const amLeader = covenState.leaderKey === covenState.you;
  if (covenActiveTab === 'members') {
    const list = document.getElementById('covenMembers');
    list.innerHTML = '';
    for (const m of covenState.members) {
      const row = document.createElement('div');
      row.className = 'slRow';
      const dot = document.createElement('span'); dot.className = 'cvDot' + (m.online ? ' on' : '');
      const name = document.createElement('span'); name.className = 'slName';
      name.textContent = `${m.leader ? '👑 ' : ''}${m.name}`;
      row.appendChild(dot); row.appendChild(name);
      if (amLeader && !m.leader) {
        const kick = document.createElement('button');
        kick.className = 'kickBtn';
        kick.textContent = 'turn out';
        kick.addEventListener('click', () => ws.send(JSON.stringify({ type: 'coven_kick', memberKey: m.key })));
        row.appendChild(kick);
      }
      list.appendChild(row);
    }
    document.getElementById('covenMotdBtn').style.display = amLeader ? '' : 'none';
    document.getElementById('covenClaimBtn').style.display = me && me.room === 'cafe' ? '' : 'none';
  } else if (covenActiveTab === 'chat') {
    covenUnread = 0;
    refreshCovenMenuRow();
    renderCovenChat();
  } else if (covenActiveTab === 'bank') {
    document.getElementById('covenGold').textContent = String(covenState.bank.gold);
    document.getElementById('covenBankNote').textContent = me && me.room === 'bank'
      ? 'You stand in the Gilded Vault — the tab is open.'
      : 'The shared tab is used at the 🏦 Gilded Vault, like your own account.';
    const grid = document.getElementById('covenSlots');
    grid.innerHTML = '';
    covenState.bank.slots.forEach((s, i) => {
      const cell = document.createElement('div');
      cell.className = 'covenSlot';
      if (s) {
        const meta = ITEM_CATALOG[s.itemId];
        cell.innerHTML = `${meta ? meta.icon : '❔'}<span class="qty">×${s.qty}</span>`;
        cell.title = meta ? meta.name : s.itemId;
        cell.addEventListener('click', () => ws.send(JSON.stringify({ type: 'coven_withdraw_item', covenSlot: i })));
      }
      grid.appendChild(cell);
    });
    const log = document.getElementById('covenLog');
    log.innerHTML = '';
    for (const l of (covenState.log || []).slice().reverse()) {
      const row = document.createElement('div');
      row.className = 'slRow';
      row.textContent = `${l.who} ${l.action}`;
      log.appendChild(row);
    }
  }
}
function renderCovenChat() {
  const log = document.getElementById('covenChatLog');
  if (!log) return;
  log.innerHTML = '';
  for (const l of covenChatLines) {
    const row = document.createElement('div');
    const who = document.createElement('span'); who.className = 'cvWho'; who.textContent = `${l.sigil} ${l.who}: `;
    const text = document.createElement('span'); text.textContent = l.text;
    row.appendChild(who); row.appendChild(text);
    log.appendChild(row);
  }
  log.scrollTop = log.scrollHeight;
}
function openCovenInviteToast(msg) {
  // Reuse the announce banner shape: a click-to-answer toast.
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;top:120px;left:50%;transform:translateX(-50%);z-index:45;background:#241a3b;border:1px solid #5ee7c0;border-radius:14px;padding:12px 16px;color:#e8dcc8;font-size:13.5px;text-align:center;max-width:320px;';
  const label = document.createElement('div');
  label.textContent = `${msg.sigil} ${msg.fromName} invites you into ${msg.covenName} (${msg.members}/8)`;
  wrap.appendChild(label);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:8px;';
  const yes = document.createElement('button');
  yes.className = 'btn'; yes.style.margin = '0'; yes.textContent = 'Join the circle';
  yes.addEventListener('click', () => { ws.send(JSON.stringify({ type: 'coven_invite_accept', inviteId: msg.inviteId })); wrap.remove(); });
  const no = document.createElement('button');
  no.className = 'btn'; no.style.margin = '0'; no.textContent = 'Decline';
  no.addEventListener('click', () => { ws.send(JSON.stringify({ type: 'coven_invite_decline', inviteId: msg.inviteId })); wrap.remove(); });
  row.appendChild(yes); row.appendChild(no);
  wrap.appendChild(row);
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 55000);
}
// The claimed café table: a floating sigil over the middle of the room.
let covenTableSprite = null;
function refreshCovenTableVisual() {
  try {
    if (covenTableSprite && covenTableSprite.parent) covenTableSprite.parent.remove(covenTableSprite);
    covenTableSprite = null;
    if (!covenTableState || !me || me.room !== 'cafe' || !currentInterior || !currentInterior.scene) return;
    covenTableSprite = makeNpcNameSprite(`${covenTableState.sigil} ${covenTableState.name}'s table`);
    covenTableSprite.position.set(0, 95, -40);
    currentInterior.scene.add(covenTableSprite);
  } catch (e) { /* cosmetic only */ }
}
(function () {
  const closeBtn = document.getElementById('covenCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeCovenModal);
  const tabs = document.getElementById('covenTabs');
  if (tabs) tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.slTab');
    if (!b) return;
    covenActiveTab = b.dataset.cv;
    renderCovenModal();
  });
  const create = document.getElementById('covenCreateBtn');
  if (create) create.addEventListener('click', () => {
    const name = document.getElementById('covenNameInput').value.trim();
    document.getElementById('covenErr').textContent = '';
    ws.send(JSON.stringify({ type: 'coven_create', name, sigil: covenPickedSigil || covenSigilsCatalog[0] }));
  });
  const invite = document.getElementById('covenInviteBtn');
  if (invite) invite.addEventListener('click', () => {
    const target = nearestCovenInvitee();
    document.getElementById('covenErr').textContent = '';
    if (!target) { document.getElementById('covenErr').textContent = 'Nobody close enough — walk up to them first.'; return; }
    ws.send(JSON.stringify({ type: 'coven_invite', targetId: target.id }));
  });
  const claim = document.getElementById('covenClaimBtn');
  if (claim) claim.addEventListener('click', () => ws.send(JSON.stringify({ type: 'coven_claim_table' })));
  const motd = document.getElementById('covenMotdBtn');
  if (motd) motd.addEventListener('click', () => {
    const text = prompt('The words over the door (up to 120 chars):', covenState ? covenState.motd : '');
    if (text != null) ws.send(JSON.stringify({ type: 'coven_motd', text }));
  });
  const leave = document.getElementById('covenLeaveBtn');
  let leaveArmed = 0;
  if (leave) leave.addEventListener('click', () => {
    if (Date.now() - leaveArmed < 3000) {
      ws.send(JSON.stringify({ type: 'coven_leave' }));
      leave.textContent = '🥀 Leave the circle';
      return;
    }
    leaveArmed = Date.now();
    leave.textContent = '⚠️ Tap again to leave the circle';
    setTimeout(() => { leave.textContent = '🥀 Leave the circle'; }, 3200);
  });
  const send2 = document.getElementById('covenChatSend');
  const input = document.getElementById('covenChatInput');
  const sendChat = () => {
    if (!input.value.trim()) return;
    ws.send(JSON.stringify({ type: 'coven_chat', text: input.value.trim() }));
    input.value = '';
  };
  if (send2) send2.addEventListener('click', sendChat);
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); e.stopPropagation(); });
  const gold = document.getElementById('covenGoldAmt');
  if (gold) gold.addEventListener('keydown', (e) => e.stopPropagation());
  const dep = document.getElementById('covenDepositBtn');
  if (dep) dep.addEventListener('click', () => {
    const amt = parseInt(document.getElementById('covenGoldAmt').value, 10);
    if (amt > 0) ws.send(JSON.stringify({ type: 'coven_deposit_gold', amount: amt }));
  });
  const wit = document.getElementById('covenWithdrawBtn');
  if (wit) wit.addEventListener('click', () => {
    const amt = parseInt(document.getElementById('covenGoldAmt').value, 10);
    if (amt > 0) ws.send(JSON.stringify({ type: 'coven_withdraw_gold', amount: amt }));
  });
})();
function nearestCovenInvitee() {
  // NOTE: deliberately NOT named nearestOtherPlayer — the combat helper of
  // that name exists further down, and duplicate top-level declarations
  // silently shadow each other (the collision uncapped this invite range
  // for a while). 160 units ≈ "standing with you at the table."
  if (!me) return null;
  let best = null, bestD = 160;
  for (const id in players) {
    const p = players[id];
    if (!p || p.id === me.id || p.room !== me.room) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// ── Dungeon lore plaques ─────────────────────────────────────────────────────
function openPlaqueModal() {
  const m = /^dungeon_t([1-4])$/.exec(me ? me.room : '');
  const lore = m && dungeonLoreCatalog && dungeonLoreCatalog[m[1]];
  if (!lore) return;
  document.getElementById('plaqueTitle').textContent = `🕳️ ${lore.name}`;
  document.getElementById('plaqueEpithet').textContent = lore.epithet;
  document.getElementById('plaqueText').textContent = lore.plaque;
  const bossName = lore.bossKey && DUNGEON_MOB_VISUALS[lore.bossKey] ? (DUNGEON_BOSS_NAMES[lore.bossKey] || '') : '';
  document.getElementById('plaqueBoss').textContent = bossName ? `⚔️ Its keeper: ${bossName}` : '';
  document.getElementById('plaqueModal').classList.remove('hidden');
}
(function () {
  const b = document.getElementById('plaqueCloseBtn');
  if (b) b.addEventListener('click', () => document.getElementById('plaqueModal').classList.add('hidden'));
})();

// ── Notifications (Web Push) ─────────────────────────────────────────────────
const NOTIF_PREFS_KEY = 'tc_notif_prefs';
function notifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY)) || { moonrise: false, bloodmoon: true, peddler: true, events: true }; }
  catch (e) { return { moonrise: false, bloodmoon: true, peddler: true, events: true }; }
}
function saveNotifPrefs(p) { try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p)); } catch (e) {} }
function pushSupportedHere() {
  return pushAvailable && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
function openNotifModal() {
  notifModalOpen = true;
  const modal = document.getElementById('notifModal');
  const err = document.getElementById('notifErr');
  err.textContent = '';
  const prefs = notifPrefs();
  document.querySelectorAll('#notifRows .notifToggle').forEach(t => {
    const on = !!prefs[t.dataset.pref];
    t.classList.toggle('on', on);
    t.textContent = on ? 'ON' : 'OFF';
  });
  const sub = document.getElementById('notifSub');
  if (!pushSupportedHere()) {
    sub.textContent = window.TOWNCHAT_PLATFORM
      ? 'The app-store builds will grow native notifications later — for now the ravens fly to browsers.'
      : 'This browser (or this server) can\'t carry ravens. On the web build over HTTPS, they fly.';
  } else if (!(accountAuth() && accountAuth().token)) {
    sub.textContent = 'Ravens follow your ACCOUNT — log in first, then enable them here.';
  } else {
    sub.textContent = 'A raven can find you when something stirs — even with the town closed.';
  }
  navigator.serviceWorker && navigator.serviceWorker.getRegistration && navigator.serviceWorker.getRegistration().then(reg =>
    reg && reg.pushManager ? reg.pushManager.getSubscription() : null
  ).then(s => {
    document.getElementById('notifEnableBtn').classList.toggle('hidden', !!s);
    document.getElementById('notifDisableBtn').classList.toggle('hidden', !s);
  }).catch(() => {});
  modal.classList.remove('hidden');
}
function urlB64ToUint8(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function enablePushHere() {
  const err = document.getElementById('notifErr');
  err.textContent = '';
  try {
    if (!pushSupportedHere()) { err.textContent = 'Push isn\'t available in this build — try the web version in a browser.'; return; }
    if (!(accountAuth() && accountAuth().token)) { err.textContent = 'Log into an account first — the raven follows your account.'; return; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { err.textContent = 'The browser refused notification permission.'; return; }
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(pushPublicKey) });
    const res = await fetch(apiUrlMaybe('/api/push/subscribe'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_token: accountAuth().token, subscription: sub.toJSON(), prefs: notifPrefs() })
    }).then(r => r.json());
    if (!res.ok) { err.textContent = 'The server declined the subscription (' + (res.error || '?') + ').'; return; }
    setUnlockToast('🔔 The raven knows this device now.');
    openNotifModal();
  } catch (e) {
    err.textContent = 'Could not enable here: ' + (e && e.message ? e.message : 'unknown error');
  }
}
async function disablePushHere() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) {
      if (accountAuth() && accountAuth().token) {
        fetch(apiUrlMaybe('/api/push/unsubscribe'), {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ account_token: accountAuth().token, endpoint: sub.endpoint })
        }).catch(() => {});
      }
      await sub.unsubscribe();
    }
    setUnlockToast('🔕 The raven forgets this device.');
    openNotifModal();
  } catch (e) {}
}
(function () {
  const rows = document.getElementById('notifRows');
  if (rows) rows.addEventListener('click', async (e) => {
    const t = e.target.closest('.notifToggle');
    if (!t) return;
    const prefs = notifPrefs();
    prefs[t.dataset.pref] = !prefs[t.dataset.pref];
    saveNotifPrefs(prefs);
    t.classList.toggle('on', prefs[t.dataset.pref]);
    t.textContent = prefs[t.dataset.pref] ? 'ON' : 'OFF';
    // If already subscribed, sync the new prefs to the server.
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && await reg.pushManager.getSubscription();
      if (sub && accountAuth() && accountAuth().token) {
        fetch(apiUrlMaybe('/api/push/subscribe'), {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ account_token: accountAuth().token, subscription: sub.toJSON(), prefs })
        }).catch(() => {});
      }
    } catch (e2) {}
  });
  const en = document.getElementById('notifEnableBtn');
  if (en) en.addEventListener('click', enablePushHere);
  const dis = document.getElementById('notifDisableBtn');
  if (dis) dis.addEventListener('click', disablePushHere);
  const close = document.getElementById('notifCloseBtn');
  if (close) close.addEventListener('click', () => { notifModalOpen = false; document.getElementById('notifModal').classList.add('hidden'); });
})();

// ── Session L menu rows ──────────────────────────────────────────────────────
(function () {
  const closeSheet = () => document.getElementById('menuSheet').classList.add('hidden');
  const wire = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { closeSheet(); fn(); });
  };
  wire('menuDelve', openDelveModal);
  wire('menuBoard', openBoardModal);
  wire('menuCoven', openCovenModal);
  wire('menuNotifs', openNotifModal);
})();

let passModalOpen = false;

function openPassModal() {
  const modal = document.getElementById('passModal');
  if (!modal) return;
  const priceEl = document.getElementById('roomPassPrice');
  if (priceEl) priceEl.textContent = passPriceLabel();
  const hoursEl = document.getElementById('roomPassHours');
  if (hoursEl) hoursEl.textContent = String(townPassHours);
  const err = document.getElementById('passModalErr');
  if (err) err.textContent = '';
  const status = document.getElementById('passModalStatus');
  if (status) {
    status.textContent = hasTownPass()
      ? `🎟️ Your pass is ACTIVE — ${passTimeLeftLabel()} remaining.`
      : (paymentsEnabled ? '' : 'Pass sales aren’t set up on this server yet. (Server operator: set STRIPE_SECRET_KEY in the host’s environment — a local .env never deploys. See README.)');
  }
  const buyBtn = document.getElementById('roomPassBuyBtn');
  if (buyBtn) {
    buyBtn.disabled = hasTownPass() || !paymentsEnabled;
    // The label must tell the truth about WHY it's inert — a disabled
    // button that still says "Buy" reads as a broken button.
    buyBtn.textContent = hasTownPass()
      ? '✓ Pass active'
      : (paymentsEnabled
          ? `Buy Day Pass — ${passPriceLabel()} / ${townPassHours}h`
          : '🚫 Passes not on sale here');
  }
  // 🏮 The 30-day Resident Pass (Session L) — same doors, resident value.
  const price30El = document.getElementById('roomPass30Price');
  if (price30El) price30El.textContent = '$' + (townPass30Cents / 100).toFixed(2);
  const buy30 = document.getElementById('roomPass30BuyBtn');
  if (buy30) {
    buy30.disabled = hasTownPass() || !paymentsEnabled;
    buy30.textContent = hasTownPass()
      ? '✓ Pass active'
      : (paymentsEnabled
          ? `Buy Resident Pass — $${(townPass30Cents / 100).toFixed(2)} / 30 days`
          : '🚫 Passes not on sale here');
  }
  modal.classList.remove('hidden');
  passModalOpen = true;
}

// ── 🌒 The Midnight Peddler's shop (Session I) ──────────────────────────
let legendModalOpen = false;
let legendCountdownTimer = null;
const LEGEND_TIER_NAMES = { 1: 'CURIO', 2: 'RELIC', 3: 'ARCANUM', 4: 'SEVERANCE-CLASS' };
const LEGEND_STAT_LABELS = { power: 'Power', guard: 'Guard', vitality: 'Max HP', haste: 'Haste', swift: 'Speed', leech: 'Lifesteal', xp: 'XP', forage: 'Forage' };
function legendStatLine(stats) {
  return Object.entries(stats).map(([k, val]) =>
    '+' + (k === 'vitality' ? val : Math.round(val * 100) + '%') + ' ' + (LEGEND_STAT_LABELS[k] || k)
  ).join(' · ');
}
function openLegendShop() {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'legend_shop_open' }));
}
function closeLegendShop() {
  const modal = document.getElementById('legendModal');
  if (modal) modal.classList.add('hidden');
  legendModalOpen = false;
  clearInterval(legendCountdownTimer);
}
function renderLegendShop(msg) {
  const modal = document.getElementById('legendModal');
  if (!modal) return;
  myMoonstones = msg.balance != null ? msg.balance : myMoonstones;
  document.getElementById('legendGreeting').textContent = msg.greeting || '';
  document.getElementById('legendErr').textContent = '';
  refreshMsUI();
  const cd = document.getElementById('legendCountdown');
  const paintCountdown = () => {
    const ms = (msg.nextRotationAt || 0) - Date.now();
    if (ms <= 0) { cd.textContent = '🌒 The stock is turning over — reopen the stall.'; return; }
    const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
    cd.textContent = '🌒 New wonders in ' + (d > 0 ? d + 'd ' + h + 'h' : h + 'h ' + m + 'm') + ' — five of a hundred, never the same five.';
  };
  paintCountdown();
  clearInterval(legendCountdownTimer);
  legendCountdownTimer = setInterval(paintCountdown, 30000);
  const list = document.getElementById('legendItems');
  list.innerHTML = '';
  for (const it of msg.items || []) {
    const row = document.createElement('div');
    row.className = 'legendRow tier' + it.tier;
    const nameLine = document.createElement('div');
    nameLine.className = 'legendName';
    nameLine.textContent = it.icon + ' ' + it.name;
    const tier = document.createElement('span');
    tier.className = 'legendTier';
    tier.textContent = LEGEND_TIER_NAMES[it.tier] || '';
    nameLine.appendChild(tier);
    row.appendChild(nameLine);
    const desc = document.createElement('div');
    desc.className = 'legendDesc';
    desc.textContent = it.desc;
    row.appendChild(desc);
    const fxLine = document.createElement('div');
    fxLine.className = 'legendFxLine';
    fxLine.style.color = it.fx && it.fx.c1 ? it.fx.c1 : '';
    fxLine.textContent = '✦ Everyone sees: ' + (it.fx ? LEGEND_FX.describe(it.fx) : '—');
    row.appendChild(fxLine);
    const stats = document.createElement('div');
    stats.className = 'legendStats';
    stats.textContent = '⚔ ' + legendStatLine(it.stats) + '  (' + (ITEM_CATALOG[it.id] ? (it.slot || 'trinket') : it.slot) + ')';
    row.appendChild(stats);
    const buyRow = document.createElement('div');
    buyRow.className = 'legendBuyRow';
    const price = document.createElement('span');
    price.className = 'legendPrice';
    price.textContent = it.ms + ' 💎';
    buyRow.appendChild(price);
    const buyBtn = document.createElement('button');
    buyBtn.className = 'btn legendBuyBtn';
    const canAfford = myMoonstones >= it.ms;
    buyBtn.textContent = canAfford ? 'Buy' : 'Need ' + (it.ms - myMoonstones) + ' more 💎';
    buyBtn.disabled = !canAfford;
    buyBtn.addEventListener('click', () => {
      document.getElementById('legendErr').textContent = '';
      ws.send(JSON.stringify({ type: 'legend_shop_buy', itemId: it.id }));
    });
    buyRow.appendChild(buyBtn);
    row.appendChild(buyRow);
    list.appendChild(row);
  }
  modal.classList.remove('hidden');
  legendModalOpen = true;
}
const legendCloseBtn = document.getElementById('legendCloseBtn');
if (legendCloseBtn) legendCloseBtn.addEventListener('click', closeLegendShop);
const legendGetMsBtn = document.getElementById('legendGetMsBtn');
if (legendGetMsBtn) legendGetMsBtn.addEventListener('click', () => { closeLegendShop(); openMsModal(); });

// ── 💎 Moonstones UI (Session I) ────────────────────────────────────────
let msModalOpen = false;
function refreshMsUI() {
  const menuVal = document.getElementById('menuMsVal');
  if (menuVal) menuVal.textContent = String(myMoonstones);
  const bal = document.getElementById('msModalBalance');
  if (bal) bal.innerHTML = 'You carry <b>' + myMoonstones + '</b> 💎';
  const lbal = document.getElementById('legendBalance');
  if (lbal) lbal.textContent = 'You carry ' + myMoonstones + ' 💎';
  updateGoldReadouts();
}

// ── Gold readouts (live report: "I can't see how much gold I have") ──────
// Gold lives in the bank vault, but the NUMBER should only ever be one
// glance away: a 🪙 badge on the menu's Inventory row, a purse strip at
// the top of the pack, and a balance line inside the Auction House. All
// three are fed from lastBankState (the server now pushes bank_state at
// every logged-in join, so they're live from the first frame — no more
// "Balance: ?" until you'd visited the teller) and myMoonstones via
// refreshMsUI. Guests have no vault, so their readouts stay hidden and
// the auction strip nudges them toward opening an account instead.
// Numbers only ever come from server payloads, so innerHTML here is safe.
function updateGoldReadouts() {
  const gold = lastBankState ? lastBankState.balance : null;
  const menuGold = document.getElementById('menuGoldVal');
  if (menuGold) {
    menuGold.classList.toggle('hidden', gold == null);
    if (gold != null) menuGold.textContent = '🪙 ' + gold;
  }
  const invLine = document.getElementById('invGoldLine');
  if (invLine) {
    invLine.classList.toggle('hidden', gold == null);
    if (gold != null) invLine.innerHTML = '🪙 <b>' + gold + '</b> gold banked · 💎 <b>' + myMoonstones + '</b> carried';
  }
  const aucLine = document.getElementById('auctionBalanceLine');
  if (aucLine) {
    if (gold == null) aucLine.textContent = 'Gold is held at the 🏦 bank — log in to a Town Chat account to earn and spend it.';
    else aucLine.innerHTML = 'You have 🪙 <b>' + gold + '</b> (bank) · 💎 <b>' + myMoonstones + '</b>';
  }
}
function msPriceLabel(cents) { return '$' + (cents / 100).toFixed(2); }
function openMsModal() {
  const modal = document.getElementById('msModal');
  if (!modal) return;
  const err = document.getElementById('msModalErr');
  if (err) err.textContent = '';
  const list = document.getElementById('msPackList');
  if (list) {
    list.innerHTML = '';
    const packs = msPacksCatalog || {};
    for (const packId in packs) {
      const p = packs[packId];
      const btn = document.createElement('button');
      btn.className = 'msPackBtn';
      const label = document.createElement('span');
      label.textContent = '💎 ' + p.ms + ' — ' + p.name;
      const price = document.createElement('span');
      price.className = 'msPackPrice';
      price.textContent = msPriceLabel(p.cents);
      btn.appendChild(label);
      btn.appendChild(price);
      btn.addEventListener('click', () => buyMoonstonePack(packId, btn));
      list.appendChild(btn);
    }
    if (!Object.keys(packs).length) {
      list.textContent = 'The Moonstone ledger hasn\u2019t opened yet — join the town first.';
    }
  }
  refreshMsUI();
  modal.classList.remove('hidden');
  msModalOpen = true;
}
function closeMsModal() {
  const modal = document.getElementById('msModal');
  if (modal) modal.classList.add('hidden');
  msModalOpen = false;
}
const msModalCloseBtn = document.getElementById('msModalCloseBtn');
if (msModalCloseBtn) msModalCloseBtn.addEventListener('click', closeMsModal);

async function buyMoonstonePack(packId, btn) {
  const err = document.getElementById('msModalErr');
  if (!savedAccount || !savedAccount.token) {
    if (err) err.textContent = '⚠️ Moonstones bind to an account — log in (or register) first, then come back.';
    return;
  }
  // Packaged mobile apps buy through the store (StoreKit / Play Billing) —
  // mobile-payments.js installs TOWNCHAT_IAP with a generic buyProduct.
  if (window.TOWNCHAT_IAP && typeof window.TOWNCHAT_IAP.buyProduct === 'function') {
    window.TOWNCHAT_IAP.buyProduct(packId, btn);
    return;
  }
  if (!paymentsEnabled) {
    if (err) err.textContent = '⚠️ Purchases aren\u2019t set up on this server yet.';
    return;
  }
  const restore = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Opening checkout…'; }
  try {
    const token = await requestResumeToken();
    if (token) sessionStorage.setItem('tc_resume', JSON.stringify({ token, name: me ? me.name : '', at: Date.now() }));
  } catch (e) {}
  fetch(apiUrlMaybe('/api/checkout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product: packId, account_token: savedAccount.token })
  })
    .then(r => r.json())
    .then(data => {
      if (data.url) { window.location.href = data.url; }
      else {
        if (err) err.textContent = '⚠️ ' + (data.error || 'Could not start checkout.');
        if (btn) { btn.disabled = false; btn.textContent = restore; }
      }
    })
    .catch(() => {
      if (err) err.textContent = '⚠️ Could not reach the server.';
      if (btn) { btn.disabled = false; btn.textContent = restore; }
    });
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
  updateGoldReadouts();
  ws.send(JSON.stringify({ type: 'bank_open' }));
  ws.send(JSON.stringify({ type: 'inventory_open' })); // the sell picker lists pack items too
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

// The sell picker offers BOTH pools: what you're carrying and what's in
// your vault (live report: you shouldn't have to deposit an item at the
// bank just to auction it). Option values are "inv:3" / "bank:7" so the
// submit handler knows which slots array — and which server-side source —
// the pick refers to. The pack group comes first: listing carried loot is
// the common case now.
function populateAuctionItemSelect() {
  const select = document.getElementById('auctionItemSelect');
  if (!select) return;
  select.innerHTML = '';
  const addGroup = (label, state, prefix) => {
    if (!state) return 0;
    let added = 0;
    const group = document.createElement('optgroup');
    group.label = label;
    state.slots.forEach((slot, idx) => {
      if (!slot) return;
      const item = ITEM_CATALOG[slot.itemId];
      const opt = document.createElement('option');
      opt.value = prefix + ':' + idx;
      opt.textContent = (item ? item.icon + ' ' + item.name : slot.itemId) + ' (have ' + slot.qty + ')';
      group.appendChild(opt);
      added++;
    });
    if (added) select.appendChild(group);
    return added;
  };
  const n = addGroup('🎒 Your pack', lastInventoryState, 'inv')
          + addGroup('🏦 Bank vault', lastBankState, 'bank');
  if (!n) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Nothing to list yet — go find some loot!';
    select.appendChild(opt);
  }
}

const auctionCreateSubmitBtn = document.getElementById('auctionCreateSubmitBtn');
if (auctionCreateSubmitBtn) auctionCreateSubmitBtn.addEventListener('click', () => {
  const err = document.getElementById('auctionModalErr');
  const raw = String(document.getElementById('auctionItemSelect').value || '');
  const m = raw.match(/^(inv|bank):(\d+)$/);
  const state = m ? (m[1] === 'inv' ? lastInventoryState : lastBankState) : null;
  const slot = state ? state.slots[parseInt(m[2], 10)] : null;
  if (!slot) { err.textContent = 'Pick an item first.'; return; }
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
  const currency = (document.getElementById('auctionCurrency') || {}).value === 'ms' ? 'ms' : 'gold';
  const source = m[1] === 'inv' ? 'inventory' : 'bank';
  ws.send(JSON.stringify({ type: 'auction_create', itemId: slot.itemId, qty, startingBid, buyoutPrice, durationHours, currency, source }));
  document.getElementById('auctionCreateForm').classList.add('hidden');
});
const auctionCurrencySel = document.getElementById('auctionCurrency');
if (auctionCurrencySel) auctionCurrencySel.addEventListener('change', () => {
  const note = document.getElementById('auctionMsFeeNote');
  if (note) note.classList.toggle('hidden', auctionCurrencySel.value !== 'ms');
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
      thumb.addEventListener('click', () => openImageLightbox(l.image));
      row.appendChild(thumb);
      const itemLine = document.createElement('div');
      itemLine.className = 'auctionItemLine';
      itemLine.textContent = `📸 ${l.sellerName}'s Selfie`;
      row.appendChild(itemLine);
    } else if (l.isVoice) {
      const itemLine = document.createElement('div');
      itemLine.className = 'auctionItemLine';
      itemLine.textContent = `📜 Blood Oath, witnessed by ${l.sellerName}`;
      row.appendChild(itemLine);
      const oathDesc = document.createElement('div');
      oathDesc.style.cssText = 'color:#c9a878;font-size:11px;font-style:italic;margin-bottom:6px;';
      oathDesc.textContent = 'A howl sworn under the full moon, sealed into this record as binding testimony.';
      row.appendChild(oathDesc);
      const player = document.createElement('audio');
      player.className = 'auctionVoicePlayer';
      player.controls = true;
      player.src = l.audio;
      row.appendChild(player);
    } else {
      const itemLine = document.createElement('div');
      itemLine.className = 'auctionItemLine';
      itemLine.textContent = (item ? item.icon + ' ' + item.name : l.itemId) + ' x' + l.qty;
      row.appendChild(itemLine);
    }

    const sym = (l.currency === 'ms') ? ' 💎' : ' 🪙';
    const bidLine = l.currentBid != null
      ? ('Current bid: ' + l.currentBid + sym + ' by ' + l.currentBidderName)
      : ('Starting bid: ' + l.startingBid + sym);
    const buyoutLine = l.buyoutPrice ? (' · Buyout: ' + l.buyoutPrice + sym) : '';
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
    const isDamage = spell.effect === 'damage' || spell.effect === 'leech';
    armTargeting('cast_spell', 'spellId', id, spell.name, isDamage, isDamage ? buildEmojiCursor(spell.icon) : SWORD_CURSOR);
    return;
  }
  if (spell.kind === 'ground') {
    closeSpellbook();
    armTargeting('cast_spell', 'spellId', id, spell.name, false, buildEmojiCursor(spell.icon), true);
    return;
  }
  document.getElementById('spellTargetPanel').classList.remove('hidden');
}

const spellCastBtn = document.getElementById('spellCastBtn');
if (spellCastBtn) spellCastBtn.addEventListener('click', () => {
  if (!selectedSpellId) return;
  if (actionOnCooldown(selectedSpellId)) { document.getElementById('spellbookErr').textContent = 'Your magic needs to recharge a moment.'; return; }
  document.getElementById('spellbookErr').textContent = '';
  ws.send(JSON.stringify({ type: 'cast_spell', spellId: selectedSpellId }));
  startActionCooldown(selectedSpellId);
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

// The tooltip's "owner" — the hovered cell that opened it. Inventory/bank/
// hotbar rerenders replace cells wholesale (innerHTML = ''), so a hovered
// cell can vanish without ever firing mouseleave; the orphaned tooltip then
// stayed visible forever, riding the cursor to wherever you clicked next
// (user-reported). The mousemove repositioner below now checks the owner is
// still attached and still hovered, and hides the tooltip the moment it
// isn't.
let _ttOwner = null;

function showItemTooltip(e, itemId) {
  if (!_tt) return;
  const item = ITEM_CATALOG[itemId];
  if (!item) return;
  _ttOwner = (e && e.currentTarget) || null;
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
  _ttOwner = (e && e.currentTarget) || null;
  _ttName.textContent  = action.icon + '  ' + action.name;
  _ttSlot.textContent  = KIND_LABELS[action.kind] || (action.kind || '');
  _ttStats.innerHTML   = '';
  _ttDesc.textContent  = action.description || '';
  _ttDesc.style.display = action.description ? '' : 'none';
  _tt.classList.remove('hidden');
  _positionTooltip(e);
}

function hideTooltip() { _ttOwner = null; if (_tt) _tt.classList.add('hidden'); }

document.addEventListener('mousemove', (e) => {
  if (!_tt || _tt.classList.contains('hidden')) return;
  // Owner gone (rerender/modal close) or cursor no longer over it → the
  // mouseleave that would normally hide us can never fire. Hide now.
  if (!_ttOwner || !_ttOwner.isConnected || !_ttOwner.matches(':hover')) { hideTooltip(); return; }
  _positionTooltip(e);
});

let myActionMsgType = null;
let myActionIdField = null;
const HOTBAR_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const HOTBAR_KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

// Each ability has its own independent cooldown (player.spellCooldowns/
// attackCooldowns server-side are keyed by spellId/attackId, not a single
// shared timestamp), so every hotbar slot tracks and renders its own
// countdown — casting Fireball only sweeps slot 4, not the other 11.
let hotbarSlotEls = []; // [{ id, slot, cooldown, cooldownText }, ...], rebuilt in buildHotbar()

// ── Personal loadout ────────────────────────────────────────────────────────
// The ORDER of your abilities is yours to choose: slots 1–12 on the desktop
// hotbar, and the first three ride the mobile action wheel. Stored per
// class, per browser (like the character pick) — it's a control preference,
// not game state; the server validates every cast regardless of order.
let myLoadout = null; // ordered ability ids for the current class, or null = default
function loadoutStorageKey() { return 'tc_loadout_' + (me ? me.charId : 'x'); }
function loadLoadout() {
  myLoadout = null;
  if (!me) return;
  try {
    const raw = JSON.parse(localStorage.getItem(loadoutStorageKey()) || 'null');
    if (Array.isArray(raw) && raw.every(x => typeof x === 'string')) myLoadout = raw;
  } catch (e) {}
}
function orderedAbilityIds() {
  if (!myActionCatalog) return [];
  const all = Object.keys(myActionCatalog);
  if (!myLoadout) return all;
  const seen = new Set();
  const out = [];
  for (const id of myLoadout) {
    if (myActionCatalog[id] && !seen.has(id)) { out.push(id); seen.add(id); }
  }
  for (const id of all) if (!seen.has(id)) out.push(id); // newly added abilities land at the end
  return out;
}
function saveLoadout(ids) {
  myLoadout = ids.slice();
  try { localStorage.setItem(loadoutStorageKey(), JSON.stringify(myLoadout)); } catch (e) {}
  buildHotbar(); // rebuilds the desktop bar; on mobile it rebuilds the wheel slots
}

function buildHotbar() {
  const bar = document.getElementById('hotbar');
  if (!bar) return;
  bar.innerHTML = '';
  hotbarSlotEls = [];
  // Mobile gets the action wheel's three quick slots instead of a 12-slot
  // keyboard bar — the old 2×6 mobile grid is what sat on top of the
  // joystick and the door button. CSS also hides #hotbar under touchMode;
  // this early-out keeps the slot elements from even existing there.
  if (MOBILE_UI) {
    bar.classList.add('hidden');
    buildMobileQuickSlots();
    return;
  }
  if (!myActionCatalog) { bar.classList.add('hidden'); return; }
  const ids = orderedAbilityIds();
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
    const cooldown = document.createElement('span');
    cooldown.className = 'hotbarCooldown';
    const cooldownText = document.createElement('span');
    cooldownText.className = 'hotbarCooldownText';
    slot.appendChild(icon);
    slot.appendChild(cooldown);
    slot.appendChild(cooldownText);
    slot.appendChild(key);
    slot.addEventListener('mouseenter', (e) => showActionTooltip(e, atk));
    slot.addEventListener('mouseleave', hideTooltip);
    slot.addEventListener('click', () => castFromHotbar(id));
    bar.appendChild(slot);
    hotbarSlotEls.push({ id, slot, cooldown, cooldownText });
  });
  bar.classList.remove('hidden');
}

// Cooldown timing — started optimistically the instant a cast_spell/
// cast_attack message is actually sent (see castFromHotbar, the armed-
// target click branch in handleCanvasClick, and the Spellbook/Attacks
// modal Cast buttons), matching the exact instant the server starts its own
// SPELL_COOLDOWN_MS/ATTACK_COOLDOWN_MS window for that specific ability id.
// Both are 8000ms today; ACTION_COOLDOWN_MS mirrors whichever one applies
// to this player's single class (a player only ever has one action catalog).
const ACTION_COOLDOWN_MS = 8000;
const actionCooldownEndAt = {}; // abilityId -> performance.now()-based end time

function startActionCooldown(id) { actionCooldownEndAt[id] = performance.now() + ACTION_COOLDOWN_MS; }
function actionOnCooldown(id) { return performance.now() < (actionCooldownEndAt[id] || 0); }

function updateHotbarCooldown() {
  if (!hotbarSlotEls.length) return;
  const now = performance.now();
  for (const { id, slot, cooldown, cooldownText } of hotbarSlotEls) {
    const remaining = (actionCooldownEndAt[id] || 0) - now;
    const active = remaining > 0;
    slot.classList.toggle('onCooldown', active);
    if (active) {
      cooldown.style.setProperty('--cd', (remaining / ACTION_COOLDOWN_MS).toFixed(3));
      cooldownText.textContent = Math.ceil(remaining / 1000);
    } else if (cooldownText.textContent !== '') {
      // Clear the last painted number — on styles where the text isn't
      // hard-hidden off-cooldown, a stale "1" used to linger forever.
      cooldownText.textContent = '';
      cooldown.style.setProperty('--cd', '0');
    }
  }
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

// Same "player or creature" reach as click-targeting for damage spells (see
// isValidArmedTarget) — the hotbar's auto-target needs the same widened
// search Fireball gets when you click, or pressing its key would silently
// find nothing whenever no other player happens to be nearby. Every other
// targeted spell/attack still calls nearestOtherPlayer() above unchanged.
//
// Range cap (live mobile report): with no cap, a quickslot press would pick
// the nearest creature ANYWHERE in the room — on a phone that meant
// fireballing things three screens away that the player never saw. The
// auto-pick now only considers what's plausibly on screen; deliberately
// TAPPING a visible target (the armed-target flow) still gets the server's
// full ABILITY_MAX_RANGE reach.
const AUTO_TARGET_RANGE = 420;
function nearestAttackable() {
  const nearestPlayer = nearestOtherPlayer();
  let best = nearestPlayer ? { id: nearestPlayer.id, targetType: 'player' } : null;
  let bestDist = nearestPlayer ? Math.hypot(nearestPlayer.x - me.x, nearestPlayer.y - me.y) : Infinity;
  if (bestDist > AUTO_TARGET_RANGE) { best = null; bestDist = AUTO_TARGET_RANGE; }
  else bestDist = Math.min(bestDist, AUTO_TARGET_RANGE);

  const mobPools = me.room === 'outside' ? [['animal', animalVisuals], ['mob', mobVisuals]]
    : me.room === 'wilds' ? [['animal2', animalVisuals2], ['mob2', mobVisuals2]]
    : me.room === 'ember_wastes' ? [['ember_mob', emberMobVisuals]]
    : (typeof me.room === 'string' && me.room.startsWith('dungeon_')) ? [['dungeon', dungeonMobVisuals]]
    : [];
  for (const [targetType, visuals] of mobPools) {
    for (const id in visuals) {
      const v = visuals[id];
      if (v.dead || (targetType === 'dungeon' && v.room !== me.room)) continue;
      const d = Math.hypot(v.x - me.x, v.y - me.y);
      if (d < bestDist) { bestDist = d; best = { id, targetType }; }
    }
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
  if (actionOnCooldown(id)) {
    setUnlockToast(myActionMsgType === 'cast_spell' ? 'Your magic needs to recharge a moment.' : 'Still recovering — wait a moment.');
    return;
  }
  cancelTargeting(); // a hotbar press means "do this nearest-target cast now", not "wait for my next click"
  const payload = { type: myActionMsgType, [myActionIdField]: id };
  if (atk.kind === 'targeted' || atk.kind === 'reveal') {
    if (atk.effect === 'damage' || atk.effect === 'leech') {
      const target = nearestAttackable();
      if (!target) { setUnlockToast('No one else is here to target.'); return; }
      payload.targetId = target.id;
      if (target.targetType !== 'player') payload.targetType = target.targetType;
    } else {
      const target = nearestOtherPlayer();
      if (!target) { setUnlockToast('No one else is here to target.'); return; }
      payload.targetId = target.id;
    }
  } else if (atk.kind === 'building') {
    const building = nearestBuilding();
    if (!building) { setUnlockToast('No building nearby.'); return; }
    payload.buildingId = building.id;
  } else if (atk.kind === 'ground') {
    // No cursor position to aim with from a keypress, so a hotbar press
    // just drops the sigil at the Witch's own feet — click-to-place (see
    // handleCanvasClick) is still there for actually aiming it somewhere.
    payload.x = me.x;
    payload.y = me.y;
  }
  ws.send(JSON.stringify(payload));
  triggerAttackAnim();
  startActionCooldown(id);
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

const ATTACK_PANEL_TITLES = { 1: '🐺 Wolf Attacks', 2: '🕯️ Mystic Rites', 3: '⚔️ Knightly Arts', 4: '🥾 Wanderer Skills' };

function openAttackPanel() {
  cancelTargeting();
  const modal = document.getElementById('attackModal');
  if (!modal || !myAttackCatalog) return;
  document.getElementById('attackErr').textContent = '';
  selectedAttackId = null;
  document.getElementById('attackTargetPanel').classList.add('hidden');
  const title = document.getElementById('attackModalTitle');
  if (title) title.textContent = (me && ATTACK_PANEL_TITLES[me.charId]) || '⚔️ Attacks';
  const howTo = document.getElementById('attackHowTo');
  if (howTo) {
    howTo.textContent = MOBILE_UI
      ? 'Targeted ones close this — then tap who to hit. AoE hits everyone nearby.'
      : 'Targeted ones close this — then click who to hit. AoE hits everyone nearby.';
  }
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
    // Damage/leech attacks reach animals and mobs too, exactly like the
    // Witch's Fireball/Leech Hex (see selectSpell above).
    const isDamage = atk.effect === 'damage' || atk.effect === 'leech';
    armTargeting('cast_attack', 'attackId', id, atk.name, isDamage, isDamage ? buildEmojiCursor(atk.icon) : SWORD_CURSOR);
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
  if (actionOnCooldown(selectedAttackId)) { err.textContent = 'Still recovering — wait a moment.'; return; }
  const payload = { type: 'cast_attack', attackId: selectedAttackId };
  if (atk.kind === 'building') {
    const buildingId = document.getElementById('attackTargetSelect').value;
    if (!buildingId) { err.textContent = 'Pick a building first.'; return; }
    payload.buildingId = buildingId;
  }
  err.textContent = '';
  ws.send(JSON.stringify(payload));
  startActionCooldown(selectedAttackId);
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
    img.addEventListener('click', () => openImageLightbox(image)); // same white-tab fix as room chat
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
    // The Day Pass ($0.99 / 24h, Lounge + Arcade) — through the same
    // /api/checkout the HUD button uses.
    startPassCheckout(roomPassBuyBtn);
  });
}
// 🏮 The Resident Pass — same doors for 30 days (Session L).
const roomPass30BuyBtn = document.getElementById('roomPass30BuyBtn');
if (roomPass30BuyBtn) {
  roomPass30BuyBtn.addEventListener('click', () => {
    const err = document.getElementById('passModalErr');
    if (!paymentsEnabled) {
      if (err) err.textContent = 'Payments are not set up on this server yet.';
      return;
    }
    startPassCheckout(roomPass30BuyBtn, 'pass30');
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
  // Each platform gets instructions for controls it actually has.
  const help = document.getElementById('arcadeHelp');
  if (help) {
    help.textContent = MOBILE_UI
      ? (type === 'snake' ? 'Swipe on the board to steer. Tap to retry after game over.'
                          : 'Slide your thumb to move the paddle. Tap to retry after game over.')
      : 'Arrow keys to play. Space to retry after game over. Esc to close.';
  }
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
    // Refuse 180° reversals — running back through your own neck was an
    // instant unfair death (the touch path guards this too).
    const aim = (d) => { if (!(d.x === -snakeState.dir.x && d.y === -snakeState.dir.y)) snakeState.nextDir = d; };
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') aim({ x: 0, y: -1 });
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') aim({ x: 0, y: 1 });
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') aim({ x: -1, y: 0 });
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') aim({ x: 1, y: 0 });
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

// ── Cabinet touch controls ──────────────────────────────────────────────────
// A pass-holding phone player used to stare at "Arrow keys to play": the
// cabinets were keyboard-only. Touch now drives both — Snake steers by
// swiping across the board (each ~24px of travel re-aims, so you can snake
// around without ever lifting your thumb), Breakout puts the paddle under
// your thumb directly, and after a game over a tap is the new Space.
(function wireArcadeTouch() {
  const cv = document.getElementById('arcadeCanvas');
  if (!cv) return;
  let touchId = null, startX = 0, startY = 0, swiped = false;
  const boardX = (clientX) => {
    const r = cv.getBoundingClientRect();
    return (clientX - r.left) * (320 / r.width); // CSS px → board coords
  };
  cv.addEventListener('touchstart', (e) => {
    if (!arcadeModalOpen || touchId !== null) return;
    const t = e.changedTouches[0];
    touchId = t.identifier;
    startX = t.clientX; startY = t.clientY; swiped = false;
    if (arcadeGameType === 'breakout' && breakoutState && !breakoutState.gameOver && !breakoutState.won) {
      breakoutState.paddleX = Math.max(0, Math.min(320 - breakoutState.paddleW, boardX(t.clientX) - breakoutState.paddleW / 2));
    }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId) continue;
      if (arcadeGameType === 'breakout' && breakoutState && !breakoutState.gameOver && !breakoutState.won) {
        breakoutState.paddleX = Math.max(0, Math.min(320 - breakoutState.paddleW, boardX(t.clientX) - breakoutState.paddleW / 2));
        swiped = true;
      } else if (arcadeGameType === 'snake' && snakeState && !snakeState.gameOver) {
        const dx = t.clientX - startX, dy = t.clientY - startY;
        if (Math.hypot(dx, dy) >= 24) {
          // Dominant axis wins; refuse 180° reversals same as the key path
          // (the snake can't run back through its own neck).
          const d = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
          if (!(d.x === -snakeState.dir.x && d.y === -snakeState.dir.y)) snakeState.nextDir = d;
          startX = t.clientX; startY = t.clientY; // chain swipes without lifting
          swiped = true;
        }
      }
    }
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId) continue;
      touchId = null;
      // A tap (no real movement) retries a finished game — the touch Space.
      if (!swiped && Math.hypot(t.clientX - startX, t.clientY - startY) < 12) {
        if (arcadeGameType === 'snake' && snakeState && snakeState.gameOver) resetArcadeGame('snake');
        else if (arcadeGameType === 'breakout' && breakoutState && (breakoutState.gameOver || breakoutState.won)) resetArcadeGame('breakout');
      }
    }
  };
  cv.addEventListener('touchend', end);
  cv.addEventListener('touchcancel', end);
})();

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
  if (kiosk && kiosk.exitDoor) {
    const b = world.buildings.find(bb => bb.id === indoorBuildingId);
    if (b) exitBuilding(b);
    return;
  }
  if (kiosk && kiosk.game) { openArcadeGame(kiosk.game); return; }
  if (kiosk && kiosk.npc === 'teller') { openBankModal(); return; }
  if (kiosk && kiosk.npc === 'auctioneer') { openAuctionModal(); return; }
  if (kiosk && kiosk.npc === 'courier') { openSendMoneyModal(); return; }
  if (kiosk && (kiosk.portal === 'wilds' || kiosk.portal === 'town') && Date.now() < portalCooldownUntil) return; // just arrived — no instant bounce-back
  if (kiosk && kiosk.portal === 'wilds') { enterWilds(); return; }
  if (kiosk && kiosk.portal === 'town') { exitWilds(); return; }
  if (kiosk && kiosk.portal === 'dungeon_exit') { exitDungeon(); return; }
  if (kiosk && kiosk.portal === 'cave_enter') { enterWitchCave(); return; }
  if (kiosk && kiosk.portal === 'cave_exit') { exitWitchCave(); return; }
  if (kiosk && kiosk.portal === 'vault_enter') { enterVault(); return; }
  if (kiosk && kiosk.portal === 'vault_exit') { exitVault(); return; }
  if (kiosk && kiosk.portal === 'ember_enter') { enterEmberWastes(); return; }
  if (kiosk && kiosk.portal === 'ember_exit') { exitEmberWastes(); return; }
  if (kiosk && kiosk.npc === 'ember_mob') { ws.send(JSON.stringify({ type: 'steal_from_mob', targetId: kiosk.targetId })); return; }
  if (kiosk && kiosk.witch === 'hazel') { ws.send(JSON.stringify({ type: 'witch_talk' })); return; }
  if (kiosk && kiosk.npc === 'npc') { openNpcShopModal(kiosk.npcId); return; }
  if (kiosk && kiosk.npc === 'legend') { openLegendShop(); return; }
  if (kiosk && kiosk.npc === 'board') { openBoardModal(); return; }
  if (kiosk && kiosk.npc === 'delve') { openDelveModal(); return; }
  if (kiosk && kiosk.npc === 'plaque') { openPlaqueModal(); return; }
  if (kiosk && kiosk.npc === 'quest') { openQuestDialogue(kiosk.npcId, kiosk.npcName); return; }
  if (kiosk && kiosk.npc === 'hint') { openNpcHintTalk(kiosk.npcId); return; }
  if (kiosk && kiosk.npc === 'wolf_pact') { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'werewolf_talk' })); return; }
  if (kiosk && kiosk.npc === 'waymark') { ws.send(JSON.stringify({ type: 'read_waymarker', markerId: kiosk.markerId })); return; }
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
  if (!me || passModalOpen || msModalOpen || legendModalOpen || arcadeModalOpen || bankModalOpen || auctionModalOpen || sendMoneyModalOpen || spellConsentOpen || howlConsentOpen || npcShopOpen || witchShopOpen || witchConsentOpen || werewolfShopOpen || werewolfConsentOpen || boardModalOpen || delveModalOpen || covenModalOpen || notifModalOpen) { hint.classList.add('hidden'); return; }
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
  if (kiosk && kiosk.exitDoor) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} pass through the door`;
    return;
  }
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
  if (kiosk && (kiosk.portal === 'wilds' || kiosk.portal === 'town') && Date.now() < portalCooldownUntil) {
    // Traversal grace — keep the tap button off the screen entirely so a
    // thumb aiming for the camera can't re-fire the portal.
    hint.classList.add('hidden');
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
  if (kiosk && kiosk.portal === 'vault_enter') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} enter the vault`;
    return;
  }
  if (kiosk && kiosk.portal === 'vault_exit') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} leave the vault`;
    return;
  }
  if (kiosk && kiosk.portal === 'ember_enter') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} step into the Ember Wastes`;
    return;
  }
  if (kiosk && kiosk.portal === 'ember_exit') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} step back through the portal`;
    return;
  }
  if (kiosk && kiosk.npc === 'ember_mob') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} pick its pocket`;
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
  if (kiosk && kiosk.npc === 'legend') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} browse the Peddler's wonders`;
    return;
  }
  if (kiosk && kiosk.npc === 'board') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} read the town board`;
    return;
  }
  if (kiosk && kiosk.npc === 'delve') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} touch the Delve Stone`;
    return;
  }
  if (kiosk && kiosk.npc === 'plaque') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} read the plaque`;
    return;
  }
  if (kiosk && kiosk.npc === 'quest') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} talk to ${kiosk.npcName}`;
    return;
  }
  if (kiosk && kiosk.npc === 'hint') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} talk to ${kiosk.npcName}`;
    return;
  }
  if (kiosk && kiosk.npc === 'wolf_pact') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} howl with Lexton Greyfur`;
    return;
  }
  if (kiosk && kiosk.npc === 'waymark') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} read the waymarker`;
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
  const _lightbox = document.getElementById('imageLightbox');
  if (_lightbox && !_lightbox.classList.contains('hidden')) {
    if (e.key === 'Escape' && !e.repeat) closeImageLightbox();
    return;
  }
  // ☰ menu sheet claims Escape next — without this, Esc while the menu is
  // open would fall through to "leave building" on desktop.
  const _menuSheet = document.getElementById('menuSheet');
  if (_menuSheet && !_menuSheet.classList.contains('hidden')) {
    if (e.key === 'Escape' && !e.repeat) _menuSheet.classList.add('hidden');
    return;
  }
  if (boardModalOpen) {
    if (e.key === 'Escape' && !e.repeat) closeBoardModal();
    return;
  }
  if (delveModalOpen) {
    if (e.key === 'Escape' && !e.repeat) closeDelveModal();
    return;
  }
  if (covenModalOpen) {
    if (e.key === 'Escape' && !e.repeat) closeCovenModal();
    return;
  }
  if (notifModalOpen) {
    if (e.key === 'Escape' && !e.repeat) { notifModalOpen = false; document.getElementById('notifModal').classList.add('hidden'); }
    return;
  }
  const _letterM = document.getElementById('letterModal');
  if (_letterM && !_letterM.classList.contains('hidden')) {
    if (e.key === 'Escape' && !e.repeat) _letterM.classList.add('hidden');
    return;
  }
  const _plaqueM = document.getElementById('plaqueModal');
  if (_plaqueM && !_plaqueM.classList.contains('hidden')) {
    if (e.key === 'Escape' && !e.repeat) _plaqueM.classList.add('hidden');
    return;
  }
  if (legendModalOpen) {
    if (e.key === 'Escape' && !e.repeat) closeLegendShop();
    return;
  }
  if (msModalOpen) {
    if (e.key === 'Escape' && !e.repeat) closeMsModal();
    return;
  }
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
  if (journalOpen && e.key === 'Escape' && !e.repeat) {
    closeJournal();
    return;
  }
  if (skillsOpen && e.key === 'Escape' && !e.repeat) {
    closeSkills();
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
  if (werewolfConsentOpen) {
    if (e.key === 'Escape' && !e.repeat) {
      ws.send(JSON.stringify({ type: 'werewolf_voice_payment', consentId: activeWerewolfConsentId, audio: null }));
      closeWerewolfVoiceConsent();
    }
    return;
  }
  if (werewolfShopOpen) {
    if (e.key === 'Escape' && !e.repeat) closeWerewolfModal();
    return;
  }
  if (arcadeModalOpen) return; // the dedicated arcade-game keydown listener owns Escape/controls while playing
  if (inventoryOpen && e.key === 'Escape' && !e.repeat) { toggleInventory(); return; }
  if (armedTarget && e.key === 'Escape' && !e.repeat) { cancelTargeting(); return; }
  // I = open/close inventory, same toggle the HUD button already calls
  if ((e.key === 'i' || e.key === 'I') && !e.repeat) { toggleInventory(); return; }
  // J = open/close the story Journal, same toggle as its HUD button
  if ((e.key === 'j' || e.key === 'J') && !e.repeat) { if (journalOpen) closeJournal(); else openJournal(); return; }
  if ((e.key === 'k' || e.key === 'K') && !e.repeat) { if (skillsOpen) closeSkills(); else openSkills(); return; }
  // R = quick-strike nearest enemy
  if ((e.key === 'r' || e.key === 'R') && !e.repeat && !armedTarget) { strikeNearestEnemy(); return; }
  // V = voice countermeasure (play a saved clip to evade), P = snapshot,
  // T = emote wheel
  if ((e.key === 'v' || e.key === 'V') && !e.repeat) { fireVoiceCountermeasure(); return; }
  if ((e.key === 'p' || e.key === 'P') && !e.repeat) { snapNearestPlayer(); return; }
  if ((e.key === 't' || e.key === 'T') && !e.repeat) { toggleEmoteWheel(); return; }
  if (myActionCatalog && !e.repeat) {
    const slot = HOTBAR_KEYS.indexOf(e.key);
    if (slot !== -1) {
      const id = orderedAbilityIds()[slot]; // keys follow YOUR order (see loadout)
      if (id) { castFromHotbar(id); return; }
    }
  }
  if ((e.key === 'h' || e.key === 'H') && !e.repeat) { toggleControlsModal(); return; }
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
  // me.x/me.y (outdoor coords) are still wherever the player was standing
  // when they walked into the building's footprint — right at the door
  // gap, since indoor/outdoor share the same coordinate space that's
  // exactly on top of the door's own collider now that the door is a real
  // closed wall segment (see getInteriorScene's isDoorCollider) instead of
  // an open gap. Starting *inside* a solid rect isn't something
  // collidesIndoor's "block this movement" check ever resolves — it only
  // stops you from moving further into one, so spawning already inside it
  // left every door in town stuck-on-entry. Nudge to a safe spot just past
  // the threshold instead, same idea as the outward nudge exitBuilding()
  // already does when leaving.
  const b = world.buildings.find(bb => bb.id === roomId);
  if (b) {
    const side = getDoorSide(b);
    const wt = world.wallThickness;
    const localDoorStart = interior.doorStart / INDOOR_SCALE, localDoorEnd = interior.doorEnd / INDOOR_SCALE;
    const doorMidLocal = (localDoorStart + localDoorEnd) / 2;
    const clearance = wt + PLAYER_R * 2;
    let localX, localY;
    if (side === 'east') { localX = interior.localW - clearance; localY = doorMidLocal; }
    else if (side === 'west') { localX = clearance; localY = doorMidLocal; }
    else if (side === 'north') { localX = doorMidLocal; localY = clearance; }
    else { localX = doorMidLocal; localY = interior.localH - clearance; }
    me.x = b.x + localX;
    me.y = b.y + localY;
  }
  setActiveContext(interior.scene, interior.camera, interior);
  maybeUpdateRoomUI(roomId);
  if (roomId === 'cafe') startMusic('ember_jig', { roomTune: true }); else stopMusic({ roomTune: true }); // the tavern tune belongs to the tavern — unless the player picked their own
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
  stopMusic({ roomTune: true }); // a player-picked track keeps playing outdoors
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
  if (world === world2 || world === DUNGEON_WORLD || world === CAVE_WORLD || world === VAULT_WORLD || world === EMBER_WORLD || me.room === 'witch_cave' || me.room === 'bank_vault' || me.room === 'ember_wastes') {
    if (!collides(nx, me.y)) me.x = nx;
    if (!collides(me.x, ny)) me.y = ny;
    const inCave = world === CAVE_WORLD || me.room === 'witch_cave';
    const inVault = world === VAULT_WORLD || me.room === 'bank_vault';
    const inEmber = world === EMBER_WORLD || me.room === 'ember_wastes';
    const boundsW = inCave ? CAVE_WORLD.width : inVault ? VAULT_WORLD.width : inEmber ? EMBER_WORLD.width : world.width;
    const boundsH = inCave ? CAVE_WORLD.height : inVault ? VAULT_WORLD.height : inEmber ? EMBER_WORLD.height : world.height;
    me.x = Math.max(PLAYER_R, Math.min(boundsW - PLAYER_R, me.x));
    me.y = Math.max(PLAYER_R, Math.min(boundsH - PLAYER_R, me.y));
    if (inCave) { me.room = 'witch_cave'; }
    else if (inVault) { me.room = 'bank_vault'; }
    else if (inEmber) { me.room = 'ember_wastes'; }
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

  let localX = me.x - b.x, localY = me.y - b.y;
  const nx = localX + stepX, ny = localY + stepY;

  // The door gap now has a real collider (isDoorCollider, see
  // getInteriorScene) just like any other wall — collidesIndoor blocks it
  // the same way. Leaving is only ever triggered by the exitDoor kiosk (F
  // key, see tryInteract()), not by walking into this position at all
  // anymore — a door that looks closed should actually behave closed.
  if (!collidesIndoor(nx, localY, interior.wallsLocal)) localX = nx;
  if (!collidesIndoor(localX, ny, interior.wallsLocal)) localY = ny;

  localX = Math.max(PLAYER_R, Math.min(interior.localW - PLAYER_R, localX));
  localY = Math.max(PLAYER_R, Math.min(interior.localH - PLAYER_R, localY));
  me.x = b.x + localX;
  me.y = b.y + localY;
}

// ── 🎮 Controller support (Session L) ────────────────────────────────────────
// Standard-mapping gamepads (Xbox/PS/most others): left stick walks with the
// same camera-relative steering as the touch joystick, right stick orbits
// the camera, and the face buttons drive the existing actions — no parallel
// systems, every button lands on a function the keyboard/touch UI already
// uses. Table stakes for the desktop build, per the top-10 review.
const gamepadVec = { x: 0, y: 0 };
let gamepadButtonsPrev = [];
let gamepadToastShown = false;
const GAMEPAD_DEADZONE = 0.18;
window.addEventListener('gamepadconnected', (e) => {
  if (!gamepadToastShown) {
    gamepadToastShown = true;
    setUnlockToast('🎮 Controller connected — stick walks, Ⓐ interacts, Ⓧ strikes, bumpers cast, ☰ on Start.');
  }
});
function pollGamepad(dt) {
  gamepadVec.x = 0; gamepadVec.y = 0;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let pad = null;
  for (const p of pads) { if (p && p.connected) { pad = p; break; } }
  if (!pad) { gamepadButtonsPrev = []; return; }
  // Left stick → movement vector (same shape the touch joystick produces).
  const lx = pad.axes[0] || 0, ly = pad.axes[1] || 0;
  if (Math.hypot(lx, ly) > GAMEPAD_DEADZONE && !typing && !seatedAt) {
    gamepadVec.x = lx;
    gamepadVec.y = ly;
  }
  // Right stick X → camera orbit (mouse-drag equivalent; movement folds it
  // back in through the steering math, so it never fights the character).
  const rx = pad.axes[2] || 0;
  if (Math.abs(rx) > GAMEPAD_DEADZONE) cameraYawOffset -= rx * 2.6 * dt;
  // Buttons, edge-triggered.
  const pressed = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
  const justPressed = (i) => pressed(i) && !gamepadButtonsPrev[i];
  const sheet = document.getElementById('menuSheet');
  const sheetOpen = sheet && !sheet.classList.contains('hidden');
  const anyModal = boardModalOpen || delveModalOpen || covenModalOpen || notifModalOpen || passModalOpen || msModalOpen || legendModalOpen || arcadeModalOpen || bankModalOpen || auctionModalOpen;
  if (justPressed(9)) { // Start → ☰
    if (sheet) sheet.classList.toggle('hidden');
  }
  if (justPressed(1)) { // B → close what's open, else hop
    if (sheetOpen || anyModal) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    else if (typeof tryJump === 'function') tryJump();
  }
  if (!sheetOpen && !anyModal && !typing) {
    if (justPressed(0)) tryInteract();                                    // A → F
    if (justPressed(2) && me && !me.isDead) strikeNearestEnemy();         // X → strike
    if (justPressed(3)) { const b = document.getElementById('btnKit'); if (b) b.click(); } // Y → kit
    if (justPressed(8)) { if (!journalOpen) openJournal(); }              // Back → journal
    const qs = ['qs1', 'qs2', 'qs3'];
    [[4, 0], [5, 1], [7, 2]].forEach(([btn, slot]) => {                   // LB/RB/RT → quickslots
      if (justPressed(btn)) { const el = document.getElementById(qs[slot]); if (el && !el.classList.contains('hidden')) el.click(); }
    });
  }
  gamepadButtonsPrev = pad.buttons.map(b => !!b.pressed);
}

function update(dt) {
  if (!me) return;
  pollGamepad(dt);

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
    // 🎮 Controller left stick (Session L) rides the same camera-relative
    // math as the touch joystick — one steering model everywhere. Touch
    // input wins if both are somehow live at once.
    const stickVec = (joyVec.x || joyVec.y) ? joyVec : gamepadVec;
    if (stickVec.x || stickVec.y) {
      if (MOBILE_UI || stickVec === gamepadVec) {
        // Camera-relative movement — the stick points where you want to
        // GO on screen and the character turns to run that way. The
        // subtlety: the VIEW must hold still while you steer. If the
        // camera chases in behind the runner every frame, "right"
        // continuously re-aims and a held stick spins you in circles
        // (v1 of this did exactly that, and read as hyperspeed turning).
        // Rule: the screen-up world yaw (facing + cameraYawOffset) is the
        // reference; facing turns toward reference + stickAngle, and the
        // offset is rewritten each frame so the reference — the view —
        // stays exactly where it was. Held right = one clean 90° turn,
        // then a straight run watched from the side. Running forward
        // naturally converges the offset to 0 (camera behind). A camera
        // drag with the other thumb shifts the reference, re-aiming the
        // run mid-stride — two-thumb steering, exactly as it should be.
        const mag = Math.min(1, Math.hypot(stickVec.x, stickVec.y));
        if (mag > 0.14) {
          // Sign note: in this engine "turn right on screen" = facing
          // DECREASES (see the desktop mapping below: turnInput -=
          // joyVec.x). The stick angle follows the same handedness —
          // without the negated x, left and right swap.
          const stickAngle = Math.atan2(-stickVec.x, -stickVec.y); // 0 = screen-up
          const viewYaw = me.facing + cameraYawOffset;
          const desired = viewYaw + stickAngle;
          let diff = desired - me.facing;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          // ~260°/s: a 180 takes ~0.7s — brisk but visible. (First pass
          // was 9 rad/s, which read as teleport-spinning.)
          const maxTurn = 4.5 * dt;
          me.facing += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
          cameraYawOffset = viewYaw - me.facing; // the view holds still while steering
          // Ease off the throttle while still turning hard so the model
          // doesn't moonwalk sideways through a 180.
          moveInput += mag * Math.max(0.25, Math.cos(Math.min(Math.abs(diff), Math.PI / 2)));
        }
      } else {
        moveInput += -stickVec.y; // push stick up = walk forward
        turnInput -= stickVec.x;  // push stick right = turn right (was inverted)
      }
    }
  }
  moveInput = Math.max(-1, Math.min(1, moveInput));
  turnInput = Math.max(-1, Math.min(1, turnInput));
  strafeInput = Math.max(-1, Math.min(1, strafeInput));

  // The instant the player actually moves or turns, snap any mouse-drag
  // camera orbit back to normal (directly behind the character) — otherwise
  // "forward" on screen and "forward" for the character can point two
  // different ways, which is exactly the confusing case being avoided here.
  // Mobile joystick movement is exempt: it folds the offset in smoothly
  // (see above) rather than snapping.
  if ((moveInput !== 0 || turnInput !== 0 || strafeInput !== 0) && !(MOBILE_UI && joyActive) && !(gamepadVec.x || gamepadVec.y)) cameraYawOffset = 0;

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
  // Raven's Cloak is the Witch's escape tool — the dark-feather visual plus
  // the same doubled pace speedboost/wolfpact already grant.
  if (me.activeStatus && me.activeStatus.type === 'ravencloak') speed *= 2;
  // Predator's Pace / Trailblazer (the 'swift' skill) — a permanent, stacking
  // walk-speed bonus, self-enforced client-side exactly like the statuses above.
  if (mySkillSpeedMult && mySkillSpeedMult !== 1) speed *= mySkillSpeedMult;
  // Cat Step and its delve kin — swift boons apply only inside the run's
  // own floors (the multiplier arrives with each delve_state).
  if (delveSpeedMult !== 1 && me && typeof me.room === 'string' && me.room.startsWith('dungeon_delve_')) speed *= delveSpeedMult;
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
  KK.tick(dt);
  LEGEND_FX.tick(dt);
  if (peddlerStallGroup && peddlerStallGroup.userData.tick) peddlerStallGroup.userData.tick(performance.now() / 1000);
  if (delveStoneGroup && delveStoneGroup.userData.tick) delveStoneGroup.userData.tick(performance.now() / 1000);
  updateAnimalVisuals(dt);
  updateMobVisuals(dt);
  updateAnimal2Visuals(dt);
  updateMob2Visuals(dt);
  updateVillageNpcVisuals(dt);
  updateTownTorchNpcVisuals(dt);
  updateDungeonMobVisuals(dt);
  updateEmberMobVisuals(dt);
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
  updateFireballs();
  updateGroundTrapVisuals();
  updateHotbarCooldown();
  updateWerewolfNpc(dt);
  updateVoiceRings(dt);
  updateEvasionVisual();
  updateEmoteFloats();
  updateWandLights();
  updateCameraGlide(dt);
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
  GFX.beforeRender();
  if (GFX.composerActive()) {
    GFX.renderPass.scene = activeScene;
    GFX.renderPass.camera = activeCamera;
    GFX.composer.render();
  } else {
    renderer.render(activeScene, activeCamera);
  }
  syncLabels();
  updateNameLabelHover();
  updateLootIcons();
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ── Seamless return from Stripe Checkout ────────────────────────────────────
// The redirect to Stripe kills the page (and with it a guest's whole
// world). startPassCheckout() stashed a one-time resume token in
// sessionStorage before leaving; if this page load is the bounce-back
// (returnedFromCheckout, set by checkReturnFromCheckout above), skip the
// join screen entirely and rejoin with the token — the server rebuilds the
// same character in the same spot, and init's `resumed` flag swaps the
// view to match via restoreSceneForRoom().

function showResumeUi(show) {
  const screen = document.getElementById('joinScreen');
  if (!screen) return;
  const card = screen.querySelector('.card');
  if (card) card.style.display = show ? 'none' : '';
  let note = document.getElementById('resumeNote');
  if (!note) {
    if (!show) return;
    note = document.createElement('div');
    note.id = 'resumeNote';
    note.style.cssText = 'color:#9ee37d;font-size:16px;font-weight:700;text-align:center;text-shadow:0 2px 12px rgba(0,0,0,0.6);';
    screen.appendChild(note);
  }
  note.textContent = '🌀 Rejoining the town…';
  note.style.display = show ? '' : 'none';
}

// Point the client's view at whatever room the server restored us into —
// the visual half of each enter* path, without re-sending moves or toasts.
function restoreSceneForRoom(room) {
  if (!me) return;
  if (world && world.buildings.some(b => b.id === room)) {
    const keep = { x: me.x, y: me.y };
    enterBuilding(room);
    me.x = keep.x; // exact stashed spot, not enterBuilding's door nudge
    me.y = keep.y;
    return;
  }
  if (room === 'wilds') { swapToWildsMap(); maybeUpdateRoomUI('wilds'); return; }
  if (room === 'witch_cave') { swapToCaveMap(); maybeUpdateRoomUI(room); return; }
  if (room === 'bank_vault') { swapToVaultMap(); maybeUpdateRoomUI(room); return; }
  if (room === 'ember_wastes') { swapToEmberMap(); maybeUpdateRoomUI(room); return; }
  maybeUpdateRoomUI('outside');
}

(function maybeAutoResume() {
  // Two flavors of "pick up where I left off", in priority order:
  //  1. Checkout return (tc_resume) — minted right before the Stripe
  //     redirect, 15-minute server stash.
  //  2. Live session (tc_live_resume) — minted at every join; the server
  //     stashes the player when the socket dies, 30-minute stash. Covers a
  //     phone reopening a killed tab and accidental refreshes: the page
  //     loads, finds the recent token, and quietly resumes the same
  //     character. (Want a genuinely fresh start? A new tab has no token —
  //     sessionStorage is per-tab.)
  let saved = null;
  let windowMs = 14 * 60 * 1000; // just under the server's checkout stash TTL
  if (returnedFromCheckout) {
    try { saved = JSON.parse(sessionStorage.getItem('tc_resume') || 'null'); } catch (e) {}
  }
  if (!saved || !saved.token) {
    try { saved = JSON.parse(sessionStorage.getItem('tc_live_resume') || 'null'); } catch (e) {}
    windowMs = 28 * 60 * 1000; // just under the server's disconnect stash TTL
  }
  try { sessionStorage.removeItem('tc_resume'); } catch (e) {} // strictly single-shot
  try { sessionStorage.removeItem('tc_live_resume'); } catch (e) {}
  if (!saved || !saved.token) return;
  if (Date.now() - (saved.at || 0) > windowMs) return; // older than the server stash lives
  resumeFallbackName = saved.name || '';
  showResumeUi(true);
  const payload = { type: 'join', resumeToken: saved.token };
  try { const a = JSON.parse(localStorage.getItem('tc_account') || 'null'); if (a && a.token) payload.accountToken = a.token; } catch (e) {}
  if (passSessionReceipt()) payload.passSession = passSessionReceipt();
  lastJoinPayload = payload; // the reconnect path reuses the same payload
  const sendJoin = () => ws.send(JSON.stringify(payload));
  if (ws && ws.readyState === WebSocket.OPEN) sendJoin();
  else ws.addEventListener('open', sendJoin, { once: true });
})();

// Test seam — exists only when the page is loaded with ?testdrive=1 (the
// headless UI harness in test/mobile-shots.cjs uses it to teleport around
// and read HUD state). The whole client is an IIFE, so without this there
// is deliberately no scriptable surface at all; with it, still nothing a
// player couldn't already do by walking.
if (location.search.includes('testdrive=1')) {
  window.__testDrive = {
    teleport(x, y) { if (me) { me.x = x; me.y = y; } },
    kiosks() { return OUTDOOR_KIOSKS.map(k => ({ ...k })); },
    world() { return world ? { buildings: world.buildings, spawn: world.spawn } : null; },
    me() { return me ? { x: me.x, y: me.y, room: me.room, charId: me.charId } : null; },
    hint() { updateInteractHint(); const h = document.getElementById('interactHint'); return h.classList.contains('hidden') ? null : document.getElementById('interactHintText').textContent; },
    simulateStruck(dmg) { flashDamage(); spawnDmgNum(window.innerWidth / 2, window.innerHeight / 2, dmg || 7, 'selfHit'); shakeScreen('S'); },
    spawnNum(x, y, dmg, kind) { spawnDmgNum(x, y, dmg, kind); },
    emoteFloat(em) { if (me) spawnEmoteFloat(myId, em); },
    refreshHud() { refreshMobileHud(); },
    // ── additions for the deeper QA sweep (still nothing a player can't
    //    already do by walking/tapping — these just skip the raycasts the
    //    headless renderer stub can't perform) ──
    send(payload) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); },
    state() {
      return me ? {
        x: me.x, y: me.y, room: me.room, charId: me.charId,
        health: me.health, level: me.level, isDead: !!me.isDead,
        status: me.activeStatus ? me.activeStatus.type : null,
        facing: me.facing, players: Object.keys(players).length
      } : null;
    },
    mobs() { return Object.entries(mobVisuals).map(([id, m]) => ({ id, x: m.x, y: m.y, dead: !!m.dead })); },
    animals() { return Object.entries(animalVisuals).map(([id, a]) => ({ id, x: a.x, y: a.y, dead: !!a.dead })); },
    interact() { tryInteract(); },
    face(angle) { if (me) { me.facing = angle; cameraYawOffset = 0; } },
    interiorKiosks() {
      if (!currentInterior || !me) return [];
      return currentInterior.kiosks.map(k => ({ ...k, world: sceneToWorldPos(me.room, k.x, k.z) }));
    },
    isNight() { return getDayNightState().isNight; },
    music() { return { choice: musicChoice, playing: musicPlaying, trackId: musicTrackId, roomTune: musicIsRoomTune, ctx: audioCtx ? audioCtx.state : null }; },
    // Session I QA probes: collision registries + direct status-visual pokes
    wallsCount() { return { active: walls.length, town: TOWN_WALLS ? TOWN_WALLS.length : -1, wilds: WILDS_WALLS.length }; },
    applyStatus(type) { applyStatusVisual(myId, type ? { type, expiresAt: Date.now() + 10000 } : null); },
    fxInfo() {
      const out = [];
      for (const id in visuals) {
        const v = visuals[id];
        if (v.legendFx) out.push({ id, key: v.legendFxKey, updaters: v.legendFx.updaters.length, sprites: v.legendFx.group.children.length });
      }
      return out;
    },
    armed() { return armedTarget ? armedTarget.name : null; },
    // Name-label fade QA (mobile "announce then fade" — the Torchkeeper Ada
    // report). Returns the active-scene name sprites with world x/z, whether
    // they're currently shown, and their material opacity.
    nameLabels() {
      return HOVER_NAME_SPRITES
        .filter(s => s.parent && activeScene && getRootScene(s) === activeScene)
        .map(s => { s.getWorldPosition(_hoverTmpVec3); return { x: _hoverTmpVec3.x, z: _hoverTmpVec3.z, visible: !!s.visible, op: s.material ? Math.round((s.material.opacity == null ? 1 : s.material.opacity) * 100) / 100 : 1 }; });
    },
    // Session L addendum QA probes: drive the hotbar cast path directly and
    // read the client-side cooldown ledger (found while chasing a live
    // mobile fireball report).
    castHotbar(id) { castFromHotbar(id); },
    cooldowns() { const out = {}; for (const k in actionCooldownEndAt) out[k] = Math.round(actionCooldownEndAt[k] - performance.now()); return out; },
    actionCatalog() { return myActionCatalog ? Object.keys(myActionCatalog) : null; },
    players() { return Object.entries(players).map(([id, p]) => ({ id, name: p.name, x: p.x, y: p.y, room: p.room, isMe: id === myId })); },
    sceneCounts() {
      const count = (s) => { let n = 0; if (s) s.traverse(() => n++); return n; };
      return { town: count(outdoorScene), wilds: count(wildsScene) };
    },
    lampGlow() { return { count: LAMP_GLOWS.length, opacity: LAMP_GLOWS.length ? LAMP_GLOWS[0].glowMat.opacity : 0 }; },
    // ── stair/graphics QA (Session G) — read-only probes ──
    stairZones() { return KK_STAIR_ZONES.map(z => ({ side: z.side, cx: z.cx, cz: z.cz, out: z.out, step: z.step, depth: z.depth, halfWidth: z.halfWidth, profile: z.profile.slice() })); },
    floorH(x, z) { return getFloorHeight('outside', x, z); },
    visualY() { const v = visuals[myId]; return v ? v.group.position.y : null; },
    camPose() { return activeCamera ? { y: activeCamera.position.y, qx: activeCamera.quaternion.x, qw: activeCamera.quaternion.w } : null; },
    doors() { return world ? world.buildings.map(b => ({ id: b.id, side: getDoorSide(b), door: getDoorWorldPos(b) })) : []; },
    camInfo() { return activeCamera ? { near: activeCamera.near, far: activeCamera.far, fov: activeCamera.fov } : null; },
    lastToast() { const el = document.getElementById('unlockToast'); return el && !el.classList.contains('hidden') ? el.textContent : null; },
    wandVisual() {
      const v = visuals[myId];
      if (!v) return null;
      const pool = wandLightPools.get(activeScene);
      return {
        weaponItem: v.weaponMeshItemId || null,
        aura: !!v.wandAura, auraOpacity: v.wandAura ? v.wandAura.material.opacity : 0,
        tipGlow: !!(v.weaponMesh && v.weaponMesh.userData.wandTipGlow),
        lightIntensities: pool ? pool.map(L => Math.round(L.intensity * 100) / 100) : []
      };
    },
    camBlockCheck() {
      // is the camera inside any building blocker box right now?
      const c = activeCamera.position;
      for (const k of KK_CAM_BLOCKERS) {
        if (c.x > k.minX && c.x < k.maxX && c.z > k.minZ && c.z < k.maxZ && c.y < k.maxY) return true;
      }
      return false;
    },
    fadedCount() { let n = 0; camFadeState.forEach(s => { if (s.amount > 0.3) n++; }); return n; },
    fadeListSize() { return activeScene ? camFadeablesFor(activeScene).length : -1; },
    camDebug() {
      const rp = getRenderPos(me);
      return { cam: { x: activeCamera.position.x, y: activeCamera.position.y, z: activeCamera.position.z },
        anchor: { x: rp.x, z: rp.z }, blockers: KK_CAM_BLOCKERS.length,
        gfx: GFX.st.quality };
    },
    segT(ax, ay, az, bx, by, bz) { return KK_CAM_BLOCKERS.map(k => Math.round(segBlockerT(ax, ay, az, bx, by, bz, k) * 1000) / 1000); },
    sunSnap() { const i = GFX.st.scenes.get(activeScene); return i && i.sun ? { tx: i.sun.target.position.x, tz: i.sun.target.position.z } : null; },
    gfxInfo() {
      const r = renderer;
      return { quality: GFX.qualityLevel ? GFX.qualityLevel() : 'n/a', shadows: r ? r.shadowMap.enabled : false, logDepth: r ? !!r.capabilities.logarithmicDepthBuffer : false };
    },
    // Raycast a height grid against the static outdoor scene — the honest
    // answer to "what's the geometry outside this door", no zone bookkeeping.
    groundGrid(x0, z0, x1, z1, step) {
      const ray = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);
      const o = new THREE.Vector3();
      const meshes = [];
      outdoorScene.traverse(obj => { if (obj.isMesh) meshes.push(obj); });
      const rows = [];
      for (let z = z0; z <= z1; z += step) {
        const row = [];
        for (let x = x0; x <= x1; x += step) {
          o.set(x, 55, z);
          ray.set(o, down);
          const hits = ray.intersectObjects(meshes, false);
          let h = 0;
          for (const hit of hits) { if (hit.point.y <= 45) { h = hit.point.y; break; } }
          row.push(Math.round(h * 10) / 10);
        }
        rows.push(row);
      }
      return rows;
    }
  };
}

})();
