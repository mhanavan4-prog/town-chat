// Ashminster's peace (lib/ashminster.js): the frith no creature enters, the
// sanctuary knocker, the anchoress at her squint, and the boards that say
// what is in the record and what is the game's.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const { EMBER_TOWN: T, ASH_SPOTS, SANCTUARY, WITCH_MARKS, ANCHORESS } = require('../data/emberTown');

for (const [n, L] of [['sanctuary', SANCTUARY], ['the marks', WITCH_MARKS], ['the anchoress', ANCHORESS]])
  check(`${n}: tier, lore, source, and where the game goes beyond the record`, L.tier === 'record' && L.lore.join(' ').length > 400 && L.source.length > 60 && /in the record\./.test(L.note) && /(is|are) the game's\.$/.test(L.note));
check('the facts the boards rest on are stated as they are recorded', /thirty-seven days/.test(SANCTUARY.lore[0]) && /frith stool/.test(SANCTUARY.lore[1]) && /1624/.test(SANCTUARY.lore[2]) && /Virgo Virginum/.test(WITCH_MARKS.lore[1]) && /Knole in 1606/.test(WITCH_MARKS.lore[1]) && /against witches/.test(WITCH_MARKS.lore[2]) && /no animal but a cat/.test(ANCHORESS.lore[1]));

let clock = 1e9, arrived = [], spoke = [];
const sent = [];
const ash = require('../lib/ashminster')({ send: (to, m) => sent.push(m), now: () => clock, onArrive: (p) => arrived.push(p.id), onSpoke: (p) => spoke.push(p.id) });
const p = { id: 'p', ws: 'p', room: 'ember_wastes', isDead: false, x: 0, y: 0 };
const at = (id, dx = 0) => { p.x = ASH_SPOTS[id].x + 30 + dx; p.y = ASH_SPOTS[id].y + 40; };
const said = (re) => sent.some((m) => m.type === 'toast' && re.test(m.message));
const board = () => [...sent].reverse().find((m) => m.type === 'vh_board');

check('every spot to be used lies where it can be reached', Object.values(ASH_SPOTS).every((s) => s.hint && s.name && Math.hypot(s.x - T.x, s.y - T.y) < 1800));
check('the knocker is well inside the frith, so that standing anywhere at it is standing in sanctuary', ['knocker', 'anchoress', 'marks'].every((k) => Math.hypot(ASH_SPOTS[k].x - T.x, ASH_SPOTS[k].y - T.y) + 140 < T.frith));
check('a thing must be gone up to, in the Wastes, by the living', (at('knocker', 500), ash.use(p, 'knocker')) === false && said(/Go up to it/) && (at('knocker'), p.room = 'wilds', ash.use(p, 'knocker')) === false && (p.room = 'ember_wastes', p.isDead = true, ash.use(p, 'knocker')) === false && !ash.holds(p));
p.isDead = false; sent.length = 0;
// the knocker stands at the frith's edge: step to it from inside
p.x = ASH_SPOTS.knocker.x + 100; p.y = ASH_SPOTS.knocker.y;   // the far side of it from the church
check('taking hold of the knocker gives sanctuary for thirty-seven minutes', ash.use(p, 'knocker') === true && ash.holds(p) && p.sanctuaryUntil === clock + 37 * 60000 && said(/You have sanctuary: 37 minutes/) && sent.some((m) => m.type === 'ash_state' && m.sanctuaryUntil === p.sanctuaryUntil) && sent.some((m) => m.sfx === 'ward'));
sent.length = 0;
check('taking it again while it holds tells her how long is left, and reads her the history', ash.use(p, 'knocker') === false && said(/37 minutes more/) && board().epithet === 'In the record' && board().lines.some((l) => /^Source: /.test(l)));
p.x = T.x; p.y = T.y; ash.tick([p]);
check('it holds anywhere inside the frith crosses', ash.holds(p));
p.x = T.x + T.frith + 50; sent.length = 0; ash.tick([p]);
check('walk out past them and it is left behind, and she is told', !ash.holds(p) && p.sanctuaryUntil === 0 && said(/past the frith crosses/) && sent.some((m) => m.type === 'ash_state' && m.sanctuaryUntil === 0));
p.x = ASH_SPOTS.knocker.x - 60; ash.use(p, 'knocker'); clock += 37 * 60000 + 1; sent.length = 0; ash.tick([p]);
check('and it runs out with its time', !ash.holds(p) && said(/run its time/));
ash.use(p, 'knocker'); p.room = 'outside'; ash.tick([p]);
check('leaving the Wastes ends it without a word', p.sanctuaryUntil === 0 && !ash.holds(p));
p.room = 'ember_wastes';

const out = ash.keepOut(T.x + 300, T.y - 400);
check('a creature inside the frith is put out to its edge on its own bearing, and one outside is left be', out && Math.abs(Math.hypot(out.x - T.x, out.y - T.y) - T.frith) < 0.01 && Math.abs((out.x - T.x) / (out.y - T.y) + 0.75) < 1e-6 && ash.keepOut(T.x + T.frith + 1, T.y) === null && !!ash.keepOut(T.x, T.y));

at('anchoress'); sent.length = 0;
const heard = []; for (let i = 0; i < ANCHORESS.says.length; i++) { ash.use(p, 'anchoress'); heard.push(sent[sent.length - 1].message); }
check('the anchoress says her piece a line at a time, and the first word of it is marked for the story', heard.length === 4 && heard.every((m, i) => m.includes(ANCHORESS.says[i])) && spoke.join() === 'p');
sent.length = 0;
check('then pressing again reads of anchoresses, and she will begin again another time', ash.use(p, 'anchoress') === false && /Dame Isolt/.test(board().title) && board().lines.some((l) => /Julian of Norwich/.test(l)) && (ash.use(p, 'anchoress'), sent[sent.length - 1].message.includes(ANCHORESS.says[0])) && spoke.length === 1 + 1);
at('marks'); sent.length = 0; ash.use(p, 'marks');
check('the marks are read at the breach', /marks at the breach/.test(board().title) && board().lines.some((l) => /daisy wheel/.test(l)));
at('frith'); sent.length = 0; ash.use(p, 'frith');
check('and a frith cross says what it marks', board().lines[0].includes('no creature of the Wastes will come'));

p.x = 500; p.y = 500; p.inAshminster = false; arrived.length = 0; ash.tick([p]);
p.x = T.x; p.y = T.y + 1900; ash.tick([p]); ash.tick([p]);
check('walking into the town is marked once for the story, not every step', arrived.join() === 'p');
p.x = 500; ash.tick([p]); p.x = T.x; ash.tick([p]);
check('and again on coming back', arrived.length === 2);

const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), main = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8');
check('sanctuary stops other players\' blades both ways; the frith holds the Wastes\' creatures out each step; its use is answered and its time is kept', /if \(ashminster\.holds\(attacker\) \|\| ashminster\.holds\(target\)\) return false;/.test(server) && /const out = ashminster\.keepOut\(m\.x, m\.y\); if \(out\) \{ m\.x = out\.x; m\.y = out\.y; \}/.test(server) && /if \(msg\.type === 'ash_use'\) \{ ashminster\.use\(player, String\(msg\.id \|\| ''\)\); return; \}/.test(server) && /ashminster\.tick\(players\.values\(\)\);/.test(server));
check('the client lets each be used and knows when she holds sanctuary', /type: 'ash_use', id: kiosk\.ashId/.test(main) && /if \(msg\.type === 'ash_state'\) \{ ashSanctuaryUntil = msg\.sanctuaryUntil \|\| 0; return; \}/.test(main));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
