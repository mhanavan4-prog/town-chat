// ---------------------------------------------------------------------------
// The Charm Book's "Where next" page: what you can write in today. Built from
// the book itself (so it agrees with what it says is met) plus the things that
// change by the day: who is at your door, which festival's season it is, the
// planetary hour, and the old calendar. Pure: the server passes in the moment.
//
// Each item: { key, icon, title, lines: [string], chapter?: key, action?: 'board' }.
// `chapter` opens that chapter of the book; `action: 'board'` opens the Board
// (where the callers are). Items that can be done right now come first.
// ---------------------------------------------------------------------------
const { CALLERS } = require('../data/callers');
const { HALLOWEEN_RITES } = require('../data/halloween');
const { YULE_RITES } = require('../data/yule');
const { WHEEL_RITES } = require('../data/wheelRites');

// What finishing a caller's visit writes into the book: the caller's own entry
// and every charm said and rite worked on the way.
function writesOf(caller) {
  const out = [{ chapter: 'callers', id: caller.id }];
  for (const s of caller.steps || []) {
    if (s.kind === 'charm') out.push({ chapter: 'charms', id: s.charm });
    else if (s.kind === 'knots') out.push({ chapter: 'charms', id: s.charm || 'warts' });
    else if (s.kind === 'rite') out.push({ chapter: null, id: s.rite });
  }
  return out;
}

// Which chapter holds a season's rites.
function seasonChapter(key) { return key === 'samhain' ? 'halloween' : key === 'yule' ? 'yule' : 'feasts'; }
function seasonRiteKeys(key) {
  if (key === 'samhain') return Object.keys(HALLOWEEN_RITES);
  if (key === 'yule') return Object.keys(YULE_RITES);
  return Object.values(WHEEL_RITES).filter((r) => r.season === key).map((r) => r.key);
}

const firstSentence = (t) => { const m = String(t || '').match(/^.*?[.!?](?=\s|$)/); return m ? m[0] : String(t || ''); };
const listOf = (xs, n = 3) => xs.length <= n ? xs.join(', ') : `${xs.slice(0, n).join(', ')} and ${xs.length - n} more`;
const mins = (ms) => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 90 ? `${Math.round(m / 60)} hours` : `${m} minute${m === 1 ? '' : 's'}`; };

