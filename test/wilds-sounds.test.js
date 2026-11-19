// client/wilds-sounds.js: the Wilds are not silent between the beck and the Hunt. A bed of wind for day and for
// night, crossfading with the light and giving way to the high wind on the besom; a creature calling now and then,
// by day or night and season, from one side or the other; and the village bell at midnight.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const raw = read('client/wilds-sounds.js');
const src = raw.replace(/^export default function/m, 'function').replace(/^export (const|function) /gm, '$1 ');
const W = new Function(src + '\nreturn { WILDS_BED, WILDS_CALLS, WILDS_MIDNIGHT_BELL, WILDS_CALL_GAP, wildsCallsNow, pickWildsCall, wildsBedVolumes, createWildsSoundscape };')();
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const dayIds = W.wildsCallsNow(false, 'samhain').map((c) => c.id), nightIds = W.wildsCallsNow(true, 'samhain').map((c) => c.id);
check('by day the day\'s creatures, by night the night\'s', dayIds.includes('raven_croak') && !dayIds.includes('tawny_owl') && nightIds.includes('tawny_owl') && !nightIds.includes('raven_croak'));
check('the season decides some: no curlew or nightjar at Samhain, the vixen and the fieldfares yes', !dayIds.includes('curlew_call') && !nightIds.includes('nightjar_churr') && nightIds.includes('vixen_scream') && dayIds.includes('fieldfare_flock'));
check('and in high summer the curlew, the lark and the nightjar, no fieldfares', W.wildsCallsNow(false, 'litha').some((c) => c.id === 'curlew_call') && W.wildsCallsNow(false, 'litha').some((c) => c.id === 'skylark_song') && W.wildsCallsNow(true, 'litha').some((c) => c.id === 'nightjar_churr') && !W.wildsCallsNow(false, 'litha').some((c) => c.id === 'fieldfare_flock'));
check('a sound not yet recorded is not asked for', W.wildsCallsNow(true, 'samhain', (id) => id === 'tawny_owl').map((c) => c.id).join() === 'tawny_owl');
let picks = []; let last = null; for (let i = 0; i < 200; i++) { const c = W.pickWildsCall(W.wildsCallsNow(false, 'samhain'), last, rnd); picks.push(c); last = c.id; }
check('never the same creature twice running', picks.every((c, i) => i === 0 || c.id !== picks[i - 1].id));
check('quiet, from one side or the other, a shade different in pitch each time', picks.every((c) => c.vol >= 0.22 && c.vol <= 0.52 && Math.abs(c.pan) <= 0.8 && c.rate >= 0.95 && c.rate <= 1.05) && picks.some((c) => c.pan < -0.3) && picks.some((c) => c.pan > 0.3));
const noon = W.wildsBedVolumes(1, 26), mid = W.wildsBedVolumes(0, 26), dusk = W.wildsBedVolumes(0.5, 26), high = W.wildsBedVolumes(1, 400);
check('the bed is the day\'s by day, the night\'s by night, both halfway at dusk', noon.day > 0 && noon.night === 0 && mid.night > 0 && mid.day === 0 && Math.abs(dusk.day - dusk.night) < 0.01);
check('low under everything', noon.day <= 0.35 && mid.night <= 0.35);
check('and it gives way to the high wind up on the besom', high.day === 0 && W.wildsBedVolumes(1, 160).day < noon.day);

// the running thing, with a stand-in clock
const heard = [], loops = {};
let now = 0, inW = true, dn = { lightAmount: 1, isNight: false, nightProgress: 0 }, alt = 0;
const sc = W.createWildsSoundscape({ inWilds: () => inW, getDayNight: () => dn, getSeason: () => 'samhain', getAlt: () => alt, have: () => true,
  playSfx: (id, vol, rate, pan) => heard.push({ id, vol, rate, pan, at: now }), startSfxLoop: (id, v) => { loops[id] = v; }, setSfxLoopVol: (id, v) => { loops[id] = v; }, stopSfxLoop: (id) => { delete loops[id]; }, rand: rnd });
for (now = 0; now <= 600000; now += 500) sc.tick(now);
const gaps = heard.slice(1).map((h, i) => h.at - heard[i].at);
check('the day\'s bed plays in the Wilds by day', loops.moor_day > 0 && !('moor_night' in loops));
check('a call every twenty seconds to a minute, and the first not at once', heard.length >= 9 && heard.length <= 32 && heard[0].at >= 8000 && gaps.every((g) => g >= 19500 && g <= 61000), { n: heard.length, first: heard[0] && heard[0].at });
const before = heard.length; inW = false; for (; now <= 700000; now += 500) sc.tick(now);
check('out of the Wilds: nothing calls and the bed stops', heard.length === before && !('moor_day' in loops));
inW = true; dn = { lightAmount: 0, isNight: true, nightProgress: 0.45 }; heard.length = 0;
for (; now <= 760000; now += 500) { if (now === 740000) dn = { lightAmount: 0, isNight: true, nightProgress: 0.51 }; sc.tick(now); }
check('at midnight the village bell, once', heard.filter((h) => h.id === 'midnight_bell').length === 1 && loops.moor_night > 0 && !('moor_day' in loops));
check('by night only the night\'s creatures', heard.filter((h) => h.id !== 'midnight_bell').every((h) => ['tawny_owl', 'vixen_scream'].includes(h.id)));
alt = 500; heard.length = 0; for (; now <= 900000; now += 500) sc.tick(now);
check('up in the high wind nothing on the ground is heard', heard.length === 0 && !('moor_night' in loops));

// every sound has a prompt that keeps to what it is
const man = JSON.parse(read('tools/audio/sfx.manifest.json'));
const ids = [W.WILDS_BED.day, W.WILDS_BED.night, W.WILDS_MIDNIGHT_BELL, ...W.WILDS_CALLS.map((c) => c.id)];
check('every sound has its prompt, and none asks for music or a voice', ids.every((id) => man.sfx.some((x) => x.id === id && /no music/i.test(x.prompt) && /no (human )?voice/i.test(x.prompt))), ids.filter((id) => !man.sfx.some((x) => x.id === id)));
check('the beds are loops that can go round without a seam', [W.WILDS_BED.day, W.WILDS_BED.night].every((id) => man.sfx.some((x) => x.id === id && x.loop === true && /loop without a seam/.test(x.prompt))));

const main = read('client/main.js'), audio = read('client/audio.js');
check('the game runs it each frame, only in the Wilds, and only with recorded sounds', /inWilds: \(\) => activeScene === wildsScene && !!me && !me\.isDead && me\.room === 'wilds'/.test(main) && /wildsSoundscape\.tick\(performance\.now\(\)\);/.test(main) && /have: \(id\) => typeof sfxAvailable === 'function' && sfxAvailable\(id\)/.test(main));
check('a recorded sound can come from one side', /function playSfx\(name, vol, rate, pan\)/.test(audio) && /createStereoPanner\(\); p\.pan\.value = Math\.max\(-1, Math\.min\(1, pan\)\)/.test(audio));
check('the lore says what is the record and what is the game\'s', /Record \(written from memory/.test(raw) && /are the game's/.test(raw));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
