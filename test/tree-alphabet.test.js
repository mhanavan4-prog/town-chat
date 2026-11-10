// The Tree Alphabet — ogham few-staves (blueprint proposal C).
//
// Holds the promises: the twenty letters are the real ogham in their real four
// groups; every letter the game lets you carve names a wood that exists AND
// that some action yields; a stave costs its wood and is carved once; Hazel
// gives Coll (her own letter) after she brews for you, once; casting needs
// three staves, draws only from the staves you hold, and is stable for the day;
// and the honesty line about modern divination ships with it.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ogham-');

let pass = 0, fail = 0;
// A true carving of a letter, as a player would cut it against the stem.
function trueCuts(key) {
  const o = require('../data/ogham').OGHAM.find((x) => x.key === key);
  const cuts = [];
  for (let i = 0; i < o.n; i++) {
    const y = 120 + i * 12;
    if (o.aicme === 'B') cuts.push({ x1: 60, y1: y, x2: 95, y2: y });
    else if (o.aicme === 'H') cuts.push({ x1: 60, y1: y, x2: 25, y2: y });
    else if (o.aicme === 'M') cuts.push({ x1: 35, y1: y + 8, x2: 85, y2: y - 8 });
    else cuts.push({ x1: 60, y1: y, x2: 60, y2: y });
  }
  return cuts;
}
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}

const { OGHAM, OGHAM_CARVE_QTY, OGHAM_CAST, OGHAM_LORE } = require('../data/ogham');
const { POTION_RECIPES } = require('../data/gameConstants');

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

  // ── The real alphabet ─────────────────────────────────────────────────────
  check('twenty letters', OGHAM.length === 20);
  check('in four aicmí of five', ['B', 'H', 'M', 'A'].every((a) => OGHAM.filter((o) => o.aicme === a).map((o) => o.n).join() === '1,2,3,4,5'));
  check('in the traditional order, B L F S N · H D T C Q · M G NG ST R · A O U E I', OGHAM.map((o) => o.letter).join(' ') === 'B L F S N H D T C Q M G NG ST R A O U E I');
  check('Coll is the hazel', OGHAM.find((o) => o.key === 'coll').tree === 'Hazel');
  check('every letter has a kenning, its probable original meaning and a reading', OGHAM.every((o) => o.kenning && o.meaningOrig && o.reading));
  check('the honesty line ships: divination is a modern practice, no tree calendar', /modern practice/.test(OGHAM_LORE.provenance) && /Graves/.test(OGHAM_LORE.provenance));

  // Every carvable wood exists and something yields it (a Wilds tree, a garden,
  // a harvestable town tree, or Hazel's gift).
  const yielded = new Set(['wood', 'rowan_berry', 'hazel_rod']);
  for (const v of Object.values(h.WILDS_FLORA_HARVEST || {})) yielded.add(v);
  const carvable = OGHAM.filter((o) => o.wood);
  check(`${carvable.length} letters can be carved from woods in the game`, carvable.length === 20);
  for (const o of carvable) {
    check(`  ${o.name}: ${o.wood} is in the catalog and comes from somewhere`, !!h.ITEM_CATALOG[o.wood] && yielded.has(o.wood), o.wood);
  }

  // ── Carving ───────────────────────────────────────────────────────────────
  const a = join('Carver', 'og_a');
  const inv = h.getInventory(a.p);
  say(a.s, { type: 'ogham_carve', key: 'beith', cuts: trueCuts('beith') });
  check('no bark, no stave', !!a.s.lastOfType('ogham_error') && !(h.accounts.og_a.ogham && h.accounts.og_a.ogham.carved.includes('beith')));
  h.addItemToAccount(inv, 'birch_bark', OGHAM_CARVE_QTY);
  say(a.s, { type: 'ogham_carve', key: 'beith', cuts: trueCuts('beith') });
  check('birch bark carves Beith, and the bark is used', h.accounts.og_a.ogham.carved.includes('beith') && h.countItemQty(inv, 'birch_bark') === 0);
  h.addItemToAccount(inv, 'birch_bark', OGHAM_CARVE_QTY);
  a.s.sent.length = 0;
  say(a.s, { type: 'ogham_carve', key: 'beith', cuts: trueCuts('beith') });
  check('a letter is carved once', !!a.s.lastOfType('ogham_error') && h.countItemQty(inv, 'birch_bark') === OGHAM_CARVE_QTY);
  check('every letter\'s tree grows somewhere now — all twenty can be carved', OGHAM.every((o) => o.wood));

  // ── Hazel's gift ──────────────────────────────────────────────────────────
  const r = POTION_RECIPES.find((x) => x.id === 'chamomile_tisane');
  for (const i of r.ingredients) h.addItemToAccount(inv, i.id, i.qty * 2);
  a.p.room = 'witch_cave';
  say(a.s, { type: 'witch_craft', recipeId: r.id });
  check('Hazel gives a hazel rod the first time she brews for you', h.countItemQty(inv, 'hazel_rod') === 1);
  say(a.s, { type: 'witch_craft', recipeId: r.id });
  check('…only once', h.countItemQty(inv, 'hazel_rod') === 1);
  say(a.s, { type: 'ogham_carve', key: 'coll', cuts: trueCuts('coll') });
  check('the rod carves Coll', h.accounts.og_a.ogham.carved.includes('coll') && h.countItemQty(inv, 'hazel_rod') === 0);

  // ── Casting ───────────────────────────────────────────────────────────────
  a.s.sent.length = 0;
  say(a.s, { type: 'ogham_cast' });
  check(`casting needs ${OGHAM_CAST} staves`, !!a.s.lastOfType('ogham_error') && !a.s.lastOfType('ogham_cast'));
  h.addItemToAccount(inv, 'blackthorn', OGHAM_CARVE_QTY);
  say(a.s, { type: 'ogham_carve', key: 'straif', cuts: trueCuts('straif') });
  a.s.sent.length = 0;
  say(a.s, { type: 'ogham_cast' });
  const c = a.s.lastOfType('ogham_cast');
  const held = h.accounts.og_a.ogham.carved;
  check(`three staves fall`, c && c.cast.length === OGHAM_CAST, c);
  check('…only staves you hold', c && c.cast.every((x) => held.includes(x.key)));
  check('…three different staves', c && new Set(c.cast.map((x) => x.key)).size === OGHAM_CAST);
  say(a.s, { type: 'ogham_cast' });
  const c2 = a.s.lastOfType('ogham_cast');
  check('the cast is stable for the day', c2 && c2.already === true && JSON.stringify(c2.cast) === JSON.stringify(c.cast));
  say(a.s, { type: 'ogham_state' });
  check("the panel shows today's cast", JSON.stringify(a.s.lastOfType('ogham_state').today) === JSON.stringify(c.cast));

  // ── The whole grove pays once ─────────────────────────────────────────────
  const b = join('Grove', 'og_b');
  const binv = h.getInventory(b.p);
  const bal0 = h.ensureBankAccount('og_b').balance;
  for (const o of carvable) h.addItemToAccount(binv, o.wood, o.wood === 'hazel_rod' ? 1 : OGHAM_CARVE_QTY);
  for (const o of carvable) say(b.s, { type: 'ogham_carve', key: o.key, cuts: trueCuts(o.key) });
  check('every carvable stave can be carved', carvable.every((o) => h.accounts.og_b.ogham.carved.includes(o.key)), h.accounts.og_b.ogham.carved);
  check('the whole grove pays a purse, once', h.ensureBankAccount('og_b').balance > bal0 && h.accounts.og_b.ogham.groveDone === true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
