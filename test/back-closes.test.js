// The back gesture and phones (client/back-closes.js): every panel is one the
// back gesture closes (the map and the inventory too), each level's history
// entry is laid at the tap, and on a touch screen a panel whose own Close is
// out of sight gets a ✕. The browser smoke test drives the real thing.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'client/back-closes.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const sel = (src.match(/BACK_MENU_SELECTOR = '([^']+)'/) || [])[1] || '';
check('the back gesture knows every panel: overlays, float panels, the ☰ menu, every …Modal, the inventory and the shops', ['.overlay', '.floatPanel', '#menuSheet', '[id$="Modal"]', '#inventoryPanel', '#witchShopPanel'].every((s) => sel.includes(s)), sel);
const ids = [...html.matchAll(/<div id="([A-Za-z]+(?:Modal|Panel))"/g)].map((m) => m[1]);
check('…the town map and the inventory among them', ids.includes('mapModal') && ids.includes('inventoryPanel'));
check('a panel inside another counts as one level, not two', /!shown\.some\(\(o\) => o !== el && o\.contains\(el\)\)/.test(src));
check('every level is pushed at the tap (a panel from the ☰ menu is two), never after a swipe', /menus\.length \+ \(fromMenu \? 1 : 0\)/.test(src) && /for \(let d = depth \+ 1; d <= want; d\+\+\) history\.pushState/.test(src) && /settleUntil/.test(src));
check('backing out of a panel that came from the menu lands on the menu', /if \(fromMenu && now >= 1 && !backOpenMenus\(\)\.length\)/.test(src));
check('on a touch screen, a ✕ over a panel whose own Close is out of sight', /pointer:coarse/.test(src) && /backCloseInReach/.test(src) && /#backCloseFab \{ position:fixed;/.test(html) && /width:44px; height:44px/.test(html));
check('…and every panel\'s buttons, tabs and toggles at least 44px to a finger', /@media \(pointer:coarse\) \{\s*\.overlay \.btn, \.floatPanel \.btn, \[id\$="Modal"\] \.btn,/.test(html) && /\.skillBuy \{ min-height:44px; min-width:44px; \}/.test(html));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
