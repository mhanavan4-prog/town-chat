// Models rebuilt in the KayKit idiom (tools/models/build_home.py "The KayKit idiom"): few chunky
// blocks in the KayKit palette, with the wide chamfer put on in Blender on export (trlib.py finish).
// This list grows as the rebuild goes; a model on it must keep to the idiom and to the size budget.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'tools/models/build_home.py'), 'utf8'), lib = fs.readFileSync(path.join(root, 'tools/models/trlib.py'), 'utf8');
const REBUILT = ['milestone', 'march_gate', 'hall_table', 'hall_bench', 'fingerpost', 'field_barrow', 'ring_stone', 'needfire',
  'ash_cross', 'frith_cross', 'ash_barricade', 'field_standard', 'field_trench', 'field_bottle', 'field_bell', 'rowan_post',
  'gibbet', 'cointree', 'coffinstone', 'boundstone', 'scots_pine', 'door_props'];
// The ruined houses and the field chapel are all one builder (_ruin_house), checked by its own name.
const RUINS = ['ash_house_a', 'ash_house_b', 'ash_house_c', 'field_chapel'];
const body = (n) => { const i = home.search(new RegExp(`\\ndef ${n}\\(`)); return home.slice(i, home.indexOf('\n    return m, None', i)); };
check('each rebuilt model names its own chamfer and is built of blocks in the KayKit palette', REBUILT.every((n) => /m\.bevel = 0\.0\d+/.test(body(n)) && /KK_(STONE|WOOD)/.test(body(n)) && /blk\(|box\(/.test(body(n))), REBUILT.filter((n) => !/m\.bevel = /.test(body(n))));
check('the chamfer is put on in Blender on export: weld, a two-segment bevel, weighted normals', /ob\.modifiers\.new\('weld', 'WELD'\)/.test(lib) && /ob\.modifiers\.new\('bevel', 'BEVEL'\)/.test(lib) && /bev\.segments = 2 if bevel else 1/.test(lib) && /ob\.modifiers\.new\('weighted', 'WEIGHTED_NORMAL'\)/.test(lib));
check('only for a model that asks for it (the kits\' size budgets stand)', /if FINISH and glow is False and self\.bevel:/.test(lib));
check('the ruins of Ashminster and the field chapel are built by the one builder, in the idiom', /m\.bevel = 0\.0\d+/.test(body('_ruin_house')) && /_kk_wall\(/.test(body('_ruin_house')) && /KK_STONE/.test(body('_kk_wall')) && RUINS.every((n) => new RegExp(`_ruin_house\\(\\d+, [\\d.]+, [\\d.]+, '${n}'\\)`).test(home)));
const sizes = [...REBUILT, ...RUINS].map((n) => [n, fs.statSync(path.join(root, 'public/kk/home', n + '.glb')).size]);
check('each rebuilt model is still small enough to stream (under 100 KB)', sizes.every(([, s]) => s < 100000), sizes.filter(([, s]) => s >= 100000));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
