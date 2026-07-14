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
const http = require('http');
// Persistent data directory for the flat-JSON stores. Defaults to the app
// folder (unchanged for local/PC runs). On a host, point this at a mounted
// volume (e.g. DATA_DIR=/data) so accounts, bank, progress, etc. survive a
// redeploy — otherwise an ephemeral filesystem loses them. Created if missing.
const DATA_DIR = process.env.DATA_DIR || __dirname;
try { require('fs').mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

// Durable storage (Session L) — extracted to lib/persistence.js (Tier 3.4 Phase B).
const persistence = require('./lib/persistence')({ dataDir: DATA_DIR });
const { persistLoad, persistSave, persistSetKey, persistRegister, persistExportBackups, getSqliteDb } = persistence;

const PERSIST_EXPORT_MS = Math.max(60 * 1000, parseInt(process.env.PERSIST_EXPORT_MS, 10) || 15 * 60 * 1000);
const _persistExportTimer = setInterval(persistExportBackups, PERSIST_EXPORT_MS);
if (_persistExportTimer.unref) _persistExportTimer.unref();
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try { persistExportBackups(); } catch (e) {}
    process.exit(0);
  });
}

const https = require('https');
const express = require('express');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const Stripe = require('stripe');

const PORT = process.env.PORT || 3000;
// Set TOWN_PASSWORD as an environment variable on your host to gate the town.
// Leave unset for no password (anyone with the link can join).
const TOWN_PASSWORD = process.env.TOWN_PASSWORD || '';

// Optional real-money paywall — the Town Pass. Two of the six buildings
// (the Phantom Parlor and the Starlight Arcade — the leisure venues; the Cafe,
// Library, Town Hall and Bank stay free so chat, quests and the economy
// are never paywalled) are locked up, and one Stripe Checkout purchase
// unlocks BOTH for TOWN_PASS_HOURS (default 24h — a day pass). Leave
// STRIPE_SECRET_KEY unset on a host and the locked buildings simply
// stay locked with a "passes aren't on sale right now" message; nothing
// else changes.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const TOWN_PASS_PRICE_CENTS = parseInt(process.env.TOWN_PASS_PRICE_CENTS, 10) || 99;
const TOWN_PASS_HOURS = parseFloat(process.env.TOWN_PASS_HOURS) || 24;
// The Resident Pass (Session L) — the same venues-only pass in the genre's
// best-liked shape (Genshin's Welkin, HSR's Express Pass): 30 days for
// $4.99. Nothing new is gated — it's purely the better-value way to buy the
// same two doors. Store product id: town_pass_30d (both consoles).
const TOWN_PASS30_PRICE_CENTS = parseInt(process.env.TOWN_PASS30_PRICE_CENTS, 10) || 499;
const TOWN_PASS30_HOURS = parseFloat(process.env.TOWN_PASS30_HOURS) || 24 * 30;
const IAP_PRODUCT30_ID = process.env.IAP_PRODUCT30_ID || 'town_pass_30d';
// The rooms the pass unlocks. Everything not listed here is free.
const LOCKED_ROOMS = new Set(['lounge', 'arcade']);
const stripeClient = STRIPE_SECRET_KEY ? Stripe(STRIPE_SECRET_KEY) : null;

// Who currently holds a pass. Two layers, mirroring how identity works
// everywhere else in this game:
//  - townPasses.json: accountKey -> expiresAt. A logged-in buyer's pass
//    follows their account across browsers/devices, persisted like
//    inventories.json (same ephemeral-filesystem caveat, see README).
//  - passSessions: stripeSessionId -> expiresAt, in-memory. The buyer's
//    browser keeps the Checkout session id in localStorage as its receipt
//    and presents it when joining; if the server restarted and forgot it,
//    the join handler re-verifies the id against Stripe itself — so even
//    guests' passes survive a server restart without a database, because
//    Stripe is the durable record of what was paid and when.
const TOWN_PASS_FILE = path.join(DATA_DIR, 'townPasses.json');
function loadTownPasses() { return persistLoad('townPasses', TOWN_PASS_FILE); }
function saveTownPasses() { persistSave('townPasses', TOWN_PASS_FILE, townPasses); }
const townPasses = loadTownPasses(); // accountKey -> expiresAt (ms)
persistRegister('townPasses', TOWN_PASS_FILE, () => townPasses);
const passSessions = new Map();      // stripe checkout session id -> expiresAt (ms)

function hasTownPass(player) {
  const now = Date.now();
  if (player.passUntil && player.passUntil > now) return true;
  if (player.accountKey && townPasses[player.accountKey] > now) {
    player.passUntil = townPasses[player.accountKey];
    return true;
  }
  return false;
}

// One Checkout session grants exactly one 24h window, no matter how many
// times the success URL gets replayed — the expiry is computed once from
// the session's payment time and cached, so refreshing the return page
// (or re-presenting an old receipt) can never stack extra hours.
function grantForSession(sessionId, paidAtMs, hours) {
  if (!passSessions.has(sessionId)) {
    passSessions.set(sessionId, paidAtMs + (hours || TOWN_PASS_HOURS) * 3600 * 1000);
  }
  return passSessions.get(sessionId);
}
// A Stripe session's own metadata says which pass it bought — so replays,
// restarts and re-verifications always rebuild the right-length window.
function passHoursForStripeSession(session) {
  return session && session.metadata && session.metadata.pass_product === 'pass30' ? TOWN_PASS30_HOURS : TOWN_PASS_HOURS;
}

const app = express();
// Trust exactly one hop of reverse proxy (Render/Railway/Heroku/Fly all sit
// in front of the app like this) so req.ip below is the real visitor IP —
// without this, every request looks like it comes from the proxy, and the
// SMS rate limit below would silently become "3 texts total for the whole
// app" instead of "3 texts per visitor."
app.set('trust proxy', 1);
app.use(express.json());
// CORS for the JSON API only. The mobile apps load from capacitor://localhost /
// https://localhost and call these endpoints cross-origin, so they need this;
// the web build is same-origin and unaffected. These endpoints don't use
// cookies (auth is a token in the request body), so an open origin is safe here.
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'content-type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
  res.json({
    paymentsEnabled: !!stripeClient,
    townPassPriceCents: TOWN_PASS_PRICE_CENTS,
    townPassHours: TOWN_PASS_HOURS,
    townPass30PriceCents: TOWN_PASS30_PRICE_CENTS,
    townPass30Hours: TOWN_PASS30_HOURS,
    lockedRooms: [...LOCKED_ROOMS]
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

// Login/registration throttle — counts recent FAILED auth attempts per IP so
// nobody can brute-force a password (or hammer registration) at machine speed.
// A success clears the counter for that IP. In-memory only, resets on restart;
// this is a friends-game guardrail, not enterprise auth (see README).
const LOGIN_FAIL_LIMIT = 8;                 // failures allowed per window…
const LOGIN_FAIL_WINDOW_MS = 5 * 60 * 1000; // …before a cool-off
const loginFailLog = new Map();             // ip -> [failure timestamps]
function loginThrottled(ip) {
  const now = Date.now();
  const fails = (loginFailLog.get(ip) || []).filter(t => now - t < LOGIN_FAIL_WINDOW_MS);
  loginFailLog.set(ip, fails);
  return fails.length >= LOGIN_FAIL_LIMIT;
}
function noteLoginFailure(ip) {
  const now = Date.now();
  const fails = (loginFailLog.get(ip) || []).filter(t => now - t < LOGIN_FAIL_WINDOW_MS);
  fails.push(now);
  loginFailLog.set(ip, fails);
}
function clearLoginFailures(ip) { loginFailLog.delete(ip); }

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

// ── Seamless checkout return ────────────────────────────────────────────────
// Stripe Checkout is a full-page redirect, and a guest's whole identity
// (XP, inventory, quest progress, position) lives on the WebSocket that
// dies the moment the page navigates away. So: right before redirecting,
// the client asks for a one-time resume token ('checkout_departure' in the
// message handler) and the server stashes a snapshot of the player; when
// the browser bounces back (paid OR canceled — see cancel_url below), it
// auto-joins with the token and the new connection is rebuilt as that
// exact player in that exact spot. Tokens are random, single-use, expire
// in 15 minutes, and only restore for the same account (or guest-ness)
// they were issued to.
const resumeStashes = new Map(); // token → { stash, expiresAt }
const RESUME_TTL_MS = 15 * 60 * 1000;
// Disconnect stashes live longer than checkout ones — a phone whose screen
// went dark can take a while to come back, and holding a guest's arrays in
// memory for half an hour costs nothing at this scale.
const DISCONNECT_RESUME_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [t, e] of resumeStashes) if (e.expiresAt < now) resumeStashes.delete(t);
}, 60 * 1000);

// Snapshot everything needed to rebuild a player on a later join-with-token.
// Shared by the checkout departure (explicit, client-requested before the
// Stripe redirect) and the socket close handler (implicit, so a dropped
// phone connection can seamlessly resume — see 'ws.on close' below).
function buildResumeStash(player) {
  return {
    name: player.name, color: player.color, charId: player.charId,
    accountKey: player.accountKey || null,
    x: player.x, y: player.y, room: player.room,
    health: player.health,
    restedUntil: player.restedUntil || 0,
    passUntil: player.passUntil || 0,
    activeQuest: player.activeQuest ? { ...player.activeQuest } : null,
    disguise: player.disguise ? { ...player.disguise } : null,
    // Guests: hold direct references — the player object is about to be
    // dropped on disconnect, and these keep its life alive.
    guestProgress: player.accountKey ? null : player.guestProgress || null,
    guestInventory: player.accountKey ? null : player.guestInventory || null,
    guestHardDrive: player.accountKey ? null : player.guestHardDrive || null,
    guestInbox: player.accountKey ? null : player.inbox || null
  };
}

app.post('/api/checkout', async (req, res) => {
  if (!stripeClient) return res.status(503).json({ error: 'Passes aren’t on sale right now — the innkeeper hasn’t opened the ledger. (Server has no STRIPE_SECRET_KEY.)' });
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    // One checkout door, two products: the Town Pass (default, the original
    // behavior) or a Moonstone pack. Packs are account-bound, so the client
    // sends its account token and we sanity-check it up front — the binding
    // grant happens at verify time against the session's own metadata.
    const product = String((req.body && req.body.product) || 'pass');
    if (MS_PACKS[product]) {
      const accountKey = req.body && req.body.account_token ? sessions.get(String(req.body.account_token)) : null;
      if (!accountKey) return res.status(400).json({ error: 'Log into an account first — Moonstones follow your account.' });
      const pack = MS_PACKS[product];
      const session = await stripeClient.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        metadata: { ms_pack: product },
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: pack.cents,
            product_data: {
              name: `Thornreach — ${pack.name}`,
              description: `${pack.ms} Moonstones, delivered to your account the moment you return to town.`
            }
          },
          quantity: 1
        }],
        success_url: `${origin}/?ms_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?pass_cancel=1`
      });
      return res.json({ url: session.url });
    }
    // Two shapes of the same pass: the day pass (default — the original
    // behavior) and the 30-day Resident Pass (Session L).
    const isResident = product === 'pass30';
    const hoursLabel = TOWN_PASS_HOURS === 24 ? 'a full day' : `${TOWN_PASS_HOURS} hours`;
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      metadata: isResident ? { pass_product: 'pass30' } : {},
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: isResident ? TOWN_PASS30_PRICE_CENTS : TOWN_PASS_PRICE_CENTS,
          product_data: isResident ? {
            name: 'Thornreach — Resident Pass (30 days)',
            description: 'Unlocks the Phantom Parlor and the Starlight Arcade for 30 days. Same doors, resident-shaped value.'
          } : {
            name: 'Town Chat — Town Pass',
            description: `Unlocks the Phantom Parlor and the Starlight Arcade for ${hoursLabel}.`
          }
        },
        quantity: 1
      }],
      success_url: `${origin}/?pass_session={CHECKOUT_SESSION_ID}`,
      // Flagged so the client knows this load is a bounce-back from an
      // abandoned checkout and can auto-resume the stashed session too.
      cancel_url: `${origin}/?pass_cancel=1`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
});

// Confirms a Checkout session actually got paid, then grants the pass. The
// check happens against Stripe itself (server-side), so it can't be spoofed
// by editing the page; what the browser keeps is just the session id as a
// receipt to present on future joins. If the buyer is logged in, the pass
// also attaches to their account so it follows them to other devices.
app.get('/api/verify-session', async (req, res) => {
  if (!stripeClient) return res.status(503).json({ unlocked: false, error: 'Payments are not set up on this server yet.' });
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).json({ unlocked: false, error: 'Missing session_id.' });
  try {
    const session = await stripeClient.checkout.sessions.retrieve(String(sessionId));
    if (session.payment_status !== 'paid') return res.json({ unlocked: false });
    // session.created is seconds; the pass clock starts at payment, not at
    // whenever the buyer got around to bouncing back to the game.
    const expiresAt = grantForSession(String(sessionId), (session.created || Math.floor(Date.now() / 1000)) * 1000, passHoursForStripeSession(session));
    const accountKey = req.query.account_token ? sessions.get(String(req.query.account_token)) : null;
    if (accountKey && (townPasses[accountKey] || 0) < expiresAt) {
      townPasses[accountKey] = expiresAt;
      saveTownPasses();
    }
    // A player already in the town gets their live connection stamped too,
    // so the pass works the moment they walk back from checkout.
    for (const p of players.values()) {
      if ((accountKey && p.accountKey === accountKey)) {
        p.passUntil = Math.max(p.passUntil || 0, expiresAt);
        send(p.ws, { type: 'pass_state', passUntil: p.passUntil });
      }
    }
    res.json({ unlocked: true, expiresAt });
  } catch (err) {
    console.error('Stripe verify error:', err.message);
    res.status(500).json({ unlocked: false, error: 'Could not verify payment.' });
  }
});

