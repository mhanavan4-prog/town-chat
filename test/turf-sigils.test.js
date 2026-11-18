// client/turf-sigils.js: the witch-signs cut into the turf. Made from numbers, every sign in one atlas, two draws for
// the lot, the grass kept out of the cut and not out of the figure, and what lies on the ground lying on the surface
// that is drawn.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

(async () => {
  const M = await import('../client/turf-sigils.js');
  const raw = read('client/turf-sigils.js');
  check('made from numbers: no canvas (Safari salts canvas pixels into coloured squares)', !/createElement|getContext|CanvasTexture/.test(raw));
  check('the same twelve signs as before', M.TURF_SIGNS.length === 12 && new Set(M.TURF_SIGNS.map((s) => s.name)).size === 12);

  const t0 = Date.now(); const A = M.makeTurfAtlas(null); const ms = Date.now() - t0;
  check('the atlas is worked out quickly enough to build with the scene', ms < 1500, ms);
  check('every sign fits in the atlas', M.TURF_SIGNS.length <= M.TURF.cols * M.TURF.cols && A.W === M.TURF.cell * M.TURF.cols);
  const B = M.makeTurfAtlas(null);
  check('it is the same every time', A.px.chalk.every((v, i) => v === B.px.chalk[i]));

  // inside a sign: chalk where the line is, open turf between the lines, nothing at the edge of the decal
  const S = M.TURF.cell, W = A.W, at = (c, i, j) => { const o = ((Math.floor(c / M.TURF.cols) * S + j) * W + (c % M.TURF.cols) * S + i) * 4; return [...A.px.chalk.slice(o, o + 4)]; };
  const E = 0.5 / M.TURF_RF, pix = (x) => Math.floor((x + E) / (2 * E) * S);
  const onCircle = at(0, pix(1), pix(0)), between = at(0, pix(0), pix(0)), edge = at(0, 2, 2);   // (0, 0): the middle of the pentacle, inside the star
  check('on the pentacle\'s circle: the cut, pale and solid', onCircle[3] > 240 && onCircle[0] > 110 && onCircle[0] > onCircle[2], onCircle);
  check('weathered, not white', onCircle[0] < 215);
  check('between its lines: open turf', between[3] < 20, between);
  check('at the edge of the decal: nothing', edge[3] === 0);
  const lit = (c, x, y) => { const o = ((Math.floor(c / M.TURF.cols) * S + pix(y)) * W + (c % M.TURF.cols) * S + pix(x)) * 4; return A.px.light[o + 3]; };
  check('the light lies in the cut and fades off it', lit(0, 1, 0) > 230 && lit(0, 1 + M.TURF.hw * 2, 0) < 140 && lit(0, 0, 0) === 0, [lit(0, 1, 0), lit(0, 1 + M.TURF.hw * 2, 0)]);
  // a worn path goes round each sign, broken in places
  let worn = 0, gaps = 0;
  for (let k = 0; k < 360; k++) { const a = k * Math.PI / 180, v = at(3, pix(Math.cos(a) * M.TURF.ring), pix(Math.sin(a) * M.TURF.ring))[3]; if (v > 120) worn++; else if (v < 40) gaps++; }
  check('a path is worn round it, broken where it is little walked', worn > 120 && gaps > 15, [worn, gaps]);

  // the grass: kept out of the cut and its edges and off the worn path, and growing between the lines
  const g = [{ x: 4000, z: 4000, R: 40, rot: 0.9, sign: 0 }], I = M.turfIndex(A, g);
  const world = (lx, ly) => [4000 + (lx * Math.cos(0.9) - ly * Math.sin(0.9)) * 40, 4000 + (lx * Math.sin(0.9) + ly * Math.cos(0.9)) * 40];
  check('no grass in the cut', I.blocked(...world(1, 0)) && I.blocked(...world(0, -1)));
  check('grass between the lines of the figure', !I.blocked(...world(0, 0)) && !I.blocked(...world(0.05, -0.05)));
  check('grass beyond the sign', !I.blocked(4300, 4300) && !I.blocked(...world(1.9, 0)));
  check('the cut is found whichever way the sign is turned', (() => { const h = I.at(...world(0, 1)); return !!h && h.d < 40 * M.TURF.hw; })());

  // crumbs of chalk and clods of turf, along the cuts
  const R = M.turfRubble(g, 0.34, A);
  const dists = R.map((p) => I.at(p.x, p.z)).filter(Boolean).map((h) => h.d / 40);
  check('rubble lies along the cut, a little out from it, and only what fell back in lies in it', R.length > 15 && dists.length === R.length && dists.filter((d) => d > M.TURF.hw * 1.1 && d < M.TURF.hw * 3).length > R.length * 0.8 && dists.every((d) => d > M.TURF.hw * 1.1 || d < M.TURF.hw * 0.85), [R.length, dists.map((d) => +(d / M.TURF.hw).toFixed(2))]);
  check('both chalk and turf', R.some((p) => p.clod) && R.some((p) => !p.clod));

  // the drawn ground: PlaneGeometry's own two triangles a cell
  const H = M.turfGridHeight([0, 0, 0, 0, 10, 0, 0, 0, 0], 2, 0, 0, 100, 100);
  check('on the grid points, the grid\'s heights', H(50, 50) === 10 && H(0, 0) === 0 && H(100, 100) === 0);
  check('between them, the plane of the triangle they fall in, as THREE.PlaneGeometry splits a cell', Math.abs(H(25, 25) - 0) < 1e-9 && Math.abs(H(40, 40) - 6) < 1e-9 && Math.abs(H(60, 60) - 6) < 1e-9);
  check('the grid is the one the Wilds ground is drawn from, captured before the beck refines it', /gridHeights = new Float32Array\(gp\.count\); for \(let i = 0; i < gp\.count; i\+\+\) gridHeights\[i\] = gp\.getY\(i\);/.test(read('client/wilds-scene.js')) && read('client/wilds-scene.js').indexOf('gridHeights = new Float32Array') < read('client/wilds-scene.js').indexOf('refineGround(THREE, groundGeo'));

  // two draws for the whole scatter, and every sign where it always was
  const scene = read('client/wilds-scene.js');
  check('two draws for every sign (was two a sign)', /buildTurfSigns\(THREE, scene, turfAtlas, turfGlyphs, groundAt/.test(scene) && !/conformingDecal\(/.test(scene) && /new THREE\.Mesh\(cg, chalkMat\)/.test(raw) && /new THREE\.Mesh\(lg, lightMat\)/.test(raw));
  const draws = (scene.match(/grand\(\)/g) || []).length;
  check('the same draws from the seed a sign as before, so each is where it was', /grand\(\);\s+\/\/ \(was the scorch's opacity\)/.test(scene) && /grand\(\);\s+\/\/ \(was the breath's depth\)/.test(scene), draws);
  check('the chalk is lit like the ground; the light is added on top and hardly shows by day', /new THREE\.MeshLambertMaterial\(\{ map: atlas\.chalk/.test(raw) && /blending: THREE\.AdditiveBlending/.test(raw) && /diffuseColor\.a = opacity \* \(tLine \+ tSpill\) \* vBreath \* uShow;/.test(raw));
  check('the floating-object audit is told the decals lie on the ground', (raw.match(/userData\.floats = true/g) || []).length === 2);
  check('the lore it rests on is named, and what is the game\'s', /Uffington White Horse/.test(raw) && /the signs themselves, and the light in\n\/\/ the cut, are the game's/.test(raw));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
