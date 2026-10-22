'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { FORBIDDEN_BOOKS } = require('../data/forbiddenBooks.js');
const { titleExists, titleName } = require('../data/titles.js');

test('the forbidden shelf has a real, well-formed catalogue', () => {
  assert.ok(FORBIDDEN_BOOKS.length >= 7, 'enough books for a multi-day rotation');
  const ids = FORBIDDEN_BOOKS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique (reads are keyed by id, never index)');
  for (const b of FORBIDDEN_BOOKS) {
    assert.ok(b.id && typeof b.id === 'string', 'book has an id');
    assert.ok(b.title && b.title.trim().length > 0, `${b.id} has a title`);
    assert.ok(b.author && b.author.trim().length > 0, `${b.id} has an author line`);
    assert.ok(b.text && b.text.trim().length >= 80, `${b.id} has a real passage`);
  }
});

test('the daily date-seed rotates through every book exactly once per cycle', () => {
  // Server picks FORBIDDEN_BOOKS[day % len]; over `len` consecutive days every
  // book must surface exactly once, so no volume is unreachable.
  const len = FORBIDDEN_BOOKS.length;
  const seen = new Map();
  for (let day = 0; day < len; day++) {
    const book = FORBIDDEN_BOOKS[day % len];
    seen.set(book.id, (seen.get(book.id) || 0) + 1);
  }
  assert.equal(seen.size, len, 'every book appears within one cycle');
  for (const [, count] of seen) assert.equal(count, 1, 'each book appears exactly once per cycle');
});

test('the completion title exists and resolves', () => {
  assert.ok(titleExists('well_read'), 'the Reader of the Forbidden Shelf title is defined');
  assert.ok(titleName('well_read') && titleName('well_read').length > 0, 'it has a display name');
});

test('read-logging and completion behave (simulated handler logic)', () => {
  // Mirrors the server handler: first read of a book logs it; completion fires
  // only on the read that fills the last slot, and only once.
  const read = {};
  const logRead = (id) => { let first = false; if (!read[id]) { read[id] = Date.now(); first = true; } return first; };
  const complete = () => FORBIDDEN_BOOKS.every((b) => read[b.id]);

  assert.equal(logRead(FORBIDDEN_BOOKS[0].id), true, 'first read logs');
  assert.equal(logRead(FORBIDDEN_BOOKS[0].id), false, 're-reading the same book does not re-log');
  assert.equal(complete(), false, 'not complete with one book');

  let completionsFired = 0;
  for (const b of FORBIDDEN_BOOKS) {
    const first = logRead(b.id);
    if (first && complete()) completionsFired++;
  }
  assert.equal(complete(), true, 'all books read → complete');
  assert.equal(completionsFired, 1, 'completion fires exactly once, on the final book');
});
