// Callers audit, Horn Fair to the Boy Bishop (callers 84–94): each correction
// was checked against its source, first- or second-hand; what could not be
// confirmed was left out.
const test = require('node:test');
const assert = require('node:assert');
const { CALLERS } = require('../data/callers');

const by = (id) => CALLERS.find((c) => c.id === id);
const failures = [];
function check(name, ok) { if (!ok) failures.push(name); }

check('Horn Fair: Hone vol. I (the 1825 fair)', /Hone, The Every-Day Book, vol\. I \(1826\), 18 October/.test(by('horn_fair').source));
check('St Crispin: the Folio cited; apprentice or full minimum wage', /Henry V, IV\.iii, First Folio \(1623\)/.test(by('st_crispin').source) && /or the full rate/.test(by('st_crispin').resolution));
const mop = by('mop_fair');
check('mop fair: principal terms on day one, the rest in two months; Howitt and the GLAA cited', /the rest within two months/.test(mop.resolution) && /Howitt, The Rural Life of England \(1840\)/.test(mop.source) && /Gangmasters and Labour Abuse Authority/.test(mop.source));
const sj = by('simon_jude');
check('Simon and Jude: Hone vol. I (1826)', /\(Hone, 1826\)/.test(sj.lore) && /vol\. I \(1826\), 28 October/.test(sj.source));
const al = by('allantide');
check('Allantide: no ducking (not in Courtney); St Ives as Hunt has it', !/ducking/.test(al.resolution) && /as little as five centimetres/.test(al.resolution) && /at St Ives every child/.test(al.lore));
check('Hop-tu-Naa: the fire services and Miller cited; no unsourced turnip line', /Buckinghamshire Fire & Rescue/.test(by('hop_tu_naa_moots').source) && /Manx Notes 144/.test(by('hop_tu_naa_moots').source) && !/harder than a pumpkin/.test(by('hop_tu_naa_moots').resolution));
check('Fifth of November: Hone vol. I col. 1430, and Chambers, cited', /vol\. I \(1826\), 5 November, col\. 1430/.test(by('fifth_november').source) && /Chambers, The Book of Days \(1864\), 5 November/.test(by('fifth_november').source));
const so = by('all_souls_souling');
check('souling: Aubrey\'s cakes for a prayer; no unsourced spice or charity claims; Burne cited', /given to the children and the poor in return for a prayer for your dead/.test(so.resolution) && !/spice|before they were a game/.test(so.resolution) && /Burne, Shropshire Folk-Lore/.test(so.source));
const cl = by('old_clem_smiths');
check('Old Clem: the NHS twenty minutes, never ice; ABANA and the NHS cited; the carrying is Hone\'s', /cool running water for twenty minutes, never ice/.test(cl.resolution) && !/ten minutes/.test(cl.resolution) && /ABANA, Safety Policy/.test(cl.source) && /\(Hone, 1826\)\.$/.test(cl.lore));
const ca = by('cattern_lacemakers');
check('Catterning: candlelight does no lasting harm; Hone\'s spinsters only; Hone vol. I; Halliwell cited', /does them no lasting harm/.test(ca.resolution) && !/wears out the eyes/.test(ca.resolution) && /'patroness of spinsters' \(Hone\)/.test(ca.lore) && /vol\. I \(1826\), 25 November/.test(ca.source) && /Halliwell/.test(ca.source) && /College of Optometrists/.test(ca.source));

test('callers 84–94 audit corrections hold', () => {
  assert.deepStrictEqual(failures, []);
});
