// New sounds waiting to be recorded play an older one meanwhile (client/main.js SFX_STAND_IN), so a
// new trigger is never silent; each new id has a prompt, and each stand-in has a recorded file.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'client/main.js'), 'utf8');
const m = main.match(/const SFX_STAND_IN = (\{[^\n]*\});/);
const STAND = m ? Function(`return ${m[1]}`)() : {};
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools/audio/sfx.manifest.json'), 'utf8'));
const ids = new Set(manifest.sfx.map((e) => e.id));
const files = new Set(fs.readdirSync(path.join(root, 'public/audio/sfx')).map((f) => f.replace(/(-\d+)?\.mp3$/, '')));
check('there is a table of stand-ins', Object.keys(STAND).length >= 7);
check('every new id has a prompt to be recorded from', Object.keys(STAND).every((id) => ids.has(id)), Object.keys(STAND).filter((id) => !ids.has(id)));
check('every stand-in has a recorded file today', Object.values(STAND).every((id) => files.has(id)), Object.values(STAND).filter((id) => !files.has(id)));
check('messages and the knot play through the stand-in', /playSfx\(sfxOrStandIn\(msg\.sfx\)\)/.test(main) && /playSfx\(sfxOrStandIn\('wind_knot'\)\)/.test(main));
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8'), folk = fs.readFileSync(path.join(root, 'lib/ashFolk.js'), 'utf8'), drove = fs.readFileSync(path.join(root, 'lib/droveRoad.js'), 'utf8');
check('the bell, the well, the need-fire, the stance and the gate name their own sounds', /'passing_bell'\)/.test(folk) && /'well_drink'\)/.test(folk) && /'needfire_kindle'/.test(drove) && /'stance_rest'/.test(drove) && (server.match(/sfx: 'march_gate'/g) || []).length === 2);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
