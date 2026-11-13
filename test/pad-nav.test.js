// 🎮 A controller in a panel, and TV text (client/pad-nav.js, wired in client/main.js's pollGamepad).
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const nav = read('client/pad-nav.js'), main = read('client/main.js'), html = read('public/index.html');

check('any open panel counts, whatever it is: overlays, float panels, the ☰ sheet, the satchel', /\.overlay:not\(\.hidden\), \.floatPanel:not\(\.hidden\), #menuSheet:not\(\.hidden\), #inventoryPanel:not\(\.hidden\)/.test(nav));
check('the d-pad and a well-pushed left stick both move the highlight, with a held repeat', /b\(12\) \|\| ly < -0\.6/.test(nav) && /b\(15\) \|\| lx > 0\.6/.test(nav) && /REPEAT_FIRST = 0\.38, REPEAT_NEXT = 0\.14/.test(nav));
check('slots and tiles drawn with a pointing hand can be landed on, not only buttons', /getComputedStyle\(el\)\.cursor !== 'pointer'/.test(nav));
check('Ⓐ presses what is highlighted', /if \(justPressed\(0\) && current\) \{ current\.click\(\);/.test(nav));
check('in a panel the stick does not walk, Ⓑ goes back, Start still opens ☰', /if \(_padNav\.poll\(pad, justPressed, dt\)\) \{\n    if \(justPressed\(1\)\) window\.dispatchEvent\(new KeyboardEvent\('keydown', \{ key: 'Escape' \}\)\);\n    if \(justPressed\(9\)\)/.test(main) && main.indexOf('if (_padNav.poll(pad, justPressed, dt))') < main.indexOf('// Left stick → movement vector'));
check('TV text: on by itself the first time a controller is used on a big screen, Select + Ⓨ turns it off and on, remembered', /innerWidth >= 1280/.test(nav) && /tc_tv_mode/.test(nav) && /if \(pressed\(8\) && justPressed\(3\)\) \{ const on = _padNav\.toggleTv\(\);/.test(main) && /body\.tvMode \.overlay > \*/.test(html));
check('the highlight is drawn', /\.padFocus \{ outline: 3px solid #f2c45a/.test(html));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
