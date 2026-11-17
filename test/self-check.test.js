// client/self-check.js: the report a player's own browser writes about itself.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const S = new Function(read('client/self-check.js').replace(/^export .*$/gm, '') + '\nreturn { strangeWords, browserName, selfCheckReport };')();

check('Safari is named as Safari', S.browserName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15') === 'Safari 18.1');
check('Chrome is not mistaken for Safari', /^Chrome 13/.test(S.browserName('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')));
check('inner names on screen are caught', S.strangeWords('You found a em_ash_ring in the dust and NaN gold').length === 2);
check('ordinary words are not', S.strangeWords('Press F to open the well-worn door. 12 gold.').length === 0);
const r = S.selfCheckReport({ build: 'abc123', ua: 'x Version/18.1 Safari/605', platform: 'MacIntel', w: 1440, h: 900, dpr: 2, fps: 58, gpu: 'Apple M2', gfx: 'High', room: 'wilds', x: 5000, y: 8000,
  floaters: { checked: 2110, floating: 1, list: [{ name: 'house', x: 10, z: 20, gap: 40 }] }, strange: [], errors: ['TypeError: x is undefined'], audio: '12 asked', socket: 'open', pad: false, keys: '1 changed', textSize: 'large' });
check('the report says where, what browser and how it ran', /Safari 18\.1 · MacIntel · 1440x900 @2/.test(r) && /58 fps · Apple M2/.test(r) && /place wilds at 5000,8000/.test(r));
check('and what it found', /floating 1 of 2110: house@10,20\+40/.test(r) && /odd text 0/.test(r) && /errors 1: TypeError/.test(r) && /keys 1 changed · text large/.test(r));
check('it fits the bug report box', S.selfCheckReport({ ua: '', w: 1, h: 1, dpr: 1, errors: new Array(3).fill('e'.repeat(500)), strange: new Array(4).fill('s'.repeat(300)) }).length <= 1000);
check('the button is in the bug panel and wired', /id="bugCheckBtn"/.test(read('public/index.html')) && /getElementById\('bugCheckBtn'\); if \(cb\) cb\.addEventListener\('click', selfCheck\)/.test(read('client/main.js')));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
