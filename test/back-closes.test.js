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
check('backing out of a panel that came from the menu lands on the menu', /if \(fromMenu && now >= 1 && sheet && sheet\.classList\.contains\('hidden'\)\)/.test(src));
check('back closes the newest panel only, by its own close button where it has one', /let order = \[\]/.test(src) && /const btn = backCloseButton\(top\);/.test(src));
check('on a touch screen, a ✕ over a panel whose own Close is out of sight', /pointer:coarse/.test(src) && /backCloseInReach/.test(src) && /#backCloseFab \{ position:fixed;/.test(html) && /width:44px; height:44px/.test(html));
check('…and every panel\'s buttons, tabs and toggles at least 44px to a finger', /@media \(pointer:coarse\) \{\s*\.overlay \.btn, \.floatPanel \.btn, \[id\$="Modal"\] \.btn,/.test(html) && /\.skillBuy \{ min-height:44px; min-width:44px; \}/.test(html));
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
check('on a phone the chat sheet (and the Log in it) closes on the back gesture too; on a desktop the chat is not a panel', sel.includes('#chatPanel') && /BACK_TOUCH_ONLY = new Set\(\['chatPanel'\]\)/.test(src) && /BACK_TOUCH_ONLY\.has\(el\.id\) && !document\.body\.classList\.contains\('touchMode'\)/.test(src) && /chatPanel: \(\) => toggleMobileChat\(false\)/.test(main));
check('…as do the menu on a player and the spy glass', sel.includes('#playerContextMenu') && sel.includes('#spyGlassPanel') && /if \(backClosers\[top\.id\]\) \{ backClosers\[top\.id\]\(\); return; \}/.test(src));
check('a struck creature flashes alone: it takes its own copy of the shared material, and keeps its own glow after', /if \(!child\.userData\.ownMaterial\) \{ child\.material = child\.material\.clone\(\); child\.userData\.ownMaterial = true; \}/.test(main) && /child\.material\.emissive\.setHex\(child\.userData\.restEmissive\)/.test(main));
check('a card never stands taller than the screen: a long text scrolls inside it', /:where\(\.overlay\) > \.card \{\s+max-height:calc\(100vh - 20px\); max-height:calc\(100dvh - 20px\);\s+overflow-y:auto; overscroll-behavior:contain;/.test(html));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
