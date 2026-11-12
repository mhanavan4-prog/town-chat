// Trade between the town and the Wilds (lib/shopTrade.js), against the real
// server: Dame Averil pays over for town goods, the town's shops pay over for
// what was gathered in the Wilds, and neither makes gold from nothing.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-shoptrade-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
require('../server.js');
const { TRADE } = require('../lib/shopTrade');

setTimeout(() => {
  const h = global.__testHooks, T = h.shopTrade, base = h.sellValueFor;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const sock = makeMockSocket('carrier');
  connHandler(sock);
  sock.emit('message', JSON.stringify({ type: 'join', name: 'Carrier' }));
  const player = h.players.get(sock.lastOfType('init').id);
  player.accountKey = 'carrier'; h.accounts.carrier = h.accounts.carrier || {};
  const say = (m) => { sock.sent.length = 0; sock.emit('message', JSON.stringify(m)); };

  check('Dame Averil pays over for town goods, and not for what grows at her own door', T.unitFor('npc_averil', 'wood') > base('wood') && T.unitFor('npc_averil', 'lumber_bundle') > base('lumber_bundle') && T.unitFor('npc_averil', 'pine_pitch') === base('pine_pitch') && T.unitFor('npc_averil', 'wolfsbane_bloom') === base('wolfsbane_bloom'));
  check('the town pays over for what was gathered in the Wilds, and not for its own', T.unitFor('npc_finn', 'pine_pitch') > base('pine_pitch') && T.unitFor('npc_mara', 'wolfsbane_bloom') > base('wolfsbane_bloom') && T.unitFor('npc_finn', 'crotal') > base('crotal') && T.unitFor('npc_finn', 'wood') === base('wood'));
  check('over is a quarter, and never less than a coin', T.unitFor('npc_averil', 'wood') === Math.max(base('wood') + 1, Math.round(base('wood') * (1 + TRADE.premium))) && T.unitFor('npc_finn', 'pine_pitch') >= base('pine_pitch') + 1);
  check('what nobody buys, nobody buys dearer', T.unitFor('npc_averil', 'hard_drive') === 0 && T.unitFor('npc_nobody', 'wood') === base('wood'));

  // No loop anywhere: nothing can be bought at any shop (regulars' rate) and sold at any shop for as much.
  const ids = new Set(Object.keys(h.SELL_VALUE_MAP)); const loops = [];
  for (const shop of Object.values(h.NPC_SHOPS)) for (const it of shop.items) ids.add(it.id);
  for (const id of ids) {
    let cheapest = Infinity;
    for (const shop of Object.values(h.NPC_SHOPS)) for (const it of shop.items) if (it.id === id) cheapest = Math.min(cheapest, Math.max(1, Math.round(it.price * 0.85)));
    for (const npcId of Object.keys(h.NPC_SHOPS)) if (T.unitFor(npcId, id) >= cheapest) loops.push([id, npcId, T.unitFor(npcId, id), cheapest]);
  }
  check('nothing can be bought at one shop and sold at another for a profit, regulars included', loops.length === 0, loops.slice(0, 5));
  check('and the better price is never the worse one', [...ids].every((id) => Object.keys(h.NPC_SHOPS).every((n) => T.unitFor(n, id) >= base(id))));

  // The shop window and the till agree.
  say({ type: 'npc_shop_open', npcId: 'npc_averil' });
  const st = sock.lastOfType('npc_shop_state');
  check('her window prices town goods over, says which, and says so', st && st.sellValues.wood === T.unitFor('npc_averil', 'wood') && st.prized.includes('wood') && !st.prized.includes('pine_pitch') && st.sellValues.pine_pitch === base('pine_pitch') && /pay over for anything from town/.test(st.greeting));
  const inv = h.getInventory(player); h.addItemToAccount(inv, 'wood', 4); h.addItemToAccount(inv, 'pine_pitch', 3);
  const bank = h.ensureBankAccount('carrier'); const g0 = bank.balance;
  say({ type: 'npc_sell_item', npcId: 'npc_averil', itemId: 'wood', qty: 4 });
  const sold = sock.lastOfType('shop_sold');
  check('four holly logs sold to her fetch her price, not the town\'s', sold && sold.gold === 4 * T.unitFor('npc_averil', 'wood') && bank.balance === g0 + sold.gold && sold.gold > 4 * base('wood'));
  say({ type: 'npc_shop_open', npcId: 'npc_finn' });
  const sf = sock.lastOfType('npc_shop_state');
  check('a town herbalist\'s window is the other way about', sf.prized.includes('pine_pitch') && !sf.prized.includes('wood') && /what grows out in the Wilds/.test(sf.greeting));
  const g1 = bank.balance;
  say({ type: 'npc_sell_item', npcId: 'npc_finn', itemId: 'pine_pitch', qty: 3 });
  check('pitch from the Wilds sold in town fetches the town\'s better price', sock.lastOfType('shop_sold').gold === 3 * T.unitFor('npc_finn', 'pine_pitch') && bank.balance === g1 + 3 * T.unitFor('npc_finn', 'pine_pitch'));

  const shop = fs.readFileSync(path.join(__dirname, '..', 'client/shop.js'), 'utf8');
  check('the Sell tab marks what a keeper pays over for and lists it first', /shopPrized = new Set\(msg\.prized \|\| \[\]\)/.test(shop) && /▲ pays over/.test(shop) && /ids\.sort\(\(p, q\) => \(shopPrized\.has\(q\)/.test(shop));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
