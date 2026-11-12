// Three quick ways to the map on a phone, none of which adds anything to the
// screen: tap the health-and-level pill; pinch the world (and spread the map
// to put it away); or Map, first in the ☰ menu — with a one-time tip for
// whoever takes the long way.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'), main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');

check('the pill carries a faint map glyph, and nothing else is added to the screen', /<span id="mvMap" aria-hidden="true">🗺️<\/span><\/div/.test(html) && /#mvMap \{ font-size:12px; opacity:0\.6;/.test(html));
check('tapping the pill opens and shuts the map, on touchstart so it works with a thumb on the joystick', /pill\.addEventListener\('touchstart', \(e\) => \{ if \(e\.cancelable\) e\.preventDefault\(\); toggle\(\); \}, \{ passive: false \}\);/.test(main));
check('Map is the first thing in the ☰ menu, and is called Map (it shows the Wilds and the Wastes too)', /<div id="menuGrid">\n {6}<button class="menuRow" id="menuMap"[^>]*>🗺️ Map<\/button>\n {6}<div class="menuSection">You<\/div>/.test(html) && (html.match(/id="menuMap"/g) || []).length === 1);
check('taking the long way through the menu tells you the short ways, once, and never fails for want of storage', /try \{ if \(localStorage\.getItem\('tc_map_ways_told'\)\) return; localStorage\.setItem\('tc_map_ways_told', '1'\); \} catch \(_\) \{ return; \}/.test(main) && /tap your health and level at the top left, or pinch the world, to open the map\.', \{ always: true, level: 'important' \}/.test(main));
check('a pinch is two fingers that came down on the world within a quarter second, drawn in to under 62%', /const PINCH_RATIO_IN = 0\.62, PINCH_RATIO_OUT = 1\.45;/.test(main) && /const PINCH_TOGETHER_MS = 250;/.test(main) && /el === canvas \|\| \(el && el\.closest && !!el\.closest\('#joyZone'\)\)/.test(main) && /if \(Math\.abs\(A\.t - B\.t\) <= PINCH_TOGETHER_MS\)/.test(main));
check('while a pinch is being made the camera does not turn and she does not walk; when it opens the map the joystick is let go', /if \(pinch\) continue; \/\/ two fingers on the world/.test(main) && /if \(pinch\) return; \/\/ two fingers came down together/.test(main) && /joyTouchId = null; joyActive = false; joyVec = \{ x: 0, y: 0 \}; restJoystick\(\);/.test(main));
check('spreading two fingers on the open map puts it away, and the map says so on a phone', /if \(d > spread \* PINCH_RATIO_OUT\) \{ spread = null; close\(\); \}/.test(main) && /'spread two fingers, or tap Close, to put it away'/.test(main));
check('only on a touch screen', /\nif \(MOBILE_UI\) \{\n {2}const PINCH_TOGETHER_MS = 250;/.test(main) && /const tellShortWays = \(\) => \{\n {4}if \(!MOBILE_UI\) return;/.test(main));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
