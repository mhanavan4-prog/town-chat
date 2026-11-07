// The Charm Book's tier tally (client/charm-tally.js): how much of what you've
// written in, and of the whole book, is record, folk or revival.
const { buildCharmBook } = require('../lib/charmBook.js');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

(async () => {
  const { tierTally } = await import('../client/charm-tally.js');
  const fresh = buildCharmBook({ acct: {}, prog: {}, seasonKey: null });
  const t0 = tierTally(fresh);
  const count = (b, f) => b.chapters.reduce((n, c) => n + c.entries.filter(f).length, 0);
  check('a fresh book: nothing written in, and the whole book counted by tier', t0.metTotal === 0 && t0.total === count(fresh, () => true) && t0.all.record === count(fresh, (e) => e.tier === 'record') && t0.all.folk === count(fresh, (e) => e.tier === 'folk') && t0.all.revival === count(fresh, (e) => e.tier === 'revival'), t0);
  check('most of the book is on the record, and some of it is modern revival', t0.all.record > t0.all.folk && t0.all.revival > 0);
  const well = buildCharmBook({ acct: { ritesDone: ['elf_shot', 'toad_bone'], booksRead: ['gardner'] }, prog: {}, seasonKey: null });
  const t1 = tierTally(well);
  check('what you\'ve written in is counted by its own tier: Elf-Shot record, the toadman folk, Gardner revival', t1.metTotal === 3 && t1.met.record === 1 && t1.met.folk === 1 && t1.met.revival === 1, t1.met);
  check('…and the parts add up', t1.met.record + t1.met.folk + t1.met.revival === t1.metTotal && t1.all.record + t1.all.folk + t1.all.revival === t1.total);
  check('an empty book is all zeros', tierTally(null).total === 0 && tierTally({ chapters: [] }).metTotal === 0);
  const CB = fs.readFileSync(path.join(__dirname, '../client/charm-book.js'), 'utf8');
  check('the contents page shows the tally under the tier key (yours, when there is any, and the whole book\'s)', /tierTally\(state\)/.test(CB) && /if \(tally\.metTotal\) tl\.appendChild/.test(CB) && /All \(\$\{tally\.total\}\)/.test(CB) && !/innerHTML/.test(CB));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
