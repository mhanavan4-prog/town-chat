// The ogham grove's harvest is worth carrying. Each of the ten new materials
// was good for one ogham stave and then dead weight; now every one has a second
// use, and each use is checked through the real handler:
//   Hazel brews elder rob, haw cordial and the white heather charm; yew wood
//   binds a Yew Wand; gorse feeds the town bonfire; and callers ask for aspen,
//   ivy, ash keys, alder bark and white heather. Also holds the fix for earned
//   items leaking into a new player's random starters.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-groveuse-');

let pass = 0, fail = 0;
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

const { POTION_RECIPES } = require('../data/gameConstants');
const { CALLERS } = require('../data/callers');
const { NINE_HERBS } = require('../data/nineHerbs');
const GROVE = ['alder_bark', 'ash_key', 'haw', 'crab_apple', 'ivy_leaf', 'elderberry', 'gorse_bloom', 'heather_sprig', 'aspen_leaf', 'yew_wood'];

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
    p.accountKey = key; h.accounts[key] = {};
    return { s, p };
  }

  // ── Every material has a use beyond its stave ────────────────────────────
  const uses = {};
  for (const id of GROVE) uses[id] = [];
  for (const r of POTION_RECIPES) for (const i of r.ingredients) if (uses[i.id]) uses[i.id].push('recipe:' + r.id);
  for (const c of CALLERS) for (const st of c.steps) if (st.kind === 'deliver' && uses[st.item]) uses[st.item].push('caller:' + c.id);
  for (const k of Object.values(h.WAND_KINDS)) if (uses[k.wood]) uses[k.wood].push('wand:' + k.wand);
  uses.gorse_bloom.push(...(h.townBonfireState ? ['bonfire'] : []));
  for (const n of NINE_HERBS) if (uses[n.id]) uses[n.id].push('nine-herbs');
  for (const id of GROVE) check(`${id} has a use beyond its ogham stave`, uses[id].length > 0, uses[id]);
  // The white heather charm counts for heather (it's brewed from it, and a caller asks for it).
  check('a caller asks for the white heather charm', CALLERS.some((c) => c.steps.some((s) => s.item === 'white_heather_charm')));

  // ── Hazel brews them ─────────────────────────────────────────────────────
  const a = join('Brewer', 'gu_a');
  const inv = h.getInventory(a.p);
  a.p.room = 'witch_cave';
  for (const [rid, ing] of [['elder_rob', 'elderberry'], ['haw_cordial', 'haw'], ['white_heather_charm', 'heather_sprig']]) {
    h.addItemToAccount(inv, ing, 2);
    a.s.sent.length = 0;
    say(a.s, { type: 'witch_craft', recipeId: rid });
    check(`Hazel brews ${rid} from 2× ${ing}`, h.countItemQty(inv, rid) === 1 && h.countItemQty(inv, ing) === 0, a.s.lastOfType('witch_craft_error'));
  }

  // ── The Yew Wand ─────────────────────────────────────────────────────────
  a.p.room = 'outside';
  h.addItemToAccount(inv, 'yew_wood', 4);
  a.s.sent.length = 0;
  say(a.s, { type: 'craft_wand', wood: 'yew_wood' });
  check('four yew wood is not enough', !!a.s.lastOfType('craft_error') && h.countItemQty(inv, 'yew_wand') === 0);
  h.addItemToAccount(inv, 'yew_wood', 1);
  say(a.s, { type: 'craft_wand', wood: 'yew_wood' });
  check('five yew wood binds a Yew Wand', h.countItemQty(inv, 'yew_wand') === 1 && h.countItemQty(inv, 'yew_wood') === 0);
  check('…and it is a real weapon with stats', h.ITEM_CATALOG.yew_wand.slot === 'weapon' && h.EQUIP_STATS.yew_wand && h.EQUIP_STATS.yew_wand.power > 0);
  h.addItemToAccount(inv, 'wood', 5);
  say(a.s, { type: 'craft_wand' });
  check('the Holly Wand still binds as before', h.countItemQty(inv, 'holly_wand') === 1 && h.countItemQty(inv, 'wood') === 0);

  // ── Gorse on the bonfire ─────────────────────────────────────────────────
  h.ensureTownBonfire();
  const bf0 = h.townBonfireState(a.p);
  h.addItemToAccount(inv, 'gorse_bloom', 3);
  check('the bonfire panel offers your gorse', (h.townBonfireState(a.p).offer || []).some((o) => o.id === 'gorse_bloom' && o.have === 3));
  say(a.s, { type: 'bonfire_offer', herb: 'gorse_bloom', qty: 3 });
  const bf1 = h.townBonfireState(a.p);
  check('gorse feeds the town fire', !bf0.lit && h.countItemQty(inv, 'gorse_bloom') === 0 && bf1.progress === bf0.progress + 3, { left: h.countItemQty(inv, 'gorse_bloom'), before: bf0.progress, after: bf1.progress });
  h.addItemToAccount(inv, 'glass_vial', 1);
  say(a.s, { type: 'bonfire_offer', herb: 'glass_vial', qty: 1 });
  check('…but not just anything', h.countItemQty(inv, 'glass_vial') === 1);

  // ── Earned things are never random starters ──────────────────────────────
  check('the random starter pool leaves out everything earned', [...h.STARTER_EXCLUDED].every((id) => !h.ITEM_IDS.includes(id)) && ['witch_bottle', 'wind_cord_3', 'hazel_rod', 'yew_wand', 'holly_wand'].every((id) => h.STARTER_EXCLUDED.has(id)));
  let leaked = [];
  for (let i = 0; i < 300; i++) {
    const bank = h.ensureBankAccount('gu_bank_' + i);
    for (const sl of bank.slots) if (sl && h.STARTER_EXCLUDED.has(sl.itemId)) leaked.push(sl.itemId);
  }
  check('300 new banks: no earned item handed out at random', leaked.length === 0, leaked);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 700);
