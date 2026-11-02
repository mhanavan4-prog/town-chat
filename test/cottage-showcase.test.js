// The Cottage Showcase (Trophy Wall) — a read-only board of what an account has
// gathered (earned auras, questlines, collections, titles), keyed by the cottage
// HOST so a visitor sees the host's trophies, not their own. Covers the builder's
// shape (earned auras only, questline done flags, collection counts) and the
// handler's host-from-instance resolution for owner, visitor, and not-in-cottage.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-showcase-');

const { GREEN_PATH } = require('../data/greenPath.js');
const { TEAS } = require('../data/teas.js');
const { TAROT_CARDS } = require('../data/tarot.js');

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

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, key) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (key) { p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {}; }
    return { s, p };
  }

  // ── Stock an owner with a spread of trophies ────────────────────────────────
  const owner = join('Hearthwitch', 'showowner');
  const prog = h.getProgress(owner.p);
  prog.greenPath = { chapter: GREEN_PATH.length, progress: 0 };   // Green Path done
  prog.hearthPath = { chapter: 0, progress: 0 };                   // Hearth Path not done
  prog.auraUnlocks = ['verdant', 'amber'];                         // verdant=earned, amber=bought
  prog.arcana = { drawn: ['fool', 'magician'], legs: [], done: false };
  h.accounts.showowner.teasBrewed = ['hearthmoon_tea', 'mugwort_tea', 'gingerroot_tea'];

  // ── The builder ─────────────────────────────────────────────────────────────
  const sc = h.cottageShowcase('showowner', 'showowner');
  check('showcase reports the viewer as self', sc.isSelf === true);
  check('showcase names a host', typeof sc.host === 'string' && sc.host.length > 0, sc.host);
  check('only EARNED auras are shown (bought auras excluded)', sc.auras.length === 1 && sc.auras[0].id === 'verdant', sc.auras);
  check('an earned aura carries a label + colour', sc.auras[0].label && typeof sc.auras[0].hex === 'number');
  const green = sc.paths.find((p) => p.key === 'green');
  const hearth = sc.paths.find((p) => p.key === 'hearth');
  check('a finished questline reads done', green.done === true && hearth.done === false);
  const teas = sc.collections.find((c) => c.key === 'teas');
  const arcana = sc.collections.find((c) => c.key === 'arcana');
  check('collection totals come from the data', teas.total === TEAS.length && arcana.total === TAROT_CARDS.length);
  check('collection counts reflect the account', teas.count === 3 && arcana.count === 2, { teas: teas.count, arcana: arcana.count });
  check('a partial collection is not done', teas.done === false);

  // A visitor sees the HOST's trophies, not their own (empty) ones.
  const scVisitor = h.cottageShowcase('showowner', 'some_visitor');
  check('a visitor is not self', scVisitor.isSelf === false);
  check('a visitor sees the host\'s collection counts', scVisitor.collections.find((c) => c.key === 'teas').count === 3);

  // ── The handler resolves the host from the room instance ────────────────────
  owner.p.room = 'cottage'; owner.p.instance = 'home_showowner';
  owner.s.emit('message', JSON.stringify({ type: 'cottage_showcase' }));
  const r1 = owner.s.lastOfType('cottage_showcase');
  check('the owner in their cottage gets their own trophy wall', r1.ok === true && r1.isSelf === true);

  const guest = join('Guest', 'guestacct');
  guest.p.room = 'cottage'; guest.p.instance = 'home_showowner'; // visiting the owner's cottage
  guest.s.emit('message', JSON.stringify({ type: 'cottage_showcase' }));
  const r2 = guest.s.lastOfType('cottage_showcase');
  check('a visitor gets the host\'s wall, flagged not-self', r2.ok === true && r2.isSelf === false && r2.collections.find((c) => c.key === 'teas').count === 3);

  owner.p.room = 'outside'; owner.p.instance = '';
  owner.s.emit('message', JSON.stringify({ type: 'cottage_showcase' }));
  check('asking outside a cottage is refused', owner.s.lastOfType('cottage_showcase').ok === false);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
