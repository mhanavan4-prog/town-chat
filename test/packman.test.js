// The packman at the Wildlands Village's stall (data/packman.js), against the
// real server: there only while the round of bound fires is closed, with four
// things from his pack each night, paying over for goods from either side.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-packman-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {},
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
const realNow = Date.now;
require('../server.js');
const { PACKMAN, stockFor } = require('../data/packman');
const { WARD } = require('../data/villageWard');
const SELL = require('../data/sellValues');

check('he names his tier, his sources and where the game leaves the record', PACKMAN.tier === 'record' && PACKMAN.lore.join(' ').length > 500 && /Spufford/.test(PACKMAN.source) && /is the game's/.test(PACKMAN.note));
check('four different things a night, not the same four two nights running, and everything in the pack comes round', [0, 1, 2, 3, 4, 5, 6, 7].every((c) => new Set(stockFor(c).map((x) => x.id)).size === PACKMAN.perNight && stockFor(c).map((x) => x.id).join() !== stockFor(c + 1).map((x) => x.id).join()) && new Set([0, 1, 2, 3, 4, 5, 6, 7].flatMap((c) => stockFor(c).map((x) => x.id))).size === PACKMAN.pool.length);
check('nothing in the pack is sold for less than twice what any shop would give for it', PACKMAN.pool.every((it) => it.price >= 2 * (SELL[it.id] || 0)));

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const sock = makeMockSocket('buyer');
  connHandler(sock);
  sock.emit('message', JSON.stringify({ type: 'join', name: 'Buyer' }));
  const player = h.players.get(sock.lastOfType('init').id);
  player.accountKey = 'buyer'; h.accounts.buyer = h.accounts.buyer || {};
  const CYCLE = 40 * 60 * 1000; // twenty minutes of day, then twenty of night (server.js CYCLE_MS)
  let t = Math.ceil(realNow() / CYCLE) * CYCLE - 5 * 60 * 1000;
  Date.now = () => t;
  const say = (m) => { sock.sent.length = 0; sock.emit('message', JSON.stringify(m)); };
  const atStall = () => Object.assign(player, { room: 'wilds', x: PACKMAN.x + 40, y: PACKMAN.y + 90, isDead: false });

  atStall(); say({ type: 'npc_shop_open', npcId: PACKMAN.npcId });
  check('on a night with no round closed the stall is shuttered, and you are read who he is', h.isNightNow() && !sock.lastOfType('npc_shop_state') && sock.sent.some((m) => m.type === 'toast' && /shuttered/.test(m.message)) && sock.sent.some((m) => m.type === 'vh_board' && m.lines.some((l) => /^Source: /.test(l))));
  say({ type: 'npc_buy_item', npcId: PACKMAN.npcId, itemId: PACKMAN.pool[0].id });
  check('and nothing can be bought from a man who is not there', !sock.lastOfType('shop_bought') && !!sock.lastOfType('shop_error'));

  for (const s of WARD.stones) { Object.assign(player, { x: s.x + 20, y: s.y + 40 }); say({ type: 'ward_use', id: s.id }); }
  check('the round is carried and closed', h.villageWard.isWarded());
  Object.assign(player, { x: 800, y: 800 }); say({ type: 'npc_shop_open', npcId: PACKMAN.npcId });
  check('he is spoken to at his stall, not from across the Wilds', !sock.lastOfType('npc_shop_state'));
  atStall(); say({ type: 'npc_shop_open', npcId: PACKMAN.npcId });
  const st = sock.lastOfType('npc_shop_state'), tonight = stockFor(Math.floor(t / CYCLE));
  check('with the round closed he is there, with tonight\'s four at his prices', st && st.npcName === PACKMAN.name && st.items.map((i) => i.id).join() === tonight.map((i) => i.id).join() && st.items.every((i, k) => i.price === tonight[k].price));
  check('he pays over for town goods and Wilds goods alike, and says so', st.prized.includes('wood') && st.prized.includes('pine_pitch') && /both markets/.test(st.greeting));
  check('meeting him is written down, once', sock.sent.some((m) => m.type === 'toast' && /the packman, met/.test(m.message)) && (say({ type: 'npc_shop_open', npcId: PACKMAN.npcId }), !sock.sent.some((m) => m.type === 'toast' && /the packman, met/.test(m.message))));
  const bank = h.ensureBankAccount('buyer'); bank.balance = 500; const g0 = bank.balance;
  say({ type: 'npc_buy_item', npcId: PACKMAN.npcId, itemId: tonight[0].id });
  check('a thing in tonight\'s pack can be bought at his price', sock.lastOfType('shop_bought') && bank.balance === g0 - tonight[0].price && h.countItemQty(h.getInventory(player), tonight[0].id) >= 1);
  const notTonight = PACKMAN.pool.find((p) => !tonight.some((x) => x.id === p.id));
  say({ type: 'npc_buy_item', npcId: PACKMAN.npcId, itemId: notTonight.id });
  check('a thing that is in the pack some other night cannot', !sock.lastOfType('shop_bought') && /isn't sold here/.test(sock.lastOfType('shop_error').message));
  h.addItemToAccount(h.getInventory(player), 'wood', 2); const g1 = bank.balance;
  say({ type: 'npc_sell_item', npcId: PACKMAN.npcId, itemId: 'wood', qty: 2 });
  check('and he buys at the better price', sock.lastOfType('shop_sold') && bank.balance === g1 + 2 * h.shopTrade.unitFor(PACKMAN.npcId, 'wood') && h.shopTrade.unitFor(PACKMAN.npcId, 'wood') > h.sellValueFor('wood'));
  t += 6 * 60 * 1000; // morning
  say({ type: 'npc_shop_open', npcId: PACKMAN.npcId });
  check('by morning he is gone', !h.isNightNow() && !sock.lastOfType('npc_shop_state') && sock.sent.some((m) => m.type === 'toast' && /shuttered/.test(m.message)));

  const main = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8'), scene = fs.readFileSync(path.join(__dirname, '..', 'client/wilds-scene.js'), 'utf8');
  check('the client marks the stall: his sign and lantern show only while the round is closed, and the prompt says which', /for \(const o of packmanMarks\) o\.visible = !!msg\.warded;/.test(scene) && /npc: 'packman', radius: 170/.test(scene) && /wardState\.warded \? 'see what the packman has' : 'look at the shuttered stall'/.test(main) && /type: 'npc_shop_open', npcId: 'npc_packman'/.test(main));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
