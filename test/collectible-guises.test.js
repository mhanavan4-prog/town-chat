// Collectible guises (roadmap #2) — the Otherworld Masks, a Moonstone-bought set
// on top of the free six. Drives the choose_guise handler: free guises stay free,
// a priced guise is bought once on first wear (balance deducted, owned account-
// wide), an unaffordable one is refused with no charge, a re-wear costs nothing,
// and gathering the whole set earns the Spirit-Clad title.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-guises-');

const { GUISES, GUISE_COLLECTIBLE, GUISE_SET_TITLE } = require('../data/guises.js');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
    clear() { this.sent.length = 0; },
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
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p };
  }
  const owned = (p) => (h.getProgress(p).guiseUnlocks || []);
  const titles = (p) => (h.getProgress(p).riteTitles || []);
  const wear = (s, gid) => s.emit('message', JSON.stringify({ type: 'choose_guise', guiseId: gid }));

  // Sanity on the data: a free set and a priced set that lines up with the title.
  const freeIds = Object.keys(GUISES).filter((id) => !(GUISES[id].ms > 0));
  check('there is a free guise set and a priced collectible set', freeIds.length >= 1 && GUISE_COLLECTIBLE.length >= 1, { free: freeIds.length, set: GUISE_COLLECTIBLE.length });
  check('every collectible guise carries a Moonstone price', GUISE_COLLECTIBLE.every((id) => GUISES[id].ms > 0));

  // ── A free guise costs nothing and needs no ownership ──────────────────────
  const w = join('Witch', 'g_witch');
  h.msAdjust('g_witch', 100);
  const bal0 = h.msBalance('g_witch');
  wear(w.s, freeIds[0]);
  check('a free guise is worn with no charge', w.p.guise === freeIds[0] && h.msBalance('g_witch') === bal0, { guise: w.p.guise, bal: h.msBalance('g_witch') });
  check('a free guise is not recorded as an unlock', owned(w.p).indexOf(freeIds[0]) === -1);

  // ── An unaffordable collectible guise is refused, no charge, not owned ─────
  const poor = join('Poor', 'g_poor');
  const dear = GUISE_COLLECTIBLE.slice().sort((a, b) => GUISES[b].ms - GUISES[a].ms)[0]; // priciest
  h.msAdjust('g_poor', GUISES[dear].ms - 1); // one short
  poor.s.clear();
  wear(poor.s, dear);
  check('an unaffordable guise is refused', poor.s.lastOfType('guise_error') !== null);
  check('the refused guise is not worn, not owned, and costs nothing', poor.p.guise !== dear && owned(poor.p).indexOf(dear) === -1 && h.msBalance('g_poor') === GUISES[dear].ms - 1);

  // ── Buy-on-first-wear: balance deducted once, owned account-wide ───────────
  const buyer = join('Buyer', 'g_buyer');
  // credit exactly the full set price
  const setCost = GUISE_COLLECTIBLE.reduce((s, id) => s + GUISES[id].ms, 0);
  h.msAdjust('g_buyer', setCost);
  const first = GUISE_COLLECTIBLE[0];
  const before = h.msBalance('g_buyer');
  wear(buyer.s, first);
  check('a collectible guise is bought on first wear (balance deducted)', h.msBalance('g_buyer') === before - GUISES[first].ms, h.msBalance('g_buyer'));
  check('the bought guise is now owned and worn', owned(buyer.p).indexOf(first) !== -1 && buyer.p.guise === first);
  check('the guise_state carries owned + balance', (() => { const st = buyer.s.lastOfType('guise_state'); return st && Array.isArray(st.owned) && st.owned.includes(first) && typeof st.balance === 'number'; })());

  // Re-wearing an owned guise costs nothing.
  const afterBuy = h.msBalance('g_buyer');
  wear(buyer.s, freeIds[0]); // switch away
  wear(buyer.s, first);      // and back
  check('re-wearing an owned guise costs nothing', h.msBalance('g_buyer') === afterBuy, h.msBalance('g_buyer'));

  // Doffing is free.
  wear(buyer.s, null);
  check('doffing (null) clears the guise for free', buyer.p.guise === null && h.msBalance('g_buyer') === afterBuy);

  // ── Completing the whole set earns the Spirit-Clad title (once) ────────────
  check('the set is not complete after one guise', titles(buyer.p).indexOf(GUISE_SET_TITLE) === -1);
  for (const id of GUISE_COLLECTIBLE.slice(1)) wear(buyer.s, id);
  check('owning all collectible guises grants the set title', titles(buyer.p).indexOf(GUISE_SET_TITLE) !== -1, titles(buyer.p));
  const titleCount = titles(buyer.p).filter((t) => t === GUISE_SET_TITLE).length;
  check('the set title is granted only once', titleCount === 1, titleCount);

  // A player who owns only part of the set has no title.
  const partial = join('Partial', 'g_partial');
  h.msAdjust('g_partial', setCost);
  wear(partial.s, GUISE_COLLECTIBLE[0]);
  check('a partial collection earns no title', titles(partial.p).indexOf(GUISE_SET_TITLE) === -1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
