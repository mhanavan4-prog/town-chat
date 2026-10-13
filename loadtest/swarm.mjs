// ---------------------------------------------------------------------------
// Thornreach load/concurrency swarm — opens N simulated players against a
// running server and reports the signals that decide whether the box holds:
// join latency, WebSocket round-trip under load (the event-loop-lag canary),
// inbound broadcast throughput, and the longest any client went unheard.
//
// It talks the real wire protocol (join → move → chat → ping), so the server
// pays the real per-tick fan-out cost. Everyone piles into ONE room (town) by
// default — the worst case, and exactly launch night, when the whole crowd
// spawns together.
//
// Needs only `ws` (already a project dependency). Run it from a machine with
// open network to the target (NOT this project's cloud container, whose egress
// is allow-listed). Examples:
//
//   # local server on the same machine
//   node loadtest/swarm.mjs ws://localhost:3000 --n 200 --dur 60
//
//   # the live box, ramping to 500 over the connect stagger
//   URL=wss://play.thornreach.com N=500 RAMP_MS=40 DUR=120 node loadtest/swarm.mjs
//
// Flags (or UPPER_CASE env of the same name):
//   --url   <ws://…>   target (1st positional arg also works)   [required]
//   --n     <int>      total simulated clients                  [100]
//   --ramp  <ms>       delay between each connect (stagger)      [50]
//   --dur   <s>        seconds to hold after the ramp finishes   [60]
//   --move  <hz>       moves/sec per client (0 = stand still)    [3]
//   --chat  <hz>       chat lines/sec per client                 [0.05]
//   --ping  <hz>       WS ping RTT probes/sec per client         [0.5]
//   --wilds <0..1>     fraction that walk north into the Wilds   [0]
//   --password <str>   TOWN_PASSWORD, if the server sets one     ['']
//   --quiet            only the final summary, no live ticks
// ---------------------------------------------------------------------------
import WebSocket from 'ws';
import http from 'http';
import https from 'https';

// ---- config ---------------------------------------------------------------
function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i !== -1) {
    const v = process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) return true; // bare flag
    return v;
  }
  const env = process.env[name.toUpperCase()];
  return env !== undefined ? env : def;
}
const TARGET = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : arg('url', process.env.URL);
if (!TARGET) { console.error('error: no target URL (pass ws://host:port as the first arg or --url)'); process.exit(2); }
const N = parseInt(arg('n', 100), 10);
const RAMP_MS = parseInt(arg('ramp', 50), 10);
const DUR_S = parseInt(arg('dur', 60), 10);
const MOVE_HZ = parseFloat(arg('move', 3));
const CHAT_HZ = parseFloat(arg('chat', 0.05));
const PING_HZ = parseFloat(arg('ping', 0.5));
const WILDS_PCT = parseFloat(arg('wilds', 0));
const PASSWORD = String(arg('password', '') || '');
const QUIET = arg('quiet', false) === true || String(arg('quiet', '')) === 'true';

// Town is 3200×2200, spawn (1600,1100); Wilds 10000×10000, spawn (5000,8800).
const TOWN = { w: 3200, h: 2200, sx: 1600, sy: 1100 };
const WILDS = { w: 10000, h: 10000, sx: 5000, sy: 8800 };

// ---- metrics --------------------------------------------------------------
const clients = [];
let connected = 0, joined = 0, failedConnect = 0, droppedAfterJoin = 0, sockErrors = 0;
const joinLat = [];                 // ms, connect→init
let rtt = [];                       // ms, rolling WS ping RTT this window
let winMsgs = 0, winBytes = 0;      // inbound since last tick
let totalMsgs = 0, totalBytes = 0;
const started = Date.now();

