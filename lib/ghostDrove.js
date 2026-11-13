'use strict';
// The last drove (data/droveRoad.js HERD): by night, coming to the March gate
// on the Wilds side, a pale herd comes through and goes west down the drove
// road to the crossroads, with a drover behind it. Keep behind it to the end
// and it is yours to have seen; get in among the beasts, or ahead of them on
// the road, and you are knocked down; fall too far back and it is gone. Once a
// night each, and nobody else sees it. (The corpse candle on the road north,
// lib/corpseCandle.js, works the same way.)
const { HERD, GATE } = require('../data/droveRoad');

const SEG = [];
let TOTAL = 0;
for (let i = 0; i < HERD.path.length - 1; i++) {
  const [ax, ay] = HERD.path[i], [bx, by] = HERD.path[i + 1];
  const len = Math.hypot(bx - ax, by - ay);
  SEG.push({ ax, ay, bx, by, len, at: TOTAL });
  TOTAL += len;
}
const SPACING = 70;     // between one beast and the next
const LENGTH = SPACING * (HERD.beasts - 1);
function along(d) {
  const dd = Math.max(0, Math.min(TOTAL, d));
  for (const s of SEG) if (dd <= s.at + s.len) { const u = (dd - s.at) / s.len; return { x: s.ax + (s.bx - s.ax) * u, y: s.ay + (s.by - s.ay) * u }; }
  const l = SEG[SEG.length - 1]; return { x: l.bx, y: l.by };
}
function onRoad(x, y) {
  let best = { d: 0, off: Infinity };
  for (const s of SEG) {
    const u = Math.max(0, Math.min(1, ((x - s.ax) * (s.bx - s.ax) + (y - s.ay) * (s.by - s.ay)) / (s.len * s.len)));
    const off = Math.hypot(x - (s.ax + (s.bx - s.ax) * u), y - (s.ay + (s.by - s.ay) * u));
    if (off < best.off) best = { d: s.at + u * s.len, off };
  }
  return best;
}
// Where the beasts are when the lead has gone `lead` along the road: the herd strings out behind it.
const beastsAt = (lead) => Array.from({ length: HERD.beasts }, (_, i) => along(lead - i * SPACING));

module.exports = function createGhostDrove({ send, grantXP, playerMaxHealth, acctOf = () => null, isNight, noteHerd = () => {}, now = () => Date.now() }) {
  const day = () => Math.floor(now() / 86400000);
  const say = (player, message, sfx) => send(player.ws, { type: 'toast', level: 'important', always: true, message, ...(sfx ? { sfx } : {}) });
  const seenTonight = (player) => { const h = acctOf(player) || player; return h.droveDay === day(); };
  const end = (player) => { player.drove = null; send(player.ws, { type: 'drove_herd', on: false }); };

  function tick(players) {
    const saw = [];
    for (const p of players) {
      if (!p) continue;
      const c = p.drove;
      if (!c) {
        if (p.room !== 'wilds' || p.isDead || !isNight() || seenTonight(p)) continue;
        if (Math.hypot(p.x - GATE.wilds.x, p.y - GATE.wilds.y) > HERD.wake) continue;
        (acctOf(p) || p).droveDay = day();
        p.drove = { t0: now(), lostAt: 0 };
        send(p.ws, { type: 'drove_herd', on: true, path: HERD.path, speed: HERD.speed, standMs: HERD.standMs, beasts: HERD.beasts, spacing: SPACING });
        say(p, '🐄 Through the March gate behind you, where there was nothing, comes a herd: black cattle gone pale, with a drover at the tail of them, and no sound of hooves. They stand a moment in the road. Then they will go west, to the crossroads. Get off the road and keep behind them.', 'drove_herd');
        continue;
      }
      if (p.room !== 'wilds' || p.isDead) { end(p); continue; }
      const moving = now() - c.t0 >= HERD.standMs;
      const lead = Math.max(0, now() - c.t0 - HERD.standMs) / 1000 * HERD.speed;
      if (lead - LENGTH >= TOTAL) {   // the last of them has reached the crossroads
        end(p);
        const tail = along(TOTAL);
        if (Math.hypot(p.x - tail.x, p.y - tail.y) <= HERD.lose) {
          grantXP(p, HERD.xp);
          noteHerd(p);
          say(p, `🐄 At the crossroads the drover lifts his stick to you, the way one drover greets another on the road, and the herd goes on into the dark under the gibbet and is not there. (+${HERD.xp} XP)`, 'candle_out');
          saw.push(p);
        } else say(p, '🐄 Far ahead of you the last of the herd goes over the crossroads and is not there. You were too far back to see where they went.');
        continue;
      }
      const herd = beastsAt(lead), near = Math.min(...herd.map((b) => Math.hypot(p.x - b.x, p.y - b.y)));
      const where = onRoad(p.x, p.y);
      if (moving && (near < HERD.cross || (where.off < HERD.beside && where.d > lead + HERD.ahead && where.d < TOTAL))) {
        const max = playerMaxHealth(p);
        if (p.health > 1) p.health = Math.max(1, p.health - Math.round(max * HERD.struck));
        end(p);
        say(p, '🐄 You are in among them. A shoulder you cannot see takes you off your feet into the ditch, cold as a stone wall, and the drover\'s stick comes down on the road beside your head. When you get up the road is empty.', 'candle_struck');
        continue;
      }
      const tail = herd[herd.length - 1];
      if (Math.hypot(p.x - tail.x, p.y - tail.y) > HERD.lose) {
        if (!c.lostAt) c.lostAt = now();
        else if (now() - c.lostAt >= HERD.loseMs) { end(p); say(p, '🐄 You let them get too far ahead. The herd goes on down the road without you and you lose them in the dark.'); }
      } else c.lostAt = 0;
    }
    return saw;
  }

  return { tick, along, beastsAt, total: TOTAL, length: LENGTH };
};
