// Things to do underground besides fighting: chests that want a bone key,
// caches in the dead ends, veins, mushrooms and crystals to gather, traps to
// step round, and two side goals (light the braziers, break the seals).
//
// Where each thing lies comes with the dungeon's shape (data/dungeonLayouts.js).
// What has been done lives here, in memory: per room for what everyone shares
// (which braziers burn, which seals are broken), and per player for what each
// may take once in a while (a chest, a cache, a vein). Nothing is saved, and
// only things that already exist are given: gold, the dungeon's own loot, iron
// ore, stone, glimmerdust, a gem, a healing potion.
const { DUNGEON_LAYOUTS } = require('../data/dungeonLayouts');
const { RARE_ROOMS, RARE, rareFor } = require('../data/rareRooms');

const USE_RANGE = 95;                    // how close you must stand to use a thing
const TAKE_AGAIN_MS = 30 * 60 * 1000;    // a chest, a cache, a side goal's purse: once in half an hour
const NODE_AGAIN_MS = 10 * 60 * 1000;    // a vein, a mushroom bed, a crystal: ten minutes to come back
const GOAL_RESET_MS = 10 * 60 * 1000;    // braziers gutter and seals knit themselves this long after a goal is done
const KEY_DROP_CHANCE = 0.08;            // a creature carries a bone key about one time in twelve; a boss always does
// What a purse is worth is counted in the dungeon's own coin: the middle of what
// one of its creatures drops when it drops gold (data/gameConstants.js LOOT_TABLES),
// so a chest in the Rootcellar and a chest in the Starless Deep are each worth a
// handful of kills there. Everything found in half an hour comes to about what
// clearing the dungeon's creatures pays.
const TIER_COIN = { 1: 2.5, 2: 6.5, 3: 15, 4: 34 };
const PURSES = { chest: [3, 5], bossChest: [7, 11], cache: [1.5, 3], braziers: [3, 5], seals: [4, 6] };
const SEAL_BLOWS = 3;                    // a seal takes three blows
const SEAL_BLOW_MS = 700;
const TRAPS = {
  spikes:   { name: 'a spike plate', rearmMs: 2500, dmg: (tier) => 6 + 4 * tier },
  vent:     { name: 'a breath of foul air', rearmMs: 1000, dmg: (tier) => 3 + 2 * tier, cycleMs: 6000, openMs: 2200 },
  rockfall: { name: 'a fall of rock', rearmMs: 8000, dmg: (tier) => 10 + 6 * tier, warnMs: 1300 },
};

