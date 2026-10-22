'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { titleExists, titleName } = require('../data/titles.js');

// Mirrors the server's arcade daily-board core (server.js ARCADE_GAMES + the
// arcade_score handler) so the ranking / cap / champion rules are locked.
const GAMES = { snake: { cap: 260, champ: 20 }, breakout: { cap: 55, champ: 25 } };

function makeBoard() {
  const board = new Map(); // accountKey → {name, score}
  // Returns { accepted, rank, champion } for a submitted score.
  return function submit(game, key, name, score) {
    const cfg = GAMES[game];
    if (!cfg) return { accepted: false };
    score = Math.floor(score);
    if (!Number.isFinite(score) || score < 0 || score > cfg.cap) return { accepted: false };
    const cur = board.get(key);
    if (!cur || score > cur.score) board.set(key, { name, score });
    const mine = board.get(key).score;
    const rank = 1 + [...board.values()].filter((e) => e.score > mine).length;
    const champion = rank === 1 && mine >= cfg.champ;
    return { accepted: true, rank, champion };
  };
}

test('the champion title exists and resolves', () => {
  assert.ok(titleExists('arcade_champion'));
  assert.ok(titleName('arcade_champion') && titleName('arcade_champion').length > 0);
});

test('impossible scores above the cap are rejected, not recorded', () => {
  const submit = makeBoard();
  assert.equal(submit('snake', 'a', 'Ada', 999).accepted, false, 'snake cap enforced');
  assert.equal(submit('breakout', 'a', 'Ada', 500).accepted, false, 'breakout cap enforced');
  assert.equal(submit('snake', 'a', 'Ada', -5).accepted, false, 'negatives rejected');
  // after rejected submissions the board is still empty → a legit score ranks #1
  assert.deepEqual(submit('snake', 'a', 'Ada', 30), { accepted: true, rank: 1, champion: true });
});

test('a board keeps each account\'s best and ranks by it', () => {
  const submit = makeBoard();
  submit('snake', 'a', 'Ada', 15);
  submit('snake', 'a', 'Ada', 9);          // lower — must not replace her 15
  const b = submit('snake', 'b', 'Bram', 22);
  assert.equal(b.rank, 1, 'Bram leads at 22');
  const a2 = submit('snake', 'a', 'Ada', 25); // Ada retakes the lead
  assert.equal(a2.rank, 1);
  assert.equal(a2.champion, true, '#1 and over the champ bar → champion');
});

test('leading the board below the skill bar is not a champion', () => {
  const submit = makeBoard();
  const r = submit('snake', 'a', 'Ada', 10); // #1 but under champ(20)
  assert.equal(r.rank, 1);
  assert.equal(r.champion, false, 'topping an empty board with a weak score is not a champion');
});

test('breakout uses its own caps and bar', () => {
  const submit = makeBoard();
  assert.equal(submit('breakout', 'a', 'Ada', 60).accepted, false, 'over breakout cap');
  assert.equal(submit('breakout', 'a', 'Ada', 24).champion, false, 'under breakout champ bar');
  assert.equal(submit('breakout', 'b', 'Bram', 40).champion, true, 'clear champion run');
});
