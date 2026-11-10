// Callers audit, the shewstone to the stye (callers 119–129): each correction
// was checked against its source, first- or second-hand; what could not be
// confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }


const nf = by('need_fire_murrain');
check('need-fire: Martin\'s sprinkled water, Frazer\'s smoke; the 1865 plague sourced', /water heated on it sprinkled on the sick cattle; elsewhere, Frazer found, the beasts were driven through its smoke/.test(nf.lore) && /The Cattle Plague of 1865/.test(nf.source));


const tb = by('toad_bone_mare');
check('toad bone: no unsupported horse-versus-dog claim; Rolfe and the ARU study cited', /a horse has a keen nose and smells a nervous hand/.test(tb.resolution) && !/better nose than a dog/.test(tb.resolution) && /Rolfe, I Walked by Night/.test(tb.source) && /Anglia Ruskin/.test(tb.source));

const cw = by('changeling_wife');
check('(the lore, as audited) changeling wife: no test can prove it; Bridget Cleary answered and was still killed, by her husband; the sepsis red flags', /her husband, believing it, killed Bridget Cleary/.test(cw.lore));

const wt = by('charming_warts');
check('warts: the clergyman\'s charm was the wheat-stalk; the quote is the 2012 update\'s', /a Devon clergyman owned to curing his brother's warts with a knotted wheat-stalk/.test(wt.lore) && /the 2012 update calls waiting "a very reasonable option"/.test(wt.lore));


test('callers 119–129 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
