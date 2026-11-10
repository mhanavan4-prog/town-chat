// Callers audit, the shewstone to the stye (callers 119–129): each correction
// was checked against its source, first- or second-hand; what could not be
// confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }

const sh = by('shewstone_litter');
check('shewstone: the pig code\'s clean dry straw and rail; the pig doctor today, not the farrier tomorrow', /Clean dry straw, not so deep the piglets are lost in it/.test(sh.resolution) && /the pig doctor today/.test(sh.resolution) && !/farrier|Deep dry straw|cold sty/.test(sh.resolution) && /Code of Practice for the Welfare of Pigs/.test(sh.source) && /AHDB/.test(sh.source));

const nf = by('need_fire_murrain');
check('need-fire: Martin\'s sprinkled water, Frazer\'s smoke; the 1865 plague sourced', /water heated on it sprinkled on the sick cattle; elsewhere, Frazer found, the beasts were driven through its smoke/.test(nf.lore) && /The Cattle Plague of 1865/.test(nf.source));

const es = by('elf_shot_cow');
check('elf-shot: frothy bloat needs the cow doctor now and oil; the trocar a last resort', /a blown cow can die within a quarter of an hour/.test(es.resolution) && /A quarter to half a litre of vegetable oil/.test(es.resolution) && /the trocar is the last resort/.test(es.resolution) && !/stick tied in her mouth|front end uphill/.test(es.resolution) && /NADIS, "Bloat"/.test(es.source) && /Cambridge Archaeological Journal 28\(3\)/.test(es.source));

const tb = by('toad_bone_mare');
check('toad bone: no unsupported horse-versus-dog claim; Rolfe and the ARU study cited', /a horse has a keen nose and smells a nervous hand/.test(tb.resolution) && !/better nose than a dog/.test(tb.resolution) && /Rolfe, I Walked by Night/.test(tb.source) && /Anglia Ruskin/.test(tb.source));

const cw = by('changeling_wife');
check('changeling wife: no test can prove it; Bridget Cleary answered and was still killed, by her husband; the sepsis red flags', /no answer to a question could prove it either way/.test(cw.resolution) && /gave the right answer in God's name, and her husband still didn't believe her/.test(cw.resolution) && !/that is the end of the question/.test(cw.resolution) && /her husband, believing it, killed Bridget Cleary/.test(cw.lore) && /doesn't know where she is or who you are, or she's fighting for breath/.test(cw.resolution) && /McCarthy, Five Years in Ireland/.test(cw.source) && /NHS, "Sepsis"/.test(cw.source));

const wt = by('charming_warts');
check('warts: the clergyman\'s charm was the wheat-stalk; the quote is the 2012 update\'s', /a Devon clergyman owned to curing his brother's warts with a knotted wheat-stalk/.test(wt.lore) && /the 2012 update calls waiting "a very reasonable option"/.test(wt.lore));

check('sprain: the NHS 111 wording', /if it hurts to put weight on it/.test(by('the_sprain').resolution));
const cr = by('the_cramp');
check('cramp: no unsourced "drink enough"; NHS inform and Farquhar cited', !/drink enough/.test(cr.resolution) && /NHS inform, "Leg cramps"/.test(cr.source) && /Farquhar/.test(cr.source));
check('stye: a week or two; nidirect for the head', /within a week or two/.test(by('the_stye').resolution) && /nidirect/.test(by('the_stye').source));

test('callers 119–129 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
