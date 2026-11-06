// ---------------------------------------------------------------------------
// The Town Board (Tier 3.4 Phase C) — weekly leaderboards + tournament note.
// DI factory; open-state via the Modals registry. boardState is shared app
// state (injected via getBoardState).
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createBoard({ send, getBoardState, getCallersState, getCallerResult, clearCallerResult, openTool, getMe, shortWhen }) {
// Callers at the Door is the Board's first page: the town's work comes before
// its scores.
let boardActiveTab = 'callers';
function openBoardModal() {
  Modals.set('boardModalOpen', true);
  document.getElementById('boardModal').classList.remove('hidden');
  send({ type: 'board_state' });
  send({ type: 'callers_state' });
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
  const honorsWrapEl = document.getElementById('boardHonors');
  if (boardActiveTab === 'callers') {
    tNote.classList.add('hidden');
    if (honorsWrapEl) honorsWrapEl.classList.add('hidden');
    weekNote.textContent = 'Callers at the Door — the town brings its troubles to the witch';
    renderCallers(list, meNote);
    return;
  }
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
    const BOARD_LABEL = { hunt: 'Hunts', boss: 'Bosses', delve: 'Delve', tourney: 'Tournament' };
    const curWk = parseInt(String(getBoardState().week || '').replace(/^w/, ''), 10);
    const whenLabel = (wkStr) => {
      const n = parseInt(String(wkStr || '').replace(/^w/, ''), 10);
      if (!Number.isFinite(curWk) || !Number.isFinite(n)) return Number.isFinite(n) ? `week ${n}` : wkStr;
      const d = curWk - n;
      return d <= 0 ? 'this week' : d === 1 ? 'last week' : `${d} weeks ago`;
    };
    for (const h of getBoardState().honors.slice().reverse()) {
      const row = document.createElement('div');
      row.className = 'slRow';
      row.textContent = `${h.place === 1 ? '🥇' : h.place === 2 ? '🥈' : '🥉'} ${BOARD_LABEL[h.board] || h.board} — ${whenLabel(h.week)}`;
      honorsList.appendChild(row);
    }
  } else {
    honorsWrap.classList.add('hidden');
  }
}

// ── Callers at the Door ──────────────────────────────────────────────────────
// A townsperson's working: the plea, the steps (each with a button that opens
// the tool that does it), then the finish. All text lands via textContent.
const TOOL_LABEL = { pendulum: '🪢 Pendulum', tarot: '🃏 Cards', runes: 'ᚱ Staves', scry: '🥣 Bowl' };
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function renderCallerResult(list, r) {
  const card = el('div', 'callerCard callerResult');
  card.appendChild(el('div', 'callerHead', `${r.icon} ${r.title} — done`));
  card.appendChild(el('div', 'callerWho', `for ${r.caller}`));
  for (const line of r.readings || []) card.appendChild(el('div', 'callerReading', line));
  card.appendChild(el('div', 'callerTale', r.resolution));
  const lore = el('div', 'callerLore');
  lore.appendChild(el('span', 'callerTier callerTier-' + r.tier, r.tierLabel));
  lore.appendChild(el('div', 'callerLoreText', r.lore));
  if (r.source) lore.appendChild(el('div', 'callerSource', `Source: ${r.source}`));
  card.appendChild(lore);
  card.appendChild(el('div', 'callerPay', `+${r.gold}🪙${r.xp ? ` · +${r.xp} XP` : ''} · workings done: ${r.total}`));
  const ok = el('button', 'btn callerBtn', 'Back to the door');
  ok.addEventListener('click', () => { clearCallerResult(); renderBoardModal(); });
  card.appendChild(ok);
  list.appendChild(card);
}
function renderCallers(list, meNote) {
  const result = getCallerResult && getCallerResult();
  if (result) { renderCallerResult(list, result); meNote.textContent = ''; return; }
  const st = getCallersState && getCallersState();
  if (!st) { list.appendChild(el('div', 'slNote', 'Someone is knocking…')); meNote.textContent = ''; return; }
  if (st.isGuest) {
    list.appendChild(el('div', 'slNote', 'Townsfolk only bring their troubles to a witch they can find again — log in and they will come knocking.'));
    meNote.textContent = '';
    return;
  }
  if (st.active) {
    const a = st.active;
    const card = el('div', 'callerCard callerActive');
    card.appendChild(el('div', 'callerHead', `${a.icon} ${a.title}`));
    card.appendChild(el('div', 'callerWho', a.caller));
    card.appendChild(el('div', 'callerPlea', `“${a.plea}”`));
    const steps = el('div', 'callerSteps');
    for (const s of a.steps) {
      const row = el('div', 'callerStep' + (s.done ? ' done' : ''));
      row.appendChild(el('span', 'callerTick', s.done ? '✓' : '○'));
      const body = el('div', 'callerStepBody');
      body.appendChild(el('div', 'callerStepLabel', s.label));
      if (s.kind === 'deliver') {
        body.appendChild(el('div', 'callerStepNote', `${s.icon} ${s.name} — ${Math.min(s.have, s.qty)}/${s.qty}${s.done ? '' : ` · ${s.where}`}`));
      } else if (s.done && s.note) {
        body.appendChild(el('div', 'callerStepNote', s.note));
      }
      row.appendChild(body);
      if (!s.done && TOOL_LABEL[s.kind]) {
        const go = el('button', 'callerGo', TOOL_LABEL[s.kind]);
        go.dataset.tool = s.kind;
        go.addEventListener('click', () => openTool(s.kind, s));
        row.appendChild(go);
      }
      steps.appendChild(row);
    }
    card.appendChild(steps);
    const btns = el('div', 'callerBtns');
    const fin = el('button', 'btn callerBtn callerFinish', a.ready ? `Finish the working · ${a.reward.gold}🪙` : 'Finish the working');
    fin.disabled = !a.ready;
    fin.addEventListener('click', () => { fin.disabled = true; send({ type: 'caller_finish' }); });
    const drop = el('button', 'btn callerBtn callerDrop', 'Set it aside');
    drop.addEventListener('click', () => send({ type: 'caller_abandon' }));
    btns.appendChild(fin); btns.appendChild(drop);
    card.appendChild(btns);
    list.appendChild(card);
  }
  const waiting = (st.offered || []).filter((o) => !st.active || o.id !== st.active.id);
  if (waiting.length) list.appendChild(el('div', 'callerSub', st.active ? 'Also at the door today' : 'At the door today'));
  for (const o of waiting) {
    const card = el('div', 'callerCard' + (o.served ? ' served' : ''));
    card.appendChild(el('div', 'callerHead', `${o.icon} ${o.title}`));
    card.appendChild(el('div', 'callerWho', o.caller));
    card.appendChild(el('div', 'callerPlea', `“${o.plea}”`));
    if (o.served) {
      card.appendChild(el('div', 'callerStepNote', 'Served today — they went home grateful.'));
    } else {
      const take = el('button', 'btn callerBtn callerTake', st.active ? 'One working at a time' : `Take the working · ${o.reward.gold}🪙`);
      take.disabled = !!st.active;
      take.addEventListener('click', () => send({ type: 'caller_take', id: o.id }));
      card.appendChild(take);
    }
    list.appendChild(card);
  }
  if (!st.active && !waiting.some((o) => !o.served)) list.appendChild(el('div', 'slNote', 'No one else at the door today. They come again tomorrow.'));
  meNote.textContent = st.total ? `Workings done for the town: ${st.total}` : 'Cunning folk were hired, paid and trusted. The town is learning your name.';
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
