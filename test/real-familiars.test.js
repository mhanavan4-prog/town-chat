// The familiars are the real animals: a cat, a toad, a hare, a country dog and
// a polecat made for the purpose, and the Wilds' crow, bat and rabbit for the
// raven, the bat and the black rabbit. A bonded coat tints the body only.
global.THREE = require('../public/three.min.js');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const fam = fs.readFileSync(path.join(root, 'client/familiars.js'), 'utf8');
const { FAMILIARS } = require('../data/familiars.js');
const glb = (k) => { const b = fs.readFileSync(path.join(root, 'public/kk/critters', k + '.glb')); return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString('utf8')); };
const block = fam.slice(fam.indexOf('const FAMILIAR_MODELS = {'), fam.indexOf('};', fam.indexOf('const FAMILIAR_MODELS = {')));
const models = Object.fromEntries([...block.matchAll(/(\w+): \['(\w+)', '(\w+)', (\d+), '(height|fit)', (0x[0-9a-f]+|null)\]/g)].map((m) => [m[1], m[2]]));
check('every familiar in the catalogue has a real model', Object.keys(FAMILIARS).every((k) => models[k]) && Object.keys(models).length === Object.keys(FAMILIARS).length, [Object.keys(FAMILIARS), models]);
check('each model is in the manifest and on disk', Object.values(models).every((m) => main.includes('cr_' + m + ": 'kk/critters/" + m + ".glb'") && fs.existsSync(path.join(root, 'public/kk/critters', m + '.glb'))));
const made = ['cat', 'toad', 'hare', 'hound', 'polecat'];
const mats = (k) => new Set(glb(k).materials.map((m) => m.name));
check('the five made as familiars have a body to tint and trim that keeps its colour (eyes, nose, mask)', made.every((k) => mats(k).has('Plant') && (mats(k).has('Trim') || mats(k).has('Glow'))), made.map((k) => [...mats(k)]));
check('…and joints to walk on', made.every((k) => { const n = glb(k).nodes.map((x) => x.name); return ['head', 'leg_FL', 'leg_FR', 'leg_BL', 'leg_BR'].every((j) => n.includes(j)); }));
check("a coat tints only the body material, to the bonded coat or the animal's natural colour", /const tint = coat != null \? coat : spec\[4\];/.test(fam) && /o\.material\.name === 'Plant'\) \{ o\.material = o\.material\.clone\(\); o\.material\.color\.setHex\(tint\); \}/.test(fam));
check('the hand-built one stands in until the model lands, and is rebuilt then', /const group = real \|\| BUILDERS\[p\.familiar\]\(coat\);/.test(fam) && /if \(r && r\.standIn && hasKK && FAMILIAR_MODELS\[r\.type\] && hasKK\('cr_' \+ FAMILIAR_MODELS\[r\.type\]\[0\]\)\) \{ removeRec\(id\); r = null; \}/.test(fam));
check('they walk, fly or hop on their own limbs', /critterRigPose\(r\.rig, r\.phase, flyer \? 2 :/.test(fam));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