module.exports = function createDungeonFinds({ players, send, grantLoot, grantXP, rollPendingLoot, LOOT_TABLES, inventoryStatePayload, absorbIncomingDamage, noteAttacked, delveRunsByRoom, delveFloorTier, playerMaxHealth, noteRare = () => {}, now = () => Date.now(), random = Math.random }) {
  const rooms = new Map();     // instance key -> { lit:Set, broken:Set, blows:{}, goalDoneAt:{} }
  const again = new Map();     // `${who}|${instance base}|${id}` -> when it may be taken again
  const trapClock = new Map(); // `${player.id}|${trap id}` -> { next, warnAt }

  // Which dungeon a room is, how deep, and the key its shared state goes under.
  // A Delve floor is its own place: a new floor is a new key, so it is all fresh.
  function placeOf(room) {
    if (typeof room !== 'string' || !room.startsWith('dungeon_')) return null;
    const run = delveRunsByRoom && delveRunsByRoom.get(room);
    if (run) return { n: 5, tier: delveFloorTier(run), key: `${room}#${run.floor}`, base: `${room}#${run.floor}`, delve: true };
    const m = /^dungeon_t([1-4])$/.exec(room);
    if (!m) return null;
    return { n: +m[1], tier: +m[1], key: room, base: room, delve: false };
  }
  function stateOf(place) {
    let s = rooms.get(place.key);
    if (!s) { s = { lit: new Set(), broken: new Set(), blows: {}, goalDoneAt: {} }; rooms.set(place.key, s); }
    // a finished goal sets itself up again after a while, so the next visitors have it to do
    for (const g of ['braziers', 'seals']) {
      if (s.goalDoneAt[g] && now() - s.goalDoneAt[g] > GOAL_RESET_MS) {
        s.goalDoneAt[g] = 0;
        if (g === 'braziers') s.lit.clear(); else { s.broken.clear(); s.blows = {}; }
      }
    }
    return s;
  }
  // ── Rare rooms (data/rareRooms.js) ── which one, if any, this place has now:
  // the same for everyone down there. A dungeon's changes with the spell of
  // the hour; a Delve floor's is settled when the floor is.
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function rareOf(place) {
    if (!place) return null;
    const sites = DUNGEON_LAYOUTS[place.n].rareSites;
    const spell = place.delve ? 0 : Math.floor(now() / RARE.spellMs);
    const token = place.delve ? place.key : `${place.key}@${spell}`;
    const r = rareFor(place.delve ? hash(place.key) : place.n * 1000003 + spell, sites, place.delve ? RARE.delveChance : RARE.chance);
    return r ? { ...r, token, until: place.delve ? 0 : (spell + 1) * RARE.spellMs } : null;
  }
  // In the Marked Chamber nothing of the dungeon comes at her.
  function sheltered(player) {
    if (!player || player.isDead) return false;
    const r = rareOf(placeOf(player.room));
    return !!(r && r.kind === 'marked' && Math.hypot(r.site.x - player.x, r.site.y - player.y) <= RARE.radius);
  }
  const rareSeen = new Map();  // instance key -> the token last told to the room
  const mendClock = new Map(); // player id -> when the marks next mend her

  const who = (player) => player.accountKey || ('guest:' + player.name);
  const againKey = (player, place, id) => `${who(player)}|${place.base}|${id}`;
  const mayTake = (player, place, id) => (again.get(againKey(player, place, id)) || 0) <= now();
  const took = (player, place, id, ms) => again.set(againKey(player, place, id), now() + ms);
  function findThing(layout, id) {
    for (const kind of ['chests', 'caches', 'nodes', 'braziers', 'seals']) {
      const t = layout[kind].find((x) => x.id === id);
      if (t) return { kind, thing: t };
    }
    return null;
  }

  // What one player needs to draw the place as it stands for them.
  function payloadFor(player) {
    const place = placeOf(player.room);
    if (!place) return null;
    const layout = DUNGEON_LAYOUTS[place.n], s = stateOf(place);
    const used = [];
    for (const kind of ['chests', 'caches', 'nodes']) for (const t of layout[kind]) if (!mayTake(player, place, t.id)) used.push(t.id);
    const r = rareOf(place);
    const rare = r ? { kind: r.kind, id: r.site.id, x: r.site.x, y: r.site.y, until: r.until, open: s.rareOpen === r.token, blows: (s.rareBlows && s.rareBlows.token === r.token) ? s.rareBlows.n : 0, used: !mayTake(player, place, 'rare:' + r.token) } : null;
    return {
      type: 'dungeon_finds', layout: place.n, keys: player.dungeonKeys || 0, now: now(), rare,
      lit: [...s.lit], broken: [...s.broken], blows: { ...s.blows }, used,
      goals: {
        braziers: { done: s.lit.size, total: layout.braziers.length, complete: !!s.goalDoneAt.braziers },
        seals: { done: s.broken.size, total: layout.seals.length, complete: !!s.goalDoneAt.seals },
      },
    };
  }
  function sendTo(player) { const p = payloadFor(player); if (p && player.ws) send(player.ws, p); }
  function sendRoom(room) { for (const p of players.values()) if (p.room === room) sendTo(p); }
  const say = (player, message, level) => send(player.ws, { type: 'toast', level: level || 'important', message });

  function give(player, pending) {
    const earned = grantLoot(pending, player);
    send(player.ws, { type: 'inventory_state', ...inventoryStatePayload(player) });
    if (earned.length) send(player.ws, { type: 'loot_drop', items: earned });
    return earned;
  }
  const purse = (kind, tier) => { const [lo, hi] = PURSES[kind], c = TIER_COIN[tier] || TIER_COIN[1]; const a = Math.round(lo * c), b = Math.round(hi * c); return { kind: 'gold', amount: a + Math.floor(random() * (b - a + 1)) }; };
  const tierLoot = (tier) => rollPendingLoot(LOOT_TABLES['dungeon_t' + tier] || []);

  const rareNews = (r) => `${RARE_ROOMS[r.kind].icon} Somewhere down here, for now: ${RARE_ROOMS[r.kind].name}. The plaque tells what it is.`;
  // Arriving in a dungeon or starting a Delve: your keys start at none.
  function onEnter(player, { fresh } = {}) {
    if (fresh) player.dungeonKeys = 0;
    sendTo(player);
    const r = rareOf(placeOf(player.room));
    if (r) say(player, rareNews(r));
  }
  // The shared room was empty and is made new for whoever walks in.
  function resetRoom(room) { rooms.delete(room); }
  function onLeave(player) { player.dungeonKeys = 0; for (const k of [...trapClock.keys()]) if (k.startsWith(player.id + '|')) trapClock.delete(k); }

  // A creature of the dungeon has fallen to this player: it may have carried a key.
  function onKill(player, mob) {
    if (!player || !mob) return;
    if (mob.boss || random() < KEY_DROP_CHANCE) {
      player.dungeonKeys = (player.dungeonKeys || 0) + 1;
      say(player, `🗝️ It carried a bone key. You hold ${player.dungeonKeys}. The chests down here want one each.`);
      sendTo(player);
    }
  }

  function use(player, id) {
    if (!player || player.isDead) return;
    const place = placeOf(player.room);
    if (!place) return;
    if (id === 'rare') { useRare(player, place); return; }
    const layout = DUNGEON_LAYOUTS[place.n], found = findThing(layout, String(id || ''));
    if (!found) return;
    const { kind, thing } = found;
    if (Math.hypot(thing.x - player.x, thing.y - player.y) > USE_RANGE) { say(player, 'Get closer to that.', 'routine'); return; }
    const s = stateOf(place), tier = place.tier;

    if (kind === 'chests') {
      if (!mayTake(player, place, thing.id)) { say(player, '📦 You have had what this chest held. It will be worth opening again later.', 'routine'); return; }
      if (!(player.dungeonKeys > 0)) { say(player, '🔒 Locked. The creatures down here carry bone keys; the boss always has one.'); return; }
      player.dungeonKeys--;
      took(player, place, thing.id, TAKE_AGAIN_MS);
      const rolls = thing.boss ? 3 : 2;
      const pending = [purse(thing.boss ? 'bossChest' : 'chest', tier)];
      for (let i = 0; i < rolls; i++) pending.push(...tierLoot(tier));
      give(player, pending);
      say(player, thing.boss ? '🗝️ The key turns. The boss kept its best here.' : '🗝️ The key turns and the lid comes up.');
      sendTo(player);
      return;
    }
    if (kind === 'caches') {
      if (!mayTake(player, place, thing.id)) { say(player, 'You have already been through this cache.', 'routine'); return; }
      took(player, place, thing.id, TAKE_AGAIN_MS);
      give(player, [purse('cache', tier), ...tierLoot(tier)]);
      say(player, '🪨 Under the stones: an old shoe and a stoppered witch bottle, hidden to keep harm out, and beside them what somebody meant to come back for.');
      sendTo(player);
      return;
    }
    if (kind === 'nodes') {
      if (!mayTake(player, place, thing.id)) { say(player, 'Picked clean for now. It wants time.', 'routine'); return; }
      took(player, place, thing.id, NODE_AGAIN_MS);
      if (thing.kind === 'ore') {
        const pending = [{ kind: 'item', itemId: 'iron_ore', qty: tier >= 3 ? 2 : 1 }];
        if (random() < 0.25) pending.push({ kind: 'item', itemId: 'stone_block', qty: 1 });
        give(player, pending);
        say(player, '⛏️ You work a few lumps of ore out of the seam.', 'routine');
      } else if (thing.kind === 'crystal') {
        const pending = [{ kind: 'item', itemId: 'glimmerdust', qty: tier >= 3 ? 2 : 1 }];
        if (tier >= 3 && random() < 0.1) pending.push({ kind: 'item', itemId: 'enchanted_gem', qty: 1 });
        give(player, pending);
        say(player, '✨ The crystal sheds a pinch of bright dust where you scrape it.', 'routine');
      } else {
        // cave mushrooms: eaten where they grow, and now and then enough to bottle
        const max = playerMaxHealth(player), heal = Math.round(max * 0.2);
        if (!player.isDead && player.health > 0) player.health = Math.min(max, player.health + heal);
        if (random() < 0.15) give(player, [{ kind: 'item', itemId: 'healing_potion', qty: 1 }]);
        say(player, `🍄 Pale cave mushrooms, the wholesome kind. They put ${heal} back into you.`, 'routine');
      }
      sendTo(player);
      return;
    }
    if (kind === 'braziers') {
      if (s.goalDoneAt.braziers || s.lit.has(thing.id)) { say(player, 'It is burning already.', 'routine'); return; }
      s.lit.add(thing.id);
      if (s.lit.size >= layout.braziers.length) finishGoal(player.room, place, s, 'braziers');
      else for (const p of players.values()) if (p.room === player.room) say(p, `🔥 A brazier takes. ${s.lit.size} of ${layout.braziers.length} lit.`, 'routine');
      sendRoom(player.room);
      return;
    }
    if (kind === 'seals') {
      if (s.goalDoneAt.seals || s.broken.has(thing.id)) { say(player, 'This seal is already broken.', 'routine'); return; }
      const t = now();
      if (player._sealBlowAt && t - player._sealBlowAt < SEAL_BLOW_MS) return;
      player._sealBlowAt = t;
      s.blows[thing.id] = (s.blows[thing.id] || 0) + 1;
      if (s.blows[thing.id] >= SEAL_BLOWS) {
        s.broken.add(thing.id);
        if (s.broken.size >= layout.seals.length) finishGoal(player.room, place, s, 'seals');
        else for (const p of players.values()) if (p.room === player.room) say(p, `💥 A seal breaks. ${s.broken.size} of ${layout.seals.length} broken.`, 'routine');
      }
      sendRoom(player.room);
    }
  }

  // The rare room, used: the marks are only read; the hoard wants three blows
  // from anyone and then pays each who reaches in, once; the well takes a bent
  // pin from each, once.
  function useRare(player, place) {
    const r = rareOf(place);
    if (!r) return;
    if (Math.hypot(r.site.x - player.x, r.site.y - player.y) > USE_RANGE + 30) { say(player, 'Get closer to that.', 'routine'); return; }
    const s = stateOf(place), tier = place.tier, key = 'rare:' + r.token;
    if (r.kind === 'marked') {
      noteRare(player, r.kind);
      say(player, '✴️ Doubled Vs, crossed lines, boxes, a maze no wider than your hand, cut one over another by people who came back to cut more. Nothing of this place will follow you in among them. Rest here.');
      return;
    }
    if (r.kind === 'hoard') {
      if (s.rareOpen !== r.token) {
        const t = now();
        if (player._sealBlowAt && t - player._sealBlowAt < SEAL_BLOW_MS) return;
        player._sealBlowAt = t;
        if (!s.rareBlows || s.rareBlows.token !== r.token) s.rareBlows = { token: r.token, n: 0 };
        s.rareBlows.n++;
        if (s.rareBlows.n < RARE.hoardBlows) { for (const p of players.values()) if (p.room === player.room) say(p, `🪙 Stones shift in the old vault. ${RARE.hoardBlows - s.rareBlows.n} more ${RARE.hoardBlows - s.rareBlows.n === 1 ? 'blow' : 'blows'}.`, 'routine'); sendRoom(player.room); return; }
        s.rareOpen = r.token;
        for (const p of players.values()) if (p.room === player.room) say(p, '🪙 The stones come down. Somebody walled this up meaning to come back, and never did. Reach in.');
        sendRoom(player.room);
        return;
      }
      if (!mayTake(player, place, key)) { say(player, 'You have had your share of this hoard.', 'routine'); return; }
      took(player, place, key, RARE.spellMs * 2);
      const [lo, hi] = RARE.hoardPurse, c = TIER_COIN[tier] || TIER_COIN[1], a = Math.round(lo * c), b = Math.round(hi * c);
      const pending = [{ kind: 'gold', amount: a + Math.floor(random() * (b - a + 1)) }];
      for (let i = 0; i < RARE.hoardRolls; i++) pending.push(...tierLoot(tier));
      give(player, pending);
      noteRare(player, r.kind);
      say(player, '🪙 Coin gone green, a spoon, a ring too small for you, wrapped in a rotten cloth. Your share.');
      sendTo(player);
      return;
    }
    // the pin well
    if (!mayTake(player, place, key)) { say(player, 'Your pin is in the water already. One is enough.', 'routine'); return; }
    took(player, place, key, RARE.spellMs * 2);
    const max = playerMaxHealth(player);
    if (player.health > 0) player.health = max;
    player.dungeonKeys = (player.dungeonKeys || 0) + 1;
    grantXP(player, RARE.wellXp);
    noteRare(player, r.kind);
    say(player, '📍 You bend a pin and let it fall. It turns over twice and lies with the others. The water is cold enough to hurt, and you are whole; and by the basin, where you would swear there was nothing, a bone key.');
    sendTo(player);
  }

  // A side goal done: everyone in the room is paid, once each in half an hour.
  function finishGoal(room, place, s, goal) {
    s.goalDoneAt[goal] = now();
    const tier = place.tier;
    for (const p of players.values()) {
      if (p.room !== room || p.isDead) continue;
      if (!mayTake(p, place, 'goal_' + goal)) { say(p, goal === 'braziers' ? '🔥 Every brazier burns.' : '💥 Every seal is broken.', 'routine'); continue; }
      took(p, place, 'goal_' + goal, TAKE_AGAIN_MS);
      give(p, [purse(goal, tier)]);
      grantXP(p, goal === 'braziers' ? 20 * tier : 30 * tier);
      say(p, goal === 'braziers'
        ? '🔥 Every brazier burns: a need-fire, kindled new to drive the bad air back. Somebody left a purse for whoever lit it.'
        : '💥 The last seal breaks. What it held shut has gone, and left its hoard.');
    }
  }

  // Traps, a few times a second: a plate bites once and re-arms, a vent only
  // while it is breathing, a rockfall after a warning you can step out from
  // under. A trap never takes your last point of health.
  function hurt(player, trap, tier) {
    const dmg = absorbIncomingDamage(player, TRAPS[trap.kind].dmg(tier));
    const left = Math.max(1, player.health - dmg);
    const dealt = player.health - left;
    if (dealt <= 0) return;
    player.health = left;
    noteAttacked(player);
    send(player.ws, { type: 'struck', byName: TRAPS[trap.kind].name, damage: dealt, trap: trap.id });
  }
  const ventOpen = (trap, t) => ((t + (trap.x * 7 + trap.y * 13)) % TRAPS.vent.cycleMs) < TRAPS.vent.openMs;
  function tick() {
    const t = now();
    // rare rooms: tell a dungeon when one opens or closes, and mend whoever rests among the marks
    const told = new Set();
    for (const player of players.values()) {
      const place = placeOf(player.room);
      if (!place) { mendClock.delete(player.id); continue; }
      if (!told.has(place.key)) {
        told.add(place.key);
        const r = rareOf(place), tok = r ? r.token : '';
        if (rareSeen.get(place.key) !== tok) {
          const first = !rareSeen.has(place.key);
          rareSeen.set(place.key, tok);
          if (!first) for (const p of players.values()) if (p.room === player.room) { if (r) say(p, rareNews(r)); sendTo(p); }
        }
      }
      if (player.isDead || !(player.health > 0) || !sheltered(player)) { mendClock.delete(player.id); continue; }
      const next = mendClock.get(player.id);
      if (next === undefined) { mendClock.set(player.id, t + RARE.mendEveryMs); continue; }
      if (t < next) continue;
      mendClock.set(player.id, t + RARE.mendEveryMs);
      const max = playerMaxHealth(player);
      if (player.health < max) player.health = Math.min(max, player.health + Math.max(1, Math.round(max * RARE.mendShare)));
    }
    for (const player of players.values()) {
      if (player.isDead || !(player.health > 1)) continue;
      const place = placeOf(player.room);
      if (!place) continue;
      for (const trap of DUNGEON_LAYOUTS[place.n].traps) {
        const inside = Math.hypot(trap.x - player.x, trap.y - player.y) < trap.r;
        const key = player.id + '|' + trap.id;
        const c = trapClock.get(key);
        if (!inside) { if (c && c.warnAt) c.warnAt = 0; continue; }
        const def = TRAPS[trap.kind];
        if (c && c.next > t) continue;
        if (trap.kind === 'vent') { if (!ventOpen(trap, t)) continue; hurt(player, trap, place.tier); trapClock.set(key, { next: t + def.rearmMs, warnAt: 0 }); continue; }
        if (trap.kind === 'rockfall') {
          if (!c || !c.warnAt) { trapClock.set(key, { next: 0, warnAt: t }); send(player.ws, { type: 'trap_warn', trap: trap.id, ms: def.warnMs }); continue; }
          if (t - c.warnAt < def.warnMs) continue;
        }
        hurt(player, trap, place.tier);
        trapClock.set(key, { next: t + def.rearmMs, warnAt: 0 });
      }
    }
  }

  return { rareOf, sheltered, RARE, use, tick, onEnter, onLeave, onKill, resetRoom, payloadFor, sendTo, sendRoom, placeOf, ventOpen, TRAPS, USE_RANGE, TAKE_AGAIN_MS, NODE_AGAIN_MS, KEY_DROP_CHANCE, SEAL_BLOWS, TIER_COIN, PURSES, _state: { rooms, again, trapClock } };
};
