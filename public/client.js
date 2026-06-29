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
let players = {};         // id -> {id,name,color,x,y,room,targetX,targetY,...visual state}
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
    document.getElementById('inventoryBtn').classList.remove('hidden');
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

  if (msg.type === 'note_destroyed') {
    setUnlockToast(`🔥 Your note was read and destroyed by ${msg.byName}`);
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
});

function addPlayer(p) {
  if (players[p.id]) return;
  players[p.id] = {
    id: p.id, name: p.name, color: p.color,
    x: p.x, y: p.y, targetX: p.x, targetY: p.y,
    renderPrevX: p.x, renderPrevY: p.y,
    room: p.room,
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
  const payload = { type: 'join', name, password: passInput.value };
  if (joinMode === 'account' && savedAccount) payload.accountToken = savedAccount.token;
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
  const b = world.buildings.find(x => x.id === roomId);
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
// Inventory — currently holds one item type: private written notes, passed
// player-to-player. Notes are never stored server-side (see server.js), so
// the only copy that ever exists is sitting in the recipient's inbox array
// here until they read it — reading it removes it immediately and tells the
// server to let the sender know it's gone. No accounts/persistence, so this
// is all just in-memory for the current tab/session like everything else.
// ---------------------------------------------------------------------------
const inbox = []; // { id, fromId, fromName, text, read }

const inventoryBtn = document.getElementById('inventoryBtn');
const inventoryPanel = document.getElementById('inventoryPanel');
let inventoryOpen = false;

function toggleInventory() {
  inventoryOpen = !inventoryOpen;
  inventoryPanel.classList.toggle('hidden', !inventoryOpen);
  if (inventoryOpen) refreshNoteRecipients();
}
if (inventoryBtn) inventoryBtn.addEventListener('click', toggleInventory);

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

function readNote(noteId) {
  const note = inbox.find(n => n.id === noteId);
  if (!note || note.read) return;
  note.read = true;
  ws.send(JSON.stringify({ type: 'read_note', id: note.id, fromId: note.fromId }));
  renderInventory();
  setTimeout(() => {
    const idx = inbox.findIndex(n => n.id === noteId);
    if (idx !== -1) inbox.splice(idx, 1);
    renderInventory();
  }, 4000);
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
      const body = document.createElement('div');
      body.textContent = note.text;
      div.appendChild(body);
      const burning = document.createElement('div');
      burning.className = 'noteBurning';
      burning.textContent = '🔥 Self-destructing…';
      div.appendChild(burning);
    } else {
      const btn = document.createElement('button');
      btn.className = 'noteReadBtn';
      btn.textContent = '📖 Read (self-destructs)';
      btn.addEventListener('click', () => readNote(note.id));
      div.appendChild(btn);
    }
    list.appendChild(div);
  }
}

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

// Jump is a purely cosmetic vertical bounce on the local player's model —
// there's no gravity/physics system in this game, just an arc over a fixed
// duration (see syncVisuals()/update()).
const JUMP_DURATION = 0.45, JUMP_HEIGHT = 34;
let jumpActive = false, jumpT = 0;

function tryJump() {
  if (jumpActive || typing || passModalOpen || arcadeModalOpen || seatedAt) return;
  jumpActive = true;
  jumpT = 0;
}

