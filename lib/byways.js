'use strict';
// By-ways of the Wilds (data/byways.js): the shoe in the chimney, the Devil's
// stone and Hob's hole, each once a day; done again that day, its history.
// All three in a day is the by-ways walked.
const { BYWAYS, BYWAYS_BY_ID, BYWAY } = require('../data/byways');

module.exports = function createByways({ send, grantXP, playerMaxHealth, acctOf = () => null, bankOf = () => null, noteWalked = () => {}, now = () => Date.now() }) {
  const day = () => Math.floor(now() / 86400000);
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });
  const stateOf = (player) => {
    const holder = acctOf(player) || player;
    if (!holder.byways || holder.byways.day !== day()) holder.byways = { day: day(), done: [], walked: false };
    return holder.byways;
  };
  // `lead` is what you find there, put at the head of the history when both come at once (a toast over the board hides its first lines on a phone)
  const board = (player, b, lead, sfx) => send(player.ws, { type: 'vh_board', title: `${b.icon} ${b.name}`, epithet: b.tier === 'record' ? 'In the record' : 'Folk tradition', lines: [...(lead ? [lead] : []), ...b.lore, `Source: ${b.source}`, b.note], ...(sfx ? { sfx } : {}) });
  const payload = (player) => ({ type: 'byway_state', done: [...stateOf(player).done], walked: stateOf(player).walked });

  function use(player, id) {
    const b = BYWAYS_BY_ID[String(id || '')];
    if (!b || !player || player.isDead || player.room !== 'wilds') return false;
    if (Math.hypot(player.x - b.x, player.y - b.y) > BYWAY.range) { say(player, 'Go up to it.'); return false; }
    const st = stateOf(player);
    if (st.done.includes(b.id)) { board(player, b); return false; }
    if (b.id === 'hob') {
      const max = playerMaxHealth(player);
      if (player.health > 0) player.health = Math.min(max, player.health + Math.round(max * BYWAY.hobHeal));
    }
    if (b.id === 'shoe') board(player, b, b.says, 'byway_shoe');   // nothing to do there but look, so the history comes with it
    else say(player, b.says, b.id === 'hob' ? 'byway_hob' : 'byway_stone');
    st.done.push(b.id);
    grantXP(player, BYWAY.eachXp);
    if (!st.walked && BYWAYS.every((x) => st.done.includes(x.id))) {
      st.walked = true;
      const bank = bankOf(player);
      if (bank) bank.balance += BYWAY.walkedGold;
      grantXP(player, BYWAY.walkedXp);
      noteWalked(player);
      say(player, `🥾 The shoe, the stone and the hole: you have walked the by-ways.${bank ? ` (+${BYWAY.walkedGold} gold, +${BYWAY.walkedXp} XP)` : ` (+${BYWAY.walkedXp} XP)`}`);
    }
    send(player.ws, payload(player));
    return true;
  }

  return { use, payload, stateOf };
};
