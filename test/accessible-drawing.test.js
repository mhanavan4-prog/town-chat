// Every drawn ritual can be done without drag-and-tap: each board has a
// keyboard path (buttons, a slider, selects) that does what a tap would, its
// picture is labelled for screen readers, and its running note is announced.
// (Driven end to end in headless Chromium by keyboard alone when this landed:
// the daisy wheel, the VV, the pentangle, the taper burn, four ogham letters
// and Dee's Monad each came out valid.)
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'client', f), 'utf8');
const wards = read('wards.js'), ogham = read('ogham.js'), monas = read('monas.js'), board = read('board.js');

check('the Wards panel has a shared keys panel, a labelled group', /function keysPanel\(body, label, items\)/.test(wards) && /setAttribute\('role', 'group'\)/.test(wards));
check('…the daisy wheel by keys: the centre, a point on the circle, each crossing by the clock', /Set the point on the centre mark/.test(wards) && /On the circle at \$\{clock\(x, y\)\}/.test(wards) && /Where it crosses at \$\{clock\(x, y\)\}/.test(wards));
check('…the Marian mark by keys: every nick a button', /Or cut by keys: choose a nick, then the other end/.test(wards));
check('…the pentangle by keys: the points in order, and lift the brush', /Lift the brush/.test(wards) && /brush down from the first, then lift/.test(wards));
check('…the taper burn by keys: a slant slider and hold / take away', /type = 'range'/.test(wards) && /Hold the flame to the wood/.test(wards) && /Take the taper away/.test(wards));
check('…the SATOR square is typed already; its picture is hidden from screen readers as a duplicate', /grid\.setAttribute\('aria-hidden', 'true'\)/.test(wards));
check('…every board picture is labelled, and the notes are announced', (wards.match(/setAttribute\('role', 'img'\)/g) || []).length >= 4 && /setAttribute\('aria-live', 'polite'\)/.test(wards));
check('the ogham bench by keys: right, left, across, notch', /Cut to the right of the edge/.test(ogham) && /Cut to the left of the edge/.test(ogham) && /Cut slanting across the edge/.test(ogham) && /Notch the edge/.test(ogham) && /aria-live/.test(ogham));
check('Dee\'s Monad by keys: across and up selects, and use this point', /Across \(left is minus\)/.test(monas) && /Up \(down is minus\)/.test(monas) && /Use this point/.test(monas) && /aria-live/.test(monas));
check('the written charms are typed in labelled inputs', /setAttribute\('aria-label', `Line \$\{s\.written \+ 1\} of/.test(board));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
