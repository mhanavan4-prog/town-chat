// The Wilds' camp fires and waymarker stones, and the decorations a witch sets
// on her altar in the manor, are modelled (tools/models/build_home.py), with
// the same flames, smoke and glows; the hand-built ones stand in until loaded.
const THREE = global.THREE = require('../public/three.min.js');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const deco = fs.readFileSync(path.join(root, 'client/altar-decor.js'), 'utf8');
const files = { wl_campfire: 'campfire', wl_waymarker: 'waymarker', alt_chalice: 'chalice', alt_bell: 'hand_bell', alt_runes: 'rune_stones', alt_mirror: 'scrying_mirror', alt_pentacle: 'pentacle_plaque', alt_crystals: 'crystal_cluster', alt_grimoire: 'open_grimoire' };
check('the nine models are in the manifest, streamed, and on disk', Object.entries(files).every(([k, f]) => main.includes(k + ": 'kk/home/" + f + ".glb'") && fs.existsSync(path.join(root, 'public/kk/home', f + '.glb'))) && /\(pl\|cr\|gv\|gd\|fl\|cave\|wl\|alt\|tw\)_/.test(main));
check('the camp fire is the modelled one, still burning, glowing and lighting the ground; the hand-built one stands in', /KK\.staticInstance\('wl_campfire', 54, 'fit'\)/.test(main) && /const li = new THREE\.PointLight\(0xff9d3c, 0\.85, 300\); li\.position\.y = 26; fire\.add\(li\);/.test(main) && /new THREE\.DodecahedronGeometry\(5 \+ \(i % 2\), 0\)/.test(main));
check('the waymarker is the modelled stone, the hand-built one standing in', /KK\.staticInstance\('wl_waymarker', 84, 'height'\)/.test(main) && /new THREE\.CylinderGeometry\(7, 12, 74, 7\)/.test(main));
// The altar decorations, run for real against a stand-in model-maker.
const src = deco.replace(/^export /gm, '').replace(/^import .*$/gm, '');
const api = new Function('document', src + '\nreturn { ALTAR_DECO_IDS, buildDecoration, setAltarDecoModels };')({ createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }), width: 0, height: 0 }) });
const hand = Object.fromEntries(api.ALTAR_DECO_IDS.map((id) => [id, !!api.buildDecoration(id)]));
check('with no models every decoration is still built by hand', Object.values(hand).every(Boolean), hand);
const asked = [];
api.setAltarDecoModels((key) => { asked.push(key); const g = new THREE.Group(); g.userData.model = key; return g; });
const real = api.ALTAR_DECO_IDS.map((id) => { const g = api.buildDecoration(id); let found = false; if (g) g.traverse((o) => { if (o.userData.model) found = true; }); return [id, found]; });
check('with models every one of the twelve is the modelled thing', real.every(([, f]) => f) && real.length === 12, real.filter(([, f]) => !f));
check('…the skull and cauldron are KayKit\'s, the raven the Wilds\' crow', ['prop_skull', 'wprop_cauldron', 'cr_gravewing_crow', 'alt_candle', 'alt_censer'].every((k) => asked.includes(k)), asked);
api.setAltarDecoModels(() => null);
check('a model that has not loaded falls back to the hand-built one', api.ALTAR_DECO_IDS.every((id) => !!api.buildDecoration(id)));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
