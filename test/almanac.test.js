// The Garden Almanac — the collection page of Green Path plants. Covers the
// discovery record (noteAlmanacDiscovery + the lazy holdings sweep) and the
// state body the garden panel renders. Mirrors the mock-socket harness.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-almanac-');

const { GREEN_PATH_CATEGORIES } = require('../data/greenPath.js');

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

// ── Pure data: the almanac mirrors the taxonomy exactly ──────────────────────
const TAXO_IDS = GREEN_PATH_CATEGORIES.flatMap((c) => c.plants.map((p) => p.id));
check('almanac covers all three categories', GREEN_PATH_CATEGORIES.length === 3);
check('every taxonomy plant has an id, name and lore', GREEN_PATH_CATEGORIES.every((c) => c.plants.every((p) => p.id && p.name && p.lore)));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];

  check('ALMANAC_PLANT_IDS matches the taxonomy', h.ALMANAC_PLANT_IDS.length === TAXO_IDS.length && TAXO_IDS.every((id) => h.ALMANAC_PLANT_IDS.includes(id)));

  function join(tag) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    return { s, p: h.players.get(s.lastOfType('init').id) };
  }

  const g = join('Botanist');
  g.p.accountKey = 'botanist';

  // A fresh account has discovered nothing.
  const a0 = h.almanacStateBody(g.p);
  check('a fresh almanac shows 0 discovered of the full set', a0 && a0.discovered === 0 && a0.total === TAXO_IDS.length, a0);
  check('the state groups plants by category with discovered flags', (() => {
    return a0.categories.length === 3 && a0.categories[0].plants.every((p) => p.discovered === false && p.name && p.lore);
  })());

  // Recording a plant marks exactly that one discovered.
  check('noteAlmanacDiscovery records a plant once', (() => {
    const first = h.noteAlmanacDiscovery(g.p, 'chamomile');
    const again = h.noteAlmanacDiscovery(g.p, 'chamomile');
    return first === true && again === false;
  })());
  const a1 = h.almanacStateBody(g.p);
  check('a recorded plant reads as discovered; others do not', (() => {
    const cottage = a1.categories.find((c) => c.id === 'cottage');
    const cham = cottage.plants.find((p) => p.id === 'chamomile');
    const cal = cottage.plants.find((p) => p.id === 'calendula');
    return a1.discovered === 1 && cham.discovered === true && cal.discovered === false;
  })());

  // A non-plant id (a brewed potion, say) is never an almanac entry.
  check('non-taxonomy items are not recordable', h.noteAlmanacDiscovery(g.p, 'chamomile_tisane') === false && h.almanacStateBody(g.p).discovered === 1);

  // The lazy holdings sweep records anything currently held (covers trades/gifts
  // that never went through a grant hook).
  h.addItemToAccount(h.getInventory(g.p), 'belladonna', 2);
  h.refreshAlmanacFromHoldings(g.p);
  check('the holdings sweep discovers a held plant', (() => {
    const bane = h.almanacStateBody(g.p).categories.find((c) => c.id === 'baneful');
    return bane.plants.find((p) => p.id === 'belladonna').discovered === true;
  })());

  // Discovery persists and the count climbs.
  check('discovered count reflects every recorded plant', h.almanacStateBody(g.p).discovered === 2);

  // A guest with no account gets a null almanac (never throws).
  const guest = join('Passerby');
  check('almanacStateBody is null without an account', h.almanacStateBody(guest.p) === null);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
