// The corpse candle on the road north (data/wayside.js CANDLE, lib/corpseCandle.js).
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { CANDLE, WAYSIDE, WAYSIDE_BY_ID } = require('../data/wayside');

check('it names its tier, its sources and where the game leaves the belief', CANDLE.tier === 'folk' && CANDLE.lore.join(' ').length > 500 && /Aubrey/.test(CANDLE.source) && /Sikes/.test(CANDLE.source) && /the game's/.test(CANDLE.note));
const stone = WAYSIDE_BY_ID.coffinstone, gib = WAYSIDE_BY_ID.gibbet, P = CANDLE.path;
check('it goes from the coffin stone to the foot of the gibbet, and round the things that stand by the road rather than through them', Math.hypot(P[0][0] - stone.x, P[0][1] - stone.y) < 150 && Math.hypot(P[P.length - 1][0] - gib.x, P[P.length - 1][1] - gib.y) < 120
  && (() => { const cc = require('../lib/corpseCandle')({ send() {}, grantXP() {}, playerMaxHealth: () => 100, isNight: () => true }); for (let d = 0; d <= cc.total; d += 20) { const a = cc.along(d); if (WAYSIDE.some((w) => Math.hypot(a.x - w.x, a.y - w.y) < 50)) return false; } return true; })());
check('it can be kept up with: slower than a walk, and the whole road in about half a minute', CANDLE.speed < 230 * 0.6 && CANDLE.standMs >= 5000);

let clock = 300 * 86400000, night = true, xp = 0;
const sent = [], acct = {}, noted = [];
const cc = require('../lib/corpseCandle')({ send: (to, m) => sent.push(m), grantXP: (_p, n) => { xp += n; }, playerMaxHealth: () => 100, acctOf: (p) => (p.guest ? null : acct), isNight: () => night, noteCandle: (p) => noted.push(p.id), now: () => clock, random: () => 0 });
const p = { id: 'p', ws: 'p', room: 'wilds', isDead: false, health: 100, x: stone.x - 400, y: stone.y };
const said = (re) => sent.some((m) => m.type === 'toast' && re.test(m.message));
const state = () => [...sent].reverse().find((m) => m.type === 'candle_state');
const step = (ms) => { clock += ms; return cc.tick([p]); };
const behind = (back) => { const went = Math.max(0, clock - p.candle.t0 - CANDLE.standMs) / 1000 * CANDLE.speed; const a = cc.along(Math.max(0, went - back)); p.x = a.x; p.y = a.y; };

night = false; p.x = stone.x + 60; cc.tick([p]);
check('by day nothing comes', !p.candle && sent.length === 0);
night = true; p.x = stone.x - 400; cc.tick([p]);
check('nor by night to one who is not near the stone', !p.candle);
p.x = stone.x + 60; p.y = stone.y + 90; cc.tick([p]);
check('by night, near the coffin stone, a light stands there: the smallest, a child\'s', p.candle && p.candle.kind === 'child' && state().on === true && state().speed === CANDLE.speed && state().standMs === CANDLE.standMs && state().path.length === P.length && said(/corpse candle/i) && acct.candleDay === 300);
step(CANDLE.standMs - 500);
check('while it stands, she is not thrown down for being where she happened to be', p.candle && p.health === 100);
// follow it all the way, a little way behind
p.x = P[0][0] + 150; p.y = P[0][1] - 100;
let ok = true;
for (let t = 0; t < 60 && p.candle; t++) { step(1000); if (p.candle) behind(150); if (p.health !== 100) ok = false; }
check('kept behind to the end, it goes out at the gibbet and she is told whose it was', ok && !p.candle && xp === CANDLE.xp && said(/It was a child's/) && noted.join() === 'p' && state().on === false);
sent.length = 0; p.x = stone.x + 60; p.y = stone.y + 90; step(1000);
check('once a night', !p.candle && sent.length === 0);

// the next night, three ways to lose it
const again = () => { clock += 86400000; sent.length = 0; p.health = 100; p.x = stone.x + 60; p.y = stone.y + 90; cc.tick([p]); step(CANDLE.standMs + 3000); };
again(); behind(0); const x0 = xp; step(100);
check('stand in its way and you are thrown down, and it is gone', !p.candle && p.health === 100 - 100 * CANDLE.struck && said(/in its road/) && xp === x0);
again(); behind(-250); step(100);
check('get before it on the road, the same', !p.candle && p.health === 75 && said(/in its road/));
again(); p.health = 10; behind(0); step(100);
check('it never takes the last of you', p.health === 1);
again(); p.x += 900; step(1000); const still = !!p.candle; step(CANDLE.loseMs);
check('fall far behind for long enough and it goes on without you', still && !p.candle && said(/too far ahead/) && p.health === 100);
again(); p.x += 900; step(1000); behind(120); step(100); behind(120); step(CANDLE.loseMs - 500); behind(120); step(600);
check('…but catching up in time keeps it', !!p.candle);
p.room = 'outside'; step(500);
check('leave the Wilds and it is gone without a word more', !p.candle && state().on === false);
const g = { id: 'g', guest: true, ws: 'g', room: 'wilds', isDead: false, health: 50, x: stone.x, y: stone.y + 100 };
cc.tick([g]);
check('a guest sees one too, once in her visit that night', g.candle && g.candleDay === Math.floor(clock / 86400000));

const server = read('server.js'), main = read('client/main.js'), ws = read('lib/wayside.js');
check('the server walks it on its tick and writes down one followed', /const lit = corpseCandle\.tick\(players\.values\(\)\); if \(lit\.length\) saveAccounts\(\);/.test(server) && /daybook\.note\(p, 'candle'\)/.test(server));
check('the client shows the light and moves it by the server\'s word', /if \(msg\.type === 'candle_state'\) \{ setCorpseCandle\(msg\); return; \}/.test(main) && /\n {2}stepCorpseCandle\(\);/.test(main) && /Math\.max\(0, t - c\.standMs\) \/ 1000 \* c\.speed/.test(main));
check('its history is read at the coffin stone, with the stone\'s own', /w\.id === CANDLE\.from \? \['🕯️ By night: the corpse candle\.', \.\.\.CANDLE\.lore/.test(ws));
const db = require('../lib/daybook')({ accounts: { a: { daybook: { candle: { first: 9, times: 1 } } } } });
check('and it has a line in the daybook', db.body({ accountKey: 'a' }).leaves.find((l) => l.id === 'wilds').entries.find((x) => x.id === 'candle').done === true);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
