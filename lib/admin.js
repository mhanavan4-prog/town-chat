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
  const { audit, getAdminKey, bans, onlineList, evidence, accountInfo, accountsSummary, analytics, analyticsSummary } = deps;

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

  // ── Product analytics (privacy-respecting, aggregate-only) ──────────────────
  app.get('/admin/analytics', (req, res) => res.type('html').send(ANALYTICS_PAGE));
  app.get('/api/admin/analytics', gate, (req, res) => {
    const days = Math.max(1, Math.min(180, parseInt(req.query.days, 10) || 30));
    res.json({
      snapshot: analytics && typeof analytics.snapshot === 'function' ? analytics.snapshot(days) : { days: [], data: {}, metrics: [] },
      summary: typeof analyticsSummary === 'function' ? analyticsSummary() : null
    });
  });

  app.get('/api/admin/events', gate, (req, res) => {
    res.json({ events: audit.recent(req.query.n, { level: req.query.level, q: req.query.q }) });
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
    <label style="color:var(--muted);font-size:12px"><input type="checkbox" id="auto" checked> auto-refresh</label>
    <button class="ghost" onclick="load()">refresh</button>
  </div>
  <div class="panel"><h2>Events (live — most recent)</h2><table><thead><tr><th>time</th><th>lvl</th><th>type</th><th>ip</th><th>account</th><th>detail</th><th></th></tr></thead><tbody id="rows"></tbody></table><div id="noev" class="empty" hidden>No events yet — quiet in the town.</div></div>
  <div class="panel"><h2>Logs by day — full history on disk</h2>
    <div class="banform">
      <select id="logday" onchange="loadDay()"><option value="">— pick a day —</option></select>
      <select id="dlevel" onchange="loadDay()"><option value="all">all levels</option><option value="alert">alerts</option><option value="warn">warnings</option><option value="info">info</option></select>
      <input id="dq" placeholder="search this day…" style="flex:1;min-width:120px" oninput="debouncedDay()">
      <a id="dayraw" class="ghost" style="display:none;text-decoration:none;padding:8px 12px" href="#">⬇ raw .jsonl</a>
    </div>
    <div id="daymeta" class="sub" style="padding:0 14px 6px;margin:0"></div>
    <table><thead><tr><th>time</th><th>lvl</th><th>type</th><th>ip</th><th>account</th><th>detail</th></tr></thead><tbody id="dayrows"></tbody></table>
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
let T;function debounced(){clearTimeout(T);T=setTimeout(load,300);}
async function start(){try{await load();document.getElementById('gate').hidden=true;document.getElementById('app').hidden=false;try{await loadImages();}catch(e){}}catch(e){document.getElementById('gerr').textContent='Wrong key, or admin console is disabled on the server.';}}
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
  const rows=(d.events||[]).map(e=>'<tr><td class="mono">'+when(e.ts)+'</td><td><span class="pill lv-'+e.level+'">'+e.level+'</span></td><td class="mono">'+esc(e.type)+'</td><td class="mono">'+esc(e.ip||'')+'</td><td>'+esc(e.account||'')+'</td><td class="det">'+esc(JSON.stringify(e.detail))+'</td><td>'+(e.ip?'<a class="act" onclick="quickban(\\'ip\\',\\''+esc(e.ip)+'\\')">ban ip</a>':'')+(e.account?' <a class="act" onclick="quickban(\\'account\\',\\''+esc(e.account)+'\\')">ban</a>':'')+'</td></tr>').join('');
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
let DT;function debouncedDay(){clearTimeout(DT);DT=setTimeout(loadDay,300);}
async function loadDay(){
  const date=document.getElementById('logday').value,raw=document.getElementById('dayraw');
  if(!date){document.getElementById('dayrows').innerHTML='';document.getElementById('noday').hidden=false;document.getElementById('daymeta').textContent='';raw.style.display='none';return;}
  const level=document.getElementById('dlevel').value,q=document.getElementById('dq').value;
  const d=await api('logday?date='+encodeURIComponent(date)+'&level='+level+'&q='+encodeURIComponent(q)+'&n=2000');
  const rows=(d.events||[]).map(e=>'<tr><td class="mono">'+whenFull(e.ts)+'</td><td><span class="pill lv-'+e.level+'">'+e.level+'</span></td><td class="mono">'+esc(e.type)+'</td><td class="mono">'+esc(e.ip||'')+'</td><td>'+esc(e.account||'')+'</td><td class="det">'+esc(JSON.stringify(e.detail))+'</td></tr>').join('');
  document.getElementById('dayrows').innerHTML=rows;document.getElementById('noday').hidden=true;
  document.getElementById('daymeta').textContent=d.missing?('No log file for '+date+'.'):('showing '+(d.shown||0)+' of '+(d.total||0)+' matching events'+((d.total||0)>(d.shown||0)?' (capped — narrow with search)':''));
  raw.style.display='inline-block';raw.href='/api/admin/logday?download=1&date='+encodeURIComponent(date)+'&key='+encodeURIComponent(KEY);
}
setInterval(()=>{if(!document.getElementById('app').hidden&&document.getElementById('auto').checked)load();},5000);
if(KEY)start();
</script></body></html>`;

// Standalone analytics dashboard (privacy-respecting, aggregate-only). Same
// key gate as /admin (shares the tr_admin_key in localStorage).
const ANALYTICS_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Analytics — Thornreach</title>
<style>
:root{--bg:#0b0716;--card:#16102a;--ink:#e9ddff;--mut:#9b8fc0;--mut2:#7d719e;--violet:#b98aff;--teal:#7ef0c3;--gold:#e8d9a8;--line:rgba(185,138,255,0.16)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,Segoe UI,Arial,sans-serif;padding:20px;max-width:1040px;margin:0 auto}
h1{font-size:22px;margin:0 0 2px}.sub{color:var(--mut2);font-size:12px;margin-bottom:18px}
a{color:var(--teal)}
.gate{max-width:360px;margin:60px auto;text-align:center}
input{background:#0e0a1c;border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:9px 12px;width:100%;font-size:14px}
button{background:linear-gradient(90deg,#a678f0,#5ee7c0);color:#0b0713;border:none;border-radius:8px;padding:9px 16px;font-weight:800;cursor:pointer;margin-top:10px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:22px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.tile .n{font-size:26px;font-weight:800;color:#f1e9ff}.tile .k{font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--mut2);margin-top:3px}
.tile .n.good{color:var(--teal)}.tile .n.gold{color:var(--gold)}
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
</style></head><body>
<div id="gate" class="gate" hidden><h1>Analytics</h1><p class="muted">Enter the admin key.</p><input id="key" type="password" placeholder="ADMIN_KEY"><button onclick="saveKey()">View</button><div class="err" id="gerr"></div></div>
<div id="app" hidden>
  <h1>Thornreach — Analytics</h1>
  <div class="sub">Anonymous, aggregate only · <a href="/admin">security console</a> · <span id="range"></span></div>
  <div class="tiles" id="tiles"></div>
  <h2>Acquisition funnel (last 30 days)</h2><div class="funnel" id="funnel"></div>
  <h2>Class choice</h2><div id="classes"></div>
  <h2>Engagement &amp; covens (last 30 days)</h2><div id="engage"></div>
  <h2>Purchases (last 30 days)</h2><div id="purch"></div>
  <h2>Daily — new accounts &amp; active</h2><div id="daily"></div>
  <div class="err" id="err"></div>
</div>
<script>
var KEY=localStorage.getItem('tr_admin_key')||'';
function saveKey(){KEY=document.getElementById('key').value.trim();localStorage.setItem('tr_admin_key',KEY);start();}
function esc(s){return String(s==null?'':s).replace(/[<>&]/g,function(c){return{'<':'&lt;','>':'&gt;','&':'&amp;'}[c];});}
function sum(data,metric){var t=0;for(var d in data){if(data[d]&&data[d][metric])t+=data[d][metric];}return t;}
function bars(el,rows,cls){var max=Math.max(1,Math.max.apply(null,rows.map(function(r){return r[1];})));
  document.getElementById(el).innerHTML=rows.map(function(r){var w=Math.round(r[1]/max*100);
    return '<div class="row"><div class="lbl">'+esc(r[0])+'</div><div class="bar"><span style="width:'+w+'%"></span></div><div class="v">'+r[1].toLocaleString()+'</div></div>';}).join('');}
function tile(n,k,cls){return '<div class="tile"><div class="n '+(cls||'')+'">'+n+'</div><div class="k">'+k+'</div></div>';}
function start(){
  document.getElementById('gate').hidden=!!KEY; if(!KEY){document.getElementById('gate').hidden=false;document.getElementById('app').hidden=true;return;}
  fetch('/api/admin/analytics?days=30',{headers:{'x-admin-key':KEY}}).then(function(r){if(r.status===401||r.status===503)throw new Error('auth');return r.json();}).then(function(d){
    document.getElementById('gate').hidden=true;document.getElementById('app').hidden=false;
    var s=d.summary||{},data=(d.snapshot&&d.snapshot.data)||{},days=(d.snapshot&&d.snapshot.days)||[];
    document.getElementById('range').textContent=days.length?('since '+days[0]):'no data yet';
    document.getElementById('tiles').innerHTML=[
      tile((s.totalAccounts||0).toLocaleString(),'Total accounts'),
      tile((s.onlineNow||0).toLocaleString(),'Online now','good'),
      tile((s.activeLast24h||0).toLocaleString(),'Active 24h'),
      tile((s.activeLast7d||0).toLocaleString(),'Active 7d'),
      tile((s.returnRate||0)+'%','Return rate','gold'),
      tile((s.covens||0).toLocaleString(),'Covens')
    ].join('');
    bars('funnel',[['Landing views',sum(data,'page.landing')],['Play opened',sum(data,'page.play')],['Registered',sum(data,'register')],['Logged in',sum(data,'login')],['Joined (fresh)',sum(data,'join')],['— as account',sum(data,'join.account')],['— as guest',sum(data,'join.guest')]]);
    var CLS=['witch','werewolf','mystic','knight','wanderer','lich'];
    bars('classes',CLS.map(function(c){return [c.charAt(0).toUpperCase()+c.slice(1),sum(data,'class.'+c)];}));
    bars('engage',[['Covens founded',sum(data,'coven.found')],['Coven joins',sum(data,'coven.join')],['Voice (in-game)',sum(data,'voice.join.game')],['Voice (website)',sum(data,'voice.join.web')]]);
    bars('purch',[['Town Pass',sum(data,'purchase.townpass')],['Moonstones',sum(data,'purchase.moonstones')],['Coven charter',sum(data,'purchase.charter')],['Coven upkeep',sum(data,'purchase.upkeep')]]);
    var rows=days.slice().reverse().map(function(day){var x=data[day]||{};return '<tr><td>'+day+'</td><td>'+((x.register||0)).toLocaleString()+'</td><td>'+((x.dau||0)).toLocaleString()+'</td><td>'+((x.join||0)).toLocaleString()+'</td></tr>';}).join('');
    document.getElementById('daily').innerHTML='<table><thead><tr><th>Day</th><th>New accts</th><th>Active (DAU)</th><th>Joins</th></tr></thead><tbody>'+(rows||'<tr><td colspan=4 class="muted">No data yet.</td></tr>')+'</tbody></table>';
    document.getElementById('err').textContent='';
  }).catch(function(e){
    if(String(e.message)==='auth'){KEY='';document.getElementById('gate').hidden=false;document.getElementById('app').hidden=true;document.getElementById('gerr').textContent='Wrong or missing key.';}
    else document.getElementById('err').textContent='Could not load analytics.';
  });
}
setInterval(function(){if(KEY&&!document.getElementById('app').hidden)start();},15000);
start();
</script></body></html>`;
