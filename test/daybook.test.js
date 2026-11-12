// The witch's daybook (lib/daybook.js): what she has done of what can be
// done, the day it was first done, and how often since.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { OLD_WAYS } = require('../data/oldWays');
const { DUNGEON_LORE } = require('../data/dungeons');
const { RARE_ROOMS } = require('../data/rareRooms');

let clock = 1_800_000_000_000;
const accounts = { ann: {}, old: { oldWays: { besom: { made: true }, bees: { combs: 1 }, toad: { bone: true } } } };
const db = require('../lib/daybook')({ accounts, now: () => clock });
const ann = { id: 'a', accountKey: 'ann' }, old = { id: 'o', accountKey: 'old' }, guest = { id: 'g' };
const find = (body, id) => body.leaves.flatMap((l) => l.entries).find((e) => e.id === id);

const b0 = db.body(ann);
check('the book has five leaves and a line for every Old Way, wanderer, rare room and village door, the balefires, and the three old sites', b0.leaves.map((l) => l.id).join() === 'ways,wanderers,rare,wilds,village' && b0.of === OLD_WAYS.length + 4 + Object.keys(RARE_ROOMS).length + 9 + Object.keys(require('../data/villageHouses').VILLAGE_HOUSES).length && b0.done === 0 && OLD_WAYS.every((w) => find(b0, 'way:' + w.id)) && [1, 2, 3, 4].every((t) => find(b0, 'wanderer:' + DUNGEON_LORE[t].wanderer.key)));
check('what is not done says how to come by it, in a line', b0.leaves.flatMap((l) => l.entries).every((e) => !e.done && e.hint.length > 15 && e.hint.length < 140 && e.first === null && e.times === 0) && OLD_WAYS.every((w) => db.WAY_HINT[w.id]));
check('a guest keeps no daybook, and nothing can be written in one', db.body(guest).isGuest === true && db.note(guest, 'balefires') === false && db.noteWay(guest, 'lead') === false);

// writing things down
check('the first time is the first time', db.note(ann, 'balefires') === true && accounts.ann.daybook.balefires.first === clock && accounts.ann.daybook.balefires.times === 1);
clock += 86400000;
check('after that the day stays and the count goes up', db.note(ann, 'balefires') === false && accounts.ann.daybook.balefires.first === clock - 86400000 && find(db.body(ann), 'balefires').times === 2 && find(db.body(ann), 'balefires').hint === '');

// the Old Ways
check('a way that is only practised is written each time it is', db.noteWay(ann, 'lead') === true && db.noteWay(ann, 'lead') === false && find(db.body(ann), 'way:lead').times === 2);
check('a broom begun is not a broom', db.noteWay(ann, 'besom') === false && !find(db.body(ann), 'way:besom').done);
accounts.ann.oldWays = { besom: { made: true }, glory: { has: true } };
check('made, it is written, once, however often it is ridden', db.noteWay(ann, 'besom') === true && db.noteWay(ann, 'besom') === false && find(db.body(ann), 'way:besom').times === 1 && db.noteWay(ann, 'glory') === true && db.noteWay(ann, 'glory') === false);
check('the reel is written when it has been danced, and each time after', db.noteWay(ann, 'reel') === false && (accounts.ann.oldWays.reel = { danced: 1 }, db.noteWay(ann, 'reel')) === true && db.noteWay(ann, 'reel') === false && find(db.body(ann), 'way:reel').times === 2);
const bo = db.body(old);
check('what was done before the book was kept shows as done, with no day against it', find(bo, 'way:besom').done && find(bo, 'way:besom').first === null && find(bo, 'way:bees').done && find(bo, 'way:toad').done && !find(bo, 'way:lead').done && bo.done === 3);

