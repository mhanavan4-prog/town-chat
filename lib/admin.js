// Thornreach admin / moderation console (Session M).
// Mounts a gated dashboard at /admin plus its JSON API. Everything that reads
// or changes data requires the x-admin-key header to equal ADMIN_KEY; the HTML
// shell itself is harmless (it just prompts for the key and calls the API).
// If ADMIN_KEY is not set, the console is OFF — no open back door.
//
//   require('./lib/admin')(app, { audit, getAdminKey, bans });
//
// `bans` is the moderation store from server.js: { isBanned, apply, lift, list }.
module.exports = function mountAdmin(app, deps) {
  const { audit, getAdminKey, bans, onlineList, evidence, accountInfo, accountsSummary, analytics, analyticsSummary, setAbEnabled, reportsList, reportsResolve, worldChatRecent, hostSay, telemetry, bugReports, auctionFeedRecent } = deps;

  function authed(req) {
    const key = getAdminKey();
    if (!key) return false; // disabled until an ADMIN_KEY is configured
    const given = req.get('x-admin-key') || (req.query && req.query.key) || (req.body && req.body.key);
    return !!given && String(given) === String(key);
  }
  function gate(req, res, next) {
    if (!getAdminKey()) return res.status(503).json({ error: 'Admin console disabled — set ADMIN_KEY on the server.' });
    if (!authed(req)) {
      audit.log({ level: 'warn', type: 'admin_auth_fail', ip: audit.clientIp(req), detail: { path: req.path } });
      return res.status(401).json({ error: 'unauthorized' });
    }
    // Accountability trail: the first authenticated call per IP per hour marks an
    // admin console session opening (the dashboard auto-refreshes, so rate-limit).
    const ip = audit.clientIp(req);
    if (audit.hit(ip, 'admin_ok', 60 * 60 * 1000) === 1) {
      audit.log({ level: 'info', type: 'admin_login_ok', ip });
    }
    next();
  }

  app.get('/admin', (req, res) => res.type('html').send(PAGE));
  // Per-player timeline — the shell; data comes from the gated /api/admin/player.
  app.get('/admin/player', (req, res) => res.type('html').send(PLAYER_PAGE));

  // ── Product analytics (privacy-respecting, aggregate-only) ──────────────────
  app.get('/admin/analytics', (req, res) => res.type('html').send(ANALYTICS_PAGE));
  app.get('/api/admin/analytics', gate, (req, res) => {
    const days = Math.max(1, Math.min(180, parseInt(req.query.days, 10) || 30));
    res.json({
      snapshot: analytics && typeof analytics.snapshot === 'function' ? analytics.snapshot(days) : { days: [], data: {}, metrics: [] },
      summary: typeof analyticsSummary === 'function' ? analyticsSummary() : null
    });
  });

  // ── Reports triage queue ────────────────────────────────────────────────
  // Live world-chat monitor: the recent open-world lines + who's online now, so
  // the owner can see people arriving (and whether they're talking to an empty
  // town). Public chat only — never the private coven/room channels.
  app.get('/api/admin/worldchat', gate, (req, res) => {
    const n = Math.min(120, Math.max(1, parseInt(req.query.n, 10) || 80));
    const roster = typeof onlineList === 'function' ? onlineList() : [];
    res.json({
      messages: typeof worldChatRecent === 'function' ? worldChatRecent(n) : [],
      online: roster.length,
      players: roster
    });
  });
  // Live auction-house activity feed (read-only).
  app.get('/api/admin/auctionfeed', gate, (req, res) => {
    const n = Math.min(200, Math.max(1, parseInt(req.query.n, 10) || 80));
    res.json({ events: typeof auctionFeedRecent === 'function' ? auctionFeedRecent(n) : [] });
  });
  // Post a line into the open world as the host (greeting arrivals).
  app.post('/api/admin/worldsay', gate, (req, res) => {
    const b = req.body || {};
    const msg = typeof hostSay === 'function' ? hostSay(String(b.text || ''), b.name ? String(b.name) : '') : null;
    if (!msg) return res.status(400).json({ error: 'Empty or invalid message.' });
    res.json({ ok: true, message: { name: msg.name, text: msg.text, ts: msg.ts } });
  });

  // Client-health detail: the recent-reports ring (load/asset beacons + crashes)
  // so the owner can see WHAT is breaking, not just the aggregate counts.
  app.get('/api/admin/telemetry', gate, (req, res) => {
    res.json({ recent: telemetry && typeof telemetry.recent === 'function' ? telemetry.recent(req.query.n) : [] });
  });

  // In-game bug reports (players' "Report a Bug").
  app.get('/api/admin/bugreports', gate, (req, res) => {
    if (!bugReports) return res.json({ reports: [], counts: { total: 0, open: 0 } });
    res.json({ reports: bugReports.recent(req.query.n, req.query.status || 'open'), counts: bugReports.counts() });
  });
  app.post('/api/admin/bug-action', gate, (req, res) => {
    const b = req.body || {};
    const ok = bugReports && bugReports.resolve(String(b.id || ''), b.status === 'open' ? 'open' : 'resolved');
    res.json({ ok: !!ok });
  });

  app.get('/admin/reports', (req, res) => res.type('html').send(REPORTS_PAGE));
  app.get('/api/admin/reports', gate, (req, res) => {
    res.json({ reports: typeof reportsList === 'function' ? reportsList(req.query.status || 'open') : [] });
  });
  app.post('/api/admin/report-action', gate, (req, res) => {
    const b = req.body || {};
    const ok = typeof reportsResolve === 'function' && reportsResolve(String(b.id || ''), b.status === 'dismissed' ? 'dismissed' : 'resolved', 'admin');
    if (ok) audit.log({ level: 'info', type: 'report_' + (b.status === 'dismissed' ? 'dismissed' : 'resolved'), ip: audit.clientIp(req), detail: { id: b.id } });
    res.json({ ok });
  });

  app.get('/api/admin/events', gate, (req, res) => {
    res.json({ events: audit.recent(req.query.n, { level: req.query.level, q: req.query.q }) });
  });

  // ── Traffic by IP ──────────────────────────────────────────────────────────
  // Group website visits (page_visit) and game joins (game_join) by IP over the
  // last N days, from the durable day logs. Admin-only (IPs are PII). Lets the
  // owner tell their own repeating IP apart from one-off organic visitors; a
  // load test that hit the WebSocket directly never loaded a page, so it only
  // shows (deduped) under game joins, never under site visits.
  app.get('/api/admin/ip-breakdown', gate, (req, res) => {
    const days = Math.max(1, Math.min(180, parseInt(req.query.days, 10) || 30));
    const dayList = (typeof audit.logDays === 'function' ? audit.logDays() : []).slice(0, days);
    const byIp = new Map();
    let cappedDays = 0, events = 0;
    for (const d of dayList) {
      const r = typeof audit.readDay === 'function' ? audit.readDay(d.date, { n: 5000 }) : null;
      if (!r) continue;
      if ((r.total || 0) > (r.shown || 0)) cappedDays++;
      for (const e of (r.events || [])) {
        if (e.type !== 'page_visit' && e.type !== 'game_join') continue;
        events++;
        const ip = e.ip || 'unknown';
        let a = byIp.get(ip);
        if (!a) { a = { ip, visits: 0, joins: 0, pages: new Set(), refs: new Set(), devices: new Set(), first: e.ts, last: e.ts }; byIp.set(ip, a); }
        const det = e.detail || {};
        if (e.type === 'page_visit') { a.visits++; if (det.page) a.pages.add(det.page); if (det.ref) a.refs.add(det.ref); if (det.device) a.devices.add(det.device); }
        else a.joins++;
        if (e.ts < a.first) a.first = e.ts;
        if (e.ts > a.last) a.last = e.ts;
      }
    }
    const rows = Array.from(byIp.values())
      .map((a) => ({ ip: a.ip, visits: a.visits, joins: a.joins, pages: Array.from(a.pages), refs: Array.from(a.refs), devices: Array.from(a.devices), first: a.first, last: a.last }))
      .sort((x, y) => (y.visits + y.joins) - (x.visits + x.joins))
      .slice(0, 300);
    res.json({ days, ips: rows.length, events, cappedDays, rows });
  });

  app.get('/api/admin/stats', gate, (req, res) => {
    res.json(Object.assign(audit.stats(), {
      bans: bans.list(),
      online: typeof onlineList === 'function' ? onlineList() : [],
      accounts: typeof accountsSummary === 'function' ? accountsSummary() : null
    }));
  });

  // ── Historical logs ───────────────────────────────────────────────────────
  // The events feed above is the in-memory ring (most recent ~800). These read
  // the durable per-day JSONL files on disk so any past day can be reviewed.
  app.get('/api/admin/logdays', gate, (req, res) => {
    res.json({ days: typeof audit.logDays === 'function' ? audit.logDays() : [] });
  });

  app.get('/api/admin/logday', gate, (req, res) => {
    const date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    // ?download=1 streams the raw, untouched JSONL for offline review/archiving.
    if (req.query.download) {
      const fp = typeof audit.dayFilePath === 'function' ? audit.dayFilePath(date) : null;
      if (!fp) return res.status(400).type('text/plain').send('bad date');
      audit.log({ level: 'info', type: 'admin_log_export', ip: audit.clientIp(req), detail: { date } });
      res.set('Content-Disposition', 'attachment; filename="security-' + date + '.jsonl"');
      res.type('application/x-ndjson');
      return res.sendFile(fp, (err) => {
        if (err && !res.headersSent) res.status(404).type('text/plain').send('No log for ' + date + '.');
      });
    }
    res.json(audit.readDay(date, { level: req.query.level, q: req.query.q, n: req.query.n }));
  });

  // ── Per-player timeline ─────────────────────────────────────────────────────
  // Everything the security log holds for ONE identity, newest-first, merged
  // from the in-memory ring and the durable per-day files on disk. Keyed by
  // account (the strong identity for a logged-in player), else by IP (the only
  // stable handle a guest has within a session), optionally narrowed by name.
  // Admin-only — this is per-identity PII, the same data already shown in the
  // live feed, gathered into one player's story so an incident like a flood of
  // out-of-range strikes can be read in context (what, where, when).
  app.get('/api/admin/player', gate, (req, res) => {
    const account = String(req.query.account || '').trim().toLowerCase();
    const ip = String(req.query.ip || '').trim();
    const name = String(req.query.name || '').trim();
    const nameLc = name.toLowerCase();
    if (!account && !ip && !name) return res.status(400).json({ error: 'account, ip, or name required' });
    const days = Math.max(1, Math.min(180, parseInt(req.query.days, 10) || 14));
    const cap = Math.max(1, Math.min(5000, parseInt(req.query.n, 10) || 1500));
    // An event belongs to this player when its strong identifier matches. We
    // prefer account; fall back to IP; name alone is a last resort (names aren't
    // unique and guests can reuse them), but when BOTH ip and name are given we
    // AND them so a shared household IP still narrows to the right guest.
    const match = (e) => {
      if (account) return (e.account || '').toLowerCase() === account;
      const eName = (e.name || (e.detail && e.detail.name) || '').toLowerCase();
      if (ip && nameLc) return e.ip === ip && eName === nameLc;
      if (ip) return e.ip === ip;
      return eName === nameLc;
    };
    const seen = new Set();
    const out = [];
    const take = (e) => {
      if (!match(e)) return;
      const k = e.ts + '|' + e.type + '|' + (e.ip || '') + '|' + JSON.stringify(e.detail || {});
      if (seen.has(k)) return; // the ring overlaps today's day-file — dedupe the seam
      seen.add(k);
      out.push(e);
    };
    for (const e of audit.recent(5000)) take(e); // in-memory ring first (has the freshest)
    const dayList = (typeof audit.logDays === 'function' ? audit.logDays() : []).slice(0, days);
    let cappedDays = 0;
    for (const d of dayList) {
      const r = typeof audit.readDay === 'function' ? audit.readDay(d.date, { n: 8000 }) : null;
      if (!r) continue;
      if ((r.total || 0) > (r.shown || 0)) cappedDays++;
      for (const e of (r.events || [])) take(e);
    }
    out.sort((a, b) => b.ts - a.ts);
    const events = out.slice(0, cap);
    // A friendly display name + the window actually covered.
    const display = account || name || ip;
    res.json({ identity: { account: account || null, ip: ip || null, name: name || null, display },
      days, total: out.length, shown: events.length, cappedDays, events });
  });

  // Pause / resume an A/B experiment without a deploy.
  app.post('/api/admin/ab-toggle', gate, (req, res) => {
    const b = req.body || {};
    const exp = String(b.exp || '');
    const enabled = !!b.enabled;
    const ok = typeof setAbEnabled === 'function' ? setAbEnabled(exp, enabled) : false;
    if (!ok) return res.status(400).json({ error: 'unknown experiment' });
    audit.log({ level: 'info', type: 'ab_toggle', ip: audit.clientIp(req), detail: { exp, enabled } });
    res.json({ ok: true, exp, enabled });
  });

  app.post('/api/admin/ban', gate, (req, res) => {
    const b = req.body || {};
    const target = b.target === 'ip' ? 'ip' : 'account';
    const value = String(b.value || '').trim().toLowerCase();
    if (!value) return res.status(400).json({ error: 'value required' });
    const kind = b.kind === 'mute' ? 'mute' : 'ban';
    const hours = Number(b.hours) > 0 ? Number(b.hours) : 0; // 0 = permanent
    bans.apply(target, value, { kind, reason: String(b.reason || '').slice(0, 200), by: 'admin', hours });
    audit.log({ level: 'alert', type: 'moderation_' + kind, ip: target === 'ip' ? value : null,
      account: target === 'account' ? value : null, detail: { target, value, kind, hours, reason: b.reason || '' } });
    res.json({ ok: true, bans: bans.list() });
  });

  app.post('/api/admin/unban', gate, (req, res) => {
    const b = req.body || {};
    const target = b.target === 'ip' ? 'ip' : 'account';
    const value = String(b.value || '').trim().toLowerCase();
    bans.lift(target, value);
    audit.log({ level: 'warn', type: 'moderation_lift', detail: { target, value } });
    res.json({ ok: true, bans: bans.list() });
  });

  // Image evidence — METADATA ONLY. This never returns image bytes to the
  // browser; it lists who posted what, when, from where, and the SHA-256 of the
  // preserved (quarantined) file so an incident can be traced and reported.
  app.get('/api/admin/images', gate, (req, res) => {
    if (!evidence) return res.json({ images: [] });
    const list = evidence.recent(req.query.n || 300, {
      account: req.query.account || undefined,
      surface: req.query.surface || undefined
    });
    res.json({ images: list, dir: evidence.dir });
  });

  // Evidence report — a plain-text dossier for handing to an authority. It
  // carries every fact needed to act (hash, time, account, IP, user-agent,
  // surface, byte size, and the on-server path of the preserved file), and the
  // account's own registration details. It does NOT contain the image.
  app.get('/api/admin/report', gate, (req, res) => {
    if (!evidence) return res.status(503).type('text/plain').send('Evidence store not configured.');
    const account = (req.query.account || '').trim();
    const sha = (req.query.sha || '').trim();
    let items = evidence.all().slice().reverse();
    if (account) items = items.filter((r) => (r.account || '').toLowerCase() === account.toLowerCase());
    if (sha) items = items.filter((r) => r.sha === sha);

    const now = new Date();
    const path = require('path');
    const L = [];
    L.push('THORNREACH — IMAGE EVIDENCE REPORT');
    L.push('Generated: ' + now.toISOString() + ' (' + now.toString() + ')');
    L.push('Scope: ' + (sha ? ('image ' + sha) : account ? ('account "' + account + '"') : 'ALL preserved images'));
    L.push('Records in this report: ' + items.length);
    L.push('Preserved files are stored, un-rendered, on the game server at:');
    L.push('  ' + evidence.dir);
    L.push('Each file below is named <sha256>.<ext> within that directory.');
    L.push('');
    L.push('NOTE FOR INVESTIGATORS: image bytes are NOT included in this report by');
    L.push('design. The operator can provide the specific preserved file(s) named');
    L.push('below directly to law enforcement on request. Hashes are SHA-256 of the');
    L.push('exact bytes as received.');
    L.push('');

    if (account && typeof accountInfo === 'function') {
      const info = accountInfo(account);
      L.push('── ACCOUNT ON FILE ─────────────────────────────────────────');
      if (info) {
        L.push('  username:        ' + (info.username || account));
        L.push('  created:         ' + (info.createdAt ? new Date(info.createdAt).toISOString() : 'unknown'));
        L.push('  age attestation: ' + (info.over18 ? 'confirmed 18+' : 'NOT on file'));
        if (info.over18At) L.push('  attested at:     ' + new Date(info.over18At).toISOString());
        if (info.over18Ip) L.push('  attested from:   ' + info.over18Ip);
      } else {
        L.push('  (no account record found for "' + account + '")');
      }
      L.push('');
    }

    L.push('── IMAGE RECORDS (' + items.length + ') ────────────────────────────────');
    if (!items.length) L.push('  (none)');
    items.forEach((r, i) => {
      L.push('');
      L.push('[' + (i + 1) + '] ' + new Date(r.ts).toISOString());
      L.push('    sha256:      ' + r.sha);
      L.push('    file:        ' + path.join(evidence.dir, r.file));
      L.push('    account:     ' + (r.account || '(guest — none)'));
      L.push('    ip:          ' + (r.ip || 'unknown'));
      L.push('    user-agent:  ' + (r.ua || 'unknown'));
      L.push('    surface:     ' + r.surface);
      L.push('    mime / size: ' + r.mime + ' · ' + r.bytes + ' bytes');
      if (r.context && Object.keys(r.context).length) L.push('    context:     ' + JSON.stringify(r.context));
    });
    L.push('');
    L.push('── END OF REPORT ───────────────────────────────────────────');

    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const fname = 'thornreach-evidence-' + (account ? account.replace(/[^a-z0-9]/gi, '_') + '-' : '') + stamp + '.txt';
    audit.log({ level: 'alert', type: 'evidence_report_generated', ip: audit.clientIp(req),
      detail: { account: account || null, sha: sha || null, records: items.length } });
    res.type('text/plain').set('Content-Disposition', 'attachment; filename="' + fname + '"').send(L.join('\n'));
  });
};

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Thornreach — Watch</title>
<style>
:root{--bg:#120d26;--panel:#1b1436;--line:#2c2350;--ink:#ece7f7;--muted:#9c93c2;--teal:#63dee6;--mint:#86efac;--gold:#d8b45a;--warn:#e0b45c;--alert:#f0736f}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(130% 120% at 50% 0%,#201a3c,#0c0a1c);color:var(--ink);font:14px/1.5 "Segoe UI",system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:22px 16px 60px}
h1{font-family:"Cinzel Decorative",Georgia,serif;font-size:24px;letter-spacing:.04em;margin:0 0 2px}
.sub{color:var(--muted);font-size:12.5px;margin-bottom:18px}
.gate{max-width:360px;margin:12vh auto;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:26px;text-align:center}
.gate input{width:100%;margin:12px 0;padding:11px 12px;border-radius:9px;border:1px solid var(--line);background:#0f0b22;color:var(--ink);font-size:15px}
button{cursor:pointer;border:0;border-radius:9px;padding:10px 16px;font-weight:600;color:#15102a;background:linear-gradient(90deg,#b096fc,#63dee6,#86efac)}
button.ghost{background:transparent;color:var(--muted);border:1px solid var(--line);font-weight:500}
.tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px}
@media(max-width:720px){.tiles{grid-template-columns:repeat(2,1fr)}}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.tile .k{font-size:11px;color:var(--muted);letter-spacing:.04em}
.tile .n{font:600 24px/1.1 "JetBrains Mono",ui-monospace,monospace;margin-top:6px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.bar input,.bar select{padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:#0f0b22;color:var(--ink)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin-bottom:16px}
.panel h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0;padding:12px 14px;border-bottom:1px solid var(--line)}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:500;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
td.mono,.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font:600 11px/1.6 "JetBrains Mono",monospace;border:1px solid currentColor}
.lv-info{color:var(--teal)}.lv-warn{color:var(--warn)}.lv-alert{color:var(--alert)}
.det{color:var(--muted);font-family:"JetBrains Mono",monospace;font-size:11.5px;word-break:break-word}
a.act{color:var(--teal);cursor:pointer;text-decoration:underline}
.empty{color:var(--muted);padding:18px 14px;text-align:center}
.banform{display:flex;gap:8px;flex-wrap:wrap;padding:12px 14px}
.banform input,.banform select{padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:#0f0b22;color:var(--ink)}
</style></head><body>
<div id="gate" class="gate">
  <h1>Thornreach</h1><div class="sub">The Watch — admin key required</div>
  <input id="key" type="password" placeholder="ADMIN_KEY" autofocus>
  <button onclick="saveKey()">Enter</button>
  <div id="gerr" style="color:var(--alert);font-size:12px;margin-top:10px"></div>
</div>
<div id="app" class="wrap" hidden>
  <h1>The Watch</h1><div class="sub">Live security log · auto-refresh · <a class="act" onclick="logout()">lock</a></div>
  <div class="tiles" id="tiles"></div>
  <div class="panel"><h2>Players</h2>
    <div class="tiles" id="ptiles" style="margin:14px;grid-template-columns:repeat(4,1fr)"></div>
  </div>
  <div class="bar">
    <select id="flevel"><option value="all">all levels</option><option value="alert">alerts</option><option value="warn">warnings</option><option value="info">info</option></select>
    <input id="fq" placeholder="search ip / account / type…" oninput="debounced()">
    <button class="ghost" onclick="setFq('page_visit')" title="website visits by IP">visits</button>
    <button class="ghost" onclick="setFq('')" title="clear search">all</button>
    <label style="color:var(--muted);font-size:12px"><input type="checkbox" id="auto" checked> auto-refresh</label>
    <button class="ghost" onclick="load()">refresh</button>
  </div>
  <div class="panel"><h2>Events (live — most recent)</h2><table><thead><tr><th>time</th><th>lvl</th><th>type</th><th>ip</th><th>player</th><th>detail</th><th></th></tr></thead><tbody id="rows"></tbody></table><div id="noev" class="empty" hidden>No events yet — quiet in the town.</div></div>
  <div class="panel"><h2>Traffic by IP — who's who</h2>
    <div class="sub" style="padding:0 14px 6px;margin:0">Site visits + game joins grouped by IP. Your own IP repeats across many pages and days (that's you/dev); a one-off visit carrying a reddit/browsergaming source is an organic visitor. A load test that hits the WebSocket directly never loads a page, so it shows only under game joins (deduped), never under site visits.</div>
    <div class="banform">
      <select id="ipdays" onchange="loadIps()"><option value="7">last 7 days</option><option value="30" selected>last 30 days</option><option value="90">last 90 days</option></select>
      <button class="ghost" onclick="loadIps()">reload</button>
      <span id="ipsummary" class="sub" style="margin:0"></span>
    </div>
    <table><thead><tr><th>ip</th><th>site visits</th><th>game joins</th><th>pages</th><th>source</th><th>device</th><th>first seen</th><th>last seen</th></tr></thead><tbody id="iprows"></tbody></table>
    <div id="noips" class="empty">No IP activity recorded yet.</div>
  </div>
  <div class="panel"><h2>Logs by day — full history on disk</h2>
    <div class="banform">
      <select id="logday" onchange="loadDay()"><option value="">— pick a day —</option></select>
      <select id="dlevel" onchange="loadDay()"><option value="all">all levels</option><option value="alert">alerts</option><option value="warn">warnings</option><option value="info">info</option></select>
      <input id="dq" placeholder="search this day…" style="flex:1;min-width:120px" oninput="debouncedDay()">
      <a id="dayraw" class="ghost" style="display:none;text-decoration:none;padding:8px 12px" href="#">⬇ raw .jsonl</a>
    </div>
    <div id="daymeta" class="sub" style="padding:0 14px 6px;margin:0"></div>
    <table><thead><tr><th>time</th><th>lvl</th><th>type</th><th>ip</th><th>player</th><th>detail</th></tr></thead><tbody id="dayrows"></tbody></table>
    <div id="noday" class="empty">Pick a day above to review its logs.</div>
  </div>
  <div class="panel"><h2>Active bans &amp; mutes</h2><tbody></tbody><table><tbody id="banrows"></tbody></table><div id="noban" class="empty" hidden>No bans.</div>
    <div class="banform">
      <select id="bt"><option value="account">account</option><option value="ip">ip</option></select>
      <input id="bv" placeholder="username or ip">
      <select id="bk"><option value="ban">ban (block)</option><option value="mute">mute (chat)</option></select>
      <input id="bh" type="number" placeholder="hours (blank=forever)" style="width:160px">
      <input id="br" placeholder="reason" style="flex:1;min-width:120px">
      <button onclick="doBan()">apply</button>
    </div>
  </div>
  <div class="panel">
    <h2>Images posted — metadata only (no image is ever shown here)</h2>
    <div class="banform">
      <input id="imgacct" placeholder="filter by account (blank = all)" style="flex:1;min-width:140px">
      <button class="ghost" onclick="loadImages()">load</button>
      <button onclick="report()">⬇ generate evidence report</button>
    </div>
    <table><thead><tr><th>time</th><th>account</th><th>ip</th><th>surface</th><th>size</th><th>sha-256</th><th></th></tr></thead><tbody id="imgrows"></tbody></table>
    <div id="noimg" class="empty">No images recorded yet.</div>
    <div class="sub" style="padding:10px 14px 14px;margin:0">Preserved files are stored un-rendered on the server and are never served to the browser. Use the report button to produce a plain-text dossier for an authority; hand them the named file directly on request.</div>
  </div>
</div>
<script>
let KEY=localStorage.getItem('tr_admin_key')||'';
function hdr(){return{'x-admin-key':KEY,'content-type':'application/json'}}
async function api(p,opt){const r=await fetch('/api/admin/'+p,Object.assign({headers:hdr()},opt||{}));if(r.status===401||r.status===503){throw new Error('auth');}return r.json();}
function saveKey(){KEY=document.getElementById('key').value.trim();localStorage.setItem('tr_admin_key',KEY);start();}
function logout(){localStorage.removeItem('tr_admin_key');location.reload();}
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function when(ts){const d=new Date(ts);return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});}
// Clickable identity cells → open a player's full timeline. The "who" cell
// shows the account for a logged-in player, else the character name a guest
// chose (kept on the entry / in detail) scoped to their IP, so clicking the
// name we attached to joins/leaves pulls up everything that player did.
function ipCell(e){return e.ip?'<a class="act" href="/admin/player?ip='+encodeURIComponent(e.ip)+'">'+esc(e.ip)+'</a>':'';}
function whoCell(e){var nm=e.name||(e.detail&&e.detail.name)||'';if(e.account)return '<a class="act" href="/admin/player?account='+encodeURIComponent(e.account)+'">'+esc(e.account)+'</a>';if(nm&&e.ip)return '<a class="act" href="/admin/player?ip='+encodeURIComponent(e.ip)+'&name='+encodeURIComponent(nm)+'">'+esc(nm)+'</a>';return esc(nm);}
let T;function debounced(){clearTimeout(T);T=setTimeout(load,300);}
function setFq(v){document.getElementById('fq').value=v;load();}
async function start(){try{await load();document.getElementById('gate').hidden=true;document.getElementById('app').hidden=false;try{await loadImages();}catch(e){}try{await loadIps();}catch(e){}}catch(e){document.getElementById('gerr').textContent='Wrong key, or admin console is disabled on the server.';}}
async function load(){
  const level=document.getElementById('flevel').value,q=document.getElementById('fq').value;
  const s=await api('stats');
  document.getElementById('tiles').innerHTML=[
    ['events (recent)',s.total],['alerts',s.byLevel.alert||0],['warnings',s.byLevel.warn||0],
    ['online',(s.online||[]).length],['active bans',(s.bans||[]).length]
  ].map(([k,n],i)=>'<div class="tile"><div class="k">'+k+'</div><div class="n" style="color:'+(i==1&&n?'var(--alert)':i==2&&n?'var(--warn)':'var(--ink)')+'">'+n+'</div></div>').join('');
  const acc=s.accounts||{};
  document.getElementById('ptiles').innerHTML=[
    ['unique players · all-time',acc.total==null?'—':acc.total],
    ['new · 24h',acc.new24h==null?'—':acc.new24h],
    ['new · 7d',acc.new7d==null?'—':acc.new7d],
    ['new · 30d',acc.new30d==null?'—':acc.new30d]
  ].map(([k,n])=>'<div class="tile"><div class="k">'+k+'</div><div class="n">'+n+'</div></div>').join('');
  loadLogDays();
  const banrows=(s.bans||[]).map(b=>'<tr><td><span class="pill '+(b.kind==='mute'?'lv-warn':'lv-alert')+'">'+b.kind+'</span></td><td class="mono">'+esc(b.target)+':'+esc(b.value)+'</td><td class="det">'+esc(b.reason||'')+(b.until?' · until '+when(b.until):' · permanent')+'</td><td><a class="act" onclick="unban(\\''+b.target+'\\',\\''+esc(b.value)+'\\')">lift</a></td></tr>').join('');
  document.getElementById('banrows').innerHTML=banrows;document.getElementById('noban').hidden=!!banrows;
  const d=await api('events?n=300&level='+level+'&q='+encodeURIComponent(q));
  const rows=(d.events||[]).map(e=>'<tr><td class="mono">'+when(e.ts)+'</td><td><span class="pill lv-'+e.level+'">'+e.level+'</span></td><td class="mono">'+esc(e.type)+'</td><td class="mono">'+ipCell(e)+'</td><td>'+whoCell(e)+'</td><td class="det">'+esc(JSON.stringify(e.detail))+'</td><td>'+(e.ip?'<a class="act" onclick="quickban(\\'ip\\',\\''+esc(e.ip)+'\\')">ban ip</a>':'')+(e.account?' <a class="act" onclick="quickban(\\'account\\',\\''+esc(e.account)+'\\')">ban</a>':'')+'</td></tr>').join('');
  document.getElementById('rows').innerHTML=rows;document.getElementById('noev').hidden=!!rows;
}
async function doBan(){await api('ban',{method:'POST',body:JSON.stringify({target:document.getElementById('bt').value,value:document.getElementById('bv').value,kind:document.getElementById('bk').value,hours:document.getElementById('bh').value,reason:document.getElementById('br').value})});document.getElementById('bv').value='';document.getElementById('br').value='';load();}
async function quickban(t,v){if(confirm('Ban '+t+' '+v+'?')){await api('ban',{method:'POST',body:JSON.stringify({target:t,value:v,kind:'ban'})});load();}}
async function unban(t,v){await api('unban',{method:'POST',body:JSON.stringify({target:t,value:v})});load();}
async function loadImages(){
  const acct=document.getElementById('imgacct').value.trim();
  const d=await api('images?n=300'+(acct?'&account='+encodeURIComponent(acct):''));
  const rows=(d.images||[]).map(r=>'<tr><td class="mono">'+when(r.ts)+'</td><td>'+esc(r.account||'<span class="det">guest</span>')+'</td><td class="mono">'+esc(r.ip||'')+'</td><td class="mono">'+esc(r.surface)+'</td><td class="mono">'+(r.bytes||0)+'</td><td class="mono" style="word-break:break-all">'+esc(r.sha)+'</td><td><a class="act" onclick="report(\\''+esc(r.sha)+'\\')">report</a></td></tr>').join('');
  document.getElementById('imgrows').innerHTML=rows;document.getElementById('noimg').hidden=!!rows;
}
async function report(sha){
  const acct=document.getElementById('imgacct').value.trim();
  const qs=sha?('sha='+encodeURIComponent(sha)):(acct?('account='+encodeURIComponent(acct)):'');
  const r=await fetch('/api/admin/report?key='+encodeURIComponent(KEY)+(qs?'&'+qs:''));
  if(!r.ok){alert('Could not generate report.');return;}
  const blob=await r.blob();const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download=(r.headers.get('content-disposition')||'').match(/filename="?([^"]+)"?/)?.[1]||'thornreach-evidence.txt';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function fmtBytes(b){b=Number(b)||0;if(b<1024)return b+' B';if(b<1048576)return (b/1024).toFixed(1)+' KB';return (b/1048576).toFixed(1)+' MB';}
function whenFull(ts){const d=new Date(ts);return d.toLocaleString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});}
async function loadLogDays(){
  try{
    const d=await api('logdays');const sel=document.getElementById('logday');const cur=sel.value;
    sel.innerHTML='<option value="">— pick a day —</option>'+(d.days||[]).map(x=>'<option value="'+x.date+'">'+x.date+'  ('+fmtBytes(x.bytes)+')</option>').join('');
    if(cur)sel.value=cur;
  }catch(e){}
}
async function loadIps(){
  let d; try{ d=await api('ip-breakdown?days='+(document.getElementById('ipdays').value||'30')); }catch(e){ return; }
  const rows=d.rows||[];
  document.getElementById('ipsummary').textContent=rows.length+' distinct IPs'+(d.cappedDays?' · note: some high-volume days were truncated':'');
  const body=rows.map(function(r){
    const src=(r.refs||[]).filter(function(x){return x&&x!=='direct';});
    const srcTxt=src.length?src.join(', '):((r.refs||[]).indexOf('direct')>=0?'direct':'');
    return '<tr><td class="mono">'+esc(r.ip)+'</td><td>'+r.visits+'</td><td>'+r.joins+'</td><td class="det">'+esc((r.pages||[]).join(', '))+'</td><td>'+esc(srcTxt)+'</td><td>'+esc((r.devices||[]).join('/'))+'</td><td class="mono">'+(r.first?whenFull(r.first):'')+'</td><td class="mono">'+(r.last?whenFull(r.last):'')+'</td></tr>';
  }).join('');
  document.getElementById('iprows').innerHTML=body;
  document.getElementById('noips').hidden=!!body;
}
let DT;function debouncedDay(){clearTimeout(DT);DT=setTimeout(loadDay,300);}
async function loadDay(){
  const date=document.getElementById('logday').value,raw=document.getElementById('dayraw');
  if(!date){document.getElementById('dayrows').innerHTML='';document.getElementById('noday').hidden=false;document.getElementById('daymeta').textContent='';raw.style.display='none';return;}
  const level=document.getElementById('dlevel').value,q=document.getElementById('dq').value;
  const d=await api('logday?date='+encodeURIComponent(date)+'&level='+level+'&q='+encodeURIComponent(q)+'&n=2000');
  const rows=(d.events||[]).map(e=>'<tr><td class="mono">'+whenFull(e.ts)+'</td><td><span class="pill lv-'+e.level+'">'+e.level+'</span></td><td class="mono">'+esc(e.type)+'</td><td class="mono">'+ipCell(e)+'</td><td>'+whoCell(e)+'</td><td class="det">'+esc(JSON.stringify(e.detail))+'</td></tr>').join('');
  document.getElementById('dayrows').innerHTML=rows;document.getElementById('noday').hidden=true;
  document.getElementById('daymeta').textContent=d.missing?('No log file for '+date+'.'):('showing '+(d.shown||0)+' of '+(d.total||0)+' matching events'+((d.total||0)>(d.shown||0)?' (capped — narrow with search)':''));
  raw.style.display='inline-block';raw.href='/api/admin/logday?download=1&date='+encodeURIComponent(date)+'&key='+encodeURIComponent(KEY);
}
setInterval(()=>{if(!document.getElementById('app').hidden&&document.getElementById('auto').checked)load();},5000);
if(KEY)start();
</script></body></html>`;

// Per-player timeline — one identity's whole story from the security log, with
// the in-game location of each event where it was captured. Opened by clicking
// an IP or player name in the Watch; shares the same key gate (tr_admin_key).
const PLAYER_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Player — Thornreach</title>
<style>
:root{--bg:#120d26;--panel:#1b1436;--line:#2c2350;--ink:#ece7f7;--muted:#9c93c2;--teal:#63dee6;--mint:#86efac;--gold:#d8b45a;--warn:#e0b45c;--alert:#f0736f}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(130% 120% at 50% 0%,#201a3c,#0c0a1c);color:var(--ink);font:14px/1.5 "Segoe UI",system-ui,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:22px 16px 60px}
h1{font-family:"Cinzel Decorative",Georgia,serif;font-size:23px;letter-spacing:.04em;margin:0 0 2px}
.sub{color:var(--muted);font-size:12.5px;margin-bottom:16px}
a.act{color:var(--teal);cursor:pointer;text-decoration:underline}
.gate{max-width:360px;margin:12vh auto;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:26px;text-align:center}
.gate input{width:100%;margin:12px 0;padding:11px 12px;border-radius:9px;border:1px solid var(--line);background:#0f0b22;color:var(--ink);font-size:15px}
button{cursor:pointer;border:0;border-radius:9px;padding:9px 15px;font-weight:600;color:#15102a;background:linear-gradient(90deg,#b096fc,#63dee6,#86efac)}
button.ghost{background:transparent;color:var(--muted);border:1px solid var(--line);font-weight:500}
.chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:4px 0 14px}
.chip{background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:3px 11px;font:600 12px/1.5 "JetBrains Mono",monospace;color:var(--teal)}
.chip b{color:var(--muted);font-weight:500;margin-right:5px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
.bar select,.bar input{padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:#0f0b22;color:var(--ink)}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:500;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
td.mono,.mono{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font:600 11px/1.6 "JetBrains Mono",monospace;border:1px solid currentColor}
.lv-info{color:var(--teal)}.lv-warn{color:var(--warn)}.lv-alert{color:var(--alert)}
.where{color:var(--mint);font-family:"JetBrains Mono",monospace;font-size:12px;white-space:nowrap}
.det{color:var(--muted);font-family:"JetBrains Mono",monospace;font-size:11.5px;word-break:break-word}
.daycut td{background:#160f30;color:var(--gold);font:600 11px/1.5 "JetBrains Mono",monospace;letter-spacing:.05em;border-top:1px solid var(--line)}
.empty{color:var(--muted);padding:20px 14px;text-align:center}
</style></head><body>
<div id="gate" class="gate">
  <h1>Thornreach</h1><div class="sub">Player timeline — admin key required</div>
  <input id="key" type="password" placeholder="ADMIN_KEY" autofocus>
  <button onclick="saveKey()">Enter</button>
  <div id="gerr" style="color:var(--alert);font-size:12px;margin-top:10px"></div>
</div>
<div id="app" class="wrap" hidden>
  <div class="sub"><a class="act" href="/admin">← The Watch</a></div>
  <h1 id="title">Player timeline</h1>
  <div class="chips" id="idchips"></div>
  <div class="bar">
    <select id="days" onchange="load()">
      <option value="1">today</option><option value="7">last 7 days</option>
      <option value="14" selected>last 14 days</option><option value="30">last 30 days</option>
      <option value="90">last 90 days</option><option value="180">last 180 days</option>
    </select>
    <button class="ghost" onclick="load()">refresh</button>
    <span id="summary" class="sub" style="margin:0"></span>
    <span style="flex:1"></span>
    <button class="ghost" id="banBtn" onclick="banPlayer()" style="color:var(--alert);border-color:var(--alert)">ban this player</button>
  </div>
  <div class="panel"><table><thead><tr><th>when</th><th>lvl</th><th>event</th><th>where</th><th>detail</th></tr></thead><tbody id="rows"></tbody></table>
    <div id="none" class="empty" hidden>Nothing logged for this player in the window.</div>
  </div>
  <div class="sub" style="margin-top:14px">The security log keeps notable events — joins & leaves, flags like out-of-range strikes or locked-room probes, chat blocks, purchases, logins — not every footstep. "Where" is the in-game room and (x,y) captured at the moment, when the event records one.</div>
</div>
<script>
var KEY=localStorage.getItem('tr_admin_key')||'';
var Q=new URLSearchParams(location.search);
var ID={account:Q.get('account')||'',ip:Q.get('ip')||'',name:Q.get('name')||''};
if(Q.get('days'))document.getElementById('days').value=Q.get('days');
function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
function hdr(){return{'x-admin-key':KEY,'content-type':'application/json'};}
function saveKey(){KEY=document.getElementById('key').value.trim();localStorage.setItem('tr_admin_key',KEY);start();}
function whenFull(ts){var d=new Date(ts);return d.toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function dayKey(ts){var d=new Date(ts);return d.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric',year:'numeric'});}
function whereOf(e){var d=e.detail||{};var b=[];if(d.room)b.push(esc(d.room));if(d.x!=null&&d.y!=null)b.push('('+d.x+', '+d.y+')');if(d.instance==='coven')b.push('· coven');return b.join(' ');}
// The chosen name rides on the entry or (for the flagged events) inside detail.
function nameOf(e){return e.name||(e.detail&&e.detail.name)||'';}
function qs(){var p=[];if(ID.account)p.push('account='+encodeURIComponent(ID.account));if(ID.ip)p.push('ip='+encodeURIComponent(ID.ip));if(ID.name)p.push('name='+encodeURIComponent(ID.name));p.push('days='+document.getElementById('days').value);return p.join('&');}
function start(){load().then(function(){document.getElementById('gate').hidden=true;document.getElementById('app').hidden=false;}).catch(function(){document.getElementById('gerr').textContent='Wrong key, or admin console is disabled on the server.';});}
function load(){
  return fetch('/api/admin/player?'+qs(),{headers:hdr()}).then(function(r){if(r.status===401||r.status===503)throw new Error('auth');return r.json();}).then(function(d){
    var id=d.identity||{};
    document.getElementById('title').textContent='Timeline — '+(id.display||'player');
    var chips=[];
    if(id.account)chips.push('<span class="chip"><b>account</b>'+esc(id.account)+'</span>');
    if(id.name)chips.push('<span class="chip"><b>name</b>'+esc(id.name)+'</span>');
    if(id.ip)chips.push('<span class="chip"><b>ip</b>'+esc(id.ip)+'</span>');
    document.getElementById('idchips').innerHTML=chips.join('');
    document.getElementById('summary').textContent=(d.shown||0)+' of '+(d.total||0)+' events'+(d.cappedDays?' · some days truncated':'');
    document.getElementById('banBtn').style.display=(id.account||id.ip)?'':'none';
    var ev=d.events||[],html='',lastDay='';
    for(var i=0;i<ev.length;i++){var e=ev[i];var dk=dayKey(e.ts);
      if(dk!==lastDay){lastDay=dk;html+='<tr class="daycut"><td colspan="5">'+esc(dk)+'</td></tr>';}
      var nm=nameOf(e);var det=Object.assign({},e.detail||{});delete det.room;delete det.x;delete det.y;delete det.instance;
      var detStr=Object.keys(det).length?JSON.stringify(det):'';
      html+='<tr><td class="mono">'+whenFull(e.ts)+'</td><td><span class="pill lv-'+e.level+'">'+e.level+'</span></td><td class="mono">'+esc(e.type)+(nm&&!ID.account?' <span style="color:var(--muted)">'+esc(nm)+'</span>':'')+'</td><td class="where">'+whereOf(e)+'</td><td class="det">'+esc(detStr)+'</td></tr>';
    }
    document.getElementById('rows').innerHTML=html;document.getElementById('none').hidden=!!ev.length;
  });
}
function banPlayer(){
  var t=ID.account?'account':'ip',v=ID.account||ID.ip;
  if(!v)return;
  if(!confirm('Ban '+t+' '+v+'? They will be blocked from the game.'))return;
  fetch('/api/admin/ban',{method:'POST',headers:hdr(),body:JSON.stringify({target:t,value:v,kind:'ban',reason:'from timeline'})}).then(function(r){return r.json();}).then(function(){alert('Banned '+t+' '+v+'.');}).catch(function(){alert('Ban failed — check the key.');});
}
if(KEY)start();
</script></body></html>`;

