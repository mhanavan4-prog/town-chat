// Town Chat — multiplayer world server
// Express serves the static client; "ws" handles realtime player movement + room-scoped chat.

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const Stripe = require('stripe');

const PORT = process.env.PORT || 3000;
// Set TOWN_PASSWORD as an environment variable on your host to gate the town.
// Leave unset for no password (anyone with the link can join).
const TOWN_PASSWORD = process.env.TOWN_PASSWORD || '';

// Optional real-money paywall for the premium buildings. Leave
// STRIPE_SECRET_KEY unset on a host and the "Unlock" button simply stays
// hidden on the client — everything else still works with only the free
// building enterable.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const PREMIUM_PRICE_CENTS = parseInt(process.env.PREMIUM_PRICE_CENTS, 10) || 300;
// A cheaper, single-room, time-limited pass — bought from the statue inside
// the free building. Defaults to $1.00 for 4 hours of Arcade access.
const ROOM_PASS_PRICE_CENTS = parseInt(process.env.ROOM_PASS_PRICE_CENTS, 10) || 100;
const ROOM_PASS_HOURS = parseFloat(process.env.ROOM_PASS_HOURS) || 4;
const ROOM_PASS_ROOMS = { arcade: { label: 'Arcade', name: 'Town Chat — Arcade Pass' } };
const stripeClient = STRIPE_SECRET_KEY ? Stripe(STRIPE_SECRET_KEY) : null;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.json({
    paymentsEnabled: !!stripeClient,
    premiumPriceCents: PREMIUM_PRICE_CENTS,
    roomPassPriceCents: ROOM_PASS_PRICE_CENTS,
    roomPassHours: ROOM_PASS_HOURS
  });
});

