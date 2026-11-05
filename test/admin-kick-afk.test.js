// Admin kick (with its rejoin cooldown) and the AFK auto-logout. Drives the
// real ws handlers.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-kick-');
process.env.ADMIN_ACCOUNTS = 'boss';

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag, closedWith: null,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    close(code) { this.closedWith = code || 1000; },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, ip, key) {
    const s = makeMockSocket(tag); s._ip = ip; connHandler(s); s._ip = ip;
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const init = s.lastOfType('init');
    const p = init ? h.players.get(init.id) : null;
    if (p && key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; }
    return { s, p };
  }
  const send = (s, m) => s.emit('message', JSON.stringify(m));

  // ── Kick ──
  const admin = join('Boss', '10.9.0.1', 'boss');
  const pest = join('Pest', '10.9.0.2');
  const bystander = join('Bystander', '10.9.0.3');
  send(bystander.s, { type: 'admin_kick', targetId: pest.p.id });
  check('a non-admin cannot kick', !pest.s.lastOfType('kicked'));
  send(admin.s, { type: 'admin_kick', targetId: pest.p.id });
  check('the target is told they were kicked', !!pest.s.lastOfType('kicked'));
  setTimeout(() => {
    check('the target socket is closed', pest.s.closedWith === 4004, pest.s.closedWith);
    check('the admin gets a confirmation', /Kicked Pest/.test((admin.s.lastOfType('toast') || {}).message || ''));
    check('the kicked network is blocked', h.kickBlockedUntil(null, '10.9.0.2') > Date.now());
    const back = join('Pest', '10.9.0.2');
    check('rejoining from the kicked network is refused', !back.s.lastOfType('init') && /removed from the town/.test((back.s.lastOfType('join_error') || {}).message || ''));
    check('an admin is never kick-blocked (same-network testing)', h.kickBlockedUntil('boss', '10.9.0.2') === 0);
    send(admin.s, { type: 'admin_kick', targetId: admin.p.id });
    check('an admin cannot kick themself', !admin.s.lastOfType('kicked'));

    // ── AFK ──
    const idler = join('Idler', '10.9.0.4');
    const now = Date.now();
    idler.p.lastActiveAt = now - h.AFK_MS + 30000; // inside the warning minute
    h.afkSweep(now);
    check('a warning toast lands a minute before logout', /Still there/.test((idler.s.lastOfType('toast') || {}).message || ''));
    // standing-still move packets don't count as activity
    idler.p._actX = idler.p.x; idler.p._actY = idler.p.y; idler.p._actRoom = idler.p.room;
    send(idler.s, { type: 'move', x: idler.p.x, y: idler.p.y, room: idler.p.room });
    check('a stationary move does not reset the idle clock', idler.p.lastActiveAt === now - h.AFK_MS + 30000);
    const out = h.afkSweep(now + 31000);
    check('past the limit the idler is logged out', out.includes(idler.p.id) && !!idler.s.lastOfType('afk_logout'));
    const active = join('Active', '10.9.0.5');
    active.p.lastActiveAt = now - h.AFK_MS - 5000;
    send(active.s, { type: 'chat', text: 'hi' });
    check('any real action resets the clock', h.afkSweep(Date.now()).indexOf(active.p.id) === -1);
    check('ping does not count as activity', (() => { active.p.lastActiveAt = 5; send(active.s, { type: 'ping' }); return active.p.lastActiveAt === 5; })());

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }, 150);
}, 400);
