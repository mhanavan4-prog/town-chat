// The Town Bell: a scheduled gathering. Drives the real ring/close engine with
// mock sockets and asserts attendance is proximity-gated at the well, the gold
// reward scales with turnout (accounts only), the XP blessing lands on everyone
// who answered (guest included), and the schedule rolls to the next half hour.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-bell-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    ofType(t) { return this.sent.filter(m => m.type === t); },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, charId) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: charId || 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    return { s, p };
  }
  const W = h.BELL_WELL;

  try {
    check('bell hooks exposed', typeof h.ringBell === 'function' && typeof h.closeBell === 'function' && !!W);

    // bellNextPeriod lands on a clean two-hour boundary (:00), in the future.
    const from = Date.parse('2026-10-24T15:17:00Z');
    const na = h.bellNextPeriod(from);
    check('schedule rolls to a clean period boundary',
      na > from && new Date(na).getUTCMinutes() === 0 && new Date(na).getSeconds() === 0 && (na % (2 * 60 * 60 * 1000)) === 0,
      new Date(na).toISOString());

    // Three players: two at the well (one account, one guest), one far away.
    const acct = join('Mordra'); acct.p.accountKey = 'mordra'; acct.p.room = 'outside'; acct.p.x = W.x + 20; acct.p.y = W.y - 10;
    h.accounts['mordra'] = h.accounts['mordra'] || {};
    const guest = join('Wisp'); guest.p.room = 'outside'; guest.p.x = W.x - 30; guest.p.y = W.y + 15; // no accountKey => guest
    const far = join('Bram'); far.p.room = 'outside'; far.p.x = W.x + 2000; far.p.y = W.y; // across the square

    check('bellAtWell: near counts', h.bellAtWell(acct.p) && h.bellAtWell(guest.p));
    check('bellAtWell: far does not', !h.bellAtWell(far.p));

    // Ring, then close and reward.
    acct.s.sent.length = 0; guest.s.sent.length = 0; far.s.sent.length = 0;
    h.ringBell();
    check('ring broadcasts to everyone', !!acct.s.lastOfType('town_bell') && acct.s.lastOfType('town_bell').phase === 'ring', acct.s.lastOfType('town_bell'));

    const bankBefore = (h.__bank && 0) || 0;
    h.closeBell();

    // Two answered -> gold = base(15) + perHead(10)*(2-1) = 25 for the account.
    const rew = acct.s.ofType('town_bell').find(m => m.phase === 'reward');
    check('account reward reflects turnout', rew && rew.count === 2 && rew.gold === 25, rew);
    const grew = guest.s.ofType('town_bell').find(m => m.phase === 'reward');
    check('guest gets the blessing but no gold', grew && grew.count === 2 && grew.gold === 0, grew);
    check('far player got no reward', !far.s.ofType('town_bell').some(m => m.phase === 'reward'));

    // XP blessing lands on everyone who answered, not the no-show.
    const now = Date.now();
    check('account has the XP buff', acct.p.bellBuffUntil && acct.p.bellBuffUntil > now);
    check('guest has the XP buff', guest.p.bellBuffUntil && guest.p.bellBuffUntil > now);
    check('far player has no buff', !far.p.bellBuffUntil);

    // Schedule advanced to a future half hour, and everyone got the idle update.
    check('next toll scheduled in the future', h.bellPublicState().nextAt > now && h.bellPublicState().ringingUntil === 0, h.bellPublicState());
    check('idle schedule broadcast', !!far.s.ofType('town_bell').some(m => m.phase === 'idle'));

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}, 300);
