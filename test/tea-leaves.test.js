// Reading the Leaves — tasseomancy after a cup of tea (blueprint proposal E).
//
// The tea system used to throw the cup away. Now every cup drunk leaves dregs
// that can be read once, while they are wet: one sign from a Highland Seer's
// dictionary, placed rim / side / bottom for soon / later / far off. These checks
// hold that loop shut: no reading without a cup, one reading per cup, a friend's
// gifted cup counts, the first sight of a sign is recorded and paid, and reading
// every sign pays the purse exactly once.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-leaves-');

let pass = 0, fail = 0;
// A throw inside the timer would leave the server listening and hang the run.
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.message); process.exit(1); });
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

const { LEAF_SYMBOLS, LEAF_PLACES, CUP_WINDOW_MS, LEAVES_SET_PURSE } = require('../data/leaves');

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const say = (s, m) => s.emit('message', JSON.stringify(m));
  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    say(s, { type: 'join', name: tag, charId: 0 });
    const p = h.players.get(s.lastOfType('init').id);
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p };
  }

  // ── The dictionary is sound ──────────────────────────────────────────────
  check('signs have unique keys', new Set(LEAF_SYMBOLS.map((x) => x.key)).size === LEAF_SYMBOLS.length);
  check('every sign has a glyph, a name, a meaning and a tone', LEAF_SYMBOLS.every((x) => x.glyph && x.name && x.meaning && ['good', 'ill', 'mixed'].includes(x.tone)));
  check('both fortunes are in the cup — good and ill signs', LEAF_SYMBOLS.some((x) => x.tone === 'good') && LEAF_SYMBOLS.some((x) => x.tone === 'ill'));
  check('three places: rim, side, bottom', JSON.stringify(LEAF_PLACES.map((p) => p.key)) === '["rim","side","bottom"]');

  const a = join('Reader', 'leaves_a');
  const inv = h.getInventory(a.p);

  // ── No cup, no reading ────────────────────────────────────────────────────
  a.s.sent.length = 0;
  say(a.s, { type: 'read_leaves' });
  check('no tea drunk → nothing to read', !a.s.lastOfType('leaves_reading') && !!a.s.lastOfType('tea_error'));
  say(a.s, { type: 'tea_state' });
  check('the kitchen shows no cup yet', a.s.lastOfType('tea_state').leaves && a.s.lastOfType('tea_state').leaves.cup === null);

  // ── Drink, then read ─────────────────────────────────────────────────────
  h.addItemToAccount(inv, 'chamomile', 3);
  say(a.s, { type: 'brew_tea', teaId: 'chamomile_tea' });
  const ts = a.s.lastOfType('tea_state');
  check('after a cup, the dregs wait to be read', ts.leaves && ts.leaves.cup && ts.leaves.cup.teaId === 'chamomile_tea', ts.leaves);
  a.s.sent.length = 0;
  say(a.s, { type: 'read_leaves' });
  const r = a.s.lastOfType('leaves_reading');
  check('reading the leaves gives one sign from the dictionary', r && LEAF_SYMBOLS.some((x) => x.key === r.symbol.key), r);
  check('…placed in the cup, with when it comes', r && LEAF_PLACES.some((p) => p.label === r.place && p.when === r.when));
  check('…and names the tea it came from', r && r.tea && r.tea.name === 'Chamomile Tea');
  check('the first sight of a sign is new and recorded', r && r.isNew === true && r.seen === 1 && h.accounts.leaves_a.leavesSeen.length === 1);
  check('the kitchen state lists the sign in the Almanac', a.s.lastOfType('tea_state').leaves.seen.length === 1 && a.s.lastOfType('tea_state').leaves.cup === null);

  a.s.sent.length = 0;
  say(a.s, { type: 'read_leaves' });
  check('a cup is read once', !a.s.lastOfType('leaves_reading'));

  // ── The leaves dry ───────────────────────────────────────────────────────
  say(a.s, { type: 'brew_tea', teaId: 'chamomile_tea' });
  h.accounts.leaves_a.teaCup.at = Date.now() - CUP_WINDOW_MS - 1000;
  a.s.sent.length = 0;
  say(a.s, { type: 'read_leaves' });
  check('dried leaves cannot be read', !a.s.lastOfType('leaves_reading'));

  // ── A friend's gift is a cup too ─────────────────────────────────────────
  const b = join('Host', 'leaves_b');
  h.accounts.leaves_b.teaGifts = [{ from: 'Reader', fromKey: 'leaves_a', teaId: 'chamomile_tea', at: Date.now() }];
  say(b.s, { type: 'claim_tea_gift', index: 0 });
  say(b.s, { type: 'tea_state' });
  const bl = b.s.lastOfType('tea_state').leaves;
  check("a friend's gifted cup can be read, and says whose it was", bl.cup && bl.cup.from === 'Reader', bl);

  // ── Every sign, once: the purse ──────────────────────────────────────────
  const c = join('Seer', 'leaves_c');
  const acct = h.accounts.leaves_c;
  acct.leavesSeen = LEAF_SYMBOLS.slice(0, -1).map((x) => x.key);
  const last = LEAF_SYMBOLS[LEAF_SYMBOLS.length - 1];
  const bal0 = h.ensureBankAccount('leaves_c').balance;
  acct.teaCup = { teaId: 'chamomile_tea', at: Date.now() };
  const out = h.readLeaves(c.p, (() => { const seq = [(LEAF_SYMBOLS.length - 1) / LEAF_SYMBOLS.length + 0.001, 0, 0.9]; let i = 0; return () => seq[i++]; })());
  check('the last unread sign completes the set', out.sym.key === last.key && out.purse === LEAVES_SET_PURSE, { got: out.sym.key, purse: out.purse });
  acct.teaCup = { teaId: 'chamomile_tea', at: Date.now() };
  const again = h.readLeaves(c.p, () => 0.999);
  check('the set purse is paid only once', again.purse === 0 && again.isNew === false);
  check('readLeaves does not touch the bank by itself (the handler pays)', h.ensureBankAccount('leaves_c').balance === bal0);

  // ── A sign read for where it fell ─────────────────────────────────────────
  // The seer's dog is a faithful friend at the rim and a secret enemy at the
  // bottom; the reading must give the meaning for the place, not all three.
  const dogIdx = LEAF_SYMBOLS.findIndex((x) => x.key === 'dog');
  const d = join('Dogwatcher', 'leaves_d');
  h.accounts.leaves_d.teaCup = { teaId: 'chamomile_tea', at: Date.now() };
  const realRandom = Math.random;
  const seq = [(dogIdx + 0.5) / LEAF_SYMBOLS.length, 2.5 / 3, 0.9]; let si = 0;
  Math.random = () => seq[si++] ?? realRandom();
  d.s.sent.length = 0;
  say(d.s, { type: 'read_leaves' });
  Math.random = realRandom;
  const dr = d.s.lastOfType('leaves_reading');
  check('a dog at the bottom reads as secret enemies, an ill sign', dr && dr.symbol.key === 'dog' && dr.place === 'at the bottom' && /secret enemies/i.test(dr.symbol.meaning) && !/faithful/i.test(dr.symbol.meaning) && dr.symbol.tone === 'ill', dr && dr.symbol);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
