// The second batch of sounds: the road north, the Wildlands Village, the
// Wilds' fires and old sites, the rest of the Old Ways, a wanderer laid, and
// the book opening. Each has a prompt in the manifest the generator reads
// (tools/audio/build-sfx.py) and something in the game that plays it. Until
// its file is recorded an id is silent (the synth voices stay retired).
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const manifest = JSON.parse(read('tools/audio/sfx.manifest.json'));
const byId = Object.fromEntries(manifest.sfx.map((e) => [e.id, e]));
// id -> the file whose code plays it
const WHERE = {
  gibbet_splinter: 'lib/wayside.js', coffin_rest: 'lib/wayside.js',
  candle_rise: 'lib/corpseCandle.js', candle_struck: 'lib/corpseCandle.js', candle_out: 'lib/corpseCandle.js',
  unwitch: 'lib/villageHouses.js', lyke_bed: 'lib/villageHouses.js', lyke_wake: 'server.js',
  balefire_light: 'lib/wildsFinds.js', balefire_round: 'lib/wildsFinds.js', cairn_open: 'lib/wildsFinds.js',
  troy_done: 'server.js', crick_done: 'server.js', stones_counted: 'server.js', cloot_tie: 'lib/callers.js',
  besom_bind: 'lib/oldWays.js', poppet_bind: 'lib/oldWays.js', lead_pour: 'lib/oldWays.js', bees_tell: 'lib/oldWays.js', brownie_cream: 'lib/oldWays.js',
  sin_eat: 'lib/oldWays.js', toad_bone: 'lib/oldWays.js', hare_back: 'lib/oldWays.js', reel_done: 'lib/oldWays.js',
  wanderer_laid: 'server.js', page_turn: 'client/oldways.js',
  candle_follow: 'client/main.js', glory_out: 'lib/oldWays.js',
};
const IDS = Object.keys(WHERE);
check('twenty-eight more, each with a prompt and a length, and each saying no music', IDS.length === 28 && IDS.every((id) => byId[id] && byId[id].prompt.length > 80 && byId[id].duration_seconds >= 0.5 && byId[id].duration_seconds <= 4 && /No music|no voice|No other instruments/i.test(byId[id].prompt)), IDS.filter((id) => !byId[id]));
check('no id is in the manifest twice', new Set(manifest.sfx.map((e) => e.id)).size === manifest.sfx.length);
const missing = IDS.filter((id) => !new RegExp("'" + id + "'").test(read(WHERE[id])));
check('each is played from where the thing happens', missing.length === 0, missing);
// every sound a server message names is one the generator knows, or the client would be silent for a misspelling
const named = new Set();
for (const f of ['server.js', ...fs.readdirSync(path.join(root, 'lib')).map((x) => 'lib/' + x)]) for (const m of read(f).matchAll(/\bsfx: '([a-z_0-9]+)'/g)) named.add(m[1]);
for (const f of ['lib/wayside.js', 'lib/villageHouses.js', 'lib/wildsFinds.js', 'lib/corpseCandle.js', 'lib/dungeonFinds.js']) for (const m of read(f).matchAll(/say\([^\n]*, '([a-z_0-9]+)'\);/g)) if (!['important', 'routine'].includes(m[1])) named.add(m[1]);
const unknown = [...named].filter((id) => !byId[id]);
check('every sound the server names is in the manifest', named.size > 30 && unknown.length === 0, unknown);
const main = read('client/main.js');
check('a village door sounds going in and coming out, and the Countless Stones result may bring a sound', (main.match(/playSfx\('door'\)/g) || []).length >= 4 && /if \(msg\.type === 'count_stones_result'\) \{ if \(msg\.sfx && typeof playSfx === 'function'\) playSfx\(msg\.sfx\);/.test(main));
check('the book sounds when it is opened, not each time it is turned to its other half', /if \(m\.classList\.contains\('hidden'\)\) sfx\('page_turn'\);/.test(read('client/oldways.js')) && /sfx: \(id\) => \{ if \(typeof playSfx === 'function'\) playSfx\(id\); \}/.test(main));
check('the old sites sound only when the thing is done', /event === 'done' \? \{ sfx: 'troy_done' \}/.test(read('server.js')) && /event === 'done' \? \{ sfx: 'crick_done' \}/.test(read('server.js')) && /v\.key === 'beaten' \? \{ sfx: 'stones_counted' \}/.test(read('server.js')));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
