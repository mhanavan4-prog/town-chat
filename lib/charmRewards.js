// Charm Book rewards — pure: what a book (lib/charmBook.js) has earned that an
// account's record (accounts[k].charmRewards) hasn't been given yet, and the
// view the book's contents page draws. The server pays out (server.js).
const { CHAPTER_PURSE, MILESTONES } = require('../data/charmRewards');
const { TITLES } = require('../data/titles');

function bookPercent(book) {
  let met = 0, total = 0;
  for (const c of book.chapters) { met += c.met; total += c.total; }
  return { met, total, pct: total ? Math.floor((met * 100) / total) : 0 };
}

function dueRewards(book, done) {
  const given = done || {};
  const chaptersGiven = new Set(given.chapters || []);
  const milestonesGiven = new Set(given.milestones || []);
  const chapters = book.chapters
    .filter((c) => c.total > 0 && !c.noPurse && c.met >= c.total && !chaptersGiven.has(c.key))
    .map((c) => ({ key: c.key, title: c.title, icon: c.icon, gold: CHAPTER_PURSE }));
  const { pct } = bookPercent(book);
  const milestones = MILESTONES.filter((m) => pct >= m.at && !milestonesGiven.has(m.key));
  return { chapters, milestones };
}

function rewardsView(book, done) {
  const given = new Set(((done || {}).milestones) || []);
  const { met, total, pct } = bookPercent(book);
  return {
    met, total, pct, chapterPurse: CHAPTER_PURSE,
    milestones: MILESTONES.map((m) => ({
      key: m.key, at: m.at, label: m.label, gold: m.gold, dye: m.dye || null,
      title: (TITLES[m.title] || {}).name || m.title, glyph: (TITLES[m.title] || {}).glyph || '📜',
      given: given.has(m.key),
    })),
  };
}

module.exports = { bookPercent, dueRewards, rewardsView };