// ---------------------------------------------------------------------------
// In-app purchases (mobile apps) — the iOS/Android builds can't use Stripe
// (Apple/Google mandate their own billing for digital goods), so they buy the
// Town Pass through StoreKit / Play Billing and send the receipt/token here.
// This validates it directly with Apple/Google and grants the SAME pass the
// Stripe flow grants — one shared server, three client billing paths, one
// multiplayer town. Uses only Node built-ins (no extra npm deps).
//
// Config (env, all optional — a platform whose secret is unset returns 503):
//   IAP_PRODUCT_ID              product id for the pass (default town_pass_24h)
//   APPLE_IAP_SHARED_SECRET     App-Specific Shared Secret (App Store Connect)
//   APPLE_BUNDLE_ID             your iOS bundle id (receipt is checked against it)
//   GOOGLE_PLAY_PACKAGE         your Android package name
//   GOOGLE_SERVICE_ACCOUNT_JSON service-account JSON (inline) with Play Dev API access
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Moonstones — the premium currency (Session I). Account-bound (guests can
// neither buy nor hold them; the client mirrors that rule in its UI), spent
// at the Midnight Peddler and in the auction house's Moonstone lane. Sold
// for real money in three pack sizes: Stripe on web/desktop, StoreKit /
// Play Billing in the apps (same /api/verify-iap flow as the pass). Every
// grant is replay-proof by a grant id (Stripe session id / store tx id).
// ---------------------------------------------------------------------------
// Moonstone currency (Session I) — extracted to lib/moonstones.js (Tier 3.4 Phase B).
const moonstones = require('./lib/moonstones')({ dataDir: DATA_DIR, persistLoad, persistSave, persistRegister });
const { msData, msBalance, msAdjust, grantMoonstones } = moonstones;
function pushMsStateIfOnline(key) {
  const p = findConnectionByAccountKey(key);
  if (p) send(p.ws, { type: 'ms_state', balance: msBalance(key) });
}
const { MS_PACKS } = require('./data/gameConstants'); // Tier 3.4 Phase A: extracted to data/

const IAP_PRODUCT_ID = process.env.IAP_PRODUCT_ID || 'town_pass_24h';
function httpsRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (r) => {
      let d = ''; r.on('data', (c) => d += c);
      r.on('end', () => { let json = null; try { json = JSON.parse(d); } catch (e) {} resolve({ status: r.statusCode, json, raw: d }); });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
// Apple: legacy verifyReceipt (simple + reliable). Prod first, retry sandbox
// on status 21007 so TestFlight/sandbox receipts validate during review.
async function verifyAppleReceipt(receiptBase64, wantedProductId) {
  const productId = wantedProductId || IAP_PRODUCT_ID;
  if (!process.env.APPLE_IAP_SHARED_SECRET) return { ok: false, code: 503, error: 'apple_iap_not_configured' };
  if (!receiptBase64) return { ok: false, code: 400, error: 'missing_receipt' };
  const payload = JSON.stringify({ 'receipt-data': receiptBase64, password: process.env.APPLE_IAP_SHARED_SECRET, 'exclude-old-transactions': true });
  const hit = (host) => httpsRequest({ host, path: '/verifyReceipt', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } }, payload);
  let r = await hit('buy.itunes.apple.com');
  if (r.json && r.json.status === 21007) r = await hit('sandbox.itunes.apple.com');
  if (!r.json || r.json.status !== 0) return { ok: false, code: 400, error: 'apple_status_' + (r.json && r.json.status) };
  const bundle = r.json.receipt && r.json.receipt.bundle_id;
  if (process.env.APPLE_BUNDLE_ID && bundle !== process.env.APPLE_BUNDLE_ID) return { ok: false, code: 400, error: 'bundle_mismatch' };
  const items = r.json.latest_receipt_info || (r.json.receipt && r.json.receipt.in_app) || [];
  const match = items.filter((i) => i.product_id === productId)
    .sort((a, b) => Number(b.purchase_date_ms) - Number(a.purchase_date_ms))[0];
  if (!match) return { ok: false, code: 400, error: 'no_matching_purchase' };
  return { ok: true, txId: 'apple_' + match.transaction_id, purchaseMs: Number(match.purchase_date_ms) };
}
// Google: sign a service-account JWT (RS256, built-in crypto) → access token
// → Play Developer API purchases.products.get. purchaseState 0 = purchased.
async function getGoogleAccessToken() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
  let sa; try { sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON); } catch (e) { return null; }
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600
  });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(signingInput), sa.private_key).toString('base64url');
  const form = 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + (signingInput + '.' + sig);
  const r = await httpsRequest({ host: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(form) } }, form);
  return r.json && r.json.access_token;
}
async function verifyGooglePurchase(productId, token, packageName) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return { ok: false, code: 503, error: 'google_iap_not_configured' };
  if (!token) return { ok: false, code: 400, error: 'missing_token' };
  const pkg = packageName || process.env.GOOGLE_PLAY_PACKAGE;
  if (!pkg) return { ok: false, code: 503, error: 'missing_package' };
  const access = await getGoogleAccessToken();
  if (!access) return { ok: false, code: 503, error: 'google_auth_failed' };
  const path = `/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;
  const r = await httpsRequest({ host: 'androidpublisher.googleapis.com', path, method: 'GET', headers: { authorization: 'Bearer ' + access } });
  if (!r.json) return { ok: false, code: 400, error: 'google_no_response' };
  if (r.json.purchaseState !== 0) return { ok: false, code: 400, error: 'not_purchased' };
  return { ok: true, txId: 'google_' + (r.json.orderId || token), purchaseMs: Number(r.json.purchaseTimeMillis || Date.now()) };
}
// Confirms a Moonstone-pack Checkout session got paid, then credits the
// pack to the buyer's account — replay-proof (grantMoonstones), and the
// pack identity comes from the session's own metadata, not the query.
app.get('/api/verify-ms-session', async (req, res) => {
  if (!stripeClient) return res.status(503).json({ granted: 0, error: 'Payments are not set up on this server yet.' });
  const sessionId = req.query.session_id;
  const accountKey = req.query.account_token ? sessions.get(String(req.query.account_token)) : null;
  if (!sessionId) return res.status(400).json({ granted: 0, error: 'Missing session_id.' });
  if (!accountKey) return res.status(401).json({ granted: 0, error: 'Log into your account to claim the Moonstones from this purchase.' });
  try {
    const session = await stripeClient.checkout.sessions.retrieve(String(sessionId));
    if (session.payment_status !== 'paid') return res.json({ granted: 0 });
    const packId = session.metadata && session.metadata.ms_pack;
    if (!MS_PACKS[packId]) return res.status(400).json({ granted: 0, error: 'That checkout wasn’t a Moonstone pack.' });
    const g = grantMoonstones('stripe_' + String(sessionId), accountKey, packId);
    pushMsStateIfOnline(accountKey);
    res.json({ granted: g.granted, balance: g.balance });
  } catch (err) {
    console.error('MS verify error:', err.message);
    res.status(500).json({ granted: 0, error: 'Could not verify the purchase.' });
  }
});

app.post('/api/verify-iap', express.json({ limit: '1mb' }), async (req, res) => {
  const platform = String(req.body.platform || '');
  const productId = String(req.body.productId || IAP_PRODUCT_ID);
  try {
    let v;
    if (platform === 'ios') v = await verifyAppleReceipt(String(req.body.receipt || ''), productId);
    else if (platform === 'android') v = await verifyGooglePurchase(productId, String(req.body.purchaseToken || ''), req.body.packageName);
    else return res.status(400).json({ unlocked: false, error: 'unknown_platform' });
    if (!v.ok) return res.status(v.code || 400).json({ unlocked: false, error: v.error });
    // Moonstone packs bought in-app land here too — same receipt validation,
    // different grant. Account required: the stones live on the account.
    if (MS_PACKS[productId]) {
      const msKey = req.body.accountToken ? sessions.get(String(req.body.accountToken)) : null;
      if (!msKey) return res.status(400).json({ unlocked: false, error: 'account_required' });
      const g = grantMoonstones(v.txId, msKey, productId);
      pushMsStateIfOnline(msKey);
      return res.json({ unlocked: true, moonstones: g.balance, granted: g.granted, txId: v.txId });
    }
    // Same replay-proof grant the Stripe flow uses — one transaction id grants
    // exactly one window, computed from the purchase time. The 30-day
    // Resident Pass rides the same path with a longer window (Session L).
    const expiresAt = grantForSession(v.txId, v.purchaseMs || Date.now(), productId === IAP_PRODUCT30_ID ? TOWN_PASS30_HOURS : TOWN_PASS_HOURS);
    const accountKey = req.body.accountToken ? sessions.get(String(req.body.accountToken)) : null;
    if (accountKey && (townPasses[accountKey] || 0) < expiresAt) { townPasses[accountKey] = expiresAt; saveTownPasses(); }
    for (const p of players.values()) {
      if (accountKey && p.accountKey === accountKey) {
        p.passUntil = Math.max(p.passUntil || 0, expiresAt);
        send(p.ws, { type: 'pass_state', passUntil: p.passUntil });
      }
    }
    res.json({ unlocked: true, expiresAt, txId: v.txId });
  } catch (err) {
    console.error('IAP verify error:', err.message);
    res.status(500).json({ unlocked: false, error: 'verify_failed' });
  }
});

// == Client error telemetry (Tier 3.1) ========================================
// Receives uncaught client-side errors (window.onerror / unhandledrejection) so
// silent browser crashes surface in the logs instead of vanishing. Per-IP
// throttle + field truncation keep it from being a log-flood vector. (The
// global express.json above already parses the body; payloads are tiny.)
const CLIENT_ERR_LIMIT = 20;                  // reports per IP...
const CLIENT_ERR_WINDOW_MS = 60 * 1000;       // ...per minute
const clientErrLog = new Map();               // ip -> [timestamps]
function clientErrThrottled(ip) {
  const now = Date.now();
  const hits = (clientErrLog.get(ip) || []).filter(t => now - t < CLIENT_ERR_WINDOW_MS);
  if (hits.length >= CLIENT_ERR_LIMIT) { clientErrLog.set(ip, hits); return true; }
  hits.push(now);
  clientErrLog.set(ip, hits);
  return false;
}
app.post('/api/client-error', (req, res) => {
  if (clientErrThrottled(req.ip)) return res.status(429).end();
  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  const kind = String(b.kind || 'error').slice(0, 32);
  const message = String(b.message || '').slice(0, 500);
  const source = String(b.source || '').slice(0, 300);
  const line = Number(b.line) || 0;
  const stack = String(b.stack || '').slice(0, 2000).replace(/\n/g, ' | ');
  const ua = String(b.ua || '').slice(0, 200);
  console.error('[client-error] ' + kind + ': ' + message + ' @ ' + source + ':' + line + ' ua="' + ua + '"' + (stack ? ' :: ' + stack : ''));
  res.status(204).end();
});

// == Deploy health check (Tier 3.2) ==========================================
// Render pings this on every deploy and holds traffic on the OLD build until
// the new one passes - so a build that boots but can't reach its data never
// reaches players. 2xx = healthy to Render; we return 200 only if the process
// is up AND the SQLite store answers a trivial query.
app.get('/healthz', (req, res) => {
  try {
    const db = getSqliteDb();
    if (db) db.prepare('SELECT 1').get();
    res.status(200).json({
      ok: true,
      store: db ? 'sqlite' : 'json',
      players: players.size,
      uptime: Math.round(process.uptime()),
    });
  } catch (e) {
    res.status(503).json({ ok: false, error: 'store_unreachable' });
  }
});

const server = http.createServer(app);
// maxPayload guards against an oversized image (or anything else) blowing up
// server memory — the client already resizes/compresses images well under
// this before sending, this is just the backstop.
const wss = new WebSocketServer({ server, maxPayload: 2 * 1024 * 1024 });
// Test hook — the harness in test/ drives the real connection handler with
// mock sockets through this global. Harmless at runtime (one extra global
// holding a reference the module already holds).
global.__wssInstances = global.__wssInstances || [];
global.__wssInstances.push(wss);

// ---------------------------------------------------------------------------
// World definition — single source of truth, sent to every client on join.
// Buildings double as chatrooms: being inside a building's rect = being in
// that room's chat channel. "outside" is the open-air town-square channel.
// ---------------------------------------------------------------------------
const { WORLD } = require('./data/world'); // Tier 3.4 Phase A: extracted to data/
// ---------------------------------------------------------------------------
// The Wilds — a second, smaller (1000x1000) outdoor map reached through a
// portal in the town square. No buildings; it exists purely as a wildlife/
// harvesting area with its own friendly animals, 4 dangerous mob types that
// come out at night, and 16 unique harvestable plants. Shares the same
// day/night clock as town (isNightNow() below). Player room 'wilds' is a
// peer of 'outside', not nested under it — see ROOM_IDS.
// ---------------------------------------------------------------------------
const { WORLD2 } = require('./data/world'); // Tier 3.4 Phase A: extracted to data/

// 16 harvestable plants, each a one-shot consumable with a distinct effect
// applied when used from the inventory (see 'use_item' below) rather than
// on harvest itself. 13 reuse existing status-effect types the curse/spell
// system already renders client-side; heal/regen/cleanse are new, simple
// effects that don't need a new visual.
const { PLANT_CATALOG } = require('./data/world'); // Tier 3.4 Phase A: extracted to data/
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

// 9 of each plant type — the 10000x10000 Wilds read as an empty field at
// 5 per type, and harvesting is the map's core interaction loop. Mob
// count is intentionally left at the original 8 (2 of each of the 4
// dangerous types), see MOB2_SPAWNS below — danger stays scarce, forage
// doesn't.
const PLANTS_PER_TYPE = 9;
const PLANT_POSITIONS = makeWildsScatter(0x9a17, 16, PLANT_KEYS.length * PLANTS_PER_TYPE);
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
const WAND_WOOD_COST = 5; // Holly Wood → Holly Wand (craft_wand handler)
const HARVEST_ITEM_BY_TYPE = { tree: 'wood', shrub: 'berries', flower: 'flower_bloom' };
for (const key of PLANT_KEYS) HARVEST_ITEM_BY_TYPE[key] = key; // a plant's decor type IS its item id
const HARVEST_RANGE = 70;
// Regrowth is PER PLAYER now. It used to be one global timer per plant —
// with the 24-hour regrow, the first player of the evening stripped the
// Wilds bare for everyone else (a second Werewolf literally could not
// gather wolfsbane that night). Each identity now sees its own regrowth:
// accounts keyed durably, guests by their connection (their whole
// identity already resets on disconnect anyway).
// Persisted now (Session L) so the "while you were gone" letter can count
// what regrew across restarts. Guests still live and die in memory only.
const HARVESTS_FILE = path.join(DATA_DIR, 'harvests.json');
const decorHarvestedAt = persistLoad('harvests', HARVESTS_FILE); // playerKey -> { decorId -> timestamp }
persistRegister('harvests', HARVESTS_FILE, () => decorHarvestedAt);
function saveHarvests(playerKey) {
  if (!playerKey || playerKey.startsWith('guest_')) return; // guests reset on disconnect anyway
  persistSetKey('harvests', HARVESTS_FILE, decorHarvestedAt, playerKey);
}
function harvestKeyFor(player) { return player.accountKey || ('guest_' + player.id); }
function playerHarvests(player) {
  const k = harvestKeyFor(player);
  if (!decorHarvestedAt[k]) decorHarvestedAt[k] = {};
  return decorHarvestedAt[k];
}

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

function decorPublicState(player) {
  const now = Date.now();
  const mine = player ? playerHarvests(player) : {};
  return [...WORLD.natureDecor, ...WORLD2.natureDecor]
    .filter(d => HARVEST_TYPES.has(d.type))
    .map(d => ({ id: d.id, available: !mine[d.id] || now - mine[d.id] >= HARVEST_COOLDOWN_MS }));
}

const ROOM_IDS = new Set(['outside', 'wilds', ...WORLD.buildings.map(b => b.id)]);
['dungeon_t1', 'dungeon_t2', 'dungeon_t3', 'dungeon_t4', 'witch_cave', 'bank_vault', 'ember_wastes'].forEach(r => ROOM_IDS.add(r));

const { COLORS } = require('./data/gameConstants'); // Tier 3.4 Phase A: extracted to data/

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
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

function loadAccounts() { return persistLoad('accounts', ACCOUNTS_FILE); }
function saveAccounts() { persistSave('accounts', ACCOUNTS_FILE, accounts); }

const accounts = loadAccounts(); // usernameLower -> { username, salt, hash, color, createdAt }
persistRegister('accounts', ACCOUNTS_FILE, () => accounts);
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
  if (loginThrottled(req.ip)) {
    return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
  }
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!USERNAME_RE.test(username)) {
    noteLoginFailure(req.ip);
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
  clearLoginFailures(req.ip);
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, key);
  res.json({ token, username, color: accounts[key].color });
});

app.post('/api/login', (req, res) => {
  if (loginThrottled(req.ip)) {
    return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
  }
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const key = username.toLowerCase();
  const account = accounts[key];
  if (!account || !verifyPassword(password, account.salt, account.hash)) {
    noteLoginFailure(req.ip);
    return res.status(401).json({ error: 'Wrong username or password.' });
  }
  clearLoginFailures(req.ip);
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, key);
  res.json({ token, username: account.username, color: account.color });
});

// The character roster behind the join screen's "continue as …" cards: every
// class this account has played (recorded at join, see the join handler),
// newest first, with the account's shared level and each class's campaign
// chapter. A stale token (sessions don't survive a restart) gets a clean 401
// so the client can fall back to the login form instead of silently guesting.
app.post('/api/characters', (req, res) => {
  const token = String(req.body.token || '');
  const key = token ? sessions.get(token) : null;
  if (!key || !accounts[key]) {
    return res.status(401).json({ error: 'Session expired — log in again.' });
  }
  const prog = playerProgress[key] || {};
  const chars = prog.characters || {};
  const characters = Object.keys(chars)
    .map((cid) => {
      const charId = parseInt(cid, 10);
      const story = (prog.story && prog.story[charId]) || null;
      return {
        charId,
        lastPlayedAt: chars[cid].lastPlayedAt || 0,
        chapter: story ? story.chapter : 0
      };
    })
    .filter((c) => Number.isInteger(c.charId) && c.charId >= 0 && c.charId < CHARACTER_COUNT)
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  res.json({
    username: accounts[key].username,
    color: accounts[key].color,
    level: prog.level || 1,
    lastCharId: Number.isInteger(prog.lastCharId) ? prog.lastCharId : null,
    characters
  });
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
const ITEM_CATALOG = require('./data/itemCatalog'); // Tier 3.4 Phase A: extracted to data/
// holly_wand is excluded from the random-starter pool — it's the Holly Wood
// crafting reward (5 tree harvests), never random loot.
const ITEM_IDS = Object.keys(ITEM_CATALOG).filter(id => id !== 'holly_wand');

// ── Selling to shopkeepers (Session M) ──────────────────────────────────────
// Gold used to have only faucets (loot + quests) and almost no way to turn a
// full inventory of materials back into coin. These per-item sell values are
// deliberately LOW and tiered by rarity — selling clears clutter and rewards
// hunting, it is NOT meant to mint gold (crafting is the real gold SINK). Every
// value here sits well under the same item's NPC BUY price, so there is no
// buy-low/sell-high loop. Items not listed fall through sellValueFor():
// equipment is valued from its own stats (~40-50% of its combat worth); any
// other non-equippable id is unsellable (0) — e.g. the Hard Drive, which holds
// the player's own notes, and Moonstone-bought legendaries (not in ITEM_CATALOG).
const SELL_VALUES = require('./data/sellValues'); // Tier 3.4 Phase A: extracted to data/
function sellValueFor(itemId) {
  if (SELL_VALUES[itemId] != null) return SELL_VALUES[itemId];
  const meta = ITEM_CATALOG[itemId];
  if (!meta) return 0; // legendaries / unknown ids are not gold-sellable
  if (meta.slot) return Math.max(5, Math.round(2 * (meta.atk || 0) + 2 * (meta.def || 0) + (meta.spd || 0)));
  return 0; // non-equippable with no listed value (e.g. hard_drive) — unsellable
}
// One authoritative price map shipped to the client's Sell tab so it can price
// the player's stacks without re-implementing the rule (only sellable items).
const SELL_VALUE_MAP = {};
for (const _sid of Object.keys(ITEM_CATALOG)) { const _sv = sellValueFor(_sid); if (_sv > 0) SELL_VALUE_MAP[_sid] = _sv; }
// Plants are added *after* ITEM_IDS is captured — unlike Wood/Berries/
// Flower, they're deliberately excluded from the random-starter-item pool,
// since the whole point is going out to the Wilds to harvest them.
for (const key in PLANT_CATALOG) {
  ITEM_CATALOG[key] = { name: PLANT_CATALOG[key].name, icon: PLANT_CATALOG[key].icon, slot: null };
}

// ---------------------------------------------------------------------------
// Equipment stats — until now equipped gear was purely cosmetic (it renders
// on your character model but did nothing). Each equippable item now carries
// real stat contributions that feed the SAME derived stats the skill trees
// do, so a weapon's damage and armor's toughness stack with your skills.
// Contributions are additive fractions (power/guard/haste/swift/leech/xp/forage)
// or flat max-health (vitality), read back in the stat getters below. Campaign
// relics (Shadow Staff, Alpha Fang, Dread Helm, Shadow Cloak, Soul Treads) are
// deliberately the strongest in each slot — a finale reward that finally bites.
// ---------------------------------------------------------------------------
const EQUIP_STATS = require('./data/equipStats'); // Tier 3.4 Phase A: extracted to data/
// ---------------------------------------------------------------------------
// Legendary catalog — the Midnight Peddler's stock (Session I). ~100 items,
// Moonstone-only, five on sale per week (see legendaryWeeklySet below). Each
// carries an fx spec the client renders as a visible-to-everyone effect.
// Stats are RELIC-PARITY AT MOST by design (prestige, not pay-to-win) — the
// generator that authored this block enforces the ceilings; keep it that way.
// Server-authoritative: the client receives this whole catalog in `init`
// (never hand-copy it into client.js — that's how drift happens).
// ---------------------------------------------------------------------------
const LEGENDARY_CATALOG = require('./data/legendaryCatalog'); // Tier 3.4 Phase A: extracted to data/
// Legendaries are real items everywhere else in the game — bankable,
// auctionable, equippable — so they join the two existing catalogs here.
for (const [lgId, lg] of Object.entries(LEGENDARY_CATALOG)) {
  ITEM_CATALOG[lgId] = { name: lg.name, icon: lg.icon, slot: lg.slot };
  EQUIP_STATS[lgId] = lg.stats;
}

const { STAT_KEYS, SKILL_STAT_PER_RANK, STAT_SKILL_EFFECT } = require('./data/skills'); // Tier 3.4 Phase A: extracted to data/
// ---------------------------------------------------------------------------
// Potion crafting recipes (witch cave)
// ---------------------------------------------------------------------------
const { POTION_RECIPES } = require('./data/gameConstants'); // Tier 3.4 Phase A: extracted to data/

// ---------------------------------------------------------------------------
// Mob loot tables
// ---------------------------------------------------------------------------
const { LOOT_TABLES } = require('./data/gameConstants'); // Tier 3.4 Phase A: extracted to data/

function dungeonLootTable(xp) {
  if (xp <= 8)  return LOOT_TABLES.dungeon_t1;
  if (xp <= 18) return LOOT_TABLES.dungeon_t2;
  if (xp <= 35) return LOOT_TABLES.dungeon_t3;
  return LOOT_TABLES.dungeon_t4;
}

// Rolls loot drops without granting them to anyone yet — the result sits on
// the defeated mob/animal as pendingLoot until a player actually clicks the
// loot icon on its body (see the loot_corpse handler), rather than being
// auto-granted to whoever landed the killing blow the instant it died.
function rollPendingLoot(table) {
  const pending = [];
  for (const drop of table) {
    if (Math.random() > drop.chance) continue;
    if (drop.gold) {
      const amount = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
      pending.push({ kind: 'gold', amount });
    } else {
      pending.push({ kind: 'item', itemId: drop.itemId, qty: drop.qty || 1 });
    }
  }
  return pending;
}

// Actually hands over a previously-rolled pending loot list to whoever just
// looted the body — mirrors what the old rollLoot used to do immediately,
// just deferred to loot time. Returns label strings for the result toast.
function grantLoot(pending, player) {
  const inv = getInventory(player);
  const earned = [];
  for (const drop of pending) {
    if (drop.kind === 'gold') {
      if (player.accountKey) {
        const acct = ensureBankAccount(player.accountKey);
        acct.balance += drop.amount;
        saveBankAccounts();
      }
      earned.push(`🪙 ${drop.amount}g`);
    } else if (drop.kind === 'item') {
      if (addItemToAccount(inv, drop.itemId, drop.qty)) {
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

const BANK_FILE = path.join(DATA_DIR, 'bankAccounts.json');
function loadBankAccounts() { return persistLoad('bankAccounts', BANK_FILE); }
function saveBankAccounts() { persistSave('bankAccounts', BANK_FILE, bankAccounts); }
const bankAccounts = loadBankAccounts(); // usernameLower -> { balance, slots: [ {itemId,qty}|null x24 ] }
persistRegister('bankAccounts', BANK_FILE, () => bankAccounts);

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
const INVENTORY_FILE = path.join(DATA_DIR, 'inventories.json');
function loadInventories() { return persistLoad('inventories', INVENTORY_FILE); }
function saveInventories() { persistSave('inventories', INVENTORY_FILE, inventories); }
const inventories = loadInventories(); // usernameLower -> { slots, equippedWeapon, equippedHead, equippedChest, equippedFeet, equippedRing }
persistRegister('inventories', INVENTORY_FILE, () => inventories);
// All possible equip slot keys — used throughout to avoid scattered literals.
const EQUIP_SLOTS = ['weapon', 'head', 'chest', 'feet', 'ring'];

// Each character class starts with a full themed loadout — every equip slot
// filled, nothing left to chance. These items are pre-equipped (not sitting
// in slots): the inventory starts empty so they immediately appear on the
// character's model, and the player can unequip them into slots if they want
// to swap something out later.
const { STARTER_GEAR } = require('./data/gameConstants'); // Tier 3.4 Phase A: extracted to data/

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
const HARDDRIVE_FILE = path.join(DATA_DIR, 'hardDrives.json');
function loadHardDrives() { return persistLoad('hardDrives', HARDDRIVE_FILE); }
function saveHardDrives() { persistSave('hardDrives', HARDDRIVE_FILE, hardDrives); }
const hardDrives = loadHardDrives(); // usernameLower -> { passwordSalt, passwordHash, notes: [] }
persistRegister('hardDrives', HARDDRIVE_FILE, () => hardDrives);
const HARDDRIVE_NOTE_CAPACITY = 24;

// A logged-in player's regular inbox (not the Hard Drive vault above) now
// persists the same way — usernameLower -> [{id, fromId, fromName, text,
// image?, audio?}], loaded once at boot and saved after every mutation.
// Guests still get a plain in-memory array that dies with the connection,
// same as their inventory/vault.
const INBOX_FILE = path.join(DATA_DIR, 'inboxes.json');
function loadInboxes() { return persistLoad('inboxes', INBOX_FILE); }
function saveInboxes() { persistSave('inboxes', INBOX_FILE, inboxes); }
const inboxes = loadInboxes();
persistRegister('inboxes', INBOX_FILE, () => inboxes);

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

// PvP death loot — takes one whole random carried (not equipped) item stack
// from the defeated player, same "carried items only, locked Hard Drive is
// untouchable" scope Sleight of Hand's peek already uses. Returns
// { itemId, qty } for whatever was taken, or null if they had nothing
// takeable carried at all.
function stealRandomCarriedItem(victim) {
  const inv = getInventory(victim);
  const hdLocked = !!getHardDrive(victim).passwordHash;
  const candidates = inv.slots
    .map((s, idx) => s ? { idx, itemId: s.itemId, qty: s.qty } : null)
    .filter(s => s && !(hdLocked && s.itemId === 'hard_drive'));
  if (!candidates.length) return null;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  removeItemFromAccount(inv, pick.itemId, pick.qty);
  if (victim.accountKey) saveInventories();
  return { itemId: pick.itemId, qty: pick.qty };
}

// True while `p` (a player) currently has the given status type on them and
// it hasn't expired — the server-side twin of what publicPlayer() already
// does when deciding whether to include activeStatus in a snapshot. Combat
// modifiers below use this so a long-expired buff can never keep paying out.
function hasStatus(p, type) {
  return !!(p.activeStatus && p.activeStatus.type === type && p.activeStatus.expiresAt > Date.now());
}

// Incoming-damage gate for players — the Witch's Gourd Ward (and anything
// else that grants the 'pumpkin' status) halves any damage its bearer takes,
// from mobs and other players alike. Every code path that hurts a player
// (mob strikes in each map's tick, plus applyDamage below) funnels through
// here so the ward can't be bypassed by one forgotten call site.
function absorbIncomingDamage(target, dmg) {
  // 'ward' is the class-neutral twin of 'pumpkin': identical halving, no
  // jack-o'-lantern head — used by the non-Witch classes' defensive
  // abilities (Iron Pelt, Ethereal Veil, Oath of Iron, Packmule's Guard)
  // so their wards read as their own class fantasy instead of borrowed
  // witchcraft. Client renders it as a faint glowing dome.
  if (hasStatus(target, 'pumpkin') || hasStatus(target, 'ward')) dmg = Math.max(1, Math.round(dmg * 0.5));
  // Skill-tree defense (Gourdskin Ward / Thick Hide / Bulwark / … — the
  // 'guard' skill) stacks on top of any active ward, reducing every hit
  // this player takes from both PvP and hunting mobs.
  const gm = incomingDamageMult(target);
  if (gm !== 1) dmg = Math.max(1, Math.round(dmg * gm));
  return dmg;
}

// Shared damage application — the universal melee Strike and Fireball (the
// one damage-dealing spell) both hit the exact same set of targets (players,
// dungeon mobs, or the outside/wilds/ember_wastes animal+mob pools) and need
// identical death/respawn/loot/XP handling, so it lives here once instead of
// twice. Callers differ only in their damage roll and whether they gate on
// range (Strike does; Fireball, being a ranged spell like every other spell,
// passes no maxRange). Returns { ok: false } for a missing/dead/out-of-room/
// out-of-range target, otherwise { ok: true, dead, name?, xp?, lootHint?,
// dmg } — dmg is the FINAL amount after buffs/wards, so caller messages
// never lie about the number that actually landed. Callers build their own
// message text from that (Strike says "Killed"/"Hit", Fireball says
// "incinerates"/"hits", etc).
// Ranged abilities (Fireball, Savage Bite, Smite, Knife Throw, …) reach much
// farther than a melee swing, but not across the whole map — this caps them so
// a crafted client can't snipe a target on the far side of the Wilds. Generous
// enough that every legitimate in-view cast lands; the client only ever targets
// the nearest attackable, well inside this.
const ABILITY_MAX_RANGE = 900;
function applyDamage(player, targetType, targetId, dmg, maxRange) {
  const outOfRange = (t) => maxRange != null && Math.hypot(t.x - player.x, t.y - player.y) > maxRange;

  // Monstrous Form (or any other source of the 'giant' status — the
  // Werewolf's Blood Frenzy and Wanderer's Campfire Tale share it) makes
  // the attacker hit half again as hard for its duration.
  if (hasStatus(player, 'giant')) dmg = Math.round(dmg * 1.5);
  // Skill-tree offense (Witchfire Mastery / Rending Fangs / … — the 'power'
  // skill each class carries) scales ALL of this player's damage, since both
  // Strike and every ranged ability funnel through here.
  const _skillPower = outgoingDamageMult(player);
  if (_skillPower !== 1) dmg = Math.max(1, Math.round(dmg * _skillPower));

  if (targetType === 'player') {
    const t = players.get(targetId);
    if (!t || t.id === player.id || t.room !== player.room || t.isDead || outOfRange(t)) return { ok: false };
    // A voice countermeasure (see cm_voice) makes the target untouchable
    // for a few seconds — the blow just misses, and the attacker is told
    // exactly why so the mechanic teaches itself.
    if (isEvading(t)) {
      return { ok: false, evaded: true, name: t.name };
    }
    dmg = absorbIncomingDamage(t, dmg);
    noteAttacked(t);
    t.health = Math.max(0, t.health - dmg);
    applySkillLifesteal(player, dmg); // Blood Pact / Bloodlust / Soul Harvest
    broadcastHitFx(player.room, 'player', t.id, dmg, t.health <= 0, player.id);
    if (t.health <= 0) {
      t.health = 0;
      t.isDead = true;
      // PvP loot: one random carried (not equipped) item stack changes
      // hands, the same "self-directed carried items only" scope Sleight
      // of Hand already uses — real stakes, but never touches equipped
      // gear or the Hard Drive vault. The body stays put at the death
      // spot (deathX/Y/Room) for the killer to claim even after the
      // victim respawns and wanders off as a ghost.
      const stolen = stealRandomCarriedItem(t);
      t.pendingLoot = stolen ? [{ kind: 'item', itemId: stolen.itemId, qty: stolen.qty }] : null;
      t.lootKillerId = stolen ? player.id : null;
      t.deathX = t.x; t.deathY = t.y; t.deathRoom = t.room;
      send(t.ws, { type: 'you_died', byName: player.name });
      return { ok: true, dead: true, dmg, name: t.name, lootHint: stolen ? '  Loot is on the body — go claim it!' : '' };
    }
    send(t.ws, { type: 'struck', byName: player.name, damage: dmg });
    return { ok: true, dead: false, dmg, name: t.name };
  }

  if (targetType === 'dungeon') {
    const t = findDungeonTarget(targetId, player.room);
    if (!t || t.dead || t.room !== player.room || outOfRange(t)) return { ok: false };
    const preset = DUNGEON_MOB_TYPES[t.mobType];
    // A ranged opener counts as engaging — the boss scales before the first
    // point of damage lands, so kiting from outside aggro can't cheese it
    // into a solo-sized health pool.
    if (t.boss && !t.engaged) bossEngagedScale(t, preset);
    t.health = Math.max(0, t.health - dmg);
    applySkillLifesteal(player, dmg);
    broadcastHitFx(player.room, 'dungeon', targetId, dmg, t.health <= 0, player.id);
    if (t.health <= 0) {
      t.dead = true;
      t.respawnAt = Date.now() + (t.boss ? DUNGEON_BOSS_RESPAWN_MS : DUNGEON_RESPAWN_MS);
      grantXP(player, preset.xp);
      registerHuntKill(player);
      advanceQuestProgress(player, 'kill_mob', null);
      storyEvent(player, 'kill_mob', { pool: 'dungeon', mobType: t.mobType });
      if (t.delve) noteDelveKill(player, t);
      if (t.boss) {
        // Co-op payout (Session L): everyone alive in the room shares the
        // triumph — 60% of the boss's XP to each non-killer present, so a
        // party wipe-run pays the healers and off-tanks too.
        for (const ally of players.values()) {
          if (ally.id !== player.id && ally.room === player.room && !ally.isDead) {
            grantXP(ally, Math.round(preset.xp * 0.6));
            send(ally.ws, { type: 'trophy_bonus', message: `⚔️ Your party felled ${preset.name}!` });
          }
        }
        // Bosses double-roll their OWN tier's table (the generic path keys
        // loot by xp, which a boss's outsized xp would mis-tier).
        const table = LOOT_TABLES['dungeon_t' + t.tier] || dungeonLootTable(preset.xp);
        t.pendingLoot = [...rollPendingLoot(table), ...rollPendingLoot(table)];
        const where = t.delve ? 'the Delve' : (DUNGEON_LORE[t.tier] ? DUNGEON_LORE[t.tier].name : 'the dungeon');
        broadcastAll({ type: 'announce', message: `⚔️ ${player.name} felled ${preset.name} in ${where}!` });
        noteBossKill(player, t);
      } else {
        t.pendingLoot = rollPendingLoot(dungeonLootTable(preset.xp));
      }
      t.lootKillerId = t.pendingLoot.length ? player.id : null;
      return { ok: true, dead: true, dmg, name: preset.name, xp: preset.xp, lootHint: t.pendingLoot.length ? '  Loot is on the body — go claim it!' : '' };
    }
    return { ok: true, dead: false, dmg, name: preset.name };
  }

  // Each pool only exists in (and is only reachable from) its own map.
  const POOLS = {
    animal: { list: animals, room: 'outside', respawnMs: ANIMAL_RESPAWN_MS },
    mob: { list: mobs, room: 'outside', respawnMs: MOB_RESPAWN_MS },
    animal2: { list: animals2, room: 'wilds', respawnMs: ANIMAL2_RESPAWN_MS },
    mob2: { list: mobs2, room: 'wilds', respawnMs: MOB2_RESPAWN_MS },
    mob3: { list: mobs3, room: 'wilds', respawnMs: MOB3_RESPAWN_MS },
    ember_mob: { list: emberMobs, room: 'ember_wastes', respawnMs: EMBER_MOB_RESPAWN_MS }
  };
  const poolInfo = POOLS[targetType];
  if (!poolInfo || player.room !== poolInfo.room) return { ok: false };
  const t = poolInfo.list.find(x => x.id === targetId);
  if (!t || t.dead || outOfRange(t)) return { ok: false };
  // A Mossback Tortoise's shell soaks most of a blow (its `armor` is the
  // fraction of damage that gets through). Applied before anything reads dmg
  // so lifesteal, hit numbers and the health hit all use the real figure.
  if (targetType === 'mob3') {
    const np = MOB3_TYPES[t.mobType];
    if (np && np.armor) dmg = Math.max(1, Math.round(dmg * np.armor));
    // Any hit provokes a neutral creature into fighting back.
    provokeNeutral(t, player.id);
  }
  t.health = Math.max(0, t.health - dmg);
  applySkillLifesteal(player, dmg);
  broadcastHitFx(player.room, targetType, targetId, dmg, t.health <= 0, player.id);
  if (t.health <= 0) {
    t.dead = true;
    t.respawnAt = Date.now() + poolInfo.respawnMs;
    if (targetType === 'mob' || targetType === 'mob2' || targetType === 'mob3' || targetType === 'ember_mob') registerHuntKill(player);
    if (targetType === 'mob2') {
      const preset = MOB2_TYPES[t.mobType];
      const xp = preset.xp || 15;
      grantXP(player, bloodMoonKillXp(xp));
      maybeDropBloodShard(player);
      advanceQuestProgress(player, 'kill_mob', null);
      advanceQuestProgress(player, 'kill_creature', t.mobType);
      storyEvent(player, 'kill_mob', { pool: 'mob2', mobType: t.mobType });
      const lootTable = LOOT_TABLES[t.mobType] || LOOT_TABLES.shade_stalker;
      t.pendingLoot = rollPendingLoot(lootTable);
      t.lootKillerId = t.pendingLoot.length ? player.id : null;
      if (preset.elite) broadcastAll({ type: 'announce', message: `🌒 ${player.name} felled ${preset.name} beneath the Blood Moon!` });
      return { ok: true, dead: true, dmg, name: preset.name, xp, lootHint: t.pendingLoot.length ? '  Loot is on the body — go claim it!' : '' };
    }
    if (targetType === 'mob3') {
      const preset = MOB3_TYPES[t.mobType];
      grantXP(player, bloodMoonKillXp(preset.xp));
      advanceQuestProgress(player, 'kill_creature', t.mobType);
      storyEvent(player, 'kill_mob', { pool: 'mob3', mobType: t.mobType });
      t.pendingLoot = rollPendingLoot(LOOT_TABLES[t.mobType] || LOOT_TABLES.bramble_boar);
      t.lootKillerId = t.pendingLoot.length ? player.id : null;
      return { ok: true, dead: true, dmg, name: preset.name, xp: preset.xp, lootHint: t.pendingLoot.length ? '  Loot is on the body — go claim it!' : '' };
    }
    if (targetType === 'animal2') {
      // Peaceful critters (Session M): prey, so real XP + materials on the
      // kill (rabbits stay ambient — they carry no loot table). Not a "hunt"
      // for streak/leaderboard purposes; they can still anchor a gather quest.
      const preset = CRITTER2_TYPES[t.critterType] || CRITTER2_TYPES.rabbit;
      grantXP(player, preset.xp);
      advanceQuestProgress(player, 'kill_creature', t.critterType);
      storyEvent(player, 'hunt_critter', { pool: 'animal2', critterType: t.critterType });
      if (preset.loot && LOOT_TABLES[preset.loot]) {
        t.pendingLoot = rollPendingLoot(LOOT_TABLES[preset.loot]);
        t.lootKillerId = t.pendingLoot.length ? player.id : null;
      }
      return { ok: true, dead: true, dmg, name: preset.name, xp: preset.xp, lootHint: (t.pendingLoot && t.pendingLoot.length) ? '  Something dropped — go claim it!' : '' };
    }
    if (targetType === 'mob') {
      // Town night-mobs used to be pure atmosphere; now that they hunt
      // players back, killing one is real work and pays real XP (less
      // than a Wilds horror — the square is the beginner hunting ground).
      // First kill of each night pays a bonus on top: a small "show up
      // when the moon does" ritual that gives every night a fresh-start
      // hook and makes the nightly spawn feel like an event, not scenery.
      grantXP(player, bloodMoonKillXp(TOWN_MOB_XP));
      maybeDropBloodShard(player);
      advanceQuestProgress(player, 'kill_mob', null);
      storyEvent(player, 'kill_mob', { pool: 'mob', mobType: t.mobType });
      const nightIdx = Math.floor(Date.now() / CYCLE_MS);
      if (player.trophyNight !== nightIdx) {
        player.trophyNight = nightIdx;
        grantXP(player, 25);
        send(player.ws, { type: 'trophy_bonus', message: '🌙 Night’s First Trophy — bonus +25 XP for the first hunt of the night!' });
      }
      t.pendingLoot = rollPendingLoot(LOOT_TABLES.town_mob);
      t.lootKillerId = t.pendingLoot.length ? player.id : null;
      return { ok: true, dead: true, dmg, xp: TOWN_MOB_XP, lootHint: t.pendingLoot.length ? '  Loot is on the body — go claim it!' : '' };
    }
    if (targetType === 'ember_mob') {
      const preset = EMBER_MOB_TYPES[t.mobType];
      grantXP(player, preset.xp);
      advanceQuestProgress(player, 'kill_mob', null);
      storyEvent(player, 'kill_mob', { pool: 'ember_mob', mobType: t.mobType });
      t.pendingLoot = rollPendingLoot(preset.lootTable);
      t.lootKillerId = t.pendingLoot.length ? player.id : null;
      return { ok: true, dead: true, dmg, name: preset.name, xp: preset.xp, lootHint: t.pendingLoot.length ? '  Loot is on the body — go claim it!' : '' };
    }
    return { ok: true, dead: true, dmg };
  }
  return { ok: true, dead: false, dmg };
}

// ---------------------------------------------------------------------------
// XP / leveling / skill-point system
// Persisted per account key the same way inventories/bank accounts are;
// guests get ephemeral progress that resets on disconnect, consistent with
// the rest of the guest-identity model.
// ---------------------------------------------------------------------------
const PROGRESS_FILE = path.join(DATA_DIR, 'playerProgress.json');
function loadProgress() { return persistLoad('playerProgress', PROGRESS_FILE); }
function saveProgress() { persistSave('playerProgress', PROGRESS_FILE, playerProgress); }
const playerProgress = loadProgress(); // accountKey -> { xp, level, skillPoints, questCooldowns: {} }
persistRegister('playerProgress', PROGRESS_FILE, () => playerProgress);

// XP needed to reach each level (index = level). Level cap at 20.
const { XP_THRESHOLDS } = require('./data/gameConstants'); // Tier 3.4 Phase A: extracted to data/
const MAX_LEVEL = XP_THRESHOLDS.length - 1;
// 😴 Rested XP: the first REST_MS of a session pays REST_XP_MULT, granted at
// most once per REST_COOLDOWN_MS per account so relogging can't farm it.
const REST_MS = 10 * 60 * 1000;         // 10 minutes of boosted XP per session
const REST_XP_MULT = 1.5;               // +50%
const REST_COOLDOWN_MS = 2 * 60 * 60 * 1000; // one rested window per 2 hours

function getProgress(player) {
  let prog;
  if (player.accountKey) {
    if (!playerProgress[player.accountKey]) {
      playerProgress[player.accountKey] = { xp: 0, level: 1, skillPoints: 0, questCooldowns: {}, pickpocketSuccesses: 0 };
      saveProgress();
    }
    prog = playerProgress[player.accountKey];
  } else {
    if (!player.guestProgress) player.guestProgress = { xp: 0, level: 1, skillPoints: 0, questCooldowns: {}, pickpocketSuccesses: 0 };
    prog = player.guestProgress;
  }
  // Backfills accounts saved before Sleight of Hand's skill-progress system existed.
  if (prog.pickpocketSuccesses === undefined) prog.pickpocketSuccesses = 0;
  // Backfill for accounts saved before the class skill trees existed.
  if (prog.skills === undefined) prog.skills = {};
  return prog;
}

// Award XP to a player, leveling up as many times as thresholds are crossed,
// and broadcasting the change so their HUD updates immediately.
function grantXP(player, amount) {
  if (amount <= 0) return;
  const now = Date.now();
  if (player.activeStatus && player.activeStatus.type === 'wolfpact' && player.activeStatus.expiresAt > now) {
    amount *= 2;
  }
  // Skill-tree progression (Keen Senses / Veteran's Valor / Worldly Wisdom —
  // the 'sage' skill) sweetens every XP award.
  const _xpMult = skillXpMult(player);
  if (_xpMult !== 1) amount = Math.max(1, Math.round(amount * _xpMult));
  // 😴 Rested bonus: the first few minutes of a session pay +50% XP. This
  // softens the campaign's on-ramp for players who drop in for short bursts
  // (the finale is a deliberate multi-hour climb — see the pacing tests — so
  // this eases the *feel* of it without changing the campaign/quest math the
  // gate is built on). Bounded to REST_MS per session and gated per account so
  // it can't be relog-farmed.
  if (player.restedUntil && now < player.restedUntil) {
    amount = Math.round(amount * REST_XP_MULT);
  }
  // 🏮 The Hearthmoon Festival (first Saturday, monthly): +25% XP for
  // everyone, all day — a calendar beat, same transient spirit as Rested.
  if (festivalWindow(now).active) {
    amount = Math.round(amount * FESTIVAL_XP_MULT);
  }
  const prog = getProgress(player);
  const wasLevelOne = prog.level === 1; // level only ever increases, so this alone means "never leveled up before"
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
  // First-ever level-up also awards a Hard Drive — a one-time bonus (never
  // granted again, even if a big XP dump jumps several levels at once
  // here), so every player has a guaranteed path to the note-vault
  // feature instead of relying purely on finding or buying one.
  if (wasLevelOne && leveled) {
    const inv = getInventory(player);
    if (addItemToAccount(inv, 'hard_drive', 1)) {
      if (player.accountKey) saveInventories();
      send(player.ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(player.ws, { type: 'hard_drive_awarded', message: '💽 First level up! A Hard Drive materializes in your pack — check your inventory.' });
    }
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
  player.maxHealth = playerMaxHealth(player);
}

// ---------------------------------------------------------------------------
// Class skill trees — the sink for the skill points earned at every level-up.
// Each of the 5 classes has its own 6-skill tree; each skill takes up to 3
// ranks, and a rank costs 1 point from the account-wide pool (prog.skillPoints,
// same pool that xp/level already share). Allocations are stored PER CLASS
// (prog.skills[charId]) since each class has a different tree — playing the
// Witch never spends the Knight's ranks.
//
// Every skill maps to exactly ONE server-authoritative effect (below), so
// nothing here is a cosmetic number: damage, wards, max health, cooldowns,
// lifesteal, harvest yield, and XP all read these ranks back. Movement speed
// is the one client-applied effect, self-enforced exactly like the game's
// existing speed statuses (ravencloak/speedboost) — consistent with the
// stated no-anti-cheat movement model.
// ---------------------------------------------------------------------------
const SKILL_MAX_RANK = 3;
const { SKILL_FX, SKILL_CATALOG } = require('./data/skills'); // Tier 3.4 Phase A: extracted to data/

function skillTreeFor(charId) { return SKILL_CATALOG[charId] || []; }
function getSkillAlloc(player) {
  const prog = getProgress(player);
  if (!prog.skills) prog.skills = {};
  const key = String(player.charId);
  if (!prog.skills[key]) prog.skills[key] = {};
  return prog.skills[key];
}
// Rank invested in whichever skill in this class's tree carries `effect`
// (each tree has at most one skill per effect).
function skillEffectRank(player, effect) {
  const alloc = getSkillAlloc(player);
  let rank = 0;
  for (const s of skillTreeFor(player.charId)) if (s.effect === effect) rank += (alloc[s.id] || 0);
  return Math.min(SKILL_MAX_RANK, rank);
}
// Skill-only contribution to a derived stat (per-rank magnitude × ranks).
function skillStatContrib(player, statKey) {
  const eff = STAT_SKILL_EFFECT[statKey];
  if (!eff) return 0;
  return (SKILL_STAT_PER_RANK[statKey] || 0) * skillEffectRank(player, eff);
}
// Gear-only contribution: sum every equipped item's EQUIP_STATS[statKey].
function gearStatContrib(player, statKey) {
  let sum = 0;
  for (const slot of EQUIP_SLOTS) {
    const itemId = player[invEquipField(slot)];
    const st = itemId && EQUIP_STATS[itemId];
    if (st && st[statKey]) sum += st[statKey];
  }
  return sum;
}
// Combined skill + gear + (during a delve run) boon contribution — the
// single source of truth every derived stat (and the client stats panel)
// reads from. Delve boons speak the same stat vocabulary, so a run's drafted
// power/guard/vitality/haste/swift/leech simply joins the sum for its
// duration (delveBoonContrib is 0 for anyone not in a run).
function statContrib(player, statKey) { return skillStatContrib(player, statKey) + gearStatContrib(player, statKey) + delveBoonContrib(player, statKey); }

function outgoingDamageMult(player) { return 1 + statContrib(player, 'power'); }
function incomingDamageMult(player) { return Math.max(0.25, 1 - statContrib(player, 'guard')) * delveTakenMult(player); } // floor: 75% max reduction (Glass Souls can push past it)
function playerMaxHealth(player)    { return (player && player.charId != null) ? Math.round(100 + statContrib(player, 'vitality')) : 100; }
function abilityCooldownFor(player, base) { return Math.round(base * (1 - Math.min(0.7, statContrib(player, 'haste')))); } // cap: 70% faster
function skillLifestealFrac(player) { return statContrib(player, 'leech'); }
function skillMendingRate(player)   {
  // mending is skill-only (no gear stat) — plus Witch's Broth boons in a
  // delve, minus everything under a Starving Moon (the -Infinity sentinel).
  const delve = delveMendingBonus(player);
  if (delve === -Infinity) return 0;
  return SKILL_FX.mending(skillEffectRank(player, 'mending')) + delve;
}
function skillHarvestExtraChance(player) {
  // 🏮 Festival day sweetens every forager's odds (Session L).
  return statContrib(player, 'forage') + (festivalWindow(Date.now()).active ? FESTIVAL_FORAGE_BONUS : 0);
}
function skillXpMult(player)        { return 1 + statContrib(player, 'xp'); }
function skillSpeedMult(player)     { return 1 + statContrib(player, 'swift'); }

// Full derived-stat readout for the client stats panel: base values, the
// split of skill vs gear contribution, and the final numbers. `equipOverride`
// (slot->itemId, or null to clear) lets the client preview a hypothetical
// swap by asking the server to recompute as if that slot held that item.
function computeStatBlock(player, equipOverride) {
  // Shallow proxy so gearStatContrib sees the hypothetical loadout without
  // mutating the real player.
  const view = player;
  const savedField = {}, hasOverride = equipOverride && equipOverride.slot;
  if (hasOverride) {
    const f = invEquipField(equipOverride.slot);
    savedField.f = f; savedField.v = player[f];
    player[f] = equipOverride.itemId || null;
  }
  const out = { power: {}, guard: {}, vitality: {}, haste: {}, swift: {}, leech: {}, xp: {}, forage: {} };
  for (const k of STAT_KEYS) {
    out[k] = { skill: skillStatContrib(view, k), gear: gearStatContrib(view, k), total: statContrib(view, k) };
  }
  const block = {
    stats: out,
    maxHealth: playerMaxHealth(view),
    // convenience finals the panel prints directly
    finals: {
      attackMult: outgoingDamageMult(view),
      damageReduction: 1 - incomingDamageMult(view),
      maxHealth: playerMaxHealth(view),
      speedMult: skillSpeedMult(view),
      cooldownReduction: Math.min(0.7, statContrib(view, 'haste')),
      lifesteal: skillLifestealFrac(view),
      xpBonus: statContrib(view, 'xp'),
      harvestLuck: skillHarvestExtraChance(view),
      mendingRate: skillMendingRate(view)
    }
  };
  if (hasOverride) player[savedField.f] = savedField.v;
  return block;
}
// Heal the attacker for their lifesteal share of damage just dealt.
function applySkillLifesteal(player, dmgDealt) {
  const f = skillLifestealFrac(player);
  if (f <= 0 || player.isDead || player.health <= 0) return;
  player.health = Math.min(playerMaxHealth(player), player.health + Math.max(1, Math.round(dmgDealt * f)));
}
function skillStatePayload(player) {
  const prog = getProgress(player);
  const alloc = getSkillAlloc(player);
  return {
    charId: player.charId,
    skillPoints: prog.skillPoints,
    maxHealth: playerMaxHealth(player),
    speedMult: skillSpeedMult(player),
    // Full derived-stat readout (skill vs gear split + finals) for the
    // character stats panel — recomputed here so it's always current with
    // both the skill allocation AND whatever's equipped.
    statBlock: computeStatBlock(player),
    skills: skillTreeFor(player.charId).map(s => ({
      id: s.id, name: s.name, icon: s.icon, desc: s.desc, effect: s.effect,
      rank: alloc[s.id] || 0, maxRank: SKILL_MAX_RANK
    }))
  };
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
const { QUEST_CATALOG } = require('./data/quests'); // Tier 3.4 Phase A: extracted to data/
// Reverse-lookup: npcId → questId
// npcId → [questId, …] (an NPC can carry more than one job now — the Session M
// creature hunts share the existing quest-givers rather than needing a wave of
// new NPCs). questForNpc() picks which one to surface for a given player.
const QUEST_BY_NPC = {};
for (const [id, q] of Object.entries(QUEST_CATALOG)) {
  (QUEST_BY_NPC[q.npcId] = QUEST_BY_NPC[q.npcId] || []).push(id);
}
// Which of an NPC's quests applies to THIS player right now: the one they're
// already on with this NPC, else the first not on cooldown, else the first
// (so the caller can still show a coherent "come back later").
function questForNpc(player, npcId) {
  const list = QUEST_BY_NPC[npcId];
  if (!list || !list.length) return null;
  if (player.activeQuest) {
    const aq = QUEST_CATALOG[player.activeQuest.questId];
    if (aq && aq.npcId === npcId) return player.activeQuest.questId;
  }
  const prog = getProgress(player);
  for (const qid of list) {
    const last = prog.questCooldowns && prog.questCooldowns[qid];
    if (!last || Date.now() - last >= QUEST_COOLDOWN_MS) return qid;
  }
  return list[0];
}

// Creature quarry → display label + where-to-find, for quest text/hints.
const CREATURE_LABEL = {
  embermoth: 'Embermoths', thistlehog: 'Thistlehogs', duskfawn: 'Duskfawn', mirefowl: 'Mirefowl',
  bramble_boar: 'Bramble Boars', mossback_tortoise: 'Mossback Tortoises', gravewing_crow: 'Gravewing Crows',
  fen_hexer: 'Fen Hexers', rot_swarm: 'Grave-Mites', barrow_maw: 'Barrow Maws', gloom_bat: 'Gloom Bats',
  old_marrowe: 'Old Marrowe, the Gallows Warden',
};

function advanceQuestProgress(player, eventType, itemId) {
  const aq = player.activeQuest;
  if (!aq) return;
  const quest = QUEST_CATALOG[aq.questId];
  if (!quest) return;
  let matches = false;
  if (quest.type === 'kill_mob' && eventType === 'kill_mob') matches = true;
  if (quest.type === 'harvest_plant' && eventType === 'harvest_plant') matches = true;
  if (quest.type === 'harvest_specific' && eventType === 'harvest_plant' && itemId === quest.targetItemId) matches = true;
  // Creature-specific hunts (Session M): the killed creature's type is passed
  // as the itemId arg, so only the right quarry counts.
  if (quest.type === 'kill_creature' && eventType === 'kill_creature' && itemId === quest.targetCreature) matches = true;
  if (!matches) return;

  aq.progress++;
  if (aq.progress >= quest.target) {
    player.activeQuest = null;
    grantXP(player, quest.xpReward);
    const prog = getProgress(player);
    prog.questCooldowns[aq.questId] = Date.now();
    // A permanent "has ever finished this" record, on top of the rolling
    // cooldown — this is what makes you a REGULAR at that NPC's shop
    // (see shopDiscountFor), and what a good disguise can borrow.
    if (!prog.questsDone) prog.questsDone = {};
    prog.questsDone[aq.questId] = true;
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
    const remaining = quest.target - aq.progress;
    send(player.ws, {
      type: 'quest_update',
      questId: aq.questId,
      questName: quest.name,
      progress: aq.progress,
      target: quest.target,
      where: objectiveWhere({ type: quest.type, targetItemId: quest.targetItemId, targetCreature: quest.targetCreature }),
      nearlyThere: remaining === 1,
      message: remaining === 1
        ? `🗒️ ${quest.name} — ONE more to go!`
        : `🗒️ ${quest.name} — ${aq.progress}/${quest.target}`
    });
  }
}

// Regulars discount — finish a shopkeeper's own side quest once, ever, and
// they knock 15% off for you from then on. Two ways to qualify at the till:
// be that person, or convincingly LOOK like that person (cm_disguise) — a
// mask of the tavern's favorite customer gets the tavern's favorite prices.
// Identity lookup for a disguise goes through the accounts store by the
// displayed name, since account display names ARE usernames; a mask of a
// guest (or a made-up face) earns nothing, because there's no durable
// identity behind it to have ever earned anything.
const SHOP_REGULARS_DISCOUNT = 0.15;
function shopDiscountFor(player, npcId) {
  const list = QUEST_BY_NPC[npcId];
  if (!list || !list.length) return 0;
  // A "regular" is anyone who's ever finished ANY of this NPC's jobs.
  const doneAny = (prog) => !!(prog && prog.questsDone && list.some(qid => prog.questsDone[qid]));
  if (doneAny(getProgress(player))) return SHOP_REGULARS_DISCOUNT;
  if (player.disguise) {
    const identityKey = String(player.disguise.name || '').toLowerCase();
    const identityProg = accounts[identityKey] ? playerProgress[identityKey] : null;
    if (doneAny(identityProg)) return SHOP_REGULARS_DISCOUNT;
  }
  return 0;
}
function discountedPrice(price, discount) {
  if (!discount) return price;
  return Math.max(1, Math.round(price * (1 - discount)));
}

// ── Story campaigns — one spooky quest-chain per character class ─────────────
// Each of the 5 characters has their own 6-chapter storyline set in the same
// Thornreach lore as the faction quests above (the Hollow, the shattered
// Fifth Severance, Witch Hazel beneath the Wilds). Unlike side quests these
// are: (a) class-gated — you only ever see the storyline for the charId you
// joined as; (b) sequential — chapters unlock strictly in order; (c) run in
// PARALLEL with the single active side quest (player.activeQuest), tracked
// separately, so taking Ranger Mara's cull never pauses your campaign.
//
// Progress is persisted per account in playerProgress[key].story, keyed by
// charId — the character look is a per-session pick, so an account that
// plays Witch on Monday and Knight on Tuesday keeps two independent
// campaign positions. Guests get the same shape on their ephemeral
// guestProgress, consistent with every other guest system here.
//
// Chapter objective types (each has a matching storyEvent() call at the
// action's real handler — see objectiveMatches below):
//   kill_mob                          — any hostile kill that grants quest credit
//   harvest_plant / harvest_specific  — Wilds gathering (itemId for specific)
//   talk_npc  (npcId)                 — interact with a named NPC (quest/shop/hint givers)
//   visit_room (room)                 — set foot in a specific room/zone
//   cast_ability                      — use your class's spells/attacks N times
//   craft_potion                      — brew anything at Witch Hazel's cauldron
// ─────────────────────────────────────────────────────────────────────────────
const { STORYLINES } = require('./data/quests'); // Tier 3.4 Phase A: extracted to data/

// ── Chapter level gates — the campaign's pacing spine ────────────────────────
// Each chapter demands a minimum level before "Begin Chapter" unlocks:
//   ch1 ch2 ch3 ch4 ch5 ch6
//    1   2   3   4   6   8
// Why gates at all: a campaign that can be sprinted start-to-finish in 25
// minutes evaporates as an experience. The gates make the town's OTHER
// systems — side quests, night hunts, harvesting, dungeons — the road
// between chapters instead of detours nobody takes: reaching Level 8
// (3000 XP) means roughly two-plus hours of actual play for the finale.
// The design leans on a few well-worn psychological levers, deliberately:
//  - Goal gradient: the Journal shows the whole 6-chapter arc with your
//    position in it, so there's always a visibly-shrinking distance left.
//  - Zeigarnik (open loops): a gated next chapter is an unfinished thing;
//    the HUD tracker + "unlocks at Level N" line keeps the loop open with
//    a concrete next step instead of a vague wall.
//  - Competence, not time-walls: gates are LEVELS, never timers — the
//    player is always one more hunt/quest away, never told to go wait.
const { CHAPTER_LEVEL_GATES } = require('./data/quests'); // Tier 3.4 Phase A: extracted to data/
for (const line of Object.values(STORYLINES)) {
  line.chapters.forEach((ch, i) => {
    if (ch.requiresLevel === undefined) ch.requiresLevel = CHAPTER_LEVEL_GATES[i] || 1;
  });
}

// Where-to-go hints, derived from the objective. The #1 complaint with the
// old system was a prose label with no directions — every story_update and
// Journal render now carries a concrete "where" line.
const NPC_WHEREABOUTS = {
  npc_lyra: 'town square — she wanders near the fountain',
  npc_dex: 'town square — look for the hunter pacing the paths',
  npc_mara: 'town square, by her stall',
  npc_finn: 'town square, by his stall',
  npc_scholar: '📚 the Library, behind the counter',
  npc_bartender: '☕ the Cafe, behind the bar',
  npc_apothecary: '☕ the Cafe — corner table with the vials',
  npc_tailor: '🏛️ Town Hall, by the banners',
  npc_armorer: '🏛️ Town Hall, at the armor rack',
  npc_patron: '☕ the Cafe — Old Mabel at her usual table',
  npc_apprentice: '🎮 the Starlight Arcade (Town Pass building)',
  npc_tinkerer: '🎮 the Starlight Arcade (Town Pass building)',
  npc_noble: '👻 the Phantom Parlor (Town Pass building)',
  npc_knight: '🏛️ Town Hall — Sir Dorran on guard duty',
  npc_guard: '🏦 the Bank, by the door'
};
function objectiveWhere(obj) {
  if (obj.where) return obj.where;
  switch (obj.type) {
    case 'talk_npc': return NPC_WHEREABOUTS[obj.npcId] || 'ask around town';
    case 'harvest_plant': return 'the Wilds — pick the glowing plants (portal at the north edge of town)';
    case 'harvest_specific': return 'the Wilds — hunt for the right plant among the glowing ones';
    case 'visit_room':
      if (obj.room === 'witch_cave') return 'north-west Wilds — the cave mouth where no rabbits graze';
      if (obj.room === 'wilds') return 'through the Wilds portal at the north edge of town';
      { const b = WORLD.buildings.find(x => x.id === obj.room); return b ? `${b.name}, in town` : obj.room; }
    case 'cast_ability': return 'anywhere — open your kit (hotbar keys 1–9) and let fly';
    case 'kill_mob': return 'wait for 🌕 night — creatures rise at the town edges, in the Wilds, and below';
    case 'kill_creature': {
      const label = CREATURE_LABEL[obj.targetCreature] || 'the quarry';
      if (obj.targetCreature === 'old_marrowe') return 'the Wilds — only on a 🌒 Blood Moon night does the Gallows Warden rise';
      const nightHunt = ['fen_hexer', 'rot_swarm', 'barrow_maw', 'gloom_bat'].includes(obj.targetCreature);
      return nightHunt ? `the Wilds after 🌕 nightfall — hunt the ${label}` : `the Wilds — track down the ${label} (portal at the north edge of town)`;
    }
    case 'craft_potion': return "Hazel's cauldron, inside her cave (north-west Wilds)";
    default: return '';
  }
}

// Ensure prog.story exists (backfills accounts saved before the campaign
// system existed, same pattern as the pickpocketSuccesses backfill).
function getStoryState(player) {
  const prog = getProgress(player);
  if (!prog.story) prog.story = {};
  if (!prog.story[player.charId]) prog.story[player.charId] = { chapter: 0, progress: 0, active: false };
  return prog.story[player.charId];
}

// Everything the Journal needs to render this player's campaign, in one
// payload — sent on join, on request, and after every begin/complete.
function storyStatePayload(player) {
  const line = STORYLINES[player.charId];
  if (!line) return { type: 'story_state', storyline: null };
  const st = getStoryState(player);
  const done = st.chapter >= line.chapters.length;
  const chapter = done ? null : line.chapters[st.chapter];
  const level = getProgress(player).level || 1;
  return {
    type: 'story_state',
    storyline: {
      charId: player.charId,
      title: line.title, icon: line.icon, tagline: line.tagline,
      totalChapters: line.chapters.length,
      chapterIndex: st.chapter,
      complete: done,
      active: st.active,
      progress: st.progress,
      // The whole arc, titles + gates only — lets the Journal draw the full
      // 6-chapter map with your position on it (a visible road shrinks;
      // an invisible one just feels endless).
      arc: line.chapters.map((c, i) => ({
        title: c.title, requiresLevel: c.requiresLevel,
        state: i < st.chapter ? 'done' : (i === st.chapter ? 'current' : 'ahead')
      })),
      chapter: chapter ? {
        id: chapter.id, title: chapter.title, intro: chapter.intro,
        objectiveLabel: chapter.objective.label, target: chapter.objective.target,
        where: objectiveWhere(chapter.objective),
        requiresLevel: chapter.requiresLevel,
        levelOk: level >= chapter.requiresLevel,
        playerLevel: level,
        xpReward: chapter.xpReward, goldReward: chapter.goldReward,
        itemRewards: (chapter.itemRewards || []).map(r => ({
          itemId: r.itemId, qty: r.qty || 1,
          name: ITEM_CATALOG[r.itemId] ? ITEM_CATALOG[r.itemId].name : r.itemId,
          icon: ITEM_CATALOG[r.itemId] ? ITEM_CATALOG[r.itemId].icon : '❔'
        }))
      } : null
    }
  };
}

function objectiveMatches(obj, eventType, detail) {
  if (obj.type === 'kill_mob') return eventType === 'kill_mob';
  if (obj.type === 'harvest_plant') return eventType === 'harvest_plant';
  if (obj.type === 'harvest_specific') return eventType === 'harvest_plant' && detail.itemId === obj.itemId;
  if (obj.type === 'talk_npc') return eventType === 'talk_npc' && detail.npcId === obj.npcId;
  if (obj.type === 'visit_room') return eventType === 'visit_room' && detail.room === obj.room;
  if (obj.type === 'cast_ability') return eventType === 'cast_ability';
  if (obj.type === 'craft_potion') return eventType === 'craft_potion';
  return false;
}

// The campaign's advanceQuestProgress — called from the same real action
// sites side quests hook (kills, harvests) plus the campaign-only ones
// (talks, room visits, ability casts, crafting). Deliberately separate
// from player.activeQuest so a side quest and a chapter can both tick off
// the same kill.
function storyEvent(player, eventType, detail = {}) {
  // First Steps piggyback (Session L): every talk/harvest/kill already
  // funnels through here, so the newcomer tracker needs no extra call sites.
  if (eventType === 'kill_mob') noteFirstStep(player, 'killed');
  else if (eventType === 'harvest_plant') noteFirstStep(player, 'harvested');
  else if (eventType === 'talk_npc') noteFirstStep(player, 'talked');
  const line = STORYLINES[player.charId];
  if (!line) return;
  const st = getStoryState(player);
  if (!st.active || st.chapter >= line.chapters.length) return;
  const chapter = line.chapters[st.chapter];
  if (!objectiveMatches(chapter.objective, eventType, detail)) return;

  st.progress++;
  if (st.progress < chapter.objective.target) {
    if (player.accountKey) saveProgress();
    const remaining = chapter.objective.target - st.progress;
    send(player.ws, {
      type: 'story_update',
      chapterTitle: chapter.title,
      objectiveLabel: chapter.objective.label,
      where: objectiveWhere(chapter.objective),
      progress: st.progress,
      target: chapter.objective.target,
      // Goal-gradient flourish: the last step before completion gets its
      // own louder phrasing — near-finished goals pull hardest, so say
      // it out loud when the player is one action away.
      nearlyThere: remaining === 1,
      message: remaining === 1
        ? `📖 ${chapter.title} — ONE more to go!`
        : `📖 ${chapter.title} — ${st.progress}/${chapter.objective.target}`
    });
    return;
  }

  // Chapter complete — grant rewards (same flow as quest completion above),
  // advance to the next chapter (left inactive so the player reads the
  // outro and begins it from the Journal when ready).
  st.chapter++;
  st.progress = 0;
  st.active = false;
  grantXP(player, chapter.xpReward);
  if (chapter.goldReward && player.accountKey) {
    const acct = ensureBankAccount(player.accountKey);
    acct.balance += chapter.goldReward;
    saveBankAccounts();
  }
  const inv = getInventory(player);
  const itemsGranted = [];
  if (chapter.itemRewards) {
    for (const r of chapter.itemRewards) {
      if (addItemToAccount(inv, r.itemId, r.qty || 1)) {
        const meta = ITEM_CATALOG[r.itemId];
        itemsGranted.push(`${meta ? meta.icon : '?'} ${meta ? meta.name : r.itemId}`);
        send(player.ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      }
    }
    if (player.accountKey) saveInventories();
  }
  if (player.accountKey) saveProgress();

  const storyDone = st.chapter >= line.chapters.length;
  const rewardParts = [`+${chapter.xpReward} XP`];
  if (chapter.goldReward) rewardParts.push(`+${chapter.goldReward}🪙${player.accountKey ? '' : ' (lost — guests have no bank)'}`);
  if (itemsGranted.length) rewardParts.push(itemsGranted.join(', '));
  // What's next, spelled out — if the following chapter is level-gated
  // above the player, say so HERE, at the moment of triumph, so the gate
  // reads as "here's your next goal" rather than a surprise wall later.
  const nextCh = storyDone ? null : line.chapters[st.chapter];
  const level = getProgress(player).level || 1;
  let nextHint = '';
  if (nextCh) {
    nextHint = level >= nextCh.requiresLevel
      ? ` Next: "${nextCh.title}" — begin it from your Journal (J).`
      : ` Next: "${nextCh.title}" unlocks at Level ${nextCh.requiresLevel} (you're ${level}) — side quests and night hunts are the fastest XP.`;
  }
  send(player.ws, {
    type: 'story_chapter_complete',
    chapterTitle: chapter.title,
    outro: chapter.outro,
    rewards: rewardParts.join(' · '),
    storyComplete: storyDone,
    chapterIndex: st.chapter,
    totalChapters: line.chapters.length,
    nextRequiresLevel: nextCh ? nextCh.requiresLevel : null,
    message: storyDone
      ? `📖 "${chapter.title}" complete — ${rewardParts.join(' · ')} · ${line.icon} THE STORY IS COMPLETE.`
      : `📖 Chapter ${st.chapter}/${line.chapters.length} complete: "${chapter.title}" — ${rewardParts.join(' · ')}.${nextHint}`
  });
  // Finishing a whole campaign is town news — everyone hears the bell.
  // (Public recognition is half the reward; it also quietly advertises
  // that the campaigns exist to players who haven't started theirs.)
  if (storyDone) {
    broadcastAll({
      type: 'announce',
      message: `${line.icon} ${player.name} has completed "${line.title}" and claimed its relic!`
    });
  }
  send(player.ws, storyStatePayload(player));
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
  return {
    hasPassword: !!hd.passwordHash,
    notes: hd.notes,
    capacity: HARDDRIVE_NOTE_CAPACITY,
    selfies: hd.selfies || [],
    clips: hd.clips || [],
    selfieCapacity: HARDDRIVE_SELFIE_CAPACITY,
    clipCapacity: HARDDRIVE_CLIP_CAPACITY
  };
}

