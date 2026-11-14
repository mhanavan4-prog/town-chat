// Ashminster (data/emberTown.js): the minster's peace. No creature of the
// Wastes comes inside the frith. Someone who takes hold of the sanctuary
// knocker has sanctuary: for a time, and while she stays inside the frith, no
// other player can strike her, nor she them. The anchoress speaks through her
// squint; the marks and the crosses can be read.
const { EMBER_TOWN: T, ASH_SPOTS, SANCTUARY, WITCH_MARKS, ANCHORESS } = require('../data/emberTown');

module.exports = function createAshminster({ send, now = () => Date.now(), onArrive = () => {}, onSpoke = () => {}, onSpeak = () => {}, epilogue = () => null }) {
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });
  const board = (player, title, epithet, lines) => send(player.ws, { type: 'vh_board', title, epithet, lines });
  const inFrith = (x, y) => Math.hypot(x - T.x, y - T.y) < T.frith;
  const inTown = (x, y) => T.ground.some((g) => Math.hypot(x - g.x, y - g.y) < g.r);

  // Does she hold sanctuary now? (The one question the rest of the server asks.)
  function holds(p) { return !!(p && p.sanctuaryUntil && p.room === 'ember_wastes' && !p.isDead && now() < p.sanctuaryUntil && inFrith(p.x, p.y)); }

  // A creature's place: never inside the frith. A point inside is put out to its edge.
  function keepOut(x, y) {
    const dx = x - T.x, dy = y - T.y, d = Math.hypot(dx, dy);
    if (d >= T.frith) return null;
    const ux = d > 1 ? dx / d : 0, uy = d > 1 ? dy / d : 1;
    return { x: T.x + ux * T.frith, y: T.y + uy * T.frith };
  }

  function use(player, id) {
    const spot = ASH_SPOTS[String(id || '')];
    if (!spot || !player || player.isDead || player.room !== 'ember_wastes') return false;
    if (Math.hypot(player.x - spot.x, player.y - spot.y) > T.range) { say(player, 'Go up to it.'); return false; }
    if (id === 'knocker') {
      if (holds(player)) {
        say(player, `🚪 You have sanctuary already, for ${Math.max(1, Math.ceil((player.sanctuaryUntil - now()) / 60000))} minutes more, while you stay inside the frith crosses.`);
        board(player, '🚪 Sanctuary', 'In the record', [...SANCTUARY.lore, `Source: ${SANCTUARY.source}`, SANCTUARY.note]);
        return false;
      }
      player.sanctuaryUntil = now() + T.sanctuaryMs;
      say(player, `🚪 You take hold of the ring. It is cold and it is worn bright where every hand before yours took it. You have sanctuary: ${Math.round(T.sanctuaryMs / 60000)} minutes, inside the frith crosses, and no other blade can touch you there, nor yours them.`, 'ward');
      send(player.ws, { type: 'ash_state', sanctuaryUntil: player.sanctuaryUntil });
      return true;
    }
    if (id === 'anchoress') {
      onSpeak(player);   // every time: a story chapter that sends you to her may have begun since you first spoke
      const after = epilogue(player);   // her word on your story's end, once (data/epilogues.js)
      if (after) { say(player, `🕯️ ${after}`, 'epilogue'); return true; }
      const n = player.isoltHeard || 0;
      if (n < ANCHORESS.says.length) {
        player.isoltHeard = n + 1;
        say(player, `🕯️ ${ANCHORESS.says[n]}`);
        if (n === 0) onSpoke(player);
        return true;
      }
      // her piece said: once, what an anchoress was; and after that, what she would have done
      if (n === ANCHORESS.says.length) { player.isoltHeard = n + 1; board(player, `🕯️ ${ANCHORESS.name}`, 'In the record', [...ANCHORESS.lore, `Source: ${ANCHORESS.source}`, ANCHORESS.note]); return false; }
      send(player.ws, { type: 'ash_quest', npcId: 'npc_anchoress', npcName: '🕯️ Dame Isolt' });
      return false;
    }
    if (id === 'marks') { board(player, '✴️ The marks at the breach', 'In the record', [...WITCH_MARKS.lore, `Source: ${WITCH_MARKS.source}`, WITCH_MARKS.note]); return false; }
    if (id === 'frith') { board(player, '✝️ The frith cross', 'In the record', ['This cross and three others stand at the edge of the minster\'s peace. Inside them no creature of the Wastes will come.', ...SANCTUARY.lore, `Source: ${SANCTUARY.source}`, SANCTUARY.note]); return false; }
    return false;
  }

  // On the server's tick: sanctuary ends when its time is out or she leaves the
  // frith, and she is told; and the place is named done to whoever first walks into it.
  function tick(players) {
    for (const p of players) {
      if (!p || p.room !== 'ember_wastes') { if (p && p.sanctuaryUntil) p.sanctuaryUntil = 0; if (p) p.inAshminster = false; continue; }
      if (p.sanctuaryUntil && !holds(p) && !p.isDead) {
        const timed = now() >= p.sanctuaryUntil;
        p.sanctuaryUntil = 0;
        send(p.ws, { type: 'ash_state', sanctuaryUntil: 0 });
        say(p, timed ? '🚪 Your sanctuary has run its time. The knocker will give it again.' : '🚪 You have gone out past the frith crosses, and your sanctuary stays behind you.');
      }
      const here = inTown(p.x, p.y);
      if (here && !p.inAshminster) onArrive(p);
      p.inAshminster = here;
    }
  }

  return { use, tick, holds, keepOut, inFrith, inTown };
};