function pct(arr, p) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}
function httpBase(wsUrl) {
  try {
    const u = new URL(wsUrl);
    u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
    u.pathname = '/healthz'; u.search = '';
    return u.toString();
  } catch { return null; }
}
const HEALTH_URL = httpBase(TARGET);
function pollHealth() {
  return new Promise((resolve) => {
    if (!HEALTH_URL) return resolve(null);
    const lib = HEALTH_URL.startsWith('https') ? https : http;
    const req = lib.get(HEALTH_URL, { timeout: 2000 }, (res) => {
      let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ---- one simulated player -------------------------------------------------
function spawnClient(i) {
  const inWilds = i < Math.floor(N * WILDS_PCT);
  const area = inWilds ? WILDS : TOWN;
  const room = inWilds ? 'wilds' : 'outside';
  const c = {
    i, ws: null, room, x: area.sx + (Math.random() * 400 - 200), y: area.sy + (Math.random() * 400 - 200),
    connectAt: 0, joinedAt: 0, lastRecvAt: 0, msgs: 0, bytes: 0, alive: false, joinedFlag: false, timers: [],
  };
  clients.push(c);
  let ws;
  try {
    ws = new WebSocket(TARGET, { perMessageDeflate: true, handshakeTimeout: 8000 });
  } catch (e) { failedConnect++; return; }
  c.ws = ws;
  c.connectAt = Date.now();

  ws.on('open', () => {
    connected++; c.alive = true; c.lastRecvAt = Date.now();
    const join = { type: 'join', name: 'Load' + i, charId: i % 6 };
    if (PASSWORD) join.password = PASSWORD;
    safeSend(c, join);
    // WS ping RTT probe — the pong echoes our timestamp; the gap is the
    // round-trip including the server's event-loop lag under load.
    if (PING_HZ > 0) c.timers.push(setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) { try { ws.ping(Buffer.from(String(Date.now()))); } catch {} }
    }, 1000 / PING_HZ));
  });
  ws.on('pong', (buf) => {
    const t = Number(buf.toString()); if (Number.isFinite(t)) rtt.push(Date.now() - t);
  });
  ws.on('message', (data, isBinary) => {
    const len = isBinary ? data.length : Buffer.byteLength(data);
    c.msgs++; c.bytes += len; c.lastRecvAt = Date.now();
    winMsgs++; winBytes += len; totalMsgs++; totalBytes += len;
    if (!c.joinedFlag) {
      let m; try { m = JSON.parse(data.toString()); } catch { return; }
      if (m && m.type === 'init') {
        c.joinedFlag = true; c.joinedAt = Date.now(); joined++;
        joinLat.push(c.joinedAt - c.connectAt);
        startActivity(c);
      }
    }
  });
  ws.on('error', () => { sockErrors++; });
  ws.on('close', () => {
    c.alive = false;
    c.timers.forEach(clearInterval); c.timers = [];
    if (!c.joinedFlag) failedConnect++; else droppedAfterJoin++;
  });
}

function safeSend(c, obj) {
  if (c.ws && c.ws.readyState === WebSocket.OPEN) { try { c.ws.send(JSON.stringify(obj)); } catch {} }
}

// Random-walk moves + the odd chat line, once a client is in the world.
function startActivity(c) {
  const area = c.room === 'wilds' ? WILDS : TOWN;
  if (MOVE_HZ > 0) c.timers.push(setInterval(() => {
    c.x = Math.max(0, Math.min(area.w, c.x + (Math.random() * 120 - 60)));
    c.y = Math.max(0, Math.min(area.h, c.y + (Math.random() * 120 - 60)));
    safeSend(c, { type: 'move', x: Math.round(c.x), y: Math.round(c.y), room: c.room });
  }, 1000 / MOVE_HZ));
  if (CHAT_HZ > 0) c.timers.push(setInterval(() => {
    safeSend(c, { type: 'chat', text: 'gg ' + Math.floor(Math.random() * 1000) });
  }, 1000 / CHAT_HZ));
}

// ---- ramp + live dashboard ------------------------------------------------
console.log(`\nThornreach swarm → ${TARGET}`);
console.log(`  clients=${N}  ramp=${RAMP_MS}ms/conn (~${Math.round(1000 / RAMP_MS)}/s)  hold=${DUR_S}s  move=${MOVE_HZ}hz  chat=${CHAT_HZ}hz  ping=${PING_HZ}hz  wilds=${Math.round(WILDS_PCT * 100)}%`);
console.log(`  health=${HEALTH_URL || '(none)'}\n`);

let launched = 0;
const rampTimer = setInterval(() => {
  if (launched >= N) { clearInterval(rampTimer); return; }
  spawnClient(launched++);
}, RAMP_MS);

async function tick(final) {
  const el = ((Date.now() - started) / 1000).toFixed(0);
  const win = rtt.slice(); rtt = [];
  const h = await pollHealth();
  const maxStale = clients.reduce((mx, c) => (c.alive && c.lastRecvAt ? Math.max(mx, Date.now() - c.lastRecvAt) : mx), 0);
  const aliveNow = clients.filter(c => c.alive).length;
  const line = [
    `t=${el}s`,
    `live=${aliveNow}/${launched}`,
    `joined=${joined}`,
    `drop=${droppedAfterJoin}`,
    `fail=${failedConnect}`,
    `in=${winMsgs}msg/${(winBytes / 1024 / 2).toFixed(0)}KB·s⁻¹`,
    `rtt(ms) p50=${pct(win, 50) ?? '—'} p95=${pct(win, 95) ?? '—'} max=${win.length ? Math.max(...win) : '—'}`,
    `stale=${maxStale}ms`,
    h ? `srv.players=${h.players} up=${h.uptime}s` : 'srv=?',
  ].join('  ');
  if (!QUIET || final) console.log((final ? 'FINAL  ' : '       ') + line);
  winMsgs = 0; winBytes = 0;
}

const liveTimer = setInterval(() => tick(false), 2000);

// End = time to launch everything + the hold window.
const totalMs = N * RAMP_MS + DUR_S * 1000;
setTimeout(async () => {
  clearInterval(liveTimer);
  await tick(true);
  const aliveNow = clients.filter(c => c.alive).length;
  const uptimeS = (Date.now() - started) / 1000;
  console.log('\n──────── summary ────────');
  console.log(`target            ${TARGET}`);
  console.log(`requested         ${N} clients`);
  console.log(`peak connected    ${connected}   (still alive at end: ${aliveNow})`);
  console.log(`joined world      ${joined}`);
  console.log(`failed to connect ${failedConnect}`);
  console.log(`dropped post-join ${droppedAfterJoin}`);
  console.log(`socket errors     ${sockErrors}`);
  console.log(`join latency ms   p50=${pct(joinLat, 50)}  p95=${pct(joinLat, 95)}  max=${joinLat.length ? Math.max(...joinLat) : '—'}`);
  console.log(`inbound total     ${totalMsgs} msgs / ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`inbound avg/client ${joined ? (totalBytes / joined / 1024 / uptimeS).toFixed(1) : '—'} KB/s each over the run`);
  const verdict = failedConnect === 0 && droppedAfterJoin === 0;
  console.log(`\n${verdict ? '✅ all requested clients connected, joined, and stayed connected' : '⚠️  some clients failed or dropped — see counts above'}`);
  clients.forEach(c => { c.timers.forEach(clearInterval); try { c.ws && c.ws.close(); } catch {} });
  setTimeout(() => process.exit(verdict ? 0 : 1), 500);
}, totalMs);
