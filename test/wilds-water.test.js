// Water in the Wilds (client/wilds-water.js): the well's rill and its pool, the beck, its ford and its mere. They are
// cut into the ground everything stands on, they only ever run downhill, and they stand clear of what was already there.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const raw = read('client/wilds-water.js'), scene = read('client/wilds-scene.js'), main = read('client/main.js');
const src = raw.replace(/export const /g, 'const ').replace(/export function /g, 'function ');
const W = new Function(src + '\nreturn { WILDS_WATERS, beckLine, makeBeck, makeWaters, refineGround, wildsWaters, resetWildsWaters };')();

// the moor as main.js makes it (the same noise), level round the well and the arrival clearing
const vn = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }, sm = (t) => t * t * (3 - 2 * t);
const lat = (fx, fy) => { const xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi, u = sm(xf), v = sm(yf), a = vn(xi, yi), b = vn(xi + 1, yi), c = vn(xi, yi + 1), d = vn(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const ZONES = [[5000, 8800, 440], [5170, 8820, 210], [2900, 8300, 300]];
const moor = (x, z) => { let f = 1; for (const [cx, cy, r] of ZONES) { const d = Math.hypot(x - cx, z - cy); if (d < r) f = Math.min(f, sm(d / r)); } const n = x * 0.00042, m = z * 0.00042; return ((lat(n * 3 + 11, m * 3 + 11) - 0.5) + (lat(n * 7 + 40, m * 7 + 40) - 0.5) * 0.4 + (lat(n * 15, m * 15) - 0.5) * 0.15) * 90 * f; };
check('the test moor is the game\'s own (same noise, same height)', /lattice\(n \* 3 \+ 11, m \* 3 \+ 11\) - 0\.5\) \* 1\.0/.test(main) && /lattice\(n \* 7 \+ 40, m \* 7 \+ 40\) - 0\.5\) \* 0\.4/.test(main) && /const WILDS_AMP = 90;/.test(main) && /const n = x \* 0\.00042/.test(main));

const waters = W.makeWaters(moor), [rill, beck] = waters.each;
check('two waters: the well\'s rill and the beck', W.WILDS_WATERS.length === 2 && rill.B.name === 'rill' && beck.B.name === 'beck');
check('the rill rises at the clootie well', rill.sx[0] === 2900 && rill.sz[0] === 8300 && /clootieWell.*r: 300/.test(main));
for (const b of waters.each) {
  let up = 0, above = 0, maxCut = 0;
  for (let i = 1; i < b.n; i++) { if (b.sbed[i] > b.sbed[i - 1] + 1e-6) up++; if (b.sbed[i] > b.sraw[i] + 1e-6) above++; maxCut = Math.max(maxCut, b.sraw[i] - b.sbed[i]); }
  check(`${b.B.name}: the bed never runs uphill`, up === 0, up);
  check(`${b.B.name}: and never stands above the ground it crosses`, above === 0, above);
  check(`${b.B.name}: where a rise is in its way it cuts a dale, not a gorge (under 40 deep; a player stands 68)`, maxCut < 40, maxCut);
  const M = b.B.mere; let rim = Infinity;
  for (let k = 0; k < 64; k++) for (const f of [1, 1.3]) rim = Math.min(rim, moor(M.x + Math.cos(k / 64 * 6.2832) * M.r * f, M.y + Math.sin(k / 64 * 6.2832) * M.r * f));
  check(`${b.B.name}: its pool stands below the lowest ground round it (it cannot spill)`, b.level + b.B.water < rim, [b.level + b.B.water, rim]);
  check(`${b.B.name}: the course ends in the pool`, Math.hypot(b.sx[b.n - 1] - M.x, b.sz[b.n - 1] - M.y) < 1 && b.inMere[b.n - 1] === 1);
  let raised = 0, deepest = 0;
  for (let i = 0; i < b.n; i += 2) for (const off of [-90, -40, -15, 0, 15, 40, 90]) { const x = b.sx[i] + off, z = b.sz[i] + off * 0.6, h = moor(x, z), c = waters.carve(x, z, h); if (c > h + 1e-6) raised++; const s = waters.surfaceAt(x, z); if (s !== null) deepest = Math.max(deepest, s - c); }
  check(`${b.B.name}: carving only ever lowers the ground`, raised === 0, raised);
  check(`${b.B.name}: it is shallow everywhere (never over 20; you wade, you do not swim)`, deepest > 2 && deepest < 20, deepest);
}
check('far from any water the ground is untouched and there is no surface', waters.carve(8000, 3000, 12.5) === 12.5 && waters.surfaceAt(8000, 3000) === null && !waters.near(8000, 3000, 100));
check('in the beck the ground is lower and there is water over it', (() => { const i = 30, x = beck.sx[i], z = beck.sz[i], h = moor(x, z), c = waters.carve(x, z, h), s = waters.surfaceAt(x, z); return c < h - 5 && s > c + 3 && s < h; })());
check('the ford is where the track up from the portal crosses, and the beck runs through it', (() => { const f = beck.B.ford, nr = beck.nearest(f.x, f.y); return nr && nr.d < 12 && /way\(\[\[sp\.x, sp\.y - 120\], \[5060, 7300\]/.test(scene) && Math.abs(f.x - 5040) < 40; })());
check('no water lies in the arrival clearing or by the return portal', waters.each.every((b) => { for (let i = 0; i < b.n; i++) { if (Math.hypot(b.sx[i] - 5000, b.sz[i] - 8800) < 440 + b.B.half) return false; if (Math.hypot(b.sx[i] - 5170, b.sz[i] - 8820) < 210 + b.B.half) return false; } return true; }));
check('a glyph that lands in the water is moved out of it', (() => { const [x, z] = waters.pushOff(beck.sx[40] + 5, beck.sz[40], 60); const [mx, mz] = waters.pushOff(beck.B.mere.x + 20, beck.B.mere.y, 60); return !waters.near(x, z, 55) && !waters.near(mx, mz, 55) && String(waters.pushOff(8000, 3000, 60)) === '8000,3000'; })());
check('it is the same every time', (() => { const again = W.makeWaters(moor).each[1]; return again.n === beck.n && again.sbed.every((v, i) => v === beck.sbed[i]); })());

// the fine cells: a 4x4 plane, the middle of it wet
function plane(segs, size) {
  const V = segs + 1, pos = [], uv = [], nrm = [], idx = [];
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) { pos.push(i / segs * size - size / 2, 0, j / segs * size - size / 2); uv.push(i / segs, 1 - j / segs); nrm.push(0, 1, 0); }
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) { const a = i + V * j, b = i + V * (j + 1), c = (i + 1) + V * (j + 1), d = (i + 1) + V * j; idx.push(a, b, d, b, c, d); }
  const attr = (arr, n) => ({ array: Float32Array.from(arr), count: arr.length / n, getX(i) { return this.array[i * n]; }, getY(i) { return this.array[i * n + 1]; }, getZ(i) { return this.array[i * n + 2]; }, needsUpdate: false });
  const geo = { attributes: { position: attr(pos, 3), uv: attr(uv, 2), normal: attr(nrm, 3) }, index: { array: idx },
    setAttribute(k, a) { this.attributes[k] = a; }, setIndex(i) { this.index = { array: i }; }, computeVertexNormals() { const n = new Float32Array(this.attributes.position.count * 3); for (let i = 1; i < n.length; i += 3) n[i] = 0.5; this.attributes.normal = attr(n, 3); } };
  return geo;
}
const T3 = { BufferAttribute: function (array, n) { return { array, count: array.length / n, getX(i) { return array[i * n]; }, getY(i) { return array[i * n + 1]; }, getZ(i) { return array[i * n + 2]; } }; } };
const geo = plane(4, 400), dip = (x, z) => -Math.max(0, 60 - Math.hypot(x, z));
const fineCells = W.refineGround(T3, geo, 4, dip, (x, z, pad) => Math.hypot(x, z) < 80 + pad * 0, 6);
check('only the cells the water touches are made fine', fineCells === 4, fineCells);
check('they are six to a side, and the coarse cells that are left keep their two triangles', geo.attributes.position.count === 25 + 4 * 49 && geo.index.array.length === (16 - 4) * 6 + 4 * 36 * 6);
check('the fine cells hold the dip the coarse mesh could not', (() => { let lo = 0; const p = geo.attributes.position; for (let i = 25; i < p.count; i++) lo = Math.min(lo, p.getY(i)); return lo < -20; })());
check('where fine meets coarse the edge lies on the coarse edge\'s straight line (nothing gapes)', (() => { const p = geo.attributes.position; for (let i = 25; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); if ((Math.abs(Math.abs(x) - 100) < 1e-3 || Math.abs(Math.abs(z) - 100) < 1e-3) && Math.abs(p.getY(i)) > 1e-6) return false; } return true; })());
check('the coarse mesh keeps the shading it had', (() => { const n = geo.attributes.normal; for (let i = 0; i < 25; i++) if (n.getY(i) !== 1) return false; return true; })());
check('nothing wet: the ground is left as it was', W.refineGround(T3, plane(4, 400), 4, dip, () => false) === 0);

