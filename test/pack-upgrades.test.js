// Bag tiers: a used bag permanently grows the pack (+8 / +16 / +32 over the
// base 24). A better bag replaces a lesser one; bonuses never stack.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-packs-');

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
  // Put a bag in the pack and use it. With no free slot the bag cannot be held
  // at all, which is the whole chicken-and-egg — that path is covered below.
  function useBag(g, bagId) {
    const inv = h.getInventory(g.p);
    h.addItemToAccount(inv, bagId, 1);
    const idx = inv.slots.findIndex((s) => s && s.itemId === bagId);
    g.s.emit('message', JSON.stringify({ type: 'use_item', slotIdx: idx }));
    return h.getInventory(g.p);
  }

  const BASE = h.PACK_BASE_SLOTS;
  const a = join('Hauler', 'pack_a');
  check('a new pack is the base size', h.packCapacity(a.p) === BASE && h.getInventory(a.p).slots.length === BASE, { cap: h.packCapacity(a.p), len: h.getInventory(a.p).slots.length });

  // ── +8 ────────────────────────────────────────────────────────────────────
  let inv = useBag(a, 'pack_satchel');
  check('the satchel adds 8 slots', h.packCapacity(a.p) === BASE + 8, h.packCapacity(a.p));
  check('the pack really grew', inv.slots.length === BASE + 8, inv.slots.length);
  check('the bag itself is spent', h.countItemQty(inv, 'pack_satchel') === 0);
  check('the player is told the new size', new RegExp(String(BASE + 8)).test((a.s.lastOfType('use_result') || {}).message || ''), (a.s.lastOfType('use_result') || {}).message);

  // ── a better bag replaces, it does not stack ──────────────────────────────
  inv = useBag(a, 'pack_witchwoven');
  check('the witchwoven pack takes it to +32, not +40', h.packCapacity(a.p) === BASE + 32, h.packCapacity(a.p));

  // ── a lesser bag is refused and kept ──────────────────────────────────────
  inv = useBag(a, 'pack_hide');
  check('a smaller bag does not shrink the pack', h.packCapacity(a.p) === BASE + 32, h.packCapacity(a.p));
  check('and the refused bag stays in the satchel', h.countItemQty(inv, 'pack_hide') === 1, h.countItemQty(inv, 'pack_hide'));
  check('the refusal says why', /downgrade/i.test((a.s.lastOfType('use_result') || {}).message || ''), (a.s.lastOfType('use_result') || {}).message);

  // ── the extra room is usable ──────────────────────────────────────────────
  const b = join('Filler', 'pack_b');
  const binv = h.getInventory(b.p);
  for (let i = 0; i < binv.slots.length; i++) binv.slots[i] = { itemId: 'filler' + i, qty: 1 };
  check('the base pack is now full', h.addItemToAccount(binv, 'unique_thing', 1) === false);
  // A pack with no free slot cannot even hold a bag — applying it must not
  // require one, or the upgrade is unreachable exactly when it is needed.
  const upB = h.applyPackUpgrade(b.p, 'pack_hide');
  check('a bag applies with no free slot at all', !!(upB && upB.applied), upB);
  check('after a +16 bag there is room again', h.addItemToAccount(h.getInventory(b.p), 'unique_thing', 1) === true);
  check('capacity is base + 16', h.packCapacity(b.p) === BASE + 16, h.packCapacity(b.p));

  // ── a held reward lands as soon as the bag makes room ─────────────────────
  const c = join('Waiting', 'pack_c');
  const cinv = h.getInventory(c.p);
  for (let i = 0; i < cinv.slots.length; i++) cinv.slots[i] = { itemId: 'filler' + i, qty: 1 };
  h.grantRewardItems(c.p, [{ itemId: 'mugwort', qty: 2 }], 'test');
  check('the reward is held while the pack is full', h.heldRewardsOf(c.p).length === 1);
  // A bag granted as a reward into a full pack applies itself rather than queueing.
  const gave = h.grantRewardItems(c.p, [{ itemId: 'pack_satchel', qty: 1 }], 'test');
  check('a bag rewarded into a full pack is shouldered, not queued',
    h.packCapacity(c.p) === BASE + 8 && !h.heldRewardsOf(c.p).some((r) => r.itemId === 'pack_satchel'),
    { cap: h.packCapacity(c.p), held: h.heldRewardsOf(c.p), gave });
  h.flushHeldRewards(c.p);
  check('a bigger bag releases it', h.countItemQty(h.getInventory(c.p), 'mugwort') === 2 && h.heldRewardsOf(c.p).length === 0,
    { mugwort: h.countItemQty(h.getInventory(c.p), 'mugwort'), held: h.heldRewardsOf(c.p).length });

  // ── growing a pack never disturbs what is already in it ───────────────────
  const d = join('Keeper', 'pack_d');
  const dinv = h.getInventory(d.p);
  h.addItemToAccount(dinv, 'mugwort', 5);
  h.addItemToAccount(dinv, 'yarrow', 2);
  const before = JSON.stringify(dinv.slots.slice(0, BASE));
  useBag(d, 'pack_witchwoven');
  const after = h.getInventory(d.p);
  check('existing slots are untouched by the resize', JSON.stringify(after.slots.slice(0, BASE)) === before);
  check('the new slots are empty', after.slots.slice(BASE).every((s) => s === null));

  // ── every tier is obtainable ──────────────────────────────────────────────
  const { CRAFT_SHOP_RECIPES } = require('../data/craftShop.js');
  const sold = Object.values(h.NPC_SHOPS).flatMap((sh) => sh.items.map((i) => i.id));
  const crafted = CRAFT_SHOP_RECIPES.map((r) => r.result);
  const unreachable = Object.keys(h.PACK_UPGRADES).filter((id) =>
    !sold.includes(id) && !crafted.includes(id) && id !== 'pack_witchwoven');
  check('the shop and forge bags are actually obtainable', unreachable.length === 0, unreachable);
  check('the capstone bag is a real catalog item', !!h.ITEM_CATALOG.pack_witchwoven);
  // Every bag must describe what it does — they are useless-looking otherwise.
  const undescribed = Object.keys(h.PACK_UPGRADES).filter((id) => !(h.ITEM_CATALOG[id] || {}).desc);
  check('every bag says what it gives you', undescribed.length === 0, undescribed);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 500);
