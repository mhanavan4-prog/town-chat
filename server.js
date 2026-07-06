// Town Chat — multiplayer world server
// Express serves the static client; "ws" handles realtime player movement + room-scoped chat.

// Loads variables from a local .env file (if present) into process.env —
// lets you keep secrets like API keys in one untracked file instead of
// retyping them on the command line every time you start the server. See
// .env.example. Has no effect in production hosts that already inject
// environment variables directly (Render, Railway, etc.) — there's just no
// .env file there, so this is a silent no-op.
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
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
// Trust exactly one hop of reverse proxy (Render/Railway/Heroku/Fly all sit
// in front of the app like this) so req.ip below is the real visitor IP —
// without this, every request looks like it comes from the proxy, and the
// SMS rate limit below would silently become "3 texts total for the whole
// app" instead of "3 texts per visitor."
app.set('trust proxy', 1);
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

// ---------------------------------------------------------------------------
// Texting from the Arcade — each player brings their own Twilio account
// (Account SID + Auth Token/API Key, and a Twilio number they own), entered
// once in the Text tab and kept in that browser's localStorage. This server
// never sees those credentials except as part of relaying one send request
// to Twilio and is not in the business of storing them anywhere — there's
// no per-player Twilio config here at all, unlike accounts.json for game
// logins. That also means each player pays for and is responsible for
// their own texts, not the server operator.
//
// Still worth a strict format check and a per-IP rate limit, though: this
// endpoint is a generic credential-driven relay to Twilio, and without
// limits it could be used to mass-test/abuse stolen Twilio credentials
// while hiding the true caller's IP from Twilio (it would only ever see
// this server's IP). None of this is bot-proof; don't expose this publicly
// unless you trust whoever can reach it.
const SMS_MAX_BODY_LEN = 300;
const SMS_RATE_LIMIT = 3;
const SMS_RATE_WINDOW_MS = 10 * 60 * 1000;
const smsRateLog = new Map(); // ip -> [timestamps]
const E164_RE = /^\+[1-9]\d{6,14}$/;
const ACCOUNT_SID_RE = /^AC[a-zA-Z0-9]{32}$/;
const API_KEY_SID_RE = /^SK[a-zA-Z0-9]{32}$/;

function smsRateLimited(ip) {
  const now = Date.now();
  const hits = (smsRateLog.get(ip) || []).filter(t => now - t < SMS_RATE_WINDOW_MS);
  if (hits.length >= SMS_RATE_LIMIT) { smsRateLog.set(ip, hits); return true; }
  hits.push(now);
  smsRateLog.set(ip, hits);
  return false;
}

app.post('/api/send-sms', (req, res) => {
  const accountSid = String(req.body.accountSid || '').trim();
  const apiKeySid = String(req.body.apiKeySid || '').trim();
  const secret = String(req.body.secret || '').trim();
  const from = String(req.body.from || '').trim();
  const to = String(req.body.to || '').trim();
  const body = String(req.body.body || '').trim();

  if (!ACCOUNT_SID_RE.test(accountSid)) {
    return res.status(400).json({ error: 'Your Twilio Account SID looks wrong — it should start with "AC" (34 characters).' });
  }
  if (apiKeySid && !API_KEY_SID_RE.test(apiKeySid)) {
    return res.status(400).json({ error: 'Your Twilio API Key SID looks wrong — it should start with "SK" (34 characters).' });
  }
  if (!secret || secret.length < 8) {
    return res.status(400).json({ error: 'Enter your Twilio Auth Token or API Key Secret.' });
  }
  if (!E164_RE.test(from)) {
    return res.status(400).json({ error: 'Your Twilio number should be in international format, e.g. +15551234567.' });
  }
  if (!E164_RE.test(to)) {
    return res.status(400).json({ error: 'Enter a phone number in international format, e.g. +15551234567.' });
  }
  if (!body) return res.status(400).json({ error: 'Message is empty.' });
  if (body.length > SMS_MAX_BODY_LEN) {
    return res.status(400).json({ error: `Message is too long (max ${SMS_MAX_BODY_LEN} characters).` });
  }
  if (smsRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Too many texts sent recently — try again later.' });
  }

  // Basic Auth username is the API Key SID when the player supplied one
  // (recommended — independently revocable), otherwise the Account SID
  // paired with the main Auth Token. The URL always wants the real
  // Account SID either way.
  const authUser = apiKeySid || accountSid;
  const payload = new URLSearchParams({ To: to, From: from, Body: body }).toString();
  const auth = Buffer.from(`${authUser}:${secret}`).toString('base64');
  const apiReq = https.request({
    hostname: 'api.twilio.com',
    path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (twilioRes) => {
    let raw = '';
    twilioRes.on('data', (chunk) => { raw += chunk; });
    twilioRes.on('end', () => {
      if (twilioRes.statusCode >= 200 && twilioRes.statusCode < 300) {
        res.json({ ok: true });
      } else {
        let message = 'Twilio rejected the message.';
        try { message = JSON.parse(raw).message || message; } catch (e) {}
        res.status(502).json({ error: message });
      }
    });
  });
  apiReq.on('error', () => res.status(502).json({ error: 'Could not reach Twilio.' }));
  apiReq.write(payload);
  apiReq.end();
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
    { id: 'hall',    name: '🏛️ Town Hall',        x: 1360, y: 110,  w: 480, h: 290, color: '#8a9a5b', door: 'south' },
    // South of spawn, centered like Town Hall is to the north — spawn is
    // north of this one, so its door faces north (a code path that exists
    // but, until now, no other building actually used).
    { id: 'bank',    name: '🏦 The Bank',          x: 1380, y: 1810, w: 440, h: 280, color: '#c9a227', door: 'north' }
  ]
};
// Nature decor — trees/shrubs/rocks/flowers scattered around the outdoor
// map. Used to live purely client-side as static decoration; now lives
// here instead (with stable ids) so harvesting can be server-authoritative
// and every client agrees on which ones are currently picked clean. Only
// tree/shrub/flower types are harvestable — rocks are still just scenery.
// Positions/scales copied over unchanged from the old client.js constant.
// Tree scales are ~3x their original values — makeTree()'s whole geometry
// (trunk + foliage cones, and the collision radius derived from the same
// scale in addNatureDecor) grows uniformly with it, so at this scale a town
// tree stands several times taller than a player character instead of just
// slightly taller. Shrub/rock/flower scales are untouched.
WORLD.natureDecor = [
  { id: 'decor_0',  type: 'tree',   x: 80,   y: 935,  scale: 3.3 },  { id: 'decor_1',  type: 'tree',   x: 145,  y: 1175, scale: 2.7 },
  { id: 'decor_2',  type: 'tree',   x: 65,   y: 1360, scale: 3.0 },  { id: 'decor_3',  type: 'shrub',  x: 175,  y: 1015, scale: 1.0 },
  { id: 'decor_4',  type: 'shrub',  x: 120,  y: 1280, scale: 0.8 },  { id: 'decor_5',  type: 'tree',   x: 935,  y: 80,   scale: 3.0 },
  { id: 'decor_6',  type: 'tree',   x: 1160, y: 55,   scale: 2.55 }, { id: 'decor_7',  type: 'shrub',  x: 1040, y: 120,  scale: 1.0 },
  { id: 'decor_8',  type: 'tree',   x: 3065, y: 935,  scale: 3.0 },  { id: 'decor_9',  type: 'tree',   x: 3135, y: 1175, scale: 2.7 },
  { id: 'decor_10', type: 'tree',   x: 3080, y: 1360, scale: 3.15 }, { id: 'decor_11', type: 'shrub',  x: 2985, y: 1025, scale: 0.9 },
  { id: 'decor_12', type: 'shrub',  x: 3040, y: 1265, scale: 1.0 },  { id: 'decor_13', type: 'tree',   x: 935,  y: 2135, scale: 3.0 },
  { id: 'decor_14', type: 'tree',   x: 1200, y: 2160, scale: 2.85 }, { id: 'decor_15', type: 'tree',   x: 2000, y: 2145, scale: 3.0 },
  { id: 'decor_16', type: 'tree',   x: 2265, y: 2120, scale: 2.7 },  { id: 'decor_17', type: 'shrub',  x: 1065, y: 2095, scale: 1.0 },
  { id: 'decor_18', type: 'shrub',  x: 2135, y: 2080, scale: 0.85 }, { id: 'decor_19', type: 'tree',   x: 1975, y: 80,   scale: 2.7 },
  { id: 'decor_20', type: 'tree',   x: 2160, y: 105,  scale: 3.0 },  { id: 'decor_21', type: 'shrub',  x: 2065, y: 55,   scale: 0.9 },
  { id: 'decor_22', type: 'tree',   x: 105,  y: 335,  scale: 2.85 }, { id: 'decor_23', type: 'tree',   x: 3105, y: 335,  scale: 2.85 },
  { id: 'decor_24', type: 'shrub',  x: 80,   y: 1865, scale: 1.0 },  { id: 'decor_25', type: 'shrub',  x: 3120, y: 1865, scale: 1.0 },
  { id: 'decor_26', type: 'rock',   x: 500,  y: 1100, scale: 1.0 },  { id: 'decor_27', type: 'rock',   x: 1100, y: 1700, scale: 0.9 },
  { id: 'decor_28', type: 'rock',   x: 2100, y: 1700, scale: 1.1 },  { id: 'decor_29', type: 'rock',   x: 2700, y: 1100, scale: 0.9 },
  { id: 'decor_30', type: 'rock',   x: 1600, y: 1700, scale: 1.0 },  { id: 'decor_31', type: 'rock',   x: 1050, y: 650,  scale: 0.85 },
  { id: 'decor_32', type: 'flower', x: 950,  y: 1200, scale: 1.0 },  { id: 'decor_33', type: 'flower', x: 1700, y: 750,  scale: 1.0 },
  { id: 'decor_34', type: 'flower', x: 2450, y: 1300, scale: 1.0 },  { id: 'decor_35', type: 'flower', x: 1300, y: 900,  scale: 0.9 },
  { id: 'decor_36', type: 'flower', x: 2000, y: 1500, scale: 1.0 },  { id: 'decor_37', type: 'flower', x: 600,  y: 1400, scale: 0.95 }
];
// ---------------------------------------------------------------------------
// The Wilds — a second, smaller (1000x1000) outdoor map reached through a
// portal in the town square. No buildings; it exists purely as a wildlife/
// harvesting area with its own friendly animals, 4 dangerous mob types that
// come out at night, and 16 unique harvestable plants. Shares the same
// day/night clock as town (isNightNow() below). Player room 'wilds' is a
// peer of 'outside', not nested under it — see ROOM_IDS.
// ---------------------------------------------------------------------------
const WORLD2 = {
  id: 'wilds',
  width: 10000,
  height: 10000,
  // Both ends of the portal: where you land stepping into the Wilds, and
  // the spot in town the portal occupies (used for the kiosk's position and
  // for nudging a returning player just outside it, same idea as
  // getDoorWorldPos for buildings).
  spawn: { x: 5000, y: 8800 },
  portalInTown: { x: 1600, y: 700 },
  buildings: []
};

// 16 harvestable plants, each a one-shot consumable with a distinct effect
// applied when used from the inventory (see 'use_item' below) rather than
// on harvest itself. 13 reuse existing status-effect types the curse/spell
// system already renders client-side; heal/regen/cleanse are new, simple
// effects that don't need a new visual.
const PLANT_CATALOG = {
  swift_root:           { name: 'Swift Root',           icon: '🥕', effect: 'status',  statusType: 'speedboost', durationMs: 12000 },
  featherleaf:           { name: 'Featherleaf',           icon: '🍃', effect: 'status',  statusType: 'feather',    durationMs: 20000 },
  giants_cap:             { name: "Giant's Cap",            icon: '🍄', effect: 'status',  statusType: 'giant',      durationMs: 15000 },
  shrinking_violet:       { name: 'Shrinking Violet',       icon: '🌷', effect: 'status',  statusType: 'shrink',     durationMs: 20000 },
  pumpkin_blossom:        { name: 'Pumpkin Blossom',        icon: '🎃', effect: 'status',  statusType: 'pumpkin',    durationMs: 30000 },
  bats_breath:            { name: "Bat's Breath Flower",    icon: '🦇', effect: 'status',  statusType: 'bats',       durationMs: 15000 },
  rainbow_petal:          { name: 'Rainbow Petal',          icon: '🌈', effect: 'status',  statusType: 'colorcycle', durationMs: 20000 },
  ravens_feather_plant:   { name: "Raven's Feather Plant",  icon: '🪶', effect: 'status',  statusType: 'ravencloak', durationMs: 30000 },
  stumbleweed:            { name: 'Stumbleweed',            icon: '🌾', effect: 'status',  statusType: 'stumble',    durationMs: 15000 },
  gibberish_root:         { name: 'Gibberish Root',         icon: '🫚', effect: 'status',  statusType: 'gibberish',  durationMs: 20000 },
  toadstool:              { name: 'Toadstool',              icon: '🐸', effect: 'status',  statusType: 'toad',       durationMs: 20000 },
  wolfsbane_bloom:        { name: 'Wolfsbane Bloom',        icon: '🌺', effect: 'status',  statusType: 'wolfmark',   durationMs: 30000 },
  meditation_lotus:       { name: 'Meditation Lotus',       icon: '🪷', effect: 'status',  statusType: 'meditate',   durationMs: 60000 },
  healing_herb:           { name: 'Healing Herb',           icon: '🌿', effect: 'heal',    amount: 40 },
  regen_root:             { name: 'Regen Root',             icon: '🫘', effect: 'status',  statusType: 'regen',      durationMs: 15000 },
  cleansing_clover:       { name: 'Cleansing Clover',       icon: '🍀', effect: 'cleanse' },
  // --- Witch-brewed potions (same use_item flow, enhanced durations) ---
  health_potion_ii:       { name: 'Greater Healing Potion', icon: '❤️‍🔥', effect: 'heal',   amount: 80 },
  regen_brew:             { name: 'Regen Brew',             icon: '🫧',  effect: 'status', statusType: 'regen',      durationMs: 45000 },
  swift_brew:             { name: 'Swift Brew',             icon: '💨',  effect: 'status', statusType: 'speedboost', durationMs: 45000 },
  shadow_draught:         { name: 'Shadow Draught',         icon: '🌘',  effect: 'status', statusType: 'ravencloak', durationMs: 60000 },
  giants_elixir:          { name: "Giant's Elixir",         icon: '🍄‍🟫', effect: 'status', statusType: 'giant',      durationMs: 45000 },
  bat_swarm_potion:       { name: 'Bat Swarm Potion',       icon: '🦇',  effect: 'status', statusType: 'bats',       durationMs: 45000 },
  clarity_draught:        { name: 'Clarity Draught',        icon: '✨',  effect: 'cleanse' },
  chaos_brew:             { name: 'Chaos Brew',             icon: '🌈',  effect: 'status', statusType: 'colorcycle', durationMs: 60000 },
  wolf_pact_brew:         { name: "Wolf's Pact Brew",       icon: '🐺',  effect: 'status', statusType: 'wolfpact',   durationMs: 3600000 },
};
// Two of each plant, scattered across the 1000x1000 map, clear of the
// portal landing spot at (500, 880).
const PLANT_KEYS = Object.keys(PLANT_CATALOG);
// Laid out on the original 1000x1000 footprint for readability, then
// scaled up to match WORLD2's actual (10x larger) size below.
const WILDS_SCALE = WORLD2.width / 1000;

// Deterministic pseudo-random scatter — laid out on the same readable
// 1000x1000 design footprint as before (then scaled up by WILDS_SCALE),
// using a fixed-seed PRNG so the layout is stable across server restarts
// instead of reshuffling on every deploy. Cells of a coarse grid are
// shuffled and handed out one at a time so instances spread across the
// whole map rather than clumping, with a keep-out radius around the
// landing spawn point so you're never dropped right on top of one.
function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function makeWildsScatter(seed, gridSize, count) {
  const rand = seededRandom(seed);
  const cells = [];
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) cells.push([gx, gy]);
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const cellSize = 1000 / gridSize;
  const spawnKeepOut = 130;
  const out = [];
  for (const [gx, gy] of cells) {
    if (out.length >= count) break;
    const x = (gx + 0.2 + rand() * 0.6) * cellSize;
    const y = (gy + 0.2 + rand() * 0.6) * cellSize;
    if (Math.hypot(x - 500, y - 880) < spawnKeepOut) continue;
    out.push([x * WILDS_SCALE, y * WILDS_SCALE]);
  }
  return out;
}

// 5 of each of the 16 plants (80 total) and 24 friendly animals — mob
// count is intentionally left at the original 8 (2 of each of the 4
// dangerous types), see MOB2_SPAWNS below.
const PLANTS_PER_TYPE = 5;
const PLANT_POSITIONS = makeWildsScatter(0x9a17, 14, PLANT_KEYS.length * PLANTS_PER_TYPE);
WORLD2.natureDecor = PLANT_KEYS.flatMap((type, i) => {
  const out = [];
  for (let n = 0; n < PLANTS_PER_TYPE; n++) {
    const [x, y] = PLANT_POSITIONS[i * PLANTS_PER_TYPE + n];
    out.push({ id: `wdecor_${i}_${n}`, type, x, y, scale: 1 });
  }
  return out;
});

const HARVEST_TYPES = new Set(['tree', 'shrub', 'flower', ...PLANT_KEYS]);
const HARVEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const HARVEST_ITEM_BY_TYPE = { tree: 'wood', shrub: 'berries', flower: 'flower_bloom' };
for (const key of PLANT_KEYS) HARVEST_ITEM_BY_TYPE[key] = key; // a plant's decor type IS its item id
const HARVEST_RANGE = 70;
const decorHarvestedAt = {}; // id -> timestamp of last harvest, absent/expired = available

// Finds a decor entry by id across both maps and reports which room it
// belongs to, so the harvest handler can confirm the player is actually
// standing in the right place (coordinates alone aren't enough to tell —
// the two maps' coordinate spaces overlap).
function findDecorById(id) {
  let d = WORLD.natureDecor.find(x => x.id === id);
  if (d) return { decor: d, room: 'outside' };
  d = WORLD2.natureDecor.find(x => x.id === id);
  if (d) return { decor: d, room: 'wilds' };
  return null;
}

function decorPublicState() {
  const now = Date.now();
  return [...WORLD.natureDecor, ...WORLD2.natureDecor]
    .filter(d => HARVEST_TYPES.has(d.type))
    .map(d => ({ id: d.id, available: !decorHarvestedAt[d.id] || now - decorHarvestedAt[d.id] >= HARVEST_COOLDOWN_MS }));
}

const ROOM_IDS = new Set(['outside', 'wilds', ...WORLD.buildings.map(b => b.id)]);
['dungeon_t1', 'dungeon_t2', 'dungeon_t3', 'dungeon_t4', 'witch_cave', 'bank_vault'].forEach(r => ROOM_IDS.add(r));

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
// Bank accounts & auction house — the in-game economy. Bank accounts are
// keyed by the same usernameLower as the login accounts above (see
// accountKey on each connected player), because a bank balance needs a
// durable identity to mean anything — guests are ephemeral by design (a
// fresh identity every session, nothing persisted), so they can look
// around the Bank but can't open an account there. That's a real
// constraint of this project's no-database, flat-JSON-files design, not
// an arbitrary restriction.
//
// Persisted the same way accounts.json is: one JSON file, gitignored,
// rewritten in full on every mutation. Same hosting caveat applies —
// an ephemeral filesystem (Render free tier, etc.) won't carry balances
// across a redeploy, only across restarts of the same running instance.
// ---------------------------------------------------------------------------
// "slot" marks what an item can be equipped as ('weapon'/'head'/'chest'/'feet'/'ring'), or null
// for things that are only ever carried/banked/traded (potions, materials,
// curios) — both inventory_equip and the client's slot-action UI key off
// this to decide what a given item can actually do.
const ITEM_CATALOG = {
  iron_sword:     { name: 'Iron Sword',     icon: '⚔️', slot: 'weapon' },
  spell_tome:     { name: 'Spell Tome',     icon: '📕', slot: 'weapon' },
  steel_shield:   { name: 'Steel Shield',   icon: '🛡️', slot: 'chest' },
  wizard_hat:     { name: 'Wizard Hat',     icon: '🎩', slot: 'head'  },
  leather_boots:  { name: 'Leather Boots',  icon: '👢', slot: 'feet'  },
  silver_ring:    { name: 'Silver Ring',    icon: '💍', slot: 'ring'  },
  healing_potion: { name: 'Healing Potion', icon: '🧪', slot: null },
  magic_scroll:   { name: 'Magic Scroll',   icon: '📜', slot: null },
  dragon_scale:   { name: 'Dragon Scale',   icon: '🐉', slot: null },
  enchanted_gem:  { name: 'Enchanted Gem',  icon: '💎', slot: null },
  ancient_coin:   { name: 'Ancient Coin',   icon: '🪙', slot: null },
  golden_chalice: { name: 'Golden Chalice', icon: '🏆', slot: null },
  hard_drive:     { name: 'Hard Drive',     icon: '💽', slot: null },
  wood:           { name: 'Wood',           icon: '🪵', slot: null },
  berries:        { name: 'Berries',        icon: '🍓', slot: null },
  flower_bloom:   { name: 'Flower',         icon: '🌸', slot: null },
  // ---- Witch starter set ----
  witch_robe:     { name: "Witch's Robe",   icon: '🌑', slot: 'chest' },
  hexed_boots:    { name: 'Hexed Boots',    icon: '🌙', slot: 'feet'  },
  hex_amulet:     { name: 'Hex Amulet',     icon: '🔮', slot: 'ring'  },
  // ---- Werewolf starter set ----
  beast_crown:    { name: 'Beast Crown',    icon: '👑', slot: 'head'  },
  beast_hide:     { name: 'Beast Hide',     icon: '🐺', slot: 'chest' },
  paw_boots:      { name: 'Paw Boots',      icon: '🐾', slot: 'feet'  },
  // ---- Mystic starter set ----
  spirit_veil:    { name: 'Spirit Veil',    icon: '✨', slot: 'head'  },
  spirit_robe:    { name: 'Spirit Robe',    icon: '🌌', slot: 'chest' },
  spirit_ring:    { name: 'Spirit Ring',    icon: '💜', slot: 'ring'  },
  // ---- Knight starter set ----
  knights_helm:   { name: "Knight's Helm",  icon: '⛑️', slot: 'head' },
  order_signet:   { name: "Order's Signet", icon: '🔰', slot: 'ring'  },
  // ---- Wanderer starter set ----
  travelers_hood: { name: "Traveler's Hood",icon: '🧢', slot: 'head'  },
  travelers_vest: { name: "Traveler's Vest",icon: '🧥', slot: 'chest' },
  trail_ring:     { name: 'Trail Ring',     icon: '🪬', slot: 'ring'  },
  // ---- Witch cave exclusive (selfie-gated) ----
  cursed_blade:   { name: 'Cursed Blade',   icon: '🗡️',  slot: 'weapon' },
  shadow_staff:   { name: 'Shadow Staff',   icon: '🪄',  slot: 'weapon' },
  bone_armor:     { name: 'Bone Armor',     icon: '🦴',  slot: 'chest'  },
  shadow_cloak:   { name: 'Shadow Cloak',   icon: '🌑',  slot: 'chest'  },
  witches_boon:   { name: "Witch's Boon",   icon: '🔮',  slot: 'ring'   },
  dread_helm:     { name: 'Dread Helm',     icon: '💀',  slot: 'head'   },
  soul_treads:    { name: 'Soul Treads',    icon: '👁️',  slot: 'feet'   },
  void_staff:     { name: 'Void Staff',     icon: '☄️',  slot: 'weapon' },
  shadow_crown:   { name: 'Shadow Crown',   icon: '🌙',  slot: 'head'   },
  abyssal_armor:  { name: 'Abyssal Armor',  icon: '⚫',  slot: 'chest'  },
  death_ring:     { name: 'Death Ring',     icon: '💍',  slot: 'ring'   },
  wraith_treads:  { name: 'Wraith Treads',  icon: '🌫️',  slot: 'feet'   },
  // ---- Loot materials (mob drops) ----
  fur_scrap:      { name: 'Fur Scrap',       icon: '🧶', slot: null },
  animal_pelt:    { name: 'Animal Pelt',     icon: '🐻', slot: null },
  bone_shard:     { name: 'Bone Shard',      icon: '🦴', slot: null },
  leather_hide:   { name: 'Leather Hide',    icon: '🟤', slot: null },
  iron_ore:       { name: 'Iron Ore',        icon: '⛏️', slot: null },
  enchanted_fur:  { name: 'Enchanted Fur',   icon: '🌟', slot: null },
  shadow_essence: { name: 'Shadow Essence',  icon: '🫥', slot: null },
  // ---- Wildlands quest rewards ----
  lumber_bundle:  { name: 'Lumber Bundle',   icon: '🪵', slot: null },
  stone_block:    { name: 'Stone Block',     icon: '🪨', slot: null },
  iron_ingot:     { name: 'Iron Ingot',      icon: '⚙️', slot: null },
  druid_stone:    { name: 'Druid Stone',     icon: '🔮', slot: null },
  hollow_shard:   { name: 'Hollow Shard',    icon: '💠', slot: null },
  // ---- Lexton's Howl Trade exclusive (voice-gated, see werewolf_buy_item) ----
  moonhowl_pelt:    { name: 'Moonhowl Pelt',    icon: '🌕', slot: 'chest'  },
  alpha_fang:       { name: 'Alpha Fang',       icon: '🦷', slot: 'weapon' },
  packbound_ring:   { name: 'Packbound Ring',   icon: '🐾', slot: 'ring'   },
  nightfang_boots:  { name: 'Nightfang Boots',  icon: '🐺', slot: 'feet'   },
};
const ITEM_IDS = Object.keys(ITEM_CATALOG);
// Plants are added *after* ITEM_IDS is captured — unlike Wood/Berries/
// Flower, they're deliberately excluded from the random-starter-item pool,
// since the whole point is going out to the Wilds to harvest them.
for (const key in PLANT_CATALOG) {
  ITEM_CATALOG[key] = { name: PLANT_CATALOG[key].name, icon: PLANT_CATALOG[key].icon, slot: null };
}
// ---------------------------------------------------------------------------
// Potion crafting recipes (witch cave)
// ---------------------------------------------------------------------------
const POTION_RECIPES = [
  { id: 'health_potion_ii', result: 'health_potion_ii',
    ingredients: [{ id: 'healing_herb', qty: 2 }],
    desc: '2× Healing Herb → Greater Healing Potion (restores 80 HP)' },
  { id: 'regen_brew', result: 'regen_brew',
    ingredients: [{ id: 'regen_root', qty: 1 }, { id: 'healing_herb', qty: 1 }],
    desc: 'Regen Root + Healing Herb → Regen Brew (regenerates HP over 45s)' },
  { id: 'swift_brew', result: 'swift_brew',
    ingredients: [{ id: 'swift_root', qty: 2 }],
    desc: '2× Swift Root → Swift Brew (speed boost for 45s)' },
  { id: 'shadow_draught', result: 'shadow_draught',
    ingredients: [{ id: 'wolfsbane_bloom', qty: 1 }, { id: 'ravens_feather_plant', qty: 1 }],
    desc: 'Wolfsbane Bloom + Raven\'s Feather → Shadow Draught (raven cloak 60s)' },
  { id: 'giants_elixir', result: 'giants_elixir',
    ingredients: [{ id: 'giants_cap', qty: 2 }],
    desc: "2× Giant's Cap → Giant's Elixir (giant form 45s)" },
  { id: 'bat_swarm_potion', result: 'bat_swarm_potion',
    ingredients: [{ id: 'bats_breath', qty: 2 }],
    desc: "2× Bat's Breath → Bat Swarm Potion (summon bats 45s)" },
  { id: 'clarity_draught', result: 'clarity_draught',
    ingredients: [{ id: 'meditation_lotus', qty: 1 }, { id: 'cleansing_clover', qty: 1 }],
    desc: 'Meditation Lotus + Cleansing Clover → Clarity Draught (cleanse all effects)' },
  { id: 'chaos_brew', result: 'chaos_brew',
    ingredients: [{ id: 'rainbow_petal', qty: 1 }, { id: 'pumpkin_blossom', qty: 1 }, { id: 'toadstool', qty: 1 }],
    desc: 'Rainbow Petal + Pumpkin Blossom + Toadstool → Chaos Brew (wild colour effects 60s)' },
];

