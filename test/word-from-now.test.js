// The standing rule for a caller's ending, after "trim and fold": the story
// and its lore come first, in the witch's own world; a modern word is kept
// only where doing the thing for real could hurt someone, and then it is one
// short plain line, folded away under "A word from now" (client/now-note.js).
// No "practical half" label, no clinical lists, no phone numbers or named
// agencies in what a player reads as the story. Every caller still names its
// sources and is badged with a provenance tier.
const fs = require('fs');
const path = require('path');
const { CALLERS } = require('../data/callers.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const words = (t) => (t || '').split(/\s+/).filter(Boolean).length;
// What a player shouldn't meet in a story: agencies, emergency numbers,
// drug names, and the body spelled out like a leaflet.
const MODERN = /\bNHS\b|\bA&E\b|\b999\b|\b111\b|\b101\b|\bGP\b|helpline|GOV\.UK|paracetamol|ibuprofen|aspirin|\bmicrograms?\b|practical half/i;
const CLINICAL = /genital|\banus\b|\bbowel|\bpoo\b|diarrh|vomit|numbness|tingling|\bpus\b/i;
const PHONE = /\b0\d{2,4}[ -]?\d{3}/;

check('there are callers to check', CALLERS.length >= 129, CALLERS.length);
const labelled = CALLERS.filter((c) => /practical half/i.test(c.resolution)).map((c) => c.id);
check('no ending is labelled "the practical half"', labelled.length === 0, labelled);
const leaflet = CALLERS.filter((c) => MODERN.test(c.resolution) || CLINICAL.test(c.resolution) || PHONE.test(c.resolution)).map((c) => c.id);
check('no story carries agencies, emergency numbers, drug names, clinical words or phone numbers', leaflet.length === 0, leaflet);

const notes = CALLERS.filter((c) => c.note !== undefined);
check('a note, where there is one, is a non-empty string', notes.every((c) => typeof c.note === 'string' && c.note.trim()), notes.filter((c) => typeof c.note !== 'string').map((c) => c.id));
const long = notes.filter((c) => words(c.note) > 25).map((c) => [c.id, words(c.note)]);
check('each note is one short line (25 words at most)', long.length === 0, long);
const sentences = notes.filter((c) => (c.note.match(/[.!?](\s|$)/g) || []).length > 2).map((c) => c.id);
check('…of no more than two sentences', sentences.length === 0, sentences);
const loud = notes.filter((c) => MODERN.test(c.note) || CLINICAL.test(c.note) || PHONE.test(c.note)).map((c) => c.id);
check('…in plain words: no agencies, numbers, drug names or clinical terms', loud.length === 0, loud);
const storyWords = CALLERS.reduce((a, c) => a + words(c.resolution), 0);
const noteWords = notes.reduce((a, c) => a + words(c.note), 0);
check('the notes stay a small part of the whole: under a fifth of the story', noteWords * 5 < storyWords, { storyWords, noteWords });
check('…and not every caller needs one', notes.length < CALLERS.length * 0.6, { notes: notes.length, callers: CALLERS.length });

// Where a modern line still matters, it is there.
const by = (id) => CALLERS.find((c) => c.id === id);
for (const [id, re] of [
  ['the_scald', /cool running water for twenty minutes/], ['yule_log', /fire burning alone/], ['beltane_cake', /peat/],
  ['dowse_well', /tested/], ['midsummer_door', /pharmacist/], ['ague', /doctor/], ['lifting', /said yes/],
  ['bringing_in_green', /mistletoe/], ['shrove_tuesday_shroving', /never throw water/],
]) check(`${id} keeps its one line: ${re.source}`, by(id) && re.test(by(id).note || ''), by(id) && by(id).note);
// And the old in-world wisdom stays in the story, not in a note.
check('Ruth Osborne at Tring stays in the butter story', /near Tring in 1745 Ruth Osborne/.test(by('butter_wont_come').resolution));
check('the eel-skin is kept, and the cat goes off till supper', /He keeps the eel-skin anyway/.test(by('the_cramp').resolution) && /does not come back until supper/.test(by('the_stye').resolution));

const unsourced = CALLERS.filter((c) => !(c.source || '').trim()).map((c) => c.id);
check('every caller names its sources', unsourced.length === 0, unsourced);
const untiered = CALLERS.filter((c) => !['record', 'folk', 'revival'].includes(c.tier)).map((c) => c.id);
check('every caller is badged record, folk or revival', untiered.length === 0, untiered);

// The note travels with the result and is drawn folded.
const lib = fs.readFileSync(path.join(__dirname, '..', 'lib', 'callers.js'), 'utf8');
check('the server sends the note with the caller\'s result', /note: c\.note/.test(lib));
const board = fs.readFileSync(path.join(__dirname, '..', 'client', 'board.js'), 'utf8');
check('the Board draws it with the fold, after the lore', /if \(r\.note\) card\.appendChild\(nowNoteEl\(r\.note\)\)/.test(board));
const fold = fs.readFileSync(path.join(__dirname, '..', 'client', 'now-note.js'), 'utf8');
check('the fold is a closed <details> headed "A word from now", text only', /createElement\('details'\)/.test(fold) && /A word from now/.test(fold) && !/\.open\s*=\s*true/.test(fold) && !/innerHTML/.test(fold));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
