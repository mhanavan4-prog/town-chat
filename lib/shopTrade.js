// Trade between the town and the Wilds. A thing is worth most where it does
// not grow: Dame Averil, out in the Wildlands Village, pays over for what
// comes from town, and the town's shopkeepers pay over for what was gathered
// in the Wilds. It is a reason to carry a full pack up the road north (and
// back), not a way to make gold from nothing: the better price is held under
// the cheapest any shop sells the same thing for, regulars' rate included.
'use strict';

const TRADE = {
  premium: 0.25,        // a quarter over, and never less than one coin more
  underBuy: 0.8,        // the better price stays at or under this share of the cheapest shelf price
  wildsShops: ['npc_averil'],
  bothShops: ['npc_packman'],   // the packman has both markets ahead of him, and pays over for goods from either
};

module.exports = function createShopTrade({ shops, sellValueFor, wildsGoods, townGoods, maxDiscount }) {
  const isWildsShop = (npcId) => TRADE.wildsShops.includes(npcId);
  const isBoth = (npcId) => TRADE.bothShops.includes(npcId);
  const wilds = new Set(wildsGoods);
  // Town goods: what grows or is made there, and whatever a town shop stocks.
  const town = new Set(townGoods);
  for (const [npcId, shop] of Object.entries(shops)) if (!isWildsShop(npcId) && !isBoth(npcId)) for (const it of shop.items) if (!wilds.has(it.id)) town.add(it.id);
  // The cheapest any shop will sell a thing for, at the regulars' rate.
  const cheapest = {};
  for (const shop of Object.values(shops)) for (const it of shop.items) {
    const p = Math.max(1, Math.round(it.price * (1 - (maxDiscount || 0))));
    if (cheapest[it.id] == null || p < cheapest[it.id]) cheapest[it.id] = p;
  }

  function wanted(npcId, itemId) { return shops[npcId] ? (isBoth(npcId) ? town.has(itemId) || wilds.has(itemId) : isWildsShop(npcId) ? town.has(itemId) : wilds.has(itemId)) : false; }

  function unitFor(npcId, itemId) {
    const base = sellValueFor(itemId);
    if (base <= 0 || !wanted(npcId, itemId)) return base;
    let over = Math.max(base + 1, Math.round(base * (1 + TRADE.premium)));
    if (cheapest[itemId] != null) over = Math.min(over, Math.floor(cheapest[itemId] * TRADE.underBuy));
    return Math.max(base, over);
  }

  // The Sell tab's prices at one shop, and which of them are the better ones.
  function pricesFor(npcId, baseMap) {
    const values = {}, prized = [];
    for (const id of Object.keys(baseMap)) { const u = unitFor(npcId, id); values[id] = u; if (u > baseMap[id]) prized.push(id); }
    return { values, prized };
  }

  function wantLine(npcId) { return isBoth(npcId) ? 'I have both markets ahead of me. I pay over for town goods and Wilds goods alike.' : isWildsShop(npcId) ? 'I pay over for anything from town. It is a long road for an old woman.' : 'Bring me what grows out in the Wilds and I will pay over for it.'; }

  return { unitFor, pricesFor, wanted, wantLine, isWildsShop, town, wilds };
};
module.exports.TRADE = TRADE;
