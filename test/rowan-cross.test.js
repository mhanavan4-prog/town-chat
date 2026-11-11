// The rowan cross over the door: the Scots way, two twigs bound with red
// thread and never knotted (Stewart; Gregor, as Black reports him); the Manx
// way, made without a knife (Moore). Each refused the way its record refuses.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-rowan-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
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

const { WARDS, ROWAN_WAYS, rowanProblem, WARD_GUARD } = require('../data/wards');
const { buildCharmBook } = require('../lib/charmBook');

// ── The record ──────────────────────────────────────────────────────────────
const R = WARDS.rowan;
check('the rowan cross is a ward entry, folk tier, over the door', R && R.tier === 'folk' && R.where === 'over the door' && R.lore && R.source);
check('Gregor\'s rhyme, word for word as he printed it (1881)', /"Rawn-tree in red-threed \/ Gars the witches tyne their speed"/.test(R.lore) && /Gregor.*1881.*p\. 188/.test(R.source));
check('Stewart\'s Beltane crosses in the lintels, and the one in the garment lining', /"formed into the shape of a cross, by means of a red thread"/.test(R.lore) && /"inserted in the different door-lintels in the town"/.test(R.lore) && /"between the lining and cloth of your garment"/.test(R.lore) && /Stewart.*pp\. 35, 181/.test(R.source));
check('no knot on the thread: Gregor to Black (1893)', /"that upon no account must there be a knot on the thread, or the charm will be of no use"/.test(R.lore) && /Black.*1893/.test(R.source));
check('the Manx crosses made without a knife and stuck over the doors (Moore, 1891, p. 110)', /"without the aid of a knife, which was on no account to be used"/.test(R.lore) && /"over the doors of the dwelling-houses and cow-houses"/.test(R.lore) && /Moore.*p\. 110/.test(R.source));
check('the Manx way says plainly that Moore does not say how the twigs were held, and whose word the game follows', /Moore does not say/.test(ROWAN_WAYS.manx.how) && /Clague \(1911\)/.test(ROWAN_WAYS.manx.how) && /Miller/.test(ROWAN_WAYS.manx.how));
check('the Scots way needs red thread and a sprig; the Manx only the sprig', JSON.stringify(ROWAN_WAYS.scots.parts.map((p) => p.id).sort()) === '["red_thread","rowan_berry"]' && JSON.stringify(ROWAN_WAYS.manx.parts.map((p) => p.id)) === '["rowan_berry"]');
check('nothing modern dressed as old: no druids, no nine sacred woods, no wool from a hedge', !/druid|nine sacred|hedge/i.test(R.lore + JSON.stringify(ROWAN_WAYS)));

