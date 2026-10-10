// ---------------------------------------------------------------------------
// Load test — a headless bot swarm that finds the concurrent-player ceiling
// before a launch crowd does. Forks the REAL server as a child process, ramps
// websocket clients through a set of levels, and at each level reports:
//   • server CPU% (of one core) and RSS, sampled from /proc
//   • the broadcast gap each bot actually sees between wildlife_state frames
//     (target 150ms — when the median/p95 climbs, the tick is falling behind)
//   • join latency and any dropped connections
//
// The broadcast gap is the real health signal: the server pushes wildlife_state
// every 150ms, so if bots start seeing 300–600ms gaps the single tick loop can
// no longer keep up with the room it's serving.
//
// Usage:
//   node tools/loadtest.mjs                       # default ramp 50,100,200,300
//   node tools/loadtest.mjs --steps 100,250,500 --hold 20
//   node tools/loadtest.mjs --room wilds          # stress a different room
//
// Local only by default (spawns its own server on a temp DB) — it never touches
// production data.
// ---------------------------------------------------------------------------
import WebSocket from 'ws';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const STEPS = arg('steps', '50,100,200,300').split(',').map(n => parseInt(n, 10)).filter(Boolean);
const HOLD_MS = parseInt(arg('hold', '20'), 10) * 1000;
const ROOM = arg('room', 'outside');
const PORT = parseInt(arg('port', '4399'), 10);
const MOVE_HZ = parseInt(arg('movehz', '5'), 10); // moves per bot per second (a real walking player)
const CHAR_COUNT = 6;
// Spread the swarm across the real room so area-of-interest behaves as it would
// live (a corner-packed swarm would all sit inside one view radius and hide the
// effect). Override with --spread W,H.
const ROOM_SPREAD = { outside: [3200, 2200], wilds: [10000, 10000], ember_wastes: [20000, 20000] };
const spreadArg = arg('spread', null);
const [SPREAD_W, SPREAD_H] = spreadArg ? spreadArg.split(',').map(Number) : (ROOM_SPREAD[ROOM] || [1900, 1900]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Server CPU/RSS sampling from /proc (Linux) ──────────────────────────────
function readProcStat(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    // utime (14) + stime (15) are after the comm field in parens.
    const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const utime = Number(after[11]), stime = Number(after[12]);
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const m = status.match(/VmRSS:\s+(\d+)\s+kB/);
    const rssMb = m ? Number(m[1]) / 1024 : 0;
    return { ticks: utime + stime, rssMb };
  } catch { return null; }
}
const CLK = 100; // USER_HZ (jiffies/sec) — standard on Linux

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

// ── A single bot ────────────────────────────────────────────────────────────
class Bot {
  constructor(id) {
    this.id = id;
    this.name = 'bot_' + id + '_' + Math.random().toString(36).slice(2, 6);
    this.cx = Math.random() * SPREAD_W;
    this.cy = Math.random() * SPREAD_H;
    this.lastFrameAt = 0;
    this.gaps = [];
    this.joined = false;
    this.joinSentAt = 0;
    this.joinLatency = null;
    this.dead = false;
  }
  connect() {
    return new Promise((resolve) => {
      this.ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
      this.ws.on('open', () => {
        this.joinSentAt = Date.now();
        this.ws.send(JSON.stringify({ type: 'join', name: this.name, charId: this.id % CHAR_COUNT }));
        resolve(true);
      });
      this.ws.on('message', (raw) => {
        let msg; try { msg = JSON.parse(raw); } catch { return; }
        if (msg.type === 'init' && !this.joined) { this.joined = true; this.joinLatency = Date.now() - this.joinSentAt; }
        if (msg.type === 'wildlife_state') {
          const now = Date.now();
          if (this.lastFrameAt) this.gaps.push(now - this.lastFrameAt);
          this.lastFrameAt = now;
        }
      });
      this.ws.on('error', () => { this.dead = true; });
      this.ws.on('close', () => { this.dead = true; });
    });
  }
  move() {
    if (this.dead || this.ws.readyState !== WebSocket.OPEN) return;
    // Small random walk — well under the teleport-anomaly threshold.
    this.cx = Math.max(20, Math.min(SPREAD_W - 20, this.cx + (Math.random() - 0.5) * 70));
    this.cy = Math.max(20, Math.min(SPREAD_H - 20, this.cy + (Math.random() - 0.5) * 70));
    this.ws.send(JSON.stringify({ type: 'move', x: this.cx, y: this.cy, room: ROOM }));
  }
  close() { try { this.ws.close(); } catch {} }
}

