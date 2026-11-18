// client/key-remap.js: a chosen key becomes the action's ordinary key, a key
// whose action moved away does nothing, and two actions never share a key.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const src = read('client/key-remap.js').replace(/^export .*$/gm, '');
const K = new Function(src + '\nreturn { KEY_ACTIONS, normKey, keyLabel, keyAllowed, cleanBinds, boundKey, rebind, translateKey };')();

check('with nothing changed, every key is itself', K.translateKey({}, 'f') === null && K.translateKey(null, 'w') === null);
{
  const r = K.rebind({}, 'f', 'x');
  check('give Use the X key', r.binds.f === 'x' && !r.swapped);
  check('X now acts as F', K.translateKey(r.binds, 'x') === 'f' && K.translateKey(r.binds, 'X') === 'f');
  check('F, left without an action, does nothing', K.translateKey(r.binds, 'f') === '');
  check('other keys are untouched', K.translateKey(r.binds, 'w') === null);
  check('the prompt can name the key in use', K.keyLabel(K.boundKey(r.binds, 'f')) === 'X' && K.keyLabel(K.boundKey(r.binds, ' ')) === 'Space');
}
{
  const r = K.rebind({}, 'f', 'g');
  check('choosing a key another action holds swaps the two', r.swapped === 'g' && r.binds.f === 'g' && r.binds.g === 'f');
  check('and each key does the other job', K.translateKey(r.binds, 'g') === 'f' && K.translateKey(r.binds, 'f') === 'g');
  const back = K.rebind(r.binds, 'f', 'f');
  check('setting it back undoes the swap', Object.keys(back.binds).length === 0, back.binds);
}
{
  let b = K.rebind({}, 'f', 'x').binds; b = K.rebind(b, 'g', 'f').binds;
  check('a freed key can be given to something else', b.g === 'f' && K.translateKey(b, 'f') === 'g' && K.translateKey(b, 'x') === 'f' && K.translateKey(b, 'g') === '');
  const keys = K.KEY_ACTIONS.map((a) => K.boundKey(b, a[0]));
  check('no two actions share a key', new Set(keys).size === keys.length);
}
for (const k of ['Escape', 'Enter', 'ArrowUp', '1', '0', 'Shift', 'Tab', 'F5', '-']) check(`${k} cannot be chosen`, !!K.rebind({}, 'f', k).error && !K.keyAllowed(k));
check('Space can be chosen', K.rebind({}, 'f', ' ').binds.f === ' ' || K.rebind({}, 'f', ' ').swapped === ' ');
check('saved rubbish is thrown out', JSON.stringify(K.cleanBinds({ f: 'x', zz: 'y', g: 'x', r: 'Escape', w: 'w' })) === '{"f":"x"}');
{
  const main = read('client/main.js');
  check('the remap is installed in front of the game', /installKeyRemap\(/.test(main));
  check('the use prompt names the bound key', /Press \$\{keyLabel\(boundKey\(keyBinds, 'f'\)\)\} to/.test(main));
}
{
  const R = new Function(src + '\nreturn { relabelKeys };')().relabelKeys;
  const b = { w: 'u', f: 'x' };
  check('the help sheet shows the key in use', R('F', b) === 'X' && R('W/S', b) === 'U/S' && R('R', b) === 'R' && R('Space', { ' ': 'z' }) === 'Z');
  check('and leaves alone what is not a rebindable key', R('1–9, 0, -, =', b) === '1–9, 0, -, =' && R('hold C', b) === 'hold C' && R('Drag', b) === 'Drag' && R('P', b) === 'P');
  check('the sheet is re-worded each time it opens', /function openControlsModal\(\) \{\n  applyKeyLabels\(\);/.test(read('client/main.js')));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
