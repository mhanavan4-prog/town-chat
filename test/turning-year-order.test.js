// The Turning Year in the order of the year: after the twelve festival rites,
// the dated callers' rites follow the calendar, Plough Monday to St Thomas's,
// each with its date ("moves with Easter" for the days that do), and the
// chapter shows it.
const fs = require('fs');
const path = require('path');
const { buildCharmBook } = require('../lib/charmBook.js');
const { CALLERS } = require('../data/callers.js');
const BOOK = fs.readFileSync(path.join(__dirname, '../client/charm-book.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

const ch = buildCharmBook({ acct: {}, prog: {}, seasonKey: null }).chapters.find((c) => c.key === 'feasts');
const tail = ch.entries.slice(12);
// The dated rites in the order their callers come in a middling year (2027),
// whatever days are added later; the known ones all there, Plough Monday first
// of these and St Thomas's last of them.
const { nextWindow } = require('../lib/callers.js');
const startOf = (id) => { const c = CALLERS.find((x) => x.when && x.steps.some((s) => s.kind === 'rite' && s.rite === id)); return c ? nextWindow(c.when, Date.UTC(2027, 0, 1)).start : Infinity; };
const KNOWN = ['plough_monday', 'shroving', 'valentine_bay', 'simnel', 'cross_bun', 'porch_watch', 'beat_bounds', 'royal_oak', 'fern_seed', 'swithin_sky', 'grotto', 'nutting', 'soul_cakes', 'martin_blood', 'old_clem', 'cattern_cakes', 'gooding'];
const ids = tail.map((e) => e.id);
check('the dated rites run through the year, in their callers\' order', ids.every((id, i) => !i || startOf(ids[i - 1]) <= startOf(id)) && KNOWN.every((id) => ids.includes(id)) && ids.indexOf('plough_monday') < ids.indexOf('shroving') && ids.indexOf('cattern_cakes') < ids.indexOf('gooding'), ids);
check('…and the festivals\' twelve come first, untouched', ch.entries[0].id === 'bridesbed' && ch.entries[11].id === 'michaelmas' && ch.entries.slice(0, 12).every((e) => !e.date));
const date = (id) => (tail.find((e) => e.id === id) || {}).date;
check('each has its date: fixed days by the day', date('valentine_bay') === '13 February' && date('porch_watch') === '24 April' && date('royal_oak') === '29 May' && date('soul_cakes') === '2 November' && date('gooding') === '21 December');
check('…Martinmas by its week', date('martin_blood') === '9–13 November');
check('…and the moving days say so', date('plough_monday') === 'the Monday after Twelfth Day' && ['shroving', 'simnel', 'cross_bun', 'beat_bounds'].every((id) => date(id) === 'moves with Easter'));
check('every dated caller in the chapter has a date', tail.every((e) => e.date) && tail.length === CALLERS.filter((c) => c.when && c.steps.some((s) => s.kind === 'rite' && ch.entries.some((e) => e.id === s.rite))).length);
check('the intro says so', /in the order of the year, each with its date/.test(ch.intro));
check('the chapter shows the date, met or not', (BOOK.match(/if \(e\.date\) [a-z]+\.appendChild\(el\('span', 'cbEntryDate', e\.date\)\)/g) || []).length === 2);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
