// The game's sound must come back by itself: Safari parks the AudioContext as 'interrupted' (sleep, another tab or
// app taking the sound), not only 'suspended', and keyboard players may never click.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }
const a = fs.readFileSync(path.join(__dirname, '..', 'client/audio.js'), 'utf8');
check('asleep is anything but running (so Safari\'s "interrupted" is woken too)', /function audioAsleep\(\) \{ return !!audioCtx && audioCtx\.state !== 'running' && audioCtx\.state !== 'closed'; \}/.test(a));
check('nothing still wakes only a "suspended" context', !/state === 'suspended'/.test(a));
check('a click, a key, or coming back to the tab wakes it', /addEventListener\('pointerdown', wakeAudio\)/.test(a) && /addEventListener\('keydown', wakeAudio\)/.test(a) && /visibilitychange', \(\) => \{ if \(!document\.hidden\) wakeAudio\(\); \}/.test(a));
check('a refused wake is swallowed, not thrown', /const p = audioCtx\.resume\(\); if \(p && p\.catch\) p\.catch\(\(\) => \{\}\);/.test(a));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
