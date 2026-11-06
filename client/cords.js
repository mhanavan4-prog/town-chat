// ---------------------------------------------------------------------------
// Knots & the Wind (blueprint F) — the Cord Magic panel.
//
// Tie a wind into a hemp cord under the open sky, then loose its knots when you
// need them: a breeze, half a gale, a hurricane with a price. The only power in
// the game you can store for later. State from the server (`cords_state`).
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createCords({ send, place }) {
  let state = null;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

  function open() {
    const m = document.getElementById('cordsModal');
    if (!m) return;
    m.classList.remove('hidden');
    if (place) place(m);
    Modals.set('cordsOpen', true);
    send({ type: 'cords_state' });
    render();
  }
  function close() {
    const m = document.getElementById('cordsModal');
    if (m) m.classList.add('hidden');
    Modals.set('cordsOpen', false);
  }
  function setState(s) { state = s; if (Modals.isOpen('cordsOpen')) render(); }

  function render() {
    const body = document.getElementById('cordsContent');
    if (!body) return;
    body.innerHTML = '';
    if (!state) { body.appendChild(el('div', 'slNote', 'Feeling for the wind…')); return; }
    if (state.isGuest) { body.appendChild(el('div', 'slNote', 'Log into an account to keep a cord.')); return; }

    if (state.blowing) {
      const secs = Math.max(1, Math.round((state.blowing.until - Date.now()) / 1000));
      body.appendChild(el('div', 'cordBlowing', `🌬️ The wind is up — +${Math.round(state.blowing.swift * 100)}% speed for ${secs}s more.`));
    }
    if (state.seaWitch) body.appendChild(el('div', 'wardHearth', '🌊 You walk the Sea Path — you may tie two winds a day, and your knots blow half again as long.'));

    // Tie a new one
    const tie = el('div', 'cordTie');
    const left = Math.max(0, state.perDay - state.tiedToday);
    tie.appendChild(el('div', 'cordLine', `Hemp cord in your pack: ${state.material} · winds you can still tie today: ${left}`));
    const tb = el('button', 'btn cordBtn cordTieBtn', state.openSky ? '🪢 Tie a wind into a cord' : '🪢 Tie a wind (go outside first)');
    tb.disabled = !state.openSky || !left || !state.material;
    tb.addEventListener('click', () => { tb.disabled = true; send({ type: 'tie_wind_cord' }); });
    tie.appendChild(tb);
    if (!state.material) tie.appendChild(el('div', 'wardHow', 'Tailor Ines sells hemp cord.'));
    body.appendChild(tie);

    // Cords you hold
    const held = state.cords.filter((c) => c.qty > 0);
    body.appendChild(el('div', 'ogSub', held.length ? 'Your cords' : 'You hold no tied cords'));
    const cols = el('div', 'menuCols');
    body.appendChild(cols);
    for (const c of held) {
      const card = el('div', 'cordCard' + (c.knots === 1 ? ' last' : ''));
      card.dataset.knots = String(c.knots);
      card.appendChild(el('div', 'cordKnots', `${'🪢'.repeat(c.knots)}  ${c.knots} knot${c.knots === 1 ? '' : 's'} tied ×${c.qty}`));
      card.appendChild(el('div', 'cordNext', `Next: ${c.next.name.toLowerCase()} — ${c.next.wind}, +${Math.round(c.next.swift * 100)}% speed${c.next.hpCostFrac ? `, and it costs ${Math.round(c.next.hpCostFrac * 100)}% of your health` : ''}.`));
      const ub = el('button', 'btn cordBtn cordUntieBtn' + (c.next.hpCostFrac ? ' peril' : ''), c.next.hpCostFrac ? '⚠️ Loose the third knot' : `Loose ${c.next.name.toLowerCase()}`);
      ub.addEventListener('click', () => { ub.disabled = true; send({ type: 'untie_knot', knots: c.knots }); });
      card.appendChild(ub);
      cols.appendChild(card);
    }

    const lore = el('div', 'ogLore');
    lore.appendChild(el('span', 'callerTier callerTier-folk', 'Folk tradition'));
    lore.appendChild(el('div', 'callerLoreText', state.lore.wind));
    lore.appendChild(el('div', 'callerLoreText', state.lore.ladder));
    lore.appendChild(el('div', 'callerSource', `Sources: ${state.lore.source}`));
    body.appendChild(lore);
  }

  (function wire() {
    const c = document.getElementById('cordsCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  return { open, close, setState, render };
}
