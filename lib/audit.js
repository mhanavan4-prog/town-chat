// Thornreach security audit log (Session M).
// One durable, structured record of security-relevant EVENTS — not crashes.
// Every event is appended as a JSON line to DATA_DIR/security/security-YYYY-MM-DD.jsonl
// (one file per day), kept in a rolling in-memory ring for the admin dashboard,
// and — when level === 'alert' — pushed to an optional webhook so you're paged.
//
//   const audit = require('./lib/audit')({ dataDir, alertWebhookUrl });
//   audit.log({ level:'warn', type:'login_fail', ip, account, detail:{reason} });
//   const n = audit.hit(ip, 'chat', 10000);   // rolling per-ip/type counter
//
// No new npm deps — fs + node's http/https only.
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

module.exports = function createAudit({ dataDir, alertWebhookUrl = '', ringSize = 800 } = {}) {
  const dir = path.join(dataDir, 'security');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}

  const ring = [];                 // recent events, newest last
  const counters = new Map();      // ip -> Map(type -> [timestamps])  (detectors)
  let stream = null, streamDay = null;

  function today() { return new Date().toISOString().slice(0, 10); }
  function getStream() {
    const d = today();
    if (d !== streamDay) {
      try { if (stream) stream.end(); } catch (e) {}
      stream = fs.createWriteStream(path.join(dir, 'security-' + d + '.jsonl'), { flags: 'a' });
      streamDay = d;
    }
    return stream;
  }

  // Real visitor IP behind Cloudflare -> Caddy -> Node. Cloudflare's
  // CF-Connecting-IP is the trustworthy one; fall back sensibly otherwise.
  function clientIp(reqLike) {
    const h = (reqLike && reqLike.headers) || {};
    const xff = (h['x-forwarded-for'] || '').split(',')[0].trim();
    const raw = h['cf-connecting-ip'] || xff ||
      (reqLike && reqLike.socket && reqLike.socket.remoteAddress) ||
      (reqLike && reqLike.ip) || '';
    return (String(raw).replace(/^::ffff:/, '') || 'unknown');
  }

  function log(ev) {
    const e = {
      ts: Date.now(),
      level: ev.level === 'alert' || ev.level === 'warn' ? ev.level : 'info',
      type: String(ev.type || 'event'),
      ip: ev.ip || null,
      account: ev.account || null,
      name: ev.name || null,
      detail: ev.detail || {}
    };
    ring.push(e);
    if (ring.length > ringSize) ring.shift();
    try { getStream().write(JSON.stringify(e) + '\n'); } catch (err) {}
    if (e.level === 'alert') dispatchAlert(e);
    return e;
  }

  // Rolling counter: record a hit for (ip,type) and return how many happened
  // within windowMs. Used by callers to decide when something is a flood.
  function hit(key, type, windowMs) {
    if (!key) return 0;
    const now = Date.now();
    let m = counters.get(key);
    if (!m) { m = new Map(); counters.set(key, m); }
    const arr = (m.get(type) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    m.set(type, arr);
    // opportunistic cleanup so the Map can't grow without bound
    if (counters.size > 5000) counters.clear();
    return arr.length;
  }

  function recent(n, opts) {
    opts = opts || {};
    let out = ring.slice(-(Math.min(Number(n) || 200, ring.length))).reverse();
    if (opts.level && opts.level !== 'all') out = out.filter((e) => e.level === opts.level);
    if (opts.q) {
      const q = String(opts.q).toLowerCase();
      out = out.filter((e) => JSON.stringify(e).toLowerCase().includes(q));
    }
    return out;
  }

  function stats() {
    const byType = {}, byLevel = { info: 0, warn: 0, alert: 0 }, ipScore = {};
    for (const e of ring) {
      byType[e.type] = (byType[e.type] || 0) + 1;
      byLevel[e.level] = (byLevel[e.level] || 0) + 1;
      if (e.ip && e.level !== 'info') ipScore[e.ip] = (ipScore[e.ip] || 0) + (e.level === 'alert' ? 3 : 1);
    }
    const topIps = Object.entries(ipScore).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([ip, score]) => ({ ip, score }));
    return { total: ring.length, byLevel, byType, topIps };
  }

  // ── Historical day files on disk (the full record, beyond the ~800-event
  // in-memory ring). Logs are one JSONL file per UTC day:
  // security-YYYY-MM-DD.jsonl. These let the admin console review any past day.
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function logDays() {
    let files = [];
    try { files = fs.readdirSync(dir); } catch (e) { return []; }
    const out = [];
    for (const f of files) {
      const m = /^security-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(f);
      if (!m) continue;
      let bytes = 0;
      try { bytes = fs.statSync(path.join(dir, f)).size; } catch (e) {}
      out.push({ date: m[1], bytes });
    }
    out.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest day first
    return out;
  }

  function dayFilePath(date) {
    if (!DAY_RE.test(String(date || ''))) return null; // guards path traversal
    return path.join(dir, 'security-' + date + '.jsonl');
  }

  // Read ONE day's events from disk, newest-first, optionally level/q filtered
  // and capped. `date` MUST be YYYY-MM-DD. Enormous files are tail-read so the
  // console can't OOM the box reviewing a pathological day.
  function readDay(date, opts) {
    opts = opts || {};
    const file = dayFilePath(date);
    if (!file) return { date: null, total: 0, events: [], error: 'bad date' };
    let text = '';
    try {
      const st = fs.statSync(file);
      const MAX = 25 * 1024 * 1024;
      if (st.size > MAX) {
        const fd = fs.openSync(file, 'r');
        try {
          const buf = Buffer.alloc(MAX);
          fs.readSync(fd, buf, 0, MAX, st.size - MAX);
          text = buf.toString('utf8');
        } finally { fs.closeSync(fd); }
        text = text.slice(text.indexOf('\n') + 1); // drop the torn leading line
      } else {
        text = fs.readFileSync(file, 'utf8');
      }
    } catch (e) { return { date, total: 0, events: [], missing: true }; }

    const all = [];
    for (const line of text.split('\n')) {
      if (!line) continue;
      try { all.push(JSON.parse(line)); } catch (e) { /* skip a torn line */ }
    }
    let out = all;
    if (opts.level && opts.level !== 'all') out = out.filter((e) => e.level === opts.level);
    if (opts.q) {
      const q = String(opts.q).toLowerCase();
      out = out.filter((e) => JSON.stringify(e).toLowerCase().includes(q));
    }
    const total = out.length;
    out = out.reverse(); // newest first
    const cap = Math.min(Number(opts.n) || 1000, 5000);
    const events = out.slice(0, cap);
    return { date, total, shown: events.length, events };
  }

  function dispatchAlert(e) {
    if (!alertWebhookUrl) return;
    try {
      const u = new URL(alertWebhookUrl);
      const text =
        '🚨 Thornreach alert — ' + e.type + '\n' +
        'ip: ' + (e.ip || '?') + '  ·  account: ' + (e.account || '-') + '\n' +
        new Date(e.ts).toISOString() + '\n' +
        '```' + JSON.stringify(e.detail) + '```';
      // {content} works for Discord, {text} for Slack — send both, each ignores the other.
      const body = JSON.stringify({ content: text, text });
      const lib = u.protocol === 'http:' ? http : https;
      const rq = lib.request(u, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
        timeout: 5000
      }, (res) => { res.resume(); });
      rq.on('error', () => {});
      rq.on('timeout', () => rq.destroy());
      rq.write(body);
      rq.end();
    } catch (err) {}
  }

  function close() { try { if (stream) stream.end(); } catch (e) {} }

  return { log, hit, recent, stats, clientIp, close, logDays, readDay, dayFilePath, dir };
};
