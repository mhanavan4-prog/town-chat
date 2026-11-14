// The Wilds' ground drawn as country (client/wilds-ground.js): grass, heather, earth and rock mixed by the lie of
// the land; trodden ways; grass standing round you. The old tiled floor is kept on 'low'.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const raw = read('client/wilds-ground.js'), scene = read('client/wilds-scene.js'), main = read('client/main.js');
const src = raw.replace(/export const /g, 'const ').replace(/export function /g, 'function ');
const G = new Function(src + '\nreturn { makeGroundNoise, makeGroundMask, mixAt, wander, WILDS_GRASS, grassRoom, grassSlack, WG_FRAG, WG_C, WG_S };')();

const noise = G.makeGroundNoise(null);
let lo = [1, 1, 1, 1], hi = [0, 0, 0, 0];
for (let i = 0; i < noise.px.length; i++) { const c = i % 4, v = noise.px[i] / 255; if (v < lo[c]) lo[c] = v; if (v > hi[c]) hi[c] = v; }
check('the noise is made from numbers (no canvas: Safari salts canvas pixels), four channels, each using the whole range', !/createElement|getContext/.test(raw) && noise.px.length === 256 * 256 * 4 && lo.every((v) => v === 0) && hi.every((v) => v === 1));
check('it is the same every time', G.makeGroundNoise(null).px.every((v, i) => v === noise.px[i]));
check('and it wraps, so nothing shows where it repeats', [0, 1, 2, 3].every((c) => Math.abs(noise.sample(0.0001, 0.3, c) - noise.sample(0.9999, 0.3, c)) < 0.03 && Math.abs(noise.sample(0.3, 0.0001, c) - noise.sample(0.3, 0.9999, c)) < 0.03));
check('read at four scales, none a multiple of another (so the repeats never line up)', Object.values(G.WG_S).length === 4 && Object.values(G.WG_S).every((a, i, all) => all.every((b, j) => i === j || (Math.max(a, b) / Math.min(a, b)) % 1 > 0.05)));

const W = { width: 10000, height: 10000 };
const road = [[2000, 5000], [8000, 5000]];
const mask = G.makeGroundMask(null, W, [{ pts: road, half: 15, w: 0.85 }], [{ x: 5000, y: 2000, r: 300, w: 0.5 }]);
check('a trodden way is beaten along its middle and fades out to nothing beside it', mask.at(5000, 5000) > 0.7 && mask.at(5000, 5020) < mask.at(5000, 5000) && mask.at(5000, 5080) === 0 && mask.at(5000, 7000) === 0);
check('a place people gather is trodden to its edge, less than a way', mask.at(5000, 2000) > 0.4 && mask.at(5000, 2000) < 0.6 && mask.at(5000, 2290) < 0.1 && mask.at(5000, 2400) === 0);
const wa = G.wander([[0, 0], [1000, 0], [1000, 1000]]), wb = G.wander([[0, 0], [1000, 0], [1000, 1000]]);
check('a track wanders off the ruled line between its ends, the same way every time, and still meets them', JSON.stringify(wa) === JSON.stringify(wb) && wa.length > 6 && wa[0][0] === 0 && wa[0][1] === 0 && wa[wa.length - 1][0] === 1000 && wa[wa.length - 1][1] === 1000 && wa.some(([x, y]) => x < 990 && Math.abs(y) > 5));

// what the ground is, here and there
const on = [], off = [];
for (let k = 0; k < 200; k++) { const x = 2200 + k * 28; on.push(G.mixAt(noise, mask, x, 5000, 0.6)); off.push(G.mixAt(noise, mask, x, 6200 + (k % 7) * 90, 0.6)); }
const mean = (a, f) => a.reduce((s, m) => s + f(m), 0) / a.length;
check('on a way the earth shows; off it, mostly grass', mean(on, (m) => m.earth) > 0.75 && mean(off, (m) => m.earth) < 0.3, [mean(on, (m) => m.earth), mean(off, (m) => m.earth)]);
check('the hollows are barer than the rises', mean(off.map((_, k) => G.mixAt(noise, mask, 2200 + k * 28, 7400, 0.02)), (m) => m.earth) > mean(off.map((_, k) => G.mixAt(noise, mask, 2200 + k * 28, 7400, 0.9)), (m) => m.earth) + 0.2);
const greens = off.map((m) => m.grass);
check('the grass is green, and no two stretches of it quite the same', greens.every((g) => g[1] > g[0] * 0.85 && g[1] > g[2]) && new Set(greens.map((g) => g.map((v) => v.toFixed(2)).join())).size > 60);
check('some of the country is heather', (() => { let n = 0; for (let x = 300; x < 9800; x += 190) for (let z = 300; z < 9800; z += 190) if (G.mixAt(noise, mask, x, z, 0.6).heath > 0.4) n++; return n > 40 && n < 1500; })());

