// Out in the Wilds (data/wildsFinds.js): caches under cairns, and six
// balefires to light in a day. What each player has had or lit is kept in
// memory, by who they are, and nothing is saved.
const { WILDS_FINDS: F, WILDS_FIND_RULES: R } = require('../data/wildsFinds');

module.exports = function createWildsFinds({ send, grantLoot, grantXP, inventoryStatePayload, noteRound = () => {}, now = () => Date.now(), random = Math.random }) {
  const again = new Map();   // `${who}|${cache id}` -> when it may be searched again
  const lit = new Map();     // `${who}|${day}` -> { fires:Set, paid }
  const who = (p) => p.accountKey || ('guest:' + p.name);
  const day = (t) => Math.floor(t / 86400000);
  const roundOf = (p) => { const k = who(p) + '|' + day(now()); let r = lit.get(k); if (!r) { r = { fires: new Set(), paid: false }; lit.set(k, r); if (lit.size > 4000) lit.delete(lit.keys().next().value); } return r; };
  const say = (p, message, level) => send(p.ws, { type: 'toast', level: level || 'important', always: level !== 'routine', message });

  function payloadFor(player) {
    const t = now(), r = roundOf(player);
    return { type: 'wilds_finds', used: F.caches.filter((c) => (again.get(who(player) + '|' + c.id) || 0) > t).map((c) => c.id), lit: [...r.fires], total: F.balefires.length, complete: r.paid };
  }
  const sendTo = (player) => { if (player && player.ws) send(player.ws, payloadFor(player)); };

  function use(player, id) {
    if (!player || player.isDead || player.room !== 'wilds') return;
    const cache = F.caches.find((c) => c.id === id), fire = F.balefires.find((f) => f.id === id), thing = cache || fire;
    if (!thing) return;
    if (Math.hypot(thing.x - player.x, thing.y - player.y) > R.range) { say(player, 'Get closer to that.', 'routine'); return; }
    const t = now();
    if (cache) {
      const k = who(player) + '|' + cache.id;
      if ((again.get(k) || 0) > t) { say(player, 'You have been through this cairn already. Give it time.', 'routine'); return; }
      again.set(k, t + R.cacheAgainMs);
      const gold = R.cacheGold[0] + Math.floor(random() * (R.cacheGold[1] - R.cacheGold[0] + 1));
      const earned = grantLoot([{ kind: 'gold', amount: gold }, { kind: 'item', itemId: R.cacheGoods[Math.floor(random() * R.cacheGoods.length)], qty: 1 }], player);
      send(player.ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
      if (earned.length) send(player.ws, { type: 'loot_drop', items: earned });
      say(player, '🪨 Under the cairn, wrapped in oilcloth: what some traveller left against a bad day, and never came back for.');
    } else {
      const r = roundOf(player);
      if (r.fires.has(fire.id)) { say(player, 'You have lit this one today. It is burning.', 'routine'); return; }
      r.fires.add(fire.id);
      grantXP(player, R.fireXp);
      if (r.fires.size >= F.balefires.length && !r.paid) {
        r.paid = true;
        noteRound(player);
        grantLoot([{ kind: 'gold', amount: R.roundGold }], player); grantXP(player, R.roundXp);
        send(player.ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
        say(player, `🔥 The sixth balefire takes, and from here you can see the others answering across the Wilds. The round is made: ${R.roundGold} gold was left at the last cairn for whoever made it.`);
      } else say(player, `🔥 The balefire takes. ${r.fires.size} of ${F.balefires.length} lit today.`);
    }
    sendTo(player);
  }
  return { use, payloadFor, sendTo, F, R };
};
