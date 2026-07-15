// ---------------------------------------------------------------------------
// The Town Board (Tier 3.4 Phase C) — weekly leaderboards + tournament note.
// DI factory; open-state via the Modals registry. boardState is shared app
// state (injected via getBoardState).
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createBoard({ send, getBoardState, getMe, shortWhen }) {
let boardActiveTab = 'hunt';
function openBoardModal() {
  Modals.set('boardModalOpen', true);
  document.getElementById('boardModal').classList.remove('hidden');
  send({ type: 'board_state' });
  renderBoardModal();
}
function closeBoardModal() {
  Modals.set('boardModalOpen', false);
  document.getElementById('boardModal').classList.add('hidden');
}
function renderBoardModal() {
  if (!Modals.isOpen('boardModalOpen')) return;
  const list = document.getElementById('boardList');
  const weekNote = document.getElementById('boardWeekNote');
  const meNote = document.getElementById('boardMeNote');
  const tNote = document.getElementById('boardTourneyNote');
  if (!list) return;
  document.querySelectorAll('#boardTabs .slTab').forEach(b =>
    b.classList.toggle('active', b.dataset.board === boardActiveTab));
  list.innerHTML = '';
  if (!getBoardState()) { list.innerHTML = '<div class="slNote">Consulting the board…</div>'; return; }
  weekNote.textContent = `This week's deeds — new page ${shortWhen(getBoardState().weekEndsAt)}`;
  const board = getBoardState().boards[boardActiveTab];
  tNote.classList.toggle('hidden', boardActiveTab !== 'tourney');
  if (boardActiveTab === 'tourney' && getBoardState().tourney) {
    tNote.textContent = getBoardState().tourney.active
      ? `🏹 LIVE — ends ${shortWhen(getBoardState().tourney.endsAt)}. Every creature felled counts.`
      : `Next tournament ${shortWhen(getBoardState().tourney.startsAt)} (Friday evening → Sunday night).`;
  }
  if (!board || !board.top.length) {
    list.innerHTML = '<div class="slNote">No deeds written on this page yet — be the first.</div>';
  } else {
    board.top.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'slRow' + (board.me && e.value === board.me.value && getMe() && e.name === getMe().name ? ' slMe' : '');
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const rank = document.createElement('span'); rank.className = 'slRank'; rank.textContent = medal;
      const name = document.createElement('span'); name.className = 'slName'; name.textContent = e.name;
      const val = document.createElement('span'); val.className = 'slVal';
      val.textContent = boardActiveTab === 'delve' ? `depth ${e.value}` : `×${e.value}`;
      row.appendChild(rank); row.appendChild(name); row.appendChild(val);
      list.appendChild(row);
    });
  }
  meNote.textContent = getBoardState().isGuest
    ? 'Guests pass through unrecorded — log in and the board remembers you.'
    : (board && board.me ? `You: #${board.me.rank} with ${boardActiveTab === 'delve' ? 'depth ' + board.me.value : '×' + board.me.value}` : 'Nothing beside your name yet this week.');
  const honorsWrap = document.getElementById('boardHonors');
  const honorsList = document.getElementById('boardHonorsList');
  if (getBoardState().honors && getBoardState().honors.length) {
    honorsWrap.classList.remove('hidden');
    honorsList.innerHTML = '';
    for (const h of getBoardState().honors.slice().reverse()) {
      const row = document.createElement('div');
      row.className = 'slRow';
      row.textContent = `${h.place === 1 ? '🥇' : h.place === 2 ? '🥈' : '🥉'} ${h.board} board — ${h.week}`;
      honorsList.appendChild(row);
    }
  } else {
    honorsWrap.classList.add('hidden');
  }
}
(function () {
  const tabs = document.getElementById('boardTabs');
  if (tabs) tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.slTab');
    if (!b) return;
    boardActiveTab = b.dataset.board;
    renderBoardModal();
  });
  const close = document.getElementById('boardCloseBtn');
  if (close) close.addEventListener('click', closeBoardModal);
})();

  return { openBoardModal, closeBoardModal, renderBoardModal };
}
