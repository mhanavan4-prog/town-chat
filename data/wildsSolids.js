// What stands solid in the Wilds, as rectangles [x, y, w, h]: the village's
// houses, the Artificer's tower, the stall and the larger stones and props.
// These are the same footprints the client stops a player at (WILDS_WALLS in
// client/wilds-scene.js), which it works out from the models when it builds
// the scene. The server cannot load models, so this is a copy, taken from the
// running client with window.__testDrive.walls() in the Wilds and kept to
// things at least 44 across (a creature brushing through a sapling does not
// show; one walking through a house does). If a building is moved or added,
// take the copy again.
const WILDS_SOLIDS = [
  [8213,1779,60,60],
  [8731,1846,60,60],
  [1920,1850,160,160],
  [2060,1922,120,120],
  [1813,1923,124,124],
  [4698,2178,303,352],
  [8439,2287,60,60],
  [5584,2679,273,317],
  [4816,2787,368,414],
  [4100,2814,367,292],
  [5281,3253,113,153],
  [4981,3341,44,38],
  [4238,3401,270,303],
  [5514,3423,268,306],
  [1649,3739,60,60],
  [1170,3925,60,60],
  [1591,4278,60,60],
  [5146,4566,68,68],
  [2849,4724,60,60],
  [8345,4985,60,60],
  [3302,5006,60,60],
  [8868,5084,60,60],
  [2795,5226,60,60],
  [8513,5463,60,60],
  [4730,5870,60,60],
  [6466,6166,68,68],
  [4083,6281,60,60],
  [4435,6631,60,60],
  [6939,6688,60,60],
  [3993,6799,60,60],
  [7274,7086,60,60],
  [6754,7127,60,60]
];

module.exports = { WILDS_SOLIDS };
