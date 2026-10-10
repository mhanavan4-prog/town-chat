// ---------------------------------------------------------------------------
// The Collection Log (Session N) — a permanent trophy shelf. DI factory, same
// shape as the Town Board: open-state via the Modals registry, data pushed by
// the server's `achievements_state` and held in app state (getAchState). The
// log groups every achievement under its category, shows a progress bar toward
// the ones not yet earned, and gilds the ones that are.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createAchievements({ send, getAchState }) {
function openAchModal() {
  Modals.set('achModalOpen', true);
  document.getElementById('achModal').classList.remove('hidden');
  send({ type: 'achievements_state' });
  renderAchModal();
}
function closeAchModal() {
  Modals.set('achModalOpen', false);
  document.getElementById('achModal').classList.add('hidden');
}
function renderAchModal() {
  if (!Modals.isOpen('achModalOpen')) return;
  const list = document.getElementById('achList');
  const summary = document.getElementById('achSummary');
  if (!list) return;
  const st = getAchState();
  if (!st) { list.innerHTML = '<div class="slNote">Opening the log…</div>'; return; }
  summary.textContent = `${st.unlocked} of ${st.total} trophies earned — deeds done across Thornreach.`;
  list.innerHTML = '';
  let lastCat = null;
  for (const a of st.achievements) {
    if (a.cat !== lastCat) {
      lastCat = a.cat;
      const head = document.createElement('div');
      head.className = 'achCat';
      head.textContent = a.cat;
      list.appendChild(head);
    }
    const row = document.createElement('div');
    row.className = 'achRow ' + (a.unlocked ? 'done' : 'locked');

    const icon = document.createElement('div');
    icon.className = 'achIcon';
    icon.textContent = a.unlocked ? a.icon : '🔒';

    const body = document.createElement('div');
    body.className = 'achBody';
    const name = document.createElement('div');
    name.className = 'achName';
    name.textContent = a.name;
    const desc = document.createElement('div');
    desc.className = 'achDesc';
    desc.textContent = a.desc;
    body.appendChild(name);
    body.appendChild(desc);
    // Progress bar only while the trophy is still out of reach.
    if (!a.unlocked) {
      const track = document.createElement('div');
      track.className = 'achBarTrack';
      const fill = document.createElement('div');
      fill.className = 'achBarFill';
      fill.style.width = Math.round((a.pct || 0) * 100) + '%';
      track.appendChild(fill);
      body.appendChild(track);
    }

    const meta = document.createElement('div');
    meta.className = 'achMeta';
    meta.textContent = a.unlocked ? '✓ earned' : `${a.have} / ${a.need}`;

    row.appendChild(icon);
    row.appendChild(body);
    row.appendChild(meta);
    list.appendChild(row);
  }
}
(function () {
  const close = document.getElementById('achCloseBtn');
  if (close) close.addEventListener('click', closeAchModal);
})();

  return { openAchModal, closeAchModal, renderAchModal };
}
