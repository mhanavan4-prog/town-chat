// ---------------------------------------------------------------------------
// Covens UI (Tier 3.4 Phase C) — roster, chat, shared bank, invites, and the
// claimed-table sprite. DI factory; open-state via the Modals registry. The
// coven* state is shared (WS handlers write it) so it's injected via getters;
// setCovenUnread handles the read-badge reset.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createCoven({ getWs, getMe, getPlayers, getCovenState, getCovenTableState, getCovenUnread, setCovenUnread, getCovenChatLines, getCovenSigilsCatalog, getCurrentInterior, makeNpcNameSprite, ITEM_CATALOG, accountAuth, getCovenCharterInfo, startCharterCheckout, getIsAdmin, getCovenStandings, getCovenChampions }) {
  const isAdmin = () => typeof getIsAdmin === 'function' && !!getIsAdmin();
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
    // Founding a coven needs a one-time Coven Charter (Session N). Label the
    // button for what the next click will do: found (charter in hand) or buy.
    // Restore the name/sigil the player typed before being sent to Stripe to buy
    // their Charter, so a round-trip through checkout doesn't lose their work.
    try {
      const pend = JSON.parse(localStorage.getItem('tc_pending_coven') || 'null');
      if (pend && pend.name) {
        const nameEl = document.getElementById('covenNameInput');
        if (nameEl && !nameEl.value) nameEl.value = pend.name;
        if (pend.sigil) covenPickedSigil = pend.sigil;
        localStorage.removeItem('tc_pending_coven');
      }
    } catch (e) {}
    const info = (typeof getCovenCharterInfo === 'function' && getCovenCharterInfo()) || { charters: 0, charterPriceCents: 999, paymentsEnabled: false };
    const createBtn = document.getElementById('covenCreateBtn');
    if (createBtn) {
      if (isAdmin()) createBtn.textContent = '🔑 Found the coven (admin — free)';
      else if ((info.charters || 0) >= 1) createBtn.textContent = '🌙 Found the coven (Charter ready)';
      else if (info.paymentsEnabled) createBtn.textContent = `Found a coven — $${((info.charterPriceCents || 999) / 100).toFixed(2)} one-time`;
      else createBtn.textContent = 'Found the coven';
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
  document.getElementById('covenStandingsView').classList.toggle('hidden', covenActiveTab !== 'standings');
  if (covenActiveTab === 'standings') renderCovenStandings();
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
      row.style.cssText = 'padding:7px 10px;margin:4px 0;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);font-size:12.5px;line-height:1.35;color:#ece3ff';
      const who = document.createElement('b');
      who.style.cssText = 'color:#9ee37d;font-weight:650';
      who.textContent = l.who;
      row.appendChild(who);
      row.appendChild(document.createTextNode(' ' + l.action));
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
// The café table: a floating sigil over the middle of the room. The week's
// leading coven holds the Champions' Table (shown with a 🏆), falling back to
// whoever casually claimed the seat if no one has scored yet this week.
let covenTableSprite = null;
function refreshCovenTableVisual() {
  try {
    if (covenTableSprite && covenTableSprite.parent) covenTableSprite.parent.remove(covenTableSprite);
    covenTableSprite = null;
    if (!getMe() || getMe().room !== 'cafe' || !getCurrentInterior() || !getCurrentInterior().scene) return;
    const champ = (typeof getCovenChampions === 'function' && getCovenChampions()) || null;
    const seat = getCovenTableState();
    let label = null;
    if (champ) label = `🏆 ${champ.sigil} ${champ.name} — Champions' Table`;
    else if (seat) label = `${seat.sigil} ${seat.name}'s table`;
    if (!label) return;
    covenTableSprite = makeNpcNameSprite(label);
    covenTableSprite.position.set(0, 95, -40);
    getCurrentInterior().scene.add(covenTableSprite);
  } catch (e) { /* cosmetic only */ }
}
// The weekly inter-coven standings board — the Champions' Table race. Fed by
// the server's coven_standings reply (requested when the tab is opened).
function renderCovenStandings() {
  const list = document.getElementById('covenStandingsList');
  const ends = document.getElementById('covenStandingsEnds');
  if (!list) return;
  const st = (typeof getCovenStandings === 'function' && getCovenStandings()) || null;
  if (!st || !st.standings) { list.innerHTML = '<div class="slNote">Tallying the circles…</div>'; if (ends) ends.textContent = ''; return; }
  if (ends) {
    const ms = (st.endsAt || 0) - Date.now();
    const d = Math.max(0, Math.floor(ms / 86400000)), h = Math.max(0, Math.floor((ms % 86400000) / 3600000));
    ends.textContent = ms > 0 ? `This week ends in ${d}d ${h}h — the leader holds the table.` : 'Tallying the final standings…';
  }
  list.innerHTML = '';
  if (st.reign) {
    const r = document.createElement('div');
    r.className = 'slNote';
    r.style.cssText = 'border:1px solid rgba(201,133,0,0.4);background:rgba(201,133,0,0.1)';
    r.innerHTML = `👑 <b>Reigning Champions:</b> ${st.reign.sigil} ${st.reign.name}` +
      (st.reign.titles > 1 ? ` <span style="opacity:.75">— ${st.reign.titles} titles</span>` : '') +
      ` <span style="opacity:.6">(last week)</span>`;
    list.appendChild(r);
  }
  if (!st.standings.length) { const e = document.createElement('div'); e.className = 'slNote'; e.textContent = 'No coven has scored yet this week. Be the first.'; list.appendChild(e); return; }
  st.standings.forEach((row, i) => {
    const mine = row.covenId === st.myCovenId;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;margin:3px 0;border-radius:8px;' +
      (mine ? 'background:rgba(158,227,125,0.12);border:1px solid rgba(94,231,192,0.45);' : 'border:1px solid rgba(255,255,255,0.06);');
    const name = document.createElement('span');
    name.style.cssText = 'font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    name.textContent = `${i === 0 ? '🏆' : '#' + (i + 1)}  ${row.sigil} ${row.name}`;
    const pts = document.createElement('span');
    pts.style.cssText = 'color:#9ee37d;font-weight:650;white-space:nowrap';
    pts.textContent = `${Number(row.points).toLocaleString()} pts`;
    pts.title = `🔥 ${row.breakdown.hunt} · ⚔️ ${row.breakdown.boss} · 🕳️ ${row.breakdown.delve} · 🏹 ${row.breakdown.tourney}`;
    div.appendChild(name); div.appendChild(pts);
    list.appendChild(div);
  });
}
(function () {
  const closeBtn = document.getElementById('covenCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeCovenModal);
  const tabs = document.getElementById('covenTabs');
  if (tabs) tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.slTab');
    if (!b) return;
    covenActiveTab = b.dataset.cv;
    if (covenActiveTab === 'standings') getWs().send(JSON.stringify({ type: 'coven_standings' }));
    renderCovenModal();
  });
  const create = document.getElementById('covenCreateBtn');
  if (create) create.addEventListener('click', () => {
    document.getElementById('covenErr').textContent = '';
    const info = (typeof getCovenCharterInfo === 'function' && getCovenCharterInfo()) || { charters: 0, paymentsEnabled: false };
    // No Charter yet → send them to buy one (unless payments are off, in which
    // case let the server respond with its own guidance). Admins skip the
    // purchase entirely — the server founds their coven for free.
    if (!isAdmin() && (info.charters || 0) < 1 && info.paymentsEnabled && typeof startCharterCheckout === 'function') {
      const name = document.getElementById('covenNameInput').value.trim();
      if (name.length < 3) { document.getElementById('covenErr').textContent = 'Name your coven first (3–24 characters), then buy its Charter.'; return; }
      try { localStorage.setItem('tc_pending_coven', JSON.stringify({ name, sigil: covenPickedSigil || getCovenSigilsCatalog()[0] })); } catch (e) {}
      startCharterCheckout(create);
      return;
    }
    const name = document.getElementById('covenNameInput').value.trim();
    getWs().send(JSON.stringify({ type: 'coven_create', name, sigil: covenPickedSigil || getCovenSigilsCatalog()[0] }));
  });
  // Invite by exact username — unambiguous even in a crowded town (a proximity
  // "nearest player" invite could target the wrong soul). The server resolves
  // the name to an online account and sends them the invite toast.
  const inviteInput = document.getElementById('covenInviteInput');
  const sendCovenInvite = () => {
    const username = (inviteInput ? inviteInput.value : '').trim();
    document.getElementById('covenErr').textContent = '';
    if (!username) { document.getElementById('covenErr').textContent = 'Type the username of the player to invite.'; if (inviteInput) inviteInput.focus(); return; }
    getWs().send(JSON.stringify({ type: 'coven_invite', username }));
    if (inviteInput) inviteInput.value = '';
  };
  const invite = document.getElementById('covenInviteBtn');
  if (invite) invite.addEventListener('click', sendCovenInvite);
  if (inviteInput) inviteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendCovenInvite(); } });
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
  return { refreshCovenMenuRow, openCovenModal, closeCovenModal, renderCovenModal, renderCovenChat, openCovenInviteToast, refreshCovenTableVisual, renderCovenStandings };
}
