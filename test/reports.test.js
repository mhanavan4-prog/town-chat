// Player reports → durable triage queue + admin actions. A player reports
// another; the report lands in the queue (not just the audit log); the
// admin-gated endpoints list it and resolve/dismiss it.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-reports-');
process.env.ADMIN_KEY = 'adminkey99';

const http = require('http');
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, _ip: '10.0.0.' + Math.floor(Math.random() * 200),
    on(e, cb) { this._handlers[e] = cb; }, send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
function req(method, path, port, key, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const r = http.request({ host: '127.0.0.1', port, path, method, headers: Object.assign({ 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }, key ? { 'x-admin-key': key } : {}) }, (res) => {
      let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch (e) {} resolve({ status: res.statusCode, j }); });
    });
    r.on('error', () => resolve({ status: 0, j: {} })); r.write(data); r.end();
  });
}

require('../server.js');

setTimeout(async () => {
  try {
    const h = global.__testHooks;
    const wss = global.__wssInstances[0];
    const server = h.server;
    const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
    let port = 0; for (let i = 0; i < 40 && !port; i++) { const a = server && server.address(); port = (a && a.port) || 0; if (!port) await new Promise((r) => setTimeout(r, 50)); }

    function join(tag, account) {
      const s = makeMockSocket(tag); connHandler(s);
      s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
      const p = h.players.get(s.lastOfType('init').id);
      if (account) { p.accountKey = account; s._isGuest = false; }
      return { s, p };
    }
    const reporter = join('Alice', 'alice');
    const target = join('Troublemaker', 'troublemaker');

    reporter.s.emit('message', JSON.stringify({ type: 'report', targetId: target.p.id, reason: 'Harassment' }));
    check('reporter gets an ack', !!reporter.s.lastOfType('announce_soft'));
    const open = h.reportsList('open');
    check('report landed in the queue', open.length === 1, open);
    check('report captured reporter + target + reason', open[0] && open[0].reporterName === 'Alice' && open[0].targetName === 'Troublemaker' && open[0].reason === 'Harassment' && open[0].targetAccount === 'troublemaker', open[0]);
    const rid = open[0] && open[0].id;

    // Admin endpoints: gated.
    let r = await req('GET', '/api/admin/reports?status=open', port, null);
    check('reports endpoint is gated (401 without key)', r.status === 401, r.status);
    r = await req('GET', '/api/admin/reports?status=open', port, 'adminkey99');
    check('admin can list open reports', r.status === 200 && r.j.reports && r.j.reports.length === 1, r.j);

    // Mute the target via the shared ban endpoint (kind=mute), as the UI does.
    r = await req('POST', '/api/admin/ban', port, 'adminkey99', { target: 'account', value: 'troublemaker', kind: 'mute', hours: 168, reason: 'report' });
    check('mute applied', r.status === 200, r.status);
    check('target now listed as muted', Array.isArray(r.j.bans) && r.j.bans.some((b) => b.value === 'troublemaker' && b.kind === 'mute'), r.j.bans);

    // Resolve the report.
    r = await req('POST', '/api/admin/report-action', port, 'adminkey99', { id: rid, status: 'resolved' });
    check('report-action resolves', r.status === 200 && r.j.ok === true, r.j);
    check('queue has no open reports now', h.reportsList('open').length === 0);
    check('resolved tab shows it', h.reportsList('resolved').length === 1);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) { console.error(e); process.exit(1); }
}, 300);