// ---------------------------------------------------------------------------
// Mob loot tables
// ---------------------------------------------------------------------------
const LOOT_TABLES = {
  town_mob: [
    { itemId: 'fur_scrap',   qty: 1, chance: 0.40 },
    { itemId: 'bone_shard',  qty: 1, chance: 0.20 },
    { gold: true, min: 1, max: 3, chance: 0.45 },
  ],
  // Wilds mobs keyed by mobType
  shade_stalker: [
    { itemId: 'fur_scrap',      qty: 1, chance: 0.55 },
    { itemId: 'shadow_essence', qty: 1, chance: 0.15 },
    { gold: true, min: 2, max: 8, chance: 0.60 },
  ],
  bog_brute: [
    { itemId: 'animal_pelt',  qty: 1, chance: 0.65 },
    { itemId: 'leather_hide', qty: 1, chance: 0.30 },
    { gold: true, min: 4, max: 14, chance: 0.55 },
    { itemId: 'iron_sword',   qty: 1, chance: 0.04 },
  ],
  night_howler: [
    { itemId: 'fur_scrap',     qty: 1, chance: 0.60 },
    { itemId: 'enchanted_fur', qty: 1, chance: 0.12 },
    { gold: true, min: 3, max: 10, chance: 0.55 },
  ],
  will_o_wisp: [
    { itemId: 'shadow_essence', qty: 1, chance: 0.70 },
    { gold: true, min: 2, max: 6,  chance: 0.50 },
    { itemId: 'silver_ring',    qty: 1, chance: 0.06 },
  ],
  // Dungeon keyed by xp tier
  dungeon_t1: [ // xp=8
    { itemId: 'bone_shard',  qty: 1, chance: 0.55 },
    { itemId: 'fur_scrap',   qty: 1, chance: 0.30 },
    { gold: true, min: 1, max: 4,  chance: 0.50 },
  ],
  dungeon_t2: [ // xp=18
    { itemId: 'leather_hide', qty: 1, chance: 0.45 },
    { itemId: 'bone_shard',   qty: 1, chance: 0.35 },
    { gold: true, min: 3, max: 10,  chance: 0.60 },
    { itemId: 'iron_sword',   qty: 1, chance: 0.05 },
    { itemId: 'steel_shield', qty: 1, chance: 0.04 },
  ],
  dungeon_t3: [ // xp=35
    { itemId: 'iron_ore',      qty: 1, chance: 0.50 },
    { itemId: 'enchanted_fur', qty: 1, chance: 0.25 },
    { gold: true, min: 8, max: 22,  chance: 0.65 },
    { itemId: 'cursed_blade',  qty: 1, chance: 0.05 },
    { itemId: 'bone_armor',    qty: 1, chance: 0.04 },
    { itemId: 'dread_helm',    qty: 1, chance: 0.04 },
  ],
  dungeon_t4: [ // xp=65
    { itemId: 'shadow_essence', qty: 1, chance: 0.60 },
    { itemId: 'dragon_scale',   qty: 1, chance: 0.20 },
    { gold: true, min: 18, max: 50, chance: 0.70 },
    { itemId: 'void_staff',     qty: 1, chance: 0.06 },
    { itemId: 'abyssal_armor',  qty: 1, chance: 0.05 },
    { itemId: 'shadow_crown',   qty: 1, chance: 0.04 },
    { itemId: 'wraith_treads',  qty: 1, chance: 0.04 },
  ],
};

function dungeonLootTable(xp) {
  if (xp <= 8)  return LOOT_TABLES.dungeon_t1;
  if (xp <= 18) return LOOT_TABLES.dungeon_t2;
  if (xp <= 35) return LOOT_TABLES.dungeon_t3;
  return LOOT_TABLES.dungeon_t4;
}

// Rolls loot drops, adds items to inventory and gold to bank, returns label strings.
function rollLoot(table, player) {
  const inv = getInventory(player);
  const earned = [];
  for (const drop of table) {
    if (Math.random() > drop.chance) continue;
    if (drop.gold) {
      const amount = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
      if (player.accountKey) {
        const acct = ensureBankAccount(player.accountKey);
        acct.balance += amount;
        saveBankAccounts();
      }
      earned.push(`🪙 ${amount}g`);
    } else {
      if (addItemToAccount(inv, drop.itemId, drop.qty || 1)) {
        if (player.accountKey) saveInventories();
        const meta = ITEM_CATALOG[drop.itemId];
        earned.push(`${meta?.icon || '?'} ${meta?.name || drop.itemId}`);
      }
    }
  }
  return earned;
}

const BANK_SLOT_COUNT = 24;
const BANK_STARTING_BALANCE = 100;
const BANK_STARTER_ITEM_COUNT = 3;

const BANK_FILE = path.join(__dirname, 'bankAccounts.json');
function loadBankAccounts() {
  try { return JSON.parse(fs.readFileSync(BANK_FILE, 'utf8')); } catch (e) { return {}; }
}
function saveBankAccounts() {
  fs.writeFileSync(BANK_FILE, JSON.stringify(bankAccounts, null, 2));
}
const bankAccounts = loadBankAccounts(); // usernameLower -> { balance, slots: [ {itemId,qty}|null x24 ] }

function emptySlots() {
  return new Array(BANK_SLOT_COUNT).fill(null);
}

function ensureBankAccount(key) {
  if (bankAccounts[key]) return bankAccounts[key];
  const slots = emptySlots();
  for (let i = 0; i < BANK_STARTER_ITEM_COUNT; i++) {
    slots[i] = { itemId: ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)], qty: 1 };
  }
  bankAccounts[key] = { balance: BANK_STARTING_BALANCE, slots };
  saveBankAccounts();
  return bankAccounts[key];
}

// Adds qty of itemId to the account, stacking onto an existing slot of the
// same item first. Returns false (without partially applying) if there's
// no room for it at all.
function addItemToAccount(account, itemId, qty) {
  const existing = account.slots.find(s => s && s.itemId === itemId);
  if (existing) { existing.qty += qty; return true; }
  const emptyIdx = account.slots.findIndex(s => !s);
  if (emptyIdx === -1) return false;
  account.slots[emptyIdx] = { itemId, qty };
  return true;
}

function countItemQty(account, itemId) {
  return account.slots.reduce((sum, s) => sum + (s && s.itemId === itemId ? s.qty : 0), 0);
}

// Removes qty of itemId, taking from however many stacked slots it takes.
// Returns false (without partially applying) if the account doesn't hold
// enough.
function removeItemFromAccount(account, itemId, qty) {
  if (countItemQty(account, itemId) < qty) return false;
  let remaining = qty;
  for (let i = 0; i < account.slots.length && remaining > 0; i++) {
    const s = account.slots[i];
    if (!s || s.itemId !== itemId) continue;
    const take = Math.min(s.qty, remaining);
    s.qty -= take;
    remaining -= take;
    if (s.qty <= 0) account.slots[i] = null;
  }
  return true;
}

function bankStatePayload(key) {
  const account = ensureBankAccount(key);
  return { balance: account.balance, slots: account.slots };
}

// ---------------------------------------------------------------------------
// Personal inventory — what a player actually carries, as opposed to what
// sits in their bank. Separate 24-slot pool, plus two equip slots
// (weapon/armor). Unlike the bank, this isn't account-gated: equipping
// gear is core gameplay, not the economy feature, so guests get one too —
// it just lives only on their in-memory player object (player.guestInventory)
// and is gone the moment they disconnect, the same as everything else about
// a guest identity. Logged-in players get theirs persisted to
// inventories.json, same model/caveats as bankAccounts.json.
// ---------------------------------------------------------------------------
const INVENTORY_FILE = path.join(__dirname, 'inventories.json');
function loadInventories() {
  try { return JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8')); } catch (e) { return {}; }
}
function saveInventories() {
  fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inventories, null, 2));
}
const inventories = loadInventories(); // usernameLower -> { slots, equippedWeapon, equippedHead, equippedChest, equippedFeet, equippedRing }
const INVENTORY_STARTER_ITEM_COUNT = 2;
// All possible equip slot keys — used throughout to avoid scattered literals.
const EQUIP_SLOTS = ['weapon', 'head', 'chest', 'feet', 'ring'];

// Each character class starts with a full themed loadout — every equip slot
// filled, nothing left to chance. These items are pre-equipped (not sitting
// in slots): the inventory starts empty so they immediately appear on the
// character's model, and the player can unequip them into slots if they want
// to swap something out later.
const STARTER_GEAR = {
  0: { weapon: 'spell_tome',  head: 'wizard_hat',    chest: 'witch_robe',    feet: 'hexed_boots',    ring: 'hex_amulet'   },
  1: { weapon: 'iron_sword',  head: 'beast_crown',   chest: 'beast_hide',    feet: 'paw_boots',      ring: 'silver_ring'  },
  2: { weapon: 'spell_tome',  head: 'spirit_veil',   chest: 'spirit_robe',   feet: 'leather_boots',  ring: 'spirit_ring'  },
  3: { weapon: 'iron_sword',  head: 'knights_helm',  chest: 'steel_shield',  feet: 'leather_boots',  ring: 'order_signet' },
  4: { weapon: 'iron_sword',  head: 'travelers_hood',chest: 'travelers_vest',feet: 'leather_boots',  ring: 'trail_ring'   }
};

function starterInventory(charId) {
  const gear = STARTER_GEAR[charId] || STARTER_GEAR[0];
  return {
    slots: emptySlots(),
    equippedWeapon: gear.weapon || null,
    equippedHead:   gear.head   || null,
    equippedChest:  gear.chest  || null,
    equippedFeet:   gear.feet   || null,
    equippedRing:   gear.ring   || null
  };
}

function freshInventory() {
  const slots = emptySlots();
  for (let i = 0; i < INVENTORY_STARTER_ITEM_COUNT; i++) {
    slots[i] = { itemId: ITEM_IDS[Math.floor(Math.random() * ITEM_IDS.length)], qty: 1 };
  }
  return { slots, equippedWeapon: null, equippedHead: null, equippedChest: null, equippedFeet: null, equippedRing: null };
}

// The live inventory object for this connection — loaded/created in
// inventories.json for a logged-in account, or created once on the
// in-memory player object for a guest. Either way, callers just get back
// an object with .slots and equippedXxx fields to read or mutate;
// addItemToAccount/removeItemFromAccount/countItemQty work unchanged
// since they only ever touch .slots.
function getInventory(player) {
  if (player.accountKey) {
    if (!inventories[player.accountKey]) {
      inventories[player.accountKey] = starterInventory(player.charId);
      saveInventories();
    }
    return inventories[player.accountKey];
  }
  if (!player.guestInventory) player.guestInventory = starterInventory(player.charId);
  return player.guestInventory;
}

function invEquipField(slotKind) {
  if (slotKind === 'weapon') return 'equippedWeapon';
  if (slotKind === 'head')   return 'equippedHead';
  if (slotKind === 'chest')  return 'equippedChest';
  if (slotKind === 'feet')   return 'equippedFeet';
  if (slotKind === 'ring')   return 'equippedRing';
  return null;
}

function inventoryStatePayload(player) {
  const inv = getInventory(player);
  return {
    slots: inv.slots,
    equippedWeapon: inv.equippedWeapon || null,
    equippedHead:   inv.equippedHead   || null,
    equippedChest:  inv.equippedChest  || null,
    equippedFeet:   inv.equippedFeet   || null,
    equippedRing:   inv.equippedRing   || null
  };
}

// ---------------------------------------------------------------------------
// Hard Drive — a password-lockable note vault (up to HARDDRIVE_NOTE_CAPACITY
// notes). The physical "Hard Drive" item in a player's inventory is just a
// key that unlocks access to *their own* vault below; it's not itself the
// container, so stealing the physical item (when unlocked, see Sleight of
// Hand below) only denies the victim access to their own vault — it can
// never hand the thief someone else's stored notes, since every handler
// here always operates on getHardDrive(player) for whichever connection
// sent the request. When a password is set, every operation (view, store,
// retrieve, destroy, even clearing the password itself) requires it, so the
// vault is fully inert to outside tampering — including Rapid Swipe and
// Sleight of Hand, which only ever read player.inbox / inventory slots and
// never reach into hardDrives at all.
// ---------------------------------------------------------------------------
const HARDDRIVE_FILE = path.join(__dirname, 'hardDrives.json');
function loadHardDrives() {
  try { return JSON.parse(fs.readFileSync(HARDDRIVE_FILE, 'utf8')); } catch (e) { return {}; }
}
function saveHardDrives() {
  fs.writeFileSync(HARDDRIVE_FILE, JSON.stringify(hardDrives, null, 2));
}
const hardDrives = loadHardDrives(); // usernameLower -> { passwordSalt, passwordHash, notes: [] }
const HARDDRIVE_NOTE_CAPACITY = 24;

function getHardDrive(player) {
  if (player.accountKey) {
    if (!hardDrives[player.accountKey]) {
      hardDrives[player.accountKey] = { passwordSalt: null, passwordHash: null, notes: [] };
      saveHardDrives();
    }
    return hardDrives[player.accountKey];
  }
  if (!player.guestHardDrive) player.guestHardDrive = { passwordSalt: null, passwordHash: null, notes: [] };
  return player.guestHardDrive;
}

function persistHardDrive(player) {
  if (player.accountKey) saveHardDrives();
}

function ownsHardDriveItem(player) {
  const inv = getInventory(player);
  return inv.slots.some(s => s && s.itemId === 'hard_drive');
}

// ---------------------------------------------------------------------------
// XP / leveling / skill-point system
// Persisted per account key the same way inventories/bank accounts are;
// guests get ephemeral progress that resets on disconnect, consistent with
// the rest of the guest-identity model.
// ---------------------------------------------------------------------------
const PROGRESS_FILE = path.join(__dirname, 'playerProgress.json');
function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch (e) { return {}; }
}
function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(playerProgress, null, 2));
}
const playerProgress = loadProgress(); // accountKey -> { xp, level, skillPoints, questCooldowns: {} }

// XP needed to reach each level (index = level). Level cap at 20.
const XP_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 6000,
                        8200, 11000, 14500, 19000, 25000, 32500, 42000, 54000, 69000, 87000];
const MAX_LEVEL = XP_THRESHOLDS.length - 1;

function getProgress(player) {
  if (player.accountKey) {
    if (!playerProgress[player.accountKey]) {
      playerProgress[player.accountKey] = { xp: 0, level: 1, skillPoints: 0, questCooldowns: {} };
      saveProgress();
    }
    return playerProgress[player.accountKey];
  }
  if (!player.guestProgress) player.guestProgress = { xp: 0, level: 1, skillPoints: 0, questCooldowns: {} };
  return player.guestProgress;
}

// Award XP to a player, leveling up as many times as thresholds are crossed,
// and broadcasting the change so their HUD updates immediately.
function grantXP(player, amount) {
  if (amount <= 0) return;
  const now = Date.now();
  if (player.activeStatus && player.activeStatus.type === 'wolfpact' && player.activeStatus.expiresAt > now) {
    amount *= 2;
  }
  const prog = getProgress(player);
  prog.xp += amount;
  let leveled = false;
  while (prog.level < MAX_LEVEL && prog.xp >= XP_THRESHOLDS[prog.level]) {
    prog.level++;
    prog.skillPoints++;
    leveled = true;
    send(player.ws, {
      type: 'level_up',
      level: prog.level,
      skillPoints: prog.skillPoints,
      message: `⬆️ Level up! You are now Level ${prog.level}. Skill points: ${prog.skillPoints}.`
    });
  }
  if (player.accountKey && (leveled || amount >= 5)) saveProgress();
  send(player.ws, { type: 'xp_gain', xp: prog.xp, level: prog.level, skillPoints: prog.skillPoints, gained: amount });
}

// Attach current progress fields to the in-memory player object so
// publicPlayer() can expose them without a separate lookup per broadcast.
function syncProgressToPlayer(player) {
  const prog = getProgress(player);
  player.xp = prog.xp;
  player.level = prog.level;
  player.skillPoints = prog.skillPoints;
}

// ---------------------------------------------------------------------------
// Quest system — 4 NPCs wandering town, each offering one repeatable quest
// tied to Wilds activities (killing mobs, harvesting plants). Quests go on a
// 24h cooldown after completion so they can't be farmed in seconds, but are
// otherwise repeatable. Only one quest can be active at a time.
// ---------------------------------------------------------------------------
const QUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// ── The Thornreach Chronicles ─────────────────────────────────────────────────
// Five centuries ago the Old Circle performed "The Fifth Severance" — a ritual
// meant to seal the Hollow, a void of corrupted spirits. The ritual shattered,
// splitting the order into two factions and infusing the Wildlands with dark
// energy. Witch Hazel, keeper of the ritual key (the Fifth Hand), can still
// close it — but both factions need the player's help first.
// ─────────────────────────────────────────────────────────────────────────────
const QUEST_CATALOG = {
  // ── Town quests (Ranger / Herbalist / Hunter / Scholar) ──────────────────
  rangers_cull: {
    npcId: 'npc_mara', npcName: 'Ranger Mara',
    name: 'Cull the Night Creatures',
    type: 'kill_mob', target: 3, xpReward: 75, goldReward: 40,
    itemRewards: [{ itemId: 'healing_potion', qty: 2 }],
    description: 'Three night creatures have been spotted near the Wilds portal. Put them down before dawn.'
  },
  herbalists_gather: {
    npcId: 'npc_finn', npcName: 'Herbalist Finn',
    name: 'Gather Wild Herbs',
    type: 'harvest_plant', target: 5, xpReward: 60, goldReward: 30,
    itemRewards: [{ itemId: 'magic_scroll', qty: 1 }],
    description: 'My supply is running low. Bring me five plants from the Wilds — any kind will do.'
  },
  hunters_hunt: {
    npcId: 'npc_dex', npcName: 'Hunter Dex',
    name: 'Slay the Greater Beasts',
    type: 'kill_mob', target: 5, xpReward: 120, goldReward: 60,
    itemRewards: [{ itemId: 'animal_pelt', qty: 2 }],
    description: 'The Wilds are crawling with foul things at night. Hunt five of them and I\'ll make it worth your while.'
  },
  scholars_find: {
    npcId: 'npc_lyra', npcName: 'Scholar Lyra',
    name: 'Find Healing Herbs',
    type: 'harvest_specific', targetItemId: 'healing_herb', target: 3, xpReward: 90, goldReward: 50,
    itemRewards: [{ itemId: 'enchanted_gem', qty: 1 }],
    description: 'I need healing herbs for my research — three of them from the Wilds. They\'re the bright green sprouts.'
  },

  // ── The Unbound Circle (western wilds, ~2200,5000) ────────────────────────
  circles_first_rite: {
    npcId: 'npc_morvaine', npcName: 'Elder Morvaine',
    name: 'Spirits of the Corrupted',
    type: 'kill_mob', target: 6, xpReward: 100, goldReward: 80,
    itemRewards: [{ itemId: 'enchanted_gem', qty: 1 }, { itemId: 'healing_potion', qty: 2 }],
    description: 'The corruption that bled from the Hollow has twisted the creatures of the Thornreach. Six of them must be put down. This is the first step of the old rite — do not falter.'
  },
  circles_second_rite: {
    npcId: 'npc_talwyn', npcName: 'Sister Talwyn',
    name: 'The Ancient Harvest',
    type: 'harvest_plant', target: 8, xpReward: 120, goldReward: 100,
    itemRewards: [{ itemId: 'druid_stone', qty: 1 }, { itemId: 'magic_scroll', qty: 2 }],
    description: 'The Fifth Severance requires the living essence of untouched plants — the old grove still holds some. Gather eight offerings from the Wilds. I can feel the seal weakening as we speak.'
  },
  circles_final_rite: {
    npcId: 'npc_caelum', npcName: 'Brother Caelum',
    name: 'Thornreach\'s Last Hunt',
    type: 'kill_mob', target: 10, xpReward: 180, goldReward: 200,
    itemRewards: [{ itemId: 'spirit_ring', qty: 1 }, { itemId: 'hollow_shard', qty: 2 }],
    description: 'The Hollow draws strength from its servants. Ten more must fall before Elder Morvaine can attempt the sealing ritual. Every corrupted creature you slay brings the Thornreach closer to peace.'
  },

  // ── The Thornwarden Scouts (eastern wilds, ~7800,5000) ───────────────────
  thorns_sweep: {
    npcId: 'npc_rhedyn', npcName: 'Captain Rhedyn',
    name: 'Eastern Sweep',
    type: 'kill_mob', target: 8, xpReward: 120, goldReward: 100,
    itemRewards: [{ itemId: 'leather_hide', qty: 3 }, { itemId: 'healing_potion', qty: 1 }],
    description: 'Corrupted creatures have broken through the eastern perimeter. Eight of them need to fall before they regroup. Move fast — we cannot let them reach the village.'
  },
  thorns_salvage: {
    npcId: 'npc_brynn', npcName: 'Quartermaster Brynn',
    name: 'Material Salvage',
    type: 'harvest_plant', target: 10, xpReward: 140, goldReward: 150,
    itemRewards: [{ itemId: 'lumber_bundle', qty: 3 }, { itemId: 'iron_ore', qty: 2 }],
    description: 'The camp fortifications are deteriorating. I need raw material from the Wilds — harvest what you can find. The builders need lumber desperately. Every bundle helps.'
  },
  thorns_assault: {
    npcId: 'npc_elara', npcName: 'Scout Elara',
    name: 'Storm the Hollows',
    type: 'kill_mob', target: 12, xpReward: 200, goldReward: 250,
    itemRewards: [{ itemId: 'stone_block', qty: 3 }, { itemId: 'iron_ingot', qty: 2 }, { itemId: 'enchanted_fur', qty: 1 }],
    description: 'My scouts tracked a corrupted convergence node east of the camp. Twelve of them must be destroyed before they coalesce into something none of us can stop. This is our moment — do not waste it.'
  }
};
// Reverse-lookup: npcId → questId
const QUEST_BY_NPC = {};
for (const [id, q] of Object.entries(QUEST_CATALOG)) QUEST_BY_NPC[q.npcId] = id;

