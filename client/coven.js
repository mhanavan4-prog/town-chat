// ---------------------------------------------------------------------------
// Covens UI (Tier 3.4 Phase C) — roster, chat, shared bank, invites, and the
// claimed-table sprite. DI factory; open-state via the Modals registry. The
// coven* state is shared (WS handlers write it) so it's injected via getters;
// setCovenUnread handles the read-badge reset.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createCoven({ getWs, getMe, getPlayers, getCovenState, getCovenTableState, getCovenUnread, setCovenUnread, getCovenChatLines, getCovenSigilsCatalog, getCurrentInterior, makeNpcNameSprite, ITEM_CATALOG, accountAuth }) {
let covenActiveTab = 'members';
let covenPickedSigil = null;
function refreshCovenMenuRow() {
  const row = document.getElementById('menuCoven');
  const badge = document.getElementById('menuCovenBadge');
  if (row) {
    const label = getCovenState() ? `${getCovenState().sigil} ${getCovenState().name}` : '🕸️ Coven';
    row.childNodes[0].nodeValue = label;
  }
  if (badge) {
    badge.textContent = String(getCovenUnread());
    badge.classList.toggle('hidden', getCovenUnread() === 0);
  }
  const chatBadge = document.getElementById('covenChatBadge');
  if (chatBadge) {
    chatBadge.textContent = String(getCovenUnread());
    chatBadge.classList.toggle('hidden', getCovenUnread() === 0);
  }
}
function openCovenModal() {
  Modals.set('covenModalOpen', true);
  document.getElementById('covenModal').classList.remove('hidden');
  document.getElementById('covenErr').textContent = '';
  if (getWs() && getWs().readyState === WebSocket.OPEN) getWs().send(JSON.stringify({ type: 'coven_state' }));
  renderCovenModal();
}
function closeCovenModal() {
  Modals.set('covenModalOpen', false);
  document.getElementById('covenModal').classList.add('hidden');
}
function renderCovenModal() {
  if (!Modals.isOpen('covenModalOpen')) return;
  const none = document.getElementById('covenNone');
  const main = document.getElementById('covenMain');
  const title = document.getElementById('covenTitle');
  const isGuest = !(accountAuth() && accountAuth().token);
  if (!getCovenState()) {
    title.textContent = '🕸️ Coven';
    none.classList.remove('hidden');
    main.classList.add('hidden');
    if (isGuest) document.getElementById('covenErr').textContent = 'Covens are for townsfolk with an account — log in first.';
    // sigil picker
    const pick = document.getElementById('covenSigilPick');
    if (pick && !pick.childNodes.length) {
      for (const s of getCovenSigilsCatalog()) {
        const b = document.createElement('button');
        b.textContent = s;
        b.addEventListener('click', () => {
          covenPickedSigil = s;
          pick.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b));
        });
        pick.appendChild(b);
      }
    }
    return;
  }
  title.textContent = `${getCovenState().sigil} ${getCovenState().name}`;
  none.classList.add('hidden');
  main.classList.remove('hidden');
  document.getElementById('covenMotd').textContent = getCovenState().motd || 'No words over the door yet.';
  document.querySelectorAll('#covenTabs .slTab').forEach(b =>
    b.classList.toggle('active', b.dataset.cv === covenActiveTab));
  document.getElementById('covenMembersView').classList.toggle('hidden', covenActiveTab !== 'members');
  document.getElementById('covenChatView').classList.toggle('hidden', covenActiveTab !== 'chat');
  document.getElementById('covenBankView').classList.toggle('hidden', covenActiveTab !== 'bank');
  const amLeader = getCovenState().leaderKey === getCovenState().you;
  if (covenActiveTab === 'members') {
    const list = document.getElementById('covenMembers');
    list.innerHTML = '';
    for (const m of getCovenState().members) {
      const row = document.createElement('div');
      row.className = 'slRow';
      const dot = document.createElement('span'); dot.className = 'cvDot' + (m.online ? ' on' : '');
      const name = document.createElement('span'); name.className = 'slName';
      name.textContent = `${m.leader ? '👑 ' : ''}${m.name}`;
      row.appendChild(dot); row.appendChild(name);
      if (amLeader && !m.leader) {
        const kick = document.createElement('button');
        kick.className = 'kickBtn';
        kick.textContent = 'turn out';
        kick.addEventListener('click', () => getWs().send(JSON.stringify({ type: 'coven_kick', memberKey: m.key })));
        row.appendChild(kick);
      }
      list.appendChild(row);
    }
    document.getElementById('covenMotdBtn').style.display = amLeader ? '' : 'none';
    document.getElementById('covenClaimBtn').style.display = getMe() && getMe().room === 'cafe' ? '' : 'none';
  } else if (covenActiveTab === 'chat') {
    setCovenUnread(0);
    refreshCovenMenuRow();
    renderCovenChat();
  } else if (covenActiveTab === 'bank') {
    document.getElementById('covenGold').textContent = String(getCovenState().bank.gold);
    document.getElementById('covenBankNote').textContent = getMe() && getMe().room === 'bank'
      ? 'You stand in the Gilded Vault — the tab is open.'
      : 'The shared tab is used at the 🏦 Gilded Vault, like your own account.';
    const grid = document.getElementById('covenSlots');
    grid.innerHTML = '';
    getCovenState().bank.slots.forEach((s, i) => {
      const cell = document.createElement('div');
      cell.className = 'covenSlot';
      if (s) {
        const meta = ITEM_CATALOG[s.itemId];
        cell.innerHTML = `${meta ? meta.icon : '❔'}<span class="qty">×${s.qty}</span>`;
        cell.title = meta ? meta.name : s.itemId;
        cell.addEventListener('click', () => getWs().send(JSON.stringify({ type: 'coven_withdraw_item', covenSlot: i })));
      }
      grid.appendChild(cell);
    });
    const log = document.getElementById('covenLog');
    log.innerHTML = '';
    for (const l of (getCovenState().log || []).slice().reverse()) {
      const row = document.createElement('div');
      row.className = 'slRow';
      row.textContent = `${l.who} ${l.action}`;
      log.appendChild(row);
    }
  }
}
function renderCovenChat() {
  const log = document.getElementById('covenChatLog');
  if (!log) return;
  log.innerHTML = '';
  for (const l of getCovenChatLines()) {
    const row = document.createElement('div');
    const who = document.createElement('span'); who.className = 'cvWho'; who.textContent = `${l.sigil} ${l.who}: `;
    const text = document.createElement('span'); text.textContent = l.text;
    row.appendChild(who); row.appendChild(text);
    log.appendChild(row);
  }
  log.scrollTop = log.scrollHeight;
}
function openCovenInviteToast(msg) {
  // Reuse the announce banner shape: a click-to-answer toast.
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;top:120px;left:50%;transform:translateX(-50%);z-index:45;background:#241a3b;border:1px solid #5ee7c0;border-radius:14px;padding:12px 16px;color:#e8dcc8;font-size:13.5px;text-align:center;max-width:320px;';
  const label = document.createElement('div');
  label.textContent = `${msg.sigil} ${msg.fromName} invites you into ${msg.covenName} (${msg.members}/8)`;
  wrap.appendChild(label);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:8px;';
  const yes = document.createElement('button');
  yes.className = 'btn'; yes.style.margin = '0'; yes.textContent = 'Join the circle';
  yes.addEventListener('click', () => { getWs().send(JSON.stringify({ type: 'coven_invite_accept', inviteId: msg.inviteId })); wrap.remove(); });
  const no = document.createElement('button');
  no.className = 'btn'; no.style.margin = '0'; no.textContent = 'Decline';
  no.addEventListener('click', () => { getWs().send(JSON.stringify({ type: 'coven_invite_decline', inviteId: msg.inviteId })); wrap.remove(); });
  row.appendChild(yes); row.appendChild(no);
  wrap.appendChild(row);
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 55000);
}
// The claimed café table: a floating sigil over the middle of the room.
let covenTableSprite = null;
function refreshCovenTableVisual() {
  try {
    if (covenTableSprite && covenTableSprite.parent) covenTableSprite.parent.remove(covenTableSprite);
    covenTableSprite = null;
    if (!getCovenTableState() || !getMe() || getMe().room !== 'cafe' || !getCurrentInterior() || !getCurrentInterior().scene) return;
    covenTableSprite = makeNpcNameSprite(`${getCovenTableState().sigil} ${getCovenTableState().name}'s table`);
    covenTableSprite.position.set(0, 95, -40);
    getCurrentInterior().scene.add(covenTableSprite);
  } catch (e) { /* cosmetic only */ }
}
(function () {
  const closeBtn = document.getElementById('covenCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeCovenModal);
  const tabs = document.getElementById('covenTabs');
  if (tabs) tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.slTab');
    if (!b) return;
    covenActiveTab = b.dataset.cv;
    renderCovenModal();
  });
  const create = document.getElementById('covenCreateBtn');
  if (create) create.addEventListener('click', () => {
    const name = document.getElementById('covenNameInput').value.trim();
    document.getElementById('covenErr').textContent = '';
    getWs().send(JSON.stringify({ type: 'coven_create', name, sigil: covenPickedSigil || getCovenSigilsCatalog()[0] }));
  });
  const invite = document.getElementById('covenInviteBtn');
  if (invite) invite.addEventListener('click', () => {
    const target = nearestCovenInvitee();
    document.getElementById('covenErr').textContent = '';
    if (!target) { document.getElementById('covenErr').textContent = 'Nobody close enough — walk up to them first.'; return; }
    getWs().send(JSON.stringify({ type: 'coven_invite', targetId: target.id }));
  });
  const claim = document.getElementById('covenClaimBtn');
  if (claim) claim.addEventListener('click', () => getWs().send(JSON.stringify({ type: 'coven_claim_table' })));
  const motd = document.getElementById('covenMotdBtn');
  if (motd) motd.addEventListener('click', () => {
    const text = prompt('The words over the door (up to 120 chars):', getCovenState() ? getCovenState().motd : '');
    if (text != null) getWs().send(JSON.stringify({ type: 'coven_motd', text }));
  });
  const leave = document.getElementById('covenLeaveBtn');
  let leaveArmed = 0;
  if (leave) leave.addEventListener('click', () => {
    if (Date.now() - leaveArmed < 3000) {
      getWs().send(JSON.stringify({ type: 'coven_leave' }));
      leave.textContent = '🥀 Leave the circle';
      return;
    }
    leaveArmed = Date.now();
    leave.textContent = '⚠️ Tap again to leave the circle';
    setTimeout(() => { leave.textContent = '🥀 Leave the circle'; }, 3200);
  });
  const send2 = document.getElementById('covenChatSend');
  const input = document.getElementById('covenChatInput');
  const sendChat = () => {
    if (!input.value.trim()) return;
    getWs().send(JSON.stringify({ type: 'coven_chat', text: input.value.trim() }));
    input.value = '';
  };
  if (send2) send2.addEventListener('click', sendChat);
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); e.stopPropagation(); });
  const gold = document.getElementById('covenGoldAmt');
  if (gold) gold.addEventListener('keydown', (e) => e.stopPropagation());
  const dep = document.getElementById('covenDepositBtn');
  if (dep) dep.addEventListener('click', () => {
    const amt = parseInt(document.getElementById('covenGoldAmt').value, 10);
    if (amt > 0) getWs().send(JSON.stringify({ type: 'coven_deposit_gold', amount: amt }));
  });
  const wit = document.getElementById('covenWithdrawBtn');
  if (wit) wit.addEventListener('click', () => {
    const amt = parseInt(document.getElementById('covenGoldAmt').value, 10);
    if (amt > 0) getWs().send(JSON.stringify({ type: 'coven_withdraw_gold', amount: amt }));
  });
})();
function nearestCovenInvitee() {
  // NOTE: deliberately NOT named nearestOtherPlayer — the combat helper of
  // that name exists further down, and duplicate top-level declarations
  // silently shadow each other (the collision uncapped this invite range
  // for a while). 160 units ≈ "standing with you at the table."
  if (!getMe()) return null;
  let best = null, bestD = 160;
  for (const id in getPlayers()) {
    const p = getPlayers()[id];
    if (!p || p.id === getMe().id || p.room !== getMe().room) continue;
    const d = Math.hypot(p.x - getMe().x, p.y - getMe().y);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

  return { refreshCovenMenuRow, openCovenModal, closeCovenModal, renderCovenModal, renderCovenChat, openCovenInviteToast, refreshCovenTableVisual };
}
