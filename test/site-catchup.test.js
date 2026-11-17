// The site says what the game now does: abilities by level on the class pages, the besom and macros in the FAQ and on the landing page.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the class API gives each ability the level that opens it, and the page shows it', () => {
  const server = read('server.js'), page = read('public/class.html');
  assert.match(server, /abilities: \(cls\.abilities \|\| \[\]\)\.map\(\(a\) => Object\.assign\(\{\}, a, \{ level: lv\[a\.id\] \|\| 1 \}\)\)/);
  assert.match(page, /a\.level > 1 \? ' Opens at Level ' \+ a\.level \+ '\.' : ' Yours from the start\.'/);
  assert.match(page, /'<span class="lv">Lv '\+a\.level\+'<\/span>'/);
  const { UNLOCK_START } = require('../data/abilityUnlocks');
  assert.strictEqual(UNLOCK_START, 3, 'the pages say three are yours from the start');
  assert.match(page, /Three are yours from the start/);
});

test('the FAQ covers the besom, the bar keys, abilities by level and macros, and says what Moonstones buy', () => {
  const faq = read('public/faq.html');
  const { MACROS } = require('../data/macros');
  const { MOUNT } = require('../lib/besomMount');
  assert.match(faq, /<kbd>G<\/kbd> — get on or off the <strong>besom<\/strong> \(from Level 20/);
  assert.strictEqual(MOUNT.level, 20);
  assert.match(faq, /hold <kbd>Space<\/kbd> to climb and <kbd>Shift<\/kbd> to sink/);
  assert.match(faq, /<h3>Do abilities all come at once\?<\/h3>/);
  assert.match(faq, /<h3>What are macros\?<\/h3>/);
  assert.match(faq, /three macros of two abilities each for free; longer ones, up to six/);
  assert.strictEqual(MACROS.slots, 3); assert.strictEqual(MACROS.baseSteps, 2); assert.strictEqual(MACROS.sizes[MACROS.sizes.length - 1].steps, 6);
  assert.match(faq, /optional conveniences, such as longer macros and skipping a wait/);
});

test('the landing page shows the besom, the kit, macros and the Smithy, in a full grid', () => {
  const land = read('public/landing.html');
  for (const h of ['Ride the besom', 'A kit you grow into', 'Macros', 'The Smithy']) assert.ok(land.includes('<h3>' + h + '</h3>'), h);
  assert.match(land, /Wayland's Smithy since a charter of 955/);
  assert.match(land, /in 1738 Francis Wise wrote down/);
  const world = land.slice(land.indexOf('<h3>Honest by design</h3>') - 200, land.indexOf('<h3>Play anywhere</h3>') + 300);
  assert.strictEqual((world.match(/class="feat"/g) || []).length % 3, 0, 'the world grid fills its rows of three');
});
