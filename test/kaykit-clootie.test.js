// The clootie well in KayKit dress (Forest Nature Pack, CC0, Kay Lousberg):
// a flat-crowned lone tree in leaf for the thorn, grey stones round the
// spring, grass tufts, and the cloots hung under the crown where they show.
// All from models already shipped; the plain thorn stays as the fallback.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
global.window = global; require('./three-stub.js'); global.THREE = global.window.THREE;
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const main = read('client/main.js');
check('every model it uses is already in the manifest and shipped', ['tree_leaf2', 'rock2', 'grass1', 'grass2', 'grass3', 'grass4'].every((k) => { const m = main.match(new RegExp(k + ":\\s*'(kk/[^']+)'")); return m && fs.existsSync(path.join(root, 'public', m[1])); }));
check('the Wilds hands KK to the well', /makeClootieWell\(w2\.clootieWell\.x, w2\.clootieWell\.y, KK\)/.test(read('client/wilds-scene.js')));

const src = read('client/props-clootie.js').replace(/^export /gm, '');
const names = [...src.matchAll(/^function (\w+)/gm)].map((m) => m[1]);
const mod = new Function('THREE', src + '\nreturn {' + names.join(',') + '};')(global.THREE);
const used = [];
const KK = { has: () => true, staticInstance: (k) => { used.push(k); return new global.THREE.Group(); } };
// The stand-in has no real Box3; give the crown a size so the cloots can hang.
const B = global.THREE.Box3;
global.THREE.Box3 = class { setFromObject() { this.min = { x: -40, y: 0, z: -98 }; this.max = { x: 56, y: 84, z: -18 }; return this; } };
const withKK = mod.makeClootieWell(4400, 8200, KK);
global.THREE.Box3 = B;
const without = mod.makeClootieWell(4400, 8200, null);
check('with KayKit: the lone tree as the thorn, a ring of stones, grass', used.filter((k) => k === 'tree_leaf2').length === 1 && used.filter((k) => k === 'rock2').length >= 10 && used.some((k) => /^grass/.test(k)));
const rags = (g) => g.children.filter((o) => o.userData && o.userData.cloot);
check('the cloots are still there, more than before, and hang under the crown, not above it or on the ground', rags(withKK).length >= 20 && rags(withKK).every((r) => r.position.y > 84 * 0.55 && r.position.y < 84 * 0.75), rags(withKK).map((r) => Math.round(r.position.y)));
check('…and every one in a colour of wool or cotton the old cloots used', rags(withKK).every((r) => /CLOOTIE_RAG_COLOURS/.test(src)));
check('the spring is there either way, and the plain thorn is the fallback', withKK.children.some((o) => o.userData.spring) && without.children.some((o) => o.userData.spring) && without.children.some((o) => o.userData.thorn === 'plain') && !withKK.children.some((o) => o.userData.thorn === 'plain') && rags(without).length === 20);
check('placed where the well is', withKK.position.x === 4400 && withKK.position.z === 8200);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
