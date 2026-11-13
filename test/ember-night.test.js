// The Ember Wastes by night (server.js nightOnly spawns; client/ember-storm.js;
// lib/witchRing.js ring_sung): the field's dead get up after dark and lie down
// at dawn; the sky, fog and lights go down; the track's lanterns are lit; the
// ring glows on a night it has not yet sung.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-embernight-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const src = read('server.js').replace('function isNightNow() {', 'function isNightNow() { if (global.__night != null) return global.__night;');
const Module = require('module');
const m = new Module(path.join(__dirname, '..', 'server.js'), module); m.filename = path.join(__dirname, '..', 'server.js'); m.paths = Module._nodeModulePaths(path.join(__dirname, '..'));
m._compile(src, m.filename);

setTimeout(() => {
  const h = global.__testHooks;
  const dead = h.emberMobs.filter((x) => x.nightOnly);
  const { FINDS } = require('../data/emberField');
  check('the field\'s dead: two by each grave, the chapel and each standard', dead.length === FINDS.filter((f) => /barrow|chapel|standard/.test(f.model)).length * 2 && dead.every((x) => x.mobType === 'soot_revenant'));
  global.__night = false;
  h.tickEmberWastes(0.05);
  check('by day they lie down', dead.every((x) => x.dead));
  global.__night = true;
  for (const x of dead) x.respawnAt = 0;
  h.tickEmberWastes(0.05);
  check('after dark they get up', dead.every((x) => !x.dead));
  global.__night = false;
  h.tickEmberWastes(0.05);
  check('and at dawn they lie down again, and stay down', dead.every((x) => x.dead));
  h.tickEmberWastes(0.05); h.tickEmberWastes(0.05);
  check('(still down a while after)', dead.every((x) => x.dead));
  check('the rest of the Wastes is not touched by the day', h.emberMobs.filter((x) => !x.nightOnly && !x.boss).some((x) => !x.dead));

  const ring = read('lib/witchRing.js'), storm = read('client/ember-storm.js'), scene = read('client/ember-scene.js'), main = read('client/main.js');
  check('the ring tells the Wastes when it has sung, and says on asking whether it has tonight', /tellWastes\(\{ type: 'ring_sung' \}\)/.test(ring) && /sung: sungCycle === cycleId\(\)/.test(ring) && /msg\.type === 'ring_sung'\) \{ _emberStorm\.sung\(\)/.test(main));
  check('by night the client darkens sky and fog and turns the lights down', /NIGHT = \{ near: 420, far: 3400/.test(storm) && /L\[k\]\.intensity = L\.base\[k\]/.test(storm) && /scene\.userData\.lights = \{ ambient: emberAmbientLight, sun: emberSun, hemi: emberHemi/.test(scene));
  check('the track\'s lanterns are lit every night, and the ring glows until it has sung', /const lit = Math\.max\(s \* 1\.4, n \* 0\.9\);/.test(storm) && /ringSung \? 0/.test(storm) && /scene\.userData\.ringGlow = glow/.test(scene));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
