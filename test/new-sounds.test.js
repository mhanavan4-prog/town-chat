// Sounds for the newer things: each has a prompt in the manifest the generator
// reads (tools/audio/build-sfx.py), and something in the game that plays it.
// The recorded files are made where the key is; until then playSfx is silent
// for an id with no file (the old synth voices stay retired).
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const manifest = JSON.parse(read('tools/audio/sfx.manifest.json'));
const IDS = ['reel_trump', 'besom_ride', 'hare_go', 'glory_light', 'moon_silver', 'daybook', 'wander_rawhead', 'wander_church_grim', 'wander_mine_demon', 'wander_black_annis', 'rare_marked', 'rare_hoard', 'rare_well'];
const byId = Object.fromEntries(manifest.sfx.map((e) => [e.id, e]));
check('every new sound has a prompt and a length in the manifest, and says no music', IDS.every((id) => byId[id] && byId[id].prompt.length > 80 && byId[id].duration_seconds > 0.4 && byId[id].duration_seconds <= 10 && /No music|no voice|No other instruments/i.test(byId[id].prompt)));
check('no id is in the manifest twice', new Set(manifest.sfx.map((e) => e.id)).size === manifest.sfx.length);
const { DUNGEON_LORE } = require('../data/dungeons');
check('each wanderer\'s sound is named for it, so its warning can bring it', [1, 2, 3, 4].every((t) => byId[DUNGEON_LORE[t].wanderer.key]));
const main = read('client/main.js'), server = read('server.js'), ow = read('lib/oldWays.js'), finds = read('lib/dungeonFinds.js'), dung = read('lib/dungeons.js'), delve = read('lib/delve.js'), audio = read('client/audio.js');
check('a message may bring its own sound', /if \(msg\.sfx && typeof playSfx === 'function'\) playSfx\(msg\.sfx\);/.test(main) && /\.\.\.\(out\.sfx \? \{ sfx: out\.sfx \} : \{\}\)/.test(server));
check('the hare, the Hand of Glory and the turned silver each have theirs', /sfx: 'hare_go', toast:/.test(ow) && /sfx: 'glory_light', toast:/.test(ow) && /sfx: 'moon_silver', toast:/.test(ow));
check('a wanderer abroad is heard as well as told, in a dungeon, on a Delve floor, and on arriving', /sfx: m\.mobType, message: wandererWarning\(m\)/.test(dung) && /sfx: key, message: `🕯️ The lanterns dip/.test(delve) && /sfx: w\.mobType, message: wandererWarning\(w\)/.test(server));
check('the three rare rooms each sound when used', /'important', 'rare_marked'\);/.test(finds) && /'important', 'rare_hoard'\);/.test(finds) && /'important', 'rare_well'\);/.test(finds));
check('the reel has its trump, round again while the ring turns, and the besom its wind', (main.match(/playSfx\('reel_trump'\)/g) || []).length === 2 && /playSfx\('besom_ride'\)/.test(main));
check('a line written in the daybook scratches', (server.match(/sfx: 'daybook', message: '📖 Written in your daybook/g) || []).length === 5);
check('an id with no recorded file yet is simply silent: the synth voices stay retired', /const SYNTH_MUTED = true;/.test(audio) && IDS.every((id) => !new RegExp("case '" + id + "'").test(audio)));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
