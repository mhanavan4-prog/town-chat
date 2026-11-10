// "Drawn & Walked": the Charm Book's chapter for the figures drawn by hand and
// the old places walked (Dee's Monad, Agrippa's two tables, Caerdroia, the
// Bath tablet, the Shepherd's Race and the clootie well), each met the way the
// game records it; and the Wilds map marks the two old places by the portal.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const fs = require('fs');
const { buildCharmBook } = require('../lib/charmBook');
const chap = (b) => b.chapters.find((c) => c.key === 'figures');
const empty = chap(buildCharmBook({ acct: {}, prog: {}, seasonKey: null }));
check('seven entries, none met on a fresh account, every one sourced and record-tier', empty.total === 7 && empty.met === 0 && empty.entries.every((e) => e.lore && e.source && e.tier === 'record' && e.hint));
check('in order: the Monad, Saturn, Jupiter, Caerdroia, the Bath tablet, the Shepherd\'s Race, the clootie well', empty.entries.map((e) => e.id).join(',') === 'monas,kamea_saturn,kamea_jupiter,caerdroia,bath_tablet,shepherds_race,clootie');
const acct = { monas: { at: 1 }, kameas: { jupiter: { at: 1 } }, troyTown: { runs: 2 }, callers: { byId: { caerdroia: 1, clootie: 1 } } };
const met = chap(buildCharmBook({ acct, prog: {}, seasonKey: null }));
check('met the way the game records each: the Monad, Jupiter\'s table, a run, and the callers served', met.entries.filter((e) => e.met).map((e) => e.id).join(',') === 'monas,kamea_jupiter,caerdroia,shepherds_race,clootie' && met.met === 5);
check('a Shepherd\'s Race never finished is not met', !chap(buildCharmBook({ acct: { troyTown: { runs: 0 } }, prog: {}, seasonKey: null })).entries.find((e) => e.id === 'shepherds_race').met);
check('the hints say where to go', /Wilds, east of the portal/.test(empty.entries.find((e) => e.id === 'shepherds_race').hint) && /west of the portal/.test(empty.entries.find((e) => e.id === 'clootie').hint) && /Real Shelf/.test(empty.entries.find((e) => e.id === 'kamea_saturn').hint));
const main = fs.readFileSync(__dirname + '/../client/main.js', 'utf8');
check('the Wilds map marks the Shepherd\'s Race and the clootie well where the server puts them', /kind: 'maze', label: "🌀 Shepherd's Race"/.test(main) && /kind: 'rag_well', label: '🎀 Clootie well'/.test(main) && /if \(kind === 'maze'\)/.test(main) && /if \(kind === 'rag_well'\)/.test(main) && /world2\.troyTown\.hub\[0\]/.test(main) && /world2\.clootieWell\.x/.test(main));
check('…and the Crick-stone and the Nine-and-Twenty, when the server has them', /if \(world2\.menAnTol\) oldPlaces\.push/.test(main) && /if \(world2\.countless\) oldPlaces\.push/.test(main) && /if \(kind === 'holed_stone'\)/.test(main) && /if \(kind === 'stone_ring'\)/.test(main));
const scene = fs.readFileSync(__dirname + '/../client/wilds-scene.js', 'utf8');
check('no glowing ground sigil lands on the old places (a playtest found one on the clootie well)', /w2\.clootieWell \? \[\{ x: w2\.clootieWell\.x, z: w2\.clootieWell\.y, r: 170 \}\]/.test(scene) && /w2\.troyTown \? \[\{ x: w2\.troyTown\.hub\[0\]/.test(scene));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
