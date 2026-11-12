// ---------------------------------------------------------------------------
// The Old Ways — the besom, the poppet, lead-pouring, the bees, the brownie,
// sin-eating, the toad-bone (data/oldWays.js). The server sends each as a
// card: how it stands, what may be done now (and why not, if not), and the
// lore with its tier and source. Text via textContent.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createOldWays({ send, place }) {
  let state = null, book = null, tab = 'ways';
  const open_ = new Set(); // lore folds the reader has opened, kept across re-renders
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const TIER = { record: 'Archaeological / documentary', folk: 'Folk tradition', revival: 'Modern revival' };

  function open(which) {
    const m = document.getElementById('oldWaysModal');
    if (!m) return;
    tab = which === 'book' ? 'book' : 'ways';
    m.classList.remove('hidden');
    if (place) place(m);
    Modals.set('oldWaysOpen', true);
    send({ type: 'oldways_state' }); send({ type: 'daybook_state' });
    render();
  }
  function close() {
    const m = document.getElementById('oldWaysModal');
    if (m) m.classList.add('hidden');
    Modals.set('oldWaysOpen', false);
  }
  function setState(s) { state = s; if (Modals.isOpen('oldWaysOpen')) render(); }
  function setBook(b) { book = b; if (Modals.isOpen('oldWaysOpen') && tab === 'book') render(); }
  const doIt = (way, action, choice) => send({ type: 'oldways_do', way, action, choice });

  function render() {
    const body = document.getElementById('oldWaysContent');
    if (!body) return;
    body.innerHTML = '';
    // two leaves: what can be done, and the daybook of what has been
    const tabs = el('div', 'slTabs');
    for (const [id, label] of [['ways', '🧹 The Old Ways'], ['book', book && !book.isGuest ? `📖 Your daybook · ${book.done} of ${book.of}` : '📖 Your daybook']]) {
      const b = el('button', 'slTab' + (tab === id ? ' active' : ''), label);
      b.dataset.tab = id;
      b.addEventListener('click', () => { tab = id; if (id === 'book') send({ type: 'daybook_state' }); render(); body.scrollTop = 0; });
      tabs.appendChild(b);
    }
    body.appendChild(tabs);
    if (tab === 'book') { renderBook(body); return; }
    if (!state) { body.appendChild(el('div', 'slNote', 'Gathering your things…')); return; }
    body.appendChild(el('div', 'wardIntro', state.isGuest ? 'Log into an account to keep the old ways.' : 'Eleven things witches, cunning folk, horsemen and thieves were said to do. Each tells you where it comes from, and where the game goes beyond the record.'));
    const cols = el('div', 'menuCols');
    body.appendChild(cols);
    // What can be done here and now comes first: on a phone the list is a long scroll.
    const isReady = (w) => (w.actions || []).some((a) => a.enabled);
    const ordered = [...state.ways].sort((x, y) => (isReady(y) ? 1 : 0) - (isReady(x) ? 1 : 0));
    for (const w of ordered) {
      const ready = isReady(w);
      const card = el('div', 'prCard' + (ready ? ' ready' : ''));
      card.dataset.way = w.id;
      card.appendChild(el('div', 'prHead', `${w.icon} ${w.name}`));
      card.appendChild(el('div', 'prHow', w.how));
      card.appendChild(el('div', 'prNote', w.status || ''));
      for (const a of (w.actions || [])) {
        const row = el('div', 'owRow');
        let pick = null;
        if (a.choices && a.choices.length) {
          pick = document.createElement('select');
          pick.className = 'owPick';
          for (const c of a.choices) { const o = el('option', '', c.label); o.value = c.id; pick.appendChild(o); }
          pick.disabled = !a.enabled;
          row.appendChild(pick);
        }
        const b = el('button', 'btn prBtn', a.label);
        b.disabled = !a.enabled;
        b.dataset.action = a.id;
        b.addEventListener('click', () => {
          if (a.confirm && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Yes, ' + a.label.toLowerCase(); why.textContent = a.confirm; return; }
          b.disabled = true; doIt(w.id, a.id, pick ? pick.value : undefined);
        });
        row.appendChild(b);
        const why = el('div', 'owWhy', a.enabled ? '' : (a.why || ''));
        card.appendChild(row);
        card.appendChild(why);
      }
      const fold = document.createElement('details');
      fold.className = 'prFold';
      fold.open = open_.has(w.id);
      fold.addEventListener('toggle', () => { if (fold.open) open_.add(w.id); else open_.delete(w.id); });
      fold.appendChild(el('summary', 'prSummary', 'The lore, and where it comes from'));
      const lore = el('div', 'wardLore');
      lore.appendChild(el('span', 'callerTier callerTier-' + w.tier, TIER[w.tier] || w.tier));
      lore.appendChild(el('div', 'callerLoreText', w.lore));
      lore.appendChild(el('div', 'callerSource', `Source: ${w.source}`));
      fold.appendChild(lore);
      card.appendChild(fold);
      cols.appendChild(card);
    }
  }

  // The daybook: each thing with a tick and the day it was first done, or a line on how to come by it.
  const day = (ms) => { try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } };
  function renderBook(body) {
    if (!book) { body.appendChild(el('div', 'slNote', 'Finding the page…')); return; }
    if (book.isGuest) { body.appendChild(el('div', 'wardIntro', 'A daybook is kept on an account. Log into one and what you do is written down.')); return; }
    body.appendChild(el('div', 'wardIntro', `What you have done of what can be done: ${book.done} of ${book.of}. The lore of each is on its own page: the Old Ways here, the wanderers and rare rooms on the plaque below ground.`));
    for (const leaf of book.leaves) {
      const card = el('div', 'prCard');
      card.dataset.leaf = leaf.id;
      card.appendChild(el('div', 'prHead', `${leaf.title} · ${leaf.entries.filter((e) => e.done).length} of ${leaf.entries.length}`));
      for (const e of leaf.entries) {
        const row = el('div', 'dbRow' + (e.done ? ' done' : ''));
        row.dataset.entry = e.id;
        row.appendChild(el('span', 'dbTick', e.done ? '✓' : '·'));
        const text = el('div', 'dbText');
        text.appendChild(el('div', 'dbName', `${e.icon} ${e.name}`));
        text.appendChild(el('div', 'dbNote', e.done ? (e.first ? `First on ${day(e.first)}${e.times > 1 ? ` · ${e.times} times` : ''}` : 'Done before this book was kept.') : e.hint));
        row.appendChild(text);
        card.appendChild(row);
      }
      body.appendChild(card);
    }
  }

  (function wire() {
    const c = document.getElementById('oldWaysCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  return { open, close, setState, setBook, render };
}
