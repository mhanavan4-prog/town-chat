// The menu opens up as you rise (client/menu-gates.js): a short menu at level 1, the rest in bands.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('public/index.html'), main = read('client/main.js');
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
const src = read('client/menu-gates.js').replace(/export const /g, 'const ').replace(/export function /g, 'function ');
const G = new Function('localStorage', src + '\nreturn { MENU_GATES, menuGateLevel, applyMenuGates, openMenuEarly, menuPointedAt };')(global.localStorage);
// a stand-in for the page: every menu row in index.html
const rows = {};
for (const m of html.matchAll(/<(?:button|a) class="menuRow[^"]*" id="(menu[A-Za-z]+)"[^>]*>([^<]*)/g)) {
  const cls = new Set();
  rows[m[1]] = { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) }, childNodes: [{ nodeType: 3, textContent: m[2] }], textContent: m[2] };
}
const doc = { getElementById: (id) => rows[id] || null };
const gated = Object.values(G.MENU_GATES).flat();
check('every gated entry is a real row of the menu, and none is listed twice', gated.every((id) => rows[id]) && new Set(gated).size === gated.length, gated.filter((id) => !rows[id]));
check('the bands are levels 2, 4, 7, 10 and 13', Object.keys(G.MENU_GATES).join() === '2,4,7,10,13');
const always = ['menuMap', 'menuOnline', 'menuInventory', 'menuSkills', 'menuKit', 'menuJournal', 'menuSettings', 'menuControls', 'menuMoonstones', 'menuPass', 'menuInvite', 'menuNotifs', 'menuBug', 'menuLogout'];
check('what a new arrival needs, and the shop and the ways out, are never gated', always.every((id) => rows[id] && G.menuGateLevel(id) === 1), always.filter((id) => !rows[id]));
G.applyMenuGates(1, doc);
const shown = (id) => !rows[id].classList.contains('lvlLocked');
check('at level 1 every gated entry is off the menu, and the rest are on it', gated.every((id) => !shown(id)) && always.every(shown));
const fresh = G.applyMenuGates(2, doc);
check('reaching a band opens it, and says what is new', G.MENU_GATES[2].every(shown) && !shown('menuGarden') && fresh.length === 6 && fresh.some((t) => /Wardrobe/.test(t)));
G.applyMenuGates(13, doc);
check('at 13 the whole menu is open', gated.every(shown));
G.applyMenuGates(1, doc);
G.menuPointedAt('📖 Written in your daybook: the by-ways, walked.', doc);
check('a notice that names an entry opens it early, and it stays open', shown('menuDaybook') && (G.applyMenuGates(1, doc), shown('menuDaybook')) && JSON.parse(store.tc_menu_early).includes('menuDaybook'));
check('the level-up notice itself opens nothing', (G.menuPointedAt('☰ New in your menu: 🕸️ Coven.', doc), G.applyMenuGates(1, doc), !shown('menuCoven')));
check('the client applies the gates on joining, on levelling and each time the menu opens, and the row style hides a locked row', /applyMenuGates\(msg\.level\);/.test(main) && /const fresh = applyMenuGates\(msg\.level\);/.test(main) && (main.match(/applyMenuGates\(\(me && me\.level\) \|\| 1\)/g) || []).length === 3 && /\.menuRow\.lvlLocked \{ display:none; \}/.test(html) && /menuPointedAt\(text\);/.test(main));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
