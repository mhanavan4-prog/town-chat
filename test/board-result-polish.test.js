// From the Martinmas-week phone playtest: a finished working's result opens at
// its top (not wherever the long working card was scrolled to), and a notice
// shown over an open menu is solid, so the panel's own words don't bleed
// through it.
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const BOARD = fs.readFileSync(path.join(__dirname, '../client/board.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }

const fn = BOARD.match(/function renderCallerResult\(list, r\) \{([\s\S]*?)\n\}/);
check('a new caller result scrolls the Board list back to the top', fn && /list\.appendChild\(card\);\s*if \(r !== resultShown\) \{ resultShown = r; list\.scrollTop = 0; \}/.test(fn[1]));
check('…once per result, so re-renders while reading it leave the scroll alone', /let resultShown = null;/.test(BOARD));
const solid = HTML.match(/body\.panelOpen \.unlockToastItem, body\.panelOpen \.unlockToastItem\.flavor \{([^}]*)\}/);
check('a notice over an open menu has a solid background', solid && /background:rgb\(\d+,\d+,\d+\)/.test(solid[1]));
check('…and comes after the base toast styles, so it wins', solid && HTML.indexOf(solid[0]) > HTML.indexOf('.unlockToastItem.flavor {'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