function whereNext({ book, offeredIds = [], season = null, nextSeason = null, oldDay = null, hours = [], hourHerbs = {}, now = Date.now() }) {
  if (!book || !Array.isArray(book.chapters)) return [];
  // Every entry in the book, by chapter and id, and every rite by id wherever it lives.
  const entry = {};
  const riteEntry = {};
  for (const c of book.chapters) {
    for (const e of c.entries) {
      entry[c.key + ':' + e.id] = { ...e, chapterKey: c.key };
      if (c.key === 'halloween' || c.key === 'yule' || c.key === 'feasts' || c.key === 'household') riteEntry[e.id] = { ...e, chapterKey: c.key };
    }
  }
  const find = (w) => (w.chapter ? entry[w.chapter + ':' + w.id] : riteEntry[w.id]) || null;
  const items = [];

  // 🚪 Today's callers who would write something new.
  const byId = Object.fromEntries(CALLERS.map((c) => [c.id, c]));
  const doorLines = [];
  const doorCharms = new Set();
  for (const id of offeredIds) {
    const c = byId[id];
    if (!c) continue;
    const seen = new Set();
    const fresh = writesOf(c).map(find).filter((e) => e && !e.met && !seen.has(e.chapterKey + ':' + e.id) && seen.add(e.chapterKey + ':' + e.id));
    if (!fresh.length) continue;
    for (const e of fresh) if (e.chapterKey === 'charms') doorCharms.add(e.id);
    // A rite that shares the caller's title ("The Blue Clue") isn't named twice.
    const names = fresh.filter((e) => e.chapterKey !== 'callers').map((e) => e.title.replace(/ · .*$/, '')).filter((t) => t.toLowerCase() !== c.title.toLowerCase());
    doorLines.push(`${c.icon} ${c.caller}: ${c.title}` + (names.length ? ` (${names.join(', ')})` : ''));
  }
  if (doorLines.length) {
    items.push({ key: 'door', icon: '🚪', title: 'At your door today', lines: [...doorLines, 'See them on the Board in the square; they change at midnight.'], action: 'board', now: true });
  }

  // ⏳ The planetary hour: the one now, if its planet isn't kept yet, else the next unkept one.
  const hoursCh = book.chapters.find((c) => c.key === 'hours');
  const unkept = new Set(hoursCh ? hoursCh.entries.filter((e) => !e.met).map((e) => e.id) : []);
  if (unkept.size && hours.length) {
    const h = hours.find((x) => unkept.has(x.planet));
    if (h) {
      const herbs = hourHerbs[h.planet] || [];
      const what = herbs.length ? `Gather ${listOf(herbs, 2)}, or brew its tea` : 'Brew its tea';
      const isNow = now >= h.start && now < h.end;
      items.push({
        key: 'hour', icon: h.glyph, chapter: 'hours', now: isNow,
        title: isNow ? `The hour of ${h.name} is now` : `The hour of ${h.name} comes in ${mins(h.start - now)}`,
        lines: [`${what} in it` + (isNow ? `: ${mins(h.end - now)} left.` : '.')],
      });
    }
  }

  // ☸️ This festival's season: its callers and customs still to come.
  if (season && season.key) {
    const ch = book.chapters.find((c) => c.key === seasonChapter(season.key));
    const riteKeys = new Set(seasonRiteKeys(season.key));
    const rites = ch ? ch.entries.filter((e) => riteKeys.has(e.id)) : [];
    const left = rites.filter((e) => !e.met);
    const seasonCallers = CALLERS.filter((c) => c.season === season.key);
    const until = nextSeason && nextSeason.name ? ` until ${nextSeason.name}` : '';
    if (seasonCallers.length && left.length) {
      items.push({
        key: 'season', icon: season.glyph || '☸️', chapter: ch.key,
        title: left.length === rites.length ? `${season.name}: ${rites.length} customs to work` : `${season.name}: ${left.length} of its ${rites.length} customs still to work`,
        lines: [`Still to come: ${listOf(left.map((e) => e.title.replace(/ · .*$/, '')), 4)}.`, `One of its callers knocks first every day${until}.`],
      });
    } else if (seasonCallers.length) {
      items.push({
        key: 'season', icon: season.glyph || '☸️', chapter: ch.key,
        title: `${season.name}: every custom worked`,
        lines: [nextSeason && nextSeason.name ? `The next festival is ${nextSeason.name}; its callers come then.` : 'The next festival brings new callers.'],
      });
    }
  }

  // 📅 The old calendar: today's custom, or the next.
  if (oldDay) {
    const t = (oldDay.today || [])[0];
    if (t) {
      items.push({ key: 'old', icon: t.icon || '📅', title: `Today in the old calendar: ${t.title}`, lines: [firstSentence(t.text), 'More in the Commonplace Book.'], now: true });
    } else if (oldDay.next) {
      const n = oldDay.next;
      items.push({ key: 'old', icon: n.icon || '📅', title: `Next in the old calendar: ${n.title}`, lines: [`In ${n.inDays} day${n.inDays === 1 ? '' : 's'}. ${firstSentence(n.text)}`] });
    }
  }

  // 📚 Unread on the Real Shelf.
  const lib = book.chapters.find((c) => c.key === 'library');
  const unread = lib ? lib.entries.filter((e) => !e.met) : [];
  if (unread.length) {
    items.push({ key: 'library', icon: '📚', chapter: 'library', title: `${unread.length} book${unread.length === 1 ? '' : 's'} unread on the Real Shelf`, lines: [`${listOf(unread.map((e) => e.title), 2)}. In the Library, any time.`] });
  }

  // 🗣️ Charms not yet said, beyond today's callers.
  const charmsCh = book.chapters.find((c) => c.key === 'charms');
  const untried = charmsCh ? charmsCh.entries.filter((e) => !e.met && !doorCharms.has(e.id)) : [];
  if (untried.length) {
    items.push({ key: 'charms', icon: '🗣️', chapter: 'charms', title: `${untried.length} charm${untried.length === 1 ? '' : 's'} not yet said`, lines: [`${listOf(untried.map((e) => e.title), 3)}. Each comes with a caller who needs it; they come round in time.`] });
  }

  // 📜 Chapters nearly finished (a purse waits at the end of each).
  const near = book.chapters.filter((c) => c.total && c.met < c.total && c.total - c.met <= 2 && c.met > 0)
    .sort((a, b) => (a.total - a.met) - (b.total - b.met)).slice(0, 2);
  for (const c of near) {
    const left = c.total - c.met;
    items.push({ key: 'near:' + c.key, icon: c.icon || '📜', chapter: c.key, title: `${c.title}: ${left} to go`, lines: [left === 1 ? 'One more entry finishes the chapter.' : 'Two more entries finish the chapter.'] });
  }

  // What can be done right now goes first; otherwise keep the order above.
  return items.map((x, i) => ({ x, i })).sort((a, b) => (b.x.now ? 1 : 0) - (a.x.now ? 1 : 0) || a.i - b.i).map(({ x }) => x);
}

module.exports = { whereNext, writesOf };
