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
const ws = new WebSocket(proto + '://' + location.host);

let myId = null;
let world = null;
let walls = [];           // generated collision rects, derived from world.buildings
let players = {};         // id -> {id,name,color,x,y,room,targetX,targetY,lastMsg,...visual state}
let me = null;            // convenience pointer to players[myId]
let currentRoom = 'outside';
const messagesByRoom = {}; // room id -> array of {name,color,text,ts}

ws.addEventListener('open', () => setStatus(true));
ws.addEventListener('close', () => setStatus(false));
ws.addEventListener('error', () => setStatus(false));

ws.addEventListener('message', (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch (e) { return; }

  if (msg.type === 'init') {
    myId = msg.id;
    world = msg.world;
    walls = buildWalls(world);
    players = {};
    initScene(world);
    for (const p of msg.players) addPlayer(p);
    me = players[myId];
    document.getElementById('joinScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    if (isTouchDevice()) document.getElementById('joystick').classList.add('show');
    refreshUnlockUI();
    resize();
    last = performance.now();
    requestAnimationFrame(loop);
    return;
  }

  if (msg.type === 'join_error') {
    showJoinError(msg.message);
    return;
  }

  if (msg.type === 'player_joined') {
    addPlayer(msg.player);
    return;
  }

  if (msg.type === 'player_left') {
    removePlayer(msg.id);
    return;
  }

  if (msg.type === 'state') {
    for (const p of msg.players) {
      if (p.id === myId) continue; // trust local prediction for ourselves
      const existing = players[p.id];
      if (existing) {
        existing.targetX = p.x; existing.targetY = p.y; existing.room = p.room; existing.name = p.name; existing.color = p.color;
      } else {
        addPlayer(p);
      }
    }
    return;
  }

  if (msg.type === 'chat') {
    const m = msg.message;
    if (!messagesByRoom[m.room]) messagesByRoom[m.room] = [];
    messagesByRoom[m.room].push(m);
    if (players[m.id]) players[m.id].lastMsg = { text: m.text, ts: m.ts };
    if (m.room === currentRoom) renderChatLog();
    return;
  }
});

function addPlayer(p) {
  if (players[p.id]) return;
  players[p.id] = {
    id: p.id, name: p.name, color: p.color,
    x: p.x, y: p.y, targetX: p.x, targetY: p.y,
    renderPrevX: p.x, renderPrevY: p.y,
    room: p.room, lastMsg: null,
    facing: 0, walkPhase: Math.random() * 10
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

function showJoinError(text) {
  document.getElementById('joinErr').textContent = text;
}

function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

// ---------------------------------------------------------------------------
// Join flow
// ---------------------------------------------------------------------------
const nameInput = document.getElementById('nameInput');
const passInput = document.getElementById('passInput');
const joinBtn = document.getElementById('joinBtn');

function attemptJoin() {
  const name = nameInput.value.trim();
  if (!name) { showJoinError('Enter a name first.'); return; }
  showJoinError('');
  const payload = { type: 'join', name, password: passInput.value };
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
  const t = w.wallThickness, dw = w.doorWidth;
  const list = [];
  for (const b of w.buildings) {
    const doorStart = b.x + (b.w - dw) / 2;
    const doorEnd = doorStart + dw;
    list.push({ x: b.x, y: b.y, w: b.w, h: t });                                  // top
    list.push({ x: b.x, y: b.y, w: t, h: b.h });                                  // left
    list.push({ x: b.x + b.w - t, y: b.y, w: t, h: b.h });                        // right
    list.push({ x: b.x, y: b.y + b.h - t, w: doorStart - b.x, h: t });            // bottom-left
    list.push({ x: doorEnd, y: b.y + b.h - t, w: (b.x + b.w) - doorEnd, h: t });   // bottom-right
  }
  return list;
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
  const b = world.buildings.find(x => x.id === roomId);
  return b ? b.name : roomId;
}

// ---------------------------------------------------------------------------
// Premium gating — one building is free, the rest need a verified Stripe
// payment. Gating is enforced client-side only (no accounts/database in
// this project), persisted in localStorage once a payment is verified.
// ---------------------------------------------------------------------------
const FREE_BUILDING_ID = 'cafe';
let unlocked = localStorage.getItem('tc_unlocked') === '1';
let paymentsEnabled = false;
let premiumPriceCents = 300;

function isLockedRoom(roomId) {
  return roomId !== 'outside' && roomId !== FREE_BUILDING_ID && !unlocked;
}

function formatPrice(cents) { return '$' + (cents / 100).toFixed(2); }

function refreshUnlockUI() {
  const bar = document.getElementById('unlockBar');
  if (!bar) return;
  if (unlocked || !paymentsEnabled) { bar.classList.add('hidden'); return; }
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
  if (!sessionId) return;
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
})();

// ---------------------------------------------------------------------------
// Input — keyboard + touch joystick (unchanged)
// ---------------------------------------------------------------------------
const keys = { up:false, down:false, left:false, right:false };
let typing = false;

window.addEventListener('keydown', (e) => {
  if (typing) return;
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = true;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
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
    const text = chatInput.value.trim();
    if (text) ws.send(JSON.stringify({ type: 'chat', text }));
    chatInput.value = '';
  } else if (e.key === 'Escape') {
    chatInput.blur();
  }
});

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
    div.appendChild(document.createTextNode(' ' + m.text));
    chatLog.appendChild(div);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

let lastRoom = 'outside';
function maybeUpdateRoomUI(room) {
  if (room === lastRoom) return;
  lastRoom = room;
  currentRoom = room;
  document.getElementById('roomLabel').textContent = roomLabel(room);
  document.getElementById('chatPanel').classList.toggle('hidden', room === 'outside');
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
const INDOOR_SCALE = 1.8;
const INDOOR_WALL_HEIGHT = 150;

let renderer;
let outdoorScene, outdoorCamera;
let activeScene, activeCamera;
let mode = 'outdoor';          // 'outdoor' | 'indoor'
let indoorBuildingId = null;
let currentInterior = null;    // { scene, camera, roomW, roomD, doorStart, doorEnd, wallsLocal }
let groundY = 0;
const visuals = {}; // id -> { group, armL, armR, legL, legR, nameEl, bubbleEl, inScene, parentScene }
const interiorScenes = {};     // buildingId -> interior record
const lockVisuals = {};        // buildingId -> { door, lockSign }

const INTERIOR_THEMES = {
  cafe:    { label: 'Tavern',          wall: 0x8a6a4a, banner: 0xd98a4f, furniture: 'tavern' },
  library: { label: 'Scriptorium',     wall: 0x6f5a44, banner: 0x6f8fae, furniture: 'library' },
  arcade:  { label: "Alchemist's Den", wall: 0x55506a, banner: 0x9b5fc0, furniture: 'alchemist' },
  lounge:  { label: 'Noble Parlor',    wall: 0x7a4a52, banner: 0xc0596f, furniture: 'parlor' },
  hall:    { label: 'Great Hall',      wall: 0x6a6a48, banner: 0x8a9a5b, furniture: 'greathall' }
};

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
  if (p.room === 'outside' || !world) return { x: p.x, z: p.y };
  const b = world.buildings.find(bb => bb.id === p.room);
  if (!b) return { x: p.x, z: p.y };
  return { x: (p.x - b.x) * INDOOR_SCALE, z: (p.y - b.y) * INDOOR_SCALE };
}

function contextMatches(room) {
  return mode === 'outdoor' ? room === 'outside' : room === indoorBuildingId;
}

function initScene(w) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0ef);
  scene.fog = new THREE.Fog(0x8fd0ef, 700, 2200);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 4000);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const sun = new THREE.DirectionalLight(0xfff3d6, 0.9);
  sun.position.set(400, 600, 300);
  scene.add(sun);

  const groundGeo = new THREE.PlaneGeometry(w.width + 600, w.height + 600);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x2f5a35 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(w.width / 2, 0, w.height / 2);
  scene.add(ground);

  const grid = new THREE.GridHelper(Math.max(w.width, w.height) + 600, 60, 0x3f7a48, 0x3f7a48);
  grid.position.set(w.width / 2, 0.2, w.height / 2);
  scene.add(grid);

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
    const doorX = b.x + b.w / 2, doorY = b.y + b.h;
    scene.add(buildPathSegment(doorX, doorY, w.spawn.x, w.spawn.y, 46, dirtTex, hubRadius));
  }

  outdoorScene = scene;
  outdoorCamera = camera;
  mode = 'outdoor';
  indoorBuildingId = null;
  setActiveContext(outdoorScene, outdoorCamera, null);
  refreshBuildingLockVisuals();
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

