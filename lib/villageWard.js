// The bound fires of the Wildlands Village (data/villageWard.js). One round
// for everyone, each night: fire carried to the four stones in the sun's
// order closes it, and until dawn nothing that hunts by night comes inside.
// Carried against the sun, or with a stone passed over, the round is broken
// and the fires go out.
const { WARD } = require('../data/villageWard');
const ORDER = WARD.stones.map((s) => s.id);
const BY_ID = Object.fromEntries(WARD.stones.map((s) => [s.id, s]));

module.exports = function createVillageWard({ send, tellWilds, grantXP, isNight, cycleId, playerById = () => null, noteWard = () => {}, onClosed = () => {} }) {
  let st = { cycle: null, lit: [], by: new Set(), warded: false };
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });
  const payload = () => ({ type: 'village_ward', lit: [...st.lit], warded: st.warded });
  const board = (player) => send(player.ws, { type: 'vh_board', title: '🔥 The bound fires', epithet: 'In the record', lines: [...WARD.lore, `Source: ${WARD.source}`, WARD.note] });

  // A night's round does not outlast the night. True if there was something to put out.
  function fresh() {
    const live = isNight() && st.cycle === cycleId();
    if (live) return false;
    const had = st.lit.length > 0;
    st = { cycle: isNight() ? cycleId() : null, lit: [], by: new Set(), warded: false };
    return had;
  }
  // On the server's tick: at dawn the fires are out, and everyone in the Wilds sees it.
  function tick() { if (fresh()) tellWilds(payload()); }
  function isWarded() { fresh(); return st.warded; }

  // Where a night creature may stand: not inside a closed round. A point inside is put out to its edge.
  function keepOut(x, y) {
    if (!st.warded || !isWarded()) return null;
    const dx = x - WARD.centre.x, dy = y - WARD.centre.y, d = Math.hypot(dx, dy);
    if (d >= WARD.radius) return null;
    const ux = d > 1 ? dx / d : 1, uy = d > 1 ? dy / d : 0;
    return { x: WARD.centre.x + ux * WARD.radius, y: WARD.centre.y + uy * WARD.radius };
  }

  function use(player, id) {
    const stone = BY_ID[String(id || '')];
    if (!stone || !player || player.isDead || player.room !== 'wilds') return false;
    if (Math.hypot(player.x - stone.x, player.y - stone.y) > WARD.range) { say(player, 'Go up to the stone.'); return false; }
    fresh();
    if (!isNight()) { say(player, '🔥 The basket is cold. The round is made after dark, when there is something to keep out.'); board(player); return false; }
    if (st.warded) { say(player, '🔥 The round is closed. Nothing that hunts by night will cross between the stones before dawn.'); board(player); return false; }
    if (st.lit.includes(stone.id)) { say(player, '🔥 This one is burning. Carry the fire on, the way the sun goes: east, south, west, north.'); board(player); return false; }
    if (st.lit.length) {
      const want = ORDER[(ORDER.indexOf(st.lit[st.lit.length - 1]) + 1) % ORDER.length];
      if (stone.id !== want) {
        st.lit = []; st.by = new Set();
        tellWilds(payload());
        tellWilds({ type: 'toast', level: 'important', always: true, message: `🌑 Fire was carried to ${stone.name} out of its turn, against the sun. Every basket on the round goes out at once. It must be begun again, and carried sunways: after ${BY_ID[ORDER[(ORDER.indexOf(want) + ORDER.length - 1) % ORDER.length]].name.replace(/^the /, 'the ')}, ${BY_ID[want].name}.` });
        return false;
      }
    }
    st.lit.push(stone.id); st.by.add(player.id);
    grantXP(player, WARD.eachXp);
    if (st.lit.length < ORDER.length) {
      const next = BY_ID[ORDER[(ORDER.indexOf(stone.id) + 1) % ORDER.length]];
      say(player, `🔥 The basket on ${stone.name} takes. ${st.lit.length} of ${ORDER.length}. Carry it on sunways to ${next.name}.`, 'balefire_light');
      tellWilds(payload());
      return true;
    }
    st.warded = true;
    tellWilds(payload());
    tellWilds({ type: 'toast', level: 'important', always: true, sfx: 'ward', message: '🔥 The fourth bound fire takes and the round is closed, sunways, with fire. Until dawn nothing that hunts by night will come inside the stones of the Wildlands Village.' });
    for (const pid of st.by) { const p = playerById(pid); if (p) { grantXP(p, WARD.roundXp); noteWard(p); } }
    onClosed();
    return true;
  }

  return { use, tick, isWarded, keepOut, payload, board, state: () => st };
};
