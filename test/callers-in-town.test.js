// Callers at the Door, standing in the town (client/callers-in-town.js): your
// working and the day's waiting callers stand beside the Town Board as KayKit
// townsfolk (Mystery Monthly Farmers and Lorekeeper, CC0), each with a walk-up
// point that opens the Board. Yours only; nothing for a guest.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

class Group { constructor() { this.children = []; this.userData = {}; this.parent = null; this.position = { set: (x, y, z) => { this.position.x = x; this.position.y = y; this.position.z = z; } }; this.rotation = {}; } add(o) { o.parent = this; this.children.push(o); } remove(o) { this.children = this.children.filter((c) => c !== o); o.parent = null; } }
const THREE = { Group };
const src = read('client/callers-in-town.js').replace(/^export default /m, '').replace(/^export /gm, '');
const mod = new Function('THREE', src + '\nreturn { createCallersInTown, callersTownBody, CALLERS_TOWN_SPOTS };')(THREE);

// Who looks like whom.
const b = (n) => mod.callersTownBody(n);
check('a man is the bearded farmer', b('Tobias Hext, from the downs').key === 'npc_farmer_a' && b('Captain Rask').key === 'npc_farmer_a');
check('a woman is the woman farmer, by name or title', ['Morag Fraser, from the Black Isle', 'Widow Garrow', 'Mrs Penhallow', 'Mistress Cole', 'Goodwife Ashby', 'Mother Furlong', 'Old Mrs Charlton, from Shields', 'Hester Bligh, dairymaid'].every((n) => b(n).key === 'npc_farmer_b'));
check('an old man is the Lorekeeper', ['Old Hobb', 'Old Jacob Venn', 'Old Duncan the herd'].every((n) => b(n).key === 'npc_lorekeeper'));
check('children stand smaller', b('Little Bridie Flynn').height < b('Morag Fraser').height && b('The Kemp children').height < 60);
const { CALLERS } = require('../data/callers.js');
check('every caller gets one of the three bodies', CALLERS.every((c) => ['npc_farmer_a', 'npc_farmer_b', 'npc_lorekeeper'].includes(b(c.caller).key)));

// Standing them up.
const scene = new Group();
const kiosks = [{ x: 1, z: 1, npc: 'board' }];
const has = new Set();
const made = [];
let ct_onload = null;
const ct = mod.createCallersInTown({
  KK: { has: (k) => has.has(k), onAssetLoad: (cb) => { ct_onload = cb; } },
  createKayKitByKey: (k) => { made.push(k); return { group: new Group(), kk: {} }; },
  createHumanoid: () => ({ group: new Group() }), kkSetState: () => {},
  getTownScene: () => scene, makeNpcNameSprite: () => { const g = new Group(); g.isLabel = true; return g; }, OUTDOOR_KIOSKS: kiosks,
});
const st = { isGuest: false, active: { id: 'dowse_well', caller: 'Tobias Hext, from the downs', icon: '🪄' }, offered: [
  { id: 'dowse_well', caller: 'Tobias Hext, from the downs' },
  { id: 'clootie', caller: 'Morag Fraser, from the Black Isle', icon: '🎀' },
  { id: 'lintel_mark', caller: 'Widow Garrow', served: true },
  { id: 'yule_wassail', caller: 'Old Jacob Venn' },
] };
ct.update(st);
const shown = ct.shown();
check('your working stands first, then the callers still waiting; one already served is gone', shown.map((s) => s.id).join() === 'dowse_well,clootie,yule_wassail');
check('they stand at the spots beside the Board', shown.every((s, i) => s.x === mod.CALLERS_TOWN_SPOTS[i].x && s.z === mod.CALLERS_TOWN_SPOTS[i].y) && mod.CALLERS_TOWN_SPOTS.every((p) => Math.hypot(p.x - 2010, p.y - 1150) < 160));
check('each one can be walked up to', kiosks.filter((k) => k.npc === 'caller').map((k) => k.callerId).join() === 'dowse_well,clootie,yule_wassail' && kiosks.some((k) => k.npc === 'board'));
check('until the bodies stream in, the plain figure stands in', shown.every((s) => !s.real) && made.length === 0);
['npc_farmer_a', 'npc_farmer_b', 'npc_lorekeeper'].forEach((k) => has.add(k));
ct_onload && ct_onload();
check('…and once they have, the KayKit townsfolk', ct.shown().every((s) => s.real) && made.sort().join() === 'npc_farmer_a,npc_farmer_b,npc_lorekeeper');
const before = scene.children.length;
ct.update(st);
check('the same callers again rebuild nothing', scene.children.length === before);
ct.update({ ...st, active: null, offered: st.offered.map((o) => ({ ...o, served: true })) });
check('when all are served, they go, and so do their walk-up points', ct.shown().length === 0 && scene.children.length === 0 && !kiosks.some((k) => k.npc === 'caller') && kiosks.length === 1);
ct.update({ isGuest: true, offered: [{ id: 'x', caller: 'Tom' }], active: null });
check('a guest has no callers in town', ct.shown().length === 0);
const many = { isGuest: false, active: null, offered: Array.from({ length: 9 }, (_, i) => ({ id: 'c' + i, caller: 'Tom ' + i })) };
ct.update(many);
check('never more than there are spots', ct.shown().length === mod.CALLERS_TOWN_SPOTS.length);

// The client wiring.
const main = read('client/main.js');
check('the three bodies are in the manifest and stream in the background', /npc_farmer_a: 'kk\/Farmer_A\.glb'/.test(main) && /npc_farmer_b: 'kk\/Farmer_B\.glb'/.test(main) && /npc_lorekeeper: 'kk\/Lorekeeper\.glb'/.test(main) && /'npc_witch', 'npc_farmer_a', 'npc_farmer_b', 'npc_lorekeeper'/.test(main) && ['Farmer_A', 'Farmer_B', 'Lorekeeper'].every((f) => fs.existsSync(path.join(root, 'public/kk', f + '.glb'))));
check('drawn from every callers_state and when the town is built', /_callersInTown\.update\(msg\)/.test(main) && /outdoorScene = scene;\n  try \{ _callersInTown\.update\(null\); \}/.test(main));
check('walking up and interacting opens the Board, with a prompt naming them', /kiosk\.npc === 'caller'\) \{ openBoardModal\(\); return; \}/.test(main) && /hear \$\{kiosk\.callerName\} out/.test(main));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
