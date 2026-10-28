// Titles (Session P) — the honorifics shelf. DI factory, same shape as the
// Collection Log: open-state via Modals, data pushed by the server's
// `titles_state` and held in app state (getTitlesState). Players see every
// title they've earned and may fly one over their head (or none).
import { Modals } from './modals.js';

export default function createTitles({ send, getTitlesState }) {
function openTitlesModal() {
  Modals.set('titlesModalOpen', true);
  document.getElementById('titlesModal').classList.remove('hidden');
  send({ type: 'titles_state' });
  renderTitlesModal();
}
function closeTitlesModal() {
  Modals.set('titlesModalOpen', false);
  document.getElementById('titlesModal').classList.add('hidden');
}
function renderTitlesModal() {
  if (!Modals.isOpen('titlesModalOpen')) return;
  const list = document.getElementById('titlesList');
  const summary = document.getElementById('titlesSummary');
  if (!list) return;
  const st = getTitlesState();
  const earned = (st && st.earned) || [];
  const active = (st && st.active) || null;
  if (summary) summary.textContent = earned.length
    ? `${earned.length} title${earned.length === 1 ? '' : 's'} earned — fly one over your head.`
    : 'No titles yet — earn them through coven Rites and deeds across Thornreach.';
  list.innerHTML = '';

  if (!earned.length) {
    const empty = document.createElement('div');
    empty.className = 'slNote';
    empty.textContent = '🎖️ Your honors will appear here as you earn them.';
    list.appendChild(empty);
    return;
  }

  // A "None" row at the top to clear the active title.
  const mkRow = (opts) => {
    const row = document.createElement('div');
    const on = opts.activeNow;
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;margin:5px 0;border-radius:10px;border:1px solid ' +
      (on ? 'rgba(94,231,192,0.5);background:rgba(94,231,192,0.09)' : 'rgba(255,255,255,0.08);background:rgba(255,255,255,0.03)');
    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:20px;width:26px;text-align:center';
    icon.textContent = opts.glyph;
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;min-width:0';
    const name = document.createElement('div');
    name.style.cssText = 'font-weight:650;color:#fff';
    name.textContent = opts.name;
    body.appendChild(name);
    if (opts.desc) { const d = document.createElement('div'); d.style.cssText = 'font-size:12px;opacity:.82;margin-top:2px'; d.textContent = opts.desc; body.appendChild(d); }
    if (opts.from) { const f = document.createElement('div'); f.style.cssText = 'font-size:11px;opacity:.55;margin-top:2px'; f.textContent = opts.from; body.appendChild(f); }
    const btn = document.createElement('button');
    btn.className = 'btn';
    // The shared .btn class is width:100%, which in this flex row eats all the
    // space and squeezes the name/description down to one word per line. Pin it
    // to its content width (same fix as .codexRow .btn) so the text column gets
    // the room it needs.
    btn.style.cssText = 'margin:0;white-space:nowrap;flex:0 0 auto;width:auto;padding:7px 14px;font-size:12.5px;' + (on ? 'opacity:.6;pointer-events:none' : '');
    btn.textContent = on ? '✓ Active' : 'Fly it';
    btn.addEventListener('click', () => send({ type: 'set_title', title: opts.id }));
    row.appendChild(icon); row.appendChild(body); row.appendChild(btn);
    return row;
  };

  list.appendChild(mkRow({ id: '', glyph: '—', name: 'No title', desc: 'Fly nothing over your head.', from: '', activeNow: !active }));
  for (const t of earned) {
    list.appendChild(mkRow({ id: t.id, glyph: t.glyph || '🎖️', name: t.name, desc: t.desc, from: t.from, activeNow: active === t.id }));
  }
}
(function () {
  const close = document.getElementById('titlesCloseBtn');
  if (close) close.addEventListener('click', closeTitlesModal);
})();

  return { openTitlesModal, closeTitlesModal, renderTitlesModal };
}
