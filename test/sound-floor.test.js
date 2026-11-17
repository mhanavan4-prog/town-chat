// client/sound-floor.js: an action that brings no sound of its own gets a soft
// one, and an action that does is never doubled.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const src = read('client/sound-floor.js').replace(/^export .*$/gm, '');
const { INTERACT_QUIET_MS, CLICK_QUIET_MS, createSoundFloor, clickWantsSound } = new Function(src + '\nreturn { INTERACT_QUIET_MS, CLICK_QUIET_MS, createSoundFloor, clickWantsSound };')();

{
  let asked = 0; const played = []; const timers = [];
  const floor = createSoundFloor(() => asked, (id, vol) => { played.push([id, vol]); asked++; }, (fn, ms) => timers.push([fn, ms]));
  floor('interact_soft', INTERACT_QUIET_MS, 0.6);
  check('it waits before deciding', played.length === 0 && timers.length === 1 && timers[0][1] === INTERACT_QUIET_MS);
  timers.shift()[0]();
  check('a silent action gets the soft sound', played.length === 1 && played[0][0] === 'interact_soft' && played[0][1] === 0.6);
  floor('ui_click', CLICK_QUIET_MS, 0.5);
  asked++;                                   // the action brought its own sound meanwhile
  timers.shift()[0]();
  check('an action with its own sound is not doubled', played.length === 1);
  // an action that sounds at once, before the floor is even asked for (the portal)
  const since = asked; asked++;
  floor('interact_soft', INTERACT_QUIET_MS, 0.6, since);
  timers.shift()[0]();
  check('a sound made at once by the action itself is not doubled', played.length === 1);
  check('the wait for a server reply is longer than the wait for a button', INTERACT_QUIET_MS > CLICK_QUIET_MS && INTERACT_QUIET_MS >= 300);
}

{
  // closest() over a tiny stand-in for the DOM: an element is a list of the selectors it or its parents match.
  const el = (matches, extra) => ({ closest(sel) { const want = sel.split(',').map((s) => s.trim()); return matches.find((m) => want.includes(m.sel)) || null; }, ...extra });
  const btn = { sel: 'button', disabled: false, getAttribute: () => null };
  const off = { sel: 'button', disabled: true, getAttribute: () => null };
  const row = { sel: '.menuRow', getAttribute: () => null };
  check('a button wants a sound', clickWantsSound(el([btn])) === true);
  check('a menu row wants a sound', clickWantsSound(el([row])) === true);
  check('a switched-off button does not', clickWantsSound(el([off])) === false);
  check('the game canvas does not', clickWantsSound(el([])) === false);
  check('typing into a box inside a button-like row does not', clickWantsSound(el([{ sel: 'input' }, row])) === false);
  check('nothing at all does not', clickWantsSound(null) === false);
}

{
  const main = read('client/main.js');
  check('using a thing in the world goes through the floor', /function tryInteract\(\) \{[\s\S]{0,400}const heardBefore = window\.__sfxAsked \|\| 0;[^\n]*\n\s*tryInteractNow\(\);[\s\S]{0,120}soundFloor\('interact_soft', INTERACT_QUIET_MS, 0\.6, heardBefore\)/.test(main));
  check('one listener covers every button', /document\.addEventListener\('click', \(e\) => \{ if \(e\.isTrusted !== false && clickWantsSound\(e\.target\)\) soundFloor\('ui_click', CLICK_QUIET_MS/.test(main));
  check('every ask is counted, even when muted', /window\.__sfxAsked = \(window\.__sfxAsked \|\| 0\) \+ 1;[^\n]*\n\s*if \(sfxMuted\) return;/.test(read('client/audio.js')));
  const man = JSON.parse(read('tools/audio/sfx.manifest.json'));
  check('the soft sound has a prompt and a stand-in until it is recorded', man.sfx.some((s) => s.id === 'interact_soft' && s.prompt.length > 40) && /interact_soft: 'ui_click'/.test(main));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
