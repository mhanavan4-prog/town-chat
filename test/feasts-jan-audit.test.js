// The Turning Year, January to early February, read against its sources:
// Mitchell's Clavie page and volume dates; Chambers's "congreve dare" and
// "black-smith"; Hone's Bessy "an old woman, or a boy dressed up to represent
// one"; the non-payer's lawn or drive, not a doorstep; Herrick's St Distaff
// poem not given "whole"; his "looke"; Candlemas a Scottish quarter day fixed
// by the 1990 Act on 28 February; Kildare's collections "in honour of Miss
// Biddy"; the Brat Bríde from the Dúchas leaflet, not the museum; the old
// Brigid's cross buried or scattered, not burned.
const one = (o) => Object.values(o)[0];
const R = {
  clavie: one(require('../data/clavie.js').CLAVIE_RITES),
  plough: one(require('../data/ploughMonday.js').PLOUGH_RITES),
  distaff: one(require('../data/stDistaff.js').DISTAFF_RITES),
  ceve: one(require('../data/candlemasEve.js').CANDLEMAS_RITES),
  cweather: one(require('../data/candlemasWeather.js').CANDLEMAS_WEATHER_RITES),
  brigid: one(require('../data/brigidEve.js').BRIGID_RITES),
};
const { WHEEL_RITES } = require('../data/wheelRites.js');
const { OLD_CALENDAR } = require('../data/oldCalendar.js');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
check('the Clavie: Mitchell 10 (1872–74), pp. 656–57; Chambers\'s spelling', /10 \(1872–74\), pp\. 656–57/.test(R.clavie.source) && /patent congreve dare approach/.test(R.clavie.lore) && /village black-smith/.test(R.clavie.lore));
check('Plough Monday: Hone\'s Bessy; the lawn or drive', /"an old woman, or a boy dressed up to represent one"/.test(R.plough.lore) && /lawn or drive ploughed up/.test(R.plough.lore) && !/doorstep|a man dressed as an old woman/.test(R.plough.lore) && !/a man dressed as an old woman/.test(JSON.stringify(OLD_CALENDAR)));
check('St Distaff: not "the whole of it"', !/the whole of it/.test(R.distaff.lore));
check('Candlemas Eve: Herrick\'s "looke"', /"looke how many leaves there be/.test(R.ceve.lore));
check('Candlemas weather: the 1990 Act\'s 28 February', /since 1990 the law has fixed it on 28 February/.test(R.cweather.lore) && /Term and Quarter Days \(Scotland\) Act 1990/.test(R.cweather.source));
check('the Brídeóg: Kildare\'s collections; the Brat Bríde from Dúchas', /collections of food and money were made "in honour of Miss Biddy"/.test(R.brigid.lore) && /Dúchas, "1 February – St Brigid's Day"/.test(R.brigid.source) && !/All about St Brigid/.test(R.brigid.source));
const cross = Object.values(WHEEL_RITES).find((r) => /Brigid/.test(r.lore || '') && /cross/.test(r.how || ''));
check('St Brigid\'s cross: the old one buried or scattered, not burned', cross && /bury in the field or scatter over the land/.test(cross.how) && !/to burn/.test(cross.how));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
