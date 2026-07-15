// ---------------------------------------------------------------------------
// The Weekly Delve UI (Tier 3.4 Phase C) — lobby, run view, boon draft + HUD.
// Also carries the small Locksmith modal (colocated in the source). DI factory;
// open-state via the Modals registry. delveState/weeklyDelveModsClient are
// shared app state, injected via getters.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createDelve({ getWs, getDelveState, getWeeklyDelveMods }) {
function openDelveModal() {
  Modals.set('delveModalOpen', true);
  document.getElementById('delveModal').classList.remove('hidden');
  document.getElementById('delveErr').textContent = '';
  if (getWs() && getWs().readyState === WebSocket.OPEN) getWs().send(JSON.stringify({ type: 'delve_state' }));
  renderDelveModal();
}
function closeDelveModal() {
  Modals.set('delveModalOpen', false);
  document.getElementById('delveModal').classList.add('hidden');
}
function openLocksmithModal() {
  Modals.set('locksmithModalOpen', true);
  document.getElementById('locksmithModal').classList.remove('hidden');
  document.getElementById('locksmithErr').textContent = '';
}
function closeLocksmithModal() {
  Modals.set('locksmithModalOpen', false);
  document.getElementById('locksmithModal').classList.add('hidden');
}
(function wireLocksmith() {
  const reset = document.getElementById('locksmithResetBtn');
  if (reset) reset.addEventListener('click', () => {
    document.getElementById('locksmithErr').textContent = '';
    if (getWs() && getWs().readyState === WebSocket.OPEN) getWs().send(JSON.stringify({ type: 'harddrive_reset_lock' }));
  });
  const close = document.getElementById('locksmithCloseBtn');
  if (close) close.addEventListener('click', closeLocksmithModal);
})();
function renderDelveModal() {
  if (!Modals.isOpen('delveModalOpen')) return;
  const mods = document.getElementById('delveMods');
  const lobby = document.getElementById('delveLobby');
  const runView = document.getElementById('delveRunView');
  const modsList = (getDelveState() && getDelveState().mods) || getWeeklyDelveMods() || [];
  mods.innerHTML = '';
  for (const m of modsList) {
    const chip = document.createElement('span');
    chip.className = 'modChip';
    chip.textContent = `${m.icon} ${m.name} — ${m.desc}`;
    mods.appendChild(chip);
  }
  const inRun = getDelveState() && getDelveState().inRun;
  lobby.classList.toggle('hidden', !!inRun);
  runView.classList.toggle('hidden', !inRun);
  if (inRun) {
    document.getElementById('delveRunNote').textContent =
      `Floor ${getDelveState().floor} — ${getDelveState().kills}/${getDelveState().killsNeeded} felled · depth so far ${Math.max(0, getDelveState().floor - 1)}`;
  } else if (getDelveState() && !getDelveState().inRun) {
    const best = getDelveState().best || { rank: null, value: 0 };
    document.getElementById('delveBestNote').textContent = getDelveState().isGuest
      ? 'Guests may delve, but only named souls are written on the board — log in to be remembered.'
      : (best.value ? `Your deepest this week: ${best.value}${best.rank ? ` (#${best.rank})` : ''}` : 'You haven\'t delved this week.');
    const top = document.getElementById('delveTopList');
    top.innerHTML = '';
    if (getDelveState().top && getDelveState().top.length) {
      getDelveState().top.forEach((e, i) => {
        const row = document.createElement('div');
        row.className = 'slRow';
        row.innerHTML = `<span class="slRank">${i === 0 ? '🥇' : i + 1 + '.'}</span>`;
        const name = document.createElement('span'); name.className = 'slName'; name.textContent = e.name;
        const val = document.createElement('span'); val.className = 'slVal'; val.textContent = 'depth ' + e.value;
        row.appendChild(name); row.appendChild(val);
        top.appendChild(row);
      });
    } else {
      top.innerHTML = '<div class="slNote">Nobody has gone below this week.</div>';
    }
  }
}
function renderDelveHud() {
  const hud = document.getElementById('delveHud');
  if (!hud) return;
  if (!getDelveState() || !getDelveState().inRun) { hud.classList.add('hidden'); return; }
  document.getElementById('delveHudFloor').textContent = `🕳️ Floor ${getDelveState().floor}`;
  document.getElementById('delveHudKills').textContent =
    getDelveState().state === 'draft' ? '✨ draft' : `${getDelveState().kills} / ${getDelveState().killsNeeded}`;
  const boons = document.getElementById('delveHudBoons');
  boons.textContent = Object.entries(getDelveState().myBoons || {})
    .map(([id, n]) => { const b = delveBoonMeta(id); return b ? b.icon.repeat(Math.min(n, 3)) : ''; }).join('');
  hud.classList.remove('hidden');
}
function delveBoonMeta(id) {
  if (getDelveState() && getDelveState().myOffer) {
    const hit = getDelveState().myOffer.find(o => o.id === id);
    if (hit) return hit;
  }
  const FALLBACK = { ember_heart: '🔥', bark_skin: '🪵', moon_blood: '🌕', quick_wick: '🕯️', cat_step: '🐈‍⬛', red_thread: '🧵', witchs_broth: '🍲', wolfs_bargain: '🐺', gravedigger: '⚰️' };
  return FALLBACK[id] ? { icon: FALLBACK[id] } : null;
}
let boonDraftTimer = null;
function renderBoonDraft() {
  const overlay = document.getElementById('boonDraft');
  if (!overlay) return;
  const offer = getDelveState() && getDelveState().inRun && getDelveState().state === 'draft' ? getDelveState().myOffer : null;
  if (!offer || !offer.length) {
    overlay.classList.add('hidden');
    clearInterval(boonDraftTimer);
    return;
  }
  const cards = document.getElementById('boonCards');
  cards.innerHTML = '';
  for (const b of offer) {
    const card = document.createElement('div');
    card.className = 'boonCard';
    card.innerHTML = `<div class="bIcon">${b.icon}</div><div class="bName">${b.name}</div>`;
    const desc = document.createElement('div'); desc.className = 'bDesc'; desc.textContent = b.desc;
    card.appendChild(desc);
    card.addEventListener('click', () => {
      getWs().send(JSON.stringify({ type: 'delve_pick_boon', boonId: b.id }));
      overlay.classList.add('hidden');
    });
    cards.appendChild(card);
  }
  const timerEl = document.getElementById('boonTimer');
  clearInterval(boonDraftTimer);
  const paint = () => {
    const secs = Math.max(0, Math.ceil((((getDelveState() && getDelveState().draftEndsAt) || 0) - Date.now()) / 1000));
    timerEl.textContent = secs > 0 ? `The way down opens in ${secs}s — undecided delvers take the first boon.` : '…';
  };
  paint();
  boonDraftTimer = setInterval(paint, 1000);
  overlay.classList.remove('hidden');
}
(function () {
  const start = document.getElementById('delveStartBtn');
  if (start) start.addEventListener('click', () => {
    document.getElementById('delveErr').textContent = '';
    getWs().send(JSON.stringify({ type: 'delve_start' }));
    closeDelveModal();
  });
  const exit = document.getElementById('delveExitBtn');
  if (exit) exit.addEventListener('click', () => {
    getWs().send(JSON.stringify({ type: 'delve_exit' }));
    closeDelveModal();
  });
  const close = document.getElementById('delveCloseBtn');
  if (close) close.addEventListener('click', closeDelveModal);
})();

  return { openDelveModal, closeDelveModal, renderDelveModal, renderDelveHud, openLocksmithModal, closeLocksmithModal, renderBoonDraft };
}
