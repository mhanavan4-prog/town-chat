// The witches' ring (data/witchRing.js). By night each of the five places
// gives that witch's voice, once a night for each person; all five and the
// elder speaks. Five people standing each in a place at once: the ring sings
// for all five, once a night. By day the places and the elder read their
// boards.
const { RING, FIVE, ELDER, RING_LORE } = require('../data/witchRing');
const BY_ID = Object.fromEntries(FIVE.map((w) => [w.id, w]));

module.exports = function createWitchRing({ send, grantXP, players, isNight, cycleId, acctOf = () => null, bankOf = () => null, tellWastes = () => {}, noteRing = () => {}, noteSung = () => {} }) {
  let sungCycle = null;
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });
  const stateOf = (player) => {
    const holder = acctOf(player) || player;
    const st = holder.witchRing || (holder.witchRing = { cycle: null, heard: [], elder: false });
    if (st.cycle !== cycleId()) { st.cycle = cycleId(); st.heard = []; st.elder = false; }
    return st;
  };
  const near = (p, x, y, r) => p && p.room === 'ember_wastes' && !p.isDead && Math.hypot(p.x - x, p.y - y) <= r;
  const placeBoard = (player, w) => send(player.ws, { type: 'vh_board', title: `🕯️ ${w.name}'s place`, epithet: 'The ring', lines: [...RING_LORE.lines] });
  const elderBoard = (player) => send(player.ws, { type: 'vh_board', title: '🌿 The elder in the ring', epithet: 'Folk tradition', lines: [...ELDER.lore, `Source: ${ELDER.source}`, ELDER.note] });

  // Is there someone living in every one of the five places, and are they five different people?
  function fiveStanding() {
    const who = FIVE.map((w) => [...players.values()].filter((p) => near(p, w.x, w.y, RING.range)));
    if (who.some((list) => !list.length)) return null;
    const chosen = new Set();
    for (const list of who) { const p = list.find((q) => !chosen.has(q)); if (!p) return null; chosen.add(p); }
    return [...chosen];
  }

  function use(player, id) {
    if (!player || player.isDead || player.room !== 'ember_wastes') return false;
    if (id === 'elder') {
      if (!near(player, RING.x, RING.y, RING.elderRange)) { say(player, 'Go up to it.'); return false; }
      const st = stateOf(player);
      if (!isNight() || st.elder || st.heard.length < FIVE.length) {
        if (isNight() && !st.elder && st.heard.length < FIVE.length) say(player, `🌿 The elder is still. ${FIVE.length - st.heard.length} of the five have not spoken to you tonight.`);
        elderBoard(player); return false;
      }
      st.elder = true;
      grantXP(player, RING.elderXp);
      noteRing(player);
      say(player, `🌿 ${ELDER.says} (+${RING.elderXp} XP)`, 'candle_out');
      return true;
    }
    const w = BY_ID[String(id || '')];
    if (!w) return false;
    if (!near(player, w.x, w.y, RING.range)) { say(player, `Stand in ${w.name}'s place.`); return false; }
    if (!isNight()) { say(player, `🕯️ ${w.name}'s place. Worn smooth, a hand deep. Nothing speaks here by day.`); placeBoard(player, w); return false; }
    // five standing at once: the ring sings
    const five = fiveStanding();
    if (five && sungCycle !== cycleId()) {
      sungCycle = cycleId();
      for (const p of five) {
        grantXP(p, RING.sungXp);
        const bank = bankOf(p); if (bank) bank.balance += RING.sungGold;
        noteSung(p);
        say(p, `🎶 Five of you, in the five places, under the stones. The ring sings: a sound out of the ground like a hand drawn round the rim of a glass, rising until the elder\'s leaves shake, and the Wastes go quiet for a mile in every direction. (+${RING.sungXp} XP${bank ? `, +${RING.sungGold} gold` : ''})`, 'stones_counted');
      }
      tellWastes({ type: 'toast', level: 'important', always: true, message: '🎶 Far off in the west, something is singing. The ring is awake.' });
      tellWastes({ type: 'ring_sung' });   // its glow goes out for the night (client/ember-storm.js)
    }
    const st = stateOf(player);
    if (st.heard.includes(w.id)) { placeBoard(player, w); return !!five; }
    st.heard.push(w.id);
    grantXP(player, RING.voiceXp);
    say(player, `🕯️ ${w.name}: ${w.says}${st.heard.length === FIVE.length ? ' (All five have spoken. Go to the elder.)' : ` (${st.heard.length} of ${FIVE.length})`}`, 'candle_rise');
    send(player.ws, { type: 'ring_state', heard: [...st.heard], elder: st.elder });
    return true;
  }

  const payload = (player) => { const st = stateOf(player); return { type: 'ring_state', heard: [...st.heard], elder: st.elder, sung: sungCycle === cycleId() }; };
  return { use, payload, fiveStanding };
};