function advanceQuestProgress(player, eventType, itemId) {
  const aq = player.activeQuest;
  if (!aq) return;
  const quest = QUEST_CATALOG[aq.questId];
  if (!quest) return;
  let matches = false;
  if (quest.type === 'kill_mob' && eventType === 'kill_mob') matches = true;
  if (quest.type === 'harvest_plant' && eventType === 'harvest_plant') matches = true;
  if (quest.type === 'harvest_specific' && eventType === 'harvest_plant' && itemId === quest.targetItemId) matches = true;
  if (!matches) return;

  aq.progress++;
  if (aq.progress >= quest.target) {
    player.activeQuest = null;
    grantXP(player, quest.xpReward);
    const prog = getProgress(player);
    prog.questCooldowns[aq.questId] = Date.now();
    if (player.accountKey) saveProgress();

    // Gold reward → bank balance
    if (quest.goldReward && player.accountKey) {
      const acct = ensureBankAccount(player.accountKey);
      acct.balance += quest.goldReward;
      saveBankAccounts();
    }

    // Item rewards → inventory
    const inv = getInventory(player);
    const itemsGranted = [];
    if (quest.itemRewards) {
      for (const r of quest.itemRewards) {
        if (addItemToAccount(inv, r.itemId, r.qty || 1)) {
          const meta = ITEM_CATALOG[r.itemId];
          itemsGranted.push(`${meta?.icon || '?'} ${meta?.name || r.itemId}`);
        }
      }
      if (player.accountKey) saveInventories();
    }

    const rewardParts = [`+${quest.xpReward} XP`];
    if (quest.goldReward) rewardParts.push(`+${quest.goldReward}🪙`);
    if (itemsGranted.length) rewardParts.push(itemsGranted.join(', '));

    send(player.ws, {
      type: 'quest_complete',
      questId: aq.questId,
      questName: quest.name,
      xpReward: quest.xpReward,
      goldReward: quest.goldReward || 0,
      itemsGranted,
      message: `✅ "${quest.name}" complete — ${rewardParts.join(' · ')}`
    });
  } else {
    send(player.ws, {
      type: 'quest_update',
      questId: aq.questId,
      questName: quest.name,
      progress: aq.progress,
      target: quest.target
    });
  }
}

// Returns null if access is granted, or an error message string if not —
// covers both "no password set" (always granted) and "wrong/missing
// password" cases in one check used by every mutating/viewing handler.
function checkHardDrivePassword(hd, suppliedPassword) {
  if (!hd.passwordHash) return null;
  if (!suppliedPassword || !verifyPassword(String(suppliedPassword), hd.passwordSalt, hd.passwordHash)) {
    return 'Incorrect Hard Drive password.';
  }
  return null;
}

function hardDriveStatePayload(hd) {
  return { hasPassword: !!hd.passwordHash, notes: hd.notes, capacity: HARDDRIVE_NOTE_CAPACITY };
}

// Keeps the connection's broadcastable equip state (read by publicPlayer())
// in sync with whatever's actually equipped in their inventory. Called
// after anything that can change equip state, and once at join.
function syncEquipToPlayer(player) {
  const inv = getInventory(player);
  player.equippedWeapon = inv.equippedWeapon || null;
  player.equippedHead   = inv.equippedHead   || null;
  player.equippedChest  = inv.equippedChest  || null;
  player.equippedFeet   = inv.equippedFeet   || null;
  player.equippedRing   = inv.equippedRing   || null;
}

// Equips one unit of whatever's in inv.slots[slotIdx] into the correct equip
// slot for that item (weapon/head/chest/feet/ring), swapping anything already
// equipped there back into the inventory first. Returns null on success, or
// an error string. Mutates nothing if it fails.
function equipFromSlot(inv, slotIdx, equipKind) {
  const stack = inv.slots[slotIdx];
  if (!stack) return 'That slot is empty.';
  const meta = ITEM_CATALOG[stack.itemId];
  if (!meta || meta.slot !== equipKind) return `That item can't be equipped as ${equipKind}.`;
  const field = invEquipField(equipKind);
  if (!field) return 'Unknown equip slot.';
  const itemId = stack.itemId;
  const previousItemId = inv[field];

  if (stack.qty > 1) stack.qty -= 1;
  else inv.slots[slotIdx] = null;

  if (previousItemId) {
    const added = addItemToAccount(inv, previousItemId, 1);
    if (!added) {
      if (inv.slots[slotIdx]) inv.slots[slotIdx].qty += 1;
      else inv.slots[slotIdx] = { itemId, qty: 1 };
      return `No room to unequip your current ${equipKind} first — free up a slot.`;
    }
  }

  inv[field] = itemId;
  return null;
}

// Inverse of equipFromSlot: moves whatever's equipped back into the
// inventory as a normal stack. Returns null on success, or an error string.
function unequipToInventory(inv, equipKind) {
  const field = invEquipField(equipKind);
  if (!field) return 'Unknown equip slot.';
  const itemId = inv[field];
  if (!itemId) return 'Nothing is equipped there.';
  if (!addItemToAccount(inv, itemId, 1)) return 'No room in your inventory to unequip that.';
  inv[field] = null;
  return null;
}

// ---------------------------------------------------------------------------
// Auction house. Listings persist the same way bank accounts do, keyed by
// a generated id rather than by player, since the active set is small and
// just needs to be browsable by everyone. Bidding uses escrow: a bid's
// amount comes out of the bidder's balance immediately (refunded if later
// outbid), so nobody can win an auction with money they don't actually
// have, and a seller's listed item leaves their slots the moment the
// listing goes up (returned if it expires with no bids) rather than
// risking them re-selling or losing track of something mid-auction.
// ---------------------------------------------------------------------------
const LISTINGS_FILE = path.join(__dirname, 'listings.json');
function loadListings() {
  try { return JSON.parse(fs.readFileSync(LISTINGS_FILE, 'utf8')); } catch (e) { return []; }
}
function saveListings() {
  fs.writeFileSync(LISTINGS_FILE, JSON.stringify(listings, null, 2));
}
let listings = loadListings();

const AUCTION_DURATIONS_MS = { 1: 3600000, 12: 12 * 3600000, 24: 24 * 3600000 };
// Selfie listings run much shorter than item listings — minutes, not hours
// — since guests (who can list selfies but have no bank account to escrow
// gold for a long-running auction) are expected to be the main sellers.
const SELFIE_AUCTION_DURATIONS_MS = { 5: 5 * 60000, 10: 10 * 60000, 20: 20 * 60000 };

function publicListing(l) {
  return {
    id: l.id, sellerName: l.sellerName, itemId: l.itemId || null, qty: l.qty || null,
    isSelfie: !!l.isSelfie, image: l.isSelfie ? l.image : null,
    isVoice: !!l.isVoice, audio: l.isVoice ? l.audio : null,
    startingBid: l.startingBid, buyoutPrice: l.buyoutPrice || null,
    currentBid: l.currentBid, currentBidderName: l.currentBidderName || null,
    expiresAt: l.expiresAt
  };
}

function broadcastAuctionState() {
  broadcastAll({ type: 'auction_state', listings: listings.map(publicListing) });
}

// A player's live connection, found by their bank-account key — used to
// push them a fresh bank_state after a sale/resolution affects their
// balance/items while they might have the panel open. Best-effort only:
// if they're offline, the change still lands in bankAccounts.json, they
// just see it next time they open the bank instead of immediately.
function findConnectionByAccountKey(key) {
  for (const p of players.values()) {
    if (p.accountKey === key) return p;
  }
  return null;
}
function pushBankStateIfOnline(key) {
  const p = findConnectionByAccountKey(key);
  if (p) send(p.ws, { type: 'bank_state', ...bankStatePayload(key) });
}

function resolveListing(listing) {
  listings = listings.filter(l => l.id !== listing.id);

  if (listing.isSelfie) {
    // The selfie itself isn't a bank-held item — it only ever exists as the
    // listing's image, so there's nothing to physically return on a no-bid
    // expiry. A winning bid just pays the seller and delivers the photo to
    // the winner as a note (not silently — the winner sees exactly where it
    // came from).
    if (listing.currentBidderKey) {
      if (listing.sellerKey) {
        const sellerAccount = ensureBankAccount(listing.sellerKey);
        sellerAccount.balance += listing.currentBid;
        saveBankAccounts();
        pushBankStateIfOnline(listing.sellerKey);
      } else {
        // A guest seller has no bank account to pay into — gold only
        // reaches them if they're still connected, as a one-time payout
        // notice. If they've disconnected by the time the auction closes,
        // there's nowhere for it to go, the same way a guest's inventory
        // or notes don't survive a disconnect either.
        const seller = players.get(listing.sellerId);
        if (seller) {
          send(seller.ws, {
            type: 'auction_payout',
            message: `📸 Your selfie sold to ${listing.currentBidderName} for ${listing.currentBid} gold! (Guest sales aren't banked — log in to an account to keep earnings.)`
          });
        }
      }
      pushBankStateIfOnline(listing.currentBidderKey);
      const winner = findConnectionByAccountKey(listing.currentBidderKey);
      const note = {
        id: makeId(), fromId: listing.sellerId || '', fromName: `📸 ${listing.sellerName}'s Auction Selfie`,
        text: `You won ${listing.sellerName}'s auctioned selfie for ${listing.currentBid} gold!`, image: listing.image
      };
      if (winner) {
        winner.inbox.push(note);
        send(winner.ws, { type: 'note_received', note });
      }
    }
    saveListings();
    return;
  }

  if (listing.isVoice) {
    // Same shape as the isSelfie branch above — the recording isn't a
    // bank-held item, it only exists as the listing's audio, so there's
    // nothing to return on a no-bid expiry. This branch was missing
    // entirely until now: without it, a resolved voice listing fell
    // through to the generic item logic below, which calls
    // addItemToAccount(winnerAccount, listing.itemId, listing.qty) — both
    // undefined for a voice listing, so nothing was ever delivered.
    if (listing.currentBidderKey) {
      if (listing.sellerKey) {
        const sellerAccount = ensureBankAccount(listing.sellerKey);
        sellerAccount.balance += listing.currentBid;
        saveBankAccounts();
        pushBankStateIfOnline(listing.sellerKey);
      } else {
        const seller = players.get(listing.sellerId);
        if (seller) {
          send(seller.ws, {
            type: 'auction_payout',
            message: `🎤 Your howl recording sold to ${listing.currentBidderName} for ${listing.currentBid} gold! (Guest sales aren't banked — log in to an account to keep earnings.)`
          });
        }
      }
      pushBankStateIfOnline(listing.currentBidderKey);
      const winner = findConnectionByAccountKey(listing.currentBidderKey);
      const note = {
        id: makeId(), fromId: listing.sellerId || '', fromName: `📜 Blood Oath, witnessed by ${listing.sellerName}`,
        text: `You won this howl recording for ${listing.currentBid} gold!`, audio: listing.audio
      };
      if (winner) {
        winner.inbox.push(note);
        send(winner.ws, { type: 'note_received', note });
      }
    }
    saveListings();
    return;
  }

  if (listing.currentBidderKey) {
    const winnerAccount = ensureBankAccount(listing.currentBidderKey);
    const added = addItemToAccount(winnerAccount, listing.itemId, listing.qty);
    if (added) {
      const sellerAccount = ensureBankAccount(listing.sellerKey);
      sellerAccount.balance += listing.currentBid;
      saveBankAccounts();
      pushBankStateIfOnline(listing.sellerKey);
      pushBankStateIfOnline(listing.currentBidderKey);
    } else {
      // Winner's bank is full — refund their escrowed bid and hand the
      // item back to the seller instead of losing it.
      winnerAccount.balance += listing.currentBid;
      const sellerAccount = ensureBankAccount(listing.sellerKey);
      addItemToAccount(sellerAccount, listing.itemId, listing.qty); // if seller is also full, the item is lost — rare double-edge-case, acceptable for this scope
      saveBankAccounts();
      pushBankStateIfOnline(listing.sellerKey);
      pushBankStateIfOnline(listing.currentBidderKey);
    }
  } else {
    // No bids — item just goes back to the seller.
    const sellerAccount = ensureBankAccount(listing.sellerKey);
    addItemToAccount(sellerAccount, listing.itemId, listing.qty);
    saveBankAccounts();
    pushBankStateIfOnline(listing.sellerKey);
  }
  saveListings();
}

setInterval(() => {
  const now = Date.now();
  const expired = listings.filter(l => l.expiresAt <= now);
  if (expired.length === 0) return;
  for (const l of expired) resolveListing(l);
  broadcastAuctionState();
}, 10000);

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

// A few seconds of compressed audio comfortably fits well under this —
// bumped up from an earlier, tighter cap since some browsers' default
// MediaRecorder bitrate ran larger than assumed and got rejected here.
const MAX_AUDIO_DATA_URL_LENGTH = 3000000;
function sanitizeAudio(raw) {
  if (typeof raw !== 'string') return null;
  if (raw.length > MAX_AUDIO_DATA_URL_LENGTH) return null;
  // MediaRecorder.mimeType's exact format (codec params, quoting, spacing
  // around ";") varies more across browsers than a strict pattern can
  // reliably match — an earlier stricter regex here rejected real
  // recordings more than once. This just checks it's actually an audio
  // data: URL with base64 content, nothing more specific than that.
  if (!/^data:audio\//i.test(raw)) return null;
  if (!/;base64,/i.test(raw)) return null;
  return raw;
}

const WITCH_DENIAL_LINES = [
  "I see no soul in this image… only trickery. Come back with your true face!",
  "My cauldron rejects fakes! That's not a human face — try again, dearie.",
  "The spirits whisper of deception. I need to see your FACE, not some other body part.",
  "Hmm… my crystal ball sees right through you. Show me a face — eyes, nose, mouth — not a hand!",
  "Do you think me a fool?! I need to see your FACE, not… whatever that was.",
  "That is not a face! I am a witch, not a palm reader. Point the camera at your actual face.",
];

// Calls Claude Haiku vision API to check whether the image contains a real human face.
// Fails open (returns true) on network/API errors so purchases aren't blocked by outages.
function detectHumanFace(dataUrl) {
  return new Promise((resolve) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[witch face-check] ANTHROPIC_API_KEY not set — server-side check skipped (client FaceDetector is primary)');
      return resolve(true);
    }

    const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/s);
    if (!match) return resolve(false);
    const [, mediaType, base64Data] = match;

    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      system: 'You are a strict selfie-gate. Reply only YES or NO — never any other text.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: `Selfie verification check. Answer NO for ANY of these:\n- hand, fingers, arm, leg, foot, or any body part that is not a face\n- pet, animal, or object\n- blank wall, ceiling, floor, or background\n- drawing, screen, or photo-of-a-photo\n- face not visible, covered, or looking away\n\nAnswer YES only if: a human face is the clear main subject AND eyes + nose + mouth are all visible.\n\nWhat is the primary subject? Is it a human face meeting ALL requirements above?` }
        ]
      }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = (parsed?.content?.[0]?.text || '').trim().toUpperCase();
          console.log('[witch face-check]', text);
          resolve(text.startsWith('YES'));
        } catch { resolve(true); }
      });
    });

    req.on('error', () => resolve(true));
    req.setTimeout(10000, () => { req.destroy(); resolve(true); });
    req.write(body);
    req.end();
  });
}

