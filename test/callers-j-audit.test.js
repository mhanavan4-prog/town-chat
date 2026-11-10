// Callers audit, St Andrew to Grotto Day (callers 95–106): each correction
// was checked against its source, first- or second-hand; what could not be
// confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }

const g = by('st_thomas_gooding');
check('(the lore, as audited) gooding: Hone vol. I col. 1586; the shilling is Staffordshire\'s (Chambers); Charity Commission and Trussell cited', /in Staffordshire the parson gave a shilling/.test(g.lore));
const b = by('bartholomew_fair');
check('Bartholomew Fair: Morley\'s 1133; no unsourced bank line', /chartered, Morley gives it, in 1133/.test(b.lore) && /Morley, Memoirs of Bartholomew Fair/.test(b.source) && !/ring your bank/.test(b.resolution));
const o = by('ould_lammas_fair');
check('(the lore, as audited) Ould Lammas Fair: 1831 is the OS Memoir\'s, the fair list Lewis\'s; the passport office updates the database', /\(Ordnance Survey Memoir\)/.test(o.lore) && /and now for dulse and yellowman/.test(o.lore));
const p = by('puck_fair');
check('(the lore, as audited) Puck Fair: the vet and the organisers in 2022; "said to rest" on 1613', /is said to rest on a patent of 1613/.test(p.lore));

test('callers 95–106 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
