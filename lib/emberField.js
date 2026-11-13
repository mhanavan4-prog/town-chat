// The field (data/emberField.js): twelve things left by the war, along the
// Ember Wastes' track. Each can be searched once a day for a little coin and
// the piece of the story it holds; pressing again that day reads it back (and,
// for the two that are in the record, what the record says). Finding all
// twelve, ever, is walking the field: a purse, a title, a line in the daybook.
const { FINDS, FINDS_BY_ID, FIELD } = require('../data/emberField');

module.exports = function createEmberField({ send, grantXP, acctOf = () => null, bankOf = () => null, grantTitle = () => {}, noteWalked = () => {}, now = () => Date.now() }) {
  const day = () => Math.floor(now() / 86400000);
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });
  function stateOf(player) {
    const holder = acctOf(player) || player;
    const st = holder.emberField || (holder.emberField = { day: day(), done: [], ever: [] });
    if (st.day !== day()) { st.day = day(); st.done = []; }
    if (!Array.isArray(st.ever)) st.ever = [];
    return st;
  }
  const payload = (player) => { const st = stateOf(player); return { type: 'field_state', done: [...st.done], ever: [...st.ever], total: FINDS.length }; };
  function board(player, f) {
    const lines = [f.says];
    if (f.lore) lines.push(...f.lore, `Source: ${f.source}`, f.note);
    else lines.push('This is a piece of the game\'s own story: the war that made the Wastes, as Dame Isolt tells it at Ashminster.');
    send(player.ws, { type: 'vh_board', title: `${f.icon} ${f.name}`, epithet: f.tier === 'record' ? 'In the record' : f.tier === 'folk' ? 'Folk tradition' : 'The field', lines });
  }

  function use(player, id) {
    const f = FINDS_BY_ID[String(id || '')];
    if (!f || !player || player.isDead || player.room !== 'ember_wastes') return false;
    if (Math.hypot(player.x - f.x, player.y - f.y) > FIELD.range) { say(player, 'Go up to it.'); return false; }
    const st = stateOf(player);
    if (st.done.includes(f.id)) { board(player, f); return false; }
    st.done.push(f.id);
    const first = !st.ever.includes(f.id);
    if (first) st.ever.push(f.id);
    const bank = bankOf(player);
    if (bank) bank.balance += FIELD.gold;
    grantXP(player, FIELD.xp + (first ? FIELD.firstXp : 0));
    say(player, `${f.icon} ${f.says}${bank ? ` (+${FIELD.gold} gold` : ' ('}${bank ? ', ' : ''}+${FIELD.xp + (first ? FIELD.firstXp : 0)} XP)`, 'cairn_open');
    if (first && st.ever.length === FINDS.length) {
      if (bank) bank.balance += FIELD.allGold;
      if (acctOf(player)) grantTitle(player, FIELD.allTitle);
      noteWalked(player);
      say(player, `🕯️ That is all twelve. You have walked the whole field, and know more of what happened on it than anyone living but the anchoress.${bank ? ` (+${FIELD.allGold} gold)` : ''}`, 'daybook');
    }
    send(player.ws, payload(player));
    return true;
  }

  return { use, payload, stateOf };
};
