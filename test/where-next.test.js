// The Charm Book's "Where next" page: what you can write in today — today's
// callers who would write something new, the planetary hour, this festival's
// customs, the old calendar, unread books, untried charms, nearly-done chapters.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-wherenext-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { whereNext, writesOf } = require('../lib/whereNext.js');
const { buildCharmBook } = require('../lib/charmBook.js');
const { CALLERS } = require('../data/callers.js');
const BOOKJS = fs.readFileSync(path.join(__dirname, '../client/charm-book.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const item = (list, key) => list.find((x) => x.key === key);

// ── What a caller writes in ──
const leask = CALLERS.find((c) => c.steps.some((s) => s.charm === 'sprain'));
const w = writesOf(leask);
check('a caller writes in their own entry and the charms they need', w[0].chapter === 'callers' && w[0].id === leask.id && w.some((x) => x.chapter === 'charms' && x.id === 'sprain'));
const gibbs = CALLERS.find((c) => c.steps.some((s) => s.rite === 'nuts'));
check('…and the rites they need', writesOf(gibbs).some((x) => x.chapter === null && x.id === 'nuts'));

// ── A fresh book ──
const fresh = buildCharmBook({ acct: {}, prog: {}, seasonKey: 'samhain' });
const hour = (planet, start, end) => ({ planet, name: planet[0].toUpperCase() + planet.slice(1), glyph: '*', start, end });
const T = 1000000000000;
const wn = whereNext({
  book: fresh, offeredIds: [gibbs.id, leask.id], now: T,
  season: { key: 'samhain', name: 'Samhain', glyph: '🕯️' }, nextSeason: { name: 'Yule' },
  oldDay: { today: [{ key: 'x', icon: '🐄', title: 'Martinmas: the mart', text: 'Cattle were killed and salted. More words here.' }], next: null },
  hours: [hour('venus', T - 60000, T + 20 * 60000)], hourHerbs: { venus: ['Mugwort', 'Feverfew', 'Yarrow'] },
});
const door = item(wn, 'door');
check('today\'s callers who would write something new, with what they\'d write', door && door.action === 'board' && door.lines.some((l) => l.includes(gibbs.caller) && /Burning the Nuts/.test(l)) && door.lines.some((l) => l.includes(leask.caller) && /Sprain/.test(l)));
check('…each entry named once', door && (door.lines.find((l) => l.includes(leask.caller)).match(/Wresting Thread/g) || []).length <= 2);
const blue = CALLERS.find((c) => c.steps.some((s) => s.rite === 'clue'));
const wnBlue = whereNext({ book: fresh, offeredIds: [blue.id] });
check('a rite named like its caller ("The Blue Clue") is not named twice', item(wnBlue, 'door') && !item(wnBlue, 'door').lines.some((l) => /\(The Blue Clue\)/.test(l)), item(wnBlue, 'door') && item(wnBlue, 'door').lines);
check('the planetary hour now, with its herbs and time left', item(wn, 'hour') && /The hour of Venus is now/.test(item(wn, 'hour').title) && /Mugwort, Feverfew and 1 more/.test(item(wn, 'hour').lines[0]) && /20 minutes left/.test(item(wn, 'hour').lines[0]));
const season = item(wn, 'season');
check('this festival\'s customs still to work, and how long its callers come', season && season.chapter === 'halloween' && /^Samhain: 5 customs to work$/.test(season.title) && /until Yule/.test(season.lines[1]));
check('today in the old calendar, first sentence only', item(wn, 'old') && /Today in the old calendar: Martinmas/.test(item(wn, 'old').title) && item(wn, 'old').lines[0] === 'Cattle were killed and salted.');
check('unread books on the Real Shelf', item(wn, 'library') && /books unread on the Real Shelf/.test(item(wn, 'library').title) && item(wn, 'library').chapter === 'library');
const charms = item(wn, 'charms');
check('charms not yet said, leaving out the one at the door today', charms && !/Wresting Thread/.test(charms.lines[0]) && /\d charms not yet said/.test(charms.title));
check('what can be done now comes first', wn[0].now && wn[1].now && wn.findIndex((x) => !x.now) > wn.findLastIndex((x) => x.now));

// ── Later: things done drop off ──
const later = buildCharmBook({ acct: { callers: { byId: { [gibbs.id]: 1 } }, ritesDone: ['nuts', 'luggies'], charmsSaid: ['sprain'], hoursKept: ['venus'] }, prog: {}, seasonKey: 'samhain' });
const wn2 = whereNext({ book: later, offeredIds: [gibbs.id, leask.id], now: T, season: { key: 'samhain', name: 'Samhain' }, hours: [hour('venus', T - 60000, T + 60000), hour('saturn', T + 60000, T + 3 * 60000)], hourHerbs: {} });
const door2 = item(wn2, 'door');
check('a caller already served, with nothing new to write, is left off', door2 && !door2.lines.some((l) => l.includes(gibbs.caller)) && door2.lines.some((l) => l.includes(leask.caller) && !/Sprain/.test(l)));
check('a kept hour is skipped for the next one to come', item(wn2, 'hour') && /The hour of Saturn comes in 1 minute/.test(item(wn2, 'hour').title) && !item(wn2, 'hour').now);
check('the festival count goes down', /Samhain: 3 of its 5 customs/.test(item(wn2, 'season').title));
const all = whereNext({ book: buildCharmBook({ acct: { ritesDone: Object.keys(require('../data/halloween.js').HALLOWEEN_RITES) }, prog: {}, seasonKey: 'samhain' }), season: { key: 'samhain', name: 'Samhain' }, nextSeason: { name: 'Yule' } });
const sAll = item(all, 'season');
check('with every custom worked, it points to the next festival', sAll && /Samhain: every custom worked/.test(sAll.title) && /next festival is Yule/.test(sAll.lines[0]), sAll);
const near = whereNext({ book: { chapters: [{ key: 'wards', icon: '🏠', title: 'Threshold & Hearth', met: 3, total: 4, entries: [] }, { key: 'ogham', icon: '🌳', title: 'Ogham', met: 0, total: 20, entries: [] }] } });
check('a chapter one entry from done is pointed out; an untouched one is not', item(near, 'near:wards') && /1 to go/.test(item(near, 'near:wards').title) && !item(near, 'near:ogham'));
check('no book, no page', whereNext({ book: null }).length === 0);

// ── The client ──
check('the contents page leads to Where next, and items open a chapter or the Board', /cbNextRow/.test(BOOKJS) && /renderNext\(body\)/.test(BOOKJS) && /openBoard\(\)/.test(BOOKJS) && /openChapter = it\.chapter/.test(BOOKJS));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const p = { accountKey: 'scribe', room: 'town' };
  h.accounts.scribe = {}; h.playerProgress.scribe = { level: 1, xp: 0 };
  const book = h.charmBookStateBody(p);
  check('the Charm Book state carries the Where next page', Array.isArray(book.whereNext) && book.whereNext.length >= 3 && book.whereNext.every((x) => x.key && x.title && Array.isArray(x.lines)));
  check('…with today\'s callers from the door', item(book.whereNext, 'door') && item(book.whereNext, 'door').lines.length >= 2);
  const swithin = h.whereNextFor(p, book, Date.UTC(2026, 6, 15, 12));
  check('on St Swithin\'s Day the old calendar says so', item(swithin, 'old') && /St Swithin/.test(item(swithin, 'old').title) && item(swithin, 'old').now);
  check('a guest gets the page without the door', !item(h.whereNextFor({ room: 'town' }, h.charmBookStateBody({ room: 'town' })), 'door'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