// ── The rules ───────────────────────────────────────────────────────────────
check('Scots: a knot spoils it, with Gregor\'s words', /upon no account must there be a knot/.test(rowanProblem({ way: 'scots', tool: 'hand', finish: 'knot' })));
check('Scots: a knife is fine (the Angus cross was "cut and peeled"), if the end is tucked', rowanProblem({ way: 'scots', tool: 'knife', finish: 'tuck' }) === null);
check('Manx: a knife spoils it, with Moore\'s words', /without the aid of a knife/.test(rowanProblem({ way: 'manx', tool: 'knife' })));
check('Manx: broken by hand, it is right', rowanProblem({ way: 'manx', tool: 'hand' }) === null);
check('no way chosen, or the twigs not taken: refused', !!rowanProblem({}) && !!rowanProblem({ way: 'scots' }) && !!rowanProblem({ way: 'scots', tool: 'hand' }));

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
  const err = (s) => { const e = s.lastOfType('wards_error'); return e ? e.message : ''; };

  const shopItems = new Set();
  for (const shop of Object.values(h.NPC_SHOPS || {})) for (const it of shop.items) shopItems.add(it.id);
  check('red thread is in the catalog and sold in town', !!h.ITEM_CATALOG.red_thread && shopItems.has('red_thread'));

  const a = join('Lintel', 'rowan_a');
  const inv = h.getInventory(a.p);
  goHome(a.p);
  say(a.s, { type: 'make_rowan_cross', way: 'scots', tool: 'hand', finish: 'tuck' });
  check('without the rowan and thread it is refused, saying where they come from', /Green Path|Tailor Ines/.test(err(a.s)) && !(h.accounts.rowan_a.wards && h.accounts.rowan_a.wards.rowan), err(a.s));
  h.addItemToAccount(inv, 'rowan_berry', 1); h.addItemToAccount(inv, 'red_thread', 1);
  say(a.s, { type: 'make_rowan_cross', way: 'scots', tool: 'hand', finish: 'knot' });
  check('knotted, it is refused and nothing is used up', /knot/.test(err(a.s)) && h.countItemQty(inv, 'red_thread') === 1 && h.countItemQty(inv, 'rowan_berry') === 1);
  a.p.room = 'outside'; a.p.instance = '';
  say(a.s, { type: 'make_rowan_cross', way: 'scots', tool: 'hand', finish: 'tuck' });
  check('it is set over your own door, not out in the street', /home/.test(err(a.s)) && !h.accounts.rowan_a.wards.rowan);
  goHome(a.p);
  const guard0 = h.statContrib(a.p, 'guard');
  say(a.s, { type: 'make_rowan_cross', way: 'scots', tool: 'hand', finish: 'tuck' });
  const w = h.accounts.rowan_a.wards;
  check('made the Scots way: over the door, the rowan and thread used', w.rowan && w.rowan.way === 'scots' && h.countItemQty(inv, 'red_thread') === 0 && h.countItemQty(inv, 'rowan_berry') === 0);
  check('…it wards the house like the other marks', Math.abs(h.statContrib(a.p, 'guard') - guard0 - WARD_GUARD) < 1e-9);
  check('…the house shows it, and which way it was made', h.wardsPublic('rowan_a').rowan === 'scots');
  check('…the toast says it was never knotted', /never knotted/.test(a.s.lastOfType('toast').message));
  h.addItemToAccount(inv, 'rowan_berry', 1);
  say(a.s, { type: 'make_rowan_cross', way: 'manx', tool: 'hand' });
  check('one over the door is enough', /already/.test(err(a.s)) && h.countItemQty(inv, 'rowan_berry') === 1);
  const book = buildCharmBook({ acct: h.accounts.rowan_a, prog: {}, seasonKey: null });
  check('the Charm Book marks the rowan cross met', book.chapters.find((c) => c.key === 'wards').entries.find((e) => e.id === 'rowan').met === true);

  const b = join('Manxwoman', 'rowan_b');
  const invb = h.getInventory(b.p);
  goHome(b.p);
  h.addItemToAccount(invb, 'rowan_berry', 1);
  say(b.s, { type: 'make_rowan_cross', way: 'manx', tool: 'knife' });
  check('the Manx way with a knife is refused', /knife/.test(err(b.s)) && !(h.accounts.rowan_b.wards && h.accounts.rowan_b.wards.rowan));
  say(b.s, { type: 'make_rowan_cross', way: 'manx', tool: 'hand' });
  check('broken by hand, the Manx cross goes up, needing no thread', h.accounts.rowan_b.wards.rowan && h.accounts.rowan_b.wards.rowan.way === 'manx' && /never cut/.test(b.s.lastOfType('toast').message));
  const st = h.wardsStateBody(b.p);
  check('the panel has both ways, with what each needs', st.rowanWays && st.rowanWays.scots.parts.length === 2 && st.rowanWays.manx.parts.length === 1 && st.lore.rowan);

  const wardsJs = fs.readFileSync(path.join(__dirname, '../client/wards.js'), 'utf8');
  const cottage = fs.readFileSync(path.join(__dirname, '../client/cottage-scene.js'), 'utf8');
  check('the Wards panel offers both ways, the twigs by hand or knife, and a knot or a tuck', /function rowanCard/.test(wardsJs) && /function renderRowan/.test(wardsJs) && /Tie it off with a knot/.test(wardsJs) && /Tuck the end under the winding/.test(wardsJs) && /Cut them with your knife/.test(wardsJs) && /type: 'make_rowan_cross'/.test(wardsJs));
  check('the cottage draws the cross over the door, with red thread only the Scots way', /if \(w\.rowan\)/.test(cottage) && /rowanCross/.test(cottage) && /if \(w\.rowan !== 'manx'\)/.test(cottage));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
