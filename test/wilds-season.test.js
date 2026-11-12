// The Wilds wear the season (client/wilds-season.js): ground, leaf and air for
// each sabbat. The dyeing is driven here against a small stand-in for three.js,
// because the leaf materials are shared with the town and must be put back.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

class Color {
  constructor(h = 0xffffff) { this.setHex(h); }
  setHex(h) { this.r = ((h >> 16) & 255) / 255; this.g = ((h >> 8) & 255) / 255; this.b = (h & 255) / 255; return this; }
  getHex() { return (Math.round(this.r * 255) << 16) | (Math.round(this.g * 255) << 8) | Math.round(this.b * 255); }
  multiply(c) { this.r *= c.r; this.g *= c.g; this.b *= c.b; return this; }
  multiplyScalar(k) { this.r *= k; this.g *= k; this.b *= k; return this; }
  lerp(c, t) { this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t; return this; }
}
class Geo { setAttribute(n, a) { this.attributes = { [n]: a }; } dispose() {} }
const THREE = { Color, BufferGeometry: Geo, BufferAttribute: class { constructor(array) { this.array = array; } }, PointsMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
  Points: class { constructor(g, m) { this.geometry = g; this.material = m; this.position = { set() {} }; } }, DataTexture: class { constructor(data, w, h) { this.data = data; this.w = w; this.h = h; } }, RGBAFormat: 1, LinearFilter: 1 };
global.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {} }) }) };
global.performance = global.performance || { now: () => Date.now() };

const mat = (name, hex, glow) => ({ name, color: new Color(hex), emissive: new Color(glow || 0), userData: {} });
const ground = mat('', 0xffffff), forest = mat('forest', 0x80c080), plant = mat('Plant', 0x60a060), trim = mat('Trim', 0x884422), lamp = mat('forest', 0x80c080, 0x202020);
const meshes = [{ isMesh: true, name: 'wildsGround', material: ground }, { isMesh: true, material: forest }, { isMesh: true, material: forest }, { isMesh: true, material: [plant, trim] }, { isMesh: true, material: lamp }];
const scene = { traverse(fn) { meshes.forEach(fn); }, add(o) { o.parent = this; this.added = o; }, remove(o) { o.parent = null; this.added = null; } };
let active = scene, season = 'mabon', quality = 'high';

