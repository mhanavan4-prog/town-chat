// The witches' ring in the west of the Ember Wastes (data/witchRing.js, lib/witchRing.js).
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const { RING, FIVE, ELDER } = require('../data/witchRing');
const { TRACK } = require('../data/emberField');
const scene = fs.readFileSync(path.join(root, 'client/ember-scene.js'), 'utf8'), main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');

const cFive = new Function('return ' + /const WITCH_FIVE = (\[[\s\S]*?\n\]);/.exec(scene)[1])();
const cRing = new Function('return ' + /const WITCH_RING = (\{[^}]*\});/.exec(scene)[1])();
check('the client draws the ring and its five places where the server keeps them', cRing.x === RING.x && cRing.y === RING.y && cRing.stoneR === RING.stoneR && cRing.stones === RING.stones && JSON.stringify(cFive) === JSON.stringify(FIVE.map(({ id, name, x, y }) => ({ id, name, x, y }))));
check('it fills the empty west, and the track\'s west branch ends at its edge', RING.x < 4000 && Math.hypot(TRACK.find((t) => t.id === 'ring').pts.at(-1)[0] - RING.x, TRACK.find((t) => t.id === 'ring').pts.at(-1)[1] - RING.y) < RING.stoneR + 600);
check('five places inside the stones, far enough apart that one person cannot stand in two', FIVE.length === 5 && FIVE.every((w) => Math.hypot(w.x - RING.x, w.y - RING.y) < RING.stoneR - 100) && FIVE.every((a, i) => FIVE.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) > RING.range * 2)));
check('each of the five has her own voice; Hazel among them, and one who stayed', FIVE.every((w) => w.says.length > 150) && FIVE[0].id === 'hazel' && /did not go home/.test(FIVE.find((w) => w.id === 'elspet').says));
check('the elder\'s board names its tier and sources and where the game goes beyond them', ELDER.tier === 'folk' && /Rollright/.test(ELDER.lore[0]) && /Evans/.test(ELDER.source) && /are the game's\.$/.test(ELDER.note));

let night = true, cycle = 1, xpOf = {};
const sent = {}, players = new Map(), banks = {}, rung = [], sung = [], wastes = [];
const mk = (id) => { const p = { id, ws: id, room: 'ember_wastes', isDead: false, x: 0, y: 0, accountKey: id }; players.set(id, p); sent[id] = []; banks[id] = { balance: 0 }; return p; };
const ring = require('../lib/witchRing')({ send: (to, m) => sent[to].push(m), grantXP: (p, n) => { xpOf[p.id] = (xpOf[p.id] || 0) + n; }, players, isNight: () => night, cycleId: () => cycle,
  acctOf: () => null, bankOf: (p) => banks[p.id], tellWastes: (m) => wastes.push(m), noteRing: (p) => rung.push(p.id), noteSung: (p) => sung.push(p.id) });
const a = mk('a');
const at = (p, w) => { p.x = w.x + 20; p.y = w.y + 10; };
const last = (p) => sent[p.id][sent[p.id].length - 1];

night = false; at(a, FIVE[0]);
check('by day a place is only stone, and reads of the ring', ring.use(a, 'hazel') === false && sent.a.some((m) => m.type === 'vh_board' && m.epithet === 'The ring'));
night = true; a.x += 200;
check('she must stand in the place', ring.use(a, 'hazel') === false && /Stand in Hazel's place/.test(last(a).message));
at(a, FIVE[0]);
check('by night, standing in it, she hears that witch', ring.use(a, 'hazel') === true && sent.a.some((m) => m.type === 'toast' && m.message.includes(FIVE[0].says)) && xpOf.a === RING.voiceXp);
check('once a night for each', ring.use(a, 'hazel') === false && xpOf.a === RING.voiceXp);
a.x = RING.x; a.y = RING.y + 50; sent.a.length = 0;
check('the elder is still until all five have spoken', ring.use(a, 'elder') === false && sent.a.some((m) => /4 of the five have not spoken/.test(m.message || '')) && sent.a.some((m) => m.type === 'vh_board' && /Rollright/.test(m.lines.join(' '))));
for (const w of FIVE.slice(1)) { at(a, w); ring.use(a, w.id); }
a.x = RING.x; a.y = RING.y + 50;
check('then it speaks, and the five are written in her daybook', ring.use(a, 'elder') === true && sent.a.some((m) => m.type === 'toast' && m.message.includes(ELDER.says)) && rung.join() === 'a' && ring.use(a, 'elder') === false);
cycle = 2; at(a, FIVE[0]);
check('the next night it is all to hear again', ring.use(a, 'hazel') === true);

// five people, five places
const ps = ['a', 'b', 'c', 'd', 'e'].map((id) => players.get(id) || mk(id));
ps.forEach((p, i) => at(p, FIVE[i]));
ps[4].x += 500;   // one not yet in her place
check('four standing is not five', ring.fiveStanding() === null && ring.use(ps[0], 'hazel') === false && sung.length === 0);
at(ps[4], FIVE[4]);
const xb = xpOf.b || 0;
check('five standing, each in a place, and one of them uses hers: the ring sings for all five, and the whole Wastes hear it', ring.use(ps[1], 'morwenna') === true && sung.sort().join() === 'a,b,c,d,e' && xpOf.b === xb + RING.sungXp + RING.voiceXp && banks.e.balance === RING.sungGold && wastes.filter((m) => m.type === 'toast').length === 1 && wastes.some((m) => m.type === 'ring_sung'));
check('once a night', (ring.use(ps[2], 'joan'), sung.length === 5 && wastes.filter((m) => m.type === 'toast').length === 1));
ps[1].x = FIVE[0].x + 10; ps[1].y = FIVE[0].y + 10;   // two people crowding one place
ps[0].x += 600; cycle = 3;
check('two in one place and one empty is not five', ring.fiveStanding() === null);

const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
check('the server answers and saves; the client lets each place and the elder be used; it is named as a landmark; nothing rises inside it', /if \(msg\.type === 'ring_use'\) \{/.test(server) && /if \(witchRing\.use\(player, String\(msg\.id \|\| ''\)\)\) \{ saveAccounts\(\); saveBankAccounts\(\); \}/.test(server) && /type: 'ring_use', id: kiosk\.ringId/.test(main) && /ring: true, blurb: WITCH_RING\.blurb/.test(server) && /\{ x: WITCH_RING\.x, y: WITCH_RING\.y, r: 1000 \}/.test(server));
check('the stone has a model in the manifest and on disk', /em_ring_stone: 'kk\/home\/ring_stone\.glb'/.test(main) && fs.existsSync(path.join(root, 'public/kk/home/ring_stone.glb')));
{ const scene = fs.readFileSync(path.join(root, 'client/ember-scene.js'), 'utf8'), RINGD = require('../data/witchRing').RING;
  const r = scene.match(/npc: 'ring', ringId: w\.id, hint: `stand in \$\{w\.name\}'s place`, radius: (\d+)/);
  check('on a phone: each place answers as far out as the server allows, and the stones ghost out of the camera', r && +r[1] === RINGD.range && /g\.userData\.camFade = true;   \/\/ the chase camera ghosts a stone/.test(scene)); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
