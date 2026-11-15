// ---------------------------------------------------------------------------
// The herb bag (Mother Yarrow sells them, in the Wildlands Village).
//
// Every kind of plant took a slot of the pack to itself, and there are more
// kinds of plant than a pack has slots. A herb bag is a second place that only
// plants go into: each kind takes one place in it however many you hold, and a
// bigger bag has more places. The best of them has a place for every plant
// there is.
//
// The bag lives on the inventory record (inv.herbBag is its tier, inv.herbs is
// { itemId: qty }), and the three functions everything already uses for items
// (add, count, remove) look in it as well as the pack, so brewing, sowing,
// quests and anything else that asks "how many have you?" needs no change.
// Things that work on a pack SLOT (selling, listing, trading, using) do not see
// into the bag: take the plant out first.
//
// Nothing here is a lore claim.
// ---------------------------------------------------------------------------

module.exports = function createHerbBag({ HERB_IDS }) {
  const herbs = new Set(HERB_IDS);
  // kinds: how many different plants it holds (Infinity = every one there is)
  const TIERS = [
    null,
    { tier: 1, id: 'pouch', name: 'Herb Pouch', icon: '👝', kinds: 8, gold: 200, says: 'A drawstring pouch, waxed inside. Eight sorts of leaf, and none of them crushed.' },
    { tier: 2, id: 'satchel', name: 'Gatherer\'s Satchel', icon: '👜', kinds: 16, gold: 700, says: 'Pockets within pockets. Sixteen sorts, each to its own.' },
    { tier: 3, id: 'basket', name: 'Wort-Wife\'s Basket', icon: '🧺', kinds: 28, gold: 2000, says: 'Willow, with a lid. Twenty-eight sorts, roots at the bottom.' },
    { tier: 4, id: 'hamper', name: 'Mother Yarrow\'s Hamper', icon: '🌿', kinds: Infinity, gold: 5000, says: 'Her own pattern. A place for every plant that grows, and she knows them all.' },
  ];
  const isHerb = (itemId) => herbs.has(itemId);
  const tierOf = (inv) => { const t = inv && Number(inv.herbBag); return Number.isInteger(t) && t >= 1 && t < TIERS.length ? t : 0; };
  const capOf = (inv) => { const t = tierOf(inv); return t ? Math.min(TIERS[t].kinds, herbs.size) : 0; };
  const held = (inv) => { if (!inv.herbs || typeof inv.herbs !== 'object') inv.herbs = {}; return inv.herbs; };
  const kindsIn = (inv) => (inv && inv.herbs ? Object.keys(inv.herbs).filter((k) => inv.herbs[k] > 0).length : 0);
  const count = (inv, itemId) => (inv && inv.herbs && inv.herbs[itemId] > 0 ? inv.herbs[itemId] : 0);

  // Put qty of a plant into the bag if it has a place for it. True if it went in.
  function tryAdd(inv, itemId, qty) {
    if (!isHerb(itemId) || !(qty > 0)) return false;
    const cap = capOf(inv); if (!cap) return false;
    const h = held(inv);
    if (!(h[itemId] > 0) && kindsIn(inv) >= cap) return false;
    h[itemId] = (h[itemId] || 0) + qty;
    return true;
  }
  // Take up to qty out of the bag. Returns how many came out.
  function removeUpTo(inv, itemId, qty) {
    const have = count(inv, itemId), n = Math.min(have, Math.max(0, qty));
    if (n > 0) { inv.herbs[itemId] = have - n; if (inv.herbs[itemId] <= 0) delete inv.herbs[itemId]; }
    return n;
  }
  // Move the plants that are in the pack into the bag, as far as it has places. Returns how many stacks moved.
  function sweep(inv) {
    let moved = 0;
    if (!capOf(inv) || !Array.isArray(inv.slots)) return 0;
    for (let i = 0; i < inv.slots.length; i++) {
      const s = inv.slots[i];
      if (s && isHerb(s.itemId) && tryAdd(inv, s.itemId, s.qty)) { inv.slots[i] = null; moved++; }
    }
    return moved;
  }
  // Take a whole kind out of the bag into the pack. Returns 'ok', 'none' or 'full'.
  function takeOut(inv, itemId) {
    const n = count(inv, itemId); if (!n) return 'none';
    const stack = inv.slots.find((s) => s && s.itemId === itemId);
    if (stack) stack.qty += n;
    else { const i = inv.slots.findIndex((s) => !s); if (i === -1) return 'full'; inv.slots[i] = { itemId, qty: n }; }
    delete inv.herbs[itemId];
    return 'ok';
  }
  // Which bag she will sell you next, if any.
  const nextTier = (inv) => { const t = tierOf(inv); return t + 1 < TIERS.length ? TIERS[t + 1] : null; };
  // For the client: the bag you have, what is in it, and what she sells.
  function payload(inv, catalog) {
    const t = tierOf(inv), cap = capOf(inv);
    const rows = Object.keys((inv && inv.herbs) || {}).filter((k) => inv.herbs[k] > 0).sort().map((k) => ({ itemId: k, qty: inv.herbs[k], name: (catalog[k] && catalog[k].name) || k, icon: (catalog[k] && catalog[k].icon) || '🌿' }));
    return {
      tier: t, name: t ? TIERS[t].name : null, icon: t ? TIERS[t].icon : null, kinds: cap, all: t ? TIERS[t].kinds === Infinity : false, used: rows.length, total: herbs.size, herbs: rows,
      shop: TIERS.slice(1).map((b) => ({ tier: b.tier, name: b.name, icon: b.icon, kinds: b.kinds === Infinity ? herbs.size : b.kinds, all: b.kinds === Infinity, gold: b.gold, says: b.says, owned: b.tier <= t })),
    };
  }
  return { TIERS, isHerb, tierOf, capOf, kindsIn, count, tryAdd, removeUpTo, sweep, takeOut, nextTier, payload, size: herbs.size };
};