window.addEventListener('keydown', (e) => {
  if (typing || passModalOpen || arcadeModalOpen) return;
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
let dragging = false, lastDragX = 0, lastDragY = 0;

canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  cameraYawOffset -= (e.clientX - lastDragX) * 0.006;
  cameraPitchOffset -= (e.clientY - lastDragY) * 0.006; // drag up = look up
  cameraPitchOffset = Math.max(-CAMERA_PITCH_LIMIT, Math.min(CAMERA_PITCH_LIMIT, cameraPitchOffset));
  lastDragX = e.clientX;
  lastDragY = e.clientY;
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mouseleave', () => { dragging = false; });

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

function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text && !pendingImage) return;
  const payload = { type: 'chat', text };
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
// Arcade-only: the (3x larger) chat panel can switch into an embedded web
// browser. This is purely client-side — the iframe loads whatever URL the
// player types directly in their own browser, same as opening a new tab.
// Many sites set headers (X-Frame-Options/CSP frame-ancestors) that block
// being embedded like this; that's the site's own restriction and shows up
// as a blank/refused frame, not an error in this game.
// ---------------------------------------------------------------------------
const chatTabChatBtn = document.getElementById('chatTabChat');
const chatTabBrowserBtn = document.getElementById('chatTabBrowser');
const chatLogView = document.getElementById('chatLogView');
const browserView = document.getElementById('browserView');
const browserFrame = document.getElementById('browserFrame');
const browserUrlInput = document.getElementById('browserUrlInput');
const browserGoBtn = document.getElementById('browserGoBtn');

function showChatTab() {
  chatLogView.classList.remove('hidden');
  browserView.classList.add('hidden');
  if (chatTabChatBtn) chatTabChatBtn.classList.add('active');
  if (chatTabBrowserBtn) chatTabBrowserBtn.classList.remove('active');
  browserFrame.src = 'about:blank'; // stop whatever was loaded/playing while out of view
}

function showBrowserTab() {
  chatLogView.classList.add('hidden');
  browserView.classList.remove('hidden');
  if (chatTabChatBtn) chatTabChatBtn.classList.remove('active');
  if (chatTabBrowserBtn) chatTabBrowserBtn.classList.add('active');
}

function navigateBrowser() {
  let url = browserUrlInput.value.trim();
  if (!url) return;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) url = 'https://' + url;
  browserFrame.src = url;
}

