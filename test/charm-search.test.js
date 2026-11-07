// Search the Charm Book (client/charm-search.js): one box across every
// chapter, by name, and by lore or source once an entry is written in; an
// un-met caller is never found, and an un-met entry only by its name.
const { buildCharmBook } = require('../lib/charmBook.js');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

(async () => {
  const { searchBook } = await import('../client/charm-search.js');
  const fresh = buildCharmBook({ acct: {}, prog: {}, seasonKey: null });
  const well = buildCharmBook({ acct: { ritesDone: ['elf_shot', 'shewstone'], callers: { byId: { elf_shot_cow: 1 } }, booksRead: ['kirk'] }, prog: {}, seasonKey: null });

  check('nothing for an empty or one-letter query', searchBook(well, '').length === 0 && searchBook(well, 'a').length === 0);
  const elf = searchBook(well, 'elf');
  check('"elf" finds Elf-Shot (written in), with its chapter', elf.some((h) => h.id === 'elf_shot' && h.met && h.chapter === 'household'));
  check('…and the met caller who brought it', elf.some((h) => h.id === 'elf_shot_cow' && h.chapter === 'callers'));
  check('title matches come before lore matches', elf.findIndex((h) => h.id === 'elf_shot') < elf.findIndex((h) => h.score === 1) || elf.every((h) => h.score === 0));
  const kirk = searchBook(well, 'kirk');
  check('a written-in entry is found by its source ("Kirk"), with a snippet cut at whole words', kirk.some((h) => h.id === 'elf_shot' && /Kirk/.test(h.snippet) && /^…[A-Z]?[a-z]+ /.test(h.snippet) && !/^…e /.test(h.snippet)), kirk.map((h) => h.snippet));
  check('…and the book read on the Real Shelf by its title', searchBook(well, 'secret common').some((h) => h.id === 'kirk' && h.chapter === 'library'));
  const hidden = searchBook(fresh, 'butter');
  check('an un-met caller is never found, even by name', !hidden.some((h) => h.chapter === 'callers'));
  check('an un-met entry is found by its name only, not its lore', searchBook(fresh, 'Elf-Shot').some((h) => h.id === 'elf_shot' && !h.met && !h.snippet) && !searchBook(fresh, 'Pitcairn').some((h) => h.id === 'elf_shot'));
  check('every word must match, accents and case aside ("bride bed")', searchBook(well, 'BRIDE bed').some((h) => h.id === 'bridesbed') && searchBook(well, 'samhain zzzz').length === 0);
  check('Old English is found as written ("wið færstice")', searchBook(well, 'wið færstice').some((h) => h.id === 'elf_shot'));
  check('results are capped', searchBook(well, 'the', 10).length === 10);

  const CB = fs.readFileSync(path.join(__dirname, '../client/charm-book.js'), 'utf8');
  check('the contents page has the search box, results replace the contents while searching, textContent only', /cbBookSearch/.test(CB) && /searchBook\(state, bookQuery\)/.test(CB) && /rest\.classList\.toggle\('hidden'/.test(CB) && !/innerHTML/.test(CB));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
