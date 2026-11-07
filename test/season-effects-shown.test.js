// Every sabbat's effects are live, and the game says what they are: the HUD
// tag and the Commonplace Book show each season's effects in words.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-seasonfx-');
process.on('uncaughtException', (e) => { console.log('FAIL - threw:', e && e.stack); process.exit(1); });

const fs = require('fs');
const path = require('path');
const { SABBATS, seasonEffectLines } = require('../data/seasons.js');
const SEASONS_SRC = fs.readFileSync(path.join(__dirname, '../data/seasons.js'), 'utf8');
const SERVER = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const CLIENT = fs.readFileSync(path.join(__dirname, '../client/main.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ── Every declared effect is wired in the server ──
const keys = new Set(SABBATS.flatMap((s) => Object.keys(s.effects || {})));
const wired = (k) => new RegExp(`effects\\.${k}\\b`).test(SERVER);
check('every effect a sabbat declares is applied somewhere in the server', [...keys].every(wired), [...keys].filter((k) => !wired(k)));
check('the seasons file no longer claims its effects are not applied', !/NOT yet applied/.test(SEASONS_SRC));

// ── …and every one can be put into words ──
check('every sabbat\'s effects have words', SABBATS.every((s) => seasonEffectLines(s.effects).length >= 1), SABBATS.map((s) => [s.key, seasonEffectLines(s.effects)]));
const words = (k) => seasonEffectLines(SABBATS.find((s) => s.key === k).effects).join(' | ');
check('Beltane says its Fireball burns hotter', /\+30% Fireball damage/.test(words('beltane')), words('beltane'));
check('Mabon says its loot odds rise', /\+20% loot odds/.test(words('mabon')), words('mabon'));
check('Samhain says the slain rise sooner', /the slain rise 40% sooner/.test(words('samhain')), words('samhain'));
check('Imbolc and Yule say they mend out of combat', /HP\/s mending out of combat/.test(words('imbolc')) && /HP\/s mending out of combat/.test(words('yule')));
check('an empty or unknown effect says nothing', seasonEffectLines({}).length === 0 && seasonEffectLines(null).length === 0);
check('the HUD tag and the Commonplace Book draw the words', /calendarState\.season\.effectLines/.test(CLIENT) && /calendarState\.wheelEffects/.test(CLIENT));

require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  for (const [label, t] of [['Beltane', Date.UTC(2027, 4, 1, 12)], ['Samhain', Date.UTC(2026, 9, 31, 12)]]) {
    const cal = h.calendarPublicState(t);
    check(`${label} day: the calendar sends the season's effects in words`, cal.season && Array.isArray(cal.season.effectLines) && cal.season.effectLines.length >= 1, cal.season && cal.season.effectLines);
  }
  const after = h.calendarPublicState(Date.UTC(2027, 4, 9, 12));
  check('a week after Beltane its effects are off, and so are the words', after.season && after.season.key === 'beltane' && after.season.effectLines.length === 0);
  const cal = h.calendarPublicState();
  check('…and every sabbat\'s, for the Commonplace Book', cal.wheelEffects && SABBATS.every((s) => Array.isArray(cal.wheelEffects[s.key]) && cal.wheelEffects[s.key].length >= 1));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);