if (chatTabChatBtn) chatTabChatBtn.addEventListener('click', showChatTab);
if (chatTabBrowserBtn) chatTabBrowserBtn.addEventListener('click', showBrowserTab);
if (browserGoBtn) browserGoBtn.addEventListener('click', navigateBrowser);
if (browserUrlInput) {
  browserUrlInput.addEventListener('focus', () => { typing = true; });
  browserUrlInput.addEventListener('blur', () => { typing = false; });
  browserUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigateBrowser();
    else if (e.key === 'Escape') browserUrlInput.blur();
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
  document.getElementById('chatPanel').classList.toggle('hidden', room === 'outside');
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
let activeScene, activeCamera;
let mode = 'outdoor';          // 'outdoor' | 'indoor'
let indoorBuildingId = null;
let currentInterior = null;    // { scene, camera, roomW, roomD, doorStart, doorEnd, wallsLocal }
let groundY = 0;
const visuals = {}; // id -> { group, armL, armR, legL, legR, nameEl, inScene, parentScene }
const interiorScenes = {};     // buildingId -> interior record
const lockVisuals = {};        // buildingId -> { door, lockSign }

const INTERIOR_THEMES = {
  cafe:    { label: 'Tavern',          wall: 0x8a6a4a, banner: 0xd98a4f, furniture: 'tavern',    floorTint: 0xffffff },
  library: { label: 'Scriptorium',     wall: 0x6f5a44, banner: 0x6f8fae, furniture: 'library',   floorTint: 0xb9c6ff },
  arcade:  { label: "Alchemist's Den", wall: 0x55506a, banner: 0x9b5fc0, furniture: 'alchemist',  floorTint: 0xd9b8ff },
  lounge:  { label: 'Noble Parlor & Terrace', wall: 0x7a4a52, banner: 0xc0596f, furniture: 'parlor', floorTint: 0xffc9d2 },
  hall:    { label: 'Great Hall',      wall: 0x6a6a48, banner: 0x8a9a5b, furniture: 'greathall',  floorTint: 0xd7e6a0 }
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
  hall:    { w: 480, h: 500 }   // door axis (w) matches outdoor; deep great hall
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

  addNatureDecor(scene);
  addAnimals(scene);

  outdoorScene = scene;
  outdoorCamera = camera;
  mode = 'outdoor';
  indoorBuildingId = null;
  setActiveContext(outdoorScene, outdoorCamera, null);
  refreshBuildingLockVisuals();
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

// Fixed (not random-per-load) positions so every connected client sees the
// same nature layout, scaled up to match the world's current footprint.
// Kept clear of building footprints, the spawn hub, and the dirt paths
// radiating from it. Trees get a small trunk collision box pushed into the
// same `walls` array buildings use, so you can't walk through them; shrubs,
// rocks, and flower patches are purely decorative ground cover (walk-through).
const NATURE_DECOR = [
  { type: 'tree', x: 80,   y: 935,  scale: 1.1 },  { type: 'tree', x: 145,  y: 1175, scale: 0.9 },
  { type: 'tree', x: 65,   y: 1360, scale: 1.0 },  { type: 'shrub', x: 175, y: 1015, scale: 1.0 },
  { type: 'shrub', x: 120, y: 1280, scale: 0.8 },  { type: 'tree', x: 935,  y: 80,   scale: 1.0 },
  { type: 'tree', x: 1160, y: 55,   scale: 0.85 }, { type: 'shrub', x: 1040,y: 120,  scale: 1.0 },
  { type: 'tree', x: 3065, y: 935,  scale: 1.0 },  { type: 'tree', x: 3135, y: 1175, scale: 0.9 },
  { type: 'tree', x: 3080, y: 1360, scale: 1.05 }, { type: 'shrub', x: 2985,y: 1025, scale: 0.9 },
  { type: 'shrub', x: 3040,y: 1265, scale: 1.0 },  { type: 'tree', x: 935,  y: 2135, scale: 1.0 },
  { type: 'tree', x: 1200, y: 2160, scale: 0.95 }, { type: 'tree', x: 2000, y: 2145, scale: 1.0 },
  { type: 'tree', x: 2265, y: 2120, scale: 0.9 },  { type: 'shrub', x: 1065,y: 2095, scale: 1.0 },
  { type: 'shrub', x: 2135,y: 2080, scale: 0.85 }, { type: 'tree', x: 1975, y: 80,   scale: 0.9 },
  { type: 'tree', x: 2160, y: 105,  scale: 1.0 },  { type: 'shrub', x: 2065,y: 55,   scale: 0.9 },
  { type: 'tree', x: 105,  y: 335,  scale: 0.95 }, { type: 'tree', x: 3105, y: 335,  scale: 0.95 },
  { type: 'shrub', x: 80,  y: 1865, scale: 1.0 },  { type: 'shrub', x: 3120,y: 1865, scale: 1.0 },
  // Extra growth for the larger map — rocks and flower patches dotted
  // through the open grass for more visual variety/realism.
  { type: 'rock', x: 500,  y: 1100, scale: 1.0 },  { type: 'rock', x: 1100, y: 1700, scale: 0.9 },
  { type: 'rock', x: 2100, y: 1700, scale: 1.1 },  { type: 'rock', x: 2700, y: 1100, scale: 0.9 },
  { type: 'rock', x: 1600, y: 1700, scale: 1.0 },  { type: 'rock', x: 1050, y: 650,  scale: 0.85 },
  { type: 'flower', x: 950,  y: 1200, scale: 1.0 },{ type: 'flower', x: 1700, y: 750,  scale: 1.0 },
  { type: 'flower', x: 2450, y: 1300, scale: 1.0 },{ type: 'flower', x: 1300, y: 900,  scale: 0.9 },
  { type: 'flower', x: 2000, y: 1500, scale: 1.0 },{ type: 'flower', x: 600,  y: 1400, scale: 0.95 }
];

function addNatureDecor(scene) {
  for (const d of NATURE_DECOR) {
    if (d.type === 'tree') {
      scene.add(makeTree(d.x, d.y, d.scale));
      const r = 8 * (d.scale || 1);
      walls.push({ x: d.x - r, y: d.y - r, w: r * 2, h: r * 2 });
    } else if (d.type === 'shrub') {
      scene.add(makeShrub(d.x, d.y, d.scale));
    } else if (d.type === 'rock') {
      scene.add(makeRock(d.x, d.y, d.scale));
    } else if (d.type === 'flower') {
      scene.add(makeFlowerPatch(d.x, d.y, d.scale));
    }
  }
}

// ---------------------------------------------------------------------------
// Wildlife — a handful of rabbits wandering the open grass, purely cosmetic.
// Each connected client runs this same flee/wander logic independently,
// reacting only to its own player; there's no server involvement and no
// shared/synced state, so two players standing near the same rabbit may see
// it dodge in very slightly different directions. That's an acceptable
// tradeoff for something this lightweight — it's flavor, not gameplay.
// ---------------------------------------------------------------------------
const ANIMAL_SPAWNS = [
  { x: 1600, y: 700 },  { x: 1600, y: 1500 }, { x: 1000, y: 1100 },
  { x: 2200, y: 1100 }, { x: 1300, y: 1750 }, { x: 1950, y: 520 },
  { x: 500,  y: 1300 }, { x: 2700, y: 1300 }, { x: 1100, y: 600 },
  { x: 2100, y: 1850 }
];
const ANIMAL_FLEE_RADIUS = 130; // start running once the player gets this close
const ANIMAL_SAFE_RADIUS = 190; // ...and don't relax back to wandering until clearly clear, to avoid flicker
const ANIMAL_FLEE_SPEED = 110;
const ANIMAL_WANDER_SPEED = 26;
const ANIMAL_R = 9;
let animals = [];

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
  return g;
}

function addAnimals(scene) {
  animals = ANIMAL_SPAWNS.map(p => ({
    x: p.x, y: p.y,
    facing: Math.random() * Math.PI * 2,
    fleeing: false,
    wanderTimer: Math.random() * 2,
    wanderAngle: 0,
    grazing: false,
    hopPhase: Math.random() * Math.PI * 2,
    mesh: makeRabbit()
  }));
  for (const a of animals) {
    a.mesh.position.set(a.x, 0, a.y);
    scene.add(a.mesh);
  }
}

// Reuses the same wall-rect list buildings/trees collide against, just with
// a much smaller radius, so rabbits steer around buildings and tree trunks
// instead of clipping through them while fleeing.
function animalBlocked(x, y) {
  for (const wl of walls) {
    if (x > wl.x - ANIMAL_R && x < wl.x + wl.w + ANIMAL_R && y > wl.y - ANIMAL_R && y < wl.y + wl.h + ANIMAL_R) return true;
  }
  return false;
}

function updateAnimals(dt) {
  if (!world || !me) return;
  for (const a of animals) {
    const dx = a.x - me.x, dy = a.y - me.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ANIMAL_FLEE_RADIUS) a.fleeing = true;
    else if (dist > ANIMAL_SAFE_RADIUS) a.fleeing = false;

    let vx = 0, vy = 0;
    if (a.fleeing) {
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * ANIMAL_FLEE_SPEED;
      vy = dy * inv * ANIMAL_FLEE_SPEED;
    } else {
      a.wanderTimer -= dt;
      if (a.wanderTimer <= 0) {
        a.wanderTimer = 1.5 + Math.random() * 2.5;
        a.grazing = Math.random() < 0.35; // pause to "graze" sometimes instead of always wandering
        a.wanderAngle = Math.random() * Math.PI * 2;
      }
      if (!a.grazing) {
        vx = Math.sin(a.wanderAngle) * ANIMAL_WANDER_SPEED;
        vy = Math.cos(a.wanderAngle) * ANIMAL_WANDER_SPEED;
      }
    }

    const margin = 60;
    const nx = a.x + vx * dt, ny = a.y + vy * dt;
    if (vx !== 0 && !animalBlocked(nx, a.y) && nx > margin && nx < world.width - margin) a.x = nx;
    if (vy !== 0 && !animalBlocked(a.x, ny) && ny > margin && ny < world.height - margin) a.y = ny;

    const moving = vx !== 0 || vy !== 0;
    if (moving) a.facing = Math.atan2(vx, vy);
    a.hopPhase += dt * (a.fleeing ? 14 : 5);
    const hop = moving ? Math.abs(Math.sin(a.hopPhase)) * (a.fleeing ? 6 : 2.5) : 0;

    a.mesh.position.set(a.x, hop, a.y);
    a.mesh.rotation.y = a.facing;
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

  // exit sign above the doorway — wherever the door actually is
  const exitSign = makeSignSprite(`🚪 Walk ${side} to leave`);
  if (side === 'east') exitSign.position.set(roomW - 4, 95, roomD / 2);
  else if (side === 'west') exitSign.position.set(4, 95, roomD / 2);
  else if (side === 'north') exitSign.position.set(roomW / 2, 95, 4);
  else exitSign.position.set(roomW / 2, 95, roomD - 4);
  scene.add(exitSign);

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

  // Not parented into any scene yet — syncVisuals() adds/removes it from
  // whichever scene matches the player's current room each frame.
  visuals[p.id] = { ...built, nameEl, inScene: false, parentScene: null };
}

function destroyPlayerVisual(id) {
  const v = visuals[id];
  if (!v) return;
  if (v.inScene && v.parentScene) v.parentScene.remove(v.group);
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

    if (id === myId && seatedAt) {
      const ease = Math.min(1, dt * 8);
      const legBend = -Math.PI / 2.1, armBend = 0.15;
      v.legL.rotation.x += (legBend - v.legL.rotation.x) * ease;
      v.legR.rotation.x += (legBend - v.legR.rotation.x) * ease;
      v.armL.rotation.x += (armBend - v.armL.rotation.x) * ease;
      v.armR.rotation.x += (armBend - v.armR.rotation.x) * ease;
    } else if (isMoving) {
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
      const seatedYOffset = (id === myId && seatedAt) ? -8 : 0;
      const jumpYOffset = (id === myId && jumpActive) ? Math.sin(Math.PI * jumpT / JUMP_DURATION) * JUMP_HEIGHT : 0;
      const floorYOffset = getFloorHeight(p.room, rp.x);
      v.group.position.set(rp.x, groundY + seatedYOffset + jumpYOffset + floorYOffset, rp.z);
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
  const cam = mode === 'outdoor' ? OUTDOOR_CAM : (seatedAt ? INDOOR_SEATED_CAM : INDOOR_CAM);
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
function findNearestKiosk() {
  if (!currentInterior || !currentInterior.kiosks || !me) return null;
  const rp = getRenderPos(me);
  let best = null, bestDist = 50;
  for (const k of currentInterior.kiosks) {
    const d = Math.hypot(rp.x - k.x, rp.z - k.z);
    if (d < bestDist) { bestDist = d; best = k; }
  }
  return best;
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

function tryInteract() {
  if (mode !== 'indoor' || !me) return;
  if (seatedAt) { standUp(); return; }
  const seat = findNearestSeat();
  if (seat) {
    if (seatIsOccupied(seat)) { setUnlockToast('That seat is taken.'); return; }
    sitDown(seat);
    return;
  }
  const kiosk = findNearestKiosk();
  if (kiosk && kiosk.game) { openArcadeGame(kiosk.game); return; }
  if (PAYWALLS_ENABLED && kiosk && kiosk.id === 'town_pass') { openPassModal(); }
}

function updateInteractHint() {
  const hint = document.getElementById('interactHint');
  if (!hint) return;
  if (mode !== 'indoor' || !me || passModalOpen || arcadeModalOpen) { hint.classList.add('hidden'); return; }
  if (seatedAt) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = 'Press F to stand';
    return;
  }
  const seat = findNearestSeat();
  if (seat && !seatIsOccupied(seat)) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = 'Press F to sit';
    return;
  }
  const kiosk = findNearestKiosk();
  if (kiosk && kiosk.game) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = 'Press F to play ' + (kiosk.game === 'snake' ? 'Snake' : 'Breakout');
    return;
  }
  if (PAYWALLS_ENABLED && kiosk) {
    hint.classList.remove('hidden');
    document.getElementById('interactHintText').textContent = 'Press F to view Town Pass';
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
  if (arcadeModalOpen) return; // the dedicated arcade-game keydown listener owns Escape/controls while playing
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
  if (!typing && !seatedAt && !passModalOpen && !arcadeModalOpen) {
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
  // is throttled slightly compared to the open town square.
  const speed = mode === 'indoor' ? SPEED * 0.9 : SPEED;
  const stepX = (fx * moveInput + rx * strafeInput) * speed * dt;
  const stepY = (fy * moveInput + ry * strafeInput) * speed * dt;

  if (jumpActive) {
    jumpT += dt;
    if (jumpT >= JUMP_DURATION) { jumpActive = false; jumpT = 0; }
  }

  if (mode === 'outdoor') {
    updateOutdoor(stepX, stepY);
    updateAnimals(dt);
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
