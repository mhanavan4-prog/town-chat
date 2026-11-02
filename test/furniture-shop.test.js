// Player housing — the premium decor runway. Default pieces are owned by all;
// premium pieces are locked until unlocked with Moonstones, then placeable and
// account-wide. Covers ownership, the catalog's price/owned flags, the buy flow
// (spend + unlock + can now place), and refusals (unknown/insufficient funds).
// Mirrors test/housing.test.js' harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-furnshop-');

const { FURNITURE } = require('../data/furniture.js');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    hasType(t) { return this.sent.some((m) => m.type === t); },
  };
}

// ── Pure data: the catalog has both tiers, priced sanely ────────────────────
const premium = FURNITURE.filter((f) => f.source === 'premium');
const defaults = FURNITURE.filter((f) => f.source === 'default');
check('the free starter set is still all default', defaults.length >= 10 && defaults.every((f) => !f.ms));
check('there is a premium tier, every piece priced in Moonstones', premium.length >= 4 && premium.every((f) => f.ms > 0));
check('premium furniture carries no stats (cosmetic only)', premium.every((f) => !('atk' in f) && !('def' in f)));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }

  const g = join('Decorator');
  g.p.accountKey = 'decorator';
  const pick = premium[0]; // the cheapest-to-reason-about premium piece

  // ── Ownership: defaults yes, premium no (yet) ──────────────────────────────
  check('a default piece is owned from the start', h.ownsFurniture(g.p, defaults[0].id) === true);
  check('a premium piece is NOT owned before unlock', h.ownsFurniture(g.p, pick.id) === false);
  check('the catalog flags the premium piece locked + priced', (() => {
    const c = h.homeStateBody(g.p).catalog.find((x) => x.id === pick.id);
    return c && c.owned === false && c.ms === pick.ms;
  })());

  // ── Can't place what you don't own ─────────────────────────────────────────
  check('placing an unowned premium piece is rejected', h.homePlace(g.p, pick.id, 0, 0, 0).ok === false);

  // ── Buy with too little Moonstone is refused ──────────────────────────────
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'buy_furniture', pieceId: pick.id }));
  check('buying with no Moonstones is refused', g.s.hasType('ms_error') && !g.s.hasType('furniture_bought'));
  check('a refused buy leaves it unowned', h.ownsFurniture(g.p, pick.id) === false);

  // ── Fund the account, then buy ─────────────────────────────────────────────
  h.msAdjust('decorator', pick.ms + 20);
  const balBefore = h.msBalance('decorator');
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'buy_furniture', pieceId: pick.id }));
  check('a funded buy succeeds', g.s.hasType('furniture_bought'));
  check('the Moonstones were spent', h.msBalance('decorator') === balBefore - pick.ms);
  check('the piece is now owned', h.ownsFurniture(g.p, pick.id) === true);
  check('the refreshed catalog shows it owned', (() => {
    const c = h.homeStateBody(g.p).catalog.find((x) => x.id === pick.id);
    return c && c.owned === true;
  })());

  // ── Now it places ──────────────────────────────────────────────────────────
  check('an unlocked premium piece can be placed', h.homePlace(g.p, pick.id, 0, 0, 0).ok === true);

  // ── Buying again is a no-op (no double charge) ─────────────────────────────
  const balAfter = h.msBalance('decorator');
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'buy_furniture', pieceId: pick.id }));
  check('re-buying an owned piece does not charge again', h.msBalance('decorator') === balAfter && g.s.hasType('furniture_bought'));

  // ── Unknown / non-premium ids are not for sale ────────────────────────────
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'buy_furniture', pieceId: defaults[0].id }));
  check('a default (free) piece is not "for sale"', g.s.hasType('ms_error') && !g.s.hasType('furniture_bought'));
  g.s.sent.length = 0;
  g.s.emit('message', JSON.stringify({ type: 'buy_furniture', pieceId: 'throne_of_skulls' }));
  check('an unknown piece id is rejected', g.s.hasType('ms_error'));

  // ── A guest (no account) can't buy ─────────────────────────────────────────
  const guest = join('Drifter');
  guest.s.sent.length = 0;
  guest.s.emit('message', JSON.stringify({ type: 'buy_furniture', pieceId: pick.id }));
  check('a guest with no account cannot buy', guest.s.hasType('ms_error') && !guest.s.hasType('furniture_bought'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
