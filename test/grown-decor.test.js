// Grow-your-own decor — pot up a plant you raised on the Green Path into placeable
// cottage furniture (garden ↔ housing). Covers the catalog (grown pieces carry
// plant/cost/tint and start unowned), the pot_decor handler (spends the herb,
// unlocks the piece, is idempotent), and the refusal when you're short.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-grown-');

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
  };
}

// ── Pure data: the grown tier is well-formed ───────────────────────────────────
const grown = FURNITURE.filter((f) => f.source === 'grown');
check('there is a grown-decor tier', grown.length >= 4, grown.length);
check('every grown piece names a plant + a cost + a foliage tint', grown.every((f) => f.plant && f.cost > 0 && typeof f.tint === 'number'));
check('grown pieces are not free (not the default set)', grown.every((f) => f.source !== 'default'));

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
  const invCount = (p, id) => { const inv = h.getInventory(p); let n = 0; for (const it of (inv.slots || inv)) if (it && it.itemId === id) n += (it.qty || 1); return n; };

  const g = join('Potter', 'potter');
  const piece = grown[0];
  const owns = () => (h.getProgress(g.p).furnitureUnlocks || []).indexOf(piece.id) !== -1;

  // The catalog ships grown pieces, unowned, with their cost + tint.
  const cat = h.homeStateBody(g.p).catalog.find((c) => c.id === piece.id);
  check('the home catalog carries the grown piece, unowned', cat && cat.owned === false && cat.cost === piece.cost && cat.tint === piece.tint, cat);

  // ── Short on the herb: refused, nothing spent ───────────────────────────────
  g.s.emit('message', JSON.stringify({ type: 'pot_decor', pieceId: piece.id }));
  check('potting with no herbs is refused', !owns());
  check('a refusal explains what to grow', /need|grow/i.test((g.s.lastOfType('toast') || {}).message || ''));

  // ── With the harvest: pots up, spends exactly the cost ──────────────────────
  h.grantLoot([{ kind: 'item', itemId: piece.plant, qty: piece.cost + 3 }], g.p);
  const before = invCount(g.p, piece.plant);
  g.s.emit('message', JSON.stringify({ type: 'pot_decor', pieceId: piece.id }));
  check('potting up unlocks the piece', owns());
  check('potting spends exactly its cost', invCount(g.p, piece.plant) === before - piece.cost, { before, after: invCount(g.p, piece.plant), cost: piece.cost });
  check('the catalog now reports it owned', h.homeStateBody(g.p).catalog.find((c) => c.id === piece.id).owned === true);

  // ── Idempotent: re-potting an owned piece spends nothing ────────────────────
  const held = invCount(g.p, piece.plant);
  g.s.emit('message', JSON.stringify({ type: 'pot_decor', pieceId: piece.id }));
  check('re-potting an owned piece costs nothing', invCount(g.p, piece.plant) === held && owns());

  // ── A non-grown piece can't be potted ───────────────────────────────────────
  const premium = FURNITURE.find((f) => f.source === 'premium');
  g.s.emit('message', JSON.stringify({ type: 'pot_decor', pieceId: premium.id }));
  check('a premium piece cannot be potted up', (h.getProgress(g.p).furnitureUnlocks || []).indexOf(premium.id) === -1);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
