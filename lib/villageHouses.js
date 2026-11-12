// The village's opened buildings (data/villageHouses.js): going in and out,
// and what each is for. The barn's ledger is the bank's own (the server lets
// the bank be opened there); the hall's hearth, the hall's board and the
// tower's look-out are answered here.
const { VILLAGE_HOUSES, HOUSE_BY_ROOM, VH, WISE_WOMAN, LYKE_WAKE } = require('../data/villageHouses');

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
// which way (x east, y south) and roughly how far one place lies from another
function bearing(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const a = Math.atan2(dx, -dy), i = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  const d = Math.hypot(dx, dy);
  return `${d < 1200 ? 'close by, ' : d < 3000 ? '' : 'far off, '}to the ${COMPASS[i]}`;
}

module.exports = function createVillageHouses({ send, playerMaxHealth, wildsFinds, wildsData, abroad = () => [], bankOf = () => null, acctOf = () => null, now = () => Date.now() }) {
  const houseOf = (player) => HOUSE_BY_ROOM[player.room] || null;
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });

  function enter(player, id) {
    const h = VILLAGE_HOUSES[id];
    if (!h || !player || player.isDead || player.room !== 'wilds') return false;
    if (Math.hypot(player.x - h.door.x, player.y - h.door.y) > VH.doorRange) { say(player, 'Go up to the door.'); return false; }
    player.room = h.room; player.x = h.spawn.x; player.y = h.spawn.y; player.roomLockUntil = now() + 1500;
    send(player.ws, { type: 'vh_entered', id: h.id, spawn: h.spawn });
    return true;
  }
  function exit(player) {
    const h = houseOf(player);
    if (!h) return false;
    player.room = 'wilds'; player.x = h.door.x; player.y = h.door.y + 30; player.roomLockUntil = now() + 1500;
    send(player.ws, { type: 'vh_exited', id: h.id, x: player.x, y: player.y });
    return true;
  }
  const hours = (ms) => { const h = Math.max(1, Math.round(ms / 3600000)); return h === 1 ? '1 hour' : `${h} hours`; };
  // Where she wakes if the Wilds kill her: outside the Lyke-Wake's door, while her bed there is paid for; else null.
  function wakeAt(player) {
    const a = acctOf(player);
    if (!a || !a.lodging || !(a.lodging.until > now())) return null;
    const d = VILLAGE_HOUSES.lodging.door;
    return { x: d.x, y: d.y + 30 };
  }
  // Somebody who logs out indoors, or dies there, is put back at the door.
  function doorOf(room) { const h = HOUSE_BY_ROOM[room]; return h ? { x: h.door.x, y: h.door.y + 30 } : null; }

  function use(player, spotId) {
    const h = houseOf(player);
    if (!h || player.isDead) return;
    const spot = h.spots.find((s) => s.id === spotId);
    if (!spot) return;
    if (Math.hypot(player.x - spot.x, player.y - spot.y) > VH.spotRange) { say(player, 'Go closer to it.'); return; }
    if (spot.id === 'hearth') {
      const t = now(), rest = (player.hearthRestUntil || 0) - t, max = playerMaxHealth(player);
      if (player.health >= max) { say(player, '🔥 You sit a while by the fire. There is nothing wrong with you that it can mend.'); return; }
      if (rest > 0) { say(player, `🔥 You have had the good of the fire for now. Come back to it in ${Math.max(1, Math.ceil(rest / 60000))} ${Math.ceil(rest / 60000) === 1 ? 'minute' : 'minutes'}.`); return; }
      player.health = max; player.hearthRestUntil = t + VH.hearthRestMs;
      say(player, '🔥 Somebody makes room on the bench and puts a bowl in your hands. By the time it is empty you are whole again.', 'heal');
      return;
    }
    if (spot.id === 'board') { send(player.ws, { type: 'vh_board', title: '📜 The moot board', epithet: 'what is abroad, as far as anybody here has seen', lines: abroad(player) }); return; }
    if (spot.id === 'lookout') { send(player.ws, { type: 'vh_board', title: '🗼 From the look-out', epithet: 'the Wilds, laid out like a cloth', lines: lookout(player) }); return; }
    if (spot.id === 'keeper') {
      send(player.ws, { type: 'vh_board', title: '🕯️ The Lyke-Wake', epithet: 'In the record', lines: [...LYKE_WAKE.lore, `Source: ${LYKE_WAKE.source}`, LYKE_WAKE.note] });
      return;
    }
    if (spot.id === 'bed') {
      const a = acctOf(player), t = now();
      if (!a) { say(player, '🕯️ "A bed is kept for a name, and you have not given one." (Log into an account.)'); return true; }
      const left = ((a.lodging && a.lodging.until) || 0) - t;
      if (left > VH.bedRenewMs) { say(player, `🕯️ Your bed is paid for (${hours(left)} more). If the Wilds kill you, this is where you will wake.`); return true; }
      const acct = bankOf(player);
      if (!acct || acct.balance < VH.bedGold) { say(player, `🕯️ "It is ${VH.bedGold} gold for a day and a night, fire and candle found." You have not got it.`); return true; }
      acct.balance -= VH.bedGold;
      a.lodging = { until: t + VH.bedMs };
      say(player, `🕯️ You pay your ${VH.bedGold} gold and are shown a bed by the wall. "If you come to grief out there, you'll be fetched in and sat up with." For a day and a night, if the Wilds or the deeps under them kill you, you will wake here.`);
      return 'paid';
    }
    if (spot.id === 'trade') {
      send(player.ws, { type: 'vh_board', title: `🌿 ${WISE_WOMAN.name}, on her trade`, epithet: 'In the record', lines: [...WISE_WOMAN.lore, `Source: ${WISE_WOMAN.source}`, WISE_WOMAN.note] });
      return;
    }
    if (spot.id === 'unwitch') {
      const st = player.activeStatus && player.activeStatus.expiresAt > now() ? player.activeStatus : null;
      if (!st || !VH.harms.includes(st.type)) { say(player, '🌿 She looks you over, turns your hands up, and shakes her head. "There\'s nothing on you but the weather. Keep your money."'); return true; }
      const acct = bankOf(player);
      if (!acct) { say(player, '🌿 "I\'ll want paying, and you have no name to put it to." (Log into an account.)'); return true; }
      if (acct.balance < VH.unwitchGold) { say(player, `🌿 "That wants taking off, and it is ${VH.unwitchGold} gold to do it." You have not got it.`); return true; }
      acct.balance -= VH.unwitchGold;
      player.activeStatus = null;
      say(player, `🌿 She heats a pin, says something into a bottle you cannot hear, and stops it hard. Whatever was on you goes out of the room like a draught. (${VH.unwitchGold} gold)`, 'cleanse');
      return 'paid';
    }
    // the barn's ledger is opened by the client as the bank is, and the wise-woman's shelf as a shop; nothing to answer here
  }

  // What can be seen from the top of the tower: the day's balefires, lit and
  // unlit, and how many cairns she has not been through, with where they lie.
  function lookout(player) {
    const from = VILLAGE_HOUSES.tower.door, st = wildsFinds.payloadFor(player), lit = new Set(st.lit || []), used = new Set(st.used || []);
    const lines = [];
    const dark = wildsData.balefires.filter((f) => !lit.has(f.id));
    lines.push(dark.length === 0 ? '🔥 All six balefires are burning. You can see every one from here.'
      : `🔥 ${wildsData.balefires.length - dark.length} of ${wildsData.balefires.length} balefires are lit today. Dark still: ${dark.map((f) => bearing(from, f)).join('; ')}.`);
    const left = wildsData.caches.filter((c) => !used.has(c.id));
    if (!left.length) lines.push('🪨 You have been through every cairn you can see.');
    else {
      const near = [...left].sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y)).slice(0, 3);
      lines.push(`🪨 ${left.length} ${left.length === 1 ? 'cairn stands' : 'cairns stand'} that you have not searched. The nearest: ${near.map((c) => bearing(from, c)).join('; ')}.`);
    }
    lines.push(...abroad(player).filter((l) => /^(🌒|🌑|🌓|🌔|🌕|🌖|🌗|🌘|🔴|📯|💃)/u.test(l)));
    return lines;
  }
  return { enter, exit, use, doorOf, wakeAt, lookout, bearing, houseOf };
};