function buildBuildingMesh(b, w) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: b.color });
  const wallRects = buildWallsForOne(b, w);
  for (const r of wallRects) {
    if (r.w <= 0 || r.h <= 0) continue;
    const geo = new THREE.BoxGeometry(r.w, WALL_HEIGHT, r.h);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(r.x + r.w / 2, WALL_HEIGHT / 2, r.y + r.h / 2);
    group.add(mesh);
  }

  // foundation plinth — a low, dark base so the building looks grounded
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(b.w + 14, 6, b.h + 14),
    new THREE.MeshLambertMaterial({ color: 0x4a4a4a })
  );
  foundation.position.set(b.x + b.w / 2, 3, b.y + b.h / 2);
  group.add(foundation);

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
  roof.position.set(b.x + b.w / 2, WALL_HEIGHT + roofHeight / 2, b.y + b.h / 2);
  group.add(roof);

  // a visible door slab filling the gap in the front wall — locked buildings
  // get a barred reddish door; the free building and unlocked ones get a
  // normal wooden door (kept in sync via refreshBuildingLockVisuals()).
  const t = w.wallThickness, doorH = 72;
  const locked = b.id !== FREE_BUILDING_ID && !unlocked;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(w.doorWidth - 6, doorH, t * 0.7),
    new THREE.MeshLambertMaterial({ color: locked ? 0x5a1f1f : 0x3c2616 })
  );
  door.position.set(b.x + b.w / 2, doorH / 2, b.y + b.h - t / 2);
  group.add(door);

  // glowing windows on the three solid walls (back, left, right)
  const winMat = new THREE.MeshBasicMaterial({ color: 0xfff1b0 });
  const winY = WALL_HEIGHT * 0.56;
  const backWin = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 2), winMat);
  backWin.position.set(b.x + b.w / 2, winY, b.y - 0.6);
  group.add(backWin);
  const leftWin = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 26), winMat);
  leftWin.position.set(b.x - 0.6, winY, b.y + b.h / 2);
  group.add(leftWin);
  const rightWin = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 26), winMat);
  rightWin.position.set(b.x + b.w + 0.6, winY, b.y + b.h / 2);
  group.add(rightWin);

  // floating sign with the building name, billboarded each frame
  const sign = makeSignSprite(b.name);
  sign.position.set(b.x + b.w / 2, WALL_HEIGHT + roofHeight + 22, b.y + b.h / 2);
  group.add(sign);

  // a second sign disclosing free-vs-premium status
  const tag = locked
    ? makeSignSprite('🔒 Premium — Unlock to enter')
    : (b.id === FREE_BUILDING_ID ? makeSignSprite('✓ Free to enter') : makeSignSprite('🔓 Unlocked'));
  tag.position.set(b.x + b.w / 2, WALL_HEIGHT + roofHeight - 4, b.y + b.h / 2);
  group.add(tag);

  lockVisuals[b.id] = { door, lockSign: tag };

  return group;
}

