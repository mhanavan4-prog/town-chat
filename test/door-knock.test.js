// A knock at the door: a player who comes in on a dated caller's day is told,
// once that day, who is at the door (server.js doorKnock), unless that caller
// is already being worked or has been served.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-doorknock-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
const SRC = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
check('a fresh join (not a reconnect) listens for the knock', /if \(!resume\) setTimeout\(\(\) => \{ try \{ doorKnock\(player\); \}/.test(SRC));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const join = (tag, acct) => {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (acct) { p.accountKey = acct; h.accounts[acct] = {}; h.playerProgress[acct] = { level: 1, xp: 0 }; }
    return { s, p };
  };
  const NOV10 = Date.UTC(2027, 10, 10, 12);
  // The callers' own clock is Date.now, so knock as of a moment.
  const realNow = Date.now;
  const knock = (p, t) => { Date.now = () => t; try { return h.doorKnock(p, t); } finally { Date.now = realNow; } };
  const a = join('Hob', 'hob');
  const m1 = knock(a.p, NOV10);
  check('in Martinmas week: "🐓 Bridget Cullinan is at your door today: Martinmas week only."', m1 === '🐓 Bridget Cullinan is at your door today: Martinmas week only. The Board in the square has them.', m1);
  const t = a.s.lastOfType('toast');
  check('…sent as an important notice, shown even with screen notices off', t && t.message === m1 && t.level === 'important' && t.always === true);
  check('…and only once that day', knock(a.p, NOV10 + 3600000) === null);
  check('…but again the next day', typeof knock(a.p, NOV10 + 86400000) === 'string');
  const b = join('Wren', 'wrenfan');
  const m2 = knock(b.p, Date.UTC(2027, 11, 26, 12));
  check('the wren boys "are" at your door, on St Stephen\'s Day', /^🐦 Denny Sheehan and the wren boys are at your door today: St Stephen's Day only\./.test(m2), m2);
  const c = join('Quiet', 'quiet');
  check('nothing on an ordinary day', knock(c.p, Date.UTC(2027, 6, 1, 12)) === null);
  const d = join('Busy', 'busy');
  Date.now = () => NOV10; try { h.callers.stateOf(d.p).active = { id: 'martinmas_cock', done: {} }; } finally { Date.now = realNow; }
  check('nothing if she is already being worked', knock(d.p, NOV10) === null);
  const e = join('Done', 'done');
  // stateOf resets "served" on a new day, so serve her on the day itself.
  Date.now = () => NOV10; try { h.callers.stateOf(e.p).served = ['martinmas_cock']; } finally { Date.now = realNow; }
  check('nothing if she has been served today', knock(e.p, NOV10) === null);
  const g = join('Guest');
  check('nothing for a guest, who can\'t take callers', knock(g.p, NOV10) === null);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
