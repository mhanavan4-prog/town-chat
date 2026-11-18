// What lies and grows on the Wilds' ground besides the grass (client/wilds-ground.js): stones where it is rock or
// bare, heather on the heath, tussocks in the wet hollows. None on the ways people walk, none in a cut sign, none on 'low'.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const raw = read('client/wilds-ground.js'), scene = read('client/wilds-scene.js'), main = read('client/main.js');
const src = raw.replace(/export const /g, 'const ').replace(/export function /g, 'function ');
const G = new Function(src + '\nreturn { makeGroundNoise, makeGroundMask, mixAt, SCATTER_KINDS, WILDS_SCATTER, scatterRoom, WG_C };')();

// how often a kind stands on ground like this, over many cells
const grass = G.WG_C.gMid;
const ground = (o) => ({ earth: 0, heath: 0, trod: 0, rock: 0, grass, ...o });
function rate(kind, m, h = 0.5, n = 4000) {
  let k = 0, sizes = [];
  for (let i = 0; i < n; i++) {
    const q = (j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
    const c = G.SCATTER_KINDS[kind](0, 10, 0, m, h, q);
    if (c) { k++; sizes.push(c[4]); if (c.length !== 9 || c.some((v) => !Number.isFinite(v))) return { bad: c }; }
  }
  return { r: k / n, mean: sizes.reduce((a, b) => a + b, 0) / (sizes.length || 1) };
}
const stoneRock = rate('stone', ground({ rock: 1 })), stoneGrass = rate('stone', ground({})), stoneBare = rate('stone', ground({ earth: 1 })), stoneWay = rate('stone', ground({ earth: 1, trod: 0.9 }));
check('stones lie thick where it is rock, fewer on bare earth, now and then one in the grass', stoneRock.r > 0.7 && stoneBare.r > 0.1 && stoneBare.r < 0.35 && stoneGrass.r > 0.005 && stoneGrass.r < 0.06, { stoneRock, stoneBare, stoneGrass });
check('the rock\'s stones are the big ones', stoneRock.mean > stoneGrass.mean * 1.8, { stoneRock, stoneGrass });
check('no stones on a trodden way', stoneWay.r === 0, stoneWay);
const heath = rate('heather', ground({ heath: 0.8 })), noHeath = rate('heather', ground({})), heathWay = rate('heather', ground({ heath: 0.8, trod: 0.6 }));
check('heather grows on the heath and nowhere else', heath.r > 0.5 && noHeath.r === 0 && heathWay.r === 0, { heath, noHeath, heathWay });
const wet = rate('tussock', ground({}), 0.05), dry = rate('tussock', ground({}), 0.9), onEarth = rate('tussock', ground({ earth: 1 }), 0.05);
check('tussocks stand thick in the hollows and seldom on the rises', wet.r > 0.4 && dry.r > 0 && dry.r < 0.06, { wet, dry });
check('and not on bare earth', onEarth.r < wet.r * 0.25, { onEarth, wet });

check('"low" has none of it; medium less, and not as far, as high', !G.WILDS_SCATTER.low && ['stone', 'heather', 'tussock'].every((k) => G.WILDS_SCATTER.medium[k].gap > G.WILDS_SCATTER.high[k].gap && G.WILDS_SCATTER.medium[k].to < G.WILDS_SCATTER.high[k].to));
check('each kind has room for every cell its ring can hold', ['stone', 'heather', 'tussock'].every((k) => { const r = G.WILDS_SCATTER.high[k], R = r.to + r.gap * 3; return G.scatterRoom(r) > Math.PI * (R + r.gap) * (R + r.gap) / (r.gap * r.gap); }));

// rock: the same sum as the shader's, from the slope
const noise = G.makeGroundNoise(null), mask = G.makeGroundMask(null, { width: 4000, height: 4000 }, [], []);
check('the ground knows where it is rock: steep is, flat is not, and without a slope there is none', G.mixAt(noise, mask, 900, 900, 0.5, 0.2).rock > 0.9 && G.mixAt(noise, mask, 900, 900, 0.5, 0.0).rock === 0 && G.mixAt(noise, mask, 900, 900, 0.5).rock === 0);
check('the shader reads rock from the same numbers', /float wRock = smoothstep\(0\.036, 0\.062, vGS \+ \(nC\.r - 0\.5\) \* 0\.022\) \* \(1\.0 - smoothstep\(0\.5, 0\.9, trod\)\);/.test(raw) && /wgSS\(0\.036, 0\.062, slope \+ \(Cn\(0\) - 0\.5\) \* 0\.022\) \* \(1 - wgSS\(0\.5, 0\.9, trod\)\)/.test(raw));

check('made from numbers, no canvas', !/createElement|getContext|CanvasTexture/.test(raw));
check('one draw a kind, only as many as stand (so a hidden one is never left lying at the origin)', /K\.mesh\.count = n;/.test(raw) && /mesh\.count = 0; mesh\.name = 'wildsScatter_' \+ name;/.test(raw));
check('they come up out of the ground at the ring\'s edge rather than appearing', /float sShow = 1\.0 - smoothstep\(uTo \* 0\.8, uTo, distance\(sO\.xz, uC\)\);/.test(raw));
check('the season dyes what grows, not the stones', /if \(tint && K\.name !== 'stone'\) K\.mat\.color\.copy\(tint\);/.test(raw));
check('the scene lays them on the drawn ground, kept out of the cut signs, and updates them with the grass',
  /createWildsScatter\(THREE, scene, \{ \.\.\.richGround, heightAt: wildsHeightAt, groundAt, blocked: \(x, z\) => turfCut\.blocked\(x, z\),/.test(scene)
  && /if \(wildsScatter\) wildsScatter\.update\(x, z, t, /.test(scene) && /catch \(e\) \{ console\.error\('wilds scatter: none', e\); wildsScatter = null; \}/.test(scene));
check('the tours can count them and find them', /scatter\(kind\) \{ const m = players\[myId\]; return wildsScatterCounts\(kind, m && m\.x, m && m\.y\); \}/.test(main));
check('the lore it leans on is named as the record, and where it grows as the game\'s', /Ling \(Calluna vulgaris\)/.test(raw) && /Where it grows here is the game's/.test(raw));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
