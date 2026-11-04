// Rune casting (data/runes.js) — the Elder Futhark divination. 24 runes in three
// aettir of eight, each with an upright + merkstave reading; a three-stave cast
// with a synthesis. Mirrors the tarot test.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const { RUNES, RUNE_POSITIONS, RUNE_AETTIR, aettKeys, runeSynthesis } = require('../data/runes.js');

check('the full Elder Futhark — 24 runes', RUNES.length === 24, RUNES.length);
check('three staves in a cast', RUNE_POSITIONS.length === 3, RUNE_POSITIONS.map((p) => p.key));
check('three aettir', RUNE_AETTIR.length === 3, RUNE_AETTIR.map((a) => a.id));

const keys = new Set(), AETTS = new Set(RUNE_AETTIR.map((a) => a.id));
const perAett = { freyr: 0, hagal: 0, tyr: 0 };
for (const r of RUNES) {
  check(`${r.key}: name/sym/reading/reversed present`, !!(r.name && r.sym && r.reading && r.reversed), r);
  check(`${r.key}: belongs to a known aett`, AETTS.has(r.aett), r.aett);
  check(`${r.key}: key is unique`, !keys.has(r.key), r.key); keys.add(r.key);
  if (perAett[r.aett] !== undefined) perAett[r.aett]++;
}
check('each aett holds eight runes', perAett.freyr === 8 && perAett.hagal === 8 && perAett.tyr === 8, perAett);

// Synthesis traces a three-stave cast and names each rune.
const cast = [
  { rune: RUNES[0], reversed: false },
  { rune: RUNES[5], reversed: true },
  { rune: RUNES[16], reversed: false },
];
const syn = runeSynthesis(cast);
check('synthesis is a non-empty line', typeof syn === 'string' && syn.length > 20, syn);
check('synthesis names each rune', syn.indexOf(RUNES[0].name) !== -1 && syn.indexOf(RUNES[5].name) !== -1 && syn.indexOf(RUNES[16].name) !== -1, syn);
check('a reversed stave is marked reversed', syn.indexOf(RUNES[5].name + ' reversed') !== -1, syn);
check('synthesis guards a short cast', runeSynthesis([]) === '' && runeSynthesis(null) === '');

// The collectible arc: each aett carries a purse, and aettKeys partitions the 24.
check('each aett carries a gold purse', RUNE_AETTIR.every((a) => Number.isFinite(a.gold) && a.gold > 0), RUNE_AETTIR.map((a) => a.gold));
let partitionOk = true, allAettKeys = [];
for (const a of RUNE_AETTIR) {
  const ks = aettKeys(a.id);
  if (ks.length !== 8) partitionOk = false;
  allAettKeys = allAettKeys.concat(ks);
}
check('aettKeys gives eight runes per aett', partitionOk);
check('the three aettir partition all 24 runes exactly once', allAettKeys.length === 24 && new Set(allAettKeys).size === 24 && RUNES.every((r) => allAettKeys.indexOf(r.key) !== -1));
check('aettKeys of an unknown aett is empty', aettKeys('nope').length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
