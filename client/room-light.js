// ---------------------------------------------------------------------------
// Light for a room, so that a fire lights it.
//
// The village's rooms were lit, but nothing showed it: the floor was one flat
// quad and the walls five boxes, shaded at their corners only (Lambert), so a
// fire two paces away put no pool of light on the boards. And nothing cast a
// shadow, because no light in the room was set to.
//
//   roomSurface   a floor or wall material shaded at every pixel, so lamp and
//                 firelight fall off across it as they should
//   plankTexture  boards for the floor (or flags, for a stone one), made from
//                 numbers (Safari salts canvas pixels)
//   roomCaster    a soft light from straight overhead that takes a share of
//                 the room's fill and casts the shadows: furniture and people
//                 stand on the floor instead of floating over it
//
// On 'low' the old flat materials stay and nothing casts.
// ---------------------------------------------------------------------------

const rlHash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// Floor boards (kind 'plank') or stone flags (kind 'flag') as a greyscale-ish tile that multiplies the floor's colour.
// Returns { px, size, tex } (tex null without THREE). The tile wraps.
export function plankTexture(THREE, kind = 'plank') {
  const N = 256, px = new Uint8Array(N * N * 4);
  const ROWS = kind === 'flag' ? 4 : 8, rowH = N / ROWS;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const row = Math.floor(y / rowH), inRow = y - row * rowH;
    // each row is cut into boards at its own places (flags: two to a row, staggered)
    const cuts = kind === 'flag' ? 2 : 1 + Math.floor(rlHash(row, 3) * 2), off = Math.floor(rlHash(row, 7) * N);
    const xx = (x + off) % N, len = N / cuts, board = Math.floor(xx / len), inBoard = xx - board * len;
    let v = 0.80 + 0.20 * rlHash(row * 13 + board, 17);                          // every board its own shade
    if (kind === 'flag') v += (rlHash(x >> 2, y >> 2) - 0.5) * 0.10;              // stone: a coarse speckle
    else v += (rlHash(xx >> 3, row * 31 + Math.floor(inRow / 2)) - 0.5) * 0.09;   // wood: grain running with the board
    const seam = Math.min(inRow, rowH - 1 - inRow, inBoard, len - 1 - inBoard);
    if (seam < 1) v *= 0.42; else if (seam < 2) v *= 0.78;                        // the gaps between
    const c = Math.max(0, Math.min(255, Math.round(v * 255))), i = (y * N + x) * 4;
    px[i] = c; px[i + 1] = c; px[i + 2] = c; px[i + 3] = 255;
  }
  let tex = null;
  if (THREE) {
    tex = new THREE.DataTexture(px, N, N, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
  }
  return { px, size: N, tex };
}

// A floor or wall material. rich=false gives the old Lambert back.
export function roomSurface(THREE, color, { rich = true, map = null } = {}) {
  if (!rich) return new THREE.MeshLambertMaterial({ color });
  const m = new THREE.MeshPhongMaterial({ color, specular: 0x000000, shininess: 1 });
  if (map) m.map = map;
  return m;
}

// The overhead caster. `fill` is the room's decorative directional (it keeps noShadowCaster); `share` of its light
// moves overhead, so the room is no brighter for it. Returns the caster.
export function roomCaster(THREE, scene, fill, W, D, share = 0.45) {
  const caster = new THREE.DirectionalLight(fill.color.getHex(), fill.intensity * share);
  fill.intensity *= (1 - share);
  caster.position.set(W / 2, 900, D / 2); caster.target.position.set(W / 2, 0, D / 2);
  caster.userData.followShadow = true; caster.userData.shadowSpan = 520;   // rides the player, like the town's rooms (main.js sceneInfo)
  scene.add(caster); scene.add(caster.target);
  return caster;
}