// Turns coordinates into a coarse "near <city>, <region>" label via
// OpenStreetMap's free Nominatim reverse-geocoder (no API key). zoom=10
// caps the lookup at city-level, so nothing street- or building-level ever
// comes back — the caller also pre-rounds lat/lon before this even runs,
// so no path to an exact address exists at any point in the chain. Resolves
// null (never rejects) on any failure so a lookup hiccup just fizzles the
// spell instead of leaking raw coordinates as a fallback.
function reverseGeocodeCoarse(lat, lon) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'nominatim.openstreetmap.org',
      path: `/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
      method: 'GET',
      headers: { 'User-Agent': 'town-chat-game/1.0 (in-game howl spell flavor text, no address lookups)' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const addr = JSON.parse(data).address || {};
          const place = addr.city || addr.town || addr.village || addr.county || null;
          const region = addr.state || addr.country || null;
          resolve(place && region ? `${place}, ${region}` : (place || region || null));
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Must match CHARACTER_PRESETS.length in client.js — the server doesn't
// know or care what the presets actually look like, it just needs to
// validate the index a client claims and relay it to everyone else.
const CHARACTER_COUNT = 5;

function publicPlayer(p) {
  // activeStatus is only ever included while still live — expired ones are
  // cleared in the periodic tick below, so clients never have to separately
  // track/guess expiry themselves; if it's present, it's still in effect.
  const status = p.activeStatus && p.activeStatus.expiresAt > Date.now() ? p.activeStatus : null;
  return {
    id: p.id, name: p.name, color: p.color, charId: p.charId, x: p.x, y: p.y, room: p.room,
    equippedWeapon: p.equippedWeapon || null,
    equippedHead:   p.equippedHead   || null,
    equippedChest:  p.equippedChest  || null,
    equippedFeet:   p.equippedFeet   || null,
    equippedRing:   p.equippedRing   || null,
    activeStatus: status, health: p.health,
    level: p.level || 1, skillPoints: p.skillPoints || 0,
    isDead: !!p.isDead
  };
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

// ---------------------------------------------------------------------------
// Wildlife & mobs — server-authoritative so every connected player sees the
// same rabbit/mob in the same place doing the same thing, rather than each
// client running its own disconnected simulation (which is how this worked
// before). Ticks on its own interval below and broadcasts positions;
// clients only render and interpolate, the same way they already do for
// remote players' positions.
//
// Day/night gating for mobs is computed independently here, purely from
// Date.now() with the same DAY_MS/NIGHT_MS split client.js uses for its
// lighting — both sides reading the same wall clock is what keeps them in
// agreement without needing a dedicated "is it night" message.
// ---------------------------------------------------------------------------
const DAY_MS = 20 * 60 * 1000;
const NIGHT_MS = 20 * 60 * 1000;
const CYCLE_MS = DAY_MS + NIGHT_MS;
function isNightNow() {
  return (Date.now() % CYCLE_MS) >= DAY_MS;
}

// ---------------------------------------------------------------------------
// Nightly torch-lighting ritual — 4 torches around the town square's spawn
// hub (1600, 1100), each with an assigned NPC who walks in from their
// daytime spot and lights it. Deliberately stateless: like isNightNow()
// above, ritual progress is computed purely from Date.now() % CYCLE_MS
// rather than tracked as mutable "ritual started at X" state, so every
// client (including one that joins mid-ritual) computes the exact same
// walk position/lit state independently, no dedicated sync message needed
// beyond the regular wildlife_state broadcast.
// ---------------------------------------------------------------------------
const TOWN_TORCHES = [
  { id: 'torch_n', x: 1600, y: 880 },
  { id: 'torch_e', x: 1820, y: 1100 },
  { id: 'torch_s', x: 1600, y: 1320 },
  { id: 'torch_w', x: 1380, y: 1100 }
];
const TORCH_NPCS = [
  { id: 'tnpc_0', name: 'Torchkeeper Ada',  charId: 2, homeX: 1600, homeY: 700,  torchIdx: 0 },
  { id: 'tnpc_1', name: 'Torchkeeper Bram', charId: 1, homeX: 2020, homeY: 1100, torchIdx: 1 },
  { id: 'tnpc_2', name: 'Torchkeeper Cora', charId: 0, homeX: 1600, homeY: 1500, torchIdx: 2 },
  { id: 'tnpc_3', name: 'Torchkeeper Dill', charId: 4, homeX: 1180, homeY: 1100, torchIdx: 3 }
];
const NIGHT_RITUAL_WALK_MS = 6000; // how long the walk-to-torch takes once night falls
const TORCH_HEAL_RADIUS = 180;

// null during the day; 0..1 during night (0 = dusk, just started walking;
// 1 = torches lit, ritual complete for the rest of the night).
function getTorchRitualProgress() {
  const t = Date.now() % CYCLE_MS;
  if (t < DAY_MS) return null;
  return Math.min(1, (t - DAY_MS) / NIGHT_RITUAL_WALK_MS);
}

function torchNpcPublicState() {
  const progress = getTorchRitualProgress();
  return TORCH_NPCS.map(n => {
    const torch = TOWN_TORCHES[n.torchIdx];
    let x = n.homeX, y = n.homeY, facing = 0;
    if (progress !== null) {
      x = n.homeX + (torch.x - n.homeX) * progress;
      y = n.homeY + (torch.y - n.homeY) * progress;
      facing = Math.atan2(torch.x - n.homeX, torch.y - n.homeY);
    }
    return { id: n.id, charId: n.charId, name: n.name, x, y, facing, working: progress !== null && progress >= 1 };
  });
}

function townTorchPublicState() {
  const lit = getTorchRitualProgress() >= 1;
  return TOWN_TORCHES.map(t => ({ id: t.id, x: t.x, y: t.y, lit }));
}

// Heals to full once per night, the moment a player is standing near any
// lit torch when the ritual completes (or whenever they later wander into
// range, for the rest of that night) — flag resets at dawn so it can fire
// again the following night rather than only ever once per player.
function tickTorchHealing() {
  const lit = getTorchRitualProgress() >= 1;
  for (const player of players.values()) {
    if (!lit) { player.torchHealedThisNight = false; continue; }
    if (player.torchHealedThisNight || player.isDead || player.room !== 'outside') continue;
    const near = TOWN_TORCHES.some(t => Math.hypot(player.x - t.x, player.y - t.y) < TORCH_HEAL_RADIUS);
    if (near) {
      player.health = 100;
      player.torchHealedThisNight = true;
      send(player.ws, { type: 'torch_healed', message: '🔥 The torchlight washes over you, and your wounds heal completely.' });
    }
  }
}

// Tree-trunk colliders, positions copied from client.js's NATURE_DECOR
// (tree entries only — shrubs/rocks/flowers have no collision there
// either). Only used for wildlife steering here; trees themselves are
// purely a client-side visual, never sent to clients from this list.
const TREE_COLLIDERS = [
  { x: 80, y: 935, r: 9 },   { x: 145, y: 1175, r: 7 }, { x: 65, y: 1360, r: 8 },
  { x: 935, y: 80, r: 8 },   { x: 1160, y: 55, r: 7 },
  { x: 3065, y: 935, r: 8 }, { x: 3135, y: 1175, r: 7 }, { x: 3080, y: 1360, r: 8 },
  { x: 935, y: 2135, r: 8 }, { x: 1200, y: 2160, r: 8 }, { x: 2000, y: 2145, r: 8 }, { x: 2265, y: 2120, r: 7 },
  { x: 1975, y: 80, r: 7 },  { x: 2160, y: 105, r: 8 },
  { x: 105, y: 335, r: 8 },  { x: 3105, y: 335, r: 8 }
];

// Unlike client.js's old per-client version, this blocks the *entire*
// building footprint (not just outside the door gap) — wildlife was never
// meant to wander inside, so there's no need to replicate the door-segment
// math here.
function wildlifeBlocked(x, y, r) {
  for (const b of WORLD.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
  }
  for (const t of TREE_COLLIDERS) {
    if (Math.hypot(x - t.x, y - t.y) < t.r + r) return true;
  }
  return false;
}

const ANIMAL_SPAWNS = [
  { x: 1600, y: 700 },  { x: 1600, y: 1500 }, { x: 1000, y: 1100 },
  { x: 2200, y: 1100 }, { x: 1300, y: 1750 }, { x: 1950, y: 520 },
  { x: 500,  y: 1300 }, { x: 2700, y: 1300 }, { x: 1100, y: 600 },
  { x: 2100, y: 1850 }
];
const ANIMAL_FLEE_RADIUS = 130;
const ANIMAL_SAFE_RADIUS = 190;
const ANIMAL_FLEE_SPEED = 110;
const ANIMAL_WANDER_SPEED = 26;
const ANIMAL_R = 9;

const ANIMAL_MAX_HEALTH = 30;
const ANIMAL_RESPAWN_MS = 90 * 1000;

const animals = ANIMAL_SPAWNS.map((p, i) => ({
  id: 'animal_' + i,
  spawnX: p.x, spawnY: p.y,
  x: p.x, y: p.y,
  facing: Math.random() * Math.PI * 2,
  fleeing: false,
  wanderTimer: Math.random() * 2,
  wanderAngle: 0,
  grazing: false,
  health: ANIMAL_MAX_HEALTH,
  dead: false,
  respawnAt: 0
}));

const MOB_SPAWNS = [
  { x: 250, y: 300 },   { x: 250, y: 750 },
  { x: 2780, y: 420 },  { x: 2780, y: 580 },
  { x: 245, y: 1560 },  { x: 245, y: 1730 },
  { x: 2785, y: 1560 }, { x: 2785, y: 1730 },
  { x: 1450, y: 60 },   { x: 1750, y: 60 }
];
const MOB_WANDER_SPEED = 22;
const MOB_R = 10;

const MOB_MAX_HEALTH = 50;
const MOB_RESPAWN_MS = 120 * 1000;

const mobs = MOB_SPAWNS.map((p, i) => ({
  id: 'mob_' + i,
  spawnX: p.x, spawnY: p.y,
  x: p.x, y: p.y,
  facing: Math.random() * Math.PI * 2,
  wanderTimer: Math.random() * 2,
  wanderAngle: 0,
  paused: false,
  health: MOB_MAX_HEALTH,
  dead: false,
  respawnAt: 0
}));

// Animals only react to (and mobs are only ever relevant to) players who
// are currently outdoors — someone inside a building shouldn't make a
// rabbit on the other side of town bolt.
function nearestOutdoorPlayer(x, y) {
  let best = null, bestDist = Infinity;
  for (const p of players.values()) {
    if (p.room !== 'outside' || p.isDead) continue;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return { player: best, dist: bestDist };
}

// Shared by animals and mobs: once dead, sit out of the simulation (no
// movement, invisible client-side) until respawnAt passes, then pop back
// at full health at the original spawn point — simplest possible respawn,
// no need to pick a new location since the spawn points are already spread
// around the map.
function tickRespawns(now) {
  for (const a of animals) {
    if (a.dead && now >= a.respawnAt) {
      a.dead = false; a.health = ANIMAL_MAX_HEALTH;
      a.x = a.spawnX; a.y = a.spawnY; a.fleeing = false;
    }
  }
  for (const m of mobs) {
    if (m.dead && now >= m.respawnAt) {
      m.dead = false; m.health = MOB_MAX_HEALTH;
      m.x = m.spawnX; m.y = m.spawnY; m.paused = false;
    }
  }
}

function tickWildlife(dt) {
  tickRespawns(Date.now());
  for (const a of animals) {
    if (a.dead) continue;
    const { player: nearestP, dist } = nearestOutdoorPlayer(a.x, a.y);
    if (dist < ANIMAL_FLEE_RADIUS) a.fleeing = true;
    else if (dist > ANIMAL_SAFE_RADIUS) a.fleeing = false;

    let vx = 0, vy = 0;
    if (a.fleeing && nearestP) {
      const dx = a.x - nearestP.x, dy = a.y - nearestP.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * ANIMAL_FLEE_SPEED;
      vy = dy * inv * ANIMAL_FLEE_SPEED;
    } else if (!a.fleeing) {
      a.wanderTimer -= dt;
      if (a.wanderTimer <= 0) {
        a.wanderTimer = 1.5 + Math.random() * 2.5;
        a.grazing = Math.random() < 0.35;
        a.wanderAngle = Math.random() * Math.PI * 2;
      }
      if (!a.grazing) {
        vx = Math.sin(a.wanderAngle) * ANIMAL_WANDER_SPEED;
        vy = Math.cos(a.wanderAngle) * ANIMAL_WANDER_SPEED;
      }
    }

    const margin = 60;
    const nx = a.x + vx * dt, ny = a.y + vy * dt;
    if (vx !== 0 && !wildlifeBlocked(nx, a.y, ANIMAL_R) && nx > margin && nx < WORLD.width - margin) a.x = nx;
    if (vy !== 0 && !wildlifeBlocked(a.x, ny, ANIMAL_R) && ny > margin && ny < WORLD.height - margin) a.y = ny;
    if (vx !== 0 || vy !== 0) a.facing = Math.atan2(vx, vy);
  }

  if (!isNightNow()) return;
  for (const m of mobs) {
    if (m.dead) continue;
    m.wanderTimer -= dt;
    if (m.wanderTimer <= 0) {
      m.wanderTimer = 1.5 + Math.random() * 2.5;
      m.paused = Math.random() < 0.3;
      m.wanderAngle = Math.random() * Math.PI * 2;
    }
    let vx = 0, vy = 0;
    if (!m.paused) {
      vx = Math.sin(m.wanderAngle) * MOB_WANDER_SPEED;
      vy = Math.cos(m.wanderAngle) * MOB_WANDER_SPEED;
    }
    const margin = 60;
    const nx = m.x + vx * dt, ny = m.y + vy * dt;
    if (vx !== 0 && !wildlifeBlocked(nx, m.y, MOB_R) && nx > margin && nx < WORLD.width - margin) m.x = nx;
    if (vy !== 0 && !wildlifeBlocked(m.x, ny, MOB_R) && ny > margin && ny < WORLD.height - margin) m.y = ny;
    if (vx !== 0 || vy !== 0) m.facing = Math.atan2(vx, vy);
  }
}

// ---------------------------------------------------------------------------
// The Wilds' own wildlife — friendly animals that behave exactly like
// town's rabbits, plus 4 dangerous mob types that, unlike town's mobs,
// actually fight back: at night, one that notices a nearby player chases
// them and lands periodic damage if it catches up, using the same
// health-reduction/defeat pattern as a player's own Strike. Reusing
// 'struck'/'defeated' for this means the client doesn't need any new
// message handling to feel it.
// ---------------------------------------------------------------------------
const ANIMALS2_COUNT = 24;
const ANIMAL2_SPAWNS = makeWildsScatter(0x5e21, 14, ANIMALS2_COUNT).map(([x, y]) => ({ x, y }));
const ANIMAL2_MAX_HEALTH = 30;
const ANIMAL2_RESPAWN_MS = 90 * 1000;
const animals2 = ANIMAL2_SPAWNS.map((p, i) => ({
  id: 'animal2_' + i,
  spawnX: p.x, spawnY: p.y, x: p.x, y: p.y,
  facing: Math.random() * Math.PI * 2,
  fleeing: false, wanderTimer: Math.random() * 2, wanderAngle: 0, grazing: false,
  health: ANIMAL2_MAX_HEALTH, dead: false, respawnAt: 0
}));

// 4 distinct designs — color/size for now-quick visual variety client-side,
// plus genuinely different combat stats so they read as different threats
// rather than reskins: a glass-cannon, a slow tank, a balanced classic
// wolf-type, and an erratic-but-fragile one.
const MOB2_TYPES = {
  shade_stalker: { name: 'Shade Stalker', color: 0x3a1a4a, scale: 0.85, maxHealth: 35, speed: 70, aggroRadius: 160, strikeRange: 50, dmgMin: 6,  dmgMax: 10, hitCooldownMs: 1400 },
  bog_brute:     { name: 'Bog Brute',     color: 0x3a4a26, scale: 1.35, maxHealth: 90, speed: 16, aggroRadius: 120, strikeRange: 60, dmgMin: 12, dmgMax: 18, hitCooldownMs: 2200 },
  night_howler:  { name: 'Night Howler',  color: 0x1a1a22, scale: 1.0,  maxHealth: 55, speed: 36, aggroRadius: 200, strikeRange: 50, dmgMin: 8,  dmgMax: 13, hitCooldownMs: 1800 },
  will_o_wisp:   { name: "Will-o'-Wisp",  color: 0x6fd8ff, scale: 0.6,  maxHealth: 18, speed: 50, aggroRadius: 140, strikeRange: 45, dmgMin: 4,  dmgMax: 7,  hitCooldownMs: 1200 }
};
const MOB2_KEYS = Object.keys(MOB2_TYPES);
const MOB2_SPAWNS = [
  { x: 150, y: 500, type: 'shade_stalker' }, { x: 850, y: 500, type: 'shade_stalker' },
  { x: 500, y: 150, type: 'bog_brute' },     { x: 500, y: 850, type: 'bog_brute' },
  { x: 320, y: 320, type: 'night_howler' },  { x: 680, y: 680, type: 'night_howler' },
  { x: 680, y: 320, type: 'will_o_wisp' },   { x: 320, y: 680, type: 'will_o_wisp' }
].map(p => ({ x: p.x * WILDS_SCALE, y: p.y * WILDS_SCALE, type: p.type }));
const MOB2_RESPAWN_MS = 120 * 1000;
const mobs2 = MOB2_SPAWNS.map((p, i) => ({
  id: 'mob2_' + i,
  mobType: p.type,
  spawnX: p.x, spawnY: p.y, x: p.x, y: p.y,
  facing: Math.random() * Math.PI * 2,
  wanderTimer: Math.random() * 2, wanderAngle: 0, paused: false,
  health: MOB2_TYPES[p.type].maxHealth, dead: false, respawnAt: 0,
  lastHitAt: 0
}));

function nearestWildsPlayer(x, y) {
  let best = null, bestDist = Infinity;
  for (const p of players.values()) {
    if (p.room !== 'wilds' || p.isDead) continue;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return { player: best, dist: bestDist };
}

function tickRespawns2(now) {
  for (const a of animals2) {
    if (a.dead && now >= a.respawnAt) {
      a.dead = false; a.health = ANIMAL2_MAX_HEALTH;
      a.x = a.spawnX; a.y = a.spawnY; a.fleeing = false;
    }
  }
  for (const m of mobs2) {
    if (m.dead && now >= m.respawnAt) {
      m.dead = false; m.health = MOB2_TYPES[m.mobType].maxHealth;
      m.x = m.spawnX; m.y = m.spawnY; m.paused = false;
    }
  }
}

function tickWilds(dt) {
  tickRespawns2(Date.now());
  const margin = 30; // smaller than town's — the Wilds is a much smaller map
  for (const a of animals2) {
    if (a.dead) continue;
    const { player: nearestP, dist } = nearestWildsPlayer(a.x, a.y);
    if (dist < ANIMAL_FLEE_RADIUS) a.fleeing = true;
    else if (dist > ANIMAL_SAFE_RADIUS) a.fleeing = false;

    let vx = 0, vy = 0;
    if (a.fleeing && nearestP) {
      const dx = a.x - nearestP.x, dy = a.y - nearestP.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * ANIMAL_FLEE_SPEED;
      vy = dy * inv * ANIMAL_FLEE_SPEED;
    } else if (!a.fleeing) {
      a.wanderTimer -= dt;
      if (a.wanderTimer <= 0) {
        a.wanderTimer = 1.5 + Math.random() * 2.5;
        a.grazing = Math.random() < 0.35;
        a.wanderAngle = Math.random() * Math.PI * 2;
      }
      if (!a.grazing) {
        vx = Math.sin(a.wanderAngle) * ANIMAL_WANDER_SPEED;
        vy = Math.cos(a.wanderAngle) * ANIMAL_WANDER_SPEED;
      }
    }
    const nx = a.x + vx * dt, ny = a.y + vy * dt;
    if (vx !== 0 && nx > margin && nx < WORLD2.width - margin) a.x = nx;
    if (vy !== 0 && ny > margin && ny < WORLD2.height - margin) a.y = ny;
    if (vx !== 0 || vy !== 0) a.facing = Math.atan2(vx, vy);
  }

  if (!isNightNow()) return;
  const now = Date.now();
  for (const m of mobs2) {
    if (m.dead) continue;
    const preset = MOB2_TYPES[m.mobType];
    const { player: nearestP, dist } = nearestWildsPlayer(m.x, m.y);
    let vx = 0, vy = 0;
    if (nearestP && dist < preset.aggroRadius) {
      const dx = nearestP.x - m.x, dy = nearestP.y - m.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * preset.speed;
      vy = dy * inv * preset.speed;
      if (dist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
        m.lastHitAt = now;
        const dmg = preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1));
        nearestP.health = Math.max(0, nearestP.health - dmg);
        if (nearestP.health <= 0) {
          nearestP.health = 0;
          nearestP.isDead = true;
          send(nearestP.ws, { type: 'you_died', byName: preset.name });
        } else {
          send(nearestP.ws, { type: 'struck', byName: preset.name, damage: dmg });
        }
      }
    } else {
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0) {
        m.wanderTimer = 1.5 + Math.random() * 2.5;
        m.paused = Math.random() < 0.3;
        m.wanderAngle = Math.random() * Math.PI * 2;
      }
      if (!m.paused) {
        vx = Math.sin(m.wanderAngle) * (preset.speed * 0.4);
        vy = Math.cos(m.wanderAngle) * (preset.speed * 0.4);
      }
    }
    const nx = m.x + vx * dt, ny = m.y + vy * dt;
    if (vx !== 0 && nx > margin && nx < WORLD2.width - margin) m.x = nx;
    if (vy !== 0 && ny > margin && ny < WORLD2.height - margin) m.y = ny;
    if (vx !== 0 || vy !== 0) m.facing = Math.atan2(vx, vy);
  }
}

// ---------------------------------------------------------------------------
// Village — A settlement in the wildlands. 8 NPCs (5 builders + 3 guards).
// Day: builders walk between construction sites and work; night: all patrol.
// ---------------------------------------------------------------------------
const VILLAGE_CENTER = { x: 5000, y: 3000 };
const VILLAGE_RADIUS = 370;

const VILLAGE_BUILD_SITES = [
  { x: 4960, y: 2885 }, // construction site left
  { x: 5040, y: 2885 }, // construction site right
  { x: 5135, y: 2955 }, // workshop/forge
  { x: 4865, y: 2955 }, // barn
  { x: 5000, y: 3005 }, // longhouse front
  { x: 4895, y: 3115 }, // cottage A
  { x: 5105, y: 3115 }, // cottage B
  { x: 5050, y: 2830 }, // guard tower base
];

const VILLAGE_PATROL_POINTS = (() => {
  const pts = [], N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push({ x: VILLAGE_CENTER.x + Math.cos(a) * VILLAGE_RADIUS, y: VILLAGE_CENTER.y + Math.sin(a) * VILLAGE_RADIUS });
  }
  return pts;
})();

const villageNpcs = [
  { id: 'vnpc_0', name: 'Carpenter',   charId: 1, x: 4960, y: 2885, facing: 0, buildSites: [0, 1],       siteIdx: 0, workTimer: 0, working: false, patrolIdx: 0  },
  { id: 'vnpc_1', name: 'Mason',       charId: 2, x: 5040, y: 2885, facing: 0, buildSites: [0, 1, 4],    siteIdx: 1, workTimer: 0, working: false, patrolIdx: 3  },
  { id: 'vnpc_2', name: 'Blacksmith',  charId: 3, x: 5135, y: 2955, facing: 0, buildSites: [2, 4],       siteIdx: 0, workTimer: 0, working: false, patrolIdx: 6  },
  { id: 'vnpc_3', name: 'Farmer',      charId: 1, x: 4865, y: 2955, facing: 0, buildSites: [3, 5, 6],    siteIdx: 0, workTimer: 0, working: false, patrolIdx: 9  },
  { id: 'vnpc_4', name: 'Lumberjack',  charId: 4, x: 5000, y: 3005, facing: 0, buildSites: [4, 5, 6, 7], siteIdx: 0, workTimer: 0, working: false, patrolIdx: 1  },
  { id: 'vnpc_5', name: 'Guard',       charId: 3, x: 5370, y: 3000, facing: 0, buildSites: [4, 7],       siteIdx: 0, workTimer: 0, working: false, patrolIdx: 0  },
  { id: 'vnpc_6', name: 'Guard',       charId: 3, x: 5000, y: 3370, facing: 0, buildSites: [4, 7],       siteIdx: 1, workTimer: 0, working: false, patrolIdx: 4  },
  { id: 'vnpc_7', name: 'Guard',       charId: 3, x: 4630, y: 3000, facing: 0, buildSites: [4, 7],       siteIdx: 0, workTimer: 0, working: false, patrolIdx: 8  },
];

const VILLAGER_SPEED = 65;

function tickVillageNpcs(dt) {
  const night = isNightNow();
  for (const npc of villageNpcs) {
    if (night) {
      const pt = VILLAGE_PATROL_POINTS[npc.patrolIdx % VILLAGE_PATROL_POINTS.length];
      const dx = pt.x - npc.x, dy = pt.y - npc.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) {
        npc.patrolIdx = (npc.patrolIdx + 1) % VILLAGE_PATROL_POINTS.length;
      } else {
        const inv = 1 / dist;
        npc.x += dx * inv * VILLAGER_SPEED * dt;
        npc.y += dy * inv * VILLAGER_SPEED * dt;
        npc.facing = Math.atan2(dx, dy);
      }
      npc.working = false;
    } else {
      if (npc.working) {
        npc.workTimer -= dt;
        if (npc.workTimer <= 0) {
          npc.working = false;
          npc.siteIdx = (npc.siteIdx + 1) % npc.buildSites.length;
        }
      } else {
        const site = VILLAGE_BUILD_SITES[npc.buildSites[npc.siteIdx]];
        const dx = site.x - npc.x, dy = site.y - npc.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 18) {
          npc.working = true;
          npc.workTimer = 6 + Math.random() * 8;
          npc.facing = Math.atan2(site.x - VILLAGE_CENTER.x, site.y - VILLAGE_CENTER.y);
        } else {
          const inv = 1 / dist;
          npc.x += dx * inv * VILLAGER_SPEED * dt;
          npc.y += dy * inv * VILLAGER_SPEED * dt;
          npc.facing = Math.atan2(dx, dy);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Personal Dungeon — 4 tier rooms (dungeon_t1 through dungeon_t4), each
// entered via the inventory Wildlands Token. Level range → tier:
//   Tier 1: levels  1-5   → dungeon_t1
//   Tier 2: levels  6-10  → dungeon_t2
//   Tier 3: levels 11-15  → dungeon_t3
//   Tier 4: levels 16-20  → dungeon_t4
// 32 mob types (8 per tier × 2 instances each = 64 dungeon mob objects).
// Always active — no day/night gate. Each room is 800×800.
// ---------------------------------------------------------------------------
const DUNGEON_SIZE = 800;
const DUNGEON_SPAWN = { x: 400, y: 700 };
const DUNGEON_RESPAWN_MS = 60 * 1000;
const DUNGEON_ROOMS = { 1: 'dungeon_t1', 2: 'dungeon_t2', 3: 'dungeon_t3', 4: 'dungeon_t4' };

function dungeonTierForLevel(level) {
  if (level <= 5)  return 1;
  if (level <= 10) return 2;
  if (level <= 15) return 3;
  return 4;
}

const DUNGEON_MOB_TYPES = {
  // Tier 1 — levels 1-5
  cave_rat:         { name: 'Cave Rat',         tier: 1, xp: 8,  color: 0x6b4c2a, scale: 0.55, maxHealth: 20,  speed: 70,  aggroRadius: 150, strikeRange: 45, dmgMin: 3,  dmgMax: 6,  hitCooldownMs: 1400 },
  stone_bat:        { name: 'Stone Bat',         tier: 1, xp: 8,  color: 0x5a5a6e, scale: 0.6,  maxHealth: 18,  speed: 85,  aggroRadius: 180, strikeRange: 40, dmgMin: 2,  dmgMax: 5,  hitCooldownMs: 1200 },
  moss_crawler:     { name: 'Moss Crawler',      tier: 1, xp: 8,  color: 0x3d5c2a, scale: 0.75, maxHealth: 35,  speed: 35,  aggroRadius: 100, strikeRange: 50, dmgMin: 4,  dmgMax: 7,  hitCooldownMs: 1800 },
  fungal_grunt:     { name: 'Fungal Grunt',      tier: 1, xp: 8,  color: 0x7a5f3a, scale: 1.0,  maxHealth: 45,  speed: 30,  aggroRadius: 120, strikeRange: 55, dmgMin: 5,  dmgMax: 8,  hitCooldownMs: 2000 },
  mud_slinger:      { name: 'Mud Slinger',       tier: 1, xp: 8,  color: 0x5a4a2e, scale: 0.85, maxHealth: 30,  speed: 45,  aggroRadius: 140, strikeRange: 48, dmgMin: 4,  dmgMax: 7,  hitCooldownMs: 1600 },
  tunnel_rat:       { name: 'Tunnel Rat',        tier: 1, xp: 8,  color: 0x7a5a3a, scale: 0.65, maxHealth: 25,  speed: 75,  aggroRadius: 160, strikeRange: 42, dmgMin: 3,  dmgMax: 6,  hitCooldownMs: 1300 },
  rock_beetle:      { name: 'Rock Beetle',       tier: 1, xp: 8,  color: 0x4a4a4a, scale: 0.9,  maxHealth: 50,  speed: 22,  aggroRadius: 90,  strikeRange: 52, dmgMin: 6,  dmgMax: 9,  hitCooldownMs: 2200 },
  pale_sprite:      { name: 'Pale Sprite',       tier: 1, xp: 8,  color: 0xd4c8ff, scale: 0.5,  maxHealth: 15,  speed: 90,  aggroRadius: 170, strikeRange: 38, dmgMin: 2,  dmgMax: 4,  hitCooldownMs: 1100 },
  // Tier 2 — levels 6-10
  shadow_wolf:      { name: 'Shadow Wolf',       tier: 2, xp: 18, color: 0x2a2a3a, scale: 1.05, maxHealth: 65,  speed: 80,  aggroRadius: 200, strikeRange: 52, dmgMin: 10, dmgMax: 15, hitCooldownMs: 1500 },
  dark_adder:       { name: 'Dark Adder',        tier: 2, xp: 18, color: 0x1e2b1e, scale: 0.75, maxHealth: 55,  speed: 65,  aggroRadius: 160, strikeRange: 45, dmgMin: 8,  dmgMax: 14, hitCooldownMs: 1400 },
  crypt_spider:     { name: 'Crypt Spider',      tier: 2, xp: 18, color: 0x3a1a3a, scale: 0.85, maxHealth: 60,  speed: 90,  aggroRadius: 175, strikeRange: 44, dmgMin: 9,  dmgMax: 13, hitCooldownMs: 1300 },
  bone_hound:       { name: 'Bone Hound',        tier: 2, xp: 18, color: 0xd8d0b8, scale: 1.0,  maxHealth: 80,  speed: 55,  aggroRadius: 180, strikeRange: 50, dmgMin: 12, dmgMax: 16, hitCooldownMs: 1700 },
  venom_crawler:    { name: 'Venom Crawler',     tier: 2, xp: 18, color: 0x2a4a1a, scale: 0.9,  maxHealth: 70,  speed: 40,  aggroRadius: 130, strikeRange: 54, dmgMin: 14, dmgMax: 18, hitCooldownMs: 2000 },
  swamp_lurker:     { name: 'Swamp Lurker',      tier: 2, xp: 18, color: 0x2e4a2a, scale: 1.15, maxHealth: 90,  speed: 28,  aggroRadius: 110, strikeRange: 58, dmgMin: 13, dmgMax: 17, hitCooldownMs: 2200 },
  cave_troll:       { name: 'Cave Troll',        tier: 2, xp: 18, color: 0x4a5a3a, scale: 1.4,  maxHealth: 120, speed: 18,  aggroRadius: 100, strikeRange: 62, dmgMin: 16, dmgMax: 20, hitCooldownMs: 2500 },
  marsh_specter:    { name: 'Marsh Specter',     tier: 2, xp: 18, color: 0x6aafcc, scale: 0.7,  maxHealth: 45,  speed: 100, aggroRadius: 190, strikeRange: 42, dmgMin: 11, dmgMax: 15, hitCooldownMs: 1200 },
  // Tier 3 — levels 11-15
  blood_bat:        { name: 'Blood Bat',         tier: 3, xp: 35, color: 0x8a0020, scale: 0.8,  maxHealth: 130, speed: 105, aggroRadius: 220, strikeRange: 44, dmgMin: 18, dmgMax: 24, hitCooldownMs: 1300 },
  iron_golem:       { name: 'Iron Golem',        tier: 3, xp: 35, color: 0x5a6070, scale: 1.7,  maxHealth: 220, speed: 12,  aggroRadius: 90,  strikeRange: 70, dmgMin: 25, dmgMax: 32, hitCooldownMs: 2800 },
  feral_warden:     { name: 'Feral Warden',      tier: 3, xp: 35, color: 0x6a2020, scale: 1.1,  maxHealth: 160, speed: 60,  aggroRadius: 195, strikeRange: 54, dmgMin: 20, dmgMax: 27, hitCooldownMs: 1800 },
  chaos_imp:        { name: 'Chaos Imp',         tier: 3, xp: 35, color: 0xcc4400, scale: 0.65, maxHealth: 100, speed: 120, aggroRadius: 200, strikeRange: 40, dmgMin: 18, dmgMax: 26, hitCooldownMs: 1200 },
  plague_hound:     { name: 'Plague Hound',      tier: 3, xp: 35, color: 0x4a5a1a, scale: 1.05, maxHealth: 145, speed: 80,  aggroRadius: 210, strikeRange: 50, dmgMin: 22, dmgMax: 28, hitCooldownMs: 1600 },
  void_walker:      { name: 'Void Walker',       tier: 3, xp: 35, color: 0x1a0a2a, scale: 0.75, maxHealth: 90,  speed: 95,  aggroRadius: 230, strikeRange: 42, dmgMin: 22, dmgMax: 30, hitCooldownMs: 1300 },
  stone_giant:      { name: 'Stone Giant',       tier: 3, xp: 35, color: 0x6a6a5a, scale: 1.8,  maxHealth: 210, speed: 10,  aggroRadius: 85,  strikeRange: 72, dmgMin: 28, dmgMax: 36, hitCooldownMs: 3000 },
  dusk_wraith:      { name: 'Dusk Wraith',       tier: 3, xp: 35, color: 0x4a2060, scale: 0.9,  maxHealth: 120, speed: 85,  aggroRadius: 240, strikeRange: 46, dmgMin: 24, dmgMax: 31, hitCooldownMs: 1400 },
  // Tier 4 — levels 16-20
  nightmare_beast:  { name: 'Nightmare Beast',   tier: 4, xp: 65, color: 0x1a0022, scale: 1.3,  maxHealth: 280, speed: 100, aggroRadius: 250, strikeRange: 56, dmgMin: 32, dmgMax: 42, hitCooldownMs: 1400 },
  shadow_titan:     { name: 'Shadow Titan',      tier: 4, xp: 65, color: 0x0a0010, scale: 1.9,  maxHealth: 400, speed: 14,  aggroRadius: 100, strikeRange: 72, dmgMin: 40, dmgMax: 52, hitCooldownMs: 2600 },
  void_serpent:     { name: 'Void Serpent',      tier: 4, xp: 65, color: 0x220033, scale: 0.85, maxHealth: 240, speed: 90,  aggroRadius: 230, strikeRange: 50, dmgMin: 34, dmgMax: 44, hitCooldownMs: 1500 },
  abyssal_hound:    { name: 'Abyssal Hound',     tier: 4, xp: 65, color: 0x1a0030, scale: 1.15, maxHealth: 300, speed: 95,  aggroRadius: 260, strikeRange: 54, dmgMin: 36, dmgMax: 46, hitCooldownMs: 1500 },
  infernal_brute:   { name: 'Infernal Brute',    tier: 4, xp: 65, color: 0x8a1a00, scale: 1.6,  maxHealth: 360, speed: 20,  aggroRadius: 110, strikeRange: 68, dmgMin: 42, dmgMax: 54, hitCooldownMs: 2800 },
  death_knight:     { name: 'Death Knight',      tier: 4, xp: 65, color: 0x1a1a2a, scale: 1.2,  maxHealth: 320, speed: 55,  aggroRadius: 220, strikeRange: 58, dmgMin: 38, dmgMax: 48, hitCooldownMs: 1800 },
  chaos_dragon:     { name: 'Chaos Dragon',      tier: 4, xp: 65, color: 0x660000, scale: 1.5,  maxHealth: 350, speed: 80,  aggroRadius: 270, strikeRange: 60, dmgMin: 44, dmgMax: 56, hitCooldownMs: 1500 },
  void_leviathan:   { name: 'Void Leviathan',    tier: 4, xp: 65, color: 0x000022, scale: 2.0,  maxHealth: 450, speed: 10,  aggroRadius: 95,  strikeRange: 80, dmgMin: 50, dmgMax: 65, hitCooldownMs: 3200 }
};

const DUNGEON_MOB_KEYS_BY_TIER = {
  1: ['cave_rat','stone_bat','moss_crawler','fungal_grunt','mud_slinger','tunnel_rat','rock_beetle','pale_sprite'],
  2: ['shadow_wolf','dark_adder','crypt_spider','bone_hound','venom_crawler','swamp_lurker','cave_troll','marsh_specter'],
  3: ['blood_bat','iron_golem','feral_warden','chaos_imp','plague_hound','void_walker','stone_giant','dusk_wraith'],
  4: ['nightmare_beast','shadow_titan','void_serpent','abyssal_hound','infernal_brute','death_knight','chaos_dragon','void_leviathan']
};

const DUNGEON_SPAWN_POSITIONS = [
  { x: 150, y: 150 }, { x: 400, y: 120 }, { x: 650, y: 150 },
  { x: 120, y: 350 }, { x: 680, y: 350 },
  { x: 120, y: 450 }, { x: 680, y: 450 },
  { x: 150, y: 600 }, { x: 400, y: 580 }, { x: 650, y: 600 },
  { x: 250, y: 250 }, { x: 550, y: 250 },
  { x: 250, y: 500 }, { x: 550, y: 500 },
  { x: 200, y: 400 }, { x: 600, y: 400 }
];

// Build dungeonMobs: 8 types × 4 tiers × 2 instances = 64 total
const dungeonMobs = [];
let _dmIdx = 0;
for (const [tierStr, keys] of Object.entries(DUNGEON_MOB_KEYS_BY_TIER)) {
  const tier = Number(tierStr);
  const room = DUNGEON_ROOMS[tier];
  for (const key of keys) {
    const preset = DUNGEON_MOB_TYPES[key];
    for (let inst = 0; inst < 2; inst++) {
      const sp = DUNGEON_SPAWN_POSITIONS[_dmIdx % DUNGEON_SPAWN_POSITIONS.length];
      _dmIdx++;
      const jitter = () => (Math.random() - 0.5) * 60;
      const sx = Math.max(50, Math.min(DUNGEON_SIZE - 50, sp.x + jitter()));
      const sy = Math.max(50, Math.min(DUNGEON_SIZE - 50, sp.y + jitter()));
      dungeonMobs.push({
        id: `dung_${key}_${inst}`,
        mobType: key, tier, room,
        spawnX: sx, spawnY: sy, x: sx, y: sy,
        facing: Math.random() * Math.PI * 2,
        wanderTimer: Math.random() * 2, wanderAngle: 0, paused: false,
        health: preset.maxHealth, dead: false, respawnAt: 0,
        lastHitAt: 0
      });
    }
  }
}

function nearestDungeonPlayer(room, x, y) {
  let best = null, bestDist = Infinity;
  for (const p of players.values()) {
    if (p.room !== room || p.isDead) continue;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return { player: best, dist: bestDist };
}

function tickDungeon(dt) {
  const now = Date.now();
  const margin = 40;
  for (const m of dungeonMobs) {
    if (m.dead) {
      if (now >= m.respawnAt) {
        m.dead = false;
        m.health = DUNGEON_MOB_TYPES[m.mobType].maxHealth;
        m.x = m.spawnX; m.y = m.spawnY;
      }
      continue;
    }
    const preset = DUNGEON_MOB_TYPES[m.mobType];
    const { player: nearestP, dist } = nearestDungeonPlayer(m.room, m.x, m.y);
    let vx = 0, vy = 0;
    if (nearestP && dist < preset.aggroRadius) {
      const dx = nearestP.x - m.x, dy = nearestP.y - m.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * preset.speed;
      vy = dy * inv * preset.speed;
      if (dist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
        m.lastHitAt = now;
        const dmg = preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1));
        nearestP.health = Math.max(0, nearestP.health - dmg);
        if (nearestP.health <= 0) {
          nearestP.health = 0;
          nearestP.isDead = true;
          send(nearestP.ws, { type: 'you_died', byName: preset.name });
        } else {
          send(nearestP.ws, { type: 'struck', byName: preset.name, damage: dmg });
        }
      }
    } else {
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0) {
        m.wanderTimer = 1.5 + Math.random() * 2.5;
        m.paused = Math.random() < 0.3;
        m.wanderAngle = Math.random() * Math.PI * 2;
      }
      if (!m.paused) {
        vx = Math.sin(m.wanderAngle) * (preset.speed * 0.35);
        vy = Math.cos(m.wanderAngle) * (preset.speed * 0.35);
      }
    }
    const nx = m.x + vx * dt, ny = m.y + vy * dt;
    if (vx !== 0 && nx > margin && nx < DUNGEON_SIZE - margin) m.x = nx;
    if (vy !== 0 && ny > margin && ny < DUNGEON_SIZE - margin) m.y = ny;
    if (vx !== 0 || vy !== 0) m.facing = Math.atan2(vx, vy);
  }
}

// The one status effect that isn't purely client-cosmetic — Regen Root
// actually heals over time, so unlike every other status it needs the
// server to do something with it each tick rather than just track expiry.
const REGEN_HP_PER_SEC = 2.5;
function tickPlayerRegen(now, dt) {
  for (const p of players.values()) {
    if (p.activeStatus && p.activeStatus.type === 'regen' && p.activeStatus.expiresAt > now) {
      p.health = Math.min(100, p.health + REGEN_HP_PER_SEC * dt);
    }
  }
}

let lastWildlifeTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.5, (now - lastWildlifeTick) / 1000);
  lastWildlifeTick = now;
  tickWildlife(dt);
  tickWilds(dt);
  tickVillageNpcs(dt);
  tickDungeon(dt);
  tickPlayerRegen(now, dt);
  tickTorchHealing();
  if (players.size === 0) return;
  broadcastAll({
    type: 'wildlife_state',
    isNight: isNightNow(),
    animals: animals.map(a => ({ id: a.id, x: a.x, y: a.y, facing: a.facing, fleeing: a.fleeing, health: a.health, maxHealth: ANIMAL_MAX_HEALTH, dead: a.dead })),
    mobs: mobs.map(m => ({ id: m.id, x: m.x, y: m.y, facing: m.facing, health: m.health, maxHealth: MOB_MAX_HEALTH, dead: m.dead })),
    animals2: animals2.map(a => ({ id: a.id, x: a.x, y: a.y, facing: a.facing, fleeing: a.fleeing, health: a.health, maxHealth: ANIMAL2_MAX_HEALTH, dead: a.dead })),
    mobs2: mobs2.map(m => ({ id: m.id, mobType: m.mobType, x: m.x, y: m.y, facing: m.facing, health: m.health, maxHealth: MOB2_TYPES[m.mobType].maxHealth, dead: m.dead })),
    decor: decorPublicState(),
    dungeonMobs: dungeonMobs.map(m => ({ id: m.id, mobType: m.mobType, tier: m.tier, room: m.room, x: m.x, y: m.y, facing: m.facing, health: m.health, maxHealth: DUNGEON_MOB_TYPES[m.mobType].maxHealth, dead: m.dead })),
    villageNpcs: villageNpcs.map(n => ({ id: n.id, charId: n.charId, name: n.name, x: n.x, y: n.y, facing: n.facing, working: n.working })),
    torchNpcs: torchNpcPublicState(),
    torches: townTorchPublicState()
  });
}, 150);

// ---------------------------------------------------------------------------
// Spells — a Witch-only (charId 0) feature, cast from the client's
// Spellbook. Most are a timed "status effect" stamped onto a player and
// synced via publicPlayer() above, the same way equipped gear already is;
// the client owns all the actual visual/gameplay behavior per status type
// (scale, movement multiplier, chat text mangling, etc.) — this server only
// tracks who has what and until when. Only one status can be active on a
// given player at a time; a new cast simply overwrites whatever was there.
//
// Open 3rd Eye is the deliberate exception: instead of an immediate
// status, it sends the TARGET an explicit consent request and waits.
// There is no code path here that captures or transmits a photo without
// that target's own in-the-moment Allow — a Deny (or no response at all)
// just lets the request expire with nothing sent anywhere.
// ---------------------------------------------------------------------------
const SPELL_CATALOG = {
  open_third_eye: {
    name: 'Open 3rd Eye', icon: '👁️', kind: 'targeted', effect: 'camera',
    description: "Asks to peer through a target's own eyes — with their permission — and sends what it sees back to you as a note."
  },
  toads_tongue: {
    name: "Toad's Tongue", icon: '🐸', kind: 'targeted', effect: 'status', statusType: 'toad', durationMs: 45000,
    description: 'Curses the target to croak mid-sentence in chat for a while.'
  },
  stumble_hex: {
    name: 'Stumble Hex', icon: '🦶', kind: 'targeted', effect: 'status', statusType: 'stumble', durationMs: 20000,
    description: "Hexes the target's feet — halves their walking speed."
  },
  featherfall: {
    name: 'Featherfall Curse', icon: '🪶', kind: 'targeted', effect: 'status', statusType: 'feather', durationMs: 20000,
    description: 'Fills the target with helium dread — they bounce absurdly high when they jump.'
  },
  shrinking_curse: {
    name: 'Shrinking Curse', icon: '🔻', kind: 'targeted', effect: 'status', statusType: 'shrink', durationMs: 20000,
    description: 'Shrinks the target down to half size.'
  },
  giants_folly: {
    name: "Giant's Folly", icon: '🔺', kind: 'targeted', effect: 'status', statusType: 'giant', durationMs: 20000,
    description: 'Swells the target up to twice their size.'
  },
  pumpkin_head: {
    name: 'Pumpkin Head', icon: '🎃', kind: 'targeted', effect: 'status', statusType: 'pumpkin', durationMs: 30000,
    description: "Replaces the target's head with a jack-o'-lantern."
  },
  bat_swarm: {
    name: 'Bat Swarm', icon: '🦇', kind: 'targeted', effect: 'status', statusType: 'bats', durationMs: 15000,
    description: 'Summons a circling swarm of bats around the target.'
  },
  color_curse: {
    name: 'Color Curse', icon: '🌈', kind: 'targeted', effect: 'status', statusType: 'colorcycle', durationMs: 20000,
    description: "Curses the target's clothes to cycle through every color."
  },
  silver_tongue: {
    name: 'Silver Tongue Hex', icon: '🗣️', kind: 'targeted', effect: 'status', statusType: 'gibberish', durationMs: 30000,
    description: "Tangles the target's words into nonsense in chat for a while."
  },
  ravens_cloak: {
    name: "Raven's Cloak", icon: '🪽', kind: 'self', effect: 'status', statusType: 'ravencloak', durationMs: 30000,
    description: 'Wraps the caster in a swirl of dark feathers.'
  },
  glimpse_future: {
    name: 'Glimpse the Future', icon: '🔮', kind: 'targeted', effect: 'reveal',
    description: "Reveals a target's current location to the caster."
  }
};
const SPELL_COOLDOWN_MS = 8000;

const NPC_SHOPS = {
  npc_mara: { name: 'Ranger Mara', items: [
    { id: 'iron_sword', price: 50 }, { id: 'leather_boots', price: 30 },
    { id: 'steel_shield', price: 40 }, { id: 'healing_potion', price: 15 }
  ]},
  npc_finn: { name: 'Herbalist Finn', items: [
    { id: 'healing_potion', price: 15 }, { id: 'magic_scroll', price: 25 },
    { id: 'regen_root', price: 20 }, { id: 'cleansing_clover', price: 18 }
  ]},
  npc_dex: { name: 'Hunter Dex', items: [
    { id: 'iron_sword', price: 50 }, { id: 'beast_crown', price: 35 },
    { id: 'beast_hide', price: 40 }, { id: 'paw_boots', price: 30 }
  ]},
  npc_lyra: { name: 'Scholar Lyra', items: [
    { id: 'spell_tome', price: 60 }, { id: 'wizard_hat', price: 35 },
    { id: 'spirit_ring', price: 45 }, { id: 'enchanted_gem', price: 30 }
  ]},
  // ---- Building-interior NPCs (see buildFurniture's per-theme branches) ----
  npc_bartender: { name: 'Barkeep Joss', items: [
    { id: 'healing_potion', price: 12 }, { id: 'berries', price: 5 },
    { id: 'regen_root', price: 18 }, { id: 'cleansing_clover', price: 15 }
  ]},
  npc_scholar: { name: 'Scholar Elior', items: [
    { id: 'spirit_veil', price: 35 }, { id: 'spirit_robe', price: 40 },
    { id: 'travelers_hood', price: 25 }, { id: 'travelers_vest', price: 30 }
  ]},
  npc_apothecary: { name: 'Apothecary Vex', items: [
    { id: 'healing_potion', price: 14 }, { id: 'magic_scroll', price: 22 },
    { id: 'regen_root', price: 18 }, { id: 'berries', price: 5 }
  ]},
  npc_tailor: { name: 'Tailor Ines', items: [
    { id: 'silver_ring', price: 30 }, { id: 'travelers_vest', price: 30 },
    { id: 'order_signet', price: 40 }, { id: 'spirit_robe', price: 40 }
  ]},
  npc_armorer: { name: 'Armorer Beck', items: [
    { id: 'steel_shield', price: 45 }, { id: 'knights_helm', price: 40 },
    { id: 'leather_boots', price: 20 }, { id: 'order_signet', price: 40 }
  ]}
};

// Building-interior hint-givers — not quest-givers themselves (not in
// QUEST_BY_NPC), just a friendly local who'll point a stuck player back at
// whatever quest they're already on. See npc_hint_talk below and
// getQuestHint() for how the actual hint text is derived from the quest's
// own type/target rather than being hand-authored per quest.
const NPC_HINT_GIVERS = {
  npc_patron: { name: 'Old Mabel' },
  npc_apprentice: { name: 'Apprentice Wren' },
  npc_tinkerer: { name: 'Tinkerer Oswin' },
  npc_noble: { name: 'Lady Corwin' },
  npc_knight: { name: 'Sir Dorran' },
  npc_guard: { name: 'Guard Petra' }
};

// Generic, type-driven hint text — works for any quest without needing a
// hand-written line per quest id, so new quests/hint-NPCs don't need this
// touched.
function getQuestHint(quest, progress) {
  const remaining = Math.max(0, quest.target - progress);
  if (quest.type === 'kill_mob') {
    return `Night creatures come out in the Wilds after dark — look near the portal and the wooded edges. ${remaining} more to go.`;
  }
  if (quest.type === 'harvest_plant') {
    return `Plants are scattered all through the Wilds — walk up to any sprout, flower, or mushroom and interact with it. ${remaining} more to go.`;
  }
  if (quest.type === 'harvest_specific') {
    const item = ITEM_CATALOG[quest.targetItemId];
    return `You need ${item ? item.icon + ' ' + item.name : quest.targetItemId} specifically, not just any plant. ${remaining} more to go.`;
  }
  return `Keep at it — you're ${progress}/${quest.target} of the way there.`;
}