function buildWallsForOne(b, w) {
  const t = w.wallThickness, dw = w.doorWidth;
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
    const locked = b.id !== FREE_BUILDING_ID && !unlocked;
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

// ---------------------------------------------------------------------------
// Building interiors — medieval decor, built lazily the first time anyone
// local walks into a given building. Local coordinate space is the
// building's own (unscaled) footprint, 0..b.w by 0..b.h, with INDOOR_SCALE
// applied only for rendering — see getRenderPos()/updateIndoor().
// ---------------------------------------------------------------------------
function getInteriorScene(buildingId) {
  if (interiorScenes[buildingId]) return interiorScenes[buildingId];

  const b = world.buildings.find(bb => bb.id === buildingId);
  const wallsLocal = buildWallsForOne({ x: 0, y: 0, w: b.w, h: b.h }, world);
  const roomW = b.w * INDOOR_SCALE, roomD = b.h * INDOOR_SCALE;
  const dw = world.doorWidth * INDOOR_SCALE;
  const doorStart = (roomW - dw) / 2, doorEnd = doorStart + dw;
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

  // stone floor
  const floorTex = makeStoneTexture();
  floorTex.repeat.set(roomW / 60, roomD / 60);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(roomW, roomD),
    new THREE.MeshLambertMaterial({ map: floorTex })
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

  // exit sign above the doorway
  const exitSign = makeSignSprite('🚪 Walk south to leave');
  exitSign.position.set(roomW / 2, 95, roomD - 4);
  scene.add(exitSign);

  buildFurniture(scene, theme.furniture, roomW, roomD);

  const record = { scene, camera, roomW, roomD, doorStart, doorEnd, wallsLocal };
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

function buildFurniture(scene, type, roomW, roomD) {
  const cx = roomW / 2, cz = roomD / 2;
  if (type === 'tavern') {
    scene.add(makeRug(cx, cz, roomW * 0.55, roomD * 0.4, 0x7a2e2e));
    scene.add(makeTable(cx - 50, cz - 20));
    scene.add(makeBench(cx - 50, cz - 38, 0));
    scene.add(makeBench(cx - 50, cz - 2, 0));
    scene.add(makeTable(cx + 50, cz - 20));
    scene.add(makeBench(cx + 50, cz - 38, 0));
    scene.add(makeBench(cx + 50, cz - 2, 0));
    scene.add(makeBarrel(24, roomD - 30));
    scene.add(makeBarrel(roomW - 24, roomD - 30));
    scene.add(makeFireplace(cx, 14, Math.PI));
    scene.add(makeBanner(30, 90, 8, 0, 0xd98a4f));
    scene.add(makeBanner(roomW - 30, 90, 8, 0, 0xd98a4f));
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
    scene.add(makeTable(cx, cz - 15));
    scene.add(makeCauldron(cx, cz + 30));
    scene.add(makeBarrel(24, 24));
    scene.add(makeBarrel(roomW - 24, 24));
    scene.add(makeBanner(cx, 90, 8, 0, 0x9b5fc0));
  } else if (type === 'parlor') {
    scene.add(makeRug(cx, cz, roomW * 0.55, roomD * 0.4, 0x8a5a64));
    scene.add(makeFireplace(cx, 14, Math.PI));
    scene.add(makeBench(cx - 40, cz + 20, Math.PI / 2));
    scene.add(makeBench(cx + 40, cz + 20, -Math.PI / 2));
    scene.add(makeTable(cx, cz + 20));
    scene.add(makeBanner(30, 90, 8, 0, 0xc0596f));
    scene.add(makeBanner(roomW - 30, 90, 8, 0, 0xc0596f));
  } else { // greathall
    scene.add(makeRug(cx, cz, roomW * 0.6, roomD * 0.6, 0x6a6a3a));
    scene.add(makeThrone(cx, 30, 0));
    scene.add(makeTable(cx, cz + 15));
    scene.add(makeBench(cx - 26, cz + 30, 0));
    scene.add(makeBench(cx + 26, cz + 30, 0));
    scene.add(makeBanner(20, 95, 6, 0, 0x8a9a5b));
    scene.add(makeBanner(roomW - 20, 95, 6, 0, 0x8a9a5b));
  }
}

// ---------------------------------------------------------------------------
// Player visuals
// ---------------------------------------------------------------------------
function createHumanoid(color) {
  const group = new THREE.Group();
  const skin = 0xffd9b3, pants = 0x2b2b3a;

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 11, CHAR.torsoH, 8),
    new THREE.MeshLambertMaterial({ color })
  );
  torso.position.y = CHAR.hipY + CHAR.torsoH / 2;
  group.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(CHAR.headR, 14, 12),
    new THREE.MeshLambertMaterial({ color: skin })
  );
  head.position.y = CHAR.headY;
  group.add(head);

  function makeLimb(isArm, side) {
    const pivot = new THREE.Group();
    const length = isArm ? CHAR.armLen : CHAR.legLen;
    const radius = isArm ? 3.2 : 4.2;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.85, length, 6),
      new THREE.MeshLambertMaterial({ color: isArm ? skin : pants })
    );
    mesh.position.y = -length / 2;
    pivot.add(mesh);
    pivot.position.set(side * (isArm ? 11 : 5), isArm ? CHAR.shoulderY : CHAR.hipY, 0);
    return pivot;
  }
  const armL = makeLimb(true, -1), armR = makeLimb(true, 1);
  const legL = makeLimb(false, -1), legR = makeLimb(false, 1);
  group.add(armL, armR, legL, legR);

  return { group, armL, armR, legL, legR };
}

