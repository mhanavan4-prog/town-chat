(function () {
"use strict";

const canvas = document.getElementById('game');
let W = 0, H = 0;
function resize(){
  W = window.innerWidth; H = window.innerHeight;
  if (renderer) {
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Networking  (unchanged protocol: server only ever sees plain x/y numbers —
// the 3D scene just renders that same x/y as a ground-plane x/z coordinate)
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
    document.getElementById('chatPanel').classList.remove('hidden');
    if (isTouchDevice()) document.getElementById('joystick').classList.add('show');
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
// Chat UI (unchanged)
// ---------------------------------------------------------------------------
const chatInput = document.getElementById('chatInput');
const chatLog = document.getElementById('chatLog');
chatInput.addEventListener('focus', () => { typing = true; });
chatInput.addEventListener('blur', () => { typing = false; });
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
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
  renderChatLog();
}

// ---------------------------------------------------------------------------
// 3D scene — Three.js (r128, loaded from CDN in index.html)
// ---------------------------------------------------------------------------
const CHAR = {
  legLen: 26, torsoH: 26, armLen: 22, headR: 8,
  get hipY() { return this.legLen; },
  get shoulderY() { return this.legLen + this.torsoH; },
  get headY() { return this.shoulderY + this.headR + 2; }
};
const WALL_HEIGHT = 110;
const CAMERA_BACK = 165, CAMERA_UP = 125, LOOK_UP = 50;

let renderer, scene, camera;
let groundY = 0;
const visuals = {}; // id -> { group, armL, armR, legL, legR, nameEl, bubbleEl }

function initScene(w) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd0ef);
  scene.fog = new THREE.Fog(0x8fd0ef, 700, 2200);

  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 4000);

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

  // a visible door slab filling the gap in the front wall
  const t = w.wallThickness, doorH = 72;
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(w.doorWidth - 6, doorH, t * 0.7),
    new THREE.MeshLambertMaterial({ color: 0x3c2616 })
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
  scene.add(built.group);

  const nameEl = document.createElement('div');
  nameEl.className = 'nameTag';
  nameEl.textContent = p.name;
  document.body.appendChild(nameEl);

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'bubble';
  bubbleEl.style.display = 'none';
  document.body.appendChild(bubbleEl);

  visuals[p.id] = { ...built, nameEl, bubbleEl };
}

function destroyPlayerVisual(id) {
  const v = visuals[id];
  if (!v) return;
  scene.remove(v.group);
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

    v.group.position.set(p.x, groundY, p.y);
    v.group.rotation.y = p.facing;

    p.renderPrevX = p.x; p.renderPrevY = p.y;
  }
}

function worldToScreen(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera);
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
    const headScreen = worldToScreen(p.x, groundY + CHAR.headY, p.y);
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
  const f = me.facing;
  const targetX = me.x - Math.sin(f) * CAMERA_BACK;
  const targetZ = me.y - Math.cos(f) * CAMERA_BACK;
  const targetY = groundY + CAMERA_UP;

  const ease = 1 - Math.exp(-dt * 6);
  camera.position.x += (targetX - camera.position.x) * ease;
  camera.position.y += (targetY - camera.position.y) * ease;
  camera.position.z += (targetZ - camera.position.z) * ease;
  camera.lookAt(me.x, groundY + LOOK_UP, me.y);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now();
let moveSendTimer = 0;
const SPEED = 230;       // world units/sec, forward/back
const TURN_SPEED = 3.0;  // radians/sec

function update(dt) {
  if (!me) return;

  // Relative controls: W/up = walk forward in whatever direction you're
  // currently facing, S/down = walk backward, A/D or left/right = turn in
  // place. Nothing here is bound to map axes — "forward" always means
  // "the way the character is currently pointed."
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
  const nx = me.x + fx * moveInput * SPEED * dt;
  const ny = me.y + fy * moveInput * SPEED * dt;

  // axis-separated collision so sliding along walls feels natural
  if (!collides(nx, me.y)) me.x = nx;
  if (!collides(me.x, ny)) me.y = ny;

  me.x = Math.max(PLAYER_R, Math.min(world.width - PLAYER_R, me.x));
  me.y = Math.max(PLAYER_R, Math.min(world.height - PLAYER_R, me.y));

  const room = roomAt(me.x, me.y);
  me.room = room;
  maybeUpdateRoomUI(room);

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
  if (!me || !world || !renderer) return;
  renderer.render(scene, camera);
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
