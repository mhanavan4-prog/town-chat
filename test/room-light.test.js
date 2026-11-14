// Light that shows in the village's rooms (client/room-light.js): floors and walls shaded at every pixel so a fire
// pools on them, boards underfoot, and an overhead light that casts the shadows. Low keeps the old flat rooms.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const rl = read('client/room-light.js'), vh = read('client/village-house.js'), hf = read('client/hearth-fire.js'), main = read('client/main.js');
const R = new Function(rl.replace(/export function /g, 'function ') + '\nreturn { plankTexture, roomSurface, roomCaster };')();

for (const kind of ['plank', 'flag']) {
  const t = R.plankTexture(null, kind);
  let lo = 255, hi = 0, grey = true, seams = 0;
  for (let i = 0; i < t.px.length; i += 4) { const v = t.px[i]; if (v < lo) lo = v; if (v > hi) hi = v; if (t.px[i + 1] !== v || t.px[i + 2] !== v || t.px[i + 3] !== 255) grey = false; if (v < 110) seams++; }
  check(`${kind}: made from numbers, not a canvas, and the same every time`, !/createElement|getContext/.test(rl) && t.px.length === 256 * 256 * 4 && R.plankTexture(null, kind).px.every((v, i) => v === t.px[i]));
  check(`${kind}: a grey tile that multiplies the floor's own colour (never brighter than it, never black)`, grey && hi <= 255 && hi > 225 && lo > 60, [lo, hi]);
  check(`${kind}: the gaps between are there, and are a small part of it`, seams > 500 && seams < t.px.length / 4 * 0.12, seams);
}
const T3 = {
  MeshLambertMaterial: function (o) { Object.assign(this, o); this.kind = 'lambert'; }, MeshPhongMaterial: function (o) { Object.assign(this, o); this.kind = 'phong'; },
  DirectionalLight: function (c, i) { this.color = { hex: c, getHex() { return this.hex; } }; this.intensity = i; this.position = { set(x, y, z) { Object.assign(this, { x, y, z }); } }; this.target = { position: { set(x, y, z) { Object.assign(this, { x, y, z }); } } }; this.userData = {}; },
};
const rich = R.roomSurface(T3, 0x4a3420, { map: 'BOARDS' }), plain = R.roomSurface(T3, 0x4a3420, { rich: false, map: 'BOARDS' });
check('a rich surface is shaded at every pixel and has no shine of its own', rich.kind === 'phong' && rich.specular === 0 && rich.map === 'BOARDS' && rich.color === 0x4a3420);
check('low keeps the old flat surface, without the boards', plain.kind === 'lambert' && plain.map === undefined);
const added = [], fill = new T3.DirectionalLight(0xfff0d8, 0.26), caster = R.roomCaster(T3, { add: (o) => added.push(o) }, fill, 900, 600, 0.6);
check('the overhead light takes its share from the fill: the room is no brighter for it', Math.abs(fill.intensity + caster.intensity - 0.26) < 1e-9 && Math.abs(caster.intensity - 0.156) < 1e-9);
check('it stands straight over the middle of the room and rides the player, as the town\'s rooms do', caster.position.x === 450 && caster.position.z === 300 && caster.target.position.x === 450 && caster.target.position.z === 300 && caster.position.y > 500 && caster.userData.followShadow === true && caster.userData.shadowSpan === 520 && added.length === 2 && /info\.sun\.userData\.followShadow/.test(main));
check('the fill itself still casts nothing (a slanted caster is what banded floors)', /fill\.userData\.noShadowCaster = true;/.test(vh) && !caster.userData.noShadowCaster);

check('village rooms: rich on medium and high, the old room on low', /const rich = !\(GFX && GFX\.st && GFX\.st\.quality === 'low'\);/.test(vh) && /AmbientLight\(L\.amb, rich \? 0\.36 : 0\.5\)/.test(vh) && /DirectionalLight\(0xfff0d8, rich \? 0\.26 : 0\.22\)/.test(vh) && /if \(rich\) roomCaster\(THREE, scene, fill, W, D, 0\.6\);/.test(vh) && /createVillageHouse\(\{ kkPlace, makeSignSprite, makeGlowTexture, createHumanoid, GFX \}\)/.test(main));
check('village rooms: boards underfoot (flags in the tower), and walls that take the light', /plankTexture\(THREE, house\.id === 'tower' \? 'flag' : 'plank'\)/.test(vh) && /const wallMat = roomSurface\(THREE, L\.wall, \{ rich \}\);/.test(vh));
check('the fire: whoever places it sets its strength, and the flicker keeps it (it used to be overwritten each frame)', /l\.userData\.base = l\.intensity;/.test(hf) && /l\.intensity = l\.userData\.base \* \(0\.86/.test(hf) && /fl\.userData\.base \*= \(power \|\| 1\) \* \(rich \? 1\.45 : 1\)/.test(vh) && !/userData\.light\.intensity \*=/.test(vh));
check('the fire\'s light is lifted and brought out from the fire-back in a rich room, so it falls on the boards', /if \(rich\) \{ fl\.position\.set\(0, 62 \* size \/ 190, 64 \* size \/ 190\)/.test(vh));
check('nothing else uses the fire\'s light in the old way', !/userData\.light\.intensity/.test(main));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
