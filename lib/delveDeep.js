// ---------------------------------------------------------------------------
// The Deep's record (data/delveDeep.js): the deepest each account has ever been
// down the Delve, the all-time board made from those, and the titles for depth.
//   note(player, depth)  -> true if it is a new deepest
//   menu(player)         -> { best, next, top } for the Delve's panel
// ---------------------------------------------------------------------------
const { DEEP } = require('../data/delveDeep');

module.exports = function createDelveDeep({ accounts, grantTitle = () => {}, save = () => {}, now = () => Date.now() }) {
  let cache = null, cacheAt = 0;

  function note(player, depth) {
    const d = Math.floor(Number(depth) || 0);
    if (!player || !player.accountKey || d < 1) return false;
    const a = accounts[player.accountKey];
    if (!a) return false;
    const before = (a.delveBest && a.delveBest.depth) || 0;
    if (d <= before) return false;
    a.delveBest = { depth: d, at: now() };
    for (const h of DEEP.honours) if (before < h.depth && d >= h.depth) grantTitle(player, h.title);
    cache = null;
    save();
    return true;
  }

  function top() {
    const t = now();
    if (cache && t - cacheAt < 60000) return cache;
    const all = [];
    for (const key of Object.keys(accounts)) {
      const a = accounts[key];
      if (a && a.delveBest && a.delveBest.depth > 0) all.push({ name: a.username || key, value: a.delveBest.depth, at: a.delveBest.at || 0 });
    }
    all.sort((x, y) => (y.value - x.value) || (x.at - y.at));   // deepest first; of equals, whoever got there first
    cache = all.slice(0, DEEP.top).map((e) => ({ name: e.name, value: e.value }));
    cacheAt = t;
    return cache;
  }

  function menu(player) {
    const a = player && player.accountKey ? accounts[player.accountKey] : null;
    const best = (a && a.delveBest && a.delveBest.depth) || 0;
    const next = DEEP.honours.find((h) => h.depth > best) || null;
    return { best, next: next ? next.depth : null, deepFrom: DEEP.from, top: top() };
  }

  return { note, menu, top };
};
