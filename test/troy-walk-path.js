// The Shepherd's Race walked as a player would: the world points of its one
// path, gate to centre, from the server's own raster (data/troyTown.js), and a
// point just outside the gate. Shared by the tests that run it.
const T = require('../data/troyTown');
function troyWalkPath() {
  const R = T.raster();
  const NX = 92, CELL = 0.25, X0 = -11, Y0 = -11, u = T.TROY_TOWN.unit;
  const w = (i, j) => [T.TROY_TOWN.x + (X0 + (i + 0.5) * CELL) * u, T.TROY_TOWN.y - (Y0 + (j + 0.5) * CELL) * u];
  let start = null;
  for (let k = 0; k < R.dist.length; k++) if (R.dist[k] === R.gateD) { start = [k % NX, Math.floor(k / NX)]; break; }
  const cells = [start]; let [i, j] = start;
  while (R.dist[j * NX + i] > 0) {
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (R.dist[(j + b) * NX + (i + a)] === R.dist[j * NX + i] - 1) { i += a; j += b; break; } }
    cells.push([i, j]);
  }
  const g = T.troyTownGeometry();
  const outside = [g.gate[0] + (g.gate[0] - g.hub[0]) * 0.15, g.gate[1] + (g.gate[1] - g.hub[1]) * 0.15];
  return { inward: cells.map(([a, b]) => w(a, b)), outside, cellOf: w };
}
// The moves for a whole run, in and out, a step every n cells (a player at
// 230 u/s sends a move every 50 ms: about one cell).
function troyRunMoves(n = 2) {
  const { inward, outside } = troyWalkPath();
  const pts = [outside];
  for (let k = 0; k < inward.length; k += n) pts.push(inward[k]);
  pts.push(inward[inward.length - 1]);
  for (let k = inward.length - 1; k >= 0; k -= n) pts.push(inward[k]);
  pts.push(inward[0], outside);
  return pts;
}
module.exports = { troyWalkPath, troyRunMoves };