(async () => {
  const mod = await import('../client/wilds-season.js');
  const S = mod.WILDS_SEASON;
  const { SABBATS } = require('../data/seasons');
  check('every sabbat on the Wheel has a dress for the Wilds, with a line to say on walking out', SABBATS.every((s) => S[s.key] && S[s.key].note.length > 20 && S[s.key].leaf.length === 2 && S[s.key].leaf[1] >= 0 && S[s.key].leaf[1] <= 1) && Object.keys(S).length === SABBATS.length);
  check('high summer is the land as it was made; winter lays frost on it; what falls suits the season', S.litha.ground === 0xffffff && S.litha.leaf[1] === 0 && S.yule.frost > 0 && S.yule.air === 'snow' && S.mabon.air === 'leaves' && S.samhain.air === 'leaves' && S.ostara.air === 'petals' && S.yule.airN > S.samhain.airN);

  const ws = mod.default({ THREE, getWildsScene: () => scene, getActiveScene: () => active, getCamera: () => ({ position: { x: 0, y: 200, z: 0 } }), getSeasonKey: () => season, getQuality: () => quality });
  ws.apply();
  check('in the Wilds the ground takes the season and the leaf turns toward it', ws.worn() === 'mabon' && ground.color.getHex() === S.mabon.ground && forest.color.getHex() !== 0x80c080 && forest.color.r > forest.color.b && forest.emissive.getHex() === S.mabon.leafGlow);
  const fullShift = Math.abs(forest.color.r - 0x80 / 255), halfShift = Math.abs(plant.color.r - 0x60 / 255);
  check('the hand-made plants, which share their material with some stone, are dyed at half strength; trim is left alone', halfShift > 0 && halfShift < fullShift && trim.color.getHex() === 0x884422 && plant.emissive.getHex() !== 0 && plant.emissive.getHex() !== S.mabon.leafGlow);
  check('a thing that glowed of itself keeps its glow', lamp.emissive.getHex() === 0x202020);
  check('what falls is in the air, as many as the season has at full quality', scene.added && scene.added.name === 'wildsSeasonAir' && scene.added.geometry.attributes.position.array.length === S.mabon.airN * 3 && scene.added.material.color === S.mabon.airCol);
  const tex = scene.added.material.map, src = read('client/wilds-season.js');
  check('the flake is made from numbers, never drawn on a canvas (Safari salts canvas pixels with noise), clear at the rim and solid in the middle', tex && tex.data.length === 32 * 32 * 4 && tex.data[3] === 0 && tex.data[(16 * 32 + 16) * 4 + 3] === 255 && !/createElement\('canvas'\)|CanvasTexture/.test(src));
  check('what falls is small: a leaf is not the size of a plate', scene.added.material.size <= 6 && S.yule && /FLAKE_SIZE = \{ motes: 3, snow: 5, petals: 5, leaves: 6 \}/.test(src));
  const ys0 = Array.from(scene.added.geometry.attributes.position.array).filter((_, i) => i % 3 === 1);
  ws.update(0.1);
  // nearly all of it is lower than it was (one that reached the ground has come round again to the top)
  check('…and falls', (() => { const p = scene.added.geometry.attributes.position.array; let lower = 0; ys0.forEach((y, i) => { if (p[i * 3 + 1] < y) lower++; }); return lower >= ys0.length * 0.9; })());
  for (let k = 0; k < 50; k++) ws.update(0.05);
  check('none drifts right past the eye', (() => { const p = scene.added.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i]) < 100 && Math.abs(p[i + 2]) < 100) return false; return true; })());

  // leaving: the shared leaves go back, the ground and air stay
  active = {};
  ws.update(0.1);
  check('on leaving the Wilds the shared leaf materials are put back at once, glow and all; the ground keeps the season', forest.color.getHex() === 0x80c080 && plant.color.getHex() === 0x60a060 && forest.emissive.getHex() === 0 && lamp.emissive.getHex() === 0x202020 && ground.color.getHex() === S.mabon.ground);
  active = scene; ws.update(0.1);
  check('…and dyed again on coming back', forest.color.getHex() !== 0x80c080);

  // the season turns
  season = 'yule'; ws.update(0.1);
  check('when the Wheel turns the land changes its dress without being asked', ws.worn() === 'yule' && ground.color.getHex() === S.yule.ground && ground.emissive.getHex() === S.yule.frost && scene.added.geometry.attributes.position.array.length === S.yule.airN * 3);
  quality = 'low'; ws.redress();
  check('on a slow machine there is less in the air', scene.added.geometry.attributes.position.array.length === Math.round(S.yule.airN * 0.4) * 3);
  season = 'litha'; ws.update(0.1);
  check('high summer puts everything back as it was made', ground.color.getHex() === 0xffffff && ground.emissive.getHex() === 0 && forest.color.getHex() === 0x80c080 && forest.emissive.getHex() === 0);
  season = null; ws.update(0.1);
  check('with no season there is nothing in the air and nothing dyed', ws.worn() === null && scene.added === null && forest.color.getHex() === 0x80c080);

  const main = read('client/main.js'), wilds = read('client/wilds-scene.js');
  check('the Wilds are dressed whenever they are built, every frame the air moves, and the ground is named for the dyer', (main.match(/_dowseMarks\.place\(\); _wildsSeason\.redress\(\);/g) || []).length === 3 && /updateCottageDressing\(dt\);\n  _wildsSeason\.update\(dt\);/.test(main) && /ground\.name = 'wildsGround';/.test(wilds));
  check('walking out into the Wilds, the season is said once', /_ws && _wildsSeasonTold !== _sk \? `🌀 You step through the portal into the Wilds\. \$\{_ws\.note\}`/.test(main) && /_wildsSeasonTold = _sk;/.test(main));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL - threw', e && e.stack); process.exit(1); });
