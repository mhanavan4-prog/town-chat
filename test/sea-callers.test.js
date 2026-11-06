// Fisherfolk at the door: three sea callers, each tied to something already in
// the game (crotal and the Hedge dyes, the rune staves, the scrying bowl) and
// each citing where its belief is really recorded.
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });
const { CALLERS } = require('../data/callers.js');
const { buildCharmBook } = require('../lib/charmBook.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const by = (id) => CALLERS.find((c) => c.id === id);

const g = by('brown_gansey'), w = by('sea_words'), c = by('the_caul');
check('all three fisherfolk callers are at the door', !!(g && w && c));
check('the brown gansey rests on the Scots dictionary\'s 1941 crotal belief', g && /crottle/.test(g.source) && /1941/.test(g.source) && /native rocks/.test(g.lore) && g.tier === 'record');
check('…and re-dyes with heather, the Hedge line\'s green', g && g.steps.some((s) => s.kind === 'deliver' && s.item === 'heather_sprig'));
check('the sea words cite Jakobsen and the 2023 glossary, and name Norn', w && /Jakobsen/.test(w.source) && /2023/.test(w.source) && /Norn/.test(w.lore));
check('…and cast rune staves for a Norse-tongued isle', w && w.steps.some((s) => s.kind === 'runes'));
check('the caul quotes Dickens exactly and is marked folk', c && /advertised for sale, in the newspapers, at the low price of fifteen guineas/.test(c.lore) && c.tier === 'folk' && /David Copperfield \(1850\)/.test(c.source));
check('the caul\'s resolution keeps the mother\'s money', c && /oilskin/.test(c.resolution));
const book = buildCharmBook({ acct: { callers: { byId: { the_caul: 1 } } }, prog: {}, seasonKey: null });
const ch = book.chapters.find((x) => x.key === 'callers');
check('the Charm Book carries them', ch.entries.some((e) => e.id === 'the_caul' && e.met) && ch.entries.some((e) => e.id === 'sea_words' && !e.met));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