function ensurePlayerVisual(p) {
  if (visuals[p.id]) return;
  const built = createHumanoid(p.color);

  const nameEl = document.createElement('div');
  nameEl.className = 'nameTag';
  nameEl.textContent = p.name;
  document.body.appendChild(nameEl);

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'bubble';
  bubbleEl.style.display = 'none';
  document.body.appendChild(bubbleEl);

  // Not parented into any scene yet — syncVisuals() adds/removes it from
  // whichever scene matches the player's current room each frame.
  visuals[p.id] = { ...built, nameEl, bubbleEl, inScene: false, parentScene: null };
}

function destroyPlayerVisual(id) {
  const v = visuals[id];
  if (!v) return;
  if (v.inScene && v.parentScene) v.parentScene.remove(v.group);
  v.nameEl.remove();
  v.bubbleEl.remove();
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

    if (isMoving) {
      p.walkPhase += dt * 9;
      const swing = Math.sin(p.walkPhase) * 0.6;
      v.armL.rotation.x = swing; v.armR.rotation.x = -swing;
      v.legL.rotation.x = -swing; v.legR.rotation.x = swing;
    } else {
      const ease = Math.min(1, dt * 8);
      v.armL.rotation.x += (0 - v.armL.rotation.x) * ease;
      v.armR.rotation.x += (0 - v.armR.rotation.x) * ease;
      v.legL.rotation.x += (0 - v.legL.rotation.x) * ease;
      v.legR.rotation.x += (0 - v.legR.rotation.x) * ease;
    }

    const shouldShow = contextMatches(p.room);
    if (shouldShow && !v.inScene) {
      activeScene.add(v.group);
      v.inScene = true; v.parentScene = activeScene;
    } else if (!shouldShow && v.inScene) {
      v.parentScene.remove(v.group);
      v.inScene = false; v.parentScene = null;
    }

    if (shouldShow) {
      const rp = getRenderPos(p);
      v.group.position.set(rp.x, groundY, rp.z);
      v.group.rotation.y = p.facing;
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
      v.bubbleEl.style.display = 'none';
      continue;
    }
    const rp = getRenderPos(p);
    const headScreen = worldToScreen(rp.x, groundY + CHAR.headY, rp.z);
    if (!headScreen.visible) {
      v.nameEl.style.display = 'none';
      v.bubbleEl.style.display = 'none';
      continue;
    }
    v.nameEl.style.display = 'block';
    v.nameEl.style.left = headScreen.x + 'px';
    v.nameEl.style.top = (headScreen.y - 14) + 'px';

    if (p.lastMsg && Date.now() - p.lastMsg.ts < 4500) {
      v.bubbleEl.style.display = 'block';
      v.bubbleEl.textContent = p.lastMsg.text;
      v.bubbleEl.style.left = headScreen.x + 'px';
      v.bubbleEl.style.top = (headScreen.y - 34) + 'px';
    } else {
      v.bubbleEl.style.display = 'none';
    }
  }
}

