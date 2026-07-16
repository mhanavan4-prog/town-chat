import createAudio from './audio.js';
import createCollision from './collision.js';
import { Modals } from './modals.js';
import createShop from './shop.js';
import createSpellbook from './spellbook.js';
import createAttacks from './attacks.js';
import createBoard from './board.js';
import createDelve from './delve.js';
import createCoven from './coven.js';
import createNotif from './notif.js';
import createLegendShop from './legend.js';
import createConsent from './consent.js';
import createVaultScene from './vault-scene.js';
import createCaveScene from './cave-scene.js';
import createDungeonScene from './dungeon-scene.js';
import createEmberScene from './ember-scene.js';
import createTownProps from './props-town.js';
import { makeTree, makeShrub, makeRock, makeFlowerPatch, makePlantBloom, makePlantMushroom, makePlantSprout, PLANT_VISUALS } from './props-nature.js';
import { makeGrassTexture, makeGlowTexture, makeMoorTexture, makeFlagstoneTexture, makeStoneTexture, makeWhiteStoneTexture, makeWoodSidingTexture, makeShingleTexture, makePentacleTexture, makeSigilFloorTexture } from './textures.js';
import createCreatures from './creatures.js';
import { makeHealthBarSprite, updateHealthBar, makeLootIconSprite, makeSignSprite, makeNpcNameSprite, HOVER_NAME_SPRITES } from './sprites.js';
import createWildsScene from './wilds-scene.js';
import createTownScene from './town-scene.js';
import createMobsTown from './mobs-town.js';
import createMobMeshes from './mob-meshes.js';
import createMobsWilds from './mobs-wilds.js';
import createEmberMobs from './ember-mobs.js';
import createDungeonMobs from './dungeon-mobs.js';
import createVillageNpcs from './village-npcs.js';
import createHumanoidBuilder from './humanoid.js';
import createJournalSkills from './journal-skills.js';
import createBankAuction from './bank-auction.js';
import createNotesDrive from './notes-drive.js';
import createInventoryPanel from './inventory-panel.js';
import createPlayerVisuals from './player-visuals.js';
import createFurniture from './furniture.js';
import createInteriorScene from './interior-scene.js';
import createAccountSelect from './account-select.js';
import createHud from './hud.js';
import createLoadout from './loadout.js';
import createGroundTraps from './ground-traps.js';
import createFireballs from './fireballs.js';
import createMobileHud from './mobile-hud.js';
import createOverheadBubbles from './overhead-bubbles.js';
import createBuildingMesh from './building-mesh.js';
import createTownTorchNpcs from './town-torch-npcs.js';
import createDayNight from './day-night.js';
import createEquipVisuals from './equip-visuals.js';
import createMoonstones from './moonstones.js';


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
// --- Mobile (Capacitor) server plumbing --------------------------------------
// The packaged apps load this file from capacitor://localhost, so the game
// server is a REMOTE origin. config.js (loaded just before this file) sets
// window.TOWNCHAT_SERVER to the deployed server; when it's empty/undefined
// (the plain web build) everything falls back to same-origin, unchanged.
const SERVER_ORIGIN = (typeof window !== 'undefined' && window.TOWNCHAT_SERVER)
  ? String(window.TOWNCHAT_SERVER).replace(/\/+$/, '') : '';
function apiUrl(path) { return SERVER_ORIGIN ? SERVER_ORIGIN + path : path; }
function wsUrl() {
  if (!SERVER_ORIGIN) return proto + '://' + location.host;
  return SERVER_ORIGIN.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
}

