// The Hedge line — plant dyes steeped from gathered dyestuff (+ gold for the
// mordant), and the dye catalog shipped from the server so the client's copy
// can't drift again (it had lost the Finery line and Ember).
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-plantdyes-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const { DYES, DYE_UNLOCKS, PLANT_DYE_LORE } = require('../data/wardrobe.js');
const ITEM_CATALOG = require('../data/itemCatalog.js');

function makeMockSocket(tag) {
  return {
    OPEN: 1, readyState: 1, sent: [], _handlers: {}, _tag: tag,
    on(e, cb) { this._handlers[e] = cb; },
    send(d) { this.sent.push(JSON.parse(d)); },
    emit(e, ...a) { if (this._handlers[e]) this._handlers[e](...a); },
    lastOfType(t) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === t) return this.sent[i]; return null; },
  };
}
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ── Catalog ──────────────────────────────────────────────────────────────────
const PLANT = Object.keys(DYE_UNLOCKS).filter((k) => DYE_UNLOCKS[k].steep);
check('six plant dyes are steepable', PLANT.length === 6, PLANT);
check('every plant dye is in the palette with a colour', PLANT.every((id) => { const d = DYES.find((x) => x.id === id); return d && typeof d.hex === 'number'; }));
check('every dyestuff is a real item', PLANT.every((id) => !!ITEM_CATALOG[DYE_UNLOCKS[id].steep.item]), PLANT.map((id) => DYE_UNLOCKS[id].steep.item));
check('every plant dye has lore, a mordant, a source and a tier', PLANT.every((id) => { const l = PLANT_DYE_LORE[id]; return l && l.lore && l.source && /^(alum|copperas|none)$/.test(l.mordant) && /^(record|folk|revival)$/.test(l.tier); }));
check('alder black uses copperas (iron), the recorded mordant for black', PLANT_DYE_LORE.alder_black.mordant === 'copperas');
check('crotal needs no mordant, so costs no gold', PLANT_DYE_LORE.crotal_brown.mordant === 'none' && DYE_UNLOCKS.crotal_brown.steep.gold === 0);
check('crotal carries the fishermen\'s belief from the record', /fishermen/.test(PLANT_DYE_LORE.crotal_brown.lore) && /Scots Language/.test(PLANT_DYE_LORE.crotal_brown.source));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  function join(tag, acct) {
    const s = makeMockSocket(tag); connHandler(s);
    s.emit('message', JSON.stringify({ type: 'join', name: tag, charId: 0 }));
    const p = h.players.get(s.lastOfType('init').id);
    if (acct) {
      p.accountKey = acct;
      h.accounts[acct] = h.accounts[acct] || { username: acct, miles: {} };
      h.playerProgress[acct] = h.playerProgress[acct] || { level: 1, xp: 0 };
    }
    return { s, p };
  }

  // ── The catalog ships in init ────────────────────────────────────────────────
  const g = join('Looker');
  const w = g.s.lastOfType('init').wardrobe;
  check('init ships the full dye palette', w && Array.isArray(w.dyes) && w.dyes.length === DYES.length, w && w.dyes && w.dyes.length);
  check('init ships the Finery and Ember dyes the client copy lacked', w && ['obsidian', 'pearl', 'ember'].every((id) => w.dyes.some((d) => d.id === id)));
  check('init ships the unlock rules and plant-dye lore', w && w.dyeUnlocks && w.dyeUnlocks.alder_black && w.dyeUnlocks.alder_black.steep && w.dyeLore && w.dyeLore.alder_black);
  check('init lists quest-earned dyes (none yet)', w && Array.isArray(w.dyesEarned) && w.dyesEarned.length === 0, w && w.dyesEarned);

  // ── Guests can't steep ───────────────────────────────────────────────────────
  g.s.emit('message', JSON.stringify({ type: 'steep_dye', dye: 'alder_black' }));
  check('a guest is told to sign in', (() => { const e = g.s.lastOfType('craft_error'); return e && /account/i.test(e.message); })());

  // ── An account steeps Alder Black ────────────────────────────────────────────
  const a = join('Dyer', 'hedgedyer');
  const inv = h.getInventory(a.p);
  const bank = h.ensureBankAccount('hedgedyer');
  bank.balance = 100;
  a.s.emit('message', JSON.stringify({ type: 'steep_dye', dye: 'alder_black' }));
  check('without the bark it refuses and names the item', (() => { const e = a.s.lastOfType('craft_error'); return e && /Alder Bark/.test(e.message); })());
  check('a refused steep records nothing', !(h.playerProgress.hedgedyer.dyeUnlocks || []).includes('alder_black'));
  check('a refused steep charges nothing', bank.balance === 100, bank.balance);

  h.addItemToAccount(inv, 'alder_bark', 5);
  bank.balance = 10;
  a.s.emit('message', JSON.stringify({ type: 'steep_dye', dye: 'alder_black' }));
  check('without the gold it refuses and names the mordant', (() => { const e = a.s.lastOfType('craft_error'); return e && /copperas/.test(e.message); })());
  check('a gold-short steep keeps the bark', h.countItemQty(inv, 'alder_bark') === 5, h.countItemQty(inv, 'alder_bark'));

  bank.balance = 100;
  const sentBefore = a.s.sent.length;
  a.s.emit('message', JSON.stringify({ type: 'steep_dye', dye: 'alder_black' }));
  const ok = a.s.lastOfType('dye_bought');
  check('steeping confirms with dye_bought', ok && ok.dye === 'alder_black' && a.s.sent.indexOf(ok) >= sentBefore);
  check('the confirmation carries the lore', ok && /copperas/.test(ok.message) && /Dwelly/.test(ok.message), ok && ok.message);
  check('it uses exactly four bark', h.countItemQty(inv, 'alder_bark') === 1, h.countItemQty(inv, 'alder_bark'));
  check('it charges the mordant from the bank', bank.balance === 60, bank.balance);
  check('the dye is recorded account-wide', (h.playerProgress.hedgedyer.dyeUnlocks || []).includes('alder_black'));

  a.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { dyeBody: 'alder_black' } }));
  check('a steeped dye can be worn', a.p.appearance && a.p.appearance.dyeBody === 'alder_black', a.p.appearance);
  a.s.emit('message', JSON.stringify({ type: 'set_appearance', appearance: { dyeAccent: 'whin_gold' } }));
  check('an un-steeped plant dye still clamps to natural', a.p.appearance.dyeAccent === 'none', a.p.appearance);

  h.addItemToAccount(inv, 'alder_bark', 4);
  a.s.emit('message', JSON.stringify({ type: 'steep_dye', dye: 'alder_black' }));
  check('re-steeping an owned dye costs nothing', h.countItemQty(inv, 'alder_bark') === 5 && bank.balance === 60);

  // ── Plant dyes can't be bought, and other dyes can't be steeped ─────────────
  a.s.emit('message', JSON.stringify({ type: 'buy_dye', dye: 'whin_gold' }));
  check('buy_dye refuses a plant dye', (() => { const e = a.s.lastOfType('ms_error'); return e && /sale/.test(e.message); })());
  a.s.emit('message', JSON.stringify({ type: 'steep_dye', dye: 'obsidian' }));
  check('steep_dye refuses a Finery dye', (() => { const e = a.s.lastOfType('craft_error'); return e && /steep/.test(e.message); })());

  // ── Crotal: stones in the Wilds, scraped for lichen, steeped free of gold ───
  const stones = h.WORLD2.natureDecor.filter((d) => d.type === 'crotal_stone');
  check('twelve crotal stones stand in the Wilds', stones.length === 12, stones.length);
  check('crotal stones have unique ids', new Set(stones.map((d) => d.id)).size === 12);
  check('a crotal stone yields crotal lichen', h.WILDS_FLORA_HARVEST.crotal_stone === 'crotal');
  check('crotal lichen is a real item', !!ITEM_CATALOG.crotal && ITEM_CATALOG.crotal.name === 'Crotal Lichen');
  h.addItemToAccount(inv, 'crotal', 4);
  const goldBefore = bank.balance;
  a.s.emit('message', JSON.stringify({ type: 'steep_dye', dye: 'crotal_brown' }));
  const cb = a.s.lastOfType('dye_bought');
  check('crotal brown steeps', cb && cb.dye === 'crotal_brown' && (h.playerProgress.hedgedyer.dyeUnlocks || []).includes('crotal_brown'));
  check('crotal brown takes the lichen and no gold', h.countItemQty(inv, 'crotal') === 0 && bank.balance === goldBefore, { crotal: h.countItemQty(inv, 'crotal'), bank: bank.balance });
  check('its message says it needs no mordant', cb && /boiled straight/.test(cb.message) && !/steeped with none/.test(cb.message), cb && cb.message);

  // ── Ember shows as earned once the Trials are done ──────────────────────────
  check('Ember is not earned before the Trials', !h.dyesEarnedFor(a.p).includes('ember'));
  h.playerProgress.hedgedyer.questsDone = Object.assign({}, h.playerProgress.hedgedyer.questsDone, { ashblood_ascension: true });
  check('a finished Ashblood arc lists Ember as earned', h.dyesEarnedFor(a.p).includes('ember'), h.dyesEarnedFor(a.p));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
