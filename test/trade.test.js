// lib/trade.js: nothing moves until both are ready, a changed offer un-readies
// both, and the swap is all or nothing.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const fs = require('fs'), path = require('path');

function world(slotsA = 4, slotsB = 4) {
  const players = new Map(), sent = [], inv = {}, bank = {};
  const mk = (id, name, key, slots) => { const p = { id, name, accountKey: key, room: 'outside', ws: { id } }; players.set(id, p); if (key) { inv[key] = { slots: new Array(slots).fill(null) }; bank[key] = { balance: 100 }; } return p; };
  const add = (a, id, q) => { const e = a.slots.find((s) => s && s.itemId === id); if (e) { e.qty += q; return true; } const i = a.slots.findIndex((s) => !s); if (i < 0) return false; a.slots[i] = { itemId: id, qty: q }; return true; };
  const count = (a, id) => a.slots.reduce((n, s) => n + (s && s.itemId === id ? s.qty : 0), 0);
  const rem = (a, id, q) => { if (count(a, id) < q) return false; let r = q; for (let i = 0; i < a.slots.length && r > 0; i++) { const s = a.slots[i]; if (!s || s.itemId !== id) continue; const t = Math.min(s.qty, r); s.qty -= t; r -= t; if (!s.qty) a.slots[i] = null; } return true; };
  let saves = 0; const logs = [];
  const blocked = new Set();
  const T = require('../lib/trade')({ players, send: (ws, m) => sent.push([ws.id, m]), invOf: (p) => inv[p.accountKey], bankOf: (p) => bank[p.accountKey],
    addItem: add, removeItem: rem, countItem: count, itemName: (id) => id.toUpperCase(), blocks: (r, s) => blocked.has(r.id + '>' + s.id), save: () => { saves++; }, log: (l) => logs.push(l) });
  const a = mk('1', 'Ada', 'ada', slotsA), b = mk('2', 'Bea', 'bea', slotsB), g = mk('3', 'Wren', null, 0);
  return { T, a, b, g, inv, bank, add, count, sent, logs, blocked, saves: () => saves, last: (id, type = 'trade_state') => [...sent].reverse().find((e) => e[0] === id && e[1].type === type)[1], open() { T.ask(a, '2'); T.answer(b, '1', true); } };
}

{
  const w = world();
  check('a guest cannot trade, either way', !!w.T.ask(w.g, '1').error && /guest/.test(w.T.ask(w.a, '3').error));
  w.b.room = 'wilds';
  check('you must be in the same place', /same place/.test(w.T.ask(w.a, '2').error));
  w.b.room = 'outside';
  check('asking tells the other', w.T.ask(w.a, '2').ok && w.last('2', 'trade_asked').fromName === 'Ada');
  check('saying no tells the asker and opens nothing', w.T.answer(w.b, '1', false).ok && w.last('1').open === false && !w.T.inTrade(w.a));
  w.blocked.add('2>1'); const n = w.sent.length;
  check('asking someone who blocked you looks asked and goes nowhere', w.T.ask(w.a, '2').ok && w.sent.length === n);
}

{
  const w = world(); w.add(w.inv.ada, 'herb', 5); w.add(w.inv.bea, 'ring', 1);
  w.open();
  check('saying yes opens the table for both', w.last('1').open && w.last('2').open && w.last('1').with.name === 'Bea');
  w.T.offer(w.a, { gold: 30, items: [{ itemId: 'herb', qty: 3 }] });
  w.T.offer(w.b, { gold: 0, items: [{ itemId: 'ring', qty: 1 }] });
  check('each sees both offers, with names', w.last('2').theirs.gold === 30 && w.last('2').theirs.items[0].name === 'HERB' && w.last('1').theirs.items[0].itemId === 'ring');
  w.T.ready(w.a, true);
  check('one ready moves nothing', w.count(w.inv.ada, 'herb') === 5 && w.last('2').ready.them === true && w.last('2').ready.me === false);
  w.T.offer(w.b, { gold: 0, items: [] });
  check('changing an offer un-readies both', w.last('1').ready.me === false && w.last('1').ready.them === false);
  w.T.offer(w.b, { gold: 0, items: [{ itemId: 'ring', qty: 1 }] });
  w.T.ready(w.a, true); const r = w.T.ready(w.b, true);
  check('both ready: goods and gold change hands', r.ok && w.count(w.inv.ada, 'herb') === 2 && w.count(w.inv.bea, 'herb') === 3 && w.count(w.inv.ada, 'ring') === 1 && w.count(w.inv.bea, 'ring') === 0 && w.bank.ada.balance === 70 && w.bank.bea.balance === 130);
  check('the table closes, saved and logged', w.last('1').open === false && w.last('1').done === true && !w.T.inTrade(w.a) && w.saves() === 1 && w.logs.length === 1);
}

{
  const w = world(); w.add(w.inv.ada, 'herb', 2);
  w.open();
  w.T.offer(w.a, { gold: 5000, items: [{ itemId: 'herb', qty: 99 }, { itemId: 'moon', qty: 1 }, { itemId: 'herb', qty: -3 }] });
  const o = w.last('1').mine;
  check('an offer is cut to what is truly held', o.gold === 100 && o.items.length === 1 && o.items[0].qty === 2);
  check('nothing on the table cannot be agreed', (w.T.offer(w.a, {}), w.T.ready(w.a, true), !!w.T.ready(w.b, true).error) && w.T.inTrade(w.a));
}

{
  // all or nothing: Bea's pack is full
  const w = world(4, 1); w.add(w.inv.ada, 'herb', 2); w.add(w.inv.bea, 'stone', 1);
  w.open();
  w.T.offer(w.a, { gold: 10, items: [{ itemId: 'herb', qty: 2 }] });
  w.T.ready(w.a, true); const r = w.T.ready(w.b, true);
  check('a full pack stops the trade with nothing moved', !!r.error && /room/.test(r.error) && w.count(w.inv.ada, 'herb') === 2 && w.bank.ada.balance === 100 && w.bank.bea.balance === 100 && w.T.inTrade(w.a));
  check('and both are told why', /room/.test(w.last('1', 'trade_note').message) && w.last('2').ready.me === false);
}

{
  // goods spent between offering and agreeing
  const w = world(); w.add(w.inv.ada, 'herb', 2);
  w.open(); w.T.offer(w.a, { items: [{ itemId: 'herb', qty: 2 }] });
  w.inv.ada.slots[0] = null;
  w.T.ready(w.a, true); const r = w.T.ready(w.b, true);
  check('goods no longer held stop the trade', !!r.error && /Ada no longer has/.test(r.error) && w.count(w.inv.bea, 'herb') === 0);
}

{
  const w = world(); w.open();
  check('calling it off tells both', w.T.cancel(w.a) && w.last('2').open === false && /Ada called off/.test(w.last('2').message));
  w.open(); w.b.room = 'wilds'; w.T.tick();
  check('walking apart clears the table', !w.T.inTrade(w.a) && /parted/.test(w.last('1').message));
  w.b.room = 'outside'; w.open(); w.T.ask(w.a, '2');
  check('one trade at a time', /already/.test(w.T.ask(w.a, '2').error));
}

{
  const srv = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  check('leaving the game calls off a trade', /trade\.cancel\(player, [^)]*\);[^\n]*\n[^\n]*friends\.presence\(player, false\)|friends\.presence\(player, false\)[^\n]*\n[^\n]*trade\.cancel\(player/.test(srv));
  check('a trade is written to the audit log', /type: 'trade'/.test(srv));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
