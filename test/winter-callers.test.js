// Two dated callers for the winter: Stir-up Sunday (data/stirUp.js) and saining
// the house at Hogmanay (data/saining.js). Kept to what the record says, and
// saying plainly where it stops.
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const { STIR_UP_RITES } = require('../data/stirUp');
const { SAINING_RITES } = require('../data/saining');
const { OLD_CALENDAR, entryDate } = require('../data/oldCalendar');
const { CALLERS } = require('../data/callers');

// ── Stir-up Sunday ──
const S = STIR_UP_RITES.stir_up;
const sc = CALLERS.find((c) => c.id === 'stir_up_sunday');
check('the collect, word for word as the Prayer Book has it', /"Stir up, we beseech thee, O Lord, the wills of thy faithful people; that they plenteously bringing forth the fruit of good works, may of thee be plenteously rewarded"/.test(S.lore) && /Book of Common Prayer \(1549\)/.test(S.source));
check('…from the Sarum collect, "Excita, quaesumus, Domine" (Procter)', /Excita, quaesumus, Domine/.test(S.lore) && /Procter.*p\. 275/.test(S.source));
check('the schoolboys\' rhyme as Dyer prints it (1876, p. 431), after Brand', /"Stir up, we beseech thee, \/ The pudding in the pot, \/ And when we get home, \/ We'll eat it all hot"/.test(S.lore) && /Dyer.*p\. 431.*Brand/.test(S.source));
check('it says the thirteen ingredients, east to west and the wishes have no early source', /thirteen ingredients.*east to west.*wish.*no source we could find before the twentieth century/.test(S.lore) && /no source we could find before the twentieth century/.test(sc.lore));
check('…and its caller does not do them as if they were old: the cook\'s mother never said a word of it', /My mother never said a word of it/.test(sc.plea) && /neither knows nor cares whether it comes to thirteen/.test(sc.resolution));
check('a folk tier: the name and the rhyme are old, the pudding-day custom later', S.tier === 'folk' && sc.tier === 'folk');
const se = OLD_CALENDAR.find((e) => e.key === 'stir_up_sunday');
const sundays = [2025, 2026, 2027, 2028, 2029, 2030].map((y) => { const [m, d] = entryDate(se, y); return [y, m, d, new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; });
check('dated to the Sunday next before Advent: a Sunday from 20 to 26 November (22 November in 2026)', sundays.every(([, m, d, wd]) => m === 11 && d >= 20 && d <= 26 && wd === 0) && sundays.find(([y]) => y === 2026)[2] === 22, sundays);
check('the caller comes on that day', sc.when && sc.when.calendar === 'stir_up_sunday');

// ── Saining at Hogmanay ──
const H = SAINING_RITES.saining;
const hc = CALLERS.find((c) => c.id === 'hogmanay_saining');
check('Stewart\'s Strathdown account, in his words: the juniper, the ford, the silence', /"as much in request this night as kail is on Hallowe'en"/.test(H.lore) && /"the dead and living ford"/.test(H.lore) && /"observing all the time the most profound silence"/.test(H.lore));
check('…the brush, the key-hole, the juniper, the coughing, the beasts, the bottle dhu', /"by means of a large brush"/.test(H.lore) && /"stuff all the crevices and windows in the house, even to the key-hole"/.test(H.lore) && /"piles of juniper are kindled into a conflagration"/.test(H.lore) && /"an incessant shower of hiccupping, sneezing, wheezing, and coughing"/.test(H.lore) && /"the horses, cattle, and other bestial stock"/.test(H.lore) && /"bottle dhu"/.test(H.lore) && /Stewart.*pp\. 172–177/.test(H.source));
check('Campbell: New Year\'s Day "a great saining day", juniper "burnt in the byre" (1902)', /"a great saining day"/.test(H.lore) && /"burnt in the byre"/.test(H.lore) && /Campbell.*1902/.test(H.source));
check('nothing Stewart doesn\'t say: no whisky by name, the water not drunk, no "living and the dead" gloss', !/whisky|drank|drink the water|living and the dead/i.test(H.lore + H.how + hc.resolution + hc.lore));
check('the one modern line, folded under it, is about the smoke in a shut room', /Smoke in a shut room can kill/.test(hc.note) && /window open/.test(hc.note));
check('dated to Hogmanay', OLD_CALENDAR.find((e) => e.key === 'hogmanay_saining').month === 12 && OLD_CALENDAR.find((e) => e.key === 'hogmanay_saining').day === 31 && hc.when.calendar === 'hogmanay_saining');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
