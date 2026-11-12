// The corpse candle on the road north (data/wayside.js CANDLE). By night,
// when a witch comes near the coffin stone, a small light sets out down the
// road toward the gibbet. Keep behind it to the end and you are told whose it
// was; get in its way and it throws you down; fall too far behind and it is
// gone. Once a night each. Hers alone: nobody else sees her candle.
const { CANDLE, WAYSIDE_BY_ID } = require('../data/wayside');

// Lengths along the path, once.
const SEG = [];
let TOTAL = 0;
for (let i = 0; i < CANDLE.path.length - 1; i++) {
  const [ax, ay] = CANDLE.path[i], [bx, by] = CANDLE.path[i + 1];
  const len = Math.hypot(bx - ax, by - ay);
  SEG.push({ ax, ay, bx, by, len, at: TOTAL });
  TOTAL += len;
}
function along(d) {
  const dd = Math.max(0, Math.min(TOTAL, d));
  for (const s of SEG) if (dd <= s.at + s.len) { const u = (dd - s.at) / s.len; return { x: s.ax + (s.bx - s.ax) * u, y: s.ay + (s.by - s.ay) * u }; }
  const l = SEG[SEG.length - 1]; return { x: l.bx, y: l.by };
}
// Where on the road a point is: how far along, and how far off to the side.
function onRoad(x, y) {
  let best = { d: 0, off: Infinity };
  for (const s of SEG) {
    const u = Math.max(0, Math.min(1, ((x - s.ax) * (s.bx - s.ax) + (y - s.ay) * (s.by - s.ay)) / (s.len * s.len)));
    const off = Math.hypot(x - (s.ax + (s.bx - s.ax) * u), y - (s.ay + (s.by - s.ay) * u));
    if (off < best.off) best = { d: s.at + u * s.len, off };
  }
  return best;
}

module.exports = function createCorpseCandle({ send, grantXP, playerMaxHealth, acctOf = () => null, isNight, noteCandle = () => {}, now = () => Date.now(), random = Math.random }) {
  const stone = WAYSIDE_BY_ID[CANDLE.from];
  const day = () => Math.floor(now() / 86400000);
  const say = (player, message) => send(player.ws, { type: 'toast', level: 'important', always: true, message });
  const seenTonight = (player) => { const h = acctOf(player) || player; return h.candleDay === day(); };
  const end = (player) => { player.candle = null; send(player.ws, { type: 'candle_state', on: false }); };

  // Called on the server's tick with everyone who is in the world. Returns
  // those who followed one to the end (so the caller can save).
  function tick(players) {
    const followed = [];
    for (const p of players) {
      if (!p) continue;
      const c = p.candle;
      if (!c) {
        if (p.room !== 'wilds' || p.isDead || !isNight() || seenTonight(p)) continue;
        if (Math.hypot(p.x - stone.x, p.y - stone.y) > CANDLE.wake) continue;
        const kind = CANDLE.kinds[Math.floor(random() * CANDLE.kinds.length) % CANDLE.kinds.length];
        (acctOf(p) || p).candleDay = day();
        p.candle = { t0: now(), kind: kind.id, lostAt: 0 };
        send(p.ws, { type: 'candle_state', on: true, path: CANDLE.path, speed: CANDLE.speed, standMs: CANDLE.standMs, colour: kind.colour, size: kind.size });
        say(p, `🕯️ ${kind.name[0].toUpperCase() + kind.name.slice(1)} comes away from the coffin stone, a hand above the ground, and stands there with nobody carrying it. A corpse candle. It will go down the road to the gibbet: get off the road, keep behind it, and do not get in its way.`);
        continue;
      }
      if (p.room !== 'wilds' || p.isDead) { end(p); continue; }
      const moving = now() - c.t0 >= CANDLE.standMs;   // it stands by the stone first: time to get off the road
      const went = Math.max(0, now() - c.t0 - CANDLE.standMs) / 1000 * CANDLE.speed;
      const at = along(went), dist = Math.hypot(p.x - at.x, p.y - at.y);
      const kind = CANDLE.kinds.find((k) => k.id === c.kind) || CANDLE.kinds[0];
      if (went >= TOTAL) {
        end(p);
        if (dist <= CANDLE.lose) {
          grantXP(p, CANDLE.xp);
          noteCandle(p);
          say(p, `🕯️ At the foot of the gibbet the light stands a moment and goes out. It was ${kind.whose}. You know the road it took, and you will know the bell when you hear it. (+${CANDLE.xp} XP)`);
          followed.push(p);
        } else say(p, '🕯️ Far ahead of you the light stands a moment by the gibbet and goes out. You were too far behind to see whose it was.');
        continue;
      }
      const where = onRoad(p.x, p.y);
      if (moving && (dist < CANDLE.cross || (where.off < CANDLE.beside && where.d > went + CANDLE.ahead))) {
        const max = playerMaxHealth(p);
        if (p.health > 1) p.health = Math.max(1, p.health - Math.round(max * CANDLE.struck));
        end(p);
        say(p, '🕯️ You are in its road. Something you do not see walks into you like a man carrying one end of a heavy load, and you are thrown down on the verge. When you get up the light is gone.');
        continue;
      }
      if (dist > CANDLE.lose) {
        if (!c.lostAt) c.lostAt = now();
        else if (now() - c.lostAt >= CANDLE.loseMs) { end(p); say(p, '🕯️ You let it get too far ahead. The light goes on down the road without you and is lost among the trees.'); }
      } else c.lostAt = 0;
    }
    return followed;
  }

  return { tick, along, onRoad, total: TOTAL };
};
