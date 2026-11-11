// The old calendar: dated customs of the British and Irish year, each sourced,
// with the moveable feasts worked out from Easter, sent with the calendar.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-oldcal-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { OLD_CALENDAR, oldCalendarDay, easter, entryDate } = require('../data/oldCalendar.js');
const CLIENT = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const on = (key, y) => entryDate(OLD_CALENDAR.find((e) => e.key === key), y).join('/');

// ── The entries ──
check('about sixty customs, each with a unique key', OLD_CALENDAR.length >= 55 && new Set(OLD_CALENDAR.map((e) => e.key)).size === OLD_CALENDAR.length, OLD_CALENDAR.length);
check('every one has a title, an icon, words, a source and a real tier', OLD_CALENDAR.every((e) => e.title && e.icon && e.text && e.source && /^(record|folk)$/.test(e.tier)));
check('every one has a date: a fixed day or a rule', OLD_CALENDAR.every((e) => (e.month >= 1 && e.month <= 12 && e.day >= 1 && e.day <= 31) || typeof e.rule === 'function'));
check('every month has at least three', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].every((m) => OLD_CALENDAR.filter((e) => entryDate(e, 2026)[0] === m).length >= 3));
check('quotes are short (public-domain, under 25 words)', OLD_CALENDAR.every((e) => !e.quote || e.quote.split(/\s+/).length <= 25));
check('no custom the game already works as a rite is repeated here', !OLD_CALENDAR.some((e) => /first-foot|wassail the|yule log|may dew|bride's bed/i.test(e.title)));

// ── Easter and the moveable feasts ──
check('Easter by the Gregorian computus: 2024, 2025, 2026, 2027', [easter(2024), easter(2025), easter(2026), easter(2027)].map((d) => d.join('/')).join(' ') === '3/31 4/20 4/5 3/28');
check('Shrove Tuesday 2026 is 17 February; 2027, 9 February', on('shrove_tuesday', 2026) === '2/17' && on('shrove_tuesday', 2027) === '2/9');
check('Mothering Sunday 2026 is 15 March', on('mothering_sunday', 2026) === '3/15');
check('Plough Monday is the first Monday after Twelfth Day (12 Jan 2026, 11 Jan 2027)', on('plough_monday', 2026) === '1/12' && on('plough_monday', 2027) === '1/11');
check('Helston Furry Day steps back to Saturday when the 8th is a Sunday or Monday', on('helston_furry', 2022) === '5/7' && on('helston_furry', 2023) === '5/6' && on('helston_furry', 2026) === '5/8');
check('the Ould Lammas Fair is the last Tuesday in August', on('ould_lammas_fair', 2026) === '8/25' && on('ould_lammas_fair', 2027) === '8/31');
check('the Horn Dance is the Monday after the first Sunday after 4 September (7 Sept 2026)', on('horn_dance', 2026) === '9/7');

// ── Today and the next ──
const swithin = oldCalendarDay(Date.UTC(2026, 6, 15, 23, 59));
check("15 July is St Swithin's, with its rhyme", swithin.today.length === 1 && swithin.today[0].key === 'st_swithin' && /forty days/.test(swithin.today[0].quote));
const gap = oldCalendarDay(Date.UTC(2026, 10, 7, 12));
check('on a quiet day, the next custom is named with its date and how far off', gap.today.length === 0 && gap.next && gap.next.key === 'martinmas' && gap.next.inDays === 4 && gap.next.month === 11 && gap.next.day === 11);
const yearEnd = oldCalendarDay(Date.UTC(2026, 11, 30, 12));
check('the year wraps: after Childermas comes Hogmanay\'s saining, then the cream of the well on New Year\'s Day', yearEnd.next && yearEnd.next.key === 'hogmanay_saining' && yearEnd.next.inDays === 1 && (() => { const nd = oldCalendarDay(Date.UTC(2026, 11, 31, 12)); return nd.next && nd.next.key === 'cream_of_the_well' && nd.next.inDays === 1; })());
check('the client shows it on the HUD tag, in the Commonplace Book, and once a day as a notice', /calendarState\.oldDay/.test(CLIENT) && /renderOldCalendarSec\(\)/.test(CLIENT) && /maybeToastOldDay\(\)/.test(CLIENT));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const cal = h.calendarPublicState(Date.UTC(2026, 6, 15, 12));
  check('the calendar sends the old day', cal.oldDay && cal.oldDay.today[0] && cal.oldDay.today[0].key === 'st_swithin' && cal.oldDay.next);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