// Media on the Hard Drive — selfies and voice clips, the raw material for
// the countermeasure mechanics (cm_voice / cm_disguise below). Selfies are
// self-captured (the same consent-first camera flow Hazel's shop uses) or
// copied off an image note someone chose to send you; clips are your own
// mic recordings. Media rides the same vault object as notes and persists
// the same way (hardDrives.json for accounts, in-memory for guests).
const HARDDRIVE_SELFIE_CAPACITY = 8;
const HARDDRIVE_CLIP_CAPACITY = 6;
function driveMedia(hd) {
  if (!hd.selfies) hd.selfies = [];
  if (!hd.clips) hd.clips = [];
  return hd;
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
const LISTINGS_FILE = path.join(DATA_DIR, 'listings.json');
function loadListings() {
  const d = persistLoad('listings', LISTINGS_FILE);
  return Array.isArray(d) ? d : [];
}
function saveListings() { persistSave('listings', LISTINGS_FILE, listings); }
let listings = loadListings();
persistRegister('listings', LISTINGS_FILE, () => listings);

const AUCTION_DURATIONS_MS = { 1: 3600000, 12: 12 * 3600000, 24: 24 * 3600000 };
// Moonstone-lane house cut, taken from the seller's proceeds at resolution.
const AUCTION_MS_FEE = 0.10;
// Selfie listings run much shorter than item listings — minutes, not hours
// — since guests (who can list selfies but have no bank account to escrow
// gold for a long-running auction) are expected to be the main sellers.
const SELFIE_AUCTION_DURATIONS_MS = { 5: 5 * 60000, 10: 10 * 60000, 20: 20 * 60000 };

function publicListing(l) {
  return {
    id: l.id, sellerName: l.sellerName, itemId: l.itemId || null, qty: l.qty || null,
    currency: l.currency || 'gold',
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
function pushInventoryStateIfOnline(key) {
  const p = findConnectionByAccountKey(key);
  if (p) send(p.ws, { type: 'inventory_state', ...inventoryStatePayload(p) });
}

// Hands an unsold (or undeliverable) item listing back to its seller.
// Inventory-sourced listings (players can now list straight from their
// pack, no bank deposit round-trip) go back into the pack they came from,
// falling back to the bank vault if the pack is full in the meantime.
// Bank-sourced listings return to the vault as they always have. Works
// for offline sellers too: a logged-in seller's pack lives in
// inventories.json keyed by the same account key as their vault, so both
// destinations are reachable whether or not they're connected. (Item
// listings always have a sellerKey — guests can't create them.)
function returnListingItemToSeller(listing) {
  if (listing.source === 'inventory' && inventories[listing.sellerKey] &&
      addItemToAccount(inventories[listing.sellerKey], listing.itemId, listing.qty)) {
    saveInventories();
    pushInventoryStateIfOnline(listing.sellerKey);
    return;
  }
  const sellerAccount = ensureBankAccount(listing.sellerKey);
  addItemToAccount(sellerAccount, listing.itemId, listing.qty);
  saveBankAccounts();
  pushBankStateIfOnline(listing.sellerKey);
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
        if (winner.accountKey) saveInboxes();
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
        if (winner.accountKey) saveInboxes();
        send(winner.ws, { type: 'note_received', note });
      }
    }
    saveListings();
    return;
  }

  if (listing.currentBidderKey) {
    const isMs = (listing.currency || 'gold') === 'ms';
    const winnerAccount = ensureBankAccount(listing.currentBidderKey);
    const added = addItemToAccount(winnerAccount, listing.itemId, listing.qty);
    if (added) {
      if (isMs) {
        // Moonstone lane: the house keeps AUCTION_MS_FEE of the hammer
        // price (a deliberate sink — Moonstones must leave circulation
        // somewhere, or nobody ever needs to buy a fresh pack). The seller
        // sees the fee up front when listing.
        const net = Math.floor(listing.currentBid * (1 - AUCTION_MS_FEE));
        msAdjust(listing.sellerKey, net);
        const seller = findConnectionByAccountKey(listing.sellerKey);
        if (seller) send(seller.ws, { type: 'auction_payout', message: `💎 Your ${ITEM_CATALOG[listing.itemId] ? ITEM_CATALOG[listing.itemId].name : 'item'} sold for ${listing.currentBid} Moonstones — ${net} after the house's cut.` });
        pushMsStateIfOnline(listing.sellerKey);
        saveBankAccounts();
      } else {
        const sellerAccount = ensureBankAccount(listing.sellerKey);
        sellerAccount.balance += listing.currentBid;
        saveBankAccounts();
      }
      pushBankStateIfOnline(listing.sellerKey);
      pushBankStateIfOnline(listing.currentBidderKey);
    } else {
      // Winner's bank is full — refund their escrowed bid and hand the
      // item back to the seller instead of losing it. (If the seller's
      // destination is also full it falls back vault-ward inside the
      // helper; a double-full loss remains the rare acceptable edge.)
      if (isMs) { msAdjust(listing.currentBidderKey, listing.currentBid); pushMsStateIfOnline(listing.currentBidderKey); }
      else winnerAccount.balance += listing.currentBid;
      saveBankAccounts();
      returnListingItemToSeller(listing);
      pushBankStateIfOnline(listing.currentBidderKey);
    }
  } else {
    // No bids — the item goes back to wherever the seller listed it from
    // (their pack for an inventory-sourced listing, their bank vault
    // otherwise).
    returnListingItemToSeller(listing);
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
    activeStatus: status, health: p.health, maxHealth: playerMaxHealth(p),
    level: p.level || 1, skillPoints: p.skillPoints || 0,
    isDead: !!p.isDead,
    // Disguise identity (see cm_disguise): only the NAME rides the 70ms
    // state broadcast — the mask image itself is heavy (a data URL) and
    // is delivered exactly once per change via 'disguise_state', which
    // clients cache by player id.
    disguiseName: p.disguise ? p.disguise.name : null,
    // Corpse loot — deathX/Y/Room are only meaningful while hasLoot is true;
    // they mark the fixed spot the body fell, independent of wherever the
    // ghost wanders off to afterward (see the 'strike' PvP branch above).
    hasLoot: !!(p.pendingLoot && p.pendingLoot.length),
    deathX: p.deathX, deathY: p.deathY, deathRoom: p.deathRoom
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
// hub (1600, 1100), each with an assigned NPC who lives at the Temple (a
// standalone shrine near the tree line at the back/south of town — see
// buildTownTemple() in client.js). Every morning they walk back to the
// temple and stay there; the moment night falls, all four walk out from the
// temple to their torch and light it together, then stay there till dawn.
//
// This has to be real per-NPC tick state (x/y/facing/working mutated every
// interval, like the Wilds' village NPCs below) rather than a pure
// Date.now()-derived formula: "walk to the torch"/"walk to the temple" both
// have to interpolate from wherever that NPC actually was the moment the
// edge hit, not a fixed point — duskX/duskY+ritualStartAt (night edge) and
// dawnX/dawnY+templeWalkStartAt (day edge) are each captured once, right on
// their respective transition (the same instant for all four, since
// isNightNow() is one shared boolean), so using elapsed-time/duration (not
// distance/speed) for progress still guarantees every torch lights — and
// every NPC arrives home — at exactly the same moment regardless of how far
// any individual NPC had to walk.
// ---------------------------------------------------------------------------
const { TOWN_TORCHES } = require('./data/townDecor'); // Tier 3.4 Phase A: extracted to data/
// The altar itself, at the temple structure's own center — where the Ember
// Wastes portal hovers once it's open (see templePortalOpen(), enter_ember_wastes),
// and also where the Torchkeepers gather by day now (see TEMPLE_STAND_OFFSETS).
const { TEMPLE_ALTAR } = require('./data/townDecor'); // Tier 3.4 Phase A: extracted to data/
// The temple platform's footprint (mirrors client TEMPLE_PLATFORM_*) plus a
// walk-in point at its north (townward) edge. Torchkeeper walks that would
// cross the platform get routed through this gate instead of clipping
// through the corner pillars (user-reported, Session I).
const { TEMPLE_RECT, TEMPLE_GATE } = require('./data/townDecor'); // Tier 3.4 Phase A: extracted to data/
function segCrossesTempleRect(x1, y1, x2, y2) {
  // Conservative segment-vs-AABB (slab) test, rect inflated a pillar's width.
  const pad = 16;
  const minX = TEMPLE_RECT.x - pad, maxX = TEMPLE_RECT.x + TEMPLE_RECT.w + pad;
  const minY = TEMPLE_RECT.y - pad, maxY = TEMPLE_RECT.y + TEMPLE_RECT.h + pad;
  const dx = x2 - x1, dy = y2 - y1;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, x1 - minX], [dx, maxX - x1], [-dy, y1 - minY], [dy, maxY - y1]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}
// Point (and walk direction) along from→to at `progress`, detouring through
// TEMPLE_GATE when the direct line would cross the platform. Constant speed
// across the whole (possibly two-leg) path, so the existing fixed-duration
// lerp architecture is preserved exactly.
function torchWalkPoint(fromX, fromY, toX, toY, progress) {
  const legs = segCrossesTempleRect(fromX, fromY, toX, toY)
    ? [[fromX, fromY, TEMPLE_GATE.x, TEMPLE_GATE.y], [TEMPLE_GATE.x, TEMPLE_GATE.y, toX, toY]]
    : [[fromX, fromY, toX, toY]];
  const lens = legs.map(([ax, ay, bx, by]) => Math.hypot(bx - ax, by - ay));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let d = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 0; i < legs.length; i++) {
    if (d <= lens[i] || i === legs.length - 1) {
      const [ax, ay, bx, by] = legs[i];
      const t = lens[i] ? Math.min(1, d / lens[i]) : 1;
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dirX: bx - ax, dirY: by - ay };
    }
    d -= lens[i];
  }
  return { x: toX, y: toY, dirX: toX - fromX, dirY: toY - fromY };
}
// Where each NPC kneels by day, relative to TEMPLE_ALTAR — a small diamond
// ring around the altar (radius ~65, clear of its 64-unit-wide footprint
// and well inside the platform's edges) rather than stacking on one point.
const { TEMPLE_STAND_OFFSETS, TORCH_NPCS } = require('./data/townDecor'); // Tier 3.4 Phase A: extracted to data/
// Seed everyone kneeling at the altar already, so the steady-state (server
// freshly started, mid-day) looks right without waiting for a fake "walk in".
TORCH_NPCS.forEach((n, i) => {
  n.x = TEMPLE_ALTAR.x + TEMPLE_STAND_OFFSETS[i].dx;
  n.y = TEMPLE_ALTAR.y + TEMPLE_STAND_OFFSETS[i].dy;
  n.dawnX = n.x; n.dawnY = n.y; n.templeWalkStartAt = -Infinity; // -Infinity => progress clamps to 1 (already arrived)
});
let torchNpcsWasNight = false;
const NIGHT_RITUAL_WALK_MS = 6000; // how long the walk-to-torch takes once night falls
const MORNING_TEMPLE_WALK_MS = 6000; // how long the walk-to-temple takes once day breaks
// Must be >= the ritual torch's PointLight `distance` (260, see
// buildTownRitualTorch in client.js) — it was 180 before, so a player
// standing well inside the torch's visible glow (180-260 units out) looked
// "lit up" but was outside the heal check and never got healed.
const TORCH_HEAL_RADIUS = 260;
const TORCH_STAND_BACK = 45; // how far short of the torch's own coordinate an NPC stops

function tickTorchNpcs(dt) {
  const night = isNightNow();
  const justTurnedNight = night && !torchNpcsWasNight;
  const justTurnedDay = !night && torchNpcsWasNight;
  torchNpcsWasNight = night;
  const now = Date.now();

  TORCH_NPCS.forEach((n, i) => {
    if (justTurnedNight) {
      n.duskX = n.x;
      n.duskY = n.y;
      n.ritualStartAt = now;
    }
    if (justTurnedDay) {
      n.dawnX = n.x;
      n.dawnY = n.y;
      n.templeWalkStartAt = now;
    }

    if (night) {
      const torch = TOWN_TORCHES[n.torchIdx];
      const dx = torch.x - n.duskX, dy = torch.y - n.duskY;
      const dist = Math.hypot(dx, dy) || 1;
      const standX = torch.x - (dx / dist) * TORCH_STAND_BACK;
      const standY = torch.y - (dy / dist) * TORCH_STAND_BACK;
      const progress = Math.min(1, (now - n.ritualStartAt) / NIGHT_RITUAL_WALK_MS);
      const pt = torchWalkPoint(n.duskX, n.duskY, standX, standY, progress);
      n.x = pt.x;
      n.y = pt.y;
      if (progress < 1) {
        n.facing = Math.atan2(pt.dirX, pt.dirY); // face along the walked leg
      } else {
        // Standing at the torch, lighting it: face the town's center
        // (where players actually are), not the torch pole itself.
        n.facing = Math.atan2(WORLD.spawn.x - n.x, WORLD.spawn.y - n.y);
      }
      n.working = progress >= 1;
      n.praying = false;
    } else {
      const off = TEMPLE_STAND_OFFSETS[i];
      const targetX = TEMPLE_ALTAR.x + off.dx, targetY = TEMPLE_ALTAR.y + off.dy;
      const progress = Math.min(1, (now - n.templeWalkStartAt) / MORNING_TEMPLE_WALK_MS);
      const pt = torchWalkPoint(n.dawnX, n.dawnY, targetX, targetY, progress);
      n.x = pt.x;
      n.y = pt.y;
      if (progress < 1) {
        n.facing = Math.atan2(pt.dirX, pt.dirY); // face along the walked leg
      } else {
        // Kneeling at the altar: face inward toward it, not out toward the
        // town square — they're praying together, not standing watch.
        n.facing = Math.atan2(TEMPLE_ALTAR.x - n.x, TEMPLE_ALTAR.y - n.y);
      }
      n.working = false;
      n.praying = progress >= 1;
    }
  });
}

function torchNpcPublicState() {
  return TORCH_NPCS.map(n => ({ id: n.id, charId: n.charId, name: n.name, x: n.x, y: n.y, facing: n.facing, working: n.working, praying: !!n.praying }));
}

function townTorchPublicState() {
  return TOWN_TORCHES.map((t, idx) => {
    const npc = TORCH_NPCS.find(n => n.torchIdx === idx);
    return { id: t.id, x: t.x, y: t.y, lit: !!(npc && npc.working) };
  });
}

// A hurt player standing near any lit torch mends gradually rather than
// snapping to full — TORCH_HEAL_RATE_PER_SEC HP per second, so a full
// 0->100 heal takes a few seconds of actually standing in the light, not
// an instant fix. The one-time "warmth begins to mend you" toast is still
// edge-triggered off player.nearLitTorch (was near last tick? no -> yes),
// so going off to the Wilds, getting hurt, and walking back in announces
// itself again instead of only ever once; leaving mid-heal (any room
// change away from 'outside', or just walking out of range) stops the
// regen immediately since "near" is recomputed fresh every tick.
const TORCH_HEAL_RATE_PER_SEC = 25; // 0 -> 100 in ~4s of standing in the light
// Wilds campfires — always-lit rest stops spaced along the routes between
// the landmarks (spawn road, the village↔circle meadow, the camp's edge,
// the cave approach, the far north). Stand in the warmth and wounds mend;
// same mechanic as the town's ritual torches, minus the night gating.
// Positions are mirrored in client.js (WILDS_CAMPFIRES there) for the
// visuals — keep the two lists identical.
const { WILDS_CAMPFIRES } = require('./data/townDecor'); // Tier 3.4 Phase A: extracted to data/
const CAMPFIRE_HEAL_RADIUS = 220;
const CAMPFIRE_HEAL_RATE_PER_SEC = 20;

// Weathered waymarkers — five standing stones scattered along the Wilds
// routes, each carrying a piece of the Thornreach lore the campaigns are
// built on. Walk up, press F (or tap the pill), read. Positions mirrored
// in client.js (WILDS_WAYMARKERS there) for the visuals + interact kiosks.
const { WAYMARKER_LORE } = require('./data/townDecor'); // Tier 3.4 Phase A: extracted to data/

function tickTorchHealing(dt) {
  const litTorches = TOWN_TORCHES.filter((t, idx) => {
    const npc = TORCH_NPCS.find(n => n.torchIdx === idx);
    return npc && npc.working;
  });
  for (const player of players.values()) {
    if (player.isDead || (player.room !== 'outside' && player.room !== 'wilds')) { player.nearLitTorch = false; continue; }
    const near = player.room === 'outside'
      ? litTorches.length > 0 && litTorches.some(t => Math.hypot(player.x - t.x, player.y - t.y) < TORCH_HEAL_RADIUS)
      : WILDS_CAMPFIRES.some(f => Math.hypot(player.x - f.x, player.y - f.y) < CAMPFIRE_HEAL_RADIUS);
    // (Session I fix: this gate said `< 100` — a leftover from before max HP
    // could exceed 100 — so torch/campfire healing stranded high-vitality
    // players a few HP short of full, e.g. 103/108.)
    if (near && player.health < playerMaxHealth(player)) {
      if (!player.nearLitTorch) {
        send(player.ws, { type: 'torch_healed', message: player.room === 'wilds'
          ? "🔥 The campfire's warmth begins to mend your wounds..."
          : "🔥 The torchlight's warmth begins to mend your wounds..." });
      }
      const rate = player.room === 'wilds' ? CAMPFIRE_HEAL_RATE_PER_SEC : TORCH_HEAL_RATE_PER_SEC;
      player.health = Math.min(playerMaxHealth(player), player.health + rate * dt);
    }
    player.nearLitTorch = near;
  }
}

// Tree-trunk colliders, positions copied from client.js's NATURE_DECOR
// (tree entries only — shrubs/rocks/flowers have no collision there
// either). Only used for wildlife steering here; trees themselves are
// purely a client-side visual, never sent to clients from this list.
const { TREE_COLLIDERS } = require('./data/townDecor'); // Tier 3.4 Phase A: extracted to data/

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

// Town night-mobs fight back now (this was the long-promised other shoe —
// they spawned as pure atmosphere for a while). Deliberately gentler than
// the Wilds' four horrors, since the town square is the beginner zone:
// smaller aggro bubble, slower chase, lighter hits. A player at full
// health survives ~13 unanswered hits — plenty of time to fight, run
// indoors (mobs never follow inside), or fire a countermeasure.
const TOWN_MOB_COMBAT = {
  aggroRadius: 150,
  strikeRange: 34,
  chaseSpeed: 62,
  dmgMin: 4,
  dmgMax: 9,
  hitCooldownMs: 1500
};
const TOWN_MOB_XP = 10; // they also pay XP now that they can kill you

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
  respawnAt: 0,
  lastHitAt: 0,
  scaredUntil: 0 // a played voice clip routs them briefly — see cm_voice
}));

// ── Hunt streaks ────────────────────────────────────────────────────────────
// Chained creature kills (≤8s apart) build a streak: a 🔥 counter with a
// little XP kiss at 5 and 10, and a town-wide shout at 10. Variable reward
// on top of steady hunting — the classic combo-counter loop: each kill
// buys 8 more seconds, so the streak itself becomes the thing you're
// protecting. Applies to every hostile pool (town, wilds, dungeon, ember);
// PvP deliberately excluded so nobody farms their friends for the counter.
const { EMOTE_SET } = require('./data/gameConstants'); // Tier 3.4 Phase A: extracted to data/
const STREAK_WINDOW_MS = 8000;
// Blood Moon claws (Session L): outdoor night creatures hit ~25% harder
// while the red moon is up. Town + Wilds pools only — the underground zones
// never see the sky.
function bloodMoonMobDamage(rolled) {
  return bloodMoonActive() ? Math.round(rolled * BLOOD_MOON_MOB_DMG_MULT) : rolled;
}
// Kill XP under the Blood Moon pays half again (outdoor pools, same scope).
function bloodMoonKillXp(base) {
  return bloodMoonActive() ? Math.round(base * BLOOD_MOON_XP_MULT) : base;
}

function registerHuntKill(player) {
  const now = Date.now();
  // Every creature felled scores the weekly Hunts board — and the Tournament
  // lane too while the weekend window is open (Session L).
  lbBump('hunt', player, 1);
  if (tourneyWindow(now).active) lbBump('tourney', player, 1);
  player.huntStreak = (player.lastHuntKillAt && now - player.lastHuntKillAt <= STREAK_WINDOW_MS)
    ? (player.huntStreak || 1) + 1 : 1;
  player.lastHuntKillAt = now;
  if (player.huntStreak >= 2) {
    let bonus = 0;
    if (player.huntStreak === 5) bonus = 10;
    if (player.huntStreak === 10) bonus = 25;
    if (bonus) grantXP(player, bonus);
    send(player.ws, {
      type: 'streak',
      count: player.huntStreak,
      windowMs: STREAK_WINDOW_MS,
      bonus,
      message: bonus ? `🔥 Hunt streak ×${player.huntStreak} — +${bonus} bonus XP!` : `🔥 Hunt streak ×${player.huntStreak}`
    });
    if (player.huntStreak === 10) {
      broadcastAll({ type: 'announce', message: `🔥 ${player.name} is on a ×10 hunt streak!` });
    }
  }
}

// Room-wide hit feedback — every landed blow (dealt by a player, or taken
// by one) is announced to the room so clients can draw floating damage
// numbers over the target. Pure presentation data; no game state rides it.
function broadcastHitFx(room, targetType, targetId, dmg, dead, casterId) {
  broadcastRoom(room, { type: 'hit_fx', targetType, targetId, dmg, dead: !!dead, casterId: casterId || null });
}

