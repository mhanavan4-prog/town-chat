// On a phone the inventory fills the screen. The shared dim behind every open panel (#menuScrim, z 59, blurred)
// must be BEHIND it: with the panel left at its base z (19) the whole inventory was dimmed and blurred.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
const rule = (sel) => { const i = html.indexOf(sel + ' {'); return i < 0 ? '' : html.slice(i, html.indexOf('}', i)); };
const z = (css) => { const m = /z-index:\s*(\d+)/.exec(css); return m ? +m[1] : null; };
const scrim = z(rule('  #menuScrim'));
check('the dim behind open panels is shown whenever the inventory is open', /body:has\(#inventoryPanel:not\(\.hidden\)\) #menuScrim \{ display:block; \}/.test(html));
check('on a phone the inventory sits above that dim', z(rule('  body.touchMode #inventoryPanel')) > scrim, [z(rule('  body.touchMode #inventoryPanel')), scrim]);
check('as it does on a desktop', /body:not\(\.touchMode\) #inventoryPanel \{[^}]*z-index:60 !important/.test(html));
check('and so does every other panel', z(rule('  .floatPanel')) > scrim);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