// Witch cave — entrance in the Wilds, leads to a small cave room
const WITCH_CAVE_ENTRANCE = { x: 2000, y: 2000 };
const WITCH_CAVE_SPAWN = { x: 400, y: 450 };

// Bank Vault — a small sub-room reached from inside the Bank's own
// interior (not from the town/wilds directly), same idea as the Witch's
// Cave but nested one level deeper. No distance gate on entry since it's
// triggered by an interior kiosk (F key) rather than a zone check.
const VAULT_WORLD_DIMS = { width: 300, height: 300 };
const VAULT_SPAWN = { x: 150, y: 60 };

const WITCH_SHOP_TIERS = [
  // tier 0: lvl 1-5
  [
    { id: 'cursed_blade' }, { id: 'shadow_cloak' },
    { id: 'dread_helm' },   { id: 'witches_boon' }, { id: 'soul_treads' }
  ],
  // tier 1: lvl 6-10
  [
    { id: 'shadow_staff' }, { id: 'bone_armor' },
    { id: 'shadow_crown' }, { id: 'witches_boon' }, { id: 'soul_treads' }
  ],
  // tier 2: lvl 11-15
  [
    { id: 'void_staff' },   { id: 'abyssal_armor' },
    { id: 'shadow_crown' }, { id: 'death_ring' }, { id: 'wraith_treads' }
  ],
  // tier 3: lvl 16-20
  [
    { id: 'void_staff' },   { id: 'abyssal_armor' },
    { id: 'shadow_crown' }, { id: 'death_ring' }, { id: 'wraith_treads' }
  ]
];

