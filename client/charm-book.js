// ---------------------------------------------------------------------------
// The Charm Book — every piece of folk-magic lore you've met, in one place,
// each with where it really comes from and how old it really is.
//
// Named for what cunning folk actually kept: a written book of charms and
// receipts (the "Book of Shadows" is a 1950s Wiccan term, so the game doesn't
// use it). The server decides what you've met (charm_book_state); this panel
// only draws it. Entries you haven't met show as a one-line hint so the book
// doubles as a guide to what's still out there. All text is set with
// textContent.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';
import { searchBook } from './charm-search.js';
import { tierTally } from './charm-tally.js';

const CHARM_TIER_LABEL = { record: 'Record', folk: 'Folk', revival: 'Revival' };
const NEXT = '__whereNext'; // the Where next page (not a chapter)
const SOURCES = '__sources'; // the Sources page (not a chapter)
const CALENDAR = '__calendar'; // the Calendar page (not a chapter)

export default function createCharmBook({ send, place, openBoard }) {
  let state = null;
  let openChapter = null; // key of the expanded chapter, or null = contents page
  let sourceFilter = ''; // what's typed in the Sources page's search box
  let bookQuery = ''; // what's typed in the contents page's search box
  let focusWork = null; // a Sources work to show first (from "Check it")

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

  function open() {
    const m = document.getElementById('charmBookModal');
    if (!m) return;
    m.classList.remove('hidden');
    if (place) place(m);
    Modals.set('charmBookOpen', true);
    send({ type: 'charm_book_state' });
    render();
  }
  function close() {
    const m = document.getElementById('charmBookModal');
    if (m) m.classList.add('hidden');
    Modals.set('charmBookOpen', false);
  }
  // Open the book at the Sources page, at one work (the shelf's "Check it").
  function openSource(id) {
    openChapter = SOURCES; sourceFilter = ''; focusWork = id || null;
    open();
  }
  function setState(s) { state = s; if (Modals.isOpen('charmBookOpen')) render(); }

  function tierBadge(tier) {
    return el('span', 'callerTier callerTier-' + (tier || 'folk'), CHARM_TIER_LABEL[tier] || 'Folk');
  }

  function renderContents(bodyIn) {
    let body = bodyIn;
    const met = state.chapters.reduce((n, c) => n + c.met, 0);
    const total = state.chapters.reduce((n, c) => n + c.total, 0);
    body.appendChild(el('div', 'cbIntro', `${met} of ${total} charms written in. Cunning folk kept a book like this — charms, cures and receipts copied out by hand. Every entry says where it really comes from.`));
    const key = el('div', 'cbKey');
    key.appendChild(tierBadge('record')); key.appendChild(el('span', null, ' written down at the time  '));
    key.appendChild(tierBadge('folk')); key.appendChild(el('span', null, ' gathered from living custom  '));
    key.appendChild(tierBadge('revival')); key.appendChild(el('span', null, ' modern'));
    body.appendChild(key);
    // Where the book's knowledge comes from: of what you've written in, and of it all.
    const tally = tierTally(state);
    const tl = el('div', 'cbTally');
    const part = (o, t) => { const sp = el('span', 'cbTallyPart'); sp.appendChild(tierBadge(t)); sp.appendChild(el('span', null, ` ${o[t]}`)); return sp; };
    const line = (label, o) => { const r = el('div', 'cbTallyLine'); r.appendChild(el('span', 'cbTallyLabel', label)); for (const t of ['record', 'folk', 'revival']) r.appendChild(part(o, t)); return r; };
    if (tally.metTotal) tl.appendChild(line(`Yours (${tally.metTotal})`, tally.met));
    tl.appendChild(line(`All (${tally.total})`, tally.all));
    body.appendChild(tl);
    // 🔎 Search the whole book: results replace the contents while there is a query.
    const search = el('input', 'cbBookSearch');
    search.type = 'search';
    search.placeholder = 'Search: a charm, a herb, a name…';
    search.value = bookQuery;
    body.appendChild(search);
    const results = el('div', 'cbSearchResults');
    body.appendChild(results);
    const rest = el('div', 'cbContentsRest');
    const drawResults = () => {
      results.textContent = '';
      const hits = searchBook(state, bookQuery);
      rest.classList.toggle('hidden', bookQuery.trim().length >= 2);
      if (bookQuery.trim().length < 2) return;
      results.appendChild(el('div', 'cbHint', hits.length ? `${hits.length}${hits.length === 60 ? '+' : ''} found` : 'Nothing in the book matches that yet.'));
      for (const h of hits) {
        const row = el('button', 'cbSearchHit' + (h.met ? ' met' : ''));
        const head = el('div', 'cbEntryHead');
        head.appendChild(el('span', 'cbEntryTitle', `${h.icon ? h.icon + ' ' : ''}${h.title}`));
        if (h.met) head.appendChild(tierBadge(h.tier));
        row.appendChild(head);
        row.appendChild(el('div', 'cbSearchCh', `${h.chapterIcon} ${h.chapterTitle}${h.met ? '' : ' · not yet written in'}`));
        if (h.snippet) row.appendChild(el('div', 'cbSearchSnip', h.snippet));
        row.addEventListener('click', () => { openChapter = h.chapter; render(); });
        results.appendChild(row);
      }
    };
    search.addEventListener('input', () => { bookQuery = search.value; drawResults(); });
    body.appendChild(rest);
    body = rest; // the rest of the contents page goes under the search
    if (Array.isArray(state.whereNext) && state.whereNext.length) {
      const wn = state.whereNext;
      const row = el('button', 'cbChapter cbNextRow');
      row.appendChild(el('span', 'cbChIcon', '✒️'));
      const txt = el('span', 'cbChText');
      txt.appendChild(el('span', 'cbChTitle', 'Where next'));
      const nowN = wn.filter((x) => x.now).length;
      txt.appendChild(el('span', 'cbChCount', nowN ? `${nowN} to do now` : `${wn.length} ideas`));
      row.appendChild(txt);
      row.appendChild(el('span', 'cbNextSub', wn[0].title));
      row.addEventListener('click', () => { openChapter = NEXT; render(); });
      body.appendChild(row);
    }
    if (state.calendar && Array.isArray(state.calendar.months)) {
      const cal = state.calendar;
      const row = el('button', 'cbChapter cbCalendarRow');
      row.appendChild(el('span', 'cbChIcon', '🗓️'));
      const txt = el('span', 'cbChText');
      txt.appendChild(el('span', 'cbChTitle', 'The Calendar'));
      const mo = cal.months[cal.today.month - 1];
      txt.appendChild(el('span', 'cbChCount', mo ? mo.name : ''));
      row.appendChild(txt);
      row.appendChild(el('span', 'cbNextSub', 'The year at a glance: its seasons, its callers, its days'));
      row.addEventListener('click', () => { openChapter = CALENDAR; render(); });
      body.appendChild(row);
    }
    if (state.rewards) renderRewards(body, state.rewards);
    const cols = el('div', 'menuCols'); // chapters in two columns in the wide frame
    body.appendChild(cols);
    for (const ch of state.chapters) {
      const row = el('button', 'cbChapter' + (ch.met === ch.total && ch.total ? ' done' : ''));
      row.dataset.chapter = ch.key;
      row.appendChild(el('span', 'cbChIcon', ch.icon || '📜'));
      const txt = el('span', 'cbChText');
      txt.appendChild(el('span', 'cbChTitle', ch.title));
      txt.appendChild(el('span', 'cbChCount', `${ch.met} / ${ch.total}`));
      row.appendChild(txt);
      const bar = el('span', 'cbChBar'); const fill = el('span', 'cbChFill');
      fill.style.width = (ch.total ? Math.round((ch.met / ch.total) * 100) : 0) + '%';
      bar.appendChild(fill); row.appendChild(bar);
      row.addEventListener('click', () => { openChapter = ch.key; render(); });
      cols.appendChild(row);
    }
    if (state.sources && state.sources.works && state.sources.works.length) {
      const row = el('button', 'cbChapter cbSourcesRow');
      row.appendChild(el('span', 'cbChIcon', '📖'));
      const txt = el('span', 'cbChText');
      txt.appendChild(el('span', 'cbChTitle', 'Sources'));
      txt.appendChild(el('span', 'cbChCount', `${state.sources.works.length} works`));
      row.appendChild(txt);
      row.appendChild(el('span', 'cbNextSub', 'Every work this book cites, A to Z'));
      row.addEventListener('click', () => { openChapter = SOURCES; render(); });
      body.appendChild(row);
    }
    drawResults(); // a query kept from before (re-opened, or the book refreshed)
  }

  // What writing the book up earns: a chip per milestone (ticked once given)
  // and the purse for each finished chapter.
  function renderRewards(body, r) {
    const box = el('div', 'cbRewards');
    for (const m of r.milestones) {
      const chip = el('span', 'cbMilestone' + (m.given ? ' given' : ''));
      chip.title = `${m.label}: the title ${m.title}, ${m.gold} gold` + (m.dye ? ', and Woad Blue for your wardrobe' : '');
      chip.appendChild(el('span', 'cbMsAt', `${m.given ? '✓ ' : ''}${m.at}%`));
      chip.appendChild(el('span', 'cbMsTitle', `${m.glyph} ${m.title}`));
      chip.appendChild(el('span', 'cbMsGold', `${m.gold}g${m.dye ? ' · 🎨' : ''}`));
      box.appendChild(chip);
    }
    body.appendChild(box);
    const unpaid = state.chapters.filter((c) => c.noPurse).map((c) => c.title);
    body.appendChild(el('div', 'cbHint', `${r.pct}% written. Every chapter you finish pays ${r.chapterPurse} gold${unpaid.length ? ` (not ${unpaid.join(' or ')}, which is for the dead)` : ''}; each milestone gives a title to wear.`));
  }

  function renderChapter(body, ch) {
    const back = el('button', 'btn cbBack', '‹ Contents');
    back.addEventListener('click', () => { openChapter = null; render(); });
    body.appendChild(back);
    body.appendChild(el('div', 'cbChHead', `${ch.icon || '📜'} ${ch.title} · ${ch.met} / ${ch.total}`));
    if (ch.intro) body.appendChild(el('div', 'cbIntro', ch.intro));
    for (const e of ch.entries) {
      if (!e.met) {
        const row = el('div', 'cbEntry unmet');
        row.appendChild(el('span', 'cbEntryTitle' + (ch.showNames ? ' named' : ''), ch.showNames ? (e.icon ? e.icon + ' ' : '') + e.title : '· · ·'));
        if (e.date) row.appendChild(el('span', 'cbEntryDate', e.date));
        row.appendChild(el('div', 'cbHint', e.hint || 'Not yet met.'));
        body.appendChild(row);
        continue;
      }
      const row = el('div', 'callerLore cbEntry');
      const head = el('div', 'cbEntryHead');
      head.appendChild(el('span', 'cbEntryTitle', (e.icon ? e.icon + ' ' : '') + e.title));
      if (e.date) head.appendChild(el('span', 'cbEntryDate', e.date));
      head.appendChild(tierBadge(e.tier));
      row.appendChild(head);
      if (e.lore) row.appendChild(el('div', 'callerLoreText', e.lore));
      if (e.source) row.appendChild(el('div', 'callerSource', e.source));
      body.appendChild(row);
    }
    if (ch.note) body.appendChild(el('div', 'cbNote', ch.note));
  }

  // ✒️ Where next: what you can write in today (lib/whereNext.js on the server).
  function renderNext(body) {
    const back = el('button', 'btn cbBack', '‹ Contents');
    back.addEventListener('click', () => { openChapter = null; render(); });
    body.appendChild(back);
    body.appendChild(el('div', 'cbChHead', '✒️ Where next'));
    body.appendChild(el('div', 'cbIntro', 'What you can write in today. Some of it only lasts the hour or the day.'));
    const list = el('div', 'cbNextList');
    for (const it of state.whereNext || []) {
      const row = el(it.chapter || it.action ? 'button' : 'div', 'cbNextItem' + (it.now ? ' now' : ''));
      const head = el('div', 'cbNextHead');
      head.appendChild(el('span', 'cbNextIcon', it.icon || '📜'));
      head.appendChild(el('span', 'cbNextTitle', it.title));
      if (it.now) head.appendChild(el('span', 'cbNextNow', 'Now'));
      row.appendChild(head);
      for (const line of it.lines || []) row.appendChild(el('div', 'cbNextLine', line));
      if (it.action === 'board' && openBoard) {
        row.appendChild(el('div', 'cbNextGo', 'Open the Board ›'));
        row.addEventListener('click', () => { close(); openBoard(); });
      } else if (it.chapter && state.chapters.some((c) => c.key === it.chapter)) {
        row.appendChild(el('div', 'cbNextGo', 'Open the chapter ›'));
        row.addEventListener('click', () => { openChapter = it.chapter; render(); });
      }
      list.appendChild(row);
    }
    body.appendChild(list);
  }

  // 📖 Sources: every work the book cites, A to Z, with the entries that cite
  // it (lib/sources.js). Tap an entry to open its chapter.
  function renderSources(body) {
    const back = el('button', 'btn cbBack', '‹ Contents');
    back.addEventListener('click', () => { openChapter = null; focusWork = null; render(); });
    body.appendChild(back);
    const src = state.sources || { works: [] };
    body.appendChild(el('div', 'cbChHead', `📖 Sources · ${src.works.length} works`));
    body.appendChild(el('div', 'cbIntro', 'Every work this book cites, A to Z, and the entries that cite it, so you can check any of it for yourself. An entry you have not met yet shows as · · ·. Tap one to open its chapter.'));
    const search = el('input', 'cbSourceSearch');
    search.type = 'search';
    search.placeholder = 'Find an author, a book, a year…';
    search.value = sourceFilter;
    body.appendChild(search);
    const list = el('div', 'cbSourceList');
    body.appendChild(list);
    const titleOf = (k) => (state.chapters.find((c) => c.key === k) || {}).title || k;
    const draw = () => {
      list.textContent = '';
      const q = sourceFilter.trim().toLowerCase();
      const shown = src.works.filter((w) => !q || w.cite.toLowerCase().includes(q) || w.entries.some((e) => e.title && e.title.toLowerCase().includes(q)));
      let focusRow = null;
      for (const w of shown) {
        const row = el('div', 'cbSource' + (focusWork && w.id === focusWork ? ' focus' : ''));
        if (focusWork && w.id === focusWork) focusRow = row;
        row.appendChild(el('div', 'cbSourceCite', w.cite));
        const cited = el('div', 'cbSourceCited');
        for (const e of w.entries) {
          const b = el('button', 'cbSourceEntry' + (e.met ? ' met' : ''), e.title ? `${e.icon ? e.icon + ' ' : ''}${e.title}` : '· · ·');
          b.title = titleOf(e.chapter);
          b.appendChild(el('span', 'cbSourceCh', ` · ${titleOf(e.chapter)}`));
          b.addEventListener('click', () => { openChapter = e.chapter; focusWork = null; render(); });
          cited.appendChild(b);
        }
        row.appendChild(cited);
        list.appendChild(row);
      }
      if (!shown.length) list.appendChild(el('div', 'cbHint', 'Nothing in the book cites that.'));
      if (focusRow) requestAnimationFrame(() => { focusRow.scrollIntoView({ block: 'center' }); });
    };
    search.addEventListener('input', () => { sourceFilter = search.value; focusWork = null; draw(); });
    draw();
    if (src.note) body.appendChild(el('div', 'cbNote', src.note));
  }

  // 🗓️ The Calendar: the whole year, month by month (lib/yearCalendar.js), with
  // today marked and the page opened at this month.
  function renderCalendar(body) {
    const back = el('button', 'btn cbBack', '‹ Contents');
    back.addEventListener('click', () => { openChapter = null; render(); });
    body.appendChild(back);
    const cal = state.calendar;
    body.appendChild(el('div', 'cbChHead', `🗓️ The Calendar · ${cal.year}`));
    body.appendChild(el('div', 'cbIntro', 'The year at a glance: which festival season each month lies in, the days a caller comes only then (🚪), and the old calendar\'s customs. Dates are this year\'s; some move with Easter or the weekday.'));
    // The Year's Round: the dated callers you've answered (✓ on their days).
    const kept = new Set((cal.round && cal.round.kept) || []);
    if (cal.round) body.appendChild(el('div', 'cbRound', `🗓️ The Year's Round: ${kept.size} of ${cal.round.total} old days kept${kept.size === cal.round.total ? '. Every one.' : ''}`));
    let here = null;
    for (const mo of cal.months) {
      const box = el('div', 'cbMonth' + (mo.month === cal.today.month ? ' now' : ''));
      const head = el('div', 'cbMonthHead');
      head.appendChild(el('span', 'cbMonthName', mo.name));
      head.appendChild(el('span', 'cbMonthSeasons', mo.seasons.map((s) => `${s.glyph} ${s.name}`).join(' · ')));
      box.appendChild(head);
      let todayShown = mo.month !== cal.today.month;
      const todayRow = () => { const r = el('div', 'cbDay today'); r.appendChild(el('span', 'cbDayNum', String(cal.today.day))); r.appendChild(el('span', 'cbDayTitle', '◆ Today')); return r; };
      for (const d of mo.days) {
        if (!todayShown && d.day > cal.today.day) { box.appendChild(todayRow()); todayShown = true; }
        const row = el('div', 'cbDay ' + d.kind + (mo.month === cal.today.month && d.day === cal.today.day ? ' isToday' : ''));
        row.appendChild(el('span', 'cbDayNum', String(d.day)));
        row.appendChild(el('span', 'cbDayIcon', d.kind === 'caller' ? '🚪' : (d.icon || '·')));
        const t = el('span', 'cbDayTitle', d.kind === 'caller' ? `${d.icon || ''} ${d.title}`.trim() + (kept.has(d.key) ? ' ✓' : '') : d.title);
        if (d.kind === 'caller' && kept.has(d.key)) row.classList.add('kept');
        row.appendChild(t);
        if (d.note) row.appendChild(el('span', 'cbDayNote', d.note));
        box.appendChild(row);
      }
      if (!todayShown) box.appendChild(todayRow());
      body.appendChild(box);
      if (mo.month === cal.today.month) here = box;
    }
    if (here) requestAnimationFrame(() => { here.scrollIntoView({ block: 'start' }); });
  }

  function render() {
    const body = document.getElementById('charmBookContent');
    if (!body) return;
    body.textContent = '';
    if (!state || !Array.isArray(state.chapters)) { body.appendChild(el('div', 'cbIntro', 'Opening the book…')); return; }
    const ch = openChapter && state.chapters.find((c) => c.key === openChapter);
    if (openChapter === NEXT) renderNext(body); else if (openChapter === SOURCES) renderSources(body); else if (openChapter === CALENDAR && state.calendar) renderCalendar(body); else if (ch) renderChapter(body, ch); else renderContents(body);
    body.scrollTop = 0;
  }

  (function wire() {
    const c = document.getElementById('charmBookCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  return { open, openSource, close, setState, render };
}