// Standalone analytics dashboard (privacy-respecting, aggregate-only). Same
// key gate as /admin (shares the tr_admin_key in localStorage).
const ANALYTICS_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Analytics — Thornreach</title>
<style>
:root{--bg:#0b0716;--card:#16102a;--ink:#e9ddff;--mut:#9b8fc0;--mut2:#7d719e;--violet:#b98aff;--teal:#7ef0c3;--gold:#e8d9a8;--line:rgba(185,138,255,0.16)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,Segoe UI,Arial,sans-serif;padding:20px;max-width:1040px;margin:0 auto}
.coin{display:inline-block;width:0.92em;height:0.92em;border-radius:50%;background:radial-gradient(circle at 36% 30%,#fff3b0,#ffd85a 34%,#eab12a 66%,#b07d12);box-shadow:inset 0 0 0 1.4px rgba(120,86,12,0.9),inset 1px 1px 2px rgba(255,248,210,0.6);vertical-align:-0.11em}
h1{font-size:22px;margin:0 0 2px}.sub{color:var(--mut2);font-size:12px;margin-bottom:18px}
a{color:var(--teal)}
.gate{max-width:360px;margin:60px auto;text-align:center}
input{background:#0e0a1c;border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:9px 12px;width:100%;font-size:14px}
button{background:linear-gradient(90deg,#a678f0,#5ee7c0);color:#0b0713;border:none;border-radius:8px;padding:9px 16px;font-weight:800;cursor:pointer;margin-top:10px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:22px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.tile .n{font-size:26px;font-weight:800;color:#f1e9ff}.tile .k{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--mut2);margin-top:3px}
.tile .n.good{color:var(--teal)}.tile .n.gold{color:var(--gold)}.tile .n.bad{color:#ff8a8a}
.cerr .ln.e-error{border-left:2px solid #ff8a8a;padding-left:6px}
.cerr .ek{font-weight:700;color:#ff8a8a}.cerr .ed{color:var(--mut2);font-size:11px;margin-left:6px}
.cerr .em{color:var(--ink)}.cerr .es{color:var(--mut2);font-size:11px}
h2{font-size:13px;letter-spacing:1.2px;text-transform:uppercase;color:var(--violet);margin:26px 0 12px}
.row{display:flex;align-items:center;gap:10px;margin:5px 0;font-size:13px}
.row .lbl{width:150px;color:var(--mut);flex:0 0 auto}
.row .bar{flex:1;height:16px;background:#0e0a1c;border-radius:6px;overflow:hidden}
.row .bar span{display:block;height:100%;background:linear-gradient(90deg,#a678f0,#5ee7c0)}
.row .v{width:60px;text-align:right;color:#f1e9ff;font-weight:700}
.funnel .row .bar span{background:linear-gradient(90deg,#8de8c8,#5ee7c0)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{text-align:right;padding:6px 8px;border-bottom:1px solid var(--line)}th:first-child,td:first-child{text-align:left;color:var(--mut)}
th{color:var(--mut2);font-weight:600;letter-spacing:.5px}
.err{color:#ff9b9b;margin-top:10px}.muted{color:var(--mut2);font-size:12px}
.wchat-wrap{margin-bottom:22px}
.wrow{display:flex;gap:14px;align-items:stretch}
.wcol-chat{flex:1;min-width:0}
.wcol-online{width:220px;flex:0 0 auto;display:flex;flex-direction:column}
.wonline-hd{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--mut2);margin:0 0 6px}
.wroster{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 10px;height:220px;overflow-y:auto;font-size:12.5px;display:flex;flex-direction:column;gap:2px}
.wroster .pl{padding:5px 0;border-bottom:1px solid rgba(185,138,255,0.08)}
.wroster .pl:last-child{border-bottom:none}
.wroster .pn{font-weight:700;color:#f1e9ff}
.wroster .pm{color:var(--mut2);font-size:11px;margin-top:1px}
.wroster .tag{font-size:9px;letter-spacing:.4px;text-transform:uppercase;padding:1px 6px;border-radius:8px;background:#1b1430;color:var(--mut2);margin-left:6px}
.wroster .tag.acct{color:var(--teal)}
@media (max-width:720px){.wrow{flex-direction:column}.wcol-online{width:auto}.wroster{height:150px}}
.wonline{font-size:11px;color:var(--mut2);letter-spacing:.5px;text-transform:none;margin-left:8px;font-weight:600}
.wchat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;height:220px;overflow-y:auto;font-size:13px;display:flex;flex-direction:column;gap:4px}
.wchat .ln{line-height:1.4}
.wchat .nm{font-weight:700;color:var(--violet)}
.wchat .ln.host .nm{color:var(--gold)}
.wchat .tx{color:var(--ink)}
.wchat .tm{color:var(--mut2);font-size:11px;margin-left:6px}
.afl .ic{margin-right:6px}
.afl.list .nm{color:var(--violet)}
.afl.bid .nm{color:var(--gold)}
.afl.sold .nm{color:var(--teal)}
.afl.expired{opacity:.72}
.afl.expired .nm{color:var(--mut2)}
.afl .aflhead{line-height:1.4}
.itemcard{display:flex;gap:10px;align-items:flex-start;margin:6px 0 2px 22px;padding:8px 11px;background:rgba(140,90,255,0.06);border:1px solid var(--line);border-radius:10px;max-width:460px}
.itemcard .ich{font-size:22px;line-height:1;flex:0 0 auto}
.itemcard .inm{font-weight:700;color:#f1e9ff;font-size:13.5px}
.itemcard .islot{font-weight:600;color:var(--mut2);font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-left:6px}
.itemcard .istats{margin-top:3px;display:flex;flex-wrap:wrap;gap:4px 12px}
.itemcard .istats span{color:#d9cdf0;font-size:11.5px}
.itemcard .idesc{margin-top:3px;color:var(--mut);font-size:11.5px;font-style:italic}
.itemcard .iplain{color:var(--mut2);font-size:11.5px;margin-top:2px}
.itemcard .afimg{width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid var(--line);flex:0 0 auto;background:#0b0716;cursor:zoom-in}
.itemcard .afimg:hover{border-color:var(--violet)}
.itemcard .afaudio{margin-top:5px;height:30px;max-width:230px}
.wsay-row{display:flex;gap:8px;margin-top:10px}
.wsay-row input{flex:1}
.wsay-row button{margin-top:0;white-space:nowrap}
.note{color:var(--teal);font-size:12px;min-height:16px;margin-top:6px}
</style></head><body>
<div id="gate" class="gate" hidden><h1>Analytics</h1><p class="muted">Enter the admin key.</p><input id="key" type="password" placeholder="ADMIN_KEY"><button onclick="saveKey()">View</button><div class="err" id="gerr"></div></div>
<div id="app" hidden>
  <h1>Thornreach — Analytics</h1>
  <div class="sub">Anonymous, aggregate only · <a href="/admin">security console</a> · <span id="range"></span> · window
    <select id="winDays" onchange="onAnalyticsWindow(this.value)" style="background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:2px 6px;margin-left:4px">
      <option value="30">last 30 days</option><option value="90">last 90 days</option><option value="180">last 6 months</option><option value="365">last year</option><option value="1825">all time</option>
    </select></div>
  <div class="tiles" id="tiles"></div>
  <h2>Growth funnel (this window)</h2><div class="sub" style="margin:0 0 8px">Each stage and how many carried through from the one above — where people drop off on the way from a first visit to a returning player. "vs top" is the share of landing visitors who reached that stage.</div><div id="gfunnel"></div>
  <h2>Funnel by device (this window)</h2><div class="sub" style="margin:0 0 8px">The same journey split mobile vs desktop — if one platform converts far worse at a stage, that's where to look. "conv" is carry-through from the stage above.</div><div id="devfunnel"></div>
  <h2>Source quality (this window)</h2><div class="sub" style="margin:0 0 8px">Not just how many visits each traffic source sends, but how many of those visitors actually sign up — first-touch attributed. A source that sends few but converts well beats a firehose of bouncers. Tag your links with ?src= (reddit, browsergaming, qr, …).</div><div id="srcconv"></div>
  <h2>Virality (this window)</h2><div class="sub" style="margin:0 0 8px">How much the game spreads on its own — coven invites extended and accepted, and the shared player/coven links people actually open.</div><div id="virality"></div>
  <h2>Geography (this window)</h2><div class="sub" style="margin:0 0 8px">Where visitors and signups come from, by country — coarse (country-level, no IPs stored). "Unknown" means no CDN country header and no offline match. Tells you which regions to court and when your live windows should be.</div><div id="geo"></div>
  <h2>A/B tests (this window)</h2><div class="sub" style="margin:0 0 8px">Running experiments: each variant's exposures, signups and conversion. The best-converting variant is flagged once there's enough traffic to tell. Define tests server-side in lib/ab.js.</div><div id="abtests"></div>
  <h2>📈 Monthly trends (all time)</h2>
  <div class="sub" style="margin:0 0 8px">Daily counters rolled up per calendar month, oldest → newest — so trends reveal themselves over the game's life. (The window selector above only changes the rolling sections below; these are always all-time.)</div>
  <div class="sub" style="margin:10px 0 4px">🆕 New accounts by month</div><div id="mAccounts"></div>
  <div class="sub" style="margin:10px 0 4px">💎 Moonstone pack revenue by month (US$)</div><div id="mRevenue"></div>
  <div class="sub" style="margin:10px 0 4px">🌐 Peak on site by month (everyone on the site)</div><div id="mOnSite"></div>
  <div class="sub" style="margin:10px 0 4px">👥 Peak concurrent by month (in game)</div><div id="mPeak"></div>
  <div class="sub" style="margin:10px 0 4px">↪️ Landing → Play % by month (did visitors start the game)</div><div id="mLandPlay"></div>
  <div class="sub" style="margin:10px 0 4px">📝 Visit → Signup % by month (did visitors make an account)</div><div id="mSignup"></div>
  <div class="sub" style="margin:10px 0 4px">🕸️ Covens founded by month</div><div id="mCovens"></div>
  <div class="sub" style="margin:10px 0 4px">💎 Moonstones spent in-game by month</div><div id="mMsSpent"></div>
  <div class="sub" style="margin:10px 0 4px"><span class="coin"></span> Gold spent by month</div><div id="mGoldSpent"></div>
  <div class="wchat-wrap">
    <h2 style="margin-top:4px">World chat — live<span id="wonline" class="wonline"></span></h2>
    <div class="wrow">
      <div class="wcol-chat">
        <div id="wchat" class="wchat"><div class="muted">Loading…</div></div>
        <div class="wsay-row">
          <input id="wsay" maxlength="240" placeholder="Greet the world as the host…" autocomplete="off">
          <button id="wsend" type="button" onclick="sendSay()">Send</button>
        </div>
        <div class="note" id="wnote"></div>
      </div>
      <div class="wcol-online">
        <div class="wonline-hd">Who's online</div>
        <div id="wroster" class="wroster"><div class="muted">—</div></div>
      </div>
    </div>
  </div>
  <div class="wchat-wrap">
    <h2 style="margin-top:4px"><span class="coin"></span> Auction house — live<span id="afonline" class="wonline"></span></h2>
    <div class="sub" style="margin:0 0 8px">Recent listings, bids, sales and expiries from the auction house — newest at the bottom.</div>
    <div id="afeed" class="wchat" style="height:240px"><div class="muted">Loading…</div></div>
  </div>
  <h2>💎 Moonstone packs — real revenue (last 30 days)<span id="packRev" class="wonline"></span></h2>
  <div class="sub" style="margin:0 0 8px">Real-money pack sales (Stripe + in-app), by pack. Bar value is revenue in US$.</div>
  <div id="buyPacks"></div>
  <h2>💎 Moonstone spending — top items (last 30 days)</h2>
  <div class="sub" style="margin:0 0 8px">What players spend premium 💎 on in-game (peddler legendaries, looks, dyes). Bar value is 💎 spent.</div>
  <div id="buyMs"></div>
  <h2><span class="coin"></span> Gold spending — top items (last 30 days)</h2>
  <div class="sub" style="margin:0 0 8px">In-game gold sinks: NPC-shop buys and learned recipes. Bar value is gold spent.</div>
  <div id="buyGold"></div>
  <h2><span class="coin"></span> Gold spending — by type</h2><div id="buyGoldType"></div>
  <h2>🔁 Player auctions — volume (last 30 days)<span id="aucVol" class="wonline"></span></h2>
  <div class="sub" style="margin:0 0 8px">What trades player-to-player on the auction house (gear, selfies, howls). Not your revenue — a demand signal. Bar value is gold volume; 💎-currency lots are noted in the label.</div>
  <div id="buyAuction"></div>
  <h2>Acquisition funnel (last 30 days)</h2><div class="funnel" id="funnel"></div>
  <h2>Traffic sources (last 30 days)</h2><div id="sources"></div>
  <h2>Device</h2><div id="devices"></div>
  <h2>First Steps — onboarding funnel (last 30 days)</h2><div class="funnel" id="firststeps"></div>
  <h2>Session end — onboarding drop-off (last 30 days)</h2><div class="sub" style="margin:0 0 8px">Where sessions ended for players still in the tutorial funnel — the cliff. "Completed all 4" finished it.</div><div class="funnel" id="dropoff"></div>
  <h2>Retention by signup cohort (all time)</h2><div class="sub" style="margin:0 0 8px">Each week's signups and the share still playing at least 1 / 7 / 30 days later — the "is retention improving as we ship?" view. A cell shows "—" until that cohort is old enough to measure it.</div><div id="cohorts"></div>
  <h2>Lifetime value by signup cohort</h2><div class="sub" style="margin:0 0 8px">Revenue per cohort as it matures — ARPU (per signup) and ARPPU (per payer) climb as a cohort ages, so reading down the age column is an LTV curve. From lifetime spend recorded on each account.</div><div id="ltvtable"></div>
  <div class="sub" style="margin:10px 0 4px">ARPU by cohort ($, oldest → newest)</div><div id="ltvchart"></div>
  <h2>LTV curve — revenue per user by day since signup</h2><div class="sub" style="margin:0 0 8px">Average cumulative revenue per account at each age, across accounts old enough to have reached it (non-payers counted as $0). The shape tells you how LTV accrues — mostly up front, or over time. Fills in for purchases logged from now on.</div><div id="ltvcurve"></div>
  <h2>Retention — return cohorts (last 30 days)</h2><div class="sub" style="margin:0 0 8px">Of accounts that signed up, how soon they first came back. Compare with new-account counts below for a rough D1 / week-1 rate.</div><div id="retention"></div>
  <h2>Session length (last 30 days)</h2><div id="sesslen"></div>
  <h2>Arrival — was the town empty? (last 30 days)</h2><div id="arrival"></div>
  <h2>Site reach — peak on site by hour (ET)</h2><div class="sub" style="margin:0 0 8px">The most people on the whole site at once in each hour (browsing + in game), summed across the window — the full picture of when people show up, not just those who entered the game.</div><div id="oshour"></div>
  <h2>World liveness — peak concurrent by hour (ET)</h2><div class="sub" style="margin:0 0 8px">The most players online at once in each hour, summed across the window — where your live windows actually are. The flip side of the empty-world problem.</div><div id="cchour"></div>
  <h2>Sessions spent entirely alone (last 30 days)</h2><div class="sub" style="margin:0 0 8px">The true empty-world signal — whole sessions where no one else was ever online, vs sessions that overlapped with at least one other player. (join.alone above only catches the arrival instant.)</div><div id="alone"></div>
  <h2>Per-room activity — which buildings get used (last 30 days)</h2><div class="sub" style="margin:0 0 8px">Every building is its own chat room. Visits per building with the average time people linger — dead rooms to cut or merge vs the ones that work.</div><div id="rooms"></div>
  <h2>Chat engagement (last 30 days)</h2><div class="sub" style="margin:0 0 8px">Whether arrivals actually talk. Sessions that spoke vs left in silence, messages by channel, and lines sent into an empty town (world chat with no one else online).</div><div id="chateng"></div><div id="chatchan" style="margin-top:10px"></div>
  <h2>Campaign progression (last 30 days)</h2><div class="sub" style="margin:0 0 8px">How far the class campaigns carry players before they stall — whether the story you built actually gets seen — plus how much the class kits get used.</div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Furthest chapter reached (unique players)</h3><div class="funnel" id="chapfunnel"></div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Chapter completions by class</h3><div id="chapclass"></div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Ability casts by class</h3><div id="abilcast"></div>
  <h2>By device — mobile vs desktop (last 30 days)</h2><div class="sub" style="margin:0 0 8px">Session length and whether sessions spoke, split by device. Mobile is where client issues surface — shorter sessions or lower engagement there are the tell.</div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Session length — mobile</h3><div id="sessMobile"></div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Session length — desktop</h3><div id="sessDesktop"></div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Sessions that spoke, by device (%)</h3><div id="devspoke"></div>
  <h2>Landing page — dwell &amp; conversion (last 30 days)</h2><div class="sub" style="margin:0 0 8px">How long visitors linger on the landing page before heading in or leaving — time-on-page before bounce, and the real landing→play conversion (beacon-based, so OG unfurls and bots don't inflate it).</div>
  <div class="tiles" id="landtiles"></div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Time on landing page before leaving or playing</h3><div id="landdwell"></div>
  <h2>Progression milestones (last 30 days)</h2><div class="sub" style="margin:0 0 8px">Each counted once per account — the levels &amp; systems where players stick or stall.</div><div id="milestones"></div>
  <h2>Guest depth — how far guests get (last 30 days)</h2><div class="sub" style="margin:0 0 8px">What the guest wave reaches before leaving — once per guest session (not unique players). Measured against guest joins, this shows whether drop-ins get hooked.</div><div id="guestdepth"></div>
  <h2>When players are online (by hour, ET)</h2><div id="byhour"></div>
  <h2>Class choice</h2><div id="classes"></div>
  <h2>Engagement &amp; covens (last 30 days)</h2><div id="engage"></div>
  <h2>Purchases (last 30 days)</h2><div id="purch"></div>
  <h2>Client health — load time, assets &amp; crashes (last 30 days)</h2>
  <div class="sub" style="margin:0 0 8px">Time to reach a playable world, streamed models that failed to their fallback, dropped connections, and uncaught client errors. This is the signal that would have surfaced the 90%-stuck loading bug.</div>
  <div class="tiles" id="htiles"></div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Time to playable</h3><div id="ttp"></div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Asset failures (by model)</h3><div id="assetfail"></div>
  <h3 style="font-size:14px;margin:14px 0 6px;color:var(--mut)">Recent client errors</h3><div id="cerr" class="wchat" style="height:200px"></div>
  <h2>🐛 Bug reports<span id="bugCount" class="wonline"></span></h2>
  <div class="sub" style="margin:0 0 8px">Players' in-game "Report a Bug" submissions, with the context attached. Click Done to clear one.</div>
  <div id="bugList" class="wchat" style="height:260px"></div>
  <h2>Daily — new accounts &amp; active</h2><div id="daily"></div>
  <h2>Active users by day</h2><div class="sub" style="margin:0 0 8px">DAU / WAU / MAU recorded daily (accounts whose latest character was played within 1 / 7 / 30 days). These fill in from the day they started being recorded.</div>
  <div class="sub" style="margin:10px 0 4px">DAU — active within 24h</div><div id="dDau"></div>
  <div class="sub" style="margin:10px 0 4px">WAU — active within 7 days</div><div id="dWau"></div>
  <div class="sub" style="margin:10px 0 4px">MAU — active within 30 days</div><div id="dMau"></div>
  <div class="err" id="err"></div>
</div>
<script>
var KEY=localStorage.getItem('tr_admin_key')||'';
function saveKey(){KEY=document.getElementById('key').value.trim();localStorage.setItem('tr_admin_key',KEY);start();}
function esc(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;'}[c];});}
function toggleExp(name,enabled){fetch('/api/admin/ab-toggle',{method:'POST',headers:{'x-admin-key':KEY,'content-type':'application/json'},body:JSON.stringify({exp:name,enabled:enabled})}).then(function(r){return r.json();}).then(function(){start();}).catch(function(){});}
function sum(data,metric){var t=0;for(var d in data){if(data[d]&&data[d][metric])t+=data[d][metric];}return t;}
function maxOf(data,metric){var m=0;for(var d in data){if(data[d]&&data[d][metric]>m)m=data[d][metric];}return m;}
function pct(a,b){return b?Math.round(a/b*100):0;}
function sessTotal(data){return sum(data,'sess.lt1m')+sum(data,'sess.1_5m')+sum(data,'sess.5_15m')+sum(data,'sess.15_30m')+sum(data,'sess.30_60m')+sum(data,'sess.gt60m');}
function bars(el,rows,cls){var max=Math.max(1,Math.max.apply(null,rows.map(function(r){return r[1];})));
  document.getElementById(el).innerHTML=rows.map(function(r){var w=Math.round(r[1]/max*100);
    return '<div class="row"><div class="lbl">'+esc(r[0])+'</div><div class="bar"><span style="width:'+w+'%"></span></div><div class="v">'+r[1].toLocaleString()+'</div></div>';}).join('');}
function tile(n,k,cls){return '<div class="tile"><div class="n '+(cls||'')+'">'+n+'</div><div class="k">'+k+'</div></div>';}
function wago(t){var s=(Date.now()-t)/1000;if(s<60)return'now';if(s<3600)return Math.floor(s/60)+'m';if(s<86400)return Math.floor(s/3600)+'h';return Math.floor(s/86400)+'d';}
function pollChat(){
  if(!KEY||document.getElementById('app').hidden)return;
  fetch('/api/admin/worldchat?n=80',{headers:{'x-admin-key':KEY}}).then(function(r){if(r.status===401||r.status===503)throw new Error('auth');return r.json();}).then(function(d){
    var box=document.getElementById('wchat');if(!box)return;
    var near=box.scrollHeight-box.scrollTop-box.clientHeight<40;
    var ms=d.messages||[];
    document.getElementById('wonline').textContent=' \\u00b7 '+(d.online||0)+' online';
    box.innerHTML=ms.length?ms.map(function(m){
      var nm='<span class="nm"'+(m.host?'':' style="color:'+esc(m.color||'#b98aff')+'"')+'>'+esc(m.name||'?')+'</span>';
      return '<div class="ln'+(m.host?' host':'')+'">'+nm+' <span class="tx">'+esc(m.text||'')+'</span><span class="tm">'+wago(m.ts)+'</span></div>';
    }).join(''):'<div class="muted">No world chat yet.</div>';
    if(near)box.scrollTop=box.scrollHeight;
    var roster=document.getElementById('wroster');
    if(roster){
      var pls=d.players||[];
      roster.innerHTML=pls.length?pls.map(function(p){
        var tag=p.account?'<span class="tag acct">account</span>':'<span class="tag">guest</span>';
        // Disambiguator: guests can reuse any name (two "ShadowBan"s look
        // identical), so show a short session id + how long they've been on.
        var meta=[];if(p.room)meta.push(esc(p.room));if(p.id)meta.push('#'+esc(p.id));if(p.since)meta.push(wago(p.since)+' online');
        return '<div class="pl"><div class="pn">'+esc(p.name||'?')+tag+'</div>'+(meta.length?'<div class="pm">'+meta.join(' \\u00b7 ')+'</div>':'')+'</div>';
      }).join(''):'<div class="muted">No one online.</div>';
    }
  }).catch(function(){});
}
function pollAuctions(){
  if(!KEY||document.getElementById('app').hidden)return;
  fetch('/api/admin/auctionfeed?n=100',{headers:{'x-admin-key':KEY}}).then(function(r){if(r.status===401||r.status===503)throw new Error('auth');return r.json();}).then(function(d){
    var box=document.getElementById('afeed');if(!box)return;
    var near=box.scrollHeight-box.scrollTop-box.clientHeight<40;
    var evs=d.events||[];
    var ICON={list:'\\uD83C\\uDFF7\\uFE0F',bid:'\\uD83D\\uDCB0',sold:'\\u2705',expired:'\\u231B'};
    var SLOT={weapon:'Weapon',head:'Head',chest:'Chest',feet:'Feet',ring:'Ring'};
    box.innerHTML=evs.length?evs.map(function(e){
      var ic=ICON[e.kind]||'\\uD83E\\uDE99';
      var head='<div class="aflhead"><span class="ic">'+ic+'</span><span class="nm">'+esc(e.name||'?')+'</span> <span class="tx">'+esc(e.text||'')+'</span><span class="tm">'+wago(e.ts)+'</span></div>';
      var card='';
      var it=e.item;
      if(it){
        var slot=it.slot?('<span class="islot">'+esc(SLOT[it.slot]||it.slot)+'</span>'):'<span class="islot">Item</span>';
        var body='<div class="inm">'+esc(it.icon||'')+' '+esc(it.name||'')+((it.qty&&it.qty>1)?(' \\u00d7'+it.qty):'')+' '+slot+'</div>';
        if(it.stats&&it.stats.length)body+='<div class="istats">'+it.stats.map(function(s){return '<span>'+esc(s)+'</span>';}).join('')+'</div>';
        else if(!it.desc)body+='<div class="iplain">No combat stats \\u2014 a trade good.</div>';
        if(it.desc)body+='<div class="idesc">'+esc(it.desc)+'</div>';
        card='<div class="itemcard"><div class="ich">'+esc(it.icon||'\\uD83D\\uDCE6')+'</div><div class="ibody">'+body+'</div></div>';
      }
      // Selfie / howl listings — show the actual media a player sees on the block.
      var md=e.media;
      if(md){
        if(md.kind==='selfie' && typeof md.image==='string' && /^data:image\\//.test(md.image)){
          card='<div class="itemcard"><img class="afimg" alt="auctioned selfie" src="'+esc(md.image)+'"><div class="ibody"><div class="inm">\\uD83D\\uDCF8 Selfie <span class="islot">photo</span></div><div class="iplain">What bidders see on the block.</div></div></div>';
        } else if(md.kind==='voice' && typeof md.audio==='string' && /^data:audio\\//.test(md.audio)){
          card='<div class="itemcard"><div class="ich">\\uD83C\\uDFA4</div><div class="ibody"><div class="inm">Howl recording <span class="islot">audio</span></div><audio class="afaudio" controls preload="none" src="'+esc(md.audio)+'"></audio></div></div>';
        }
      }
      return '<div class="ln afl '+esc(e.kind||'list')+'">'+head+card+'</div>';
    }).join(''):'<div class="muted">No auction activity yet.</div>';
    if(near)box.scrollTop=box.scrollHeight;
  }).catch(function(){});
}
function pollTelemetry(){
  if(!KEY||document.getElementById('app').hidden)return;
  fetch('/api/admin/telemetry?n=60',{headers:{'x-admin-key':KEY}}).then(function(r){if(r.status===401||r.status===503)throw new Error('auth');return r.json();}).then(function(d){
    var box=document.getElementById('cerr');if(!box)return;
    var rows=(d.recent||[]).filter(function(e){return e.type==='error';});
    box.innerHTML=rows.length?rows.map(function(e){
      var loc=e.source?(' @ '+esc(e.source)+(e.line?(':'+e.line):'')):'';
      return '<div class="ln e-error"><span class="ek">'+esc(e.kind||'error')+'</span><span class="ed">'+esc(e.device||'')+' · '+wago(e.t)+'</span><div class="em">'+esc(e.message||'(no message)')+'</div><div class="es">'+esc((e.source?('@ '+e.source+(e.line?(':'+e.line):'')):''))+'</div></div>';
    }).join(''):'<div class="muted">No client errors reported. \\u2728</div>';
  }).catch(function(){});
}
function resolveBug(id){
  fetch('/api/admin/bug-action',{method:'POST',headers:{'x-admin-key':KEY,'content-type':'application/json'},body:JSON.stringify({id:id,status:'resolved'})}).then(function(){pollBugs();}).catch(function(){});
}
window.resolveBug=resolveBug;
function pollBugs(){
  if(!KEY||document.getElementById('app').hidden)return;
  fetch('/api/admin/bugreports?n=60&status=open',{headers:{'x-admin-key':KEY}}).then(function(r){if(r.status===401||r.status===503)throw new Error('auth');return r.json();}).then(function(d){
    var box=document.getElementById('bugList');if(!box)return;
    var c=document.getElementById('bugCount');if(c)c.textContent=d.counts?(' \\u00b7 '+d.counts.open+' open'):'';
    var rows=d.reports||[];
    box.innerHTML=rows.length?rows.map(function(b){
      var who=esc(b.name||'?')+(b.account?'':' (guest)');
      var meta=[b.room?('in '+esc(b.room)):'',b.level?('Lv '+b.level):'',esc(b.device||''),b.build?('build '+esc(b.build)):''].filter(Boolean).join(' \\u00b7 ');
      var errs=(b.errors&&b.errors.length)?('<div class="es">'+b.errors.map(function(e){return esc(e);}).join('<br>')+'</div>'):'';
      return '<div class="ln e-error"><span class="ek">'+who+'</span><span class="ed">'+wago(b.ts)+(b.ip?(' \\u00b7 '+esc(b.ip)):'')+' <a class="act" style="color:var(--teal);cursor:pointer;margin-left:6px">'+'<span onclick="resolveBug(\\''+b.id+'\\')">Done</span></a></span><div class="em">'+esc(b.text||'')+'</div><div class="es">'+esc(meta)+'</div>'+errs+'</div>';
    }).join(''):'<div class="muted">No open bug reports. \\u2728</div>';
  }).catch(function(){});
}
function sendSay(){
  var inp=document.getElementById('wsay'),t=(inp.value||'').trim();if(!t)return;
  var btn=document.getElementById('wsend');btn.disabled=true;
  fetch('/api/admin/worldsay',{method:'POST',headers:{'x-admin-key':KEY,'content-type':'application/json'},body:JSON.stringify({text:t})}).then(function(r){return r.json();}).then(function(d){
    btn.disabled=false;
    if(d&&d.ok){inp.value='';document.getElementById('wnote').textContent='Sent to the world.';pollChat();setTimeout(function(){document.getElementById('wnote').textContent='';},2000);}
    else document.getElementById('wnote').textContent=(d&&d.error)||'Could not send.';
  }).catch(function(){btn.disabled=false;document.getElementById('wnote').textContent='Could not send.';});
}
var ANALYTICS_DAYS=30;
function onAnalyticsWindow(v){ANALYTICS_DAYS=v;start();}
function start(){
  document.getElementById('gate').hidden=!!KEY; if(!KEY){document.getElementById('gate').hidden=false;document.getElementById('app').hidden=true;return;}
  fetch('/api/admin/analytics?days='+ANALYTICS_DAYS,{headers:{'x-admin-key':KEY}}).then(function(r){if(r.status===401||r.status===503)throw new Error('auth');return r.json();}).then(function(d){
    document.getElementById('gate').hidden=true;document.getElementById('app').hidden=false;
    pollChat();
    var s=d.summary||{},data=(d.snapshot&&d.snapshot.data)||{},days=(d.snapshot&&d.snapshot.days)||[];
    document.getElementById('range').textContent=days.length?('since '+days[0]):'no data yet';
    var mob=sum(data,'device.mobile'),desk=sum(data,'device.desktop');
    document.getElementById('tiles').innerHTML=[
      tile((s.totalAccounts||0).toLocaleString(),'Total accounts'),
      tile('<span class="coin"></span> '+(s.goldInEconomy||0).toLocaleString(),'Gold in economy','gold'),
      tile(((s.live&&s.live.onSite)||0).toLocaleString(),'On site now','good'),
      tile((s.onlineNow||0).toLocaleString(),'In game now','good'),
      tile(maxOf(data,'onsite').toLocaleString(),'Peak on site','good'),
      tile(maxOf(data,'concurrent').toLocaleString(),'Peak concurrent','good'),
      tile((s.activeLast7d||0).toLocaleString(),'Active 7d'),
      tile(pct(s.activeLast24h||0,s.activeLast30d||0)+'%','Stickiness (DAU/MAU)','good'),
      tile(pct(sum(data,'page.play'),sum(data,'page.landing'))+'%','Landing→Play','gold'),
      tile(pct(mob,mob+desk)+'%','Mobile share'),
      tile((s.returnRate||0)+'%','Return rate','gold'),
      tile(sum(data,'ret.next_day').toLocaleString(),'Returned next day','good'),
      tile((function(){var b=sum(data,'sess.lt1m'),t=sessTotal(data);return pct(b,t);})()+'%','Bounce (<1m)'),
      tile((function(){var a=sum(data,'sess.alone_whole'),o=sum(data,'sess.saw_others');return pct(a,a+o);})()+'%','Solo sessions',(function(){var a=sum(data,'sess.alone_whole'),o=sum(data,'sess.saw_others');return pct(a,a+o)>60?'bad':'';})()),
      tile((function(){var sp=sum(data,'sess.spoke'),si=sum(data,'sess.silent');return pct(sp,sp+si);})()+'%','Sessions that spoke','good'),
      tile((s.covens||0).toLocaleString(),'Covens'),
      tile('$'+(((s.revenue&&s.revenue.lifetimeUsd)||0)).toLocaleString(),'Lifetime revenue','gold'),
      tile(((s.revenue&&s.revenue.payerConversion)||0)+'%','Payer conversion','gold'),
      tile('$'+(((s.revenue&&s.revenue.arpuUsd)||0)),'ARPU','gold'),
      tile('$'+(((s.revenue&&s.revenue.arppuUsd)||0)),'ARPPU','gold')
    ].join('');
    // Growth funnel over the selected window: visit → play → join → signup →
    // return, each stage with carry-through from the previous and from the top.
    (function(){
      var stages=[['Landing views',sum(data,'page.landing')],['Play page opened',sum(data,'page.play')],['Joined the game',sum(data,'join')],['Signed up',sum(data,'register')],['Returned next day',sum(data,'ret.next_day')]];
      var top=stages[0][1]||stages[1][1]||1;
      var h='<table><thead><tr><th>stage</th><th>count</th><th>vs prev</th><th>vs top</th></tr></thead><tbody>';
      for(var i=0;i<stages.length;i++){var v=stages[i][1],prev=i?stages[i-1][1]:v;h+='<tr><td>'+stages[i][0]+'</td><td class="mono">'+v.toLocaleString()+'</td><td class="mono">'+(i?pct(v,prev)+'%':'—')+'</td><td class="mono">'+pct(v,top)+'%</td></tr>';}
      document.getElementById('gfunnel').innerHTML=h+'</tbody></table>';
    })();
    // Funnel by device: the stage counts split mobile vs desktop.
    (function(){
      var fs=function(stage,dev){return sum(data,stage+'.'+dev);};
      var stages=[['Landing','page.landing'],['Play page','page.play'],['Joined','join'],['Signed up','register']];
      var h='<table><thead><tr><th>stage</th><th>mobile</th><th>mob conv</th><th>desktop</th><th>desk conv</th></tr></thead><tbody>';
      for(var i=0;i<stages.length;i++){var st=stages[i][1];var m=fs(st,'mob'),d=fs(st,'desk');var pm=i?fs(stages[i-1][1],'mob'):m,pd=i?fs(stages[i-1][1],'desk'):d;h+='<tr><td>'+stages[i][0]+'</td><td class="mono">'+m.toLocaleString()+'</td><td class="mono">'+(i?pct(m,pm)+'%':'—')+'</td><td class="mono">'+d.toLocaleString()+'</td><td class="mono">'+(i?pct(d,pd)+'%':'—')+'</td></tr>';}
      document.getElementById('devfunnel').innerHTML=h+'</tbody></table>';
    })();
    // Source quality: views (ref.*) vs attributed signups (reg.src.*) per source.
    (function(){
      var views={},regs={};
      for(var day in data){var r=data[day]||{};for(var k in r){
        if(k.indexOf('ref.')===0){var a=k.slice(4);views[a]=(views[a]||0)+r[k];}
        else if(k.indexOf('reg.src.')===0){var b=k.slice(8);regs[b]=(regs[b]||0)+r[k];}
      }}
      var srcs=Object.keys(views);for(var g in regs)if(srcs.indexOf(g)<0)srcs.push(g);
      srcs.sort(function(x,y){return (views[y]||0)-(views[x]||0);});
      var h='<table><thead><tr><th>source</th><th>page views</th><th>signups</th><th>signup rate</th></tr></thead><tbody>';
      if(!srcs.length)h+='<tr><td colspan=4 class="muted">No source data yet — tag links with ?src=.</td></tr>';
      for(var i=0;i<srcs.length;i++){var s=srcs[i],v=views[s]||0,sg=regs[s]||0;h+='<tr><td>'+esc(s)+'</td><td class="mono">'+v.toLocaleString()+'</td><td class="mono">'+sg.toLocaleString()+'</td><td class="mono">'+pct(sg,v)+'%</td></tr>';}
      document.getElementById('srcconv').innerHTML=h+'</tbody></table>';
    })();
    // Virality: invites extended/accepted + shared links opened.
    (function(){
      var sent=sum(data,'invite.sent'),acc=sum(data,'invite.accepted');
      var shP=sum(data,'share.click.player'),shC=sum(data,'share.click.coven'),shT=sum(data,'share.click');
      var h='<table><thead><tr><th>signal</th><th>count</th></tr></thead><tbody>'
        +'<tr><td>Coven invites sent</td><td class="mono">'+sent.toLocaleString()+'</td></tr>'
        +'<tr><td>Coven invites accepted</td><td class="mono">'+acc.toLocaleString()+'</td></tr>'
        +'<tr><td>Invite accept rate</td><td class="mono">'+pct(acc,sent)+'%</td></tr>'
        +'<tr><td>Shared player links opened</td><td class="mono">'+shP.toLocaleString()+'</td></tr>'
        +'<tr><td>Shared coven links opened</td><td class="mono">'+shC.toLocaleString()+'</td></tr>'
        +'<tr><td>Share clicks (total)</td><td class="mono">'+shT.toLocaleString()+'</td></tr>'
        +'</tbody></table>';
      document.getElementById('virality').innerHTML=h;
    })();
    // Geography: views (geo.*) vs signups (geo.reg.*) by country. Check the
    // geo.reg. prefix first so it isn't double-counted as a plain geo. view.
    (function(){
      var views={},regs={};
      for(var day in data){var r=data[day]||{};for(var k in r){
        if(k.indexOf('geo.reg.')===0){var c=k.slice(8);regs[c]=(regs[c]||0)+r[k];}
        else if(k.indexOf('geo.')===0){var c2=k.slice(4);views[c2]=(views[c2]||0)+r[k];}
      }}
      var flag=function(cc){if(!cc||cc.length!==2||cc==='ZZ')return '🏳️';try{return String.fromCodePoint.apply(String,cc.toUpperCase().split('').map(function(ch){return 127397+ch.charCodeAt(0);}));}catch(e){return '🏳️';}};
      var ccs=Object.keys(views);for(var g in regs)if(ccs.indexOf(g)<0)ccs.push(g);
      ccs.sort(function(x,y){return (views[y]||0)-(views[x]||0);});
      var h='<table><thead><tr><th>country</th><th>page views</th><th>signups</th><th>signup rate</th></tr></thead><tbody>';
      if(!ccs.length)h+='<tr><td colspan=4 class="muted">No geo data yet.</td></tr>';
      for(var i=0;i<ccs.length && i<20;i++){var cc=ccs[i],v=views[cc]||0,sg=regs[cc]||0,nm=cc==='ZZ'?'Unknown':cc;h+='<tr><td>'+flag(cc)+' '+esc(nm)+'</td><td class="mono">'+v.toLocaleString()+'</td><td class="mono">'+sg.toLocaleString()+'</td><td class="mono">'+pct(sg,v)+'%</td></tr>';}
      document.getElementById('geo').innerHTML=h+'</tbody></table>';
    })();
    // A/B tests: authoritative experiment list + state (s.experiments) with a
    // pause/resume toggle, each variant's counters folded in from exp.* keys.
    (function(){
      var E={};
      for(var day in data){var r=data[day]||{};for(var k in r){var p=k.split('.');if(p[0]==='exp'&&p.length===4){var e=p[1],va=p[2],m=p[3];E[e]=E[e]||{};E[e][va]=E[e][va]||{view:0,signup:0};if(m==='view')E[e][va].view+=r[k];else if(m==='signup')E[e][va].signup+=r[k];}}}
      var exps=s.experiments||[],html='';
      if(!exps.length)html='<div class="muted" style="padding:6px 0">No experiments defined.</div>';
      for(var i=0;i<exps.length;i++){var ex=exps[i],e=ex.name,vs=E[e]||{},vks=ex.variants||Object.keys(vs);
        var best=-1,bestK=null;for(var j=0;j<vks.length;j++){var o=vs[vks[j]]||{view:0,signup:0};var cv=o.view?o.signup/o.view:0;if(o.view&&cv>best){best=cv;bestK=vks[j];}}
        var badge=ex.enabled?'<span style="color:var(--mint,#86efac)">● running</span>':'<span class="muted">⏸ paused</span>';
        var btn='<button style="margin-left:10px;padding:3px 10px;font-size:12px" onclick="toggleExp(\''+e+'\','+(ex.enabled?'false':'true')+')">'+(ex.enabled?'Pause':'Resume')+'</button>';
        html+='<div style="margin:8px 0 2px;font-weight:600">'+esc(e)+' '+badge+btn+'</div><table><thead><tr><th>variant</th><th>exposures</th><th>signups</th><th>conversion</th></tr></thead><tbody>';
        for(var j2=0;j2<vks.length;j2++){var va2=vks[j2],o2=vs[va2]||{view:0,signup:0};html+='<tr><td>'+esc(va2)+(va2===bestK?' <span style="color:var(--mint,#86efac)">✓ leading</span>':'')+'</td><td class="mono">'+o2.view.toLocaleString()+'</td><td class="mono">'+o2.signup.toLocaleString()+'</td><td class="mono">'+pct(o2.signup,o2.view)+'%</td></tr>';}
        html+='</tbody></table>';
      }
      document.getElementById('abtests').innerHTML=html;
    })();
    // Monthly trends (all time) — one bar per calendar month, chronological.
    var mon=s.monthly||[];
    var MNA=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    function mlab(ym){var p=String(ym).split('-');return (MNA[(+p[1])-1]||p[1])+" '"+(p[0]||'').slice(2);}
    function mbars(el,key){bars(el, mon.length?mon.map(function(m){return [mlab(m.month), m[key]||0];}):[['(no data yet)',0]]);}
    mbars('mAccounts','accounts');
    mbars('mRevenue','packRevenue');
    mbars('mOnSite','peakOnSite');
    mbars('mPeak','peakConcurrent');
    bars('mLandPlay', mon.length?mon.map(function(m){return [mlab(m.month), pct(m.play, m.landing)];}):[['(no data yet)',0]]);
    bars('mSignup', mon.length?mon.map(function(m){return [mlab(m.month), pct(m.accounts, m.landing)];}):[['(no data yet)',0]]);
    mbars('mCovens','covens');
    mbars('mMsSpent','msSpent');
    mbars('mGoldSpent','goldSpent');
    // Purchases — real-money packs (revenue), 💎 spending, and gold spending.
    var pur=s.purchases||{};
    document.getElementById('packRev').textContent=' \\u00b7 $'+((pur.packRevenue||0).toLocaleString())+' total';
    bars('buyPacks',(pur.packs&&pur.packs.length)?pur.packs.map(function(p){return [p.name+' \\u00b7 '+p.count+' sold',p.revenue];}):[['(no pack sales yet)',0]]);
    bars('buyMs',(pur.msItems&&pur.msItems.length)?pur.msItems.map(function(i){return [i.icon+' '+i.name+' \\u00b7 '+i.units+'\\u00d7',i.ms];}):[['(no 💎 spending yet)',0]]);
    bars('buyGold',(pur.goldItems&&pur.goldItems.length)?pur.goldItems.map(function(i){return [i.icon+' '+i.name+' \\u00b7 '+i.units+'\\u00d7',i.gold];}):[['(no gold spending yet)',0]]);
    bars('buyGoldType',(pur.goldTypes&&pur.goldTypes.length)?pur.goldTypes.map(function(t){return [t.type+' \\u00b7 '+t.units+' sold',t.gold];}):[['(none yet)',0]]);
    var auc=pur.auction||{};
    document.getElementById('aucVol').textContent=' \\u00b7 '+((auc.lots||0).toLocaleString())+' lots \\u00b7 '+((auc.goldVolume||0).toLocaleString())+' gold'+(auc.msVolume?(' + '+auc.msVolume.toLocaleString()+' 💎'):'');
    bars('buyAuction',(auc.items&&auc.items.length)?auc.items.map(function(i){return [i.icon+' '+i.name+' \\u00b7 '+i.lots+' lot'+(i.lots===1?'':'s')+(i.ms?(' \\u00b7 '+i.ms+'💎'):''),i.gold];}):[['(no auction sales yet)',0]]);
    bars('funnel',[['Landing views',sum(data,'page.landing')],['Play opened',sum(data,'page.play')],['Registered',sum(data,'register')],['Logged in',sum(data,'login')],['Joined (fresh)',sum(data,'join')],['— as account',sum(data,'join.account')],['— as guest',sum(data,'join.guest')]]);
    // Fold slugs to a canonical source so historic junk variants (a pasted URL
    // or stray words after the tag) merge into their root instead of showing as
    // one-off rows. Mirrors refSlug() on the server.
    // Collapse slug variants to a canonical source (e.g. playmygameplatform ->
    // playmygame). Keep in sync with server.js KNOWN_REFS.
    var KNOWN=['browsergaming','indiegaming','reddit','discord','twitter','youtube','tiktok','qr','playmygame','webgames','direct'];
    function canonRef(slug){for(var i=0;i<KNOWN.length;i++){if(slug.indexOf(KNOWN[i])===0)return KNOWN[i];}return slug;}
    var refMap={};
    ((d.snapshot&&d.snapshot.metrics)||[]).filter(function(m){return m.indexOf('ref.')===0;})
      .forEach(function(m){var k=canonRef(m.slice(4));refMap[k]=(refMap[k]||0)+sum(data,m);});
    var refs=Object.keys(refMap).map(function(k){return [k,refMap[k]];})
      .filter(function(r){return r[1]>0;}).sort(function(a,b){return b[1]-a[1];});
    bars('sources',refs.length?refs:[['(no tagged sources yet)',0]]);
    bars('devices',[['Mobile',mob],['Desktop',desk]]);
    bars('firststeps',[['Talked to a townsperson',sum(data,'fs.talked')],['Used a class ability',sum(data,'fs.ability')],['Felled a creature',sum(data,'fs.killed')],['Harvested',sum(data,'fs.harvested')],['Completed all 4',sum(data,'fs.complete')]]);
    // Onboarding drop-off: sessions that ended with N of the 4 first steps done
    // (0..3 = quit mid-tutorial), plus the ones that finished it.
    bars('dropoff',[['Quit having done nothing',sum(data,'exit.onboard0')],['Quit after 1 step',sum(data,'exit.onboard1')],['Quit after 2 steps',sum(data,'exit.onboard2')],['Quit after 3 steps',sum(data,'exit.onboard3')],['Completed all 4',sum(data,'fs.complete')]]);
    // Return cohorts vs the new accounts in the window (rough rate denominator).
    var newAcct=sum(data,'register');
    bars('retention',[['New accounts (window)',newAcct],['Returned next day (D1)',sum(data,'ret.next_day')],['Returned within week 1',sum(data,'ret.week1')],['Returned after a week+',sum(data,'ret.week2plus')]]);
    (function(){
      var coh=s.cohorts||[],cell=function(x){return x==null?'—':x+'%';};
      var h='<table><thead><tr><th>cohort week (Mon)</th><th>signups</th><th>D1</th><th>D7</th><th>D30</th></tr></thead><tbody>';
      if(!coh.length)h+='<tr><td colspan=5 class="muted">No cohorts yet.</td></tr>';
      for(var i=0;i<coh.length;i++){var c=coh[i];h+='<tr><td class="mono">'+esc(c.week)+'</td><td class="mono">'+(c.size||0).toLocaleString()+'</td><td class="mono">'+cell(c.d1)+'</td><td class="mono">'+cell(c.d7)+'</td><td class="mono">'+cell(c.d30)+'</td></tr>';}
      document.getElementById('cohorts').innerHTML=h+'</tbody></table>';
    })();
    // Lifetime value by cohort: ARPU/ARPPU table + an ARPU-by-cohort bar chart.
    (function(){
      var L=s.ltv||[];
      var h='<table><thead><tr><th>cohort (Mon)</th><th>age wks</th><th>signups</th><th>payers</th><th>payer %</th><th>revenue</th><th>ARPU</th><th>ARPPU</th></tr></thead><tbody>';
      if(!L.length)h+='<tr><td colspan=8 class="muted">No cohorts yet.</td></tr>';
      for(var i=0;i<L.length;i++){var c=L[i];h+='<tr><td class="mono">'+esc(c.week)+'</td><td class="mono">'+c.ageWeeks+'</td><td class="mono">'+c.signups+'</td><td class="mono">'+c.payers+'</td><td class="mono">'+c.payerPct+'%</td><td class="mono">$'+c.revenueUsd.toLocaleString()+'</td><td class="mono">$'+c.arpuUsd+'</td><td class="mono">$'+c.arppuUsd+'</td></tr>';}
      document.getElementById('ltvtable').innerHTML=h+'</tbody></table>';
      var chrono=L.slice().reverse();
      bars('ltvchart', chrono.length?chrono.map(function(c){return [c.week.slice(5),c.arpuUsd];}):[['(no data yet)',0]]);
      var cv=s.ltvCurve||[];
      bars('ltvcurve', cv.length?cv.map(function(p){return ['d'+p.day,p.ltvUsd];}):[['(no data yet)',0]]);
    })();
    // Session length distribution.
    bars('sesslen',[['Under 1 min',sum(data,'sess.lt1m')],['1–5 min',sum(data,'sess.1_5m')],['5–15 min',sum(data,'sess.5_15m')],['15–30 min',sum(data,'sess.15_30m')],['30–60 min',sum(data,'sess.30_60m')],['60 min+',sum(data,'sess.gt60m')]]);
    // Arrival loneliness + guest conversion in one view.
    bars('arrival',[['Joined to an empty town (alone)',sum(data,'join.alone')],['Joined with others online',sum(data,'join.withothers')],['Guest → account conversions',sum(data,'conv.guest_to_account')]]);
    // World liveness: peak concurrent by hour (ET) + whole-session solitude.
    var osHours=[];for(var oh=0;oh<24;oh++){var ohh=('0'+oh).slice(-2);osHours.push([ohh+':00',sum(data,'onsite.hour.'+ohh)]);}
    bars('oshour',osHours);
    var ccHours=[];for(var ch=0;ch<24;ch++){var chh=('0'+ch).slice(-2);ccHours.push([chh+':00',sum(data,'cc.hour.'+chh)]);}
    bars('cchour',ccHours);
    var aloneWhole=sum(data,'sess.alone_whole'),sawOthers=sum(data,'sess.saw_others');
    bars('alone',[['Alone the whole session',aloneWhole],['Shared the world with someone',sawOthers]]);
    // Per-room activity: auto-discover rooms from the room.enter.* slugs, show
    // visits with average dwell folded into the label. "Cafe", "Bank", etc.
    function prettyRoom(id){return id.replace(/_/g,' ').replace(/\\b\\w/g,function(c){return c.toUpperCase();});}
    function fmtDwell(sec){if(sec<=0)return'—';if(sec<60)return sec+'s';return Math.floor(sec/60)+'m '+(sec%60)+'s';}
    var roomRows=((d.snapshot&&d.snapshot.metrics)||[]).filter(function(m){return m.indexOf('room.enter.')===0;}).map(function(m){
      var id=m.slice('room.enter.'.length),enters=sum(data,m),visits=sum(data,'room.visit.'+id),dwell=sum(data,'room.dwellms.'+id);
      var avg=visits?Math.round(dwell/visits/1000):0;
      return [prettyRoom(id)+' · avg '+fmtDwell(avg),enters];
    }).filter(function(r){return r[1]>0;}).sort(function(a,b){return b[1]-a[1];});
    bars('rooms',roomRows.length?roomRows:[['(no room visits yet)',0]]);
    // Chat engagement: did sessions talk, through which channel, into the void?
    var spoke=sum(data,'sess.spoke'),silent=sum(data,'sess.silent'),msgs=sum(data,'chat.sent');
    bars('chateng',[['Sessions that spoke',spoke],['Sessions that stayed silent',silent],['Messages sent (all channels)',msgs],['— into an empty town (world, no one else)',sum(data,'chat.void')]]);
    bars('chatchan',[['World channel',sum(data,'chat.sent.world')],['Building rooms',sum(data,'chat.sent.room')],['Coven moots',sum(data,'chat.sent.coven')]]);
    // Campaign progression: furthest chapter reached (once-per-account milestones),
    // completions by class, and ability casts by class.
    function capw(c){return c.charAt(0).toUpperCase()+c.slice(1);}
    // Furthest chapter reached, merging accounts (mile.chapterN, once per account)
    // and guests (guest.chapterN, once per guest session) — most players are guests.
    var chapDepths={};
    ((d.snapshot&&d.snapshot.metrics)||[]).forEach(function(m){var mm=/^(?:mile|guest)\\.chapter(\\d+)$/.exec(m);if(mm){var k=parseInt(mm[1],10);chapDepths[k]=(chapDepths[k]||0)+sum(data,m);}});
    var chapFunnel=Object.keys(chapDepths).map(function(k){return [parseInt(k,10),chapDepths[k]];}).sort(function(a,b){return a[0]-b[0];}).map(function(x){return ['Reached chapter '+x[0],x[1]];});
    bars('chapfunnel',chapFunnel.length?chapFunnel:[['(no chapters completed yet)',0]]);
    var CLS2=['witch','werewolf','mystic','knight','wanderer','lich'];
    bars('chapclass',CLS2.map(function(c){return [capw(c),sum(data,'chapter.complete.'+c)];}));
    bars('abilcast',CLS2.map(function(c){return [capw(c),sum(data,'ability.cast.'+c)];}));
    // By device: session length (mobile vs desktop) + spoke rate per device.
    function sessRows(pfx){return [['Under 1 min',sum(data,pfx+'lt1m')],['1–5 min',sum(data,pfx+'1_5m')],['5–15 min',sum(data,pfx+'5_15m')],['15–30 min',sum(data,pfx+'15_30m')],['30–60 min',sum(data,pfx+'30_60m')],['60 min+',sum(data,pfx+'gt60m')]];}
    bars('sessMobile',sessRows('sess.mobile.'));
    bars('sessDesktop',sessRows('sess.desktop.'));
    var mSp=sum(data,'sess.mobile.spoke'),mSi=sum(data,'sess.mobile.silent'),dSp=sum(data,'sess.desktop.spoke'),dSi=sum(data,'sess.desktop.silent');
    bars('devspoke',[['Mobile',pct(mSp,mSp+mSi)],['Desktop',pct(dSp,dSp+dSi)]]);
    // Landing page: dwell distribution + conversion. landing.view is beacon-based.
    var lview=sum(data,'landing.view'),lplay=sum(data,'landing.play');
    var LDB=[['lt5s','Under 5s'],['5_15s','5–15s'],['15_60s','15–60s'],['gt60s','60s+']];
    var lmed='—',lacc=0;for(var li=0;li<LDB.length;li++){lacc+=sum(data,'landing.dwell.'+LDB[li][0]);if(lview&&lacc>=lview/2){lmed=LDB[li][1];break;}}
    document.getElementById('landtiles').innerHTML=[
      tile(lview.toLocaleString(),'Landing visits'),
      tile(pct(lplay,lview)+'%','Clicked Play','gold'),
      tile(lmed,'Median dwell','good')
    ].join('');
    bars('landdwell',lview?LDB.map(function(b){return [b[1],sum(data,'landing.dwell.'+b[0])];}):[['(no landing beacons yet)',0]]);
    // Progression milestones (once per account).
    bars('milestones',[['Reached level 2',sum(data,'mile.lvl2')],['Reached level 5',sum(data,'mile.lvl5')],['Reached level 10',sum(data,'mile.lvl10')],['Joined/founded a coven',sum(data,'mile.coven')],['Entered a dungeon/delve',sum(data,'mile.delve')],['Crafted something',sum(data,'mile.craft')]]);
    // Guest depth: how far guests get per session, against the guest-join count.
    bars('guestdepth',[['Guest joins',sum(data,'join.guest')],['Reached level 2',sum(data,'guest.lvl2')],['Reached level 5',sum(data,'guest.lvl5')],['Reached level 10',sum(data,'guest.lvl10')],['Entered a dungeon/delve',sum(data,'guest.delve')],['Crafted something',sum(data,'guest.craft')]]);
    // When players are online, by hour in the owner's timezone (ET).
    var hours=[];for(var h=0;h<24;h++){var hh=('0'+h).slice(-2);hours.push([hh+':00',sum(data,'hour.'+hh)]);}
    bars('byhour',hours);
    var CLS=['witch','werewolf','mystic','knight','wanderer','lich'];
    bars('classes',CLS.map(function(c){return [c.charAt(0).toUpperCase()+c.slice(1),sum(data,'class.'+c)];}));
    bars('engage',[['Covens founded',sum(data,'coven.found')],['Coven joins',sum(data,'coven.join')],['Voice (in-game)',sum(data,'voice.join.game')],['Voice (website)',sum(data,'voice.join.web')]]);
    bars('purch',[['Town Pass',sum(data,'purchase.townpass')],['Moonstones',sum(data,'purchase.moonstones')],['Coven charter',sum(data,'purchase.charter')],['Coven upkeep',sum(data,'purchase.upkeep')]]);
    var rows=days.slice().reverse().map(function(day){var x=data[day]||{};return '<tr><td>'+day+'</td><td>'+((x.register||0)).toLocaleString()+'</td><td>'+((x.dau||0)).toLocaleString()+'</td><td>'+((x.join||0)).toLocaleString()+'</td><td>'+((x.onsite||0)).toLocaleString()+'</td><td>'+((x.concurrent||0)).toLocaleString()+'</td></tr>';}).join('');
    document.getElementById('daily').innerHTML='<table><thead><tr><th>Day</th><th>New accts</th><th>Active (DAU)</th><th>Joins</th><th>Peak on site</th><th>Peak in game</th></tr></thead><tbody>'+(rows||'<tr><td colspan=6 class="muted">No data yet.</td></tr>')+'</tbody></table>';
    var dayseries=function(metric){return days.map(function(day){return [day.slice(5),(data[day]||{})[metric]||0];});};
    bars('dDau',dayseries('dau'));bars('dWau',dayseries('wau'));bars('dMau',dayseries('mau'));
    // ── Client health ───────────────────────────────────────────────────────
    var TTPB=[['lt2s','Under 2s'],['2_4s','2–4s'],['4_6s','4–6s'],['6_10s','6–10s'],['10_20s','10–20s'],['gt20s','Over 20s']];
    var ttpRows=TTPB.map(function(b){return [b[1],sum(data,'ttp.'+b[0])];});
    var playable=sum(data,'playable');
    // Approximate median bucket: the first whose running total crosses half.
    var medLbl='—',acc=0;for(var i=0;i<TTPB.length;i++){acc+=sum(data,'ttp.'+TTPB[i][0]);if(playable&&acc>=playable/2){medLbl=TTPB[i][1];break;}}
    var disc=sum(data,'disconnect'),drop=sum(data,'disconnect.drop'),cerr=sum(data,'clienterr'),afail=sum(data,'asset_fail');
    document.getElementById('htiles').innerHTML=[
      tile(playable.toLocaleString(),'Playable loads'),
      tile(medLbl,'Median load','good'),
      tile(afail.toLocaleString(),'Asset failures',afail>0?'bad':'good'),
      tile(pct(drop,disc)+'%','Dropped conns',pct(drop,disc)>40?'bad':''),
      tile(cerr.toLocaleString(),'Client errors',cerr>0?'bad':'good')
    ].join('');
    bars('ttp',playable?ttpRows:[['(no load beacons yet)',0]]);
    var AF=[['char0','Witch (char0)'],['char1','Werewolf (char1)'],['char2','Mystic (char2)'],['char3','Knight (char3)'],['char4','Wanderer (char4)'],['char5','Lich (char5)'],['town','Town'],['other','Other']];
    var afRows=AF.map(function(a){return [a[1],sum(data,'asset_fail.'+a[0])];}).filter(function(r){return r[1]>0;});
    bars('assetfail',afRows.length?afRows:[['(no asset failures — good)',0]]);
    pollTelemetry();
    pollBugs();
    document.getElementById('err').textContent='';
  }).catch(function(e){
    if(String(e.message)==='auth'){KEY='';document.getElementById('gate').hidden=false;document.getElementById('app').hidden=true;document.getElementById('gerr').textContent='Wrong or missing key.';}
    else document.getElementById('err').textContent='Could not load analytics.';
  });
}
setInterval(function(){if(KEY&&!document.getElementById('app').hidden)start();},15000);
setInterval(pollChat,4000);
setInterval(pollAuctions,5000);
setInterval(pollBugs,20000);
document.addEventListener('keydown',function(e){if(e.key==='Enter'&&document.activeElement&&document.activeElement.id==='wsay')sendSay();});
// Click a selfie thumbnail in the auction feed to expand it full-size, the same
// as a player can in-game. Built with delegation + a lazily-created overlay so
// it survives the feed's periodic re-render.
(function(){
  var box=null;
  function overlay(){
    if(box)return box;
    box=document.createElement('div');
    box.id='afLightbox';
    box.style.cssText='position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;background:rgba(6,4,16,0.92);cursor:zoom-out;padding:24px';
    box.innerHTML='<img style="max-width:94vw;max-height:94vh;border-radius:12px;box-shadow:0 12px 50px rgba(0,0,0,0.6)">';
    box.addEventListener('click',close);
    document.body.appendChild(box);
    return box;
  }
  function open(src){var b=overlay();b.querySelector('img').src=src;b.style.display='flex';}
  function close(){if(box)box.style.display='none';}
  document.addEventListener('click',function(e){
    var t=e.target;
    if(t&&t.classList&&t.classList.contains('afimg')&&t.getAttribute('src')){open(t.getAttribute('src'));}
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
})();
start();
</script></body></html>`;

// Reports triage queue (admin-gated, shares tr_admin_key with /admin).
const REPORTS_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Reports — Thornreach</title>
<style>
:root{--bg:#0b0716;--card:#16102a;--ink:#e9ddff;--mut:#9b8fc0;--mut2:#7d719e;--violet:#b98aff;--teal:#7ef0c3;--gold:#e8d9a8;--red:#ff8a8a;--line:rgba(185,138,255,0.16)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,Segoe UI,Arial,sans-serif;padding:20px;max-width:900px;margin:0 auto}
h1{font-size:22px;margin:0 0 2px}.sub{color:var(--mut2);font-size:12px;margin-bottom:16px}a{color:var(--teal)}
.gate{max-width:360px;margin:60px auto;text-align:center}
input{background:#0e0a1c;border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:9px 12px;width:100%;font-size:14px}
.tabs{display:flex;gap:8px;margin-bottom:14px}
.tabs button{background:#120c24;border:1px solid var(--line);color:var(--mut);border-radius:8px;padding:7px 14px;cursor:pointer;font-size:13px;font-weight:700}
.tabs button.on{background:linear-gradient(90deg,#a678f0,#5ee7c0);color:#0b0713;border:none}
.rep{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:12px}
.rep .top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.rep .who{font-weight:800;color:#f1e9ff;font-size:15px}.rep .arrow{color:var(--mut2)}.rep .tgt{font-weight:800;color:var(--red)}
.rep .when{margin-left:auto;color:var(--mut2);font-size:12px}
.rep .reason{color:var(--ink);font-size:13.5px;margin:8px 0;padding:8px 10px;background:#120c24;border-radius:8px;border-left:3px solid var(--gold)}
.rep .meta{color:var(--mut2);font-size:12px}
.rep .acts{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
.rep .acts button{border:none;border-radius:8px;padding:7px 12px;font-weight:700;font-size:12.5px;cursor:pointer}
.b-mute{background:rgba(232,217,168,0.16);color:var(--gold);border:1px solid rgba(232,217,168,0.4)!important}
.b-ban{background:rgba(255,90,90,0.16);color:var(--red);border:1px solid rgba(255,120,120,0.4)!important}
.b-dismiss{background:#1b1430;color:var(--mut)}
.badge{font-size:10px;letter-spacing:.5px;text-transform:uppercase;padding:2px 8px;border-radius:10px;background:#1b1430;color:var(--mut2)}
.badge.resolved{color:var(--teal)}.badge.dismissed{color:var(--mut2)}
.empty,.err{color:var(--mut2);text-align:center;padding:40px 0}.err{color:var(--red)}
.note{color:var(--teal);font-size:12px;min-height:16px;margin-top:6px}
</style></head><body>
<div id="gate" class="gate" hidden><h1>Reports</h1><p class="sub">Enter the admin key.</p><input id="key" type="password" placeholder="ADMIN_KEY"><button onclick="saveKey()" style="margin-top:10px;background:linear-gradient(90deg,#a678f0,#5ee7c0);color:#0b0713;border:none;border-radius:8px;padding:9px 16px;font-weight:800;cursor:pointer">View</button><div class="err" id="gerr"></div></div>
<div id="app" hidden>
  <h1>Player reports</h1>
  <div class="sub">Triage queue · <a href="/admin">security console</a> · <a href="/admin/analytics">analytics</a></div>
  <div class="tabs"><button data-s="open" class="on" onclick="setTab('open')">Open</button><button data-s="all" onclick="setTab('all')">All</button><button data-s="resolved" onclick="setTab('resolved')">Resolved</button><button data-s="dismissed" onclick="setTab('dismissed')">Dismissed</button></div>
  <div id="list"></div>
  <div class="note" id="note"></div>
</div>
<script>
var KEY=localStorage.getItem('tr_admin_key')||'',TAB='open';
function saveKey(){KEY=document.getElementById('key').value.trim();localStorage.setItem('tr_admin_key',KEY);load();}
function esc(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;'}[c];});}
function ago(t){var s=(Date.now()-t)/1000;if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago';}
function hdr(){return{'x-admin-key':KEY,'content-type':'application/json'};}
function setTab(s){TAB=s;[].forEach.call(document.querySelectorAll('.tabs button'),function(b){b.classList.toggle('on',b.getAttribute('data-s')===s);});load();}
function note(m){document.getElementById('note').textContent=m||'';}
function act(id,status){return fetch('/api/admin/report-action',{method:'POST',headers:hdr(),body:JSON.stringify({id:id,status:status})}).then(function(r){return r.json();});}
function ban(rep,kind,hours){
  var target=rep.targetAccount?'account':'ip',value=rep.targetAccount||rep.targetIp;
  if(!value){note('No account or IP on that report to '+kind+'.');return Promise.resolve();}
  return fetch('/api/admin/ban',{method:'POST',headers:hdr(),body:JSON.stringify({target:target,value:value,kind:kind,hours:hours||0,reason:'report: '+(rep.reason||'')})}).then(function(r){return r.json();});
}
function doMute(id){var r=REP[id];ban(r,'mute',168).then(function(){return act(id,'resolved');}).then(function(){note('Muted '+(r.targetName||'')+' for 7 days.');load();});}
function doBan(id){var r=REP[id];if(!confirm('Permanently ban '+(r.targetName||'this player')+'?'))return;ban(r,'ban',0).then(function(){return act(id,'resolved');}).then(function(){note('Banned '+(r.targetName||'')+'.');load();});}
function doDismiss(id){act(id,'dismissed').then(function(){note('Dismissed.');load();});}
var REP={};
function load(){
  if(!KEY){document.getElementById('gate').hidden=false;document.getElementById('app').hidden=true;return;}
  fetch('/api/admin/reports?status='+TAB,{headers:hdr()}).then(function(r){if(r.status===401||r.status===503)throw new Error('auth');return r.json();}).then(function(d){
    document.getElementById('gate').hidden=true;document.getElementById('app').hidden=false;
    REP={};var reps=d.reports||[];
    document.getElementById('list').innerHTML=reps.length?reps.map(function(r){REP[r.id]=r;
      var open=r.status==='open';
      var acts=open?('<div class="acts"><button class="b-mute" onclick="doMute(\\''+r.id+'\\')">\\u{1F507} Mute 7d</button><button class="b-ban" onclick="doBan(\\''+r.id+'\\')">\\u{1F6AB} Ban</button><button class="b-dismiss" onclick="doDismiss(\\''+r.id+'\\')">Dismiss</button></div>'):('<div class="acts"><span class="badge '+r.status+'">'+r.status+(r.resolvedBy?(' by '+esc(r.resolvedBy)):'')+'</span></div>');
      return '<div class="rep"><div class="top"><span class="who">'+esc(r.reporterName||'someone')+'</span><span class="arrow">reported</span><span class="tgt">'+esc(r.targetName||'?')+'</span><span class="when">'+ago(r.at)+'</span></div>'+
        '<div class="reason">'+(r.reason?esc(r.reason):'<span style="color:#7d719e">(no reason given)</span>')+'</div>'+
        '<div class="meta">'+(r.targetAccount?('account: '+esc(r.targetAccount)):'guest')+(r.targetRoom?(' \\u00b7 in '+esc(r.targetRoom)):'')+(r.targetIp?(' \\u00b7 ip '+esc(r.targetIp)):'')+'</div>'+acts+'</div>';
    }).join(''):'<div class="empty">No '+TAB+' reports.</div>';
    note('');
  }).catch(function(e){
    if(String(e.message)==='auth'){KEY='';document.getElementById('gate').hidden=false;document.getElementById('app').hidden=true;document.getElementById('gerr').textContent='Wrong or missing key.';}
    else document.getElementById('list').innerHTML='<div class="err">Could not load reports.</div>';
  });
}
setInterval(function(){if(KEY&&!document.getElementById('app').hidden)load();},15000);
load();
</script></body></html>`;