async function main() {
  const DATA_DIR = mkdtempSync(path.join(tmpdir(), 'tc-load-'));
  console.log(`Spawning server on :${PORT} (temp DB ${DATA_DIR})…`);
  const child = spawn('node', ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DATA_DIR, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false;
  child.stdout.on('data', (d) => { if (/listening/i.test(d.toString())) ready = true; });
  child.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  for (let i = 0; i < 100 && !ready; i++) await sleep(100);
  if (!ready) { console.error('Server did not start.'); child.kill(); process.exit(1); }
  await sleep(500);

  const bots = [];
  let moveTimer = null;
  const startMoveLoop = () => {
    const interval = Math.round(1000 / MOVE_HZ);
    moveTimer = setInterval(() => { for (const b of bots) b.move(); }, interval);
  };

  console.log(`\nRamp: ${STEPS.join(' → ')} bots in room "${ROOM}", ${HOLD_MS / 1000}s hold each, ${MOVE_HZ} moves/s each.\n`);
  const header = ['level', 'connected', 'joined', 'joinMs(med/p95)', 'cpu%(1 core)', 'rssMB', 'gap ms(med/p95/max)', 'dropped'];
  console.log(header.join('  |  '));
  console.log('-'.repeat(header.join('  |  ').length + 20));

  const results = [];
  for (const level of STEPS) {
    // Open new connections up to `level`.
    const toOpen = level - bots.length;
    for (let i = 0; i < toOpen; i++) {
      const b = new Bot(bots.length);
      bots.push(b);
      await b.connect();
      await sleep(8); // stagger the handshake storm a little
    }
    if (!moveTimer) startMoveLoop();
    // Let joins settle, then clear per-bot gap buffers so we measure THIS level.
    await sleep(1500);
    for (const b of bots) b.gaps.length = 0;
    const p0 = readProcStat(child.pid); const t0 = Date.now();

    await sleep(HOLD_MS);

    const p1 = readProcStat(child.pid); const t1 = Date.now();
    const cpuPct = (p0 && p1) ? (100 * (p1.ticks - p0.ticks) / CLK) / ((t1 - t0) / 1000) : 0;
    const rssMb = p1 ? p1.rssMb : 0;
    const allGaps = [];
    for (const b of bots) for (const g of b.gaps) allGaps.push(g);
    allGaps.sort((a, b) => a - b);
    const joinLat = bots.map(b => b.joinLatency).filter(x => x != null).sort((a, b) => a - b);
    const connected = bots.filter(b => !b.dead).length;
    const joined = bots.filter(b => b.joined).length;
    const dropped = bots.filter(b => b.dead).length;

    const row = {
      level, connected, joined,
      joinMed: pct(joinLat, 50), joinP95: pct(joinLat, 95),
      cpuPct: Math.round(cpuPct), rssMb: Math.round(rssMb),
      gapMed: pct(allGaps, 50), gapP95: pct(allGaps, 95), gapMax: allGaps[allGaps.length - 1] || 0,
      dropped,
    };
    results.push(row);
    console.log([
      String(level).padStart(5),
      String(connected).padStart(9),
      String(joined).padStart(6),
      `${row.joinMed}/${row.joinP95}`.padStart(15),
      String(row.cpuPct).padStart(12),
      String(row.rssMb).padStart(5),
      `${row.gapMed}/${row.gapP95}/${row.gapMax}`.padStart(19),
      String(dropped).padStart(7),
    ].join('  |  '));
  }

  // ── Verdict ──
  console.log('\n── Verdict ──');
  const HEALTHY_GAP = 230;  // median broadcast gap should sit near the 150ms target
  const SATURATED = 90;     // one core nearly pegged
  let ceiling = null;
  for (const r of results) {
    const healthy = r.gapMed <= HEALTHY_GAP && r.cpuPct < SATURATED && r.dropped === 0;
    if (healthy) ceiling = r.level;
    console.log(`${String(r.level).padStart(4)} players — ${healthy ? 'OK' : 'STRAINED'} (gap ${r.gapMed}ms, cpu ${r.cpuPct}%, dropped ${r.dropped})`);
  }
  console.log(ceiling
    ? `\nComfortable ceiling in "${ROOM}" at this hardware: ~${ceiling} concurrent (last healthy level).`
    : `\nStrained even at the lowest level — investigate the tick cost in "${ROOM}".`);

  if (moveTimer) clearInterval(moveTimer);
  for (const b of bots) b.close();
  await sleep(300);
  child.kill('SIGTERM');
  await sleep(300);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
