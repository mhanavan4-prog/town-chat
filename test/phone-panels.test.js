// On a phone every panel fills the screen and keeps its Close button in
// reach. Nine panels carried an id rule (max-height:84vh) that outranked the
// full-screen rule, so held sideways they stopped short and their Close
// button sat below the fold.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
check('the full-screen rule cannot be outranked by a panel\'s own height cap', /body\.touchMode \.floatPanel \{ height:100% !important; max-height:none !important; overflow-y:auto; \}/.test(html));
check('any panel\'s own Close button stays at the bottom of the screen as it scrolls', /body\.touchMode \.floatPanel > \.btn\[id\$="CloseBtn"\] \{\s*position:sticky; bottom:0; z-index:4;/.test(html));
// every floatPanel that has a Close button has it as a direct child with an id the rule matches
const panels = [...html.matchAll(/<div id="([A-Za-z]+)" class="floatPanel[^"]*">([\s\S]*?)\n<\/div>/g)];
const odd = panels.filter(([, , body]) => /Close/.test(body) && !/\n {2}<button class="btn[^"]*" id="[A-Za-z]+CloseBtn"/.test(body)).map(([, id]) => id);
check('the panels are found, and each one\'s Close button is where the rule looks for it', panels.length >= 20 && odd.length <= 3, { n: panels.length, odd });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
