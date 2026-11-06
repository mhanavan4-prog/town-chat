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

const CHARM_TIER_LABEL = { record: 'Record', folk: 'Folk', revival: 'Revival' };

export default function createCharmBook({ send, place }) {
  let state = null;
  let openChapter = null; // key of the expanded chapter, or null = contents page

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
  function setState(s) { state = s; if (Modals.isOpen('charmBookOpen')) render(); }

  function tierBadge(tier) {
    return el('span', 'callerTier callerTier-' + (tier || 'folk'), CHARM_TIER_LABEL[tier] || 'Folk');
  }

  function renderContents(body) {
    const met = state.chapters.reduce((n, c) => n + c.met, 0);
    const total = state.chapters.reduce((n, c) => n + c.total, 0);
    body.appendChild(el('div', 'cbIntro', `${met} of ${total} charms written in. Cunning folk kept a book like this — charms, cures and receipts copied out by hand. Every entry says where it really comes from.`));
    const key = el('div', 'cbKey');
    key.appendChild(tierBadge('record')); key.appendChild(el('span', null, ' written down at the time  '));
    key.appendChild(tierBadge('folk')); key.appendChild(el('span', null, ' gathered from living custom  '));
    key.appendChild(tierBadge('revival')); key.appendChild(el('span', null, ' modern'));
    body.appendChild(key);
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
      body.appendChild(row);
    }
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
        row.appendChild(el('span', 'cbEntryTitle', '· · ·'));
        row.appendChild(el('div', 'cbHint', e.hint || 'Not yet met.'));
        body.appendChild(row);
        continue;
      }
      const row = el('div', 'callerLore cbEntry');
      const head = el('div', 'cbEntryHead');
      head.appendChild(el('span', 'cbEntryTitle', (e.icon ? e.icon + ' ' : '') + e.title));
      head.appendChild(tierBadge(e.tier));
      row.appendChild(head);
      if (e.lore) row.appendChild(el('div', 'callerLoreText', e.lore));
      if (e.source) row.appendChild(el('div', 'callerSource', e.source));
      body.appendChild(row);
    }
    if (ch.note) body.appendChild(el('div', 'cbNote', ch.note));
  }

  function render() {
    const body = document.getElementById('charmBookContent');
    if (!body) return;
    body.textContent = '';
    if (!state || !Array.isArray(state.chapters)) { body.appendChild(el('div', 'cbIntro', 'Opening the book…')); return; }
    const ch = openChapter && state.chapters.find((c) => c.key === openChapter);
    if (ch) renderChapter(body, ch); else renderContents(body);
    body.scrollTop = 0;
  }

  (function wire() {
    const c = document.getElementById('charmBookCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  return { open, close, setState, render };
}