function updateCamera(dt) {
  if (!me) return;
  const rp = getRenderPos(me);
  const f = me.facing;
  const cam = mode === 'outdoor' ? OUTDOOR_CAM : INDOOR_CAM;
  const targetX = rp.x - Math.sin(f) * cam.back;
  const targetZ = rp.z - Math.cos(f) * cam.back;
  const targetY = groundY + cam.height;

  const ease = 1 - Math.exp(-dt * 6);
  activeCamera.position.x += (targetX - activeCamera.position.x) * ease;
  activeCamera.position.y += (targetY - activeCamera.position.y) * ease;
  activeCamera.position.z += (targetZ - activeCamera.position.z) * ease;

  if (mode === 'indoor' && currentInterior) {
    const margin = 18;
    activeCamera.position.x = Math.max(margin, Math.min(currentInterior.roomW - margin, activeCamera.position.x));
    activeCamera.position.z = Math.max(margin, Math.min(currentInterior.roomD - margin, activeCamera.position.z));
  }

  activeCamera.lookAt(rp.x, groundY + cam.lookUp, rp.z);
}

// ---------------------------------------------------------------------------
// Entering / leaving a building
// ---------------------------------------------------------------------------
function enterBuilding(roomId) {
  const interior = getInteriorScene(roomId);
  mode = 'indoor';
  indoorBuildingId = roomId;
  me.room = roomId;
  setActiveContext(interior.scene, interior.camera, interior);
  maybeUpdateRoomUI(roomId);
}

