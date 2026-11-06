// ---------------------------------------------------------------------------
// Your Craft — the Witch Paths' practices (Green, Lunar, Hedge, Kitchen).
// Every practice is open to everyone; your own path's card is marked and its
// practice is stronger. Green is worked in the garden (harvest a herb in its
// planet's hour), so its card explains rather than acts. Text via textContent.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createPractices({ send, place }) {
  let state = null;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const PATH_NAME = { green: 'Green Witch', lunar: 'Lunar Witch', hedge: 'Hedge Witch', kitchen: 'Kitchen Witch' };

  function open() {
    const m = document.getElementById('practicesModal');
    if (!m) return;
    m.classList.remove('hidden');
    if (place) place(m);
    Modals.set('practicesOpen', true);
    send({ type: 'practice_state' });
    render();
  }
  function close() {
    const m = document.getElementById('practicesModal');
    if (m) m.classList.add('hidden');
    Modals.set('practicesOpen', false);
  }
  function setState(s) { state = s; if (Modals.isOpen('practicesOpen')) render(); }

  function render() {
    const body = document.getElementById('practicesContent');
    if (!body) return;
    body.innerHTML = '';
    if (!state) { body.appendChild(el('div', 'slNote', 'Gathering your things…')); return; }
    if (state.isGuest) { body.appendChild(el('div', 'slNote', 'Log into an account to keep a practice.')); return; }
    body.appendChild(el('div', 'wardIntro', state.path
      ? `You walk the ${PATH_NAME[state.path] || state.path + ' witch'}'s path — its practice is stronger for you. Every witch may try them all.`
      : 'Every witch may try these. Choose a Witch Path and its practice grows stronger for you.'));
    if (state.moonBuff) {
      const mins = Math.max(1, Math.round((state.moonBuff.until - Date.now()) / 60000));
      body.appendChild(el('div', 'cordBlowing', `🌕 The moon is on you — +${Math.round(state.moonBuff.amount * 100)}% XP for ${mins} more min.`));
    }
    const ordered = state.practices.slice().sort((a, b) => (b.onPath ? 1 : 0) - (a.onPath ? 1 : 0));
    for (const p of ordered) {
      const card = el('div', 'prCard' + (p.onPath ? ' onPath' : '') + (p.ready && p.id !== 'green' ? ' ready' : ''));
      card.dataset.practice = p.id;
      card.appendChild(el('div', 'prPath', (p.onPath ? '★ your path · ' : '') + (PATH_NAME[p.path] || p.path)));
      card.appendChild(el('div', 'prHead', `${p.icon} ${p.name}`));
      card.appendChild(el('div', 'prHow', p.how));
      card.appendChild(el('div', 'prNote', p.note));
      if (p.id !== 'green') {
        const b = el('button', 'btn prBtn', `${p.icon} ${p.verb}`);
        b.disabled = !p.ready;
        b.addEventListener('click', () => { b.disabled = true; send({ type: 'practice_do', id: p.id }); });
        card.appendChild(b);
      }
      // The lore folds away so four practices fit on a screen; your own path's opens.
      const fold = document.createElement('details');
      fold.className = 'prFold';
      if (p.onPath) fold.open = true;
      fold.appendChild(el('summary', 'prSummary', 'The lore, and where it comes from'));
      const lore = el('div', 'wardLore');
      lore.appendChild(el('span', 'callerTier callerTier-' + p.tier, p.tier === 'record' ? 'Archaeological / documentary' : p.tier === 'folk' ? 'Folk tradition' : 'Modern revival'));
      lore.appendChild(el('div', 'callerLoreText', p.lore));
      lore.appendChild(el('div', 'callerSource', `Source: ${p.source}`));
      fold.appendChild(lore);
      card.appendChild(fold);
      body.appendChild(card);
    }
  }

  (function wire() {
    const c = document.getElementById('practicesCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  return { open, close, setState, render };
}
