// Callers audit, May Eve to the pinned heart (callers 107–118): each
// correction was checked against its source, first- or second-hand; what
// could not be confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }

const mg = by('may_garland');
check('May garland: no unsourced pennies or "if in doubt"; the RHS cited', !/pennies/.test(mg.lore + mg.resolution) && !/if in doubt/.test(mg.resolution) && /Potentially harmful garden plants/.test(mg.source));
check('St George: the Norfolk Record Office cited', /Norfolk Record Office/.test(by('st_george').source));
const sm = by('st_marks_watch');
check('St Mark\'s Eve: Hone\'s sick who despaired, not deaths on the night; "the coming year"', /almost despair of recovery/.test(sm.resolution) && !/died of their own fears on this night/.test(sm.resolution) && /in the coming year/.test(sm.lore));
check('bees: Notes and Queries cited', /Notes and Queries \(25 October 1851\)/.test(by('tell_the_bees').source));
const oc = by('overlooked_child');
check('overlooked: Carmichael\'s gold, silver and copper (not "silver water"); Campbell credited; no unsourced crust', /a water with gold, silver and copper in the ladle/.test(oc.lore) && /Campbell wrote that the eye could be in friend or foe/.test(oc.resolution) && !/hard crust/.test(oc.resolution));
const ph = by('pinned_heart_pigs');
check('(the lore, as audited) pinned heart: a pig\'s heart (Elworthy); the Cuming dairyman\'s man; Borrow and ASF reporting', /a pig's heart was stuck with pins and thorns/.test(ph.lore));

test('callers 107–118 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
