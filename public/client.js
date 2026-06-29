(function () {
"use strict";

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------
const proto = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(proto + '://' + location.host);

let myId = null;
let world = null;
let walls = [];           // generated collision rects, derived from world.buildings
let players = {};         // id -> {id,name,color,x,y,room, renderX, renderY, lastMsg}
let me = null;            // convenience pointer to players[myId]
let currentRoom = 'outside';
const messagesByRoom = {}; // room id -> array of {name,color,text,ts}

ws.addEventListener('open', () => {
  setStatus(true);
});
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
    for (const p of msg.players) addPlayer(p);
    me = players[myId];
    document.getElementById('joinScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('chatPanel').classList.remove('hidden');
    if (isTouchDevice()) document.getElementById('joystick').classList.add('show');
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
    delete players[msg.id];
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
    if (m.room === currentRoom) {
      renderChatLog();
    }
    return;
  }
});

function addPlayer(p) {
  players[p.id] = {
    id: p.id, name: p.name, color: p.color,
    x: p.x, y: p.y, targetX: p.x, targetY: p.y,
    room: p.room, lastMsg: null
  };
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
// World / collision
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
// Input — keyboard + touch joystick
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

// Joystick
const joystickEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
let joyVec = { x: 0, y: 0 };
let joyActive = false, joyOrigin = { x: 0, y: 0 };

joystickEl.addEventListener('touchstart', (e) => {
  joyActive = true;
  const t = e.touches[0];
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
// Chat UI
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
// Main loop
// ---------------------------------------------------------------------------
let last = performance.now();
let moveSendTimer = 0;
const SPEED = 230; // px/sec

function update(dt) {
  if (!me) return;

  let dx = 0, dy = 0;
  if (!typing) {
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
  }
  if (joyVec.x || joyVec.y) { dx += joyVec.x; dy += joyVec.y; }

  const len = Math.hypot(dx, dy);
  if (len > 0) { dx /= len; dy /= len; }

  const nx = me.x + dx * SPEED * dt;
  const ny = me.y + dy * SPEED * dt;

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

  moveSendTimer -= dt;
  if (moveSendTimer <= 0) {
    moveSendTimer = 0.05;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'move', x: me.x, y: me.y, room: me.room }));
    }
  }

  document.getElementById('peopleCount').textContent = Object.keys(players).length;
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function drawGround(camX, camY) {
  ctx.fillStyle = '#27432c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  const grid = 64;
  const startX = -((camX) % grid);
  const startY = -((camY) % grid);
  for (let x = startX; x < W; x += grid) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = startY; y < H; y += grid) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
}

function drawBuilding(b, camX, camY) {
  const x = b.x - camX, y = b.y - camY;
  ctx.save();
  ctx.translate(x, y);
  // walls
  ctx.fillStyle = b.color;
  ctx.fillRect(0, 0, b.w, b.h);
  // roof strip
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 0, b.w, 14);
  // door gap (lighter, shows entrance)
  const dw = world.doorWidth;
  const doorStart = (b.w - dw) / 2;
  ctx.fillStyle = 'rgba(40,30,20,0.55)';
  ctx.fillRect(doorStart, b.h - 16, dw, 16);
  // outline
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, b.w - 3, b.h - 3);
  ctx.restore();

  ctx.fillStyle = '#eafff0';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.name, x + b.w / 2, y - 10);
}

function drawPlayer(p, camX, camY, isMe) {
  const x = p.x - camX, y = p.y - camY;
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = p.color;
  ctx.shadowBlur = isMe ? 16 : 8;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (isMe) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(p.name, x, y - PLAYER_R - 8);
  ctx.shadowBlur = 0;

  if (p.lastMsg && Date.now() - p.lastMsg.ts < 4500) {
    drawBubble(p.lastMsg.text, x, y - PLAYER_R - 24);
  }
}

function drawBubble(text, x, y) {
  ctx.font = '12px sans-serif';
  const padding = 8;
  const w = Math.min(180, ctx.measureText(text).width + padding * 2);
  const h = 24;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - w/2, y - h, w, h, 8) : ctx.rect(x - w/2, y - h, w, h);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  let display = text;
  if (ctx.measureText(text).width > w - padding*2) {
    while (display.length > 3 && ctx.measureText(display + '…').width > w - padding*2) {
      display = display.slice(0, -1);
    }
    display += '…';
  }
  ctx.fillText(display, x, y - h/2 + 4);
}

function render() {
  if (!me || !world) return;
  let camX = clamp(me.x - W/2, 0, Math.max(0, world.width - W));
  let camY = clamp(me.y - H/2, 0, Math.max(0, world.height - H));
  if (world.width < W) camX = -(W - world.width)/2;
  if (world.height < H) camY = -(H - world.height)/2;

  drawGround(camX, camY);

  for (const b of world.buildings) drawBuilding(b, camX, camY);

  const order = Object.values(players);
  for (const p of order) if (p.id !== myId) drawPlayer(p, camX, camY, false);
  drawPlayer(me, camX, camY, true);
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

})();
