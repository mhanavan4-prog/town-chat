'use strict';
// The drove road (data/droveRoad.js): the milestone, the pines, the need-fire
// and the march stone, each once a day; done again that day, its history.
// All four in a day is the road walked. The gate itself (crossing between the
// Wilds and the Ember Wastes) is in server.js, which owns the rooms.
const { ROAD, STOPS, STOPS_BY_ID } = require('../data/droveRoad');

module.exports = function createDroveRoad({ send, grantXP, playerMaxHealth, acctOf = () => null, bankOf = () => null, noteWalked = () => {}, now = () => Date.now() }) {
  const day = () => Math.floor(now() / 86400000);
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });
  const stateOf = (player) => {
    const holder = acctOf(player) || player;
    if (!holder.droveRoad || holder.droveRoad.day !== day()) holder.droveRoad = { day: day(), done: [], walked: false };
    return holder.droveRoad;
  };
  const board = (player, s) => send(player.ws, { type: 'vh_board', title: `${s.icon} ${s.name}`, epithet: s.tier === 'record' ? 'In the record' : 'Folk tradition', lines: [...s.lore, `Source: ${s.source}`, s.note] });
  const payload = (player) => ({ type: 'drove_state', done: [...stateOf(player).done], walked: stateOf(player).walked });

  // The need-fire's smoke: how much less the Wastes' creatures hurt you now.
  const smokeCut = (player) => (player && player.needfireUntil > now() ? ROAD.needfireCut : 0);

  function use(player, id) {
    const s = STOPS_BY_ID[String(id || '')];
    if (!s || !player || player.isDead || player.room !== 'wilds') return false;
    if (Math.hypot(player.x - s.x, player.y - s.y) > ROAD.range) { say(player, 'Go up to it.'); return false; }
    const st = stateOf(player);
    if (st.done.includes(s.id)) { board(player, s); return false; }
    if (s.id === 'pines') {
      const max = playerMaxHealth(player);
      if (player.health > 0) player.health = Math.min(max, player.health + Math.round(max * ROAD.stanceHeal));
    }
    if (s.id === 'needfire') {
      player.needfireUntil = now() + ROAD.needfireMs;
      send(player.ws, { type: 'needfire_state', until: player.needfireUntil });
    }
    say(player, s.says, s.id === 'needfire' ? 'needfire_kindle' : s.id === 'pines' ? 'stance_rest' : null);
    if (s.id === 'gate' || s.id === 'milestone') board(player, s);
    st.done.push(s.id);
    grantXP(player, ROAD.eachXp);
    if (!st.walked && STOPS.every((x) => st.done.includes(x.id))) {
      st.walked = true;
      const bank = bankOf(player);
      if (bank) bank.balance += ROAD.walkedGold;
      grantXP(player, ROAD.walkedXp);
      noteWalked(player);
      say(player, `🐄 The milestone, the stance, the need-fire and the march: you have walked the drove road.${bank ? ` (+${ROAD.walkedGold} gold, +${ROAD.walkedXp} XP)` : ` (+${ROAD.walkedXp} XP)`}`);
    }
    send(player.ws, payload(player));
    return true;
  }

  return { use, payload, stateOf, smokeCut };
};
