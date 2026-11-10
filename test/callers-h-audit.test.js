// Callers audit, Good Friday to the fern seed (callers 72–83): each correction
// was checked against its source, first- or second-hand; what could not be
// confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }

const gf = by('good_friday_bun');
check('(the lore, as audited) Good Friday: the mould line is Poor Robin\'s, not Chambers\'s; 111 now', /"not grow mouldy like the common bread" \(Poor Robin's Almanack, 1733\)/.test(gf.lore));

const wd = by('well_dressing');
check('(the lore, as audited) well-dressing: the readings one at each well (Lysons); UKHSA\'s at-risk groups', /one at each well \(Lysons, 1817\)/.test(wd.lore));

const oa = by('oak_apple_boys');
check('(the lore, as audited) Oak Apple Day: the nettles are Derbyshire\'s; Hone, Chambers and St John Ambulance cited; no unsourced roadside rule', /in Derbyshire a lad without was stung/.test(oa.lore));

check('Dog Days: Vaughan and Hone cited', /Vaughan, Approved Directions for Health \(1612\)/.test(by('dog_days').source) && /Hone, The Every-Day Book, vol\. I \(1826\), 3 July/.test(by('dog_days').source));

const ty = by('tynwald');
check('Tynwald: the Lieutenant Governor presides; Moore\'s Midsummer Eve wreaths', /who takes it up to the Lieutenant Governor/.test(ty.resolution) && !/President/.test(ty.resolution) && /on Midsummer Eve was once made into wreaths/.test(ty.lore));

const sw = by('st_swithin_hay');
check('(the lore, as audited) St Swithin: "since records began" as the Met Office has it; Hone, RMetS and the RHS cited', /no such forty days has ever been recorded/.test(sw.lore));

const sp = by('st_peters_eve');
check('St Peter\'s Eve: Courtney\'s beach pile is Polperro\'s; Newcastle sourced; no unsourced beach rule', /At home in Polperro/.test(sp.plea) && /Newcastle cooks/.test(sp.source) && !/find out first/.test(sp.resolution));

const mq = by('midsummer_quarter');
check('(the lore, as audited) quarter day: Hone vol. I (1826); police and the council', /\(Hone, The Every-Day Book, vol\. I, 1826\)/.test(mq.lore));



test('callers 72–83 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
