// Gold is shown as the gold coin emblem everywhere (client/gold-coin.js): the 🪙 emoji is silver on Apple.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('text is split around every coin, with the variation selector swallowed', async () => {
  const { coinParts, COIN_CHAR } = await import('../client/gold-coin.js');
  assert.deepStrictEqual(coinParts('+12' + COIN_CHAR + ' · done'), ['+12', null, ' · done']);
  assert.deepStrictEqual(coinParts(COIN_CHAR + '️ 5g'), [null, ' 5g']);
  assert.deepStrictEqual(coinParts('a' + COIN_CHAR + COIN_CHAR + 'b'), ['a', null, null, 'b']);
  assert.deepStrictEqual(coinParts('no coin here'), ['no coin here']);
  assert.deepStrictEqual(coinParts(''), ['']);
});

test('the emblem is a gold SVG, used by every .coin chip, and the emoji inside it is hidden', async () => {
  const { COIN_SVG_URI } = await import('../client/gold-coin.js');
  assert.match(COIN_SVG_URI, /^data:image\/svg\+xml,/);
  assert.match(decodeURIComponent(COIN_SVG_URI), /#ffd84f/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.includes('background:url("' + COIN_SVG_URI + '") center / contain no-repeat;'));
  assert.match(html, /\.coin > \.coinT \{ display:none; \}/);
});

test('the page is watched from the start', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  assert.match(main, /try \{ watchCoins\(document\); \} catch \(_\) \{\}/);
});