// the wanderers and the rare rooms
const key = DUNGEON_LORE[2].wanderer.key;
accounts.ann.wanderers = { [key]: { slain: 3, firstAt: 12345 } };
check('a wanderer laid is read from the record already kept of it', (() => { const e = find(db.body(ann), 'wanderer:' + key); return e.done && e.times === 3 && e.first === 12345 && e.name === DUNGEON_LORE[2].wanderer.name; })());
db.note(ann, 'rare:well');
check('a rare room used is written under its own name', find(db.body(ann), 'rare:well').done && find(db.body(ann), 'rare:well').name === RARE_ROOMS.well.name && !find(db.body(ann), 'rare:hoard').done);
// the old sites, and the village
accounts.ann.troyTown = { runs: 4, day: 1 }; accounts.ann.menAnTol = { crawls: 1, day: 1 };
check('Troy Town, the Crick-stone and the Countless Stones are read from the counts they already keep, with no first day', (() => { const t = find(db.body(ann), 'troy'), c = find(db.body(ann), 'crick'), n = find(db.body(ann), 'countless'); return t.done && t.times === 4 && t.first === null && c.done && c.times === 1 && !n.done && n.hint.length > 20; })());
check('a village door gone through is written under the house\'s own name', db.note(ann, 'house:lodging') === true && find(db.body(ann), 'house:lodging').done && find(db.body(ann), 'house:lodging').name === 'The Lyke-Wake' && !find(db.body(ann), 'house:barn').done);
check('the count on the cover is the count of what is ticked', db.body(ann).done === db.body(ann).leaves.flatMap((l) => l.entries).filter((e) => e.done).length && db.body(ann).done === 10);

// wiring
const server = read('server.js'), panel = read('client/oldways.js'), main = read('client/main.js'), html = read('public/index.html');
check('the server writes down an Old Way when its button has done something, but not its undoing, and the reel when it is danced out', /const firstTime = msg\.way !== 'reel' && !\['back', 'shed'\]\.includes\(String\(msg\.action\)\) && daybook\.noteWay\(player, String\(msg\.way \|\| ''\)\);/.test(server) && /for \(const p of danced\) daybook\.noteWay\(p, 'reel'\); saveAccounts\(\);/.test(server));
check('…and a rare room used, and the balefire round made, each saved', /noteRare: \(p, kind\) => \{ if \(daybook\.note\(p, 'rare:' \+ kind\)\)/.test(server) && /noteRound: \(p\) => \{ if \(daybook\.note\(p, 'balefires'\)\)/.test(server) && (read('lib/dungeonFinds.js').match(/noteRare\(player, r\.kind\);/g) || []).length === 3 && /noteRound\(player\);/.test(read('lib/wildsFinds.js')));
check('the page is a second leaf of the Old Ways panel, with its own row in the menu', /msg\.type === 'daybook_state'\) \{ send\(ws, \{ type: 'daybook_state', \.\.\.daybook\.body\(player\) \}\)/.test(server) && /if \(msg\.type === 'daybook_state'\) \{ _oldWays\.setBook\(msg\); return; \}/.test(main) && /on\('menuDaybook', closeSheetAnd\(\(\) => \{ _oldWays\.open\('book'\); \}\)\);/.test(main) && /id="menuDaybook"/.test(html) && /function renderBook\(body\)/.test(panel) && /\.dbRow\.done \.dbTick/.test(html));
check('going in at a village door writes it down the first time, and a count with no day reads as a count', /villageHouses\.enter\(player, String\(msg\.id \|\| ''\)\) && daybook\.note\(player, 'house:' \+ String\(msg\.id\)\)/.test(server) && /e\.times > 0 \? \(e\.times === 1 \? 'Once\.' : `\$\{e\.times\} times\.`\)/.test(panel));
check('on a phone what can be done now is listed first', /const ordered = \[\.\.\.state\.ways\]\.sort\(\(x, y\) => \(isReady\(y\) \? 1 : 0\) - \(isReady\(x\) \? 1 : 0\)\);/.test(panel));

{ const d2 = require('../lib/daybook')({ accounts: { c: { callers: { byId: { clootie: 3 } } }, n: {} } }); const e = (k) => d2.body({ accountKey: k }).leaves.find((l) => l.id === 'wilds').entries.find((x) => x.id === 'clootie');
  check('a cloot tied at the well is read from the callers\' own count', e('c').done && e('c').times === 3 && !e('n').done); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
