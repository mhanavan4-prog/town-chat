// The witch's ladder (after the Wellington ladder, Pitt Rivers 1911.32.7):
// cord + cock's feathers, hung at home; harvest luck, never guard — because no
// one who wrote about the real one thought it was a protection.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-ladder-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

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

const { WARDS, LADDER_FORAGE, LADDER_FORAGE_HEARTH, LADDER_PARTS } = require('../data/wards');
const { buildCharmBook } = require('../lib/charmBook');

// ── The lore keeps the honest uncertainty ────────────────────────────────────
const L = WARDS.ladder;
check('the ladder is a ward entry with the house-ward fields', L && L.name && L.icon && L.where && L.blurb && L.lore && L.source);
check('its source is the Pitt Rivers object and Colles 1887', /1911\.32\.7/.test(L.source) && /Colles/.test(L.source) && /1887/.test(L.source));
check('the lore gives all four explanations, not one', ['ladder for witches', 'milk', 'sewel', 'birds'].every((w) => L.lore.includes(w)), L.lore);
check('…and says plainly the purpose is unknown', /honestly unknown/.test(L.lore));
check('it is cord and feathers', JSON.stringify(LADDER_PARTS.map((p) => p.id).sort()) === '["cock_feathers","hemp_cord"]');

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
  const goHome = (p) => { p.room = 'cottage'; p.instance = 'home_' + p.accountKey; };

  const shopItems = new Set();
  for (const shop of Object.values(h.NPC_SHOPS || {})) for (const it of shop.items) shopItems.add(it.id);
  check('both parts are sold in town', LADDER_PARTS.every((p) => shopItems.has(p.id)));
  check('the catalog knows the feathers', !!h.ITEM_CATALOG.cock_feathers);

  const a = join('Roofer', 'ladder_a');
  const inv = h.getInventory(a.p);
  goHome(a.p);
  say(a.s, { type: 'hang_witch_ladder' });
  check('without the parts it refuses and points to the tailor', (() => { const e = a.s.lastOfType('wards_error'); return e && /Tailor Ines/.test(e.message); })());

  for (const pt of LADDER_PARTS) h.addItemToAccount(inv, pt.id, pt.qty);
  a.p.room = 'outside'; a.p.instance = '';
  say(a.s, { type: 'hang_witch_ladder' });
  check('it is hung at home, not out in the street', (() => { const e = a.s.lastOfType('wards_error'); return e && /home/.test(e.message); })() && !(h.accounts.ladder_a.wards && h.accounts.ladder_a.wards.ladder));

  goHome(a.p);
  const guard0 = h.statContrib(a.p, 'guard'), forage0 = h.statContrib(a.p, 'forage');
  say(a.s, { type: 'hang_witch_ladder' });
  check('hanging it records the ladder', !!(h.accounts.ladder_a.wards && h.accounts.ladder_a.wards.ladder));
  check('it uses up the cord and the feathers', LADDER_PARTS.every((pt) => h.countItemQty(inv, pt.id) === 0));
  check(`it adds +${LADDER_FORAGE * 100}% harvest luck`, Math.abs(h.statContrib(a.p, 'forage') - forage0 - LADDER_FORAGE) < 1e-9, { before: forage0, after: h.statContrib(a.p, 'forage') });
  check('…and no guard at all (it was never a protection)', Math.abs(h.statContrib(a.p, 'guard') - guard0) < 1e-9);
  const st = a.s.lastOfType('wards_state');
  check('the wards panel shows it hung', st && st.ladder === true);
  check('the house carries it for visitors to see', h.wardsPublic('ladder_a').ladder === true);
  for (const pt of LADDER_PARTS) h.addItemToAccount(inv, pt.id, pt.qty);
  say(a.s, { type: 'hang_witch_ladder' });
  check('one per house', (() => { const e = a.s.lastOfType('wards_error'); return e && /already/.test(e.message); })() && LADDER_PARTS.every((pt) => h.countItemQty(inv, pt.id) === pt.qty));

  h.accounts.ladder_a.witchPath = 'hearth';
  check('a Hearth Witch draws more', Math.abs(h.wardContrib(a.p, 'forage') - LADDER_FORAGE_HEARTH) < 1e-9);
  const book = buildCharmBook({ acct: h.accounts.ladder_a, prog: {}, seasonKey: null });
  check('the Charm Book marks it met', book.chapters.find((c) => c.key === 'wards').entries.find((e) => e.id === 'ladder').met === true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
