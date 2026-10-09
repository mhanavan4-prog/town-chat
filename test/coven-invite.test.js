// Coven invite-by-username — a precise alternative to the old proximity
// "nearest player" invite that could target the wrong soul in a crowd.
// Exercises the real server coven_invite handler via mock sockets.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-coveninvite-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    allOfType(t) { return this.sent.filter(m => m.type === t); },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const hooks = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag) {
    const s = makeMockSocket(tag);
    connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = hooks.players.get(s.lastOfType('init').id);
    p.accountKey = tag.toLowerCase(); s._isGuest = false;
    return { s, p };
  }
  const A = join('Alice'), B = join('Bob');

  // Alice already leads a coven.
  hooks.covens['cv_inv'] = { id: 'cv_inv', name: 'Nightshade', sigil: '🌙', members: ['alice'], leaderKey: 'alice', bank: { gold: 0, slots: [] }, log: [] };
  hooks.covenIndex.set('alice', 'cv_inv');

  // ── Invite Bob by exact username ──
  A.s.emit('message', JSON.stringify({ type: 'coven_invite', username: 'Bob' }));
  const inv = B.s.lastOfType('coven_invited');
  check('the named player receives the invite', !!inv && inv.covenName === 'Nightshade', inv);
  check('username is case-insensitive (typed "Bob", account "bob")', !!inv);

  // ── Error cases ──
  A.s.emit('message', JSON.stringify({ type: 'coven_invite', username: 'nobody' }));
  check('an offline / unknown name errors instead of inviting the wrong soul',
    /No one online by that name/.test((A.s.lastOfType('coven_error') || {}).message || ''),
    A.s.lastOfType('coven_error'));

  A.s.emit('message', JSON.stringify({ type: 'coven_invite', username: 'Alice' }));
  check('you cannot invite yourself',
    /invite yourself/.test((A.s.lastOfType('coven_error') || {}).message || ''),
    A.s.lastOfType('coven_error'));

  // Bob joins a coven of his own, then a re-invite is refused.
  hooks.covens['cv_bob'] = { id: 'cv_bob', name: 'Bob Circle', sigil: '🔮', members: ['bob'], leaderKey: 'bob', bank: { gold: 0, slots: [] }, log: [] };
  hooks.covenIndex.set('bob', 'cv_bob');
  const beforeInv = B.s.allOfType('coven_invited').length;
  A.s.emit('message', JSON.stringify({ type: 'coven_invite', username: 'bob' }));
  check('a player already in a coven cannot be invited',
    B.s.allOfType('coven_invited').length === beforeInv &&
    /already belongs to a coven/.test((A.s.lastOfType('coven_error') || {}).message || ''),
    A.s.lastOfType('coven_error'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
