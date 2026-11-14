'use strict';
// The Wastes' two reading places (data/emberLore.js): the sin-eater's stone and the watching place. Once a day
// each pays a little; what is found there heads its history, on the one board.
const { EMBER_LORE_BY_ID, LORE } = require('../data/emberLore');

module.exports = function createEmberLore({ send, grantXP, acctOf = () => null, now = () => Date.now() }) {
  const day = () => Math.floor(now() / 86400000);
  const stateOf = (player) => {
    const holder = acctOf(player) || player;
    if (!holder.emberLore || holder.emberLore.day !== day()) holder.emberLore = { day: day(), done: [] };
    return holder.emberLore;
  };
  const payload = (player) => ({ type: 'ember_lore_state', done: [...stateOf(player).done] });
  function use(player, id) {
    const e = EMBER_LORE_BY_ID[String(id || '')];
    if (!e || !player || player.isDead || player.room !== 'ember_wastes') return false;
    if (Math.hypot(player.x - e.x, player.y - e.y) > LORE.range) { send(player.ws, { type: 'toast', level: 'important', always: true, message: 'Go up to it.' }); return false; }
    const st = stateOf(player), first = !st.done.includes(e.id);
    send(player.ws, { type: 'vh_board', title: `${e.icon} ${e.name}`, epithet: e.tier === 'record' ? 'In the record' : 'Folk tradition', lines: [...(first ? [e.says] : []), ...e.lore, `Source: ${e.source}`, e.note], ...(first ? { sfx: 'daybook' } : {}) });
    if (!first) return false;
    st.done.push(e.id);
    grantXP(player, LORE.xp);
    send(player.ws, payload(player));
    return true;
  }
  return { use, payload, stateOf };
};
