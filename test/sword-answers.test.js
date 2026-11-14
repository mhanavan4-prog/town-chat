// The big sword button must always answer. Its "No enemies nearby" notice goes to the Log, not the screen, so with
// nothing in reach the button looked dead (reported from a phone, in town). It swings at the air instead.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');

test('with nothing in reach the strike still swings, and still tells the Log why', () => {
  const fn = src.slice(src.indexOf('function strikeNearestEnemy()'), src.indexOf('let _airSwingAt'));
  const miss = fn.slice(fn.lastIndexOf('} else {'));
  assert.match(miss, /triggerAttackAnim\(\)/);
  assert.match(miss, /playSfx\('swing'\)/);
  assert.match(miss, /No enemies nearby to strike\./);
  assert.match(miss, /now - _airSwingAt > \d+/, 'a held or hammered button does not restart the swing every frame');
});

test('a strike that finds something is unchanged: it tells the server', () => {
  const fn = src.slice(src.indexOf('function strikeNearestEnemy()'), src.indexOf('let _airSwingAt'));
  assert.match(fn, /ws\.send\(JSON\.stringify\(\{ type: 'strike', targetType: nearest\.kind, targetId: nearest\.targetId \}\)\)/);
});
