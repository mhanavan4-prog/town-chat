// The Wilds' water can be heard as you come near it, and found on the map (client/wilds-water.js).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('loud beside it, quieter with distance, silent far off', async () => {
  const w = await import('../client/wilds-water.js');
  const ford = w.WILDS_BECK.ford, mere = w.WILDS_BECK.mere;
  assert.strictEqual(w.waterDistance(ford.x, ford.y), 0, 'in the ford');
  assert.strictEqual(w.waterLoudness(ford.x, ford.y), w.WATER_LOUD);
  assert.strictEqual(w.waterLoudness(mere.x, mere.y), w.WATER_LOUD, 'in the mere');
  const near = w.waterLoudness(ford.x, ford.y - 120), mid = w.waterLoudness(ford.x, ford.y - 300);
  assert.ok(near < w.WATER_LOUD && mid < near && mid > 0, `${near} ${mid}`);
  assert.strictEqual(w.waterLoudness(ford.x, ford.y - 2000), 0);
  assert.strictEqual(w.waterLoudness(500, 500), 0, 'the far corner of the moor');
  assert.ok(w.waterLoudness(3100, 8100) > 0, 'the rill has a voice too');
  assert.strictEqual(w.waterCourses().length, w.WILDS_WATERS.length);
});

test('the loop, its prompt, and the map', () => {
  const m = read('client/main.js');
  assert.match(m, /startSfxLoop\('beck_run', vol, 2\)/); assert.match(m, /setSfxLoopVol\('beck_run', vol, 0\.6\)/); assert.match(m, /stopSfxLoop\('beck_run', 2\.5\)/);
  assert.match(m, /tickBeckSound\(performance\.now\(\)\);/);
  assert.match(m, /for \(const c of waterCourses\(\)\) \{/, 'drawn on the Wilds map');
  assert.match(m, /__mapLabel\('💧 The beck'/);
  assert.match(read('client/audio.js'), /function setSfxLoopVol\(name, vol, rampSec\)/);
  const e = JSON.parse(read('tools/audio/sfx.manifest.json')).sfx.find((s) => s.id === 'beck_run');
  assert.ok(e && e.loop === true && e.duration_seconds >= 15 && /loop seamlessly/.test(e.prompt));
});