// A struck player is fair game for countermeasures for this long — the
// "I'm being attacked" window cm_voice validates against.
const ATTACKED_RECENT_MS = 6000;
// Playing a clip buys ~4s where nothing can hit you or track you, routs
// every mob in earshot for ~8s, and then can't be used again for 45s —
// a genuine escape button, not an immortality toggle.
const VOICE_CM_EVADE_MS = 4000;
const VOICE_CM_SCARE_MS = 8000;
const VOICE_CM_COOLDOWN_MS = 45000;
const VOICE_CM_RADIUS = 320;
// Snapshots: close-range, per-photographer cooldown.
const SNAP_RANGE = 140;
const SNAP_COOLDOWN_MS = 15000;
function isEvading(p) {
  return p.evasionUntil && p.evasionUntil > Date.now();
}
function noteAttacked(p) {
  p.lastAttackedAt = Date.now();
}

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
      m.pendingLoot = null; m.lootKillerId = null;
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
  const now = Date.now();
  for (const m of mobs) {
    if (m.dead) continue;
    const C = TOWN_MOB_COMBAT;
    const { player: nearestP, dist } = nearestOutdoorPlayer(m.x, m.y);
    let vx = 0, vy = 0;
    if (m.scaredUntil > now && nearestP) {
      // Routed by a voice countermeasure — run from the noise like the
      // rabbits run from footsteps, then settle back into the usual prowl.
      const dx = m.x - nearestP.x, dy = m.y - nearestP.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * C.chaseSpeed;
      vy = dy * inv * C.chaseSpeed;
    } else if (nearestP && dist < C.aggroRadius && !isEvading(nearestP)) {
      // Aggro: chase, and swing when close enough. An evading player has
      // slipped out of their senses entirely (see cm_voice).
      const dx = nearestP.x - m.x, dy = nearestP.y - m.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * C.chaseSpeed;
      vy = dy * inv * C.chaseSpeed;
      if (dist < C.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= C.hitCooldownMs)) {
        m.lastHitAt = now;
        const dmg = absorbIncomingDamage(nearestP, bloodMoonMobDamage(C.dmgMin + Math.floor(Math.random() * (C.dmgMax - C.dmgMin + 1))));
        nearestP.health = Math.max(0, nearestP.health - dmg);
        noteAttacked(nearestP);
        if (nearestP.health <= 0) {
          nearestP.health = 0;
          nearestP.isDead = true;
          send(nearestP.ws, { type: 'you_died', byName: 'a Hollow creature', mobId: m.id });
        } else {
          send(nearestP.ws, { type: 'struck', byName: 'a Hollow creature', damage: dmg, mobId: m.id });
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
        vx = Math.sin(m.wanderAngle) * MOB_WANDER_SPEED;
        vy = Math.cos(m.wanderAngle) * MOB_WANDER_SPEED;
      }
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
const ANIMALS2_COUNT = 40; // was 36 — the Wilds now has a real ecosystem of prey
const ANIMAL2_SPAWNS = makeWildsScatter(0x5e21, 14, ANIMALS2_COUNT).map(([x, y]) => ({ x, y }));
const ANIMAL2_RESPAWN_MS = 90 * 1000;

// Peaceful critters (Session M) — the Wilds used to hold only rabbits for
// daytime life. Each critter type flees like a rabbit but reads distinct and
// drops its own materials, so hunting them is worth doing and each can anchor
// a quest. `hp`/`xp`/`loot` are per type; `fly` is a client visual hint (the
// Embermoth drifts rather than hops). All are always present (not night-gated)
// exactly like the rabbits they join.
const { CRITTER2_TYPES } = require('./data/creatures'); // Tier 3.4 Phase A: extracted to data/
// Round-robin the four new critters through the population, seeding a handful
// of the original rabbits too so the classic prey never fully disappears.
const { CRITTER2_ORDER } = require('./data/creatures'); // Tier 3.4 Phase A: extracted to data/
const animals2 = ANIMAL2_SPAWNS.map((p, i) => {
  const critterType = CRITTER2_ORDER[i % CRITTER2_ORDER.length];
  return {
    id: 'animal2_' + i, critterType,
    spawnX: p.x, spawnY: p.y, x: p.x, y: p.y,
    facing: Math.random() * Math.PI * 2,
    fleeing: false, wanderTimer: Math.random() * 2, wanderAngle: 0, grazing: false,
    health: CRITTER2_TYPES[critterType].hp, dead: false, respawnAt: 0
  };
});

// 4 distinct designs — color/size for now-quick visual variety client-side,
// plus genuinely different combat stats so they read as different threats
// rather than reskins: a glass-cannon, a slow tank, a balanced classic
// wolf-type, and an erratic-but-fragile one.
const { MOB2_TYPES } = require('./data/creatures'); // Tier 3.4 Phase A: extracted to data/
const MOB2_SPAWNS = [
  // The original eight, one pair per type…
  { x: 150, y: 500, type: 'shade_stalker' }, { x: 850, y: 500, type: 'shade_stalker' },
  { x: 500, y: 150, type: 'bog_brute' },     { x: 500, y: 850, type: 'bog_brute' },
  { x: 320, y: 320, type: 'night_howler' },  { x: 680, y: 680, type: 'night_howler' },
  { x: 680, y: 320, type: 'will_o_wisp' },   { x: 320, y: 680, type: 'will_o_wisp' },
  // …plus sixteen more (4 extra per type — 24 total, 3x the old population):
  // the Wilds read as empty at night with 8 mobs on a 10k×10k map. Laid out
  // on the same 1000×1000 design grid, spread to the corners and midfield,
  // all comfortably clear of the portal landing spot at (500, 880).
  { x: 250, y: 180, type: 'shade_stalker' }, { x: 760, y: 620, type: 'shade_stalker' },
  { x: 120, y: 760, type: 'shade_stalker' }, { x: 880, y: 240, type: 'shade_stalker' },
  { x: 180, y: 340, type: 'bog_brute' },     { x: 820, y: 760, type: 'bog_brute' },
  { x: 340, y: 780, type: 'bog_brute' },     { x: 660, y: 140, type: 'bog_brute' },
  { x: 480, y: 420, type: 'night_howler' },  { x: 180, y: 120, type: 'night_howler' },
  { x: 860, y: 880, type: 'night_howler' },  { x: 760, y: 420, type: 'night_howler' },
  { x: 560, y: 640, type: 'will_o_wisp' },   { x: 140, y: 600, type: 'will_o_wisp' },
  { x: 880, y: 520, type: 'will_o_wisp' },   { x: 420, y: 240, type: 'will_o_wisp' },
  // ── Session M horrors ──
  { x: 300, y: 500, type: 'fen_hexer' }, { x: 700, y: 300, type: 'fen_hexer' }, { x: 620, y: 780, type: 'fen_hexer' },
  { x: 220, y: 660, type: 'gloom_bat' }, { x: 780, y: 560, type: 'gloom_bat' }, { x: 440, y: 160, type: 'gloom_bat' }, { x: 540, y: 900, type: 'gloom_bat' },
  { x: 400, y: 560, type: 'barrow_maw' }, { x: 640, y: 460, type: 'barrow_maw' }, { x: 240, y: 260, type: 'barrow_maw' },
  // Rot Swarm — two knots of grave-mites, four to a cluster so they mob you.
  { x: 500, y: 480, type: 'rot_swarm' }, { x: 516, y: 490, type: 'rot_swarm' }, { x: 490, y: 500, type: 'rot_swarm' }, { x: 508, y: 508, type: 'rot_swarm' },
  { x: 820, y: 680, type: 'rot_swarm' }, { x: 836, y: 690, type: 'rot_swarm' }, { x: 810, y: 700, type: 'rot_swarm' }, { x: 828, y: 708, type: 'rot_swarm' },
  // Old Marrowe — a single rare elite that only rises on Blood Moon nights.
  { x: 500, y: 320, type: 'old_marrowe' }
].map(p => ({ x: p.x * WILDS_SCALE, y: p.y * WILDS_SCALE, type: p.type }));
const MOB2_RESPAWN_MS = 120 * 1000;
const mobs2 = MOB2_SPAWNS.map((p, i) => ({
  id: 'mob2_' + i,
  mobType: p.type,
  spawnX: p.x, spawnY: p.y, x: p.x, y: p.y,
  facing: Math.random() * Math.PI * 2,
  wanderTimer: Math.random() * 2, wanderAngle: 0, paused: false,
  health: MOB2_TYPES[p.type].maxHealth, dead: false, respawnAt: 0,
  lastHitAt: 0,
  // A Barrow Maw lurks buried until a player strays into ambush range; every
  // other type is simply "emerged" from the start (the flag is inert for them).
  emerged: !MOB2_TYPES[p.type].buried
}));

// ── Neutral creatures (Session M) — the "leave them be, or else" middle
// ground the Wilds never had. They wander and graze and IGNORE players until
// one strikes them (or, for the crow, disturbs its patch); being hit provokes
// them for a window during which they chase and fight back like a mob, then
// they calm down. Not night-gated — they're out day and night. The Mossback
// carries `armor` (a flat incoming-damage multiplier) so it shrugs off blows.
const { MOB3_TYPES } = require('./data/creatures'); // Tier 3.4 Phase A: extracted to data/
const MOB3_SPAWNS = [
  { x: 360, y: 720, type: 'bramble_boar' }, { x: 740, y: 220, type: 'bramble_boar' }, { x: 560, y: 540, type: 'bramble_boar' },
  { x: 180, y: 460, type: 'mossback_tortoise' }, { x: 820, y: 400, type: 'mossback_tortoise' },
  { x: 300, y: 300, type: 'gravewing_crow' }, { x: 680, y: 700, type: 'gravewing_crow' }, { x: 460, y: 840, type: 'gravewing_crow' },
].map(p => ({ x: p.x * WILDS_SCALE, y: p.y * WILDS_SCALE, type: p.type }));
const MOB3_RESPAWN_MS = 110 * 1000;
const mobs3 = MOB3_SPAWNS.map((p, i) => ({
  id: 'mob3_' + i,
  mobType: p.type,
  spawnX: p.x, spawnY: p.y, x: p.x, y: p.y,
  facing: Math.random() * Math.PI * 2,
  wanderTimer: Math.random() * 2, wanderAngle: 0, paused: false,
  health: MOB3_TYPES[p.type].maxHealth, dead: false, respawnAt: 0,
  lastHitAt: 0,
  provoked: false, provokedUntil: 0, provokerId: null
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

// A neutral creature just took a hit — wake it up and point it at whoever
// struck it (falling back to nearest if the provoker has wandered off).
function provokeNeutral(m, playerId) {
  const preset = MOB3_TYPES[m.mobType];
  if (!preset) return;
  m.provoked = true;
  m.provokedUntil = Date.now() + preset.provokeMs;
  m.provokerId = playerId;
}

// One creature landing a blow on a player — shared by the night-mob (mobs2)
// and neutral (mobs3) pools so the strike/kill/lifesteal shape lives in one
// place. `dmgRaw` is the pre-mitigation roll; absorbIncomingDamage applies the
// player's own defenses. Returns the damage actually dealt.
function creatureStrike(m, preset, target, now, dmgRaw) {
  m.lastHitAt = now;
  const dmg = absorbIncomingDamage(target, dmgRaw);
  target.health = Math.max(0, target.health - dmg);
  noteAttacked(target);
  if (target.health <= 0) {
    target.health = 0; target.isDead = true;
    send(target.ws, { type: 'you_died', byName: preset.name, mobId: m.id });
  } else {
    send(target.ws, { type: 'struck', byName: preset.name, damage: dmg, mobId: m.id });
  }
  // The Gloom Bat siphons a share of what it deals back into its own health.
  if (preset.lifesteal && m.health != null && preset.maxHealth) {
    m.health = Math.min(preset.maxHealth, m.health + Math.round(dmg * preset.lifesteal));
  }
  return dmg;
}

// Neutral pool tick — creatures wander and graze, ignoring players entirely
// until provoked (a hit, via provokeNeutral). While provoked they chase and
// strike whoever woke them; when the window lapses they calm and wander again.
function tickWildsNeutral(dt, now, margin) {
  for (const m of mobs3) {
    if (m.dead) continue;
    const preset = MOB3_TYPES[m.mobType];
    if (m.provoked && now >= m.provokedUntil) { m.provoked = false; m.provokerId = null; }
    let target = null, dist = Infinity;
    if (m.provoked) {
      const provoker = m.provokerId ? players.get(m.provokerId) : null;
      if (provoker && provoker.room === 'wilds' && !provoker.isDead) {
        target = provoker; dist = Math.hypot(provoker.x - m.x, provoker.y - m.y);
      } else {
        const np = nearestWildsPlayer(m.x, m.y); target = np.player; dist = np.dist;
      }
    }
    let vx = 0, vy = 0;
    if (m.provoked && target && !isEvading(target)) {
      const dx = target.x - m.x, dy = target.y - m.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * preset.chaseSpeed;
      vy = dy * inv * preset.chaseSpeed;
      if (dist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
        const dmgRaw = bloodMoonMobDamage(preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1)));
        creatureStrike(m, preset, target, now, dmgRaw);
      }
    } else {
      m.wanderTimer -= dt;
      if (m.wanderTimer <= 0) {
        m.wanderTimer = 2 + Math.random() * 3;
        m.paused = Math.random() < 0.4;
        m.wanderAngle = Math.random() * Math.PI * 2;
      }
      if (!m.paused) {
        vx = Math.sin(m.wanderAngle) * preset.wanderSpeed;
        vy = Math.cos(m.wanderAngle) * preset.wanderSpeed;
      }
    }
    const nx = m.x + vx * dt, ny = m.y + vy * dt;
    if (vx !== 0 && nx > margin && nx < WORLD2.width - margin) m.x = nx;
    if (vy !== 0 && ny > margin && ny < WORLD2.height - margin) m.y = ny;
    if (vx !== 0 || vy !== 0) m.facing = Math.atan2(vx, vy);
  }
}

function tickRespawns2(now) {
  for (const a of animals2) {
    if (a.dead && now >= a.respawnAt) {
      a.dead = false; a.health = CRITTER2_TYPES[a.critterType].hp;
      a.x = a.spawnX; a.y = a.spawnY; a.fleeing = false;
    }
  }
  for (const m of mobs2) {
    if (m.dead && now >= m.respawnAt) {
      m.dead = false; m.health = MOB2_TYPES[m.mobType].maxHealth;
      m.x = m.spawnX; m.y = m.spawnY; m.paused = false;
      m.pendingLoot = null; m.lootKillerId = null;
      m.emerged = !MOB2_TYPES[m.mobType].buried; // a respawned Barrow Maw re-buries
    }
  }
  for (const m of mobs3) {
    if (m.dead && now >= m.respawnAt) {
      m.dead = false; m.health = MOB3_TYPES[m.mobType].maxHealth;
      m.x = m.spawnX; m.y = m.spawnY; m.paused = false;
      m.pendingLoot = null; m.lootKillerId = null;
      m.provoked = false; m.provokedUntil = 0; m.provokerId = null;
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

  const now = Date.now();
  // Neutral creatures are out day AND night (they only fight when provoked).
  tickWildsNeutral(dt, now, margin);

  if (!isNightNow()) return;
  for (const m of mobs2) {
    if (m.dead) continue;
    const preset = MOB2_TYPES[m.mobType];
    // Old Marrowe only rises under the Blood Moon — dormant otherwise (and the
    // client is told to hide it, so it never appears on an ordinary night).
    if (preset.bloodMoonOnly && !bloodMoonActive()) continue;
    const { player: nearestP, dist } = nearestWildsPlayer(m.x, m.y);
    // Barrow Maw lurks buried until a player strays into ambush range; while
    // buried it doesn't move, strike, or turn.
    if (preset.buried && !m.emerged) {
      if (nearestP && dist < preset.ambushRange && !isEvading(nearestP)) m.emerged = true;
      else continue;
    }
    let vx = 0, vy = 0;
    if (m.scaredUntil > now && nearestP) {
      // Routed by a voice countermeasure — see cm_voice.
      const dx = m.x - nearestP.x, dy = m.y - nearestP.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * preset.speed;
      vy = dy * inv * preset.speed;
    } else if (nearestP && dist < preset.aggroRadius && !isEvading(nearestP)) {
      // Ranged casters (Fen Hexer) kite: back off if the player closes inside
      // kiteRange, hold position in the mid-band, and strike from anywhere
      // within their long strikeRange. Everyone else just charges in.
      let approach = 1; // +1 toward, -1 away, 0 hold ground
      if (preset.ranged) {
        if (dist < preset.kiteRange) approach = -1;
        else if (dist < preset.strikeRange) approach = 0;
      }
      if (approach !== 0) {
        const dx = (nearestP.x - m.x) * approach, dy = (nearestP.y - m.y) * approach;
        const inv = dist > 0.01 ? 1 / dist : 0;
        vx = dx * inv * preset.speed;
        vy = dy * inv * preset.speed;
      }
      if (dist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
        const dmgRaw = bloodMoonMobDamage(preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1)));
        creatureStrike(m, preset, nearestP, now, dmgRaw);
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
    // A caster keeps facing its quarry even while backpedalling.
    if (preset.ranged && nearestP && dist < preset.aggroRadius) m.facing = Math.atan2(nearestP.x - m.x, nearestP.y - m.y);
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
const DUNGEON_SIZE = 1200;
const DUNGEON_SPAWN = { x: 600, y: 1080 };
const DUNGEON_RESPAWN_MS = 60 * 1000;
const DUNGEON_ROOMS = { 1: 'dungeon_t1', 2: 'dungeon_t2', 3: 'dungeon_t3', 4: 'dungeon_t4' };

function dungeonTierForLevel(level) {
  if (level <= 5)  return 1;
  if (level <= 10) return 2;
  if (level <= 15) return 3;
  return 4;
}

// ── Named dungeons (Session L) ──────────────────────────────────────────────
// The four tiers are PLACES now, not numbers — each with a name, a lore
// plaque at the entrance, and a signature boss holding the deep end of the
// arena. Names surface everywhere the raw tier used to (entry toast, the
// location pill, the Journal, the store listings). The catalog ships to the
// client in init (like legendaryCatalog) — one authoritative copy, no
// hand-sync.
const { DUNGEON_LORE } = require('./data/dungeons'); // Tier 3.4 Phase A: extracted to data/
const { DUNGEON_MOB_TYPES } = require('./data/dungeons'); // Tier 3.4 Phase A: extracted to data/

const { DUNGEON_MOB_KEYS_BY_TIER } = require('./data/dungeons'); // Tier 3.4 Phase A: extracted to data/

const { DUNGEON_SPAWN_POSITIONS } = require('./data/dungeons'); // Tier 3.4 Phase A: extracted to data/

// Per-tier spawn layouts. Tier 1 (The Rootcellar) is a serpentine labyrinth
// now (client ROOTCELLAR_WALLS) — its mobs sit in the lanes between the wall
// baffles, clear of the walls, boss in the deep north chamber. Tiers 2-4 keep
// the old open-arena grid until they're revamped too. Delve floors keep using
// DUNGEON_SPAWN_POSITIONS directly.
const { DUNGEON_SPAWN_POSITIONS_BY_TIER } = require('./data/dungeons'); // Tier 3.4 Phase A: extracted to data/ (LANES_T1-4 used only inside the module)

// Build dungeonMobs: 8 types × 4 tiers × 2 instances = 64 total
const dungeonMobs = [];
for (const [tierStr, keys] of Object.entries(DUNGEON_MOB_KEYS_BY_TIER)) {
  const tier = Number(tierStr);
  const room = DUNGEON_ROOMS[tier];
  const _positions = DUNGEON_SPAWN_POSITIONS_BY_TIER[tier] || DUNGEON_SPAWN_POSITIONS;
  let _ti = 0;
  for (const key of keys) {
    const preset = DUNGEON_MOB_TYPES[key];
    for (let inst = 0; inst < 2; inst++) {
      const sp = _positions[_ti % _positions.length];
      _ti++;
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

// One signature boss per tier, holding the middle-north of the arena (the
// exit portal stays reachable along the walls for anyone not looking for a
// fight). Slower respawn than the rank-and-file so a boss kill stays an
// event, not a farm.
const DUNGEON_BOSS_SPAWN = { x: 600, y: 360 };
// Per-tier boss position. Tier 1's boss (Old Gnawbone) holds the deep north
// chamber of the Rootcellar labyrinth; other tiers keep the old arena spot.
const DUNGEON_BOSS_SPAWN_BY_TIER = { 1: { x: 600, y: 225 }, 2: { x: 235, y: 600 }, 3: { x: 600, y: 600 }, 4: { x: 600, y: 600 } };
const DUNGEON_ENTRY_BY_TIER = { 1: { x: 600, y: 1080 }, 2: { x: 1080, y: 600 }, 3: { x: 600, y: 1090 }, 4: { x: 600, y: 1090 } };
const DUNGEON_BOSS_RESPAWN_MS = 5 * 60 * 1000;
for (const tier of [1, 2, 3, 4]) {
  const key = DUNGEON_LORE[tier].bossKey;
  const preset = DUNGEON_MOB_TYPES[key];
  const _bsp = DUNGEON_BOSS_SPAWN_BY_TIER[tier] || DUNGEON_BOSS_SPAWN;
  dungeonMobs.push({
    id: `dungboss_t${tier}`,
    mobType: key, tier, room: DUNGEON_ROOMS[tier], boss: true,
    spawnX: _bsp.x, spawnY: _bsp.y,
    x: _bsp.x, y: _bsp.y,
    facing: Math.PI, wanderTimer: 2, wanderAngle: 0, paused: false,
    health: preset.maxHealth, scaledMax: preset.maxHealth, engaged: false,
    dead: false, respawnAt: 0, lastHitAt: 0
  });
}

// Party scaling (Session L): the moment a boss first engages, its health
// pool grows +60% per extra living player in the room — so a full party
// fights a monument, not a piñata. Computed once per life (at engage), so
// mid-fight joins/leaves can't yo-yo the bar.
const PARTY_BOSS_HP_PER_ALLY = 0.6;
function playersInRoom(room) {
  let n = 0;
  for (const p of players.values()) if (p.room === room && !p.isDead) n++;
  return n;
}
function bossEngagedScale(m, preset) {
  const n = Math.max(1, playersInRoom(m.room));
  m.engaged = true;
  m.scaledMax = Math.round(preset.maxHealth * (1 + PARTY_BOSS_HP_PER_ALLY * (n - 1)));
  m.health = m.scaledMax;
}
function dungeonMobMaxHealth(m) {
  const preset = DUNGEON_MOB_TYPES[m.mobType];
  return (m.boss && m.scaledMax) ? m.scaledMax : preset.maxHealth;
}

// Strike-target lookup for everything that lives in the dungeon scene: the
// shared tier arenas' mobs/bosses, or — inside a delve run — that run's own
// instanced mobs (see the Weekly Delve below).
function findDungeonTarget(targetId, room) {
  if (room && room.startsWith('dungeon_delve_')) {
    const run = delveRunsByRoom.get(room);
    return run ? (run.mobs.find(m => m.id === targetId) || null) : null;
  }
  return dungeonMobs.find(m => m.id === targetId) || null;
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

// Fresh-run repopulate (Session M): each dungeon tier is ONE shared,
// persistent room, so walking back into a tier you just cleared finds it
// still on the 60s / 5-min respawn timers rather than freshly stocked. When a
// dungeon room has no players in it, the next entry is a brand-new run, so
// snap every one of that tier's mobs (and its boss) back to full at their
// spawn points. Mirrors the revive branch in tickDungeon exactly. Gated by
// the caller on the room being empty so it can never revive mobs out from
// under someone already fighting the shared instance.
function resetDungeonRoom(room) {
  for (const m of dungeonMobs) {
    if (m.room !== room) continue;
    m.dead = false;
    m.respawnAt = 0;
    m.health = DUNGEON_MOB_TYPES[m.mobType].maxHealth;
    m.x = m.spawnX; m.y = m.spawnY;
    m.pendingLoot = null; m.lootKillerId = null;
    if (m.boss) { m.engaged = false; m.scaledMax = DUNGEON_MOB_TYPES[m.mobType].maxHealth; }
  }
}

function tickDungeon(dt) {
  const now = Date.now();
  const margin = 40;
  for (const m of dungeonMobs) {
    if (m.dead) {
      if (now >= m.respawnAt) {
        m.dead = false;
        m.health = DUNGEON_MOB_TYPES[m.mobType].maxHealth;
        if (m.boss) { m.engaged = false; m.scaledMax = DUNGEON_MOB_TYPES[m.mobType].maxHealth; }
        m.x = m.spawnX; m.y = m.spawnY;
        m.pendingLoot = null; m.lootKillerId = null;
      }
      continue;
    }
    const preset = DUNGEON_MOB_TYPES[m.mobType];
    const { player: nearestP, dist } = nearestDungeonPlayer(m.room, m.x, m.y);
    let vx = 0, vy = 0;
    // Leashing (labyrinth revamp): dungeon mobs hold their chamber. They chase
    // only while within chaseLeash of their spawn, and walk home if they drift
    // past their leash — so the client-side walls that block the PLAYER never
    // strand a mob far from where it belongs.
    const spawnDist = Math.hypot(m.x - m.spawnX, m.y - m.spawnY);
    const leash = m.boss ? 300 : 150;
    const chaseLeash = leash + 130;
    if (m.scaredUntil > now && nearestP) {
      const dx = m.x - nearestP.x, dy = m.y - nearestP.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * preset.speed;
      vy = dy * inv * preset.speed;
    } else if (nearestP && dist < preset.aggroRadius && !isEvading(nearestP) && spawnDist < chaseLeash) {
      // A boss sizes up the whole room the first time it stirs (Session L).
      if (m.boss && !m.engaged) bossEngagedScale(m, preset);
      const dx = nearestP.x - m.x, dy = nearestP.y - m.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * preset.speed;
      vy = dy * inv * preset.speed;
      if (dist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
        m.lastHitAt = now;
        const dmg = absorbIncomingDamage(nearestP, preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1)));
        nearestP.health = Math.max(0, nearestP.health - dmg);
        noteAttacked(nearestP);
        if (nearestP.health <= 0) {
          nearestP.health = 0;
          nearestP.isDead = true;
          send(nearestP.ws, { type: 'you_died', byName: preset.name, mobId: m.id });
        } else {
          send(nearestP.ws, { type: 'struck', byName: preset.name, damage: dmg, mobId: m.id });
        }
      }
    } else if (spawnDist > leash * 0.9) {
      // Drifted too far from home — walk back toward spawn.
      const dx = m.spawnX - m.x, dy = m.spawnY - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 8) { vx = dx / d * preset.speed * 0.5; vy = dy / d * preset.speed * 0.5; }
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

// The two status effects that aren't purely client-cosmetic — 'regen'
// (Regen Root potions, the Witch's Bone-Knit Blessing) heals over time,
// and 'wither' (the Witch's Withering Hex) drains over time — so unlike
// every other status the server has to act on them each tick rather than
// just track expiry. Wither floors at 1 HP on purpose: a hex can carry a
// soul to death's door but never through it, which keeps every actual
// death (and its loot/respawn flow) inside applyDamage.
const REGEN_HP_PER_SEC = 2.5;
const WITHER_HP_PER_SEC = 3;
function tickPlayerStatusHealth(now, dt) {
  for (const p of players.values()) {
    // Spirit Mending / Field Medicine (the 'mending' skill): a slow passive
    // regeneration that only ticks OUT of combat (nothing has hit you for a
    // few seconds) — rewards disengaging, never turns a live fight
    // un-loseable. Works in any room, unlike the torch/campfire sanctuaries.
    if (!p.isDead) {
      const mend = skillMendingRate(p);
      if (mend > 0 && p.health < playerMaxHealth(p) && now - (p.lastAttackedAt || 0) > ATTACKED_RECENT_MS) {
        p.health = Math.min(playerMaxHealth(p), p.health + mend * dt);
      }
    }
    if (!p.activeStatus || p.activeStatus.expiresAt <= now) continue;
    if (p.activeStatus.type === 'regen') {
      p.health = Math.min(playerMaxHealth(p), p.health + REGEN_HP_PER_SEC * dt);
    } else if (p.activeStatus.type === 'wither' && !p.isDead) {
      p.health = Math.max(1, p.health - WITHER_HP_PER_SEC * dt);
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
  tickDelves(dt);
  tickPlayerStatusHealth(now, dt);
  tickTorchNpcs(dt);
  updateTemplePortalState();
  tickTorchHealing(dt);
  tickEmberWastes(dt);
  tickGroundTraps(now);
  if (players.size === 0) return;
  broadcastAll({
    type: 'wildlife_state',
    isNight: isNightNow(),
    groundTraps: groundTrapsPublicState(),
    animals: animals.map(a => ({ id: a.id, x: a.x, y: a.y, facing: a.facing, fleeing: a.fleeing, health: a.health, maxHealth: ANIMAL_MAX_HEALTH, dead: a.dead })),
    mobs: mobs.map(m => ({ id: m.id, x: m.x, y: m.y, facing: m.facing, health: m.health, maxHealth: MOB_MAX_HEALTH, dead: m.dead, hasLoot: !!(m.pendingLoot && m.pendingLoot.length) })),
    animals2: animals2.map(a => ({ id: a.id, type: a.critterType, x: a.x, y: a.y, facing: a.facing, fleeing: a.fleeing, health: a.health, maxHealth: CRITTER2_TYPES[a.critterType].hp, dead: a.dead })),
    mobs2: mobs2.map(m => {
      const p = MOB2_TYPES[m.mobType];
      // Hide a Barrow Maw while it's still buried, and Old Marrowe on any
      // ordinary (non-Blood-Moon) night — the client draws neither until they're real.
      const hidden = (p.buried && !m.emerged) || (p.bloodMoonOnly && !bloodMoonActive());
      return { id: m.id, mobType: m.mobType, x: m.x, y: m.y, facing: m.facing, health: m.health, maxHealth: p.maxHealth, dead: m.dead, hidden, hasLoot: !!(m.pendingLoot && m.pendingLoot.length) };
    }),
    mobs3: mobs3.map(m => ({ id: m.id, mobType: m.mobType, x: m.x, y: m.y, facing: m.facing, health: m.health, maxHealth: MOB3_TYPES[m.mobType].maxHealth, dead: m.dead, provoked: !!m.provoked, hasLoot: !!(m.pendingLoot && m.pendingLoot.length) })),
    // decor is per-player now — sent individually on join and after each harvest
    dungeonMobs: [...dungeonMobs, ...allDelveMobs()].map(m => ({ id: m.id, mobType: m.mobType, tier: m.tier, room: m.room, x: m.x, y: m.y, facing: m.facing, health: m.health, maxHealth: dungeonMobMaxHealth(m), dead: m.dead, hasLoot: !!(m.pendingLoot && m.pendingLoot.length) })),
    villageNpcs: villageNpcs.map(n => ({ id: n.id, charId: n.charId, name: n.name, x: n.x, y: n.y, facing: n.facing, working: n.working })),
    torchNpcs: torchNpcPublicState(),
    torches: townTorchPublicState(),
    templePortalOpen: templePortalOpen(),
    emberMobs: emberMobs.map(m => ({ id: m.id, mobType: m.mobType, x: m.x, y: m.y, facing: m.facing, health: m.health, maxHealth: EMBER_MOB_TYPES[m.mobType].maxHealth, dead: m.dead, hasLoot: !!(m.pendingLoot && m.pendingLoot.length) }))
  });
}, 150);

// ---------------------------------------------------------------------------
// Ground-placed spell traps — currently just Stumble Hex's sigil (see the
// 'ground' branch in cast_spell below). Each entry is self-contained (no
// SPELL_CATALOG lookup needed here), so this can tick regardless of where
// in the file it sits relative to the catalog. A trap re-applies its status
// to anyone standing inside it on every tick — stepping out lets whatever
// duration they were last given start counting down normally, the same as
// getting hexed directly.
// ---------------------------------------------------------------------------
const groundTraps = [];
function tickGroundTraps(now) {
  for (let i = groundTraps.length - 1; i >= 0; i--) {
    if (groundTraps[i].expiresAt <= now) groundTraps.splice(i, 1);
  }
  for (const trap of groundTraps) {
    for (const p of players.values()) {
      if (p.room !== trap.room || p.isDead) continue;
      if (Math.hypot(p.x - trap.x, p.y - trap.y) > trap.radius) continue;
      p.activeStatus = { type: trap.statusType, expiresAt: now + trap.statusDurationMs };
    }
  }
}
function groundTrapsPublicState() {
  return groundTraps.map(t => ({ id: t.id, spellId: t.spellId, room: t.room, x: t.x, y: t.y, radius: t.radius, expiresAt: t.expiresAt }));
}

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
  // The one 'ground' spell — instead of picking a player, the caster picks
  // a spot on the ground (see the 'ground' branch in cast_spell below) and
  // a sigil is drawn there for trapLifetimeMs. Any player who wanders within
  // trapRadius of it while it's still active gets durationMs of the status,
  // same as if they'd been hexed directly — see tickGroundTraps().
  stumble_hex: {
    name: 'Stumble Hex', icon: '🦶', kind: 'ground', effect: 'trap', statusType: 'stumble', durationMs: 20000,
    trapRadius: 130, trapLifetimeMs: 25000,
    description: 'Draws a witchy sigil on the ground — anyone who steps into it gets hexed with halved walking speed.'
  },
  // The one Witch spell that actually drains health, unlike every other
  // entry here (see the 'damage' branch in cast_spell below) — a ranged
  // counterpart to the universal melee Strike, same death/loot/respawn flow.
  fireball: {
    name: 'Fireball', icon: '🔥', kind: 'targeted', effect: 'damage', dmgMin: 18, dmgMax: 30,
    description: 'Hurls a roaring ball of witchfire at the target for real damage.'
  },
  // ---- Combat ----
  // A damage-over-time curse (see tickPlayerStatusHealth) — 3 HP/s for its
  // duration, but it floors at 1 HP: a hex can carry a soul to death's door,
  // never through it. Only a real blow (Strike/Fireball/Leech) can finish
  // what the withering starts, so the kill/loot flow stays with applyDamage.
  withering_hex: {
    name: 'Withering Hex', icon: '🥀', kind: 'targeted', effect: 'status', statusType: 'wither', durationMs: 10000,
    description: "Rots the target's vitality — their life withers away for ten dreadful seconds. It cannot kill, only carry them to the brink."
  },
  // Combat-heal hybrid: the same applyDamage path as Fireball (players AND
  // mobs), but whatever it drains flows back into the caster's own health.
  leech_hex: {
    name: 'Leech Hex', icon: '🩸', kind: 'targeted', effect: 'leech', dmgMin: 12, dmgMax: 20,
    description: 'Sinks phantom fangs into the target — the life it drains seeps back into your own veins.'
  },
  // Self combat buff: reuses the 'giant' status the client already renders
  // (doubled size), and applyDamage boosts any attacker with 'giant' by 50%.
  monstrous_form: {
    name: 'Monstrous Form', icon: '👹', kind: 'self', effect: 'status', statusType: 'giant', durationMs: 15000,
    description: 'Swell into a hulking horror — while transformed, your strikes and spells hit half again as hard.'
  },
  // ---- Defense ----
  // Self ward: 'pumpkin' status bearers take half damage from every source
  // (see absorbIncomingDamage — mob strikes and PvP alike).
  gourd_ward: {
    name: 'Gourd Ward', icon: '🎃', kind: 'self', effect: 'status', statusType: 'pumpkin', durationMs: 20000,
    description: 'Hollow out your skull into a sacred ward-gourd — while it grins, all harm against you is halved.'
  },
  // Escape/repositioning tool: the dark-feather visual plus doubled speed
  // (client movement honors 'ravencloak' the same way it does 'speedboost').
  ravens_cloak: {
    name: "Raven's Cloak", icon: '🪽', kind: 'self', effect: 'status', statusType: 'ravencloak', durationMs: 12000,
    description: 'Dissolve into a flurry of black feathers — your steps quicken to twice their pace, to flee or to chase.'
  },
  // ---- Healing ----
  // Self regen: same 'regen' status the healing potions grant, ticked
  // server-side in tickPlayerStatusHealth (~2.5 HP/s).
  bone_knit: {
    name: 'Bone-Knit Blessing', icon: '🦴', kind: 'self', effect: 'status', statusType: 'regen', durationMs: 12000,
    description: 'Whisper the old words over your own bones — wounds slowly knit themselves closed for twelve seconds.'
  },
  // ---- Intelligence gathering ----
  scrying_orb: {
    name: 'Scrying Orb', icon: '🔮', kind: 'targeted', effect: 'reveal',
    description: 'Peer into the orb at a chosen soul — learn where they are, how wounded, how seasoned, and what curse rides them.'
  },
  nightwing_augury: {
    name: 'Nightwing Augury', icon: '🦇', kind: 'self', effect: 'intel_sweep', durationMs: 15000,
    description: 'Loose your bats across the whole realm — they return whispering every soul’s whereabouts and wounds.'
  }
};
const SPELL_COOLDOWN_MS = 8000;

// ---------------------------------------------------------------------------
// The Midnight Peddler — weekly legendary shop (Session I). Five of the ~100
// legendaries are on sale at a time; the set flips every week, deterministic
// from the wall clock (seeded shuffle), so every player and every restart
// agrees with no cron and no stored state. Moonstones only.
// ---------------------------------------------------------------------------
const LEGENDARY_SET_SIZE = 5;
const LEGENDARY_WEEK_MS = 7 * 24 * 3600 * 1000;
// A Monday 00:00 UTC — rotation day. Changing this constant reshuffles
// every past and future week, so don't.
const LEGENDARY_EPOCH = Date.UTC(2026, 0, 5);
function legendaryWeekIndex(now) {
  return Math.floor(((now != null ? now : Date.now()) - LEGENDARY_EPOCH) / LEGENDARY_WEEK_MS);
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function legendaryWeeklySet(now) {
  const rand = mulberry32(((legendaryWeekIndex(now) * 2654435761) ^ 0x517cc1b7) >>> 0);
  const ids = Object.keys(LEGENDARY_CATALOG);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, LEGENDARY_SET_SIZE);
}
function legendaryShopPayload(player) {
  const now = Date.now();
  return {
    items: legendaryWeeklySet(now).map((id) => {
      const lg = LEGENDARY_CATALOG[id];
      return { id, name: lg.name, icon: lg.icon, slot: lg.slot, tier: lg.tier, ms: lg.ms, desc: lg.desc, stats: lg.stats, fx: lg.fx };
    }),
    nextRotationAt: LEGENDARY_EPOCH + (legendaryWeekIndex(now) + 1) * LEGENDARY_WEEK_MS,
    balance: player.accountKey ? msBalance(player.accountKey) : 0
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION L — the competitive-review build-out. Everything below this banner
// (leaderboards, the event calendar, the Weekly Delve, covens, streaks) was
// added in one round to close the "retention hooks" and "content rotation"
// gaps the top-10 review found. Shared conventions: weeks are Mondays 00:00
// UTC (the Peddler's week — one concept of "this week" everywhere), all
// rotation math is seeded/deterministic (mulberry32, same as the Peddler) so
// every restart and every client agrees, and all new persistent state rides
// the Session L storage layer.
// ═══════════════════════════════════════════════════════════════════════════

// ── Leaderboards ─────────────────────────────────────────────────────────────
// "Give the nightly trophy and hunt streaks a board in the town square." —
// weekly boards for hunts / bosses / delve depth, plus the weekend
// tournament's own lane. Account holders only (guests are ephemeral by
// design — the client nudges them to log in instead). Keyed by week so
// history is queryable; periods older than ~2 months are pruned at boot.
const LEADERBOARDS_FILE = path.join(DATA_DIR, 'leaderboards.json');
const leaderboards = persistLoad('leaderboards', LEADERBOARDS_FILE);
persistRegister('leaderboards', LEADERBOARDS_FILE, () => leaderboards);
const LB_BOARDS = ['hunt', 'boss', 'delve', 'tourney'];
const LB_TOP_N = 20;
const LB_KEEP_WEEKS = 9;

function weekKey(now) { return 'w' + legendaryWeekIndex(now); }
// Prune ancient periods (keep a couple months of history + the honors log).
(() => {
  const cutoff = legendaryWeekIndex(Date.now()) - LB_KEEP_WEEKS;
  let pruned = false;
  for (const k of Object.keys(leaderboards)) {
    const m = /^w(-?\d+)$/.exec(k);
    if (m && Number(m[1]) < cutoff) { delete leaderboards[k]; pruned = true; }
  }
  if (pruned) persistSave('leaderboards', LEADERBOARDS_FILE, leaderboards);
})();

function lbPeriod(wk) {
  if (!leaderboards[wk]) leaderboards[wk] = {};
  return leaderboards[wk];
}
function lbBump(board, player, delta) {
  if (!player || !player.accountKey || !delta) return;
  const wk = weekKey(Date.now());
  const period = lbPeriod(wk);
  if (!period[board]) period[board] = {};
  const e = period[board][player.accountKey] || (period[board][player.accountKey] = { name: player.name, value: 0 });
  e.name = player.name; // keep the display name fresh
  e.value += delta;
  persistSetKey('leaderboards', LEADERBOARDS_FILE, leaderboards, wk);
}
function lbSetMax(board, player, value) {
  if (!player || !player.accountKey || !(value > 0)) return;
  const wk = weekKey(Date.now());
  const period = lbPeriod(wk);
  if (!period[board]) period[board] = {};
  const e = period[board][player.accountKey] || (period[board][player.accountKey] = { name: player.name, value: 0 });
  e.name = player.name;
  if (value > e.value) e.value = value;
  persistSetKey('leaderboards', LEADERBOARDS_FILE, leaderboards, wk);
}
function lbTop(board, wk, topN) {
  const period = leaderboards[wk] || {};
  const b = period[board] || {};
  return Object.entries(b)
    .map(([key, e]) => ({ key, name: e.name, value: e.value }))
    .sort((a, b2) => b2.value - a.value)
    .slice(0, topN || LB_TOP_N);
}
function lbRankOf(board, wk, accountKey) {
  if (!accountKey) return null;
  const period = leaderboards[wk] || {};
  const b = period[board] || {};
  if (!b[accountKey]) return null;
  const better = Object.values(b).filter(e => e.value > b[accountKey].value).length;
  return { rank: better + 1, value: b[accountKey].value };
}

// Honors — the permanent trophy shelf. When a week closes, its top three in
// each board get an entry here (and a gold purse). Settled lazily: the first
// board interaction after rollover pays out, so no cron is needed and a
// sleepy Monday-morning server can't miss it.
const LB_WEEK_PRIZES = [250, 125, 60]; // gold, 1st/2nd/3rd
function lbSettleClosedWeeks() {
  const currentIdx = legendaryWeekIndex(Date.now());
  for (const wk of Object.keys(leaderboards)) {
    const m = /^w(-?\d+)$/.exec(wk);
    if (!m || Number(m[1]) >= currentIdx) continue;
    const period = leaderboards[wk];
    if (!period || period.settled) continue;
    period.settled = true;
    if (!leaderboards.honors) leaderboards.honors = {};
    for (const board of LB_BOARDS) {
      lbTop(board, wk, 3).forEach((e, i) => {
        if (!leaderboards.honors[e.key]) leaderboards.honors[e.key] = [];
        leaderboards.honors[e.key].push({ week: wk, board, place: i + 1, value: e.value });
        const purse = LB_WEEK_PRIZES[i] || 0;
        if (purse && accounts[e.key]) {
          ensureBankAccount(e.key).balance += purse;
          const online = findConnectionByAccountKey(e.key);
          if (online) send(online.ws, { type: 'announce', message: `🏅 Last week's ${boardLabel(board)} board: you placed #${i + 1}! ${purse} gold has been paid to your bank.` });
        }
      });
    }
    saveBankAccounts();
    persistSetKey('leaderboards', LEADERBOARDS_FILE, leaderboards, wk);
    persistSetKey('leaderboards', LEADERBOARDS_FILE, leaderboards, 'honors');
  }
}
function boardLabel(board) {
  return { hunt: 'Hunts', boss: 'Bosses', delve: 'Delve', tourney: 'Tournament' }[board] || board;
}
function noteBossKill(player, mob) {
  lbBump('boss', player, 1);
}
function boardStatePayload(player) {
  lbSettleClosedWeeks();
  const now = Date.now();
  const wk = weekKey(now);
  const t = tourneyWindow(now);
  const boards = {};
  for (const board of LB_BOARDS) {
    boards[board] = {
      top: lbTop(board, wk),
      me: player.accountKey ? lbRankOf(board, wk, player.accountKey) : null
    };
  }
  return {
    type: 'board_state',
    week: wk,
    weekEndsAt: LEGENDARY_EPOCH + (legendaryWeekIndex(now) + 1) * LEGENDARY_WEEK_MS,
    boards,
    tourney: { active: t.active, startsAt: t.startsAt, endsAt: t.endsAt },
    honors: player.accountKey ? ((leaderboards.honors || {})[player.accountKey] || []).slice(-12) : [],
    isGuest: !player.accountKey
  };
}

// Event calendar (Session L) — extracted to lib/calendar.js (Tier 3.4 Phase B).
const calendar = require('./lib/calendar')({ CYCLE_MS, DAY_MS, LEGENDARY_EPOCH, LEGENDARY_WEEK_MS, legendaryWeekIndex });
const { tourneyWindow, festivalWindow, bloodMoonWindow, bloodMoonActive, calendarPublicState, BLOOD_MOON_EVERY_NIGHTS } = calendar;
const FESTIVAL_XP_MULT = 1.25;
const FESTIVAL_FORAGE_BONUS = 0.15;

const BLOOD_MOON_MOB_DMG_MULT = 1.25;
const BLOOD_MOON_XP_MULT = 1.5;
const BLOOD_MOON_SHARD_CHANCE = 0.35;
const BLOODMOON_CIRCLET_COST = 5; // shards → craft_circlet handler


// Blood-moon shard drops ride every night-mob kill (town mobs, wilds mobs,
// dungeon mobs — anything hostile killed while the red moon is up).
function maybeDropBloodShard(player) {
  if (!bloodMoonActive() || Math.random() >= BLOOD_MOON_SHARD_CHANCE) return;
  const inv = getInventory(player);
  if (!addItemToAccount(inv, 'bloodmoon_shard', 1)) return;
  if (player.accountKey) saveInventories();
  const n = countItemQty(inv, 'bloodmoon_shard');
  send(player.ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
  send(player.ws, {
    type: 'harvest_result',
    message: n >= BLOODMOON_CIRCLET_COST
      ? `🩸 A Bloodmoon Shard! (${n}) — enough to bind a 🔴 Bloodmoon Circlet. Open your pack.`
      : `🩸 A Bloodmoon Shard falls glittering! (${n}/${BLOODMOON_CIRCLET_COST} for a circlet)`
  });
}

// Transition announcer — watches the deterministic windows and announces
// openings/closings + pokes the calendar state to clients + fires push
// notifications. 15s cadence: cheap, and transitions land within moments.
let _calSnapshot = null;
setInterval(() => {
  const now = Date.now();
  const t = tourneyWindow(now), f = festivalWindow(now), bm = bloodMoonWindow(now);
  const snap = `${t.active}|${f.active}|${bm.active}|${legendaryWeekIndex(now)}`;
  if (_calSnapshot === null) { _calSnapshot = snap; return; }
  if (snap === _calSnapshot) return;
  const [pt, pf, pbm, pwk] = _calSnapshot.split('|');
  _calSnapshot = snap;
  if (String(t.active) !== pt) {
    broadcastAll({ type: 'announce', message: t.active
      ? '🏹 The Weekend Hunt Tournament has begun! Every creature felled counts — the board in the town square is watching.'
      : '🏹 The Weekend Hunt Tournament has ended. Honors post when the week turns — check the town board.' });
    if (t.active) pushBroadcast('events', '🏹 The hunt is on', 'The Weekend Hunt Tournament just began in Thornreach — this weekend’s kills count.');
  }
  if (String(f.active) !== pf) {
    broadcastAll({ type: 'announce', message: f.active
      ? '🏮 The Hearthmoon Festival fills the town — +25% XP and richer foraging until the moon turns!'
      : '🏮 The Hearthmoon Festival packs up its lanterns. Until next month!' });
    if (f.active) pushBroadcast('events', '🏮 Hearthmoon Festival', 'Festival day in Thornreach: +25% XP and richer foraging, today only.');
  }
  if (String(bm.active) !== pbm) {
    broadcastAll({ type: 'announce', message: bm.active
      ? '🔴 THE BLOOD MOON RISES. The night bites harder, pays half again the XP — and sheds 🩸 shards for the brave.'
      : '🌙 The Blood Moon wanes. The night keeps its usual teeth.' });
    if (bm.active) pushBroadcast('bloodmoon', '🔴 The Blood Moon rises', 'Twisted rules in Thornreach right now: harder mobs, +50% XP, and Bloodmoon Shards for the brave.');
  }
  if (String(legendaryWeekIndex(now)) !== pwk) {
    broadcastAll({ type: 'announce', message: '🌒 The Midnight Peddler unveils a fresh set of wonders — a new week begins. Boards reset; last week’s honors are being posted.' });
    lbSettleClosedWeeks();
    pushBroadcast('peddler', '🌒 The Peddler has turned his cart', 'Five fresh legendaries are on the Midnight Peddler’s table this week.');
  }
  broadcastAll({ type: 'calendar_state', calendar: calendarPublicState(now) });
}, 15 * 1000);

// ── The Weekly Delve ─────────────────────────────────────────────────────────
// The review's single biggest lever: a seeded roguelike mode built entirely
// from content the game already owns. Every Monday the Delve reshuffles —
// two twist-rules for the week (same mulberry32/epoch determinism as the
// Peddler) — and a run is: clear a floor of dungeon creatures, draft 1-of-3
// boons, descend, repeat until you die or leave. Floors escalate through the
// four named dungeons' bestiaries; every third floor wakes that tier's
// signature boss. Depth is the score; the town board keeps it for the week.
// Runs are INSTANCED (room `dungeon_delve_<n>` — the client's existing
// dungeon scene renders it as-is), so delvers never trample the shared tier
// arenas or each other. Party members standing with the starter come along,
// same as the Wildlands Token.
const DELVE_MODS = {
  swift_shadows:  { name: 'Swift Shadows',   icon: '💨', desc: 'The dark moves 25% faster.', mobSpd: 1.25 },
  thick_hides:    { name: 'Thick Hides',     icon: '🛡️', desc: 'Creatures carry 35% more health.', mobHp: 1.35 },
  sharp_fangs:    { name: 'Sharp Fangs',     icon: '🗡️', desc: 'Creatures bite 25% harder.', mobDmg: 1.25 },
  bountiful_dark: { name: 'Bountiful Dark',  icon: '💰', desc: 'Floor purses pay half again.', goldMult: 1.5 },
  glass_souls:    { name: 'Glass Souls',     icon: '🫙', desc: 'You strike +30% — and take +30%.', playerPower: 0.3, playerTakenMult: 1.3 },
  long_dark:      { name: 'The Long Dark',   icon: '🌌', desc: 'Every floor demands two more kills.', extraKills: 2 },
  starving_moon:  { name: 'Starving Moon',   icon: '🌘', desc: 'No out-of-combat mending down here.', noMend: true },
  lucky_stars:    { name: 'Lucky Stars',     icon: '✨', desc: 'Boon drafts offer four choices, not three.', boonChoices: 4 }
};
const DELVE_BOONS = {
  ember_heart:  { name: 'Ember Heart',    icon: '🔥', desc: '+8% damage dealt',                 stats: { power: 0.08 } },
  bark_skin:    { name: 'Bark Skin',      icon: '🪵', desc: '−6% damage taken',                 stats: { guard: 0.06 } },
  moon_blood:   { name: 'Moon Blood',     icon: '🌕', desc: '+18 max health (and mends 18 now)', stats: { vitality: 18 }, healNow: 18 },
  quick_wick:   { name: 'Quick Wick',     icon: '🕯️', desc: 'Abilities recharge 8% faster',     stats: { haste: 0.08 } },
  cat_step:     { name: 'Cat Step',       icon: '🐈‍⬛', desc: '+6% movement speed',              stats: { swift: 0.06 } },
  red_thread:   { name: 'Red Thread',     icon: '🧵', desc: 'Heal 3% of damage you deal',       stats: { leech: 0.03 } },
  witchs_broth: { name: "Witch's Broth",  icon: '🍲', desc: 'Mend +1.2 HP/s out of combat',     mending: 1.2 },
  wolfs_bargain:{ name: "Wolf's Bargain", icon: '🐺', desc: '+15% damage dealt, +8% taken',     stats: { power: 0.15, guard: -0.08 } },
  gravedigger:  { name: "Gravedigger's Cut", icon: '⚰️', desc: 'Floor purses pay +50% to you',  goldBonus: 0.5 }
};
const DELVE_BOON_IDS = Object.keys(DELVE_BOONS);
const DELVE_DRAFT_MS = 25 * 1000;
const DELVE_SPAWN = { x: 600, y: 1090 }; // The Delve = layout 5 (pillar field), entry chamber (south)
const DELVE_BOSS_SPAWN = { x: 600, y: 235 };
const DELVE_LANES = [ { x:70, y:1130 }, { x:1130, y:1130 }, { x:70, y:530 }, { x:1130, y:530 }, { x:590, y:830 }, { x:150, y:70 }, { x:1050, y:70 }, { x:770, y:1130 }, { x:930, y:810 }, { x:410, y:1130 }, { x:250, y:810 }, { x:390, y:490 }, { x:810, y:490 }, { x:410, y:70 }, { x:790, y:70 }, { x:210, y:310 } ];

function weeklyDelveMods(now) {
  const rand = mulberry32(((legendaryWeekIndex(now) * 1103515245) ^ 0x2545F491) >>> 0);
  const ids = Object.keys(DELVE_MODS);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, 2);
}

const delveRuns = new Map();        // runId -> run
const delveRunsByRoom = new Map();  // room  -> run
let delveRunSeq = 1;

function allDelveMobs() {
  if (!delveRuns.size) return [];
  const out = [];
  for (const run of delveRuns.values()) for (const m of run.mobs) out.push(m);
  return out;
}
function delveRunOf(player) {
  return player && player.delveRunId ? (delveRuns.get(player.delveRunId) || null) : null;
}
function delveMemberOf(player) {
  const run = delveRunOf(player);
  return run ? (run.members.get(player.id) || null) : null;
}
function delveModActive(run, modId) { return run.mods.includes(modId); }
function delveModVal(run, field, fallback) {
  let v = fallback;
  for (const id of run.mods) {
    const m = DELVE_MODS[id];
    if (m && m[field] != null) v = m[field];
  }
  return v;
}

// Boon plumbing — delve boons speak the SAME stat vocabulary as skills and
// gear, so statContrib() folds them in and every derived effect (damage,
// guard, max HP, cooldowns, speed, lifesteal) just works for the run.
function delveBoonContrib(player, statKey) {
  const member = delveMemberOf(player);
  if (!member) return 0;
  let sum = 0;
  for (const [boonId, stacks] of Object.entries(member.boons)) {
    const st = DELVE_BOONS[boonId] && DELVE_BOONS[boonId].stats;
    if (st && st[statKey]) sum += st[statKey] * stacks;
  }
  // Glass Souls: the week itself sharpens everyone's knives.
  const run = delveRunOf(player);
  if (statKey === 'power' && run) sum += delveModVal(run, 'playerPower', 0);
  return sum;
}
function delveMendingBonus(player) {
  const member = delveMemberOf(player);
  if (!member) return 0;
  const run = delveRunOf(player);
  if (run && delveModVal(run, 'noMend', false)) return -Infinity; // Starving Moon: no mending at all
  let sum = 0;
  for (const [boonId, stacks] of Object.entries(member.boons)) {
    if (DELVE_BOONS[boonId] && DELVE_BOONS[boonId].mending) sum += DELVE_BOONS[boonId].mending * stacks;
  }
  return sum;
}
function delveTakenMult(player) {
  const run = delveRunOf(player);
  return run ? delveModVal(run, 'playerTakenMult', 1) : 1;
}

function delveFloorTier(run) {
  return Math.min(4, run.startTier + Math.floor((run.floor - 1) / 2));
}
function delveKillsNeeded(run) {
  return 6 + Math.min(6, run.floor - 1) + (delveModActive(run, 'long_dark') ? DELVE_MODS.long_dark.extraKills : 0);
}
function delveSpawnFloor(run) {
  const tier = delveFloorTier(run);
  const floorMult = 1 + 0.12 * (run.floor - 1);
  const hpMult = floorMult * delveModVal(run, 'mobHp', 1);
  const dmgMult = floorMult * delveModVal(run, 'mobDmg', 1);
  const spdMult = delveModVal(run, 'mobSpd', 1);
  run.mobs = [];
  const keys = DUNGEON_MOB_KEYS_BY_TIER[tier];
  const count = delveKillsNeeded(run);
  for (let i = 0; i < count; i++) {
    const key = keys[Math.floor(Math.random() * keys.length)];
    const preset = DUNGEON_MOB_TYPES[key];
    const sp = DELVE_LANES[i % DELVE_LANES.length];
    const jitter = () => (Math.random() - 0.5) * 60;
    const sx = Math.max(50, Math.min(DUNGEON_SIZE - 50, sp.x + jitter()));
    const sy = Math.max(50, Math.min(DUNGEON_SIZE - 50, sp.y + jitter()));
    run.mobs.push({
      id: `delve_${run.id}_f${run.floor}_${i}`,
      mobType: key, tier, room: run.room, delve: run.id,
      hpMult, dmgMult, spdMult,
      spawnX: sx, spawnY: sy, x: sx, y: sy,
      facing: Math.random() * Math.PI * 2,
      wanderTimer: Math.random() * 2, wanderAngle: 0, paused: false,
      health: Math.round(preset.maxHealth * hpMult),
      scaledMax: Math.round(preset.maxHealth * hpMult),
      dead: false, respawnAt: 0, lastHitAt: 0
    });
  }
  // Every third floor, the tier's signature boss stalks the arena too —
  // scaled to the party like its counterpart in the named dungeons.
  if (run.floor % 3 === 0) {
    const bossKey = DUNGEON_LORE[tier].bossKey;
    const preset = DUNGEON_MOB_TYPES[bossKey];
    const alive = [...run.members.values()].filter(mm => mm.alive).length || 1;
    const bossHp = Math.round(preset.maxHealth * hpMult * (1 + PARTY_BOSS_HP_PER_ALLY * (alive - 1)));
    run.mobs.push({
      id: `delve_${run.id}_f${run.floor}_boss`,
      mobType: bossKey, tier, room: run.room, delve: run.id, boss: true, engaged: true,
      hpMult, dmgMult, spdMult,
      spawnX: DELVE_BOSS_SPAWN.x, spawnY: DELVE_BOSS_SPAWN.y,
      x: DELVE_BOSS_SPAWN.x, y: DELVE_BOSS_SPAWN.y,
      facing: Math.PI, wanderTimer: 2, wanderAngle: 0, paused: false,
      health: bossHp, scaledMax: bossHp,
      dead: false, respawnAt: 0, lastHitAt: 0
    });
  }
  run.kills = 0;
  run.killsNeeded = count; // the boss is a bonus, not a gate
  run.state = 'fighting';
}

function delveStatePayloadFor(run, player) {
  const member = run.members.get(player.id);
  return {
    type: 'delve_state',
    inRun: true,
    runId: run.id,
    room: run.room,
    floor: run.floor,
    tier: delveFloorTier(run),
    kills: run.kills,
    killsNeeded: run.killsNeeded,
    state: run.state,
    draftEndsAt: run.draftEndsAt || 0,
    mods: run.mods.map(id => ({ id, ...DELVE_MODS[id] })),
    members: [...run.members.entries()].map(([pid, mm]) => {
      const p = players.get(pid);
      return { id: pid, name: p ? p.name : '—', alive: mm.alive, picked: mm.picked !== false };
    }),
    myBoons: member ? member.boons : {},
    myOffer: member && member.offer ? member.offer.map(id => ({ id, ...DELVE_BOONS[id] })) : null,
    myGold: member ? member.gold : 0,
    speedMult: 1 + statContrib(player, 'swift') // client applies this while in the delve room
  };
}
function delveBroadcast(run) {
  for (const pid of run.members.keys()) {
    const p = players.get(pid);
    if (p) send(p.ws, delveStatePayloadFor(run, p));
  }
}

// The lobby/menu view (not in a run): this week's twists + boards.
function delveMenuPayload(player) {
  const now = Date.now();
  const wk = weekKey(now);
  return {
    type: 'delve_state',
    inRun: false,
    week: wk,
    weekEndsAt: LEGENDARY_EPOCH + (legendaryWeekIndex(now) + 1) * LEGENDARY_WEEK_MS,
    mods: weeklyDelveMods(now).map(id => ({ id, ...DELVE_MODS[id] })),
    best: player.accountKey ? (lbRankOf('delve', wk, player.accountKey) || { rank: null, value: 0 }) : { rank: null, value: 0 },
    top: lbTop('delve', wk, 5),
    isGuest: !player.accountKey
  };
}

function delveStart(player) {
  if (player.isDead) return;
  if (delveRunOf(player)) return;
  const room = player.room || 'outside';
  // No delving out of the underworld's own pockets — come up for air first.
  if (room.startsWith('dungeon_') || room === 'ember_wastes' || room === 'bank_vault' || room === 'witch_cave') {
    send(player.ws, { type: 'delve_error', message: 'The Delve opens from the town and the Wilds — come up out of there first.' });
    return;
  }
  const id = delveRunSeq++;
  const run = {
    id,
    room: `dungeon_delve_${id}`,
    startedAt: Date.now(),
    week: weekKey(Date.now()),
    mods: weeklyDelveMods(Date.now()),
    floor: 1, kills: 0, killsNeeded: 0,
    mobs: [], state: 'fighting', draftEndsAt: 0,
    members: new Map(),
    startTier: 1
  };
  // The starter and any party members standing with them descend together.
  const group = [player];
  const partyId = playerParty.get(player.id);
  if (partyId) {
    const party = parties.get(partyId);
    if (party) {
      for (const memberId of party.members) {
        if (memberId === player.id) continue;
        const m = players.get(memberId);
        if (m && m.room === player.room && !m.isDead && !delveRunOf(m)) group.push(m);
      }
    }
  }
  // The floor matches the strongest delver — brave for the low-levels, honest
  // for the veterans (no farming tier-1 rats at level 20).
  run.startTier = dungeonTierForLevel(Math.max(...group.map(p => getProgress(p).level)));
  for (const p of group) {
    run.members.set(p.id, {
      boons: {}, alive: true, picked: true, offer: null, gold: 0,
      returnRoom: p.room || 'outside'
    });
    p.delveRunId = id;
    const jitter = () => (Math.random() - 0.5) * 60;
    p.x = DELVE_SPAWN.x + jitter(); p.y = DELVE_SPAWN.y + jitter();
    p.room = run.room;
    p.roomLockUntil = Date.now() + 1500; // outlive any in-flight stale moves
    send(p.ws, { type: 'dungeon_entered', tier: run.startTier, room: run.room, spawn: { x: p.x, y: p.y }, level: getProgress(p).level, delve: true, floor: 1 });
  }
  delveRuns.set(id, run);
  delveRunsByRoom.set(run.room, run);
  delveSpawnFloor(run);
  delveBroadcast(run);
}

function noteDelveKill(player, mob) {
  const run = delveRuns.get(mob.delve);
  if (!run || run.state !== 'fighting') return;
  run.kills++;
  if (run.kills >= run.killsNeeded) {
    // Floor cleared — purses, then the boon draft.
    const goldMult = delveModVal(run, 'goldMult', 1);
    for (const [pid, mm] of run.members) {
      if (!mm.alive) continue;
      const p = players.get(pid);
      if (!p) continue;
      let purse = Math.round((12 + 8 * run.floor) * goldMult);
      const digger = mm.boons.gravedigger || 0;
      if (digger) purse = Math.round(purse * (1 + DELVE_BOONS.gravedigger.goldBonus * digger));
      mm.gold += purse;
      if (p.accountKey) {
        ensureBankAccount(p.accountKey).balance += purse;
      }
      const choices = delveModVal(run, 'boonChoices', 3);
      const pool = [...DELVE_BOON_IDS];
      mm.offer = [];
      for (let i = 0; i < choices && pool.length; i++) {
        mm.offer.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      mm.picked = false;
    }
    saveBankAccounts();
    run.state = 'draft';
    run.draftEndsAt = Date.now() + DELVE_DRAFT_MS;
    delveBroadcast(run);
  } else {
    delveBroadcast(run);
  }
}

function delveAdvanceFloor(run) {
  run.floor++;
  for (const mm of run.members.values()) { mm.offer = null; mm.picked = true; }
  delveSpawnFloor(run);
  for (const pid of run.members.keys()) {
    const p = players.get(pid);
    if (p) send(p.ws, { type: 'announce_soft', message: `🕳️ Floor ${run.floor} — ${DUNGEON_LORE[delveFloorTier(run)].name}'s creatures stir…` });
  }
  delveBroadcast(run);
}

function delveDepthOf(run) { return Math.max(0, run.floor - 1); }

function delveLeave(player, reason) {
  const run = delveRunOf(player);
  if (!run) return;
  const member = run.members.get(player.id);
  const depth = delveDepthOf(run);
  lbSetMax('delve', player, depth);
  run.members.delete(player.id);
  player.delveRunId = null;
  const returnRoom = (member && member.returnRoom) || 'outside';
  // A disconnect's position is restored by the resume stash instead.
  if (reason !== 'disconnect') {
    const returnPos = returnRoom === 'wilds' ? WORLD2.spawn : WORLD.spawn;
    player.x = returnPos.x; player.y = returnPos.y;
    player.room = returnRoom;
    player.roomLockUntil = Date.now() + 1500;
    send(player.ws, {
      type: 'delve_over',
      depth,
      gold: member ? member.gold : 0,
      reason: reason || 'exit',
      room: returnRoom, x: player.x, y: player.y,
      best: player.accountKey ? (lbRankOf('delve', weekKey(Date.now()), player.accountKey) || null) : null
    });
  }
  if (run.members.size === 0) {
    delveRuns.delete(run.id);
    delveRunsByRoom.delete(run.room);
  } else {
    delveBroadcast(run);
  }
}

// Delve mob AI — same brain as tickDungeon, scoped to each run's floor,
// with the week's stat twists applied. Dead delve mobs stay dead (a floor
// is about clearing it); wipes end the run for whoever's left dead.
function tickDelves(dt) {
  if (!delveRuns.size) return;
  const now = Date.now();
  const margin = 40;
  for (const run of delveRuns.values()) {
    if (run.state === 'draft') {
      const everyonePicked = [...run.members.values()].every(mm => !mm.alive || mm.picked);
      if (everyonePicked || now >= run.draftEndsAt) {
        // Time's up: the undecided get the first offer (never nothing).
        for (const mm of run.members.values()) {
          if (mm.alive && !mm.picked && mm.offer && mm.offer.length) {
            mm.boons[mm.offer[0]] = (mm.boons[mm.offer[0]] || 0) + 1;
            mm.picked = true; mm.offer = null;
          }
        }
        delveAdvanceFloor(run);
      }
      continue;
    }
    for (const m of run.mobs) {
      if (m.dead) continue;
      const preset = DUNGEON_MOB_TYPES[m.mobType];
      const speed = preset.speed * (m.spdMult || 1);
      const { player: nearestP, dist } = nearestDungeonPlayer(m.room, m.x, m.y);
      let vx = 0, vy = 0;
      if (m.scaredUntil > now && nearestP) {
        const dx = m.x - nearestP.x, dy = m.y - nearestP.y;
        const inv = dist > 0.01 ? 1 / dist : 0;
        vx = dx * inv * speed; vy = dy * inv * speed;
      } else if (nearestP && dist < preset.aggroRadius && !isEvading(nearestP)) {
        const dx = nearestP.x - m.x, dy = nearestP.y - m.y;
        const inv = dist > 0.01 ? 1 / dist : 0;
        vx = dx * inv * speed; vy = dy * inv * speed;
        if (dist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
          m.lastHitAt = now;
          const rolled = Math.round((preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1))) * (m.dmgMult || 1));
          const dmg = absorbIncomingDamage(nearestP, rolled);
          nearestP.health = Math.max(0, nearestP.health - dmg);
          noteAttacked(nearestP);
          if (nearestP.health <= 0) {
            nearestP.health = 0;
            nearestP.isDead = true;
            send(nearestP.ws, { type: 'you_died', byName: preset.name, mobId: m.id });
            const mm = run.members.get(nearestP.id);
            if (mm) mm.alive = false;
            const anyAlive = [...run.members.values()].some(x => x.alive);
            if (!anyAlive) {
              // Full wipe: the run is over; each ghost's respawn (or exit)
              // walks them out through delveLeave with the depth recorded.
              for (const pid of run.members.keys()) {
                const pp = players.get(pid);
                if (pp) send(pp.ws, { type: 'announce_soft', message: `☠️ The Delve claims the whole party at floor ${run.floor}. Depth ${delveDepthOf(run)} stands.` });
              }
            } else {
              delveBroadcast(run);
            }
          } else {
            send(nearestP.ws, { type: 'struck', byName: preset.name, damage: dmg, mobId: m.id });
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
          vx = Math.sin(m.wanderAngle) * speed * 0.3;
          vy = Math.cos(m.wanderAngle) * speed * 0.3;
        }
      }
      const nx = m.x + vx * dt, ny = m.y + vy * dt;
      if (vx !== 0 && nx > margin && nx < DUNGEON_SIZE - margin) m.x = nx;
      if (vy !== 0 && ny > margin && ny < DUNGEON_SIZE - margin) m.y = ny;
      if (vx !== 0 || vy !== 0) m.facing = Math.atan2(vx, vy);
    }
  }
}

// ── Covens ───────────────────────────────────────────────────────────────────
// Small, named, home-based — Diablo's Warbands minus everything else. Up to
// eight ACCOUNTS (guests are ephemeral by design), a private chat channel, a
// shared bank tab (usable from the Bank like your own), a claimable table in
// the Cauldron Café, and a short deed-log so the shared tab stays honest.
// Any member may invite; only the leader kicks; the last one out inherits
// whatever's left in the tab.
const COVENS_FILE = path.join(DATA_DIR, 'covens.json');
const covens = persistLoad('covens', COVENS_FILE);
persistRegister('covens', COVENS_FILE, () => covens);
function saveCoven(covenId) { persistSetKey('covens', COVENS_FILE, covens, covenId); }
const COVEN_MAX_MEMBERS = 8;
const COVEN_CREATE_COST = 250;
const COVEN_BANK_SLOTS = 12;
const COVEN_SIGILS = ['🕯️', '🌙', '🦇', '🐈‍⬛', '🕸️', '🌿', '⭐', '🔮', '🗝️', '🥀'];
const COVEN_TABLE_HOLD_MS = 24 * 3600 * 1000;
const covenIndex = new Map(); // accountKey -> covenId
for (const [cid, cv] of Object.entries(covens)) {
  for (const key of cv.members) covenIndex.set(key, cid);
}
const covenInvites = new Map(); // inviteId -> { covenId, targetKey, expiresAt }
setInterval(() => {
  const now = Date.now();
  for (const [id, inv] of covenInvites) if (inv.expiresAt <= now) covenInvites.delete(id);
}, 15000);

function covenOf(accountKey) {
  const cid = covenIndex.get(accountKey);
  return cid ? covens[cid] || null : null;
}
function covenLog(cv, who, action) {
  cv.log = cv.log || [];
  cv.log.push({ at: Date.now(), who, action });
  if (cv.log.length > 20) cv.log = cv.log.slice(-20);
}
function covenDisplayName(key) {
  return accounts[key] ? accounts[key].username : key;
}
function covenStatePayload(cv, viewerKey) {
  return {
    coven: {
      id: cv.id, name: cv.name, sigil: cv.sigil, motd: cv.motd || '',
      leaderKey: cv.leaderKey,
      you: viewerKey,
      members: cv.members.map(k => ({
        key: k, name: covenDisplayName(k),
        online: !!findConnectionByAccountKey(k),
        leader: k === cv.leaderKey
      })),
      bank: { gold: cv.bank.gold, slots: cv.bank.slots },
      log: (cv.log || []).slice(-10),
      table: cv.table && cv.table.until > Date.now() ? cv.table : null
    }
  };
}
function covenBroadcast(cv) {
  for (const key of cv.members) {
    const p = findConnectionByAccountKey(key);
    if (p) send(p.ws, { type: 'coven_state', ...covenStatePayload(cv, key) });
  }
}
// The café table view for everyone standing in the room (not just members):
// which coven holds the table right now, if any.
function covenTableFor(room) {
  if (room !== 'cafe') return null;
  const now = Date.now();
  for (const cv of Object.values(covens)) {
    if (cv.table && cv.table.room === 'cafe' && cv.table.until > now) {
      return { name: cv.name, sigil: cv.sigil, until: cv.table.until };
    }
  }
  return null;
}

// ── Web push notifications ───────────────────────────────────────────────────
// "…and a phone notification when the moon rises." Real Web Push (RFC 8291
// aes128gcm encryption + RFC 8292 VAPID auth) implemented on Node built-ins
// only — no new npm deps, matching the verify-iap precedent. Works for web
// + installed-PWA players in real browsers; the Electron desktop shell and
// the Capacitor apps don't ship push transport, so their subscribe simply
// fails soft client-side (documented in DEPLOY-SERVER.md).
//
// VAPID keys self-bootstrap: generated once on first boot and persisted, so
// there is NOTHING to configure. Pushes only go to accounts that are
// OFFLINE (an online player already sees the in-town announcements), and
// moonrise/blood-moon pushes are rate-limited per subscription (the town's
// 40-minute cycle has ~36 moonrises a day — nobody wants 36 pings).
const SERVER_CONFIG_FILE = path.join(DATA_DIR, 'serverConfig.json');
const serverConfig = persistLoad('serverConfig', SERVER_CONFIG_FILE);
persistRegister('serverConfig', SERVER_CONFIG_FILE, () => serverConfig);
// Web push (Session L) — extracted to lib/webpush.js (Tier 3.4 Phase B).
const webpush = require('./lib/webpush')({ dataDir: DATA_DIR, persistLoad, persistSetKey, persistRegister, serverConfig, serverConfigFile: SERVER_CONFIG_FILE, findConnectionByAccountKey });
const { pushSubs, savePushSubs, getVapidKeys, encryptWebPush, vapidAuthHeader, sendWebPush, pushBroadcast, PUSH_MAX_SUBS_PER_ACCOUNT } = webpush;

// Moonrise watcher — pings when day turns to night (rate limit above keeps
// it to at most one per subscription per ~day despite the 40-minute cycle).
let _wasNight = isNightNow();
setInterval(() => {
  const night = isNightNow();
  if (night && !_wasNight) {
    pushBroadcast('moonrise', '🌕 The moon rises over Thornreach', 'Night creatures are stirring — the first trophy of the night pays a bonus.');
  }
  _wasNight = night;
}, 15 * 1000);

// The subscribe/unsubscribe doors. Account-bound (the push follows the
// account, like the pass and the stones).
app.post('/api/push/subscribe', (req, res) => {
  const keys = getVapidKeys();
  if (!keys) return res.status(503).json({ ok: false, error: 'push_unavailable' });
  const accountKey = req.body && req.body.account_token ? sessions.get(String(req.body.account_token)) : null;
  if (!accountKey) return res.status(401).json({ ok: false, error: 'account_required' });
  const s = req.body.subscription;
  if (!s || !s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth) return res.status(400).json({ ok: false, error: 'bad_subscription' });
  if (!/^https:\/\//.test(s.endpoint) && !process.env.PUSH_ALLOW_HTTP) return res.status(400).json({ ok: false, error: 'bad_endpoint' });
  const prefs = {
    moonrise: !!(req.body.prefs && req.body.prefs.moonrise),
    bloodmoon: !(req.body.prefs && req.body.prefs.bloodmoon === false),
    peddler: !(req.body.prefs && req.body.prefs.peddler === false),
    events: !(req.body.prefs && req.body.prefs.events === false)
  };
  const list = pushSubs[accountKey] || (pushSubs[accountKey] = []);
  const existing = list.find(x => x.endpoint === s.endpoint);
  if (existing) {
    existing.p256dh = s.keys.p256dh; existing.auth = s.keys.auth; existing.prefs = prefs;
  } else {
    list.push({ endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, prefs, addedAt: Date.now(), lastNightPushAt: 0 });
    while (list.length > PUSH_MAX_SUBS_PER_ACCOUNT) list.shift();
  }
  savePushSubs(accountKey);
  res.json({ ok: true, prefs });
});

app.post('/api/push/unsubscribe', (req, res) => {
  const accountKey = req.body && req.body.account_token ? sessions.get(String(req.body.account_token)) : null;
  if (!accountKey) return res.status(401).json({ ok: false, error: 'account_required' });
  const endpoint = String((req.body.subscription && req.body.subscription.endpoint) || req.body.endpoint || '');
  if (pushSubs[accountKey]) {
    pushSubs[accountKey] = pushSubs[accountKey].filter(x => x.endpoint !== endpoint);
    if (!pushSubs[accountKey].length) delete pushSubs[accountKey];
    savePushSubs(accountKey);
  }
  res.json({ ok: true });
});

// ── First Steps (Session L onboarding) ──────────────────────────────────────
// A visible win inside the first 20 minutes: three tiny goals every newcomer
// can hit, each celebrated the moment it lands, with a small purse at the
// end. Solo Leveling's post-EVOLUTION lesson, Thornreach-sized. Retired
// forever once done (and never shown to veterans — see the join gate).
const FIRST_STEPS = [
  { id: 'talked',    label: 'Speak with a townsperson',       icon: '💬' },
  { id: 'harvested', label: 'Harvest something in the Wilds', icon: '🌿' },
  { id: 'killed',    label: 'Fell one night creature',        icon: '⚔️' }
];
const FIRST_STEPS_REWARD_GOLD = 25;
function firstStepsState(prog) {
  if (!prog.firstSteps) prog.firstSteps = { talked: false, harvested: false, killed: false, done: false };
  return prog.firstSteps;
}
function firstStepsPayload(player, justCompleted) {
  const st = firstStepsState(getProgress(player));
  return {
    type: 'first_steps',
    steps: FIRST_STEPS.map(s => ({ ...s, done: !!st[s.id] })),
    done: !!st.done,
    justCompleted: justCompleted || null,
    rewardGold: FIRST_STEPS_REWARD_GOLD
  };
}
function noteFirstStep(player, stepId) {
  const prog = getProgress(player);
  if (prog.level >= 5 && !prog.firstSteps) return; // veterans predating the tracker never see it
  const st = firstStepsState(prog);
  if (st.done || st[stepId]) return;
  st[stepId] = true;
  const allDone = FIRST_STEPS.every(s => st[s.id]);
  if (allDone) {
    st.done = true;
    if (player.accountKey) {
      ensureBankAccount(player.accountKey).balance += FIRST_STEPS_REWARD_GOLD;
      saveBankAccounts();
    }
  }
  if (player.accountKey) saveProgress();
  send(player.ws, firstStepsPayload(player, stepId));
  if (allDone) {
    send(player.ws, { type: 'announce_soft', message: `🏮 First Steps complete!${player.accountKey ? ` ${FIRST_STEPS_REWARD_GOLD} gold waits in your bank.` : ' (With an account, rewards like this would follow you.)'} Your Journal (J) always names the next goal.` });
  }
}

// ── Login streaks + the "while you were gone" letter (Session L) ─────────────
// Consecutive-day logins pay a small escalating purse (a full week adds a
// bonus); coming back after 8h+ away earns a letter that counts what regrew,
// which side quests cooled down, whether the Peddler rotated, and what the
// calendar holds — a gift on the doormat, never a guilt trip.
const LETTER_AWAY_MS = 8 * 3600 * 1000;
function applyLoginStreak(player, prog, nowMs) {
  const dayIdx = Math.floor(nowMs / 86400000);
  if (prog.lastLoginDay === dayIdx) return null;
  prog.loginStreak = (prog.lastLoginDay === dayIdx - 1) ? (prog.loginStreak || 0) + 1 : 1;
  prog.lastLoginDay = dayIdx;
  if ((prog.bestLoginStreak || 0) < prog.loginStreak) prog.bestLoginStreak = prog.loginStreak;
  const gold = Math.min(60, 10 + 5 * (prog.loginStreak - 1));
  const weeklyBonus = prog.loginStreak % 7 === 0 ? 100 : 0;
  ensureBankAccount(player.accountKey).balance += gold + weeklyBonus;
  saveBankAccounts();
  return { count: prog.loginStreak, best: prog.bestLoginStreak, gold, weeklyBonus };
}
function buildWelcomeLetter(player, prog, streakInfo, nowMs) {
  const awayMs = prog.lastSeenAt ? nowMs - prog.lastSeenAt : 0;
  if (awayMs < LETTER_AWAY_MS) return null;
  const myHarv = decorHarvestedAt[player.accountKey] || {};
  const regrown = Object.values(myHarv).filter(t => nowMs - t >= HARVEST_COOLDOWN_MS).length;
  const cds = prog.questCooldowns || {};
  const questsReady = Object.values(cds).filter(t => nowMs - t >= QUEST_COOLDOWN_MS && t > prog.lastSeenAt - QUEST_COOLDOWN_MS).length;
  return {
    type: 'welcome_letter',
    awayHours: Math.floor(awayMs / 3600000),
    regrown,
    questsReady,
    peddlerRotated: legendaryWeekIndex(prog.lastSeenAt) !== legendaryWeekIndex(nowMs),
    streak: streakInfo,
    calendar: calendarPublicState(nowMs)
  };
}

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

// ---------------------------------------------------------------------------
// The Ember Wastes — a Wilds-styled PvP/hostile-NPC map, reached only
// through the red portal that appears over the Temple's altar once all 4
// Torchkeepers have lit their torches for the night (see templePortalOpen()
// below, computed off the same TORCH_NPCS.working flags townTorchPublicState
// already uses). Same "outdoor sub-room" pattern as the Witch's Cave/Vault:
// its own bounded map, entered/exited via a handshake rather than the
// free-roam Wilds portal, since entry has to be gated on the portal
// actually being open right now. Every ember mob is always hostile (no
// day/night gating needed inside — the whole zone is only ever reachable
// at night to begin with) and can both be fought (Strike, same lootable-
// corpse flow as any other mob) and pickpocketed while still alive
// (steal_from_mob, a flat chance independent of the Wanderer's Sleight of
// Hand skill level — this is a map mechanic open to every character, not a
// class spell).
// ---------------------------------------------------------------------------
const EMBER_WORLD_DIMS = { width: 4000, height: 4000 };
const EMBER_SPAWN = { x: 2000, y: 3650 };

const EMBER_MOB_TYPES = {
  ash_wraith:   { name: 'Ash Wraith',   color: 0xff5522, scale: 0.85, maxHealth: 60,  speed: 85, aggroRadius: 260, strikeRange: 50, dmgMin: 10, dmgMax: 16, hitCooldownMs: 1300, xp: 20,
    lootTable: [ { itemId: 'shadow_essence', qty: 1, chance: 0.35 }, { gold: true, min: 6, max: 16, chance: 0.6 } ],
    stealChance: 0.4, stealTable: [ 'fur_scrap', 'bone_shard' ] },
  bonecaller:   { name: 'Bonecaller',   color: 0xd8d0b8, scale: 1.0,  maxHealth: 85,  speed: 55, aggroRadius: 230, strikeRange: 55, dmgMin: 13, dmgMax: 19, hitCooldownMs: 1600, xp: 26,
    lootTable: [ { itemId: 'bone_shard', qty: 2, chance: 0.5 }, { gold: true, min: 8, max: 20, chance: 0.6 }, { itemId: 'dread_helm', qty: 1, chance: 0.03 } ],
    stealChance: 0.35, stealTable: [ 'bone_shard', 'leather_hide' ] },
  cinder_brute: { name: 'Cinder Brute', color: 0x8a1a00, scale: 1.4,  maxHealth: 140, speed: 24, aggroRadius: 190, strikeRange: 65, dmgMin: 20, dmgMax: 30, hitCooldownMs: 2400, xp: 34,
    lootTable: [ { itemId: 'iron_ore', qty: 1, chance: 0.4 }, { gold: true, min: 14, max: 32, chance: 0.65 }, { itemId: 'cursed_blade', qty: 1, chance: 0.04 } ],
    stealChance: 0.3, stealTable: [ 'iron_ore', 'animal_pelt' ] }
};
const EMBER_SCALE = EMBER_WORLD_DIMS.width / 1000;
const EMBER_MOB_SPAWNS = [
  { x: 220, y: 220, type: 'ash_wraith' },   { x: 780, y: 220, type: 'ash_wraith' },
  { x: 220, y: 780, type: 'ash_wraith' },   { x: 780, y: 780, type: 'ash_wraith' },
  { x: 500, y: 150, type: 'bonecaller' },   { x: 150, y: 500, type: 'bonecaller' },
  { x: 850, y: 500, type: 'bonecaller' },   { x: 500, y: 850, type: 'bonecaller' },
  { x: 350, y: 500, type: 'cinder_brute' }, { x: 650, y: 500, type: 'cinder_brute' },
  { x: 500, y: 350, type: 'cinder_brute' }, { x: 500, y: 650, type: 'cinder_brute' }
].map(p => ({ x: p.x * EMBER_SCALE, y: p.y * EMBER_SCALE, type: p.type }));
const EMBER_MOB_RESPAWN_MS = 90 * 1000;
const emberMobs = EMBER_MOB_SPAWNS.map((p, i) => ({
  id: 'ember_' + i,
  mobType: p.type,
  spawnX: p.x, spawnY: p.y, x: p.x, y: p.y,
  facing: Math.random() * Math.PI * 2,
  wanderTimer: Math.random() * 2, wanderAngle: 0, paused: false,
  health: EMBER_MOB_TYPES[p.type].maxHealth, dead: false, respawnAt: 0,
  lastHitAt: 0, lastStolenAt: 0
}));

function nearestEmberPlayer(x, y) {
  let best = null, bestDist = Infinity;
  for (const p of players.values()) {
    if (p.room !== 'ember_wastes' || p.isDead) continue;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return { player: best, dist: bestDist };
}

// Mob-vs-mob skirmishes — ambient background conflict for players to
// notice and watch, lower priority than actually aggroing a player (a
// nearby player always takes over immediately, see the rivalId reset
// below). Rolled on a timer while a mob has no player threat and no
// ongoing rival; once picked, the fight plays out with the exact same
// chase/strike math as a player encounter, just retargeted at another mob
// — real damage, real death/respawn, and since the loser still drops its
// normal loot table, it's finders-keepers for whoever loots the corpse
// (see the loot_corpse handler's lootKillerId check — null means anyone).
const SKIRMISH_RANGE = 220;
const SKIRMISH_CHANCE = 0.3; // rolled roughly every 4-8s per idle mob

function tickEmberWastes(dt) {
  const now = Date.now();
  const margin = 60;
  for (const m of emberMobs) {
    if (m.dead) {
      if (now >= m.respawnAt) {
        m.dead = false;
        m.health = EMBER_MOB_TYPES[m.mobType].maxHealth;
        m.x = m.spawnX; m.y = m.spawnY;
        m.pendingLoot = null; m.lootKillerId = null;
        m.rivalId = null;
      }
      continue;
    }
    const preset = EMBER_MOB_TYPES[m.mobType];
    const { player: nearestP, dist } = nearestEmberPlayer(m.x, m.y);
    let vx = 0, vy = 0;
    if (m.scaredUntil > now && nearestP) {
      const dx = m.x - nearestP.x, dy = m.y - nearestP.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * preset.speed;
      vy = dy * inv * preset.speed;
    } else if (nearestP && dist < preset.aggroRadius && !isEvading(nearestP)) {
      m.rivalId = null; // a real player threat always wins out over a squabble
      const dx = nearestP.x - m.x, dy = nearestP.y - m.y;
      const inv = dist > 0.01 ? 1 / dist : 0;
      vx = dx * inv * preset.speed;
      vy = dy * inv * preset.speed;
      if (dist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
        m.lastHitAt = now;
        const dmg = absorbIncomingDamage(nearestP, preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1)));
        nearestP.health = Math.max(0, nearestP.health - dmg);
        noteAttacked(nearestP);
        if (nearestP.health <= 0) {
          nearestP.health = 0;
          nearestP.isDead = true;
          send(nearestP.ws, { type: 'you_died', byName: preset.name, mobId: m.id });
        } else {
          send(nearestP.ws, { type: 'struck', byName: preset.name, damage: dmg, mobId: m.id });
        }
      }
    } else {
      let rival = m.rivalId ? emberMobs.find(o => o.id === m.rivalId && !o.dead) : null;
      if (!rival) {
        m.rivalId = null;
        if (!m.skirmishCheckAt || now >= m.skirmishCheckAt) {
          m.skirmishCheckAt = now + 4000 + Math.random() * 4000;
          if (Math.random() < SKIRMISH_CHANCE) {
            const candidates = emberMobs.filter(o => o !== m && !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < SKIRMISH_RANGE);
            if (candidates.length) {
              rival = candidates[Math.floor(Math.random() * candidates.length)];
              m.rivalId = rival.id;
            }
          }
        }
      }
      if (rival) {
        const rdist = Math.hypot(rival.x - m.x, rival.y - m.y);
        if (rdist > SKIRMISH_RANGE * 1.5) {
          m.rivalId = null; // strayed too far apart — call it off
        } else {
          const dx = rival.x - m.x, dy = rival.y - m.y;
          const inv = rdist > 0.01 ? 1 / rdist : 0;
          vx = dx * inv * preset.speed;
          vy = dy * inv * preset.speed;
          if (rdist < preset.strikeRange && (!m.lastHitAt || now - m.lastHitAt >= preset.hitCooldownMs)) {
            m.lastHitAt = now;
            const dmg = preset.dmgMin + Math.floor(Math.random() * (preset.dmgMax - preset.dmgMin + 1));
            rival.health = Math.max(0, rival.health - dmg);
            broadcastAll({ type: 'ember_mob_attacked', mobId: m.id }); // no player was hit, so nothing else would trigger the attack animation
            if (rival.health <= 0) {
              rival.dead = true;
              rival.respawnAt = now + EMBER_MOB_RESPAWN_MS;
              const rivalPreset = EMBER_MOB_TYPES[rival.mobType];
              rival.pendingLoot = rollPendingLoot(rivalPreset.lootTable);
              rival.lootKillerId = null; // no player earned this — free for whoever loots it first
              m.rivalId = null;
            }
          }
        }
      }
      if (!rival) {
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
    }
    const nx = m.x + vx * dt, ny = m.y + vy * dt;
    if (vx !== 0 && nx > margin && nx < EMBER_WORLD_DIMS.width - margin) m.x = nx;
    if (vy !== 0 && ny > margin && ny < EMBER_WORLD_DIMS.height - margin) m.y = ny;
    if (vx !== 0 || vy !== 0) m.facing = Math.atan2(vx, vy);
  }
}

// A "sticky" state, not a pure function of the current instant — it opens
// the moment all 4 torches are lit (same condition townTorchPublicState()
// already reports per-torch, collapsed to one shared boolean), but during
// the dawn walk back to the altar working/praying are BOTH false for
// everyone (the walk takes MORNING_TEMPLE_WALK_MS to complete), so a pure
// "are all torches lit right now" check would slam it shut the instant
// night ends — before they've even started walking home. Instead it just
// holds its previous value through that whole transition, closing only
// once every Torchkeeper has actually arrived and is praying.
let templePortalIsOpen = false;
function updateTemplePortalState() {
  if (TORCH_NPCS.every(n => n.working)) templePortalIsOpen = true;
  else if (TORCH_NPCS.every(n => n.praying)) templePortalIsOpen = false;
}
function templePortalOpen() {
  return templePortalIsOpen;
}

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

// Lexton Greyfur's "Join the Howl" trade — his only offer. It uses the
// player's own microphone, only after an explicit per-purchase consent
// prompt (see werewolf_voice_request below), a few seconds long, capturing
// the howl itself rather than anything spoken. Not level-gated, unlike the
// Witch's tiers — small, flat pool.
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

// Same per-room world dimensions the 'move' handler clamps player position
// against — shared here so ground-targeted spells (see the 'ground' branch
// in cast_spell) can clamp a sigil's placement the same way.
function roomBounds(room) {
  if (room === 'wilds') return WORLD2;
  if (room === 'witch_cave') return { width: 800, height: 700 };
  if (room === 'bank_vault') return VAULT_WORLD_DIMS;
  if (room === 'ember_wastes') return EMBER_WORLD_DIMS;
  if (typeof room === 'string' && room.startsWith('dungeon_')) return { width: DUNGEON_SIZE, height: DUNGEON_SIZE };
  return WORLD;
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
  // Savage Bite is the Werewolf's real damage attack — ranged like Fireball
  // is for the Witch (applyDamage with no maxRange), hits players AND mobs.
  // First in the catalog so it lands on hotbar key 1.
  savage_bite:      { name: 'Savage Bite',       kind: 'targeted', effect: 'damage', dmgMin: 16, dmgMax: 26 },
  // Iron Pelt/Moonlit Mending complete the kit: a ward (the class-neutral
  // 'ward' status — same halving as Gourd Ward's pumpkin, wolfier look)
  // and a self-heal (same 'regen' the Bone-Knit Blessing uses).
  iron_pelt:        { name: 'Iron Pelt',         kind: 'self', effect: 'status', statusType: 'ward',  durationMs: 30000 },
  moonlit_mending:  { name: 'Moonlit Mending',   kind: 'self', effect: 'status', statusType: 'regen', durationMs: 12000 },
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
// peeks at the target's carried inventory (not equipped gear) and rolls a
// steal chance (see PICKPOCKET_* below) to lift one item from it. Unlike
// Spy Glass, this one IS covert on success: the target only ever finds out
// when the attempt *fails* (see the pickpocket branch in cast_attack) — a
// clean steal is silent on their end, they just notice the item's gone later.
const WANDERER_ATTACK_CATALOG = {
  // Knife Throw/Trail Remedy/Packmule's Guard complete the Wanderer's kit
  // the same way Savage Bite & co. complete the Werewolf's above: a real
  // damage attack (players and mobs), a self-heal, and a ward.
  knife_throw:        { name: 'Knife Throw',         kind: 'targeted', effect: 'damage', dmgMin: 14, dmgMax: 24 },
  trail_remedy:       { name: 'Trail Remedy',        kind: 'self', effect: 'status', statusType: 'regen', durationMs: 12000 },
  packmule_guard:     { name: "Packmule's Guard",    kind: 'self', effect: 'status', statusType: 'ward',  durationMs: 30000 },
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

// charId 2 — Mystic. A spirit-medium's full battle kit: damage (Spirit
// Lash), a leech (Soul Siphon, mirrors the Witch's Leech Hex), wards for
// self AND allies, healing for self AND allies (Mending Spirits is the
// one targeted instant heal in the game alongside the Knight's Lay on
// Hands), and the intel pair (Whispered Secret single-target reveal +
// Spirit Walk full-realm sweep, same already-public-data model as the
// Witch's Scrying Orb / Nightwing Augury).
const MYSTIC_ATTACK_CATALOG = {
  spirit_lash:       { name: 'Spirit Lash',        kind: 'targeted', effect: 'damage', dmgMin: 16, dmgMax: 28 },
  soul_siphon:       { name: 'Soul Siphon',        kind: 'targeted', effect: 'leech',  dmgMin: 10, dmgMax: 18 },
  banshee_wail:      { name: 'Banshee Wail',       kind: 'aoe', effect: 'status', statusType: 'shrink', durationMs: 20000 },
  ethereal_veil:     { name: 'Ethereal Veil',      kind: 'self', effect: 'status', statusType: 'ward',  durationMs: 30000 },
  spirit_ward:       { name: 'Spirit Ward',        kind: 'targeted', effect: 'status', statusType: 'ward', durationMs: 30000 },
  ghost_step:        { name: 'Ghost Step',         kind: 'self', effect: 'status', statusType: 'speedboost', durationMs: 12000 },
  seance_of_mending: { name: 'Séance of Mending',  kind: 'self', effect: 'status', statusType: 'regen', durationMs: 12000 },
  mending_spirits:   { name: 'Mending Spirits',    kind: 'targeted', effect: 'heal', healMin: 22, healMax: 38 },
  whispered_secret:  { name: 'Whispered Secret',   kind: 'targeted', effect: 'reveal' },
  spirit_walk:       { name: 'Spirit Walk',        kind: 'self', effect: 'intel_sweep', statusType: 'bats', durationMs: 15000 },
  haunting:          { name: 'Haunting',           kind: 'targeted', effect: 'status', statusType: 'bats', durationMs: 15000 },
  graveyard_chill:   { name: 'Graveyard Chill',    kind: 'targeted', effect: 'status', statusType: 'stumble', durationMs: 25000 }
};

// charId 3 — Knight. The oathbound order's kit: the hardest-hitting single
// damage attack in the game (Smite), crowd control (Shield Bash stagger,
// Banner of Dread AoE), wards for self and allies, self-regen plus the
// targeted Lay on Hands heal, and knightly reconnaissance (Sentinel's
// Watch reveal + Herald's Muster realm-wide muster report).
const KNIGHT_ATTACK_CATALOG = {
  smite:             { name: 'Smite',              kind: 'targeted', effect: 'damage', dmgMin: 18, dmgMax: 30 },
  shield_bash:       { name: 'Shield Bash',        kind: 'targeted', effect: 'status', statusType: 'stumble', durationMs: 20000 },
  rallying_wrath:    { name: 'Rallying Wrath',     kind: 'self', effect: 'status', statusType: 'giant', durationMs: 15000 },
  oath_of_iron:      { name: 'Oath of Iron',       kind: 'self', effect: 'status', statusType: 'ward',  durationMs: 30000 },
  guardians_pledge:  { name: "Guardian's Pledge",  kind: 'targeted', effect: 'status', statusType: 'ward', durationMs: 30000 },
  field_dressing:    { name: 'Field Dressing',     kind: 'self', effect: 'status', statusType: 'regen', durationMs: 12000 },
  lay_on_hands:      { name: 'Lay on Hands',       kind: 'targeted', effect: 'heal', healMin: 25, healMax: 40 },
  sentinels_watch:   { name: "Sentinel's Watch",   kind: 'targeted', effect: 'reveal' },
  heralds_muster:    { name: "Herald's Muster",    kind: 'self', effect: 'intel_sweep', statusType: 'wolfmark', durationMs: 10000 },
  challenge:         { name: 'Challenge',          kind: 'targeted', effect: 'status', statusType: 'wolfmark', durationMs: 30000 },
  steadfast_march:   { name: 'Steadfast March',    kind: 'self', effect: 'status', statusType: 'speedboost', durationMs: 12000 },
  banner_of_dread:   { name: 'Banner of Dread',    kind: 'aoe', effect: 'status', statusType: 'stumble', durationMs: 15000 }
};

// charId -> attack catalog. cast_attack below looks itself up here instead
// of hardcoding a single charId — every non-Witch class now has a full kit
// (the Witch's equivalent is SPELL_CATALOG via cast_spell above).
const ATTACK_CATALOGS = {
  1: WEREWOLF_ATTACK_CATALOG,
  2: MYSTIC_ATTACK_CATALOG,
  3: KNIGHT_ATTACK_CATALOG,
  4: WANDERER_ATTACK_CATALOG
};

const ATTACK_COOLDOWN_MS = 8000;
const AOE_RADIUS = 200; // world units — roughly 3-4 character-widths

// ---------------------------------------------------------------------------
// Sleight of Hand skill progress — only successful steals count, tracked as
// a running total (playerProgress[accountKey].pickpocketSuccesses, same
// persistence as XP/level above) rather than its own separate level counter,
// so the level itself is always just derived from that total and never gets
// out of sync with it. Every PICKPOCKET_SUCCESSES_PER_LEVEL successful
// steals raises the skill a level, up to PICKPOCKET_MAX_LEVEL; success
// chance scales linearly from the catalog's base stealChance (level 1) up
// to PICKPOCKET_MAX_CHANCE (94%) at max level.
// ---------------------------------------------------------------------------
const PICKPOCKET_SUCCESSES_PER_LEVEL = 5;
const PICKPOCKET_MAX_LEVEL = 10;
const PICKPOCKET_MAX_CHANCE = 0.94;

function pickpocketLevelForSuccesses(successes) {
  return Math.min(PICKPOCKET_MAX_LEVEL, 1 + Math.floor(successes / PICKPOCKET_SUCCESSES_PER_LEVEL));
}
function pickpocketChanceForLevel(level, baseChance) {
  const t = (level - 1) / (PICKPOCKET_MAX_LEVEL - 1);
  return baseChance + (PICKPOCKET_MAX_CHANCE - baseChance) * t;
}

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

  // Liveness bookkeeping for the reaper below — browsers answer protocol
  // pings automatically, so a socket that misses a round is a half-open
  // corpse (phone radio died mid-air, network path gone), not a player.
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'join') {
      if (player) return; // already joined
      // A resume token stands in for the passcode — it could only have been
      // minted by a session that already passed this check, and an invalid
      // one fails loudly as resume_expired below (never a silent guest).
      if (TOWN_PASSWORD && !msg.resumeToken && msg.password !== TOWN_PASSWORD) {
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
      // Seamless checkout return: a valid resume token means "rebuild me as
      // the player I was when I left for Stripe." All-or-nothing — a dead
      // or mismatched token gets a join_error so the client can fall back
      // to the normal join screen instead of silently becoming a fresh
      // guest with a lost life.
      let resume = null;
      if (typeof msg.resumeToken === 'string' && msg.resumeToken) {
        const entry = resumeStashes.get(msg.resumeToken);
        resumeStashes.delete(msg.resumeToken); // single-use, hit or miss
        if (entry && entry.expiresAt > Date.now() && (entry.stash.accountKey || null) === (accountKey || null)) {
          resume = entry.stash;
        } else {
          send(ws, { type: 'join_error', code: 'resume_expired', message: 'That moment has passed — step back into town!' });
          return;
        }
      }
      // A resume means "I am the continuation of that player" — so if an
      // older connection for the same identity is still hanging around,
      // kick it before rebuilding. Otherwise the town gains a frozen
      // duplicate of the same character. This happens for real: the
      // checkout departure stashes the player while they're STILL
      // connected, and the old socket's close can lag behind the Stripe
      // redirect (proxies, phones) — a fast checkout return then joins
      // while the pre-checkout self is still standing there. Identity =
      // same account, or (for guests) the very same restored store
      // references handed back by the stash.
      //
      // Session L addendum — ONE ACCOUNT, ONE BODY, always. The same sweep
      // now also runs for PLAIN account logins (found live: logging in from
      // a second device put two bodies of one account in the town — two
      // writers on one inventory/bank/progress record is item-duping bait).
      // A fresh login is a TAKEOVER: the older connection is told why it's
      // closing, and every resume path back in for it is burned so the
      // losing device can't wander a duplicate back into the map.
      const evictDuplicateBodies = (takeover) => {
        for (const [oid, op] of [...players]) {
          const sameAccount = accountKey && op.accountKey === accountKey;
          const sameGuest = !accountKey && resume && (
            (resume.guestInventory && op.guestInventory === resume.guestInventory) ||
            (resume.guestProgress && op.guestProgress === resume.guestProgress)
          );
          if (!sameAccount && !sameGuest) continue;
          delveLeave(op, 'disconnect'); // depth recorded; run torn down if last
          leaveParty(op);
          if (takeover) {
            op.liveResumeToken = null; // its next disconnect stashes nothing
            send(op.ws, { type: 'session_takeover', message: '🌒 Your account just stepped into the town from another device — this visit closes so there is only ever one of you.' });
          }
          if (op.room !== 'outside') {
            broadcastAll({ type: 'clear_user_messages', room: op.room, id: op.id });
          }
          // Remove it ourselves rather than waiting on its close event —
          // a lagging/half-open socket's close is exactly what we can't
          // rely on here. The close handler is a no-op once the map
          // entry is gone (it checks players.get(id) === player).
          players.delete(oid);
          broadcastAll({ type: 'player_left', id: oid });
          try { op.ws.close(); } catch (e) {}
        }
        if (takeover && accountKey) {
          // Burn any parked resume stashes for this account too — an older
          // device returning with a stashed token must not resurrect a dupe.
          for (const [tok, entry] of resumeStashes) {
            if ((entry.stash.accountKey || null) === accountKey) resumeStashes.delete(tok);
          }
        }
      };
      if (!resume && accountKey) evictDuplicateBodies(true);
      if (resume) {
        evictDuplicateBodies(false);
      }
      const name = resume ? resume.name : (account ? account.username : sanitizeName(msg.name));
      const color = resume ? resume.color : (account ? account.color : COLORS[colorIdx++ % COLORS.length]);
      // Character look is a per-session cosmetic choice, not tied to the
      // account itself (unlike name/color above) — just trust whatever
      // valid index the client picked on the join screen, falling back to
      // a random one if it's missing or out of range.
      const charId = resume ? resume.charId
        : Number.isInteger(msg.charId) && msg.charId >= 0 && msg.charId < CHARACTER_COUNT
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
        x: resume ? resume.x : WORLD.spawn.x,
        y: resume ? resume.y : WORLD.spawn.y,
        room: resume ? resume.room : 'outside',
        // Undestroyed notes currently held, mirrors the client's inbox array
        // — for Rapid Swipe to steal from. For a logged-in account this is
        // the SAME array reference as inboxes[accountKey] (created if this
        // is their first connect), so every push/splice below already
        // mutates the persisted store directly; saveInboxes() just flushes
        // it to disk. Guests get a fresh array that's gone on disconnect.
        inbox: accountKey ? (inboxes[accountKey] || (inboxes[accountKey] = [])) : (resume && resume.guestInbox ? resume.guestInbox : []),
        health: resume ? resume.health : 100, // 0-100, shown as the heart HUD's percentage
        xp: 0, level: 1, skillPoints: 0, // overwritten by syncProgressToPlayer() below
        activeQuest: resume ? resume.activeQuest : null, // { questId, progress } or null
        // Town Pass state, resolved below (account store, then the browser's
        // Checkout-session receipt). 0 = no pass.
        passUntil: 0,
        // Countermeasures (see cm_voice / cm_disguise handlers): when the
        // last blow landed on this player, until when they're slipping
        // attacks, when they last played a clip, and their current mask.
        lastAttackedAt: 0,
        evasionUntil: 0,
        lastVoiceCmAt: 0,
        disguise: resume ? resume.disguise : null // { name, image } or null
      };
      // A resumed GUEST gets their in-memory stores handed back whole —
      // XP/level/quest-cooldowns/campaign (guestProgress), carried items +
      // equipped gear (guestInventory), and Hard Drive media. Accounts
      // reload all of that from their persistent stores by accountKey, so
      // the stash only carries their transient bits (position, quest, mask).
      if (resume && !accountKey) {
        if (resume.guestProgress) player.guestProgress = resume.guestProgress;
        if (resume.guestInventory) player.guestInventory = resume.guestInventory;
        if (resume.guestHardDrive) player.guestHardDrive = resume.guestHardDrive;
      }
      players.set(id, player);
      syncProgressToPlayer(player); // sets player.maxHealth from vitality skills
      // Character roster — powers the returning-player select screen. Remember
      // which classes this account has played and which was most recent, so
      // /api/characters can offer "continue as …" cards on the next visit.
      if (accountKey) {
        const rosterProg = getProgress(player);
        if (!rosterProg.characters) rosterProg.characters = {};
        if (!rosterProg.characters[player.charId]) {
          rosterProg.characters[player.charId] = { firstPlayedAt: Date.now() };
        }
        rosterProg.characters[player.charId].lastPlayedAt = Date.now();
        rosterProg.lastCharId = player.charId;
        saveProgress();
      }
      // A fresh (non-resumed) join starts at full health — which, for an
      // account that already invested vitality, is above 100.
      if (!resume) player.health = player.maxHealth;
      // Account-held pass, if any (bought while logged in on any device).
      if (accountKey && (townPasses[accountKey] || 0) > Date.now()) {
        player.passUntil = townPasses[accountKey];
      }
      // Guest receipt: the browser presents the Stripe Checkout session id
      // it kept in localStorage. Known ids grant instantly; an id this
      // server has never seen (restart, other instance) is re-verified
      // against Stripe in the background and granted via pass_state.
      if (!player.passUntil && typeof msg.passSession === 'string' && msg.passSession) {
        const cached = passSessions.get(msg.passSession);
        if (cached && cached > Date.now()) {
          player.passUntil = cached;
        } else if (!cached && stripeClient) {
          const claimedId = msg.passSession;
          stripeClient.checkout.sessions.retrieve(claimedId).then(session => {
            if (session.payment_status !== 'paid') return;
            const expiresAt = grantForSession(claimedId, (session.created || Math.floor(Date.now() / 1000)) * 1000, passHoursForStripeSession(session));
            if (expiresAt > Date.now() && players.get(id) === player) {
              player.passUntil = expiresAt;
              send(player.ws, { type: 'pass_state', passUntil: expiresAt });
            }
          }).catch(() => {}); // a bogus/foreign id just stays passless
        }
      }
      // Resume: carry the pre-checkout pass across (canceled checkouts keep
      // whatever pass was already held), then make sure the restored spot
      // is still legal — a known room, and never inside a ticketed building
      // without a live pass (e.g. the pass expired mid-checkout).
      if (resume) {
        if ((resume.passUntil || 0) > player.passUntil) player.passUntil = resume.passUntil;
        const knownRoom = (r) => r === 'outside' || r === 'wilds' || r === 'witch_cave'
          || r === 'bank_vault' || r === 'ember_wastes' || WORLD.buildings.some(b => b.id === r);
        if (!knownRoom(player.room) || (LOCKED_ROOMS.has(player.room) && player.passUntil <= Date.now())) {
          player.room = 'outside';
          player.roomLockUntil = Date.now() + 1500; // stale in-flight moves must not undo this
          player.x = WORLD.spawn.x;
          player.y = WORLD.spawn.y;
        }
      }
      // Loads (or creates) their inventory immediately rather than lazily
      // on first panel-open, so a returning account holder's equipped gear
      // shows up on their model from the moment they spawn, not after they
      // happen to open the inventory panel once.
      syncEquipToPlayer(player);
      // Now that equipped gear is loaded, recompute max health so vitality
      // GEAR counts too (the earlier pass only saw vitality skills), and top
      // a fresh join off to full.
      player.maxHealth = playerMaxHealth(player);
      if (!resume) player.health = player.maxHealth;
      // 😴 Rested XP window — a "welcome back" boost, at most once per 2h per
      // account. A live resume (mid-session reconnect) carries its remaining
      // window rather than re-granting.
      if (resume && resume.restedUntil) {
        player.restedUntil = resume.restedUntil;
      } else {
        const rprog = getProgress(player);
        if (!rprog.lastRestedAt || Date.now() - rprog.lastRestedAt >= REST_COOLDOWN_MS) {
          player.restedUntil = Date.now() + REST_MS;
          rprog.lastRestedAt = Date.now();
          if (player.accountKey) saveProgress();
        }
      }

      // Live resume token — minted for every join and sent in init. If this
      // socket later dies without warning (phone screen off, network blip),
      // the close handler stashes the player under this token, and the
      // client's auto-reconnect presents it to be rebuilt mid-session as the
      // exact same character in the exact same spot. Single-use, same
      // account-guarded restore path as the checkout flow.
      player.liveResumeToken = crypto.randomBytes(24).toString('hex');

      send(ws, {
        type: 'init',
        id,
        resumed: !!resume, // client swaps its view to the restored room/spot
        resumeToken: player.liveResumeToken,
        world: WORLD,
        world2: WORLD2,
        players: Array.from(players.values()).map(publicPlayer),
        // Equipment stat catalog — the client uses this to preview how a swap
        // would change your stats before you commit, with no server round-trip.
        equipStats: EQUIP_STATS,
        // Premium currency + the Peddler's catalog (Session I). The client
        // merges legendaryCatalog into its own ITEM_CATALOG at init — one
        // authoritative copy, no hand-sync.
        moonstones: player.accountKey ? msBalance(player.accountKey) : 0,
        msPacks: MS_PACKS,
        msAuctionFee: AUCTION_MS_FEE,
        legendaryCatalog: LEGENDARY_CATALOG,
        itemCatalog: ITEM_CATALOG,
        // Session L: the named dungeons' lore, the event calendar, this
        // week's Delve twists, and whether web push is available here.
        dungeonLore: DUNGEON_LORE,
        calendar: calendarPublicState(),
        delveMods: weeklyDelveMods(Date.now()).map(mid => ({ id: mid, ...DELVE_MODS[mid] })),
        covenSigils: COVEN_SIGILS,
        pushAvailable: !!getVapidKeys(),
        pushPublicKey: getVapidKeys() ? getVapidKeys().publicKey : null,
        // 😴 Rested XP window (epoch ms, 0 = none) — the client counts it down.
        restedUntil: player.restedUntil || 0,
        townPass: {
          lockedRooms: [...LOCKED_ROOMS],
          passUntil: player.passUntil || 0,
          priceCents: TOWN_PASS_PRICE_CENTS,
          hours: TOWN_PASS_HOURS,
          price30Cents: TOWN_PASS30_PRICE_CENTS,
          hours30: TOWN_PASS30_HOURS,
          product30: IAP_PRODUCT30_ID,
          paymentsEnabled: !!stripeClient
        }
      });
      // Restore whatever notes were already sitting in their inbox from a
      // prior session (account holders only — guests start empty above).
      send(ws, { type: 'inbox_state', notes: player.inbox });
      // Your own view of what's grown back (regrowth is per player).
      send(ws, { type: 'decor_state', decor: decorPublicState(player) });
      // Catch the newcomer up on any masks currently being worn — the 70ms
      // state stream only carries names, the images travel once, here.
      for (const p of players.values()) {
        if (p !== player && p.disguise) {
          send(ws, { type: 'disguise_state', id: p.id, name: p.disguise.name, image: p.disguise.image });
        }
      }
      // Campaign position for this class — sent up-front so the Journal
      // renders instantly instead of round-tripping on first open.
      send(ws, storyStatePayload(player));
      // Class skill tree + current allocations, so the Skills panel and the
      // client-side speed/max-health effects are live from the first frame.
      send(ws, { type: 'skill_state', ...skillStatePayload(player) });
      // Event calendar snapshot — tournament/festival/blood-moon windows and
      // the player's coven, so the HUD and boards render from the first frame.
      send(ws, { type: 'calendar_state', calendar: calendarPublicState() });
      if (player.accountKey) {
        const cv = covenOf(player.accountKey);
        if (cv) send(ws, { type: 'coven_state', ...covenStatePayload(cv, player.accountKey) });
      }
      // Gold you can actually SEE (live report): the balance used to be
      // visible only inside the bank teller window — NPC shops showed
      // "Balance: ?" until you'd opened the bank once this session, and
      // the pack showed no gold at all. Every logged-in join now gets its
      // bank state (and carried inventory) pushed up front, so the pack
      // header, shop greeting lines, and the Auction House balance strip
      // all have a live number from the first frame.
      if (player.accountKey) {
        send(ws, { type: 'bank_state', ...bankStatePayload(player.accountKey) });
        send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      }
      // First Steps — newcomers get their three-goal tracker; anyone who
      // predates it at level 5+ has it quietly retired.
      {
        const fsProg = getProgress(player);
        const fsSt = firstStepsState(fsProg);
        if (!fsSt.done && fsProg.level >= 5) { fsSt.done = true; if (player.accountKey) saveProgress(); }
        if (!fsSt.done) send(ws, firstStepsPayload(player, null));
      }
      // ── Login streaks + the "while you were gone" letter (Session L) ──
      // A returning account lands on a gift, not a guilt trip: the daily
      // streak pays a small purse, and being away 8h+ earns a letter that
      // counts what regrew, what's ready, and what's coming up.
      if (player.accountKey && !resume) {
        const prog = getProgress(player);
        const nowMs = Date.now();
        const streakInfo = applyLoginStreak(player, prog, nowMs);
        const letter = buildWelcomeLetter(player, prog, streakInfo, nowMs);
        if (letter) {
          send(ws, letter);
        } else if (streakInfo) {
          send(ws, {
            type: 'daily_streak',
            ...streakInfo,
            message: `🔥 Day ${streakInfo.count} in a row — ${streakInfo.gold + streakInfo.weeklyBonus} gold paid to your bank${streakInfo.weeklyBonus ? ' (a full week — bonus purse!)' : ''}.`
          });
        }
        prog.lastSeenAt = nowMs;
        saveProgress();
      }
      // A restored side quest re-renders its tracker silently (a
      // message-less quest_update never toasts).
      if (resume && player.activeQuest && QUEST_CATALOG[player.activeQuest.questId]) {
        const rq = QUEST_CATALOG[player.activeQuest.questId];
        send(ws, {
          type: 'quest_update',
          questId: player.activeQuest.questId,
          questName: rq.name,
          progress: player.activeQuest.progress,
          target: rq.target,
          where: objectiveWhere({ type: rq.type, targetItemId: rq.targetItemId, targetCreature: rq.targetCreature })
        });
      }
      broadcastAll({ type: 'player_joined', player: publicPlayer(player) }, ws);
      return;
    }

    if (!player) return; // ignore everything else until joined

    if (msg.type === 'move') {
      // Room-authority grace (Session L): when the SERVER just teleported
      // this player (delve start, dungeon token, portal exits…), a stale
      // move packet that was already in flight still carries the OLD room
      // and coordinates — applying it would yank the player straight back
      // out. For a short window after any server-side room set, moves that
      // disagree about the room are dropped whole. (Found live: a delver's
      // leftover town move flipped them to 'outside' server-side — standing
      // in the delve, unable to hit anything, invisible to the mobs.)
      if (Date.now() < (player.roomLockUntil || 0) && msg.room !== player.room) return;
      // Dungeon rooms (the four tiers and every delve instance) are only
      // ever ENTERED and LEFT through their handlers — so while you're in
      // one, a move claiming any other room can only be a stale packet, no
      // matter how late it straggles in. Drop it whole.
      if (player.room && player.room.startsWith('dungeon_') && msg.room !== player.room) return;
      const x = Number(msg.x), y = Number(msg.y);
      const bounds = roomBounds(msg.room);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        player.x = Math.max(0, Math.min(bounds.width, x));
        player.y = Math.max(0, Math.min(bounds.height, y));
      }
      if (typeof msg.room === 'string' && ROOM_IDS.has(msg.room)) {
        // The Town Pass gate, enforced here and not just in the client's
        // own door prediction — a crafted move message can't walk through
        // a locked door. Same pattern as the Ember Wastes gate: the client
        // check is a courtesy, this is the actual lock.
        if (LOCKED_ROOMS.has(msg.room) && player.room !== msg.room && !hasTownPass(player)) {
          send(ws, {
            type: 'room_locked',
            room: msg.room,
            priceCents: TOWN_PASS_PRICE_CENTS,
            hours: TOWN_PASS_HOURS,
            paymentsEnabled: !!stripeClient
          });
          return;
        }
        // Setting foot somewhere new advances any visit-this-place story
        // chapter — fired only on an actual change, not every move tick.
        const changedRoom = player.room !== msg.room;
        player.room = msg.room;
        if (changedRoom) storyEvent(player, 'visit_room', { room: msg.room });
        // Walking into the café tells you whose sigil hangs over the big
        // table right now (Session L covens).
        if (changedRoom && msg.room === 'cafe') {
          send(ws, { type: 'coven_table_state', table: covenTableFor('cafe') });
        }
      }
      return;
    }

    if (msg.type === 'emote') {
      // Quick emotes — the cheapest social loop there is. Fixed set (no
      // free-text riding an emoji channel), light rate limit, and unlike
      // chat they work OUTDOORS too: a wave across the town square is
      // exactly the moment emotes exist for.
      const emote = String(msg.emote || '');
      if (!EMOTE_SET.includes(emote)) return;
      const now = Date.now();
      if (player.lastEmoteAt && now - player.lastEmoteAt < 1200) return;
      player.lastEmoteAt = now;
      broadcastRoom(player.room, { type: 'emote_fx', id: player.id, emote });
      return;
    }

    if (msg.type === 'leave_room') {
      // A player just walked out of (or hit "Leave" in) a building. Wipe
      // everything they said in that room from every connected client's
      // chat log — chat in a building doesn't outlive your visit there.
      const room = String(msg.room || '');
      if (!ROOM_IDS.has(room) || room === 'outside') return;
      player.room = 'outside';
      player.roomLockUntil = Date.now() + 1500; // stale in-flight moves must not undo this
      broadcastAll({ type: 'clear_user_messages', room, id: player.id });
      return;
    }

    if (msg.type === 'send_note') {
      // Private, point-to-point note — kept in target.inbox in memory for
      // as long as it's undestroyed so Rapid Swipe has something to
      // actually steal. For a logged-in recipient it's also persisted to
      // inboxes.json (see saveInboxes() below) so it survives a
      // disconnect/reconnect; a guest recipient's copy still dies with the
      // connection like the rest of their guest data. Delivered only if the
      // recipient is currently connected; not queued for later (a guest has
      // no durable identity to deliver to once they leave). image is
      // optional — only the Open 3rd Eye spell result currently uses it
      // (see spell_photo below), the normal "write a note" UI is text-only.
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
      if (target.accountKey) saveInboxes();
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
      if (player.accountKey) saveInboxes();
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
      // Server-side proximity: the teller lives in the Bank, so opening an
      // account requires actually being in the Bank — a crafted client can't
      // bank from the far side of town. (Buildings you're already inside are
      // the server's proximity truth; movement itself stays client-trusted.)
      if (player.room !== 'bank') {
        send(ws, { type: 'bank_error', message: 'Step up to the teller inside the Bank to open your account.' });
        return;
      }
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
      // The Moonstone lane (Session I): listings are denominated in either
      // gold (bank balance, the original) or Moonstones. Same escrow shape.
      const currency = msg.currency === 'ms' ? 'ms' : 'gold';
      // Where the item comes out of: 'inventory' lists straight from the
      // pack the player is carrying (no bank-deposit round-trip), 'bank'
      // is the original vault-sourced flow and stays the default so older
      // clients keep working unchanged. Either way the item is escrowed
      // out the moment the listing goes up, and returnListingItemToSeller
      // sends it back to the same place if the auction ends unsold.
      const source = msg.source === 'inventory' ? 'inventory' : 'bank';
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
      if (source === 'inventory') {
        const inv = getInventory(player);
        if (!removeItemFromAccount(inv, itemId, qty)) {
          send(ws, { type: 'bank_error', message: 'You aren’t carrying that many of that item to list.' });
          return;
        }
        saveInventories();
        send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      } else {
        const account = ensureBankAccount(player.accountKey);
        if (!removeItemFromAccount(account, itemId, qty)) {
          send(ws, { type: 'bank_error', message: 'You don’t have that many of that item to list.' });
          return;
        }
        saveBankAccounts();
      }
      const listing = {
        id: makeId(),
        sellerKey: player.accountKey,
        sellerName: player.name,
        currency, source,
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
      const isMs = (listing.currency || 'gold') === 'ms';
      if (isMs) {
        // Moonstone lane — escrow against the account's Moonstone balance,
        // exactly the same shape as gold (deduct now, refund the outbid).
        if (msBalance(player.accountKey) < amount) {
          send(ws, { type: 'bank_error', message: `You don’t have enough Moonstones for that bid (you carry ${msBalance(player.accountKey)} 💎).` });
          return;
        }
        msAdjust(player.accountKey, -amount);
        if (listing.currentBidderKey) {
          msAdjust(listing.currentBidderKey, listing.currentBid);
          pushMsStateIfOnline(listing.currentBidderKey);
        }
        listing.currentBid = amount;
        listing.currentBidderKey = player.accountKey;
        listing.currentBidderName = player.name;
        send(ws, { type: 'ms_state', balance: msBalance(player.accountKey) });
      } else {
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
      }

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
        // Gear now changes real stats — refresh max health (and clamp current
        // HP if a vitality piece came off) and push a fresh stat block so the
        // stats panel updates the instant gear changes.
        player.maxHealth = playerMaxHealth(player);
        if (player.health > player.maxHealth) player.health = player.maxHealth;
        send(ws, { type: 'skill_state', ...skillStatePayload(player) });
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

    // The Bank's Locksmith — resets the password on a LOCKED Hard Drive for a
    // flat fee, so a player who forgot their own password (or looted a locked
    // drive) isn't permanently shut out. Charged against the Bank balance,
    // same deduct-then-save pattern as send-money / auction bids.
    if (msg.type === 'harddrive_reset_lock') {
      const LOCKSMITH_FEE = 10;
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'locksmith_error', message: 'You need a Hard Drive in your pack for me to work on.' });
        return;
      }
      const hd = getHardDrive(player);
      if (!hd.passwordHash) {
        send(ws, { type: 'locksmith_error', message: 'That drive isn\u2019t even locked \u2014 nothing for me to spring.' });
        return;
      }
      if (!player.accountKey) {
        send(ws, { type: 'locksmith_error', message: 'Only account players keep gold at the Bank \u2014 no gold on hand, no service.' });
        return;
      }
      const acct = ensureBankAccount(player.accountKey);
      if (acct.balance < LOCKSMITH_FEE) {
        send(ws, { type: 'locksmith_error', message: `I charge ${LOCKSMITH_FEE} gold, and your Bank balance won\u2019t cover it.` });
        return;
      }
      acct.balance -= LOCKSMITH_FEE;
      hd.passwordSalt = null;
      hd.passwordHash = null;
      persistHardDrive(player);
      saveBankAccounts();
      send(ws, { type: 'bank_state', ...bankStatePayload(player.accountKey) });
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      send(ws, { type: 'locksmith_done', message: `\ud83d\udd13 Lock sprung and the password wiped. That\u2019ll be ${LOCKSMITH_FEE} gold \u2014 set a new one whenever you like.` });
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
      if (player.accountKey) saveInboxes();
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
      if (player.accountKey) saveInboxes();
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

    // ── Hard Drive media: selfies & voice clips ─────────────────────────
    // Same access pattern as the note handlers above: you need the 💽 item,
    // and a password-locked drive demands its password for every mutation.

    if (msg.type === 'harddrive_save_selfie') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'harddrive_error', message: 'You need a Hard Drive in your inventory to store selfies.' });
        return;
      }
      const hd = driveMedia(getHardDrive(player));
      const err = checkHardDrivePassword(hd, msg.password);
      if (err) { send(ws, { type: 'harddrive_error', message: err }); return; }
      if (hd.selfies.length >= HARDDRIVE_SELFIE_CAPACITY) {
        send(ws, { type: 'harddrive_error', message: `Your drive already holds ${HARDDRIVE_SELFIE_CAPACITY} selfies — delete one first.` });
        return;
      }
      const image = sanitizeImage(msg.image);
      if (!image) { send(ws, { type: 'harddrive_error', message: 'That image didn’t come through — try capturing it again.' }); return; }
      // A selfie you capture yourself is a selfie of YOU — the drive tags
      // it that way and cm_disguise trusts the tag, so wearing your own
      // face as a mask is possible but pointless, exactly as it should be.
      hd.selfies.push({ id: makeId(), image, of: player.name, savedAt: Date.now() });
      persistHardDrive(player);
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      return;
    }

    if (msg.type === 'harddrive_save_selfie_from_note') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'harddrive_error', message: 'You need a Hard Drive in your inventory to store selfies.' });
        return;
      }
      const hd = driveMedia(getHardDrive(player));
      const err = checkHardDrivePassword(hd, msg.password);
      if (err) { send(ws, { type: 'harddrive_error', message: err }); return; }
      if (hd.selfies.length >= HARDDRIVE_SELFIE_CAPACITY) {
        send(ws, { type: 'harddrive_error', message: `Your drive already holds ${HARDDRIVE_SELFIE_CAPACITY} selfies — delete one first.` });
        return;
      }
      const note = player.inbox.find(n => n.id === String(msg.noteId || ''));
      if (!note || !note.image) {
        send(ws, { type: 'harddrive_error', message: 'That note has no picture on it.' });
        return;
      }
      // The picture stays on the note too — this copies, it doesn't move.
      // Face tag: a snapshot card is a picture of its subject; anything
      // else (a 3rd-Eye vision, a photo someone attached) is treated as a
      // picture of whoever it came from / shows — the snapOf field when
      // present, else the sender.
      const of = note.snapOf || note.fromName || 'a stranger';
      hd.selfies.push({ id: makeId(), image: note.image, of, savedAt: Date.now() });
      persistHardDrive(player);
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      return;
    }

    if (msg.type === 'harddrive_save_clip') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'harddrive_error', message: 'You need a Hard Drive in your inventory to store voice clips.' });
        return;
      }
      const hd = driveMedia(getHardDrive(player));
      const err = checkHardDrivePassword(hd, msg.password);
      if (err) { send(ws, { type: 'harddrive_error', message: err }); return; }
      if (hd.clips.length >= HARDDRIVE_CLIP_CAPACITY) {
        send(ws, { type: 'harddrive_error', message: `Your drive already holds ${HARDDRIVE_CLIP_CAPACITY} voice clips — delete one first.` });
        return;
      }
      const audio = sanitizeAudio(msg.audio);
      if (!audio) { send(ws, { type: 'harddrive_error', message: 'That recording didn’t come through — try again.' }); return; }
      const label = sanitizeText(String(msg.label || '')).slice(0, 40) || 'Voice clip';
      hd.clips.push({ id: makeId(), audio, label, savedAt: Date.now() });
      persistHardDrive(player);
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      return;
    }

    if (msg.type === 'harddrive_delete_media') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'harddrive_error', message: 'You need a Hard Drive in your inventory to manage it.' });
        return;
      }
      const hd = driveMedia(getHardDrive(player));
      const err = checkHardDrivePassword(hd, msg.password);
      if (err) { send(ws, { type: 'harddrive_error', message: err }); return; }
      const list = msg.kind === 'clip' ? hd.clips : hd.selfies;
      const idx = list.findIndex(m => m.id === String(msg.mediaId || ''));
      if (idx === -1) { send(ws, { type: 'harddrive_error', message: 'That’s not on your drive.' }); return; }
      const [removed] = list.splice(idx, 1);
      // Taking off a mask you just deleted.
      if (msg.kind !== 'clip' && player.disguise && player.disguise.image === removed.image) {
        player.disguise = null;
        broadcastAll({ type: 'disguise_state', id: player.id, name: null, image: null });
      }
      persistHardDrive(player);
      send(ws, { type: 'harddrive_state', ...hardDriveStatePayload(hd) });
      return;
    }

    // ── Countermeasures ─────────────────────────────────────────────────
    // The payoff for keeping media on your drive. cm_state is the light
    // list the combat quick-bar renders (ids and labels only — the heavy
    // data URLs stay server-side until something is actually used).

    if (msg.type === 'cm_state') {
      const hd = driveMedia(getHardDrive(player));
      send(ws, {
        type: 'cm_state',
        hasDrive: ownsHardDriveItem(player),
        clips: hd.clips.map(c => ({ id: c.id, label: c.label })),
        selfies: hd.selfies.map(s => ({ id: s.id, of: s.of })),
        disguise: player.disguise ? { name: player.disguise.name } : null,
        voiceCooldownMsLeft: Math.max(0, VOICE_CM_COOLDOWN_MS - (Date.now() - (player.lastVoiceCmAt || 0)))
      });
      return;
    }

    if (msg.type === 'cm_voice') {
      if (player.isDead) return;
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'cm_error', message: 'You need your 💽 Hard Drive on you to play a clip.' });
        return;
      }
      const now = Date.now();
      if (now - (player.lastAttackedAt || 0) > ATTACKED_RECENT_MS) {
        send(ws, { type: 'cm_error', message: 'Nothing is attacking you right now — a clip would just be noise.' });
        return;
      }
      if (now - (player.lastVoiceCmAt || 0) < VOICE_CM_COOLDOWN_MS) {
        const left = Math.ceil((VOICE_CM_COOLDOWN_MS - (now - player.lastVoiceCmAt)) / 1000);
        send(ws, { type: 'cm_error', message: `Your drive is still rewinding — ${left}s before another clip.` });
        return;
      }
      const hd = driveMedia(getHardDrive(player));
      const clip = hd.clips.find(c => c.id === String(msg.clipId || '')) || hd.clips[0];
      if (!clip) {
        send(ws, { type: 'cm_error', message: 'No voice clips on your drive — record one from the 💽 Hard Drive panel.' });
        return;
      }
      player.lastVoiceCmAt = now;
      player.evasionUntil = now + VOICE_CM_EVADE_MS;
      // Every mob sharing the player's map inside the blast radius is
      // routed — they scatter exactly like the rabbits do from footsteps.
      const scareUntil = now + VOICE_CM_SCARE_MS;
      const inBlast = (m) => Math.hypot(m.x - player.x, m.y - player.y) <= VOICE_CM_RADIUS;
      if (player.room === 'outside') for (const m of mobs) { if (!m.dead && inBlast(m)) m.scaredUntil = scareUntil; }
      if (player.room === 'wilds') for (const m of mobs2) { if (!m.dead && inBlast(m)) m.scaredUntil = scareUntil; }
      if (player.room.startsWith('dungeon_')) for (const m of dungeonMobs) { if (!m.dead && m.room === player.room && inBlast(m)) m.scaredUntil = scareUntil; }
      if (player.room === 'ember_wastes') for (const m of emberMobs) { if (!m.dead && inBlast(m)) m.scaredUntil = scareUntil; }
      // The whole point: everyone nearby actually HEARS it. Proximity, not
      // room-wide — a clip fired at the town gates shouldn't play at the
      // fountain. The player's own client is included (they hear their own
      // echo and get the visual).
      const payload = JSON.stringify({
        type: 'voice_cm',
        from: player.name,
        playerId: player.id,
        x: player.x, y: player.y,
        audio: clip.audio,
        label: clip.label,
        evadeMs: VOICE_CM_EVADE_MS
      });
      for (const p of players.values()) {
        if (p.room === player.room && Math.hypot(p.x - player.x, p.y - player.y) <= VOICE_CM_RADIUS && p.ws.readyState === p.ws.OPEN) {
          p.ws.send(payload);
        }
      }
      send(ws, { type: 'cm_result', message: `📢 "${clip.label}" rings out — you slip through the chaos! (${Math.round(VOICE_CM_EVADE_MS / 1000)}s)` });
      return;
    }

    if (msg.type === 'cm_disguise') {
      if (!ownsHardDriveItem(player)) {
        send(ws, { type: 'cm_error', message: 'You need your 💽 Hard Drive on you to wear a disguise.' });
        return;
      }
      const selfieId = msg.selfieId ? String(msg.selfieId) : null;
      if (!selfieId) {
        player.disguise = null;
        broadcastAll({ type: 'disguise_state', id: player.id, name: null, image: null });
        send(ws, { type: 'cm_result', message: '🎭 Mask off. You’re yourself again.' });
        return;
      }
      const hd = driveMedia(getHardDrive(player));
      const s = hd.selfies.find(x => x.id === selfieId);
      if (!s) { send(ws, { type: 'cm_error', message: 'That selfie isn’t on your drive.' }); return; }
      player.disguise = { name: s.of, image: s.image };
      // One heavy broadcast per change; the 70ms state stream only ever
      // carries disguiseName (see publicPlayer).
      broadcastAll({ type: 'disguise_state', id: player.id, name: s.of, image: s.image });
      send(ws, { type: 'cm_result', message: `🎭 You hold the picture of ${s.of} up as a mask. To wandering eyes — and shopkeepers — you're them now.` });
      return;
    }

    // 📷 Snapshot — point your chat-camera at a nearby player and take an
    // in-world picture. What lands in YOUR inbox is a photo card of what
    // they LOOK like — which, if they're masked, is the disguise, not the
    // player under it. That's the whole game of it.
    if (msg.type === 'snap_player') {
      const now = Date.now();
      if (now - (player.lastSnapAt || 0) < SNAP_COOLDOWN_MS) {
        send(ws, { type: 'cm_error', message: 'Your camera is still winding the film.' });
        return;
      }
      const t = players.get(String(msg.targetId || ''));
      if (!t || t.id === player.id || t.room !== player.room || t.isDead) {
        send(ws, { type: 'cm_error', message: 'No one there to photograph.' });
        return;
      }
      if (Math.hypot(t.x - player.x, t.y - player.y) > SNAP_RANGE) {
        send(ws, { type: 'cm_error', message: 'Too far away for a clear shot — get closer.' });
        return;
      }
      player.lastSnapAt = now;
      const shownName = t.disguise ? t.disguise.name : t.name;
      const note = {
        id: makeId(),
        fromId: t.id,
        fromName: '📷 Snapshot',
        snapOf: shownName,
        isSnap: true,
        text: `A snapshot of ${shownName}, taken in ${describeRoom(player.room)}.`,
        image: t.disguise ? t.disguise.image : null,
        snapCharId: t.charId
      };
      player.inbox.push(note);
      if (player.accountKey) saveInboxes();
      send(ws, { type: 'note_received', note });
      // The subject hears the shutter click — paranoia is half the fun,
      // and it means wearing a mask actually gets tested by other players.
      send(t.ws, { type: 'cm_result', message: `📷 ${player.name} just took your picture!` });
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
      // Any conversation with a named NPC counts for talk-to-them story
      // chapters, whether or not they have side-quest work to offer.
      storyEvent(player, 'talk_npc', { npcId });
      const questId = questForNpc(player, npcId);
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

    // Reading a Wilds waymarker — reuses the hint-dialogue modal shape the
    // client already renders; the "NPC" is the stone itself.
    if (msg.type === 'read_waymarker') {
      const marker = WAYMARKER_LORE[String(msg.markerId || '')];
      if (!marker) return;
      send(ws, { type: 'npc_hint_dialogue', npcId: String(msg.markerId), npcName: marker.name, message: marker.text });
      return;
    }

    if (msg.type === 'npc_hint_talk') {
      const npcId = String(msg.npcId || '');
      const giver = NPC_HINT_GIVERS[npcId];
      if (!giver) return;
      storyEvent(player, 'talk_npc', { npcId });
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
      const questId = questForNpc(player, npcId);
      if (!questId || !QUEST_CATALOG[questId]) return;
      if (player.activeQuest) return; // already on a quest
      const prog = getProgress(player);
      const lastDone = prog.questCooldowns && prog.questCooldowns[questId];
      if (lastDone && Date.now() - lastDone < QUEST_COOLDOWN_MS) return;
      player.activeQuest = { questId, progress: 0 };
      const quest = QUEST_CATALOG[questId];
      const where = objectiveWhere({ type: quest.type, targetItemId: quest.targetItemId, targetCreature: quest.targetCreature });
      send(ws, { type: 'quest_started', questId, questName: quest.name,
        target: quest.target, description: quest.description, where,
        message: `🗒️ Quest accepted: "${quest.name}" — ${where}` });
      return;
    }

    if (msg.type === 'quest_cancel') {
      player.activeQuest = null;
      send(ws, { type: 'quest_cancelled' });
      return;
    }

    // ── Story campaign handlers — see STORYLINES/storyEvent above ─────────
    if (msg.type === 'story_state') {
      send(ws, storyStatePayload(player));
      return;
    }

    if (msg.type === 'story_begin') {
      const line = STORYLINES[player.charId];
      if (!line) return;
      const st = getStoryState(player);
      if (st.active || st.chapter >= line.chapters.length) {
        send(ws, storyStatePayload(player));
        return;
      }
      const chapter = line.chapters[st.chapter];
      // The pacing gate, enforced where it counts (the Journal's Begin
      // button greys itself out too, but that's courtesy, not the lock).
      const level = getProgress(player).level || 1;
      if (level < chapter.requiresLevel) {
        send(ws, {
          type: 'story_error',
          message: `🔒 "${chapter.title}" opens at Level ${chapter.requiresLevel} — you're Level ${level}. The Hollow tests the ready: side quests, night hunts, and harvests all pay XP.`
        });
        send(ws, storyStatePayload(player));
        return;
      }
      st.active = true;
      st.progress = 0;
      if (player.accountKey) saveProgress();
      // "Set foot in X" must count feet that are ALREADY in X — without
      // this, beginning a visit-chapter while standing in the target room
      // (e.g. the Wanderer finishing ch2 in the Wilds, then beginning
      // "Follow It Into the Trees" right there) waits for a room CHANGE
      // that never has a reason to happen. Classic invisible soft-lock.
      if (chapter.objective.type === 'visit_room' && player.room === chapter.objective.room) {
        send(ws, {
          type: 'story_chapter_started',
          chapterTitle: chapter.title,
          objectiveLabel: chapter.objective.label,
          where: objectiveWhere(chapter.objective),
          target: chapter.objective.target,
          message: `📖 Chapter ${st.chapter + 1}: "${chapter.title}" — you're already standing where the story points.`
        });
        storyEvent(player, 'visit_room', { room: player.room });
        send(ws, storyStatePayload(player));
        return;
      }
      send(ws, {
        type: 'story_chapter_started',
        chapterTitle: chapter.title,
        objectiveLabel: chapter.objective.label,
        where: objectiveWhere(chapter.objective),
        target: chapter.objective.target,
        message: `📖 Chapter ${st.chapter + 1}: "${chapter.title}" — ${chapter.objective.label} (${objectiveWhere(chapter.objective)})`
      });
      send(ws, storyStatePayload(player));
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
      // Each spell has its own independent cooldown (a map keyed by spellId)
      // rather than one shared timer across all 12 — casting Fireball no
      // longer blocks Toad's Tongue, etc.
      if (!player.spellCooldowns) player.spellCooldowns = {};
      const lastCastOfThis = player.spellCooldowns[spellId];
      // Quickened Casting (the 'haste' skill) shortens the per-spell cooldown.
      if (lastCastOfThis && now - lastCastOfThis < abilityCooldownFor(player, SPELL_COOLDOWN_MS)) {
        send(ws, { type: 'spell_error', message: 'Your magic needs to recharge a moment.' });
        return;
      }

      // Fireball and Leech Hex (the damage-dealing spells) can hit
      // animals/mobs too, same targets as the universal Strike — every
      // other targeted spell stays player-only, so this only resolves a
      // player here when the cast isn't a damage/leech spell aimed at a
      // non-player targetType; the damage branch below resolves mob targets
      // itself via applyDamage().
      const targetType = msg.targetType && msg.targetType !== 'player' ? String(msg.targetType) : 'player';
      const targetsMob = (spell.effect === 'damage' || spell.effect === 'leech') && targetType !== 'player';
      let target = null;
      if (spell.kind === 'targeted' && !targetsMob) {
        target = players.get(String(msg.targetId || ''));
        if (!target || target.id === player.id) {
          send(ws, { type: 'spell_error', message: 'Pick a target first.' });
          return;
        }
      }

      player.spellCooldowns[spellId] = now;

      // Every class ability cast advances a cast-your-craft story chapter.
      storyEvent(player, 'cast_ability', { abilityId: spellId });

      if (spell.effect === 'status') {
        const recipient = spell.kind === 'self' ? player : target;
        recipient.activeStatus = { type: spell.statusType, expiresAt: now + spell.durationMs };
        // The Withering Hex actually hurts (see tickPlayerStatusHealth) —
        // unlike the prank curses, its target deserves an explicit "you are
        // being attacked" notification, same as any combat hit.
        if (spell.statusType === 'wither' && recipient !== player) {
          send(recipient.ws, { type: 'attack_hit', casterName: player.name, attackName: spell.name, detail: 'Your life drains away — the hex must run its course.', effect: 'status' });
        }
        send(ws, {
          type: 'spell_result', spellId,
          message: `${spell.icon} ${spell.name} cast${spell.kind === 'targeted' ? ' on ' + target.name : ''}.`
        });
        return;
      }

      // Scrying Orb — the single-target intel spell. Room, wounds, level,
      // and any curse riding them: all of it is already in the public
      // player snapshot every client receives (see publicPlayer), so this
      // reveals nothing new — it just reads the crystal out loud.
      if (spell.effect === 'reveal') {
        const wounds = target.isDead ? '💀 a ghost' : `❤️${Math.round(target.health)}%`;
        const affliction = target.activeStatus && target.activeStatus.expiresAt > now
          ? `afflicted by ${target.activeStatus.type}` : 'unafflicted';
        send(ws, {
          type: 'spell_result', spellId,
          message: `${spell.icon} The orb clears: ${target.name} — ${describeRoom(target.room)} — ${wounds} — level ${target.level || 1} — ${affliction}.`,
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

      if (spell.effect === 'trap') {
        const bounds = roomBounds(player.room);
        const x = Number(msg.x), y = Number(msg.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          send(ws, { type: 'spell_error', message: 'Pick a spot on the ground first.' });
          return;
        }
        groundTraps.push({
          id: makeId(), spellId, casterId: player.id, room: player.room,
          x: Math.max(0, Math.min(bounds.width, x)), y: Math.max(0, Math.min(bounds.height, y)),
          radius: spell.trapRadius, statusType: spell.statusType, statusDurationMs: spell.durationMs,
          expiresAt: now + spell.trapLifetimeMs
        });
        send(ws, { type: 'spell_result', spellId, message: `${spell.icon} ${spell.name} sigil drawn on the ground.` });
        return;
      }

      if (spell.effect === 'damage' || spell.effect === 'leech') {
        const targetId = targetsMob ? String(msg.targetId || '') : target.id;
        const dmg = spell.dmgMin + Math.floor(Math.random() * (spell.dmgMax - spell.dmgMin + 1));
        const result = applyDamage(player, targetType, targetId, dmg, ABILITY_MAX_RANGE);
        if (!result.ok) {
          send(ws, { type: 'spell_error', message: result.evaded
            ? `💨 ${result.name} slips the spell — their echo still hangs in the air!`
            : 'Pick a target first.' });
          return;
        }
        // Broadcast first so the room sees the projectile actually travel
        // and land before the caster's toast / target's damage message
        // arrive. Leech Hex reuses the fireball flight fx with the direction
        // reversed on the client (life flowing back INTO the caster).
        broadcastRoom(player.room, { type: 'spell_fx', spellId, casterId: player.id, targetId, targetType });
        const label = result.name ? ` ${result.name}` : '';
        // Leech Hex is the combat-heal hybrid: whatever it drained from the
        // target closes the caster's own wounds.
        let healedHint = '';
        if (spell.effect === 'leech' && !player.isDead) {
          const before = player.health;
          player.health = Math.min(playerMaxHealth(player), player.health + result.dmg);
          const healed = Math.round(player.health - before);
          healedHint = healed > 0 ? `  🖤 ${healed} health drained back to you.` : '';
        }
        const verb = spell.effect === 'leech' ? (result.dead ? 'drains the last life from' : 'drains') : (result.dead ? 'incinerates' : 'hits');
        if (result.dead) {
          const xpHint = result.xp ? ` (+${result.xp} XP)` : '';
          const defeatedHint = targetType === 'player' ? ' You defeated them!' : '';
          send(ws, { type: 'spell_result', spellId, message: `${spell.icon} ${spell.name} ${verb}${label} for ${result.dmg}!${xpHint}${defeatedHint}${result.lootHint || ''}${healedHint}` });
        } else {
          send(ws, { type: 'spell_result', spellId, message: `${spell.icon} ${spell.name} ${verb}${label} for ${result.dmg}!${healedHint}` });
        }
        return;
      }

      // Nightwing Augury — the intel sweep. The bats report every other
      // player in the whole realm: name, where they are, and how wounded.
      // Positions/health are already broadcast to every client continuously
      // (see the periodic 'state' snapshot), so like Glimpse the Future
      // before it this reveals nothing that wasn't already shared — it just
      // gathers it into one legible witchy report. The caster also wears
      // the bat swarm for a while, so the room can SEE the augury happen.
      if (spell.effect === 'intel_sweep') {
        player.activeStatus = { type: 'bats', expiresAt: now + spell.durationMs };
        const others = Array.from(players.values()).filter(p => p.id !== player.id);
        const report = others.length
          ? others.map(p => `${p.name} — ${describeRoom(p.room)} — ${p.isDead ? '💀 a ghost' : '❤️' + Math.round(p.health) + '%'}`).join('  ·  ')
          : 'an empty night — no other souls abroad';
        send(ws, { type: 'spell_result', spellId, message: `${spell.icon} The swarm returns whispering: ${report}` });
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
      if (caster.accountKey) saveInboxes();
      send(caster.ws, { type: 'note_received', note: visionNote });
      return;
    }

    // A universal basic melee attack, available to every character
    // regardless of class — separate from the Werewolf/Wanderer's named
    // curse-attacks (cast_attack below) or the Witch's spells, both of
    // ── Checkout departure/return (see resumeStashes up by /api/checkout) ──
    if (msg.type === 'checkout_departure') {
      if (!player) return;
      const token = crypto.randomBytes(24).toString('hex');
      resumeStashes.set(token, {
        expiresAt: Date.now() + RESUME_TTL_MS,
        stash: buildResumeStash(player)
      });
      send(ws, { type: 'resume_token', token });
      return;
    }

    // The live-connection half of pass verification: the browser's
    // /api/verify-session fetch can resolve AFTER the auto-resumed join
    // already presented (or missed) the receipt — this closes that race by
    // letting the client stamp its CURRENT connection once verification
    // lands. Same Stripe-backed checks as everywhere else; replay-proof
    // because grantForSession computes one fixed window per session id.
    if (msg.type === 'claim_pass') {
      if (!player || typeof msg.sessionId !== 'string' || !msg.sessionId) return;
      const claimedId = msg.sessionId;
      const cached = passSessions.get(claimedId);
      if (cached && cached > Date.now()) {
        if (cached > (player.passUntil || 0)) {
          player.passUntil = cached;
          send(ws, { type: 'pass_state', passUntil: player.passUntil });
        }
        return;
      }
      if (!stripeClient || cached) return; // expired-known id stays expired
      const claimer = player;
      stripeClient.checkout.sessions.retrieve(claimedId).then(session => {
        if (session.payment_status !== 'paid') return;
        const expiresAt = grantForSession(claimedId, (session.created || Math.floor(Date.now() / 1000)) * 1000, passHoursForStripeSession(session));
        if (expiresAt > Date.now() && players.get(claimer.id) === claimer && expiresAt > (claimer.passUntil || 0)) {
          claimer.passUntil = expiresAt;
          send(claimer.ws, { type: 'pass_state', passUntil: expiresAt });
        }
      }).catch(() => {});
      return;
    }

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

      const result = applyDamage(player, targetType, targetId, dmg, STRIKE_RANGE);
      if (!result.ok) {
        if (result.evaded) send(ws, { type: 'attack_result', message: `💨 ${result.name} slips your strike — their echo still hangs in the air!` });
        return;
      }
      player.lastStrikeAt = now;

      if (targetType === 'player') {
        // Non-lethal PvP hits are silent on the striker's end (the target
        // gets the 'struck' message above) — only a kill gets a toast here.
        if (result.dead) send(ws, { type: 'attack_result', message: `⚔️ You defeated ${result.name}!${result.lootHint || ''}` });
        return;
      }
      const label = result.name ? ` ${result.name}` : '';
      const xpHint = result.xp ? ` (+${result.xp} XP)` : '';
      const verb = result.dead ? 'Killed' : 'Hit';
      send(ws, { type: 'attack_result', message: `⚔️ ${verb}${label} for ${result.dmg}!${xpHint}${result.lootHint || ''}` });
      return;
    }

    // Clicking the loot icon on a defeated mob/animal/player's body — only
    // the player who landed the killing blow can claim it (lootKillerId),
    // same fairness rule as any other kill reward; everyone else just sees
    // the icon exists. Loot itself was already rolled at the moment of
    // death (see the 'strike' handler above) — this just hands it over.
    if (msg.type === 'loot_corpse') {
      const LOOT_RANGE = 90;
      const targetType = String(msg.targetType || '');
      const targetId = String(msg.targetId || '');
      // Same room-gating each targetType already uses in the 'strike'
      // handler above — distance alone isn't enough, since e.g. dungeon
      // tiers and building interiors can share overlapping coordinate
      // ranges despite being different rooms entirely.
      const LOOT_ROOMS = { mob: 'outside', mob2: 'wilds', mob3: 'wilds', ember_mob: 'ember_wastes' };
      let t = null;
      if (targetType === 'player') {
        t = players.get(targetId) || null;
        // deathRoom, not the victim's current room — their ghost may have
        // wandered off elsewhere since dying, but the body/loot stays put.
        if (t && t.deathRoom !== player.room) t = null;
      } else if (targetType === 'dungeon') {
        t = findDungeonTarget(targetId, player.room);
        if (t && t.room !== player.room) t = null;
      } else if (LOOT_ROOMS[targetType]) {
        if (player.room === LOOT_ROOMS[targetType]) {
          const pool = { mob: mobs, mob2: mobs2, mob3: mobs3, ember_mob: emberMobs }[targetType];
          t = pool.find(x => x.id === targetId) || null;
        }
      }
      if (!t) { send(ws, { type: 'loot_error', message: 'Nothing there to loot.' }); return; }
      // lootKillerId === null means nobody in particular earned this one
      // (e.g. a mob killed by another mob in a skirmish, not a player) —
      // finders keepers. If it's set, only that specific player can claim it.
      if (!t.pendingLoot || !t.pendingLoot.length || (t.lootKillerId !== null && t.lootKillerId !== player.id)) {
        send(ws, { type: 'loot_error', message: 'There’s nothing here for you to loot.' });
        return;
      }
      const tx = targetType === 'player' ? t.deathX : t.x;
      const ty = targetType === 'player' ? t.deathY : t.y;
      if (Math.hypot(tx - player.x, ty - player.y) > LOOT_RANGE) {
        send(ws, { type: 'loot_error', message: 'Get closer to loot that.' });
        return;
      }
      const earned = grantLoot(t.pendingLoot, player);
      t.pendingLoot = null;
      t.lootKillerId = null;
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      if (earned.length) send(ws, { type: 'loot_drop', items: earned });
      return;
    }

    // Pickpocketing a *live* Ember Wastes mob — press F while nearby, same
    // "carried items only" flavor as Sleight of Hand but a flat chance
    // available to every character, not gated behind the Wanderer's spell
    // or its skill level (this is a map mechanic, not a class ability).
    // Unlike a corpse, this can be attempted repeatedly (own cooldown) as
    // long as the mob is still alive — it doesn't kill or even interrupt it.
    const STEAL_RANGE = 90, STEAL_COOLDOWN_MS = 2500;
    if (msg.type === 'steal_from_mob') {
      if (player.room !== 'ember_wastes' || player.isDead) return;
      const targetId = String(msg.targetId || '');
      const t = emberMobs.find(m => m.id === targetId);
      if (!t || t.dead) { send(ws, { type: 'attack_error', message: 'Nothing there to steal from.' }); return; }
      if (Math.hypot(t.x - player.x, t.y - player.y) > STEAL_RANGE) {
        send(ws, { type: 'attack_error', message: 'Get closer to try that.' });
        return;
      }
      const nowSteal = Date.now();
      if (t.lastStolenAt && nowSteal - t.lastStolenAt < STEAL_COOLDOWN_MS) return;
      t.lastStolenAt = nowSteal;
      const preset = EMBER_MOB_TYPES[t.mobType];
      if (Math.random() < preset.stealChance) {
        const itemId = preset.stealTable[Math.floor(Math.random() * preset.stealTable.length)];
        const inv = getInventory(player);
        if (addItemToAccount(inv, itemId, 1)) {
          if (player.accountKey) saveInventories();
          const meta = ITEM_CATALOG[itemId];
          send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
          send(ws, { type: 'attack_result', message: `🤏 Lifted ${meta.icon} ${meta.name} off ${preset.name} without it noticing.` });
        } else {
          send(ws, { type: 'attack_result', message: `🤏 You could've had something off ${preset.name}, but your pack is full.` });
        }
      } else {
        send(ws, { type: 'attack_result', message: `🤏 ${preset.name} shrugged you off — no luck this time.` });
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
      const myHarvests = playerHarvests(player);
      const lastAt = myHarvests[decorId];
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
      // Hedgecraft / Forager's Lore (the 'forage' skill) — a chance the patch
      // gives up a second one. Rolled once; the bonus is best-effort (skipped
      // silently if the pack is now full).
      let bonusYield = 0;
      if (Math.random() < skillHarvestExtraChance(player)) {
        if (addItemToAccount(inv, itemId, 1)) bonusYield = 1;
      }
      if (player.accountKey) saveInventories();
      myHarvests[decorId] = Date.now();
      saveHarvests(harvestKeyFor(player));
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      // Holly Wood (tree harvests) tracks progress toward the Holly Wand —
      // 5 build one at the craft_wand handler below.
      let message = `Harvested ${ITEM_CATALOG[itemId].icon} ${ITEM_CATALOG[itemId].name}${bonusYield ? ` ×${1 + bonusYield} — a fine haul!` : '.'}`;
      if (itemId === 'wood') {
        const total = countItemQty(inv, 'wood');
        message = total >= WAND_WOOD_COST
          ? `Harvested 🪵 Holly Wood${bonusYield ? ' ×2' : ''} (${total}) — enough to build a 🎇 Holly Wand! Open your pack.`
          : `Harvested 🪵 Holly Wood${bonusYield ? ' ×2' : ''} (${total}/${WAND_WOOD_COST}) — collect ${WAND_WOOD_COST - total} more and you can build a wand.`;
      }
      send(ws, { type: 'harvest_result', message });
      // Regrowth is per player, so only THIS client's plants change looks.
      send(ws, { type: 'decor_state', decor: decorPublicState(player) });
      // XP for Wilds plants only (not town trees/shrubs/flowers)
      if (found.room === 'wilds') {
        grantXP(player, 5);
        advanceQuestProgress(player, 'harvest_plant', itemId);
        storyEvent(player, 'harvest_plant', { itemId });
      }
      return;
    }

    if (msg.type === 'craft_wand') {
      // 5 Holly Wood → 1 Holly Wand. Validated here regardless of what the
      // client shows; the wood is only consumed if the wand actually fits.
      const inv = getInventory(player);
      const total = countItemQty(inv, 'wood');
      if (total < WAND_WOOD_COST) {
        send(ws, { type: 'craft_error', message: `You need ${WAND_WOOD_COST} 🪵 Holly Wood to bind a wand — you have ${total}.` });
        return;
      }
      removeItemFromAccount(inv, 'wood', WAND_WOOD_COST);
      if (!addItemToAccount(inv, 'holly_wand', 1)) {
        addItemToAccount(inv, 'wood', WAND_WOOD_COST); // full pack — put the wood back
        send(ws, { type: 'craft_error', message: 'Your pack is full — make room for the wand first.' });
        return;
      }
      if (player.accountKey) saveInventories();
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'craft_result', message: '🎇 You bind five holly hearts into a wand. Equip it — it glows, and it will light your way at night.' });
      return;
    }

    if (msg.type === 'craft_circlet') {
      // 5 Bloodmoon Shards → the Bloodmoon Circlet: the wearable trophy of
      // the Blood Moon nights (Session L). Same shape as craft_wand.
      const inv = getInventory(player);
      const total = countItemQty(inv, 'bloodmoon_shard');
      if (total < BLOODMOON_CIRCLET_COST) {
        send(ws, { type: 'craft_error', message: `You need ${BLOODMOON_CIRCLET_COST} 🩸 Bloodmoon Shards to bind a circlet — you have ${total}. They fall on Blood Moon nights.` });
        return;
      }
      removeItemFromAccount(inv, 'bloodmoon_shard', BLOODMOON_CIRCLET_COST);
      if (!addItemToAccount(inv, 'bloodmoon_circlet', 1)) {
        addItemToAccount(inv, 'bloodmoon_shard', BLOODMOON_CIRCLET_COST);
        send(ws, { type: 'craft_error', message: 'Your pack is full — make room for the circlet first.' });
        return;
      }
      if (player.accountKey) saveInventories();
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'craft_result', message: '🔻 Five shards fuse into a circlet, still warm as a heartbeat. Wear the red night proudly.' });
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
        player.health = Math.min(playerMaxHealth(player), player.health + plant.amount);
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
      // Independent per-attack cooldown, same reasoning as spellCooldowns above.
      if (!player.attackCooldowns) player.attackCooldowns = {};
      const lastCastOfThis = player.attackCooldowns[attackId];
      // Battle Tempo / Attuned Channeling / Efficient Rest (the 'haste' skill).
      if (lastCastOfThis && now - lastCastOfThis < abilityCooldownFor(player, ATTACK_COOLDOWN_MS)) {
        send(ws, { type: 'attack_error', message: 'Still recovering — wait a moment.' });
        return;
      }
      player.attackCooldowns[attackId] = now;

      // Damage/leech attacks can hit animals/mobs too, exactly like the
      // Witch's Fireball/Leech Hex (see cast_spell's targetsMob above) —
      // the damage branch below resolves mob targets itself through
      // applyDamage(), so only player targets are gathered here.
      const atkTargetType = msg.targetType && msg.targetType !== 'player' ? String(msg.targetType) : 'player';
      const atkTargetsMob = (attack.effect === 'damage' || attack.effect === 'leech') && atkTargetType !== 'player';

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
      } else if (!atkTargetsMob) {
        const t = players.get(String(msg.targetId || ''));
        if (!t || t.id === player.id) {
          send(ws, { type: 'attack_error', message: 'Pick a target first.' });
          return;
        }
        targets = [t];
      }

      // Every class ability cast (spell or attack) advances a
      // cast-your-craft story chapter — see storyEvent/cast_spell.
      storyEvent(player, 'cast_ability', { abilityId: attackId });

      // Damage / leech — the non-Witch classes' real attacks (Savage Bite,
      // Knife Throw, Spirit Lash, Soul Siphon, Smite). Same applyDamage
      // funnel, death/loot/XP flow, and room-wide projectile broadcast as
      // Fireball; leech heals the caster for what it drained, like Leech Hex.
      if (attack.effect === 'damage' || attack.effect === 'leech') {
        const targetId = atkTargetsMob ? String(msg.targetId || '') : targets[0].id;
        const dmg = attack.dmgMin + Math.floor(Math.random() * (attack.dmgMax - attack.dmgMin + 1));
        const result = applyDamage(player, atkTargetType, targetId, dmg, ABILITY_MAX_RANGE);
        if (!result.ok) {
          send(ws, { type: 'attack_error', message: result.evaded
            ? `💨 ${result.name} slips the blow — their echo still hangs in the air!`
            : 'Pick a target first.' });
          return;
        }
        broadcastRoom(player.room, { type: 'attack_fx', attackId, casterId: player.id, targetId, targetType: atkTargetType });
        let healedHint = '';
        if (attack.effect === 'leech' && !player.isDead) {
          const before = player.health;
          player.health = Math.min(playerMaxHealth(player), player.health + result.dmg);
          const healed = Math.round(player.health - before);
          healedHint = healed > 0 ? `  💜 ${healed} health drawn back to you.` : '';
        }
        const label = result.name ? ` ${result.name}` : '';
        const verb = attack.effect === 'leech' ? (result.dead ? 'drains the last life from' : 'drains') : (result.dead ? 'fells' : 'hits');
        if (result.dead) {
          const xpHint = result.xp ? ` (+${result.xp} XP)` : '';
          const defeatedHint = atkTargetType === 'player' ? ' You defeated them!' : '';
          send(ws, { type: 'attack_result', message: `⚔️ ${attack.name} ${verb}${label} for ${result.dmg}!${xpHint}${defeatedHint}${result.lootHint || ''}${healedHint}` });
        } else {
          send(ws, { type: 'attack_result', message: `⚔️ ${attack.name} ${verb}${label} for ${result.dmg}!${healedHint}` });
        }
        return;
      }

      // Heal — Lay on Hands / Mending Spirits: the game's two targeted
      // instant heals. Works on yourself via the Attacks panel too if the
      // client ever sends kind 'self' with this effect.
      if (attack.effect === 'heal') {
        const t = attack.kind === 'self' ? player : targets[0];
        if (t.isDead) {
          send(ws, { type: 'attack_error', message: 'Too late for healing — they need to respawn.' });
          return;
        }
        const amt = attack.healMin + Math.floor(Math.random() * (attack.healMax - attack.healMin + 1));
        const before = t.health;
        t.health = Math.min(playerMaxHealth(t), t.health + amt);
        const healed = Math.round(t.health - before);
        if (t.id !== player.id) {
          send(t.ws, { type: 'attack_result', message: `💚 ${player.name}'s ${attack.name} restores ${healed} health to you.` });
          send(ws, { type: 'attack_result', message: `💚 ${attack.name} — restored ${healed} health to ${t.name}.` });
        } else {
          send(ws, { type: 'attack_result', message: `💚 ${attack.name} — restored ${healed} health.` });
        }
        return;
      }

      // Intel sweep — Spirit Walk / Herald's Muster: the class twin of the
      // Witch's Nightwing Augury. Reports every player's whereabouts and
      // wounds — all data already in the continuous public snapshot — and
      // marks the caster with a visible status so the room sees it happen.
      if (attack.effect === 'intel_sweep') {
        if (attack.statusType) player.activeStatus = { type: attack.statusType, expiresAt: now + (attack.durationMs || 10000) };
        const others = Array.from(players.values()).filter(p => p.id !== player.id);
        const report = others.length
          ? others.map(p => `${p.name} — ${describeRoom(p.room)} — ${p.isDead ? '💀 a ghost' : '❤️' + Math.round(p.health) + '%'}`).join('  ·  ')
          : 'an empty realm — no other souls abroad';
        send(ws, { type: 'attack_result', message: `📜 ${attack.name}: ${report}` });
        return;
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

        const prog = getProgress(player);
        const skillLevel = pickpocketLevelForSuccesses(prog.pickpocketSuccesses);
        const chance = pickpocketChanceForLevel(skillLevel, attack.stealChance);

        let stolen = null;
        if (peekedSlots.length > 0 && Math.random() < chance) {
          const pick = peekedSlots[Math.floor(Math.random() * peekedSlots.length)];
          const callerInv = getInventory(player);
          if (addItemToAccount(callerInv, pick.itemId, 1)) {
            removeItemFromAccount(targetInv, pick.itemId, 1);
            stolen = { itemId: pick.itemId, name: ITEM_CATALOG[pick.itemId].name, icon: ITEM_CATALOG[pick.itemId].icon };
            if (player.accountKey) saveInventories();
            if (t.accountKey) saveInventories();
            send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });

            // Skill progress — only a completed steal counts, not just a
            // winning roll (e.g. a full inventory still blocks addItemToAccount
            // above, and that shouldn't reward practice you didn't actually get).
            prog.pickpocketSuccesses++;
            const newLevel = pickpocketLevelForSuccesses(prog.pickpocketSuccesses);
            if (newLevel > skillLevel) {
              const newChance = Math.round(pickpocketChanceForLevel(newLevel, attack.stealChance) * 100);
              send(ws, {
                type: 'pickpocket_level_up', level: newLevel, chance: newChance,
                message: `🤏 Sleight of Hand improved to level ${newLevel}! Success chance is now ${newChance}%.`
              });
            }
            if (player.accountKey) saveProgress();
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
        if (t.accountKey) saveInboxes();
        send(t.ws, { type: 'note_stolen', id: stolen.id });
        send(t.ws, {
          type: 'attack_hit', attackName: attack.name, casterName: player.name,
          detail: `${player.name} swiped a note out of your inbox before you could destroy it.`
        });
        const deliveredNote = { id: makeId(), fromId: stolen.fromId, fromName: stolen.fromName, text: stolen.text, image: stolen.image };
        player.inbox.push(deliveredNote);
        if (player.accountKey) saveInboxes();
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
      // Fresh solo/party run: if this tier's shared room is currently empty,
      // repopulate it so re-entering a dungeon you just cleared starts a real
      // fight instead of a graveyard on respawn timers (see resetDungeonRoom).
      // The entering player is still in their OLD room at this point, so
      // playersInRoom() counts only OTHERS already inside — this fires only
      // when nobody else is there, never yanking mobs back mid-fight.
      if (playersInRoom(room) === 0) resetDungeonRoom(room);
      const _tierEntry = DUNGEON_ENTRY_BY_TIER[tier] || DUNGEON_SPAWN;
      const spawnWithJitter = () => ({
        x: _tierEntry.x + (Math.random() - 0.5) * 60,
        y: _tierEntry.y + (Math.random() - 0.5) * 60
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
      player.roomLockUntil = Date.now() + 1500;
      send(ws, { type: 'dungeon_entered', tier, room, spawn: { x: sp.x, y: sp.y }, level: prog.level });
      for (const member of partyMembers) {
        member.dungeonReturnRoom = member.room || 'outside';
        const msp = spawnWithJitter();
        member.x = msp.x; member.y = msp.y; member.room = room;
        member.roomLockUntil = Date.now() + 1500;
        send(member.ws, { type: 'dungeon_entered', tier, room, spawn: { x: msp.x, y: msp.y }, level: prog.level });
      }
      return;
    }

    if (msg.type === 'dungeon_exit') {
      if (!player.room || !player.room.startsWith('dungeon_')) return;
      // Inside a delve run the exit portal ends the run properly instead
      // (depth recorded, gold kept, room torn down when the last one leaves).
      if (delveRunOf(player)) { delveLeave(player, 'exit'); return; }
      const returnRoom = player.dungeonReturnRoom || 'outside';
      const returnPos = returnRoom === 'wilds' ? WORLD2.spawn : WORLD.spawn;
      player.x = returnPos.x;
      player.y = returnPos.y;
      player.room = returnRoom;
      player.roomLockUntil = Date.now() + 1500;
      player.dungeonReturnRoom = null;
      send(ws, { type: 'dungeon_exited', room: returnRoom, x: returnPos.x, y: returnPos.y });
      return;
    }

    // ── Session L: the Weekly Delve ─────────────────────────────────────────
    if (msg.type === 'delve_state') {
      const run = delveRunOf(player);
      send(ws, run ? delveStatePayloadFor(run, player) : delveMenuPayload(player));
      return;
    }

    if (msg.type === 'delve_start') {
      delveStart(player);
      return;
    }

    if (msg.type === 'delve_pick_boon') {
      const run = delveRunOf(player);
      if (!run || run.state !== 'draft') return;
      const member = run.members.get(player.id);
      if (!member || member.picked || !member.offer) return;
      const boonId = String(msg.boonId || '');
      if (!member.offer.includes(boonId)) return;
      member.boons[boonId] = (member.boons[boonId] || 0) + 1;
      member.picked = true;
      member.offer = null;
      const boon = DELVE_BOONS[boonId];
      if (boon.healNow) player.health = Math.min(playerMaxHealth(player), player.health + boon.healNow);
      send(ws, { type: 'announce_soft', message: `${boon.icon} ${boon.name} — ${boon.desc}` });
      delveBroadcast(run);
      return;
    }

    if (msg.type === 'delve_exit') {
      if (delveRunOf(player)) delveLeave(player, 'exit');
      return;
    }

    // ── Session L: the town board ───────────────────────────────────────────
    if (msg.type === 'board_state') {
      send(ws, boardStatePayload(player));
      return;
    }

    if (msg.type === 'respawn') {
      if (!player.isDead) return;
      // Death in the Delve is the roguelike contract: respawning walks you
      // out of the run (depth recorded) before you get back up.
      if (delveRunOf(player)) delveLeave(player, 'death');
      player.isDead = false;
      player.health = playerMaxHealth(player);
      // The loot window on this corpse closes the moment the body gets back
      // up, whether or not the killer ever claimed it — matches how a
      // creature's corpse loot resets on respawn too.
      player.pendingLoot = null;
      player.lootKillerId = null;
      // Your mask slips when you get back up — a death always outs a
      // disguise (and quietly guarantees no one is stuck as someone else
      // after a rough night).
      if (player.disguise) {
        player.disguise = null;
        broadcastAll({ type: 'disguise_state', id: player.id, name: null, image: null });
      }
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

    // ── Class skill trees ──────────────────────────────────────────────────
    if (msg.type === 'skill_state') {
      send(ws, { type: 'skill_state', ...skillStatePayload(player) });
      return;
    }
    if (msg.type === 'skill_allocate') {
      const skillId = String(msg.skillId || '');
      const skill = skillTreeFor(player.charId).find(s => s.id === skillId);
      // charId-gated exactly like the ability catalogs: you can only ever
      // spend into YOUR class's tree, validated here, not in the client.
      if (!skill) { send(ws, { type: 'skill_error', message: 'That skill belongs to another class.' }); return; }
      const prog = getProgress(player);
      const alloc = getSkillAlloc(player);
      const cur = alloc[skillId] || 0;
      if (cur >= SKILL_MAX_RANK) { send(ws, { type: 'skill_error', message: `${skill.name} is already at maximum rank.` }); return; }
      if ((prog.skillPoints || 0) < 1) { send(ws, { type: 'skill_error', message: 'No skill points to spend — level up to earn more.' }); return; }
      prog.skillPoints -= 1;
      alloc[skillId] = cur + 1;
      syncProgressToPlayer(player); // refreshes player.maxHealth
      if (player.accountKey) saveProgress();
      send(ws, { type: 'skill_result', message: `${skill.icon} ${skill.name} is now rank ${alloc[skillId]}/${SKILL_MAX_RANK}.` });
      send(ws, { type: 'skill_state', ...skillStatePayload(player) });
      send(ws, { type: 'xp_gain', xp: prog.xp, level: prog.level, skillPoints: prog.skillPoints, gained: 0 });
      return;
    }
    if (msg.type === 'skill_respec') {
      const prog = getProgress(player);
      const alloc = getSkillAlloc(player);
      const refunded = Object.values(alloc).reduce((a, r) => a + (r || 0), 0);
      if (refunded === 0) { send(ws, { type: 'skill_error', message: 'You have not spent any points in this class yet.' }); return; }
      prog.skillPoints = (prog.skillPoints || 0) + refunded;
      prog.skills[String(player.charId)] = {};
      // Reunspent max-health could leave current health above the new (lower)
      // cap — clamp it so nobody keeps overhealed HP after refunding vitality.
      syncProgressToPlayer(player);
      if (player.health > player.maxHealth) player.health = player.maxHealth;
      if (player.accountKey) saveProgress();
      send(ws, { type: 'skill_result', message: `↩️ Refunded ${refunded} skill point${refunded === 1 ? '' : 's'} — respend them however you like.` });
      send(ws, { type: 'skill_state', ...skillStatePayload(player) });
      send(ws, { type: 'xp_gain', xp: prog.xp, level: prog.level, skillPoints: prog.skillPoints, gained: 0 });
      return;
    }

    if (msg.type === 'ms_balance') {
      send(ws, { type: 'ms_state', balance: player.accountKey ? msBalance(player.accountKey) : 0 });
      return;
    }

    if (msg.type === 'legend_shop_open') {
      // Browsing costs nothing and works for guests — buying doesn't.
      send(ws, {
        type: 'legend_shop_state',
        greeting: player.accountKey
          ? `Ah… ${player.disguise ? player.disguise.name : player.name}. The stars said you'd come. Five wonders this week — no gold, only Moonstones.`
          : 'Browse, wanderer. But the wonders bind themselves to NAMES — log into an account before you reach for your purse.',
        ...legendaryShopPayload(player)
      });
      return;
    }

    if (msg.type === 'legend_shop_buy') {
      if (!player.accountKey) {
        send(ws, { type: 'ms_error', message: 'Log into an account first — legendaries bind to your name.' });
        return;
      }
      const itemId = String(msg.itemId || '');
      const lg = LEGENDARY_CATALOG[itemId];
      if (!lg || !legendaryWeeklySet().includes(itemId)) {
        send(ws, { type: 'ms_error', message: 'The Peddler isn’t offering that this week.' });
        return;
      }
      if (msBalance(player.accountKey) < lg.ms) {
        send(ws, { type: 'ms_error', message: `That's ${lg.ms} 💎 — you carry ${msBalance(player.accountKey)}.` });
        return;
      }
      const inv = getInventory(player);
      if (!addItemToAccount(inv, itemId, 1)) {
        send(ws, { type: 'ms_error', message: 'No room in your pack — make space first.' });
        return;
      }
      msAdjust(player.accountKey, -lg.ms);
      saveInventories();
      send(ws, { type: 'ms_state', balance: msBalance(player.accountKey) });
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'legend_bought', itemId, name: lg.name, icon: lg.icon, ms: lg.ms });
      return;
    }

    if (msg.type === 'npc_shop_open') {
      const npcId = String(msg.npcId || '');
      const shop = NPC_SHOPS[npcId];
      if (!shop) return;
      // Browsing a shopkeeper is talking to them, as far as the story cares
      // — Scholar Elior (the Mystic's chapter-1 contact) is a shop NPC.
      storyEvent(player, 'talk_npc', { npcId });
      // Shopkeepers greet whoever they SEE. A mask (cm_disguise) means
      // they see the person on the picture — including that person's
      // regulars discount, if they've earned one by finishing this
      // shopkeeper's quest. Faces are how the town knows people.
      const seenAs = player.disguise ? player.disguise.name : player.name;
      const discount = shopDiscountFor(player, npcId);
      const priced = shop.items.map(s => ({
        id: s.id,
        price: discountedPrice(s.price, discount),
        basePrice: s.price,
        name: ITEM_CATALOG[s.id]?.name || s.id,
        icon: ITEM_CATALOG[s.id]?.icon || '?'
      }));
      send(ws, {
        type: 'npc_shop_state', npcId, npcName: shop.name, items: priced,
        sellValues: SELL_VALUE_MAP,
        greeting: discount
          ? `Ah, ${seenAs}! Always a pleasure — your usual rate, of course. (−${Math.round(discount * 100)}% for regulars)`
          : `Welcome, ${seenAs}. Have a look around.`,
        discountPct: discount ? Math.round(discount * 100) : 0
      });
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
      // Same discount logic the shop window showed — the till agrees with
      // the shelf tag, disguised or not.
      const price = discountedPrice(shopItem.price, shopDiscountFor(player, npcId));
      const account = ensureBankAccount(player.accountKey);
      if (account.balance < price) {
        send(ws, { type: 'shop_error', message: `Need ${price} gold, you have ${account.balance}.` });
        return;
      }
      const inv = getInventory(player);
      if (!addItemToAccount(inv, itemId, 1)) { send(ws, { type: 'shop_error', message: 'Inventory full.' }); return; }
      account.balance -= price;
      saveBankAccounts();
      if (player.accountKey) saveInventories();
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'shop_bought', itemId, itemName: ITEM_CATALOG[itemId]?.name, price });
      return;
    }

    if (msg.type === 'npc_sell_item') {
      if (!player.accountKey) { send(ws, { type: 'shop_error', message: 'Log in to sell items.' }); return; }
      const npcId = String(msg.npcId || '');
      if (!NPC_SHOPS[npcId]) return; // must actually be at a shopkeeper
      const itemId = String(msg.itemId || '');
      const meta = ITEM_CATALOG[itemId];
      const unit = sellValueFor(itemId);
      if (!meta || unit <= 0) { send(ws, { type: 'shop_error', message: "The shopkeeper won't buy that." }); return; }
      const inv = getInventory(player);
      const have = countItemQty(inv, itemId);
      if (have <= 0) { send(ws, { type: 'shop_error', message: "You don't have that." }); return; }
      // Clamp to what they actually hold — so a "sell all" (qty = stack size) is
      // safe and there's no way to over-sell into negative gold/inventory.
      const qty = Math.max(1, Math.min(have, Math.floor(Number(msg.qty) || 1)));
      if (!removeItemFromAccount(inv, itemId, qty)) { send(ws, { type: 'shop_error', message: "You don't have that many." }); return; }
      const gold = unit * qty;
      const account = ensureBankAccount(player.accountKey);
      account.balance += gold;
      saveBankAccounts();
      saveInventories();
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      send(ws, { type: 'shop_sold', itemId, itemName: meta.name, qty, gold, balance: account.balance });
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
      // sanitizeText strips < > (same as room chat) — the client renders party
      // messages, so an unsanitized payload here is a stored-XSS vector.
      const text = sanitizeText(msg.text).slice(0, 200);
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

    // ── Session L: covens ───────────────────────────────────────────────────
    if (msg.type === 'coven_state') {
      if (!player.accountKey) { send(ws, { type: 'coven_error', message: 'Covens are for townsfolk with an account — log in first.' }); return; }
      const cv = covenOf(player.accountKey);
      if (cv) send(ws, { type: 'coven_state', ...covenStatePayload(cv, player.accountKey) });
      else send(ws, { type: 'coven_state', coven: null });
      return;
    }

    if (msg.type === 'coven_create') {
      if (!player.accountKey) { send(ws, { type: 'coven_error', message: 'Covens are for townsfolk with an account — log in first.' }); return; }
      if (covenOf(player.accountKey)) { send(ws, { type: 'coven_error', message: 'You already belong to a coven.' }); return; }
      const name = sanitizeText(String(msg.name || '')).trim().slice(0, 24);
      if (name.length < 3) { send(ws, { type: 'coven_error', message: 'A coven needs a name of at least 3 characters.' }); return; }
      const nameLower = name.toLowerCase();
      if (Object.values(covens).some(c => c.nameLower === nameLower)) {
        send(ws, { type: 'coven_error', message: 'A coven by that name already gathers — choose another.' });
        return;
      }
      const sigil = COVEN_SIGILS.includes(msg.sigil) ? msg.sigil : COVEN_SIGILS[0];
      const acct = ensureBankAccount(player.accountKey);
      if (acct.balance < COVEN_CREATE_COST) {
        send(ws, { type: 'coven_error', message: `Founding a coven costs ${COVEN_CREATE_COST} gold (your bank holds ${acct.balance}).` });
        return;
      }
      acct.balance -= COVEN_CREATE_COST;
      saveBankAccounts();
      const id = makeId();
      covens[id] = {
        id, name, nameLower, sigil, createdAt: Date.now(),
        leaderKey: player.accountKey, members: [player.accountKey],
        motd: '', bank: { gold: 0, slots: new Array(COVEN_BANK_SLOTS).fill(null) },
        log: [], table: null
      };
      covenIndex.set(player.accountKey, id);
      covenLog(covens[id], player.name, 'founded the coven');
      saveCoven(id);
      send(ws, { type: 'coven_state', ...covenStatePayload(covens[id], player.accountKey) });
      broadcastAll({ type: 'announce', message: `${sigil} A new coven gathers: ${name}!` });
      return;
    }

    if (msg.type === 'coven_invite') {
      const cv = player.accountKey && covenOf(player.accountKey);
      if (!cv) { send(ws, { type: 'coven_error', message: 'You have no coven to invite them into.' }); return; }
      if (cv.members.length >= COVEN_MAX_MEMBERS) { send(ws, { type: 'coven_error', message: `A coven holds ${COVEN_MAX_MEMBERS} at most — yours is full.` }); return; }
      const target = players.get(String(msg.targetId || ''));
      if (!target || target.id === player.id) { send(ws, { type: 'coven_error', message: 'No such soul in town.' }); return; }
      if (!target.accountKey) { send(ws, { type: 'coven_error', message: `${target.name} wanders as a guest — they need an account to join a coven.` }); return; }
      if (covenOf(target.accountKey)) { send(ws, { type: 'coven_error', message: `${target.name} already belongs to a coven.` }); return; }
      const inviteId = makeId();
      covenInvites.set(inviteId, { covenId: cv.id, targetKey: target.accountKey, expiresAt: Date.now() + 60000 });
      send(target.ws, { type: 'coven_invited', inviteId, covenName: cv.name, sigil: cv.sigil, fromName: player.name, members: cv.members.length });
      send(ws, { type: 'coven_error', message: `Invitation carried to ${target.name}.` });
      return;
    }

    if (msg.type === 'coven_invite_accept') {
      const inv = covenInvites.get(String(msg.inviteId || ''));
      if (!inv || !player.accountKey || inv.targetKey !== player.accountKey) return;
      covenInvites.delete(String(msg.inviteId || ''));
      const cv = covens[inv.covenId];
      if (!cv) return;
      if (cv.members.length >= COVEN_MAX_MEMBERS) { send(ws, { type: 'coven_error', message: 'That coven filled its circle before you answered.' }); return; }
      if (covenOf(player.accountKey)) return;
      cv.members.push(player.accountKey);
      covenIndex.set(player.accountKey, cv.id);
      covenLog(cv, player.name, 'joined the circle');
      saveCoven(cv.id);
      covenBroadcast(cv);
      return;
    }

    if (msg.type === 'coven_invite_decline') {
      covenInvites.delete(String(msg.inviteId || ''));
      return;
    }

    if (msg.type === 'coven_leave') {
      const cv = player.accountKey && covenOf(player.accountKey);
      if (!cv) return;
      cv.members = cv.members.filter(k => k !== player.accountKey);
      covenIndex.delete(player.accountKey);
      covenLog(cv, player.name, 'left the circle');
      if (cv.members.length === 0) {
        // Last one out inherits the tab — gold to their bank, items squeezed
        // into their bank slots (anything that can't fit is lost with the
        // coven, and we say so).
        const acct = ensureBankAccount(player.accountKey);
        acct.balance += cv.bank.gold;
        let lost = 0;
        for (const s of cv.bank.slots) {
          if (s && !addItemToAccount(acct, s.itemId, s.qty)) lost++;
        }
        saveBankAccounts();
        delete covens[cv.id];
        persistSave('covens', COVENS_FILE, covens);
        send(ws, { type: 'coven_state', coven: null });
        send(ws, { type: 'announce_soft', message: `🥀 ${cv.name} disbands. Its ${cv.bank.gold} gold passes to you${lost ? ` (${lost} item stack${lost > 1 ? 's' : ''} had nowhere to go)` : ''}.` });
        return;
      }
      if (cv.leaderKey === player.accountKey) {
        cv.leaderKey = cv.members[0];
        covenLog(cv, covenDisplayName(cv.leaderKey), 'now leads the coven');
      }
      saveCoven(cv.id);
      send(ws, { type: 'coven_state', coven: null });
      covenBroadcast(cv);
      return;
    }

    if (msg.type === 'coven_kick') {
      const cv = player.accountKey && covenOf(player.accountKey);
      if (!cv || cv.leaderKey !== player.accountKey) return;
      const targetKey = String(msg.memberKey || '');
      if (targetKey === player.accountKey || !cv.members.includes(targetKey)) return;
      cv.members = cv.members.filter(k => k !== targetKey);
      covenIndex.delete(targetKey);
      covenLog(cv, player.name, `turned ${covenDisplayName(targetKey)} out of the circle`);
      saveCoven(cv.id);
      const kicked = findConnectionByAccountKey(targetKey);
      if (kicked) {
        send(kicked.ws, { type: 'coven_state', coven: null });
        send(kicked.ws, { type: 'announce_soft', message: `🥀 You have been turned out of ${cv.name}.` });
      }
      covenBroadcast(cv);
      return;
    }

    if (msg.type === 'coven_chat') {
      // Same sanitize-or-suffer rule as party_chat — coven text renders on
      // other clients, so it MUST pass through sanitizeText.
      const cv = player.accountKey && covenOf(player.accountKey);
      if (!cv) return;
      const text = sanitizeText(msg.text).slice(0, 200);
      if (!text) return;
      for (const key of cv.members) {
        const m = findConnectionByAccountKey(key);
        if (m) send(m.ws, { type: 'coven_msg', fromName: player.name, fromId: player.id, sigil: cv.sigil, text });
      }
      return;
    }

    if (msg.type === 'coven_motd') {
      const cv = player.accountKey && covenOf(player.accountKey);
      if (!cv || cv.leaderKey !== player.accountKey) return;
      cv.motd = sanitizeText(String(msg.text || '')).slice(0, 120);
      covenLog(cv, player.name, 'changed the words over the door');
      saveCoven(cv.id);
      covenBroadcast(cv);
      return;
    }

    // The shared tab is a BANK fixture — the same walk-to-the-vault ritual as
    // your own account (bank_open's rule), which also keeps every mutation in
    // one guarded room.
    if (msg.type === 'coven_deposit_gold' || msg.type === 'coven_withdraw_gold') {
      const cv = player.accountKey && covenOf(player.accountKey);
      if (!cv) return;
      if (player.room !== 'bank') { send(ws, { type: 'coven_error', message: 'The coven tab lives at the Gilded Vault — speak to the teller there.' }); return; }
      const amount = Math.floor(Number(msg.amount));
      if (!(amount > 0)) return;
      const acct = ensureBankAccount(player.accountKey);
      if (msg.type === 'coven_deposit_gold') {
        if (acct.balance < amount) { send(ws, { type: 'coven_error', message: 'Your bank holds less than that.' }); return; }
        acct.balance -= amount;
        cv.bank.gold += amount;
        covenLog(cv, player.name, `laid in ${amount} gold`);
      } else {
        if (cv.bank.gold < amount) { send(ws, { type: 'coven_error', message: 'The coven tab holds less than that.' }); return; }
        cv.bank.gold -= amount;
        acct.balance += amount;
        covenLog(cv, player.name, `drew out ${amount} gold`);
      }
      saveBankAccounts();
      saveCoven(cv.id);
      send(ws, { type: 'bank_state', balance: acct.balance, slots: acct.slots });
      covenBroadcast(cv);
      return;
    }

    if (msg.type === 'coven_deposit_item') {
      const cv = player.accountKey && covenOf(player.accountKey);
      if (!cv) return;
      if (player.room !== 'bank') { send(ws, { type: 'coven_error', message: 'The coven tab lives at the Gilded Vault — speak to the teller there.' }); return; }
      const inv = getInventory(player);
      const slotIdx = Math.floor(Number(msg.slotIdx));
      const stack = inv.slots[slotIdx];
      if (!stack) return;
      const empty = cv.bank.slots.findIndex(s => !s);
      const existing = cv.bank.slots.find(s => s && s.itemId === stack.itemId);
      if (existing) existing.qty += stack.qty;
      else if (empty !== -1) cv.bank.slots[empty] = { itemId: stack.itemId, qty: stack.qty };
      else { send(ws, { type: 'coven_error', message: 'The coven tab is full.' }); return; }
      const meta = ITEM_CATALOG[stack.itemId];
      covenLog(cv, player.name, `laid in ${meta ? meta.icon + ' ' + meta.name : stack.itemId} ×${stack.qty}`);
      inv.slots[slotIdx] = null;
      if (player.accountKey) saveInventories();
      saveCoven(cv.id);
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      covenBroadcast(cv);
      return;
    }

    if (msg.type === 'coven_withdraw_item') {
      const cv = player.accountKey && covenOf(player.accountKey);
      if (!cv) return;
      if (player.room !== 'bank') { send(ws, { type: 'coven_error', message: 'The coven tab lives at the Gilded Vault — speak to the teller there.' }); return; }
      const slotIdx = Math.floor(Number(msg.covenSlot));
      const stack = cv.bank.slots[slotIdx];
      if (!stack) return;
      const inv = getInventory(player);
      if (!addItemToAccount(inv, stack.itemId, stack.qty)) {
        send(ws, { type: 'coven_error', message: 'Your pack has no room for that.' });
        return;
      }
      const meta = ITEM_CATALOG[stack.itemId];
      covenLog(cv, player.name, `drew out ${meta ? meta.icon + ' ' + meta.name : stack.itemId} ×${stack.qty}`);
      cv.bank.slots[slotIdx] = null;
      if (player.accountKey) saveInventories();
      saveCoven(cv.id);
      send(ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      covenBroadcast(cv);
      return;
    }

    if (msg.type === 'coven_claim_table') {
      const cv = player.accountKey && covenOf(player.accountKey);
      if (!cv) return;
      if (player.room !== 'cafe') { send(ws, { type: 'coven_error', message: 'The claimable table is in the Cauldron Café.' }); return; }
      const now = Date.now();
      const holder = covenTableFor('cafe');
      if (holder && holder.name !== cv.name) {
        send(ws, { type: 'coven_error', message: `${holder.sigil} ${holder.name} holds the table until the candles burn down. Try again later.` });
        return;
      }
      cv.table = { room: 'cafe', claimedAt: now, until: now + COVEN_TABLE_HOLD_MS };
      covenLog(cv, player.name, 'claimed the café table');
      saveCoven(cv.id);
      broadcastRoom('cafe', { type: 'coven_table_state', table: covenTableFor('cafe') });
      covenBroadcast(cv);
      return;
    }

    if (msg.type === 'enter_witch_cave') {
      if (player.room !== 'wilds' || player.isDead) return;
      const dist = Math.hypot(player.x - WITCH_CAVE_ENTRANCE.x, player.y - WITCH_CAVE_ENTRANCE.y);
      if (dist > 140) return;
      player.witchCaveReturnX = player.x;
      player.witchCaveReturnY = player.y;
      player.room = 'witch_cave';
      player.roomLockUntil = Date.now() + 1500; // stale in-flight moves must not undo this
      player.x = WITCH_CAVE_SPAWN.x;
      player.y = WITCH_CAVE_SPAWN.y;
      send(ws, { type: 'witch_cave_entered', spawn: WITCH_CAVE_SPAWN });
      // The cave is a story destination for several campaigns — this
      // handler sets player.room directly (not via 'move'), so it needs
      // its own visit hook.
      storyEvent(player, 'visit_room', { room: 'witch_cave' });
      return;
    }

    if (msg.type === 'exit_witch_cave') {
      if (player.room !== 'witch_cave') return;
      const retX = player.witchCaveReturnX || WITCH_CAVE_ENTRANCE.x;
      const retY = player.witchCaveReturnY || WITCH_CAVE_ENTRANCE.y + 50;
      player.room = 'wilds';
      player.roomLockUntil = Date.now() + 1500; // stale in-flight moves must not undo this
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
      player.roomLockUntil = Date.now() + 1500; // stale in-flight moves must not undo this
      player.x = VAULT_SPAWN.x;
      player.y = VAULT_SPAWN.y;
      send(ws, { type: 'vault_entered', spawn: VAULT_SPAWN });
      storyEvent(player, 'visit_room', { room: 'bank_vault' });
      return;
    }

    if (msg.type === 'exit_vault') {
      if (player.room !== 'bank_vault') return;
      const b = WORLD.buildings.find(bb => bb.id === 'bank');
      const retX = player.vaultReturnX || (b ? b.x + b.w / 2 : player.x);
      const retY = player.vaultReturnY || (b ? b.y + b.h / 2 : player.y);
      player.room = 'bank';
      player.roomLockUntil = Date.now() + 1500; // stale in-flight moves must not undo this
      player.x = retX;
      player.y = retY;
      player.vaultReturnX = null;
      player.vaultReturnY = null;
      send(ws, { type: 'vault_exited', x: retX, y: retY });
      return;
    }

    if (msg.type === 'enter_ember_wastes') {
      if (player.room !== 'outside' || player.isDead) return;
      // Re-checked here, not just hidden client-side — the portal being
      // visible/the kiosk existing is a client-side courtesy, this is the
      // actual gate. Someone whose client is stale (or who's poking the
      // socket directly) can't walk in during the day.
      if (!templePortalOpen()) {
        send(ws, { type: 'ember_wastes_error', message: 'The portal is dark — it only opens once all four torches are lit.' });
        return;
      }
      const dist = Math.hypot(player.x - TEMPLE_ALTAR.x, player.y - TEMPLE_ALTAR.y);
      if (dist > 100) return;
      player.emberReturnX = player.x;
      player.emberReturnY = player.y;
      player.room = 'ember_wastes';
      player.roomLockUntil = Date.now() + 1500; // stale in-flight moves must not undo this
      player.x = EMBER_SPAWN.x;
      player.y = EMBER_SPAWN.y;
      send(ws, { type: 'ember_wastes_entered', spawn: EMBER_SPAWN });
      storyEvent(player, 'visit_room', { room: 'ember_wastes' });
      return;
    }

    if (msg.type === 'exit_ember_wastes') {
      if (player.room !== 'ember_wastes') return;
      const retX = player.emberReturnX || TEMPLE_ALTAR.x;
      const retY = player.emberReturnY || TEMPLE_ALTAR.y + 80;
      player.room = 'outside';
      player.roomLockUntil = Date.now() + 1500; // stale in-flight moves must not undo this
      player.x = retX;
      player.y = retY;
      player.emberReturnX = null;
      player.emberReturnY = null;
      send(ws, { type: 'ember_wastes_exited', x: retX, y: retY });
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
      // Brewing at Hazel's cauldron is the Witch campaign's finale objective.
      storyEvent(player, 'craft_potion', { recipeId });
      return;
    }

    if (msg.type === 'witch_talk') {
      if (player.room !== 'witch_cave') return;
      storyEvent(player, 'talk_npc', { npcId: 'witch_hazel' });
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

    // Lexton Greyfur's Howl Trade — his one and only offer (the old Blood
    // Pact ritual handler is gone): trade an item for the player's own
    // recorded howl, which then goes on the Auction House. See
    // werewolf_voice_request/werewolf_voice_payment below for the
    // consent-first capture flow. (Wolf's Pact Brews already in player
    // inventories keep working — only the way to get new ones is retired.)
    if (msg.type === 'werewolf_talk') {
      // Used to just return here with nothing sent at all if this ever
      // didn't hold — silent failures are exactly what made the voice
      // trade's actual break hard to diagnose, so every gate in this trio
      // of handlers now always sends something back.
      if (player.room !== 'wilds') {
        send(ws, { type: 'werewolf_shop_error', message: 'Lexton is only found in the Wilds.' });
        return;
      }
      storyEvent(player, 'talk_npc', { npcId: 'npc_lexton' });
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
    // If a resume join already kicked this player out of the map (see the
    // duplicate-prevention pass in the join handler), everything below
    // already happened — including the successor taking over — so this
    // close is just the old socket finally noticing.
    if (player && players.get(player.id) === player) {
      // Stash the player for a seamless reconnect — a phone whose screen
      // turned off (or any dropped connection) can rejoin with the token
      // it got in init and carry on as the same character in the same
      // spot. Uses the same single-use restore path as checkout returns.
      if (player.liveResumeToken) {
        resumeStashes.set(player.liveResumeToken, {
          expiresAt: Date.now() + DISCONNECT_RESUME_TTL_MS,
          stash: buildResumeStash(player)
        });
      }
      leaveParty(player);
      delveLeave(player, 'disconnect');
      // Stamp the away-clock for the "while you were gone" letter.
      if (player.accountKey) {
        try { getProgress(player).lastSeenAt = Date.now(); saveProgress(); } catch (e) {}
      }
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

// Reap half-open connections. A phone that loses signal (or a tab the OS
// froze) never sends a close frame — without this, its player stands
// frozen in town until TCP gives up, which can be minutes, and can even
// end up standing next to their own resumed self. terminate() fires the
// normal 'close' handler, so a reaped player still gets stashed and can
// seamlessly resume when their connection comes back.
setInterval(() => {
  for (const client of wss.clients) {
    if (client.isAlive === false) {
      try { client.terminate(); } catch (e) {}
      continue;
    }
    client.isAlive = false;
    try { client.ping(); } catch (e) {}
  }
}, 30 * 1000);

// Test hooks — lets the mock-socket harness in test/ drive internal event
// plumbing (e.g. simulate the kill that a real mob death would produce)
// without standing up real wildlife/AI. Not used by any runtime code path.
global.__testHooks = {
  server, // test-only: live http.Server so route tests can read the bound port
  // Durable storage (Session L)
  getSqliteDb, persistLoad, persistSave, persistSetKey,
  DATA_DIR, accounts, saveAccounts, playerProgress, saveProgress,
  decorHarvestedAt, saveHarvests, persistExportBackups,
  // Session L systems
  DUNGEON_LORE, DUNGEON_MOB_TYPES, dungeonMobs, dungeonMobMaxHealth, bossEngagedScale,
  PARTY_BOSS_HP_PER_ALLY, DUNGEON_BOSS_RESPAWN_MS, findDungeonTarget,
  leaderboards, lbBump, lbSetMax, lbTop, lbRankOf, lbSettleClosedWeeks, weekKey, boardStatePayload,
  tourneyWindow, festivalWindow, bloodMoonWindow, bloodMoonActive, calendarPublicState,
  BLOOD_MOON_EVERY_NIGHTS, FESTIVAL_XP_MULT, maybeDropBloodShard, BLOODMOON_CIRCLET_COST,
  DELVE_MODS, DELVE_BOONS, weeklyDelveMods, delveRuns, delveRunsByRoom, delveStart,
  delveLeave, delveSpawnFloor, tickDelves, noteDelveKill, delveBoonContrib, delveMenuPayload,
  covens, covenOf, covenIndex, covenStatePayload, covenTableFor, COVEN_CREATE_COST, COVEN_MAX_MEMBERS,
  FIRST_STEPS, noteFirstStep, firstStepsPayload,
  applyLoginStreak, buildWelcomeLetter, LETTER_AWAY_MS, HARVEST_COOLDOWN_MS,
  sessions, covenInvites, resumeStashes,
  getVapidKeys, encryptWebPush, vapidAuthHeader, sendWebPush, pushBroadcast, pushSubs,
  TOWN_PASS30_PRICE_CENTS, TOWN_PASS30_HOURS, IAP_PRODUCT30_ID, passHoursForStripeSession,
  players, storyEvent, advanceQuestProgress, getProgress, getInventory,
  STORYLINES, QUEST_CATALOG, SPELL_CATALOG, ATTACK_CATALOGS,
  // Town Pass internals (tests grant passes directly — no Stripe in CI)
  townPasses, passSessions, hasTownPass, grantForSession,
  // 💎 Moonstones + the Peddler (Session I) — exported for the test suite.
  msData, msBalance, msAdjust, grantMoonstones, MS_PACKS,
  LEGENDARY_CATALOG, legendaryWeeklySet, legendaryWeekIndex, AUCTION_MS_FEE,
  ensureBankAccount, addItemToAccount, removeItemFromAccount, countItemQty,
  listings, resolveListing, ITEM_CATALOG, EQUIP_STATS,
  // Auction-from-inventory (Session M): pack-sourced listings + returns.
  // `listings` above is the boot-time array reference and goes stale the
  // first time resolveListing reassigns the module variable — tests that
  // create-then-resolve should read listingsLive instead.
  inventories, saveInventories, returnListingItemToSeller,
  get listingsLive() { return listings; },
  LOCKED_ROOMS, TOWN_PASS_PRICE_CENTS, TOWN_PASS_HOURS,
  // Mob combat + countermeasures
  mobs, mobs2, tickWildlife, TOWN_MOB_COMBAT, TOWN_MOB_XP,
  // Session M creatures — peaceful critters, neutral pool, new hostiles, quests
  animals2, mobs3, MOB2_TYPES, MOB3_TYPES, CRITTER2_TYPES, LOOT_TABLES,
  provokeNeutral, creatureStrike, tickWilds, questForNpc, CREATURE_LABEL, rollPendingLoot,
  applyDamage, isEvading, getHardDrive, driveMedia,
  VOICE_CM_EVADE_MS, VOICE_CM_SCARE_MS, VOICE_CM_COOLDOWN_MS, VOICE_CM_RADIUS,
  ATTACKED_RECENT_MS, SNAP_RANGE,
  // Pacing / progression
  XP_THRESHOLDS, CHAPTER_LEVEL_GATES, grantXP, shopDiscountFor, NPC_SHOPS,
  QUEST_BY_NPC, QUEST_COOLDOWN_MS, isNightNow, CYCLE_MS, DAY_MS,
  // Social + juice
  EMOTE_SET, STREAK_WINDOW_MS, registerHuntKill,
  // Class skill trees + equipment stats
  SKILL_CATALOG, SKILL_MAX_RANK, skillStatePayload, getSkillAlloc,
  playerMaxHealth, outgoingDamageMult, incomingDamageMult, abilityCooldownFor,
  skillLifestealFrac, skillHarvestExtraChance, skillXpMult, skillSpeedMult, skillMendingRate,
  computeStatBlock, statContrib, gearStatContrib, invEquipField
};

server.listen(PORT, () => {
  console.log(`Town Chat listening on http://localhost:${PORT}`);
  if (TOWN_PASSWORD) console.log('Passcode protection: ON');
  console.log(stripeClient
    ? `Stripe payments: ON (Town Pass $${(TOWN_PASS_PRICE_CENTS / 100).toFixed(2)} / ${TOWN_PASS_HOURS}h — unlocks: ${[...LOCKED_ROOMS].join(', ')})`
    : 'Stripe payments: OFF (set STRIPE_SECRET_KEY to enable — locked buildings stay locked)');
});
