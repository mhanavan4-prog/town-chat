import createAudio from './audio.js';
import createCollision from './collision.js';
import { Modals } from './modals.js';
import createShop from './shop.js';
import createSpellbook from './spellbook.js';
import createAttacks from './attacks.js';
import createBoard from './board.js';
import createSeance from './seance.js';
import createAchievements from './achievements.js';
import createTitles from './titles.js';
import createWorkshop from './workshop.js';
import createMinions from './minions.js';
import createWorldBoss from './worldboss.js';
import createDelve from './delve.js';
import createCoven from './coven.js';
import createCovenVoice from './coven-voice.js';
import createNotif from './notif.js';
import createLegendShop from './legend.js';
import createConsent from './consent.js';
import createVaultScene from './vault-scene.js';
import createRefugeScene from './refuge-scene.js';
import createCaveScene from './cave-scene.js';
import createManorScene from './manor-scene.js';
import createCottageScene from './cottage-scene.js';
import createDungeonScene from './dungeon-scene.js';
import createEmberScene from './ember-scene.js';
import createTownProps from './props-town.js';
import { makeTree, makeShrub, makeRock, makeFlowerPatch, makePlantBloom, makePlantMushroom, makePlantSprout, PLANT_VISUALS, makeWatchpine, makeDeadwood, makeMourningWillow, makeCapwood, makeHexoak, makePalebirch, makeBramblebush, makeNightberry, makeThornsnarl, makeFenfern, makeToadstoolRing } from './props-nature.js';
import { makeGrassTexture, makeGlowTexture, makeMoorTexture, makeWildsFloorTexture, makeEmberFloorTexture, makeSigilTextures, makeGroundSigilTextures, makeStoneTexture, makeWhiteStoneTexture, makeWoodSidingTexture, makeShingleTexture, makePentacleTexture, makeSigilFloorTexture } from './textures.js';
import { ALTAR_DECOS, ALTAR_SLOTS } from './altar-decor.js';
import { EMOTE_DEFS, uiIcon, hydrateIcons, glyphHTML, escHtml, moonPhaseIcon } from './ui-icons.js';
import createCreatures from './creatures.js';
import { makeHealthBarSprite, updateHealthBar, makeLootIconSprite, makeSignSprite, makeNpcNameSprite, HOVER_NAME_SPRITES } from './sprites.js';
import createWildsScene from './wilds-scene.js';
import createTownScene from './town-scene.js';
import createMobsTown from './mobs-town.js';
import createMobMeshes from './mob-meshes.js';
import createMobsWilds from './mobs-wilds.js';
import createEmberMobs from './ember-mobs.js';
import createEmberNodes from './ember-nodes.js';
import createDungeonMobs from './dungeon-mobs.js';
import createVillageNpcs from './village-npcs.js';
import createHumanoidBuilder from './humanoid.js';
import { WARDROBE, resolveLook, weaponUnlock, DYES, dyeUnlock } from './wardrobe.js';
import createJournalSkills from './journal-skills.js';
import createBankAuction from './bank-auction.js';
import createNotesDrive from './notes-drive.js';
import createInventoryPanel from './inventory-panel.js';
import createPlayerVisuals from './player-visuals.js';
import createFamiliars from './familiars.js';
import createAuras from './auras.js';
import createGuises from './guises.js';
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
// A small ring of the most recent client errors, kept in memory only so the
// in-game bug reporter can attach "what was on fire just now" to a report.
// window.__recentErrors() returns newest-first short strings; never persisted.
(function () {
  const RING = [];
  const RING_MAX = 8;
  window.__pushRecentError = function (s) {
    try { RING.push(String(s || '').slice(0, 300)); if (RING.length > RING_MAX) RING.shift(); } catch (_e) {}
  };
  window.__recentErrors = function () { return RING.slice().reverse(); };
})();
(function installErrorTelemetry() {
  let sent = 0;
  const MAX_PER_LOAD = 8;          // never flood the server from a single tab
  const seen = new Set();          // collapse identical repeats within a load
  function report(kind, message, source, line, col, stack) {
    try {
      try { window.__pushRecentError((kind || 'error') + ': ' + (message || '') + (line ? (' @' + line) : '')); } catch (_e) {}
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

// Client-health beacon: fire-and-forget health signal (time-to-playable, asset
// failures) to /api/telemetry. Uses sendBeacon when available so it survives a
// page teardown; never throws into the app. Deliberately NO player data.
function sendHealthBeacon(obj) {
  try {
    const body = JSON.stringify(obj);
    const url = apiUrl('/api/telemetry');
    if (navigator && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(function () {});
    }
  } catch (_e) { /* telemetry must never break the app */ }
}
let _ttpBeaconSent = false;

let ws;
let lastJoinPayload = null;
let gameStarted = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let bannerGraceTimer = null;
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
  // Morvaine and Caelum sat exactly on the Unbound Circle's radius-110 megalith
  // ring (CX 2200, CZ 5000): Morvaine at (2200,5100) was jammed into the +z
  // stone at (2200,5110), Caelum at (2210,4890) into the -z stone at (2200,4890).
  // Move both into clear open ground flanking the central altar (where the
  // ritual-tenders belong), well inside the torch ring and clear of every stone.
  { id: 'npc_morvaine', name: 'Elder Morvaine',       charId: 2, x: 2200, y: 5050 },
  { id: 'npc_talwyn',   name: 'Sister Talwyn',         charId: 0, x: 2360, y: 5010 },
  { id: 'npc_caelum',   name: 'Brother Caelum',        charId: 3, x: 2200, y: 4945 },
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
let mootInstanceActive = false; // Session N: true while inside your coven's private copy (the Moot Stone)
const messagesByRoom = {}; // room id -> array of {name,color,text,ts}
const worldFeed = []; // unified global WORLD chat — shown in every room, seeded from init's backlog
const _notifiedHostTs = new Set(); // host greetings already popped as a notif, so a reconnect doesn't repeat them
// Chat tabs: 'world' (the global channel, always available) and 'room' (the
// private chat of the building you're inside, occupants-only). Entering a
// building adds + auto-switches to its room tab; leaving drops back to World.
let activeChatTab = 'world';
const chatUnread = { world: 0, room: 0 };
// A "building room" has its own private chat; the open-air zones share World.
function isBuildingRoom(r) { return !!r && r !== 'outside' && r !== 'wilds' && r !== 'ember_wastes'; }
// Completely hide chat (panel + overhead bubbles/banners) for players who don't
// want it on screen. Persisted per-viewer; a small floating button restores it.
let chatHidden = false;
try { chatHidden = localStorage.getItem('tc_chatHidden') === '1'; } catch (e) {}

// Local mute (Session O): a per-viewer, client-side block list keyed by display
// name. Muted players' chat lines and overhead bubbles are hidden for THIS
// viewer only — nothing is sent to the server, so it works with no moderator
// present. Persisted so it survives reloads.
const mutedNames = new Set();
try { const a = JSON.parse(localStorage.getItem('tc_muted') || '[]'); if (Array.isArray(a)) a.forEach(n => mutedNames.add(String(n))); } catch (e) {}
function isMutedName(name) { return !!name && mutedNames.has(String(name)); }
function persistMuted() { try { localStorage.setItem('tc_muted', JSON.stringify([...mutedNames])); } catch (e) {} }
function setMuted(name, muted) {
  if (!name) return;
  if (muted) mutedNames.add(String(name)); else mutedNames.delete(String(name));
  persistMuted();
  if (typeof renderChatLog === 'function') renderChatLog();
}

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
  { name: 'Wanderer',   skin: 0x7a4a2f, hair: 0xe0e0e0, hairStyle: 'mohawk',   eye: 0xa57b3c, shirt: 0xc0596f, pants: 0x2f2f2f },
  // charId 5: Necromancer — gaunt, grave-pale, hooded in deathly robes with a
  // sickly green soul-glow in the eyes. charId 5 uses the Attacks panel
  // (NECROMANCER_ATTACK_CATALOG) and alone can raise undead.
  { name: 'Lich', skin: 0xcfc8bd, hair: 0x15121c, hairStyle: 'long',    eye: 0x7cff9a, shirt: 0x241b33, pants: 0x14101e }
];

// ═══════════════════════════════════════════════════════════════════════════
// TIER-3 UPGRADE (Session F) — KayKit asset pipeline.
// Characters: KayKit "Adventurers" (CC0, Kay Lousberg, kaylousberg.com);
// buildings: KayKit Medieval Hexagon Pack; decor: KayKit Halloween Bits.
// Assets preload from /kk at page load; join waits briefly for them, and
// anything that fails to load falls back to the classic procedural builders.
// ═══════════════════════════════════════════════════════════════════════════
const KK = (() => {
  // Heavy 3D assets (the ~19MB of KayKit models) can load from a CDN / Render
  // Static Site instead of the game's web service, to keep first-load egress
  // off the paid instance. window.THORNREACH_ASSET_BASE (set in index.html) is
  // that origin; empty = same-origin, so this is a no-op until it's configured.
  const ASSET_BASE = ((typeof window !== 'undefined' && window.THORNREACH_ASSET_BASE) || '').replace(/\/+$/, '');
  const assetUrl = (p) => ASSET_BASE ? ASSET_BASE + '/' + p : p;
  const MANIFEST = {
    char0: 'kk/Mage.glb',           // Witch
    char1: 'kk/Barbarian.glb',      // Werewolf
    char2: 'kk/Rogue_Hooded.glb',   // Mystic
    char3: 'kk/Knight.glb',         // Knight
    char4: 'kk/Rogue.glb',          // Wanderer
    char5: 'kk/Skeleton_Mage.glb',  // Necromancer — KayKit Skeletons pack (CC0). Ships no animations, so it borrows the Mage's clips at load (shared KayKit rig — see borrowAnims)
    // The Necromancer's summoned undead + the skeleton staff prop (all CC0,
    // same pack). The three skeleton bodies borrow clips like char5; the staff
    // is a static prop socketed into the Necromancer's hand.
    skel_minion:  'kk/Skeleton_Minion.glb',
    skel_warrior: 'kk/Skeleton_Warrior.glb',
    skel_rogue:   'kk/Skeleton_Rogue.glb',
    skel_staff:   'kk/Skeleton_Staff.glb',
    // Ember Wastes army (same Skeletons pack; borrow the Mage's clips like the
    // other skel_* bodies). skel_mage reuses the Necromancer's body file for the
    // Bonecaller; skel_golem is the hulking boss/brute body.
    skel_mage:    'kk/Skeleton_Mage.glb',
    skel_golem:   'kk/Skeleton_Golem.glb',
    npc_werewolf: 'kk/Werewolf_Wolf.glb', // Lexton Greyfur on the Ancient One's balcony
    npc_vampire:  'kk/Vampire.glb',        // the Artificer, lounging on his throne
    npc_witch:    'kk/Witch.glb',          // Mother Yarrow — KayKit Mystery Monthly S5 "The Witch" (CC0): orange hat, round glasses, salmon hair. No clips of her own; borrows the Mage's via the shared KayKit rig (see borrowAnims)
    // Mother Yarrow's garden dressing — the Witch pack's themed props (CC0, same
    // Mystery Monthly S5 set; all share witch_texture_A). Placed in her plot.
    wprop_cauldron:     'kk/witch/Cauldron.gltf',
    wprop_potionstn:    'kk/witch/Potionstation_decorated.gltf',
    wprop_wtable:       'kk/witch/Table_Small.gltf',
    wprop_mortar:       'kk/witch/Mortar.gltf',
    wprop_pestle:       'kk/witch/Pestle.gltf',
    wprop_mushbasket:   'kk/witch/Basket_Mushrooms.gltf',
    wprop_broom:        'kk/witch/Broom.gltf',
    prop_throne:  'kk/vampire/Vampire_Throne.gltf', // the Artificer's vampire throne
    mon_beast:    'kk/Monster.glb',        // the smaller Wilds beast-mobs (barrow maw, bone hound, swamp lurker, …); the world bosses now use skel_warrior
    // Unified to the red roofline + darkened at build time (see buildBuildingMesh)
    // for a cohesive, moody witch-town. The Bank is a squat crenellated stone
    // keep (tower_base) so it reads as a vault rather than a church.
    bld_cafe:    'kk/bld/building_tavern_red.gltf',
    bld_library: 'kk/bld/building_church_red.gltf',
    bld_arcade:  'kk/bld/building_home_B_red.gltf',
    bld_lounge:  'kk/bld/building_tower_A_red.gltf',
    bld_hall:    'kk/bld/building_castle_red.gltf',
    bld_bank:    'kk/bld/building_tower_base_red.gltf',
    bld_refuge:  'kk/bld/building_tower_base_red.gltf', // Ember Refuge shelter (warm-tinted stone keep)
    prop_watermill: 'kk/bld/building_watermill_red.gltf', // pond landmark (decor prop)
    // Wildlands Village (the Wilds) — weathered green/yellow hexagon buildings,
    // set apart from the red town. (home_B_red/market_red/well_blue reused below.)
    vil_hall:   'kk/bld/building_church_yellow.gltf',  // Village Hall
    vil_tower:  'kk/bld/building_tower_A_green.gltf',   // guard tower
    vil_home:   'kk/bld/building_home_B_yellow.gltf',  // barn / cottages
    shrine_temple:  'kk/bld/building_shrine_red.gltf',    // Temple of the Flame centerpiece (hexagon atlas)
    prop_torch:     'kk/bld/torch_lit.gltf',              // lit flame torch (Dungeon atlas) — temple corners
    // KayKit set-dressing props (swapped in for the old procedural versions).
    prop_crate:   'kk/bld/crate_A_big.gltf',
    prop_barrel:  'kk/bld/barrel.gltf',
    prop_haybale: 'kk/bld/haybale.gltf',
    prop_log:     'kk/bld/resource_lumber.gltf',
    prop_stump:   'kk/bld/tree_single_A_cut.gltf',
    prop_stall:   'kk/bld/building_market_red.gltf', // market stall (also the Peddler's canopy)
    // Wilds flora — KayKit Forest Nature Pack, recolored per species (dark green
    // c2, teal/hexed c4, pale c1). Each gltf references its own forest_c*.png.
    fl_watchpine:  'kk/forest/watchpine.gltf',  // dark-green pine
    fl_deadwood:   'kk/forest/deadwood.gltf',   // gnarled bare dead tree
    fl_hexoak:     'kk/forest/hexoak.gltf',     // teal broad "hexed" oak
    fl_palebirch:  'kk/forest/palebirch.gltf',  // pale tall birch
    fl_bramble:    'kk/forest/bramble.gltf',    // broad bramble bush
    fl_thornsnarl: 'kk/forest/thornsnarl.gltf', // small teal thorn bush
    // Hex terrain tiles — the whole map floor is carpeted with instances of
    // hex_grass (see the hex-floor builder in initScene), with hex_road_* tiles
    // routed between the buildings. Each tile's top face sits at model y=0.
    tile_grass:  'kk/tiles/hex_grass.gltf',
    tile_water:  'kk/tiles/hex_water.gltf',
    lily_a:      'kk/tiles/waterlily_A.gltf', lily_b: 'kk/tiles/waterlily_B.gltf',
    tile_road_a: 'kk/tiles/hex_road_A.gltf', tile_road_b: 'kk/tiles/hex_road_B.gltf',
    tile_road_c: 'kk/tiles/hex_road_C.gltf', tile_road_d: 'kk/tiles/hex_road_D.gltf',
    tile_road_e: 'kk/tiles/hex_road_E.gltf', tile_road_f: 'kk/tiles/hex_road_F.gltf',
    tile_road_g: 'kk/tiles/hex_road_G.gltf', tile_road_h: 'kk/tiles/hex_road_H.gltf',
    tile_road_i: 'kk/tiles/hex_road_I.gltf', tile_road_j: 'kk/tiles/hex_road_J.gltf',
    tile_road_k: 'kk/tiles/hex_road_K.gltf', tile_road_l: 'kk/tiles/hex_road_L.gltf',
    tile_road_m: 'kk/tiles/hex_road_M.gltf',
    prop_bench:    'kk/props/bench_decorated.gltf',
    prop_lamppost: 'kk/props/post_lantern.gltf',
    prop_well:     'kk/bld/building_well_blue.gltf',
    prop_fence:    'kk/props/fence.gltf',
    prop_grave_a:  'kk/props/grave_A.gltf',
    prop_grave_b:  'kk/props/gravestone.gltf',
    prop_crypt:    'kk/props/crypt.gltf',
    prop_pumpkin:  'kk/props/pumpkin_orange_jackolantern.gltf',
    prop_pumpkin2: 'kk/props/pumpkin_orange.gltf',
    // 🎃 Samhain guise head-props (client/guises.js) — socketed on the player's
    // KayKit head bone. The pumpkin reuses prop_pumpkin above. antlered_hood is
    // the Adventurers Druid's hooded-antler head, baked to head-bone-local space.
    guise_skull:   'kk/guises/skull.gltf',
    guise_antlers: 'kk/guises/antlered_hood.glb',
    guise_hat:     'kk/guises/witch_hat.glb', // Mystery Series 5 Witch's pointed hat
    guise_devil:   'kk/guises/tiefling_head.glb', // Mystery Series 5 Tiefling's horned head
    prop_shrine:   'kk/props/shrine_candles.gltf',
    prop_deadtree: 'kk/props/tree_dead_large.gltf',
    prop_deadtree2:'kk/props/tree_dead_medium.gltf',
    prop_arch:     'kk/props/arch_gate.gltf',
    // Ember Wastes landmarks — Resource-pack gems become glowing ruby spires;
    // Dungeon-pack walls/pillars/torches build the Ashlord's ruined citadel.
    gem_large:     'kk/resource/Gem_Large.gltf',
    gem_medium:    'kk/resource/Gem_Medium.gltf',
    ruin_pillar:   'kk/dungeon/pillar.gltf',
    ruin_pillar2:  'kk/dungeon/pillar_decorated.gltf',
    ruin_wall:     'kk/dungeon/wall_sloped.gltf',
    ruin_corner:   'kk/dungeon/wall_corner_small.gltf',
    ruin_torch:    'kk/dungeon/torch.gltf',
    // Low floor debris for the Delve/dungeon — rubble & rocks that hug the
    // walls instead of the view-blocking stalagmite spikes they replace.
    ruin_rubble:   'kk/dungeon/rubble_large.gltf',
    ruin_rubble2:  'kk/dungeon/rubble_half.gltf',
    ruin_rocks:    'kk/dungeon/rocks_small.gltf',
    ruin_rocks2:   'kk/dungeon/rocks_decorated.gltf',
    ruin_floor:    'kk/dungeon/floor_tile_large.gltf',
    // Forest Nature Pack — bare/dead trees for the Wilds & graveyard scenery
    // (replacing the procedural makeSpookyTree cones). Six variants for variety.
    tree_bare1a:   'kk/nature/Tree_Bare_1_A_Color1.gltf',
    tree_bare1b:   'kk/nature/Tree_Bare_1_B_Color1.gltf',
    tree_bare1c:   'kk/nature/Tree_Bare_1_C_Color1.gltf',
    tree_bare2a:   'kk/nature/Tree_Bare_2_A_Color1.gltf',
    tree_bare2b:   'kk/nature/Tree_Bare_2_B_Color1.gltf',
    tree_bare2c:   'kk/nature/Tree_Bare_2_C_Color1.gltf',
    // Forest Nature Pack — leafy trees for the TOWN (eerie teal, Color4),
    // replacing the procedural makeTree greenery. A varied mix of shapes.
    tree_leaf1:    'kk/nature/Tree_1_C_Color4.gltf',
    tree_leaf2:    'kk/nature/Tree_3_B_Color4.gltf',
    tree_leaf3:    'kk/nature/Tree_5_C_Color4.gltf',
    tree_leaf4:    'kk/nature/Tree_7_C_Color4.gltf',
    // Ground detail — teal bushes (match the trees) + neutral grey rocks.
    bush1:         'kk/nature/Bush_1_C_Color4.gltf',
    bush2:         'kk/nature/Bush_2_D_Color4.gltf',
    bush3:         'kk/nature/Bush_3_B_Color4.gltf',
    rock1:         'kk/nature/Rock_3_H_Color1.gltf',
    rock2:         'kk/nature/Rock_5_D_Color1.gltf',
    rock3:         'kk/nature/Rock_6_C_Color1.gltf',
    // Grass tufts (teal) — scattered as Wilds ground detail (kkWildsGroundDetail).
    grass1:        'kk/nature/Grass_1_A_Color4.gltf',
    grass2:        'kk/nature/Grass_1_C_Color4.gltf',
    grass3:        'kk/nature/Grass_2_A_Color4.gltf',
    grass4:        'kk/nature/Grass_2_C_Color4.gltf',
    // KayKit Furniture Bits — interior dressing. These stream in AFTER spawn
    // (see FURN_KEYS, excluded from the gate) and are only consumed when you
    // step into a furnished interior, which falls back to the procedural
    // furniture until the model has arrived. Shared furniturebits_texture.png.
    furn_table:     'kk/furn/table_medium_long.gltf', // dining table (banquet, long axis x)
    furn_chair:     'kk/furn/chair_A.gltf',           // dining chair
    furn_stool:     'kk/furn/chair_stool_wood.gltf',  // bar stool
    furn_shelf:     'kk/furn/shelf_B_large.gltf',     // wall shelf
    furn_cabinet:   'kk/furn/cabinet_medium.gltf',    // sideboard / cabinet
    furn_armchair:  'kk/furn/armchair.gltf',          // fireside armchair
    furn_lamp:      'kk/furn/lamp_table.gltf',         // table lamp
    furn_books:     'kk/furn/book_set.gltf',          // book stack (dressing)
    furn_mug:       'kk/furn/mug_A.gltf',             // mug (café table dressing)
    furn_sidetable: 'kk/furn/table_small.gltf',       // small side table
    furn_rug:       'kk/furn/rug_rectangle_A.gltf',   // accent rug
    furn_desk:      'kk/furn/desk.gltf',              // scholar's desk (library)
    furn_deskchair: 'kk/furn/chair_desk_A.gltf',      // desk chair
    furn_shelfdec:  'kk/furn/shelf_B_large_decorated.gltf', // book-laden wall shelf
    furn_couch:     'kk/furn/couch_pillows.gltf',     // lounge couch (parlor)
    furn_coffee:    'kk/furn/table_low.gltf'          // low coffee table
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
    4: ['Rogue_Cape', 'Knife'],
    5: [] // Necromancer uses the Skeleton Mage body — its meshes aren't curated props, so nothing to hide
  };
  const WEAPONISH = ['2H_Staff', '1H_Sword', 'Badge_Shield', 'Knife'];

  const models = {};   // key → {scene, animations, size:{x,y,z}}
  const mixers = new Set();
  let pending = 0, settled = false, resolveReady;
  const promise = new Promise(res => { resolveReady = res; });
  // Live load progress across the WHOLE manifest (critical + deferred), for the
  // on-screen loading pill. loadedCount ticks on every asset settle (hit OR
  // miss); allDone flips once nothing is left to stream.
  const totalCount = Object.keys(MANIFEST).length;
  let loadedCount = 0, allDone = false;

  // Load groups. The critical GATE to spawn is just the shared town — buildings,
  // props and the small socket prop (~1.3MB). The heavy character bodies (5 ×
  // ~3.4MB) are NOT gated: you only need the ONE you picked to spawn, so it's
  // awaited at join (beginChars/whenChar) while the other four stream in behind
  // you. This keeps first-load off the ~17MB cliff that used to dump slow
  // visitors into the classic fallback. Summoned undead stay fully background.
  const CHAR_KEYS = Object.keys(MANIFEST).filter((k) => /^char\d$/.test(k));
  const BG_KEYS = ['skel_minion', 'skel_warrior', 'skel_rogue', 'skel_mage', 'skel_golem', 'npc_werewolf', 'mon_beast', 'npc_vampire', 'npc_witch', 'prop_throne', 'guise_skull', 'guise_antlers', 'guise_hat', 'guise_devil',
    // Mother Yarrow's garden props (stream in after the player body; the Wilds
    // scene rebuilds once KayKit finishes loading, so they appear then).
    'wprop_cauldron', 'wprop_potionstn', 'wprop_wtable', 'wprop_mortar', 'wprop_pestle', 'wprop_mushbasket', 'wprop_broom'];
  // Interior furniture (Furniture Bits) — tiny models only needed once you enter
  // a furnished building, so they stream with the character tail rather than
  // gating first paint. buildFurniture falls back to procedural until present.
  const FURN_KEYS = Object.keys(MANIFEST).filter((k) => /^furn_/.test(k));
  const GATING_KEYS = Object.keys(MANIFEST).filter((k) => !CHAR_KEYS.includes(k) && !BG_KEYS.includes(k) && !FURN_KEYS.includes(k));
  let loader = null;
  const keyPromises = {}; // key → Promise (memoized; resolves on hit OR miss)

  const store = (key) => (gltf) => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    models[key] = { scene: gltf.scene, animations: gltf.animations || [],
      size: { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z },
      minY: box.min.y };
  };
  // After any asset settles: backfill borrowed clips once the donor (char0) is
  // present (gives char5 / the skeletons their animations), and flip allDone
  // when the whole manifest has streamed.
  const _assetCbs = [];
  function afterLoad() {
    if (models.char0) borrowAnims();
    if (loadedCount >= totalCount) allDone = true;
    // Notify subscribers (e.g. the static-NPC upgrader) that an asset settled —
    // lets them react to models arriving WITHOUT forcing any early load.
    for (const cb of _assetCbs) { try { cb(); } catch (e) {} }
  }
  // Load ONE manifest key, memoized. Resolves on success OR failure (failure
  // leaves the classic fallback in place), so a slow/broken asset never hangs a
  // join — it just falls back for that one piece.
  function loadKey(key) {
    if (models[key]) return Promise.resolve();
    if (keyPromises[key]) return keyPromises[key];
    if (!loader) return Promise.resolve();
    // Retry a failed fetch before giving up to the fallback. Streaming 120
    // model files at once means a transient blip (dropped request, a slow
    // socket) is common, and a single failure used to leave that piece on the
    // classic procedural fallback for the whole session — measured at ~1 in 8
    // sessions losing a character body. Two quick retries recover most of them;
    // only a genuinely-missing asset still falls back (and only then does the
    // assetfail beacon fire, so the metric now means "truly failed").
    const MAX_TRIES = 3;
    keyPromises[key] = new Promise((res) => {
      const attempt = (tryNum) => {
        loader.load(assetUrl(MANIFEST[key]),
          (gltf) => { store(key)(gltf); loadedCount++; afterLoad(); res(); },
          undefined,
          () => {
            if (tryNum < MAX_TRIES) { setTimeout(() => attempt(tryNum + 1), 500 * tryNum); return; }
            console.warn('KK asset failed after ' + MAX_TRIES + ' tries, using fallback:', key);
            try { sendHealthBeacon({ event: 'assetfail', asset: key }); } catch (e) {}
            loadedCount++; afterLoad(); res();
          });
      };
      attempt(1);
    });
    return keyPromises[key];
  }

  function load() {
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) { settled = true; allDone = true; resolveReady(); return; }
    loader = new THREE.GLTFLoader();
    // Gate = the shared town only. Resolves KK.promise / KK.settled fast (~1.3MB)
    // so spawn is never blocked on the big character bodies.
    pending = GATING_KEYS.length;
    if (!pending) { settled = true; resolveReady(); }
    for (const key of GATING_KEYS) {
      loadKey(key).then(() => { if (--pending === 0) { settled = true; resolveReady(); } });
    }
  }

  // Await the specific body a player is about to spawn as. The Necromancer
  // (char5) is a Skeleton-pack body with no clips of its own, so it also needs
  // the Mage (char0) as its animation donor.
  function whenChar(charId) {
    if (charId === 5) return Promise.all([loadKey('char5'), loadKey('char0')]).then(() => { if (models.char0) borrowAnims(); });
    return loadKey('char' + charId);
  }

  // Kick off character streaming: the picked body first (alone, full bandwidth),
  // then the donor Mage, the other classes, and the summon skeletons behind it.
  let charsStarted = false;
  function beginChars(priorityCharId) {
    if (!loader) return Promise.resolve();
    const prio = whenChar(priorityCharId);
    if (!charsStarted) {
      charsStarted = true;
      prio.then(() => {
        loadKey('char0').then(() => { if (models.char0) borrowAnims(); }); // donor early
        for (const k of CHAR_KEYS) if (k !== 'char' + priorityCharId) loadKey(k);
        for (const k of BG_KEYS) loadKey(k);
        for (const k of FURN_KEYS) loadKey(k);
      });
    }
    return prio;
  }

  // KayKit Skeletons-pack models ship with no animation clips of their own,
  // but share the universal KayKit rig (identical deform-bone names), so they
  // adopt the Adventurers Mage's clips — the AnimationMixer binds each track to
  // the skeleton's bones by name (IK-only tracks simply don't resolve, which is
  // harmless). Runs once every model has loaded.
  function borrowAnims() {
    const donor = models.char0 && models.char0.animations && models.char0.animations.length ? models.char0.animations : null;
    if (!donor) return;
    // three.js binds each animation track by node name, and when a track targets
    // a node that ISN'T in the bound hierarchy it silently FALLS BACK to the
    // mixer's root object. The Adventurers Mage clips animate a full IK control
    // rig (IK-foot, kneeIK, control-foot-roll, handIK, …) that the Skeletons
    // pack models don't have — so on a skeleton those ~50 orphan tracks all bind
    // to the model ROOT and overwrite its position/rotation/SCALE with the Mage's
    // IK-control values every frame. That's what shrank the Necromancer to a
    // speck, tipped it over, and sank it under the floor. The playable classes
    // share the Mage's exact rig (IK bones included), so nothing falls back.
    // Fix: for each borrower, keep only the tracks whose target node actually
    // resolves in ITS rig — the shared deform bones (root, hips, spine, chest,
    // head, all limbs) match, so the body still animates fully and correctly;
    // only the orphan IK/control tracks (the ones that would hit the root) drop.
    const resolvesToRealNode = (root, trackName) => {
      try { const b = THREE.PropertyBinding.create(root, trackName); b.bind(); return !!b.node && b.node !== root; }
      catch (e) { return false; }
    };
    // The same bone track name recurs across every clip, and within one model it
    // always resolves the same way — so memoize per model by track name. This
    // turns ~(clips × tracks) scene-graph bind traversals into ~(unique track
    // names), a ~20× cut that keeps this off the critical path to spawn. The
    // cache is per-model (built fresh in clipsFor), so it makes no cross-model
    // assumption about rigs.
    const clipsFor = (m) => {
      const memo = new Map();
      const keep = (name) => { let r = memo.get(name); if (r === undefined) { r = resolvesToRealNode(m.scene, name); memo.set(name, r); } return r; };
      return donor.map(clip => new THREE.AnimationClip(
        clip.name, clip.duration, clip.tracks.filter(t => keep(t.name))
      ));
    };
    const skinned = (m) => { let y = false; m.scene.traverse(o => { if (o.isSkinnedMesh) y = true; }); return y; };
    for (const k of Object.keys(models)) {
      // Only rigged (skinned) models borrow clips — a static prop like the
      // staff has no bones and must stay animation-less.
      if (models[k].animations && models[k].animations.length === 0 && skinned(models[k])) models[k].animations = clipsFor(models[k]);
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
    // Disable frustum culling on every mesh (same reason createKayKitByKey does
    // it): a scaled clone's cached bounding sphere can be wrong, so THREE culls
    // the whole prop when the camera turns — the large throne in the Coven Court
    // was vanishing by angle. These are a handful of static props, so the cost
    // of always drawing them is negligible.
    inst.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    g.add(inst);
    g.userData.kkHeight = t.size.y * s;
    return g;
  }

  return { MANIFEST, PROP_MESHES, KEEP, WEAPONISH, models, mixers, load, has, charKey, charReady, staticInstance,
    whenChar, beginChars,
    get settled() { return settled; }, promise,
    // Loading-pill progress: fraction 0..1 of the whole manifest, and whether
    // everything (critical + the streamed-in summon models) is done.
    get fullyLoaded() { return allDone; },
    loadFrac() { return totalCount ? loadedCount / totalCount : 1; },
    // Gating-only fraction (0..1): the SHARED WORLD graphics — buildings, hex
    // floor, trees, props. Reaches 1 exactly when KK.settled flips, so the
    // loading pill's bar fills to 100% right as the world finishes painting in
    // (loadFrac, over the whole manifest incl. the silent character tail, only
    // ever reaches ~80% by then — which looked like a stall in the pill).
    gatingFrac() { const n = GATING_KEYS.length; return n ? (n - pending) / n : 1; },
    // Character-tail fraction (0..1): the player/NPC bodies + summon skeletons
    // that stream in AFTER the gating world is up (CHAR_KEYS + BG_KEYS). Drives
    // the second, non-blocking pill phase so a fresh player knows the blocky
    // stand-in NPCs are still sharpening into their KayKit bodies.
    charTailFrac() {
      const tail = totalCount - GATING_KEYS.length;
      if (tail <= 0) return 1;
      const gatingLoaded = GATING_KEYS.length - pending;
      return Math.min(1, Math.max(0, loadedCount - gatingLoaded) / tail);
    },
    onAssetLoad(cb) { _assetCbs.push(cb); },
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
  // Witchcraft reagents (Tier 3.5) — mirrored from server.js
  glass_vial:     { name: 'Glass Vial',     icon: '⚗️', slot: null, desc: 'Empty and waiting. Fill it and set it under a full moon, and the water remembers the light.' },
  moon_water:     { name: 'Moon Water',     icon: '💧', slot: null, desc: 'Water charged under the full moon. Cool to the touch and faintly bright — the base of the strongest brews.' },
  moonwell_draught: { name: 'Moonwell Draught', icon: '💙', slot: null, desc: 'Moon water drawn through healing herb. The deepest mending a cauldron can hold (heals 120 HP).' },
  salt: { name: 'Salt', icon: '🧂', slot: null, desc: 'Blessed salt for a protective circle. Use it to lift any curse on you and turn aside the next for a time.' },
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
  // --- Wilds flora — harvest materials (the new trees & bushes) ---
  pine_pitch:    { name: 'Pine Pitch',   icon: '🌲',   slot: null, desc: 'Sticky watchpine sap. Binds a wound — or a hex.' },
  witchwood:     { name: 'Witchwood',    icon: '🪵',   slot: null, desc: 'A deadwood limb, grey and patient. It listens.' },
  willow_frond:  { name: 'Willow Frond', icon: '🍃',   slot: null, desc: 'A weeping-willow tress, cut at dusk.' },
  toadcap:       { name: 'Toadcap',      icon: '🍄‍🟫', slot: null, desc: "A slab of giant toadstool. Don't lick it." },
  hex_acorn:     { name: 'Hex Acorn',    icon: '🌰',   slot: null, desc: 'A hexoak acorn — plant it and regret it.' },
  birch_bark:    { name: 'Birch Bark',   icon: '📜',   slot: null, desc: 'Pale bark that peels like old letters.' },
  bramble_vine:  { name: 'Bramble Vine', icon: '🌿',   slot: null, desc: 'Green and grabby. Wear gloves.' },
  nightberry:    { name: 'Nightberry',   icon: '🫐',   slot: null, desc: 'Glows faintly violet. Tastes of midnight.' },
  blackthorn:    { name: 'Blackthorn',   icon: '🥀',   slot: null, desc: 'A cruel little thorn. Draws blood, keeps secrets.' },
  fern_frond:    { name: 'Fern Frond',   icon: '🌱',   slot: null, desc: 'Feathery fenfern, still damp from the bog.' },
  ring_cap:      { name: 'Ring Cap',     icon: '🍄',   slot: null, desc: 'Plucked from a fairy ring — bad luck to eat, good luck to brew.' },
  // --- Wilds-flora brews (crafted at Witch Hazel's cauldron) ---
  barkbind_salve:     { name: 'Barkbind Salve',     icon: '🩹',  slot: null, desc: 'Knits your wounds like bark over 45s.' },
  capwood_elixir:     { name: 'Capwood Elixir',     icon: '🍄‍🟫', slot: null, desc: 'Swell to giant size for 45s.' },
  nightsight_draught: { name: 'Nightsight Draught', icon: '🌘',  slot: null, desc: 'A raven cloak — the dark parts for you (60s).' },
  fernstep_philtre:   { name: 'Fernstep Philtre',   icon: '🌀',  slot: null, desc: "The road can't hold you (swift, 45s)." },
  bramble_poultice:   { name: 'Bramble Poultice',   icon: '💚',  slot: null, desc: 'Restores 50 HP.' },
  witchwood_balm:     { name: 'Witchwood Balm',     icon: '✨',  slot: null, desc: 'Cleanses every curse and charm.' },
};

const PLANT_EFFECTS = new Set([
  'swift_root', 'featherleaf', 'giants_cap', 'shrinking_violet', 'pumpkin_blossom',
  'bats_breath', 'rainbow_petal', 'ravens_feather_plant', 'stumbleweed', 'gibberish_root',
  'toadstool', 'wolfsbane_bloom', 'meditation_lotus', 'healing_herb', 'regen_root', 'cleansing_clover',
  // Witch-brewed potions use the same server-side plant handler
  'health_potion_ii', 'regen_brew', 'swift_brew', 'shadow_draught',
  'giants_elixir', 'bat_swarm_potion', 'clarity_draught', 'chaos_brew',
  'wolf_pact_brew',
  // Wilds flora brews (barkbind/capwood/nightsight/fernstep/bramble/witchwood)
  'barkbind_salve', 'capwood_elixir', 'nightsight_draught', 'fernstep_philtre',
  'bramble_poultice', 'witchwood_balm',
]);
// This set is the client's copy of "which items show a Use button." It's
// seeded above for offline/pre-init safety, but the server also ships the
// authoritative list (Object.keys(PLANT_CATALOG)) in the init payload and we
// merge it below — so any new consumable is usable with no hand-sync/drift.

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
  const custom = uiIcon(itemId);
  if (custom || itemId === 'flower_bloom') {
    const wrap = document.createElement('span');
    wrap.className = 'itemIconSvg';
    wrap.innerHTML = custom || FLOWER_ICON_SVG;
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
    description: "Asks another player to open their camera — only with their permission — and sends a photo of them back to you as a note. They choose whether to accept." },
  toads_tongue:    { name: "Toad's Tongue",      icon: '🐸', kind: 'targeted', effect: 'status',
    description: "A lashing toad-tongue tangles the target's legs — their walking speed is halved for a while." },
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
  terrifying_roar:  { name: 'Terrifying Roar',  icon: '😱', kind: 'aoe', effect: 'status', statusType: 'wolfmark', durationMs: 12000,
    description: 'A roar so fearsome it marks everyone nearby as prey — they take +30% damage until it fades.' },
  alpha_bite:       { name: 'Alpha Bite',        icon: '🐺', kind: 'targeted', effect: 'status', statusType: 'shrink',     durationMs: 25000,
    description: 'Chomps the target down to half their size.' },
  feral_dash:       { name: 'Feral Dash',        icon: '💨', kind: 'self', effect: 'status', statusType: 'speedboost', durationMs: 12000,
    description: 'Surges with wolf speed — doubles movement for a short burst.' },
  blood_frenzy:     { name: 'Blood Frenzy',      icon: '🩸', kind: 'self', effect: 'status', statusType: 'giant',      durationMs: 15000,
    description: 'Swells with feral rage — doubles the Werewolf\'s size.' },
  bone_crunch:      { name: 'Bone Crunch',       icon: '🦴', kind: 'targeted', effect: 'status', statusType: 'bloodcurse', durationMs: 8000,
    description: 'Lays a bloodcurse — for 8s every blow the target strikes bleeds them, and that blood flows back to you.' },
  shadow_claws:     { name: 'Shadow Claws',      icon: '🌑', kind: 'targeted', effect: 'status', statusType: 'bloodcurse', durationMs: 8000,
    description: 'Rakes a bloodcurse into the target — their own attacks bleed them for 8s, healing you.' },
  wolf_mark:        { name: 'Wolf Mark',          icon: '🔶', kind: 'targeted', effect: 'status', statusType: 'wolfmark',   durationMs: 12000,
    description: 'Brands the target as prey — they take +30% damage for 12s.' },
  feral_haze:       { name: 'Feral Haze',        icon: '🔥', kind: 'targeted', effect: 'status', statusType: 'reversed',   durationMs: 4000,
    description: "Clouds the target's senses — their controls reverse for 4s." },
  snarl:            { name: 'Snarl',             icon: '😤', kind: 'targeted', effect: 'status', statusType: 'rooted',     durationMs: 3000,
    description: 'A bone-chilling snarl roots the target in place for 3s.' },
  scent_trail:      { name: 'Scent Trail',       icon: '🎯', kind: 'targeted', effect: 'howl_location',
    description: "Howls at the target, inviting them to howl back. If they join in, their approximate real-world location (never exact) is sent to you privately — entirely their choice, and never posted anywhere." },
  hunters_read:     { name: "Hunter's Read",     icon: '🐺', kind: 'targeted', effect: 'rap_sheet',
    description: "Swipe a nearby player and tear loose their rap sheet — their kills, deaths and notoriety, how long they've prowled, and a cold read of their class, level, health and gear. All in-world record, nothing real-world. They feel the wolf size them up." }
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
  echo_canyon:        { name: 'Echo Canyon',        icon: '🏞️', kind: 'aoe', effect: 'status', statusType: 'stumble', durationMs: 15000,
    description: "A disorienting canyon echo turns everyone nearby around — halving their walking speed." },
  deep_meditation:    { name: 'Deep Meditation',    icon: '🧘', kind: 'self', effect: 'meditate', durationMs: 60000,
    description: 'Sink into a deep trance — for a full minute NO attack can touch you, PvP or monster. The vow: you cannot strike while you meditate. You can still move and float freely.' },
  heavy_pack:         { name: 'Heavy Pack',         icon: '🎒', kind: 'targeted', effect: 'damage',
    description: "Hurl your crushing pack onto the target — real damage, and its weight ROOTS them in place for four seconds. They can't take a step." },
  endless_road:       { name: 'Endless Road',       icon: '🥿', kind: 'targeted', effect: 'status', statusType: 'stumble',    durationMs: 25000,
    description: "Curses the target's boots — the road stretches on forever, halving their speed." },
  featherlight_pack:  { name: 'Featherlight Pack',  icon: '🪶', kind: 'self', effect: 'evade', durationMs: 15000,
    description: "Shed every ounce of weight and go featherlight for fifteen seconds — attacks slip clean past you and roaming creatures lose your trail entirely, with a burst of speed to vanish." },
  shadow_owls:        { name: 'Shadow Owls',        icon: '🦉', kind: 'targeted', effect: 'damage',
    description: 'Loose a swarm of night owls that dive and rend — the hardest-hitting single strike any class owns, players and monsters alike, leaving the swarm circling the wound.' },
  wanderlust:         { name: 'Wanderlust',         icon: '🥾', kind: 'self', effect: 'status', statusType: 'speedboost', durationMs: 12000,
    description: 'A surge of wanderlust quickens your pace for a short burst.' },
  campfire_tale:      { name: 'Campfire Tale',      icon: '🔥', kind: 'self', effect: 'status', statusType: 'giant',      durationMs: 15000,
    description: 'Tall tales by the campfire make you feel larger than life.' },
  nightwatch_cloak:   { name: 'Nightwatch Cloak',   icon: '🌌', kind: 'self', effect: 'cloak', durationMs: 30000,
    description: 'Melt into the hush of the night watch — for thirty seconds you vanish completely from every other player, moving unseen at twice your pace. You still see yourself.' },
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
    description: "Restless spirits turn the target around — their controls reverse for 4s." },
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
    description: 'Call out the target — marked, they take +30% damage for 12s.' },
  steadfast_march:   { name: 'Steadfast March',    icon: '🥾', kind: 'self', effect: 'status',
    description: 'Fall into the old march cadence — twice your pace for a short burst.' },
  banner_of_dread:   { name: 'Banner of Dread',    icon: '🚩', kind: 'aoe', effect: 'status',
    description: 'Plant a banner so grim that everyone in range falters, their walking speed halved.' },
  guardians_veil:    { name: "Guardian's Veil",    icon: '🛡️', kind: 'aoe', effect: 'veil',
    description: "Raise a ward over everyone around you — yourself included. While it holds, a Werewolf's Hunter's Read, Rapid Swipe and Scent Trail all fail against those you shelter: the record crumbles, the pockets vanish, the scent won't answer. The counter to the hunt." }
};

// Must stay in sync with NECROMANCER_ATTACK_CATALOG in server.js. charId 5 —
// the summoner's kit: three tiers of undead that rise and fight until slain,
// plus a life-draining strike, a bone ward, and a withering chill.
const NECROMANCER_ATTACK_CATALOG = {
  raise_skeleton:   { name: 'Raise Skeleton',    icon: '💀', kind: 'self', effect: 'summon',
    description: 'Tear a Risen Skeleton up out of the ground. It hunts nearby foes and fights until it is cut down. Its strength grows with your level and your ritual rank.' },
  raise_boneknight: { name: 'Raise Bone Knight', icon: '🦴', kind: 'self', effect: 'summon',
    description: 'Raise a Bone Knight — a sturdier, harder-hitting undead. Answers at Level 7.' },
  raise_wight:      { name: 'Raise Grave Wight', icon: '☠️', kind: 'self', effect: 'summon',
    description: 'Call up a Grave Wight, the deadliest of your bound dead. Answers at Level 13.' },
  life_siphon:      { name: 'Life Siphon',       icon: '🩸', kind: 'targeted', effect: 'leech',
    description: 'Drain a target\'s life across the gap — the stolen vitality closes your own wounds.' },
  bone_ward:        { name: 'Bone Ward',         icon: '🦴', kind: 'self', effect: 'status',
    description: 'Lattice your body in bone — all damage against you is halved while it holds.' },
  grave_chill:      { name: 'Grave Chill',       icon: '🥶', kind: 'targeted', effect: 'status',
    description: 'Wither a foe with grave-cold — they take amplified damage from every source while it lasts (your undead love this).' },
};

// charId -> attack catalog the player can use. Drives both which characters
// get the Attacks button at all and which catalog the panel renders from.
// Every non-Witch class has a full kit now (the Witch's is SPELL_CATALOG).
const ATTACK_CATALOGS = {
  1: WEREWOLF_ATTACK_CATALOG,
  2: MYSTIC_ATTACK_CATALOG,
  3: KNIGHT_ATTACK_CATALOG,
  4: WANDERER_ATTACK_CATALOG,
  5: NECROMANCER_ATTACK_CATALOG
};

// Set when the server evicts this connection because the same account logged
// in elsewhere; onWsClose/maybeReconnectNow check it so this tab never auto-
// reconnects into a tug-of-war. Declared here (above setupWs, which opens the
// socket at load) so an immediate close — e.g. an expired session after a
// server restart — can read it without hitting a temporal-dead-zone error.
let sessionTakenOver = false;
function setupWs() {
  ws = new WebSocket(wsUrl());
  // Harden every send against reconnect races. The socket is reassigned on each
  // reconnect, and any of the ~100 ws.send() call sites (timers, the movement
  // loop, UI panels) can fire in the brief CONNECTING/CLOSING window before a
  // fresh socket is OPEN — a raw send then throws "InvalidStateError: The object
  // is in an invalid state", which surfaces as a scary red error banner even
  // though nothing is actually broken. A non-OPEN send loses the message either
  // way (it never reaches the server), so we drop it quietly instead of throwing;
  // onWsOpen re-sends the join and the client requests a world_resync on
  // reconnect, so transient dropped frames reconcile on their own.
  const rawSend = ws.send.bind(ws);
  ws.send = (data) => { if (ws.readyState === WebSocket.OPEN) rawSend(data); };
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
    // Exponential backoff (2s → 3s → 4.5s … capped at 20s). A fixed 2s retry
    // would have every client hammer the server in lockstep if it restarts on
    // launch night; backoff spreads the herd out. A short grace delay before
    // the banner keeps a sub-second blip from flashing an alarm at the player.
    reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts - 1), 20000);
    if (reconnectAttempts === 1 && !bannerGraceTimer) {
      bannerGraceTimer = setTimeout(() => { bannerGraceTimer = null; showReconnectBanner(true); }, 1200);
    } else {
      showReconnectBanner(true);
    }
    reconnectTimer = setTimeout(() => { reconnectTimer = null; setupWs(); }, delay);
  }
}
// Phones drop the socket when the screen sleeps or the app is backgrounded,
// then sit out the retry timer after waking. Reconnect the instant the tab
// is visible/online again instead.
function maybeReconnectNow() {
  if (sessionTakenOver) return;
  if (!gameStarted || !lastJoinPayload) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  // A deliberate wake (tab visible, network back, manual tap) wants to try
  // immediately, so collapse any pending backoff and reset the counter.
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  reconnectAttempts = 0;
  showReconnectBanner(true);
  setupWs();
}
// On refocus: if the socket died it reconnects (and gets a fresh backlog via
// init); if it's still open it just missed live lines, so ask for a catch-up.
function requestWorldResync() {
  if (!gameStarted) return;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'world_resync' }));
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { maybeReconnectNow(); requestWorldResync(); } });
window.addEventListener('online', () => { maybeReconnectNow(); requestWorldResync(); });
// Manual retry from the reconnect banner's "Reconnect now" button.
window.__reconnectNow = maybeReconnectNow;
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
    if (Array.isArray(msg.worldChat)) {
      worldFeed.length = 0; for (const m of msg.worldChat) worldFeed.push(m);
      // Pop a just-posted host greeting on (re)connect. Seeding the backlog
      // alone never notifies, so a greeting sent in the moments before a player
      // finished loading — exactly the "greet them as they arrive" case — would
      // otherwise only sit silently in the (closed-on-mobile) chat panel. Only
      // fresh host lines, only once each. spawnChatNotif is a no-op on desktop.
      try {
        const now = Date.now();
        for (const m of msg.worldChat) {
          if (m && m.host && m.ts && now - m.ts < 180000 && !_notifiedHostTs.has(m.ts)) {
            _notifiedHostTs.add(m.ts);
            spawnChatNotif({ name: m.name, color: m.color, text: m.text, image: m.image });
          }
        }
      } catch (e) {}
    }
    world = msg.world;
    TOWN_WORLD = world;
    // Equipment stat catalog — used to preview how a gear swap changes stats.
    if (msg.equipStats) equipStatsCatalog = msg.equipStats;
    // 🎃 Guise catalog (server-authoritative; see GUISES_CLIENT). The Disguise
    // menu renders from this, so a guise added/removed server-side needs no
    // client edit beyond its 3D mesh in client/guises.js.
    if (msg.guises) GUISES_CLIENT = msg.guises;
    // Merge the server's authoritative usable-item list so every consumable
    // (incl. any newly added brew) shows a Use button — no client hand-sync.
    if (Array.isArray(msg.usableItems)) for (const id of msg.usableItems) PLANT_EFFECTS.add(id);
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
    if (msg.wardrobe) myWardrobe = { purchased: msg.wardrobe.purchased || [], chaptersDone: msg.wardrobe.chaptersDone || 0, dyesPurchased: msg.wardrobe.dyesPurchased || [], nameColors: msg.wardrobe.nameColors || [], nameColorsOwned: msg.wardrobe.nameColorsOwned || [], nameColor: msg.wardrobe.nameColor || 'default' };
    if (msg.familiarCos) myFamiliarCos = { skins: msg.familiarCos.skins || [], owned: msg.familiarCos.owned || [], skin: msg.familiarCos.skin || 'default' };
    if (msg.auraCos) myAuraCos = { auras: msg.auraCos.auras || [], owned: msg.auraCos.owned || [], aura: msg.auraCos.aura || 'none' };
    if (msg.msPacks) msPacksCatalog = msg.msPacks;
    refreshMsUI();
    // ── Session L: dungeon lore, the calendar, delve twists, push ──
    if (msg.dungeonLore) dungeonLoreCatalog = msg.dungeonLore;
    if (msg.calendar) applyCalendarState(msg.calendar);
    if (msg.delveMods) weeklyDelveModsClient = msg.delveMods;
    if (Array.isArray(msg.craftRecipes)) craftRecipesClient = msg.craftRecipes;
    if (Array.isArray(msg.recipesUnlocked)) myRecipesUnlocked = msg.recipesUnlocked;
    if (msg.covenSigils) covenSigilsCatalog = msg.covenSigils;
    pushPublicKey = msg.pushPublicKey || null;
    pushAvailable = !!msg.pushAvailable;
    if (msg.townPass) {
      townPass30Cents = msg.townPass.price30Cents || townPass30Cents;
      townPass30Product = msg.townPass.product30 || townPass30Product;
    }
    // 😴 Rested XP window (bonus XP for the first minutes of a session).
    restedUntil = msg.restedUntil || 0;
    titlesState = msg.titles || null;
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
      amAdmin = !!msg.townPass.isAdmin; // dev account — every locked door opens
      if (msg.townPass.passUntil > Date.now()) {
        passUntil = msg.townPass.passUntil;
        localStorage.setItem('tc_pass_until', String(passUntil));
      }
      if (amAdmin) setUnlockToast('🔑 Admin access — every door is open for testing.');
      const _cb = document.getElementById('coordBar');
      if (_cb) _cb.classList.toggle('hidden', !amAdmin); // show the coordinate readout for admins
      refreshUnlockUI();
      refreshPassHud();
      if (typeof refreshBuildingLockVisuals === 'function') refreshBuildingLockVisuals();
    }
    world2 = msg.world2 || world2;
    if (world2) schedulePrebuildWilds(); // build the Wilds in the background so the first portal trip is instant
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
      if (mode === 'indoor' || activeScene === wildsScene || activeScene === dungeonScene || activeScene === emberScene || activeScene === refugeScene || activeScene === caveScene || activeScene === vaultScene || activeScene === manorScene || activeScene === cottageScene) {
        mode = 'outdoor';
        currentRoom = 'outside';
        swapToTownMap();
      }
    }
    for (const p of msg.players) addPlayer(p);
    if (Array.isArray(msg.echoes)) reconcileEchoes(msg.echoes);
    if (msg.bell) { bellState = msg.bell; try { renderBellTag(); } catch (e) {} }
    if (Array.isArray(msg.townFeed)) townFeed = msg.townFeed.slice(0, TOWN_FEED_MAX);
    me = players[myId];
    // Stream the KayKit character bodies for ANY spawn path. The join-button
    // flow (attemptJoin) calls KK.beginChars, but an auto-resume — a hard
    // refresh or a killed/restored tab rejoining from the stashed token — skips
    // that screen, so without this the bodies were never requested: you'd sit on
    // the classic fallback body and the "Loading world…" pill would wait forever
    // for a character that never streamed. beginChars is guarded (charsStarted),
    // so this is a no-op when the join screen already kicked it off.
    if (me && KK && KK.beginChars) { try { KK.beginChars(me.charId); } catch (e) {} }
    // A fresh connection always lands in the public world (the server resets
    // instance on resume), so clear any stale Moot state from a prior session.
    mootInstanceActive = false; setMootBanner(null);
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
      // Time-to-playable: ms from page load to this first render after join
      // (performance.now() is relative to the page's time origin). First join
      // only — reconnects reuse the already-loaded client, so they're not loads.
      if (!_ttpBeaconSent) {
        _ttpBeaconSent = true;
        sendHealthBeacon({ event: 'playable', ms: Math.round(performance.now()) });
      }
      // Now that play has started, reveal world chat (unless the viewer hid it)
      // and paint the backlog — the room-UI pass can't be relied on for this
      // when you spawn straight into the town (its no-op-on-same-room guard).
      syncChatVisibility();
      renderChatLog();
    } else {
      reconnectAttempts = 0;
      if (bannerGraceTimer) { clearTimeout(bannerGraceTimer); bannerGraceTimer = null; }
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

  if (msg.type === 'echoes') { reconcileEchoes(msg.echoes); return; }
  if (msg.type === 'town_bell') { onTownBell(msg); return; }
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
        // 🎃🐈‍⬛ Guise + familiar are account-scoped and server-authoritative (no
        // local prediction), so our OWN costume/companion must flow in here too
        // — otherwise updateGuises()/updateFamiliars() read a stale id and the
        // overlay never changes when we swap or doff it.
        { const self = players[myId]; if (self) { self.guise = p.guise || null; self.familiar = p.familiar || null; } }
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
        // Wardrobe: pick up another player's cosmetic change and rebuild their rig.
        existing.appearance = p.appearance || null;
        refreshPlayerAppearance(existing);
        existing.activeStatus = p.activeStatus || null;
        applyStatusVisual(p.id, existing.activeStatus);
        existing.invisible = !!p.invisible; // Nightwatch Cloak — hidden by syncLabels
        // 🎃 Samhain guise + 🐈‍⬛ bonded familiar ride the 70ms state stream;
        // updateGuises()/updateFamiliars() read them off the player each frame
        // and (re)build the overlay/companion when they change.
        existing.guise = p.guise || null;
        existing.familiar = p.familiar || null;
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
        if ((p.activeTitle || null) !== (existing.activeTitle || null)) {
          existing.activeTitle = p.activeTitle || null;
          refreshDisguiseVisual(p.id); // the nameplate composes name + title
        }
      } else {
        addPlayer(p);
        if (p.activeTitle) { const np = players[p.id]; if (np) { np.activeTitle = p.activeTitle; refreshDisguiseVisual(p.id); } }
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
    if (msg.dungeonMobs) { applyDungeonMobState(msg.dungeonMobs); reconcileDungeonMobVisuals(msg.dungeonMobs); }
    if (msg.villageNpcs) applyVillageNpcState(msg.villageNpcs);
    if (msg.torchNpcs) applyTownTorchNpcState(msg.torchNpcs);
    if (msg.torches) applyTownTorchState(msg.torches);
    applyTemplePortalState(!!msg.templePortalOpen);
    if (msg.emberMobs) applyEmberMobState(msg.emberMobs);
    if (msg.emberNodes) applyEmberNodeStates(msg.emberNodes);
    applyWorldBossState(msg.worldBoss || null); // far-north Wilds mega-boss (null clears it)
    applyMinionState(msg.minions || []); // the Necromancer's undead in this room
    if (msg.groundTraps) applyGroundTrapsState(msg.groundTraps);
    return;
  }

  if (msg.type === 'world_boss_rose') {
    showChapterCeremony(`${msg.icon || '💀'} ${msg.name} rises`, 'A world boss holds the Blighted Hollow, far north in the Wilds. Rally and bring it down!');
    setUnlockToast(`${msg.icon || '💀'} ${msg.name} has risen in the Wilds — rally to the Blighted Hollow!`);
    return;
  }
  if (msg.type === 'world_boss_gone') {
    if (msg.slain) showChapterCeremony(`${msg.icon || '🏆'} ${msg.name} slain`, `${msg.vanquisher || 'The town'} struck hardest. The spoils are shared among all who fought.`);
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
    if (typeof playSfx === 'function') playSfx('harvest');
    setUnlockToast('🌿 ' + msg.message);
    return;
  }

  if (msg.type === 'harvest_error') {
    setUnlockToast('🌿 ' + msg.message);
    return;
  }

  if (msg.type === 'use_result') {
    if (typeof playSfx === 'function') playSfx('drink');
    setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'craft_result') {
    if (typeof playSfx === 'function') playSfx('forge');
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
    if (typeof playSfx === 'function') playSfx('quest_accept');
    setUnlockToast(msg.message || `📜 Quest started: "${msg.questName}" — ${msg.description}`);
    appendSystemChatLine(msg.message || `📜 Quest started: "${msg.questName}"`);
    updateQuestTracker(msg.questId, msg.questName, 0, msg.target, msg.where);
    return;
  }

  if (msg.type === 'npc_hint_dialogue') {
    showNpcHintDialogue(msg);
    return;
  }

  if (msg.type === 'forbidden_book') { showForbiddenBook(msg); return; }
  if (msg.type === 'forbidden_codex') { renderForbiddenCodex(msg); return; }
  if (msg.type === 'cafe_special') { showCafeSpecial(msg); return; }
  if (msg.type === 'cafe_menu') { renderCafeMenu(msg); return; }
  if (msg.type === 'arcade_result') {
    if (msg.completed && msg.grantedTitleName) setUnlockToast(`🕹️ ${msg.grantedTitleName}! You top today's board.`);
    else if (msg.isPersonalBest) setUnlockToast(`🏆 New best today: ${msg.score}` + (msg.rank ? ` — #${msg.rank} in town` : ''));
    return;
  }
  if (msg.type === 'arcade_board') { renderArcadeBoard(msg); return; }
  if (msg.type === 'vigil_result') { showVigilResult(msg); return; }
  if (msg.type === 'vigil_register') { renderVigilRegister(msg); return; }
  if (msg.type === 'relic_card') { showRelicCard(msg); return; }
  if (msg.type === 'reliquary') { renderReliquary(msg); return; }
  if (msg.type === 'codex_state') { renderCodex(msg); return; }
  if (msg.type === 'guest_nudge') { showGuestNudge(); return; }
  if (msg.type === 'claim_result') { onClaimResult(msg); return; }
  if (msg.type === 'town_pulse') { onTownPulse(msg); return; }
  if (msg.type === 'town_feed_add') { onTownFeedAdd(msg.item); return; }
  if (msg.type === 'invite_state') { renderInvite(msg); return; }

  if (msg.type === 'quest_update') {
    updateQuestTracker(msg.questId, msg.questName, msg.progress, msg.target, msg.where);
    // Side-quest ticks used to be silent — a progress beat you can feel
    // (and a louder one when you're one away) keeps the loop warm.
    if (msg.message) setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'quest_complete') {
    clearQuestTracker();
    if (typeof playSfx === 'function') playSfx('quest_fanfare');
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
    // No intro pop-up on begin: you just read the chapter's opening in the
    // Journal to click Begin, so a second box would be redundant. The story
    // beat box is kept for chapter COMPLETE (the outro), where it lands as a
    // payoff you didn't already have in front of you. (The server still sends
    // `intro`; it's simply unused here — the Journal remains its home.)
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
    // The closing narration as an in-the-moment dialogue box — the outro prose
    // that used to live only in the Journal now lands right when you finish the
    // chapter (e.g. the moment you talk to the NPC), with its rewards.
    showStoryBeat({
      kicker: msg.storyComplete ? '🏆 Story Complete' : `📖 Chapter ${msg.chapterIndex || ''} Complete`,
      title: msg.chapterTitle,
      body: msg.outro,
      rewards: msg.rewards,
      isComplete: msg.storyComplete
    });
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
    if (typeof playSfx === 'function') playSfx('levelup');
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
    if (typeof playSfx === 'function') playSfx('hurt'); // you took a hit
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
    if (typeof playSfx === 'function' && /Champions. Table/i.test(msg.message || '')) playSfx('coven_crown');
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

  if (msg.type === 'appearance_set') {
    // Server-confirmed wardrobe look (possibly clamped). Reconcile + rebuild.
    const me = (myId && players[myId]) ? players[myId] : null;
    if (me) { me.appearance = msg.appearance || null; refreshPlayerAppearance(me); }
    if (typeof window.__renderWardrobe === 'function') try { window.__renderWardrobe(); } catch (e) {}
    return;
  }

  if (msg.type === 'look_bought') {
    // A Moonstone look just unlocked — record it and wear it right away.
    if (myWardrobe.purchased.indexOf(msg.weapon) === -1) myWardrobe.purchased.push(msg.weapon);
    setUnlockToast('🎭 New look unlocked!');
    if (typeof window.__applyWardrobe === 'function') try { window.__applyWardrobe({ weapon: msg.weapon }); } catch (e) {}
    else if (typeof window.__renderWardrobe === 'function') try { window.__renderWardrobe(); } catch (e) {}
    return;
  }

  if (msg.type === 'dye_bought') {
    // A Moonstone dye just unlocked (account-wide) — record it and just re-render
    // the shop so the new swatch becomes selectable (don't force-wear a color).
    if (!myWardrobe.dyesPurchased) myWardrobe.dyesPurchased = [];
    if (myWardrobe.dyesPurchased.indexOf(msg.dye) === -1) myWardrobe.dyesPurchased.push(msg.dye);
    setUnlockToast('🎨 New dye unlocked!');
    if (typeof window.__renderWardrobe === 'function') try { window.__renderWardrobe(); } catch (e) {}
    return;
  }
  if (msg.type === 'name_color_set') {
    // Name color equipped (and bought if it was premium). Record ownership +
    // the worn id; the live nameplate/chat color updates from server state.
    myWardrobe.nameColorsOwned = msg.owned || myWardrobe.nameColorsOwned || [];
    myWardrobe.nameColor = msg.colorId;
    setUnlockToast('🎨 Name color set!');
    if (typeof window.__renderWardrobe === 'function') try { window.__renderWardrobe(); } catch (e) {}
    return;
  }

  if (msg.type === 'bug_ack') {
    // Server received (or rejected) an in-game bug report. Toast the result and,
    // on success, close the modal so the player gets a clean "done" beat.
    const sb = document.getElementById('bugSendBtn');
    if (sb) { sb.disabled = false; sb.textContent = 'Send report'; }
    setUnlockToast((msg.ok ? '' : '⚠️ ') + (msg.message || (msg.ok ? 'Thank you! Your report was sent.' : 'Could not send that report.')));
    if (msg.ok && typeof window.__closeBugModal === 'function') try { window.__closeBugModal(); } catch (e) {}
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

  if (msg.type === 'achievements_state') {
    achState = msg;
    if (Modals.isOpen('achModalOpen')) renderAchModal();
    return;
  }
  if (msg.type === 'titles_state') {
    titlesState = { earned: msg.earned || [], active: msg.active || null };
    if (Modals.isOpen('titlesModalOpen')) renderTitlesModal();
    return;
  }

  if (msg.type === 'achievement_unlocked') {
    // A gilded toast; the town shout (for a capstone) arrives separately as an
    // 'announce'. Refresh the log if it happens to be open.
    setUnlockToast(msg.message || `🏆 Achievement unlocked — ${msg.ach && msg.ach.name}`);
    if (Modals.isOpen('achModalOpen') && ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'achievements_state' }));
    return;
  }

  if (msg.type === 'workshop_craft_result') {
    if (typeof playSfx === 'function') playSfx('forge');
    setUnlockToast(msg.message || `🔨 Crafted ${msg.resultName || ''}`);
    renderWorkshopModal(); // inventory_state (sent alongside) refreshes counts; redraw the tree
    return;
  }
  if (msg.type === 'workshop_craft_error') {
    const el = document.getElementById('workshopErr');
    if (el) el.textContent = msg.message || 'That craft failed.';
    return;
  }
  if (msg.type === 'recipe_bought') {
    if (myRecipesUnlocked.indexOf(msg.recipeId) === -1) myRecipesUnlocked.push(msg.recipeId);
    if (msg.message) setUnlockToast(msg.message);
    renderWorkshopModal(); // bank_state (sent alongside) refreshes gold; redraw so it's now learned
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
    // A climb-out gets a completion flourish; a death is already voiced by the
    // you_died 'death' toll that preceded this, so don't double it here.
    if (msg.reason !== 'death' && typeof playSfx === 'function') playSfx('quest_fanfare');
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

  if (msg.type && msg.type.indexOf('coven_voice_') === 0) { _covenVoice.handleMessage(msg); return; }

  if (msg.type === 'coven_state') {
    covenState = msg.coven || null;
    if (msg.charters != null) covenCharterInfo = { charters: msg.charters || 0, charterPriceCents: msg.charterPriceCents || 999, paymentsEnabled: !!msg.paymentsEnabled };
    refreshCovenMenuRow();
    if (Modals.isOpen('covenModalOpen')) renderCovenModal();
    if (!covenState) _covenVoice.stop(); // left/disbanded the coven — drop out of voice
    _covenVoice.render();
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

  if (msg.type === 'pvp_invited') { openBattleInviteToast(msg); return; }
  if (msg.type === 'pvp_duel_started') {
    setUnlockToast(`🤺 Battle begun with ${msg.opponentName} — strike to fight!`);
    return;
  }
  if (msg.type === 'pvp_error') { setUnlockToast(msg.message); return; }

  if (msg.type === 'coven_invited') {
    openCovenInviteToast(msg);
    return;
  }

  if (msg.type === 'coven_error') {
    if (msg.needCharter) {
      // Sync the charter state from the server so the create button relabels to
      // "Found a coven — $X" and the next click starts checkout.
      covenCharterInfo = { charters: 0, charterPriceCents: msg.priceCents || covenCharterInfo.charterPriceCents, paymentsEnabled: !!msg.paymentsEnabled };
      if (Modals.isOpen('covenModalOpen')) renderCovenModal();
    }
    if (Modals.isOpen('covenModalOpen')) document.getElementById('covenErr').textContent = msg.message;
    else setUnlockToast(msg.message);
    return;
  }

  if (msg.type === 'coven_table_state') {
    covenTableState = msg.table || null;
    covenChampions = msg.champions || null;
    refreshCovenTableVisual();
    return;
  }
  if (msg.type === 'coven_standings') {
    covenStandingsState = msg;
    if (Modals.isOpen('covenModalOpen')) renderCovenStandings();
    return;
  }
  if (msg.type === 'rite_state') {
    covenRiteState = msg.rite || null;
    if (Modals.isOpen('covenModalOpen')) renderCovenRite();
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

  if (msg.type === 'voice_echo') {
    playVoiceEcho(msg);
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
    if (msg.casterId === myId) {
      if (typeof playSfx === 'function') playSfx(msg.dead ? 'kill' : meleeHitSfx()); // my blow landed (per-class melee)
      if (msg.dead) { shakeScreen('S'); haptic([12, 25, 20]); }
    } else {
      remoteActionSfx(msg.casterId, msg.dead ? 'kill' : remoteMeleeSfx(msg.casterId)); // a nearby player's blow landed
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
    if (typeof playSfx === 'function') playSfx('death');
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
    if (typeof playSfx === 'function') playSfx('portal'); // traversal into the dungeon / next delve floor
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
    // This week's keystone affixes — a short follow-up toast so players know
    // why the dungeon feels different (and richer) this week. Not for the
    // Delve, which runs its own modifiers.
    if (!msg.delve && Array.isArray(msg.affixes) && msg.affixes.length) {
      const line = msg.affixes.map(a => `${a.icon} ${a.name}`).join('  ·  ');
      setTimeout(() => setUnlockToast(`🔑 This week's keystones: ${line}. ${msg.affixes.map(a => a.desc).join(' ')}`), 2600);
    }
    pokeRoomTag();
    return;
  }

  // The Moot Stone (Session N): the world geometry is unchanged, so there's no
  // scene swap — we just swap WHICH players are visible. Forget everyone from the
  // world we left, then populate from the fresh roster for the world we entered.
  if (msg.type === 'moot_entered' || msg.type === 'moot_exited') {
    mootInstanceActive = (msg.type === 'moot_entered');
    if (typeof playSfx === 'function') playSfx('hagstone'); // the veil parting as you pass through, either way
    for (const id of Object.keys(players)) { if (id !== myId) removePlayer(id); }
    if (Array.isArray(msg.roster)) for (const p of msg.roster) { if (p.id !== myId) addPlayer(p); }
    applyManorInstanceState(mootInstanceActive); // the Manor exists only in a coven's private Wilds
    setMootBanner(mootInstanceActive ? msg : null);
    if (mootInstanceActive) openHagstoneWelcome(msg); // one-time "welcome to your private world" card
    setUnlockToast(mootInstanceActive
      ? `🌑 You slip through the Hagstone into ${(msg.covenSigil || '')} ${msg.covenName || 'your coven'}'s private world — only your coven can reach you here.`
      : '🌒 You step back through the Hagstone into the public town.');
    pokeRoomTag();
    return;
  }
  if (msg.type === 'moot_error') {
    setUnlockToast(msg.message || 'The Hagstone does not answer.');
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
      equippedRing:   msg.equippedRing   || null,
      // Access flag for the 💽 tab — must be carried through or the tab reads
      // "you don't have one" once the bound drive's item has dissolved.
      hardDriveOwned: !!msg.hardDriveOwned,
      // 🗡️ Durability: per-item edge, total repair cost, any fully-dulled gear.
      gearEdge: msg.gearEdge || {},
      repairCost: msg.repairCost || 0,
      gearDulled: !!msg.gearDulled
    };
    renderInventoryItemsPanel();
    if (Modals.isOpen('bankModalOpen')) populateBankDepositSelect();
    if (Modals.isOpen('auctionModalOpen')) populateAuctionItemSelect();
    if (Modals.isOpen('bedChestModalOpen')) renderManorChest(); // keep the pack grid in sync
    if (Modals.isOpen('workshopModalOpen')) renderWorkshopModal(); // crafting tree have/need counts
    applyMyEquipVisual(msg);
    return;
  }

  if (msg.type === 'spell_result') {
    if (typeof playSfx === 'function') playSfx(sfxForAbility(lastCastAtk, lastCastId));
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
    // Prefer this spell's own bespoke clip (id == sound id) when it's been
    // generated; otherwise the generic per-effect fallback as before.
    const sid = REMOTE_SPELL_SFX[msg.spellId];
    if (sid || (typeof sfxAvailable === 'function' && sfxAvailable(msg.spellId))) {
      const fb = sid === 'siphon' ? sfxPick('siphon', 'curse') : (sid || 'cast');
      remoteActionSfx(msg.casterId, sfxPick(msg.spellId, fb)); // a nearby player's spell
    }
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
    const aid = REMOTE_ATTACK_SFX[msg.attackId];
    if (aid || (typeof sfxAvailable === 'function' && sfxAvailable(msg.attackId))) {
      const fb = aid === 'siphon' ? sfxPick('siphon', 'curse') : sfxPick(aid || 'hit', 'hit');
      remoteActionSfx(msg.casterId, sfxPick(msg.attackId, fb)); // a nearby player's class attack
    }
    return;
  }

  if (msg.type === 'veil_fx') {
    spawnVeilDome(msg.casterId, msg.radius || 200);
    remoteActionSfx(msg.casterId, 'ward'); // a nearby player's protective veil
    return;
  }

  if (msg.type === 'spell_error') {
    if (typeof playSfx === 'function') playSfx('error');
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
    if (typeof playSfx === 'function') playSfx(sfxForAbility(lastCastAtk, lastCastId));
    if (Modals.isOpen('attackPanelOpen')) document.getElementById('attackErr').textContent = '';
    setUnlockToast(msg.message);
    if (msg.revealTargetId) showGlimpseBeacon(msg.revealTargetId);
    if (msg.itemsSeen) openPickpocketPanel(msg.pickpocketTargetName, msg.itemsSeen, msg.stolenItemId);
    if (msg.rapSheet) openRapSheetPanel(msg.rapSheet);
    return;
  }

  if (msg.type === 'attack_error') {
    if (typeof playSfx === 'function') playSfx('error');
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

  if (msg.type === 'world_sync') {
    // Catch-up after a refocus (see requestWorldResync): merge any world lines
    // we missed while backgrounded, de-duped against what we already have.
    const have = new Set(worldFeed.map(x => (x.id || '') + '|' + (x.ts || 0) + '|' + (x.text || '')));
    let added = 0;
    for (const x of (msg.messages || [])) {
      const k = (x.id || '') + '|' + (x.ts || 0) + '|' + (x.text || '');
      if (!have.has(k)) { worldFeed.push(x); have.add(k); added++; }
    }
    if (added) {
      worldFeed.sort((a, b) => (a.ts || 0) - (b.ts || 0));
      while (worldFeed.length > 120) worldFeed.shift();
      renderChatLog();
    }
    return;
  }

  if (msg.type === 'chat') {
    const m = msg.message;
    // World chat (the default global channel) rides the always-visible feed;
    // coven-private chat stays in its room bucket. Either way the server only
    // delivered it to someone meant to see it.
    let destTab;
    if (m.scope === 'world' || !m.scope) {
      worldFeed.push(m); if (worldFeed.length > 120) worldFeed.shift();
      destTab = 'world';
    } else {
      if (!messagesByRoom[m.room]) messagesByRoom[m.room] = [];
      messagesByRoom[m.room].push(m);
      destTab = 'room';
    }
    // Badge the other tab if a line landed there while you're reading this one
    // (your own lines never badge).
    if (destTab !== activeChatTab && m.id !== myId) bumpChatBadge(destTab);
    renderChatLog();
    if (m.id && players[m.id]) players[m.id].lastChatAt = Date.now();
    // An overhead bubble / mobile banner only makes sense for a speaker you can
    // actually see — someone in your own room (and therefore your own layer).
    // World chatter from elsewhere just rides the feed. Suppressed entirely when
    // the viewer has hidden chat.
    const speakerVisible = m.id && players[m.id] && players[m.id].room === currentRoom;
    // Host/system lines (the dev greeting the world) have no in-world avatar,
    // so there's no one to float an overhead bubble over — but on mobile, where
    // the chat panel is usually closed, they'd otherwise never surface. Pop them
    // as a chat notification like any visible speaker so arrivals actually see
    // the greeting. (spawnChatNotif is a no-op on desktop, which has the panel.)
    if (!chatHidden && (speakerVisible || m.host) && !(m.id !== myId && isMutedName(m.name))) {
      if (!MOBILE_UI && speakerVisible) setOverheadBubble(m.id, m.text, !!m.image);
      else spawnChatNotif({ name: m.name, color: m.color, text: m.text, image: m.image, self: m.id === myId });
    }
    return;
  }

  if (msg.type === 'room_backlog') {
    // Walking into a building: seed its private tab with recent lines so it
    // reads as an active room. Keep any system beats already queued for it.
    const room = msg.room;
    const sys = (messagesByRoom[room] || []).filter(x => x.system);
    messagesByRoom[room] = sys.concat((msg.log || []).map(x => ({ ...x, scope: 'room', room })));
    if (currentRoom === room) renderChatLog();
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
    // World chat is global, so purge the leaver/muted speaker from the shared
    // feed too (not just the room bucket).
    for (let i = worldFeed.length - 1; i >= 0; i--) if (worldFeed[i].id === msg.id) worldFeed.splice(i, 1);
    renderChatLog();
    return;
  }

  if (msg.type === 'ms_state') {
    myMoonstones = msg.balance || 0;
    refreshMsUI();
    if (Modals.isOpen('bedChestModalOpen')) renderManorChest(); // adorn UI shows balance
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
    if (typeof playSfx === 'function') playSfx('loot');
    setUnlockToast(`🛒 Bought ${msg.itemName} for ${msg.price} gold!`);
    // Refresh balance display next time shop is opened
    return;
  }

  if (msg.type === 'shop_sold') {
    if (typeof playSfx === 'function') playSfx('loot');
    setUnlockToast(`💰 Sold ${msg.itemName}${msg.qty > 1 ? ' ×' + msg.qty : ''} for ${msg.gold} gold!`);
    if (typeof playSfx === 'function') playSfx('coin');
    if (lastBankState) lastBankState.balance = msg.balance;
    if (Modals.isOpen('npcShopOpen')) {
      const balEl = document.getElementById('npcShopBalance');
      if (balEl) balEl.innerHTML = `Balance: ${msg.balance} <span class="coin"></span>`;
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

  // ── The Ember Refuge (private chat shelter on the ember flat) ─────────────
  if (msg.type === 'ember_refuge_entered') {
    if (me) { me.room = 'ember_refuge'; me.x = msg.spawn.x; me.y = msg.spawn.y; }
    swapToRefugeMap();
    return;
  }

  if (msg.type === 'ember_refuge_exited') {
    if (me) { me.room = 'ember_wastes'; me.x = msg.x; me.y = msg.y; }
    swapToEmberMap();
    setUnlockToast('🔥 You step back out onto the ember flat.');
    return;
  }

  // ── The Coven Manor (Session N) ──────────────────────────────────────────
  if (msg.type === 'manor_entered') {
    if (me) { me.room = 'manor'; me.x = msg.spawn.x; me.y = msg.spawn.y; }
    swapToManorMap();
    applyManorState(msg);
    setUnlockToast(`🏚️ You step into ${msg.covenName ? msg.covenName + '’s' : 'the coven’s'} Manor — claim a chamber with F.`);
    return;
  }
  if (msg.type === 'manor_exited') {
    if (me) { me.room = 'wilds'; me.x = msg.x; me.y = msg.y; }
    if (Modals.isOpen('bedChestModalOpen')) closeManorChest();
    swapToWildsMap();
    setUnlockToast('You step back out into the Wilds.');
    return;
  }

  // ── The cottage (player housing, slice 2) ────────────────────────────────
  if (msg.type === 'cottage_entered') {
    if (me) { me.room = 'cottage'; me.instance = 'home'; me.x = msg.spawn.x; me.y = msg.spawn.y; }
    swapToCottageMap();
    renderCottageFurniture({ grid: msg.grid, pieces: msg.pieces, catalog: msg.catalog });
    if (Modals.isOpen('homeOpen')) closeHomeModal();
    setUnlockToast('🏠 You step into your cottage. Press F at the door to leave; open 🏠 Home to rearrange.');
    return;
  }
  if (msg.type === 'cottage_exited') {
    if (me) { me.room = 'outside'; me.instance = ''; me.x = msg.x; me.y = msg.y; }
    swapToTownMap();
    setUnlockToast('You step back out into the town square.');
    return;
  }
  if (msg.type === 'cottage_layout') {
    renderCottageFurniture({ grid: msg.grid, pieces: msg.pieces, catalog: msg.catalog });
    return;
  }
  if (msg.type === 'manor_state') {
    applyManorState(msg);
    return;
  }
  if (msg.type === 'manor_storage_state') {
    manorChestSlots = Array.isArray(msg.slots) ? msg.slots : [];
    renderManorChest();
    return;
  }
  if (msg.type === 'altar_unlocks') {
    if (msg.unlocks) manorYourUnlocks = msg.unlocks;
    if (Modals.isOpen('bedChestModalOpen')) renderManorChest();
    return;
  }
  if (msg.type === 'toast') {
    if (msg.message) setUnlockToast(msg.message);
    return;
  }
  if (msg.type === 'familiar_state') { myFamiliar = msg.familiar || null; if (Modals.isOpen('familiarOpen')) renderFamiliarModal(); return; }
  if (msg.type === 'familiar_skin_set') {
    myFamiliarCos.owned = msg.owned || myFamiliarCos.owned || [];
    myFamiliarCos.skin = msg.skinId;
    if (me && players[me.id]) players[me.id].familiarSkin = msg.skinId; // recolor your own follower at once
    setUnlockToast('🎨 Familiar coat set!');
    if (Modals.isOpen('familiarOpen')) renderFamiliarModal();
    return;
  }
  if (msg.type === 'aura_set') {
    myAuraCos.owned = msg.owned || myAuraCos.owned || [];
    myAuraCos.aura = msg.auraId;
    if (me && players[me.id]) players[me.id].aura = msg.auraId; // light your own aura at once
    setUnlockToast('🌟 Aura set!');
    if (typeof window.__renderWardrobe === 'function') try { window.__renderWardrobe(); } catch (e) {}
    return;
  }
  if (msg.type === 'guise_state') { myGuise = msg.guise || null; if (Modals.isOpen('guiseOpen')) renderGuiseModal(); return; }
  if (msg.type === 'guise_error') { setUnlockToast(msg.message || 'The wardrobe is shut.'); return; }
  if (msg.type === 'scry_reading') { lastScry = msg; if (Modals.isOpen('scryOpen')) renderScryModal(); return; }
  if (msg.type === 'path_state') { myWitchPath = msg.path || null; if (Modals.isOpen('pathOpen')) renderPathModal(); return; }
  if (msg.type === 'path_error') { setUnlockToast(`🧙‍♀️ ${msg.message}`); return; }
  if (msg.type === 'ward_state') { myWardUntil = msg.until || 0; renderStatusEffects(); return; }
  if (msg.type === 'garden_state') { lastGardenState = msg; if (Array.isArray(msg.plantable)) for (const id of msg.plantable) gardenPlantable.add(id); if (Modals.isOpen('gardenOpen')) renderGardenModal(); return; }
  if (msg.type === 'garden_error') { setUnlockToast(`🌱 ${msg.message}`); return; }
  if (msg.type === 'home_state') { lastHomeState = msg; if (Modals.isOpen('homeOpen')) renderHomeModal(); return; }
  if (msg.type === 'home_error') { setUnlockToast(`🏠 ${msg.message}`); return; }
  if (msg.type === 'tea_state') { lastTeaState = msg; if (Modals.isOpen('kitchenOpen')) renderKitchenModal(); return; }
  if (msg.type === 'ancestor_state') { lastAncestorState = msg; if (Modals.isOpen('ancestorOpen')) renderAncestorModal(); renderStatusEffects(); return; }
  if (msg.type === 'ancestor_error') { setUnlockToast(msg.message || 'The altar is silent.'); return; }
  if (msg.type === 'release_state') { lastReleaseState = msg; if (Modals.isOpen('releaseOpen')) renderReleaseModal(); return; }
  if (msg.type === 'release_error') { setUnlockToast(msg.message || 'The fire is cold.'); return; }
  if (msg.type === 'tea_error') { setUnlockToast(`🍵 ${msg.message}`); return; }
  if (msg.type === 'tarot_result') {
    _lastTarotResult = msg;
    if (msg.balance != null && lastBankState) lastBankState.balance = msg.balance;
    try { updateGoldReadouts(); } catch (e) { /* readouts not ready */ }
    if (Modals.isOpen('tarotOpen')) renderTarotModal(msg);
    return;
  }
  if (msg.type === 'familiar_error') { setUnlockToast(`🐈‍⬛ ${msg.message}`); return; }
  if (msg.type === 'ritual_state') {
    // { active: {id,stat,amount,until}|null, cdUntil, now } — rebase the server
    // clock to local so the countdowns are accurate regardless of clock skew.
    const skew = Date.now() - (msg.now || Date.now());
    ritualActive = msg.active ? { ...msg.active, until: msg.active.until + skew } : null;
    ritualCdUntil = (msg.cdUntil || 0) + skew;
    refreshRitualHud();
    if (Modals.isOpen('bedChestModalOpen')) renderManorChest();
    return;
  }
  if (msg.type === 'manor_error') {
    setUnlockToast(msg.message || 'The Manor door will not open.');
    return;
  }

  if (msg.type === 'solo_seance_offer') { openSeanceModal({ solo: true }); return; }
  if (msg.type && msg.type.indexOf('seance_') === 0) {
    if (msg.type === 'seance_begin' && typeof playSfx === 'function') playSfx('seance');
    if (msg.type === 'seance_error') setUnlockToast(msg.message || 'The board will not answer.');
    handleSeanceMessage(msg);
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
    emberLandmarks = msg.landmarks || [];
    emberDiscovered = {};
    if (me) { me.room = 'ember_wastes'; me.x = msg.spawn.x; me.y = msg.spawn.y; }
    swapToEmberMap();
    // Resource veins: build their meshes now the scene exists, and fold their
    // interact kiosks in (survives every EMBER_KIOSKS rebuild via the setter).
    emberNodeKiosks = setEmberNodeDefs(msg.nodes || []);
    if (msg.greeting) {
      // Center ceremony only — the top toast banner was redundant with this.
      showChapterCeremony('🔥 The Ember Wastes', 'An open PvP battleground — anyone may strike you. The portal is the only way out, and it closes with the torches.');
    }
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
      if (typeof playSfx === 'function') playSfx('loot');
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
    if (typeof playSfx === 'function') playSfx('brew');
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
    appearance: p.appearance || null, // Phase 1 cosmetic wardrobe
    guise: p.guise || null, // 🎃 Samhain costume overlay (client/guises.js)
    familiar: p.familiar || null, // 🐈‍⬛ bonded companion (client/familiars.js)
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
  if (!el) return;
  el.classList.toggle('hidden', !show);
  if (!show) return;
  const msg = document.getElementById('reconnectMsg');
  const btn = document.getElementById('reconnectNowBtn');
  // After a few failed tries the automatic retry is clearly slow (server down,
  // bad network) — give the player a button so they're not stuck watching.
  const stalled = reconnectAttempts >= 3;
  if (msg) msg.textContent = stalled
    ? '⚡ Still trying to reconnect…'
    : '⚡ Connection lost — reconnecting…';
  if (btn) btn.classList.toggle('hidden', !stalled);
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
  updateCharPickerVisibility, apiUrlMaybe, attemptJoin, loadSavedAccount,
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
// Restore a saved account now that the factory's bindings are assigned. This
// MUST run after the destructure above, not inside createAccountSelect() — see
// the note in account-select.js (it reaches back into main's just-declared
// consts, which would TDZ and abort boot if run during construction).
loadSavedAccount();

// ---------------------------------------------------------------------------
// World / collision — identical math to the 2D version. "y" here is treated
// as the ground-plane depth (Z) axis once it reaches the 3D renderer; the
// collision/room logic itself doesn't care, it's all plain numbers.
// ---------------------------------------------------------------------------
function buildWalls(w) {
  const list = [];
  // Tag each rect with its building id so refitBuildingColliders() can replace
  // a building's wall rects in-place later (once its KayKit model is measured)
  // without disturbing the decor/tree colliders addNatureDecor() mixes in.
  for (const b of w.buildings) for (const r of buildWallsForOne(b, w)) list.push({ ...r, bld: b.id });
  return list;
}

// Re-cut a building's collider to match the footprint its placed KayKit model
// ACTUALLY fills, so collision lines up with what you see. The outdoor collider
// starts as the full data rectangle, but a model is scaled uniformly to the
// geometric mean of that rect, so on a non-square footprint it is both narrower
// across the door AND (for the castle-style models) DEEPER front-to-back than the
// rect, then flushed to the door wall — so its rear overhangs the footprint.
//
// Both axes therefore track the model box, not the data rect:
//  - DOOR AXIS (depth): use the model's real span verbatim, NOT clamped to the
//    data rect. Clamping it was the "walk into the building" bug — the model's
//    rear stuck out past the rect, the clamp left that overhang with no wall, and
//    you could stroll in the back and only stop at a wall deep inside.
//  - CROSS AXIS (width): the model's real width, but CENTERED on the footprint
//    rather than placed at the model box's own position. kkAutoAlign can shift a
//    model sideways by up to ~29% to line its steps up with the door; following
//    that offset put the collider off to one side (the earlier walk-in). Centering
//    keeps it symmetric under the model.
//
// Net: the collider is the model's XZ bounding box, recentred across the door —
// it matches the visible walls, so no invisible wall beside it and no open gap to
// walk through into it.
//
// box = { minx, minz, maxx, maxz } of the placed model in world XZ; a missing or
// degenerate box falls back to the data rect unchanged. side = the door side
// ('south'|'north'|'east'|'west'); it decides which axis is depth vs width. Pure.
function fitBuildingFootprint(b, box, side) {
  if (!box) return { x: b.x, y: b.y, w: b.w, h: b.h };
  const s = side || (b && b.door) || 'south';
  const cx = b.x + b.w / 2, cz = b.y + b.h / 2;
  const doorAxisZ = (s === 'south' || s === 'north'); // depth runs along Z
  const modelW = box.maxx - box.minx; // model's real span across X
  const modelD = box.maxz - box.minz; // model's real span across Z
  let x0, z0, w, h;
  if (doorAxisZ) {
    z0 = box.minz; h = modelD;         // depth: the model's real span (covers the rear overhang)
    w = modelW; x0 = cx - w / 2;       // width: model width, centered on the footprint
  } else {
    x0 = box.minx; w = modelW;         // depth runs along X
    h = modelD; z0 = cz - h / 2;       // width runs along Z, centered
  }
  if (w < 40 || h < 40) return { x: b.x, y: b.y, w: b.w, h: b.h }; // never trust a degenerate fit
  return { x: x0, y: z0, w, h };
}

// Re-cut every building's outdoor collider to the footprint its placed KayKit
// model actually fills, so collision lines up with what you see. Client-only:
// the server does no wall collision (it only clamps to room bounds + flags
// teleports), so there's no desync. Decor/tree colliders (untagged) are kept.
// Per-building collider inset for round tower models, whose square bounding box
// leaves empty, still-colliding corners (see the note in refitBuildingColliders).
const ROUND_TOWER_INSET = { lounge: 0.8, bank: 0.82 };
function refitBuildingColliders() {
  walls = walls.filter((r) => !r.bld);
  // Opt-in diagnostic: load the game with ?colliderdebug=1 to print each
  // building's data rect, its measured model box, and the fitted collider — so a
  // mismatch can be read off the console instead of guessed at.
  let dbg = false;
  try { dbg = typeof location !== 'undefined' && !!location.search && location.search.includes('colliderdebug'); } catch (e) { /* noop */ }
  for (const b of world.buildings) {
    const bb = KK_BLD_BOXES[b.id];
    const box = bb ? { minx: bb.min.x, minz: bb.min.z, maxx: bb.max.x, maxz: bb.max.z } : null;
    const fit = fitBuildingFootprint(b, box, getDoorSide(b));
    // Round tower models (the lounge's tower_A, the bank's tower_base) don't fill
    // their square model box, so the empty corners of a rectangular collider read
    // as invisible walls (user-reported beside the lounge). Collision is AABB-only,
    // so inset these two toward the round silhouette: it trades the big empty
    // corners for letting you brush a little closer to the curved wall at the
    // cardinal edges. Centred, so the door gap stays under the tower.
    const f = ROUND_TOWER_INSET[b.id];
    if (f) { fit.x += fit.w * (1 - f) / 2; fit.y += fit.h * (1 - f) / 2; fit.w *= f; fit.h *= f; }
    // Stash the fitted footprint on the building so roomAt() (room entry + the
    // location label) keys off the SAME rect the walls do — otherwise the data
    // rect's unwalled margins become a free teleport into the interior.
    b._fit = { x: fit.x, y: fit.y, w: fit.w, h: fit.h };
    if (dbg) { try { console.log('[collider]', b.id, 'door', getDoorSide(b), 'data', { x: b.x, y: b.y, w: b.w, h: b.h }, 'model', box, 'fit', fit); } catch (e) { /* noop */ } }
    const fb = { ...b, x: fit.x, y: fit.y, w: fit.w, h: fit.h };
    for (const r of buildWallsForOne(fb, world)) walls.push({ ...r, bld: b.id });
  }
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
let amAdmin = false; // set from the init payload for dev/admin accounts
function hasTownPass() { return amAdmin || passUntil > Date.now(); }
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

// A member of a good-standing (paid-upkeep) coven can enter the Phantom Parlor
// without a personal Town Pass — the Rite's altar is there. Mirrors the server's
// canEnterPassRoom; derived from the coven_state upkeep timestamps.
function inGoodStandingCoven() {
  const u = covenState && covenState.upkeep;
  return !!(u && u.paidThroughAt && Date.now() < u.paidThroughAt);
}
function isLockedRoom(roomId) {
  if (!PAYWALLS_ENABLED) return false;
  if (!lockedRooms.has(roomId)) return false;
  if (hasTownPass()) return false;
  if (roomId === 'lounge' && inGoodStandingCoven()) return false; // coven perk
  return true;
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
const { ensureAudio, startMusic, stopMusic, cycleMusic, musicMenuLabel, playSfx, sfxAvailable, playNarration, stopNarration, narrationAvailable } = _audio;

// Per-class melee flavour: a landed basic attack picks a weapon-appropriate
// sound by class (Witch/Lich staff → thud, Werewolf claw → rend, Mystic/Knight/
// Wanderer blade → slash), falling back to the generic 'hit' until that
// recording exists. 'kill' (the enemy dying) is unchanged. See classShowcase.js
// for the charId roster.
const CLASS_MELEE = { 0: 'thud', 1: 'rend', 2: 'slash', 3: 'slash', 4: 'slash', 5: 'thud' };
function meleeHitSfx() {
  const id = (me && CLASS_MELEE[me.charId]) || 'hit';
  return (typeof sfxAvailable === 'function' && sfxAvailable(id)) ? id : 'hit';
}

// Hearing OTHER players act. Their spell/attack/melee broadcasts (spell_fx,
// attack_fx, veil_fx, hit_fx) used to be visual-only — you heard yourself but
// never anyone nearby. remoteActionSfx voices a same-room player's action,
// gated to within audible range of you and attenuated by distance so a busy
// town doesn't turn into a wall of noise. Your own actions are skipped here —
// they're already voiced by the local cast/hit paths, so this never doubles.
const SFX_AUDIBLE_RANGE = 950; // world units; past this a remote action is silent
function sfxPick(id, fallback) { return (typeof sfxAvailable === 'function' && sfxAvailable(id)) ? id : fallback; }
function remoteActionSfx(casterId, soundId) {
  if (!soundId || casterId === myId || !me || typeof playSfx !== 'function') return;
  const other = players[casterId];
  if (!other || typeof other.x !== 'number') return;
  const d = Math.hypot(other.x - me.x, other.y - me.y);
  if (d >= SFX_AUDIBLE_RANGE) return;
  const vol = Math.max(0.12, 1 - d / SFX_AUDIBLE_RANGE); // linear falloff, floored so near-edge still reads
  playSfx(soundId, vol);
}
// A remote player's landed melee, voiced by THEIR class (not yours).
function remoteMeleeSfx(casterId) {
  const o = players[casterId];
  const cm = o && CLASS_MELEE[o.charId];
  return sfxPick(cm || 'hit', 'hit');
}
// spellId / attackId → an existing sound (falling back when the dedicated clip
// isn't loaded), mirroring sfxForAbility's intent for the broadcast FX.
const REMOTE_SPELL_SFX = { fireball: 'cast', leech_hex: 'siphon' };
const REMOTE_ATTACK_SFX = { savage_bite: 'rend', knife_throw: 'slash', spirit_lash: 'slash', soul_siphon: 'siphon', smite: 'cast' };

let _wasBloodMoon = null; // for the once-per-rise blood-moon toll (null = first check, don't toll)

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
  playSfx,
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
  captureHowlClipCued, captureSelfiePhoto, inbox, renderInventory, requestCmState, setUnlockToast,
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
  // Preset colors are stored as NUMBERS (0xRRGGBB). Assigning a number to
  // ctx.fillStyle is invalid and silently ignored — the canvas keeps the
  // previous color, so every preset-tinted shape used to draw in the
  // backdrop brown and vanish (snapshots of unmasked players came out
  // blank). Convert each to a CSS "#rrggbb" string; leave strings as-is.
  const css = (v) => (typeof v === 'number') ? '#' + ((v >>> 0) & 0xffffff).toString(16).padStart(6, '0') : v;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2b2418'; ctx.fillRect(0, 0, 96, 96);           // backdrop
  ctx.fillStyle = css(preset.shirt); ctx.fillRect(24, 62, 48, 34); // shoulders
  ctx.fillStyle = css(preset.skin);                                 // head
  ctx.beginPath(); ctx.arc(48, 40, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(preset.hair);                                 // hair cap
  ctx.beginPath(); ctx.arc(48, 33, 21, Math.PI, 0); ctx.fill();
  ctx.fillStyle = css(preset.eye);                                  // eyes
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
  makeDraggable(document.getElementById('bookModal'),       document.querySelector('#bookModal .floatPanelHandle'));
  makeDraggable(document.getElementById('familiarModal'),   document.querySelector('#familiarModal .floatPanelHandle'));
  makeDraggable(document.getElementById('guiseModal'),      document.querySelector('#guiseModal .floatPanelHandle'));
  makeDraggable(document.getElementById('scryModal'),       document.querySelector('#scryModal .floatPanelHandle'));
  makeDraggable(document.getElementById('tarotModal'),      document.querySelector('#tarotModal .floatPanelHandle'));
  makeDraggable(document.getElementById('gardenModal'),     document.querySelector('#gardenModal .floatPanelHandle'));
  makeDraggable(document.getElementById('homeModal'),       document.querySelector('#homeModal .floatPanelHandle'));
  makeDraggable(document.getElementById('kitchenModal'),    document.querySelector('#kitchenModal .floatPanelHandle'));
  makeDraggable(document.getElementById('pathModal'),       document.querySelector('#pathModal .floatPanelHandle'));
  makeDraggable(document.getElementById('ancestorModal'),   document.querySelector('#ancestorModal .floatPanelHandle'));
  makeDraggable(document.getElementById('releaseModal'),    document.querySelector('#releaseModal .floatPanelHandle'));
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
    if (typeof playSfx === 'function') playSfx('swing'); // weapon whoosh on the swing
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
let myFamiliarCos = { skins: [], owned: [], skin: 'default' }; // familiar coat palette/owned/worn (from init)
let myAuraCos = { auras: [], owned: [], aura: 'none' }; // aura palette/owned/worn (from init)
// Numeric hex for an aura id (null = none/unknown), for client/auras.js.
function auraHexClient(id) {
  if (!id || id === 'none') return null;
  const a = (myAuraCos.auras || []).find((x) => x.id === id);
  return (a && a.hex != null) ? a.hex : null;
}
let craftRecipesClient = [];  // the Artificer's Workshop crafting tree (from init)
let myRecipesUnlocked = [];   // purchasable recipes this account has learned (from init / recipe_bought)
// 💎 Moonstones (Session I) — premium currency. Balance is server truth,
// mirrored here for display; ms_state pushes keep it fresh.
let myMoonstones = 0;
// Wardrobe unlock state (Phase 2): looks bought on the current class + chapters
// done, from init; the live level drives level-gated looks. look_bought keeps it fresh.
let myWardrobe = { purchased: [], chaptersDone: 0, dyesPurchased: [] };
let msPacksCatalog = null;    // packId -> { ms, cents, name } from init

// ── Session L state ──────────────────────────────────────────────────────────
let dungeonLoreCatalog = null;      // tier -> { name, epithet, bossKey, plaque } from init
let calendarState = null;           // { tourney, festival, bloodMoon, season, peddlerNextRotationAt }
let weeklyDelveModsClient = [];     // [{ id, name, icon, desc }]
let covenSigilsCatalog = ['🕯️', '🌙', '🦇', '🐈‍⬛', '🕸️', '🌿', '⭐', '🔮', '🗝️', '🥀'];
let covenState = null;              // server coven_state payload (.coven or null)
let covenCharterInfo = { charters: 0, charterPriceCents: 999, paymentsEnabled: false }; // Session N: founding entitlement
let covenUnread = 0;
let covenChatLines = [];            // [{ who, sigil, text }] (in-memory, last 60)
let delveState = null;              // last delve_state payload
let delveSpeedMult = 1;             // swift boons — applied only inside delve rooms
let boardState = null;
let achState = null;
let titlesState = null;             // server titles_state / init.titles (earned + active)
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

// ── Phantom echoes ──────────────────────────────────────────────────────────
// Faint spectral shades of players who recently walked the public town, so a
// quiet town never feels abandoned — and it suits a game about the departed.
// Atmospheric only: they drift, bob and fade, carry a ghostly name, and are
// NOT in `visuals`, so they can never be targeted, attacked, or reported.
const ECHO_TTL_MS = 30 * 60 * 1000;
const echoVisuals = {}; // key -> { group, nameEl, baseX, baseZ, phase, bornAt, leftAt, name }
function echoKey(e) { return e.name + '|' + Math.round(e.x) + '|' + Math.round(e.y) + '|' + e.leftAt; }
function makeEchoVisual(e) {
  const group = makeGhostMesh();
  group.traverse((o) => { if (o.material) { try { o.material = o.material.clone(); } catch (err) {} o.material.transparent = true; o.material.depthWrite = false; } });
  const nameEl = document.createElement('div');
  nameEl.className = 'nameTag echoTag';
  nameEl.textContent = 'the shade of ' + e.name;
  document.body.appendChild(nameEl);
  return { group, nameEl, baseX: e.x, baseZ: e.y, phase: Math.random() * Math.PI * 2, bornAt: performance.now(), leftAt: e.leftAt, name: e.name };
}
function destroyEchoVisual(v) {
  try { if (v.group && v.group.parent) v.group.parent.remove(v.group); } catch (err) {}
  try { if (v.nameEl) v.nameEl.remove(); } catch (err) {}
}
function reconcileEchoes(list) {
  const want = {};
  for (const e of (list || [])) { if (e && e.name) want[echoKey(e)] = e; }
  for (const k of Object.keys(echoVisuals)) if (!want[k]) { destroyEchoVisual(echoVisuals[k]); delete echoVisuals[k]; }
  for (const k of Object.keys(want)) if (!echoVisuals[k]) { try { echoVisuals[k] = makeEchoVisual(want[k]); } catch (err) {} }
}
function updateEchoes(dt) {
  const inTown = activeScene === outdoorScene && currentRoom === 'outside';
  const nowP = performance.now();
  for (const k of Object.keys(echoVisuals)) {
    const v = echoVisuals[k];
    let livePresent = false;
    for (const id in players) { if (id !== myId && players[id].name === v.name && players[id].room === currentRoom) { livePresent = true; break; } }
    const show = inTown && !livePresent;
    if (show && !v.group.parent) outdoorScene.add(v.group);
    else if (!show && v.group.parent) v.group.parent.remove(v.group);
    if (!show) { if (v.nameEl) v.nameEl.style.display = 'none'; continue; }
    v.phase += dt;
    const bob = Math.sin(v.phase * 1.3) * 6;
    v.group.position.set(v.baseX + Math.sin(v.phase * 0.5) * 20, groundY + 14 + bob, v.baseZ + Math.cos(v.phase * 0.37) * 20);
    v.group.rotation.y += dt * 0.3;
    const fadeIn = Math.min(1, (nowP - v.bornAt) / 1500);
    const lifeLeft = ECHO_TTL_MS - (Date.now() - v.leftAt);
    const fadeOut = Math.max(0, Math.min(1, lifeLeft / 120000));
    const op = 0.4 * fadeIn * fadeOut;
    v.group.traverse((o) => { if (o.material && 'opacity' in o.material) o.material.opacity = op; });
    const s = worldToScreen(v.group.position.x, v.group.position.y + 58, v.group.position.z);
    if (s.visible) { v.nameEl.style.display = ''; v.nameEl.style.left = s.x + 'px'; v.nameEl.style.top = s.y + 'px'; v.nameEl.style.opacity = String(Math.min(0.85, op * 2)); }
    else v.nameEl.style.display = 'none';
  }
}

// ── Ambient NPC life (roadmap #4 — liveness) ────────────────────────────────
// A near-empty town still has townsfolk; they just stood like statues. Now the
// interior NPCs mutter to themselves: a speech bubble pops over a random one
// every several seconds with a short in-character bark (their own voice, same
// personalities as the hint dialogue). Purely a client-side ambience layer —
// no server, no network — so one lone player walking into the Café still finds
// Mabel grumbling at her cold tea. Short, self-talk lines (not aimed at you).
const NPC_BARKS = {
  npc_bartender: ['polishes a tankard that was already clean.', '"Another quiet one. Suits me fine."', '"Mead’s on the house. …It isn’t. But it sounds nice."'],
  npc_patron:    ['"In my day, the ghosts had manners."', '"Tea’s gone cold. Again."', '"I heard that. I hear everything, dear."'],
  npc_scholar:   ['"Shh. The books are sleeping."', '"Someone reshelved the grimoires by COLOUR. Barbarians."', '"Fourteen overdue tomes. Fourteen."'],
  npc_apprentice:['"Don’t open the warm books. Don’t open the warm books."', '"Scholar Elior is going to end me."', 'squints at a shelf. "…was that there before?"'],
  npc_apothecary:['"Two drops. Not three. Three is how you get a frog."', '"This one bubbles when you lie near it. Useful."', '"Mind the green vial. Actually — mind all of them."'],
  npc_tinkerer:  ['"Don’t touch the glowing bits. …fine, touch them."', 'counts. "Eight fingers. Still eight. Good week."', '"It’s not on fire. Yet."'],
  npc_tailor:    ['"A hem is a promise, darling."', '"Black is always in. Especially here."', '"Hold sti— no, you’re a coat rack. Never mind."'],
  npc_noble:     ['"One does NOT lean on the séance table."', '"The company here is… present. Barely."', '"Is that last season’s cloak? How brave."'],
  npc_armorer:   ['"A dull blade’s just a heavy stick."', '"Dented AGAIN. Do you people walk into walls?"', '"Steel doesn’t lie. People do."'],
  npc_knight:    ['"The hall is secure."', '"Strike, then step. Strike, then step."', '"Stand straight. The dead are watching."'],
  npc_guard:     ['"Too quiet. I don’t trust it."', '"Move along. …oh. It’s just you."', '"State your business. Mentally. I’m tired."']
};

function _ambientRoundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function makeSpeechBubbleSprite(text) {
  const font = '600 26px sans-serif';
  const meas = document.createElement('canvas').getContext('2d'); meas.font = font;
  const maxW = 440, padX = 22, lineH = 32;
  const words = String(text).split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (meas.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  const textW = Math.min(maxW, Math.max.apply(null, lines.map((l) => meas.measureText(l).width)));
  const W = Math.ceil(textW) + padX * 2, bodyH = lines.length * lineH + 20, tail = 14, H = bodyH + tail;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d'); ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(248,250,255,0.96)';
  _ambientRoundRect(ctx, 1, 1, W - 2, bodyH - 2, 16); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W / 2 - 11, bodyH - 2); ctx.lineTo(W / 2, H - 1); ctx.lineTo(W / 2 + 11, bodyH - 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1726';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 14 + i * lineH + lineH / 2));
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, opacity: 0 });
  const sp = new THREE.Sprite(mat);
  const scale = 0.42; sp.scale.set(W * scale, H * scale, 1);
  sp.userData.halfH = (H * scale) / 2;
  return sp;
}
let ambientBubbles = [];
let ambientNextAt = 0;
let ambientRoom = null;
function clearAmbientBubbles() {
  for (const b of ambientBubbles) {
    if (b.sprite.parent) b.sprite.parent.remove(b.sprite);
    if (b.sprite.material.map) b.sprite.material.map.dispose();
    b.sprite.material.dispose();
  }
  ambientBubbles.length = 0;
}
function updateAmbientChatter(dt) {
  const inInterior = currentInterior && activeScene === currentInterior.scene && Array.isArray(currentInterior.kiosks);
  const now = performance.now();
  const roomNow = (me && me.room) || null;
  if (!inInterior) { if (ambientBubbles.length) clearAmbientBubbles(); ambientRoom = null; return; }
  if (ambientRoom !== roomNow) { clearAmbientBubbles(); ambientRoom = roomNow; ambientNextAt = now + 1500; } // settle before the first bark
  // Advance / fade / expire active bubbles.
  for (let i = ambientBubbles.length - 1; i >= 0; i--) {
    const b = ambientBubbles[i], age = now - b.bornAt;
    if (age >= b.ttl) {
      if (b.sprite.parent) b.sprite.parent.remove(b.sprite);
      if (b.sprite.material.map) b.sprite.material.map.dispose();
      b.sprite.material.dispose(); ambientBubbles.splice(i, 1); continue;
    }
    const op = age < 300 ? age / 300 : (age > b.ttl - 600 ? Math.max(0, (b.ttl - age) / 600) : 1);
    b.sprite.material.opacity = op * 0.96;
  }
  // Pop a new bark on a random NPC who isn't already speaking.
  if (now >= ambientNextAt && ambientBubbles.length < 2) {
    const cands = currentInterior.kiosks.filter((k) => (k.npc === 'npc' || k.npc === 'hint') && NPC_BARKS[k.npcId] && !ambientBubbles.some((b) => b.npcId === k.npcId));
    if (cands.length) {
      const k = cands[Math.floor(Math.random() * cands.length)];
      const barks = NPC_BARKS[k.npcId];
      const sp = makeSpeechBubbleSprite(barks[Math.floor(Math.random() * barks.length)]);
      sp.position.set(k.x, 104 + (sp.userData.halfH || 30), k.z); // tail just above the name plate (y≈90)
      currentInterior.scene.add(sp);
      ambientBubbles.push({ sprite: sp, npcId: k.npcId, bornAt: now, ttl: 4200 });
      ambientNextAt = now + 5000 + Math.random() * 4500;
    } else {
      ambientNextAt = now + 3000;
    }
  }
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
  if (typeof playSfx === 'function') playSfx('swing');
  ws.send(JSON.stringify({ type: 'strike', targetType: 'player', targetId: id }));
  triggerAttackAnim();
});
if (_playerCtxInviteBtn) _playerCtxInviteBtn.addEventListener('click', () => {
  if (!playerContextMenuId) return;
  inviteToParty(playerContextMenuId);
  hidePlayerContextMenu();
  setUnlockToast('Party invite sent!');
});
// Challenge to Battle — the consent handshake for PvP outside the Ember Wastes
// (the Wilds and anywhere else). The server validates and replies on the
// pvp_error channel (both the "sent" notice and any refusal), so no optimistic
// message here; the target gets a pvp_invited prompt to accept or decline.
const _playerCtxChallengeBtn = document.getElementById('playerContextChallenge');
if (_playerCtxChallengeBtn) _playerCtxChallengeBtn.addEventListener('click', () => {
  if (!playerContextMenuId) return;
  const id = playerContextMenuId;
  hidePlayerContextMenu();
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pvp_invite', targetId: id }));
});
// Invite to Coven — the pick-them-out-of-a-crowd path alongside the modal's
// invite-by-username. The server's coven_invite handler takes a targetId as
// well as a username, validates it (you're in a coven, it isn't full, they
// have an account and no coven of their own), and replies on the coven_error
// channel for both the confirmation and any refusal — so that one toast is
// the feedback; no optimistic message here that could contradict it.
const _playerCtxCovenBtn = document.getElementById('playerContextCoven');
if (_playerCtxCovenBtn) _playerCtxCovenBtn.addEventListener('click', () => {
  if (!playerContextMenuId) return;
  const id = playerContextMenuId;
  hidePlayerContextMenu();
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'coven_invite', targetId: id }));
});
// Click anywhere else to dismiss the context menu. The menu opens on
// mouseup/touchend, and the browser then fires a `click` on the canvas from
// that same gesture — which, landing outside the menu, used to close it
// instantly, so on desktop the menu never appeared to open at all. Ignore any
// click within a brief window of opening so the opening gesture can't
// self-dismiss; a later click outside still closes it as before.
document.addEventListener('click', (e) => {
  if (Date.now() - _playerCtxMenuOpenedAt < 500) return;
  if (_playerCtxMenu && !_playerCtxMenu.contains(e.target)) hidePlayerContextMenu();
});

// Incoming battle challenge — a click-to-answer prompt (same shape as the coven
// invite toast). Accept establishes a mutual duel; decline tells the challenger.
function openBattleInviteToast(msg) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;top:120px;left:50%;transform:translateX(-50%);z-index:45;background:#2a160b;border:1px solid #ff9a3c;border-radius:14px;padding:12px 16px;color:#ffe1c2;font-size:13.5px;text-align:center;max-width:320px;box-shadow:0 6px 24px rgba(0,0,0,0.6);';
  const label = document.createElement('div');
  label.textContent = `🤺 ${msg.fromName} challenges you to battle!`;
  wrap.appendChild(label);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:8px;';
  const yes = document.createElement('button');
  yes.className = 'btn'; yes.style.margin = '0'; yes.textContent = 'Accept';
  yes.addEventListener('click', () => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pvp_invite_respond', accept: true })); wrap.remove(); });
  const no = document.createElement('button');
  no.className = 'btn'; no.style.margin = '0'; no.textContent = 'Decline';
  no.addEventListener('click', () => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pvp_invite_respond', accept: false })); wrap.remove(); });
  row.appendChild(yes); row.appendChild(no);
  wrap.appendChild(row);
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 44000);
}

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
  // --- Wilds-flora crafts (from the new trees' & bushes' materials) ---
  { id: 'barkbind_salve',     icon: '🩹',  name: 'Barkbind Salve',     desc: 'Birch Bark + Pine Pitch',     ingredients: [{ id: 'birch_bark', qty: 2 }, { id: 'pine_pitch', qty: 1 }] },
  { id: 'capwood_elixir',     icon: '🍄‍🟫', name: 'Capwood Elixir',     desc: 'Toadcap + Ring Cap',          ingredients: [{ id: 'toadcap', qty: 2 }, { id: 'ring_cap', qty: 1 }] },
  { id: 'nightsight_draught', icon: '🌘',  name: 'Nightsight Draught', desc: 'Nightberry + Willow Frond',   ingredients: [{ id: 'nightberry', qty: 2 }, { id: 'willow_frond', qty: 1 }] },
  { id: 'fernstep_philtre',   icon: '🌀',  name: 'Fernstep Philtre',   desc: 'Fern Frond + Blackthorn',     ingredients: [{ id: 'fern_frond', qty: 2 }, { id: 'blackthorn', qty: 1 }] },
  { id: 'bramble_poultice',   icon: '💚',  name: 'Bramble Poultice',   desc: 'Bramble Vine + Hex Acorn',    ingredients: [{ id: 'bramble_vine', qty: 2 }, { id: 'hex_acorn', qty: 1 }] },
  { id: 'witchwood_balm',     icon: '✨',  name: 'Witchwood Balm',     desc: 'Witchwood + Hex Acorn',       ingredients: [{ id: 'witchwood', qty: 2 }, { id: 'hex_acorn', qty: 1 }] },
  // --- Moon water (Tier 3.5): the full-moon ritual + what it unlocks ---
  { id: 'moon_water',         icon: '💧',  name: 'Moon Water',         desc: 'Glass Vial (full moon only)', ingredients: [{ id: 'glass_vial', qty: 1 }], requiresMoon: 'full' },
  { id: 'moonwell_draught',   icon: '💙',  name: 'Moonwell Draught',   desc: 'Moon Water + 2× Healing Herb',ingredients: [{ id: 'moon_water', qty: 1 }, { id: 'healing_herb', qty: 2 }] },
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
      row.innerHTML = `<span class="rowGi" style="font-size:22px;">${glyphHTML(item.id, 'rowGi', item.icon)}</span>
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
      // 🌕 Moon-gated recipes (moon water) only brew under a full moon. Reflect
      // the live phase (calendarState.moon.chargesMoonWater) so the button is
      // disabled off-phase rather than failing on click.
      const needsFull = recipe.requiresMoon === 'full';
      const moonReady = !needsFull || !!(calendarState && calendarState.moon && calendarState.moon.chargesMoonWater);
      const moonNote = needsFull
        ? `<span style="color:${moonReady ? '#9fe6b0' : '#e6b36a'};font-size:11px;flex-basis:100%;padding-left:36px;">${moonReady ? '🌕 The moon is full — draw it now.' : '🌑 Only under a full moon.'}</span>`
        : '';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(100,0,200,0.12);border-radius:8px;border:1px solid rgba(150,50,255,0.2);flex-wrap:wrap;';
      row.innerHTML = `<span class="rowGi" style="font-size:22px;">${glyphHTML(recipe.id, 'rowGi', recipe.icon)}</span>
        <span style="flex:1;min-width:120px;color:#e8d0ff;font-weight:600;">${recipe.name}</span>
        <span style="color:#cc88ff;font-size:11px;flex-basis:100%;padding-left:36px;">${ingText}</span>
        ${moonNote}
        <button data-rid="${recipe.id}"${moonReady ? '' : ' disabled'} style="margin-left:auto;padding:5px 14px;background:${moonReady ? '#3a1866' : '#2a1a2a'};color:${moonReady ? '#ddb0ff' : '#7a6a88'};border:1px solid ${moonReady ? '#6622aa' : '#3a2a4a'};border-radius:6px;cursor:${moonReady ? 'pointer' : 'not-allowed'};font-size:12px;">Brew</button>`;
      if (moonReady) row.querySelector('button').addEventListener('click', () => {
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

let pendingQuestSkip = null; // {npcId, questId, cost} when the offer is a cooldown-skip
function showQuestOffer(msg) {
  document.getElementById('questDialogueNpc').textContent = `💬 ${msg.npcName}`;
  document.getElementById('questDialogueName').textContent = msg.questName || '';
  // On cooldown: show the quest-giver's "come back later / pay to hurry" line
  // above the quest blurb, and flip the accept button into a 💎 skip button.
  const desc = msg.cooldown && msg.message ? `${msg.message}\n\n${msg.description || ''}` : (msg.description || '');
  document.getElementById('questDialogueDesc').textContent = desc;
  document.getElementById('questDialogueXP').textContent = msg.xpReward || 0;
  const accept = document.getElementById('questAcceptBtn');
  if (msg.cooldown) {
    pendingQuestSkip = { npcId: pendingQuestNpcId, questId: msg.questId, cost: msg.skipCost || 8 };
    if (accept) accept.textContent = `💎 Set out now · ${msg.skipCost || 8}`;
  } else {
    pendingQuestSkip = null;
    if (accept) accept.textContent = 'Accept Quest';
  }
  document.getElementById('questDialogue').classList.remove('hidden');
  // Voice the quest-giver's pitch, if this quest has a narration clip.
  if (typeof playNarration === 'function' && msg.questId) playNarration(msg.questId);
}

function closeQuestDialogue() {
  document.getElementById('questDialogue').classList.add('hidden');
  pendingQuestNpcId = null;
  pendingQuestSkip = null;
  if (typeof stopNarration === 'function') stopNarration(); // cut the voice when the card closes
}

const questAcceptBtn = document.getElementById('questAcceptBtn');
if (questAcceptBtn) questAcceptBtn.addEventListener('click', () => {
  if (!pendingQuestNpcId) return;
  // Cooldown-skip mode: buy down the wait; the server replies with a fresh
  // (now-acceptable) quest_offer that reopens this card in normal Accept mode.
  if (pendingQuestSkip) {
    ws.send(JSON.stringify({ type: 'quest_cooldown_skip', npcId: pendingQuestSkip.npcId, questId: pendingQuestSkip.questId }));
    pendingQuestSkip = null;
    return;
  }
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

// ── The Forbidden Shelf (roadmap #6): the Library's daily book + the codex ──
function showForbiddenBook(msg) {
  document.getElementById('forbiddenBookTitle').textContent = msg.title || 'A Forbidden Book';
  document.getElementById('forbiddenBookAuthor').textContent = msg.author ? `— ${msg.author}` : '';
  document.getElementById('forbiddenBookText').textContent = msg.text || '';
  const note = document.getElementById('forbiddenBookNote');
  if (msg.completed && msg.grantedTitleName) {
    note.textContent = `📖 Every forbidden volume read. The Archive names you “${msg.grantedTitleName}.”`;
    note.className = 'done';
  } else if (msg.firstRead) {
    note.textContent = `Logged to your Forbidden Archive — ${msg.readCount} of ${msg.total} read.`;
    note.className = 'done';
  } else {
    note.textContent = `You've read this one before — ${msg.readCount} of ${msg.total} in the Archive.`;
    note.className = '';
  }
  document.getElementById('forbiddenBookView').classList.remove('hidden');
  document.getElementById('forbiddenCodexView').classList.add('hidden');
  document.getElementById('forbiddenModal').classList.remove('hidden');
  if (msg.firstRead) setUnlockToast(msg.completed ? '📖 Forbidden Archive complete!' : `📖 New book logged — ${msg.readCount}/${msg.total}`);
}
function renderForbiddenCodex(msg) {
  const prog = document.getElementById('forbiddenCodexProgress');
  const done = msg.readCount === msg.total;
  prog.textContent = `${msg.readCount} of ${msg.total} volumes read` + (done ? ' — the shelf is yours.' : ' — a new one surfaces each day.');
  const grid = document.getElementById('forbiddenCodexGrid');
  grid.innerHTML = '';
  (msg.entries || []).forEach((e) => {
    const d = document.createElement('div');
    d.className = 'forbEntry' + (e.read ? ' read' : ' locked') + (e.today ? ' today' : '');
    const t = document.createElement('div'); t.className = 'ft';
    t.textContent = e.read ? e.title : '??? — unread';
    d.appendChild(t);
    if (e.read && e.author) { const a = document.createElement('div'); a.className = 'fa'; a.textContent = `— ${e.author}`; d.appendChild(a); }
    if (e.today) { const b = document.createElement('div'); b.className = 'fbadge'; b.textContent = e.read ? '• on the shelf today' : '• on the shelf today — go read it'; d.appendChild(b); }
    grid.appendChild(d);
  });
  document.getElementById('forbiddenBookView').classList.add('hidden');
  document.getElementById('forbiddenCodexView').classList.remove('hidden');
  document.getElementById('forbiddenModal').classList.remove('hidden');
}
function closeForbiddenModal() { document.getElementById('forbiddenModal').classList.add('hidden'); }
function showForbiddenBookView() {
  document.getElementById('forbiddenCodexView').classList.add('hidden');
  document.getElementById('forbiddenBookView').classList.remove('hidden');
}
(function wireForbiddenModal() {
  const codexBtn = document.getElementById('forbiddenCodexBtn');
  if (codexBtn) codexBtn.addEventListener('click', () => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'forbidden_codex' })); });
  const backBtn = document.getElementById('forbiddenCodexBackBtn');
  if (backBtn) backBtn.addEventListener('click', showForbiddenBookView);
  ['forbiddenCloseBtn', 'forbiddenCodexCloseBtn'].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', closeForbiddenModal);
  });
})();

// ── The Café Daily Special (roadmap #6): today's special + the Tasting Menu ──
function showCafeSpecial(msg) {
  document.getElementById('cafeSpecialName').textContent = msg.name || 'Today’s Special';
  document.getElementById('cafeSpecialDesc').textContent = msg.desc || '';
  document.getElementById('cafeSpecialTaste').textContent = msg.taste || '';
  const note = document.getElementById('cafeSpecialNote');
  if (msg.completed && msg.grantedTitleName) {
    note.textContent = `☕ Every special tasted. Joss says you've earned “${msg.grantedTitleName}.”`;
    note.className = 'done';
  } else if (msg.firstTaste) {
    note.textContent = `Added to your Tasting Menu — ${msg.tastedCount} of ${msg.total} tasted.`;
    note.className = 'done';
  } else {
    note.textContent = `You've had this one before — ${msg.tastedCount} of ${msg.total} on the menu.`;
    note.className = '';
  }
  document.getElementById('cafeSpecialView').classList.remove('hidden');
  document.getElementById('cafeMenuView').classList.add('hidden');
  document.getElementById('cafeSpecialModal').classList.remove('hidden');
  if (msg.firstTaste) setUnlockToast(msg.completed ? '☕ Tasting Menu complete!' : `☕ New special tasted — ${msg.tastedCount}/${msg.total}`);
}
function renderCafeMenu(msg) {
  const prog = document.getElementById('cafeMenuProgress');
  const done = msg.tastedCount === msg.total;
  prog.textContent = `${msg.tastedCount} of ${msg.total} specials tasted` + (done ? ' — the whole menu’s yours.' : ' — a new one is chalked up each day.');
  const grid = document.getElementById('cafeMenuGrid');
  grid.innerHTML = '';
  (msg.entries || []).forEach((e) => {
    const d = document.createElement('div');
    d.className = 'forbEntry' + (e.tasted ? ' read' : ' locked') + (e.today ? ' today' : '');
    const t = document.createElement('div'); t.className = 'ft';
    t.textContent = e.tasted ? e.name : '??? — not yet tasted';
    d.appendChild(t);
    if (e.tasted && e.desc) { const a = document.createElement('div'); a.className = 'fa'; a.textContent = e.desc; d.appendChild(a); }
    if (e.today) { const b = document.createElement('div'); b.className = 'fbadge'; b.textContent = e.tasted ? '• on the board today' : '• on the board today — go order it'; d.appendChild(b); }
    grid.appendChild(d);
  });
  document.getElementById('cafeSpecialView').classList.add('hidden');
  document.getElementById('cafeMenuView').classList.remove('hidden');
  document.getElementById('cafeSpecialModal').classList.remove('hidden');
}
function closeCafeSpecialModal() { document.getElementById('cafeSpecialModal').classList.add('hidden'); }
function showCafeSpecialView() {
  document.getElementById('cafeMenuView').classList.add('hidden');
  document.getElementById('cafeSpecialView').classList.remove('hidden');
}
(function wireCafeSpecialModal() {
  const menuBtn = document.getElementById('cafeMenuBtn');
  if (menuBtn) menuBtn.addEventListener('click', () => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'cafe_menu' })); });
  const backBtn = document.getElementById('cafeMenuBackBtn');
  if (backBtn) backBtn.addEventListener('click', showCafeSpecialView);
  ['cafeSpecialCloseBtn', 'cafeMenuCloseBtn'].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', closeCafeSpecialModal);
  });
})();

// ── The Starlight Arcade — Hall of Scores (roadmap #6): today's daily board ──
function renderArcadeBoard(msg) {
  const myName = (me && me.name) || null;
  const fill = (listId, rows) => {
    const ol = document.getElementById(listId);
    if (!ol) return;
    ol.innerHTML = '';
    if (!rows || !rows.length) {
      const li = document.createElement('li'); li.className = 'arcEmpty'; li.textContent = 'No scores yet today — be the first.';
      ol.appendChild(li); return;
    }
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      if (myName && r.name === myName) li.className = 'me';
      const n = document.createElement('span'); n.className = 'an'; n.textContent = `${i + 1}. ${r.name}`;
      const v = document.createElement('span'); v.className = 'av'; v.textContent = r.score;
      li.appendChild(n); li.appendChild(v); ol.appendChild(li);
    });
  };
  fill('arcadeSnakeList', msg.snakeTop);
  fill('arcadeBreakoutList', msg.breakoutTop);
  document.getElementById('arcadeSnakeYours').textContent = `Your best today: ${msg.yourSnake || 0}`;
  document.getElementById('arcadeBreakoutYours').textContent = `Your best today: ${msg.yourBreakout || 0}`;
  document.getElementById('arcadeScoresModal').classList.remove('hidden');
}
(function wireArcadeScores() {
  const b = document.getElementById('arcadeScoresCloseBtn');
  if (b) b.addEventListener('click', () => document.getElementById('arcadeScoresModal').classList.add('hidden'));
})();

// ── The Phantom Parlor — Midnight Vigil (roadmap #6): night-gated spirit event ──
function showVigilResult(msg) {
  const nameEl = document.getElementById('vigilSpiritName');
  const epEl = document.getElementById('vigilSpiritEpitaph');
  const textEl = document.getElementById('vigilSpiritText');
  const note = document.getElementById('vigilSpiritNote');
  if (!msg.night) {
    // By day the table is quiet — a gentle "come back after dark".
    nameEl.textContent = 'The table is still';
    epEl.textContent = '';
    textEl.textContent = 'The candle will not catch and the portraits only watch. The spirits keep their own hours — they stir after dark. Come back at night and sit the vigil then.';
    note.textContent = '';
  } else {
    nameEl.textContent = msg.name || 'A Restless Spirit';
    epEl.textContent = msg.epitaph ? `— ${msg.epitaph}` : '';
    textEl.textContent = msg.message || '';
    if (msg.completed && msg.grantedTitleName) note.textContent = `🌙 Every departed guest has spoken to you. You are “${msg.grantedTitleName}.”`;
    else if (msg.firstHeard) note.textContent = `Recorded in your Vigil Register — ${msg.heardCount} of ${msg.total} heard.`;
    else note.textContent = `You have sat with this one before — ${msg.heardCount} of ${msg.total} in the Register.`;
    if (msg.firstHeard) setUnlockToast(msg.completed ? '🌙 The Vigil Register is complete!' : `🌙 A new spirit heard — ${msg.heardCount}/${msg.total}`);
  }
  document.getElementById('vigilSpiritView').classList.remove('hidden');
  document.getElementById('vigilRegisterView').classList.add('hidden');
  document.getElementById('vigilModal').classList.remove('hidden');
}
function renderVigilRegister(msg) {
  const prog = document.getElementById('vigilRegisterProgress');
  const done = msg.heardCount === msg.total;
  prog.textContent = `${msg.heardCount} of ${msg.total} departed heard` + (done ? ' — the whole house has spoken.' : (msg.night ? ' — one is restless tonight.' : ' — return after dark to hear more.'));
  const grid = document.getElementById('vigilRegisterGrid');
  grid.innerHTML = '';
  (msg.entries || []).forEach((e) => {
    const d = document.createElement('div');
    d.className = 'forbEntry' + (e.heard ? ' read' : ' locked') + (e.tonight ? ' today' : '');
    const t = document.createElement('div'); t.className = 'ft';
    t.textContent = e.heard ? e.name : '??? — unheard';
    d.appendChild(t);
    if (e.heard && e.epitaph) { const a = document.createElement('div'); a.className = 'fa'; a.textContent = e.epitaph; d.appendChild(a); }
    if (e.tonight && msg.night) { const b = document.createElement('div'); b.className = 'fbadge'; b.textContent = e.heard ? '• restless tonight' : '• restless tonight — sit with them'; d.appendChild(b); }
    grid.appendChild(d);
  });
  document.getElementById('vigilSpiritView').classList.add('hidden');
  document.getElementById('vigilRegisterView').classList.remove('hidden');
  document.getElementById('vigilModal').classList.remove('hidden');
}
function closeVigilModal() { document.getElementById('vigilModal').classList.add('hidden'); }
function showVigilSpiritView() {
  document.getElementById('vigilRegisterView').classList.add('hidden');
  document.getElementById('vigilSpiritView').classList.remove('hidden');
}
(function wireVigilModal() {
  const regBtn = document.getElementById('vigilRegisterBtn');
  if (regBtn) regBtn.addEventListener('click', () => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'vigil_register' })); });
  const backBtn = document.getElementById('vigilRegisterBackBtn');
  if (backBtn) backBtn.addEventListener('click', showVigilSpiritView);
  ['vigilCloseBtn', 'vigilRegisterCloseBtn'].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', closeVigilModal);
  });
})();

// ── The Reliquary (roadmap #8): relic lore cards + the collection ──
function showRelicCard(msg) {
  document.getElementById('relicName').textContent = msg.name || 'A Relic';
  document.getElementById('relicRoom').textContent = msg.room ? `under glass in ${msg.room}` : '';
  document.getElementById('relicText').textContent = msg.text || '';
  const note = document.getElementById('relicNote');
  if (msg.completed && msg.grantedTitleName) {
    note.textContent = `🗝️ Every relic inspected. You are “${msg.grantedTitleName}.”`;
    note.className = 'done';
  } else if (msg.firstSeen) {
    note.textContent = `Added to your Reliquary — ${msg.seenCount} of ${msg.total} collected.`;
    note.className = 'done';
  } else {
    note.textContent = `Already in your Reliquary — ${msg.seenCount} of ${msg.total} collected.`;
    note.className = '';
  }
  document.getElementById('relicCardView').classList.remove('hidden');
  document.getElementById('reliquaryView').classList.add('hidden');
  document.getElementById('relicModal').classList.remove('hidden');
  if (msg.firstSeen) setUnlockToast(msg.completed ? '🗝️ The Reliquary is complete!' : `🗝️ Relic collected — ${msg.seenCount}/${msg.total}`);
}
// ── Guest → account conversion nudge ─────────────────────────────────────────
// Shown once per session when a guest reaches level 2 (server sends guest_nudge).
// "Create a free account" flags the reload so the join screen opens straight
// into the register form; "Keep playing" just dismisses.
let _guestNudgeShown = false;
function showGuestNudge() {
  if (_guestNudgeShown) return;
  _guestNudgeShown = true;
  const n = document.getElementById('guestNudge');
  if (n) n.classList.remove('hidden');
}

// ── Guest → account carry-over ───────────────────────────────────────────────
// A guest registers an account WITHOUT leaving the game. Doing it over the live
// connection is what makes the carry-over possible: the guest's character lives
// only in server memory on this socket, so we register, then ask the server to
// adopt that character into the fresh account (claim_guest) BEFORE any reload.
function openGuestRegister() {
  const m = document.getElementById('guestRegister'); if (!m) return;
  const n = document.getElementById('guestNudge'); if (n) n.classList.add('hidden');
  const st = document.getElementById('grStatus'); if (st) st.textContent = '';
  m.classList.remove('hidden');
  const u = document.getElementById('grUser'); if (u) setTimeout(() => u.focus(), 30);
}
let _grBusy = false;
function submitGuestRegister() {
  if (_grBusy) return;
  const st = document.getElementById('grStatus');
  const setStatus = (t, bad) => { if (st) { st.textContent = t || ''; st.style.color = bad ? '#f0a0a0' : '#9ee37d'; } };
  const username = (document.getElementById('grUser') || {}).value;
  const password = (document.getElementById('grPass') || {}).value;
  const email = ((document.getElementById('grEmail') || {}).value || '').trim();
  const over18 = !!(document.getElementById('grOver18') || {}).checked;
  if (!username || !username.trim() || !password) { setStatus('Enter a username and password.', true); return; }
  if (!over18) { setStatus('You must confirm you are 18 or older.', true); return; }
  _grBusy = true;
  setStatus('Creating account…');
  fetch(apiUrl('/api/register'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password, over18, email })
  })
    .then(r => r.json().then(data => ({ ok: r.ok, data })))
    .then(({ ok, data }) => {
      if (!ok || !data || !data.token) { _grBusy = false; setStatus((data && data.error) || 'Could not create the account.', true); return; }
      // Persist the account so the reload after the claim comes back logged in,
      // on the same character (tc_charid is untouched), with their roster.
      try { localStorage.setItem('tc_account', JSON.stringify({ token: data.token, username: data.username, color: data.color })); } catch (e) {}
      // Ask the server to move this guest's live character into the new account.
      setStatus('Saving your progress…');
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'claim_guest', token: data.token }));
      } else {
        // No live socket (shouldn't happen mid-game): the account exists, so at
        // least get them logged in — they keep the account, fresh character.
        location.reload();
      }
    })
    .catch(() => { _grBusy = false; setStatus('Could not reach the server.', true); });
}
function onClaimResult(msg) {
  const st = document.getElementById('grStatus');
  if (!msg || !msg.ok) {
    _grBusy = false;
    if (st) { st.style.color = '#f0a0a0'; st.textContent = 'Something went wrong saving your progress. Your account was created — try logging in.'; }
    return;
  }
  if (st) { st.style.color = '#9ee37d'; st.textContent = '✓ Saved! Welcome to Thornreach — bringing you back in…'; }
  // The progress is now persisted under the account server-side, so a reload is
  // completely safe even if it's interrupted. Reload re-enters logged in, and
  // the roster offers "continue as" the character we just carried over.
  setTimeout(() => { try { location.reload(); } catch (e) {} }, 850);
}

// ── Invite a Friend (referral loop) ──────────────────────────────────────────
function openInviteModal() {
  const m = document.getElementById('inviteModal'); if (!m) return;
  const body = document.getElementById('inviteBody'); if (body) body.textContent = 'Loading…';
  m.classList.remove('hidden');
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'invite_request' }));
}
function renderInvite(msg) {
  const body = document.getElementById('inviteBody'); if (!body) return;
  if (msg.guest) {
    body.innerHTML = 'Make a free account to get your own invite link — then every friend you bring earns you both gold.';
    return;
  }
  const url = 'https://thornreach.com/?invite=' + encodeURIComponent(msg.code);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  body.innerHTML =
    '<p style="margin:0 0 10px">Share your link. A friend who joins through it gets a welcome bonus, and when they reach <b>level 5</b> you <b>both</b> earn gold (+' + msg.referrer + ' for you).</p>' +
    '<div style="display:flex;gap:8px;align-items:center;background:rgba(0,0,0,0.25);border:1px solid rgba(230,190,120,0.25);border-radius:9px;padding:8px 10px;margin-bottom:10px">' +
      '<input id="inviteLink" readonly value="' + esc(url) + '" style="flex:1;min-width:0;background:transparent;border:none;color:#ffe9c2;font-size:12.5px;">' +
      '<button id="inviteCopyBtn" class="btn" style="margin:0;padding:6px 12px;font-size:12px;width:auto;white-space:nowrap;">Copy</button>' +
    '</div>' +
    '<div style="font-size:12.5px;color:#b6a888">Friends brought: <b style="color:#ffe08a">' + (msg.brought || 0) + '</b> · rewarded: <b style="color:#ffe08a">' + (msg.rewarded || 0) + '</b></div>';
  const copyBtn = document.getElementById('inviteCopyBtn'), inp = document.getElementById('inviteLink');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const done = () => { copyBtn.textContent = 'Copied!'; };
    const fallback = () => { try { if (inp) { inp.focus(); inp.select(); document.execCommand('copy'); } } catch (e) {} done(); };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(fallback); else fallback(); }
    catch (e) { fallback(); }
  });
}
function renderReliquary(msg) {
  const prog = document.getElementById('reliquaryProgress');
  const done = msg.seenCount === msg.total;
  prog.textContent = `${msg.seenCount} of ${msg.total} relics collected` + (done ? ' — the whole reliquary is yours.' : ' — the rest wait under glass around town.');
  const grid = document.getElementById('reliquaryGrid');
  grid.innerHTML = '';
  (msg.entries || []).forEach((e) => {
    const d = document.createElement('div');
    d.className = 'forbEntry' + (e.seen ? ' read' : ' locked');
    const t = document.createElement('div'); t.className = 'ft';
    t.textContent = e.seen ? e.name : '??? — uninspected';
    d.appendChild(t);
    // The room is shown even when locked, as a breadcrumb to where it waits.
    if (e.room) { const a = document.createElement('div'); a.className = 'fa'; a.textContent = e.seen ? `under glass in ${e.room}` : `somewhere in ${e.room}`; d.appendChild(a); }
    grid.appendChild(d);
  });
  document.getElementById('relicCardView').classList.add('hidden');
  document.getElementById('reliquaryView').classList.remove('hidden');
  document.getElementById('relicModal').classList.remove('hidden');
}
function closeRelicModal() { document.getElementById('relicModal').classList.add('hidden'); }
function showRelicCardView() {
  document.getElementById('reliquaryView').classList.add('hidden');
  document.getElementById('relicCardView').classList.remove('hidden');
}
(function wireRelicModal() {
  const relBtn = document.getElementById('reliquaryBtn');
  if (relBtn) relBtn.addEventListener('click', () => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'reliquary' })); });
  const backBtn = document.getElementById('reliquaryBackBtn');
  if (backBtn) backBtn.addEventListener('click', showRelicCardView);
  ['relicCloseBtn', 'reliquaryCloseBtn'].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', closeRelicModal);
  });
})();

// ── The Codex (unified): one screen for every collection + titles earned ──
function openCodexModal() {
  // The menu sheet is already closed by the menu wiring (closeSheet) before this runs.
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'codex_state' }));
}
function closeCodexModal() { document.getElementById('codexModal').classList.add('hidden'); }
function renderCodex(msg) {
  const cols = msg.collections || [];
  const doneCount = cols.filter((c) => c.complete).length;
  document.getElementById('codexSummary').textContent =
    `${doneCount} of ${cols.length} collections complete · ${(msg.titles || []).length} title${(msg.titles || []).length === 1 ? '' : 's'} earned`;

  const wrap = document.getElementById('codexCollections');
  wrap.innerHTML = '';
  const addRow = (icon, label, sub, count, total, complete, openMsg) => {
    const row = document.createElement('div');
    row.className = 'codexRow' + (complete ? ' done' : '');
    const pct = total ? Math.round((count / total) * 100) : 0;
    const ic = document.createElement('div'); ic.className = 'cxIcon'; ic.textContent = icon;
    const body = document.createElement('div'); body.className = 'cxBody';
    body.innerHTML = `<div class="cxLabel">${label}${complete ? '<span class="cxCheck">✓</span>' : ''}</div><div class="cxSub">${sub}</div><div class="codexBar"><span style="width:${pct}%"></span></div>`;
    const cnt = document.createElement('div'); cnt.className = 'cxCount'; cnt.textContent = `${count}/${total}`;
    const view = document.createElement('button'); view.className = 'btn'; view.textContent = 'View';
    view.addEventListener('click', () => { closeCodexModal(); if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: openMsg })); });
    row.appendChild(ic); row.appendChild(body); row.appendChild(cnt); row.appendChild(view);
    wrap.appendChild(row);
  };
  cols.forEach((c) => addRow(c.icon, c.label, `in ${c.where}`, c.count, c.total, c.complete, c.open));
  // The Arcade is a daily board rather than a set, so it shows your bests.
  const arc = msg.arcade || {};
  const arcRow = document.createElement('div');
  arcRow.className = 'codexRow' + (arc.champion ? ' done' : '');
  const arcSub = `Snake best ${arc.snake || 0} · Breakout best ${arc.breakout || 0} (today)`;
  arcRow.innerHTML = `<div class="cxIcon">🕹️</div><div class="cxBody"><div class="cxLabel">Starlight Arcade${arc.champion ? '<span class="cxCheck">✓ champion</span>' : ''}</div><div class="cxSub">${arcSub}</div></div>`;
  const arcView = document.createElement('button'); arcView.className = 'btn'; arcView.textContent = 'View';
  arcView.addEventListener('click', () => { closeCodexModal(); if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'arcade_board' })); });
  arcRow.appendChild(arcView);
  wrap.appendChild(arcRow);

  const tWrap = document.getElementById('codexTitles');
  tWrap.innerHTML = '';
  if (!(msg.titles || []).length) {
    const e = document.createElement('div'); e.className = 'codexEmpty'; e.textContent = 'No titles yet — complete a collection or a rite to earn one.';
    tWrap.appendChild(e);
  } else {
    msg.titles.forEach((t) => {
      const d = document.createElement('div'); d.className = 'codexTitle';
      const g = document.createElement('div'); g.className = 'ctGlyph'; g.textContent = t.glyph || '🎖️';
      const body = document.createElement('div');
      const active = msg.activeTitle === t.id;
      body.innerHTML = `<div class="ctName${active ? ' active' : ''}">${t.name}</div><div class="ctFrom">${t.from || ''}</div>`;
      d.appendChild(g); d.appendChild(body); tWrap.appendChild(d);
    });
  }
  document.getElementById('codexModal').classList.remove('hidden');
}
(function wireCodexModal() {
  const b = document.getElementById('codexCloseBtn');
  if (b) b.addEventListener('click', closeCodexModal);
})();

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

// Like captureHowlClip, but it opens the mic FIRST, runs a visible lead-in
// countdown, and reports each phase so the UI can tell the player exactly
// when to speak — fixing clips that got cut off because recording began the
// instant the mic turned on, before the player was ready. onPhase(phase, n):
//   'arming'          — requesting the mic
//   'leadin',   n     — n = 3,2,1 before recording starts (mic already warm)
//   'recording',n     — n = seconds left while actually capturing
//   'processing'      — encoding the clip
// Resolves { dataURL, mimeType } so the caller can play it back before saving.
function captureHowlClipCued({ durationMs = 3000, leadInMs = 1800, onPhase = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      reject(new Error('Microphone not available')); return;
    }
    try { onPhase('arming'); } catch (e) {}
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const stop = () => stream.getTracks().forEach(t => t.stop());
      const leadSteps = Math.max(1, Math.round(leadInMs / 600));
      let n = leadSteps;
      try { onPhase('leadin', n); } catch (e) {}
      const leadTimer = setInterval(() => {
        n--;
        if (n > 0) { try { onPhase('leadin', n); } catch (e) {} return; }
        clearInterval(leadTimer);
        startRecording();
      }, 600);

      function startRecording() {
        let mimeType = '';
        for (const candidate of ['audio/webm', 'audio/mp4', 'audio/ogg']) {
          if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidate)) { mimeType = candidate; break; }
        }
        let recorder;
        try { recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream); }
        catch (e) { stop(); reject(e); return; }
        const chunks = [];
        let tick = null;
        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.onerror = (e) => { stop(); if (tick) clearInterval(tick); reject(e.error || new Error('Recorder error')); };
        recorder.onstop = () => {
          stop(); if (tick) clearInterval(tick);
          try { onPhase('processing'); } catch (e) {}
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => resolve({ dataURL: reader.result, mimeType: blob.type });
          reader.onerror = () => reject(new Error('Could not encode audio'));
          reader.readAsDataURL(blob);
        };
        recorder.start();
        let secsLeft = Math.round(durationMs / 1000);
        try { onPhase('recording', secsLeft); } catch (e) {}
        tick = setInterval(() => { secsLeft--; if (secsLeft > 0) { try { onPhase('recording', secsLeft); } catch (e) {} } }, 1000);
        setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, durationMs);
      }
    }).catch(reject);
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

let lastToastText = '', lastToastAt = 0; // shared with systemChatNotif's de-dupe
// Toasts stack like a message thread instead of overwriting one slot: each call
// appends a pill below the last (newest at the bottom), the lane is capped, and
// every pill fades on its own timer. This stops the old pile-up where a burst of
// notices (load-in: admin access, respawn, a bell toll…) all landed on the same
// top-centre spot and smeared together.
const UNLOCK_TOAST_LIFE_MS = 4200;
const UNLOCK_TOAST_MAX = 4;
function setUnlockToast(text) {
  const wrap = document.getElementById('unlockToast');
  if (!wrap) return;
  wrap.classList.remove('hidden');
  const el = document.createElement('div');
  el.className = 'unlockToastItem';
  el.textContent = text;
  wrap.appendChild(el);
  // keep the lane short — drop the oldest (top) once it's too tall
  while (wrap.children.length > UNLOCK_TOAST_MAX) wrap.firstChild.remove();
  // The mobile message banners duck out of the toast's lane while any pill is up
  // (body.toastVisible → #chatNotifStack shifts down), and remember the latest
  // line so systemChatNotif() doesn't repeat it as a banner.
  lastToastText = text; lastToastAt = Date.now();
  document.body.classList.add('toastVisible');
  setTimeout(() => {
    el.classList.add('fading');
    setTimeout(() => {
      el.remove();
      if (!wrap.children.length) {
        wrap.classList.add('hidden');
        document.body.classList.remove('toastVisible');
      }
    }, 550);
  }, UNLOCK_TOAST_LIFE_MS);
}

// Persistent banner shown while inside a coven's private Moot instance (Session
// N). Created lazily so no HTML change is needed; pass null to hide it.
// The persistent "🌑 Hagstone — <coven>" pill was retired to keep the screen
// clear (it sat top-centre on phones, right in the view). A one-time welcome
// card (openHagstoneWelcome) explains the private world on first entry
// instead, and the perpetual violet night is the ongoing cue. Kept as a
// hide-only shim so any older element can't linger.
function setMootBanner(_msg) {
  const el = document.getElementById('mootBanner');
  if (el) el.style.display = 'none';
}
// The one-time "Welcome to your private world" card that replaces the pill.
// Shown the first time a player steps through the Hagstone into a coven
// instance (localStorage-gated); after that the toast + the violet night
// carry it, so the screen stays clear.
function openHagstoneWelcome(msg) {
  let seen = null;
  try { seen = localStorage.getItem('tc_hagstone_welcome_seen'); } catch (e) {}
  if (seen) return;
  const modal = document.getElementById('hagstoneWelcomeModal');
  const body = document.getElementById('hagstoneWelcomeBody');
  if (!modal || !body) return;
  const who = `${(msg && msg.covenSigil) || ''} ${(msg && msg.covenName) || 'your coven'}`.replace(/\s+/g, ' ').trim();
  body.innerHTML =
    `<p style="margin:0 0 11px">You've slipped through the <b>Hagstone</b> into <b>${who}</b>'s own hidden copy of the world — a place held apart from the public town.</p>` +
    `<ul style="margin:0; padding-left:18px">` +
    `<li style="margin:6px 0"><b>Only your coven can reach you here.</b> No stranger can wander in.</li>` +
    `<li style="margin:6px 0">It's <b>always night</b>, lit in violet, on its own quiet clock.</li>` +
    `<li style="margin:6px 0">Your coven's <b>Manor</b> stands only in this world.</li>` +
    `<li style="margin:6px 0">Step back through the <b>Hagstone</b> any time to return to the public town.</li>` +
    `</ul>`;
  modal.classList.remove('hidden');
}
(function wireHagstoneWelcome() {
  const close = () => {
    const m = document.getElementById('hagstoneWelcomeModal');
    if (m) m.classList.add('hidden');
    try { localStorage.setItem('tc_hagstone_welcome_seen', '1'); } catch (e) {}
  };
  const btn = document.getElementById('hagstoneWelcomeCloseBtn');
  if (btn) btn.addEventListener('click', close);
  const modal = document.getElementById('hagstoneWelcomeModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
})();

// ── Altar-ritual HUD + bestowing ────────────────────────────────────────────
function ritualDef(id) { return RITUALS.find((r) => r.id === id) || null; }
function fmtClock(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// A small persistent pill showing the active blessing + its countdown, created
// lazily (no HTML change). Sits top-centre, below the status pills / coven
// banner. Hidden when no blessing is live.
function refreshRitualHud() {
  let el = document.getElementById('ritualBuff');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ritualBuff';
    // Top-right corner (now free — the health/💎 cluster moved to the top-left).
    // Sits ABOVE the in-building Leave button (top:64px) and the admin coord
    // readout (top:104px) instead of overlapping the Leave button as before.
    el.style.cssText = 'position:fixed;top:14px;right:18px;z-index:59;' +
      'background:linear-gradient(90deg,#2a1a44,#1c1038);border:1px solid #6b4aa0;color:#e7dcff;' +
      'font:600 12.5px/1 system-ui,-apple-system,sans-serif;padding:7px 14px;border-radius:999px;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.4);pointer-events:none;letter-spacing:.02em';
    document.body.appendChild(el);
  }
  const now = Date.now();
  if (ritualActive && ritualActive.until > now) {
    const d = ritualDef(ritualActive.id);
    el.textContent = `${d ? d.emoji : '✨'} ${d ? d.name : 'Blessing'} · ${fmtClock(ritualActive.until - now)}`;
    el.style.display = 'block';
  } else {
    if (ritualActive) { ritualActive = null; if (Modals.isOpen('bedChestModalOpen')) renderManorChest(); } // just expired
    el.style.display = 'none';
  }
}
// Bestow your active blessing on the nearest player (any player, coven or not).
function blessNearest() {
  if (!me) return;
  if (!ritualActive || ritualActive.until <= Date.now()) { setUnlockToast('✨ You hold no blessing to give — work a rite at your altar first.'); return; }
  const target = nearestOtherPlayer();
  if (!target) { setUnlockToast('No one near enough to bless.'); return; }
  const d = Math.hypot(target.x - me.x, target.y - me.y);
  if (d > 160) { setUnlockToast('Step closer to bless them.'); return; }
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'bless_player', targetId: target.id }));
}
// Tick the HUD/modal countdowns once a second while anything is counting.
setInterval(() => {
  if ((ritualActive && ritualActive.until > Date.now()) || document.getElementById('ritualBuff')) refreshRitualHud();
  if (Modals.isOpen('bedChestModalOpen') && (ritualActive || ritualCdUntil > Date.now())) renderRituals();
}, 1000);

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
    body: JSON.stringify({ product: product === 'pass30' ? 'pass30' : 'pass', account_token: savedAccount ? savedAccount.token : undefined })
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

// Session N: buy a one-time Coven Charter, then bounce through Stripe. On return,
// checkReturnFromCheckout() verifies it and the Coven menu shows it's ready.
async function startCharterCheckout(btn) {
  let token = '';
  try { const a = JSON.parse(localStorage.getItem('tc_account') || 'null'); if (a && a.token) token = a.token; } catch (e) {}
  if (!token) { setUnlockToast('Log into an account first — a Coven Charter follows your account.'); return; }
  const restore = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  try {
    const rt = await requestResumeToken();
    if (rt) sessionStorage.setItem('tc_resume', JSON.stringify({ token: rt, name: me ? me.name : '', at: Date.now() }));
  } catch (e) {}
  fetch(apiUrlMaybe('/api/checkout'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product: 'coven_charter', account_token: token })
  })
    .then(r => r.json())
    .then(data => {
      if (data.url) window.location.href = data.url;
      else { showCheckoutProblem(data.error || 'Could not start checkout.'); if (btn) { btn.disabled = false; btn.textContent = restore; } }
    })
    .catch(() => { showCheckoutProblem('Could not reach the server — is it still running?'); if (btn) { btn.disabled = false; btn.textContent = restore; } });
}

// Coven monthly upkeep — any member can pay $9.99 to extend the whole coven
// 30 days. Mirrors the charter checkout; the server resolves which coven from
// the payer's membership.
async function startUpkeepCheckout(btn) {
  let token = '';
  try { const a = JSON.parse(localStorage.getItem('tc_account') || 'null'); if (a && a.token) token = a.token; } catch (e) {}
  if (!token) { setUnlockToast('Log into an account first — coven upkeep follows your account.'); return; }
  const restore = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting…'; }
  try {
    const rt = await requestResumeToken();
    if (rt) sessionStorage.setItem('tc_resume', JSON.stringify({ token: rt, name: me ? me.name : '', at: Date.now() }));
  } catch (e) {}
  fetch(apiUrlMaybe('/api/checkout'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ product: 'coven_upkeep', account_token: token })
  })
    .then(r => r.json())
    .then(data => {
      if (data.url) window.location.href = data.url;
      else { showCheckoutProblem(data.error || 'Could not start checkout.'); if (btn) { btn.disabled = false; btn.textContent = restore; } }
    })
    .catch(() => { showCheckoutProblem('Could not reach the server — is it still running?'); if (btn) { btn.disabled = false; btn.textContent = restore; } });
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
  const charterSessionId = params.get('charter_session');
  if (charterSessionId) {
    // Bounce-back from a Coven Charter checkout — verify (replay-proof server
    // side), toast the result, and re-ask coven_state so the modal shows the
    // charter is ready to spend on founding a coven.
    returnedFromCheckout = true;
    history.replaceState(null, '', location.pathname + (params.get('testdrive') === '1' ? '?testdrive=1' : ''));
    let acctToken = '';
    try { const a = JSON.parse(localStorage.getItem('tc_account') || 'null'); if (a && a.token) acctToken = a.token; } catch (e) {}
    fetch(apiUrlMaybe('/api/verify-charter?session_id=' + encodeURIComponent(charterSessionId)
          + (acctToken ? '&account_token=' + encodeURIComponent(acctToken) : '')))
      .then(r => r.json())
      .then(data => {
        if (data.granted) setUnlockToast('🌙 Coven Charter ready — open the Coven menu to found your coven!');
        else if (data.charters != null) setUnlockToast('🌙 That charter was already credited — you hold ' + data.charters + '. Open the Coven menu to found your coven.');
        else setUnlockToast('⚠️ ' + (data.error || 'Could not verify the Coven Charter.'));
      })
      .catch(() => setUnlockToast('⚠️ Could not verify the Coven Charter — it will retry next visit.'));
    setTimeout(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'coven_state' })); }, 2500);
    return;
  }
  const upkeepSessionId = params.get('upkeep_session');
  if (upkeepSessionId) {
    // Bounce-back from a Coven Upkeep checkout — verify (replay-proof), toast
    // the result, and re-ask coven_state so the menu shows the new paid-through.
    returnedFromCheckout = true;
    history.replaceState(null, '', location.pathname + (params.get('testdrive') === '1' ? '?testdrive=1' : ''));
    let acctToken = '';
    try { const a = JSON.parse(localStorage.getItem('tc_account') || 'null'); if (a && a.token) acctToken = a.token; } catch (e) {}
    fetch(apiUrlMaybe('/api/verify-upkeep?session_id=' + encodeURIComponent(upkeepSessionId)
          + (acctToken ? '&account_token=' + encodeURIComponent(acctToken) : '')))
      .then(r => r.json())
      .then(data => {
        if (data.granted) setUnlockToast('🕯️ Coven upkeep paid — your coven is good for another 30 days!');
        else if (data.paidThroughAt) setUnlockToast('🕯️ That upkeep was already credited — the coven is paid up.');
        else setUnlockToast('⚠️ ' + (data.error || 'Could not verify the coven upkeep.'));
      })
      .catch(() => setUnlockToast('⚠️ Could not verify the coven upkeep — it will retry next visit.'));
    setTimeout(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'coven_state' })); }, 2500);
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
  // The announce banner IS the prominent display of this line, so don't let the
  // paired appendSystemChatLine() re-banner the same words on mobile — that was
  // the faded duplicate stacked behind the banner. Reuse the toast de-dupe seam.
  lastToastText = text; lastToastAt = Date.now();
  document.body.classList.add('announceUp');
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { el.classList.add('hidden'); document.body.classList.remove('announceUp'); }, 6000);
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

// The story beat — the in-the-moment dialogue box for a campaign chapter's
// intro (fired on story_chapter_started) and outro (on story_chapter_complete).
// The full narrative still lives in the Journal; this is what makes the beat
// land when you Begin a chapter or finish one at the NPC, instead of silently
// ticking a toast. One box, reused for every chapter of every class.
function showStoryBeat({ kicker, title, body, rewards, isComplete }) {
  const modal = document.getElementById('storyBeatModal');
  if (!modal) return;
  modal.classList.toggle('complete', !!isComplete);
  document.getElementById('storyBeatKicker').textContent = kicker || '📖 Story';
  document.getElementById('storyBeatTitle').textContent = title || '';
  document.getElementById('storyBeatBody').textContent = body || '';
  const rw = document.getElementById('storyBeatRewards');
  if (rewards) { rw.textContent = '🎁 ' + rewards; rw.classList.remove('hidden'); }
  else { rw.textContent = ''; rw.classList.add('hidden'); }
  document.getElementById('storyBeatBtn').textContent = isComplete ? 'Onward' : 'Continue';
  modal.classList.remove('hidden');
}
function closeStoryBeat() {
  const m = document.getElementById('storyBeatModal');
  if (m) m.classList.add('hidden');
}
const storyBeatBtn = document.getElementById('storyBeatBtn');
if (storyBeatBtn) storyBeatBtn.addEventListener('click', closeStoryBeat);

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

// Social sibling of the above: someone nearby played a clip ALOUD (voice_say),
// no combat involved. Same "hear it + see the ring + read it" delivery, minus
// the countermeasure framing (no evasion, no "the night scattered").
function playVoiceEcho(msg) {
  try {
    if (cmAudioEl) { cmAudioEl.pause(); }
    cmAudioEl = new Audio(msg.audio);
    cmAudioEl.volume = 0.9;
    cmAudioEl.play().catch(() => {});
  } catch (e) {}
  spawnVoiceRings(me ? me.room : 'outside', msg.x, msg.y);
  if (msg.playerId === myId) setUnlockToast(`📢 You played "${msg.label}" aloud.`);
  else setUnlockToast(`📢 ${msg.from}: "${msg.label}"`);
  appendSystemChatLine(`📢 ${msg.from} played "${msg.label}" aloud.`);
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
  if (v.nameEl && p) {
    const shown = p.disguiseName ? p.disguiseName : p.name;
    // Fly the chosen title on a small line above the name — but never while
    // masked (the disguise is the whole point). Built as DOM nodes, not HTML,
    // so a crafted name/title can't inject markup.
    const title = (!p.disguiseName && p.activeTitle) ? p.activeTitle : null;
    v.nameEl.textContent = '';
    if (title) {
      const t = document.createElement('span');
      t.className = 'nameTitle';
      t.textContent = title;
      v.nameEl.appendChild(t);
      v.nameEl.appendChild(document.createElement('br'));
    }
    v.nameEl.appendChild(document.createTextNode(shown));
  }
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
    // depthTest off + a high renderOrder so the photo ALWAYS draws over the
    // character — the head and (taller) hair geometry no longer clip its lower
    // arc, which is what was cutting the circle off at the bottom.
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const r = CHAR.headR * 1.35;
    const mask = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat);
    mask.renderOrder = 12;
    // Float the whole disc just ABOVE the head (bottom edge clears the hairline)
    // so it reads as a held-up photo over the head and the full circle shows.
    mask.position.set(0, CHAR.headY + CHAR.headR * 2.5, CHAR.headR * 1.2);
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
  if (typeof playSfx === 'function') playSfx('jump');
  jumpT = 0;
}

window.addEventListener('keydown', (e) => {
  if (typing || Modals.isOpen('mapModalOpen') || Modals.isOpen('passModalOpen') || Modals.isOpen('msModalOpen') || Modals.isOpen('legendModalOpen') || Modals.isOpen('arcadeModalOpen') || Modals.isOpen('bankModalOpen') || Modals.isOpen('auctionModalOpen') || Modals.isOpen('sendMoneyModalOpen') || Modals.isOpen('spellConsentOpen') || Modals.isOpen('howlConsentOpen') || Modals.isOpen('npcShopOpen') || Modals.isOpen('witchShopOpen') || Modals.isOpen('witchConsentOpen') || Modals.isOpen('werewolfShopOpen') || Modals.isOpen('werewolfConsentOpen')) return;
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

// Push-to-talk for coven voice (hold C). Dedicated listeners so it works
// coven-wide regardless of which screen is up — but never while typing.
window.addEventListener('keydown', (e) => {
  if ((e.key === 'c' || e.key === 'C') && !e.repeat && !typing && _covenVoice.isActive()) _covenVoice.setTalking(true);
});
window.addEventListener('keyup', (e) => {
  if ((e.key === 'c' || e.key === 'C') && _covenVoice.isActive()) _covenVoice.setTalking(false);
});
// Dropping the window/tab must not leave the mic stuck open.
window.addEventListener('blur', () => { if (_covenVoice.isActive()) _covenVoice.setTalking(false); });

// Backtick (`) mirrors Escape — opens/closes the ☰ menu (and closes any open
// panel) by dispatching a synthetic Escape, reusing all of Escape's handling.
// Unlike Escape, the browser doesn't reserve it, so it opens the menu even in
// fullscreen WITHOUT dropping out. Never fires while typing (` is a character).
window.addEventListener('keydown', (e) => {
  if ((e.key === '`' || e.code === 'Backquote') && !e.repeat && !typing) {
    e.preventDefault();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  }
});

// M toggles the full-screen town map. Its own listener (not the movement one,
// which is suppressed while the map is open) so M can also CLOSE it. Opens only
// when nothing else is claiming the screen — while any other modal or the ☰
// menu is up, M is a no-op (except the map itself, which it closes).
window.addEventListener('keydown', (e) => {
  if ((e.key !== 'm' && e.key !== 'M') || e.repeat || typing) return;
  if (Modals.isOpen('mapModalOpen')) { e.preventDefault(); window.__closeTownMap && window.__closeTownMap(); return; }
  const sheet = document.getElementById('menuSheet');
  const menuUp = sheet && !sheet.classList.contains('hidden');
  if (!gameStarted || menuUp || Modals.any()) return;
  e.preventDefault();
  window.__toggleTownMap && window.__toggleTownMap();
});

// ── Mobile mode ─────────────────────────────────────────────────────────────
// One switch, decided once at boot. Everything mobile hangs off the
// body.touchMode class (CSS) and this flag (behavior).
const MOBILE_UI = isTouchDevice();
if (MOBILE_UI) document.body.classList.add('touchMode');

// ── Asset-load pill ─────────────────────────────────────────────────────────
// A small pill that rides just off the cursor while the KayKit models stream
// in, so a new player knows the brief rough-graphics moment is the world still
// loading — not a glitch. It hides (and stops updating) the instant everything
// is loaded. On touch devices there's no cursor, so it pins above the hotbar.
(() => {
  const pill = document.getElementById('loadPill');
  if (!pill) return;
  const fillEl = document.getElementById('loadPillFill');
  const textEl = document.getElementById('loadPillText');
  const subEl = pill.querySelector('.loadPillSub');
  function frame() {
    // Show once the player has committed to entering (join armed) or is in-game,
    // and only while assets are still streaming.
    const armed = gameStarted || window.__tcLoadArmed;
    // The world is ready to play once the town (gating assets, incl. the hex
    // floor) has settled and — once spawned — the player's OWN character body is
    // in.
    const worldReady = KK.settled && (!me || KK.charReady(me.charId));
    if (armed && !worldReady) {
      // Phase 1 — the shared world's own graphics. Fill off the GATING fraction
      // so the bar climbs to ~100% exactly as the world finishes painting in,
      // rather than stalling in the 70s like the whole-manifest fraction would.
      const frac = (typeof KK.gatingFrac === 'function') ? KK.gatingFrac() : KK.loadFrac();
      const pct = Math.max(4, Math.min(100, Math.round(frac * 100)));
      if (fillEl) fillEl.style.width = pct + '%';
      if (textEl) textEl.textContent = 'Loading the world’s graphics… ' + pct + '%';
      if (subEl) subEl.textContent = 'hang tight — the rough look clears in a moment';
      pill.classList.add('show');
    } else if (armed && !KK.fullyLoaded && typeof KK.charTailFrac === 'function') {
      // Phase 2 (non-blocking) — the town is up and playable, but the player/NPC
      // bodies + summon skeletons are still streaming in behind their blocky
      // stand-ins. A fresh player used to just see those stand-ins pop over with
      // no hint it was coming; keep a quiet indicator up so they know the figures
      // sharpen into real characters — and that they can dive in right now.
      const pct = Math.max(4, Math.min(99, Math.round(KK.charTailFrac() * 100)));
      if (fillEl) fillEl.style.width = pct + '%';
      if (textEl) textEl.textContent = '✨ Loading characters… ' + pct + '%';
      if (subEl) subEl.textContent = 'jump in — the blocky figures sharpen up as they arrive';
      pill.classList.add('show');
    } else {
      pill.classList.remove('show');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

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
let lastTouchAt = 0; // set by the canvas touch handlers; guards the ghost mouseup below
window.addEventListener('mouseup', (e) => {
  dragging = false;
  // Mobile browsers fire a synthetic mouse event right after a touch tap.
  // Without this guard one tap runs handleCanvasClick twice (real touchend +
  // ghost mouseup), double-sending the action — which is why a single harvest
  // click also popped "already harvested" (the 2nd send hit the cooldown).
  if (Date.now() - lastTouchAt < 1000) { clickOriginatedOnCanvas = false; return; }
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
    // Always-on nameplates (the World Boss banner): a raid target wears its
    // name the whole fight, not just when the cursor grazes it. Keep it lit
    // and skip the hover/proximity fade the ordinary NPC signs use.
    if (sprite.userData && sprite.userData._alwaysOn) {
      if (sprite.material) sprite.material.opacity = 1;
      sprite.visible = true;
      continue;
    }
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
    { const g = worldBossGroup(); if (g && g.visible) list.push(g); }
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
  return typing || Modals.isOpen('mapModalOpen') || Modals.isOpen('passModalOpen') || Modals.isOpen('arcadeModalOpen') || Modals.isOpen('bankModalOpen') || Modals.isOpen('auctionModalOpen') ||
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

const ATTACKABLE_KINDS = new Set(['player', 'animal', 'mob', 'animal2', 'mob2', 'mob3', 'dungeon', 'ember_mob', 'world_boss']);

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
  if (room === 'outside' || room === 'wilds' || (typeof room === 'string' && room.startsWith('dungeon_')) || room === 'witch_cave' || room === 'bank_vault' || room === 'ember_wastes' || room === 'ember_refuge' || room === 'manor' || room === 'cottage' || !world) {
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
  if (room === 'manor') return manorScene || null;
  if (room === 'cottage') return cottageScene || null;
  if (room === 'bank_vault') return vaultScene || null;
  if (room === 'ember_wastes') return emberScene || null;
  if (room === 'ember_refuge') return refugeScene || null;
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
  if (targetType === 'world_boss') { const p = worldBossVisualPos(); return p ? { x: p.x, z: p.y } : null; }
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
let _playerCtxMenuOpenedAt = 0; // guards the document click-dismiss from closing the menu on the same gesture that opened it
function showPlayerContextMenu(targetId, x, y) {
  playerContextMenuId = targetId;
  _playerCtxMenuOpenedAt = Date.now();
  const menu = document.getElementById('playerContextMenu');
  const p = players[targetId];
  // Tapping someone is also how you ASK for their name on mobile (names
  // are distance-gated there) — surface it for a few seconds. The shown
  // name honors disguises, of course; that's the whole game of them.
  if (p) p.tapNameUntil = Date.now() + 4500;
  if (menu) {
    document.getElementById('playerContextName').textContent = p ? (p.disguiseName || p.name) : 'Player';
    // Only offer "Invite to Coven" when you actually lead/belong to one —
    // otherwise the server would just bounce it back as "you have no coven."
    const covenBtn = document.getElementById('playerContextCoven');
    if (covenBtn) covenBtn.classList.toggle('hidden', !covenState);
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

let _lastHarvestId = null, _lastHarvestAt = 0; // dedupe double-fired harvests (ghost tap)
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
    lastCastAtk = (armedTarget.msgType === 'cast_spell' ? SPELL_CATALOG : myAttackCatalog)[armedTarget.attackId] || null;
    lastCastId = armedTarget.attackId;
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
      lastCastAtk = (armedTarget.msgType === 'cast_spell' ? SPELL_CATALOG : myAttackCatalog)[armedTarget.attackId] || null;
    lastCastId = armedTarget.attackId;
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
    if (typeof playSfx === 'function') playSfx('swing');
    ws.send(JSON.stringify({ type: 'strike', targetType: hit.kind, targetId: hit.targetId }));
    flashCreatureHit(hit.kind, hit.targetId);
    triggerAttackAnim();
  } else if (hit.kind === 'decor') {
    // Swallow a double-fire on one tap: a mobile tap can emit a second click
    // (the synthetic ghost mouse event) just after the real one, and the
    // second harvest of the same node pops "Already harvested" right after the
    // first succeeded. Ignore a repeat of the same decor within a short window.
    const nowH = Date.now();
    if (!(hit.decorId === _lastHarvestId && nowH - _lastHarvestAt < 1500)) {
      _lastHarvestId = hit.decorId; _lastHarvestAt = nowH;
      ws.send(JSON.stringify({ type: 'harvest', decorId: hit.decorId }));
    }
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
  lastTouchAt = Date.now(); // mark the tap so the ghost mousedown/up is ignored
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
  lastTouchAt = Date.now(); // mark the tap so the ghost mouseup is ignored
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

// Replace the ☰ menu rows' leading emoji with custom carved icons. Reuses
// existing item/ability icons where the concept matches; m_* are menu-only.
const MENU_ICONS = {
  menuInventory: 'm_bag', menuSkills: 'm_skills', menuLoadout: 'm_loadout', menuWardrobe: 'm_wardrobe',
  menuTitles: 'm_titles', menuJournal: 'magic_scroll', menuDrive: 'hard_drive', menuPath: 'wizard_hat',
  menuFamiliar: 'm_familiar', menuGarden: 'm_garden', menuKitchen: 'trail_remedy', menuBook: 'kit',
  menuTarot: 'm_tarot', menuScry: 'm_mirror', menuAncestor: 'm_candle', menuRelease: 'fireball',
  menuGuise: 'm_guise', menuMap: 'm_map', menuBoard: 'm_board', menuCrier: 'callout', menuDelve: 'm_delve',
  menuCoven: 'm_coven', menuAchievements: 'm_medal', menuCodex: 'm_codex',
  menuPass: 'm_ticket', menuMoonstones: 'moonstone', menuNotifs: 'bell', menuInvite: 'm_handshake',
};
function hydrateMenuRows() {
  for (const id in MENU_ICONS) {
    const el = document.getElementById(id);
    if (!el || el._menuIconed) continue;
    const svg = uiIcon(MENU_ICONS[id]);
    if (!svg) continue;
    const t = el.childNodes[0];
    if (t && t.nodeType === 3) t.textContent = t.textContent.replace(/^\s*\S+\s*/u, '');
    const span = document.createElement('span');
    span.className = 'menuGi';
    span.innerHTML = svg;
    el.insertBefore(span, el.firstChild);
    el._menuIconed = true;
  }
}

// ── Action wheel wiring ──
(function wireActionCluster() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
  };
  // Swap the cluster's emoji glyphs for the custom carved-icon set.
  const setIcon = (id, key) => {
    const el = document.getElementById(id);
    const svg = uiIcon(key);
    if (el && svg) el.innerHTML = svg;
  };
  setIcon('btnStrike', 'attack');
  setIcon('btnJump', 'jump');
  setIcon('btnEmote', 'emote');
  setIcon('btnCm', 'callout');
  setIcon('btnKit', 'kit');
  // Inject the static HUD icons (heart / moonstone / chat / day-night).
  hydrateIcons(document);
  hydrateMenuRows();
  on('btnStrike', () => { if (me && !me.isDead) strikeNearestEnemy(); });
  on('btnJump', tryJump);
  on('btnEmote', () => toggleEmoteWheel());
  on('btnCm', fireVoiceCountermeasure);
  on('btnKit', () => {
    // Mobile: fan out the overflow abilities as a radial. The full panel
    // (descriptions + loadout) still lives on the ☰ menu's Abilities row.
    if (MOBILE_UI) { toggleAbilityWheel(); return; }
    if (me && me.charId === 0) { if (!Modals.isOpen('spellbookOpen')) openSpellbook(); }
    else if (myAttackCatalog) { if (!Modals.isOpen('attackPanelOpen')) openAttackPanel(); }
  });
  on('chatToggleBtn', () => toggleMobileChat());
  on('menuBtn', () => { if (typeof playSfx === 'function') playSfx('ui_click'); document.getElementById('menuSheet').classList.remove('hidden'); });
  // Desktop's ☰ chip opens the very same sheet — one menu for both platforms.
  // __fromMenu tracks whether the open panel was launched from the ☰ menu, so
  // Escape can step back INTO the menu rather than closing everything (the menu
  // and every panel share one shape, so it reads as the content swapping).
  on('pcMenuBtn', () => { document.getElementById('menuSheet').classList.remove('hidden'); window.__fromMenu = false; });
  on('menuCloseBtn', () => { document.getElementById('menuSheet').classList.add('hidden'); window.__fromMenu = false; });
  const sheet = document.getElementById('menuSheet');
  if (sheet) sheet.addEventListener('click', (e) => { if (e.target === sheet) { sheet.classList.add('hidden'); window.__fromMenu = false; } });
  const closeSheetAnd = (fn) => () => { document.getElementById('menuSheet').classList.add('hidden'); window.__fromMenu = true; fn(); };
  // One place that marks EVERY ☰ menu-row launch "from menu" (so Escape steps
  // back into the menu, not the game) — covers closeSheetAnd, wire, and inline
  // handlers alike. Capture phase runs before the row's own click handler.
  const _menuGridEl = document.getElementById('menuGrid');
  if (_menuGridEl) _menuGridEl.addEventListener('click', (e) => {
    const row = e.target && e.target.closest && e.target.closest('.menuRow');
    if (row && row.id !== 'menuCloseBtn') window.__fromMenu = true;
  }, true);
  on('menuInventory', closeSheetAnd(() => { if (!Modals.isOpen('inventoryOpen')) toggleInventory(); }));
  // Guest → account nudge: "Create a free account" reloads to the join screen
  // with a flag so it opens straight into the register form.
  on('guestNudgeYes', () => { openGuestRegister(); });
  on('guestNudgeNo', () => { const n = document.getElementById('guestNudge'); if (n) n.classList.add('hidden'); });
  on('gatherHint', () => { const el = document.getElementById('gatherHint'); if (el) el.classList.add('hidden'); if (me) _gatherDismissedRoom = me.room; });
  on('grSubmit', () => { submitGuestRegister(); });
  on('grCancel', () => { const m = document.getElementById('guestRegister'); if (m) m.classList.add('hidden'); });
  { const gp = document.getElementById('grPass'); if (gp) gp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitGuestRegister(); }); }
  { const ge = document.getElementById('grEmail'); if (ge) ge.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitGuestRegister(); }); }
  on('menuJournal', closeSheetAnd(() => { if (!Modals.isOpen('journalOpen')) openJournal(); }));
  on('menuBook', closeSheetAnd(() => { if (!Modals.isOpen('bookOpen')) openBookModal(); }));
  on('bookCloseBtn', closeBookModal);
  on('menuFamiliar', closeSheetAnd(() => { if (!Modals.isOpen('familiarOpen')) openFamiliarModal(); }));
  on('familiarCloseBtn', closeFamiliarModal);
  on('menuGuise', closeSheetAnd(() => { if (!Modals.isOpen('guiseOpen')) openGuiseModal(); }));
  on('guiseCloseBtn', closeGuiseModal);
  on('menuScry', closeSheetAnd(() => { if (!Modals.isOpen('scryOpen')) openScryModal(); }));
  on('scryCloseBtn', closeScryModal);
  on('menuTarot', closeSheetAnd(() => { if (!Modals.isOpen('tarotOpen')) openTarotModal(); }));
  on('tarotCloseBtn', closeTarotModal);
  on('menuGarden', closeSheetAnd(() => { if (!Modals.isOpen('gardenOpen')) openGardenModal(); }));
  on('gardenCloseBtn', closeGardenModal);
  on('menuHome', closeSheetAnd(() => { if (!Modals.isOpen('homeOpen')) openHomeModal(); }));
  on('homeCloseBtn', closeHomeModal);
  on('menuKitchen', closeSheetAnd(() => { if (!Modals.isOpen('kitchenOpen')) openKitchenModal(); }));
  on('kitchenCloseBtn', closeKitchenModal);
  on('menuPath', closeSheetAnd(() => { if (!Modals.isOpen('pathOpen')) openPathModal(); }));
  on('menuAncestor', closeSheetAnd(() => { if (!Modals.isOpen('ancestorOpen')) openAncestorModal(); }));
  on('ancestorCloseBtn', closeAncestorModal);
  on('menuRelease', closeSheetAnd(() => { if (!Modals.isOpen('releaseOpen')) openReleaseModal(); }));
  on('releaseCloseBtn', closeReleaseModal);
  on('pathCloseBtn', closePathModal);
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
  on('menuInvite', closeSheetAnd(openInviteModal));
  on('inviteCloseBtn', () => { const m = document.getElementById('inviteModal'); if (m) m.classList.add('hidden'); });
  on('menuCrier', closeSheetAnd(openCrierModal));
  on('crierCloseBtn', () => closeCrierModal());
  { const cm = document.getElementById('crierModal'); if (cm) cm.addEventListener('click', (e) => { if (e.target === cm) closeCrierModal(); }); }
  { const im = document.getElementById('inviteModal'); if (im) im.addEventListener('click', (e) => { if (e.target === im) im.classList.add('hidden'); }); }
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
  card.querySelector('.apName').innerHTML = glyphHTML(info.id || info.icon || '✨', 'apGi', info.icon || '✨') + ' ' + escHtml(info.name || '');
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
    kitBtn.innerHTML = uiIcon(me.charId === 0 ? 'kit' : 'm_skills') || (me.charId === 0 ? '📖' : '✨');
    if (me.charId === 0 || myAttackCatalog) kitBtn.style.opacity = '1';
  }
  if (!myActionCatalog) return;
  const ids = orderedAbilityIds().slice(0, 5);
  ['qs1', 'qs2', 'qs3', 'qs4', 'qs5'].forEach((qid, i) => {
    const btn = document.getElementById(qid);
    if (!btn) return;
    const abilityId = ids[i];
    if (!abilityId) { btn.classList.add('hidden'); btn.style.display = 'none'; return; }
    const ab = myActionCatalog[abilityId];
    btn.innerHTML = '';
    const _svg = uiIcon(abilityId);
    if (_svg) { const _w = document.createElement('span'); _w.innerHTML = _svg; btn.appendChild(_w.firstElementChild); }
    else { btn.appendChild(document.createTextNode(ab.icon || '✨')); }
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
    btn._castId = abilityId;
    btn.onclick = (e) => { e.preventDefault(); castFromHotbar(abilityId); }; // gamepad / non-touch
    attachCastOnRelease(btn); // touch: tap = quick-cast, drag = aim + cast-on-release
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
// Eight keyed emotes, each drawn as a custom carved-talisman icon (ui-icons.js)
// rather than a system emoji, so the wheel stays in the game's visual language.
const EMOTES = EMOTE_DEFS.map((d) => d.key);
let emoteWheelTimer = null;

function buildEmoteWheel() {
  const wheel = document.getElementById('emoteWheel');
  if (!wheel || wheel.childElementCount) return;
  const R = 88, cx = 115, cy = 115;
  EMOTE_DEFS.forEach((def, i) => {
    const ang = (i / EMOTE_DEFS.length) * Math.PI * 2 - Math.PI / 2;
    const b = document.createElement('button');
    b.className = 'emoteBtn';
    b.innerHTML = uiIcon(def.key) || '';
    b.title = def.label;
    b.setAttribute('aria-label', def.label);
    b.style.left = (cx + Math.cos(ang) * R - 26) + 'px';
    b.style.top = (cy + Math.sin(ang) * R - 26) + 'px';
    b.style.animationDelay = (i * 0.02) + 's';
    b.addEventListener('click', (e) => {
      e.preventDefault();
      ws.send(JSON.stringify({ type: 'emote', emote: def.key }));
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

// ── Ability overflow wheel (mobile) ─────────────────────────────────────────
// The kit button fans out every ability past the 5-slot arc as a radial, so a
// 12–15 ability class can reach its situational skills in one tap. Tap an
// ability to quick-cast it (nearest target); the dim backdrop taps to close.
let abilityWheelTimer = null;
function abilityTint(ab) {
  const e = ab && ab.effect;
  if (e === 'damage' || e === 'leech') return 'awOffense';
  if (e === 'heal') return 'awSupport';
  return 'awUtility';
}
function buildAbilityWheel() {
  const wheel = document.getElementById('abilityWheel');
  if (!wheel || !myActionCatalog) return;
  wheel.innerHTML = '';
  const ids = orderedAbilityIds().slice(5); // everything past the 5-slot arc
  const n = ids.length;
  if (!n) return;
  const cx = 150, cy = 150;             // wheel box is 300×300
  const R = Math.min(122, 44 + n * 9);  // ring grows with the count, capped
  ids.forEach((id, i) => {
    const ab = myActionCatalog[id]; if (!ab) return;
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    const b = document.createElement('button');
    b.className = 'awBtn ' + abilityTint(ab);
    const svg = uiIcon(id);
    if (svg) b.innerHTML = svg; else b.textContent = ab.icon || '✨';
    b.title = ab.name || id;
    b.style.left = (cx + Math.cos(ang) * R - 28) + 'px';
    b.style.top = (cy + Math.sin(ang) * R - 28) + 'px';
    b.style.animationDelay = (i * 0.015) + 's';
    if (actionOnCooldown(id)) b.classList.add('onCd');
    b.addEventListener('click', (e) => { e.preventDefault(); castFromHotbar(id); toggleAbilityWheel(false); });
    attachAbilityPeek(b, () => ({ id, icon: ab.icon, name: ab.name, kind: ab.kind, description: ab.description }));
    wheel.appendChild(b);
  });
}
function toggleAbilityWheel(open) {
  const wheel = document.getElementById('abilityWheel');
  const bg = document.getElementById('abilityWheelBg');
  if (!wheel) return;
  const willOpen = open === undefined ? wheel.classList.contains('hidden') : open;
  if (willOpen) {
    buildAbilityWheel();
    if (!wheel.childElementCount) { setUnlockToast('All your abilities are already on the bar.'); return; }
  }
  wheel.classList.toggle('hidden', !willOpen);
  if (bg) bg.classList.toggle('hidden', !willOpen);
  document.body.classList.toggle('abilityWheelOpen', willOpen);
  clearTimeout(abilityWheelTimer);
  if (willOpen) abilityWheelTimer = setTimeout(() => toggleAbilityWheel(false), 6000);
}
(function wireAbilityWheelBg() {
  const bg = document.getElementById('abilityWheelBg');
  if (bg) { bg.addEventListener('click', () => toggleAbilityWheel(false)); bg.addEventListener('touchstart', (e) => { e.preventDefault(); toggleAbilityWheel(false); }, { passive: false }); }
})();

// Emote floats — the emoji bounces above the sender's head for a couple of
// seconds, tracked to their moving position each frame.
const activeEmoteFloats = [];
function spawnEmoteFloat(playerId, emote) {
  const layer = document.getElementById('fxLayer');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = 'emoteFloat';
  const svg = uiIcon(emote);
  if (svg) el.innerHTML = svg; else el.textContent = emote;
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
  // ⛶ Fullscreen — toggle the browser Fullscreen API for a clutter-free view
  // (hides tabs/toolbar/dock). The menu click is the user gesture the API
  // requires, so closing the sheet first is fine. The label tracks state.
  const fsLabel = () => { const r = document.getElementById('menuFullscreen'); if (r) r.textContent = document.fullscreenElement ? '⛶ Exit fullscreen' : '⛶ Fullscreen'; };
  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const el = document.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
      }
    } catch (e) { /* fullscreen can be blocked by the browser; ignore */ }
  }
  on('menuFullscreen', () => { document.getElementById('menuSheet').classList.add('hidden'); toggleFullscreen(); });
  document.addEventListener('fullscreenchange', fsLabel);
  document.addEventListener('webkitfullscreenchange', fsLabel);
  fsLabel();
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
    sendChatMessage();
  } else if (e.key === 'Escape') {
    chatInput.blur();
  }
});
// ➤ Send — the tap path phones need (no reliable Enter key on a software
// keyboard) and a nicety on desktop.
const chatSendBtn = document.getElementById('chatSendBtn');
if (chatSendBtn) chatSendBtn.addEventListener('click', () => {
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
    // Pictures only from a building's private room tab (incl. paid rooms);
    // never from world chat (text-only for moderation).
    if (!(activeChatTab === 'room' && isBuildingRoom(currentRoom))) return;
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
  // Route to the tab you're typing in: the building's private room, or World.
  payload.channel = (activeChatTab === 'room' && isBuildingRoom(currentRoom)) ? 'room' : 'world';
  ws.send(JSON.stringify(payload));
  chatInput.value = '';
  clearPendingImage();
}

// ── Chat tabs (World ⟷ the building you're in) ──────────────────────────────
function bumpChatBadge(which) {
  if (which !== 'world' && which !== 'room') return;
  chatUnread[which] = (chatUnread[which] || 0) + 1;
  syncChatTabs();
}
function clearChatBadge(which) { if (chatUnread[which]) { chatUnread[which] = 0; syncChatTabs(); } }
function setActiveChatTab(which) {
  if (which === 'room' && !isBuildingRoom(currentRoom)) which = 'world';
  activeChatTab = which;
  clearChatBadge(which);
  renderChatLog();
  try { if (!MOBILE_UI) chatInput.focus(); } catch (e) {}
}
// Reflect current tab state into the DOM (active highlight, room tab label +
// visibility, unread badges). Safe to call on every render.
function syncChatTabs() {
  const inBuilding = isBuildingRoom(currentRoom);
  if (activeChatTab === 'room' && !inBuilding) activeChatTab = 'world';
  const tW = document.getElementById('chatTabWorld');
  const tR = document.getElementById('chatTabRoom');
  if (!tW || !tR) return;
  tR.classList.toggle('hidden', !inBuilding);
  if (inBuilding) {
    const nm = document.getElementById('chatTabRoomName');
    if (nm) nm.textContent = (typeof roomLabel === 'function' ? roomLabel(currentRoom) : 'Room');
  }
  tW.classList.toggle('on', activeChatTab === 'world');
  tR.classList.toggle('on', activeChatTab === 'room');
  // Picture upload is allowed only on a building's private room tab (incl. the
  // paid lounge/arcade); world chat stays text-only for moderation. Reveal the
  // camera there, and drop any staged image when we're not on a room tab so it
  // can never ride a world-channel send.
  const canImage = activeChatTab === 'room' && inBuilding;
  if (chatImageBtn) chatImageBtn.classList.toggle('show', canImage);
  if (!canImage && typeof clearPendingImage === 'function' && pendingImage) clearPendingImage();
  const bW = document.getElementById('chatBadgeWorld');
  const bR = document.getElementById('chatBadgeRoom');
  if (bW) { bW.textContent = chatUnread.world > 9 ? '9+' : String(chatUnread.world || ''); bW.classList.toggle('hidden', !chatUnread.world || activeChatTab === 'world'); }
  if (bR) { bR.textContent = chatUnread.room > 9 ? '9+' : String(chatUnread.room || ''); bR.classList.toggle('hidden', !chatUnread.room || activeChatTab === 'room' || !inBuilding); }
}

function renderChatLog() {
  syncChatTabs();
  // Show the ACTIVE tab's channel — World (global) or this room's private chat
  // — always alongside system beats (story/combat), newest 40, in time order.
  const roomMsgs = messagesByRoom[currentRoom] || [];
  const systemLines = roomMsgs.filter(m => m.system);
  const onRoomTab = activeChatTab === 'room' && isBuildingRoom(currentRoom);
  const channelLines = onRoomTab ? roomMsgs.filter(m => !m.system) : worldFeed;
  const msgs = systemLines.concat(channelLines).sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-40);
  chatLog.innerHTML = '';
  let shown = 0;
  for (const m of msgs) {
    const div = document.createElement('div');
    if (m.system) {
      // Story/quest/combat beats — persistent history for what the toasts
      // only flashed. Styled as parchment lines, no author.
      div.className = 'chatLine systemLine';
      div.textContent = m.text;
      chatLog.appendChild(div);
      shown++;
      continue;
    }
    // Local mute: hide this viewer's muted names (their own lines always show).
    if (m.name && m.id !== myId && isMutedName(m.name)) continue;
    div.className = 'chatLine';
    const b = document.createElement('b');
    b.style.color = m.color;
    b.textContent = m.name + ':';
    // Click another player's name for mute / report. Not on your own lines,
    // not on system beats (handled above).
    if (m.id && m.id !== myId) {
      b.style.cursor = 'pointer';
      b.title = 'Options for ' + m.name;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); openPlayerMenu(m, ev); });
    }
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
    shown++;
  }
  if (!shown) {
    const empty = document.createElement('div');
    empty.className = 'chatLine systemLine';
    empty.style.opacity = '0.65';
    empty.textContent = (activeChatTab === 'room' && isBuildingRoom(currentRoom))
      ? `🌙 ${roomLabel(currentRoom)} is quiet. Say hello — press Enter to start chatting.`
      : '🌙 Town is quiet. Say hello — press Enter to start chatting.';
    chatLog.appendChild(empty);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ── Player menu (Session O): mute / report, opened by clicking a name in chat.
let playerMenuEl = null;
function closePlayerMenu() { if (playerMenuEl) { playerMenuEl.remove(); playerMenuEl = null; document.removeEventListener('click', closePlayerMenu, true); } }
function sendReport(m, reason) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'report', targetId: m.id, targetName: m.name, reason }));
  appendSystemChatLine('🚩 Reported ' + m.name + ' (' + reason + ').');
}
function openPlayerMenu(m, ev) {
  closePlayerMenu();
  const menu = document.createElement('div');
  menu.className = 'playerMenu';
  const head = document.createElement('div'); head.className = 'playerMenuHead'; head.textContent = m.name;
  menu.appendChild(head);
  const muted = isMutedName(m.name);
  const muteBtn = document.createElement('button');
  muteBtn.textContent = muted ? '🔊 Unmute' : '🔇 Mute';
  muteBtn.addEventListener('click', (e) => { e.stopPropagation(); setMuted(m.name, !muted); appendSystemChatLine((muted ? '🔊 Unmuted ' : '🔇 Muted ') + m.name + '.'); closePlayerMenu(); });
  menu.appendChild(muteBtn);
  const rlabel = document.createElement('div'); rlabel.className = 'playerMenuLabel'; rlabel.textContent = 'Report for…';
  menu.appendChild(rlabel);
  for (const reason of ['Spam', 'Harassment', 'Inappropriate']) {
    const rb = document.createElement('button');
    rb.className = 'playerMenuReport'; rb.textContent = '🚩 ' + reason;
    rb.addEventListener('click', (e) => { e.stopPropagation(); sendReport(m, reason); closePlayerMenu(); });
    menu.appendChild(rb);
  }
  document.body.appendChild(menu);
  // Position near the click, clamped to the viewport.
  const r = menu.getBoundingClientRect();
  const x = Math.min((ev ? ev.clientX : 40), window.innerWidth - r.width - 8);
  const y = Math.min((ev ? ev.clientY : 40), window.innerHeight - r.height - 8);
  menu.style.left = Math.max(8, x) + 'px';
  menu.style.top = Math.max(8, y) + 'px';
  // Close on any outside click (capture so the next click anywhere dismisses).
  setTimeout(() => document.addEventListener('click', closePlayerMenu, true), 0);
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

// Completely hide chat — panel AND overhead bubbles/banners (the receive handler
// checks `chatHidden` before popping any). A floating 💬 button restores it.
// The choice is remembered per viewer.
const chatHideBtn = document.getElementById('chatHideBtn');
const chatShowBtn = document.getElementById('chatShowBtn');
// Sync panel + restore-button to the current hidden state. The panel never
// shows before the game starts (the join screen stays clean), and the floating
// restore button only appears in-game while hidden.
function syncChatVisibility() {
  const panel = document.getElementById('chatPanel');
  if (panel) panel.classList.toggle('hidden', chatHidden || !gameStarted);
  if (chatShowBtn) chatShowBtn.classList.toggle('hidden', !(chatHidden && gameStarted));
}
function setChatHidden(hidden) {
  chatHidden = hidden;
  try { localStorage.setItem('tc_chatHidden', hidden ? '1' : '0'); } catch (e) {}
  syncChatVisibility();
}
if (chatHideBtn) chatHideBtn.addEventListener('click', () => setChatHidden(true));
if (chatShowBtn) chatShowBtn.addEventListener('click', () => setChatHidden(false));
{
  const tW = document.getElementById('chatTabWorld');
  const tR = document.getElementById('chatTabRoom');
  if (tW) tW.addEventListener('click', () => setActiveChatTab('world'));
  if (tR) tR.addEventListener('click', () => setActiveChatTab('room'));
}

let lastRoom = null; // null (not 'outside') so the FIRST room-UI pass always runs — otherwise spawning into the town short-circuits it and the chat panel never un-hides there
function maybeUpdateRoomUI(room) {
  if (room === lastRoom) return;
  const prevRoom = lastRoom;
  lastRoom = room;
  currentRoom = room;
  document.getElementById('roomLabel').textContent = roomLabel(room);
  pokeRoomTag();
  // World chat is global, so the panel lives in every room (town included) —
  // unless the viewer has hidden it. Inside a building you also get that
  // building's private room tab, auto-focused; the open air is World-only.
  syncChatVisibility();
  document.getElementById('chatPanel').classList.toggle('arcadeMode', room === 'arcade');
  // Leaving a building: drop its now-stale local lines (the backlog is re-sent
  // on re-entry) and fall back to the World tab.
  if (isBuildingRoom(prevRoom) && prevRoom !== room) { delete messagesByRoom[prevRoom]; chatUnread.room = 0; }
  if (isBuildingRoom(room)) { activeChatTab = 'room'; chatUnread.room = 0; }
  else { activeChatTab = 'world'; }
  renderChatLog();
  // Session L: the coven table sprite lives only in the café, and the event
  // pill re-evaluates per room (it hides indoors-agnostically otherwise).
  try { refreshCovenTableVisual(); } catch (e) {}
  try { renderEventTag(); } catch (e) {}
  // A new room means the gather nudge should re-evaluate (and any dismissal is
  // cleared — you've moved, so pointing you somewhere is useful again).
  _gatherDismissedRoom = null;
  try { renderGatherHint(); } catch (e) {}
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
const { createHumanoid, createKayKitByKey, createStaticNpc } = createHumanoidBuilder({ CHAR, CHARACTER_PRESETS, KK, kkSetState, resolveLook });
const WALL_HEIGHT = 110;
// Outdoor follow camera — pulled back ~10% (was back:165 height:125) so
// more of the town/wilds is on screen at once. Indoor cams stay as-is:
// their rooms are small, and the cave's walls were tuned to the old
// distances (see updateCamera()'s clip notes).
const OUTDOOR_CAM = { back: 182, height: 138, lookUp: 50 };
// Interior view: raised and angled DOWN into the room (a "dollhouse" framing)
// rather than the old low, near-level peer that made rooms feel cramped and
// left you looking up at furniture. height stays safely under the 150 ceiling
// of the shortest interiors (town buildings, the Vault) with headroom for
// pitch; the wall-clip shrink in updateCamera() keeps it off the walls.
const INDOOR_CAM  = { back: 100, height: 100, lookUp: 30 };
// The Coven Manor is a big hall with a taller (200) ceiling, so it gets its own
// higher, further-back framing to take in the open floor.
const MANOR_CAM   = { back: 150, height: 150, lookUp: 40 };
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
let justExitedRoom = null;     // building id just left — suppress instant re-entry until clear
let currentInterior = null;    // { scene, camera, roomW, roomD, doorStart, doorEnd, wallsLocal }
let groundY = 0;
const visuals = {}; // id -> { group, armL, armR, legL, legR, nameEl, inScene, parentScene }

// Outdoor-only day/night lighting — set once in initScene(), then mutated
// every frame by updateDayNightCycle(). Indoor scenes are unaffected (each
// building's interior already has its own fixed lighting).
let outdoorAmbient = null;
let outdoorSun = null;
let outdoorMoonLight = null;
let outdoorHemi = null; // violet-sky / warm-amber-ground wash: cheap torchlight bounce, no per-torch lights
// Temple of the Flame torch point lights — registered by buildTownTemple and
// ramped up at night (see updateDayNightCycle) so the flames "carry the dark".
const TEMPLE_TORCH_LIGHTS = [];
let moonMesh = null;
let sunMesh = null;
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
  lounge:  { w: 860, h: 420 },  // door axis (h) matches outdoor; one big open séance hall
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
// needs both x and z. The rendered Y is flat to the platform top across the
// footprint (the visible dais is a flat box, so a ramp left players sinking
// through the rim). Shared with initScene()'s temple placement/collision so
// the numbers can't drift.
const TEMPLE_PLATFORM_X = 1060, TEMPLE_PLATFORM_Z = 1900;
const TEMPLE_PLATFORM_W = 360, TEMPLE_PLATFORM_D = 260, TEMPLE_PLATFORM_HEIGHT = 16;

function getFloorHeight(roomId, rx, rz) {
  if (roomId === 'wilds') return wildsHeightAt(rx, rz || 0);
  if (roomId === 'ember_wastes') return emberHeightAt(rx, rz || 0);
  if (roomId === 'outside') {
    const halfW = TEMPLE_PLATFORM_W / 2, halfD = TEMPLE_PLATFORM_D / 2;
    const dx = Math.abs(rx - TEMPLE_PLATFORM_X), dz = Math.abs((rz ?? TEMPLE_PLATFORM_Z) - TEMPLE_PLATFORM_Z);
    if (dx <= halfW && dz <= halfD) {
      const depth = Math.min(halfW - dx, halfD - dz);
      // Flat to the platform top: the visible dais is a flat box (top at
      // platformH), so ramping the collision height up over the outer edge left
      // a standing player BELOW the visible floor near the rim — sinking through
      // it. Match the flat visual instead; stepping up onto a 16-unit dais reads
      // fine. (A proper stepped/KayKit platform is the real fix — see the temple
      // rebuild — which can restore a smooth edge.)
      return TEMPLE_PLATFORM_HEIGHT;
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
  // The Phantom Parlor is now a single flat floor (the two-story stairs +
  // terrace were removed for one bigger open room), so there's no height
  // function left — every room but the terrain/temple ones is dead level.
  return 0;
}

// ── Wilds terrain (rolling hills) ────────────────────────────────────────────
// A deterministic heightfield for the Wilds: gentle rolling hills everywhere,
// smoothly FLATTENED to level ground under the developed areas (spawn, portal,
// village, both ritual circles, the Witch's Cave, the Manor spot, the giant
// tree) and under every campfire/waymarker/NPC, so the hand-placed structures
// stay grounded while the open moor rolls. getFloorHeight('wilds') rides this,
// as do the ground mesh + scattered decor (see wilds-scene.js / addNatureDecor /
// addSpookyDecor). Collision stays 2D — only the vertical look changes.
const WILDS_AMP = 90; // hill height — gives rolling swells ≈0.8× the 68u player, gentle slopes (low-frequency noise)
let _wildsFlatZones = null;
function wildsFlatZones() {
  if (_wildsFlatZones) return _wildsFlatZones;
  const sx = world2 ? world2.spawn.x : 5000, sy = world2 ? world2.spawn.y : 8800;
  _wildsFlatZones = [
    { x: sx, y: sy, r: 440 },              // arrival spawn
    { x: sx + 170, y: sy + 20, r: 210 },   // return portal
    { x: 5000, y: 3000, r: 780 },          // the village
    { x: 2200, y: 5000, r: 540 },          // western ritual circle (Unbound camp)
    { x: 7800, y: 5000, r: 540 },          // eastern ritual circle (Thornwarden camp)
    { x: 2000, y: 2000, r: 470 },          // Witch's Cave mouth
    { x: 3000, y: 3000, r: 340 },          // the Manor's clearing
    { x: 6500, y: 6200, r: 330 },          // the giant werewolf tree
    ...WILDS_CAMPFIRES.map((f) => ({ x: f.x, y: f.y, r: 150 })),
    ...WILDS_WAYMARKERS.map((m) => ({ x: m.x, y: m.y, r: 150 })),
    ...WILDS_NPCS.map((n) => ({ x: n.x, y: n.y, r: 170 })),
  ];
  return _wildsFlatZones;
}
function wildsNoise(x, z) {
  const vn = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  const sm = (t) => t * t * (3 - 2 * t);
  const lattice = (fx, fy) => {
    const xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi;
    const u = sm(xf), v = sm(yf);
    const a = vn(xi, yi), b = vn(xi + 1, yi), c = vn(xi, yi + 1), d = vn(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const n = x * 0.00042, m = z * 0.00042;
  let h = (lattice(n * 3 + 11, m * 3 + 11) - 0.5) * 1.0;
  h += (lattice(n * 7 + 40, m * 7 + 40) - 0.5) * 0.4;
  h += (lattice(n * 15, m * 15) - 0.5) * 0.15;
  return h * WILDS_AMP;
}
function wildsHeightAt(x, z) {
  let flat = 1; // 1 = full hills, 0 = flat
  const zones = wildsFlatZones();
  for (let i = 0; i < zones.length; i++) {
    const c = zones[i];
    const d = Math.hypot(x - c.x, z - c.y);
    if (d < c.r) { const t = d / c.r; flat = Math.min(flat, t * t * (3 - 2 * t)); }
  }
  return flat <= 0 ? 0 : wildsNoise(x, z) * flat;
}

// The Ember Wastes' own rolling heightfield — scorched dunes across the open
// zone, flattened to level ground in the arrival haven around the portal so
// spawn/decor there sit flat. Client-only (collision stays 2D); getFloorHeight
// ('ember_wastes') rides this, as do the ground mesh, scattered decor, and the
// ember mobs. Amplitude a touch higher than the Wilds' moor for a harsher land.
// The Ember Wastes is a FLAT zone — a dead level plain of ruby-hex ground. It
// used to roll like the Wilds' moor (a displaced heightfield), but it now reads
// as a glassy ember flat carpeted with ruby hex tiles (see the ember scene's
// hex floor), so the heightfield is flattened to 0. Kept as a function (not a
// const 0) because the ground mesh, scattered decor, ember mobs and nodes all
// call it as groundY(x,z) — they now all sit dead level.
function emberHeightAt(/* x, z */) {
  return 0;
}

let seatedAt = null; // {x,z,facing} in render-space coords, or null when standing

function setActiveContext(sceneObj, cameraObj, interiorRecord) {
  if (sceneObj !== activeScene && typeof destroyMinions === 'function') destroyMinions(); // undead don't follow across scenes; the next state re-adds any in the new room
  activeScene = sceneObj;
  activeCamera = cameraObj;
  currentInterior = interiorRecord;
  if (activeCamera) {
    activeCamera.aspect = W / H;
    activeCamera.updateProjectionMatrix();
  }
}

function getRenderPos(p) {
  if (p.room === 'outside' || p.room === 'wilds' || (p.room && p.room.startsWith('dungeon_')) || p.room === 'witch_cave' || p.room === 'bank_vault' || p.room === 'ember_wastes' || p.room === 'ember_refuge' || p.room === 'manor' || p.room === 'cottage' || !world) return { x: p.x, z: p.y };
  const b = world.buildings.find(bb => bb.id === p.room);
  if (!b) return { x: p.x, z: p.y };
  return { x: (p.x - b.x) * INDOOR_SCALE, z: (p.y - b.y) * INDOOR_SCALE };
}

function contextMatches(room) {
  if (mode === 'indoor') return room === indoorBuildingId;
  if (activeScene === dungeonScene) return me && room === me.room;
  if (activeScene === wildsScene) return room === 'wilds';
  if (activeScene === caveScene) return room === 'witch_cave';
  if (activeScene === manorScene) return room === 'manor';
  if (activeScene === cottageScene) return room === 'cottage';
  if (activeScene === vaultScene) return room === 'bank_vault';
  if (activeScene === emberScene) return room === 'ember_wastes';
  if (activeScene === refugeScene) return room === 'ember_refuge';
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
    // MSAA in the post-processing path. `antialias:true` on the renderer only
    // anti-aliases its DEFAULT framebuffer; once the scene renders THROUGH the
    // composer (medium/high), it lands in an offscreen target with no MSAA, so
    // FXAA alone was left to fight the edges — which it loses on high-contrast
    // silhouettes and shadow boundaries (the "sawtoothing"). On WebGL2 we give
    // the composer a multisampled target so real MSAA runs again; FXAA stays to
    // clean up the texture/alpha edges MSAA doesn't. WebGL1 falls back to the
    // old single-sample target (FXAA only), unchanged.
    let msaaTarget = null;
    if (renderer.capabilities && renderer.capabilities.isWebGL2 && typeof THREE.WebGLMultisampleRenderTarget === 'function') {
      const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
      msaaTarget = new THREE.WebGLMultisampleRenderTarget(Math.max(2, sz.x), Math.max(2, sz.y), { format: THREE.RGBAFormat });
      msaaTarget.samples = st.quality === 'high' ? 4 : 2; // gentler on mobile/medium
    }
    st.composer = new THREE.EffectComposer(renderer, msaaTarget || undefined);
    st.renderPass = new THREE.RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    st.composer.addPass(st.renderPass);
    // Bloom is by far the heaviest composer pass — several fullscreen blur
    // iterations at the device's internal resolution every frame. Profiling
    // showed the town is GPU-FILL-bound on mobile (frame ~27ms GPU vs ~2ms JS),
    // and this pass is the single biggest chunk of that fill. Skip it on touch
    // devices; keep the cheap grade (saturation + vignette) and FXAA so the mood
    // and edges survive. Desktop keeps the full glow. st.bloomPass stays null and
    // its one other reader (night strength tweak) is already guarded.
    const wantBloom = !(typeof MOBILE_UI !== 'undefined' && MOBILE_UI);
    if (wantBloom) {
      st.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(W || 1280, H || 720), 0.42, 0.55, 0.82);
      st.composer.addPass(st.bloomPass);
    }
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
      if (o.userData && o.userData._noShadow) { o.castShadow = false; o.receiveShadow = false; return; } // e.g. sky clouds
      const glowy = m.transparent === true || (m.blending !== undefined && m.blending !== THREE.NormalBlending) || m.isMeshBasicMaterial;
      if (glowy) { o.castShadow = false; o.receiveShadow = false; return; }
      const g = o.geometry;
      const gt = g && g.type || '';
      const flat = gt.indexOf('Plane') === 0 || gt.indexOf('Circle') === 0;
      // Characters cast ground shadows but DON'T receive them: self-shadowing on
      // the small humanoid models under the wide follow shadow map stair-stepped
      // into saw-tooth acne across the body. Walk up for the isHumanoid flag.
      let isChar = false;
      for (let p = o; p; p = p.parent) { if (p.userData && p.userData.isHumanoid) { isChar = true; break; } }
      o.receiveShadow = !isChar;
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
    // Interiors are a single small room, so a far sharper shadow map is cheap
    // there — the follow (outdoor) map covers the whole town and stays modest.
    // The old 2048 over the interior's ~1240-unit span gave ~0.6 units/texel,
    // which stair-stepped the cast shadow on the floor; 4096 roughly halves that.
    const mapSize = info.follow ? (q === 'high' ? 2048 : 1024) : (q === 'high' ? 4096 : 2048);
    light.shadow.mapSize.set(mapSize, mapSize);
    if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
    const span = info.follow ? 720 : 620;
    const c = light.shadow.camera;
    c.left = -span; c.right = span; c.top = span; c.bottom = -span;
    c.near = 40; c.far = 3200;
    // Bias nudged up to stop surfaces shadow-acne'ing themselves (the "zebra
    // striping" seen on building doors/walls under the wide follow shadow map).
    // normalBias especially helps grazing-angle faces like a vertical door.
    // (If shadows ever visibly detach from their caster — peter-panning — these
    // are too high; dial back toward -0.00035 / 3.)
    // Interiors (non-follow) are small rooms lit by a near light, which acnes
    // walls and curved surfaces (helmets) more — and a touch of peter-panning
    // there is far less visible than the zebra striping, so bias harder.
    light.shadow.bias = info.follow ? -0.0006 : -0.0009;
    light.shadow.normalBias = info.follow ? 4 : 6;
    // Soften the edge. Resolution (above) shrinks the texel; radius widens the
    // PCF kernel so the shadow boundary gets a real penumbra instead of a hard,
    // stair-stepped line — the interior "sawtooth". Interiors can take a wide,
    // soft radius; the outdoor follow map stays crisp.
    light.shadow.radius = info.follow ? 2 : 7;
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

  // A low-poly cloud: a cluster of flat-shaded, flattened icosahedra forming a
  // puffy silhouette with a flat base — solid geometry, matching the faceted
  // look of the trees and buildings. No transparency, so nothing for the
  // display to dither into the "rainbow speckle" the soft sprite clouds showed.
  function makeLowpolyCloud() {
    const grp = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2a3048, emissiveIntensity: 0.35, flatShading: true });
    mat.fog = false; // clouds sit beyond the fog's far plane; don't let it eat them
    // [x, y, z, r] — a broad flat base row with a few lumps piled on top
    const blobs = [
      [0, 0, 0, 62], [-78, -4, 10, 46], [80, -3, -8, 48], [-140, -8, 4, 34], [138, -7, -4, 36],
      [-36, 34, -4, 46], [44, 30, 8, 42], [4, 46, 2, 34],
    ];
    for (const [x, y, z, r] of blobs) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
      mesh.position.set(x, y, z);
      mesh.scale.set(1, 0.62, 0.85); // squashed so the cloud is wide and shallow
      mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.userData._noShadow = true; // high in the sky — don't throw a huge shadow across the ground
      grp.add(mesh);
    }
    return { group: grp, mat };
  }

  function initSky(scene) {
    if (st.skyGroup) return;
    const grp = new THREE.Group();
    grp.name = 'gfxSky';
    // Several independent star layers, each twinkling on its own phase AND
    // speed (see cycleTick) so the night sky scintillates — different stars
    // bright at different moments — instead of the whole field pulsing in
    // unison. Varied size/colour gives a natural mix of bright & faint stars.
    const STAR_LAYERS = [
      { n: 300, size: 2.7, color: 0xffffff, speed: 1.1, phase: 0.0 },
      { n: 260, size: 2.1, color: 0xeaf0ff, speed: 1.7, phase: 1.3 },
      { n: 230, size: 1.6, color: 0xcfd8ff, speed: 2.4, phase: 2.6 },
      { n: 190, size: 1.3, color: 0xfff0d8, speed: 3.1, phase: 3.9 },
    ];
    for (const L of STAR_LAYERS) {
      const n = L.n;
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
      const mat = new THREE.PointsMaterial({ color: L.color, size: L.size,
        sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      grp.add(pts);
      st.stars.push({ mat, phase: L.phase, speed: L.speed });
    }
    // slow low-poly clouds — solid flat-shaded geometry (see makeLowpolyCloud),
    // drifting across the sky. Opaque, so no soft-gradient dither speckle.
    for (let i = 0; i < 7; i++) {
      const { group: sp, mat: m } = makeLowpolyCloud();
      const sc = 3.4 + Math.random() * 2.2;
      sp.scale.set(sc * (1 + Math.random() * 0.25), sc, sc);
      sp.position.set((Math.random() - 0.5) * 3200, 620 + Math.random() * 360, (Math.random() - 0.5) * 3200);
      grp.add(sp);
      st.clouds.push({ sp, m, speed: 6 + Math.random() * 9 });
    }
    scene.add(grp);
    st.skyGroup = grp;
    // moon halo, parented to the moon so it migrates with it
    if (moonMesh && !st.moonGlow) {
      const mg = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex('rgba(220,232,255,0.9)', 8), transparent: true, opacity: 0, depthWrite: false, fog: false }));
      mg.scale.set(340, 340, 1);
      moonMesh.add(mg);
      st.moonGlow = mg;
      // Dark wisps that drift across the moon's face and dim it — "clouds
      // crossing the moon." Parented to the moon so they follow it; depthTest
      // off so they always draw over its face.
      st.moonClouds = [];
      const mcTex = softTex('rgba(255,255,255,0.8)', 24);
      for (let i = 0; i < 2; i++) {
        const m = new THREE.SpriteMaterial({ map: mcTex, color: 0x242236, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false });
        const sp = new THREE.Sprite(m); sp.scale.set(300, 120, 1);
        sp.position.set(-320 + i * 480, 15 - i * 30, 0);
        moonMesh.add(sp);
        st.moonClouds.push({ sp, m, speed: 30 + i * 14 });
      }
    }
    st.shootTex = softTex('rgba(210,230,255,0.95)', 3); // shooting-star streak
  }

  // ── fireflies: per-scene clusters, alive at night ─────────────────────
  function addFireflies(scene, anchors, perAnchor) {
    // Mobile night-fill pass: fireflies are additive Points with size
    // attenuation, so looking straight at a cluster balloons each one to fill
    // the screen and they stack transparent overdraw (profiled: a town firefly
    // cluster dropped the phone to ~11fps). On touch devices, thin the swarm and
    // pin a small FIXED pixel size (no attenuation) so a near cluster can't
    // explode the fill. Desktop keeps the full, size-attenuated swarm.
    const _mob = typeof MOBILE_UI !== 'undefined' && MOBILE_UI;
    if (_mob) perAnchor = Math.min(perAnchor, 8);
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
    const mat = new THREE.PointsMaterial({ color: 0xd8ffa0, size: _mob ? 4 : 5.5, sizeAttenuation: !_mob, transparent: true,
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
      // stronger swing + per-layer speed → a lively, start-screen-style twinkle
      s2.mat.opacity = night * Math.max(0, 0.6 + Math.sin(t * (s2.speed || 1.3) + s2.phase) * 0.4);
    }
    for (const c of st.clouds) {
      c.sp.position.x += c.speed * (1 / 60);
      if (c.sp.position.x > 2400) c.sp.position.x = -2400;
      // Opaque geometry, so tint instead of fade: bright white by day, dusky
      // blue-grey at night so the clouds recede into the dark sky.
      c.m.color.setHSL(0.62, 0.12 * (1 - lightAmount), 0.34 + lightAmount * 0.6);
      c.m.emissiveIntensity = 0.18 + lightAmount * 0.3;
    }
    // moon clouds drift across the face; dim the halo when one covers it
    let _moonCover = 0;
    if (st.moonClouds) {
      for (const mc of st.moonClouds) {
        mc.sp.position.x += mc.speed * (1 / 60);
        if (mc.sp.position.x > 340) mc.sp.position.x = -340;
        mc.m.opacity = night * 0.72;
        _moonCover = Math.max(_moonCover, Math.max(0, 1 - Math.abs(mc.sp.position.x) / 170));
      }
    }
    if (st.moonGlow) st.moonGlow.material.opacity = night * 0.5 * (1 - 0.55 * _moonCover);
    // ✦ shooting stars — occasional streaks across the deep night sky
    if (!st.shooters) st.shooters = [];
    if (night > 0.5 && st.skyGroup && st.shootTex && st.shooters.length < 2 && Math.random() < 0.006) {
      const dir = Math.random() < 0.5 ? 1 : -1, ang = Math.PI * (0.14 + Math.random() * 0.2);
      const m = new THREE.SpriteMaterial({ map: st.shootTex, color: 0xe6f0ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
      m.rotation = -ang * dir;
      const sp = new THREE.Sprite(m); sp.scale.set(230, 7, 1);
      sp.position.set((Math.random() - 0.5) * 2400, 760 + Math.random() * 640, -600 - Math.random() * 700);
      sp.userData = { vx: Math.cos(ang) * dir * 48, vy: -Math.sin(ang) * 48, life: 1 };
      st.skyGroup.add(sp); st.shooters.push(sp);
    }
    for (let i = st.shooters.length - 1; i >= 0; i--) {
      const sp = st.shooters[i], u = sp.userData;
      sp.position.x += u.vx; sp.position.y += u.vy; u.life -= 0.022;
      sp.material.opacity = Math.max(0, Math.sin(Math.max(0, u.life) * Math.PI)) * night;
      if (u.life <= 0) { st.skyGroup.remove(sp); st.shooters.splice(i, 1); }
    }
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

  // near=6 (not 1): the 4000-unit far plane over a near of 1 starved the depth
  // buffer, so coplanar building faces z-fought and the edges crawled/saw-toothed
  // as the camera turned. A near of 6 is safe in third-person (the camera never
  // sits within 6 units of town geometry) and multiplies depth precision ~6×.
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 6, 4000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  GFX.initRenderer();

  outdoorAmbient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(outdoorAmbient);
  // One hemisphere light = the whole village catches a warm, torch-coloured
  // bounce from below (amber ground) under a cool violet sky — the night's
  // "lit by firelight" feel without a crowd of point lights to render. The
  // day/night grade (day-night.js) fades its warmth in with the dark and
  // recolours it for blood-moon and Hagstone nights.
  outdoorHemi = new THREE.HemisphereLight(0x3a3a6e, 0x7a4a22, 0.0);
  scene.add(outdoorHemi);
  outdoorSun = new THREE.DirectionalLight(0xffe2b8, 0.9); // low amber sun — perpetual witch-hour light
  outdoorSun.position.set(400, 600, 300);
  scene.add(outdoorSun);

  // Moon: a separate, dimmer/cooler light plus a visible glowing sprite in
  // the sky, both only really active at night — see updateDayNightCycle().
  outdoorMoonLight = new THREE.DirectionalLight(0xcfd9ff, 0);
  outdoorMoonLight.position.set(-400, 500, -300);
  scene.add(outdoorMoonLight);

  // The moon shows its real phase: a lit sphere with a soft terminator. The
  // "direction to the sun" is built per-frame IN THE SHADER from the actual
  // camera→moon axis (not a fixed screen direction), so the phase is correct no
  // matter where the moon sits in view or how the camera is turned. uTheta is
  // the phase angle (0 = full, π = new) and uDir the waxing(+1)/waning(−1) side.
  // uLit carries the night's colour (pale / blood-red / Hagstone-violet); the
  // dark limb keeps a faint earthshine so the disc is still findable.
  const moonMat = new THREE.ShaderMaterial({
    uniforms: {
      uLit: { value: new THREE.Color(0xeaf2ff) },
      uDark: { value: new THREE.Color(0x121526) },
      uTheta: { value: 0 },
      uDir: { value: 1 },
      uOpacity: { value: 0 },
    },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: `
      uniform float uTheta; uniform float uDir;
      varying vec3 vN;
      varying vec3 vSun;
      void main() {
        vN = normalize(normalMatrix * normal);           // surface normal in view space
        vec3 Mv = (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; // moon centre in view space
        vec3 d = normalize(Mv);                          // camera→moon axis
        vec3 right = normalize(cross(d, vec3(0.0, 1.0, 0.0))); // moon's screen-right, perp to d
        // dirToSun: -d at full (lit face toward camera), swings to +d at new,
        // crossing the right/left limb at the quarters.
        vSun = normalize(-cos(uTheta) * d + sin(uTheta) * uDir * right);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uLit; uniform vec3 uDark; uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vSun;
      void main() {
        float d = dot(normalize(vN), normalize(vSun));
        float lit = smoothstep(-0.07, 0.10, d); // soft terminator
        vec3 col = mix(uDark, uLit, lit);
        float a = uOpacity * mix(0.14, 1.0, lit); // faint earthshine on the dark limb
        gl_FragColor = vec4(col, a);
      }`,
  });
  moonMesh = new THREE.Mesh(new THREE.SphereGeometry(130, 32, 32), moonMat);
  scene.add(moonMesh);

  // A visible daytime sun to match the moon: a warm glowing disc with an
  // additive corona. updateDayNightCycle() arcs it across the sky (anchored to
  // the camera's sky-dome) and fades it with the daylight.
  sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(150, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, fog: false })
  );
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xffd982, transparent: true, opacity: 0,
    depthWrite: false, fog: false, blending: THREE.AdditiveBlending
  }));
  sunGlow.scale.set(820, 820, 1);
  sunMesh.add(sunGlow);
  sunMesh.userData.glow = sunGlow;
  scene.add(sunMesh);

  // ── Hex-tile floor ─ the whole town is carpeted with KayKit medieval hex
  // tiles instead of the old flat moor plane. One InstancedMesh carries every
  // tile (a single draw call for the entire ground, so it stays light on
  // mobile / the 2 GB box). Each tile's top face is modelled at y=0, so the
  // buildings, trees and props already placed at y=0 sit flush on it. A
  // dark-moss tint tames KayKit's bright lime into the witch-town's mood.
  // A plain dark plane sits just below as a backstop (covers the horizon beyond
  // the carpet, and any gap if the tiles somehow fail to load).
  {
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(w.width + 2400, w.height + 2400),
      new THREE.MeshLambertMaterial({ color: 0x3b4233 })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(w.width / 2, -6, w.height / 2);
    scene.add(base);
  }
  // Build the hex-tile floor + road network in a retryable closure. On a warm
  // load the ~19MB of KayKit tile models are already cached, so this runs now.
  // On a cold HARD REFRESH the init packet can beat the tiles to the client, so
  // initScene would run with no tiles and skip the floor FOREVER (leaving only
  // the dark backstop plane) — the bug behind "hard refresh never loads the new
  // ground". So we also retry once the KayKit asset batch settles.
  let hexFloorBuilt = false;
  const floorScene = scene; // capture the town scene; `scene` may be swapped later
  const buildHexFloor = () => {
    if (hexFloorBuilt || !(KK.settled && KK.has('tile_grass'))) return;
    hexFloorBuilt = true;
    const scene = floorScene;
    // Pointy-top hex grid in axial (q,r) coords. One model unit = S world units.
    const S = 100, HW = 2.0 * S, ROW = 0.75 * 2.309 * S; // col spacing 200, row 173.2
    const axToWorld = (q, r) => ({ x: HW * (q + r / 2), z: ROW * r });
    function axRound(q, r) { // cube rounding of fractional axial
      let x = q, z = r, y = -x - z, rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
      return [rx, rz];
    }
    const worldToAx = (x, z) => { const r = z / ROW; return axRound(x / HW - r / 2, r); };
    const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]; // edge e (60e°) → neighbour
    const key = (q, r) => q + ',' + r;

    // Route a spoke of hexes from the spawn hub to each building's door, and
    // record which edges each road hex connects to its neighbours on the path.
    const hub = worldToAx(w.spawn.x, w.spawn.y);
    const roadEdges = new Map(), roadQR = new Map();
    function mark(a, b) {
      let e = -1;
      for (let i = 0; i < 6; i++) if (a[0] + NB[i][0] === b[0] && a[1] + NB[i][1] === b[1]) { e = i; break; }
      if (e < 0) return;
      for (const [h, ed] of [[a, e], [b, (e + 3) % 6]]) {
        const k = key(h[0], h[1]);
        if (!roadEdges.has(k)) { roadEdges.set(k, new Set()); roadQR.set(k, h); }
        roadEdges.get(k).add(ed);
      }
    }
    function hexLine(a, b) { // adjacent-step path via cube lerp
      const ay = -a[0] - a[1], by = -b[0] - b[1];
      const N = Math.max(Math.abs(a[0] - b[0]), Math.abs(ay - by), Math.abs(a[1] - b[1]));
      const out = [];
      for (let i = 0; i <= N; i++) { const t = N ? i / N : 0; out.push(axRound(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); }
      return out;
    }
    const DOOR_OUT = { east: [1, 0], west: [-1, 0], north: [0, -1], south: [0, 1] };
    for (const b of w.buildings) {
      const dp = getDoorWorldPos(b), n = DOOR_OUT[getDoorSide(b)] || [0, 1];
      let door = worldToAx(dp.x, dp.y);
      // The door point lands on the footprint edge, so its hex can sit UNDER the
      // building — the road tile there is hidden by the mesh, so the path looks
      // like it stops short or veers aside. Step the target outward along the
      // door normal until the hex centre clears the footprint: that hex is where
      // a player actually stands at the door, so the road ends right at it.
      for (let g = 0; g < 4; g++) {
        const c = axToWorld(door[0], door[1]);
        if (!(c.x > b.x && c.x < b.x + b.w && c.z > b.y && c.z < b.y + b.h)) break;
        let best = 0, bestDot = -Infinity;
        for (let i = 0; i < 6; i++) {
          const cc = axToWorld(door[0] + NB[i][0], door[1] + NB[i][1]);
          const dx = cc.x - c.x, dz = cc.z - c.z, L = Math.hypot(dx, dz) || 1;
          const d = (dx / L) * n[0] + (dz / L) * n[1];
          if (d > bestDot) { bestDot = d; best = i; }
        }
        door = [door[0] + NB[best][0], door[1] + NB[best][1]];
      }
      const line = hexLine(hub, door);
      for (let i = 0; i < line.length - 1; i++) mark(line[i], line[i + 1]);
      // The terminus would otherwise be a dead-end stub whose road graphic runs
      // only from the hex centre back toward the approach. Add a spur pointing at
      // the actual DOOR POINT so the road turns toward the threshold. (Aiming at
      // -n — the building centre — sent the stub into the wall when the door sat
      // off to one side of the terminus hex, e.g. the arcade's east door, whose
      // hex rounds to the building's NE corner with the door ~106u south.)
      const tc = axToWorld(door[0], door[1]);
      const ddx = dp.x - tc.x, ddz = dp.y - tc.z, dL = Math.hypot(ddx, ddz) || 1;
      let be = 0, bd = -Infinity;
      for (let i = 0; i < 6; i++) {
        const cc = axToWorld(door[0] + NB[i][0], door[1] + NB[i][1]);
        const dx = cc.x - tc.x, dz = cc.z - tc.z, L = Math.hypot(dx, dz) || 1;
        const d = (dx / L) * (ddx / dL) + (dz / L) * (ddz / dL);
        if (d > bd) { bd = d; be = i; }
      }
      const tkey = key(door[0], door[1]);
      if (!roadEdges.has(tkey)) { roadEdges.set(tkey, new Set()); roadQR.set(tkey, door); }
      roadEdges.get(tkey).add(be);
    }

    // Base edge-set of each road tile (from pixel-sampling the atlas), and a
    // picker: find [tileKey, k] whose base set rotated by k (rotation.y = +60k
    // maps base edge e → e-k) matches the hex's required edge mask exactly.
    const ROAD = {
      tile_road_a: [0, 3], tile_road_b: [3, 5], tile_road_c: [3, 4], tile_road_d: [1, 3, 5],
      tile_road_e: [0, 3, 5], tile_road_f: [0, 1, 3], tile_road_g: [2, 3, 4], tile_road_h: [0, 2, 3, 4],
      tile_road_i: [1, 2, 4, 5], tile_road_j: [0, 1, 2, 3], tile_road_k: [1, 2, 3, 4, 5],
      tile_road_l: [0, 1, 2, 3, 4, 5], tile_road_m: [3]
    };
    function pickTile(mask) {
      const want = [...mask].sort((p, n) => p - n).join(',');
      for (const [tk, base] of Object.entries(ROAD)) {
        for (let k = 0; k < 6; k++) {
          if (base.map((e) => (e - k + 6) % 6).sort((p, n) => p - n).join(',') === want) return [tk, k];
        }
      }
      return null;
    }
    const meshOf = (tk, tint) => { // clone a tile's geometry+material once
      let g = null, m = null;
      KK.models[tk].scene.traverse((ch) => { if (ch.isMesh && !g) { g = ch.geometry; m = ch.material; } });
      return g ? [g.clone(), (m = m.clone(), m.color = new THREE.Color(tint), m)] : null;
    };

    // Carpet the whole map: grass everywhere, a road tile where the network runs.
    const grassGM = meshOf('tile_grass', 0x76805a);
    const grassM = [], roadGM = {}, roadM = {};
    // A small pond on the east tree line — a disc of hexes verified (offline sim)
    // clear of the road network and every building footprint. Cosmetic for now:
    // walkable, no shoreline/collision yet (a follow-up pass with hex_coast tiles
    // + pond colliders is planned).
    const WATER = new Set(['10,7', '11,7', '10,8', '9,8', '9,7', '10,6', '11,6']);
    const waterGM = meshOf('tile_water', 0x8fb0c4);
    const waterM = [];
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), yUp = new THREE.Vector3(0, 1, 0), scl = new THREE.Vector3(S, S, S), pos = new THREE.Vector3();
    for (let r = -4; r <= 17; r++) {
      for (let q = Math.floor(-2 - r / 2); q <= Math.ceil(18 - r / 2); q++) {
        const k = key(q, r), wld = axToWorld(q, r);
        pos.set(wld.x, 0, wld.z);
        if (WATER.has(k) && waterGM) { qt.identity(); m4.compose(pos, qt, scl); waterM.push(m4.clone()); continue; }
        const pick = roadEdges.has(k) ? pickTile(roadEdges.get(k)) : null;
        if (pick && KK.has(pick[0])) {
          const [tk, kRot] = pick;
          if (!roadGM[tk]) { roadGM[tk] = meshOf(tk, 0x9a8f63); roadM[tk] = []; } // warm earth road
          if (roadGM[tk]) { qt.setFromAxisAngle(yUp, (Math.PI / 3) * kRot); m4.compose(pos, qt, scl); roadM[tk].push(m4.clone()); continue; }
        }
        qt.identity(); m4.compose(pos, qt, scl); grassM.push(m4.clone());
      }
    }
    const addInst = (gm, mats) => { if (!gm || !mats.length) return; const im = new THREE.InstancedMesh(gm[0], gm[1], mats.length); im.frustumCulled = false; for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]); im.instanceMatrix.needsUpdate = true; scene.add(im); };
    addInst(grassGM, grassM);
    addInst(waterGM, waterM);
    // A few KayKit waterlilies floating on the pond for life/detail. Placed on
    // chosen water hexes with a small in-hex offset; sized via staticInstance so
    // they read as lily pads, not tiles. Pure scenery (no collider).
    const LILIES = [['11,7', 'lily_a', 42, -20], ['9,8', 'lily_b', -34, 28], ['10,6', 'lily_a', 10, 40], ['10,8', 'lily_b', 30, 24]];
    for (const [hk, lk, ox, oz] of LILIES) {
      if (!WATER.has(hk) || !KK.has(lk)) continue;
      const [lq, lr] = hk.split(',').map(Number), lc = axToWorld(lq, lr);
      const g = KK.staticInstance(lk, 46, 'fit');
      if (!g) continue;
      g.position.set(lc.x + ox, 1.5, lc.z + oz);
      g.rotation.y = Math.random() * Math.PI * 2;
      scene.add(g);
    }
    for (const tk of Object.keys(roadM)) addInst(roadGM[tk], roadM[tk]);
  };
  buildHexFloor(); // warm load: tiles already cached → build immediately
  if (!hexFloorBuilt && KK) {
    if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(buildHexFloor).catch(() => {});
    if (KK.onAssetLoad) KK.onAssetLoad(buildHexFloor); // fires as each asset settles
  }

  // Same cold-hard-refresh race as the floor: buildBuildingMesh asks KK for each
  // building's model (bld_*, all in the gating set), and on a cold load those
  // haven't arrived when initScene runs — so every building fell back to the
  // plain procedural box and never upgraded. Build once KK has settled (warm:
  // immediately; cold: when the gated batch lands), so the KayKit buildings show.
  // Town collision is refit to the KayKit models and snapshotted into TOWN_WALLS
  // at the end of initScene. But buildings AND decor are now deferred to KK-settle
  // (below), so on a cold load neither has happened by then: the refit ran against
  // empty model boxes and left the full data-rect walls standing beyond the
  // smaller models — invisible walls. Re-finalize collision once BOTH deferred
  // builds are done, whichever finishes last (no-op on a warm load, where the
  // end-of-initScene refit already ran with everything in place).
  let townBuilt = false, decorBuilt = false, collisionFinalized = false;
  const finalizeTownCollision = () => {
    if (collisionFinalized || !townBuilt || !decorBuilt) return;
    collisionFinalized = true;
    refitBuildingColliders(); // re-cut building walls to the now-placed model boxes
    TOWN_WALLS = walls;        // re-snapshot so swapToTownMap() restores the fit collision
  };
  const bldScene = scene; // capture the town scene; `scene` may be swapped later
  const buildTownBuildings = () => {
    if (townBuilt || !KK.settled) return;
    townBuilt = true;
    for (const b of w.buildings) bldScene.add(buildBuildingMesh(b, w));
    finalizeTownCollision();
  };
  buildTownBuildings();
  if (!townBuilt && KK) {
    if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(buildTownBuildings).catch(() => {});
    if (KK.onAssetLoad) KK.onAssetLoad(buildTownBuildings);
  }

  // Trees/bushes/rocks use gated KayKit models (makeKayLeafTree/Bush/Rock), so
  // on a cold hard refresh they fell back to the plain procedural cones and
  // never upgraded. addNatureDecor also registers colliders + harvestables, so
  // re-running it would duplicate — instead defer the single call until KK has
  // settled (warm: now; cold: when the gated batch lands), same as floor/buildings.
  const decorScene = scene;
  const buildDecor = () => {
    if (decorBuilt || !KK.settled) return;
    decorBuilt = true;
    addNatureDecor(decorScene, w, decorVisuals);
    finalizeTownCollision();
  };
  buildDecor();
  if (!decorBuilt && KK) {
    if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(buildDecor).catch(() => {});
    if (KK.onAssetLoad) KK.onAssetLoad(buildDecor);
  }

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
  const templeCx = TEMPLE_PLATFORM_X, templeCz = TEMPLE_PLATFORM_Z;
  scene.add(buildTownTemple(templeCx, templeCz));
  const altarW = 64, altarD = 64;
  walls.push({ x: templeCx - altarW / 2, y: templeCz - altarD / 2, w: altarW, h: altarD });
  // The KayKit shrine backdrop sits toward the platform's back (cz + 72 in
  // buildTownTemple) — block it so players can't walk through the model.
  walls.push({ x: templeCx - 49, y: (templeCz + 72) - 55, w: 98, h: 110 });

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
  refitBuildingColliders(); // tighten building colliders to their placed KayKit models (no "invisible walls")
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
// now active, swapping world/walls to match) so the
// 'defeated' handler can reuse just that half without also re-sending a
// redundant move or popping a second "you stepped through the portal"
// toast on top of the defeat one.
// ---------------------------------------------------------------------------
function swapToWildsMap() {
  if (!wildsScene && world2) {
    try {
      buildWildsScene(world2); applyDrawDistanceTier(GFX.quality); // lazy: built on first entry, not at boot
      // If the KayKit models hadn't all streamed in yet — e.g. a reload/resume
      // straight into the Wilds on a cold load — this build used placeholder
      // NPCs (a procedural Artificer, no Lexton) and skipped the KayKit
      // buildings (kkPlace returns null before load). Upgrade to the full scene
      // once the models settle.
      if (!KK.fullyLoaded) scheduleWildsUpgrade();
    } catch (e) { console.error('buildWildsScene failed:', e); }
  }
  if (!wildsScene || !world2 || activeScene === wildsScene) return;
  for (const light of [outdoorAmbient, outdoorHemi, outdoorSun, outdoorMoonLight, moonMesh, sunMesh, outdoorSun.target, outdoorMoonLight.target, GFX.st.skyGroup].filter(Boolean)) {
    outdoorScene.remove(light);
    wildsScene.add(light);
  }
  world = world2;
  walls = WILDS_WALLS;
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  ensureManorExterior();                      // lazily add the Manor to the wilds scene
  applyManorInstanceState(mootInstanceActive); // ...but only show it inside your coven's world
  setActiveContext(wildsScene, wildsCamera, null);
}

function swapToTownMap() {
  if (!outdoorScene || !TOWN_WORLD || activeScene === outdoorScene) return;
  for (const light of [outdoorAmbient, outdoorHemi, outdoorSun, outdoorMoonLight, moonMesh, sunMesh, outdoorSun.target, outdoorMoonLight.target, GFX.st.skyGroup].filter(Boolean)) {
    if (wildsScene) wildsScene.remove(light); // wilds may be unbuilt (lazy) if never visited — nothing to remove
    outdoorScene.add(light);
  }
  world = TOWN_WORLD;
  walls = TOWN_WALLS;
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

// Portal transition cover: show an opaque "loading" screen INSTANTLY (so it
// fully hides the map swap / first-entry build — a heavy synchronous build
// would otherwise show through a mid-fade overlay), run the swap behind it,
// let the new scene paint a few frames, then fade the cover out. doSwap returns
// false to abort (e.g. a failed build) — then we uncover immediately.
function portalFade(text, doSwap) {
  if (typeof playSfx === 'function') playSfx('portal'); // all traversals (wilds/cave/ember/manor/vault) fade through here
  const ov = document.getElementById('portalFade');
  if (!ov) { doSwap(); return; }
  const label = document.getElementById('portalFadeText');
  if (label) label.textContent = text || '';
  ov.classList.remove('hidden');
  ov.style.transition = 'none';
  ov.style.opacity = '1';
  void ov.offsetWidth; // flush so the cover is painted opaque before the build
  requestAnimationFrame(() => requestAnimationFrame(() => {
    let ok = true;
    try { ok = doSwap() !== false; } catch (e) { ok = false; console.error('portal swap failed:', e); }
    setTimeout(() => {
      ov.style.transition = 'opacity 0.55s ease';
      ov.style.opacity = '0';
      setTimeout(() => { ov.classList.add('hidden'); ov.style.transition = ''; }, 600);
    }, ok ? 300 : 0); // let the revealed world render a few frames first
  }));
}

// Build the Wilds ahead of time during idle (after the town's assets settle),
// so the first trip through the portal is usually instant — the portal cover
// then just plays as a transition rather than hiding a build hitch.
let wildsPrebuildScheduled = false;
function prebuildWilds() {
  if (wildsScene || !world2 || !KK.settled) return;
  try {
    buildWildsScene(world2); applyDrawDistanceTier(GFX.quality);
    // Prebuild runs as soon as the GATING town settles, which is typically
    // before the character/NPC bodies finish streaming — so the Artificer,
    // Lexton and the Wilds quest NPCs would be baked as procedural stand-ins.
    // Upgrade once the whole manifest is in.
    if (!KK.fullyLoaded) scheduleWildsUpgrade();
  } catch (e) { console.error('Wilds pre-build failed:', e); }
}
function schedulePrebuildWilds() {
  if (wildsPrebuildScheduled || !world2) return;
  wildsPrebuildScheduled = true;
  const idle = () => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(prebuildWilds, { timeout: 7000 });
    else setTimeout(prebuildWilds, 4000);
  };
  if (KK.settled) idle();
  else if (KK.promise && typeof KK.promise.then === 'function') KK.promise.then(idle).catch(() => {});
  else setTimeout(idle, 5000);
}

// If the Wilds got built before the KayKit models finished streaming (a resume
// straight into the Wilds on a cold load), rebuild it once the models land so
// the Artificer, Lexton and the village buildings come in for real instead of
// their placeholders. buildWildsScene self-clears its collider/kiosk lists and
// its mob/animal pools, so the rebuild is clean; we just move the shared lights
// across and re-point the player if they're standing in it.
// 0 = idle, 1 = waiting for the models, 2 = done (rebuild fired once).
let wildsUpgradeState = 0;
function scheduleWildsUpgrade() {
  if (wildsUpgradeState !== 0) return;
  wildsUpgradeState = 1;
  const run = () => {
    // Wait for the WHOLE manifest, not just the gating town: the Artificer,
    // Lexton AND the Wilds quest/faction NPC bodies are character models that
    // stream in on the tail AFTER KK.settled, so KK.promise (which resolves at
    // gating-settle) is too early — a rebuild then would still bake procedural
    // stand-ins. onAssetLoad fires on every asset settle; this no-ops until the
    // last body lands, then rebuilds once.
    if (wildsUpgradeState !== 1 || !KK.fullyLoaded) return;
    wildsUpgradeState = 2;
    if (!wildsScene || !world2) return;
    const sharedLights = [outdoorAmbient, outdoorHemi, outdoorSun, outdoorMoonLight, moonMesh, sunMesh, outdoorSun.target, outdoorMoonLight.target, GFX.st.skyGroup].filter(Boolean);
    const wasActive = (activeScene === wildsScene);
    for (const light of sharedLights) wildsScene.remove(light); // free the shared lights from the stale scene
    manorExteriorGroup = null; // force ensureManorExterior to re-add to the fresh scene
    wildsScene = null;         // force a full rebuild on the next call
    try { buildWildsScene(world2); applyDrawDistanceTier(GFX.quality); } catch (e) { console.error('Wilds upgrade rebuild failed:', e); return; }
    if (wasActive && wildsScene) {
      for (const light of sharedLights) wildsScene.add(light);
      world = world2; walls = WILDS_WALLS; cameraYawOffset = 0; cameraPitchOffset = 0;
      ensureManorExterior();
      applyManorInstanceState(mootInstanceActive);
      setActiveContext(wildsScene, wildsCamera, null);
    }
  };
  if (KK.fullyLoaded) run();
  else if (KK.onAssetLoad) KK.onAssetLoad(run);
  else setTimeout(run, 4000);
}

function enterWilds() {
  if (!world2 || !me) return;
  portalFade('Stepping into the Wilds…', () => {
    swapToWildsMap(); // builds the Wilds on first entry (lazy; usually pre-built by now)
    if (activeScene !== wildsScene) return false; // build failed / not ready — don't half-enter
    // Face toward the actual Wilds (facing=Math.PI is -Y). Spawn sits near the
    // southern edge while the content clusters ~thousands of units north, so
    // facing -Y points the camera at the Wilds itself (see git history for the
    // old cameraYawOffset hack this replaced).
    me.facing = Math.PI;
    me.room = 'wilds';
    me.x = world2.spawn.x;
    me.y = world2.spawn.y;
    portalCooldownUntil = Date.now() + PORTAL_COOLDOWN_MS;
    ws.send(JSON.stringify({ type: 'move', x: me.x, y: me.y, room: me.room }));
    setUnlockToast('🌀 You step through the portal into the Wilds.');
    return true;
  });
}

function exitWilds() {
  if (!outdoorScene || !TOWN_WORLD || !me || !world2) return;
  portalFade('Returning to town…', () => {
    swapToTownMap();
    me.room = 'outside';
    // Land clear of the town-side portal kiosk — outside its 80-unit interact
    // radius, plus the traversal grace below.
    me.x = world2.portalInTown.x;
    me.y = world2.portalInTown.y + 115;
    portalCooldownUntil = Date.now() + PORTAL_COOLDOWN_MS;
    ws.send(JSON.stringify({ type: 'move', x: me.x, y: me.y, room: me.room }));
    setUnlockToast('🌀 You step back through the portal into town.');
    return true;
  });
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

// Drift the Manor's embers upward, wrapping back to the floor — only while the
// Manor is the active scene, so it costs nothing anywhere else.
// Drifting ember field for the Ember Wastes — rises and recentres on the camera
// so embers surround the player wherever they roam (a full-zone cloud would be
// mostly wasted beyond the fog). Same Points-with-velocity trick as the Manor.
function updateEmberAmbient(dt) {
  if (!emberAmbient || activeScene !== emberScene) return;
  const cam = emberCamera;
  const cx = cam ? cam.position.x : EMBER_WORLD.spawn.x;
  const cz = cam ? cam.position.z : EMBER_WORLD.spawn.y;
  const pos = emberAmbient.points.geometry.attributes.position;
  const a = pos.array, vel = emberAmbient.vel, RAD = emberAmbient.RAD, CEIL = emberAmbient.CEIL;
  for (let i = 0; i < vel.length; i++) {
    a[i * 3 + 1] += vel[i] * dt;
    const dx = a[i * 3] - cx, dz = a[i * 3 + 2] - cz;
    if (a[i * 3 + 1] > CEIL || dx > RAD || dx < -RAD || dz > RAD || dz < -RAD) {
      a[i * 3] = cx + (Math.random() - 0.5) * 2 * RAD;
      a[i * 3 + 1] = 2 + Math.random() * 60;
      a[i * 3 + 2] = cz + (Math.random() - 0.5) * 2 * RAD;
    }
  }
  pos.needsUpdate = true;
}

function updateManorEmbers(dt) {
  if (!manorEmbers || activeScene !== manorScene) return;
  const pos = manorEmbers.points.geometry.attributes.position;
  const a = pos.array, vel = manorEmbers.vel, H = manorEmbers.WALL_H;
  for (let i = 0; i < vel.length; i++) {
    a[i * 3 + 1] += vel[i] * dt;
    if (a[i * 3 + 1] > H) { a[i * 3 + 1] = 2; a[i * 3] = Math.random() * manorEmbers.W; a[i * 3 + 2] = Math.random() * manorEmbers.D; }
  }
  pos.needsUpdate = true;
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
  { id: 'npc_mara', name: 'Ranger Mara',    charId: 3, x: 1150, y: 1380 }, // own area: SW green, by the wood-line
  { id: 'npc_finn', name: 'Herbalist Finn', charId: 0, x:  880, y: 1160 }, // own area: the west-side garden
  { id: 'npc_dex',  name: 'Hunter Dex',     charId: 1, x: 1950, y:  340 }, // by the graveyard's south approach, clear of the wooded pocket's trees
  { id: 'npc_lyra', name: 'Scholar Lyra',   charId: 2, x: 2230, y: 1180 } // moved to the open east commons to declutter the spawn square
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
  KK, OUTDOOR_KIOSKS, TOWN_NPCS, createHumanoid: createStaticNpc, getDoorSide, getDoorWorldPos, kkPlace,
  makeNpcNameSprite, makePentacleTexture, makeSigilFloorTexture, makeSignSprite, makeWhiteStoneTexture,
  getMe: () => me,
  mobileLite: MOBILE_UI, // mobile GPU-fill pass: drop the clustered temple ambiance lights
  TEMPLE_TORCH_LIGHTS,
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

// KayKit bare/dead tree (Forest Nature Pack) for the Wilds & graveyards — a
// detailed leafless tree that suits the spooky mood far better than the old
// procedural cones. Picks a random variant and facing; falls back to the
// procedural tree if the models haven't finished loading yet.
const KAY_BARE_TREES = ['tree_bare1a', 'tree_bare1b', 'tree_bare1c', 'tree_bare2a', 'tree_bare2b', 'tree_bare2c'];
function makeKayTree(x, z) {
  const key = KAY_BARE_TREES[Math.floor(Math.random() * KAY_BARE_TREES.length)];
  const h = 72 + Math.random() * 46; // world-units tall, a little varied
  const g = KK.staticInstance(key, h, 'height');
  if (!g) return makeSpookyTree(x, z); // models not ready → procedural fallback
  g.rotation.y = Math.random() * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}

// KayKit leafy tree (Forest Nature Pack, eerie teal) for the TOWN's harvestable
// tree decor — a varied upgrade over the procedural makeTree. Returns null if
// the models aren't loaded yet so the caller falls back to makeTree; flagged
// userData.camFade so the chase-camera obstruction fader still ghosts it.
const KAY_LEAF_TREES = ['tree_leaf1', 'tree_leaf2', 'tree_leaf3', 'tree_leaf4'];
function makeKayLeafTree(x, z, scale) {
  const key = KAY_LEAF_TREES[Math.floor(Math.random() * KAY_LEAF_TREES.length)];
  const h = (72 + Math.random() * 30) * (scale || 1);
  const g = KK.staticInstance(key, h, 'height');
  if (!g) return null;
  g.rotation.y = Math.random() * Math.PI * 2;
  g.position.set(x, 0, z);
  g.userData.camFade = true;
  return g;
}

// KayKit bush (teal) for 'shrub' decor. Short ground cover — no camFade needed.
// Sized by max horizontal extent ('fit'). Null → caller falls back to makeShrub.
const KAY_BUSHES = ['bush1', 'bush2', 'bush3'];
function makeKayBush(x, z, scale) {
  const key = KAY_BUSHES[Math.floor(Math.random() * KAY_BUSHES.length)];
  const w = (26 + Math.random() * 12) * (scale || 1);
  const g = KK.staticInstance(key, w, 'fit');
  if (!g) return null;
  g.rotation.y = Math.random() * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}

// KayKit rock (grey) for 'rock' decor — pure scenery. Null → fallback to makeRock.
const KAY_ROCKS = ['rock1', 'rock2', 'rock3'];
function makeKayRock(x, z, scale) {
  const key = KAY_ROCKS[Math.floor(Math.random() * KAY_ROCKS.length)];
  const w = (22 + Math.random() * 14) * (scale || 1);
  const g = KK.staticInstance(key, w, 'fit');
  if (!g) return null;
  g.rotation.y = Math.random() * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}

// KayKit grass tuft (teal) — Wilds ground detail. Sized by HEIGHT so the thin
// blade variants don't balloon the way a horizontal 'fit' would. Short, so no
// camFade and no collision (walk-through). Null → caller skips it.
const KAY_GRASS = ['grass1', 'grass2', 'grass3', 'grass4'];
function makeKayGrass(x, z, scale) {
  const key = KAY_GRASS[Math.floor(Math.random() * KAY_GRASS.length)];
  const h = (20 + Math.random() * 14) * (scale || 1);
  const g = KK.staticInstance(key, h, 'height');
  if (!g) return null;
  g.rotation.y = Math.random() * Math.PI * 2;
  g.position.set(x, 0, z);
  return g;
}

// Collapse a crowd of identical KayKit decor props into ONE InstancedMesh per
// model (a single draw call for the whole scatter instead of one per prop),
// baking each prop's size, terrain height and random turn into its instance
// matrix. This is the GPU-over-CPU win for the Wilds ground detail: the hundreds
// of grass/rock/bush groups it used to add are the bulk of the map's draw calls.
// `placements` is [{x,z,size,roty}]; `mode` sizes it like KK.staticInstance
// ('height' or 'fit'). A null model (not streamed) just adds nothing.
function addInstancedDecor(scene, key, mode, placements) {
  if (!placements || !placements.length || !KK.has(key)) return 0;
  const unit = KK.staticInstance(key, 1, mode); // size-1 reference, base at y=0
  if (!unit) return 0;
  unit.updateMatrixWorld(true);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), yUp = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  let made = 0;
  unit.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld); // bake the unit scale + local offset: prop now sits at size 1, base y=0
    const im = new THREE.InstancedMesh(geo, o.material, placements.length);
    im.frustumCulled = false; // one big object spanning the map — never cull it whole
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      q.setFromAxisAngle(yUp, p.roty || 0);
      pos.set(p.x, (typeof wildsHeightAt === 'function' ? wildsHeightAt(p.x, p.z) : 0), p.z);
      scl.set(p.size, p.size, p.size);
      m4.compose(pos, q, scl);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
    made++;
  });
  return made;
}

// Wilds ground-detail scatter — grass tufts (in clusters), scattered rocks and
// low bushes across the walkable moor, lifted onto the rolling terrain. All
// pure scenery (walk-through, no colliders) and deterministic so every client
// sees the same floor. Keeps spawn and the campfires clear. Emitted as one
// InstancedMesh per model (see addInstancedDecor) rather than ~300 separate
// prop groups — same look, a fraction of the draw calls.
function kkWildsGroundDetail(scene, w2) {
  if (!KK.settled) return;
  let seed = 0x9e3779b1 >>> 0;
  const rand = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = (a, b) => a + rand() * (b - a);
  const W2 = w2.width || 10000, H2 = w2.height || 10000;
  const keepClear = [{ x: w2.spawn.x, y: w2.spawn.y, r: 300 }, { x: 5000, y: 3000, r: 560 }, ...WILDS_CAMPFIRES.map((f) => ({ x: f.x, y: f.y, r: 110 }))];
  const clearOf = (x, z) => keepClear.every((c) => Math.hypot(x - c.x, z - c.y) > c.r);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  // Gather placements per model key, then emit one InstancedMesh each.
  const place = {}; // key -> [{x,z,size,roty}]
  const push = (key, x, z, size) => { (place[key] || (place[key] = [])).push({ x, z, size, roty: rand() * Math.PI * 2 }); };
  // Grass in clusters (reads as patches of undergrowth rather than even stubble); sized by HEIGHT.
  for (let c = 0; c < 22; c++) {
    const cx = rng(300, W2 - 300), cz = rng(300, H2 - 300);
    if (!clearOf(cx, cz)) continue;
    const n = 6 + Math.floor(rand() * 7);
    for (let i = 0; i < n; i++) push(pick(KAY_GRASS), cx + rng(-90, 90), cz + rng(-90, 90), (20 + rand() * 14) * (0.8 + rand() * 0.6));
  }
  // Scattered boulders; sized by FIT.
  for (let i = 0; i < 44; i++) {
    const x = rng(300, W2 - 300), z = rng(300, H2 - 300);
    if (clearOf(x, z)) push(pick(KAY_ROCKS), x, z, (22 + rand() * 14) * (0.9 + rand() * 1.0));
  }
  // Scattered low bushes; sized by FIT.
  for (let i = 0; i < 34; i++) {
    const x = rng(300, W2 - 300), z = rng(300, H2 - 300);
    if (clearOf(x, z)) push(pick(KAY_BUSHES), x, z, (26 + rand() * 12) * (0.9 + rand() * 0.6));
  }
  const grassKeys = new Set(KAY_GRASS);
  for (const key in place) addInstancedDecor(scene, key, grassKeys.has(key) ? 'height' : 'fit', place[key]);
}

function makeGravestone(x, z) {
  // KayKit headstone (Halloween props) — varied; procedural stone below is the
  // fallback if the models haven't streamed in.
  const kk = (KK && KK.staticInstance)
    ? KK.staticInstance(Math.random() < 0.5 ? 'prop_grave_a' : 'prop_grave_b', 26 + Math.random() * 12, 'height')
    : null;
  if (kk) { kk.rotation.y = (Math.random() - 0.5) * 0.7; kk.position.set(x, 0, z); return kk; }
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
  // KayKit crypt — a grand graveyard tomb, replacing the old crude notched
  // wall. Procedural ruined wall below is the fallback.
  const kk = (KK && KK.staticInstance) ? KK.staticInstance('prop_crypt', 88 + Math.random() * 30, 'fit') : null;
  if (kk) { kk.rotation.y = Math.random() * Math.PI * 2; kk.position.set(x, 0, z); kk.userData.camFade = true; return kk; }
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
  // Everything added here is organic scatter (spooky trees, gravestones, bone
  // piles, ruined walls), so lift each piece onto the rolling terrain by
  // wrapping scene.add — the makers position their group at (x, 0, z), so its
  // own x/z sample the heightfield.
  const rawScene = scene;
  scene = { add: (o) => { if (o && o.position) o.position.y += wildsHeightAt(o.position.x, o.position.z); rawScene.add(o); } };
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
  // Trimmed from 150: these are pure scenery (no server decor entry, so they
  // can't be harvested). We lean on the server's harvestable deadwood flora
  // for most of the standalone dead trees now, so a dead tree you walk up to
  // is usually one you can actually chop. Graveyard spooky trees (below) stay
  // for atmosphere.
  for (let i = 0; i < 85; i++) {
    const x = rng(300, w2.width - 300), z = rng(300, w2.height - 300);
    if (!clearOf(x, z)) continue;
    scene.add(makeKayTree(x, z));
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
      scene.add(makeKayTree(x, z));
      wildsCollide(x, z, 9);
    }
    // …and the remains of whatever visits graveyards at night
    for (let i = 0; i < 2; i++) {
      scene.add(makeBonePile(cx + rng(-170, 170), cz + rng(-170, 170)));
    }
  }
  // Crypt grounds — clusters of KayKit tombs (makeRuinedWall builds a crypt).
  // Placed on a jittered ring so the tombs stand apart as a graveyard rather
  // than clipping into one another (they used to scatter within ±170 and
  // overlap). Each tomb is ~120 wide, so a ~300-radius ring keeps them clear.
  for (const [cx, cz] of [[3000,5000],[7000,7000],[1500,4000],[8500,2000],[4200,6600],[8600,5200]]) {
    const n = 3, R = 300;
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const ang = a0 + (i / n) * Math.PI * 2;
      const x = cx + Math.cos(ang) * (R + rng(-40, 40)), z = cz + Math.sin(ang) * (R + rng(-40, 40));
      scene.add(makeRuinedWall(x, z));
      wildsCollide(x, z, 30); // solid tomb — bigger than the old wall
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
  makeSignSprite, makeNpcNameSprite, createHumanoid: createStaticNpc, CAVE_WORLD,
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
// The Ember Refuge — a warm shelter standing on the ember flat (at
// EMBER_REFUGE_SPOT, drawn by ember-scene.js), whose door is a private,
// occupants-only chat room for players who missed the portal back. Same
// "indoor sub-room" architecture as the Vault: own scene/camera/bounds, mode
// stays 'outdoor' so the building-interior logic never mistakes it for a town
// building. Kept in sync with the server's EMBER_REFUGE_DIMS/SPAWN.
// ---------------------------------------------------------------------------
let refugeScene, refugeCamera;
const REFUGE_WORLD = { width: 760, height: 620, buildings: [], spawn: { x: 380, y: 540 } };
const REFUGE_KIOSKS = [
  { x: 380, z: 600, portal: 'refuge_exit' }
];
const { buildRefugeScene } = createRefugeScene({
  makeStoneTexture, makeWoodSidingTexture, makeSignSprite, REFUGE_WORLD,
  setRefugeScene: (s) => { refugeScene = s; },
  setRefugeCamera: (c) => { refugeCamera = c; },
});

// ---------------------------------------------------------------------------
// The Coven Manor — an 8-bedroom hall in a coven's PRIVATE world (reached from
// the Wilds once you've stepped through the Moot Stone). Same "indoor sub-room"
// architecture as the Vault: its own scene/camera/bounds, mode stays 'outdoor'
// the whole time so none of the building-interior logic mistakes it for a town
// building. Entry is server-gated to your own coven instance; bedrooms are
// claimed per member (manor_claim_bedroom) and shown as doorplates over each
// bed. MANOR_WORLD + the authoritative MANOR_BED_SPOTS layout live here so the
// rendered beds and the claim kiosks can never drift apart.
// ---------------------------------------------------------------------------
let manorScene, manorCamera;
let manorEmbers = null;                                   // { points, vel, W, D, WALL_H } — ticked in the render loop
const MANOR_WORLD = { width: 1120, height: 1120, buildings: [], spawn: { x: 560, y: 1040 } };
// slot -> { x, y, rot }. 4 along the north wall, 2 each on the east/west walls.
// Beds hug the walls (fixed ~86u offset) and spread along the now-doubled hall,
// so the big central floor stays open to move around in.
const MANOR_BED_SPOTS = [
  { x: 190, y: 86,  rot: 0 },               // 0  N
  { x: 435, y: 86,  rot: 0 },               // 1  N
  { x: 685, y: 86,  rot: 0 },               // 2  N
  { x: 930, y: 86,  rot: 0 },               // 3  N
  { x: 1034, y: 400, rot: -Math.PI / 2 },   // 4  E
  { x: 1034, y: 720, rot: -Math.PI / 2 },   // 5  E
  { x: 86,   y: 400, rot: Math.PI / 2 },    // 6  W
  { x: 86,   y: 720, rot: Math.PI / 2 },    // 7  W
];
// Exit sits at the south door; one claim kiosk per bed (manorBed = slot).
const MANOR_KIOSKS = [
  { x: MANOR_WORLD.width / 2, z: MANOR_WORLD.height - 24, portal: 'manor_exit' },
  { x: MANOR_WORLD.width / 2, z: MANOR_WORLD.height / 2, npc: 'seance' }, // the séance board on the centre rug
  ...MANOR_BED_SPOTS.map((s, i) => ({ x: s.x, z: s.y, manorBed: i })),
];
let manorBedState = {};        // slot -> { key, name } | null, from the server
let manorYours = null;         // which slot is mine (null = none)
const manorBedplates = [];     // slot -> THREE.Sprite (doorplate), rebuilt on state change
let manorAltars = {};          // slot -> [ALTAR_SLOTS] deco ids|null, every claimed altar
let manorYourUnlocks = {};     // decoId -> true, which premium pieces I've unlocked

// ── Player housing (slice 2): the cottage interior ──────────────────────────
// A cozy instanced one-room cottage that renders the furniture you place in the
// Home grid editor (slice 1). The shell is built by cottage-scene.js; the
// furniture is placed here (renderCottageFurniture), since this is where the
// KayKit loader + the catalog→prop map live. COTTAGE_CELL/ORIGIN mirror the
// server's placement maths exactly so a piece sits in the same spot in the 2D
// editor and the 3D room.
let cottageScene, cottageCamera;
let lastCottageLayout = null;       // the most recent {grid,pieces,catalog} we rendered
const cottagePlacedProps = [];      // THREE objects we've placed, cleared on each refresh
let cottageWalls = [];              // {x,y,w,h} collider rects for solid furniture (x,y in world x/z)
// Furniture you can walk through: flat floor coverings and wall-mounted pieces.
const COTTAGE_NONSOLID = new Set(['rug', 'wall_charm']);
const COTTAGE_WORLD = { width: 1140, height: 1140, buildings: [], spawn: { x: 570, y: 1070 } };
const COTTAGE_CELL = 120;           // world units per grid cell
const COTTAGE_ORIGIN = 90;          // the grid's top-left inset from the wall
const COTTAGE_CAM = { back: 150, height: 155, lookUp: 36 };
const COTTAGE_KIOSKS = [
  { x: COTTAGE_WORLD.width / 2, z: COTTAGE_WORLD.height - 26, portal: 'cottage_exit' },
];
// Grid cell (cx,cy) → world centre of that cell.
function cottageCellCentre(cx, cy) {
  return { x: COTTAGE_ORIGIN + cx * COTTAGE_CELL + COTTAGE_CELL / 2, z: COTTAGE_ORIGIN + cy * COTTAGE_CELL + COTTAGE_CELL / 2 };
}

// ── Altar rituals (mirror of server RITUALS; keep in sync) ──────────────────
const RITUALS = [
  { id: 'vigor',     name: 'Brew of Vigor',         emoji: '🧪', desc: '+40 max health' },
  { id: 'swiftness', name: 'Blessing of Swiftness', emoji: '🌀', desc: '+15% move speed' },
  { id: 'ward',      name: 'Hex Ward',              emoji: '🛡️', desc: '+15% damage resist' },
  { id: 'fortune',   name: 'Rite of Fortune',       emoji: '✨', desc: '+25% XP gained' },
  { id: 'forage',    name: "Forager's Chant",       emoji: '🌿', desc: '+25% harvest luck' },
  { id: 'quicken',   name: 'Quicken',               emoji: '⚡', desc: '15% faster cooldowns' },
];
let ritualActive = null;   // { id, stat, amount, until } (local-clock until) or null
let ritualCdUntil = 0;     // local-clock timestamp the altar is free again

// ── Correspondence attunement (mirror of data/correspondences.js) ────────────
// Used only to PREVIEW how aligned a rite is before working it; the server is
// authoritative on the actual bonus. Keep these three maps in sync with the
// data module.
const RITUAL_DECOS = { vigor: ['chalice', 'candles'], swiftness: ['raven', 'incense'], ward: ['pentacle', 'skull'], fortune: ['grimoire', 'crystals'], forage: ['cauldron', 'runes'], quicken: ['bell', 'mirror'] };
const DAY_RITUAL = { 0: 'vigor', 1: 'forage', 2: 'ward', 3: 'quicken', 4: 'fortune', 5: 'swiftness', 6: 'ward' };
const MOON_RITUAL = { waxing_crescent: ['forage', 'fortune'], waxing_gibbous: ['forage', 'fortune'], waning_gibbous: ['ward'], last_quarter: ['ward'], waning_crescent: ['ward'] };
let altarOfferMoonWater = false;   // toggle: spend 1 moon water on the next rite
function moonWaterCount() { const s = (lastInventoryState && lastInventoryState.slots) || []; let n = 0; for (const it of s) if (it && it.itemId === 'moon_water') n += (it.qty || 1); return n; }
function altarAttunePreview(ritualId) {
  const decos = (manorAltars && manorChestSlot != null && manorAltars[manorChestSlot]) || [];
  const want = RITUAL_DECOS[ritualId] || [];
  const matched = [...new Set(decos.filter((d) => d && want.includes(d)))];
  const reasons = [];
  let bonus = matched.length * 0.15;
  if (matched.length) reasons.push(`${matched.length} symbol${matched.length > 1 ? 's' : ''}`);
  const moon = calendarState && calendarState.moon;
  if (moon && moon.isFull) { bonus += 0.20; reasons.push('full moon'); }
  else if (moon && moon.key && (MOON_RITUAL[moon.key] || []).includes(ritualId)) { bonus += 0.10; reasons.push('the moon'); }
  if (DAY_RITUAL[new Date().getUTCDay()] === ritualId) { bonus += 0.15; reasons.push('its day'); }
  if (altarOfferMoonWater && moonWaterCount() > 0) { bonus += 0.25; reasons.push('offering'); }
  if (calendarState && calendarState.season && calendarState.season.key === 'samhain') { bonus += 0.15; reasons.push('Samhain'); }
  bonus = Math.min(0.90, Math.round(bonus * 100) / 100);
  return { pct: Math.round(bonus * 100), reasons };
}

// ── Book of Shadows ─────────────────────────────────────────────────────────
// The witch's working reference: the Wheel of the Year, the Moon's phases and
// their intentions, the altar correspondences, and the cauldron's brews. A
// read-only grimoire assembled from the client mirrors (the systems' own data);
// the live season/phase is highlighted from calendarState.
const BOOK_SABBATS = [
  { key: 'imbolc', g: '🌱', n: 'Imbolc', e: 'the First Stirring' },
  { key: 'ostara', g: '🥚', n: 'Ostara', e: 'the Balance of Spring' },
  { key: 'beltane', g: '🔥', n: 'Beltane', e: 'the Bright Fire' },
  { key: 'litha', g: '☀️', n: 'Litha', e: 'the Sun at its Height' },
  { key: 'lughnasadh', g: '🌾', n: 'Lughnasadh', e: 'the First Harvest' },
  { key: 'mabon', g: '🍂', n: 'Mabon', e: 'the Second Harvest' },
  { key: 'samhain', g: '🕯️', n: 'Samhain', e: "the Witches' New Year" },
  { key: 'yule', g: '❄️', n: 'Yule', e: 'the Longest Night' },
];
const BOOK_MOON = [
  { key: 'new', g: '🌑', n: 'New Moon', i: 'intentions & fresh starts' },
  { key: 'waxing_crescent', g: '🌒', n: 'Waxing Crescent', i: 'growth & drawing in' },
  { key: 'first_quarter', g: '🌓', n: 'First Quarter', i: 'decisions & building' },
  { key: 'waxing_gibbous', g: '🌔', n: 'Waxing Gibbous', i: 'refining & attraction' },
  { key: 'full', g: '🌕', n: 'Full Moon', i: 'power, charging & divination' },
  { key: 'waning_gibbous', g: '🌖', n: 'Waning Gibbous', i: 'gratitude & release' },
  { key: 'last_quarter', g: '🌗', n: 'Last Quarter', i: 'banishing & cleansing' },
  { key: 'waning_crescent', g: '🌘', n: 'Waning Crescent', i: 'rest & deep divination' },
];
const BOOK_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function renderBookModal() {
  const el = document.getElementById('bookContent');
  if (!el) return;
  const curSeason = (calendarState && calendarState.season && calendarState.season.key) || null;
  const curMoon = (calendarState && calendarState.moon && calendarState.moon.key) || null;
  const decoEmoji = {}; try { ALTAR_DECOS.forEach((d) => { decoEmoji[d.id] = d.emoji; }); } catch (e) { /* noop */ }
  const ritualDays = {}; Object.keys(DAY_RITUAL).forEach((d) => { const r = DAY_RITUAL[d]; (ritualDays[r] = ritualDays[r] || []).push(BOOK_DAY_NAMES[d]); });
  const ritualPhases = {}; Object.keys(MOON_RITUAL).forEach((ph) => { MOON_RITUAL[ph].forEach((r) => { (ritualPhases[r] = ritualPhases[r] || []).push(ph); }); });
  const phaseName = {}; BOOK_MOON.forEach((m) => { phaseName[m.key] = m.n; });
  let h = '';
  h += '<div class="bookSec"><h4>🎡 The Wheel of the Year</h4><div class="bookGrid">';
  for (const s of BOOK_SABBATS) h += `<div class="bookCell${s.key === curSeason ? ' cur' : ''}"><span class="bg">${s.g}</span><b>${esc(s.n)}</b><span class="bi">${esc(s.e)}</span></div>`;
  h += '</div></div>';
  h += '<div class="bookSec"><h4>🌙 The Moon</h4><div class="bookGrid">';
  for (const m of BOOK_MOON) h += `<div class="bookCell${m.key === curMoon ? ' cur' : ''}"><span class="bg">${m.g}</span><b>${esc(m.n)}</b><span class="bi">${esc(m.i)}</span></div>`;
  h += '</div><div class="bookNote">Charge moon water and work the esbat at the full moon.</div></div>';
  h += '<div class="bookSec"><h4>🔮 The Altar — Correspondences</h4><table class="bookTable"><tr><th>Blessing</th><th>Symbols</th><th>Day</th><th>Moon</th></tr>';
  for (const r of RITUALS) {
    const syms = (RITUAL_DECOS[r.id] || []).map((d) => decoEmoji[d] || '•').join(' ');
    const days = (ritualDays[r.id] || []).join(', ') || '—';
    const phs = (ritualPhases[r.id] || []).map((p) => phaseName[p]).join(', ') || 'Full Moon';
    h += `<tr><td>${r.emoji} ${esc(r.name)}</td><td>${syms}</td><td>${esc(days)}</td><td>${esc(phs)}</td></tr>`;
  }
  h += '</table><div class="bookNote">Match the symbols, the day, and the moon to deepen a rite; an offering of moon water deepens it further.</div></div>';
  h += '<div class="bookSec"><h4>🧪 The Cauldron — Brews</h4><div class="bookBrews">';
  for (const rec of POTION_RECIPES_CLIENT) {
    const ing = rec.ingredients.map((i) => { const meta = ITEM_CATALOG[i.id]; return `${i.qty}× ${meta ? meta.name : i.id}`; }).join(' + ');
    const made = ITEM_CATALOG[rec.id];
    const effect = (made && made.desc) ? made.desc : '';
    h += `<div class="bookBrew" title="${esc(effect)}"><b>${rec.icon} ${esc(rec.name)}</b><span class="bi">${esc(ing)}${rec.requiresMoon ? ' · 🌕 full moon' : ''}</span>${effect ? `<span class="brewFx">${esc(effect)}</span>` : ''}</div>`;
  }
  h += '</div></div>';
  el.innerHTML = h;
}
function openBookModal() {
  const modal = document.getElementById('bookModal');
  if (!modal) return;
  renderBookModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 370, 120);
  Modals.set('bookOpen', true);
}
function closeBookModal() {
  const modal = document.getElementById('bookModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('bookOpen', false);
}

// ── Familiar picker ─────────────────────────────────────────────────────────
const FAMILIARS_CLIENT = {
  cat: { name: 'Black Cat', emoji: '🐈‍⬛', blurb: '+15% harvest luck' },
  raven: { name: 'Raven', emoji: '🐦‍⬛', blurb: '+10% XP gained' },
  toad: { name: 'Toad', emoji: '🐸', blurb: '+25 max health' },
  hare: { name: 'Hare', emoji: '🐇', blurb: '+10% move speed' },
  bat: { name: 'Bat', emoji: '🦇', blurb: '+6% lifesteal' },
};
// undefined = not yet heard from the server (fall back to the live stream);
// null = explicitly dismissed. Distinguishing them keeps "No familiar" from
// being overridden by the stale stream value in the tick before it updates.
let myFamiliar; // last known from familiar_state (account-scoped)
// Numeric coat hex for a skin id (null = natural), used by client/familiars.js
// to recolor the follower's body material.
function familiarSkinHex(id) {
  if (!id || id === 'default') return null;
  const s = (myFamiliarCos.skins || []).find((x) => x.id === id);
  return (s && s.hex != null) ? s.hex : null;
}
function renderFamiliarModal() {
  const el = document.getElementById('familiarContent');
  if (!el) return;
  const send = (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); };
  const cur = (myFamiliar !== undefined) ? myFamiliar : ((me && players[me.id] && players[me.id].familiar) || null);
  let h = '<div style="font-size:12px;opacity:0.92;margin-bottom:8px;">Bond a familiar — it follows you everywhere and lends you its gift.</div><div class="menuCols">';
  for (const id of ['cat', 'raven', 'toad', 'hare', 'bat']) {
    const f = FAMILIARS_CLIENT[id];
    h += `<div class="famRow${cur === id ? ' cur' : ''}" data-fid="${id}"><span class="fe">${f.emoji}</span><span style="flex:1"><div class="fn">${f.name}${cur === id ? ' ✓' : ''}</div><div class="fb">${f.blurb}</div></span></div>`;
  }
  h += `<div class="famRow${!cur ? ' cur' : ''}" data-fid=""><span class="fe">—</span><span style="flex:1"><div class="fn">No familiar${!cur ? ' ✓' : ''}</div><div class="fb">Walk alone.</div></span></div></div>`;
  // Coat picker — recolors whichever familiar you've bonded. Account-wide,
  // server-sourced palette; owned/default equip on click, locked show 💎 price.
  if ((myFamiliarCos.skins || []).length) {
    const owned = myFamiliarCos.owned || []; const curSkin = myFamiliarCos.skin || 'default';
    h += '<div class="famCoatSec">Coat</div><div class="famCoats">';
    for (const s of myFamiliarCos.skins) {
      const sw = (s.hex == null)
        ? 'background:linear-gradient(135deg,#2a2140 50%,#4a3f66 50%)'
        : 'background:#' + s.hex.toString(16).padStart(6, '0');
      const isOwned = !s.ms || owned.indexOf(s.id) !== -1;
      if (!isOwned) h += '<button class="famCoat buy" data-skin="' + s.id + '" title="' + s.label + '"><span class="famSw" style="' + sw + '"></span><span class="famCoatLbl">' + s.ms + '💎</span></button>';
      else h += '<button class="famCoat' + (curSkin === s.id ? ' on' : '') + '" data-skin="' + s.id + '" title="' + s.label + '"><span class="famSw" style="' + sw + '"></span><span class="famCoatLbl">' + s.label + '</span></button>';
    }
    h += '</div>';
  }
  el.innerHTML = h;
  el.querySelectorAll('.famRow').forEach((row) => row.addEventListener('click', () => {
    send({ type: 'choose_familiar', familiarId: row.getAttribute('data-fid') || null });
  }));
  el.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => {
    send({ type: 'set_familiar_skin', skinId: b.getAttribute('data-skin') });
  }));
}
function openFamiliarModal() {
  const modal = document.getElementById('familiarModal');
  if (!modal) return;
  renderFamiliarModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 140);
  Modals.set('familiarOpen', true);
}
function closeFamiliarModal() {
  const modal = document.getElementById('familiarModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('familiarOpen', false);
}

// ── Wardrobe: don a Samhain guise (cosmetic, account-scoped) ──
// The guise catalog (id → name/emoji/blurb) is server-authoritative: it rides
// in on the init payload (from data/guises.js) and fills this map, so there is
// no hand-synced copy to drift out of lockstep. 3D rendering lives in
// client/guises.js keyed by the same ids.
let GUISES_CLIENT = {};
let myGuise; // last known from guise_state (undefined = unheard; null = doffed)
function renderGuiseModal() {
  const el = document.getElementById('guiseContent');
  if (!el) return;
  const send = (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); };
  const cur = (myGuise !== undefined) ? myGuise : ((me && players[me.id] && players[me.id].guise) || null);
  let h = '<div style="font-size:12px;opacity:0.92;margin-bottom:8px;">Guising — don a disguise so the wandering dead pass you by. Everyone sees your costume. Free to change or doff.</div><div class="menuCols">';
  for (const id of Object.keys(GUISES_CLIENT)) {
    const g = GUISES_CLIENT[id];
    if (!g) continue; // never let a stale/unknown guise id crash the menu
    h += `<div class="famRow${cur === id ? ' cur' : ''}" data-gid="${id}"><span class="fe">${g.emoji}</span><span style="flex:1"><div class="fn">${g.name}${cur === id ? ' ✓' : ''}</div><div class="fb">${g.blurb}</div></span></div>`;
  }
  h += `<div class="famRow${!cur ? ' cur' : ''}" data-gid=""><span class="fe">—</span><span style="flex:1"><div class="fn">No disguise${!cur ? ' ✓' : ''}</div><div class="fb">Show your own face.</div></span></div></div>`;
  el.innerHTML = h;
  el.querySelectorAll('.famRow').forEach((row) => row.addEventListener('click', () => {
    send({ type: 'choose_guise', guiseId: row.getAttribute('data-gid') || null });
  }));
}
function openGuiseModal() {
  const modal = document.getElementById('guiseModal');
  if (!modal) return;
  renderGuiseModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 140);
  Modals.set('guiseOpen', true);
}
function closeGuiseModal() {
  const modal = document.getElementById('guiseModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('guiseOpen', false);
}

// ── The Scrying Bowl: gaze into the water and read the turning wheel ──
let lastScry = null;
function scryDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d >= 1) return h >= 1 ? `${d}d ${h}h` : `${d}d`;
  if (h >= 1) return m >= 1 ? `${h}h ${m}m` : `${h}h`;
  return `${Math.max(1, m)}m`;
}
function renderScryModal() {
  const el = document.getElementById('scryContent');
  if (!el) return;
  const send = (p) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(p)); };
  const st = lastScry;
  if (!st) { el.innerHTML = '<div class="scryGaze">The water darkens, and clouds…</div>'; send({ type: 'scry' }); return; }
  let h = '<div class="scryGaze">You cup the dark water and gaze. It clouds, then clears…</div>';
  // The moon
  const mn = st.moon || {};
  const moonLine = mn.isBlood ? 'A <b>Blood Moon</b> hangs full and red tonight.'
    : (mn.isFull ? 'The moon is <b>full</b> tonight — the water drinks its light.'
      : `The next <b>full moon</b> rises in <b>${scryDur(mn.nextFullMs)}</b>.`);
  h += `<div class="scryRow"><span class="sge">${esc(mn.glyph || '🌙')}</span><span class="sgt"><div class="sgh">${esc(mn.name || 'The Moon')}</div><div class="sgs">${moonLine}</div></span></div>`;
  // The Blood Moon (when not already the moon line's subject)
  const bm = st.bloodMoon || {};
  if (!mn.isBlood) {
    const bmLine = bm.active ? 'It burns in the sky <b>now</b>.' : `It rises again in <b>${bm.nextNights} ${bm.nextNights === 1 ? 'night' : 'nights'}</b>.`;
    h += `<div class="scryRow"><span class="sge">🔴</span><span class="sgt"><div class="sgh">The Blood Moon</div><div class="sgs">${bmLine}</div></span></div>`;
  }
  // The turning wheel
  const w = st.wheel || {};
  let wheelLine = w.seasonName ? `<b>${esc(w.seasonName)}</b>${w.epithet ? ', ' + esc(w.epithet) + ',' : ''} holds.` : '';
  if (w.nextName) wheelLine += ` ${esc(w.nextGlyph || '')} <b>${esc(w.nextName)}</b> turns in <b>${scryDur(w.turnsMs)}</b>.`;
  h += `<div class="scryRow"><span class="sge">${esc(w.seasonGlyph || '🎡')}</span><span class="sgt"><div class="sgh">The Wheel of the Year</div><div class="sgs">${wheelLine}</div></span></div>`;
  // The day's omen
  if (st.omen) h += `<div class="scryOmen"><div class="sol">The water whispers</div><div class="sot">“${esc(st.omen)}”</div></div>`;
  if (st.samhain) h += '<div class="scrySamhain">🕯️ The veil is thin — the water shows more than it should.</div>';
  el.innerHTML = h;
}
function openScryModal() {
  const modal = document.getElementById('scryModal');
  if (!modal) return;
  renderScryModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 130);
  Modals.set('scryOpen', true);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'scry' }));
}
function closeScryModal() {
  const modal = document.getElementById('scryModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('scryOpen', false);
}

// ── Witch path picker ───────────────────────────────────────────────────────
const WITCH_PATHS_CLIENT = {
  green: { name: 'Green Witch', emoji: '🌿', blurb: '+10% harvest luck · foraging & gardening' },
  lunar: { name: 'Lunar Witch', emoji: '🌙', blurb: '+8% XP · the moon & moon water' },
  hedge: { name: 'Hedge Witch', emoji: '🕯️', blurb: '+5% lifesteal · séance & divination' },
  kitchen: { name: 'Kitchen Witch', emoji: '🍵', blurb: '+20 max health · brewing & teas' },
  sea: { name: 'Sea Witch', emoji: '🌊', blurb: '+8% move speed · tides & water' },
  hearth: { name: 'Hearth Witch', emoji: '🛡️', blurb: '+8% damage resist · altar & warding' },
};
let myWitchPath = null;
function renderPathModal() {
  const el = document.getElementById('pathContent');
  if (!el) return;
  const send = (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); };
  const cur = myWitchPath || null;
  let h = '<div style="font-size:12px;opacity:0.92;margin-bottom:8px;">Walk a tradition — a small gift, and a sense of which craft is yours. Change it any time.</div><div class="menuCols">';
  for (const id of ['green', 'lunar', 'hedge', 'kitchen', 'sea', 'hearth']) {
    const p = WITCH_PATHS_CLIENT[id];
    h += `<div class="famRow${cur === id ? ' cur' : ''}" data-pid="${id}"><span class="fe">${p.emoji}</span><span style="flex:1"><div class="fn">${p.name}${cur === id ? ' ✓' : ''}</div><div class="fb">${p.blurb}</div></span></div>`;
  }
  h += `<div class="famRow${!cur ? ' cur' : ''}" data-pid=""><span class="fe">—</span><span style="flex:1"><div class="fn">No path${!cur ? ' ✓' : ''}</div><div class="fb">Walk your own way.</div></span></div></div>`;
  el.innerHTML = h;
  el.querySelectorAll('.famRow').forEach((row) => row.addEventListener('click', () => send({ type: 'choose_path', pathId: row.getAttribute('data-pid') || null })));
}
function openPathModal() {
  const modal = document.getElementById('pathModal');
  if (!modal) return;
  renderPathModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 150);
  Modals.set('pathOpen', true);
}
function closePathModal() {
  const modal = document.getElementById('pathModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('pathOpen', false);
}

// ── Daily Tarot ─────────────────────────────────────────────────────────────
let _lastTarotResult = null; // today's card once drawn this session
function renderTarotModal(result) {
  const el = document.getElementById('tarotContent');
  if (!el) return;
  const send = (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); };
  if (!result) {
    el.innerHTML = '<div class="tarotBack">🂠 🂠 🂠</div><div style="font-size:12.5px;opacity:0.9;margin-bottom:14px;">Lay the spread — <b>The Past</b>, <b>The Present</b>, and <b>What Comes</b>.</div><button id="tarotDrawBtn">Lay your spread</button>';
    const b = document.getElementById('tarotDrawBtn');
    if (b) b.addEventListener('click', () => { b.disabled = true; b.textContent = 'Turning the cards…'; send({ type: 'tarot_draw' }); });
    return;
  }
  if (!result.spread || !result.spread.length) { el.innerHTML = `<div style="font-size:12.5px;opacity:0.85;">${result.message || 'The cards are quiet.'}</div>`; return; }
  let h = '<div class="tspread">';
  for (const s of result.spread) {
    h += `<div class="tseat"><div class="tpos">${esc(s.pos)}</div>`;
    h += `<div class="tcard${s.reversed ? ' rev' : ''}"><div class="tcInner"><div class="tcNum">${esc(s.num)}</div><div class="tcGlyph">${s.emoji}</div><div class="tcName">${esc(s.name)}</div></div>`;
    if (s.reversed) h += '<div class="tcRev">⟲ reversed</div>';
    h += `</div><div class="tMeaning">${esc(s.meaning)}</div></div>`;
  }
  h += '</div>';
  if (result.synthesis) h += `<div class="tSynth"><div class="tSynthLabel">The reading</div>${esc(result.synthesis)}</div>`;
  if (result.secret) h += `<div class="tsecret">🕯️ The cards whisper: "${esc(result.secret)}"</div>`;
  if (result.alreadyDrawn) h += '<div style="font-size:11.5px;opacity:0.72;text-align:center;margin-top:10px;">Today\'s spread. Return tomorrow for a new one.</div>';
  else if (result.gold) h += `<div id="tarotReward"><span class="coin"></span> +${result.gold} gold</div><div style="font-size:11px;opacity:0.72;text-align:center;">Return tomorrow for a new spread.</div>`;
  el.innerHTML = h;
}
function openTarotModal() {
  const modal = document.getElementById('tarotModal');
  if (!modal) return;
  renderTarotModal(_lastTarotResult);
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 150);
  Modals.set('tarotOpen', true);
}
function closeTarotModal() {
  const modal = document.getElementById('tarotModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('tarotOpen', false);
}

// ── Green-witch garden ──────────────────────────────────────────────────────
let lastGardenState = null;
let gardenView = 'beds'; // 'beds' | 'almanac' — the garden modal's two pages
function gardenMoonTier() {
  const m = calendarState && calendarState.moon;
  if (m && m.isFull) return { yield: 4, label: '🌕 the full moon' };
  if (m && ['waxing_crescent', 'first_quarter', 'waxing_gibbous'].includes(m.key)) return { yield: 3, label: '🌔 the waxing moon' };
  return { yield: 2, label: 'the moon' };
}
function gardenHerbCount(id) { const s = (lastInventoryState && lastInventoryState.slots) || []; let n = 0; for (const it of s) if (it && it.itemId === id) n += (it.qty || 1); return n; }
function gardenFmtLeft(ms) { const m = Math.ceil(ms / 60000); return m <= 1 ? 'under a minute' : m + ' min'; }
// Mother Yarrow's voice in the garden panel — a short line that reacts to how
// far along the Green Path you are, so tending the garden always feels like
// she's there tending it with you. Lines are trusted constants (no user input).
function yarrowGreeting(gp) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  if (gp.done) return pick([
    "You've walked the whole path, cottage to poison. A green witch true — my garden is yours.",
    "Nothing left to teach you, child. The beds know your hands now.",
    "Belladonna to chamomile, all of it yours. I knew you had the green in you.",
  ]);
  if (gp.chapter === 0 && (gp.progress || 0) === 0) return pick([
    "Welcome to my garden, child. The beds are bare and waiting — sow something, and we'll see what you can grow.",
    "So you've come to learn the green way. Good. Put a seed in the earth, and we'll begin.",
  ]);
  if (!gp.levelOk) return pick([
    "Patience. The next working asks more of you than you've got yet — grow a little stronger, then come back to me.",
    "Not yet, child. Some herbs won't answer to a hand that isn't ready. Go, live a little, and return.",
  ]);
  if (gp.band === 'cottage') return pick([
    "Keep at the cottage herbs — healing is where every green witch begins.",
    "The gentle ones first: chamomile, calendula. Learn their tempers before you reach for anything with teeth.",
  ]);
  if (gp.band === 'hedge') return pick([
    "You're crossing the hedge now. Mind what you gather out there — the wild doesn't give its herbs freely.",
    "Mugwort and rue, vervain and yarrow — the warding herbs. You'll want them before the dark work comes.",
  ]);
  if (gp.band === 'baneful') return pick([
    "The Poison Path. Grow these with respect, child — belladonna and henbane don't forgive carelessness.",
    "Nightshade and mandrake now, the witch's dark art. Steady hands — and never taste your own work.",
  ]);
  return "Tend your beds, child. The garden rewards a patient hand.";
}
function renderGardenModal() {
  const el = document.getElementById('gardenContent');
  if (!el) return;
  const send = (p) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(p)); };
  const st = lastGardenState;
  if (!st || !st.plots) { el.innerHTML = '<div style="opacity:.8;font-size:12px;">Tending the beds…</div>'; send({ type: 'garden_state' }); return; }
  // A two-page panel: the beds you tend, and the Almanac of plants you've found.
  const alm = st.almanac;
  const tabs = `<div class="gardenTabs">`
    + `<button class="gtab${gardenView === 'beds' ? ' on' : ''}" data-view="beds">🌿 Garden</button>`
    + (alm ? `<button class="gtab${gardenView === 'almanac' ? ' on' : ''}" data-view="almanac">📖 Almanac <span class="gtabCount">${alm.discovered}/${alm.total}</span></button>` : '')
    + `</div>`;
  if (gardenView === 'almanac' && alm) { renderAlmanacInto(el, tabs, alm); return; }
  const mt = gardenMoonTier();
  const now = Date.now();
  let h = tabs;
  // The Green Path — a gardening questline surfaced right here, since sowing and
  // harvesting ARE the objectives. Shows the current chapter + progress.
  const gp = st.greenPath;
  if (gp) {
    h += `<div class="yarrowSays"><div class="ysWho">Mother Yarrow</div><div class="ysLine">“${yarrowGreeting(gp)}”</div></div>`;
    if (gp.done) {
      h += '<div class="gpQuest done">🌿 <b>The Green Path</b> — complete. The garden is yours.</div>';
    } else {
      const sub = !gp.levelOk
        ? `🔒 Unlocks at Level ${gp.requiresLevel}`
        : `${gp.label} · <b>${gp.progress}/${gp.target}</b>`;
      h += `<div class="gpQuest"><div class="gpqHead">🌿 The Green Path · Ch. ${gp.chapter + 1}/${gp.total}: ${gp.title}</div><div class="gpqObj">${sub}</div></div>`;
    }
  }
  h += `<div class="gardenHint">Sow a herb and it grows into more. Planted under ${mt.label} now, a bed yields <b>${mt.yield}×</b> — plant as the moon fills for a richer crop.</div>`;
  h += '<div class="menuCols">';
  (st.plots || []).forEach((p, i) => {
    h += '<div class="gardenPlot">';
    if (!p) {
      h += `<div class="gpTitle">Bed ${i + 1} — empty</div><div class="gardenPlant">`;
      for (const id of (st.plantable || [])) {
        const meta = ITEM_CATALOG[id]; const have = gardenHerbCount(id);
        h += `<span class="gardenSeed${have > 0 ? '' : ' disabled'}" data-herb="${id}" data-plot="${i}">${meta ? meta.icon : '🌱'} ${meta ? meta.name : id} <span style="opacity:.6">(${have})</span></span>`;
      }
      h += '</div>';
    } else {
      const meta = ITEM_CATALOG[p.herb];
      const ready = p.ready || (now - p.plantedAt >= p.growMs);
      if (ready) h += `<div class="gpTitle">${meta ? meta.icon : '🌿'} ${meta ? meta.name : p.herb} — ready!</div><button class="gpReady" data-harvest="${i}">🌿 Harvest ${p.yield}×</button>`;
      else h += `<div class="gpTitle">${meta ? meta.icon : '🌱'} ${meta ? meta.name : p.herb} — growing</div><div class="gpGrow">ready in ${gardenFmtLeft(p.growMs - (now - p.plantedAt))} · yields ${p.yield}×</div><button class="gpRush" data-rush="${i}">💎 Grow now · ${st.rushCost || 5}</button>`;
    }
    h += '</div>';
  });
  h += '</div>';
  el.innerHTML = h;
  el.querySelectorAll('.gardenSeed').forEach((s) => { if (!s.classList.contains('disabled')) s.addEventListener('click', () => send({ type: 'garden_plant', plotIndex: +s.getAttribute('data-plot'), herb: s.getAttribute('data-herb') })); });
  el.querySelectorAll('.gpReady').forEach((b) => b.addEventListener('click', () => send({ type: 'garden_harvest', plotIndex: +b.getAttribute('data-harvest') })));
  el.querySelectorAll('.gpRush').forEach((b) => b.addEventListener('click', () => send({ type: 'garden_rush', plotIndex: +b.getAttribute('data-rush') })));
  wireGardenTabs(el);
}

// Hooks up the Garden / Almanac tab buttons (present in both views).
function wireGardenTabs(el) {
  el.querySelectorAll('.gtab').forEach((b) => b.addEventListener('click', () => {
    const v = b.getAttribute('data-view');
    if (v && v !== gardenView) { gardenView = v; renderGardenModal(); }
  }));
}

// The Garden Almanac — a collection page of the real-witchcraft Green Path
// plants, grouped by category, each with its folk lore. Undiscovered entries are
// hidden until you've held the plant (server-tracked), for a pokedex-style hook.
function renderAlmanacInto(el, tabs, alm) {
  const pct = alm.total ? Math.round((alm.discovered / alm.total) * 100) : 0;
  let h = tabs;
  h += `<div class="almIntro">A green witch's record of every plant she has grown or found. `
    + `<b>${alm.discovered} of ${alm.total}</b> discovered.`
    + `<div class="almBar"><span style="width:${pct}%"></span></div></div>`;
  for (const cat of (alm.categories || [])) {
    const found = cat.plants.filter((p) => p.discovered).length;
    h += `<div class="almCat">`
      + `<div class="almCatHead">${escHtml(cat.name)} <span class="almCatN">${found}/${cat.plants.length}</span></div>`
      + `<div class="almCatLore">${escHtml(cat.lore)}</div>`
      + `<div class="almGrid">`;
    for (const p of cat.plants) {
      if (p.discovered) {
        h += `<div class="almCell"><div class="almIcon">${uiIcon(p.id) || '🌿'}</div>`
          + `<div class="almName">${escHtml(p.name)}</div>`
          + `<div class="almLore">${escHtml(p.lore)}</div></div>`;
      } else {
        h += `<div class="almCell locked"><div class="almIcon">?</div>`
          + `<div class="almName">Undiscovered</div>`
          + `<div class="almLore">Grow or find this plant to record it.</div></div>`;
      }
    }
    h += `</div></div>`;
  }
  el.innerHTML = h;
  wireGardenTabs(el);
}
function openGardenModal() {
  const modal = document.getElementById('gardenModal');
  if (!modal) return;
  gardenView = 'beds'; // always open to the beds
  renderGardenModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 130);
  Modals.set('gardenOpen', true);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'garden_state' }));
}
function closeGardenModal() {
  const modal = document.getElementById('gardenModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('gardenOpen', false);
}

// ── Player housing: the cottage grid editor ─────────────────────────────────
// Slice 1 — a flat 8×8 floor you furnish from a palette of (cosmetic) pieces.
// Interaction: tap a palette piece to pick it up, then tap the grid to drop it;
// tap a placed piece to select it, then move / rotate / remove it. The server
// owns placement truth (bounds + overlap), so a bad drop just gets a toast.
let lastHomeState = null;
let homeSelPalette = null;   // a catalog piece id "in hand" for placement
let homeSelPiece = null;     // index of a placed piece that's selected
let homePendRot = 0;         // rotation to place / rotate the selection with
// The cells a piece covers when anchored (top-left) at (x,y) — mirrors the
// server's footprintCells so we can draw a live ghost and the occupancy grid.
function homeFootprint(piece, x, y, rot) {
  const swap = (rot === 1 || rot === 3);
  const fw = swap ? piece.h : piece.w;
  const fh = swap ? piece.w : piece.h;
  const cells = [];
  for (let cy = y; cy < y + fh; cy++) for (let cx = x; cx < x + fw; cx++) cells.push([cx, cy]);
  return cells;
}
function renderHomeModal() {
  const el = document.getElementById('homeContent');
  if (!el) return;
  const send = (p) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(p)); };
  const st = lastHomeState;
  if (!st || !st.grid) { el.innerHTML = '<div style="opacity:.8;font-size:12px;">Opening the cottage…</div>'; send({ type: 'home_state' }); return; }
  const { grid, pieces = [], catalog = [] } = st;
  const byId = {};
  for (const c of catalog) byId[c.id] = c;
  // Occupancy: which placed-piece index (if any) sits on each cell.
  const occ = {};
  pieces.forEach((pc, idx) => {
    const meta = byId[pc.id];
    if (!meta) return;
    for (const [cx, cy] of homeFootprint(meta, pc.x, pc.y, pc.rot || 0)) occ[cx + ',' + cy] = idx;
  });
  // The selected piece's footprint (so we can outline it).
  const selCells = {};
  if (homeSelPiece != null && pieces[homeSelPiece]) {
    const pc = pieces[homeSelPiece]; const meta = byId[pc.id];
    if (meta) for (const [cx, cy] of homeFootprint(meta, pc.x, pc.y, pc.rot || 0)) selCells[cx + ',' + cy] = true;
  }

  let h = '';
  h += `<button class="btn homeEnterBtn" data-act="enter">🚪 Step Inside Your Cottage</button>`;
  const inHand = homeSelPalette ? byId[homeSelPalette] : null;
  if (inHand) h += `<div class="homeHint">Holding <b>${escHtml(inHand.name)}</b> — tap a spot to set it down. ↻ turns it first.</div>`;
  else if (homeSelPiece != null && pieces[homeSelPiece]) h += `<div class="homeHint">Selected <b>${escHtml((byId[pieces[homeSelPiece].id] || {}).name || 'piece')}</b> — tap a new spot to move it, or use the buttons below.</div>`;
  else h += `<div class="homeHint">Tap a piece below to pick it up, then tap the floor to place it. Tap a placed piece to move or remove it.</div>`;

  // Toolbar — rotate / remove / deselect (context-aware).
  const hasSel = (homeSelPiece != null && pieces[homeSelPiece]) || inHand;
  h += '<div class="homeToolbar">';
  h += `<button data-act="rotate"${hasSel ? '' : ' disabled'}>↻ Rotate</button>`;
  h += `<button data-act="remove"${(homeSelPiece != null && pieces[homeSelPiece]) ? '' : ' disabled'}>🗑 Remove</button>`;
  h += `<button data-act="deselect"${hasSel ? '' : ' disabled'}>✕ Done</button>`;
  h += '</div>';

  // The floor grid.
  const CELL = 36;
  h += '<div class="homeGridWrap"><div class="homeGrid" style="grid-template-columns:repeat(' + grid.w + ',' + CELL + 'px);grid-template-rows:repeat(' + grid.h + ',' + CELL + 'px);">';
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
    const key = x + ',' + y;
    const idx = occ[key];
    let cls = 'homeCell';
    if (idx != null) cls += ' occ';
    if (selCells[key]) cls += ' sel';
    // The anchor cell of each placed piece carries its icon.
    let ico = '';
    if (idx != null) {
      const pc = pieces[idx];
      if (pc.x === x && pc.y === y) { const m = byId[pc.id]; ico = `<span class="hpIco">${m ? m.icon : '▪'}</span>`; }
    }
    h += `<div class="${cls}" data-x="${x}" data-y="${y}">${ico}</div>`;
  }
  h += '</div></div>';

  // The palette of owned pieces.
  h += '<div class="homePalette">';
  for (const c of catalog) {
    if (!c.owned) continue;
    h += `<div class="homePiece${homeSelPalette === c.id ? ' on' : ''}" data-piece="${c.id}"><span class="hpIco">${c.icon}</span><span class="hpName">${escHtml(c.name)}</span></div>`;
  }
  h += '</div>';
  el.innerHTML = h;

  // Wire the "step inside" button.
  { const eb = el.querySelector('.homeEnterBtn'); if (eb) eb.addEventListener('click', () => enterCottage()); }
  // Wire the palette.
  el.querySelectorAll('.homePiece').forEach((p) => p.addEventListener('click', () => {
    const id = p.getAttribute('data-piece');
    homeSelPalette = (homeSelPalette === id) ? null : id;
    homeSelPiece = null; homePendRot = 0;
    renderHomeModal();
  }));
  // Wire the grid.
  el.querySelectorAll('.homeCell').forEach((cell) => cell.addEventListener('click', () => {
    const x = +cell.getAttribute('data-x'), y = +cell.getAttribute('data-y');
    const idx = occ[x + ',' + y];
    if (idx != null && homeSelPalette == null) {
      // Select the placed piece under this cell.
      homeSelPiece = idx; homePendRot = pieces[idx].rot || 0; homeSelPalette = null;
      renderHomeModal();
    } else if (homeSelPalette) {
      send({ type: 'home_place', pieceId: homeSelPalette, x, y, rot: homePendRot });
    } else if (homeSelPiece != null && pieces[homeSelPiece]) {
      send({ type: 'home_move', idx: homeSelPiece, x, y, rot: homePendRot });
    }
  }));
  // Wire the toolbar.
  el.querySelectorAll('.homeToolbar button').forEach((b) => b.addEventListener('click', () => {
    const act = b.getAttribute('data-act');
    if (act === 'rotate') {
      homePendRot = (homePendRot + 1) % 4;
      if (homeSelPiece != null && pieces[homeSelPiece]) { const pc = pieces[homeSelPiece]; send({ type: 'home_move', idx: homeSelPiece, x: pc.x, y: pc.y, rot: homePendRot }); }
      else renderHomeModal();
    } else if (act === 'remove') {
      if (homeSelPiece != null) { send({ type: 'home_remove', idx: homeSelPiece }); homeSelPiece = null; }
    } else if (act === 'deselect') {
      homeSelPalette = null; homeSelPiece = null; homePendRot = 0; renderHomeModal();
    }
  }));
}
function openHomeModal() {
  const modal = document.getElementById('homeModal');
  if (!modal) return;
  homeSelPalette = null; homeSelPiece = null; homePendRot = 0;
  renderHomeModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 130);
  Modals.set('homeOpen', true);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'home_state' }));
}
function closeHomeModal() {
  const modal = document.getElementById('homeModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('homeOpen', false);
}

// ── Kitchen witchery (teas) ─────────────────────────────────────────────────
let lastTeaState = null;
const TEA_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function renderKitchenModal() {
  const el = document.getElementById('kitchenContent');
  if (!el) return;
  const send = (p) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(p)); };
  const st = lastTeaState;
  if (!st || !st.teas) { el.innerHTML = '<div style="opacity:.8;font-size:12px;">Putting the kettle on…</div>'; send({ type: 'tea_state' }); return; }
  let h = '';
  if (st.active && st.active.until > Date.now()) {
    const t = (st.teas || []).find((x) => x.id === st.active.id);
    const mins = Math.max(1, Math.round((st.active.until - Date.now()) / 60000));
    h += `<div class="teaActive">${t ? t.emoji : '🍵'} ${t ? t.name : 'Tea'} warming you — ${mins} min left.</div>`;
  }
  h += `<div class="gardenHint">Brew a herb into a tea and sip it on the spot. On a tea's planetary day it steeps longer (×${st.dayBonus || 1.5}).</div>`;
  h += '<div class="menuCols">';
  for (const tea of st.teas) {
    const onDay = st.today === tea.day;
    const ings = (tea.herbs || []).map((ing) => { const meta = ITEM_CATALOG[ing.id]; const have = gardenHerbCount(ing.id); return { text: `${meta ? meta.icon : '🌿'} ${ing.qty}× ${meta ? meta.name : ing.id}`, ok: have >= ing.qty }; });
    const canBrew = ings.every((i) => i.ok);
    h += `<div class="teaRow"><div class="trHead"><span class="tre">${tea.emoji}</span><span class="trn">${tea.name}</span>${onDay ? '<span class="trDay">✨ steeps longer today</span>' : `<span class="trDay" style="opacity:.55">${TEA_DAY_NAMES[tea.day]}</span>`}</div>`;
    h += `<div class="trb">${tea.blurb}</div><div class="tri">${ings.map((i) => i.text).join(' + ')}</div>`;
    h += `<button class="teaBrewBtn" data-tea="${tea.id}"${canBrew ? '' : ' disabled'}>Brew &amp; sip</button></div>`;
  }
  h += '</div>';
  el.innerHTML = h;
  el.querySelectorAll('.teaBrewBtn').forEach((b) => { if (!b.disabled) b.addEventListener('click', () => send({ type: 'brew_tea', teaId: b.getAttribute('data-tea') })); });
}
function openKitchenModal() {
  const modal = document.getElementById('kitchenModal');
  if (!modal) return;
  renderKitchenModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 130);
  Modals.set('kitchenOpen', true);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'tea_state' }));
}
function closeKitchenModal() {
  const modal = document.getElementById('kitchenModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('kitchenOpen', false);
}

// ── The Ancestor Altar — the solitary Samhain rite (dumb supper) ──
let lastAncestorState = null;
let ancestorPick = { offeringId: null, virtueId: null };
function renderAncestorModal() {
  const el = document.getElementById('ancestorContent');
  if (!el) return;
  const send = (p) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(p)); };
  const st = lastAncestorState;
  if (!st) { el.innerHTML = '<div style="opacity:.8;font-size:12px;">The candle gutters…</div>'; send({ type: 'ancestor_state' }); return; }
  if (st.needAccount) { el.innerHTML = '<div class="ancClosed">Log into an account to keep a forebear’s blessing across your characters.</div>'; return; }
  let h = '';
  // A live blessing, whatever the season — it was earned and still holds.
  if (st.active && st.active.until > Date.now()) {
    const v = (st.virtues || []).find((x) => x.id === st.active.id);
    const mins = Math.max(1, Math.round((st.active.until - Date.now()) / 60000));
    const left = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
    h += `<div class="ancActive">${v ? v.emoji : '🕯️'} ${v ? v.name + '’s' : 'A forebear’s'} blessing watches over you${st.lastName ? ` — ${esc(st.lastName)} remembered` : ''}. ${left} left.</div>`;
  }
  if (!st.veilThin) {
    h += '<div class="ancClosed">The veil is not yet thin. The Ancestor Altar wakes only at Samhain, when the dead walk closer to the torchlight.</div>';
    el.innerHTML = h;
    return;
  }
  if (st.todayKept) {
    h += '<div class="ancClosed">You have set a place today, and kept the silence. Return tomorrow to keep the rite again.</div>';
    el.innerHTML = h;
    return;
  }
  h += '<div class="ancHint">Set a place at the table for your dead. Lay down an offering in silence — the dumb supper — name a forebear and the virtue you carry forward, and receive their blessing (lasts ' + (st.hours || 6) + 'h). Once a day.</div>';
  h += `<input class="ancName" id="ancNameIn" maxlength="40" placeholder="a name to remember (optional)" value="${esc(st.lastName || '')}">`;
  h += '<div class="ancLabel">The offering</div><div class="ancOfferRow">';
  for (const o of (st.offerings || [])) {
    const out = (o.have || 0) < 1;
    const cls = 'ancOffer' + (out ? ' out' : '') + (ancestorPick.offeringId === o.id ? ' pick' : '');
    h += `<div class="${cls}" ${out ? '' : `data-offer="${o.id}"`}>${o.icon || '🕯️'} ${o.name}<span class="ao0">×${o.have || 0}</span></div>`;
  }
  h += '</div>';
  h += '<div class="ancLabel">The virtue you carry forward</div>';
  for (const v of (st.virtues || [])) {
    const cls = 'ancVirtue' + (ancestorPick.virtueId === v.id ? ' pick' : '');
    h += `<div class="${cls}" data-virtue="${v.id}"><div class="avh"><span class="ave">${v.emoji}</span><span class="avn">${v.name}</span></div><div class="avl">${esc(v.line || '')}</div></div>`;
  }
  const ready = !!ancestorPick.offeringId && !!ancestorPick.virtueId;
  h += `<button id="ancSetBtn"${ready ? '' : ' disabled'}>🕯️ Set a place &amp; keep the silence</button>`;
  el.innerHTML = h;
  // Preserve a half-typed name across re-renders triggered by selection clicks.
  const nameIn = document.getElementById('ancNameIn');
  if (nameIn) nameIn.addEventListener('input', () => { if (lastAncestorState) lastAncestorState.lastName = nameIn.value; });
  el.querySelectorAll('.ancOffer[data-offer]').forEach((b) => b.addEventListener('click', () => { ancestorPick.offeringId = b.getAttribute('data-offer'); renderAncestorModal(); }));
  el.querySelectorAll('.ancVirtue[data-virtue]').forEach((b) => b.addEventListener('click', () => { ancestorPick.virtueId = b.getAttribute('data-virtue'); renderAncestorModal(); }));
  const setBtn = document.getElementById('ancSetBtn');
  if (setBtn && ready) setBtn.addEventListener('click', () => {
    const nm = (document.getElementById('ancNameIn') || {}).value || '';
    send({ type: 'ancestor_offering', offeringId: ancestorPick.offeringId, virtueId: ancestorPick.virtueId, rememberName: nm });
    ancestorPick = { offeringId: null, virtueId: null };
  });
}
function openAncestorModal() {
  const modal = document.getElementById('ancestorModal');
  if (!modal) return;
  ancestorPick = { offeringId: null, virtueId: null };
  renderAncestorModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 130);
  Modals.set('ancestorOpen', true);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ancestor_state' }));
}
function closeAncestorModal() {
  const modal = document.getElementById('ancestorModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('ancestorOpen', false);
}

// ── The Release Fire — the letting-go Samhain rite ──
let lastReleaseState = null;
function renderReleaseModal() {
  const el = document.getElementById('releaseContent');
  if (!el) return;
  const send = (p) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(p)); };
  const st = lastReleaseState;
  if (!st) { el.innerHTML = '<div style="opacity:.8;font-size:12px;">The embers stir…</div>'; send({ type: 'release_state' }); return; }
  if (st.needAccount) { el.innerHTML = '<div class="relClosed">Log into an account to keep the hearth’s memory.</div>'; return; }
  let h = '';
  if (!st.veilThin) {
    h += '<div class="relClosed">The fire is only lit at Samhain, when the year turns and the old burdens are given to the flames.</div>';
    if (st.lastBurden) h += `<div class="relLast">Last given to the flames: “${esc(st.lastBurden)}”.</div>`;
    el.innerHTML = h;
    return;
  }
  if (st.todayKept) {
    h += '<div class="relClosed">You have given to the flames today, and walked away lighter. Return tomorrow.</div>';
    if (st.lastBurden) h += `<div class="relLast">You released: “${esc(st.lastBurden)}”.</div>`;
    el.innerHTML = h;
    return;
  }
  h += '<div class="relHint">The year turns, and the veil thins. Name what you carry — a grief, a fear, an old anger — and give it to the flames. The fire burns away a curse that clings to you, and you grow a little, <span class="relName">lighter now</span> (+' + (st.xp || 40) + ' XP). Once a day.</div>';
  const ph = (st.prompts && st.prompts.length) ? st.prompts[Math.floor(Math.random() * st.prompts.length)] : 'what you are ready to set down';
  h += `<textarea class="relBurden" id="relBurdenIn" maxlength="80" placeholder="${esc(ph)}…"></textarea>`;
  h += '<button id="relBurnBtn">🔥 Give it to the flames</button>';
  if (st.lastBurden) h += `<div class="relLast">Last time you released: “${esc(st.lastBurden)}”.</div>`;
  el.innerHTML = h;
  const btn = document.getElementById('relBurnBtn');
  if (btn) btn.addEventListener('click', () => {
    const b = (document.getElementById('relBurdenIn') || {}).value || '';
    send({ type: 'release_burden', burden: b });
  });
}
function openReleaseModal() {
  const modal = document.getElementById('releaseModal');
  if (!modal) return;
  renderReleaseModal();
  modal.classList.remove('hidden');
  setDefaultFloatPos(modal, 400, 130);
  Modals.set('releaseOpen', true);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'release_state' }));
}
function closeReleaseModal() {
  const modal = document.getElementById('releaseModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('releaseOpen', false);
}

const { buildManorScene, setAltarDecor } = createManorScene({
  makeStoneTexture, makeSignSprite, makeSigilFloorTexture, MANOR_WORLD, MANOR_BED_SPOTS,
  setManorScene: (s) => { manorScene = s; },
  setManorCamera: (c) => { manorCamera = c; },
  setManorEmbers: (e) => { manorEmbers = e; },
});

function swapToManorMap() {
  if (!manorScene) { try { buildManorScene(); } catch (e) { console.error('buildManorScene failed:', e); } } // lazy: built on first entry
  if (!manorScene || activeScene === manorScene) return;
  world = MANOR_WORLD;
  walls = [];
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(manorScene, manorCamera, null);
}

function enterManor() {
  if (!me || me.isDead) return;
  // Client-side courtesy gate (the server is authoritative): only from your
  // coven's private Wilds. If it refuses, a manor_error toast explains why.
  ws.send(JSON.stringify({ type: 'enter_manor' }));
}

function exitManor() {
  ws.send(JSON.stringify({ type: 'exit_manor' }));
}

// ── The cottage (player housing, slice 2) ───────────────────────────────────
const { buildCottageScene } = createCottageScene({
  makeSignSprite, COTTAGE_WORLD,
  setCottageScene: (s) => { cottageScene = s; },
  setCottageCamera: (c) => { cottageCamera = c; },
});

function swapToCottageMap() {
  if (!cottageScene) { try { buildCottageScene(); } catch (e) { console.error('buildCottageScene failed:', e); } } // lazy: first entry
  if (!cottageScene || activeScene === cottageScene) return;
  world = COTTAGE_WORLD;
  walls = cottageWalls; // solid furniture colliders (rebuilt by renderCottageFurniture)
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(cottageScene, cottageCamera, null);
}

function enterCottage() {
  if (!me || me.isDead) return;
  ws.send(JSON.stringify({ type: 'enter_cottage' }));
}
function exitCottage() {
  ws.send(JSON.stringify({ type: 'exit_cottage' }));
}

// Clear and rebuild every furniture prop from the saved layout. Each placed
// piece maps to a KayKit model (preferred) or a small procedural stand-in,
// dropped at the world centre of its footprint and turned to its rotation.
function renderCottageFurniture(layout) {
  if (!cottageScene) return;
  lastCottageLayout = layout || lastCottageLayout;
  const st = lastCottageLayout;
  // tear down the previous set
  for (const o of cottagePlacedProps) {
    cottageScene.remove(o);
    o.traverse && o.traverse((c) => { if (c.geometry) c.geometry.dispose && c.geometry.dispose(); if (c.material) { const m = c.material; if (m.map) m.map.dispose && m.map.dispose(); m.dispose && m.dispose(); } });
  }
  cottagePlacedProps.length = 0;
  const newWalls = [];
  if (!st || !Array.isArray(st.pieces)) { cottageWalls = newWalls; if (activeScene === cottageScene) walls = cottageWalls; return; }
  const byId = {};
  for (const c of (st.catalog || [])) byId[c.id] = c;
  const gw = (st.grid && st.grid.w) || 8;
  const WT = 10; // inner wall face — snap targets sit a hair off it
  for (const pc of st.pieces) {
    const meta = byId[pc.id] || HOME_CATALOG_FALLBACK[pc.id];
    if (!meta) continue;
    // footprint centre (averaged cell centres) so rotation never shifts the piece
    const cells = homeFootprint(meta, pc.x, pc.y, pc.rot || 0);
    let sx = 0, sz = 0;
    for (const [cx, cy] of cells) { const c = cottageCellCentre(cx, cy); sx += c.x; sz += c.z; }
    const px = sx / cells.length, pz = sz / cells.length;
    const yaw = -(pc.rot || 0) * Math.PI / 2;
    const obj = buildCottageProp(pc.id, meta, px, pz, yaw);
    if (!obj) continue;
    // Edge pieces hug the wall: anything whose footprint touches the north/east/
    // west edge of the grid is slid flush against that wall using its REAL model
    // bounds, instead of floating a grid-margin away. (The south wall holds the
    // door, so pieces there stay put rather than blocking the entrance.)
    const minx = Math.min(...cells.map((c) => c[0])), maxx = Math.max(...cells.map((c) => c[0]));
    const miny = Math.min(...cells.map((c) => c[1]));
    const onEdge = (miny === 0 || minx === 0 || maxx === gw - 1);
    if (onEdge) {
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      if (isFinite(box.min.z)) {
        if (miny === 0) obj.position.z += (WT - box.min.z);                           // north wall
        if (minx === 0) obj.position.x += (WT - box.min.x);                           // west wall
        else if (maxx === gw - 1) obj.position.x += ((COTTAGE_WORLD.width - WT) - box.max.x); // east wall
      }
    }
    cottageScene.add(obj);
    cottagePlacedProps.push(obj);
    // Solid pieces get a collider matching their real rendered footprint, so you
    // bump into the bed and the hearth instead of walking through them. Rugs and
    // the wall charm stay walk-through (flat / wall-mounted).
    if (!COTTAGE_NONSOLID.has(pc.id)) {
      obj.updateMatrixWorld(true);
      const fb = new THREE.Box3().setFromObject(obj);
      if (isFinite(fb.min.x) && isFinite(fb.min.z)) {
        const INSET = 4; // a hair smaller than the model so you slide along, not snag
        const rx = fb.min.x + INSET, rz = fb.min.z + INSET;
        const rw = (fb.max.x - fb.min.x) - INSET * 2, rh = (fb.max.z - fb.min.z) - INSET * 2;
        if (rw > 2 && rh > 2) newWalls.push({ x: rx, y: rz, w: rw, h: rh });
      }
    }
  }
  cottageWalls = newWalls;
  if (activeScene === cottageScene) walls = cottageWalls;
}

// A minimal fallback so a never-opened-editor layout can still name footprints.
const HOME_CATALOG_FALLBACK = {
  rug: { w: 3, h: 2 }, bed: { w: 2, h: 2 }, table: { w: 2, h: 1 }, chair: { w: 1, h: 1 },
  bookshelf: { w: 2, h: 1 }, hearth: { w: 2, h: 1 }, cauldron: { w: 1, h: 1 },
  candle_stand: { w: 1, h: 1 }, potted_herb: { w: 1, h: 1 }, wall_charm: { w: 1, h: 1 },
};

// id → a THREE object for the cottage floor. KayKit models where we have a good
// match; small procedural props otherwise. Sized so its footprint roughly fills
// its grid cells (COTTAGE_CELL per cell).
function buildCottageProp(id, meta, x, z, yaw) {
  const long = Math.max(meta.w || 1, meta.h || 1) * COTTAGE_CELL * 0.82; // target footprint of the long axis
  const kk = (key, size, mode) => { const g = KK.staticInstance(key, size, mode || 'fit'); if (g) { g.rotation.y = yaw; g.position.set(x, 0, z); } return g; };
  let g = null;
  switch (id) {
    case 'rug':        g = kk('furn_rug', long, 'fit'); break;
    case 'table':      g = kk('furn_table', long, 'fit'); break;
    case 'chair':      g = kk('furn_chair', COTTAGE_CELL * 0.7, 'fit'); break;
    case 'bookshelf':  g = kk('furn_shelfdec', long, 'fit') || kk('furn_shelf', long, 'fit'); break;
    case 'cauldron':   g = kk('wprop_cauldron', COTTAGE_CELL * 0.6, 'fit'); break;
    default: break;
  }
  if (g) return g;
  // ── procedural stand-ins (bed, hearth, candle_stand, potted_herb, wall_charm,
  // and any KayKit model not yet loaded) ──
  return buildProceduralProp(id, meta, x, z, yaw);
}

function buildProceduralProp(id, meta, x, z, yaw) {
  const g = new THREE.Group();
  const put = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); g.add(m); return m; };
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const woodDark = new THREE.MeshLambertMaterial({ color: 0x4a3017 });
  const cw = COTTAGE_CELL;
  if (id === 'bed') {
    put(new THREE.BoxGeometry(cw * 1.5, 22, cw * 1.8), woodDark, 0, 11, 0);                 // frame
    put(new THREE.BoxGeometry(cw * 1.4, 18, cw * 1.6), new THREE.MeshLambertMaterial({ color: 0x8a5a7a }), 0, 30, 6); // mattress
    put(new THREE.BoxGeometry(cw * 1.2, 16, cw * 0.4), new THREE.MeshLambertMaterial({ color: 0xece0d0 }), 0, 38, -cw * 0.6); // pillow
    put(new THREE.BoxGeometry(cw * 1.5, 46, 14), woodDark, 0, 23, -cw * 0.85);              // headboard
  } else if (id === 'hearth') {
    const stone = new THREE.MeshLambertMaterial({ color: 0x6a5f54 });
    put(new THREE.BoxGeometry(cw * 1.6, 110, 36), stone, 0, 55, -cw * 0.2);                 // surround
    put(new THREE.BoxGeometry(cw * 1.1, 70, 26), new THREE.MeshLambertMaterial({ color: 0x2a2018 }), 0, 40, -cw * 0.14); // firebox
    put(new THREE.BoxGeometry(cw * 1.8, 16, 44), stone, 0, 112, -cw * 0.2);                 // mantle
    const fire = new THREE.Mesh(new THREE.ConeGeometry(16, 48, 10), new THREE.MeshBasicMaterial({ color: 0xffac3a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    fire.position.set(0, 34, -cw * 0.1); fire.onBeforeRender = () => { fire.scale.y = 0.85 + Math.sin(performance.now() * 0.006) * 0.15; }; g.add(fire);
    const fl = new THREE.PointLight(0xffb060, 1.1, 420, 1.8); fl.position.set(0, 50, 20); g.add(fl);
  } else if (id === 'candle_stand') {
    put(new THREE.CylinderGeometry(5, 9, 12, 10), woodDark, 0, 6, 0);                        // base
    put(new THREE.CylinderGeometry(3, 3.5, 60, 8), new THREE.MeshLambertMaterial({ color: 0x2a2018 }), 0, 38, 0); // post
    put(new THREE.CylinderGeometry(5, 6, 16, 10), new THREE.MeshLambertMaterial({ color: 0xece0cf }), 0, 74, 0);  // candle
    const flame = new THREE.Mesh(new THREE.ConeGeometry(3.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    flame.position.set(0, 88, 0); flame.onBeforeRender = () => { flame.scale.y = 0.85 + Math.sin(performance.now() * 0.009) * 0.18; }; g.add(flame);
    const fl = new THREE.PointLight(0xffcf87, 0.7, 240, 2); fl.position.set(0, 90, 0); g.add(fl);
  } else if (id === 'potted_herb') {
    put(new THREE.CylinderGeometry(16, 12, 26, 12), new THREE.MeshLambertMaterial({ color: 0x8a4a2a }), 0, 13, 0); // pot
    put(new THREE.CylinderGeometry(15, 15, 4, 12), new THREE.MeshLambertMaterial({ color: 0x3a2414 }), 0, 26, 0);  // soil
    for (const [lx, lz, h] of [[0, 0, 40], [8, 6, 30], [-7, 5, 32], [5, -6, 28]]) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(6, h, 6), new THREE.MeshLambertMaterial({ color: 0x5a9a4a }));
      leaf.position.set(lx, 26 + h / 2, lz); g.add(leaf);
    }
  } else if (id === 'wall_charm') {
    const disc = new THREE.Mesh(new THREE.TorusGeometry(16, 3, 8, 20), new THREE.MeshLambertMaterial({ color: 0xc9a24a }));
    disc.position.set(0, 100, 0); g.add(disc);
    const star = new THREE.Mesh(new THREE.CircleGeometry(13, 5), new THREE.MeshBasicMaterial({ color: 0x8e6bff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    star.position.set(0, 100, 0.5); g.add(star);
  } else {
    // generic crate-ish stand-in for any unmapped piece
    put(new THREE.BoxGeometry(cw * 0.7, 40, cw * 0.7), wood, 0, 20, 0);
  }
  g.rotation.y = yaw;
  g.position.set(x, 0, z);
  return g;
}

// Rebuild the floating doorplate over every bed from the latest ownership map.
// A claimed room shows its owner's name; an empty one invites a claim.
function refreshManorBedplates() {
  if (!manorScene) return;
  for (const s of manorBedplates) { if (s) { manorScene.remove(s); if (s.material) { if (s.material.map) s.material.map.dispose(); s.material.dispose(); } } }
  manorBedplates.length = 0;
  for (let i = 0; i < MANOR_BED_SPOTS.length; i++) {
    const spot = MANOR_BED_SPOTS[i];
    const occ = manorBedState[i];
    const label = occ ? `🕯️ ${occ.name}` : (manorYours === null ? 'Empty — Press F to claim' : 'Empty');
    const sprite = makeSignSprite(label);
    sprite.position.set(spot.x, 128, spot.y);
    manorScene.add(sprite);
    manorBedplates[i] = sprite;
  }
}

function applyManorState(msg) {
  if (msg.bedrooms) manorBedState = msg.bedrooms;
  if ('yours' in msg) manorYours = msg.yours;
  if (msg.altars) manorAltars = msg.altars;
  if (msg.yourUnlocks) manorYourUnlocks = msg.yourUnlocks;
  if (typeof msg.msBalance === 'number') myMoonstones = msg.msBalance; // keep the adorn UI's balance fresh
  refreshManorBedplates();
  refreshManorAltars();
  if (Modals.isOpen('bedChestModalOpen')) renderManorChest(); // keep the adorn UI live
}

// Paint every altar's decorations from the latest state. Each claimed bedroom
// slot gets its owner's arrangement; unclaimed/empty altars render bare.
function refreshManorAltars() {
  if (!setAltarDecor) return;
  for (let i = 0; i < MANOR_BED_SPOTS.length; i++) {
    setAltarDecor(i, (manorAltars && manorAltars[i]) || []);
  }
}

// ── Bedroom chest (a claimed bed doubles as personal storage) ────────────────
let manorChestSlot = null;   // which bed's chest is open (null = closed)
let manorChestSlots = [];    // [{itemId,qty}|null] from the server
function openManorChest(slot) {
  manorChestSlot = slot;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'manor_storage_open', slot }));
  const modal = document.getElementById('bedChestModal');
  if (modal) modal.classList.remove('hidden');
  Modals.set('bedChestModalOpen', true);
}
function closeManorChest() {
  manorChestSlot = null;
  const modal = document.getElementById('bedChestModal');
  if (modal) modal.classList.add('hidden');
  Modals.set('bedChestModalOpen', false);
}
let altarSelDisplay = 0;   // which of the 6 altar display slots is selected to fill
function renderAltarAdorn() {
  const slotRow = document.getElementById('altarSlots');
  const catalog = document.getElementById('altarCatalog');
  const msLine = document.getElementById('altarMsLine');
  if (!slotRow || !catalog) return;
  const arrangement = (manorAltars && manorChestSlot != null && manorAltars[manorChestSlot]) || [];
  const decoById = {}; ALTAR_DECOS.forEach((d) => { decoById[d.id] = d; });
  if (msLine) msLine.textContent = `💎 ${myMoonstones}`;
  const send = (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); };

  // the six display slots — click to select which one the catalog fills
  slotRow.innerHTML = '';
  for (let i = 0; i < ALTAR_SLOTS; i++) {
    const id = arrangement[i] || null;
    const cell = document.createElement('div');
    cell.className = 'aslot' + (i === altarSelDisplay ? ' sel' : '') + (id ? ' filled' : '');
    cell.textContent = id ? (decoById[id] ? decoById[id].emoji : '•') : '·';
    cell.title = id ? (decoById[id] ? decoById[id].name : id) : 'Empty spot — pick one, then tap a decoration below';
    cell.addEventListener('click', () => {
      if (i === altarSelDisplay && id) send({ type: 'manor_altar_place', display: i, decoId: null }); // tap a filled, selected slot to clear it
      altarSelDisplay = i; renderAltarAdorn();
    });
    slotRow.appendChild(cell);
  }

  // the catalog — free + unlocked place into the selected slot; locked ones
  // offer a Moonstone unlock first.
  catalog.innerHTML = '';
  ALTAR_DECOS.forEach((d) => {
    const owned = d.free || !!manorYourUnlocks[d.id];
    const placedHere = arrangement[altarSelDisplay] === d.id;
    const cell = document.createElement('div');
    const affordable = owned || myMoonstones >= (d.ms || 0);
    cell.className = 'adeco' + (owned ? '' : ' locked') + (placedHere ? ' placed' : '') + (!owned && !affordable ? ' unaffordable' : '');
    cell.innerHTML = `<span>${d.emoji}</span>` + (owned ? '' : `<span class="acost">${d.ms}</span>`);
    cell.title = owned ? d.name + ' — tap to place in the selected spot' : `${d.name} — unlock for ${d.ms} 💎`;
    cell.addEventListener('click', () => {
      if (owned) send({ type: 'manor_altar_place', display: altarSelDisplay, decoId: placedHere ? null : d.id });
      else if (affordable) send({ type: 'manor_altar_unlock', decoId: d.id });
    });
    catalog.appendChild(cell);
  });
}

function renderRituals() {
  const wrap = document.getElementById('altarRituals');
  const status = document.getElementById('altarRitualStatus');
  if (!wrap) return;
  const now = Date.now();
  const onCd = ritualCdUntil > now;
  if (status) {
    if (ritualActive && ritualActive.until > now) { const d = ritualDef(ritualActive.id); status.textContent = `${d ? d.emoji : '✨'} ${fmtClock(ritualActive.until - now)} left`; }
    else if (onCd) status.textContent = `altar spent · ${fmtClock(ritualCdUntil - now)}`;
    else status.textContent = 'ready';
  }
  const send = (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); };
  wrap.innerHTML = '';
  // Offering toggle — spend one moon water to deepen the next rite (+25%).
  const mw = moonWaterCount();
  if (mw <= 0) altarOfferMoonWater = false;
  else {
    const off = document.createElement('div');
    off.className = 'arite' + (altarOfferMoonWater ? ' active' : '');
    off.style.cursor = 'pointer';
    off.innerHTML = `<span class="aemoji">💧</span><span><b>Offer moon water ${altarOfferMoonWater ? '✓' : ''}</b><br><span class="adesc">Deepen the next rite +25% — you have ${mw}</span></span>`;
    off.addEventListener('click', () => { altarOfferMoonWater = !altarOfferMoonWater; renderRituals(); });
    wrap.appendChild(off);
  }
  RITUALS.forEach((r) => {
    const isActive = ritualActive && ritualActive.id === r.id && ritualActive.until > now;
    const att = altarAttunePreview(r.id);
    const attLine = att.pct > 0 ? `<br><span class="adesc" style="color:#9fe6b0">✨ attuned +${att.pct}% · ${att.reasons.join(', ')}</span>` : '';
    const row = document.createElement('div');
    row.className = 'arite' + (isActive ? ' active' : '') + (onCd && !isActive ? ' locked' : '');
    row.innerHTML = `<span class="aemoji">${r.emoji}</span><span><b>${r.name}</b><br><span class="adesc">${r.desc}</span>${attLine}</span>`;
    row.title = onCd && !isActive ? 'The altar is still spent — wait for the cooldown.' : `Perform ${r.name}`;
    row.addEventListener('click', () => { if (!onCd || isActive) send({ type: 'altar_ritual_perform', ritualId: r.id, offer: altarOfferMoonWater }); });
    wrap.appendChild(row);
  });
}

function renderManorChest() {
  renderAltarAdorn();
  renderRituals();
  const chestGrid = document.getElementById('bedChestSlots');
  const packGrid = document.getElementById('bedChestInv');
  if (!chestGrid || !packGrid) return;
  const cell = (meta, onClick) => {
    const c = document.createElement('div');
    c.className = 'covenSlot' + (meta ? '' : ' empty');
    if (meta) {
      const m = ITEM_CATALOG[meta.itemId];
      c.innerHTML = `${m ? m.icon : '❔'}<span class="qty">×${meta.qty}</span>`;
      c.title = m ? m.name : meta.itemId;
      c.addEventListener('click', onClick);
    }
    return c;
  };
  chestGrid.innerHTML = '';
  manorChestSlots.forEach((s, i) => chestGrid.appendChild(cell(s, () => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'manor_storage_withdraw', slot: manorChestSlot, chestIdx: i }));
  })));
  packGrid.innerHTML = '';
  const invSlots = (lastInventoryState && lastInventoryState.slots) || [];
  invSlots.forEach((s, i) => packGrid.appendChild(cell(s, () => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'manor_storage_deposit', slot: manorChestSlot, invIdx: i }));
  })));
}
const bedChestCloseBtn = document.getElementById('bedChestCloseBtn');
if (bedChestCloseBtn) bedChestCloseBtn.addEventListener('click', closeManorChest);

// ── The Manor's EXTERIOR, standing in the Wilds ──────────────────────────────
// The Wilds geometry is shared between the public world and every coven's
// private copy (the Moot Stone swaps rosters, not scenes), so the Manor must
// only be visible/enterable while you're inside your OWN coven instance. Same
// pattern as the Ember portal: one group added to the wilds scene (hidden by
// default) plus a kiosk added to / removed from WILDS_KIOSKS, toggled by
// applyManorInstanceState() off mootInstanceActive. Must match server.js's
// MANOR_WILDS_SPOT exactly, since that's where enter_manor's distance gate is.
const MANOR_WILDS_SPOT = { x: 3000, y: 3000 };
const MANOR_ENTER_KIOSK = { x: MANOR_WILDS_SPOT.x, z: MANOR_WILDS_SPOT.y, portal: 'manor_enter', radius: 150 };
let manorExteriorGroup = null;
let manorCollider = null; // the footprint rect; added to WILDS_WALLS only while the Manor is visible

function buildManorExterior() {
  const g = new THREE.Group();
  // Preferred: the KayKit castle (bld_hall) — a grey-stone keep with red-roofed
  // towers and banners, so the Coven Manor reads as a prize worth joining a coven
  // for rather than a dark box. Its wooden gate is on the +z face, matching the
  // old manor's door and the enter kiosk's approach side. Sized by HEIGHT so the
  // tall keep stays imposing without ballooning to its ~800u fit height. Falls
  // back to the procedural manor below until the model streams in.
  const castle = (KK && KK.staticInstance && KK.has && KK.has('bld_hall')) ? KK.staticInstance('bld_hall', 440, 'height') : null;
  if (castle) {
    g.add(castle);
    const ch = castle.userData.kkHeight || 440;
    // Warm light spilling from the gate so the keep glows against the wilds night.
    const lamp = new THREE.PointLight(0xffb060, 1.8, 900, 1.5);
    lamp.position.set(0, 120, 150); g.add(lamp);
    const sign = makeSignSprite('🏰 The Coven Manor — Press F');
    sign.position.set(0, ch + 46, 120); g.add(sign);
  } else {
    // ── Procedural fallback (cold load, before the castle model streams in) ──
    // DoubleSide on the shell: if the third-person camera ever grazes a wall the
    // interior faces still render, so the manor never reads as hollow.
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x241d3a, side: THREE.DoubleSide });
    const trimMat = new THREE.MeshLambertMaterial({ color: 0x17112a, side: THREE.DoubleSide });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x120c22, side: THREE.DoubleSide });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcf87 });
    const BODY_W = 360, BODY_H = 220, BODY_D = 260;
    const body = new THREE.Mesh(new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D), stoneMat);
    body.position.y = BODY_H / 2; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(BODY_W * 0.62, 120, 4), roofMat);
    roof.rotation.y = Math.PI / 4; roof.position.y = BODY_H + 56; g.add(roof);
    for (const sx of [-BODY_W / 2 - 10, BODY_W / 2 + 10]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, BODY_H + 70, 10), trimMat);
      tower.position.set(sx, (BODY_H + 70) / 2, BODY_D / 2 - 30); g.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(42, 74, 10), roofMat);
      cap.position.set(sx, BODY_H + 70 + 37, BODY_D / 2 - 30); g.add(cap);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(70, 120, 10), new THREE.MeshLambertMaterial({ color: 0x3a2416 }));
    door.position.set(0, 60, BODY_D / 2 + 2); g.add(door);
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(74, 16), glowMat);
    doorGlow.position.set(0, 128, BODY_D / 2 + 3); g.add(doorGlow);
    for (const wy of [70, 150]) for (const wx of [-120, -60, 60, 120]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(28, 40), glowMat);
      win.position.set(wx, wy, BODY_D / 2 + 1.5); g.add(win);
    }
    const lamp = new THREE.PointLight(0xffb060, 1.4, 600, 1.6);
    lamp.position.set(0, 150, BODY_D / 2 + 40); g.add(lamp);
    const sign = makeSignSprite('🏚️ The Coven Manor — Press F');
    sign.position.set(0, BODY_H + 150, BODY_D / 2 + 10); g.add(sign);
  }
  g.position.set(MANOR_WILDS_SPOT.x, 0, MANOR_WILDS_SPOT.y);
  g.visible = false;
  return g;
}

// Build the exterior into the wilds scene once (lazy — the wilds itself is
// lazy), and give it a collider so players can't walk through the walls.
function ensureManorExterior() {
  if (manorExteriorGroup || !wildsScene) return;
  try {
    manorExteriorGroup = buildManorExterior();
    wildsScene.add(manorExteriorGroup);
    // Body footprint collider for the castle keep (~219×250), inset on the +z
    // gate side so the entrance stays walkable up to the kiosk. Stored here but
    // only pushed into WILDS_WALLS while the Manor is actually visible (see
    // applyManorInstanceState): the Manor exists only inside a coven instance,
    // so in the public Wilds this box was a solid invisible wall at (3000,3000).
    manorCollider = { x: MANOR_WILDS_SPOT.x - 105, y: MANOR_WILDS_SPOT.y - 125, w: 210, h: 180 };
  } catch (e) { console.error('buildManorExterior failed:', e); }
}

// Show/hide the Manor (and its entrance kiosk) with the coven instance.
function applyManorInstanceState(active) {
  if (manorExteriorGroup) manorExteriorGroup.visible = !!active;
  const idx = WILDS_KIOSKS.indexOf(MANOR_ENTER_KIOSK);
  if (active && idx === -1) WILDS_KIOSKS.push(MANOR_ENTER_KIOSK);
  else if (!active && idx !== -1) WILDS_KIOSKS.splice(idx, 1);
  // The footprint collider follows the Manor's visibility — present when the
  // keep is actually standing there, gone in the public Wilds so there's no
  // invisible wall where the hidden Manor would be.
  if (manorCollider) {
    const ci = WILDS_WALLS.indexOf(manorCollider);
    if (active && ci === -1) WILDS_WALLS.push(manorCollider);
    else if (!active && ci !== -1) WILDS_WALLS.splice(ci, 1);
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
const EMBER_WORLD = { width: 20000, height: 20000, buildings: [], spawn: { x: 10000, y: 18600 } }; // full open zone — twice the Wilds' span (kept in sync with server EMBER_WORLD_DIMS/EMBER_SPAWN)
let EMBER_STATIC_KIOSKS = []; // the fixed exit portal, built once
let EMBER_KIOSKS = [];        // static + live mobs, rebuilt each tick
let emberNodeKiosks = [];     // harvestable resource veins (folded into EMBER_KIOSKS each rebuild)
let emberLandmarks = [];      // named POIs from ember_wastes_entered
let emberDiscovered = {};     // landmark id -> true once the player has drawn near this visit
// Folding node kiosks into whatever the mob/scene code writes back keeps the
// resource veins interactable even though EMBER_KIOSKS is rebuilt every tick.
const setEmberKiosksWithNodes = (k) => { EMBER_KIOSKS = emberNodeKiosks.length ? k.concat(emberNodeKiosks) : k; };

// Humanoid, not the blob-monster rig every other mob type uses — each gets
// its own custom preset (see createHumanoid's presetOverride) rather than
// one of the 5 playable looks, so they read as hostile at a glance instead
// of looking like another player. Glowing eye colors match the flavor each
// type already had (fire/ember, bone/death, molten-brute).
// Each ember mob is an animated KayKit Skeleton (same pack as the Necromancer's
// summons — they borrow the Mage's clips), ember-scorched via kkTint so the
// bone-white pack reads as risen-from-ash undead. The classic `preset` stays as
// the cold-load fallback used only until the skeleton body streams in.
// kkKey → model, kkHeight → world-unit height, kkAttack → borrowed attack clip,
// kkTint → { mul (multiply the bones toward this), emissive, ei } .
const EMBER_MOB_VISUALS = {
  ash_wraith:    { name: 'Ash Wraith',    scale: 0.95, kkKey: 'skel_rogue',   kkHeight: 60,  kkAttack: '1H_Melee_Attack_Slice_Diagonal', kkTint: { mul: 0xd98a4a, emissive: 0x401505, ei: 0.35, eye: 0xffcc66 }, preset: { skin: 0xb85a30, hair: 0x3a1810, hairStyle: 'mohawk', eye: 0xffcc66, shirt: 0x5a2015, pants: 0x2a1a15 } },
  ashen_stalker: { name: 'Ashen Stalker', scale: 1.0,  kkKey: 'skel_minion',  kkHeight: 64,  kkAttack: 'Unarmed_Melee_Attack_Punch_A',    kkTint: { mul: 0xe07838, emissive: 0x501a04, ei: 0.4,  eye: 0xffdd88 }, preset: { skin: 0xd06a28, hair: 0x2a1008, hairStyle: 'mohawk', eye: 0xffdd88, shirt: 0x6a2810, pants: 0x331808 } },
  bonecaller:    { name: 'Bonecaller',    scale: 1.0,  kkKey: 'skel_mage',    kkHeight: 66,  kkAttack: 'Unarmed_Melee_Attack_Punch_A',    kkTint: { mul: 0xbfe0a8, emissive: 0x0e3a1c, ei: 0.4,  eye: 0x66ffaa }, preset: { skin: 0xd8d0b8, hair: 0x1a1a1a, hairStyle: 'long',   eye: 0x66ffaa, shirt: 0x2a2418, pants: 0x1c1810 } },
  soot_revenant: { name: 'Soot Revenant', scale: 1.1,  kkKey: 'skel_minion',  kkHeight: 70,  kkAttack: 'Unarmed_Melee_Attack_Punch_A',    kkTint: { mul: 0x9a6ab0, emissive: 0x2a0e44, ei: 0.45, eye: 0xcc88ff }, preset: { skin: 0x6a4a7a, hair: 0x120a1a, hairStyle: 'long',   eye: 0xcc88ff, shirt: 0x2a1a3a, pants: 0x160e22 } },
  cinder_brute:  { name: 'Cinder Brute',  scale: 1.25, kkKey: 'skel_warrior', kkHeight: 86,  kkAttack: '2H_Melee_Attack_Slice',           kkTint: { mul: 0xd0481c, emissive: 0x5a1400, ei: 0.5,  eye: 0xffaa00 }, preset: { skin: 0x8a3a1a, hair: 0x1a0a00, hairStyle: 'buzz',   eye: 0xffaa00, shirt: 0x4a1a00, pants: 0x2a1000 } },
  magma_golem:   { name: 'Magma Golem',   scale: 1.6,  kkKey: 'skel_golem',   kkHeight: 128, kkAttack: '2H_Melee_Attack_Slice',           kkTint: { mul: 0xc8401a, emissive: 0x6a1800, ei: 0.6,  eye: 0xffee44 }, preset: { skin: 0xb83010, hair: 0x300800, hairStyle: 'buzz',   eye: 0xffee44, shirt: 0x5a1400, pants: 0x330a00 } },
  ember_warlord: { name: 'Ashlord Cindermaw', scale: 2.5, kkKey: 'skel_golem', kkHeight: 220, kkAttack: '2H_Melee_Attack_Slice',          kkTint: { mul: 0xe83a08, emissive: 0x8a1800, ei: 0.75, eye: 0xffff66 }, preset: { skin: 0xff3a00, hair: 0x1a0300, hairStyle: 'mohawk', eye: 0xffff66, shirt: 0x7a1000, pants: 0x2a0600 } }
};

let emberMobVisuals = {};

// ── Ember Wastes mobs (pool mgmt) ─ extracted to client/ember-mobs.js (Phase C).
// emberMobVisuals + EMBER_KIOSKS/EMBER_STATIC_KIOSKS + emberScene stay in main
// (shared with ember-scene) — injected via get/set; MOB_ATTACK_LUNGE_DIST via
// getter (declared later). ──
const { applyEmberMobState, updateEmberMobVisuals } = createEmberMobs({
  EMBER_MOB_VISUALS, createHumanoid, lerpAngle, makeHealthBarSprite, makeNpcNameSprite, mobAttackLungeAmount, updateHealthBar,
  createKayKitByKey, kkSetState, kkOneShot, hasKK: (key) => KK.has(key),
  getMobAttackLungeDist: () => MOB_ATTACK_LUNGE_DIST,
  getEmberScene: () => emberScene,
  getEmberMobVisuals: () => emberMobVisuals,
  getEmberStaticKiosks: () => EMBER_STATIC_KIOSKS,
  setEmberKiosks: setEmberKiosksWithNodes,
  emberHeightAt, // ride the scorched dunes, not a flat y=0
});

// ── Ember Wastes resource nodes — harvestable Emberbloom / Cinder-Salt veins
// that feed the Artificer's Workshop. Positions arrive on entry; readiness
// rides wildlife_state. Their interact kiosks fold into EMBER_KIOSKS. ──
const { setNodeDefs: setEmberNodeDefs, applyNodeStates: applyEmberNodeStates, updateNodeVisuals: updateEmberNodeVisuals } = createEmberNodes({
  getEmberScene: () => emberScene,
  emberHeightAt,
});

// Announce a landmark the first time the player wanders into its reach this
// visit — gives the vast zone a sense of place and flags the warlord's throne.
function checkEmberLandmarkDiscovery() {
  if (!me || !emberLandmarks.length) return;
  for (const lm of emberLandmarks) {
    if (emberDiscovered[lm.id]) continue;
    if (Math.hypot(me.x - lm.x, me.y - lm.y) > lm.radius) continue;
    emberDiscovered[lm.id] = true;
    const icon = lm.warlord ? '⚔️' : '📍';
    // Center popup only — no top banner (matches the entry greeting).
    showChapterCeremony(`${icon} ${lm.name}`, lm.blurb || (lm.warlord ? 'The warlord of the wastes holds this place.' : ''));
  }
}

// ── The World Boss — the far-north Wilds mega-boss (Session N). One big
// humanoid with a shared healthbar; state from wildlife_state.worldBoss. ──
const { applyWorldBossState, updateWorldBossVisuals, worldBossVisualPos, worldBossGroup } = createWorldBoss({
  createHumanoid, lerpAngle, makeHealthBarSprite, makeNpcNameSprite, mobAttackLungeAmount, updateHealthBar,
  createKayKitByKey, kkSetState, kkOneShot, hasKK: (key) => KK.has(key),
  getMobAttackLungeDist: () => MOB_ATTACK_LUNGE_DIST,
  getWildsScene: () => wildsScene,
});

// ── The Necromancer's undead — minions rendered from wildlife_state.minions,
// rising from the ground and crumbling when slain, in whatever room they're in.
const { applyMinionState, updateMinionVisuals, destroyMinions } = createMinions({
  createHumanoid, lerpAngle, makeHealthBarSprite, updateHealthBar,
  getActiveScene: () => activeScene,
  getFloorHeight,
  getMe: () => me,
  createKayKitByKey, kkSetState, kkOneShot, hasKK: (key) => KK.has(key),
});

// ── Ember Wastes scene — extracted to client/ember-scene.js (Phase C 3D slice).
// THREE global; prop-helpers + EMBER_WORLD injected; scene/camera/kiosks/mob-
// visuals written back via get/set. ──
let emberAmbient = null; // { points, vel, RAD, CEIL } — drifting embers, ticked in the render loop
const { buildEmberScene } = createEmberScene({
  makeGrassTexture, makeEmberFloorTexture, makeRock, makeTree, buildPortalMesh, EMBER_WORLD, emberHeightAt, KK,
  makeGlowTexture, setEmberAmbient: (e) => { emberAmbient = e; },
  setEmberScene: (s) => { emberScene = s; },
  setEmberCamera: (c) => { emberCamera = c; },
  getEmberStaticKiosks: () => EMBER_STATIC_KIOSKS,
  setEmberStaticKiosks: (k) => { EMBER_STATIC_KIOSKS = k; },
  setEmberKiosks: setEmberKiosksWithNodes,
  getEmberMobVisuals: () => emberMobVisuals,
  setEmberMobVisuals: (v) => { emberMobVisuals = v; },
  getEmberLandmarks: () => emberLandmarks,
  makeNpcNameSprite,
  createStaticNpc, // Warden Kol, the Ashblood Trials quest-giver at the refuge
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

function swapToRefugeMap() {
  if (!refugeScene) { try { buildRefugeScene(); } catch (e) { console.error('buildRefugeScene failed:', e); } } // lazy: built on first entry, not at boot
  if (!refugeScene || activeScene === refugeScene) return;
  world = REFUGE_WORLD;
  walls = [];
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  setActiveContext(refugeScene, refugeCamera, null);
}

function enterRefuge() {
  if (!me || me.isDead) return;
  // Same standalone sub-room treatment as the Vault: mode stays 'outdoor' so
  // the building-interior logic never mistakes the refuge for a town building.
  mode = 'outdoor';
  indoorBuildingId = null;
  swapToRefugeMap();
  me.room = 'ember_refuge';
  me.x = REFUGE_WORLD.spawn.x;
  me.y = REFUGE_WORLD.spawn.y;
  ws.send(JSON.stringify({ type: 'enter_ember_refuge' }));
  setUnlockToast('🔥 You duck into the refuge — warm, and out of the ash.');
}

function exitRefuge() {
  ws.send(JSON.stringify({ type: 'exit_ember_refuge' }));
}

// ── The Wilds scene ─ extracted to client/wilds-scene.js (Phase C 3D slice).
// buildWildsScene + its village/circle/camp/tree sub-builders + buildWildsNPCs.
// THREE global; layout tables, prop makers, mob/decor helpers injected; scene/
// camera + lextonNpc written back via setters. decorVisuals2 via getter (it's
// declared later, so a by-ref pass here would TDZ at eval time). ──
const { buildWildsScene } = createWildsScene({
  GFX, WILDS_CAMPFIRES, WILDS_KIOSKS, WILDS_NPCS, WILDS_WALLS, WILDS_WAYMARKERS,
  WITCH_CAVE_ENTRANCE_X, WITCH_CAVE_ENTRANCE_Z,
  KK, createKayKitByKey, kkSetState, hasKK: (key) => KK.has(key), addNatureDecor, addSpookyDecor, buildPortalMesh, createHumanoid,
  kkWildsDressing, kkWildsGroundDetail, kkPlace, makeSpookyTree, makeWaymarkerStone, makeWildsCampfire, wildsCollide,
  makeMoorTexture, makeWildsFloorTexture, makeSigilTextures, makeGroundSigilTextures, makeGlowTexture, makeSignSprite, makeNpcNameSprite,
  makeFlowerPatch, makePlantBloom, // Mother Yarrow's garden plot (the Green Path)
  getDecorVisuals2: () => decorVisuals2,
  getAddAnimals2: () => addAnimals2,
  getAddMobs2: () => addMobs2, getAddMobs3: () => addMobs3,
  setWildsScene: (s) => { wildsScene = s; },
  setWildsCamera: (c) => { wildsCamera = c; },
  setLextonNpc: (n) => { lextonNpc = n; },
  wildsHeightAt,
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
  kkStatic: (key, size, mode) => (KK && KK.staticInstance ? KK.staticInstance(key, size, mode || 'fit') : null),
  hasKK: (key) => KK.has(key),
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

// Witchlight daytime: no postcard-blue noon, but cozy rather than cold —
// a warm golden-hour light over a soft warm-lavender sky, so the town reads
// as a welcoming witch-town where the Cauldron Café makes sense. Night swings
// hard the other way: a deep moonlit blue (see the ambient-intensity curve in
// day-night.js) so the torches, lanterns and the ember portal carry the dark.
const SKY_DAY = new THREE.Color(0xb6a7c2);
const SKY_NIGHT = new THREE.Color(0x0a1230);
const AMBIENT_DAY = new THREE.Color(0xf4e7cf);
const AMBIENT_NIGHT = new THREE.Color(0x7a7cae); // night fill, warmed slightly off icy-blue
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
// The moon's phase as [theta, dir] for the moon shader, which builds the sun
// direction from the live camera→moon axis. theta: 0 = full (whole face lit) →
// π = new (face dark). dir: +1 waxing (lit limb on the right) / −1 waning (left).
// Keyed to the same calendar phase the HUD and Book of Shadows show.
const MOON_PHASE_GEOM = {
  new:             [Math.PI,        1],
  waxing_crescent: [Math.PI * 0.72, 1],
  first_quarter:   [Math.PI * 0.5,  1],
  waxing_gibbous:  [Math.PI * 0.28, 1],
  full:            [0,              1],
  waning_gibbous:  [Math.PI * 0.28, -1],
  last_quarter:    [Math.PI * 0.5,  -1],
  waning_crescent: [Math.PI * 0.72, -1],
};
function moonPhaseGeom() {
  const key = (calendarState && calendarState.moon && calendarState.moon.key) || 'full';
  return MOON_PHASE_GEOM[key] || MOON_PHASE_GEOM.full;
}
const { getDayNightState, updateDayNightCycle } = createDayNight({
  DAY_MS, NIGHT_MS, CYCLE_MS, DAY_NIGHT_TRANSITION_MS, SKY_DAY, SKY_NIGHT, AMBIENT_DAY, AMBIENT_NIGHT,
  _skyColor, _ambientColor, GFX, bloodMoonActiveClient,
  hagstoneActiveClient: () => mootInstanceActive, // 🌑 re-grade to violet night inside a coven's private world
  getLampGlows: () => LAMP_GLOWS,
  getTempleTorchLights: () => TEMPLE_TORCH_LIGHTS,
  getOutdoorScene: () => outdoorScene, getOutdoorSun: () => outdoorSun, getMoonMesh: () => moonMesh,
  getOutdoorAmbient: () => outdoorAmbient, getOutdoorMoonLight: () => outdoorMoonLight,
  getOutdoorHemi: () => outdoorHemi,
  getMoonPhaseGeom: moonPhaseGeom,
  getWildsScene: () => wildsScene,
  getSunMesh: () => sunMesh, getSkyAnchor: () => activeCamera ? activeCamera.position : null,
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
  lerpAngle, makeHealthBarSprite, updateHealthBar, getFloorHeight,
  mobAttackLungeAmount, getMobAttackLungeDist: () => MOB_ATTACK_LUNGE_DIST,
});

// ---------------------------------------------------------------------------
// The Wilds' 4 dangerous mob types — same base shape as a town mob, just
// recolored/rescaled per type (see MOB2_VISUALS) so the 4 read as distinct
// threats at a glance, matching their distinct stats from server.js.
// ---------------------------------------------------------------------------
// The humanoid/undead/beast threats are animated KayKit bodies (shared-rig,
// scorch/recoloured via kkTint — a lerp toward the hue so a bone-white skeleton
// can read as a rot-green wight). The abstract ones (the Will-o'-Wisp orb, the
// Gloom Bat) have no KayKit fit and stay their hand-built rigs. kkKey → model,
// kkHeight → world-unit height, kkAttack → borrowed clip, kkTint → { to,amt,emissive,ei }.
const MOB2_VISUALS = {
  shade_stalker: { color: 0x3a1a4a, eyeColor: 0xb98aff, scale: 0.85, kkKey: 'skel_rogue',   kkHeight: 62,  kkAttack: '1H_Melee_Attack_Slice_Diagonal', kkTint: { to: 0x7a5aa6, amt: 0.6, emissive: 0x2a1040, ei: 0.35 } },
  bog_brute:     { color: 0x3a4a26, eyeColor: 0xd8ff6f, scale: 1.35, kkKey: 'skel_warrior', kkHeight: 96,  kkAttack: '2H_Melee_Attack_Slice',           kkTint: { to: 0x5c7a2e, amt: 0.55, emissive: 0x24340e, ei: 0.35 } },
  // A hostile shadow-werewolf — deliberately NOT Lexton. He shares the werewolf
  // model, so this one is tinted near-black and mangy with a strong red ember
  // glow (vs Lexton's natural grey coat + red jacket) and kept clearly smaller
  // (72 vs Lexton's 150) so there's no mistaking the two.
  night_howler:  { color: 0x1a1a22, eyeColor: 0xff2a2a, scale: 1.0,  kkKey: 'npc_werewolf', kkHeight: 72,  kkAttack: 'Unarmed_Melee_Attack_Punch_A',    kkTint: { to: 0x181420, amt: 0.82, emissive: 0x580a0a, ei: 0.34 } },
  will_o_wisp:   { color: 0x4fb8d8, eyeColor: 0xeafcff, scale: 0.6 },
  // ── Session M horrors ──
  fen_hexer:   { color: 0x3a1a4a, eyeColor: 0xd8b0ff, scale: 0.9,  fly: 12, kkKey: 'skel_mage',    kkHeight: 68, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0x9070c0, amt: 0.6, emissive: 0x2e1448, ei: 0.4 } },
  rot_swarm:   { color: 0x3a4a26, eyeColor: 0xd8ff6f, scale: 0.42, kkKey: 'skel_minion',  kkHeight: 42, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0x6a8a3a, amt: 0.55, emissive: 0x24340e, ei: 0.35 } },
  barrow_maw:  { color: 0x6a5038, eyeColor: 0xff7a2a, scale: 1.05, kkKey: 'mon_beast',    kkHeight: 76, kkAttack: '2H_Melee_Attack_Slice',        kkTint: { to: 0x9a6038, amt: 0.5, emissive: 0x3a1c08, ei: 0.4 } },
  gloom_bat:   { color: 0x1c1c26, eyeColor: 0xff2a2a, scale: 0.7,  fly: 26 },
  barrow_wight:{ color: 0x6a7a6a, eyeColor: 0x9fe0ff, scale: 1.1,  kkKey: 'skel_minion',  kkHeight: 70, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0xaab8ac, amt: 0.35, emissive: 0x16303a, ei: 0.3 } },
  old_marrowe: { color: 0x8a3a2a, eyeColor: 0xff5a4a, scale: 1.7,  elite: true, kkKey: 'skel_golem', kkHeight: 150, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0xa0432c, amt: 0.5, emissive: 0x4a1206, ei: 0.4 } }
};

// Visual data for all 32 dungeon mob types (color, eyeColor, scale match server's DUNGEON_MOB_TYPES)
// Dungeon mobs. The humanoid/beast/undead archetypes wear animated KayKit
// bodies (shared-rig path, same as the Wilds horrors): canines → the Werewolf
// & Monster, brutes → the Skeleton Golem, undead/wraiths → the robed & armoured
// Skeletons — all background-streamed keys, lerp-tinted toward each mob's hue.
// The critters KayKit has no model for (rats, bats, spiders, serpents) keep
// their purpose-built flat-shaded low-poly rigs. kkHeight (world units) carries
// the size, so KK mobs ignore `scale`.
const DUNGEON_MOB_VISUALS = {
  // Tier 1
  cave_rat:        { color: 0x6b4c2a, eyeColor: 0xff9944, scale: 0.55 },
  stone_bat:       { color: 0x5a5a6e, eyeColor: 0xccccff, scale: 0.6  },
  moss_crawler:    { color: 0x3d5c2a, eyeColor: 0x99ff44, scale: 0.75 },
  fungal_grunt:    { color: 0x7a5f3a, eyeColor: 0xffdd88, scale: 1.0, kkKey: 'skel_warrior', kkHeight: 70, kkAttack: '1H_Melee_Attack_Slice_Diagonal', kkTint: { to: 0x7a7f4a, amt: 0.52, emissive: 0x242a10, ei: 0.28 } },
  mud_slinger:     { color: 0x5a4a2e, eyeColor: 0xaabb66, scale: 0.85, kkKey: 'skel_minion', kkHeight: 60, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0x6a5a3a, amt: 0.55, emissive: 0x201808, ei: 0.25 } },
  tunnel_rat:      { color: 0x7a5a3a, eyeColor: 0xff8833, scale: 0.65 },
  rock_beetle:     { color: 0x4a4a4a, eyeColor: 0x88ff44, scale: 0.9  },
  pale_sprite:     { color: 0xd4c8ff, eyeColor: 0xffffff, scale: 0.5, kkKey: 'skel_minion', kkHeight: 46, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0xd4c8ff, amt: 0.5, emissive: 0x4a4668, ei: 0.5 } },
  // Tier 2
  shadow_wolf:     { color: 0x2a2a3a, eyeColor: 0xff4444, scale: 1.05, kkKey: 'npc_werewolf', kkHeight: 74, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0x2a2a3a, amt: 0.55, emissive: 0x2a0606, ei: 0.3 } },
  dark_adder:      { color: 0x1e2b1e, eyeColor: 0x44ff88, scale: 0.75 },
  crypt_spider:    { color: 0x3a1a3a, eyeColor: 0xdd44ff, scale: 0.85 },
  bone_hound:      { color: 0xd8d0b8, eyeColor: 0xff2222, scale: 1.0, kkKey: 'mon_beast', kkHeight: 66, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0xcfc7ac, amt: 0.5, emissive: 0x2a0808, ei: 0.3 } },
  venom_crawler:   { color: 0x2a4a1a, eyeColor: 0x88ff22, scale: 0.9  },
  swamp_lurker:    { color: 0x2e4a2a, eyeColor: 0x66ff44, scale: 1.15, kkKey: 'mon_beast', kkHeight: 82, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x2e4a2a, amt: 0.55, emissive: 0x0e2408, ei: 0.3 } },
  cave_troll:      { color: 0x4a5a3a, eyeColor: 0xffaa00, scale: 1.4, kkKey: 'skel_golem', kkHeight: 104, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x5a6a44, amt: 0.52, emissive: 0x241e08, ei: 0.3 } },
  marsh_specter:   { color: 0x6aafcc, eyeColor: 0xeaffff, scale: 0.7, kkKey: 'skel_mage', kkHeight: 58, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x6aafcc, amt: 0.5, emissive: 0x18404a, ei: 0.45 } },
  // Tier 3
  blood_bat:       { color: 0x8a0020, eyeColor: 0xff0000, scale: 0.8  },
  iron_golem:      { color: 0x5a6070, eyeColor: 0x4488ff, scale: 1.7, kkKey: 'skel_golem', kkHeight: 128, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x5a6070, amt: 0.55, emissive: 0x10203a, ei: 0.35 } },
  feral_warden:    { color: 0x6a2020, eyeColor: 0xff6600, scale: 1.1, kkKey: 'mon_beast', kkHeight: 78, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0x7a2828, amt: 0.55, emissive: 0x2e0c04, ei: 0.35 } },
  chaos_imp:       { color: 0xcc4400, eyeColor: 0xffdd00, scale: 0.65, kkKey: 'skel_minion', kkHeight: 50, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0xcc4400, amt: 0.55, emissive: 0x4a1600, ei: 0.4 } },
  plague_hound:    { color: 0x4a5a1a, eyeColor: 0x88ff00, scale: 1.05, kkKey: 'mon_beast', kkHeight: 70, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0x5a6a2a, amt: 0.55, emissive: 0x1e2808, ei: 0.3 } },
  void_walker:     { color: 0x1a0a2a, eyeColor: 0xaa44ff, scale: 0.75, kkKey: 'skel_mage', kkHeight: 62, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x3a1a5a, amt: 0.55, emissive: 0x280a40, ei: 0.45 } },
  stone_giant:     { color: 0x6a6a5a, eyeColor: 0xffcc44, scale: 1.8, kkKey: 'skel_golem', kkHeight: 138, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x6a6a5a, amt: 0.55, emissive: 0x2a2410, ei: 0.3 } },
  dusk_wraith:     { color: 0x4a2060, eyeColor: 0xcc88ff, scale: 0.9, kkKey: 'skel_mage', kkHeight: 70, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x5a2a78, amt: 0.55, emissive: 0x2a1240, ei: 0.45 } },
  // Tier 4
  nightmare_beast: { color: 0x1a0022, eyeColor: 0xff00ff, scale: 1.3, kkKey: 'mon_beast', kkHeight: 92, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x2a0a33, amt: 0.6, emissive: 0x380a40, ei: 0.4 } },
  shadow_titan:    { color: 0x0a0010, eyeColor: 0x8800ff, scale: 1.9, kkKey: 'skel_golem', kkHeight: 150, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x160a24, amt: 0.6, emissive: 0x2a0a4a, ei: 0.4 } },
  void_serpent:    { color: 0x220033, eyeColor: 0xdd00ff, scale: 0.85 },
  abyssal_hound:   { color: 0x1a0030, eyeColor: 0xff22aa, scale: 1.15, kkKey: 'npc_werewolf', kkHeight: 80, kkAttack: 'Unarmed_Melee_Attack_Punch_A', kkTint: { to: 0x2a0a40, amt: 0.6, emissive: 0x360838, ei: 0.4 } },
  infernal_brute:  { color: 0x8a1a00, eyeColor: 0xff4400, scale: 1.6, kkKey: 'skel_golem', kkHeight: 120, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x8a1a00, amt: 0.58, emissive: 0x4a1000, ei: 0.5 } },
  death_knight:    { color: 0x1a1a2a, eyeColor: 0x4444ff, scale: 1.2, kkKey: 'skel_warrior', kkHeight: 86, kkAttack: '1H_Melee_Attack_Slice_Diagonal', kkTint: { to: 0x2a2a44, amt: 0.55, emissive: 0x10104a, ei: 0.4 } },
  chaos_dragon:    { color: 0x660000, eyeColor: 0xff6600, scale: 1.5  },
  void_leviathan:  { color: 0x000022, eyeColor: 0x0066ff, scale: 2.0, kkKey: 'skel_golem', kkHeight: 160, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0x0a1a3a, amt: 0.6, emissive: 0x0a2050, ei: 0.4 } },
  // ── The signature bosses (Session L) — one per named dungeon ──
  boss_rat_king:       { color: 0x8a6a3a, eyeColor: 0xffcc44, scale: 1.5,  boss: true },
  boss_crypt_weaver:   { color: 0x5a2a5a, eyeColor: 0xff88ff, scale: 1.65, boss: true },
  boss_forge_tyrant:   { color: 0xb84a10, eyeColor: 0xffee66, scale: 1.95, boss: true, kkKey: 'skel_golem', kkHeight: 152, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0xb84a10, amt: 0.56, emissive: 0x5a1c00, ei: 0.55 } },
  boss_pale_sovereign: { color: 0xd8d8ea, eyeColor: 0xaaccff, scale: 2.1,  boss: true, kkKey: 'skel_mage', kkHeight: 150, kkAttack: '2H_Melee_Attack_Slice', kkTint: { to: 0xd8d8ea, amt: 0.5, emissive: 0x3a4a6a, ei: 0.5 } }
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
const { makeMob2, makeMob3 } = createMobMeshes({ makeMob, MOB2_VISUALS, makeHealthBarSprite, createKayKitByKey, kkSetState, hasKK: (key) => KK.has(key) });

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
  const v = mobVisuals[mobId] || mobVisuals2[mobId] || mobVisuals3[mobId] || dungeonMobVisuals[mobId] || emberMobVisuals[mobId];
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
  kkSetState, kkOneShot,
  getWildsScene: () => wildsScene, getLastWildlifeIsNight: () => lastWildlifeIsNight,
  getMobVisuals2: () => mobVisuals2, setMobVisuals2: (v) => { mobVisuals2 = v; },
  getMobVisuals3: () => mobVisuals3, setMobVisuals3: (v) => { mobVisuals3 = v; },
  getWildsHeightAt: () => wildsHeightAt, // ride the rolling terrain, not a flat y=0
});

// ── Wilds village NPCs ─ extracted to client/village-npcs.js (Phase C). The
// friendly villagers; the visual pool is private to the module.
// createHumanoid/kkSetState/lerpAngle injected; Wilds scene via getter. ──
const { applyVillageNpcState, updateVillageNpcVisuals } = createVillageNpcs({
  createHumanoid, kkSetState, lerpAngle, getWildsScene: () => wildsScene, KK,
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
  getOutdoorScene: () => outdoorScene, KK,
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
  createKayKitByKey, kkSetState, kkOneShot, hasKK: (key) => KK.has(key),
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
  for (const id in animalVisuals2) {
    const key = 'animal2:' + id;
    const v = animalVisuals2[id];
    if (v.hasLoot && wildsScene) showLootIcon(key, wildsScene, v.x, LOOT_ICON_HEIGHT, v.y, 'animal2', id);
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

// Tear down dungeon/delve mob visuals the latest snapshot no longer lists.
// applyDungeonMobState only adds/updates, so without this, mobs that were
// looted-and-cleared server-side — or, in a Delve, left behind when the floor
// advanced (run.mobs is reset each floor) — keep their meshes AND their 💰 loot
// icons forever. Every Delve floor shares one room id (dungeon_delve_<id>, no
// floor number), so the `v.room === me.room` guard in updateLootIcons never
// hides those stale bags: they pile up across floors and can't be collected
// (the server already discarded the mob, so loot_corpse returns "nothing here").
// The wildlife snapshot is the FULL per-room set, so anything absent is gone.
function reconcileDungeonMobVisuals(list) {
  const live = new Set();
  for (const m of list) live.add(String(m.id));
  for (const id in dungeonMobVisuals) {
    if (live.has(String(id))) continue;
    const v = dungeonMobVisuals[id];
    if (v && v.mesh) {
      if (v.mesh.parent) v.mesh.parent.remove(v.mesh);
      v.mesh.traverse((c) => {
        if (c.geometry && c.geometry.dispose) c.geometry.dispose();
        const mats = Array.isArray(c.material) ? c.material : (c.material ? [c.material] : []);
        for (const mm of mats) { if (mm && mm.dispose) mm.dispose(); }
      });
    }
    const key = 'dungeon:' + id;
    const spr = lootIconVisuals[key];
    if (spr) {
      if (spr.parent) spr.parent.remove(spr);
      if (spr.material) {
        if (spr.material.map && spr.material.map.dispose) spr.material.map.dispose();
        if (spr.material.dispose) spr.material.dispose();
      }
      delete lootIconVisuals[key];
    }
    delete dungeonMobVisuals[id];
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
  canvas, createHumanoid: createStaticNpc, makeNpcNameSprite, makeSignSprite, makeWallPainting, KK,
});
// ── Town-decor props — extracted to client/props-town.js (Phase C, first prop
// library slice). Pure THREE-group builders; makeGlowTexture/makeBarrel injected. ──
const {
  makeBenchProp, makeLamppost, makeWell, makeMarketStall, makeCrate, makeBarrelProp, makeHaybale, makeFenceSeg, makeStump, makeFallenLog, makeNoticeboard, makeWatermill,
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
const WILDS_FLORA_TYPES_CLIENT = ['watchpine', 'deadwood', 'mourning_willow', 'capwood', 'hexoak', 'palebirch', 'bramblebush', 'nightberry', 'thornsnarl', 'fenfern', 'toadring'];
const HARVESTABLE_DECOR_TYPES = new Set(['tree', 'shrub', 'flower', ...Object.keys(PLANT_VISUALS), ...WILDS_FLORA_TYPES_CLIENT]);
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
// Wilds flora: a KayKit Forest Nature Pack instance in place of the procedural
// builder, seated at the decor point with a deterministic per-id yaw so the
// forest doesn't read as clones. Returns null if the model hasn't streamed in
// yet, so the caller falls back to the procedural version. `extra` tacks on
// per-species detail (e.g. deadwood's harvestable spirit-glint).
function makeKKFlora(key, d, targetH, extra) {
  const inst = (KK && KK.staticInstance) ? KK.staticInstance(key, targetH * (d.scale || 1), 'height') : null;
  if (!inst) return null;
  let h = 0; const id = d.id || '';
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  inst.rotation.y = (((h % 360) + 360) % 360) * Math.PI / 180;
  inst.position.set(d.x, 0, d.y);
  inst.userData.camFade = true;
  if (extra) extra(inst, d);
  return inst;
}

// Deadwood's spirit-wisp glint — the cue that THIS dead tree is harvestable
// (the scenery spooky trees have none). Re-added to the KayKit model so the
// tell survives the swap (mirrors makeDeadwood in props-nature.js).
function addDeadwoodGlint(g, d) {
  const s = d.scale || 1;
  const gy = (g.userData.kkHeight || 90) * 0.8;
  const glint = new THREE.Mesh(new THREE.SphereGeometry(3.4 * s, 8, 8), new THREE.MeshBasicMaterial({ color: 0x9fe0ff }));
  glint.position.set(2.5 * s, gy, 2.5 * s); g.add(glint);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(6.2 * s, 8, 8), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.22 }));
  halo.position.copy(glint.position); g.add(halo);
}

const PROP_BUILDERS = {
  bench: { make: makeBenchProp, collide: () => ({ w: 40, h: 40 }) },
  lamppost: { make: makeLamppost, collide: () => ({ w: 9, h: 9 }) },
  well: { make: makeWell, collide: () => ({ w: 46, h: 46 }) },
  stall: { make: makeMarketStall, collide: (d) => (Math.abs((d.rot || 0) % Math.PI) > 0.8 ? { w: 52, h: 76 } : { w: 76, h: 52 }) },
  crate: { make: makeCrate, collide: () => ({ w: 19, h: 19 }) },
  barrel: { make: makeBarrelProp, collide: () => ({ w: 19, h: 19 }) },
  haybale: { make: makeHaybale, collide: () => ({ w: 28, h: 28 }) },
  watermill: { make: makeWatermill, collide: () => ({ w: 150, h: 150 }) },
  fence: { make: makeFenceSeg, collide: (d) => (Math.abs((d.rot || 0) % Math.PI) > 0.8 ? { w: 7, h: 58 } : { w: 58, h: 7 }) },
  stump: { make: makeStump, collide: () => ({ w: 17, h: 17 }) },
  log: { make: makeFallenLog, collide: () => ({ w: 34, h: 34 }) },
  noticeboard: { make: makeNoticeboard, collide: () => ({ w: 34, h: 12 }) },
  // ── Wilds flora — trees block movement (small collider), bushes walk-through ──
  watchpine:       { make: (d) => makeKKFlora('fl_watchpine', d, 132) || makeWatchpine(d.x, d.y, d.scale),       collide: () => ({ w: 16, h: 16 }) },
  deadwood:        { make: (d) => makeKKFlora('fl_deadwood', d, 92, addDeadwoodGlint) || makeDeadwood(d.x, d.y, d.scale), collide: () => ({ w: 15, h: 15 }) },
  mourning_willow: { make: (d) => makeMourningWillow(d.x, d.y, d.scale), collide: () => ({ w: 18, h: 18 }) },
  capwood:         { make: (d) => makeCapwood(d.x, d.y, d.scale),        collide: () => ({ w: 22, h: 22 }) },
  hexoak:          { make: (d) => makeKKFlora('fl_hexoak', d, 112) || makeHexoak(d.x, d.y, d.scale),             collide: () => ({ w: 20, h: 20 }) },
  palebirch:       { make: (d) => makeKKFlora('fl_palebirch', d, 100) || makePalebirch(d.x, d.y, d.scale),       collide: () => ({ w: 18, h: 18 }) },
  bramblebush:     { make: (d) => makeKKFlora('fl_bramble', d, 34) || makeBramblebush(d.x, d.y, d.scale),        collide: () => null },
  nightberry:      { make: (d) => makeNightberry(d.x, d.y, d.scale),     collide: () => null },
  thornsnarl:      { make: (d) => makeKKFlora('fl_thornsnarl', d, 30) || makeThornsnarl(d.x, d.y, d.scale),      collide: () => null },
  fenfern:         { make: (d) => makeFenfern(d.x, d.y, d.scale),        collide: () => null },
  toadring:        { make: (d) => makeToadstoolRing(d.x, d.y, d.scale),  collide: () => null }
};

function addNatureDecor(scene, w, pool, wallsOut) {
  // Which collision set the decor registers into. The Wilds scene is built
  // while `walls` still points at the TOWN array, so before Session I its
  // trees never collided in the Wilds AND left invisible colliders in town
  // wherever coordinates overlapped (user-reported as "no collision in the
  // Wilds"). Explicit is better than ambient.
  const wallsTarget = wallsOut || walls;
  const onTerrain = (w === world2); // the Wilds rolls; the town stays flat
  for (const d of (w.natureDecor || [])) {
    let group;
    if (d.type === 'tree') {
      group = makeKayLeafTree(d.x, d.y, d.scale) || makeTree(d.x, d.y, d.scale);
      const r = 8 * (d.scale || 1);
      wallsTarget.push({ x: d.x - r, y: d.y - r, w: r * 2, h: r * 2 });
    } else if (d.type === 'shrub') {
      group = makeKayBush(d.x, d.y, d.scale) || makeShrub(d.x, d.y, d.scale);
    } else if (d.type === 'rock') {
      group = makeKayRock(d.x, d.y, d.scale) || makeRock(d.x, d.y, d.scale);
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
    if (onTerrain && group) group.position.y += wildsHeightAt(d.x, d.y); // sit on the rolling moor
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
  lerpAngle, makeHealthBarSprite, updateHealthBar, getFloorHeight,
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
  // Wilds-only dressing (dead trees, arch, grave markers) placed in the open
  // midfield — lift each onto the rolling terrain by wrapping scene.add.
  const rawScene = scene;
  scene = { add: (o) => { if (o && o.position) o.position.y += wildsHeightAt(o.position.x, o.position.z); rawScene.add(o); } };
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
  if (type === 'slash') return (charId === 0 || charId === 5) ? '2H_Melee_Attack_Slice' : '1H_Melee_Attack_Slice_Diagonal'; // staff casters swing 2H
  if (charId === 4) return '1H_Melee_Attack_Stab';        // wanderer's knife jab
  if (charId === 2 || charId === 5) return 'Spellcast_Shoot'; // mystic + necromancer strike with magic
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
  updateStatusVisuals, updateWerewolfNpc, ensurePlayerVisual, destroyPlayerVisual, syncVisuals, refreshPlayerAppearance,
} = createPlayerVisuals({
  CHAR, JUMP_DURATION, JUMP_HEIGHT, KK, applyEquipVisual, applyStatusVisual, contextMatches, createHumanoid, getDayNightState, getFloorHeight, getRenderPos, kkDrivePlayer, kkSetState, lerpAngle, makeGhostMesh, setUnlockToast, visuals,
  getActiveScene: () => activeScene, getGroundY: () => groundY, getJumpActive: () => jumpActive, getJumpT: () => jumpT,
  getLextonNpc: () => lextonNpc, getMe: () => me, getMyId: () => myId, getPlayers: () => players,
  getSeatedAt: () => seatedAt, getWildsScene: () => wildsScene,
});

// 🐈‍⬛ Familiars — trail a companion behind every present player who has one,
// reading the shared visuals map for positions (cosmetic; perk is server-side).
const { updateFamiliars } = createFamiliars({
  getPlayers: () => players, getVisuals: () => visuals, getMe: () => me,
  getSkinHex: (id) => familiarSkinHex(id),
});
const { updateAuras } = createAuras({
  getPlayers: () => players, getVisuals: () => visuals, getAuraHex: (id) => auraHexClient(id),
});
const { updateGuises } = createGuises({
  getPlayers: () => players, getVisuals: () => visuals, getKK: () => KK,
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
    // Nightwatch Cloak — another player is invisible: hide their mesh and
    // nametag. Only invisibility touches group.visible here, and the flag
    // lets us restore exactly what we hid without clobbering other logic.
    if (p.invisible && id !== myId) {
      if (v.group) { v.group.visible = false; v._invisHidden = true; }
      v.nameEl.style.display = 'none';
      if (v.bubbleEl) v.bubbleEl.style.display = 'none';
      continue;
    } else if (v._invisHidden) {
      if (v.group) v.group.visible = true;
      v._invisHidden = false;
    }
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
  const cam = (activeScene === manorScene && !seatedAt) ? MANOR_CAM
            : (activeScene === cottageScene && !seatedAt) ? COTTAGE_CAM
            : (mode === 'outdoor' && activeScene !== caveScene && activeScene !== vaultScene && activeScene !== manorScene && activeScene !== cottageScene) ? OUTDOOR_CAM
            : (seatedAt ? INDOOR_SEATED_CAM : INDOOR_CAM);
  const dirX = -Math.sin(f), dirZ = -Math.cos(f); // unit vector pointing from the player back toward the camera

  // Indoors, rooms are small enough that a fixed pull-back distance can put
  // the camera past a wall. Rather than clamping the camera's x/z
  // independently (which can yank it off the behind-the-player line —
  // sometimes right on top of the character, or even past them, hiding
  // them entirely), shrink the pull-back distance along that same line so
  // the camera always stays directly behind the player, just closer when a
  // wall is near. This guarantees you can always see your own character.
  let back = cam.back;
  // Keep the camera inside whatever bounded room we're in by shrinking the
  // pull-back distance along the behind-the-player line (never past a wall),
  // rather than clamping x/z independently (which can shove it onto the
  // character). Town interiors carry their size on currentInterior; the
  // sub-room scenes (Manor/Cave/Vault) keep mode='outdoor' with no
  // currentInterior, so until now they got NO clip protection and the camera
  // sailed through their walls — resolve their bounds from the scene instead.
  let roomW = 0, roomD = 0;
  if (mode === 'indoor' && currentInterior) { roomW = currentInterior.roomW; roomD = currentInterior.roomD; }
  else if (activeScene === manorScene) { roomW = MANOR_WORLD.width; roomD = MANOR_WORLD.height; }
  else if (activeScene === cottageScene) { roomW = COTTAGE_WORLD.width; roomD = COTTAGE_WORLD.height; }
  else if (activeScene === caveScene)  { roomW = CAVE_WORLD.width;  roomD = CAVE_WORLD.height; }
  else if (activeScene === vaultScene) { roomW = VAULT_WORLD.width; roomD = VAULT_WORLD.height; }
  if (roomW) {
    const margin = 16;
    const maxX = dirX > 0.001 ? (roomW - margin - rp.x) / dirX
               : dirX < -0.001 ? (margin - rp.x) / dirX
               : Infinity;
    const maxZ = dirZ > 0.001 ? (roomD - margin - rp.z) / dirZ
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

// Admin-only coordinate readout (top-right). Shows the room, the player's x/y
// and the ground height under them — so floating/sunk decor can be reported by
// exact position. Throttled; a no-op (and hidden) for non-admins.
let _coordBarLast = 0;
function updateCoordBar() {
  if (!amAdmin) return;
  const el = document.getElementById('coordBar');
  if (!el || el.classList.contains('hidden') || !me) return;
  const now = performance.now();
  if (now - _coordBarLast < 120) return;
  _coordBarLast = now;
  const gnd = Math.round(getFloorHeight(me.room, me.x, me.y));
  const sign = gnd >= 0 ? '+' : '';
  el.innerHTML = `<span class="cbK">${roomLabel(me.room)}</span>\n`
    + `x ${Math.round(me.x)}   y ${Math.round(me.y)}\n`
    + `<span class="cbK">gnd</span> ${sign}${gnd}`;
}

// ---------------------------------------------------------------------------
// Sit-down interaction — seats are registered in render-space coordinates
// (matching furniture placement) by addDiningSet(). Occupancy is inferred
// dynamically from other players' current render positions, no new network
// messages needed. Movement is fully locked while seated; only an explicit
// E-press stands back up.
// ---------------------------------------------------------------------------
// The Champions' Table seats are gated to members of the coven that currently
// holds the crown. Until a coven is crowned (no champion yet) the table is open
// to everyone, so it isn't dead weight at the start of a week.
function canSitChampionsTable() {
  if (!covenChampions || !covenChampions.covenId) return true;
  return !!(covenState && covenState.id && covenState.id === covenChampions.covenId);
}

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
  if (me.room === 'ember_refuge') return nearestKioskIn(REFUGE_KIOSKS, me.x, me.y);
  if (me.room === 'manor') return nearestKioskIn(MANOR_KIOSKS, me.x, me.y);
  if (me.room === 'cottage') return nearestKioskIn(COTTAGE_KIOSKS, me.x, me.y);
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
// sessionTakenOver is declared up by setupWs() (it's read by onWsClose, which
// can fire during early load); the takeover UI lives here.
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
  renderMoonTag();
  if (Modals.isOpen('bookOpen')) renderBookModal();
}
// The live moon phase pill (HUD, beside the day/night clock). Always on so the
// phase is readable at a glance — the full moon glows gold (esbat / charge moon
// water), a blood moon glows red. Phase + flavor come from the server's
// calendar_state (calendarState.moon); the client only displays it.
function renderMoonTag() {
  const el = document.getElementById('moonTag');
  if (!el) return;
  const m = calendarState && calendarState.moon;
  if (!m || !me) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML = `<span class="moonGi">${moonPhaseIcon(m.key, m.isBlood) || ''}</span>${escHtml(m.name)}`;
  el.title = `${m.name} — ${m.intention}` + (m.blurb ? `\n${m.blurb}` : '');
  el.classList.toggle('fullMoon', !!m.isFull && !m.isBlood);
  el.classList.toggle('bloodMoon', !!m.isBlood);
}

// ── Active-effect bar ───────────────────────────────────────────────────────
// Little squares (like the hotbar) for everything timed riding the player: the
// activeStatus curse/buff, the altar blessing, a sipped tea, and a salt ward.
// Red = a curse/debuff, green = a blessing, gold = a ward.
const STATUS_FX = {
  wither: { icon: '☠️', label: 'Withering', debuff: true, desc: 'Grave-rot gnaws at you — losing health over time.' },
  stumble: { icon: '🌀', label: 'Stumbling', debuff: true, desc: 'Off-balance — your steps lurch and wander.' },
  shrink: { icon: '🔻', label: 'Shrunken', debuff: true, desc: 'Shrunk down small.' },
  toad: { icon: '🐸', label: 'Toaded', debuff: true, desc: 'A toad for now — your words come out as croaks.' },
  gibberish: { icon: '💬', label: 'Gibberish', debuff: true, desc: 'Your speech comes out as nonsense.' },
  wolfmark: { icon: '🐺', label: 'Wolf-marked', debuff: true, desc: 'Marked by the hunt — the pack can find you.' },
  rooted: { icon: '🪤', label: 'Rooted', debuff: true, desc: 'Snared in place — you cannot move.' },
  reversed: { icon: '🔄', label: 'Reversed', debuff: true, desc: 'Up is down — your movement is reversed.' },
  bloodcurse: { icon: '🩸', label: 'Blood-cursed', debuff: true, desc: 'Every blow you land bleeds you, and the blood feeds whoever cursed you.' },
  pumpkin: { icon: '🎃', label: 'Pumpkin-headed', debuff: true, desc: 'A carved gourd for a head — but all damage against you is halved while it grins.' },
  regen: { icon: '🫧', label: 'Regenerating', debuff: false, desc: 'Health knits back steadily over time.' },
  speedboost: { icon: '💨', label: 'Swift', debuff: false, desc: 'Fleet-footed — increased movement speed.' },
  ravencloak: { icon: '🌘', label: 'Raven Cloak', debuff: false, desc: 'Cloaked in feathers and shadow.' },
  giant: { icon: '🍄', label: 'Giant', debuff: false, desc: 'Grown huge — you tower over the town.' },
  bats: { icon: '🦇', label: 'Bat Swarm', debuff: false, desc: 'A swarm of bats wheels around you.' },
  meditate: { icon: '🪷', label: 'Meditating', debuff: false, desc: 'Centered and calm.' },
  wolfpact: { icon: '🐺', label: "Wolf's Pact", debuff: false, desc: "The pack's strength runs in you." },
  feather: { icon: '🍃', label: 'Featherfall', debuff: false, desc: 'Light as a leaf — you drift down gently.' },
  ward: { icon: '🛡️', label: 'Warded', debuff: false, desc: 'Shielded — all damage against you is halved while it holds.' },
  colorcycle: { icon: '🌈', label: 'Chaos', debuff: false, desc: 'Your colors cycle wildly.' },
};
let myWardUntil = 0; // Circle of Salt (server-pushed on cast)
function fxTimeLabel(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? Math.ceil(s / 60) + 'm' : s + 's'; }
function renderStatusEffects() {
  const bar = document.getElementById('statusFxBar');
  if (!bar) return;
  if (!me) { bar.innerHTML = ''; return; }
  const now = Date.now();
  const fx = [];
  const as = me.activeStatus;
  if (as && as.type && as.expiresAt > now) {
    const meta = STATUS_FX[as.type] || { icon: '✨', label: as.type, debuff: false };
    fx.push({ icon: meta.icon, ikey: as.type, label: meta.label, desc: meta.desc || '', cls: meta.debuff ? 'debuff' : 'buff', kind: meta.debuff ? 'Curse' : 'Blessing', until: as.expiresAt });
  }
  if (ritualActive && ritualActive.until > now) {
    const d = ritualDef(ritualActive.id);
    fx.push({ icon: d ? d.emoji : '✨', label: (d ? d.name : 'Blessing') + (ritualActive.mult > 1 ? ` (+${Math.round((ritualActive.mult - 1) * 100)}%)` : ''), desc: (d && (d.desc || d.description)) || 'An altar blessing.', cls: 'buff', kind: 'Altar rite', until: ritualActive.until });
  }
  if (lastTeaState && lastTeaState.active && lastTeaState.active.until > now) {
    const t = (lastTeaState.teas || []).find((x) => x.id === lastTeaState.active.id);
    fx.push({ icon: t ? t.emoji : '🍵', label: t ? t.name : 'Tea', desc: (t && (t.desc || t.effect)) || 'A brewed tea.', cls: 'buff', kind: 'Tea', until: lastTeaState.active.until });
  }
  if (lastAncestorState && lastAncestorState.active && lastAncestorState.active.until > now) {
    const v = (lastAncestorState.virtues || []).find((x) => x.id === lastAncestorState.active.id);
    fx.push({ icon: v ? v.emoji : '🕯️', label: (v ? v.name : 'Ancestor') + '’s blessing', desc: (v && (v.line || v.desc)) || "A forebear's blessing.", cls: 'buff', kind: 'Ancestor', until: lastAncestorState.active.until });
  }
  if (myWardUntil && myWardUntil > now) fx.push({ icon: '🧂', ikey: 'salt', label: 'Circle of Salt', desc: 'A ring of salt holds hostile magic at bay.', cls: 'ward', kind: 'Ward', until: myWardUntil });
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  bar.innerHTML = fx.map((f) => {
    const t = fxTimeLabel(f.until - now);
    return `<div class="statusFx ${f.cls}" data-fxname="${esc(f.label)}" data-fxdesc="${esc(f.desc)}" data-fxicon="${esc(f.ikey || f.icon)}" data-fxkind="${esc(f.kind || '')}">${glyphHTML(f.ikey || f.icon)}<span class="sfxTime">${t}</span></div>`;
  }).join('');
  if (!bar._tipWired) {
    // One delegated set of handlers (the bar is re-rendered constantly) → a rich
    // hover popup naming the effect and what it does, reusing the item tooltip.
    bar._tipWired = true;
    const show = (e) => {
      const el = e.target && e.target.closest && e.target.closest('.statusFx');
      if (!el) return;
      showActionTooltip(e, { icon: el.dataset.fxicon || '✨', name: el.dataset.fxname || '', kind: el.dataset.fxkind || '', description: el.dataset.fxdesc || '' });
    };
    bar.addEventListener('mouseover', show);
    bar.addEventListener('mousemove', (e) => { if (_ttOwner && e.target.closest && e.target.closest('.statusFx')) _positionTooltip(e); });
    bar.addEventListener('mouseout', (e) => { if (!e.relatedTarget || !(e.relatedTarget.closest && e.relatedTarget.closest('.statusFx'))) hideTooltip(); });
  }
}
// The event pill announces, then gets out of the way (the Session I location-
// pill lesson, re-learned live on Michael's phone): it shows for a few seconds
// whenever the ACTIVE EVENT SET changes (an event starting or ending), then
// fades. Tapping it while visible opens the Town Board.
let _eventTagSig = null;
let _eventTagFadeTimer = null;
// Turn an event-strip segment ("🕯️ Samhain — +15% XP") into HTML whose leading
// glyph becomes a custom icon, the rest kept as text.
function iconizeStripPart(p) {
  const m = String(p).match(/^(\S+)\s+([\s\S]*)$/u);
  if (!m) return escHtml(p);
  const svg = uiIcon(m[1]);
  return (svg ? '<span class="stripGi">' + svg + '</span>' : escHtml(m[1]) + ' ') + escHtml(m[2]);
}
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
  el.innerHTML = parts.map(iconizeStripPart).join(' <span class="stripSep">·</span> ');
  el.classList.remove('hidden');
  if (sig !== _eventTagSig) {
    // The set changed — surface it fresh, then fade back out of the way.
    _eventTagSig = sig;
    el.classList.remove('tagFaded');
    clearTimeout(_eventTagFadeTimer);
    _eventTagFadeTimer = setTimeout(() => el.classList.add('tagFaded'), 6500);
  }
}
setInterval(() => { renderEventTag(); renderMoonTag(); if (Modals.isOpen('gardenOpen')) renderGardenModal(); if (Modals.isOpen('kitchenOpen')) renderKitchenModal(); if (Modals.isOpen('ancestorOpen')) renderAncestorModal(); if (Modals.isOpen('releaseOpen')) renderReleaseModal(); if (Modals.isOpen('scryOpen') && ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'scry' })); }, 20000);
setInterval(renderStatusEffects, 1000); // active-effect squares + countdowns
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
  if (letter.coven) {
    const c = letter.coven;
    const who = `${c.sigil ? c.sigil + ' ' : ''}<b>${c.name}</b>`;
    if (c.holdsCrown) lines.push(['🏆', `Your coven ${who} holds the Champions' Table this week — <b>${c.points}</b> points.`]);
    else if (c.rank) lines.push(['🕸️', `Your coven ${who} sits <b>#${c.rank}</b> on the board this week with <b>${c.points}</b> points.`]);
    else lines.push(['🕸️', `Your coven ${who} hasn't put a mark on the board yet this week — it's all to play for.`]);
  }
  const cal = letter.calendar || calendarState;
  if (cal) {
    const now = Date.now();
    if (cal.season) lines.push([cal.season.glyph, cal.season.blessing.slice(cal.season.glyph.length).trim()]);
    if (now >= cal.tourney.startsAt && now < cal.tourney.endsAt) lines.push(['🏹', 'The Weekend Hunt Tournament is ON right now — every kill counts.']);
    else if (cal.tourney.startsAt > now) lines.push(['🏹', `Next hunt tournament: ${shortWhen(cal.tourney.startsAt)}.`]);
    if (now >= cal.festival.startsAt && now < cal.festival.endsAt) lines.push(['🏮', 'The Hearthmoon Festival fills the town today — +25% XP!']);
    if (bloodMoonActiveClient(now)) lines.push(['🔴', 'The BLOOD MOON is up at this very moment. Shards are falling.']);
  }
  // Gentle nudges toward the daily/nightly rooms (server only sends these after
  // a full day away) — reasons to wander back in.
  (letter.nudges || []).forEach((n) => lines.push(['✨', n]));
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
// Concrete "how to actually do it" guidance for each First Step — this is what
// turns the checklist into a guided first session. Phrased per input type.
const FS_HINTS = {
  talked:    { d: 'Walk up to a glowing townsperson and press F to talk.',              m: 'Walk up to a glowing townsperson and tap the prompt that appears.' },
  ability:   { d: 'Press 1 to use your first ability — your hotbar runs along the bottom.', m: 'Tap an ability on the right to use it.' },
  killed:    { d: 'Night creatures roam after dark — press R, or click one, to strike.', m: 'Night creatures roam after dark — tap one to strike.' },
  harvested: { d: 'Take the north portal to the Wilds, then click a plant to harvest it.', m: 'Take the north portal to the Wilds, then tap a plant to harvest it.' }
};
function fsHint(id) { const h = FS_HINTS[id]; return h ? (MOBILE_UI ? h.m : h.d) : ''; }
function renderFirstSteps() {
  const chip = document.getElementById('firstStepsChip');
  if (!chip) return;
  if (!firstStepsState || firstStepsState.done) { chip.classList.add('hidden'); return; }
  chip.innerHTML = '';
  const steps = firstStepsState.steps || [];
  const doneCount = steps.filter(s => s.done).length;
  const current = steps.find(s => !s.done) || null; // the one objective to guide toward right now
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
  title.textContent = `🏮 First Steps · ${doneCount}/${steps.length}`;
  chip.appendChild(title);
  // The active objective, spelled out as a concrete action.
  if (current) {
    const next = document.createElement('div');
    next.className = 'fsNext';
    next.innerHTML = `<span class="fsNextLabel">👉 ${current.icon} ${current.label}</span><span class="fsNextHint">${fsHint(current.id)}</span>`;
    chip.appendChild(next);
  }
  for (const s of steps) {
    const row = document.createElement('div');
    row.className = s.done ? 'fsDone' : (current && s.id === current.id ? 'fsCur' : '');
    row.textContent = `${s.done ? '✓' : s.icon} ${s.label}`;
    chip.appendChild(row);
  }
  const note = document.createElement('div');
  note.style.cssText = 'color:#9a8ac0;font-size:11px;margin-top:3px;';
  note.textContent = `Finish all ${steps.length} for ${firstStepsState.rewardGold} gold`;
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

const _seance = createSeance({
  send: (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); },
  getMe: () => me,
  shortWhen,
});
const { openSeanceModal, closeSeanceModal, handleSeanceMessage } = _seance;

const _ach = createAchievements({
  send: (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); },
  getAchState: () => achState,
});
const { openAchModal, closeAchModal, renderAchModal } = _ach;
const _titles = createTitles({
  send: (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); },
  getTitlesState: () => titlesState,
});
const { openTitlesModal, closeTitlesModal, renderTitlesModal } = _titles;

const _workshop = createWorkshop({
  send: (payload) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload)); },
  getCraftRecipes: () => craftRecipesClient,
  getInventoryState: () => lastInventoryState,
  getItemCatalog: () => ITEM_CATALOG,
  getEquipStats: () => equipStatsCatalog,
  getRecipesUnlocked: () => myRecipesUnlocked,
  getGold: () => (lastBankState ? lastBankState.balance : 0),
  showItemTooltip, hideTooltip,
});
const { openWorkshopModal, closeWorkshopModal, renderWorkshopModal } = _workshop;

// ── The Weekly Delve UI ──────────────────────────────────────────────────────
const _delve = createDelve({
  getWs: () => ws,
  getDelveState: () => delveState,
  getWeeklyDelveMods: () => weeklyDelveModsClient,
});
const { openDelveModal, closeDelveModal, renderDelveModal, renderDelveHud, openLocksmithModal, closeLocksmithModal, renderBoonDraft } = _delve;

// ── Covens UI ────────────────────────────────────────────────────────────────
let covenTableState = null;
let covenStandingsState = null;     // server coven_standings reply (the weekly board)
let covenChampions = null;          // current week's leading coven (holds the Champions' Table)
let covenRiteState = null;          // server rite_state reply (the seasonal coven Rite)
const _coven = createCoven({
  getWs: () => ws, getMe: () => me, getPlayers: () => players,
  getCovenState: () => covenState, getCovenTableState: () => covenTableState,
  getCovenUnread: () => covenUnread, setCovenUnread: (v) => { covenUnread = v; },
  getCovenChatLines: () => covenChatLines, getCovenSigilsCatalog: () => covenSigilsCatalog,
  getCurrentInterior: () => currentInterior, makeNpcNameSprite, ITEM_CATALOG, accountAuth,
  getCovenCharterInfo: () => covenCharterInfo, startCharterCheckout, startUpkeepCheckout,
  getIsAdmin: () => amAdmin, // admins found a coven for free (server allows it too)
  getCovenStandings: () => covenStandingsState, getCovenChampions: () => covenChampions,
  getCovenRite: () => covenRiteState,
});
const { refreshCovenMenuRow, openCovenModal, closeCovenModal, renderCovenModal, renderCovenChat, openCovenInviteToast, refreshCovenTableVisual, renderCovenStandings, renderCovenRite } = _coven;

const _covenVoice = createCovenVoice({
  getWs: () => ws, getCovenState: () => covenState, setUnlockToast,
  getMobile: () => MOBILE_UI, // phones get a hold-to-talk mic button (no C key)
});

// ── Dungeon lore plaques ─────────────────────────────────────────────────────
function openPlaqueModal() {
  // The Weekly Delve is an instanced room (dungeon_delve_<n>) with no fixed
  // lore or boss — its plaque records this week's modifiers instead, so the
  // tiered-dungeon lore path below (dungeon_t1..4) would silently do nothing.
  if (me && /^dungeon_delve_/.test(me.room || '')) {
    const mods = weeklyDelveModsClient || [];
    document.getElementById('plaqueTitle').textContent = '🕳️ The Weekly Delve';
    document.getElementById('plaqueEpithet').textContent = 'Its rules are rewritten with every new moon';
    const txt = document.getElementById('plaqueText');
    txt.style.whiteSpace = 'pre-line';
    txt.textContent = mods.length
      ? "This week the dark bends to:\n\n" + mods.map(md => `${md.icon} ${md.name} — ${md.desc}`).join('\n')
      : 'No curse binds the dark this week — a clean descent.';
    document.getElementById('plaqueBoss').textContent = '';
    document.getElementById('plaqueModal').classList.remove('hidden');
    return;
  }
  const m = /^dungeon_t([1-4])$/.exec(me ? me.room : '');
  const lore = m && dungeonLoreCatalog && dungeonLoreCatalog[m[1]];
  if (!lore) return;
  document.getElementById('plaqueText').style.whiteSpace = '';
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
  // The Workshop is now reached only at the Artificer's forge in the Wildlands
  // Village (see the 'artificer' kiosk) — no menu entry.
  wire('menuAchievements', openAchModal);
  wire('menuCodex', openCodexModal);
  wire('menuTitles', openTitlesModal);
  wire('menuCoven', openCovenModal);
  wire('menuNotifs', openNotifModal);
})();

// ── Wardrobe (Phase 1 cosmetics) ─────────────────────────────────────────────
// A dressing room: pick which weapon you visibly hold and toggle headwear/cape
// for your class. Pure fashion — applied to your own rig immediately and sent to
// the server, which stores it and carries it to everyone on the next broadcast.
(function () {
  const meRec = () => (myId && players[myId]) ? players[myId] : null;
  // What can this player do with a weapon look? ok = wear it; locked = earn it
  // (shows the requirement); buy = Moonstone purchase.
  function lookState(me, w) {
    const u = weaponUnlock(me.charId, w.id);
    if (!u) return { k: 'ok' };
    if (u.lvl) return (me.level || 1) >= u.lvl ? { k: 'ok' } : { k: 'locked', why: 'Lv ' + u.lvl };
    if (u.chapter) return (myWardrobe.chaptersDone || 0) >= u.chapter ? { k: 'ok' } : { k: 'locked', why: 'Ch. ' + u.chapter };
    if (u.ms) return (myWardrobe.purchased || []).indexOf(w.id) !== -1 ? { k: 'ok' } : { k: 'buy', ms: u.ms };
    return { k: 'locked', why: 'Locked' };
  }
  // Same three-state logic for a dye (account-wide, so purchases read from
  // myWardrobe.dyesPurchased rather than the per-class weapon list).
  function dyeState(me, dyeId) {
    const u = dyeUnlock(dyeId);
    if (!u) return { k: 'ok' };
    if (u.lvl) return (me.level || 1) >= u.lvl ? { k: 'ok' } : { k: 'locked', why: 'Lv ' + u.lvl };
    if (u.chapter) return (myWardrobe.chaptersDone || 0) >= u.chapter ? { k: 'ok' } : { k: 'locked', why: 'Ch. ' + u.chapter };
    if (u.ms) return (myWardrobe.dyesPurchased || []).indexOf(dyeId) !== -1 ? { k: 'ok' } : { k: 'buy', ms: u.ms };
    // Finery line (roadmap #7): a gold-priced cosmetic sink. Ownership rides the
    // same account-wide dyesPurchased list as the Moonstone dyes.
    if (u.gold) return (myWardrobe.dyesPurchased || []).indexOf(dyeId) !== -1 ? { k: 'ok' } : { k: 'buygold', gold: u.gold };
    return { k: 'locked', why: 'Locked' };
  }
  // One row of dye swatches for a slot ('dyeBody' | 'dyeAccent'). Owned dyes are
  // clickable chips; locked ones show their requirement; Moonstone ones show a
  // price and buy on click. The active dye is ringed.
  function dyeRow(me, slot, cur) {
    return DYES.map((d) => {
      const s = dyeState(me, d.id);
      const sw = d.hex == null
        ? 'background:linear-gradient(135deg,#2a2140 50%,#4a3f66 50%)'
        : 'background:#' + d.hex.toString(16).padStart(6, '0');
      const on = (cur || 'none') === d.id;
      if (s.k === 'locked') return '<button class="wrDye locked" disabled title="' + d.label + ' · ' + s.why + '"><span class="wrSw" style="' + sw + '"></span><span class="wrDyeLbl">' + s.why + '</span></button>';
      if (s.k === 'buy') return '<button class="wrDye buy" data-buydye="' + d.id + '" title="' + d.label + '"><span class="wrSw" style="' + sw + '"></span><span class="wrDyeLbl">' + s.ms + '💎</span></button>';
      if (s.k === 'buygold') return '<button class="wrDye buygold" data-buydye="' + d.id + '" title="' + d.label + ' — Finery (gold)"><span class="wrSw" style="' + sw + '"></span><span class="wrDyeLbl">' + s.gold + 'g</span></button>';
      return '<button class="wrDye' + (on ? ' on' : '') + '" data-dye="' + d.id + '" data-slot="' + slot + '" title="' + d.label + '"><span class="wrSw" style="' + sw + '"></span><span class="wrDyeLbl">' + d.label + '</span></button>';
    }).join('');
  }
  // One row of name-color swatches. Owned/default chips equip on click; locked
  // premium chips show their 💎 price and buy-then-equip on click (server-side).
  function nameColorRow() {
    const owned = myWardrobe.nameColorsOwned || [];
    const cur = myWardrobe.nameColor || 'default';
    return (myWardrobe.nameColors || []).map((c) => {
      const sw = (c.hex == null)
        ? 'background:linear-gradient(135deg,#2a2140 50%,#4a3f66 50%)'
        : 'background:#' + c.hex.toString(16).padStart(6, '0');
      const isOwned = !c.ms || owned.indexOf(c.id) !== -1;
      if (!isOwned) return '<button class="wrDye buy" data-namecolor="' + c.id + '" title="' + c.label + '"><span class="wrSw" style="' + sw + '"></span><span class="wrDyeLbl">' + c.ms + '💎</span></button>';
      const on = cur === c.id;
      return '<button class="wrDye' + (on ? ' on' : '') + '" data-namecolor="' + c.id + '" title="' + c.label + '"><span class="wrSw" style="' + sw + '"></span><span class="wrDyeLbl">' + c.label + '</span></button>';
    }).join('');
  }
  // One row of aura swatches (the foot-glow). Same three-state swatch language
  // as dyes/name colors: owned/none equip on click, locked show their 💎 price.
  function auraRow() {
    const owned = myAuraCos.owned || [];
    const cur = myAuraCos.aura || 'none';
    return (myAuraCos.auras || []).map((a) => {
      const sw = (a.hex == null)
        ? 'background:linear-gradient(135deg,#2a2140 50%,#4a3f66 50%)'
        : 'background:radial-gradient(circle,#' + a.hex.toString(16).padStart(6, '0') + ' 30%,rgba(0,0,0,0.2) 100%)';
      const isOwned = owned.indexOf(a.id) !== -1 || (!a.ms && !a.earned);
      if (!isOwned) {
        // Earned auras (Verdant, from the Green Path) show a locked 🌿 badge, not
        // a 💎 price — they can't be bought.
        const lbl = a.earned ? '🌿' : (a.ms + '💎');
        const ttl = a.earned ? a.label + ' — earned on the Green Path' : a.label;
        return '<button class="wrDye buy' + (a.earned ? ' earned' : '') + '" data-aura="' + a.id + '" title="' + ttl + '"><span class="wrSw" style="' + sw + '"></span><span class="wrDyeLbl">' + lbl + '</span></button>';
      }
      return '<button class="wrDye' + (cur === a.id ? ' on' : '') + '" data-aura="' + a.id + '" title="' + a.label + '"><span class="wrSw" style="' + sw + '"></span><span class="wrDyeLbl">' + a.label + '</span></button>';
    }).join('');
  }
  function renderWardrobe() {
    const me = meRec(); const list = document.getElementById('wardrobeList');
    if (!me || !list) return;
    const def = WARDROBE[me.charId];
    if (!def) { list.innerHTML = '<div class="slNote">No looks for this class yet.</div>'; return; }
    const ap = me.appearance || {};
    const curW = def.weapons.some((w) => w.id === ap.weapon) ? ap.weapon : def.defaultWeapon;
    let h = '<div class="wrSec">Weapon</div><div class="wrOpts">';
    h += def.weapons.map((w) => {
      const s = lookState(me, w);
      if (s.k === 'buy') return '<button class="wrOpt buy" data-buy="' + w.id + '">' + w.label + ' · ' + s.ms + '💎</button>';
      if (s.k === 'locked') return '<button class="wrOpt locked" disabled>' + w.label + ' · ' + s.why + '</button>';
      return '<button class="wrOpt' + (w.id === curW ? ' on' : '') + '" data-w="' + w.id + '">' + w.label + '</button>';
    }).join('');
    h += '</div>';
    if (def.toggles.length) {
      h += '<div class="wrSec">Show</div><div class="wrOpts">';
      h += def.toggles.map((t) => { const on = ap[t.id] === undefined ? true : !!ap[t.id]; return '<button class="wrOpt' + (on ? ' on' : '') + '" data-t="' + t.id + '">' + t.label + (on ? ' ✓' : '') + '</button>'; }).join('');
      h += '</div>';
    }
    // Colors (Phase 3 dyes): two swatch rows — the outfit tint and the accent
    // (hat/cape) tint. Shared account-wide palette; head/face stay natural.
    h += '<div class="wrSec">Outfit color</div><div class="wrDyes">' + dyeRow(me, 'dyeBody', ap.dyeBody) + '</div>';
    h += '<div class="wrSec">Accent color</div><div class="wrDyes">' + dyeRow(me, 'dyeAccent', ap.dyeAccent) + '</div>';
    // Name color (chat + nameplate flair) — account-wide, server-sourced palette.
    h += '<div class="wrSec">Name color</div><div class="wrDyes">' + nameColorRow() + '</div>';
    // Aura (a glow at your feet, seen in-world) — account-wide, server-sourced.
    h += '<div class="wrSec">Aura</div><div class="wrDyes">' + auraRow() + '</div>';
    h += '<div class="slNote" style="margin-top:12px">Looks are pure cosmetics — they never change your stats. Dyes are account-wide. The <b>Finery</b> line (gold swatches) is bought with gold. 💎 ' + myMoonstones + '</div>';
    list.innerHTML = h;
    list.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => applyWardrobe({ weapon: b.getAttribute('data-w') })));
    list.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'buy_look', weapon: b.getAttribute('data-buy') }));
    }));
    list.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
      const me2 = meRec(); const id = b.getAttribute('data-t');
      const cur = (me2 && me2.appearance && me2.appearance[id] !== undefined) ? !!me2.appearance[id] : true;
      const ch = {}; ch[id] = !cur; applyWardrobe(ch);
    }));
    list.querySelectorAll('[data-dye]').forEach((b) => b.addEventListener('click', () => {
      const ch = {}; ch[b.getAttribute('data-slot')] = b.getAttribute('data-dye'); applyWardrobe(ch);
    }));
    list.querySelectorAll('[data-buydye]').forEach((b) => b.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'buy_dye', dye: b.getAttribute('data-buydye') }));
    }));
    list.querySelectorAll('[data-namecolor]').forEach((b) => b.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'set_name_color', colorId: b.getAttribute('data-namecolor') }));
    }));
    list.querySelectorAll('[data-aura]').forEach((b) => b.addEventListener('click', () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'set_aura', auraId: b.getAttribute('data-aura') }));
    }));
  }
  function applyWardrobe(change) {
    const me = meRec(); if (!me) return;
    const def = WARDROBE[me.charId]; if (!def) return;
    const next = Object.assign({ weapon: def.defaultWeapon }, me.appearance || {}, change);
    for (const t of def.toggles) if (next[t.id] === undefined) next[t.id] = true;
    me.appearance = next;
    refreshPlayerAppearance(me); // rebuild your own rig immediately
    renderWardrobe();
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'set_appearance', appearance: next }));
  }
  window.__renderWardrobe = renderWardrobe; // so the ack handler can refresh it
  window.__applyWardrobe = applyWardrobe;    // so look_bought can auto-equip the new look
  const mw = document.getElementById('menuWardrobe');
  if (mw) mw.addEventListener('click', () => { document.getElementById('menuSheet').classList.add('hidden'); renderWardrobe(); const m = document.getElementById('wardrobeModal'); if (m) m.classList.remove('hidden'); });
  const cb = document.getElementById('wardrobeCloseBtn');
  if (cb) cb.addEventListener('click', () => { const m = document.getElementById('wardrobeModal'); if (m) m.classList.add('hidden'); });
})();

// == In-game bug reporter ====================================================
// A "Report a Bug" menu entry players can use to tell us what broke. The server
// attaches their identity + context (class, room, level, device, IP); the
// client adds the build hash and a snapshot of recent client errors so a report
// carries "what was on fire just now" without the player having to know any of
// it. Pure dev-feedback channel — never touches moderation or the audit log.
(function installBugReporter() {
  function buildHash() {
    try {
      const s = document.querySelector('script[src*="client.js"]');
      const m = s && /[?&]v=([\w.-]+)/.exec(s.getAttribute('src') || '');
      return m ? m[1] : '';
    } catch (_e) { return ''; }
  }
  function open() {
    const sheet = document.getElementById('menuSheet'); if (sheet) sheet.classList.add('hidden');
    const m = document.getElementById('bugModal'); if (!m) return;
    const meta = document.getElementById('bugMeta');
    if (meta) {
      let errs = []; try { errs = (window.__recentErrors && window.__recentErrors()) || []; } catch (_e) {}
      const b = buildHash();
      meta.textContent = '🔒 We attach: your name, class, room, and build' + (b ? (' ' + b) : '') +
        (errs.length ? (' · ' + errs.length + ' recent error' + (errs.length === 1 ? '' : 's')) : '') + '.';
    }
    const err = document.getElementById('bugText'); if (err) err.value = '';
    const sb = document.getElementById('bugSendBtn'); if (sb) { sb.disabled = false; sb.textContent = 'Send report'; }
    m.classList.remove('hidden');
    if (err) try { err.focus(); } catch (_e) {}
  }
  function close() { const m = document.getElementById('bugModal'); if (m) m.classList.add('hidden'); }
  function send() {
    const ta = document.getElementById('bugText');
    const text = ta ? String(ta.value || '').trim() : '';
    if (!text) { setUnlockToast('Please add a short description of the bug first.'); if (ta) try { ta.focus(); } catch (_e) {} return; }
    let errs = []; try { errs = (window.__recentErrors && window.__recentErrors()) || []; } catch (_e) {}
    const sb = document.getElementById('bugSendBtn'); if (sb) { sb.disabled = true; sb.textContent = 'Sending…'; }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'bug_report', text: text.slice(0, 1000), build: buildHash(), errors: errs.slice(0, 5) }));
    } else {
      setUnlockToast('⚠️ Not connected — reconnect and try again.');
      if (sb) { sb.disabled = false; sb.textContent = 'Send report'; }
    }
  }
  const mb = document.getElementById('menuBug'); if (mb) mb.addEventListener('click', open);
  const cl = document.getElementById('bugCloseBtn'); if (cl) cl.addEventListener('click', close);
  const sn = document.getElementById('bugSendBtn'); if (sn) sn.addEventListener('click', send);
  window.__closeBugModal = close;
})();

// == Full-screen town map (press M) ==========================================
// A top-down overview of the town drawn from the authoritative world geometry
// the server sends on join (world.buildings + bounds + spawn), plus the live
// positions already tracked for every player. Answers "where is everything?"
// — the exact confusion a veteran hit on Reddit about the auction house. No new
// server data: it reads what the client already has.
(function installTownMap() {
  let timer = null;
  // Outdoor NPC / landmark markers, keyed by the kiosk's `npc` type (the live
  // OUTDOOR_KIOSKS list is the source of truth for positions). 'npc' is a town
  // quest-giver villager (its own name is shown). Portals are drawn separately.
  const KIOSK_MARKERS = {
    npc:       { icon: '❗', role: null,         color: '#ffd479' },
    legend:    { icon: '🌒', role: 'Peddler',    color: '#d7b8ff' },
    locksmith: { icon: '🔑', role: 'Locksmith',  color: '#e8d9a8' },
    board:     { icon: '🏆', role: 'Town Board', color: '#9ee37d' },
    delve:     { icon: '🕳️', role: 'Weekly Delve', color: '#ff8a8a' },
    moot:      { icon: '🕸️', role: 'Coven Hagstone', color: '#b98aff' }
  };
  // One-line "what's inside" captions per building. Keep in sync with the
  // building NPCs in client/furniture.js + server NPC_WHEREABOUTS.
  const BUILDING_SVC = {
    bank:    '🏦 Banker · Auctioneer',
    cafe:    '☕ Tavern · quests',
    library: '📚 Lore · quests',
    hall:    '🏛️ Armorer · quests',
    arcade:  '🎮 Games (Town Pass)',
    lounge:  '👻 Séances (Town Pass)'
  };
  // Major Wilds landmarks. Keep in sync with wildsFlatZones() positions above.
  // (The 6 named camp NPCs come from WILDS_NPCS and campfires from
  // WILDS_CAMPFIRES — referenced live, not duplicated here.)
  const WILDS_POI = [
    { x: 5000, y: 3000, kind: 'village', label: 'The Village' },
    { x: 2200, y: 5000, kind: 'camp', color: '#b5633a', label: 'Unbound Camp' },
    { x: 7800, y: 5000, kind: 'camp', color: '#5f7fa0', label: 'Thornwarden Camp' },
    { x: 2000, y: 2000, kind: 'cave', label: "Witch's Cave" },
    { x: 3000, y: 3000, kind: 'manor', label: 'Coven Manor (coven only)' },
    { x: 6500, y: 6200, kind: 'tree', label: 'The Great Tree' }
  ];
  const EMBER_SAFE_R = 1800; // keep in sync with server EMBER_SAFE_RADIUS
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // Shrink a label until it fits `maxW` (floor 9px), else hard-truncate.
  function fitText(ctx, text, maxW, base) {
    let px = base;
    for (; px >= 9; px--) { ctx.font = '600 ' + px + 'px system-ui, sans-serif'; if (ctx.measureText(text).width <= maxW) return px; }
    ctx.font = '600 9px system-ui, sans-serif';
    return 9;
  }
  // Per-building sprite recipe: which silhouette + real-model colors to draw
  // on the map, so each lot shows a little 2.5-D version of the actual KayKit
  // building instead of a flat colored box. (arch + palette; keep in sync with
  // KK_MODELS archetypes.)
  const BUILDING_SPEC = {
    cafe:    { arch: 'barrel',     p: { wall: '#9a6a34', roof: '#7c4a26', trim: '#2e2013', stone: '#9aa0a8' } },
    library: { arch: 'steeple',    p: { wall: '#e9e4d6', roof: '#3f6aa8', trim: '#262b36' } },
    arcade:  { arch: 'timber',     p: { wall: '#e4dcc6', roof: '#c8702e', trim: '#5f4327' } },
    lounge:  { arch: 'stonetower', p: { wall: '#8b9099', roof: '#7c3030', trim: '#43474e' } },
    hall:    { arch: 'keep',       p: { wall: '#8b9099', roof: '#b23b2b', trim: '#43474e' } },
    bank:    { arch: 'steeple',    p: { wall: '#efe7cf', roof: '#d7a52c', trim: '#2a2a2f' } }
  };
  // Rough height-as-multiple-of-s per archetype, used to shrink a sprite that
  // would otherwise clip the top edge of the map canvas (e.g. Town Hall).
  const BUILDING_HF = { barrel: 1.5, timber: 1.3, steeple: 1.5, keep: 2.0, stonetower: 1.6 };
  // Lighten/darken a hex color by factor f (returns an rgb() string).
  function shade(hex, f) {
    const s = String(hex).replace('#', '');
    const n = parseInt(s.length === 3 ? s.replace(/(.)/g, '$1$1') : s, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, r * f | 0)); g = Math.max(0, Math.min(255, g * f | 0)); b = Math.max(0, Math.min(255, b * f | 0));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  // Draw a small 2.5-D building whose ground point is (gx,gy), front-face width
  // s, silhouette `arch`, themed by palette `p` {wall,roof,trim,stone?}.
  function drawBuilding(ctx, gx, gy, s, arch, p) {
    const P = (q, a, b) => [q[0] + (a || 0), q[1] + (b || 0)];
    const dxk = 0.40, dyk = -0.28;
    function shadow(w) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(gx + w * 0.2, gy + w * 0.12, w * 0.78, w * 0.26, 0, 0, 7); ctx.fill(); }
    function body(bw, bh, wall) {
      const dx = bw * dxk, dy = bw * dyk;
      const FLb = [gx - bw / 2, gy], FRb = [gx + bw / 2, gy], FLt = [gx - bw / 2, gy - bh], FRt = [gx + bw / 2, gy - bh];
      ctx.strokeStyle = shade(wall, 0.45); ctx.lineWidth = 1.4;
      ctx.fillStyle = shade(wall, 0.66); ctx.beginPath(); ctx.moveTo(...FRb); ctx.lineTo(...FRt); ctx.lineTo(...P(FRt, dx, dy)); ctx.lineTo(...P(FRb, dx, dy)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = wall; ctx.beginPath(); ctx.moveTo(...FLb); ctx.lineTo(...FRb); ctx.lineTo(...FRt); ctx.lineTo(...FLt); ctx.closePath(); ctx.fill(); ctx.stroke();
      return { FLt, FRt, dx, dy };
    }
    function door(bw, bh) { ctx.fillStyle = p.trim; ctx.fillRect(gx - bw * 0.11, gy - bh * 0.42, bw * 0.22, bh * 0.42); }
    function win(x, y, w, h) { ctx.fillStyle = shade(p.roof, 1.1); ctx.fillRect(x - w / 2, y, w, h); }
    function gableRoof(b, bw, rh, roof) {
      const apF = [gx, b.FLt[1] - rh], apB = P(apF, b.dx, b.dy);
      ctx.strokeStyle = shade(roof, 0.5);
      ctx.fillStyle = shade(roof, 0.68); ctx.beginPath(); ctx.moveTo(...b.FRt); ctx.lineTo(...apF); ctx.lineTo(...apB); ctx.lineTo(...P(b.FRt, b.dx, b.dy)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(...b.FLt); ctx.lineTo(...b.FRt); ctx.lineTo(...apF); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    function cone(cx, baseY, bw, ch, roof) {
      const dx = bw * dxk, dy = bw * dyk;
      const L = [cx - bw / 2, baseY], R = [cx + bw / 2, baseY], tip = [cx, baseY - ch], tipB = P(tip, dx, dy);
      ctx.strokeStyle = shade(roof, 0.5);
      ctx.fillStyle = shade(roof, 0.66); ctx.beginPath(); ctx.moveTo(...R); ctx.lineTo(...tip); ctx.lineTo(...tipB); ctx.lineTo(...P(R, dx, dy)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(...L); ctx.lineTo(...R); ctx.lineTo(...tip); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (arch === 'barrel') {
      const R = s * 0.42, legH = s * 0.3, cyB = gy - legH - R;
      shadow(s * 0.9);
      ctx.fillStyle = shade(p.stone, 0.7); ctx.fillRect(gx - R * 0.8, gy - legH, R * 0.22, legH); ctx.fillRect(gx + R * 0.6, gy - legH, R * 0.22, legH);
      ctx.fillStyle = p.stone; ctx.fillRect(gx - R * 0.95, gy - legH - s * 0.06, R * 1.9, s * 0.08);
      const dx = R * 0.6, dy = -R * 0.42; ctx.fillStyle = shade(p.wall, 0.62); ctx.strokeStyle = p.trim; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(gx + dx, cyB + dy, R * 0.6, R, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(gx, cyB - R); ctx.lineTo(gx + dx, cyB - R + dy); ctx.moveTo(gx, cyB + R); ctx.lineTo(gx + dx, cyB + R + dy); ctx.stroke();
      ctx.fillStyle = p.wall; ctx.beginPath(); ctx.ellipse(gx, cyB, R * 0.82, R, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = shade(p.wall, 0.5); for (const fx of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(gx + fx * R * 0.82, cyB - R * 0.9); ctx.lineTo(gx + fx * R * 0.82, cyB + R * 0.9); ctx.stroke(); }
      ctx.strokeStyle = p.trim; ctx.lineWidth = 3; for (const hy of [-0.55, 0.55]) { ctx.beginPath(); ctx.ellipse(gx, cyB + hy * R, R * 0.78, R * 0.46, 0, 0, 7); ctx.stroke(); }
      ctx.lineWidth = 1.4; ctx.fillStyle = shade(p.roof, 1); ctx.strokeStyle = shade(p.roof, 0.55);
      ctx.beginPath(); ctx.moveTo(gx - R, cyB - R * 0.9); ctx.lineTo(gx + R, cyB - R * 0.9); ctx.lineTo(gx, cyB - R * 1.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      return;
    }
    if (arch === 'timber') {
      shadow(s * 0.9); const bw = s * 0.9, bh = s * 0.72; const b = body(bw, bh, p.wall);
      ctx.strokeStyle = p.trim; ctx.lineWidth = 2; ctx.strokeRect(gx - bw / 2, gy - bh, bw, bh);
      ctx.beginPath(); ctx.moveTo(gx - bw / 2, gy - bh * 0.5); ctx.lineTo(gx + bw / 2, gy - bh * 0.5);
      ctx.moveTo(gx, gy - bh); ctx.lineTo(gx, gy - bh * 0.5);
      ctx.moveTo(gx - bw / 2, gy - bh); ctx.lineTo(gx - bw * 0.2, gy - bh * 0.5);
      ctx.moveTo(gx + bw / 2, gy - bh); ctx.lineTo(gx + bw * 0.2, gy - bh * 0.5); ctx.stroke();
      win(gx - bw * 0.28, gy - bh * 0.42, bw * 0.16, bh * 0.22); win(gx + bw * 0.28, gy - bh * 0.42, bw * 0.16, bh * 0.22);
      door(bw, bh); gableRoof(b, bw, s * 0.62, p.roof);
      return;
    }
    if (arch === 'steeple') {
      shadow(s * 0.95); const bw = s * 0.8, bh = s * 0.66; const b = body(bw, bh, p.wall);
      win(gx + bw * 0.22, gy - bh * 0.5, bw * 0.16, bh * 0.3); door(bw, bh);
      gableRoof(b, bw, s * 0.42, p.roof);
      const tw = s * 0.34, tx = gx - bw * 0.5 + tw * 0.1, th = s * 0.86, dx = tw * dxk, dy = tw * dyk;
      const FLb = [tx - tw / 2, gy], FRb = [tx + tw / 2, gy], FLt = [tx - tw / 2, gy - th], FRt = [tx + tw / 2, gy - th];
      ctx.strokeStyle = shade(p.wall, 0.45); ctx.lineWidth = 1.4;
      ctx.fillStyle = shade(p.wall, 0.66); ctx.beginPath(); ctx.moveTo(...FRb); ctx.lineTo(...FRt); ctx.lineTo(...P(FRt, dx, dy)); ctx.lineTo(...P(FRb, dx, dy)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.wall; ctx.beginPath(); ctx.moveTo(...FLb); ctx.lineTo(...FRb); ctx.lineTo(...FRt); ctx.lineTo(...FLt); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = p.trim; ctx.fillRect(tx - tw * 0.16, gy - th * 0.8, tw * 0.32, th * 0.26);
      cone(tx, gy - th, tw * 1.02, s * 0.6, p.trim);
      return;
    }
    if (arch === 'keep' || arch === 'stonetower') {
      const tall = arch === 'keep'; shadow(s * 0.85);
      const bw = s * (tall ? 0.66 : 0.72), bh = s * (tall ? 1.08 : 0.92); body(bw, bh, p.wall);
      ctx.strokeStyle = shade(p.wall, 0.78); ctx.lineWidth = 1;
      for (let y = gy - bh * 0.25; y > gy - bh; y -= bh * 0.25) { ctx.beginPath(); ctx.moveTo(gx - bw / 2, y); ctx.lineTo(gx + bw / 2, y); ctx.stroke(); }
      win(gx, gy - bh * 0.55, bw * 0.14, bh * 0.2); door(bw, bh);
      if (tall) {
        ctx.fillStyle = shade(p.wall, 0.9); const n = 3, mw = bw / (n * 2 - 1);
        for (let i = 0; i < n; i++) { const mx = gx - bw / 2 + i * 2 * mw; ctx.fillRect(mx, gy - bh - s * 0.14, mw, s * 0.14); ctx.strokeStyle = shade(p.wall, 0.45); ctx.strokeRect(mx, gy - bh - s * 0.14, mw, s * 0.14); }
        cone(gx, gy - bh - s * 0.14, bw * 0.92, s * 0.78, p.roof);
        for (const sg of [-1, 1]) { const tx = gx + sg * bw * 0.52; ctx.fillStyle = shade(p.wall, 0.6); ctx.fillRect(tx - s * 0.07, gy - bh * 0.72, s * 0.14, bh * 0.72); ctx.strokeRect(tx - s * 0.07, gy - bh * 0.72, s * 0.14, bh * 0.72); cone(tx, gy - bh * 0.72, s * 0.2, s * 0.3, p.roof); }
      } else { cone(gx, gy - bh, bw * 1.06, s * 0.68, p.roof); }
      return;
    }
  }
  // A labeled marker: emoji glyph at (px,py), short label beneath.
  // A small 3-D-ish map prop (ground point gx,gy, scale s) for landmarks,
  // services, portals and quest NPCs — the marker equivalent of drawBuilding.
  function drawProp(ctx, gx, gy, s, kind, opt) {
    opt = opt || {};
    const P = (q, a, b) => [q[0] + (a || 0), q[1] + (b || 0)];
    function shadow(w, h) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(gx, gy, w || s * 0.5, h || s * 0.18, 0, 0, 7); ctx.fill(); }
    function post(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x - w / 2, y - h, w, h); ctx.strokeStyle = shade(c, 0.6); ctx.lineWidth = 1; ctx.strokeRect(x - w / 2, y - h, w, h); }
    function hut(cx, base, w, hh, wall, roof) {
      const dx = w * 0.34, dy = -w * 0.24;
      const FLb = [cx - w / 2, base], FRb = [cx + w / 2, base], FLt = [cx - w / 2, base - hh], FRt = [cx + w / 2, base - hh];
      ctx.strokeStyle = shade(wall, 0.5); ctx.lineWidth = 1.2;
      ctx.fillStyle = shade(wall, 0.66); ctx.beginPath(); ctx.moveTo(...FRb); ctx.lineTo(...FRt); ctx.lineTo(...P(FRt, dx, dy)); ctx.lineTo(...P(FRb, dx, dy)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = wall; ctx.beginPath(); ctx.moveTo(...FLb); ctx.lineTo(...FRb); ctx.lineTo(...FRt); ctx.lineTo(...FLt); ctx.closePath(); ctx.fill(); ctx.stroke();
      const apF = [cx, base - hh - w * 0.42], apB = P(apF, dx, dy);
      ctx.fillStyle = shade(roof, 0.7); ctx.beginPath(); ctx.moveTo(...FRt); ctx.lineTo(...apF); ctx.lineTo(...apB); ctx.lineTo(...P(FRt, dx, dy)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(...FLt); ctx.lineTo(...FRt); ctx.lineTo(...apF); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    function flame(cx, base, r, warm) {
      const g = ctx.createRadialGradient(cx, base - r, 1, cx, base - r, r * 1.6);
      if (warm) { g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#ff8a2a'); g.addColorStop(1, 'rgba(200,60,0,0)'); }
      else { g.addColorStop(0, '#d8fff0'); g.addColorStop(0.5, '#4fe0c0'); g.addColorStop(1, 'rgba(40,160,130,0)'); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, base - r, r, r * 1.4, 0, 0, 7); ctx.fill();
    }
    if (kind === 'npc') {
      shadow(s * 0.34);
      ctx.fillStyle = '#4a7a3c'; ctx.strokeStyle = '#2f4a26'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(gx - s * 0.2, gy); ctx.lineTo(gx - s * 0.26, gy - s * 0.42); ctx.lineTo(gx + s * 0.26, gy - s * 0.42); ctx.lineTo(gx + s * 0.2, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8b887'; ctx.beginPath(); ctx.arc(gx, gy - s * 0.56, s * 0.19, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.ellipse(gx, gy - s * 0.68, s * 0.22, s * 0.1, 0, Math.PI, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(gx, gy - s * 0.98, s * 0.16, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a2a05'; ctx.font = '700 ' + (s * 0.22 | 0) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', gx, gy - s * 0.96);
      return;
    }
    if (kind === 'legend') {
      shadow(s * 0.5);
      post(gx - s * 0.32, gy, s * 0.07, s * 0.5, '#6b4a2a'); post(gx + s * 0.32, gy, s * 0.07, s * 0.5, '#6b4a2a');
      ctx.fillStyle = '#8a6a40'; ctx.fillRect(gx - s * 0.4, gy - s * 0.28, s * 0.8, s * 0.1);
      const aw = s * 0.9; for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#b98ad8' : '#efe4f6'; ctx.beginPath(); ctx.moveTo(gx - aw / 2 + i * aw / 5, gy - s * 0.5); ctx.lineTo(gx - aw / 2 + (i + 1) * aw / 5, gy - s * 0.5); ctx.lineTo(gx - aw / 2 + (i + 0.5) * aw / 5, gy - s * 0.38); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#c9a6e8'; ctx.fillRect(gx - aw / 2, gy - s * 0.62, aw, s * 0.12);
      ctx.fillStyle = '#d7b8ff'; ctx.beginPath(); ctx.arc(gx, gy - s * 0.33, s * 0.08, 0, 7); ctx.fill(); ctx.strokeStyle = '#9b6bc0'; ctx.stroke();
      return;
    }
    if (kind === 'locksmith') {
      shadow(s * 0.3);
      ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gx, gy - s * 0.75); ctx.lineTo(gx, gy - s * 0.1); ctx.stroke();
      ctx.fillStyle = '#e8c84d'; ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = s * 0.07;
      ctx.beginPath(); ctx.arc(gx, gy - s * 0.78, s * 0.18, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2010'; ctx.beginPath(); ctx.arc(gx, gy - s * 0.78, s * 0.07, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8c84d'; ctx.fillRect(gx, gy - s * 0.26, s * 0.16, s * 0.07); ctx.fillRect(gx, gy - s * 0.16, s * 0.12, s * 0.06);
      ctx.lineCap = 'butt';
      return;
    }
    if (kind === 'board') {
      shadow(s * 0.44);
      post(gx - s * 0.26, gy, s * 0.07, s * 0.6, '#5f4327'); post(gx + s * 0.26, gy, s * 0.07, s * 0.6, '#5f4327');
      ctx.fillStyle = '#8a6a40'; ctx.strokeStyle = '#4a3320'; ctx.lineWidth = 1.4; ctx.fillRect(gx - s * 0.4, gy - s * 0.62, s * 0.8, s * 0.4); ctx.strokeRect(gx - s * 0.4, gy - s * 0.62, s * 0.8, s * 0.4);
      ctx.fillStyle = '#e8e2d2'; ctx.fillRect(gx - s * 0.3, gy - s * 0.56, s * 0.22, s * 0.14); ctx.fillRect(gx + s * 0.04, gy - s * 0.5, s * 0.24, s * 0.2);
      ctx.fillStyle = '#e8c84d'; ctx.strokeStyle = '#8a6a1a'; ctx.beginPath(); ctx.moveTo(gx - s * 0.1, gy - s * 0.66); ctx.lineTo(gx + s * 0.1, gy - s * 0.66); ctx.lineTo(gx + s * 0.05, gy - s * 0.78); ctx.lineTo(gx - s * 0.05, gy - s * 0.78); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillRect(gx - s * 0.02, gy - s * 0.66, s * 0.04, s * 0.05);
      return;
    }
    if (kind === 'delve') {
      shadow(s * 0.5); const c = '#4c4c56';
      post(gx - s * 0.3, gy, s * 0.16, s * 0.62, c); post(gx + s * 0.3, gy, s * 0.16, s * 0.62, c);
      ctx.fillStyle = shade(c, 1.1); ctx.strokeStyle = shade(c, 0.6); ctx.lineWidth = 1; ctx.fillRect(gx - s * 0.46, gy - s * 0.74, s * 0.92, s * 0.16); ctx.strokeRect(gx - s * 0.46, gy - s * 0.74, s * 0.92, s * 0.16);
      const g = ctx.createRadialGradient(gx, gy - s * 0.34, 1, gx, gy - s * 0.34, s * 0.22); g.addColorStop(0, 'rgba(150,120,255,0.7)'); g.addColorStop(1, 'rgba(90,60,160,0)');
      ctx.fillStyle = g; ctx.fillRect(gx - s * 0.22, gy - s * 0.6, s * 0.44, s * 0.5);
      return;
    }
    if (kind === 'moot') {
      shadow(s * 0.4);
      ctx.fillStyle = '#8a8a92'; ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(gx - s * 0.24, gy); ctx.lineTo(gx - s * 0.3, gy - s * 0.66); ctx.lineTo(gx - s * 0.05, gy - s * 0.82); ctx.lineTo(gx + s * 0.26, gy - s * 0.7); ctx.lineTo(gx + s * 0.22, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
      const g = ctx.createRadialGradient(gx, gy - s * 0.4, 1, gx, gy - s * 0.4, s * 0.16); g.addColorStop(0, '#d7b8ff'); g.addColorStop(1, '#5a3a8a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(gx, gy - s * 0.4, s * 0.12, s * 0.15, 0, 0, 7); ctx.fill();
      return;
    }
    if (kind === 'spawn') {
      shadow(s * 0.3);
      post(gx, gy, s * 0.06, s * 0.8, '#8a6a40');
      ctx.fillStyle = '#e8d9a8'; ctx.strokeStyle = '#b89a60'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx + s * 0.03, gy - s * 0.78); ctx.lineTo(gx + s * 0.4, gy - s * 0.66); ctx.lineTo(gx + s * 0.03, gy - s * 0.54); ctx.closePath(); ctx.fill(); ctx.stroke();
      return;
    }
    if (kind === 'wilds_portal') {
      shadow(s * 0.4);
      ctx.fillStyle = '#6a6a74'; ctx.strokeStyle = '#3a3a42'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(gx, gy - s * 0.5, s * 0.34, s * 0.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      const g = ctx.createRadialGradient(gx, gy - s * 0.5, 1, gx, gy - s * 0.5, s * 0.3); g.addColorStop(0, '#bfe0ff'); g.addColorStop(0.5, '#7a6bff'); g.addColorStop(1, '#3a2a8a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(gx, gy - s * 0.5, s * 0.24, s * 0.4, 0, 0, 7); ctx.fill();
      return;
    }
    if (kind === 'ember_temple') {
      shadow(s * 0.6);
      ctx.fillStyle = '#d8d2c4'; ctx.strokeStyle = '#a8a090'; ctx.lineWidth = 1.2;
      ctx.fillRect(gx - s * 0.5, gy - s * 0.14, s * 1.0, s * 0.14); ctx.strokeRect(gx - s * 0.5, gy - s * 0.14, s * 1.0, s * 0.14);
      ctx.fillRect(gx - s * 0.38, gy - s * 0.24, s * 0.76, s * 0.1);
      post(gx - s * 0.32, gy - s * 0.24, s * 0.1, s * 0.42, '#cfc8ba'); post(gx + s * 0.32, gy - s * 0.24, s * 0.1, s * 0.42, '#cfc8ba');
      const g = ctx.createRadialGradient(gx, gy - s * 0.46, 1, gx, gy - s * 0.46, s * 0.26); g.addColorStop(0, '#ffd0a0'); g.addColorStop(0.5, '#ff5a2a'); g.addColorStop(1, '#7a1500');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(gx, gy - s * 0.46, s * 0.17, s * 0.24, 0, 0, 7); ctx.fill();
      return;
    }
    if (kind === 'village') {
      shadow(s * 0.55);
      hut(gx + s * 0.22, gy, s * 0.5, s * 0.4, '#b98a5a', '#9a5a30');
      hut(gx - s * 0.14, gy, s * 0.62, s * 0.5, '#cdb088', '#b5673a');
      return;
    }
    if (kind === 'camp') {
      shadow(s * 0.55); const c = opt.color || '#b5633a';
      ctx.fillStyle = c; ctx.strokeStyle = shade(c, 0.55); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(gx - s * 0.5, gy); ctx.lineTo(gx, gy - s * 0.66); ctx.lineTo(gx + s * 0.5, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = shade(c, 0.72); ctx.beginPath(); ctx.moveTo(gx, gy - s * 0.66); ctx.lineTo(gx + s * 0.5, gy); ctx.lineTo(gx, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(c, 0.38); ctx.beginPath(); ctx.moveTo(gx, gy - s * 0.4); ctx.lineTo(gx - s * 0.12, gy); ctx.lineTo(gx + s * 0.12, gy); ctx.closePath(); ctx.fill();
      post(gx, gy - s * 0.66, s * 0.03, s * 0.16, '#5f4327');
      ctx.fillStyle = shade(c, 1.35); ctx.beginPath(); ctx.moveTo(gx + s * 0.015, gy - s * 0.82); ctx.lineTo(gx + s * 0.26, gy - s * 0.76); ctx.lineTo(gx + s * 0.015, gy - s * 0.7); ctx.closePath(); ctx.fill();
      flame(gx - s * 0.42, gy, s * 0.1, true);
      return;
    }
    if (kind === 'cave') {
      shadow(s * 0.55);
      ctx.fillStyle = '#5a5560'; ctx.strokeStyle = '#36323c'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(gx - s * 0.5, gy); ctx.quadraticCurveTo(gx - s * 0.5, gy - s * 0.7, gx, gy - s * 0.72); ctx.quadraticCurveTo(gx + s * 0.55, gy - s * 0.68, gx + s * 0.5, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#17131c'; ctx.beginPath(); ctx.moveTo(gx - s * 0.18, gy); ctx.quadraticCurveTo(gx - s * 0.18, gy - s * 0.4, gx, gy - s * 0.42); ctx.quadraticCurveTo(gx + s * 0.18, gy - s * 0.4, gx + s * 0.18, gy); ctx.closePath(); ctx.fill();
      flame(gx, gy - s * 0.04, s * 0.09, true);
      return;
    }
    if (kind === 'manor') {
      shadow(s * 0.5);
      hut(gx + s * 0.06, gy, s * 0.66, s * 0.56, '#54506a', '#3a2f52');
      post(gx - s * 0.34, gy, s * 0.26, s * 0.95, '#5e5a76');
      ctx.fillStyle = '#3a2f52'; ctx.strokeStyle = '#2a2240'; ctx.beginPath(); ctx.moveTo(gx - s * 0.49, gy - s * 0.95); ctx.lineTo(gx - s * 0.19, gy - s * 0.95); ctx.lineTo(gx - s * 0.34, gy - s * 1.22); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd77a'; ctx.fillRect(gx - s * 0.4, gy - s * 0.6, s * 0.12, s * 0.14);
      return;
    }
    if (kind === 'tree') {
      shadow(s * 0.5);
      post(gx, gy, s * 0.14, s * 0.4, '#5f4327');
      ctx.fillStyle = '#3f7a46'; ctx.strokeStyle = '#2c5632'; ctx.lineWidth = 1.2;
      for (const c of [[-0.22, -0.5, 0.3], [0.22, -0.52, 0.3], [0, -0.72, 0.36], [0, -0.5, 0.34]]) { ctx.beginPath(); ctx.arc(gx + c[0] * s, gy + c[1] * s, c[2] * s, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#53934f'; for (const c of [[-0.14, -0.66, 0.16], [0.16, -0.6, 0.14]]) { ctx.beginPath(); ctx.arc(gx + c[0] * s, gy + c[1] * s, c[2] * s, 0, 7); ctx.fill(); }
      return;
    }
    if (kind === 'campfire') {
      shadow(s * 0.4);
      ctx.strokeStyle = '#5f4327'; ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(gx - s * 0.3, gy); ctx.lineTo(gx + s * 0.3, gy - s * 0.08); ctx.moveTo(gx - s * 0.3, gy - s * 0.08); ctx.lineTo(gx + s * 0.3, gy); ctx.stroke(); ctx.lineCap = 'butt';
      flame(gx, gy - s * 0.02, s * 0.22, true);
      return;
    }
    if (kind === 'haven') {
      shadow(s * 0.4);
      post(gx, gy, s * 0.12, s * 0.5, '#8a8f98');
      ctx.fillStyle = '#b7bcc4'; ctx.strokeStyle = '#6a6f78'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(gx, gy - s * 0.5, s * 0.2, s * 0.09, 0, 0, 7); ctx.fill(); ctx.stroke();
      flame(gx, gy - s * 0.5, s * 0.2, false);
      return;
    }
    if (kind === 'boss') {
      shadow(s * 0.45);
      post(gx, gy, s * 0.1, s * 0.6, '#2a2228');
      ctx.fillStyle = '#e6e0d4'; ctx.strokeStyle = '#8a8276'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(gx, gy - s * 0.72, s * 0.24, Math.PI, 2 * Math.PI); ctx.lineTo(gx + s * 0.16, gy - s * 0.5); ctx.lineTo(gx - s * 0.16, gy - s * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(gx - s * 0.09, gy - s * 0.74, s * 0.055, 0, 7); ctx.arc(gx + s * 0.09, gy - s * 0.74, s * 0.055, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a2228'; ctx.fillRect(gx - s * 0.03, gy - s * 0.56, s * 0.02, s * 0.06); ctx.fillRect(gx + s * 0.01, gy - s * 0.56, s * 0.02, s * 0.06);
      return;
    }
    if (kind === 'ember_crag') {
      shadow(s * 0.5);
      ctx.fillStyle = '#2e2622'; ctx.strokeStyle = '#120d0a'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(gx - s * 0.4, gy); ctx.lineTo(gx - s * 0.22, gy - s * 0.6); ctx.lineTo(gx + s * 0.06, gy - s * 0.78); ctx.lineTo(gx + s * 0.34, gy - s * 0.5); ctx.lineTo(gx + s * 0.42, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(gx - s * 0.1, gy); ctx.lineTo(gx + s * 0.02, gy - s * 0.4); ctx.lineTo(gx - s * 0.04, gy - s * 0.56); ctx.stroke();
      const g = ctx.createRadialGradient(gx, gy - s * 0.2, 1, gx, gy - s * 0.2, s * 0.3); g.addColorStop(0, 'rgba(255,120,30,0.5)'); g.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = g; ctx.fillRect(gx - s * 0.4, gy - s * 0.5, s * 0.8, s * 0.5);
      return;
    }
  }
  // Prop marker centered on (px,py) with a short label beneath, at scale s.
  function propMarker(ctx, px, py, kind, label, color, s, opt) {
    const gy = py + s * 0.2;
    drawProp(ctx, px, gy, s, kind, opt);
    if (label) {
      ctx.fillStyle = color || '#cfc3e8'; ctx.font = '600 9px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(label, px, gy + 5);
    }
  }
  // Dots for everyone else in `room`, then the teal "You" marker.
  function drawPlayers(ctx, PX, PY, room) {
    for (const id in players) {
      const p = players[id];
      if (!p || id === myId || p.room !== room || typeof p.x !== 'number') continue;
      ctx.fillStyle = '#b98aff'; ctx.beginPath(); ctx.arc(PX(p.x), PY(p.y), 4, 0, Math.PI * 2); ctx.fill();
    }
    if (me && me.room === room && typeof me.x === 'number') {
      const px = PX(me.x), py = PY(me.y);
      ctx.strokeStyle = 'rgba(94,231,192,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#5ee7c0'; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5ee7c0'; ctx.font = '700 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('You', px, py - 11);
    }
  }
  // Which zone the map should show, and the geometry + title for it.
  function activeZone() {
    const r = me && me.room;
    if (r === 'wilds' && typeof world2 !== 'undefined' && world2) {
      return { key: 'wilds', W: world2.width, H: world2.height, bg: '#161022', title: '🗺️ The Wilds' };
    }
    if (r === 'ember_wastes' && typeof EMBER_WORLD !== 'undefined' && EMBER_WORLD) {
      return { key: 'ember', W: EMBER_WORLD.width, H: EMBER_WORLD.height, bg: '#1c0e0a', title: '🗺️ The Ember Wastes' };
    }
    if (world && world.buildings) return { key: 'town', W: world.width, H: world.height, bg: '#10211a', title: '🗺️ Thornreach — Town Map' };
    return null;
  }
  function render() {
    const canvas = document.getElementById('mapCanvas');
    const wrap = document.getElementById('mapCanvasWrap');
    const zone = activeZone();
    if (!canvas || !wrap || !zone) return;
    const W = zone.W, H = zone.H, aspect = W / H;
    let cw = wrap.clientWidth, ch = cw / aspect;
    if (ch > wrap.clientHeight) { ch = wrap.clientHeight; cw = ch * aspect; }
    if (cw < 10 || ch < 10) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = cw / W, sy = ch / H;
    const PX = (x) => x * sx, PY = (y) => y * sy;
    const t = document.getElementById('mapTitle'); if (t) t.textContent = zone.title;

    // Ground + faint grid.
    ctx.fillStyle = zone.bg; ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = 'rgba(126,240,195,0.05)'; ctx.lineWidth = 1;
    const step = W / 8;
    for (let gx = 0; gx <= W; gx += step) { ctx.beginPath(); ctx.moveTo(PX(gx), 0); ctx.lineTo(PX(gx), ch); ctx.stroke(); }
    for (let gy = 0; gy <= H; gy += step) { ctx.beginPath(); ctx.moveTo(0, PY(gy)); ctx.lineTo(cw, PY(gy)); ctx.stroke(); }

    if (zone.key === 'town') drawTown(ctx, PX, PY, sx, sy, cw, ch);
    else if (zone.key === 'wilds') drawWilds(ctx, PX, PY, cw, ch);
    else if (zone.key === 'ember') drawEmber(ctx, PX, PY, cw, ch);
  }
  function drawTown(ctx, PX, PY, sx, sy, cw, ch) {
    const meRoom = me && me.room;
    for (const b of world.buildings) {
      const bx = PX(b.x), by = PY(b.y), bw = b.w * sx, bh = b.h * sy;
      const here = meRoom === b.id;
      const cx = bx + bw / 2, cy = by + bh / 2;
      const spec = BUILDING_SPEC[b.id] ||
        { arch: 'timber', p: { wall: b.color || '#8a8f98', roof: shade(b.color || '#8a8f98', 0.6), trim: '#2a2a2f' } };
      // Faint footprint "lot" so the building's real location + size still read.
      ctx.fillStyle = 'rgba(126,240,195,0.045)';
      ctx.strokeStyle = here ? '#5ee7c0' : 'rgba(200,220,255,0.12)';
      ctx.lineWidth = here ? 2.5 : 1;
      roundRect(ctx, bx, by, bw, bh, 6); ctx.fill(); ctx.stroke();
      // The 2.5-D building sprite, centered on the lot and shrunk if it would
      // otherwise poke past the top edge of the map canvas.
      const gy = cy + bh * 0.18;
      let s = Math.max(24, Math.min(bw * 0.5, bh * 0.78, 54));
      const avail = gy - 4, need = s * (BUILDING_HF[spec.arch] || 1.5);
      if (need > avail) s = Math.max(20, s * avail / need);
      drawBuilding(ctx, cx - s * 0.14, gy, s, spec.arch, spec.p);
      // Name + service caption beneath the lot.
      const parts = String(b.name || '').split(' ');
      const emoji = parts[0]; const name = parts.slice(1).join(' ') || b.name;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#f3ecff';
      fitText(ctx, emoji + ' ' + name, bw + 36, 13);
      ctx.fillText(emoji + ' ' + name, cx, by + bh + 5);
      let ly = by + bh + 5 + 15;
      const svc = BUILDING_SVC[b.id];
      if (svc) {
        ctx.fillStyle = 'rgba(233,221,255,0.72)';
        fitText(ctx, svc, bw + 36, 10);
        ctx.fillText(svc, cx, ly); ly += 13;
      }
      if (here) {
        ctx.fillStyle = '#5ee7c0'; ctx.font = '700 10px system-ui, sans-serif';
        ctx.fillText("● you're inside", cx, ly);
      }
    }
    const propS = Math.max(22, Math.min(cw * 0.028, 34));
    if (world.spawn) {
      propMarker(ctx, PX(world.spawn.x), PY(world.spawn.y), 'spawn', 'Spawn', '#e8d9a8', propS);
    }
    if (typeof world2 !== 'undefined' && world2 && world2.portalInTown) {
      propMarker(ctx, PX(world2.portalInTown.x), PY(world2.portalInTown.y), 'wilds_portal', '🌀 Wilds', '#d7b8ff', propS);
    }
    // The Torchkeepers' temple — where the Ember Wastes portal opens at night.
    if (typeof TEMPLE_PLATFORM_X !== 'undefined') {
      propMarker(ctx, PX(TEMPLE_PLATFORM_X), PY(TEMPLE_PLATFORM_Z), 'ember_temple', 'Ember Temple (night)', '#ff8a8a', propS);
    }
    if (typeof OUTDOOR_KIOSKS !== 'undefined' && Array.isArray(OUTDOOR_KIOSKS)) {
      for (const k of OUTDOOR_KIOSKS) {
        const m = KIOSK_MARKERS[k.npc];
        if (!m || typeof k.x !== 'number') continue;
        propMarker(ctx, PX(k.x), PY(k.z), k.npc, m.role || k.npcName || '', m.color, propS);
      }
    }
    drawPlayers(ctx, PX, PY, 'outside');
  }
  function drawWilds(ctx, PX, PY, cw, ch) {
    const propS = Math.max(18, Math.min(cw * 0.024, 28));
    const npcS = Math.max(16, propS * 0.82), fireS = Math.max(14, propS * 0.7);
    // Spawn / portal home (they sit together at the south edge).
    if (world2.spawn) {
      propMarker(ctx, PX(world2.spawn.x), PY(world2.spawn.y), 'wilds_portal', '🌀 Portal home', '#d7b8ff', propS);
    }
    // Landmark props; seed the label-placement list so NPC names below won't
    // collide with them.
    const placed = [];
    for (const poi of WILDS_POI) {
      propMarker(ctx, PX(poi.x), PY(poi.y), poi.kind, poi.label, '#cbbdf0', propS, { color: poi.color });
      placed.push({ x: PX(poi.x), y: PY(poi.y) + propS * 0.2 + 5 });
    }
    // Campfires: prop only — five identical "Campfire" labels were just noise.
    if (typeof WILDS_CAMPFIRES !== 'undefined') {
      for (const f of WILDS_CAMPFIRES) drawProp(ctx, PX(f.x), PY(f.y) + fireS * 0.2, fireS, 'campfire');
    }
    // NPCs: villager props at their true spots, then names stacked downward so
    // the tight camp clusters read as a clean list instead of a tangle.
    if (typeof WILDS_NPCS !== 'undefined') {
      for (const n of WILDS_NPCS) drawProp(ctx, PX(n.x), PY(n.y) + npcS * 0.2, npcS, 'npc');
      ctx.font = '600 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffd479';
      const list = WILDS_NPCS.map((n) => ({ name: n.name, x: PX(n.x), y: PY(n.y) + npcS * 0.2 })).sort((a, b) => a.y - b.y || a.x - b.x);
      for (const it of list) {
        let ly = it.y + 6, guard = 0;
        while (placed.some((p) => Math.abs(p.x - it.x) < 60 && Math.abs(p.y - ly) < 11) && guard++ < 14) ly += 11;
        placed.push({ x: it.x, y: ly });
        ctx.fillText(it.name, it.x, ly);
      }
    }
    drawPlayers(ctx, PX, PY, 'wilds');
  }
  function drawEmber(ctx, PX, PY, cw, ch) {
    const emberPropS = Math.max(18, Math.min(cw * 0.024, 28));
    const sp = EMBER_WORLD.spawn;
    // Safe haven ring around spawn.
    if (sp) {
      const px = PX(sp.x), py = PY(sp.y), rr = EMBER_SAFE_R * (cw / EMBER_WORLD.width);
      ctx.fillStyle = 'rgba(126,240,195,0.07)'; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(126,240,195,0.35)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      propMarker(ctx, px, py, 'haven', 'Safe haven', '#7ef0c3', emberPropS);
    }
    // Named POIs streamed in on entry (warlord = the boss).
    if (typeof emberLandmarks !== 'undefined' && Array.isArray(emberLandmarks)) {
      for (const lm of emberLandmarks) {
        if (typeof lm.x !== 'number') continue;
        propMarker(ctx, PX(lm.x), PY(lm.y), lm.warlord ? 'boss' : 'ember_crag', lm.name || '', lm.warlord ? '#ff8a8a' : '#e0b84a', lm.warlord ? emberPropS * 1.15 : emberPropS);
      }
    }
    drawPlayers(ctx, PX, PY, 'ember_wastes');
    ctx.fillStyle = 'rgba(255,160,140,0.75)'; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('⚔️ Open PvP — anyone may strike you outside the haven', cw / 2, ch - 8);
  }
  function open() {
    if (!activeZone()) { setUnlockToast('The map loads once you’re in the world.'); return; }
    const sheet = document.getElementById('menuSheet'); if (sheet) sheet.classList.add('hidden');
    const m = document.getElementById('mapModal'); if (!m) return;
    Modals.set('mapModalOpen', true);
    m.classList.remove('hidden');
    render();
    if (timer) clearInterval(timer);
    timer = setInterval(render, 500); // live player dots while open
  }
  function close() {
    const m = document.getElementById('mapModal'); if (m) m.classList.add('hidden');
    Modals.set('mapModalOpen', false);
    if (timer) { clearInterval(timer); timer = null; }
  }
  function toggle() { Modals.isOpen('mapModalOpen') ? close() : open(); }
  window.__toggleTownMap = toggle;
  window.__closeTownMap = close;
  const mi = document.getElementById('menuMap'); if (mi) mi.addEventListener('click', open);
  const cb = document.getElementById('mapCloseBtn'); if (cb) cb.addEventListener('click', close);
  window.addEventListener('resize', () => { if (Modals.isOpen('mapModalOpen')) render(); });
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
const _ttSource = document.getElementById('ttSource');
const _ttUses = document.getElementById('ttUses');
// Items the Garden will let you sow — learned from garden_state (so the tooltip
// can say "Plant it" once you've visited your beds at least once).
const gardenPlantable = new Set();

// Everything the player can DO with an item, derived from the same catalogs the
// Garden / Cauldron / Workshop menus use — so the inventory tooltip answers
// "what is this for?" instead of leaving a material looking like dead weight.
function itemUses(itemId, item) {
  const uses = [];
  if (item.slot) uses.push('🧤 Equip — ' + (SLOT_LABELS[item.slot] || item.slot) + ' slot');
  if (PLANT_EFFECTS.has(itemId)) uses.push('✨ Use for its effect');
  if (gardenPlantable.has(itemId)) uses.push('🌱 Plant it in the Garden');
  // Resolve a recipe's output to its readable catalog name (brews carry one
  // directly; crafts name their output via `result`). Prettify is a safety net
  // for any id the catalog hasn't got, so nothing ever shows a raw variable.
  const prettyId = (id) => String(id).replace(/^cs_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const nameFor = (id) => (ITEM_CATALOG[id] && ITEM_CATALOG[id].name) || prettyId(id);
  const joinNames = (names) => names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '');
  const brews = POTION_RECIPES_CLIENT.filter(r => (r.ingredients || []).some(i => i.id === itemId)).map(r => r.name || nameFor(r.id));
  if (brews.length) uses.push('🧪 Cauldron ingredient — brews ' + joinNames(brews));
  const crafts = (craftRecipesClient || []).filter(r => (r.ingredients || []).some(i => i.id === itemId)).map(r => nameFor(r.result || r.id));
  if (crafts.length) uses.push('🔨 Workshop material — forges ' + joinNames(crafts));
  if (!uses.length) uses.push('🏦 Nothing to do here — deposit or auction it at the Bank');
  return uses;
}
// Where to find each crafting material — shown as a "📍" line in the item
// tooltip (and on the Workshop ingredient chips). Derived from the real loot
// tables (data/gameConstants.js), the Ember Wastes harvest nodes and warlord
// drops (server.js), and the refine tree (data/craftingTree.js); keep in sync
// if those move. Only materials that are crafting inputs need an entry.
const MATERIAL_SOURCES = {
  fur_scrap:      'Common drop from Wilds beasts & critters',
  animal_pelt:    'Drops from Wilds beasts — bog brutes, duskfawn, boars',
  bone_shard:     'Drops from undead — crows, wights, rot swarms',
  shadow_essence: 'Drops from Wilds shades, wisps & hexers',
  glimmerdust:    'Drops from embermoths in the Wilds',
  iron_ore:       'Drops from bramble boars in the Wilds',
  dragon_scale:   'Rare drop from Ember Wastes elites & the warlord boss',
  emberbloom:     'Harvested at Ember Wastes nodes (Cinder Bazaar, Emberfall Caldera)',
  cinder_salt:    'Harvested at Ember Wastes nodes (Charhold Keep, the Great Ossuary)',
  cured_leather:  'Crafted here: 3× Fur Scrap + Animal Pelt',
  tempered_ingot: 'Crafted here: 2× Iron Ore + Bone Shard',
  spirit_thread:  'Crafted here: 2× Shadow Essence + Glimmerdust',
  ember_glass:    'Crafted here: 2× Emberbloom + 2× Cinder-Salt',
};
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
  _ttName.innerHTML    = glyphHTML(item.iconKey || item.icon, 'ttGi') + '  ' + escHtml(item.name);
  _ttSlot.textContent  = item.slot ? (SLOT_LABELS[item.slot] || item.slot) : 'Item';
  const lines = [];
  if (item.atk) lines.push('⚔️ ATK  +' + item.atk);
  if (item.def) lines.push('🛡️ DEF  +' + item.def);
  if (item.spd) lines.push('⚡ SPD  +' + item.spd + '%');
  _ttStats.innerHTML = lines.join('<br>');
  _ttDesc.textContent = item.desc || '';
  _ttDesc.style.display = item.desc ? '' : 'none';
  if (_ttSource) _ttSource.textContent = MATERIAL_SOURCES[itemId] ? ('📍 ' + MATERIAL_SOURCES[itemId]) : '';
  if (_ttUses) _ttUses.innerHTML = itemUses(itemId, item).map((u) => `<span class="ttUse">${u}</span>`).join('');
  _tt.classList.remove('hidden');
  _positionTooltip(e);
}

function showActionTooltip(e, action) {
  if (!_tt || !action) return;
  _ttOwner = (e && e.currentTarget) || null;
  _ttName.innerHTML    = glyphHTML(action.iconKey || action.icon, 'ttGi') + '  ' + escHtml(action.name);
  _ttSlot.textContent  = KIND_LABELS[action.kind] || (action.kind || '');
  _ttStats.innerHTML   = '';
  _ttDesc.textContent  = action.description || '';
  _ttDesc.style.display = action.description ? '' : 'none';
  if (_ttSource) _ttSource.textContent = '';
  if (_ttUses) _ttUses.innerHTML = '';
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
    const _svg = uiIcon(id);
    if (_svg) { icon.classList.add('hbGi'); icon.innerHTML = _svg; } else { icon.textContent = atk.icon; }
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

// Maps an ability to its witchy cast sound by what it actually DOES (effect),
// so a summon rumbles, a heal shimmers, a hex falls, a ward hums. Damage/leech
// keep the generic cast whoosh — their impact is voiced separately by hit_fx.
let lastCastAtk = null;
let lastCastId = null; // the ability id of the last cast — lets sfxForAbility pick a per-ability sound
function sfxForAbility(atk, id) {
  if (!atk) return 'cast';
  // Per-ability sound: every ability id doubles as a sound id (they're globally
  // unique), so the moment a bespoke clip for this ability has been generated
  // and loaded, it wins — that's how the "every action is its own sound" pass
  // lights up incrementally. Until an ability's clip exists, sfxAvailable is
  // false and we fall through to the generic effect-bucket below (no silence).
  if (id && typeof sfxAvailable === 'function' && sfxAvailable(id)) return id;
  // Werewolf howls get their own feral cue, whatever their mechanical effect.
  if (atk.effect === 'howl_location' || /howl/i.test(atk.name || '')) return 'howl';
  switch (atk.effect) {
    case 'summon': return 'summon';
    case 'heal': return 'heal';
    case 'leech': return (typeof sfxAvailable === 'function' && sfxAvailable('siphon')) ? 'siphon' : 'curse';
    case 'veil': return 'ward';
    case 'reveal': case 'intel_sweep': case 'camera': case 'spyglass': return 'reveal';
    case 'meditate': case 'cloak': case 'evade': return 'ward';
    case 'trap': return 'curse';
    case 'status':
      if (atk.kind === 'self') return atk.statusType === 'regen' ? 'heal' : (atk.statusType === 'giant' ? 'buff' : 'ward');
      return 'curse';
    default: return 'cast'; // damage / leech-strike / utility — whoosh, impact via hit_fx
  }
}

function castFromHotbar(id, aim) {
  if (!myActionCatalog || !myActionMsgType) return;
  const atk = myActionCatalog[id];
  if (!atk) return;
  lastCastAtk = atk; // remembered so the result handler voices the right sound
  lastCastId = id;   // ...and its id, so a per-ability sound can be chosen
  if (actionOnCooldown(id)) {
    setUnlockToast(myActionMsgType === 'cast_spell' ? 'Your magic needs to recharge a moment.' : 'Still recovering — wait a moment.');
    return;
  }
  cancelTargeting(); // a hotbar press means "do this nearest-target cast now", not "wait for my next click"
  const payload = { type: myActionMsgType, [myActionIdField]: id };
  // `aim` (mobile cast-on-release) overrides the default nearest-target pick:
  // { target: {id,targetType} } for entity casts, { groundPt: {x,z} } for
  // ground-placed ones. Absent → the original nearest-target / at-your-feet.
  if (atk.kind === 'targeted' || atk.kind === 'reveal') {
    const damage = atk.effect === 'damage' || atk.effect === 'leech';
    let target = aim && aim.target ? aim.target : null;
    if (!target) {
      if (damage) target = nearestAttackable();
      else { const p = nearestOtherPlayer(); target = p ? { id: p.id, targetType: 'player' } : null; }
    }
    if (!target) { setUnlockToast('No one else is here to target.'); return; }
    payload.targetId = target.id;
    if (target.targetType && target.targetType !== 'player') payload.targetType = target.targetType;
  } else if (atk.kind === 'building') {
    const building = nearestBuilding();
    if (!building) { setUnlockToast('No building nearby.'); return; }
    payload.buildingId = building.id;
  } else if (atk.kind === 'ground') {
    if (aim && aim.groundPt) {
      const w = sceneToWorldPos(me.room, aim.groundPt.x, aim.groundPt.z);
      payload.x = w.x; payload.y = w.y;
    } else {
      // No aim → drop the sigil at the Witch's own feet (click-to-place in
      // handleCanvasClick still aims it on desktop).
      payload.x = me.x; payload.y = me.y;
    }
  }
  ws.send(JSON.stringify(payload));
  triggerAttackAnim();
  startActionCooldown(id);
}

// ── Cast-on-release aiming (mobile) ─────────────────────────────────────────
// Press an ability, drag to aim — the nearest entity to your finger locks on
// (or the ground point, for placed spells) — release to fire. A quick tap
// keeps the old nearest-target quick-cast; a still hold is the read-peek
// (attachAbilityPeek, via abilityPeekSwallowUntil). The joystick is a separate
// touch on a separate element, so aiming and moving never fight.
let _aimReticle = null, _aimRing = null;
function ensureAimUI() {
  if (_aimReticle) return;
  const layer = document.getElementById('fxLayer');
  if (!layer) return;
  _aimReticle = document.createElement('div'); _aimReticle.className = 'aimReticle hidden'; layer.appendChild(_aimReticle);
  _aimRing = document.createElement('div'); _aimRing.className = 'aimRing hidden'; layer.appendChild(_aimRing);
}
function hideAimUI() { if (_aimReticle) _aimReticle.classList.add('hidden'); if (_aimRing) _aimRing.classList.add('hidden'); }
function showAimUI(cx, cy, ringPos, kind) {
  ensureAimUI();
  if (_aimReticle) { _aimReticle.classList.remove('hidden'); _aimReticle.style.left = cx + 'px'; _aimReticle.style.top = cy + 'px'; _aimReticle.dataset.kind = kind || 'self'; }
  if (_aimRing) {
    if (ringPos && ringPos.visible !== false) { _aimRing.classList.remove('hidden'); _aimRing.style.left = ringPos.x + 'px'; _aimRing.style.top = ringPos.y + 'px'; _aimRing.dataset.kind = kind || 'self'; }
    else _aimRing.classList.add('hidden');
  }
}
// Candidate attackables (players always; mobs/animals only for a damage cast),
// mirroring castFromHotbar's targeting rules, so we can pick nearest-to-finger.
function aimCandidates(damageOnly) {
  const out = [];
  for (const pid in players) if (pid !== myId && visuals[pid] && visuals[pid].inScene) out.push({ id: pid, targetType: 'player' });
  if (damageOnly && me) {
    const pools = me.room === 'outside' ? [['animal', animalVisuals], ['mob', mobVisuals]]
      : me.room === 'wilds' ? [['animal2', animalVisuals2], ['mob2', mobVisuals2], ['mob3', mobVisuals3]]
      : me.room === 'ember_wastes' ? [['ember_mob', emberMobVisuals]]
      : (typeof me.room === 'string' && me.room.startsWith('dungeon_')) ? [['dungeon', dungeonMobVisuals]]
      : [];
    for (const [tt, vis] of pools) for (const mid in vis) { const v = vis[mid]; if (v.dead || v.hidden || (tt === 'dungeon' && v.room !== me.room)) continue; out.push({ id: mid, targetType: tt }); }
  }
  return out;
}
function pickAimTarget(cx, cy, atk) {
  const damage = atk.effect === 'damage' || atk.effect === 'leech';
  let best = null, bestD = 150; // px radius of forgiveness
  for (const c of aimCandidates(damage)) {
    const s = screenPosForTarget(c.targetType, c.id);
    if (!s || s.visible === false) continue;
    const d = Math.hypot(s.x - cx, s.y - cy);
    if (d < bestD) { bestD = d; best = { id: c.id, targetType: c.targetType, _s: s }; }
  }
  return best;
}
function attachCastOnRelease(btn) {
  if (btn._aimWired) return; btn._aimWired = true;
  btn.addEventListener('touchstart', (e) => {
    if (typing || anyOverlayOpen() || !btn._castId) return;
    const t = e.changedTouches[0];
    btn._aim = { sx: t.clientX, sy: t.clientY, aiming: false, target: null, groundPt: null };
    if (e.cancelable) e.preventDefault(); // suppress the synthetic click (onclick stays for gamepad)
  }, { passive: false });
  btn.addEventListener('touchmove', (e) => {
    const a = btn._aim; if (!a) return;
    const t = e.changedTouches[0];
    if (!a.aiming && Math.hypot(t.clientX - a.sx, t.clientY - a.sy) > 16) a.aiming = true;
    if (!a.aiming) return;
    const atk = myActionCatalog && myActionCatalog[btn._castId]; if (!atk) return;
    if (atk.kind === 'ground') {
      a.groundPt = raycastGroundAt(t.clientX, t.clientY); a.target = null;
      const gs = a.groundPt ? worldToScreen(a.groundPt.x, 0, a.groundPt.z) : null;
      showAimUI(t.clientX, t.clientY, gs, 'ground');
    } else if (atk.kind === 'targeted' || atk.kind === 'reveal') {
      a.target = pickAimTarget(t.clientX, t.clientY, atk); a.groundPt = null;
      showAimUI(t.clientX, t.clientY, a.target ? a.target._s : null, (atk.effect === 'damage' || atk.effect === 'leech') ? 'enemy' : 'hex');
    } else {
      a.target = null; a.groundPt = null; showAimUI(t.clientX, t.clientY, null, 'self');
    }
  }, { passive: false });
  btn.addEventListener('touchend', () => {
    const a = btn._aim; btn._aim = null; hideAimUI();
    if (!a || !btn._castId) return;
    if (Date.now() < abilityPeekSwallowUntil) return; // a read-peek just happened — don't cast
    if (a.aiming) castFromHotbar(btn._castId, { target: a.target, groundPt: a.groundPt });
    else castFromHotbar(btn._castId);
  });
  btn.addEventListener('touchcancel', () => { btn._aim = null; hideAimUI(); });
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
  // The hit already landed — this is a heads-up, not something the player must
  // acknowledge. Always auto-dismiss and hide the button; a tap on the card
  // closes it early. Sleight of Hand is even quicker.
  const quick = effect === 'pickpocket';
  document.getElementById('attackHitDismiss').classList.add('hidden');
  el.classList.add('show');
  clearTimeout(attackHitTimer);
  attackHitTimer = setTimeout(() => el.classList.remove('show'), quick ? 2000 : 4000);
}

// Tap the card to dismiss it early — no button to hunt for.
const attackHitNotif = document.getElementById('attackHitNotification');
if (attackHitNotif) attackHitNotif.addEventListener('click', () => {
  clearTimeout(attackHitTimer);
  attackHitNotif.classList.remove('show');
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
// 🛡️ Guardian's Veil — a one-shot golden half-dome blooms over the caster's
// ground when the Knight raises the ward, then fades. Cosmetic only; the
// protection itself lives server-side (veiledUntil) and travels with those
// it covered.
function spawnVeilDome(casterId, radius) {
  try {
    const v = visuals[casterId];
    const grp = v && v.group;
    if (!grp || !activeScene || typeof THREE === 'undefined') return;
    const geo = new THREE.SphereGeometry(radius || 200, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
    const dome = new THREE.Mesh(geo, mat);
    dome.position.set(grp.position.x, grp.position.y + 2, grp.position.z);
    activeScene.add(dome);
    const start = performance.now(), dur = 1800;
    (function anim() {
      if (!dome.parent) return;
      const t = (performance.now() - start) / dur;
      if (t >= 1) { dome.parent.remove(dome); geo.dispose(); mat.dispose(); return; }
      const s = 0.25 + 0.75 * Math.min(1, t * 1.4);
      dome.scale.set(s, s, s);
      mat.opacity = 0.38 * (1 - t);
      requestAnimationFrame(anim);
    })();
  } catch (e) { /* cosmetic only */ }
}

// 🐺 Hunter's Read — the rap-sheet card the Werewolf tears off a target.
// Pure in-world record (built server-side from benign game state), laid out
// in the three sections the attack promises.
function openRapSheetPanel(d) {
  const modal = document.getElementById('rapSheetModal');
  const body = document.getElementById('rapSheetBody');
  const title = document.getElementById('rapSheetTitle');
  if (!modal || !body) return;
  if (title) title.textContent = `🐺 ${d.name}'s Rap Sheet`;
  const vet = [];
  if (d.ageDays != null) vet.push(d.ageDays <= 0 ? 'arrived today — fresh meat' : `a ${d.ageDays}-day prowler`);
  else vet.push('a drifter — no account, no past');
  if (d.streak > 0) vet.push(`🔥 ${d.streak}-day streak${d.bestStreak > d.streak ? ` (best ${d.bestStreak})` : ''}`);
  if (d.sessionMin != null) vet.push(d.sessionMin < 1 ? 'on the prowl just now' : `on the prowl ${d.sessionMin}m`);
  const weapon = d.weapon ? `${d.weapon.icon || '🗡️'} ${d.weapon.name}` : 'bare claws';
  const stat = (label, val) => `<div class="rsRow"><span>${label}</span><b>${val}</b></div>`;
  const section = (icon, heading, rows) => `<div class="rsSec"><div class="rsHead">${icon} ${heading}</div>${rows}</div>`;
  body.innerHTML =
    section('📓', 'The rap sheet',
      stat('Creatures felled', Number(d.kills).toLocaleString()) +
      stat('Times they’ve fallen', Number(d.deaths).toLocaleString()) +
      stat('Pockets picked', Number(d.pickpockets).toLocaleString()) +
      stat('Times photographed', Number(d.snapped).toLocaleString())) +
    section('🌙', 'Fresh meat or old wolf', `<div class="rsNote">${vet.join(' &middot; ')}</div>`) +
    section('🩸', 'Sizing up the kill',
      stat('Class', `${d.className}${d.masked ? ' <span class="rsTell">🎭 masked</span>' : ''}`) +
      stat('Level', d.level) +
      stat('Health', `${d.hpPct}%`) +
      stat('Armed with', weapon) +
      stat('Their hoard', d.wealth));
  modal.classList.remove('hidden');
}
(function wireRapSheet() {
  const close = () => { const m = document.getElementById('rapSheetModal'); if (m) m.classList.add('hidden'); };
  const btn = document.getElementById('rapSheetCloseBtn');
  if (btn) btn.addEventListener('click', close);
  const modal = document.getElementById('rapSheetModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
})();
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
// face-api.js (~650KB) is only needed for selfies / the third-eye spell, not
// at boot. It used to load render-blocking in index.html, delaying first
// paint on phones; now it's fetched on demand (and pre-warmed when idle).
let _faceApiScriptP = null;
function _loadFaceApiScript() {
  if (typeof faceapi !== 'undefined') return Promise.resolve(true);
  if (_faceApiScriptP) return _faceApiScriptP;
  _faceApiScriptP = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'face-api.min.js';
    s.async = true;
    s.onload = () => resolve(typeof faceapi !== 'undefined');
    s.onerror = () => { _faceApiScriptP = null; resolve(false); };
    document.head.appendChild(s);
  });
  return _faceApiScriptP;
}
async function _ensureFaceApi() {
  if (_faceApiReady) return true;
  if (!(await _loadFaceApiScript())) return false;
  if (typeof faceapi === 'undefined') return false;
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    _faceApiReady = true;
    return true;
  } catch { return false; }
}
// Pre-warm the detector once the browser is idle, so the first selfie/third-eye
// is instant without holding up the initial load. Skipped on phones: it's
// 650KB many touch players never use, and the on-demand path covers them when
// they do reach for the camera.
(function prewarmFaceApi() {
  if (MOBILE_UI) return;
  const go = () => { _ensureFaceApi(); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 8000 });
  else setTimeout(go, 5000);
})();

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
    if (typeof playSfx === 'function') playSfx('arcade_eat');
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
      b.alive = false; s.score++; if (typeof playSfx === 'function') playSfx('arcade_break'); s.ballVY *= -1; break;
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

let arcadeSubmitted = false; // one score report per game, on the game-over edge
function resetArcadeGame(type) {
  arcadeSubmitted = false;
  if (type === 'snake') resetSnake(); else resetBreakout();
}

function arcadeLoop(now) {
  if (!Modals.isOpen('arcadeModalOpen')) return;
  const dt = Math.min(0.05, (now - arcadeLast) / 1000);
  arcadeLast = now;
  if (arcadeGameType === 'snake') { updateSnake(dt); renderSnake(arcadeCtx); }
  else { updateBreakout(dt); renderBreakout(arcadeCtx); }
  // On the finish edge, report the score once for the daily high-score board.
  const st = arcadeGameType === 'snake' ? snakeState : breakoutState;
  if (st && (st.gameOver || st.won) && !arcadeSubmitted) {
    arcadeSubmitted = true;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'arcade_score', game: arcadeGameType, score: st.score | 0 }));
  }
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

// F-to-harvest for town/Wilds plants — the same key that gathers Ember Wastes
// veins and works every other kiosk, so "walk up + press F" is the one gather
// verb everywhere (clicking a plant still works too). Returns the nearest ripe,
// available harvestable decor's id within reach, or null.
const HARVEST_F_REACH = 80; // ≤ server HARVEST_RANGE (90), so anything in reach actually gathers
function nearestHarvestableDecor() {
  if (!me) return null;
  let pool = null;
  if (activeScene === wildsScene || me.room === 'wilds') pool = decorVisuals2;
  else if (activeScene === outdoorScene || me.room === 'outside') pool = decorVisuals;
  else return null;
  let best = null, bestD = HARVEST_F_REACH;
  for (const id in pool) {
    const v = pool[id];
    if (!v || v.harvested || !HARVESTABLE_DECOR_TYPES.has(v.type)) continue;
    if (decorAvailability[id] === false) continue;
    const p = v.group.position;
    const d = Math.hypot(me.x - p.x, me.y - p.z);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

function tryInteract() {
  if (!me) return;
  if (seatedAt) { standUp(); return; }
  const seat = findNearestSeat(); // null outdoors (currentInterior is null), so this is a no-op there
  if (seat) {
    if (seat.championsOnly && !canSitChampionsTable()) { setUnlockToast("🏆 The Champions' Table is reserved for the reigning coven."); return; }
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
  if (kiosk && kiosk.portal === 'manor_enter') { enterManor(); return; }
  if (kiosk && kiosk.portal === 'manor_exit') { exitManor(); return; }
  if (kiosk && kiosk.portal === 'cottage_exit') { exitCottage(); return; }
  if (kiosk && Number.isInteger(kiosk.manorBed)) {
    const slot = kiosk.manorBed;
    if (manorYours === slot) openManorChest(slot);                                  // your bed → open its chest
    else if (!manorBedState[slot]) ws.send(JSON.stringify({ type: 'manor_claim_bedroom', slot })); // empty → claim it
    else setUnlockToast(`${manorBedState[slot].name}'s chamber — claim an empty one.`);
    return;
  }
  if (kiosk && kiosk.portal === 'vault_enter') { enterVault(); return; }
  if (kiosk && kiosk.portal === 'vault_exit') { exitVault(); return; }
  if (kiosk && kiosk.portal === 'ember_enter') { enterEmberWastes(); return; }
  if (kiosk && kiosk.portal === 'ember_exit') { exitEmberWastes(); return; }
  if (kiosk && kiosk.portal === 'refuge_enter') { enterRefuge(); return; }
  if (kiosk && kiosk.portal === 'refuge_exit') { exitRefuge(); return; }
  if (kiosk && kiosk.npc === 'rite_altar') { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'rite_light_candle' })); return; }
  if (kiosk && kiosk.npc === 'ember_mob') { ws.send(JSON.stringify({ type: 'steal_from_mob', targetId: kiosk.targetId })); return; }
  if (kiosk && kiosk.node === 'ember_node') { ws.send(JSON.stringify({ type: 'harvest_ember_node', nodeId: kiosk.nodeId })); return; }
  if (kiosk && kiosk.witch === 'hazel') { ws.send(JSON.stringify({ type: 'witch_talk' })); return; }
  if (kiosk && kiosk.npc === 'artificer') { openWorkshopModal(); return; } // the Artificer's forge in the Wildlands Village
  if (kiosk && kiosk.npc === 'yarrow') { openGardenModal(); return; } // Mother Yarrow's garden plot — the Green Path
  if (kiosk && kiosk.npc === 'npc') { openNpcShopModal(kiosk.npcId); return; }
  if (kiosk && kiosk.npc === 'legend') { openLegendShop(); return; }
  if (kiosk && kiosk.npc === 'board') { openBoardModal(); return; }
  if (kiosk && kiosk.npc === 'seance') { openSeanceModal(); return; }
  if (kiosk && kiosk.npc === 'delve') { openDelveModal(); return; }
  if (kiosk && kiosk.npc === 'moot') { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'moot_teleport' })); return; }
  if (kiosk && kiosk.npc === 'locksmith') { openLocksmithModal(); return; }
  if (kiosk && kiosk.npc === 'plaque') { openPlaqueModal(); return; }
  if (kiosk && kiosk.npc === 'quest') { openQuestDialogue(kiosk.npcId, kiosk.npcName); return; }
  if (kiosk && kiosk.npc === 'hint') { openNpcHintTalk(kiosk.npcId); return; }
  if (kiosk && kiosk.npc === 'wolf_pact') { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'werewolf_talk' })); return; }
  if (kiosk && kiosk.npc === 'waymark') { ws.send(JSON.stringify({ type: 'read_waymarker', markerId: kiosk.markerId })); return; }
  if (kiosk && kiosk.npc === 'forbidden_book') { ws.send(JSON.stringify({ type: 'read_forbidden_book' })); return; }
  if (kiosk && kiosk.npc === 'cafe_special') { ws.send(JSON.stringify({ type: 'order_special' })); return; }
  if (kiosk && kiosk.npc === 'arcade_scores') { ws.send(JSON.stringify({ type: 'arcade_board' })); return; }
  if (kiosk && kiosk.npc === 'midnight_vigil') { ws.send(JSON.stringify({ type: 'sit_vigil' })); return; }
  if (kiosk && kiosk.npc === 'relic') { ws.send(JSON.stringify({ type: 'inspect_relic', relicId: kiosk.relicId })); return; }
  if (PAYWALLS_ENABLED && kiosk && kiosk.id === 'town_pass') { openPassModal(); return; }
  // Fallback: no kiosk here — try to gather the nearest ripe plant.
  const decorId = nearestHarvestableDecor();
  if (decorId) {
    const nowH = Date.now();
    if (!(decorId === _lastHarvestId && nowH - _lastHarvestAt < 1500)) {
      _lastHarvestId = decorId; _lastHarvestAt = nowH;
      ws.send(JSON.stringify({ type: 'harvest', decorId }));
    }
  }
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
  if (!me || Modals.isOpen('passModalOpen') || Modals.isOpen('msModalOpen') || Modals.isOpen('legendModalOpen') || Modals.isOpen('arcadeModalOpen') || Modals.isOpen('bankModalOpen') || Modals.isOpen('auctionModalOpen') || Modals.isOpen('sendMoneyModalOpen') || Modals.isOpen('spellConsentOpen') || Modals.isOpen('howlConsentOpen') || Modals.isOpen('npcShopOpen') || Modals.isOpen('witchShopOpen') || Modals.isOpen('witchConsentOpen') || Modals.isOpen('werewolfShopOpen') || Modals.isOpen('werewolfConsentOpen') || Modals.isOpen('boardModalOpen') || Modals.isOpen('delveModalOpen') || Modals.isOpen('covenModalOpen') || Modals.isOpen('bedChestModalOpen') || Modals.isOpen('notifModalOpen') || Modals.isOpen('locksmithModalOpen') || Modals.isOpen('seanceModalOpen')) { hint.classList.add('hidden'); return; }
  if (seatedAt) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} stand`;
    return;
  }
  const seat = findNearestSeat();
  if (seat && !seatIsOccupied(seat)) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent =
      (seat.championsOnly && !canSitChampionsTable()) ? "🏆 Champions' Table — reigning coven only" : `${interactVerb()} sit`;
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
  if (kiosk && kiosk.npc === 'rite_altar') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} light a candle for the Rite`;
    return;
  }
  if (kiosk && kiosk.npc === 'seance') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} gather at the Séance Board`;
    return;
  }
  if (kiosk && kiosk.npc === 'forbidden_book') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} read the Forbidden Shelf`;
    return;
  }
  if (kiosk && kiosk.npc === 'cafe_special') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} order the Daily Special`;
    return;
  }
  if (kiosk && kiosk.npc === 'arcade_scores') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} check the Hall of Scores`;
    return;
  }
  if (kiosk && kiosk.npc === 'midnight_vigil') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} sit the Midnight Vigil`;
    return;
  }
  if (kiosk && kiosk.npc === 'relic') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} inspect ${kiosk.npcName || 'the relic'}`;
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
  if (kiosk && kiosk.portal === 'manor_enter') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} enter the Coven Manor`;
    return;
  }
  if (kiosk && kiosk.portal === 'manor_exit') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} leave the Manor`;
    return;
  }
  if (kiosk && Number.isInteger(kiosk.manorBed)) {
    const occ = manorBedState[kiosk.manorBed];
    const mine = manorYours === kiosk.manorBed;
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent =
      mine ? `${interactVerb()} open your chest`
      : occ ? `${occ.name}'s chamber`
      : `${interactVerb()} claim this chamber`;
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
  if (kiosk && kiosk.portal === 'refuge_enter') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} shelter in the refuge`;
    return;
  }
  if (kiosk && kiosk.portal === 'refuge_exit') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} step back onto the ember flat`;
    return;
  }
  if (kiosk && kiosk.npc === 'ember_mob') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} pick its pocket`;
    return;
  }
  if (kiosk && kiosk.node === 'ember_node') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} gather the vein`;
    return;
  }
  if (kiosk && kiosk.witch === 'hazel') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} speak with Witch Hazel`;
    return;
  }
  if (kiosk && kiosk.npc === 'artificer') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} work the Artificer's forge`;
    return;
  }
  if (kiosk && kiosk.npc === 'yarrow') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} tend Mother Yarrow's garden`;
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
  if (kiosk && kiosk.npc === 'moot') {
    hint.classList.remove('hidden');
    // A coven-less seeker is invited to ask the veil (the free solo taste);
    // a coven member steps through to their private world.
    document.getElementById('interactHintText').textContent = !covenState
      ? `${interactVerb()} ask the veil at the Hagstone`
      : `${interactVerb()} ${mootInstanceActive ? 'return through' : 'step through'} the Hagstone`;
    return;
  }
  if (kiosk && kiosk.npc === 'locksmith') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} see Tumbler the Locksmith`;
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
    document.getElementById('interactHintText').textContent = `${interactVerb()} read ${kiosk.npcName || 'the waymarker'}`;
    return;
  }
  if (PAYWALLS_ENABLED && kiosk && kiosk.id === 'town_pass') {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} view Town Pass`;
    return;
  }
  // No kiosk — prompt to harvest if a ripe plant is in reach.
  if (nearestHarvestableDecor()) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = `${interactVerb()} harvest`;
    return;
  }
  hint.classList.add('hidden');
}

// Step back into the ☰ menu after closing a menu panel, so Escape walks one
// level up instead of dropping to the game. Reopening through pcMenuBtn also
// refreshes the menu's live labels (graphics, moonstones, …).
function backToMenu() {
  const p = document.getElementById('pcMenuBtn');
  if (p) { p.click(); return; }
  const s = document.getElementById('menuSheet');
  if (s) s.classList.remove('hidden');
  window.__fromMenu = false;
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
  if (Modals.isOpen('mapModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) { window.__closeTownMap && window.__closeTownMap(); if (window.__fromMenu) backToMenu(); }
    return;
  }
  if (Modals.isOpen('boardModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) { closeBoardModal(); if (window.__fromMenu) backToMenu(); }
    return;
  }
  if (Modals.isOpen('delveModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) { closeDelveModal(); if (window.__fromMenu) backToMenu(); }
    return;
  }
  if (Modals.isOpen('locksmithModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeLocksmithModal();
    return;
  }
  if (Modals.isOpen('covenModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) { closeCovenModal(); if (window.__fromMenu) backToMenu(); }
    return;
  }
  if (Modals.isOpen('bedChestModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) closeManorChest();
    return;
  }
  if (Modals.isOpen('notifModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) { Modals.set('notifModalOpen', false); document.getElementById('notifModal').classList.add('hidden'); if (window.__fromMenu) backToMenu(); }
    return;
  }
  const _storyBeat = document.getElementById('storyBeatModal');
  if (_storyBeat && !_storyBeat.classList.contains('hidden')) {
    if (e.key === 'Escape' && !e.repeat) _storyBeat.classList.add('hidden');
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
    if (e.key === 'Escape' && !e.repeat) { closeMsModal(); if (window.__fromMenu) backToMenu(); }
    return;
  }
  if (Modals.isOpen('passModalOpen')) {
    if (e.key === 'Escape' && !e.repeat) { closePassModal(); if (window.__fromMenu) backToMenu(); }
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
    if (e.key === 'Escape' && !e.repeat) { closeAttackPanel(); if (window.__fromMenu) backToMenu(); }
    return;
  }
  if (Modals.isOpen('journalOpen') && e.key === 'Escape' && !e.repeat) {
    closeJournal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('bookOpen') && e.key === 'Escape' && !e.repeat) {
    closeBookModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('familiarOpen') && e.key === 'Escape' && !e.repeat) {
    closeFamiliarModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('guiseOpen') && e.key === 'Escape' && !e.repeat) {
    closeGuiseModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('scryOpen') && e.key === 'Escape' && !e.repeat) {
    closeScryModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('tarotOpen') && e.key === 'Escape' && !e.repeat) {
    closeTarotModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('gardenOpen') && e.key === 'Escape' && !e.repeat) {
    closeGardenModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('homeOpen') && e.key === 'Escape' && !e.repeat) {
    closeHomeModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('kitchenOpen') && e.key === 'Escape' && !e.repeat) {
    closeKitchenModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('pathOpen') && e.key === 'Escape' && !e.repeat) {
    closePathModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('ancestorOpen') && e.key === 'Escape' && !e.repeat) {
    closeAncestorModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('releaseOpen') && e.key === 'Escape' && !e.repeat) {
    closeReleaseModal();
    if (window.__fromMenu) backToMenu();
    return;
  }
  if (Modals.isOpen('skillsOpen') && e.key === 'Escape' && !e.repeat) {
    closeSkills();
    if (window.__fromMenu) backToMenu();
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
  if (Modals.isOpen('inventoryOpen') && e.key === 'Escape' && !e.repeat) { toggleInventory(); if (window.__fromMenu) backToMenu(); return; }
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
  if ((e.key === 'b' || e.key === 'B') && !e.repeat) { blessNearest(); return; } // bestow your active blessing on the nearest player
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
  // Catch-all: any open menu or panel not claimed by a handler above (the
  // overlay modals, and any panel added without its own Escape wiring) still
  // backs out ONE level on Escape — close the topmost open one through its
  // Close button, so you never have to reach for the mouse. Runs after every
  // specific handler, so consent/confirm dialogs (which decline on Escape) are
  // already handled and never reach here.
  if (e.key === 'Escape' && !e.repeat) {
    const openMenus = [...document.querySelectorAll('.overlay:not(.hidden), .floatPanel:not(.hidden)')]
      .filter((el) => getComputedStyle(el).display !== 'none');
    if (openMenus.length) {
      const top = openMenus.sort((a, b) => (parseInt(getComputedStyle(b).zIndex, 10) || 0) - (parseInt(getComputedStyle(a).zIndex, 10) || 0))[0];
      let btn = top.querySelector('[id$="CloseBtn"]');
      if (!btn) btn = [...top.querySelectorAll('button, .btn')].find((b) => /\bclose\b/i.test(b.textContent || ''));
      const fromMenu = window.__fromMenu;
      if (btn) btn.click(); else top.classList.add('hidden');
      if (fromMenu) backToMenu(); // step back into the ☰ menu, one level up
      e.preventDefault();
      return;
    }
  }
  if (e.key === 'Escape' && !e.repeat) {
    // Escape with nothing else open pops the ☰ menu (the open-menu branch up
    // top closes it, so Escape toggles). Driving it through the hidden
    // pcMenuBtn means its graphics/music labels refresh on open, same as a
    // click would. Leaving a building now lives on the Leave button and the
    // menu's "🚪 Leave building" row rather than on Escape.
    const pm = document.getElementById('pcMenuBtn');
    if (pm) pm.click();
    else document.getElementById('menuSheet').classList.remove('hidden');
  }
});

// ---------------------------------------------------------------------------
// Entering / leaving a building
// ---------------------------------------------------------------------------
function enterBuilding(roomId) {
  if (typeof playSfx === 'function') playSfx('door');
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
  if (typeof playSfx === 'function') playSfx('door');
  mode = 'outdoor';
  indoorBuildingId = null;
  // Same reasoning as enterBuilding(): don't let a leftover look-angle from
  // inside make it confusing to see/walk back toward the door you just left.
  cameraYawOffset = 0;
  cameraPitchOffset = 0;
  const side = getDoorSide(b);
  // Nudge just outside the door so they don't immediately re-enter. This must
  // clear the FITTED footprint (b._fit), not the raw data rect: roomAt() keys
  // entry off the fitted footprint now, and a model flushed to the door wall can
  // overhang the data edge — dropping the player at data-edge+26 could land them
  // back inside the entry zone and re-enter in a loop (got stuck in the Bank).
  const f = b._fit || b;
  if (side === 'east') { me.x = f.x + f.w + 30; me.y = f.y + f.h / 2; }
  else if (side === 'west') { me.x = f.x - 30; me.y = f.y + f.h / 2; }
  else if (side === 'north') { me.x = f.x + f.w / 2; me.y = f.y - 30; }
  else { me.x = f.x + f.w / 2; me.y = f.y + f.h + 30; }
  justExitedRoom = b.id; // backstop: block auto re-entry until we read 'outside'
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
const FOOT_STRIDE = 110; // world units walked per footstep sound — cadence scales with speed
let _footAccum = 0;      // distance banked toward the next step (primed when standing still)

function updateOutdoor(stepX, stepY) {
  const nx = me.x + stepX, ny = me.y + stepY;

  // The Wilds has no buildings/locked rooms to detect — just move, clamp
  // to its (much smaller) bounds, and stay in room 'wilds'. Letting this
  // fall through to the town's door/lock logic below would, at best, do
  // nothing useful (world.buildings is empty there) and at worst stomp
  // me.room back to 'outside' every frame via the unconditional set at the
  // bottom of the town path.
  if (world === world2 || world === DUNGEON_WORLD || world === CAVE_WORLD || world === VAULT_WORLD || world === EMBER_WORLD || world === REFUGE_WORLD || world === MANOR_WORLD || world === COTTAGE_WORLD || me.room === 'witch_cave' || me.room === 'bank_vault' || me.room === 'ember_wastes' || me.room === 'ember_refuge' || me.room === 'manor' || me.room === 'cottage') {
    // If you're already overlapping a collider (e.g. you placed furniture right
    // where you stand), don't lock up — let the move through so you can walk out.
    const stuck = collides(me.x, me.y);
    if (stuck || !collides(nx, me.y)) me.x = nx;
    if (stuck || !collides(me.x, ny)) me.y = ny;
    const inCave = world === CAVE_WORLD || me.room === 'witch_cave';
    const inVault = world === VAULT_WORLD || me.room === 'bank_vault';
    const inEmber = world === EMBER_WORLD || me.room === 'ember_wastes';
    const inRefuge = world === REFUGE_WORLD || me.room === 'ember_refuge';
    const inManor = world === MANOR_WORLD || me.room === 'manor';
    const inCottage = world === COTTAGE_WORLD || me.room === 'cottage';
    const boundsW = inCave ? CAVE_WORLD.width : inVault ? VAULT_WORLD.width : inEmber ? EMBER_WORLD.width : inRefuge ? REFUGE_WORLD.width : inManor ? MANOR_WORLD.width : inCottage ? COTTAGE_WORLD.width : world.width;
    const boundsH = inCave ? CAVE_WORLD.height : inVault ? VAULT_WORLD.height : inEmber ? EMBER_WORLD.height : inRefuge ? REFUGE_WORLD.height : inManor ? MANOR_WORLD.height : inCottage ? COTTAGE_WORLD.height : world.height;
    me.x = Math.max(PLAYER_R, Math.min(boundsW - PLAYER_R, me.x));
    me.y = Math.max(PLAYER_R, Math.min(boundsH - PLAYER_R, me.y));
    if (inCave) { me.room = 'witch_cave'; }
    else if (inVault) { me.room = 'bank_vault'; }
    else if (inEmber) { me.room = 'ember_wastes'; }
    else if (inRefuge) { me.room = 'ember_refuge'; }
    else if (inManor) { me.room = 'manor'; }
    else if (inCottage) { me.room = 'cottage'; }
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
  // Re-entry guard: right after leaving a building, exitBuilding drops us just
  // outside its door. If that spot still reads as inside (tight geometry), don't
  // get sucked straight back in — wait until we've stepped fully clear.
  if (room === justExitedRoom && room !== 'outside') {
    me.room = 'outside';
    maybeUpdateRoomUI('outside');
    return;
  }
  justExitedRoom = null;
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
  const anyModal = Modals.isOpen('boardModalOpen') || Modals.isOpen('delveModalOpen') || Modals.isOpen('covenModalOpen') || Modals.isOpen('bedChestModalOpen') || Modals.isOpen('notifModalOpen') || Modals.isOpen('passModalOpen') || Modals.isOpen('msModalOpen') || Modals.isOpen('legendModalOpen') || Modals.isOpen('arcadeModalOpen') || Modals.isOpen('bankModalOpen') || Modals.isOpen('auctionModalOpen');
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

  // Feral Haze / Haunting — 'reversed' flips every control for a few seconds:
  // forward↔back, turn left↔right, strafe↔strafe. Self-enforced client-side
  // like every other movement status here.
  if (me.activeStatus && me.activeStatus.type === 'reversed') {
    moveInput = -moveInput; turnInput = -turnInput; strafeInput = -strafeInput;
  }

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
  if (me.activeStatus && me.activeStatus.type === 'rooted') speed = 0; // Heavy Pack — pinned in place
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

  // Footsteps — paced by distance walked (not frames), so the cadence scales
  // with speed (boosts sound faster) and stops when you stand still. playSfx
  // routes to the recorded footstep variants (random pick) or the synth. Primed
  // to FOOT_STRIDE while idle so the first step on moving off lands promptly.
  // Teleports set me.x directly without going through stepX/stepY, so they can't
  // trigger a burst.
  if (me && !me.isDead) {
    const stepped = Math.hypot(stepX, stepY);
    if (stepped > 0.0001) {
      _footAccum += stepped;
      if (_footAccum >= FOOT_STRIDE) { _footAccum -= FOOT_STRIDE; if (typeof playSfx === 'function') playSfx('footstep'); }
    } else {
      _footAccum = FOOT_STRIDE;
    }
  }

  if (jumpActive) {
    jumpT += dt;
    if (jumpT >= JUMP_DURATION) { jumpActive = false; jumpT = 0; }
  }

  // Runs regardless of indoor/outdoor so the lighting is already correct
  // the instant anyone steps back outside, not just for players currently
  // out there to see it change. Wildlife visuals interpolate unconditionally
  // too, same reasoning as remote players just below.
  updateDayNightCycle();
  { const _bm = bloodMoonActiveClient(Date.now()); if (_wasBloodMoon !== null && _bm && !_wasBloodMoon && typeof playSfx === 'function') playSfx('bloodmoon'); _wasBloodMoon = _bm; }
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
  updateEmberAmbient(dt);
  if (me && me.room === 'ember_wastes') { updateEmberNodeVisuals(dt); checkEmberLandmarkDiscovery(); }
  updateWorldBossVisuals(dt);
  updateMinionVisuals(dt);
  updatePortals(dt);
  updateManorEmbers(dt);

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
  updateFamiliars(dt); // after syncVisuals so player group positions are current
  updateAuras(dt); // cosmetic foot-glow, attached to each player's visual group
  updateGuises(); // costume overlays, parented to each player's body group
  updateEchoes(dt);
  updateAmbientChatter(dt);
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
  updateCoordBar();
  updateInteractHint();

  moveSendTimer -= dt;
  if (moveSendTimer <= 0) {
    moveSendTimer = 0.05;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'move', x: me.x, y: me.y, room: me.room }));
    }
  }

  renderTownPulse();
}

// Town-wide liveness. The local `players` map only holds whoever shares your
// room (the AOI), so counting it told a player alone in a room that there was
// "1 in town" even with others elsewhere — a counter that actively made the
// world feel dead. town_pulse carries the real town-wide headcount; we floor it
// by the local count only as a pre-first-pulse safety net.
let townInTown = 1, townToday = 0, townRooms = {};
function onTownPulse(msg) {
  if (msg && typeof msg.inTown === 'number') townInTown = msg.inTown;
  if (msg && typeof msg.today === 'number') townToday = msg.today;
  if (msg && msg.rooms && typeof msg.rooms === 'object') townRooms = msg.rooms;
  renderTownPulse();
  renderGatherHint();
}

// Rooms where a gather nudge would be noise rather than help: focused/solo
// content you don't walk into looking for company, and the Wilds. Everywhere
// else is part of the social town hub (the square + its buildings).
function _isContentRoom(r) {
  return r === 'wilds' || r === 'ember_wastes' || r === 'ember_refuge' || r === 'manor' || r === 'cottage' ||
    (typeof r === 'string' && r.startsWith('dungeon_'));
}
// The wayfinding nudge: only when you're effectively alone in your current hub
// room but other witches are gathered somewhere else in the public town. Points
// you at the busiest other room so a scattered, lightly-populated town can
// actually find itself. Hidden the moment you're with people or the town empties.
let _gatherText = '';        // last nudge shown, so an unchanged state doesn't keep re-announcing
let _gatherFadeTimer = null;
function renderGatherHint() {
  const el = document.getElementById('gatherHint');
  if (!el) return;
  const hide = () => { el.classList.add('hidden'); _gatherText = ''; };
  if (!me || mootInstanceActive || _isContentRoom(me.room)) return hide();
  if (_gatherDismissedRoom === me.room) return hide();
  const here = townRooms[me.room] || 0;
  const othersHere = Math.max(here - 1, 0); // server counts me in my own room
  if (othersHere >= 1) return hide(); // already in company
  // Busiest other public room.
  let bestRoom = null, bestN = 0;
  for (const r in townRooms) {
    if (r === me.room || _isContentRoom(r)) continue;
    const n = townRooms[r] || 0;
    if (n > bestN) { bestN = n; bestRoom = r; }
  }
  if (!bestRoom || bestN < 1) return hide(); // no one to point to
  const label = (typeof roomLabel === 'function') ? roomLabel(bestRoom) : bestRoom;
  const who = bestN === 1 ? '1 witch' : bestN + ' witches';
  const text = `✨ ${who} in ${label} — head over`;
  el.textContent = text;
  el.classList.remove('hidden');
  // Announce, then fade out of the way — so it isn't parked in the corner the
  // whole time you're alone. A new target (room changes, or the count shifts)
  // re-announces; an unchanged one stays faded.
  if (text !== _gatherText) {
    _gatherText = text;
    el.classList.remove('faded');
    clearTimeout(_gatherFadeTimer);
    _gatherFadeTimer = setTimeout(() => { try { el.classList.add('faded'); } catch (e) {} }, 7000);
  }
}
// Tapping the nudge tucks it away until you next change rooms, so it informs
// without nagging. (A fresh town_pulse in the same room won't force it back.)
let _gatherDismissedRoom = null;

// ── The Town Bell ────────────────────────────────────────────────────────────
// A scheduled gathering: every half hour a bell tolls and everyone has a short
// window to reach the plaza well together. The pill counts down to the next
// toll (only in the final minutes, to stay out of the way), then flips to an
// urgent "gather now" state while the window is open.
let bellState = null; // { nextAt, ringingUntil, gatherMs, well, radius }
function onTownBell(msg) {
  if (!bellState) bellState = {};
  if (msg.phase === 'ring') {
    bellState.ringingUntil = msg.endsAt;
    if (msg.well) bellState.well = msg.well;
    if (msg.radius) bellState.radius = msg.radius;
    try { if (typeof playSfx === 'function') playSfx('coven_crown'); } catch (e) {} // bright ceremonial bells
    try { setUnlockToast('🔔 The town bell tolls — gather at the well!'); } catch (e) {}
  } else if (msg.phase === 'reward') {
    bellState.ringingUntil = 0;
    if (msg.nextAt) bellState.nextAt = msg.nextAt;
    try { if (typeof playSfx === 'function') playSfx('quest_fanfare'); } catch (e) {} // the server's announce_soft carries the exact reward
  } else if (msg.phase === 'idle') {
    bellState.ringingUntil = 0;
    if (msg.nextAt) bellState.nextAt = msg.nextAt;
  }
  try { renderBellTag(); } catch (e) {}
}
function _mmss(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
const BELL_PREVIEW_MS = 5 * 60 * 1000; // start showing the countdown this far out
function renderBellTag() {
  const el = document.getElementById('bellTag');
  if (!el) return;
  if (!bellState || !me) { el.classList.add('hidden'); return; }
  const now = Date.now();
  if (bellState.ringingUntil && now < bellState.ringingUntil) {
    const atWell = me.room === 'outside' && bellState.well &&
      Math.hypot((me.x || 0) - bellState.well.x, (me.y || 0) - bellState.well.y) <= (bellState.radius || 240);
    el.classList.add('bellRinging');
    el.textContent = atWell
      ? `🔔 You're at the well — hold on! (${_mmss(bellState.ringingUntil - now)})`
      : `🔔 The bell tolls — gather at the well! (${_mmss(bellState.ringingUntil - now)})`;
    el.classList.remove('hidden');
    return;
  }
  el.classList.remove('bellRinging');
  const untilNext = (bellState.nextAt || 0) - now;
  if (untilNext > 0 && untilNext <= BELL_PREVIEW_MS) {
    el.textContent = `🔔 Town Bell in ${_mmss(untilNext)}`;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}
// Tick the countdown once a second (decoupled from the 60fps render loop).
setInterval(() => { try { renderBellTag(); } catch (e) {} }, 1000);

// ── Town Crier ───────────────────────────────────────────────────────────────
// A highlight reel of recent real-player milestones. The whole point is async
// liveness: alone in a quiet hour, you still see the town is actually played.
const TOWN_FEED_MAX = 40;
let townFeed = []; // newest first: { id, icon, text, at }
function onTownFeedAdd(item) {
  if (!item || !item.text) return;
  townFeed.unshift(item);
  if (townFeed.length > TOWN_FEED_MAX) townFeed.length = TOWN_FEED_MAX;
  // A tiny unread dot on the menu button, so people discover the feed exists.
  try { const b = document.getElementById('crierMenuBadge'); if (b && !Modals.isOpen('crierModalOpen')) b.classList.remove('hidden'); } catch (e) {}
  if (Modals.isOpen('crierModalOpen')) renderCrier();
}
function _agoText(ms) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}
function renderCrier() {
  const body = document.getElementById('crierBody'); if (!body) return;
  if (!townFeed.length) {
    body.innerHTML = '<div style="color:#9a90bd;font-size:13px;padding:8px 0;">The town has been quiet. Be the first to make the Crier shout — reach level 5, finish a chapter, or found a coven.</div>';
    return;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  body.innerHTML = townFeed.map((it) =>
    '<div style="display:flex;gap:10px;align-items:baseline;padding:7px 0;border-bottom:1px solid rgba(80,70,120,0.25);">' +
      '<span class="feedGi" style="font-size:15px;flex:0 0 auto;">' + glyphHTML(it.icon || '✨', 'feedGi') + '</span>' +
      '<span style="flex:1;min-width:0;color:#eae4f6;font-size:13px;">' + esc(it.text) + '</span>' +
      '<span style="flex:0 0 auto;color:#8a80ad;font-size:11.5px;">' + esc(_agoText(it.at)) + '</span>' +
    '</div>'
  ).join('');
}
function openCrierModal() {
  const m = document.getElementById('crierModal'); if (!m) return;
  renderCrier();
  m.classList.remove('hidden');
  try { Modals.set('crierModalOpen', true); } catch (e) {}
  try { const b = document.getElementById('crierMenuBadge'); if (b) b.classList.add('hidden'); } catch (e) {}
}
function closeCrierModal() {
  const m = document.getElementById('crierModal'); if (m) m.classList.add('hidden');
  try { Modals.set('crierModalOpen', false); } catch (e) {}
}
function renderTownPulse() {
  const cEl = document.getElementById('peopleCount');
  if (!cEl) return;
  const n = Math.max(townInTown | 0, Object.keys(players).length, 1);
  cEl.textContent = n;
  const label = document.getElementById('peopleLabel');
  if (label) {
    // Alone right now: soften the lonely "1 in town" with how many have
    // wandered through today, so the town still reads as a place people visit.
    if (n <= 1 && townToday > 1) label.textContent = 'in town · ' + townToday + ' today';
    else label.textContent = 'in town';
  }
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
  if (room === 'ember_refuge') { swapToRefugeMap(); maybeUpdateRoomUI(room); return; }
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
    inspectSelf() {
      const v = visuals[myId];
      if (!v) return { noVisual: true };
      const g = v.group;
      let meshes = 0, visMeshes = 0, skinned = 0;
      g.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { meshes++; if (o.visible) visMeshes++; if (o.isSkinnedMesh) skinned++; } });
      let bbox = null;
      try { const b = new THREE.Box3().setFromObject(g); if (isFinite(b.min.y)) bbox = { minY: +b.min.y.toFixed(1), maxY: +b.max.y.toFixed(1), h: +(b.max.y - b.min.y).toFixed(1) }; } catch (e) {}
      return {
        hasKK: !!v.kk, groupVisible: g.visible, inScene: !!v.inScene, parentIsActive: v.parentScene === activeScene,
        pos: { x: +g.position.x.toFixed(1), y: +g.position.y.toFixed(1), z: +g.position.z.toFixed(1) },
        scale: +g.scale.x.toFixed(3), meshes, visMeshes, skinned, bbox,
        floorY: +getFloorHeight(me ? me.room : 'outside', g.position.x, g.position.z).toFixed(1),
        charId: me ? me.charId : null,
        baseScale: v.kk ? +(v.kk.baseScale || 0).toFixed(3) : null,
        modelSizeY: (me && KK && KK.models && KK.models[KK.charKey(me.charId)]) ? +KK.models[KK.charKey(me.charId)].size.y.toFixed(3) : null,
        instScaleX: v.kk && v.kk.inst ? +v.kk.inst.scale.x.toFixed(3) : null,
      };
    },
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

