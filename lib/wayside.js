// The road north (data/wayside.js): the gibbet, the coin tree and the coffin
// stone. Each once a day; pressing again that day reads you its history. All
// three in a day is the road walked. Kept on the account (acct.wayside) for
// those who have one, and on the player for the length of a visit otherwise.
const { WAYSIDE, WAYSIDE_BY_ID, WAY, CANDLE } = require('../data/wayside');

module.exports = function createWayside({ send, grantXP, playerMaxHealth, acctOf = () => null, bankOf = () => null, noteRoad = () => {}, now = () => Date.now(), random = Math.random }) {
  const day = () => Math.floor(now() / 86400000);
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });
  const stateOf = (player) => {
    const a = acctOf(player), holder = a || player;
    if (!holder.wayside || holder.wayside.day !== day()) holder.wayside = { day: day(), done: [], road: false };
    return holder.wayside;
  };
  const board = (player, w) => send(player.ws, { type: 'vh_board', title: `${w.icon} ${w.name}`, epithet: w.tier === 'record' ? 'In the record' : 'Folk tradition', lines: [...w.lore, `Source: ${w.source}`, w.note,
    // by night a corpse candle goes down the road from the coffin stone (lib/corpseCandle.js)
    ...(w.id === CANDLE.from ? ['🕯️ By night: the corpse candle.', ...CANDLE.lore, `Source: ${CANDLE.source}`, CANDLE.note] : [])] });
  // What the client needs to mark the three: which she has done today.
  const payload = (player) => ({ type: 'wayside_state', done: [...stateOf(player).done], road: stateOf(player).road });

  // Returns true if anything was earned (so the caller can save).
  function use(player, id) {
    const w = WAYSIDE_BY_ID[String(id || '')];
    if (!w || !player || player.isDead || player.room !== 'wilds') return false;
    if (Math.hypot(player.x - w.x, player.y - w.y) > WAY.range) { say(player, 'Go up to it.'); return false; }
    const s = stateOf(player);
    if (s.done.includes(w.id)) { board(player, w); return false; }   // done today: its history instead
    if (w.id === 'cointree') {
      const acct = bankOf(player);
      if (!acct || acct.balance < WAY.coinGold) { say(player, '🪙 You have no coin to give it. The tree is thick with other people\'s.'); board(player, w); return false; }
      acct.balance -= WAY.coinGold;
      const heard = random() < WAY.wishChance;
      if (heard) acct.balance += WAY.wishGold;
      say(player, heard
        ? `🪙 You knock a coin in edgeways with a stone and wish. On the way back to the road you find a purse in the grass that nobody is looking for. (+${WAY.wishGold} gold)`
        : '🪙 You knock a coin in edgeways with a stone, among a hundred others gone green, and wish. Nothing answers. It seldom does.', 'moon_silver');
    } else if (w.id === 'gibbet') {
      const max = playerMaxHealth(player);
      if (player.health > 0) player.health = Math.min(max, player.health + Math.round(max * WAY.splinterHeal));
      say(player, '⛓️ The cage turns a little, though there is no wind. You cut a splinter from the post, as people do, and whatever ached aches less.', 'gibbet_splinter');
    } else {
      say(player, '⚰️ You set down what you are carrying on the flat of the stone, where the bearers set theirs, and stand a minute with your back to the way you came. It is easier to take up again.', 'coffin_rest');
    }
    s.done.push(w.id);
    grantXP(player, WAY.eachXp);
    if (!s.road && WAYSIDE.every((x) => s.done.includes(x.id))) {
      s.road = true;
      const acct = bankOf(player);
      if (acct) acct.balance += WAY.roadGold;
      grantXP(player, WAY.roadXp);
      noteRoad(player);
      say(player, `🛤️ The gibbet, the tree and the stone, all in one day: you have walked the road.${acct ? ` (+${WAY.roadGold} gold, +${WAY.roadXp} XP)` : ` (+${WAY.roadXp} XP)`}`);
    }
    send(player.ws, payload(player));
    return true;
  }
  return { use, payload, stateOf };
};
