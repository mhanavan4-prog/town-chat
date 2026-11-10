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
check('Good Friday: the mould line is Poor Robin\'s, not Chambers\'s; 111 now', /"not grow mouldy like the common bread" \(Poor Robin's Almanack, 1733\)/.test(gf.lore) && /Poor Robin\\?'s Almanack \(1733\), in E\. C\. Brewer/.test(gf.source) && /ring 111 now/.test(gf.resolution));

const wd = by('well_dressing');
check('well-dressing: the readings one at each well (Lysons); UKHSA\'s at-risk groups', /one at each well \(Lysons, 1817\)/.test(wd.lore) && /young children, and anyone whose immune system is weak/.test(wd.resolution) && /Plantlife/.test(wd.source));

const oa = by('oak_apple_boys');
check('Oak Apple Day: the nettles are Derbyshire\'s; Hone, Chambers and St John Ambulance cited; no unsourced roadside rule', /in Derbyshire a lad without was stung/.test(oa.lore) && /Hone/.test(oa.source) && /St John Ambulance/.test(oa.source) && !/away from the road/.test(oa.resolution));

check('Dog Days: Vaughan and Hone cited', /Vaughan, Approved Directions for Health \(1612\)/.test(by('dog_days').source) && /Hone, The Every-Day Book, vol\. I \(1826\), 3 July/.test(by('dog_days').source));

const ty = by('tynwald');
check('Tynwald: the Lieutenant Governor presides; Moore\'s Midsummer Eve wreaths', /who takes it up to the Lieutenant Governor/.test(ty.resolution) && !/President/.test(ty.resolution) && /on Midsummer Eve was once made into wreaths/.test(ty.lore));

const sw = by('st_swithin_hay');
check('St Swithin: "since records began" as the Met Office has it; Hone, RMetS and the RHS cited', /since records began it has never once rained for forty days on end/.test(sw.resolution) && /no such forty days has ever been recorded/.test(sw.lore) && /Hone, The Every-Day Book, vol\. I \(1826\), 15 July/.test(sw.source) && /Royal Meteorological Society/.test(sw.source) && /RHS, "Potato blight"/.test(sw.source));

const sp = by('st_peters_eve');
check('St Peter\'s Eve: Courtney\'s beach pile is Polperro\'s; Newcastle sourced; no unsourced beach rule', /At home in Polperro/.test(sp.plea) && /Newcastle cooks/.test(sp.source) && !/find out first/.test(sp.resolution));

const mq = by('midsummer_quarter');
check('quarter day: Hone vol. I (1826); police and the council', /\(Hone, The Every-Day Book, vol\. I, 1826\)/.test(mq.lore) && /ring the police, and tell the council/.test(mq.resolution));

const mm = by('midsummer_men');
check('Midsummer Men: Refuge\'s signs; Aubrey via Vickery, and Brewer, cited', /checking your messages/.test(mm.resolution) && /in R\. Vickery, Folk Flora \(2019\)/.test(mm.source) && /Brewer/.test(mm.source) && /Refuge/.test(mm.source));

const fs = by('fern_seed_eve');
check('fern seed: the NHS tick method, not "pull any off whole"', /fine tweezers, gripped close to the skin and pulled slowly upwards without squeezing/.test(fs.resolution) && !/pull any off whole/.test(fs.resolution) && /NHS, "Lyme disease"/.test(fs.source));

test('callers 72–83 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
