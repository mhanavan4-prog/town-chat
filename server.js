// Town Chat — multiplayer world server
// Express serves the static client; "ws" handles realtime player movement + room-scoped chat.

const path = require('path');
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
  width: 2400,
  height: 1650,
  spawn: { x: 1200, y: 825 },
  doorWidth: 64,
  wallThickness: 14,
  // "door" picks which wall the entrance/exit gap is cut into ('south' if
  // omitted). Every building's door faces whichever wall points back toward
  // the spawn hub at (1200, 825), so walking out always faces the town square.
  buildings: [
    { id: 'cafe',    name: '☕ The Cafe',          x: 220,  y: 280,  w: 380, h: 260, color: '#d98a4f', door: 'east' },
    { id: 'library', name: '📚 The Library',       x: 1750, y: 280,  w: 300, h: 200, color: '#6f8fae', door: 'west' },
    { id: 'arcade',  name: '🎮 The Arcade',        x: 220,  y: 1150, w: 300, h: 200, color: '#9b5fc0', door: 'east' },
    { id: 'lounge',  name: '🛋️ Rooftop Lounge',   x: 1750, y: 1150, w: 300, h: 200, color: '#c0596f', door: 'west' },
    { id: 'hall',    name: '🏛️ Town Hall',        x: 1020, y: 80,   w: 360, h: 220, color: '#8a9a5b', door: 'south' }
  ]
};
const ROOM_IDS = new Set(['outside', ...WORLD.buildings.map(b => b.id)]);

const COLORS = ['#ff6b6b','#ffa94d','#ffd43b','#69db7c','#38d9a9','#4dabf7','#748ffc','#da77f2','#f783ac','#63e6be'];

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
      const color = COLORS[colorIdx++ % COLORS.length];
      player = {
        ws, id,
        name: sanitizeName(msg.name),
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