app.post('/api/checkout', async (req, res) => {
  if (!stripeClient) return res.status(503).json({ error: 'Payments are not set up on this server yet.' });
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: PREMIUM_PRICE_CENTS,
          product_data: {
            name: 'Town Chat — All-Access Pass',
            description: 'Unlocks every premium building in town for this browser.'
          }
        },
        quantity: 1
      }],
      success_url: `${origin}/?unlock_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
});

app.post('/api/checkout-room', async (req, res) => {
  if (!stripeClient) return res.status(503).json({ error: 'Payments are not set up on this server yet.' });
  const room = String(req.body.room || '');
  const roomInfo = ROOM_PASS_ROOMS[room];
  if (!roomInfo) return res.status(400).json({ error: 'Unknown room pass.' });
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: ROOM_PASS_PRICE_CENTS,
          product_data: {
            name: roomInfo.name,
            description: `${ROOM_PASS_HOURS}-hour access to the ${roomInfo.label}.`
          }
        },
        quantity: 1
      }],
      success_url: `${origin}/?room_pass_session={CHECKOUT_SESSION_ID}&pass_room=${room}`,
      cancel_url: `${origin}/`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe room-pass checkout error:', err.message);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
});

app.get('/api/verify-session', async (req, res) => {
  if (!stripeClient) return res.status(503).json({ unlocked: false, error: 'Payments are not set up on this server yet.' });
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).json({ unlocked: false, error: 'Missing session_id.' });
  try {
    const session = await stripeClient.checkout.sessions.retrieve(String(sessionId));
    res.json({ unlocked: session.payment_status === 'paid' });
  } catch (err) {
    console.error('Stripe verify error:', err.message);
    res.status(500).json({ unlocked: false, error: 'Could not verify payment.' });
  }
});

const server = http.createServer(app);
// maxPayload guards against an oversized image (or anything else) blowing up
// server memory — the client already resizes/compresses images well under
// this before sending, this is just the backstop.
const wss = new WebSocketServer({ server, maxPayload: 2 * 1024 * 1024 });

// ---------------------------------------------------------------------------
// World definition — single source of truth, sent to every client on join.
// Buildings double as chatrooms: being inside a building's rect = being in
// that room's chat channel. "outside" is the open-air town-square channel.
// ---------------------------------------------------------------------------
const WORLD = {
  width: 3200,
  height: 2200,
  spawn: { x: 1600, y: 1100 },
  // Widened from the original 64 — a narrow gap on a map this size made
  // walking back in after leaving feel needlessly fiddly (see also the
  // camera-orbit reset in client.js enterBuilding()/exitBuilding()).
  doorWidth: 100,
  wallThickness: 14,
  // "door" picks which wall the entrance/exit gap is cut into ('south' if
  // omitted). Every building's door faces whichever wall points back toward
  // the spawn hub at (1600, 1100), so walking out always faces the town square.
  buildings: [
    { id: 'cafe',    name: '☕ The Cafe',          x: 300,  y: 375,  w: 500, h: 340, color: '#d98a4f', door: 'east' },
    { id: 'library', name: '📚 The Library',       x: 2330, y: 375,  w: 400, h: 260, color: '#6f8fae', door: 'west' },
    { id: 'arcade',  name: '🎮 The Arcade',        x: 295,  y: 1530, w: 400, h: 270, color: '#9b5fc0', door: 'east' },
    { id: 'lounge',  name: '🛋️ Rooftop Lounge',   x: 2335, y: 1530, w: 400, h: 270, color: '#c0596f', door: 'west' },
    { id: 'hall',    name: '🏛️ Town Hall',        x: 1360, y: 110,  w: 480, h: 290, color: '#8a9a5b', door: 'south' }
  ]
};
const ROOM_IDS = new Set(['outside', ...WORLD.buildings.map(b => b.id)]);

const COLORS = ['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#38d9a9','#4dabf7','#748ffc','#da77f2','#f783ac','#63e6be'];

// ---------------------------------------------------------------------------
// Accounts — the only persistence in this whole project. Stored as one JSON
// file (accounts.json, gitignored — never commit it, it holds password
// hashes). No durable database, so on hosts with an ephemeral filesystem
// (e.g. Render's free tier wipes it on every redeploy) accounts won't
// survive a redeploy, only restarts of the same running instance. Sessions
// (login tokens) are purely in-memory and don't survive a restart at all —
// that's normal for a session token, just log in again.
//
// Passwords are never stored or logged in plaintext: each account gets a
// random salt, and the password is hashed with scrypt (deliberately slow,
// resistant to brute force) before being written to disk. Verifying a
// login uses a constant-time comparison to avoid leaking timing info.
// There's no rate-limiting or email recovery here — this is a lightweight
// account system for a casual game, not production-grade auth.
// ---------------------------------------------------------------------------
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');

function loadAccounts() {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}
function saveAccounts() {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

const accounts = loadAccounts(); // usernameLower -> { username, salt, hash, color, createdAt }
const sessions = new Map();      // token -> usernameLower

function hashPassword(password, saltHex) {
  return crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}
function verifyPassword(password, saltHex, hashHex) {
  const actual = Buffer.from(hashPassword(password, saltHex), 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
// A username always gets the same color, derived from the name itself, so
// "log in as the same user" also means showing up in the same color every
// time — unlike guests, who just cycle through COLORS round-robin.
function colorForUsername(usernameLower) {
  let h = 0;
  for (let i = 0; i < usernameLower.length; i++) h = (h * 31 + usernameLower.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,18}$/;

app.post('/api/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-18 letters, numbers, or underscores.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }
  const key = username.toLowerCase();
  if (accounts[key]) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  accounts[key] = {
    username,
    salt,
    hash: hashPassword(password, salt),
    color: colorForUsername(key),
    createdAt: Date.now()
  };
  saveAccounts();
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, key);
  res.json({ token, username, color: accounts[key].color });
});

app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const key = username.toLowerCase();
  const account = accounts[key];
  if (!account || !verifyPassword(password, account.salt, account.hash)) {
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, key);
  res.json({ token, username: account.username, color: account.color });
});

// ---------------------------------------------------------------------------
// Player state
// ---------------------------------------------------------------------------
/** @type {Map<string, {ws:any,id:string,name:string,color:string,x:number,y:number,room:string}>} */
const players = new Map();
let colorIdx = 0;

function makeId() {
  return crypto.randomBytes(6).toString('hex');
}

function sanitizeName(raw) {
  const cleaned = String(raw || '').replace(/[<>]/g, '').trim().slice(0, 18);
  return cleaned || ('Guest' + Math.floor(Math.random() * 9000 + 100));
}

function sanitizeText(raw) {
  return String(raw || '').replace(/[<>]/g, '').trim().slice(0, 240);
}

// The client already resizes/compresses images to well under this before
// sending (see client.js), this just rejects anything malformed or abusive
// — a data: URL of an allowed image type, capped at ~350KB of base64 text.
const MAX_IMAGE_DATA_URL_LENGTH = 350000;
function sanitizeImage(raw) {
  if (typeof raw !== 'string') return null;
  if (raw.length > MAX_IMAGE_DATA_URL_LENGTH) return null;
  if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(raw)) return null;
  return raw;
}

function publicPlayer(p) {
  return { id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, room: p.room };
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
}

function broadcastAll(data, exceptWs) {
  const msg = JSON.stringify(data);
  for (const p of players.values()) {
    if (p.ws !== exceptWs && p.ws.readyState === p.ws.OPEN) p.ws.send(msg);
  }
}

function broadcastRoom(room, data) {
  const msg = JSON.stringify(data);
  for (const p of players.values()) {
    if (p.room === room && p.ws.readyState === p.ws.OPEN) p.ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  let player = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'join') {
      if (player) return; // already joined
      if (TOWN_PASSWORD && msg.password !== TOWN_PASSWORD) {
        send(ws, { type: 'join_error', message: 'Wrong passcode.' });
        return;
      }
      const id = makeId();
      // Logged-in players always get their account's username + color,
      // regardless of whatever name was typed in the box. Guests (or a
      // stale/expired token — sessions don't survive a server restart)
      // fall back to the old behavior: whatever name they typed, with the
      // next color in the round-robin.
      const accountKey = msg.accountToken ? sessions.get(String(msg.accountToken)) : null;
      const account = accountKey ? accounts[accountKey] : null;
      const name = account ? account.username : sanitizeName(msg.name);
      const color = account ? account.color : COLORS[colorIdx++ % COLORS.length];
      player = {
        ws, id,
        name,
        color,
        x: WORLD.spawn.x,
        y: WORLD.spawn.y,
        room: 'outside'
      };
      players.set(id, player);

      send(ws, {
        type: 'init',
        id,
        world: WORLD,
        players: Array.from(players.values()).map(publicPlayer)
      });
      broadcastAll({ type: 'player_joined', player: publicPlayer(player) }, ws);
      return;
    }

    if (!player) return; // ignore everything else until joined

    if (msg.type === 'move') {
      const x = Number(msg.x), y = Number(msg.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        player.x = Math.max(0, Math.min(WORLD.width, x));
        player.y = Math.max(0, Math.min(WORLD.height, y));
      }
      if (typeof msg.room === 'string' && ROOM_IDS.has(msg.room)) {
        player.room = msg.room;
      }
      return;
    }

    if (msg.type === 'leave_room') {
      // A player just walked out of (or hit "Leave" in) a building. Wipe
      // everything they said in that room from every connected client's
      // chat log — chat in a building doesn't outlive your visit there.
      const room = String(msg.room || '');
      if (!ROOM_IDS.has(room) || room === 'outside') return;
      player.room = 'outside';
      broadcastAll({ type: 'clear_user_messages', room, id: player.id });
      return;
    }

    if (msg.type === 'send_note') {
      // Private, point-to-point note — never stored server-side, so there's
      // nothing left behind for anyone to read twice. Delivered only if the
      // recipient is currently connected; not queued for later (no accounts
      // means no durable identity to deliver to once they leave).
      const toId = String(msg.to || '');
      const text = sanitizeText(msg.text);
      const target = players.get(toId);
      if (!text || !target || toId === player.id) {
        send(ws, { type: 'note_error', message: 'Could not deliver that note.' });
        return;
      }
      const noteId = makeId();
      send(target.ws, { type: 'note_received', note: { id: noteId, fromId: player.id, fromName: player.name, text } });
      send(ws, { type: 'note_sent', toName: target.name });
      return;
    }

    if (msg.type === 'read_note') {
      // Recipient just read (and locally destroyed) a note. Let the original
      // sender know it's gone, if they're still around.
      const fromId = String(msg.fromId || '');
      const sender = players.get(fromId);
      if (sender) send(sender.ws, { type: 'note_destroyed', byName: player.name });
      return;
    }

    if (msg.type === 'chat') {
      const text = sanitizeText(msg.text);
      const image = sanitizeImage(msg.image);
      if (!text && !image) return;
      const chatMsg = {
        type: 'chat',
        message: {
          id: player.id,
          name: player.name,
          color: player.color,
          text,
          image,
          room: player.room,
          ts: Date.now()
        }
      };
      broadcastRoom(player.room, chatMsg);
      return;
    }
  });

  ws.on('close', () => {
    if (player) {
      // Disconnecting while inside a building counts as leaving it too.
      if (player.room !== 'outside') {
        broadcastAll({ type: 'clear_user_messages', room: player.room, id: player.id });
      }
      players.delete(player.id);
      broadcastAll({ type: 'player_left', id: player.id });
    }
  });
});

// Periodic full-state tick so everyone's position stays in sync even if a
// 'move' packet is dropped. Small player counts, so a full snapshot is fine.
setInterval(() => {
  if (players.size === 0) return;
  const snapshot = { type: 'state', players: Array.from(players.values()).map(publicPlayer) };
  broadcastAll(snapshot);
}, 70);

server.listen(PORT, () => {
  console.log(`Town Chat listening on http://localhost:${PORT}`);
  if (TOWN_PASSWORD) console.log('Passcode protection: ON');
  console.log(stripeClient
    ? `Stripe payments: ON (All-Access $${(PREMIUM_PRICE_CENTS / 100).toFixed(2)}, Arcade Pass $${(ROOM_PASS_PRICE_CENTS / 100).toFixed(2)}/${ROOM_PASS_HOURS}h)`
    : 'Stripe payments: OFF (set STRIPE_SECRET_KEY to enable)');
});
