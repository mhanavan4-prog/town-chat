// ---------------------------------------------------------------------------
// The Old Ways — the besom, the poppet, lead-pouring, the bees, the brownie,
// sin-eating, the toad-bone (data/oldWays.js). The server sends each as a
// card: how it stands, what may be done now (and why not, if not), and the
// lore with its tier and source. Text via textContent.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createOldWays({ send, place }) {
  let state = null;
  const open_ = new Set(); // lore folds the reader has opened, kept across re-renders
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const TIER = { record: 'Archaeological / documentary', folk: 'Folk tradition', revival: 'Modern revival' };

  function open() {
    const m = document.getElementById('oldWaysModal');
    if (!m) return;
    m.classList.remove('hidden');
    if (place) place(m);
    Modals.set('oldWaysOpen', true);
    send({ type: 'oldways_state' });
    render();
  }
  function close() {
    const m = document.getElementById('oldWaysModal');
    if (m) m.classList.add('hidden');
    Modals.set('oldWaysOpen', false);
  }
  function setState(s) { state = s; if (Modals.isOpen('oldWaysOpen')) render(); }
  const doIt = (way, action, choice) => send({ type: 'oldways_do', way, action, choice });

  function render() {
    const body = document.getElementById('oldWaysContent');
    if (!body) return;
    body.innerHTML = '';
    if (!state) { body.appendChild(el('div', 'slNote', 'Gathering your things…')); return; }
    body.appendChild(el('div', 'wardIntro', state.isGuest ? 'Log into an account to keep the old ways.' : 'Eleven things witches, cunning folk, horsemen and thieves were said to do. Each tells you where it comes from, and where the game goes beyond the record.'));
    const cols = el('div', 'menuCols');
    body.appendChild(cols);
    for (const w of state.ways) {
      const ready = (w.actions || []).some((a) => a.enabled);
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

  (function wire() {
    const c = document.getElementById('oldWaysCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  return { open, close, setState, render };
}