// == Client error telemetry (Tier 3.1) =======================================
// Uncaught client crashes used to be invisible: a broken build could ship and
// only show up as "the game won't load," with zero signal server-side. These
// handlers forward the technical shape of a crash to /api/client-error so it
// lands in the logs. Deliberately NO player data - no names, chat, positions,
// or media; message/stack/source only.
(function installErrorTelemetry() {
  let sent = 0;
  const MAX_PER_LOAD = 8;          // never flood the server from a single tab
  const seen = new Set();          // collapse identical repeats within a load
  function report(kind, message, source, line, col, stack) {
    try {
      if (sent >= MAX_PER_LOAD) return;
      const key = kind + '|' + (message || '') + '|' + (line || '');
      if (seen.has(key)) return;
      seen.add(key); sent++;
      const body = JSON.stringify({
        kind: String(kind || 'error').slice(0, 32),
        message: String(message || '').slice(0, 500),
        source: String(source || (location && location.pathname) || '').slice(0, 300),
        line: line || 0, col: col || 0,
        stack: String(stack || '').slice(0, 2000),
        ua: ((navigator && navigator.userAgent) || '').slice(0, 200),
        at: Date.now()
      });
      // keepalive lets the report flush even as the page tears down after the
      // crash; .catch swallows failures so telemetry can never itself throw.
      fetch(apiUrl('/api/client-error'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: body, keepalive: true
      }).catch(function () {});
    } catch (_e) { /* telemetry must never break the app */ }
  }
  window.addEventListener('error', function (e) {
    report('error', e && e.message, e && e.filename, e && e.lineno, e && e.colno, e && e.error && e.error.stack);
  });
  window.addEventListener('unhandledrejection', function (e) {
    const r = e && e.reason;
    report('unhandledrejection', (r && r.message) || String(r), '', 0, 0, r && r.stack);
  });
})();

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
const DUNGEON_WORLD = { width: 1200, height: 1200, buildings: [], spawn: { x: 600, y: 1080 } };
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
  glimmerdust:    { name: 'Glimmerdust',    icon: '✨', slot: null, desc: 'Scale-dust shed by embermoths; it keeps a faint light for hours after it falls.' },
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
  ws = new WebSocket(wsUrl());
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
      for (const lgId in msg.legendaryCatalog) {
        const lg = msg.legendaryCatalog[lgId];
        ITEM_CATALOG[lgId] = { name: lg.name, icon: lg.icon, slot: lg.slot, desc: lg.desc, legendary: true, tier: lg.tier, fx: lg.fx };
      }
    }
    // Base item catalog also rides in on init (server-authoritative for item
    // EXISTENCE) — this closes the render-gap class where a server-only item
    // (e.g. a fresh creature drop) had no client entry to draw. Additive: only
    // fills items the client lacks, so existing rich entries (stats/descriptions
    // authored here) are preserved untouched.
    if (msg.itemCatalog) {
      for (const _iid in msg.itemCatalog) {
        if (!ITEM_CATALOG[_iid]) {
          const _it = msg.itemCatalog[_iid];
          ITEM_CATALOG[_iid] = { name: _it.name, icon: _it.icon, slot: _it.slot, desc: _it.desc || '' };
        }
      }
    }
    myMoonstones = msg.moonstones || 0;
    if (msg.msPacks) msPacksCatalog = msg.msPacks;
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
    if (Modals.isOpen('inventoryOpen')) refreshNoteRecipients();
    return;
  }

  if (msg.type === 'player_left') {
    removePlayer(msg.id);
    if (Modals.isOpen('inventoryOpen')) refreshNoteRecipients();
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
    if (msg.mobs3) applyMob3State(msg.mobs3);
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
    // A craft (Holly Wand / Bloodmoon Circlet) just changed our item counts.
    // The grid already refreshed via the inventory_state sent right before
    // this, but the open item-detail panel — the "(have N)" label, the
    // "X/5" build note, and the Build button's enabled state — is only
    // rebuilt by selectInvSlot. Re-run it for the current selection so the
    // count updates instantly instead of staying stale until you click away
    // and back.
    if (Modals.isOpen('inventoryOpen') && invItemsTabActive && selectedInvSlotIdx != null
        && lastInventoryState && lastInventoryState.slots) {
      selectInvSlot(selectedInvSlotIdx);
    }
    return;
  }

  if (msg.type === 'craft_error') {
    if (Modals.isOpen('inventoryOpen') && invItemsTabActive) document.getElementById('invModalErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'use_error') {
    if (Modals.isOpen('inventoryOpen') && invItemsTabActive) document.getElementById('invModalErr').textContent = msg.message;
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
    if (Modals.isOpen('journalOpen')) renderJournal();
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
    if (Modals.isOpen('journalOpen')) renderJournal();
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
    if (Modals.isOpen('skillsOpen')) renderSkills();
    return;
  }

  if (msg.type === 'level_up') {
    if (me) { me.level = msg.level; me.skillPoints = msg.skillPoints; }
    updateXPDisplay();
    updateSkillsBadge();
    if (Modals.isOpen('skillsOpen')) renderSkills();
    setUnlockToast(msg.message);
    appendSystemChatLine(msg.message);
    // Leveling matters more now (chapters gate on it) — give it a beat.
    showChapterCeremony(`⬆️ Level ${msg.level}`, 'A skill point earned — spend it in 🌟 Skills.');
    if (Modals.isOpen('journalOpen')) renderJournal();
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
    if (Modals.isOpen('skillsOpen')) renderSkills();
    if (Modals.isOpen('inventoryOpen')) { renderStats(); refreshEquipPreview(); }
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
    if (errEl && Modals.isOpen('skillsOpen')) { errEl.textContent = msg.message; setTimeout(() => { if (errEl.textContent === msg.message) errEl.textContent = ''; }, 3200); }
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
    if (Modals.isOpen('boardModalOpen')) renderBoardModal();
    return;
  }

  if (msg.type === 'delve_state') {
    delveState = msg;
    delveSpeedMult = msg.inRun ? (msg.speedMult || 1) : 1;
    renderDelveHud();
    if (Modals.isOpen('delveModalOpen')) renderDelveModal();
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
    if (Modals.isOpen('delveModalOpen')) document.getElementById('delveErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'coven_state') {
    covenState = msg.coven || null;
    refreshCovenMenuRow();
    if (Modals.isOpen('covenModalOpen')) renderCovenModal();
    return;
  }

  if (msg.type === 'coven_msg') {
    covenChatLines.push({ who: msg.fromName, sigil: msg.sigil, text: msg.text });
    if (covenChatLines.length > 60) covenChatLines = covenChatLines.slice(-60);
    const chatVisible = Modals.isOpen('covenModalOpen') && !document.getElementById('covenChatView').classList.contains('hidden');
    if (chatVisible) renderCovenChat();
    else {
      covenUnread++;
      refreshCovenMenuRow();
      if (!Modals.isOpen('covenModalOpen')) setUnlockToast(`${msg.sigil} ${msg.fromName}: ${msg.text.slice(0, 60)}`);
    }
    return;
  }

  if (msg.type === 'coven_invited') {
    openCovenInviteToast(msg);
    return;
  }

  if (msg.type === 'coven_error') {
    if (Modals.isOpen('covenModalOpen')) document.getElementById('covenErr').textContent = msg.message;
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
    activeDungeonTier = msg.tier || 1;
    activeDungeonIsDelve = !!msg.delve;
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
    if (Modals.isOpen('auctionModalOpen')) populateAuctionItemSelect();
    if (Modals.isOpen('sendMoneyModalOpen')) {
      const bal = document.getElementById('sendMoneyBalance');
      if (bal) bal.textContent = String(msg.balance);
    }
    return;
  }

  if (msg.type === 'bank_error') {
    if (Modals.isOpen('bankModalOpen')) document.getElementById('bankModalErr').textContent = msg.message;
    else if (Modals.isOpen('auctionModalOpen')) document.getElementById('auctionModalErr').textContent = msg.message;
    else if (Modals.isOpen('sendMoneyModalOpen')) document.getElementById('sendMoneyErr').textContent = msg.message;
    else if (Modals.isOpen('inventoryOpen') && invItemsTabActive) document.getElementById('invModalErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'money_sent') {
    if (Modals.isOpen('sendMoneyModalOpen')) document.getElementById('sendMoneyErr').textContent = '';
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
    if (Modals.isOpen('bankModalOpen')) populateBankDepositSelect();
    if (Modals.isOpen('auctionModalOpen')) populateAuctionItemSelect();
    applyMyEquipVisual(msg);
    return;
  }

  if (msg.type === 'spell_result') {
    if (Modals.isOpen('spellbookOpen')) document.getElementById('spellbookErr').textContent = '';
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
    if (Modals.isOpen('spellbookOpen')) document.getElementById('spellbookErr').textContent = msg.message;
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
    if (Modals.isOpen('attackPanelOpen')) document.getElementById('attackErr').textContent = '';
    setUnlockToast(msg.message);
    if (msg.revealTargetId) showGlimpseBeacon(msg.revealTargetId);
    if (msg.itemsSeen) openPickpocketPanel(msg.pickpocketTargetName, msg.itemsSeen, msg.stolenItemId);
    return;
  }

  if (msg.type === 'attack_error') {
    if (Modals.isOpen('attackPanelOpen')) document.getElementById('attackErr').textContent = msg.message;
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
    if (Modals.isOpen('legendModalOpen') && legendErr) legendErr.textContent = '⚠️ ' + msg.message;
    else if (Modals.isOpen('msModalOpen') && msErr) msErr.textContent = '⚠️ ' + msg.message;
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
    if (Modals.isOpen('legendModalOpen') && ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'legend_shop_open' }));
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

  if (msg.type === 'shop_sold') {
    setUnlockToast(`💰 Sold ${msg.itemName}${msg.qty > 1 ? ' ×' + msg.qty : ''} for ${msg.gold} gold!`);
    if (lastBankState) lastBankState.balance = msg.balance;
    if (Modals.isOpen('npcShopOpen')) {
      const balEl = document.getElementById('npcShopBalance');
      if (balEl) balEl.textContent = `Balance: ${msg.balance} 🪙`;
      refreshShopSellTab(); // reflect the now-smaller stack
    }
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

  if (msg.type === 'locksmith_error') {
    if (Modals.isOpen('locksmithModalOpen')) document.getElementById('locksmithErr').textContent = msg.message || 'Locksmith error.';
    else setUnlockToast('\ud83d\udd11 ' + (msg.message || 'Locksmith error.'));
    return;
  }
  if (msg.type === 'locksmith_done') {
    setUnlockToast('\ud83d\udd11 ' + (msg.message || 'Lock reset.'));
    closeLocksmithModal();
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

// ── Account + character select ─ extracted to client/account-select.js (Phase C).
// DOM refs/presets/helpers by ref; ensureAudio/joinMode/ws getters; savedAccount
// get/set; lastJoinPayload setter. ──
// 3rd-eye opt-in lives here (main reads it when casting); the settings panel in
// the account module flips it via the injected setter.
let thirdEyeOptIn = localStorage.getItem('tc_thirdeye_optin') === '1';
const {
  updateCharPickerVisibility, apiUrlMaybe, attemptJoin,
} = createAccountSelect({
  CHARACTER_PRESETS, KK, accountLoginBtn, accountPassInput, accountRegisterBtn, accountStatusEl, accountUserInput,
  apiUrl, joinBtn, nameInput, passInput, passSessionReceipt, setAccountStatus, setJoinMode, showJoinError,
  getEnsureAudio: () => ensureAudio, getJoinMode: () => joinMode, getWs: () => ws,
  getSavedAccount: () => savedAccount, setSavedAccount: (v) => { savedAccount = v; },
  setLastJoinPayload: (v) => { lastJoinPayload = v; },
  getThirdEyeOptIn: () => thirdEyeOptIn, setThirdEyeOptInVar: (v) => { thirdEyeOptIn = v; },
});

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

// Collision & room predicates — extracted to client/collision.js (Phase C M2).
const _collision = createCollision({
  getWorld: () => world,
  getWalls: () => walls,
  getDungeonLore: () => dungeonLoreCatalog,
  getDelveState: () => delveState,
});
const { PLAYER_R, collides, collidesIndoor, roomAt, pokeRoomTag, roomLabel } = _collision;

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
// Music — procedural ambient audio, extracted to client/audio.js (Tier 3.4
// Phase C). Built here via its DI factory; the returned handles keep their
// original names, so every downstream call site below is unchanged.
// ---------------------------------------------------------------------------
const _audio = createAudio({ getMe: () => me, setUnlockToast });
const { ensureAudio, startMusic, stopMusic, cycleMusic, musicMenuLabel } = _audio;

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
let invItemsTabActive = true;

function toggleInventory() {
  Modals.set('inventoryOpen', !Modals.isOpen('inventoryOpen'));
  inventoryPanel.classList.toggle('hidden', !Modals.isOpen('inventoryOpen'));
  if (Modals.isOpen('inventoryOpen')) {
    cancelTargeting();
    // Always open on the Items tab. Deep-links (the 💾 Drive button, the
    // "Open Hard Drive" item action) call showInvTab() AFTER this, so they
    // still land on their tab — but the plain Inventory button/I key never
    // reopens stuck on a sub-view (e.g. the Hard Drive selfie screen a
    // player couldn't back out of before).
    showInvTab('invItemsView');
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
  if (Modals.isOpen('inventoryOpen')) toggleInventory();
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

// ── Inventory panel (stats/equip/items) ─ extracted to client/inventory-panel.js
// (Phase C). Data tables + item/tooltip helpers + tab switchers by ref; inventory
// snapshot/stat-block/ws/gold-readout via getters; the selected slot via get/set. ──
const {
  renderStats, refreshEquipPreview, renderInventoryItemsPanel, selectInvSlot,
} = createInventoryPanel({
  ITEM_CATALOG, Modals, PLANT_EFFECTS, STAT_DISPLAY, buildItemIconEl, hideTooltip, showInvTab, showItemTooltip, toggleInventory,
  getEquipStatsCatalog: () => equipStatsCatalog, getLastInventoryState: () => lastInventoryState,
  getMyStatBlock: () => myStatBlock, getWs: () => ws, getUpdateGoldReadouts: () => updateGoldReadouts,
  getSelectedInvSlotIdx: () => selectedInvSlotIdx, setSelectedInvSlotIdx: (v) => { selectedInvSlotIdx = v; },
});

// ── Notes + Hard-Drive tab ─ extracted to client/notes-drive.js (Phase C).
// inbox + capture/request/toast + renderInventory injected; last inventory
// snapshot + myId/players/ws via getters; the armed-clip id via get/set. ──
// Hard-drive password + last hard-drive state live here (main's net handler writes
// the state, resets the password) — the tab reads them via getters.
let pendingHdPassword = '';
let lastHardDriveState = null; // { hasPassword, notes, capacity, selfies, clips } once known
const {
  refreshNoteRecipients, openNote, destroyNote, storeNoteOnHardDrive, refreshHardDriveTab, renderHardDriveUnlocked, renderDriveMediaQuickState,
} = createNotesDrive({
  captureHowlClip, captureSelfiePhoto, inbox, renderInventory, requestCmState, setUnlockToast,
  getLastInventoryState: () => lastInventoryState,
  getMyId: () => myId, getPlayers: () => players, getWs: () => ws,
  getCmSelectedClipId: () => cmSelectedClipId, setCmSelectedClipId: (v) => { cmSelectedClipId = v; },
  getPendingHdPassword: () => pendingHdPassword, setPendingHdPassword: (v) => { pendingHdPassword = v; },
  getLastHardDriveState: () => lastHardDriveState,
});

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

// ── Player HUD ─ extracted to client/hud.js (Phase C). Health/XP/quest/story/
// party overlays; a little live state injected as read-only getters. ──
const {
  updateHealthHud, updateXPDisplay, updateQuestTracker, clearQuestTracker, updateStoryTracker, renderPartyHud,
} = createHud({
  getMe: () => me, getGameStarted: () => gameStarted, getRestedUntil: () => restedUntil,
  getMyId: () => myId, getMyParty: () => myParty, getStoryState: () => storyState,
});

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

// ── Journal + Skills panels ─ extracted to client/journal-skills.js (Phase C).
// Modals + float-pos helper injected; me/ws/mySkillState/storyState via getters,
// storyLastOutro get/set. ──
const {
  openJournal, closeJournal, updateSkillsBadge, openSkills, closeSkills, renderSkills, renderJournal,
} = createJournalSkills({
  Modals, setDefaultFloatPos,
  getMe: () => me, getWs: () => ws,
  getMySkillState: () => mySkillState, getStoryState: () => storyState,
  getStoryLastOutro: () => storyLastOutro, setStoryLastOutro: (v) => { storyLastOutro = v; },
});

const journalBtn = document.getElementById('journalBtn');
if (journalBtn) journalBtn.addEventListener('click', () => { if (Modals.isOpen('journalOpen')) closeJournal(); else openJournal(); });
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
let myStatBlock = null;       // latest computeStatBlock (skill+gear derived stats)
let equipStatsCatalog = {};   // itemId -> stat contributions, for swap previews
// 💎 Moonstones (Session I) — premium currency. Balance is server truth,
// mirrored here for display; ms_state pushes keep it fresh.
let myMoonstones = 0;
let msPacksCatalog = null;    // packId -> { ms, cents, name } from init

// ── Session L state ──────────────────────────────────────────────────────────
let dungeonLoreCatalog = null;      // tier -> { name, epithet, bossKey, plaque } from init
let calendarState = null;           // { tourney, festival, bloodMoon, season, peddlerNextRotationAt }
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
// Blood-moon night math mirrored from the server (same pure clock both ends).
const BLOOD_MOON_EVERY_NIGHTS = 13;
function bloodMoonActiveClient(now) {
  now = now == null ? Date.now() : now;
  const idx = Math.floor(now / CYCLE_MS);
  return (idx % BLOOD_MOON_EVERY_NIGHTS) === 0 && (now % CYCLE_MS) >= DAY_MS;
}
let restedUntil = 0;          // 😴 rested-XP window end (epoch ms), 0 = none
let restedToastShown = false;

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
const _shop = createShop({
  send: (data) => ws.send(data),
  getBankState: () => lastBankState,
  getInventoryState: () => lastInventoryState,
  ITEM_CATALOG,
  showItemTooltip,
  hideTooltip,
  openQuestDialogue,
});
const { openNpcShopModal, closeNpcShopModal, renderNpcShop, refreshShopSellTab } = _shop;

// ---------------------------------------------------------------------------
// Party system
// ---------------------------------------------------------------------------
let myParty = null;

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
  Modals.set('witchShopOpen', true);
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
  Modals.set('witchShopOpen', false);
  const modal = document.getElementById('witchModal');
  if (modal) modal.classList.add('hidden');
}

const witchModalCloseBtn = document.getElementById('witchModalClose');
if (witchModalCloseBtn) witchModalCloseBtn.addEventListener('click', closeWitchModal);

// ---------------------------------------------------------------------------
// Witch selfie consent — MUST be explicit, per memory constraint
// ---------------------------------------------------------------------------
let activeWitchConsentId = null;

function openWitchSelfieConsent(consentId, itemName, itemIcon) {
  activeWitchConsentId = consentId;
  Modals.set('witchConsentOpen', true);
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
  Modals.set('witchConsentOpen', false);
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
let werewolfShopItems = [];

function openWerewolfModal(msg) {
  Modals.set('werewolfShopOpen', true);
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
  Modals.set('werewolfShopOpen', false);
  const modal = document.getElementById('werewolfModal');
  if (modal) modal.classList.add('hidden');
}

const werewolfModalClose = document.getElementById('werewolfModalClose');
if (werewolfModalClose) werewolfModalClose.addEventListener('click', closeWerewolfModal);

// Voice consent modal — same requirement as the Witch's selfie consent:
// mechanical disclosure (mic, recording, public Auction House listing) has
// to stay explicit no matter how it's themed.
let activeWerewolfConsentId = null;

function openWerewolfVoiceConsent(consentId, itemName, itemIcon) {
  activeWerewolfConsentId = consentId;
  Modals.set('werewolfConsentOpen', true);
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
  Modals.set('werewolfConsentOpen', false);
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

// The Parlor/Arcade upsell bar. It announces once when it first appears, then
// fades out of the way after 6.5s (live report: it was tiring seeing it up the
// whole time) — the same manners as the event pill and the Town Pass tag. The
// day pass stays one tap away in the ☰ menu and at the Cafe statue, so once it
// has said its piece it can leave. It re-announces if it's hidden (pass bought)
// and later needs to come back (pass lapses). refreshUnlockUI is called from
// many spots (price/config updates), so the fade is gated on the shown-edge,
// not re-fired on every refresh.
let _unlockBarFadeTimer = null;
let _unlockBarShown = false;
function refreshUnlockUI() {
  const bar = document.getElementById('unlockBar');
  if (!bar) return;
  if (!PAYWALLS_ENABLED || !paymentsEnabled || hasTownPass()) {
    bar.classList.add('hidden');
    bar.classList.remove('tagFaded');
    _unlockBarShown = false;
    clearTimeout(_unlockBarFadeTimer);
    return;
  }
  bar.classList.remove('hidden');
  const priceEl = document.getElementById('unlockPrice');
  if (priceEl) priceEl.textContent = formatPrice(townPassPriceCents);
  if (!_unlockBarShown) {
    _unlockBarShown = true;
    bar.classList.remove('tagFaded');
    clearTimeout(_unlockBarFadeTimer);
    _unlockBarFadeTimer = setTimeout(() => bar.classList.add('tagFaded'), 6500);
  }
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

fetch(apiUrl('/api/config'))
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
  if (err && Modals.isOpen('passModalOpen')) err.textContent = '⚠️ ' + message;
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
  fetch(apiUrl('/api/verify-session?session_id=' + encodeURIComponent(sessionId)
        + (acctToken ? '&account_token=' + encodeURIComponent(acctToken) : '')))
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
  if (jumpActive || typing || Modals.isOpen('passModalOpen') || Modals.isOpen('msModalOpen') || Modals.isOpen('legendModalOpen') || Modals.isOpen('arcadeModalOpen') || Modals.isOpen('bankModalOpen') || Modals.isOpen('auctionModalOpen') || Modals.isOpen('sendMoneyModalOpen') || Modals.isOpen('spellConsentOpen') || Modals.isOpen('howlConsentOpen') || Modals.isOpen('npcShopOpen') || Modals.isOpen('witchShopOpen') || Modals.isOpen('witchConsentOpen') || Modals.isOpen('werewolfShopOpen') || Modals.isOpen('werewolfConsentOpen') || seatedAt) return;
  jumpActive = true;
  jumpT = 0;
}

window.addEventListener('keydown', (e) => {
  if (typing || Modals.isOpen('passModalOpen') || Modals.isOpen('msModalOpen') || Modals.isOpen('legendModalOpen') || Modals.isOpen('arcadeModalOpen') || Modals.isOpen('bankModalOpen') || Modals.isOpen('auctionModalOpen') || Modals.isOpen('sendMoneyModalOpen') || Modals.isOpen('spellConsentOpen') || Modals.isOpen('howlConsentOpen') || Modals.isOpen('npcShopOpen') || Modals.isOpen('witchShopOpen') || Modals.isOpen('witchConsentOpen') || Modals.isOpen('werewolfShopOpen') || Modals.isOpen('werewolfConsentOpen')) return;
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
    for (const id in mobVisuals3) {
      const v = mobVisuals3[id];
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
  return typing || Modals.isOpen('passModalOpen') || Modals.isOpen('arcadeModalOpen') || Modals.isOpen('bankModalOpen') || Modals.isOpen('auctionModalOpen') ||
    Modals.isOpen('sendMoneyModalOpen') || Modals.isOpen('spellConsentOpen') || Modals.isOpen('howlConsentOpen') || Modals.isOpen('inventoryOpen') || Modals.isOpen('npcShopOpen') || Modals.isOpen('witchShopOpen') || Modals.isOpen('witchConsentOpen') || Modals.isOpen('werewolfShopOpen') || Modals.isOpen('werewolfConsentOpen') || Modals.isOpen('locksmithModalOpen');
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

const ATTACKABLE_KINDS = new Set(['player', 'animal', 'mob', 'animal2', 'mob2', 'mob3', 'dungeon', 'ember_mob']);

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
    animal2: animalVisuals2, mob2: mobVisuals2, mob3: mobVisuals3,
    dungeon: dungeonMobVisuals, ember_mob: emberMobVisuals
  }[targetType];
  const v = visualsMap && visualsMap[targetId];
  return v ? { x: v.x, z: v.y } : null;
}

// ── Fireball FX ─ extracted to client/fireballs.js (Phase C). The in-flight pool
// is private; timing consts + render/scene helpers by ref; CHAR/players getters. ──
const { spawnFireballFx, updateFireballs } = createFireballs({
  FIREBALL_FLIGHT_MS, FIREBALL_IMPACT_MS, FIREBALL_ARC_HEIGHT, getRenderPos, mobRenderPos, sceneForRoom,
  getChar: () => CHAR, getPlayers: () => players,
});

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

// ── Ground traps ─ extracted to client/ground-traps.js (Phase C). Stumble-sigil
// hazards; the visual pool is private to the module. getRenderPos/sceneForRoom by
// ref, world via getter. ──
const { applyGroundTrapsState, updateGroundTrapVisuals } = createGroundTraps({
  getRenderPos, sceneForRoom, getWorld: () => world, getIndoorScale: () => INDOOR_SCALE,
});

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

// ── Mobile HUD + chat ─ extracted to client/mobile-hud.js (Phase C). The init flag
// is private; controls/helpers by ref; live state (me/mode/cm*/last*/payments) via getters. ──
const {
  initMobileHud, refreshMobileHud, toggleMobileChat, spawnChatNotif, systemChatNotif,
} = createMobileHud({
  MOBILE_UI, Modals, buildEmoteWheel, buildMobileQuickSlots, hasTownPass, openImageLightbox, restJoystick,
  passTimeLeftLabel, passPriceLabel,
  getCmClips: () => cmClips, getCmHasDrive: () => cmHasDrive, getLastAttackedClientAt: () => lastAttackedClientAt,
  getLastToastText: () => lastToastText, getMe: () => me, getMode: () => mode, getPaymentsEnabled: () => paymentsEnabled,
  getPlayers: () => players, getLastToastAt: () => lastToastAt,
});

// ── Overhead speech bubbles (desktop) ───────────────────────────────────────
// The README always promised these; the mobile rebuild's banners now cover
// phones, and this covers desktop: whoever spoke gets their words in a
// little parchment bubble over their head for ~6s, fading at the end.
// Rendered/positioned by syncLabels() right alongside the name tags.
// ── extracted to client/overhead-bubbles.js (Phase C); players via getter. ──
const { setOverheadBubble, updateBubbleTag } = createOverheadBubbles({ getPlayers: () => players });

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
    if (me && me.charId === 0) { if (!Modals.isOpen('spellbookOpen')) openSpellbook(); }
    else if (myAttackCatalog) { if (!Modals.isOpen('attackPanelOpen')) openAttackPanel(); }
  });
  on('chatToggleBtn', () => toggleMobileChat());
  on('menuBtn', () => document.getElementById('menuSheet').classList.remove('hidden'));
  // Desktop's ☰ chip opens the very same sheet — one menu for both platforms.
  on('pcMenuBtn', () => document.getElementById('menuSheet').classList.remove('hidden'));
  on('menuCloseBtn', () => document.getElementById('menuSheet').classList.add('hidden'));
  const sheet = document.getElementById('menuSheet');
  if (sheet) sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.classList.add('hidden'); });
  const closeSheetAnd = (fn) => () => { document.getElementById('menuSheet').classList.add('hidden'); fn(); };
  on('menuInventory', closeSheetAnd(() => { if (!Modals.isOpen('inventoryOpen')) toggleInventory(); }));
  on('menuJournal', closeSheetAnd(() => { if (!Modals.isOpen('journalOpen')) openJournal(); }));
  on('menuSkills', closeSheetAnd(() => { if (!Modals.isOpen('skillsOpen')) openSkills(); }));
  on('menuKit', closeSheetAnd(() => {
    if (me && me.charId === 0) { if (!Modals.isOpen('spellbookOpen')) openSpellbook(); }
    else if (myAttackCatalog && !Modals.isOpen('attackPanelOpen')) openAttackPanel();
  }));
  on('menuDrive', closeSheetAnd(() => {
    if (!Modals.isOpen('inventoryOpen')) toggleInventory();
    showInvTab('invHardDriveView');
  }));
  on('menuPass', closeSheetAnd(openPassModal));
  on('menuMoonstones', closeSheetAnd(() => openMsModal()));
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
    applyDrawDistanceTier(G.quality); // re-tier outdoor draw distance for the new quality
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
  Modals.set('emoteWheelOpen', open === undefined ? !Modals.isOpen('emoteWheelOpen') : open);
  wheel.classList.toggle('hidden', !Modals.isOpen('emoteWheelOpen'));
  const cluster = document.getElementById('actionCluster');
  if (cluster) cluster.classList.toggle('wheelOpen', Modals.isOpen('emoteWheelOpen'));
  // While the wheel is up, the hint/XP strip/joystick ring step back too —
  // same "one thing under the thumb" rule the cluster buttons follow.
  document.body.classList.toggle('emoteWheelOpen', Modals.isOpen('emoteWheelOpen'));
  clearTimeout(emoteWheelTimer);
  if (Modals.isOpen('emoteWheelOpen')) emoteWheelTimer = setTimeout(() => toggleEmoteWheel(false), 4000);
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

// ── Loadout modal ─ extracted to client/loadout.js (Phase C). Ability helpers +
// MOBILE_UI by ref; action catalog + hotbar key tables via getters; the selected
// slot via get/set. ──
const { openLoadoutModal, closeLoadoutModal, renderLoadoutModal } = createLoadout({
  MOBILE_UI, attachAbilityPeek, haptic, orderedAbilityIds, saveLoadout, setUnlockToast,
  getMyActionCatalog: () => myActionCatalog, getHotbarKeys: () => HOTBAR_KEYS, getHotbarKeyLabels: () => HOTBAR_KEY_LABELS,
  getLoadoutSelectedSlot: () => loadoutSelectedSlot, setLoadoutSelectedSlot: (v) => { loadoutSelectedSlot = v; },
});

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
  fetch(apiUrl('/api/send-sms'), {
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
// ── Humanoid builder constructed here (right after CHAR) so createHumanoid is
// available to all the scene/mob/NPC constructions below. See client/humanoid.js. ──
const { createHumanoid } = createHumanoidBuilder({ CHAR, CHARACTER_PRESETS, KK, kkSetState });
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
let builtDungeonTier = 0; // which geometry the (rebuilt) dungeonScene holds — 1 = Rootcellar labyrinth, 0 = flat arena
let activeDungeonTier = 1, activeDungeonIsDelve = false; // set from dungeon_entered before swapToDungeonMap()
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
    if (q !== 'low') {
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

// ── Mobile draw-distance tiering ───────────────────────────────────────────
// On the 'low' quality tier ONLY (a tier the player opts into for performance),
// pull the outdoor fog + camera far planes in so a busy night town renders less
// distant geometry. 'medium' (the mobile default) and 'high' (desktop) keep
// their authored distances untouched, so no default experience changes. The
// authored far values are captured once (WeakMap) so switching quality back
// restores them exactly. Applied to the two big outdoor maps (town + wilds);
// the small indoor/destination scenes aren't worth tiering. Numbers are
// deliberately gentle — tune against real devices.
const DRAW_TIER = { low: { fog: 0.78, cam: 0.75 } };
const _authoredFar = new WeakMap();
function _tierFar(target, isCamera, mul) {
  if (!target || typeof target.far !== 'number') return;
  if (!_authoredFar.has(target)) _authoredFar.set(target, target.far);
  target.far = _authoredFar.get(target) * mul;
  if (isCamera && target.updateProjectionMatrix) target.updateProjectionMatrix();
}
function applyDrawDistanceTier(q) {
  const t = DRAW_TIER[q] || { fog: 1, cam: 1 };
  _tierFar(outdoorScene && outdoorScene.fog, false, t.fog);
  _tierFar(outdoorCamera, true, t.cam);
  _tierFar(wildsScene && wildsScene.fog, false, t.fog);
  _tierFar(wildsCamera, true, t.cam);
}

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

  const grassTex = makeMoorTexture(); // spooky Withered Moor ground (town only; the Wilds keeps grass)
  const groundSpan = Math.max(w.width, w.height) + 600;
  grassTex.repeat.set(groundSpan / 140, groundSpan / 140);
  const groundGeo = new THREE.PlaneGeometry(w.width + 600, w.height + 600);
  const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(w.width / 2, 0, w.height / 2);
  scene.add(ground);

  const dirtTex = makeFlagstoneTexture(); // eerie Cracked Flagstone paths + plaza

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
    // The Arcade path used to leave the square nearly parallel to the Temple
    // path, so their planks overlapped and z-fought inside the spawn circle.
    // Aim the Arcade path due-west of the hub (−90°, well clear of the Temple
    // path's −40°) and stop it right at the plaza rim (tiny stopback) so it
    // fans out to the far side and never enters the circle interior — no path
    // overlap in the spawn area. Cosmetic; path planks carry no collider.
    const isArcade = b.id === 'arcade';
    const hubX = isArcade ? w.spawn.x - 128 : w.spawn.x;
    const hubY = isArcade ? w.spawn.y : w.spawn.y;
    const stop = isArcade ? 8 : hubRadius;
    scene.add(buildPathSegment(doorPos.x, doorPos.y, hubX, hubY, 46, dirtTex, stop));
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
  const templeCx = TEMPLE_PLATFORM_X, templeCz = TEMPLE_PLATFORM_Z, templeD = TEMPLE_PLATFORM_D;
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
  applyDrawDistanceTier(GFX.quality); // pull in fog/far if the player is on 'low'
  mode = 'outdoor';
  indoorBuildingId = null;
  setActiveContext(outdoorScene, outdoorCamera, null);
  refreshBuildingLockVisuals();
  TOWN_WALLS = walls; // snapshot now that tree colliders from addNatureDecor are in place

  buildDungeonScene();
  // Wilds / Cave / Vault / Ember are built LAZILY on first entry (see
  // swapToWildsMap / swapToCaveMap / swapToVaultMap / swapToEmberMap) rather
  // than all up front here — this trims boot-time geometry + GPU/memory for the
  // common sessions that never visit them (a big win on lower-end phones). Each
  // is reached only through its swap fn, and every reference to their scene vars
  // already tolerates a null: day-night guards `if (getWildsScene())`, the
  // swapToTownMap light-return guards `if (wildsScene)`, loot-icon adds guard
  // `&& <scene>`, the sceneCounts probe guards `if (s)`, and a boot build could
  // always throw — so "null until first entry" is a safe, already-handled case.
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
  if (!wildsScene && world2) { try { buildWildsScene(world2); applyDrawDistanceTier(GFX.quality); } catch (e) { console.error('buildWildsScene failed:', e); } } // lazy: built on first entry, not at boot
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
    if (wildsScene) wildsScene.remove(light); // wilds may be unbuilt (lazy) if never visited — nothing to remove
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
  rebuildDungeonForTier(activeDungeonTier, activeDungeonIsDelve);
  if (!dungeonScene) return;
  world = DUNGEON_WORLD;
  walls = (builtDungeonTier >= 1 && DUNGEON_LAYOUTS[builtDungeonTier]) ? DUNGEON_LAYOUTS[builtDungeonTier].walls.slice() : [];
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  if (activeScene !== dungeonScene) setActiveContext(dungeonScene, dungeonCamera, null);
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
  if (!world2 || !me) return;
  swapToWildsMap(); // builds the Wilds on first entry (lazy)
  if (activeScene !== wildsScene) return; // build failed / not ready — don't half-enter

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
  { id: 'npc_dex',  name: 'Hunter Dex',     charId: 1, x: 1950, y:  340 }, // by the graveyard's south approach, clear of the wooded pocket's trees
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

// ── Town scene builders ─ extracted to client/town-scene.js (Phase C). Town
// NPCs + structures, the nightly ritual torches, the Torchkeepers' temple (+altar
// props), and the KayKit dressing. Called from initScene; textures/sprites,
// createHumanoid, door helpers, and TOWN_NPCS/KK/kiosk data injected; me via getter. ──
// Animated town-structure groups — built inside the town builders, ticked each
// frame by the render loop below; they live here so the loop can reach them.
let delveStoneGroup = null, peddlerStallGroup = null, locksmithGroup = null;
const {
  buildTownNPCs, buildTownRitualTorch, buildTownTemple, kkTownDressing,
} = createTownScene({
  KK, OUTDOOR_KIOSKS, TOWN_NPCS, createHumanoid, getDoorSide, getDoorWorldPos, kkPlace,
  makeNpcNameSprite, makePentacleTexture, makeSigilFloorTexture, makeSignSprite, makeWhiteStoneTexture,
  getMe: () => me,
  setDelveStoneGroup: (g) => { delveStoneGroup = g; },
  setPeddlerStallGroup: (g) => { peddlerStallGroup = g; },
  setLocksmithGroup: (g) => { locksmithGroup = g; },
});

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

// ── Witch Cave scene — extracted to client/cave-scene.js (Phase C 3D slice;
// includes addCaveWallShelves + its nested decoration makers). THREE global;
// helpers + CAVE_WORLD injected; scene/camera written back via setters. ──
const { buildCaveScene } = createCaveScene({
  makeSignSprite, makeNpcNameSprite, createHumanoid, CAVE_WORLD,
  setCaveScene: (s) => { caveScene = s; },
  setCaveCamera: (c) => { caveCamera = c; },
});

function swapToCaveMap() {
  if (!caveScene) { try { buildCaveScene(); } catch (e) { console.error('buildCaveScene failed:', e); } } // lazy: built on first entry, not at boot
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
// ── Bank Vault scene — extracted to client/vault-scene.js (Phase C, first 3D
// slice). THREE is global; prop-helpers + VAULT_WORLD injected; built scene/
// camera written back through setters. ──
const { buildVaultScene } = createVaultScene({
  makeStoneTexture, makeSignSprite, buildInteriorDoorway, VAULT_WORLD,
  setVaultScene: (s) => { vaultScene = s; },
  setVaultCamera: (c) => { vaultCamera = c; },
});

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

// ── Ember Wastes mobs (pool mgmt) ─ extracted to client/ember-mobs.js (Phase C).
// emberMobVisuals + EMBER_KIOSKS/EMBER_STATIC_KIOSKS + emberScene stay in main
// (shared with ember-scene) — injected via get/set; MOB_ATTACK_LUNGE_DIST via
// getter (declared later). ──
const { applyEmberMobState, updateEmberMobVisuals } = createEmberMobs({
  EMBER_MOB_VISUALS, createHumanoid, lerpAngle, makeHealthBarSprite, makeNpcNameSprite, mobAttackLungeAmount, updateHealthBar,
  getMobAttackLungeDist: () => MOB_ATTACK_LUNGE_DIST,
  getEmberScene: () => emberScene,
  getEmberMobVisuals: () => emberMobVisuals,
  getEmberStaticKiosks: () => EMBER_STATIC_KIOSKS,
  setEmberKiosks: (k) => { EMBER_KIOSKS = k; },
});

// ── Ember Wastes scene — extracted to client/ember-scene.js (Phase C 3D slice).
// THREE global; prop-helpers + EMBER_WORLD injected; scene/camera/kiosks/mob-
// visuals written back via get/set. ──
const { buildEmberScene } = createEmberScene({
  makeGrassTexture, makeRock, makeTree, buildPortalMesh, EMBER_WORLD,
  setEmberScene: (s) => { emberScene = s; },
  setEmberCamera: (c) => { emberCamera = c; },
  getEmberStaticKiosks: () => EMBER_STATIC_KIOSKS,
  setEmberStaticKiosks: (k) => { EMBER_STATIC_KIOSKS = k; },
  setEmberKiosks: (k) => { EMBER_KIOSKS = k; },
  getEmberMobVisuals: () => emberMobVisuals,
  setEmberMobVisuals: (v) => { emberMobVisuals = v; },
});

function swapToEmberMap() {
  if (!emberScene) { try { buildEmberScene(); } catch (e) { console.error('buildEmberScene failed:', e); } } // lazy: built on first entry, not at boot
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
  if (!vaultScene) { try { buildVaultScene(); } catch (e) { console.error('buildVaultScene failed:', e); } } // lazy: built on first entry, not at boot
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

// ── The Wilds scene ─ extracted to client/wilds-scene.js (Phase C 3D slice).
// buildWildsScene + its village/circle/camp/tree sub-builders + buildWildsNPCs.
// THREE global; layout tables, prop makers, mob/decor helpers injected; scene/
// camera + lextonNpc written back via setters. decorVisuals2 via getter (it's
// declared later, so a by-ref pass here would TDZ at eval time). ──
const { buildWildsScene } = createWildsScene({
  GFX, WILDS_CAMPFIRES, WILDS_KIOSKS, WILDS_NPCS, WILDS_WALLS, WILDS_WAYMARKERS,
  WITCH_CAVE_ENTRANCE_X, WITCH_CAVE_ENTRANCE_Z,
  addNatureDecor, addSpookyDecor, buildPortalMesh, createHumanoid,
  kkWildsDressing, makeSpookyTree, makeWaymarkerStone, makeWildsCampfire, wildsCollide,
  makeMoorTexture, makeGlowTexture, makeSignSprite, makeNpcNameSprite,
  getDecorVisuals2: () => decorVisuals2,
  getAddAnimals2: () => addAnimals2,
  getAddMobs2: () => addMobs2, getAddMobs3: () => addMobs3,
  setWildsScene: (s) => { wildsScene = s; },
  setWildsCamera: (c) => { wildsCamera = c; },
  setLextonNpc: (n) => { lextonNpc = n; },
});

// ---------------------------------------------------------------------------
// Personal Dungeon scene — built once at init, swapped in when the player
// uses the Wildlands Token. Uses its own lights so the shared sun/moon
// objects never need to be re-parented here. 800×800 dark stone arena with
// torch-style point lights and stone pillars.
// ---------------------------------------------------------------------------
// ── The Rootcellar (Tier 1) — spooky red sigil-cave labyrinth (1200×1200) ──
// A big winding cave of dark rock lit by glowing lanterns: four staggered rock
// ridges weave a serpentine from the south entry up to a summoning-circle boss
// chamber. Each ridge is a single row of spaced boulders (no overlapping pile),
// and the stone GLOWS with red sigils (emissive map, following the rock's own
// curvature). Walls block only the PLAYER; mobs sit server-side in the wide
// lanes between the ridges, leashed.
const DUNGEON_LAYOUTS = {
  // 1: Rootcellar (horizontal serpentine)
  1: { walls: [ { x:0, y:972, w:780, h:28 }, { x:420, y:792, w:780, h:28 }, { x:0, y:612, w:780, h:28 }, { x:420, y:432, w:780, h:28 } ],
     entry: { x: 600, y: 1080 }, boss: { x: 600, y: 225 }, portal: { x: 300, y: 1120 }, plaque: { x: 840, y: 1080 },
     lanterns: [ [600,1080], [600,225], [70,1130], [1130,1130], [70,510], [1130,510], [590,850], [170,70], [1030,70], [770,550], [410,550], [930,850] ] },
  // 2: Weeping Crypts (vertical serpentine)
  2: { walls: [ { x:990, y:0, w:28, h:800 }, { x:720, y:400, w:28, h:800 }, { x:470, y:0, w:28, h:800 } ],
     entry: { x: 1080, y: 600 }, boss: { x: 235, y: 600 }, portal: { x: 1090, y: 880 }, plaque: { x: 1080, y: 320 },
     lanterns: [ [1080,600], [235,600], [1130,70], [1130,1130], [530,70], [530,1130], [830,590], [70,150], [70,1050], [1130,770], [830,950], [530,770] ] },
  // 3: Howling Forge (central arena)
  3: { walls: [ { x:300, y:300, w:600, h:28 }, { x:872, y:300, w:28, h:330 }, { x:300, y:872, w:600, h:28 }, { x:300, y:570, w:28, h:330 }, { x:300, y:300, w:28, h:180 }, { x:872, y:720, w:28, h:180 } ],
     entry: { x: 600, y: 1090 }, boss: { x: 600, y: 600 }, portal: { x: 300, y: 1120 }, plaque: { x: 880, y: 1090 },
     lanterns: [ [600,1090], [600,600], [70,70], [1130,70], [70,1130], [1130,1130], [590,70], [70,590], [1130,590], [490,1030], [830,930], [330,270] ] },
  // 4: Starless Deep (concentric rings)
  4: { walls: [ { x:190, y:190, w:600, h:28 }, { x:190, y:190, w:28, h:600 }, { x:982, y:410, w:28, h:600 }, { x:410, y:982, w:600, h:28 }, { x:360, y:360, w:360, h:28 }, { x:360, y:360, w:28, h:360 }, { x:812, y:600, w:28, h:240 }, { x:600, y:812, w:240, h:28 } ],
     entry: { x: 600, y: 1090 }, boss: { x: 600, y: 600 }, portal: { x: 320, y: 1110 }, plaque: { x: 880, y: 1090 },
     lanterns: [ [600,1090], [600,600], [70,70], [1130,70], [70,1130], [1130,1130], [590,70], [70,590], [1130,590], [490,1050], [830,890], [330,330] ] },
  // 5: The Delve (pillar field)
  5: { walls: [ { x:250, y:850, w:180, h:28 }, { x:770, y:850, w:180, h:28 }, { x:500, y:700, w:200, h:28 }, { x:250, y:560, w:180, h:28 }, { x:770, y:560, w:180, h:28 }, { x:430, y:400, w:28, h:180 }, { x:742, y:400, w:28, h:180 } ],
     entry: { x: 600, y: 1090 }, boss: { x: 600, y: 235 }, portal: { x: 320, y: 1120 }, plaque: { x: 880, y: 1090 },
     lanterns: [ [600,1090], [600,235], [70,1130], [1130,1130], [70,530], [1130,530], [590,830], [150,70], [1050,70], [770,1130], [930,810], [410,1130] ] },
};
const DUNGEON_CAVE_THEMES = {
  1: { bg: 0x160709, amb: 0x6a3226, hemiTop: 0x8a3a26, hemiBot: 0x1e0c0e, floor: 0x281618, rock: 0x2a181b, glow: 0xff3018, accent: 0xff5a3a, lantern: 0xff8a4a, lanternLight: 0xff6030, hook: 0x140709 },
  2: { bg: 0x08150c, amb: 0x2c5238, hemiTop: 0x306040, hemiBot: 0x0a1c12, floor: 0x142418, rock: 0x172c1d, glow: 0x22b84e, accent: 0x46e07a, lantern: 0x8affa0, lanternLight: 0x2fc858, hook: 0x081a0e },
  3: { bg: 0x160a04, amb: 0x6e3c18, hemiTop: 0x8c4a18, hemiBot: 0x1e0e06, floor: 0x281808, rock: 0x2c1b0e, glow: 0xff6410, accent: 0xff8a24, lantern: 0xffc25a, lanternLight: 0xff7420, hook: 0x140a04 },
  4: { bg: 0x0a0818, amb: 0x3c3468, hemiTop: 0x4e3e88, hemiBot: 0x0c0a1e, floor: 0x161428, rock: 0x1b1732, glow: 0x7a4aff, accent: 0xa688ff, lantern: 0xc4b6ff, lanternLight: 0x8a5aff, hook: 0x0a081a },
  // 5 = The Delve — its own spectral-blue cave, so the endless descent reads as its own cursed place, not a recoloured tier.
  5: { bg: 0x04101a, amb: 0x1c4a5a, hemiTop: 0x2a6478, hemiBot: 0x06161e, floor: 0x0e2028, rock: 0x122630, glow: 0x18c4e0, accent: 0x5ad8ff, lantern: 0x9ef0ff, lanternLight: 0x3ac8ee, hook: 0x06141c }
};
// ── Personal Dungeon scene — extracted to client/dungeon-scene.js (Phase C 3D
// slice). THREE global; buildPortalMesh + layout/theme tables injected; scene/
// camera/kiosks/mob-visuals written back via setters. ──
const { buildDungeonScene, rebuildDungeonForTier } = createDungeonScene({
  buildPortalMesh, DUNGEON_LAYOUTS, DUNGEON_CAVE_THEMES,
  getDungeonScene: () => dungeonScene,
  setDungeonScene: (s) => { dungeonScene = s; },
  setDungeonCamera: (c) => { dungeonCamera = c; },
  getDungeonKiosks: () => DUNGEON_KIOSKS,
  setDungeonKiosks: (k) => { DUNGEON_KIOSKS = k; },
  setDungeonMobVisuals: (v) => { dungeonMobVisuals = v; },
  getBuiltDungeonTier: () => builtDungeonTier,
  setBuiltDungeonTier: (t) => { builtDungeonTier = t; },
});

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
// ── Day/night cycle ─ extracted to client/day-night.js (Phase C). Timing/color
// consts + GFX by ref, lamp glows + scene-lighting objects via getters. ──
// Night flag lives here (net handler writes it; mob modules read it via getters).
let lastWildlifeIsNight = false;
const { getDayNightState, updateDayNightCycle } = createDayNight({
  DAY_MS, NIGHT_MS, CYCLE_MS, DAY_NIGHT_TRANSITION_MS, SKY_DAY, SKY_NIGHT, AMBIENT_DAY, AMBIENT_NIGHT,
  _skyColor, _ambientColor, GFX, bloodMoonActiveClient,
  getLampGlows: () => LAMP_GLOWS,
  getOutdoorScene: () => outdoorScene, getOutdoorSun: () => outdoorSun, getMoonMesh: () => moonMesh,
  getOutdoorAmbient: () => outdoorAmbient, getOutdoorMoonLight: () => outdoorMoonLight,
  getDayNightWorldRadius: () => dayNightWorldRadius, getWildsScene: () => wildsScene,
});

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

// Briefly flash a struck creature's material red as hit confirmation.
function flashCreatureHit(kind, targetId) {
  let v;
  if (kind === 'mob')     v = mobVisuals[targetId];
  else if (kind === 'mob2')    v = mobVisuals2[targetId];
  else if (kind === 'mob3')    v = mobVisuals3[targetId];
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

let mobVisuals = {}; // id -> { mesh, x, y, targetX, targetY, facing, targetFacing, initialized }
// ── Town mobs ─ extracted to client/mobs-town.js (Phase C). makeMob mesh +
// spawn/apply/update over the mobVisuals pool (kept here — targeting/mobRenderPos/
// debug read it — injected via get/set; scene + night flag via getters). ──
const { makeMob, addMobs, applyMobState, updateMobVisuals } = createMobsTown({
  getMobVisuals: () => mobVisuals, setMobVisuals: (v) => { mobVisuals = v; },
  getOutdoorScene: () => outdoorScene, getLastWildlifeIsNight: () => lastWildlifeIsNight,
  lerpAngle, makeHealthBarSprite, updateHealthBar,
});

// ---------------------------------------------------------------------------
// The Wilds' 4 dangerous mob types — same base shape as a town mob, just
// recolored/rescaled per type (see MOB2_VISUALS) so the 4 read as distinct
// threats at a glance, matching their distinct stats from server.js.
// ---------------------------------------------------------------------------
const MOB2_VISUALS = {
  shade_stalker: { color: 0x3a1a4a, eyeColor: 0xb98aff, scale: 0.85 },
  bog_brute:     { color: 0x3a4a26, eyeColor: 0xd8ff6f, scale: 1.35 },
  night_howler:  { color: 0x1a1a22, eyeColor: 0xff2a2a, scale: 1.0 },
  will_o_wisp:   { color: 0x4fb8d8, eyeColor: 0xeafcff, scale: 0.6 },
  // ── Session M horrors (custom rigs where the blob won't do) ──
  fen_hexer:   { color: 0x3a1a4a, eyeColor: 0xd8b0ff, scale: 0.9,  fly: 12 },
  rot_swarm:   { color: 0x3a4a26, eyeColor: 0xd8ff6f, scale: 0.42 }, // recolored mini-blob
  barrow_maw:  { color: 0x6a5038, eyeColor: 0xff7a2a, scale: 1.05 },
  gloom_bat:   { color: 0x1c1c26, eyeColor: 0xff2a2a, scale: 0.7,  fly: 26 },
  barrow_wight:{ color: 0x6a7a6a, eyeColor: 0x9fe0ff, scale: 1.1 }, // recolored base blob — pale corpse, cold blue glow
  old_marrowe: { color: 0x8a3a2a, eyeColor: 0xff5a4a, scale: 1.7,  elite: true }
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

// ── Mob meshes ─ extracted to client/mob-meshes.js (Phase C). The Wilds mob2
// horrors + the mob3 critters — pure THREE/LEGEND_FX geometry; makeMob base +
// MOB2_VISUALS + health-bar sprite injected. makeMob2/makeMob3 are called by the
// mob2/mob3 visual pools (still in main). ──
const { makeMob2, makeMob3 } = createMobMeshes({ makeMob, MOB2_VISUALS, makeHealthBarSprite });

let mobVisuals2 = {};
let mobVisuals3 = {};

// Mobs (Wilds mobs2 + dungeon mobs) have no limbs to swing like the player
// rig does, so "attacking" is shown as a whole-body lunge toward whatever
// they just hit, plus a forward pitch (like a snapping bite), then a spring
// back — triggered from the 'struck'/'you_died' handlers via mobId, which
// the server now includes alongside those messages.
const MOB_ATTACK_ANIM_MS = 380;
const MOB_ATTACK_LUNGE_DIST = 16;
function triggerMobAttackAnim(mobId) {
  if (!mobId) return;
  const v = mobVisuals2[mobId] || mobVisuals3[mobId] || dungeonMobVisuals[mobId] || emberMobVisuals[mobId];
  if (v) v.attackAnimStartAt = performance.now();
}
// 0 -> 1 -> 0 over the animation's duration, or 0 once it's done/not attacking.
function mobAttackLungeAmount(v) {
  if (v.attackAnimStartAt == null) return 0;
  const t = (performance.now() - v.attackAnimStartAt) / MOB_ATTACK_ANIM_MS;
  if (t >= 1) { v.attackAnimStartAt = null; return 0; }
  return Math.sin(Math.min(1, t) * Math.PI);
}

// ── Wilds mobs (pool mgmt) ─ extracted to client/mobs-wilds.js (Phase C).
// mobVisuals2/mobVisuals3 stay in main (targeting/mob-pools/debug read them) —
// injected via get/set; Wilds scene + night flag via getters; makeMob2/makeMob3
// meshes + MOB2_VISUALS + attack-lunge helper injected. ──
const {
  addMobs2, addMobs3, applyMob2State, applyMob3State, updateMob2Visuals, updateMob3Visuals,
} = createMobsWilds({
  MOB2_VISUALS, MOB_ATTACK_LUNGE_DIST, lerpAngle, makeMob2, makeMob3, mobAttackLungeAmount, updateHealthBar,
  getWildsScene: () => wildsScene, getLastWildlifeIsNight: () => lastWildlifeIsNight,
  getMobVisuals2: () => mobVisuals2, setMobVisuals2: (v) => { mobVisuals2 = v; },
  getMobVisuals3: () => mobVisuals3, setMobVisuals3: (v) => { mobVisuals3 = v; },
});

// ── Wilds village NPCs ─ extracted to client/village-npcs.js (Phase C). The
// friendly villagers; the visual pool is private to the module.
// createHumanoid/kkSetState/lerpAngle injected; Wilds scene via getter. ──
const { applyVillageNpcState, updateVillageNpcVisuals } = createVillageNpcs({
  createHumanoid, kkSetState, lerpAngle, getWildsScene: () => wildsScene,
});

// ---------------------------------------------------------------------------
// Nightly torch-lighting ritual — same server-authoritative-position/
// client-interpolates-and-animates pattern as the Wilds' village NPCs
// above, just targeting the town's own outdoorScene instead. Torch
// lit/unlit state and each Torchkeeper's walk position both come from the
// same wildlife_state broadcast (see torchNpcs/torches, server.js).
// ---------------------------------------------------------------------------
const townTorchVisuals = {}; // id -> { flame, light } — populated in initScene()

// ── Town torch NPCs ─ extracted to client/town-torch-npcs.js (Phase C). The NPC
// pool is private; the torch-flame map (populated by initScene) injected by ref;
// createHumanoid/helpers by ref; town scene via getter. ──
const { applyTownTorchNpcState, updateTownTorchNpcVisuals, applyTownTorchState } = createTownTorchNpcs({
  createHumanoid, getFloorHeight, kkSetState, lerpAngle, makeNpcNameSprite, townTorchVisuals,
  getOutdoorScene: () => outdoorScene,
});

// ── Dungeon enemy archetypes ────────────────────────────────────────────────
// Distinct body silhouettes so enemies read as different creatures (not just
// recoloured clones). Each takes (color, eyeColor) and returns a Group; the
// per-type colour/scale still come from DUNGEON_MOB_VISUALS via makeDungeonMob.
function _dmMat(c) { return new THREE.MeshLambertMaterial({ color: c }); }
function _dmEye(c) { return new THREE.MeshBasicMaterial({ color: c }); }
function _dmEyes(g, ec, y, z, sep, r) {
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 6), _dmEye(ec)); e.position.set(s * sep, y, z); g.add(e); }
}

// ── Dungeon mobs ─ extracted to client/dungeon-mobs.js (Phase C, last mob
// variant). Archetype mesh builders + makeDungeonMob + pool mgmt over
// dungeonMobVisuals (kept in main, shared with dungeon-scene — getter; scenes +
// me via getters; DUNGEON_* tables + helpers injected). ──
const { applyDungeonMobState, updateDungeonMobVisuals } = createDungeonMobs({
  DUNGEON_BOSS_NAMES, DUNGEON_MOB_VISUALS, MOB_ATTACK_LUNGE_DIST, lerpAngle, makeHealthBarSprite, makeNpcNameSprite, mobAttackLungeAmount, updateHealthBar,
  getActiveScene: () => activeScene,
  getDungeonScene: () => dungeonScene,
  getDungeonMobVisuals: () => dungeonMobVisuals,
  getMe: () => me,
});

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
  for (const id in mobVisuals3) {
    const key = 'mob3:' + id;
    const v = mobVisuals3[id];
    if (v.hasLoot && wildsScene) showLootIcon(key, wildsScene, v.x, LOOT_ICON_HEIGHT, v.y, 'mob3', id);
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

// ---------------------------------------------------------------------------
// Town props — the scenery expansion. Same server-driven natureDecor flow as
// trees/shrubs (server.js decor_38+), just non-harvestable: benches and
// lampposts along the lanes, a well + market stalls on the plaza ring, a
// fenced flower garden, hay/crate/barrel work clusters, stumps and fallen
// logs. Lamppost lanterns are registered in LAMP_GLOWS and brighten with
// nightfall — see the hook at the end of updateDayNightCycle().
// ---------------------------------------------------------------------------
const LAMP_GLOWS = [];

// PROP_WOOD/PROP_WOOD_DARK/PROP_STONE colors moved to client/props-town.js (Phase C).

// NOTE: named makeBenchProp (not makeBench) — a second `function makeBench(x, z, rotY)`
// exists below for interiors, and duplicate function declarations in the same scope
// silently shadow each other (the later one wins), which used to leave every outdoor
// bench rendered at NaN coordinates: invisible, but still colliding. Same story for
// makeBarrelProp below.
// ── Interior furniture — constructed here (before the town props, which reuse
// makeBarrel) so its consts precede every interior/props construction. See
// client/furniture.js. ──
const {
  buildFurniture, makeBarrel, buildTorch,
} = createFurniture({
  INDOOR_WALL_HEIGHT, LOUNGE_PLATFORM_HEIGHT, LOUNGE_STAIR_END_FRAC, LOUNGE_STAIR_START_FRAC,
  canvas, createHumanoid, makeNpcNameSprite, makeSignSprite, makeWallPainting,
});
// ── Town-decor props — extracted to client/props-town.js (Phase C, first prop
// library slice). Pure THREE-group builders; makeGlowTexture/makeBarrel injected. ──
const {
  makeBenchProp, makeLamppost, makeWell, makeMarketStall, makeCrate, makeBarrelProp, makeHaybale, makeFenceSeg, makeStump, makeFallenLog, makeNoticeboard,
} = createTownProps({ makeGlowTexture, makeBarrel, KK, LAMP_GLOWS });


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

// ── Creatures & animals — extracted to client/creatures.js (Phase C). Town
// rabbits + Wilds critters + both server-driven visual pools. The pools stay
// here (shared by targeting, mob-pools, and the debug snapshot) and are
// injected into the factory via get/set. ──
let animalVisuals = {}; // id -> { mesh, x, y, targetX, targetY, facing, targetFacing, fleeing, hopPhase, initialized }
let animalVisuals2 = {};
const {
  addAnimals, addAnimals2, applyAnimalState, applyAnimal2State, updateAnimalVisuals, updateAnimal2Visuals,
} = createCreatures({
  lerpAngle, makeHealthBarSprite, updateHealthBar,
  getOutdoorScene: () => outdoorScene, getWildsScene: () => wildsScene,
  getAnimalVisuals: () => animalVisuals, setAnimalVisuals: (v) => { animalVisuals = v; },
  getAnimalVisuals2: () => animalVisuals2, setAnimalVisuals2: (v) => { animalVisuals2 = v; },
});

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
// ── Building exterior mesh ─ extracted to client/building-mesh.js (Phase C).
// KayKit box/stair tables + wall/door/window helpers + textures by ref; the
// camera-blocker list + locked-rooms set via getters. ──
const { buildBuildingMesh } = createBuildingMesh({
  KK, KK_BLD_BOXES, KK_STAIR_ZONES, WALL_HEIGHT, buildWallsForOne, getDoorSide, getDoorWorldPos,
  isVisuallyLocked, makeRectWindow, makeShingleTexture, makeSignSprite, makeWoodSidingTexture, lockVisuals,
  getKkCamBlockers: () => KK_CAM_BLOCKERS, getLockedRooms: () => lockedRooms,
});

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
// ── Interior scene builder ─ extracted to client/interior-scene.js (Phase C).
// Furniture builders + door/wall helpers + theme/size tables + stone texture
// injected; world via getter; interiorScenes cache shared by reference. ──
const { getInteriorScene } = createInteriorScene({
  INDOOR_SCALE, INDOOR_WALL_HEIGHT, INTERIOR_SIZE_OVERRIDES, INTERIOR_THEMES, buildFurniture,
  buildInteriorDoorway, buildTorch, buildWallsForOne, getDoorSide, interiorScenes, makeStoneTexture,
  getWorld: () => world,
});

// ── Interior furniture (buildTorch/makeTable/.../buildFurniture) → client/
// furniture.js (Phase C). Constructed up by the town-props construction so the
// makeBarrel const it shares is ready. ──

// ---------------------------------------------------------------------------
// Player visuals
// ── Humanoid mesh builders (addFace/addHair/createHumanoidClassic/createHumanoid/
// createKayKitHumanoid) → client/humanoid.js (Phase C). Constructed up near CHAR so
// the createHumanoid const precedes every scene/mob/NPC construction that needs it. ──

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
// ── Equip + status visuals ─ extracted to client/equip-visuals.js (Phase C).
// CHAR/EQUIP_ATTACH + glow texture + visuals registry by ref; myId/players getters. ──
const { applyEquipVisual, applyMyEquipVisual, applyStatusVisual } = createEquipVisuals({
  CHAR, EQUIP_ATTACH, makeGlowTexture, visuals,
  getMyId: () => myId, getPlayers: () => players,
});


// ── Player visuals ─ extracted to client/player-visuals.js (Phase C, the core
// character render/animation layer). The `visuals` registry stays in main (many
// readers) and is injected by reference; rig/equip/status/render helpers by ref;
// reassigned world state (me/players/scenes/seatedAt/jump/lexton) via getters. ──
const {
  updateStatusVisuals, updateWerewolfNpc, ensurePlayerVisual, destroyPlayerVisual, syncVisuals,
} = createPlayerVisuals({
  CHAR, JUMP_DURATION, JUMP_HEIGHT, KK, applyEquipVisual, applyStatusVisual, contextMatches, createHumanoid, getDayNightState, getFloorHeight, getRenderPos, kkDrivePlayer, kkSetState, lerpAngle, makeGhostMesh, setUnlockToast, visuals,
  getActiveScene: () => activeScene, getGroundY: () => groundY, getJumpActive: () => jumpActive, getJumpT: () => jumpT,
  getLextonNpc: () => lextonNpc, getMe: () => me, getMyId: () => myId, getPlayers: () => players,
  getSeatedAt: () => seatedAt, getWildsScene: () => wildsScene,
});

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
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
  if (calendarState.season) { // the current sabbat — always present, an ambient seasonal banner with its live blessing
    const se = calendarState.season.effects || {};
    let tag = calendarState.season.glyph + ' ' + calendarState.season.name;
    if (se.xpMult) tag += ' — +' + Math.round((se.xpMult - 1) * 100) + '% XP';
    else if (se.forageBonus) tag += ' — +' + Math.round(se.forageBonus * 100) + '% foraging';
    parts.push(tag);
  }
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
    if (cal.season) lines.push([cal.season.glyph, cal.season.blessing.slice(cal.season.glyph.length).trim()]);
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
const _board = createBoard({
  send: (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); },
  getBoardState: () => boardState,
  getMe: () => me,
  shortWhen,
});
const { openBoardModal, closeBoardModal, renderBoardModal } = _board;

// ── The Weekly Delve UI ──────────────────────────────────────────────────────
const _delve = createDelve({
  getWs: () => ws,
  getDelveState: () => delveState,
  getWeeklyDelveMods: () => weeklyDelveModsClient,
});
const { openDelveModal, closeDelveModal, renderDelveModal, renderDelveHud, openLocksmithModal, closeLocksmithModal, renderBoonDraft } = _delve;

// ── Covens UI ────────────────────────────────────────────────────────────────
let covenTableState = null;
const _coven = createCoven({
  getWs: () => ws, getMe: () => me, getPlayers: () => players,
  getCovenState: () => covenState, getCovenTableState: () => covenTableState,
  getCovenUnread: () => covenUnread, setCovenUnread: (v) => { covenUnread = v; },
  getCovenChatLines: () => covenChatLines, getCovenSigilsCatalog: () => covenSigilsCatalog,
  getCurrentInterior: () => currentInterior, makeNpcNameSprite, ITEM_CATALOG, accountAuth,
});
const { refreshCovenMenuRow, openCovenModal, closeCovenModal, renderCovenModal, renderCovenChat, openCovenInviteToast, refreshCovenTableVisual } = _coven;

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
const _notif = createNotif({
  getPushPublicKey: () => pushPublicKey,
  getPushAvailable: () => pushAvailable,
  accountAuth, apiUrlMaybe, setUnlockToast,
});
const { openNotifModal } = _notif;

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
  Modals.set('passModalOpen', true);
}

// ── 💎 Moonstones UI — extracted to client/moonstones.js (Phase C). Built
// before the legend shop below, which injects openMsModal/refreshMsUI. ──
const _moonstones = createMoonstones({
  getMyMoonstones: () => myMoonstones,
  getBankState: () => lastBankState,
  getMsPacksCatalog: () => msPacksCatalog,
  getMe: () => me,
  getSavedAccount: () => savedAccount,
  getPaymentsEnabled: () => paymentsEnabled,
  requestResumeToken, apiUrlMaybe,
});
const { refreshMsUI, updateGoldReadouts, openMsModal, closeMsModal } = _moonstones;

// ── 🌒 The Midnight Peddler's shop (Session I) ──────────────────────────
const _legend = createLegendShop({
  getWs: () => ws,
  getMyMoonstones: () => myMoonstones,
  setMyMoonstones: (v) => { myMoonstones = v; },
  refreshMsUI, openMsModal, ITEM_CATALOG,
});
const { openLegendShop, closeLegendShop, renderLegendShop } = _legend;


function closePassModal() {
  const modal = document.getElementById('passModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('passModalOpen', false);
}

const passModalCloseBtn = document.getElementById('passModalCloseBtn');
if (passModalCloseBtn) passModalCloseBtn.addEventListener('click', closePassModal);

// ---------------------------------------------------------------------------
// Bank & Auction House UI. Neither modal tracks its own copy of truth —
// they just render whatever the server last sent in bank_state/auction_state
// and fire off requests/actions, the same trust split as the rest of this
// client (server decides, client displays + asks).
// ---------------------------------------------------------------------------
let lastBankState = null; // { balance, slots }
let lastInventoryState = null; // { slots, equippedWeapon, equippedHead, equippedChest, equippedFeet, equippedRing }
let selectedInvSlotIdx = null;
let lastAuctionListings = [];

// ── Bank + Send-Money + Auction modals ─ extracted to client/bank-auction.js
// (Phase C). last*State snapshots + myId/players/ws injected as getters (main
// owns them); ITEM_CATALOG/helpers/Modals by ref; the bank-slot selection private. ──
const {
  openBankModal, closeBankModal, renderBankModal, openSendMoneyModal, closeSendMoneyModal,
  openAuctionModal, closeAuctionModal, renderAuctionModal, populateBankDepositSelect, populateAuctionItemSelect,
} = createBankAuction({
  ITEM_CATALOG, Modals, buildItemIconEl, cancelTargeting, captureSelfiePhoto, hideTooltip, openImageLightbox, showItemTooltip, updateGoldReadouts,
  getLastBankState: () => lastBankState, getLastInventoryState: () => lastInventoryState,
  getLastAuctionListings: () => lastAuctionListings,
  getMyId: () => myId, getPlayers: () => players, getWs: () => ws,
});

// Listings carry a live countdown ("Xh Ym left"); refresh the text once a
// minute so it doesn't go stale while the modal sits open without a bid
// changing anything (which would otherwise be the only thing triggering
// a re-render via auction_state).
setInterval(() => { if (Modals.isOpen('auctionModalOpen')) renderAuctionModal(); }, 60000);

// ---------------------------------------------------------------------------
// Spellbook UI — Witch-only (spellbookBtn is only ever unhidden for charId
// 0, see the 'init' handler above). Renders entirely from the local
// SPELL_CATALOG mirror, no server round-trip just to list spells — the
// catalog isn't per-player/dynamic. Casting is the only thing that talks
// to the server, which owns all real validation/cooldown/effects; this is
// just the menu and the request.
// ---------------------------------------------------------------------------
const _spellbook = createSpellbook({
  send: (data) => ws.send(data),
  cancelTargeting, setDefaultFloatPos, SPELL_CATALOG, armTargeting,
  buildEmojiCursor, SWORD_CURSOR, actionOnCooldown, startActionCooldown, visuals,
});
const { openSpellbook, closeSpellbook, showGlimpseBeacon } = _spellbook;

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
    : me.room === 'wilds' ? [['animal2', animalVisuals2], ['mob2', mobVisuals2], ['mob3', mobVisuals3]]
    : me.room === 'ember_wastes' ? [['ember_mob', emberMobVisuals]]
    : (typeof me.room === 'string' && me.room.startsWith('dungeon_')) ? [['dungeon', dungeonMobVisuals]]
    : [];
  for (const [targetType, visuals] of mobPools) {
    for (const id in visuals) {
      const v = visuals[id];
      // v.hidden — a buried Barrow Maw / dormant Old Marrowe can't be targeted.
      if (v.dead || v.hidden || (targetType === 'dungeon' && v.room !== me.room)) continue;
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
const _attacks = createAttacks({
  send: (data) => ws.send(data),
  getMe: () => me,
  getWorld: () => world,
  getAttackCatalog: () => myAttackCatalog,
  MOBILE_UI,
  setDefaultFloatPos, cancelTargeting, armTargeting, buildEmojiCursor, SWORD_CURSOR,
  actionOnCooldown, startActionCooldown,
});
const { openAttackPanel, closeAttackPanel } = _attacks;

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

const _consent = createConsent({ getWs: () => ws, captureSelfiePhoto });
const { openSpellConsentPrompt, openHowlConsentPrompt, denySpellConsent, denyHowlConsent } = _consent;

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
  if (!Modals.isOpen('arcadeModalOpen')) return;
  const dt = Math.min(0.05, (now - arcadeLast) / 1000);
  arcadeLast = now;
  if (arcadeGameType === 'snake') { updateSnake(dt); renderSnake(arcadeCtx); }
  else { updateBreakout(dt); renderBreakout(arcadeCtx); }
  arcadeRAF = requestAnimationFrame(arcadeLoop);
}

function openArcadeGame(type) {
  arcadeGameType = type;
  Modals.set('arcadeModalOpen', true);
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
  if (!Modals.isOpen('arcadeModalOpen')) return;
  Modals.set('arcadeModalOpen', false);
  if (arcadeRAF) cancelAnimationFrame(arcadeRAF);
  document.getElementById('arcadeModal').classList.add('hidden');
}

const arcadeCloseBtn = document.getElementById('arcadeCloseBtn');
if (arcadeCloseBtn) arcadeCloseBtn.addEventListener('click', closeArcadeGame);

window.addEventListener('keydown', (e) => {
  if (!Modals.isOpen('arcadeModalOpen')) return;
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
  if (!Modals.isOpen('arcadeModalOpen') || arcadeGameType !== 'breakout' || !breakoutState) return;
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
    if (!Modals.isOpen('arcadeModalOpen') || touchId !== null) return;
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
  if (kiosk && kiosk.npc === 'locksmith') { openLocksmithModal(); return; }
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
  if (!me || Modals.isOpen('passModalOpen') || Modals.isOpen('msModalOpen') || Modals.isOpen('legendModalOpen') || Modals.isOpen('arcadeModalOpen') || Modals.isOpen('bankModalOpen') || Modals.isOpen('auctionModalOpen') || Modals.isOpen('sendMoneyModalOpen') || Modals.isOpen('spellConsentOpen') || Modals.isOpen('howlConsentOpen') || Modals.isOpen('npcShopOpen') || Modals.isOpen('witchShopOpen') || Modals.isOpen('witchConsentOpen') || Modals.isOpen('werewolfShopOpen') || Modals.isOpen('werewolfConsentOpen') || Modals.isOpen('boardModalOpen') || Modals.isOpen('delveModalOpen') || Modals.isOpen('covenModalOpen') || Modals.isOpen('notifModalOpen') || Modals.isOpen('locksmithModalOpen')) { hint.classList.add('hidden'); return; }
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
  if (Modals.isOpen('boardModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeBoardModal();
    return;
  }
  if (Modals.isOpen('delveModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeDelveModal();
    return;
  }
  if (Modals.isOpen('locksmithModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeLocksmithModal();
    return;
  }
  if (Modals.isOpen('covenModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeCovenModal();
    return;
  }
  if (Modals.isOpen('notifModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) { Modals.set('notifModalOpen', false); document.getElementById('notifModal').classList.add('hidden'); }
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
  if (Modals.isOpen('legendModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeLegendShop();
    return;
  }
  if (Modals.isOpen('msModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeMsModal();
    return;
  }
  if (Modals.isOpen('passModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closePassModal();
    return;
  }
  if (Modals.isOpen('bankModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeBankModal();
    return;
  }
  if (Modals.isOpen('auctionModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeAuctionModal();
    return;
  }
  if (Modals.isOpen('sendMoneyModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeSendMoneyModal();
    return;
  }
  if (Modals.isOpen('spellbookOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeSpellbook();
    return;
  }
  if (Modals.isOpen('spellConsentOpen')) {
    if (e.key === 'Escape' && !e.repeat) denySpellConsent();
    return;
  }
  if (Modals.isOpen('howlConsentOpen')) {
    if (e.key === 'Escape' && !e.repeat) denyHowlConsent();
    return;
  }
  if (Modals.isOpen('attackPanelOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeAttackPanel();
    return;
  }
  if (Modals.isOpen('journalOpen') && e.key === 'Escape' && !e.repeat) {
    closeJournal();
    return;
  }
  if (Modals.isOpen('skillsOpen') && e.key === 'Escape' && !e.repeat) {
    closeSkills();
    return;
  }
  if (Modals.isOpen('npcShopOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeNpcShopModal();
    return;
  }
  if (Modals.isOpen('witchConsentOpen')) {
    if (e.key === 'Escape' && !e.repeat) {
      ws.send(JSON.stringify({ type: 'witch_selfie_payment', consentId: activeWitchConsentId, image: null }));
      closeWitchSelfieConsent();
    }
    return;
  }
  if (Modals.isOpen('witchShopOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeWitchModal();
    return;
  }
  if (Modals.isOpen('werewolfConsentOpen')) {
    if (e.key === 'Escape' && !e.repeat) {
      ws.send(JSON.stringify({ type: 'werewolf_voice_payment', consentId: activeWerewolfConsentId, audio: null }));
      closeWerewolfVoiceConsent();
    }
    return;
  }
  if (Modals.isOpen('werewolfShopOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeWerewolfModal();
    return;
  }
  if (Modals.isOpen('arcadeModalOpen')) return; // the dedicated arcade-game keydown listener owns Escape/controls while playing
  if (Modals.isOpen('inventoryOpen') && e.key === 'Escape' && !e.repeat) { toggleInventory(); return; }
  if (armedTarget && e.key === 'Escape' && !e.repeat) { cancelTargeting(); return; }
  // I = open/close inventory, same toggle the HUD button already calls
  if ((e.key === 'i' || e.key === 'I') && !e.repeat) { toggleInventory(); return; }
  // J = open/close the story Journal, same toggle as its HUD button
  if ((e.key === 'j' || e.key === 'J') && !e.repeat) { if (Modals.isOpen('journalOpen')) closeJournal(); else openJournal(); return; }
  if ((e.key === 'k' || e.key === 'K') && !e.repeat) { if (Modals.isOpen('skillsOpen')) closeSkills(); else openSkills(); return; }
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
  const anyModal = Modals.isOpen('boardModalOpen') || Modals.isOpen('delveModalOpen') || Modals.isOpen('covenModalOpen') || Modals.isOpen('notifModalOpen') || Modals.isOpen('passModalOpen') || Modals.isOpen('msModalOpen') || Modals.isOpen('legendModalOpen') || Modals.isOpen('arcadeModalOpen') || Modals.isOpen('bankModalOpen') || Modals.isOpen('auctionModalOpen');
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
    if (justPressed(8)) { if (!Modals.isOpen('journalOpen')) openJournal(); }              // Back → journal
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
  if (!typing && !seatedAt && !Modals.isOpen('passModalOpen') && !Modals.isOpen('arcadeModalOpen') && !Modals.isOpen('bankModalOpen') && !Modals.isOpen('auctionModalOpen') && !Modals.isOpen('sendMoneyModalOpen') && !Modals.isOpen('spellConsentOpen')) {
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
  if (locksmithGroup && locksmithGroup.userData.tick) locksmithGroup.userData.tick(performance.now() / 1000);
  updateAnimalVisuals(dt);
  updateMobVisuals(dt);
  updateAnimal2Visuals(dt);
  updateMob2Visuals(dt);
  updateMob3Visuals(dt);
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
    music() { return _audio.musicState(); },
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
    // Session M creatures QA: counts of the Wilds visual pools by type, so a
    // headless run can confirm every new critter/mob mesh built without error.
    wilds() {
      const byType = (pool, field) => { const o = {}; for (const id in pool) { const t = pool[id][field] || '?'; o[t] = (o[t] || 0) + 1; } return o; };
      return {
        room: me ? me.room : null,
        critters: byType(animalVisuals2, 'critterType'),
        hostiles: byType(mobVisuals2, 'mobType'),
        neutrals: byType(mobVisuals3, 'mobType'),
      };
    },
    nearestTarget() { const t = nearestAttackable(); return t ? { id: t.id, targetType: t.targetType } : null; },
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

