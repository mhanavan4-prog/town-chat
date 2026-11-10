// Callers audit, St Andrew to Grotto Day (callers 95–106): each correction
// was checked against its source, first- or second-hand; what could not be
// confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }

check('St Andrew: the drey protected everywhere, not only in Scotland', /everywhere it's an offence to damage its drey or disturb it there/.test(by('st_andrew').resolution));
check('St Lucy: October to early March; 999 if someone is about to act', /October to early March/.test(by('st_lucy').resolution) && /about to act on them, ring 999/.test(by('st_lucy').resolution));
const g = by('st_thomas_gooding');
check('gooding: Hone vol. I col. 1586; the shilling is Staffordshire\'s (Chambers); Charity Commission and Trussell cited', /vol\. I \(1826\), 21 December, col\. 1586/.test(g.source) && /in Staffordshire the parson gave a shilling/.test(g.lore) && /Charity Commission/.test(g.source) && /Trussell/.test(g.source));
const f = by('furry_day');
check('Furry Day: the NHS cooling steps, not feet up; the Carnival\'s arm number and photo; Hone cited', /cool their skin with a wet cloth and a fan/.test(f.resolution) && !/feet up|wristband/.test(f.resolution) && /vol\. II \(1827\), 8 May, col\. 648/.test(f.source) && /Notting Hill Carnival/.test(f.source));
check('Rogation: the definitive-map and Land Registry authorities cited', /2031 cut-off/.test(by('rogation_bounds').source) && /HM Land Registry/.test(by('rogation_bounds').source));
const r = by('rushbearing_ambleside');
check('rush-bearing: waders, not unsourced species; the law and the GWCT cited', /wading birds nest in the rushes/.test(r.resolution) && !/lapwing, curlew and snipe/.test(r.resolution) && /Wildlife and Countryside Act 1981, ss\. 1 and 13/.test(r.source) && /Game & Wildlife Conservation Trust/.test(r.source));
check('Horn Dance: Rule 5\'s look-outs in bright or reflective clothes', /look-outs at the front and back, in bright clothes by day and reflective ones in the dark/.test(by('horn_dance').resolution));
const b = by('bartholomew_fair');
check('Bartholomew Fair: Morley\'s 1133; no unsourced bank line', /chartered, Morley gives it, in 1133/.test(b.lore) && /Morley, Memoirs of Bartholomew Fair/.test(b.source) && !/ring your bank/.test(b.resolution));
const o = by('ould_lammas_fair');
check('Ould Lammas Fair: 1831 is the OS Memoir\'s, the fair list Lewis\'s; the passport office updates the database', /\(Ordnance Survey Memoir\)/.test(o.lore) && /and now for dulse and yellowman/.test(o.lore) && /Ordnance Survey Memoir, Ballycastle \(1831\)/.test(o.source) && /tell the passport office/.test(o.resolution));
const l = by('lammas_term');
check('Lammas term: 39 hours after 26 weeks; Otterbourne cited', /39 once you've worked there 26 weeks/.test(l.resolution) && /Otterbourne/.test(l.source));
const p = by('puck_fair');
check('Puck Fair: the vet and the organisers in 2022; "said to rest" on 1613', /the vet and the organisers decided in 2022/.test(p.resolution) && /is said to rest on a patent of 1613/.test(p.lore) && /Irish Examiner/.test(p.source));
const gr = by('grotto_day_shells');
check('Grotto Day: cooking kills norovirus (FSA); Hone vol. I; the 1967 Act cited', /cooked through, the norovirus is killed/.test(gr.resolution) && /vol\. I \(1826\), 25 July/.test(gr.source) && /Sea Fisheries \(Shellfish\) Act 1967, s\. 16/.test(gr.source));

test('callers 95–106 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
