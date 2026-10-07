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
  const { audit, getAdminKey, bans, onlineList } = deps;

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
    next();
  }

  app.get('/admin', (req, res) => res.type('html').send(PAGE));

  app.get('/api/admin/events', gate, (req, res) => {
    res.json({ events: audit.recent(req.query.n, { level: req.query.level, q: req.query.q }) });
  });

  app.get('/api/admin/stats', gate, (req, res) => {
    res.json(Object.assign(audit.stats(), {
      bans: bans.list(),
      online: typeof onlineList === 'function' ? onlineList() : []
    }));
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
  <div class="bar">
    <select id="flevel"><option value="all">all levels</option><option value="alert">alerts</option><option value="warn">warnings</option><option value="info">info</option></select>
    <input id="fq" placeholder="search ip / account / type…" oninput="debounced()">
    <label style="color:var(--muted);font-size:12px"><input type="checkbox" id="auto" checked> auto-refresh</label>
    <button class="ghost" onclick="load()">refresh</button>
  </div>
  <div class="panel"><h2>Events</h2><table><thead><tr><th>time</th><th>lvl</th><th>type</th><th>ip</th><th>account</th><th>detail</th><th></th></tr></thead><tbody id="rows"></tbody></table><div id="noev" class="empty" hidden>No events yet — quiet in the town.</div></div>
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
async function start(){try{await load();document.getElementById('gate').hidden=true;document.getElementById('app').hidden=false;}catch(e){document.getElementById('gerr').textContent='Wrong key, or admin console is disabled on the server.';}}
async function load(){
  const level=document.getElementById('flevel').value,q=document.getElementById('fq').value;
  const s=await api('stats');
  document.getElementById('tiles').innerHTML=[
    ['events (recent)',s.total],['alerts',s.byLevel.alert||0],['warnings',s.byLevel.warn||0],
    ['online',(s.online||[]).length],['active bans',(s.bans||[]).length]
  ].map(([k,n],i)=>'<div class="tile"><div class="k">'+k+'</div><div class="n" style="color:'+(i==1&&n?'var(--alert)':i==2&&n?'var(--warn)':'var(--ink)')+'">'+n+'</div></div>').join('');
  const banrows=(s.bans||[]).map(b=>'<tr><td><span class="pill '+(b.kind==='mute'?'lv-warn':'lv-alert')+'">'+b.kind+'</span></td><td class="mono">'+esc(b.target)+':'+esc(b.value)+'</td><td class="det">'+esc(b.reason||'')+(b.until?' · until '+when(b.until):' · permanent')+'</td><td><a class="act" onclick="unban(\\''+b.target+'\\',\\''+esc(b.value)+'\\')">lift</a></td></tr>').join('');
  document.getElementById('banrows').innerHTML=banrows;document.getElementById('noban').hidden=!!banrows;
  const d=await api('events?n=300&level='+level+'&q='+encodeURIComponent(q));
  const rows=(d.events||[]).map(e=>'<tr><td class="mono">'+when(e.ts)+'</td><td><span class="pill lv-'+e.level+'">'+e.level+'</span></td><td class="mono">'+esc(e.type)+'</td><td class="mono">'+esc(e.ip||'')+'</td><td>'+esc(e.account||'')+'</td><td class="det">'+esc(JSON.stringify(e.detail))+'</td><td>'+(e.ip?'<a class="act" onclick="quickban(\\'ip\\',\\''+esc(e.ip)+'\\')">ban ip</a>':'')+(e.account?' <a class="act" onclick="quickban(\\'account\\',\\''+esc(e.account)+'\\')">ban</a>':'')+'</td></tr>').join('');
  document.getElementById('rows').innerHTML=rows;document.getElementById('noev').hidden=!!rows;
}
async function doBan(){await api('ban',{method:'POST',body:JSON.stringify({target:document.getElementById('bt').value,value:document.getElementById('bv').value,kind:document.getElementById('bk').value,hours:document.getElementById('bh').value,reason:document.getElementById('br').value})});document.getElementById('bv').value='';document.getElementById('br').value='';load();}
async function quickban(t,v){if(confirm('Ban '+t+' '+v+'?')){await api('ban',{method:'POST',body:JSON.stringify({target:t,value:v,kind:'ban'})});load();}}
async function unban(t,v){await api('unban',{method:'POST',body:JSON.stringify({target:t,value:v})});load();}
setInterval(()=>{if(!document.getElementById('app').hidden&&document.getElementById('auto').checked)load();},5000);
if(KEY)start();
</script></body></html>`;
