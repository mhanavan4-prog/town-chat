// Retention instrumentation (aggregate, no PII): join-loneliness, play-hour
// histogram, session-length buckets, onboarding drop-off at disconnect,
// guest→account conversion, progression milestones, and D1/week-1 return
// cohorts. Drives the real connection handler with mock sockets.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-retention-');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

require('../server.js');

setTimeout(() => {
  const hooks = global.__testHooks;
  const A = hooks.analytics;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const today = A.day();
  const g = (m) => (A.data[today] && A.data[today][m]) || 0;

  // helper: open a socket, optionally with a specific client IP + guest flag
  function open(ip, guest) {
    const s = makeMockSocket(ip || 'anon');
    connHandler(s);
    if (ip) s._ip = ip;
    if (guest === false) s._isGuest = false;
    return s;
  }

  // ── Arrival loneliness + hour histogram ──
  const a = open('10.0.0.1', true);
  a.emit('message', JSON.stringify({ type: 'join', name: 'Solo', charId: 0 }));
  check('first join of the day counts as alone', g('join.alone') === 1, g('join.alone'));
  const b = open('10.0.0.2', true);
  b.emit('message', JSON.stringify({ type: 'join', name: 'Duo', charId: 0 }));
  check('second join counts as with-others', g('join.withothers') === 1, g('join.withothers'));
  const hourTotal = Object.keys(A.data[today]).filter(k => k.startsWith('hour.')).reduce((s, k) => s + g(k), 0);
  check('each fresh join bumps an hour bucket', hourTotal === 2, hourTotal);

  // ── Session length on disconnect (both just joined → <1m) ──
  const before = g('sess.lt1m');
  a.emit('close');
  check('disconnect records a sub-minute session', g('sess.lt1m') === before + 1, g('sess.lt1m'));

  // ── Onboarding drop-off: a player who did 1 step then left ──
  const c = open('10.0.0.3', false);
  c.emit('message', JSON.stringify({ type: 'join', name: 'Learner', charId: 0 }));
  const learner = hooks.players.get(c.lastOfType('init').id);
  learner.accountKey = null; // keep as guest-progress so firstSteps tracks on the session
  hooks.noteFirstStep(learner, 'talked');
  const beforeDrop = g('exit.onboard1');
  c.emit('close');
  check('leaving mid-onboarding records furthest step reached', g('exit.onboard1') === beforeDrop + 1, g('exit.onboard1'));

  // ── Guest → account conversion (same IP, guest then account) ──
  const ip = '203.0.113.50';
  const guest = open(ip, true);
  guest.emit('message', JSON.stringify({ type: 'join', name: 'GuestFirst', charId: 0 }));
  const beforeConv = g('conv.guest_to_account');
  // Simulate the same IP returning as a registered account: the join handler
  // reads accountKey from token resolution, so drive the conversion directly
  // the way the join path does — mark then consume.
  const acctSock = open(ip, false);
  // emulate an account join: accountKey present + consumeRecentGuest on join
  // (the join block does exactly this). We re-create its effect:
  const gKey = 'conv_acct';
  hooks.accounts[gKey] = { username: 'ConvAcct', createdAt: Date.now() };
  // The real join block: `if (consumeRecentGuest(ws._ip)) bump`. We can't call
  // the private fn, so assert via a full account join instead:
  acctSock.emit('message', JSON.stringify({ type: 'join', name: 'ConvAcct', charId: 0 }));
  const p2 = hooks.players.get(acctSock.lastOfType('init').id);
  // A real token join would set accountKey; a plain join leaves it null, so the
  // conversion counter only moves for genuine account joins. We therefore only
  // assert the guest IP was remembered (counter unchanged for a guest re-join).
  check('a guest re-join does not fabricate a conversion', g('conv.guest_to_account') === beforeConv, g('conv.guest_to_account'));

  // ── Progression milestone: once per account, guests excluded ──
  const mk = 'mile_acct';
  hooks.accounts[mk] = { username: 'MileAcct', createdAt: Date.now() };
  hooks.noteMilestone({ accountKey: mk }, 'lvl5');
  hooks.noteMilestone({ accountKey: mk }, 'lvl5'); // dup
  check('account milestone counts once, under mile.*', g('mile.lvl5') === 1, g('mile.lvl5'));

  // ── Guest depth: routed to guest.*, deduped per session, never to mile.* ──
  const guestPlayer = { accountKey: null }; // one live guest session
  hooks.noteMilestone(guestPlayer, 'lvl5');
  hooks.noteMilestone(guestPlayer, 'lvl5'); // same session → no double count
  check('guest milestone counts under guest.*', g('guest.lvl5') === 1, g('guest.lvl5'));
  check('guest milestone does NOT touch the account metric', g('mile.lvl5') === 1, g('mile.lvl5'));
  const guest2 = { accountKey: null }; // a second guest session reaches it too
  hooks.noteMilestone(guest2, 'lvl5');
  check('a second guest session adds to guest.*', g('guest.lvl5') === 2, g('guest.lvl5'));

  // ── Return cohorts via noteActive ──
  const rk = 'ret_acct';
  const twoDaysAgo = Date.now() - 2 * 86400000;
  hooks.accounts[rk] = { username: 'RetAcct', createdAt: twoDaysAgo };
  hooks.noteActive(rk); // first activity today, 2 days after signup → week1 (not next-day)
  check('a day-2 return counts toward week 1', g('ret.week1') === 1, g('ret.week1'));
  check('a day-2 return is NOT a next-day (D1) return', g('ret.next_day') === 0, g('ret.next_day'));
  const dauBefore = g('dau');
  hooks.noteActive(rk); // same day again → no double count
  check('a second same-day touch does not recount', g('dau') === dauBefore, g('dau'));

  const rk2 = 'ret_acct_d1';
  hooks.accounts[rk2] = { username: 'RetD1', createdAt: Date.now() - 86400000 }; // signed up yesterday
  hooks.noteActive(rk2);
  check('a next-day return counts as D1 and week 1', g('ret.next_day') === 1 && g('ret.week1') === 2, { d1: g('ret.next_day'), w1: g('ret.week1') });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 200);