function exitBuilding(b) {
  mode = 'outdoor';
  indoorBuildingId = null;
  me.x = b.x + b.w / 2;
  me.y = b.y + b.h + 26; // nudge just outside the door so they don't immediately re-enter
  me.room = 'outside';
  setActiveContext(outdoorScene, outdoorCamera, null);
  maybeUpdateRoomUI('outside');
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now();
let moveSendTimer = 0;
const SPEED = 230;       // world units/sec, forward/back
const TURN_SPEED = 3.0;  // radians/sec

function updateOutdoor(stepX, stepY) {
  const nx = me.x + stepX, ny = me.y + stepY;

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

  if (!collidesIndoor(nx, localY, interior.wallsLocal)) localX = nx;
  if (!collidesIndoor(localX, ny, interior.wallsLocal)) localY = ny;

  // Walking through the door gap (south wall, local space) exits the building.
  const localDoorStart = interior.doorStart / INDOOR_SCALE;
  const localDoorEnd = interior.doorEnd / INDOOR_SCALE;
  if (localY > b.h - PLAYER_R * 0.4 && localX > localDoorStart && localX < localDoorEnd) {
    exitBuilding(b);
    return;
  }

  localX = Math.max(PLAYER_R, Math.min(b.w - PLAYER_R, localX));
  localY = Math.max(PLAYER_R, Math.min(b.h - PLAYER_R, localY));
  me.x = b.x + localX;
  me.y = b.y + localY;
}

function update(dt) {
  if (!me) return;

  // Relative controls: W/up = walk forward in whatever direction you're
  // currently facing, S/down = walk backward, A/D or left/right = turn in
  // place. Nothing here is bound to map axes — "forward" always means
  // "the way the character is currently pointed." Identical indoors and out.
  let moveInput = 0, turnInput = 0;
  if (!typing) {
    if (keys.up) moveInput += 1;
    if (keys.down) moveInput -= 1;
    if (keys.left) turnInput += 1;
    if (keys.right) turnInput -= 1;
  }
  if (joyVec.x || joyVec.y) {
    moveInput += -joyVec.y; // push stick up = walk forward
    turnInput += joyVec.x;  // push stick sideways = turn
  }
  moveInput = Math.max(-1, Math.min(1, moveInput));
  turnInput = Math.max(-1, Math.min(1, turnInput));

  me.facing += turnInput * TURN_SPEED * dt;
  const fx = Math.sin(me.facing), fy = Math.cos(me.facing);
  const stepX = fx * moveInput * SPEED * dt;
  const stepY = fy * moveInput * SPEED * dt;

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
  updateCamera(dt);

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
