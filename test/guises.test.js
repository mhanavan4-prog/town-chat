// Guising (data/guises.js) — Samhain costumes, purely cosmetic. Each guise is
// an id with name/emoji/blurb, and every id must have a mesh builder in
// client/guises.js (checked structurally here against the source).
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const fs = require('fs');
const path = require('path');
const { GUISES } = require('../data/guises.js');

const ids = Object.keys(GUISES);
check('several guises are offered', ids.length >= 4, ids);

const seen = new Set();
for (const id of ids) {
  const g = GUISES[id];
  check(`${id} has name/emoji/blurb`, !!(g.name && g.emoji && g.blurb), g);
  check(`${id} id is unique`, !seen.has(id), id);
  seen.add(id);
}

// Every guise id must have a matching client mesh builder, or players would
// broadcast a guise nobody can draw. The client module keys BUILDERS by id.
const client = fs.readFileSync(path.join(__dirname, '..', 'client', 'guises.js'), 'utf8');
for (const id of ids) {
  check(`client/guises.js builds "${id}"`, new RegExp(`\\b${id}\\s*:`).test(client), id);
}

// The Moot: the older Hallowe'en lantern for a head, free like the pumpkin,
// drawn in code (KayKit has no turnip), and saying no more than the record does.
const myth = require('../data/mythOrRecord.js');
const pl = Object.values(myth).filter(Array.isArray).flat().find((q) => q && q.id === 'pumpkin_lanterns');
check('the Moot is a free guise beside the Jack-o\'-Head', GUISES.turnip && !GUISES.turnip.ms && GUISES.pumpkin && !GUISES.pumpkin.ms);
check('…its blurb keeps to the record: a turnip, in Ireland and the Isle of Man, before the pumpkin', /turnip/.test(GUISES.turnip.blurb) && /Ireland and the Isle of Man/.test(GUISES.turnip.blurb) && pl && /Ireland and the Isle of Man/.test(pl.verdict) && /turnips/.test(pl.verdict));
check('…and it is drawn in code: a purple shoulder, a lid, a carved face lit from inside', /function makeTurnip\(\)/.test(client) && /turnip: makeTurnip/.test(client) && /0x7b3f72/.test(client) && !/turnip:\s*\{ key:/.test(client));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
