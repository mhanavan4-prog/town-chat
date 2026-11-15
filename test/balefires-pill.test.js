// The Balefires pill takes itself off once the day's fires are all lit: a few seconds of "✓" as the last one
// catches, then gone; and never shown to someone who arrives with them already lit.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('the pill dismisses itself when the count is complete', () => {
  const m = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8');
  const fn = m.slice(m.indexOf('function showWildsFindsHud(msg) {'), m.indexOf('\n', m.indexOf('function hideFindsHud(el)')));
  assert.match(fn, /const justDone = msg\.complete && _balefiresWereDone === false;/);
  assert.match(fn, /if \(msg\.complete && !justDone\) \{ if \(el\.dataset\.of === 'wilds'\) hideFindsHud\(el\); return; \}/);
  assert.match(fn, /if \(justDone\) _balefiresDoneT = setTimeout\(\(\) => \{ if \(el\.dataset\.of === 'wilds'\) hideFindsHud\(el\); \}, BALEFIRES_DONE_MS\);/);
  assert.match(fn, /let _balefiresWereDone = null/, 'not known until the server has spoken: arriving with them lit shows nothing');

  // the same logic, run
  const calls = [];
  const el = { dataset: {}, classList: { add: (c) => calls.push('+' + c), remove: (c) => calls.push('-' + c) }, innerHTML: '' };
  const body = fn.replace('function showWildsFindsHud(msg) {', 'function showWildsFindsHud(msg) { const me = { room: "wilds" };');
  const run = new Function('document', 'setTimeout', 'clearTimeout', body + '; return showWildsFindsHud;')(
    { getElementById: () => el, body: { classList: { add() {}, remove() {} } } }, (f, ms) => { calls.push('timer ' + ms); return 1; }, () => {});
  run({ complete: true, lit: [1, 2], total: 2 });
  assert.ok(!calls.includes('-hidden'), 'already lit on arrival: never shown');
  calls.length = 0; el.dataset = {};
  const run2 = new Function('document', 'setTimeout', 'clearTimeout', body + '; return showWildsFindsHud;')(
    { getElementById: () => el, body: { classList: { add() {}, remove() {} } } }, (f, ms) => { calls.push('timer ' + ms); f.__f = f; run2.last = f; return 1; }, () => {});
  run2({ complete: false, lit: [1], total: 2 });
  assert.ok(calls.includes('-hidden') && /1\/2/.test(el.innerHTML), 'counting: shown');
  calls.length = 0;
  run2({ complete: true, lit: [1, 2], total: 2 });
  assert.ok(/✓/.test(el.innerHTML) && calls.includes('timer 8000'), 'the last one lit: a tick, on a timer');
  run2.last(); assert.ok(calls.includes('+hidden'), 'and then it goes');
  calls.length = 0;
  run2({ complete: true, lit: [1, 2], total: 2 });
  assert.ok(!calls.includes('-hidden'), 'and stays gone');
});
