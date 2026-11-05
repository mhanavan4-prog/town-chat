// Rewards earned with a full pack must not be destroyed.
//
// Playtest: a Green Path chapter completed while the pack was full. The chapter
// advanced, the toast said seeds were granted, and the seeds were gone — every
// reward site read `if (addItemToAccount(...)) { report it }` with no else.
// Anything that will not fit is held on the player's progress now and handed
// over when a slot frees up.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-held-');

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
    p.accountKey = key; if (!h.accounts[key]) h.accounts[key] = {};
    return { s, p };
  }
  const qty = (p, id) => h.countItemQty(h.getInventory(p), id);
  // Fill every slot with distinct items so nothing can stack into one.
  function fillPack(p) {
    const inv = h.getInventory(p);
    const ids = Object.keys(h.ITEM_CATALOG);
    for (let i = 0; i < inv.slots.length; i++) inv.slots[i] = { itemId: ids[i % ids.length] + '__filler' + i, qty: 1 };
    return inv;
  }

  const a = join('Packed', 'held_a');
  const inv = fillPack(a.p);
  check('the pack really is full', inv.slots.every((s) => s), inv.slots.filter((s) => !s).length);

  // ── A chapter-style reward with no room ───────────────────────────────────
  const res = h.grantRewardItems(a.p, [{ itemId: 'st_johns_wort', qty: 3 }, { itemId: 'rowan_berry', qty: 3 }], 'Bitter Sight');
  check('nothing was silently granted into a full pack', res.got.length === 0, res.got);
  check('both rewards were held instead of destroyed', res.held.length === 2, res.held);
  check('the held queue records them', h.heldRewardsOf(a.p).length === 2, h.heldRewardsOf(a.p));
  check('the player does not hold the items yet', qty(a.p, 'st_johns_wort') === 0 && qty(a.p, 'rowan_berry') === 0);

  // ── Freeing one slot delivers what fits, keeps the rest ───────────────────
  inv.slots[0] = null;
  const d1 = h.flushHeldRewards(a.p);
  check('freeing one slot delivers one held reward', d1.length === 1, d1);
  check('the other stays held', h.heldRewardsOf(a.p).length === 1, h.heldRewardsOf(a.p));
  check('the delivered item is really in the pack', qty(a.p, 'st_johns_wort') === 3, qty(a.p, 'st_johns_wort'));
  check('the player is told it arrived', /held rewards/i.test((a.s.lastOfType('toast') || {}).message || ''), (a.s.lastOfType('toast') || {}).message);

  inv.slots[1] = null;
  h.flushHeldRewards(a.p);
  check('freeing another slot delivers the rest', h.heldRewardsOf(a.p).length === 0 && qty(a.p, 'rowan_berry') === 3, { held: h.heldRewardsOf(a.p).length, rowan: qty(a.p, 'rowan_berry') });

  // ── Discarding is the usual way a slot appears ────────────────────────────
  const b = join('Discarder', 'held_b');
  fillPack(b.p);
  h.grantRewardItems(b.p, [{ itemId: 'belladonna', qty: 3 }], 'The Beautiful Lady');
  check('held while full', h.heldRewardsOf(b.p).length === 1);
  b.s.emit('message', JSON.stringify({ type: 'destroy_item', slotIdx: 3 }));
  check('discarding an item delivers the held reward', h.heldRewardsOf(b.p).length === 0 && qty(b.p, 'belladonna') === 3,
    { held: h.heldRewardsOf(b.p).length, belladonna: qty(b.p, 'belladonna') });

  // ── Room available: the ordinary path is unchanged ────────────────────────
  const c = join('Roomy', 'held_c');
  const r2 = h.grantRewardItems(c.p, [{ itemId: 'mugwort', qty: 2 }], 'test');
  check('with room, rewards are granted normally and nothing is held',
    r2.got.length === 1 && r2.held.length === 0 && qty(c.p, 'mugwort') === 2 && h.heldRewardsOf(c.p).length === 0);

  // ── A stackable reward still stacks into a full pack ──────────────────────
  const d = join('Stacker', 'held_d');
  const dinv = fillPack(d.p);
  dinv.slots[5] = { itemId: 'yarrow', qty: 1 };
  const r3 = h.grantRewardItems(d.p, [{ itemId: 'yarrow', qty: 3 }], 'test');
  check('a full pack still accepts more of something it already holds',
    r3.got.length === 1 && qty(d.p, 'yarrow') === 4, { got: r3.got, yarrow: qty(d.p, 'yarrow') });

  // ── The queue is bounded ──────────────────────────────────────────────────
  const e = join('Hoarder', 'held_e');
  fillPack(e.p);
  for (let i = 0; i < h.HELD_REWARDS_MAX + 5; i++) h.grantRewardItems(e.p, [{ itemId: 'mugwort', qty: 1 }], 'spam');
  check('the held queue cannot grow without bound', h.heldRewardsOf(e.p).length === h.HELD_REWARDS_MAX, h.heldRewardsOf(e.p).length);

  // ── The reported bug, end to end through the real Green Path handler ──────
  // Complete the chapter whose reward is St John's Wort + rowan with a full
  // pack: the chapter must still advance, and the seeds must survive.
  {
    const g = join('GreenWitch', 'held_gp');
    const gp = h.greenPathOf(g.p);
    const idx = h.GREEN_PATH.findIndex((c) => (c.itemRewards || []).some((r) => r.itemId === 'st_johns_wort'));
    check('found the chapter that grants St John\'s Wort', idx >= 0, idx);
    const ch = h.GREEN_PATH[idx];
    const prog = h.getProgress(g.p);
    prog.level = Math.max(prog.level || 1, ch.requiresLevel || 1);
    gp.chapter = idx; gp.progress = (ch.objective.target || 1) - 1;
    fillPack(g.p);
    // That chapter asks for a hedge brew specifically, so hand the event one.
    const detail = ch.objective.requires
      ? { recipe: require('../data/gameConstants').POTION_RECIPES.find((r) => (r.ingredients || []).some((i) => (h.HERB_BANDS[ch.objective.requires] || []).includes(i.id))) }
      : undefined;
    h.greenPathEvent(g.p, ch.objective.type, detail);
    const after = h.greenPathOf(g.p);
    check('the chapter still completes with a full pack', after.chapter === idx + 1, { was: idx, now: after.chapter });
    check('its seeds are held, not destroyed', h.heldRewardsOf(g.p).length === (ch.itemRewards || []).length, h.heldRewardsOf(g.p));
    const toast = (g.s.lastOfType('toast') || {}).message || '';
    check('the completion toast says they are being held', /being held/i.test(toast), toast.slice(-160));
    // ...and they arrive once there is room.
    h.getInventory(g.p).slots[0] = null;
    h.getInventory(g.p).slots[1] = null;
    h.flushHeldRewards(g.p);
    check('the seeds arrive once space is made', qty(g.p, 'st_johns_wort') === 3 && qty(g.p, 'rowan_berry') === 3,
      { sjw: qty(g.p, 'st_johns_wort'), rowan: qty(g.p, 'rowan_berry') });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 500);