function witchShopTierForLevel(level) {
  if (level >= 16) return 3;
  if (level >= 11) return 2;
  if (level >= 6) return 1;
  return 0;
}

// Lexton Greyfur's "Join the Howl" trade — separate from his free daily
// Blood Pact (wolf_pact, no real data). This one is real: the player's own
// microphone, only after an explicit per-purchase consent prompt (see
// werewolf_voice_request below), a few seconds long, capturing the howl
// itself rather than anything spoken. Not level-gated, unlike the Witch's
// tiers — small, flat pool.
const WEREWOLF_HOWL_ITEMS = [
  { id: 'moonhowl_pelt' }, { id: 'alpha_fang' },
  { id: 'packbound_ring' }, { id: 'nightfang_boots' }
];

const parties = new Map();
const playerParty = new Map();
const partyInvites = new Map();

function getOrCreateParty(leaderId) {
  let partyId = playerParty.get(leaderId);
  if (!partyId) {
    partyId = makeId();
    parties.set(partyId, { leaderId, members: new Set([leaderId]) });
    playerParty.set(leaderId, partyId);
  }
  return partyId;
}

function leaveParty(p) {
  const partyId = playerParty.get(p.id);
  if (!partyId) return;
  const party = parties.get(partyId);
  playerParty.delete(p.id);
  if (!party) return;
  party.members.delete(p.id);
  if (party.members.size === 0) { parties.delete(partyId); return; }
  if (party.leaderId === p.id) party.leaderId = [...party.members][0];
  broadcastPartyUpdate(partyId);
}

function broadcastPartyUpdate(partyId) {
  const party = parties.get(partyId);
  if (!party) return;
  const memberList = [...party.members].map(id => {
    const p = players.get(id);
    return p ? { id: p.id, name: p.name, isDead: !!p.isDead } : null;
  }).filter(Boolean);
  for (const memberId of party.members) {
    const p = players.get(memberId);
    if (p) send(p.ws, { type: 'party_state', partyId, leaderId: party.leaderId, members: memberList });
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, inv] of partyInvites) {
    if (inv.expiresAt <= now) partyInvites.delete(id);
  }
}, 15000);

function describeRoom(roomId) {
  if (roomId === 'outside') return 'the Town Square';
  const b = WORLD.buildings.find(x => x.id === roomId);
  return b ? b.name : roomId;
}

// requestId -> { casterId, casterName, targetId, expiresAt }. Entries are
// removed as soon as they're resolved (deny, photo, or success); the sweep
// below only exists to clean up ones the target never responded to at all.
const pendingSpellConsents = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of pendingSpellConsents) {
    if (p.expiresAt <= now) pendingSpellConsents.delete(id);
  }
}, 30000);

// Same shape/lifecycle as pendingSpellConsents above, for the Werewolf's
// Scent Trail (see howl_location handling in cast_attack).
const pendingHowlConsents = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of pendingHowlConsents) {
    if (p.expiresAt <= now) pendingHowlConsents.delete(id);
  }
}, 30000);

// ---------------------------------------------------------------------------
// Character attacks — charId-gated (see ATTACK_CATALOGS below). AoE attacks
// use AOE_RADIUS to find nearby players automatically; targeted/reveal
// attacks require a targetId. Rapid Swipe is the unique one: it lifts one
// still-undestroyed note out of the target's inbox (see player.inbox above,
// kept in sync with send_note/destroy_note below) and delivers it to the
// caster instead — not a read-only peek, the note is actually gone from the
// target's inbox afterward. Deep Meditation (Wanderer) only ever surfaces
// chat that was already broadcast out loud to everyone in the same room
// while it was happening — not a private read of anything the meditating
// player couldn't already see in their own chat log. Target players receive
// a non-blocking attack_hit notification; the caster gets an attack_result
// toast and notes for the data-reveal effects.
// ---------------------------------------------------------------------------
const WEREWOLF_ATTACK_CATALOG = {
  rapid_swipe:      { name: 'Rapid Swipe',       kind: 'targeted', effect: 'note_steal' },
  lunar_howl:       { name: 'Lunar Howl',       kind: 'aoe', effect: 'status', statusType: 'stumble',    durationMs: 15000 },
  terrifying_roar:  { name: 'Terrifying Roar',  kind: 'aoe', effect: 'status', statusType: 'gibberish', durationMs: 20000 },
  alpha_bite:       { name: 'Alpha Bite',        kind: 'targeted', effect: 'status', statusType: 'shrink',     durationMs: 25000 },
  feral_dash:       { name: 'Feral Dash',        kind: 'self', effect: 'status', statusType: 'speedboost', durationMs: 12000 },
  blood_frenzy:     { name: 'Blood Frenzy',      kind: 'self', effect: 'status', statusType: 'giant',      durationMs: 15000 },
  bone_crunch:      { name: 'Bone Crunch',       kind: 'targeted', effect: 'status', statusType: 'feather',    durationMs: 20000 },
  shadow_claws:     { name: 'Shadow Claws',      kind: 'targeted', effect: 'status', statusType: 'pumpkin',    durationMs: 30000 },
  wolf_mark:        { name: 'Wolf Mark',          kind: 'targeted', effect: 'status', statusType: 'wolfmark',   durationMs: 30000 },
  feral_haze:       { name: 'Feral Haze',        kind: 'targeted', effect: 'status', statusType: 'colorcycle', durationMs: 20000 },
  snarl:            { name: 'Snarl',             kind: 'targeted', effect: 'status', statusType: 'bats',       durationMs: 15000 },
  // Unlike the other 'reveal' attacks (e.g. compass_trick below), this one
  // doesn't read anything the server already knows — it asks the target's
  // own device for their real location. See howl_location handling in
  // cast_attack below: target gets an explicit consent prompt naming the
  // caster before anything is requested, and the result the caster
  // eventually sees is a coarse city-level label, never raw coordinates,
  // sent only to the caster (never posted anywhere public).
  scent_trail:      { name: 'Scent Trail',       kind: 'targeted', effect: 'howl_location' }
};

// charId 4 — Wanderer. effect 'spyglass' is the unique one (Spy Glass):
// kind 'building' — caster picks any building (not necessarily one they're
// in), gets a live window into that room's chat for durationMs. Unlike the
// other reveal effects this exposes something the caster couldn't already
// see, so it is NOT covert: everyone physically in the target room gets a
// spyglass_notice the moment it's cast, naming the caster (see cast_attack
// below and roomChatLogs for the rolling per-room buffer it reads from).
// effect 'pickpocket' (Sleight of Hand) is the other one: kind 'targeted' —
// peeks at the target's carried inventory (not equipped gear) and rolls
// stealChance to lift one item from it. Also not covert: the target always
// gets an attack_hit naming the caster, whether or not the steal actually
// landed, the same as every other targeted attack.
const WANDERER_ATTACK_CATALOG = {
  spy_glass:          { name: 'Spy Glass',           kind: 'building', effect: 'spyglass', durationMs: 60000 },
  sleight_of_hand:    { name: 'Sleight of Hand',     kind: 'targeted', effect: 'pickpocket', stealChance: 0.35 },
  echo_canyon:        { name: 'Echo Canyon',         kind: 'aoe', effect: 'status', statusType: 'gibberish', durationMs: 20000 },
  deep_meditation:    { name: 'Deep Meditation',     kind: 'self', effect: 'status', statusType: 'meditate', durationMs: 60000 },
  heavy_pack:         { name: 'Heavy Pack',          kind: 'targeted', effect: 'status', statusType: 'shrink',     durationMs: 20000 },
  endless_road:       { name: 'Endless Road',        kind: 'targeted', effect: 'status', statusType: 'stumble',    durationMs: 25000 },
  featherlight_pack:  { name: 'Featherlight Pack',   kind: 'targeted', effect: 'status', statusType: 'feather',    durationMs: 20000 },
  shadow_owls:        { name: 'Shadow Owls',         kind: 'targeted', effect: 'status', statusType: 'bats',       durationMs: 15000 },
  wanderlust:         { name: 'Wanderlust',          kind: 'self', effect: 'status', statusType: 'speedboost', durationMs: 12000 },
  campfire_tale:      { name: 'Campfire Tale',       kind: 'self', effect: 'status', statusType: 'giant',      durationMs: 15000 },
  nightwatch_cloak:   { name: "Nightwatch Cloak",    kind: 'self', effect: 'status', statusType: 'ravencloak', durationMs: 30000 },
  compass_trick:      { name: 'Compass Trick',       kind: 'targeted', effect: 'reveal' }
};

// charId -> attack catalog. cast_attack below looks itself up here instead
// of hardcoding a single charId, so adding a third attack-using character
// later is just one more entry.
const ATTACK_CATALOGS = { 1: WEREWOLF_ATTACK_CATALOG, 4: WANDERER_ATTACK_CATALOG };

const ATTACK_COOLDOWN_MS = 8000;
const AOE_RADIUS = 200; // world units — roughly 3-4 character-widths