check('the shader works the same sums as the grass does: the same scales and the same colours', Object.values(G.WG_S).every((s) => G.WG_FRAG.includes(`p / ${s.toFixed(1)}`)) && Object.values(G.WG_C).every((c) => G.WG_FRAG.includes(`vec3(${c.map((n) => n.toFixed(3)).join(', ')})`)));
check('four kinds of ground: grass, heather, earth, and rock where it is steep', /wHeath/.test(G.WG_FRAG) && /wEarth/.test(G.WG_FRAG) && /wRock = smoothstep\([\d.]+, [\d.]+, vGS/.test(G.WG_FRAG));
check('the scene\'s own lights, fog and shadows are kept: only the colour is replaced', /new THREE\.MeshLambertMaterial\(\{ color: old\.color\.clone\(\)/.test(raw) && /replace\('#include <map_fragment>', 'diffuseColor\.rgb \*= wildsGround\(\);'\)/.test(raw));
check('so the season still dyes it, and the grass with it', /ground\.name = 'wildsGround'/.test(scene) && /wildsGrass\.update\(x, z, t, m \? m\.color : null, m \? m\.emissive : null\)/.test(scene) && /mat\.color\.copy\(tint\)/.test(raw));

const rooms = (q) => G.WILDS_GRASS[q].map(G.grassRoom), sum = (a) => a.reduce((x, y) => x + y, 0);
check('grass: full on high, thin on medium, none on low', sum(rooms('high')) > sum(rooms('medium')) * 2 && G.WILDS_GRASS.high[0].gap < G.WILDS_GRASS.medium[0].gap && !G.WILDS_GRASS.low && /if \(!RINGS\.length\) return null;/.test(raw));
check('it is laid in three rings, each sparser and bigger than the one inside it, out to where the fog takes the ground', ['high', 'medium'].every((q) => { const r = G.WILDS_GRASS[q]; return r.length === 3 && r[0].from === 0 && r.every((x, i) => !i || (x.gap >= r[i - 1].gap * 1.8 && x.size > r[i - 1].size && x.to > r[i - 1].to)); }) && G.WILDS_GRASS.high[2].to >= 1400 && G.WILDS_GRASS.medium[2].to >= 900);
check('each ring comes up exactly where the one inside it thins, so there is no bare band and no doubled one', ['high', 'medium'].every((q) => { const r = G.WILDS_GRASS[q]; return r.every((x, i) => !i || (x.full === r[i - 1].to && Math.abs(x.from - r[i - 1].to * (i === 1 ? 0.6 : 0.78)) < r[i - 1].to * 0.04)); }));
check('the whole of it stays within what was promised: about three times the first grass, not seventeen', sum(rooms('high')) < 12500 && sum(rooms('medium')) < 4200 && sum(rooms('high')) * 7 < 90000, [sum(rooms('high')), sum(rooms('medium'))]);
check('a ring has room for every cell it can touch, so it is never cut short on one side', ['high', 'medium'].every((q) => G.WILDS_GRASS[q].every((r) => { const out = r.to + G.grassSlack(r) + r.gap, inn = Math.max(0, r.from - G.grassSlack(r) - r.gap); let n = 0; const K = Math.ceil(out / r.gap); for (let j = -K; j <= K; j++) for (let i = -K; i <= K; i++) { const d2 = (i * i + j * j) * r.gap * r.gap; if (d2 <= out * out && d2 >= inn * inn) n++; } return n <= G.grassRoom(r); })));
check('which ring a tuft belongs to is written once, and a ring is laid again only when you have walked its own slack', /geo\.setAttribute\('aRing', new THREE\.InstancedBufferAttribute\(ringOf, 3\)\)/.test(raw) && /for \(const st of state\) if \(Math\.hypot\(x - st\.fx, z - st\.fz\) > slackOf\(st\.r\)\) fill\(st, x, z\);/.test(raw));
check('on low the old floor is left exactly as it was', /!\(GFX && GFX\.st && GFX\.st\.quality === 'low'\)/.test(scene) && /if \(!richGround\) ribbon\(P, w2\.drove\.width \/ 2/.test(scene) && /makeWildsFloorTexture\(\)/.test(scene));
check('if anything goes wrong making it, the old floor is kept', /catch \(e\) \{ console\.error\('wilds ground: kept the old floor', e\); richGround = null; wildsGrass = null; \}/.test(scene));
check('one draw call for all the grass, and what grows in a cell is worked out once', /new THREE\.InstancedMesh\(geo, mat, TOTAL\)/.test(raw) && /cells: new Map\(\)/.test(raw) && /if \(c !== undefined\) return c;/.test(raw));
check('it moves in the wind, parts where you walk, thins toward the edge of what is drawn', /gWind/.test(raw) && /gNear/.test(raw) && /smoothstep\(aRing\.z \* 0\.78, aRing\.z, gD\)/.test(raw));
check('nothing grows on a glyph, a track, or the drove road', /glyphSpots\.push\(\{ x: gx, y: gz, r: size \* 0\.66, w: 0\.9 \}\)/.test(scene) && /\.\.\.glyphSpots,/.test(scene) && /ways\.push\(\{ pts: P, half: w2\.drove\.width \* 0\.36, w: 0\.3 \}\)/.test(scene) && /\(1 - wgSS\(0\.12, 0\.45, m\.trod\)\)/.test(raw));
check('the grass is moved each frame only while the Wilds are shown', /if \(activeScene === wildsScene && me\) updateWildsGround\(me\.x, me\.y, performance\.now\(\) \* 0\.001\);/.test(main));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
