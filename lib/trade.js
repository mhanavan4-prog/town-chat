// ---------------------------------------------------------------------------
// Trading, hand to hand.
//
// Two players in the same place lay out what each will give (gold from the
// bank, things from the pack), and nothing moves until both have said they are
// ready. Changing an offer un-readies both, so no one can swap a thing out
// under a hand that has already agreed. The swap is all or nothing: it is tried
// on copies first (so a full pack on either side stops it with nothing lost),
// then done for real.
//
//   ask(player, targetId)        -> { ok } | { error }
//   answer(player, fromId, yes)  -> { ok } | { error }
//   offer(player, { gold, items: [{ itemId, qty }] })
//   ready(player, yes)
//   cancel(player, why)          also call when a player leaves or changes room
//   tick()                       cancels trades whose two sides have parted
// ---------------------------------------------------------------------------
const TRADE = { askMs: 30000, maxItems: 8, maxGold: 1000000 };

module.exports = function createTrade({ players, send, invOf, bankOf, addItem, removeItem, countItem, itemName = (id) => id,
  blocks = () => false, save = () => {}, pushStates = () => {}, log = () => {}, now = () => Date.now() }) {
  const asks = new Map();      // targetId -> { fromId, at }
  const bySide = new Map();    // playerId -> session
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const other = (s, p) => (s.a.id === p.id ? s.b : s.a);
  const sideOf = (s, p) => (s.a.id === p.id ? 'a' : 'b');
  const together = (a, b) => a && b && a.room === b.room && (a.instance || null) === (b.instance || null);

  function view(s, p) {
    const me = sideOf(s, p), them = me === 'a' ? 'b' : 'a', o = other(s, p);
    const show = (side) => ({ gold: s.offer[side].gold, items: s.offer[side].items.map((i) => ({ itemId: i.itemId, qty: i.qty, name: itemName(i.itemId) })) });
    return { type: 'trade_state', open: true, with: { id: o.id, name: o.name }, mine: show(me), theirs: show(them), ready: { me: s.ready[me], them: s.ready[them] }, maxItems: TRADE.maxItems };
  }
  function tellBoth(s) { send(s.a.ws, view(s, s.a)); send(s.b.ws, view(s, s.b)); }
  function close(s, reasonFor, done) {
    bySide.delete(s.a.id); bySide.delete(s.b.id);
    for (const p of [s.a, s.b]) send(p.ws, { type: 'trade_state', open: false, done: !!done, message: reasonFor(p) });
  }

  function ask(player, targetId) {
    const target = players.get(String(targetId || ''));
    if (!target || target.id === player.id) return { error: 'They are not here now.' };
    if (!player.accountKey) return { error: 'Trading needs an account: gold and goods are kept on it.' };
    if (!target.accountKey) return { error: `${target.name} is here as a guest, and a guest has nothing kept to trade.` };
    if (bySide.has(player.id)) return { error: 'You are in a trade already.' };
    if (!together(player, target)) return { error: `You must be in the same place as ${target.name} to trade hand to hand.` };
    if (player.isDead || target.isDead) return { error: 'Not just now.' };
    if (bySide.has(target.id)) return { error: `${target.name} is trading with someone else.` };
    if (blocks(target, player)) return { ok: true, name: target.name };   // blocked by them: it looks asked
    asks.set(target.id, { fromId: player.id, at: now() });
    send(target.ws, { type: 'trade_asked', fromId: player.id, fromName: player.name });
    return { ok: true, name: target.name };
  }

  function answer(player, fromId, yes) {
    const a = asks.get(player.id);
    if (!a || a.fromId !== String(fromId || '') || now() - a.at > TRADE.askMs) { asks.delete(player.id); return { error: 'That offer to trade has passed.' }; }
    asks.delete(player.id);
    const from = players.get(a.fromId);
    if (!from) return { error: 'They have gone.' };
    if (!yes) { send(from.ws, { type: 'trade_state', open: false, message: `${player.name} would rather not trade just now.` }); return { ok: true }; }
    if (bySide.has(from.id) || bySide.has(player.id)) return { error: 'One of you is in a trade already.' };
    if (!together(player, from)) return { error: `You must be in the same place as ${from.name} to trade hand to hand.` };
    const s = { a: from, b: player, offer: { a: { gold: 0, items: [] }, b: { gold: 0, items: [] } }, ready: { a: false, b: false } };
    bySide.set(from.id, s); bySide.set(player.id, s);
    pushStates(from); pushStates(player);   // each client has its own pack and purse in hand before the table opens
    tellBoth(s);
    return { ok: true };
  }

  // What a side may truly give: whole numbers, things in the pack, gold in the bank.
  function clean(player, raw) {
    const out = { gold: 0, items: [] };
    const gold = Math.floor(Number(raw && raw.gold) || 0);
    const bank = bankOf(player);
    out.gold = Math.max(0, Math.min(gold, TRADE.maxGold, bank ? Math.floor(bank.balance) : 0));
    const inv = invOf(player), seen = new Map();
    for (const it of (Array.isArray(raw && raw.items) ? raw.items : []).slice(0, 40)) {
      const id = String((it && it.itemId) || ''), qty = Math.floor(Number(it && it.qty) || 0);
      if (!id || qty < 1) continue;
      seen.set(id, (seen.get(id) || 0) + qty);
    }
    for (const [id, qty] of seen) {
      if (out.items.length >= TRADE.maxItems) break;
      const have = countItem(inv, id);
      if (have < 1) continue;
      out.items.push({ itemId: id, qty: Math.min(qty, have) });
    }
    return out;
  }

  function offer(player, raw) {
    const s = bySide.get(player.id);
    if (!s) return { error: 'You are not trading.' };
    s.offer[sideOf(s, player)] = clean(player, raw);
    s.ready.a = false; s.ready.b = false;     // a changed offer is a new offer: both must agree again
    tellBoth(s);
    return { ok: true };
  }

  // The swap on these inventories and banks; true if every thing found a place.
  function swap(invA, bankA, invB, bankB, give, take) {
    if (bankA.balance < give.gold || bankB.balance < take.gold) return false;
    for (const i of give.items) if (!removeItem(invA, i.itemId, i.qty)) return false;
    for (const i of take.items) if (!removeItem(invB, i.itemId, i.qty)) return false;
    for (const i of take.items) if (!addItem(invA, i.itemId, i.qty)) return false;
    for (const i of give.items) if (!addItem(invB, i.itemId, i.qty)) return false;
    bankA.balance += take.gold - give.gold; bankB.balance += give.gold - take.gold;
    return true;
  }

  function ready(player, yes) {
    const s = bySide.get(player.id);
    if (!s) return { error: 'You are not trading.' };
    s.ready[sideOf(s, player)] = !!yes;
    if (!(s.ready.a && s.ready.b)) { tellBoth(s); return { ok: true }; }
    if (!together(s.a, s.b)) { close(s, () => 'You have parted, and the trade with it.'); return { ok: true }; }
    const empty = (o) => !o.gold && !o.items.length;
    if (empty(s.offer.a) && empty(s.offer.b)) { s.ready.a = s.ready.b = false; tellBoth(s); return { error: 'There is nothing on the table.' }; }
    // On copies first: nothing real moves unless the whole of it can.
    const invA = invOf(s.a), invB = invOf(s.b), bankA = bankOf(s.a), bankB = bankOf(s.b);
    const tryA = clone(invA), tryB = clone(invB);
    const dry = swap(tryA, { balance: bankA.balance }, tryB, { balance: bankB.balance }, s.offer.a, s.offer.b);
    if (!dry) {
      // say which side it failed on, as far as can be told: a pack with no room, or goods no longer held
      const short = (p, inv, bank, o) => bank.balance < o.gold || o.items.some((i) => countItem(inv, i.itemId) < i.qty);
      const why = short(s.a, invA, bankA, s.offer.a) ? `${s.a.name} no longer has what was offered.`
        : short(s.b, invB, bankB, s.offer.b) ? `${s.b.name} no longer has what was offered.`
        : 'One of you has no room in the pack for it. Make room and try again.';
      s.ready.a = s.ready.b = false;
      s.offer.a = clean(s.a, s.offer.a); s.offer.b = clean(s.b, s.offer.b);
      tellBoth(s);
      for (const p of [s.a, s.b]) send(p.ws, { type: 'trade_note', message: why });
      return { error: why };
    }
    swap(invA, bankA, invB, bankB, s.offer.a, s.offer.b);
    save();
    log({ a: s.a, b: s.b, gave: clone(s.offer.a), got: clone(s.offer.b) });
    const done = clone(s.offer);
    close(s, (p) => `Traded with ${other(s, p).name}.`, true);
    pushStates(s.a); pushStates(s.b);
    return { ok: true, done };
  }

  function cancel(player, why) {
    asks.delete(player.id);
    for (const [tid, a] of asks) if (a.fromId === player.id) asks.delete(tid);
    const s = bySide.get(player.id);
    if (!s) return false;
    close(s, (p) => (p.id === player.id ? 'Trade called off.' : (why || `${player.name} called off the trade.`)));
    return true;
  }

  // Walked apart, or one fell: the table is cleared.
  function tick() {
    const seen = new Set();
    for (const s of bySide.values()) {
      if (seen.has(s)) continue; seen.add(s);
      if (!players.has(s.a.id) || !players.has(s.b.id) || !together(s.a, s.b) || s.a.isDead || s.b.isDead) close(s, () => 'You have parted, and the trade with it.');
    }
    const t = now();
    for (const [tid, a] of asks) if (t - a.at > TRADE.askMs) asks.delete(tid);
  }

  return { TRADE, ask, answer, offer, ready, cancel, tick, inTrade: (p) => bySide.has(p.id) };
};