// Rolling chat history per room, used only by Spy Glass's spyglass effect
// to seed the window with whatever was already said before the cast — chat
// itself is still never persisted anywhere else (see the 'chat' handler's
// note about not storing it long-term). Stores color/image too so the
// Spy Glass window can render each line identically to the room's own
// chat log, not just a stripped-down text echo.
const ROOM_CHAT_LOG_LIMIT = 50;
const roomChatLogs = new Map(); // roomId -> [{name, color, text, image, ts}]
function recordRoomChat(room, name, color, text, image) {
  if (!text && !image) return;
  const log = roomChatLogs.get(room) || [];
  log.push({ name, color, text, image, ts: Date.now() });
  if (log.length > ROOM_CHAT_LOG_LIMIT) log.shift();
  roomChatLogs.set(room, log);
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
      // Character look is a per-session cosmetic choice, not tied to the
      // account itself (unlike name/color above) — just trust whatever
      // valid index the client picked on the join screen, falling back to
      // a random one if it's missing or out of range.
      const charId = Number.isInteger(msg.charId) && msg.charId >= 0 && msg.charId < CHARACTER_COUNT
        ? msg.charId
        : Math.floor(Math.random() * CHARACTER_COUNT);
      player = {
        ws, id,
        name,
        color,
        charId,
        // Which bank account (if any) this connection is allowed to act
        // as — null for guests, who can look around the Bank but can't
        // open one (see bank/auction handlers below). Same key accounts
        // are already indexed by, so no separate identity mapping needed.
        accountKey,
        x: WORLD.spawn.x,
        y: WORLD.spawn.y,
        room: 'outside',
        inbox: [], // undestroyed notes currently held, mirrors the client's inbox array — for Rapid Swipe to steal from
        health: 100, // 0-100, shown as the heart HUD's percentage
        xp: 0, level: 1, skillPoints: 0, // overwritten by syncProgressToPlayer() below
        activeQuest: null // { questId, progress } or null
      };
      players.set(id, player);
      syncProgressToPlayer(player);
      // Loads (or creates) their inventory immediately rather than lazily
      // on first panel-open, so a returning account holder's equipped gear
      // shows up on their model from the moment they spawn, not after they
      // happen to open the inventory panel once.
      syncEquipToPlayer(player);

      send(ws, {
        type: 'init',
        id,
        world: WORLD,
        world2: WORLD2,
        players: Array.from(players.values()).map(publicPlayer)
      });
      broadcastAll({ type: 'player_joined', player: publicPlayer(player) }, ws);
      return;
    }

    if (!player) return; // ignore everything else until joined

    if (msg.type === 'move') {
      const x = Number(msg.x), y = Number(msg.y);
      // 'wilds' is its own 1000x1000 space; every other room (the open
      // town map and every building interior alike) stays clamped against
      // the town's bounds, which are large enough to never matter indoors.
      const bounds = msg.room === 'wilds' ? WORLD2
        : msg.room === 'witch_cave' ? { width: 800, height: 700 }
        : msg.room === 'bank_vault' ? VAULT_WORLD_DIMS
        : (typeof msg.room === 'string' && msg.room.startsWith('dungeon_') ? { width: DUNGEON_SIZE, height: DUNGEON_SIZE } : WORLD);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        player.x = Math.max(0, Math.min(bounds.width, x));
        player.y = Math.max(0, Math.min(bounds.height, y));
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
      // Private, point-to-point note — not durably stored (no DB, nothing
      // survives a restart), but kept in target.inbox in memory for as long
      // as it's undestroyed so Rapid Swipe has something to actually steal.
      // Delivered only if the recipient is currently connected; not queued
      // for later (no accounts means no durable identity to deliver to once
      // they leave). image is optional — only the Open 3rd Eye spell result
      // currently uses it (see spell_photo below), the normal "write a note"
      // UI is text-only.
      const toId = String(msg.to || '');
      const text = sanitizeText(msg.text);
      const image = sanitizeImage(msg.image);
      const target = players.get(toId);
      if ((!text && !image) || !target || toId === player.id) {
        send(ws, { type: 'note_error', message: 'Could not deliver that note.' });
        return;
      }
      const noteId = makeId();
      const note = { id: noteId, fromId: player.id, fromName: player.name, text, image };
      target.inbox.push(note);
      send(target.ws, { type: 'note_received', note });
      send(ws, { type: 'note_sent', toName: target.name });
      return;
    }

    if (msg.type === 'destroy_note') {
      // Recipient explicitly clicked the burn icon on a note they'd already
      // read (notes no longer auto-destruct just from opening them). Drop
      // it from their server-side inbox too, then let the original sender
      // know it's gone, if they're still around.
      const noteId = String(msg.id || '');
      const idx = player.inbox.findIndex(n => n.id === noteId);
      if (idx !== -1) player.inbox.splice(idx, 1);
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
      recordRoomChat(player.room, player.name, player.color, text, image);
      broadcastRoom(player.room, chatMsg);
      for (const watcher of players.values()) {
        if (watcher.spyGlass && watcher.spyGlass.room === player.room && watcher.spyGlass.expiresAt > Date.now()) {
          send(watcher.ws, { type: 'spyglass_chat', name: player.name, color: player.color, text, image });
        }
      }
      return;
    }

    if (msg.type === 'bank_open') {
      if (!player.accountKey) {
        send(ws, { type: 'bank_error', message: 'Log in to a Town Chat account (Account tab on the join screen) to open a bank account — guests are a fresh identity every visit, so there’d be nothing to attach a balance to.' });
        return;
      }
      send(ws, { type: 'bank_state', ...bankStatePayload(player.accountKey) });
      return;
    }

    if (msg.type === 'auction_browse') {
      send(ws, { type: 'auction_state', listings: listings.map(publicListing) });
      return;
    }

    if (msg.type === 'auction_create') {
      if (!player.accountKey) {
        send(ws, { type: 'bank_error', message: 'Log in to a Town Chat account to list items at auction.' });
        return;
      }
      const itemId = String(msg.itemId || '');
      const qty = Math.floor(Number(msg.qty));
      const startingBid = Math.floor(Number(msg.startingBid));
      const buyoutPrice = msg.buyoutPrice != null && msg.buyoutPrice !== '' ? Math.floor(Number(msg.buyoutPrice)) : null;
      const durationHours = Number(msg.durationHours);
      const validBuyout = buyoutPrice == null || (Number.isInteger(buyoutPrice) && buyoutPrice > startingBid);
      if (!ITEM_CATALOG[itemId] || !Number.isInteger(qty) || qty < 1 ||
          !Number.isInteger(startingBid) || startingBid < 1 ||
          !validBuyout || !AUCTION_DURATIONS_MS[durationHours]) {
        send(ws, { type: 'bank_error', message: 'That listing isn’t valid — check the item, quantity, starting bid, and duration.' });
        return;
      }
      const account = ensureBankAccount(player.accountKey);
      if (!removeItemFromAccount(account, itemId, qty)) {
        send(ws, { type: 'bank_error', message: 'You don’t have that many of that item to list.' });
        return;
      }
      saveBankAccounts();
      const listing = {
        id: makeId(),
        sellerKey: player.accountKey,
        sellerName: player.name,
        itemId, qty, startingBid, buyoutPrice,
        currentBid: null,
        currentBidderKey: null,
        currentBidderName: null,
        createdAt: Date.now(),
        expiresAt: Date.now() + AUCTION_DURATIONS_MS[durationHours]
      };
      listings.push(listing);
      saveListings();
      send(ws, { type: 'bank_state', ...bankStatePayload(player.accountKey) });
      broadcastAuctionState();
      return;
    }

    if (msg.type === 'auction_list_selfie') {
      // Unlike item listings, selfies don't need a bank account to sell —
      // there's no inventory slot to hold the photo, so a guest can list
      // one too. The payout for a guest seller is handled differently at
      // resolution time (see resolveListing) since they have nowhere to
      // bank gold; that's also why selfie auctions run in minutes instead
      // of hours, so a guest isn't expected to stay connected for long.
      const image = sanitizeImage(msg.image);
      const startingBid = Math.floor(Number(msg.startingBid));
      const buyoutPrice = msg.buyoutPrice != null && msg.buyoutPrice !== '' ? Math.floor(Number(msg.buyoutPrice)) : null;
      const durationMinutes = Number(msg.durationMinutes);
      const validBuyout = buyoutPrice == null || (Number.isInteger(buyoutPrice) && buyoutPrice > startingBid);
      if (!image || !Number.isInteger(startingBid) || startingBid < 1 ||
          !validBuyout || !SELFIE_AUCTION_DURATIONS_MS[durationMinutes]) {
        send(ws, { type: 'bank_error', message: 'That selfie listing isn’t valid — check the photo, starting bid, and duration.' });
        return;
      }
      const listing = {
        id: makeId(),
        sellerKey: player.accountKey || null,
        sellerId: player.id,
        sellerName: player.name,
        isSelfie: true, image,
        startingBid, buyoutPrice,
        currentBid: null,
        currentBidderKey: null,
        currentBidderName: null,
        createdAt: Date.now(),
        expiresAt: Date.now() + SELFIE_AUCTION_DURATIONS_MS[durationMinutes]
      };
      listings.push(listing);
      saveListings();
      broadcastAuctionState();
      return;
    }

    if (msg.type === 'auction_bid') {
      if (!player.accountKey) {
        send(ws, { type: 'bank_error', message: 'Log in to a Town Chat account to bid.' });
        return;
      }
      const listing = listings.find(l => l.id === msg.listingId);
      if (!listing) {
        send(ws, { type: 'bank_error', message: 'That listing is no longer available.' });
        return;
      }
      if (listing.sellerKey === player.accountKey) {
        send(ws, { type: 'bank_error', message: 'You can’t bid on your own listing.' });
        return;
      }
      const amount = Math.floor(Number(msg.amount));
      const minBid = listing.currentBid != null ? listing.currentBid + 1 : listing.startingBid;
      if (!Number.isFinite(amount) || amount < minBid) {
        send(ws, { type: 'bank_error', message: `Bid must be at least ${minBid}.` });
        return;
      }
      const bidderAccount = ensureBankAccount(player.accountKey);
      if (bidderAccount.balance < amount) {
        send(ws, { type: 'bank_error', message: 'You don’t have enough gold for that bid.' });
        return;
      }
      bidderAccount.balance -= amount;
      if (listing.currentBidderKey) {
        const prevAccount = ensureBankAccount(listing.currentBidderKey);
        prevAccount.balance += listing.currentBid;
        pushBankStateIfOnline(listing.currentBidderKey);
      }
      listing.currentBid = amount;
      listing.currentBidderKey = player.accountKey;
      listing.currentBidderName = player.name;
      saveBankAccounts();
      send(ws, { type: 'bank_state', ...bankStatePayload(player.accountKey) });

      if (listing.buyoutPrice && amount >= listing.buyoutPrice) {
        resolveListing(listing);
      } else {
        saveListings();
      }
      broadcastAuctionState();
      return;
    }

    if (msg.type === 'inventory_open') {
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      return;
    }

    if (msg.type === 'inventory_equip' || msg.type === 'inventory_unequip') {
      const inv = getInventory(player);
      const equipKind = EQUIP_SLOTS.includes(msg.equipSlot) ? msg.equipSlot : null;
      if (!equipKind) {
        send(ws, { type: 'bank_error', message: 'Invalid equip request.' });
        return;
      }
      let err;
      if (msg.type === 'inventory_equip') {
        const slotIdx = Math.floor(Number(msg.slotIdx));
        if (!Number.isInteger(slotIdx) || slotIdx < 0 || slotIdx >= inv.slots.length) {
          send(ws, { type: 'bank_error', message: 'Invalid equip request.' });
          return;
        }
        err = equipFromSlot(inv, slotIdx, equipKind);
      } else {
        err = unequipToInventory(inv, equipKind);
      }
      if (player.accountKey) saveInventories();
      if (err) {
        send(ws, { type: 'bank_error', message: err });
      } else {
        syncEquipToPlayer(player);
      }
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      return;
    }

    if (msg.type === 'harddrive_open') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'harddrive_error', message: 'You need a Hard Drive in your inventory to open it.' });
        return;
      }
      const hd = getHardDrive(player);
      const err = checkHardDrivePassword(hd, msg.password);
      if (err) { send(ws, { type: 'harddrive_error', message: err }); return; }
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      return;
    }

    if (msg.type === 'harddrive_set_password') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'harddrive_error', message: 'You need a Hard Drive in your inventory to lock it.' });
        return;
      }
      const hd = getHardDrive(player);
      const err = checkHardDrivePassword(hd, msg.currentPassword);
      if (err) { send(ws, { type: 'harddrive_error', message: err }); return; }
      const newPassword = String(msg.newPassword || '');
      if (newPassword) {
        const salt = crypto.randomBytes(16).toString('hex');
        hd.passwordSalt = salt;
        hd.passwordHash = hashPassword(newPassword, salt);
      } else {
        hd.passwordSalt = null;
        hd.passwordHash = null;
      }
      persistHardDrive(player);
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      return;
    }

    if (msg.type === 'harddrive_store') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'harddrive_error', message: 'You need a Hard Drive in your inventory to store notes.' });
        return;
      }
      const hd = getHardDrive(player);
      const err = checkHardDrivePassword(hd, msg.password);
      if (err) { send(ws, { type: 'harddrive_error', message: err }); return; }
      if (hd.notes.length >= HARDDRIVE_NOTE_CAPACITY) {
        send(ws, { type: 'harddrive_error', message: 'Your Hard Drive is full.' });
        return;
      }
      const noteId = String(msg.noteId || '');
      const idx = player.inbox.findIndex(n => n.id === noteId);
      if (idx === -1) {
        send(ws, { type: 'harddrive_error', message: 'That note is no longer in your inbox.' });
        return;
      }
      const [note] = player.inbox.splice(idx, 1);
      hd.notes.push(note);
      persistHardDrive(player);
      send(ws, { type: 'note_stolen', id: note.id }); // reuses the client's "remove from local inbox" handler
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      return;
    }

    if (msg.type === 'harddrive_retrieve') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'harddrive_error', message: 'You need a Hard Drive in your inventory to retrieve notes.' });
        return;
      }
      const hd = getHardDrive(player);
      const err = checkHardDrivePassword(hd, msg.password);
      if (err) { send(ws, { type: 'harddrive_error', message: err }); return; }
      const noteId = String(msg.noteId || '');
      const idx = hd.notes.findIndex(n => n.id === noteId);
      if (idx === -1) {
        send(ws, { type: 'harddrive_error', message: 'That note isn’t on your Hard Drive.' });
        return;
      }
      const [note] = hd.notes.splice(idx, 1);
      player.inbox.push(note);
      persistHardDrive(player);
      send(ws, { type: 'note_received', note });
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      return;
    }

    if (msg.type === 'harddrive_destroy') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'harddrive_error', message: 'You need a Hard Drive in your inventory to manage it.' });
        return;
      }
      const hd = getHardDrive(player);
      const err = checkHardDrivePassword(hd, msg.password);
      if (err) { send(ws, { type: 'harddrive_error', message: err }); return; }
      const noteId = String(msg.noteId || '');
      const idx = hd.notes.findIndex(n => n.id === noteId);
      if (idx === -1) {
        send(ws, { type: 'harddrive_error', message: 'That note isn’t on your Hard Drive.' });
        return;
      }
      const [note] = hd.notes.splice(idx, 1);
      persistHardDrive(player);
      const sender = players.get(note.fromId);
      if (sender) send(sender.ws, { type: 'note_destroyed', byName: player.name });
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      return;
    }

    if (msg.type === 'bank_deposit' || msg.type === 'bank_withdraw') {
      if (!player.accountKey) {
        send(ws, { type: 'bank_error', message: 'Log in to a Town Chat account to use the bank.' });
        return;
      }
      const bankAccount = ensureBankAccount(player.accountKey);
      const inv = getInventory(player);
      const fromPool = msg.type === 'bank_deposit' ? inv : bankAccount;
      const toPool = msg.type === 'bank_deposit' ? bankAccount : inv;
      const slotIdx = Math.floor(Number(msg.slotIdx));
      const qty = Math.floor(Number(msg.qty));
      const stack = fromPool.slots[slotIdx];
      if (!stack || !Number.isInteger(qty) || qty < 1 || qty > stack.qty) {
        send(ws, { type: 'bank_error', message: 'Invalid transfer.' });
        return;
      }
      if (!addItemToAccount(toPool, stack.itemId, qty)) {
        send(ws, { type: 'bank_error', message: msg.type === 'bank_deposit' ? 'Your bank is full.' : 'Your inventory is full.' });
        return;
      }
      removeItemFromAccount(fromPool, stack.itemId, qty);
      saveBankAccounts();
      saveInventories();
      send(ws, { type: 'bank_state', ...bankStatePayload(player.accountKey) });
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      return;
    }

    if (msg.type === 'send_money') {
      if (!player.accountKey) {
        send(ws, { type: 'bank_error', message: 'Log in to a Town Chat account to send money.' });
        return;
      }
      const target = players.get(String(msg.toId || ''));
      if (!target || target.id === player.id) {
        send(ws, { type: 'bank_error', message: 'Pick someone else to send money to.' });
        return;
      }
      if (!target.accountKey) {
        send(ws, { type: 'bank_error', message: `${target.name} doesn't have a bank account to receive money.` });
        return;
      }
      const amount = Math.floor(Number(msg.amount));
      if (!Number.isInteger(amount) || amount < 1) {
        send(ws, { type: 'bank_error', message: 'Enter a valid amount.' });
        return;
      }
      const senderAccount = ensureBankAccount(player.accountKey);
      if (senderAccount.balance < amount) {
        send(ws, { type: 'bank_error', message: 'You don’t have enough gold for that.' });
        return;
      }
      senderAccount.balance -= amount;
      const recipientAccount = ensureBankAccount(target.accountKey);
      recipientAccount.balance += amount;
      saveBankAccounts();
      send(ws, { type: 'bank_state', ...bankStatePayload(player.accountKey) });
      pushBankStateIfOnline(target.accountKey);
      send(target.ws, { type: 'money_received', fromName: player.name, amount });
      send(ws, { type: 'money_sent', toName: target.name, amount });
      return;
    }

    if (msg.type === 'quest_talk') {
      const npcId = String(msg.npcId || '');
      const questId = QUEST_BY_NPC[npcId];
      if (!questId) {
        // Not a quest-giver at all (e.g. a shop/hint NPC) — used to just
        // return here with no response, so clicking "Ask for a Quest"
        // closed the shop box and left nothing behind. npcName is a
        // client-supplied display fallback only used for this message.
        const npcName = sanitizeText(msg.npcName) || 'They';
        send(ws, { type: 'quest_offer', questId: null, npcId, npcName,
          message: `${npcName} doesn't have any work for you right now.` });
        return;
      }
      const quest = QUEST_CATALOG[questId];
      const prog = getProgress(player);
      // Busy with another quest
      if (player.activeQuest && player.activeQuest.questId !== questId) {
        const activeQ = QUEST_CATALOG[player.activeQuest.questId];
        send(ws, { type: 'quest_offer', questId: null, npcId, npcName: quest.npcName,
          message: `You're already working on "${activeQ ? activeQ.name : 'another quest'}". Finish that first.` });
        return;
      }
      // Already on this quest
      if (player.activeQuest && player.activeQuest.questId === questId) {
        send(ws, { type: 'quest_offer', questId, npcId, npcName: quest.npcName,
          questName: quest.name, progress: player.activeQuest.progress, target: quest.target,
          message: `You're on it! Progress: ${player.activeQuest.progress}/${quest.target}.` });
        return;
      }
      // On cooldown
      const lastDone = prog.questCooldowns && prog.questCooldowns[questId];
      if (lastDone && Date.now() - lastDone < QUEST_COOLDOWN_MS) {
        const hoursLeft = Math.ceil((QUEST_COOLDOWN_MS - (Date.now() - lastDone)) / 3600000);
        send(ws, { type: 'quest_offer', questId: null, npcId, npcName: quest.npcName,
          message: `You've already done that recently. Come back in about ${hoursLeft}h.` });
        return;
      }
      // Offer the quest
      send(ws, { type: 'quest_offer', questId, npcId, npcName: quest.npcName,
        questName: quest.name, description: quest.description,
        target: quest.target, xpReward: quest.xpReward });
      return;
    }

    if (msg.type === 'npc_hint_talk') {
      const npcId = String(msg.npcId || '');
      const giver = NPC_HINT_GIVERS[npcId];
      if (!giver) return;
      const aq = player.activeQuest;
      let message;
      if (!aq) {
        message = `${giver.name} shrugs. "You're not chasing anything right now — find someone with work for you, then come find me again."`;
      } else {
        const quest = QUEST_CATALOG[aq.questId];
        message = quest
          ? `${giver.name} leans in. "${getQuestHint(quest, aq.progress)}"`
          : `${giver.name} tilts their head. "Can't place what you're on about — ask whoever sent you."`;
      }
      send(ws, { type: 'npc_hint_dialogue', npcId, npcName: giver.name, message });
      return;
    }

    if (msg.type === 'quest_accept') {
      const npcId = String(msg.npcId || '');
      const questId = QUEST_BY_NPC[npcId];
      if (!questId || !QUEST_CATALOG[questId]) return;
      if (player.activeQuest) return; // already on a quest
      const prog = getProgress(player);
      const lastDone = prog.questCooldowns && prog.questCooldowns[questId];
      if (lastDone && Date.now() - lastDone < QUEST_COOLDOWN_MS) return;
      player.activeQuest = { questId, progress: 0 };
      const quest = QUEST_CATALOG[questId];
      send(ws, { type: 'quest_started', questId, questName: quest.name,
        target: quest.target, description: quest.description });
      return;
    }

    if (msg.type === 'quest_cancel') {
      player.activeQuest = null;
      send(ws, { type: 'quest_cancelled' });
      return;
    }

    if (msg.type === 'cast_spell') {
      if (player.charId !== 0) {
        send(ws, { type: 'spell_error', message: 'Only the Witch can cast spells.' });
        return;
      }
      const spellId = String(msg.spellId || '');
      const spell = SPELL_CATALOG[spellId];
      if (!spell) {
        send(ws, { type: 'spell_error', message: 'Unknown spell.' });
        return;
      }
      const now = Date.now();
      if (player.lastSpellCastAt && now - player.lastSpellCastAt < SPELL_COOLDOWN_MS) {
        send(ws, { type: 'spell_error', message: 'Your magic needs to recharge a moment.' });
        return;
      }

      let target = null;
      if (spell.kind === 'targeted') {
        target = players.get(String(msg.targetId || ''));
        if (!target || target.id === player.id) {
          send(ws, { type: 'spell_error', message: 'Pick a target first.' });
          return;
        }
      }

      player.lastSpellCastAt = now;

      if (spell.effect === 'status') {
        const recipient = spell.kind === 'self' ? player : target;
        recipient.activeStatus = { type: spell.statusType, expiresAt: now + spell.durationMs };
        send(ws, {
          type: 'spell_result', spellId,
          message: `${spell.icon} ${spell.name} cast${spell.kind === 'targeted' ? ' on ' + target.name : ''}.`
        });
        return;
      }

      if (spell.effect === 'reveal') {
        send(ws, {
          type: 'spell_result', spellId,
          message: `${spell.icon} ${target.name} is in ${describeRoom(target.room)}.`,
          revealTargetId: target.id
        });
        return;
      }

      if (spell.effect === 'camera') {
        const requestId = makeId();
        pendingSpellConsents.set(requestId, { casterId: player.id, casterName: player.name, targetId: target.id, expiresAt: now + 30000 });
        send(target.ws, { type: 'spell_consent_request', requestId, casterName: player.name, spellName: spell.name });
        send(ws, { type: 'spell_result', spellId, message: `${spell.icon} Waiting to see if ${target.name} allows it…` });
        return;
      }
      return;
    }

    if (msg.type === 'spell_consent_response') {
      // Only matters for an explicit Deny — an Allow leads straight to a
      // spell_photo (success or failure) below, with no separate ack.
      const requestId = String(msg.requestId || '');
      const pending = pendingSpellConsents.get(requestId);
      if (!pending || pending.targetId !== player.id) return;
      if (!msg.allow) {
        pendingSpellConsents.delete(requestId);
        const caster = players.get(pending.casterId);
        if (caster) {
          send(caster.ws, {
            type: 'spell_result', spellId: 'open_third_eye',
            message: `👁️ ${player.name} sensed it and resisted — the spell fizzled.`
          });
        }
      }
      return;
    }

    if (msg.type === 'spell_photo') {
      const requestId = String(msg.requestId || '');
      const pending = pendingSpellConsents.get(requestId);
      if (!pending || pending.targetId !== player.id) return;
      pendingSpellConsents.delete(requestId);
      const caster = players.get(pending.casterId);
      if (!caster) return; // caster disconnected — nothing to deliver to
      const image = sanitizeImage(msg.image);
      if (!image) {
        send(caster.ws, {
          type: 'spell_result', spellId: 'open_third_eye',
          message: `👁️ The vision through ${player.name}'s third eye came back blank — the spell fizzled.`
        });
        return;
      }
      const visionNote = {
        id: makeId(), fromId: player.id, fromName: `👁️ ${player.name}'s Third Eye`,
        text: 'A vision arrives, captured the moment the eye opened…', image
      };
      caster.inbox.push(visionNote);
      send(caster.ws, { type: 'note_received', note: visionNote });
      return;
    }

    // A universal basic melee attack, available to every character
    // regardless of class — separate from the Werewolf/Wanderer's named
    // curse-attacks (cast_attack below) or the Witch's spells, both of
    // which are debuffs/utility rather than damage. This is the thing that
    // actually drains the health heart: click any attackable target
    // (player/animal/mob) in range and it lands for a small random amount,
    // gated by a short per-player cooldown so it reads as a sword swing
    // rather than a machine-gun click.
    const STRIKE_RANGE = 70;
    const STRIKE_COOLDOWN_MS = 500;
    const STRIKE_MIN_DMG = 8, STRIKE_MAX_DMG = 14;
    if (msg.type === 'strike') {
      if (player.isDead) return;
      const now = Date.now();
      if (player.lastStrikeAt && now - player.lastStrikeAt < STRIKE_COOLDOWN_MS) return;
      const targetType = msg.targetType;
      const targetId = String(msg.targetId || '');
      const dmg = STRIKE_MIN_DMG + Math.floor(Math.random() * (STRIKE_MAX_DMG - STRIKE_MIN_DMG + 1));

      if (targetType === 'player') {
        const t = players.get(targetId);
        if (!t || t.id === player.id || t.room !== player.room || t.isDead) return;
        if (Math.hypot(t.x - player.x, t.y - player.y) > STRIKE_RANGE) return;
        player.lastStrikeAt = now;
        t.health = Math.max(0, t.health - dmg);
        if (t.health <= 0) {
          t.health = 0;
          t.isDead = true;
          send(t.ws, { type: 'you_died', byName: player.name });
          send(ws, { type: 'attack_result', message: `⚔️ You defeated ${t.name}!` });
        } else {
          send(t.ws, { type: 'struck', byName: player.name, damage: dmg });
        }
        return;
      }

      if (targetType === 'dungeon') {
        const t = dungeonMobs.find(m => m.id === targetId);
        if (!t || t.dead || t.room !== player.room) return;
        if (Math.hypot(t.x - player.x, t.y - player.y) > STRIKE_RANGE) return;
        player.lastStrikeAt = now;
        t.health = Math.max(0, t.health - dmg);
        const preset = DUNGEON_MOB_TYPES[t.mobType];
        if (t.health <= 0) {
          t.dead = true;
          t.respawnAt = now + DUNGEON_RESPAWN_MS;
          grantXP(player, preset.xp);
          advanceQuestProgress(player, 'kill_mob', null);
          const loot = rollLoot(dungeonLootTable(preset.xp), player);
          const lootStr = loot.length ? `  Loot: ${loot.join(', ')}` : '';
          send(ws, { type: 'attack_result', message: `⚔️ Killed ${preset.name} for ${dmg}! (+${preset.xp} XP)${lootStr}` });
          if (loot.length) send(ws, { type: 'loot_drop', items: loot });
        } else {
          send(ws, { type: 'attack_result', message: `⚔️ Hit ${preset.name} for ${dmg}!` });
        }
        return;
      }

      // Each pool only exists in (and is only reachable from) its own map.
      const POOLS = {
        animal: { list: animals, room: 'outside', respawnMs: ANIMAL_RESPAWN_MS },
        mob: { list: mobs, room: 'outside', respawnMs: MOB_RESPAWN_MS },
        animal2: { list: animals2, room: 'wilds', respawnMs: ANIMAL2_RESPAWN_MS },
        mob2: { list: mobs2, room: 'wilds', respawnMs: MOB2_RESPAWN_MS }
      };
      const poolInfo = POOLS[targetType];
      if (!poolInfo || player.room !== poolInfo.room) return;
      const t = poolInfo.list.find(x => x.id === targetId);
      if (!t || t.dead) return;
      if (Math.hypot(t.x - player.x, t.y - player.y) > STRIKE_RANGE) return;
      player.lastStrikeAt = now;
      t.health = Math.max(0, t.health - dmg);
      if (t.health <= 0) {
        t.dead = true;
        t.respawnAt = now + poolInfo.respawnMs;
        if (targetType === 'mob2') {
          grantXP(player, 15);
          advanceQuestProgress(player, 'kill_mob', null);
          const lootTable = LOOT_TABLES[t.mobType] || LOOT_TABLES.shade_stalker;
          const loot = rollLoot(lootTable, player);
          const lootStr = loot.length ? `  Loot: ${loot.join(', ')}` : '';
          send(ws, { type: 'attack_result', message: `⚔️ Killed for ${dmg}! (+15 XP)${lootStr}` });
          if (loot.length) send(ws, { type: 'loot_drop', items: loot });
        } else if (targetType === 'mob') {
          const loot = rollLoot(LOOT_TABLES.town_mob, player);
          const lootStr = loot.length ? `  Loot: ${loot.join(', ')}` : '';
          send(ws, { type: 'attack_result', message: `⚔️ Killed for ${dmg}!${lootStr}` });
          if (loot.length) send(ws, { type: 'loot_drop', items: loot });
        } else {
          send(ws, { type: 'attack_result', message: `⚔️ Killed for ${dmg}!` });
        }
      } else {
        send(ws, { type: 'attack_result', message: `⚔️ Hit for ${dmg}!` });
      }
      return;
    }

    if (msg.type === 'harvest') {
      if (player.room !== 'outside' && player.room !== 'wilds') return;
      const decorId = String(msg.decorId || '');
      const found = findDecorById(decorId);
      if (!found || found.room !== player.room) return;
      const decor = found.decor;
      if (!HARVEST_TYPES.has(decor.type)) return;
      if (Math.hypot(decor.x - player.x, decor.y - player.y) > HARVEST_RANGE) {
        send(ws, { type: 'harvest_error', message: 'Get closer to harvest that.' });
        return;
      }
      const lastAt = decorHarvestedAt[decorId];
      if (lastAt && Date.now() - lastAt < HARVEST_COOLDOWN_MS) {
        send(ws, { type: 'harvest_error', message: 'Already harvested — it needs time to grow back.' });
        return;
      }
      const itemId = HARVEST_ITEM_BY_TYPE[decor.type];
      const inv = getInventory(player);
      if (!addItemToAccount(inv, itemId, 1)) {
        send(ws, { type: 'harvest_error', message: 'Your inventory is full.' });
        return;
      }
      if (player.accountKey) saveInventories();
      decorHarvestedAt[decorId] = Date.now();
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'harvest_result', message: `Harvested ${ITEM_CATALOG[itemId].icon} ${ITEM_CATALOG[itemId].name}.` });
      broadcastAll({ type: 'decor_state', decor: decorPublicState() });
      // XP for Wilds plants only (not town trees/shrubs/flowers)
      if (found.room === 'wilds') {
        grantXP(player, 5);
        advanceQuestProgress(player, 'harvest_plant', itemId);
      }
      return;
    }

    if (msg.type === 'use_item') {
      const inv = getInventory(player);
      const slotIdx = Math.floor(Number(msg.slotIdx));
      const stack = inv.slots[slotIdx];
      const plant = stack && PLANT_CATALOG[stack.itemId];
      if (!stack || !plant) {
        send(ws, { type: 'use_error', message: 'That item can’t be used.' });
        return;
      }
      removeItemFromAccount(inv, stack.itemId, 1);
      if (player.accountKey) saveInventories();
      const now = Date.now();
      if (plant.effect === 'status') {
        player.activeStatus = { type: plant.statusType, expiresAt: now + plant.durationMs };
      } else if (plant.effect === 'heal') {
        player.health = Math.min(100, player.health + plant.amount);
      } else if (plant.effect === 'cleanse') {
        player.activeStatus = null;
      }
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'use_result', message: `${plant.icon} Used ${plant.name}.` });
      return;
    }

    if (msg.type === 'cast_attack') {
      const catalog = ATTACK_CATALOGS[player.charId];
      if (!catalog) {
        send(ws, { type: 'attack_error', message: 'This character has no attacks.' });
        return;
      }
      const attackId = String(msg.attackId || '');
      const attack = catalog[attackId];
      if (!attack) {
        send(ws, { type: 'attack_error', message: 'Unknown attack.' });
        return;
      }
      const now = Date.now();
      if (player.lastAttackCastAt && now - player.lastAttackCastAt < ATTACK_COOLDOWN_MS) {
        send(ws, { type: 'attack_error', message: 'Still recovering — wait a moment.' });
        return;
      }
      player.lastAttackCastAt = now;

      // Resolve the set of players this attack affects.
      let targets = [];
      if (attack.kind === 'aoe') {
        targets = [...players.values()].filter(p =>
          p.id !== player.id && Math.hypot(p.x - player.x, p.y - player.y) < AOE_RADIUS
        );
      } else if (attack.kind === 'self') {
        targets = [player];
      } else if (attack.kind === 'building') {
        // Resolved directly from msg.buildingId in the 'spyglass' effect
        // below — not a player target, so nothing to gather here.
      } else {
        const t = players.get(String(msg.targetId || ''));
        if (!t || t.id === player.id) {
          send(ws, { type: 'attack_error', message: 'Pick a target first.' });
          return;
        }
        targets = [t];
      }

      if (attack.effect === 'status') {
        for (const t of targets) {
          t.activeStatus = { type: attack.statusType, expiresAt: now + attack.durationMs };
          if (t.id !== player.id) {
            send(t.ws, { type: 'attack_hit', attackName: attack.name, casterName: player.name });
          }
        }
        const scope = attack.kind === 'aoe'
          ? (targets.length ? `hit ${targets.length} player${targets.length === 1 ? '' : 's'}` : 'no one in range')
          : attack.kind === 'self' ? 'yourself' : targets[0].name;
        send(ws, { type: 'attack_result', message: `⚔️ ${attack.name} — ${scope}.` });
        return;
      }

      if (attack.effect === 'reveal') {
        const t = targets[0];
        send(ws, {
          type: 'attack_result', message: `🎯 ${t.name} is in ${describeRoom(t.room)}.`,
          revealTargetId: t.id
        });
        return;
      }

      // The target must explicitly join the howl before anything is
      // requested from their device — see howl_consent_response and
      // howl_location_result below. Only a coarse place name (never raw
      // coordinates) goes back, and only to this caster; it's never stored
      // or shown to anyone else.
      if (attack.effect === 'howl_location') {
        const t = targets[0];
        const consentId = makeId();
        pendingHowlConsents.set(consentId, { casterId: player.id, casterName: player.name, targetId: t.id, expiresAt: now + 30000 });
        send(t.ws, { type: 'howl_consent_request', consentId, casterName: player.name });
        send(ws, { type: 'attack_result', message: `🐺 ${attack.name} — you howl at the moon, waiting to see if ${t.name} answers…` });
        return;
      }

      if (attack.effect === 'pickpocket') {
        const t = targets[0];
        const targetInv = getInventory(t);
        // A password-locked Hard Drive is invisible to a pickpocket peek
        // entirely — not just protected from the steal roll, hidden from
        // itemsSeen too, so a locked vault can't even be confirmed to exist.
        const targetHdLocked = !!getHardDrive(t).passwordHash;
        const peekedSlots = targetInv.slots
          .map((s, idx) => s ? { idx, itemId: s.itemId, qty: s.qty } : null)
          .filter(s => s && !(targetHdLocked && s.itemId === 'hard_drive'));
        const itemsSeen = peekedSlots.map(s => ({
          itemId: s.itemId, qty: s.qty, name: ITEM_CATALOG[s.itemId].name, icon: ITEM_CATALOG[s.itemId].icon
        }));

        let stolen = null;
        if (peekedSlots.length > 0 && Math.random() < attack.stealChance) {
          const pick = peekedSlots[Math.floor(Math.random() * peekedSlots.length)];
          const callerInv = getInventory(player);
          if (addItemToAccount(callerInv, pick.itemId, 1)) {
            removeItemFromAccount(targetInv, pick.itemId, 1);
            stolen = { itemId: pick.itemId, name: ITEM_CATALOG[pick.itemId].name, icon: ITEM_CATALOG[pick.itemId].icon };
            if (player.accountKey) saveInventories();
            if (t.accountKey) saveInventories();
            send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
          }
        }

        // Only a failed attempt tips the target off — a successful swipe is
        // silent on their end, they just find the item gone later. The
        // caster, on the other hand, always learns the outcome either way.
        if (!stolen) {
          send(t.ws, {
            type: 'attack_hit', attackName: attack.name, casterName: player.name, effect: attack.effect,
            detail: `${player.name} rifled through your pockets but came up empty — you caught them!`
          });
        }

        send(ws, {
          type: 'attack_result',
          message: stolen
            ? `🤏 ${attack.name} — you swiped ${stolen.icon} ${stolen.name} from ${t.name}!`
            : `🤏 ${attack.name} — ${t.name} caught you trying to pick their pocket!`,
          pickpocketTargetId: t.id,
          pickpocketTargetName: t.name,
          itemsSeen,
          stolenItemId: stolen ? stolen.itemId : null
        });
        return;
      }

      if (attack.effect === 'note_steal') {
        const t = targets[0];
        if (t.inbox.length === 0) {
          send(ws, { type: 'attack_result', message: `🐾 ${attack.name} — ${t.name} has no notes to take.` });
          return;
        }
        const stolen = t.inbox.shift();
        send(t.ws, { type: 'note_stolen', id: stolen.id });
        send(t.ws, {
          type: 'attack_hit', attackName: attack.name, casterName: player.name,
          detail: `${player.name} swiped a note out of your inbox before you could destroy it.`
        });
        const deliveredNote = { id: makeId(), fromId: stolen.fromId, fromName: stolen.fromName, text: stolen.text, image: stolen.image };
        player.inbox.push(deliveredNote);
        send(ws, { type: 'note_received', note: deliveredNote });
        send(ws, { type: 'attack_result', message: `🐾 ${attack.name} — swiped a note from ${t.name}.` });
        return;
      }

      if (attack.effect === 'spyglass') {
        const buildingId = String(msg.buildingId || '');
        if (!ROOM_IDS.has(buildingId) || buildingId === 'outside') {
          send(ws, { type: 'attack_error', message: 'Pick a building to spy on first.' });
          return;
        }
        const endAt = now + attack.durationMs;
        player.spyGlass = { room: buildingId, expiresAt: endAt };
        const playerId = player.id;

        // Everyone actually in the room gets told right away — chat in
        // there is normally only visible to people physically present, so
        // remotely watching it has to announce itself the same way every
        // other attack notifies whoever it affects.
        for (const occupant of players.values()) {
          if (occupant.room === buildingId) {
            send(occupant.ws, {
              type: 'spyglass_notice', casterName: player.name, buildingName: describeRoom(buildingId)
            });
          }
        }

        send(ws, {
          type: 'spyglass_start',
          buildingName: describeRoom(buildingId),
          durationMs: attack.durationMs,
          log: roomChatLogs.get(buildingId) || []
        });
        setTimeout(() => {
          const p = players.get(playerId);
          if (p && p.spyGlass && p.spyGlass.expiresAt <= Date.now()) {
            delete p.spyGlass;
            send(p.ws, { type: 'spyglass_end' });
          }
        }, attack.durationMs);
        send(ws, { type: 'attack_result', message: `🔭 ${attack.name} — watching ${describeRoom(buildingId)} for ${Math.round(attack.durationMs / 1000)}s.` });
        return;
      }
      return;
    }

    if (msg.type === 'howl_consent_response') {
      // Only matters for an explicit Decline — joining the howl leads
      // straight to a howl_location_result (success or failure) below,
      // with no separate ack needed here.
      const consentId = String(msg.consentId || '');
      const pending = pendingHowlConsents.get(consentId);
      if (!pending || pending.targetId !== player.id) return;
      if (!msg.allow) {
        pendingHowlConsents.delete(consentId);
        const caster = players.get(pending.casterId);
        if (caster) {
          send(caster.ws, {
            type: 'attack_result',
            message: `🐺 Scent Trail — ${player.name} stayed silent. The howl fades unanswered.`
          });
        }
      }
      return;
    }

    if (msg.type === 'howl_location_result') {
      const consentId = String(msg.consentId || '');
      const pending = pendingHowlConsents.get(consentId);
      if (!pending || pending.targetId !== player.id) return;
      pendingHowlConsents.delete(consentId);
      const caster = players.get(pending.casterId);
      if (!caster) return; // caster disconnected — nothing to deliver to
      // msg.lat/lon are null when the target declined or their device
      // couldn't get a location — Number(null) is 0, not NaN, so that has
      // to be checked before the Number() conversion below or a failed
      // capture would silently resolve to real coordinates (0,0).
      if (msg.lat == null || msg.lon == null) {
        send(caster.ws, { type: 'attack_result', message: `🐺 Scent Trail — the trail went cold before it led anywhere.` });
        return;
      }
      const lat = Number(msg.lat), lon = Number(msg.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        send(caster.ws, { type: 'attack_result', message: `🐺 Scent Trail — the trail went cold before it led anywhere.` });
        return;
      }
      // Defense in depth: re-round server-side too, regardless of what
      // precision the client already sent — a coarse label is the only
      // thing that's ever allowed to reach the caster.
      const roundedLat = Math.round(lat * 100) / 100;
      const roundedLon = Math.round(lon * 100) / 100;
      const targetName = player.name;
      const casterId = pending.casterId;
      reverseGeocodeCoarse(roundedLat, roundedLon).then(place => {
        const c = players.get(casterId); // re-fetch: lookup is async, caster may have left
        if (!c) return;
        send(c.ws, {
          type: 'attack_result',
          message: place
            ? `🐺 Scent Trail — ${targetName}'s trail leads toward ${place}.`
            : `🐺 Scent Trail — you caught ${targetName}'s scent, but couldn't place where it leads.`
        });
      });
      return;
    }

    if (msg.type === 'use_dungeon_token') {
      if (player.room && player.room.startsWith('dungeon_')) return;
      if (player.isDead) return;
      const prog = getProgress(player);
      const tier = dungeonTierForLevel(prog.level);
      const room = DUNGEON_ROOMS[tier];
      const spawnWithJitter = () => ({
        x: DUNGEON_SPAWN.x + (Math.random() - 0.5) * 60,
        y: DUNGEON_SPAWN.y + (Math.random() - 0.5) * 60
      });
      const partyId = playerParty.get(player.id);
      const partyMembers = [];
      if (partyId) {
        const party = parties.get(partyId);
        if (party) {
          for (const memberId of party.members) {
            if (memberId === player.id) continue;
            const member = players.get(memberId);
            if (member && member.room === player.room && !member.isDead) partyMembers.push(member);
          }
        }
      }
      player.dungeonReturnRoom = player.room || 'outside';
      const sp = spawnWithJitter();
      player.x = sp.x; player.y = sp.y; player.room = room;
      send(ws, { type: 'dungeon_entered', tier, room, spawn: { x: sp.x, y: sp.y }, level: prog.level });
      for (const member of partyMembers) {
        member.dungeonReturnRoom = member.room || 'outside';
        const msp = spawnWithJitter();
        member.x = msp.x; member.y = msp.y; member.room = room;
        send(member.ws, { type: 'dungeon_entered', tier, room, spawn: { x: msp.x, y: msp.y }, level: prog.level });
      }
      return;
    }

    if (msg.type === 'dungeon_exit') {
      if (!player.room || !player.room.startsWith('dungeon_')) return;
      const returnRoom = player.dungeonReturnRoom || 'outside';
      const returnPos = returnRoom === 'wilds' ? WORLD2.spawn : WORLD.spawn;
      player.x = returnPos.x;
      player.y = returnPos.y;
      player.room = returnRoom;
      player.dungeonReturnRoom = null;
      send(ws, { type: 'dungeon_exited', room: returnRoom, x: returnPos.x, y: returnPos.y });
      return;
    }

    if (msg.type === 'respawn') {
      if (!player.isDead) return;
      player.isDead = false;
      player.health = 100;
      if (player.room && player.room.startsWith('dungeon_')) {
        const returnRoom = player.dungeonReturnRoom || 'outside';
        const returnPos = returnRoom === 'wilds' ? WORLD2.spawn : WORLD.spawn;
        player.x = returnPos.x; player.y = returnPos.y;
        player.room = returnRoom;
        player.dungeonReturnRoom = null;
        send(ws, { type: 'you_respawned', room: returnRoom, x: returnPos.x, y: returnPos.y });
      } else if (player.room === 'wilds') {
        player.x = WORLD2.spawn.x; player.y = WORLD2.spawn.y;
        send(ws, { type: 'you_respawned', room: 'wilds', x: player.x, y: player.y });
      } else {
        player.x = WORLD.spawn.x; player.y = WORLD.spawn.y;
        send(ws, { type: 'you_respawned', room: 'outside', x: player.x, y: player.y });
      }
      return;
    }

    if (msg.type === 'npc_shop_open') {
      const npcId = String(msg.npcId || '');
      const shop = NPC_SHOPS[npcId];
      if (!shop) return;
      send(ws, { type: 'npc_shop_state', npcId, npcName: shop.name, items: shop.items.map(s => ({
        id: s.id, price: s.price,
        name: ITEM_CATALOG[s.id]?.name || s.id,
        icon: ITEM_CATALOG[s.id]?.icon || '?'
      })) });
      return;
    }

    if (msg.type === 'npc_buy_item') {
      if (!player.accountKey) { send(ws, { type: 'shop_error', message: 'Log in to buy items.' }); return; }
      const npcId = String(msg.npcId || '');
      const itemId = String(msg.itemId || '');
      const shop = NPC_SHOPS[npcId];
      if (!shop) return;
      const shopItem = shop.items.find(s => s.id === itemId);
      if (!shopItem) { send(ws, { type: 'shop_error', message: "That item isn't sold here." }); return; }
      const account = ensureBankAccount(player.accountKey);
      if (account.balance < shopItem.price) {
        send(ws, { type: 'shop_error', message: `Need ${shopItem.price} gold, you have ${account.balance}.` });
        return;
      }
      const inv = getInventory(player);
      if (!addItemToAccount(inv, itemId, 1)) { send(ws, { type: 'shop_error', message: 'Inventory full.' }); return; }
      account.balance -= shopItem.price;
      saveBankAccounts();
      if (player.accountKey) saveInventories();
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'shop_bought', itemId, itemName: ITEM_CATALOG[itemId]?.name, price: shopItem.price });
      return;
    }

    if (msg.type === 'party_invite') {
      const target = players.get(String(msg.targetId || ''));
      if (!target || target.id === player.id) return;
      const partyId = getOrCreateParty(player.id);
      if (parties.get(partyId).leaderId !== player.id) {
        send(ws, { type: 'party_error', message: 'Only the leader can invite.' }); return;
      }
      partyInvites.set(target.id, { fromId: player.id, fromName: player.name, partyId, expiresAt: Date.now() + 30000 });
      send(target.ws, { type: 'party_invite_received', fromName: player.name, fromId: player.id });
      broadcastPartyUpdate(partyId);
      return;
    }

    if (msg.type === 'party_invite_accept') {
      const invite = partyInvites.get(player.id);
      if (!invite || Date.now() > invite.expiresAt) { send(ws, { type: 'party_error', message: 'Invite expired.' }); return; }
      partyInvites.delete(player.id);
      leaveParty(player);
      playerParty.set(player.id, invite.partyId);
      parties.get(invite.partyId).members.add(player.id);
      broadcastPartyUpdate(invite.partyId);
      return;
    }

    if (msg.type === 'party_invite_decline') {
      const invite = partyInvites.get(player.id);
      if (invite) {
        partyInvites.delete(player.id);
        const fromP = players.get(invite.fromId);
        if (fromP) send(fromP.ws, { type: 'party_info', message: `${player.name} declined.` });
      }
      return;
    }

    if (msg.type === 'party_leave') {
      leaveParty(player);
      send(ws, { type: 'party_disbanded' });
      return;
    }

    if (msg.type === 'party_chat') {
      const text = String(msg.text || '').trim().slice(0, 200);
      if (!text) return;
      const partyId = playerParty.get(player.id);
      if (!partyId) return;
      const party = parties.get(partyId);
      if (!party) return;
      for (const memberId of party.members) {
        const m = players.get(memberId);
        if (m) send(m.ws, { type: 'party_msg', fromName: player.name, fromId: player.id, text });
      }
      return;
    }

    if (msg.type === 'enter_witch_cave') {
      if (player.room !== 'wilds' || player.isDead) return;
      const dist = Math.hypot(player.x - WITCH_CAVE_ENTRANCE.x, player.y - WITCH_CAVE_ENTRANCE.y);
      if (dist > 140) return;
      player.witchCaveReturnX = player.x;
      player.witchCaveReturnY = player.y;
      player.room = 'witch_cave';
      player.x = WITCH_CAVE_SPAWN.x;
      player.y = WITCH_CAVE_SPAWN.y;
      send(ws, { type: 'witch_cave_entered', spawn: WITCH_CAVE_SPAWN });
      return;
    }

    if (msg.type === 'exit_witch_cave') {
      if (player.room !== 'witch_cave') return;
      const retX = player.witchCaveReturnX || WITCH_CAVE_ENTRANCE.x;
      const retY = player.witchCaveReturnY || WITCH_CAVE_ENTRANCE.y + 50;
      player.room = 'wilds';
      player.x = retX;
      player.y = retY;
      player.witchCaveReturnX = null;
      player.witchCaveReturnY = null;
      send(ws, { type: 'witch_cave_exited', x: retX, y: retY });
      return;
    }

    if (msg.type === 'enter_vault') {
      if (player.room !== 'bank' || player.isDead) return;
      player.vaultReturnX = player.x;
      player.vaultReturnY = player.y;
      player.room = 'bank_vault';
      player.x = VAULT_SPAWN.x;
      player.y = VAULT_SPAWN.y;
      send(ws, { type: 'vault_entered', spawn: VAULT_SPAWN });
      return;
    }

    if (msg.type === 'exit_vault') {
      if (player.room !== 'bank_vault') return;
      const b = WORLD.buildings.find(bb => bb.id === 'bank');
      const retX = player.vaultReturnX || (b ? b.x + b.w / 2 : player.x);
      const retY = player.vaultReturnY || (b ? b.y + b.h / 2 : player.y);
      player.room = 'bank';
      player.x = retX;
      player.y = retY;
      player.vaultReturnX = null;
      player.vaultReturnY = null;
      send(ws, { type: 'vault_exited', x: retX, y: retY });
      return;
    }

    if (msg.type === 'witch_craft') {
      if (player.room !== 'witch_cave') return;
      const recipeId = String(msg.recipeId || '');
      const recipe = POTION_RECIPES.find(r => r.id === recipeId);
      if (!recipe) { send(ws, { type: 'witch_craft_error', message: 'Unknown recipe.' }); return; }
      const inv = getInventory(player);
      for (const ing of recipe.ingredients) {
        if (countItemQty(inv, ing.id) < ing.qty) {
          const item = ITEM_CATALOG[ing.id] || PLANT_CATALOG[ing.id];
          send(ws, { type: 'witch_craft_error', message: `You need ${ing.qty}× ${item?.name || ing.id}.` });
          return;
        }
      }
      for (const ing of recipe.ingredients) removeItemFromAccount(inv, ing.id, ing.qty);
      const resultItem = ITEM_CATALOG[recipe.result] || PLANT_CATALOG[recipe.result];
      if (!addItemToAccount(inv, recipe.result, 1)) {
        // Undo removals if inventory is full (re-add ingredients)
        for (const ing of recipe.ingredients) addItemToAccount(inv, ing.id, ing.qty);
        send(ws, { type: 'witch_craft_error', message: 'Your inventory is full.' }); return;
      }
      if (player.accountKey) saveInventories();
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'witch_craft_result',
        resultIcon: resultItem?.icon || '🧪',
        resultName: resultItem?.name || recipe.result,
        message: `🧪 Hazel brews your herbs into ${resultItem?.name || recipe.result}!`
      });
      return;
    }

    if (msg.type === 'witch_talk') {
      if (player.room !== 'witch_cave') return;
      const prog = getProgress(player);
      const tier = witchShopTierForLevel(prog.level);
      const tierItems = WITCH_SHOP_TIERS[tier];
      send(ws, { type: 'witch_dialogue',
        greeting: "Ah... another wandering soul finds my cave. 🕯️ I trade in something more valuable than gold — a glimpse of you, captured in the moment. Each selfie you give me goes on the auction block for 25 gold. Agree to my terms, and you may browse my wares.",
        shopItems: tierItems.map(s => ({
          id: s.id,
          name: ITEM_CATALOG[s.id]?.name || s.id,
          icon: ITEM_CATALOG[s.id]?.icon || '?'
        })),
        level: prog.level, tier
      });
      return;
    }

    if (msg.type === 'witch_buy_item') {
      if (player.room !== 'witch_cave') return;
      const itemId = String(msg.itemId || '');
      const prog = getProgress(player);
      const tierItems = WITCH_SHOP_TIERS[witchShopTierForLevel(prog.level)];
      if (!tierItems.find(s => s.id === itemId) || !ITEM_CATALOG[itemId]) {
        send(ws, { type: 'witch_shop_error', message: 'That item is not in my collection for your level.' });
        return;
      }
      const consentId = makeId();
      player.pendingWitchPurchase = { consentId, itemId };
      // The client MUST show an explicit consent prompt before capturing any camera.
      send(ws, { type: 'witch_selfie_request', consentId,
        itemName: ITEM_CATALOG[itemId]?.name,
        itemIcon: ITEM_CATALOG[itemId]?.icon
      });
      return;
    }

    if (msg.type === 'witch_selfie_payment') {
      if (player.room !== 'witch_cave') return;
      const pending = player.pendingWitchPurchase;
      if (!pending || pending.consentId !== String(msg.consentId || '')) {
        send(ws, { type: 'witch_shop_error', message: 'No pending purchase.' });
        return;
      }
      player.pendingWitchPurchase = null;
      if (!msg.image) {
        send(ws, { type: 'witch_shop_error', message: 'No selfie captured — purchase cancelled.' });
        return;
      }
      const image = sanitizeImage(msg.image);
      if (!image) { send(ws, { type: 'witch_shop_error', message: 'Invalid image.' }); return; }
      const { itemId } = pending;
      // Async: verify the selfie contains a real human face before completing the sale.
      detectHumanFace(image).then(isHuman => {
        if (!isHuman) {
          const denial = WITCH_DENIAL_LINES[Math.floor(Math.random() * WITCH_DENIAL_LINES.length)];
          send(ws, { type: 'witch_dialogue', greeting: denial, shopItems: [] });
          return;
        }
        const inv = getInventory(player);
        if (!addItemToAccount(inv, itemId, 1)) {
          send(ws, { type: 'witch_shop_error', message: 'Inventory full.' }); return;
        }
        if (player.accountKey) saveInventories();
        listings.push({
          id: makeId(),
          sellerKey: null, sellerId: 'witch', sellerName: 'Witch Hazel',
          isSelfie: true, image,
          startingBid: 25, buyoutPrice: null,
          currentBid: null, currentBidderKey: null, currentBidderName: null,
          createdAt: Date.now(), expiresAt: Date.now() + 10 * 60000
        });
        saveListings();
        broadcastAuctionState();
        send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
        send(ws, { type: 'witch_purchase_complete',
          itemId, itemName: ITEM_CATALOG[itemId]?.name, itemIcon: ITEM_CATALOG[itemId]?.icon
        });
      }).catch(() => {
        // API failure — fail open so a network blip doesn't block every purchase.
        const inv = getInventory(player);
        if (!addItemToAccount(inv, itemId, 1)) {
          send(ws, { type: 'witch_shop_error', message: 'Inventory full.' }); return;
        }
        if (player.accountKey) saveInventories();
        listings.push({
          id: makeId(),
          sellerKey: null, sellerId: 'witch', sellerName: 'Witch Hazel',
          isSelfie: true, image,
          startingBid: 25, buyoutPrice: null,
          currentBid: null, currentBidderKey: null, currentBidderName: null,
          createdAt: Date.now(), expiresAt: Date.now() + 10 * 60000
        });
        saveListings();
        broadcastAuctionState();
        send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
        send(ws, { type: 'witch_purchase_complete',
          itemId, itemName: ITEM_CATALOG[itemId]?.name, itemIcon: ITEM_CATALOG[itemId]?.icon
        });
      });
      return;
    }

    if (msg.type === 'wolf_pact') {
      const now = Date.now();
      const PACT_COOLDOWN = 24 * 60 * 60 * 1000;
      if (player.wolfPactLastAt && now - player.wolfPactLastAt < PACT_COOLDOWN) {
        const hoursLeft = Math.ceil((player.wolfPactLastAt + PACT_COOLDOWN - now) / 3600000);
        send(ws, { type: 'wolf_pact_result', ok: false,
          message: `Lexton's amber eyes glow. "The pact must rest, wanderer. Return in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}."` });
        return;
      }
      const inv = getInventory(player);
      if (!addItemToAccount(inv, 'wolf_pact_brew', 1)) {
        send(ws, { type: 'wolf_pact_result', ok: false, message: 'Your inventory is full — make room first.' });
        return;
      }
      player.wolfPactLastAt = now;
      if (player.accountKey) saveInventories();
      send(ws, { type: 'wolf_pact_result', ok: true,
        message: '🐺 Lexton presses the vial into your hand. "The pact is sealed. Use it when the moon is right — your power doubles for an hour."' });
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      return;
    }

    // Lexton's second offer — distinct from wolf_pact above. That one is a
    // free daily ritual that explicitly touches no real data; this one is
    // real: it trades an item for the player's own recorded howl, which
    // then goes on the Auction House. See werewolf_voice_request/
    // werewolf_voice_payment below for the consent-first capture flow.
    if (msg.type === 'werewolf_talk') {
      // Used to just return here with nothing sent at all if this ever
      // didn't hold — silent failures are exactly what made the voice
      // trade's actual break hard to diagnose, so every gate in this trio
      // of handlers now always sends something back.
      if (player.room !== 'wilds') {
        send(ws, { type: 'werewolf_shop_error', message: 'Lexton is only found in the Wilds.' });
        return;
      }
      send(ws, { type: 'werewolf_dialogue',
        greeting: "Lexton throws back his head and howls at the moon. \"Join me, wanderer — howl with me, and I'll teach you something worth having. Your howl will be recorded and listed on the Auction House for any wandering ear to hear. That's the whole of the price.\"",
        shopItems: WEREWOLF_HOWL_ITEMS.map(s => ({
          id: s.id,
          name: ITEM_CATALOG[s.id]?.name || s.id,
          icon: ITEM_CATALOG[s.id]?.icon || '?'
        }))
      });
      return;
    }

    if (msg.type === 'werewolf_buy_item') {
      if (player.room !== 'wilds') {
        send(ws, { type: 'werewolf_shop_error', message: 'Lexton is only found in the Wilds.' });
        return;
      }
      const itemId = String(msg.itemId || '');
      if (!WEREWOLF_HOWL_ITEMS.find(s => s.id === itemId) || !ITEM_CATALOG[itemId]) {
        send(ws, { type: 'werewolf_shop_error', message: "That's not one of the things I can teach you." });
        return;
      }
      const consentId = makeId();
      player.pendingHowlVoicePurchase = { consentId, itemId };
      // The client MUST show an explicit consent prompt before capturing any microphone audio.
      send(ws, { type: 'werewolf_voice_request', consentId,
        itemName: ITEM_CATALOG[itemId]?.name,
        itemIcon: ITEM_CATALOG[itemId]?.icon
      });
      return;
    }

    if (msg.type === 'werewolf_voice_payment') {
      if (player.room !== 'wilds') {
        send(ws, { type: 'werewolf_shop_error', message: 'Lexton is only found in the Wilds.' });
        return;
      }
      const pending = player.pendingHowlVoicePurchase;
      if (!pending || pending.consentId !== String(msg.consentId || '')) {
        send(ws, { type: 'werewolf_shop_error', message: 'No pending trade.' });
        return;
      }
      player.pendingHowlVoicePurchase = null;
      if (!msg.audio) {
        send(ws, { type: 'werewolf_shop_error', message: 'No howl recorded — the trade is off.' });
        return;
      }
      const audio = sanitizeAudio(msg.audio);
      if (!audio) { send(ws, { type: 'werewolf_shop_error', message: 'Invalid recording.' }); return; }
      const { itemId } = pending;
      const inv = getInventory(player);
      if (!addItemToAccount(inv, itemId, 1)) {
        send(ws, { type: 'werewolf_shop_error', message: 'Inventory full.' }); return;
      }
      if (player.accountKey) saveInventories();
      // sellerName is Lexton, not the player — same anonymization the
      // Witch's selfie listings already use, so a voice clip on the
      // Auction House is never tied back to whichever player it came from.
      listings.push({
        id: makeId(),
        sellerKey: null, sellerId: 'lexton', sellerName: 'Lexton Greyfur',
        isVoice: true, audio,
        startingBid: 25, buyoutPrice: null,
        currentBid: null, currentBidderKey: null, currentBidderName: null,
        createdAt: Date.now(), expiresAt: Date.now() + 10 * 60000
      });
      saveListings();
      broadcastAuctionState();
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'werewolf_purchase_complete',
        itemId, itemName: ITEM_CATALOG[itemId]?.name, itemIcon: ITEM_CATALOG[itemId]?.icon
      });
      return;
    }
  });

  ws.on('close', () => {
    if (player) {
      leaveParty(player);
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