check('every height in the Wilds goes through the carve', /function wildsHeightAt\(x, z\) \{\s*const h = wildsRawHeightAt\(x, z\);\s*return world2 \? wildsWaters\(wildsRawHeightAt\)\.carve\(x, z, h\) : h;/.test(main));
check('the scene swaps in the fine cells before the ground is dressed, and draws the water on every tier', scene.indexOf('refineGround(THREE, groundGeo') > 0 && scene.indexOf('refineGround(THREE, groundGeo') < scene.indexOf('richGround = dressWildsGround') && /buildWildsWater\(THREE, scene, b, wildsHeightAt/.test(scene) && scene.indexOf('buildWildsWater(') > scene.indexOf("console.error('wilds ground: kept the old floor'"));
check('the beds are bare in the ground mask, glyphs are kept out, and a failure leaves the Wilds standing', /ways\.push\(\{ pts, half: b\.B\.half \+ 6, w: 1 \}\)/.test(scene) && /beck\.pushOff\(gx, gz, size \* 0\.7\)/.test(scene) && /wilds water: none drawn/.test(scene) && /wilds water: ground left coarse/.test(scene));
check('reeds are for medium and high; low keeps only the water and the stones', /quality === 'low' \? 0 : quality === 'medium' \? 0\.5 : 1/.test(raw));
check('the water is not a shadow caster and does not write depth (grass and reeds show through its edge)', /depthWrite: false/.test(raw) && /noShadowCaster = true/.test(raw));
check('names are this module\'s own (one bundle, one scope)', !/\bconst (SS|hash|lerp|clamp)\b = /.test(raw.split('\n').filter((l) => !/^\s/.test(l)).join('\n')));

const manifest = JSON.parse(read('tools/audio/sfx.manifest.json')).sfx.find((x) => x.id === 'wade');
check('wading has its own step: a prompt in the manifest, and the ordinary footstep wherever the recording is missing', !!manifest && /One step only/.test(manifest.prompt) && /wade: 'footstep'/.test(main) && /playSfx\(wadingNow\(\) \? sfxOrStandIn\('wade'\) : 'footstep'\)/.test(main) && /s - wildsHeightAt\(me\.x, me\.y\) > 1/.test(main));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
