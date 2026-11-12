// World signs are written for a keyboard; on a phone they must not tell the
// player to press a key she does not have.
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const dir = path.join(__dirname, '..', 'client');
const src = fs.readFileSync(path.join(dir, 'sprites.js'), 'utf8');
// lift the pure function out of the module to run it here
const body = /export function signTextFor\(text, touch\) \{([\s\S]*?)\n\}/.exec(src)[1];
const signTextFor = new Function('text', 'touch', body);
check('with a keyboard a sign says what it always said', signTextFor('🛏️ A bed — Press F', false) === '🛏️ A bed — Press F');
check('on a phone the bare instruction is dropped', signTextFor('🛏️ A bed — Press F', true) === '🛏️ A bed' && signTextFor('🌿 Mother Yarrow — the Green Path · Press F', true) === '🌿 Mother Yarrow — the Green Path');
check('and "Press F to do a thing" becomes "tap to do a thing"', signTextFor("🕯️ Witch's Cave — Press F to enter", true) === "🕯️ Witch's Cave — tap to enter" && signTextFor('Empty — Press F to claim', true) === 'Empty — tap to claim');
check('a sign with no instruction is left alone', signTextFor('⛓️ The gibbet at the crossroads', true) === '⛓️ The gibbet at the crossroads');
check('every sign is passed through it', /export function makeSignSprite\(text\) \{\n {2}text = signTextFor\(text, SIGN_TOUCH\);/.test(src));
// every "Press F" a sign can carry is of a shape the function handles
const left = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/(?:makeSignSprite|sign)\((['"`])((?:(?!\1).)*Press F(?:(?!\1).)*)\1/g)) { const t = m[2].replace(/\$\{[^}]*\}/g, 'X'); if (/Press F/.test(signTextFor(t, true))) left.push(f + ': ' + t); }
check('no sign in the game still says Press F on a phone', left.length === 0, left);
const main = fs.readFileSync(path.join(dir, 'main.js'), 'utf8');
check('the cottage\'s arrival message speaks to a phone too', (main.match(/isTouchDevice\(\) \? 'Tap the prompt' : 'Press F'\} at the door/g) || []).length === 2);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
