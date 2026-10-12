// ---------------------------------------------------------------------------
// Covens UI (Tier 3.4 Phase C) — roster, chat, shared bank, invites, and the
// claimed-table sprite. DI factory; open-state via the Modals registry. The
// coven* state is shared (WS handlers write it) so it's injected via getters;
// setCovenUnread handles the read-badge reset.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createCoven({ getWs, getMe, getPlayers, getCovenState, getCovenTableState, getCovenUnread, setCovenUnread, getCovenChatLines, getCovenSigilsCatalog, getCurrentInterior, makeNpcNameSprite, ITEM_CATALOG, accountAuth, getCovenCharterInfo, startCharterCheckout, startUpkeepCheckout, getIsAdmin, getCovenStandings, getCovenChampions, getCovenRite }) {
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
  document.getElementById('covenRiteView').classList.toggle('hidden', covenActiveTab !== 'rite');
  if (covenActiveTab === 'standings') renderCovenStandings();
  if (covenActiveTab === 'rite') renderCovenRite();
  const amLeader = getCovenState().leaderKey === getCovenState().you;
  if (covenActiveTab === 'members') {
    const list = document.getElementById('covenMembers');
    list.innerHTML = '';
    renderCovenUpkeep(list); // upkeep card at the top — every member can see it and pay
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
// The upkeep card — shown to EVERY member in the Members view. Any member can
// pay the monthly $9.99 to keep the coven open; the state is derived from the
// server's raw timestamps against the local clock.
function renderCovenUpkeep(container) {
  const u = getCovenState() && getCovenState().upkeep;
  if (!u) return;
  const now = Date.now();
  const paid = now < (u.paidThroughAt || 0);
  const inGrace = !paid && u.graceEndsAt && now < u.graceEndsAt;
  const graceEligible = !u.graceUsedAt || (now - u.graceUsedAt) > u.resetMs;
  const price = '$' + (((u.priceCents || 999) / 100).toFixed(2));
  const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const daysLeft = (ts) => Math.max(0, Math.ceil((ts - now) / 86400000));

  const card = document.createElement('div');
  card.className = 'covenUpkeep' + (inGrace ? ' grace' : '');
  const title = document.createElement('div');
  title.className = 'cuTitle';
  title.textContent = `🕯️ Upkeep — ${price}/month`;
  card.appendChild(title);

  const status = document.createElement('div');
  status.className = 'cuStatus';
  if (inGrace) {
    status.textContent = `⚠️ Upkeep lapsed — ${daysLeft(u.graceEndsAt)} day${daysLeft(u.graceEndsAt) === 1 ? '' : 's'} left for any member to pay, or the coven disbands.`;
  } else if (paid) {
    status.textContent = `Paid through ${fmtDate(u.paidThroughAt)}.`;
  } else {
    status.textContent = 'Upkeep is due.';
  }
  card.appendChild(status);

  // Perk reminder: active upkeep lets every member keep the seasonal Rite going
  // AND walk into the Phantom Parlor (the altar room) without a personal pass.
  const perk = document.createElement('div');
  perk.className = 'cuStatus';
  perk.style.cssText = 'opacity:.72;font-size:11.5px';
  perk.textContent = '🕯️ While paid: the coven Rite runs, and members enter the Phantom Parlor free.';
  card.appendChild(perk);

  // If the one yearly grace has been spent, warn that a lapse now is fatal.
  if (paid && !graceEligible && u.graceUsedAt) {
    const warn = document.createElement('div');
    warn.className = 'cuWarn';
    warn.textContent = `Grace already used this year — if upkeep lapses before ${fmtDate(u.graceUsedAt + u.resetMs)}, the coven disbands immediately.`;
    card.appendChild(warn);
  }

  if (u.paymentsEnabled) {
    const pay = document.createElement('button');
    pay.className = 'btn cuPay';
    pay.textContent = `Pay upkeep (${price})`;
    pay.addEventListener('click', () => { if (typeof startUpkeepCheckout === 'function') startUpkeepCheckout(pay); });
    card.appendChild(pay);
  } else {
    const off = document.createElement('div');
    off.className = 'cuWarn';
    off.textContent = 'Payments are not enabled on this server.';
    card.appendChild(off);
  }
  container.appendChild(card);
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
    r.style.cssText = 'border:1px solid rgba(143,111,255,0.45);background:rgba(143,111,255,0.12);color:#cfc3e8';
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
    name.style.cssText = 'font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e8dcc8';
    name.textContent = `${i === 0 ? '🏆' : '#' + (i + 1)}  ${row.sigil} ${row.name}`;
    const pts = document.createElement('span');
    pts.style.cssText = 'color:#9ee37d;font-weight:650;white-space:nowrap';
    pts.textContent = `${Number(row.points).toLocaleString()} pts`;
    pts.title = `🔥 ${row.breakdown.hunt} · ⚔️ ${row.breakdown.boss} · 🕳️ ${row.breakdown.delve} · 🏹 ${row.breakdown.tourney}`;
    div.appendChild(name); div.appendChild(pts);
    list.appendChild(div);
  });
}
// The coven Rite panel — the live sabbat's seasonal, coven-only questline. Fed
// by the server's rite_state reply (requested when the tab opens, pushed on any
// contribution). Phases run in order; a gated phase shows its attunement
// countdown; the candle phase is kept at the séance altar in the Phantom Parlor.
function fmtCountdown(ms) {
  ms = Math.max(0, ms);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m`;
}
function riteBar(label, cur, target) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin:6px 0';
  const top = document.createElement('div');
  top.style.cssText = 'display:flex;justify-content:space-between;font-size:12px;color:#ece3ff;margin-bottom:3px';
  const l = document.createElement('span'); l.textContent = label;
  const c = document.createElement('span'); c.style.cssText = 'color:#9ee37d;font-weight:650'; c.textContent = `${cur} / ${target}`;
  top.appendChild(l); top.appendChild(c);
  const track = document.createElement('div');
  track.style.cssText = 'height:8px;border-radius:5px;background:rgba(255,255,255,0.08);overflow:hidden';
  const fill = document.createElement('div');
  const pct = Math.min(100, Math.round(100 * cur / Math.max(1, target)));
  fill.style.cssText = `height:100%;width:${pct}%;border-radius:5px;background:${cur >= target ? '#5ee7c0' : '#8f6fff'};transition:width .3s`;
  track.appendChild(fill);
  wrap.appendChild(top); wrap.appendChild(track);
  return wrap;
}
function renderCovenRite() {
  const body = document.getElementById('covenRiteBody');
  if (!body) return;
  body.innerHTML = '';
  const r = (typeof getCovenRite === 'function' && getCovenRite()) || null;
  const note = (txt) => { const d = document.createElement('div'); d.className = 'slNote'; d.innerHTML = txt; return d; };
  if (!r) { body.appendChild(note('The vigil is kept by covens. Join or found one, then return here at the sabbat.')); return; }
  if (r.none) { body.appendChild(note('🌙 No Rite stirs this season — the next begins at the coming sabbat. Watch the Wheel of the Year.')); return; }

  const head = document.createElement('div');
  head.className = 'slNote';
  head.innerHTML = `<div style="font-size:15px;font-weight:700;color:#fff">${r.glyph} ${r.name}</div>` +
    `<div style="margin-top:4px;opacity:.9">${r.blurb}</div>` +
    `<div style="margin-top:6px;font-size:12px;opacity:.75">Scaled for a coven of ${r.memberScale}. ` +
    (r.completed ? '✅ Completed — the blessing holds over the coven this season.'
      : r.expired ? '🥀 The season turned before the vigil was done.'
      : `Reward: ${r.reward.gold} gold each${r.reward.title ? ` + the title “${r.reward.title}”` : ''}, and the coven’s seasonal blessing.`) +
    `</div>`;
  body.appendChild(head);

  if (r.locked) {
    body.appendChild(note('⚠️ The Rite is <b>paused</b> — the coven’s upkeep has lapsed. Pay it (Members tab) to keep the vigil.'));
  }
  if (r.buffActive && !r.locked) {
    body.appendChild(note('🌟 The season’s blessing is <b>active</b> for the whole coven.'));
  }

  (r.phases || []).forEach((ph, i) => {
    const card = document.createElement('div');
    const active = ph.active && !r.locked;
    card.style.cssText = 'padding:10px 12px;margin:8px 0;border-radius:10px;border:1px solid ' +
      (ph.completed ? 'rgba(94,231,192,0.45);background:rgba(94,231,192,0.08)'
        : active ? 'rgba(143,111,255,0.5);background:rgba(143,111,255,0.1)'
        : 'rgba(255,255,255,0.08);background:rgba(255,255,255,0.03)');
    const title = document.createElement('div');
    title.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-weight:650;color:#fff';
    const left = document.createElement('span');
    left.textContent = `${ph.glyph || '•'} ${i + 1}. ${ph.title}`;
    const state = document.createElement('span');
    state.style.cssText = 'font-size:12px;font-weight:600';
    if (ph.completed) { state.style.color = '#5ee7c0'; state.textContent = '✓ done'; }
    else if (!ph.unlocked) {
      state.style.color = '#c9a0ff';
      const at = ph.unlockAt || r.nextGateAt;
      state.textContent = at ? `🔒 opens in ${fmtCountdown(at - Date.now())}` : '🔒 locked';
    } else { state.style.color = '#ffd27a'; state.textContent = '⏳ in progress'; }
    title.appendChild(left); title.appendChild(state);
    card.appendChild(title);

    if (ph.unlocked || ph.completed) {
      const blurb = document.createElement('div');
      blurb.style.cssText = 'font-size:12px;opacity:.82;margin:5px 0 2px';
      blurb.textContent = ph.blurb || '';
      card.appendChild(blurb);
      if (ph.candle) {
        card.appendChild(riteBar(ph.candle.label || 'Candles lit', ph.candle.count, ph.candle.target));
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:12px;margin-top:4px;color:' + (ph.candle.youLit ? '#5ee7c0' : '#ece3ff');
        hint.innerHTML = ph.candle.youLit
          ? '🕯️ Your candle burns on the altar.'
          : (active ? '🕯️ Light yours at the <b>séance altar</b> in the Phantom Parlor (stand on the circle, press F / tap).' : '');
        card.appendChild(hint);
      } else {
        for (const o of (ph.objectives || [])) card.appendChild(riteBar(o.label, o.progress, o.target));
        if (ph.minContributors > 1) {
          const mc = document.createElement('div');
          mc.style.cssText = 'font-size:11.5px;opacity:.6;margin-top:3px';
          mc.textContent = `Needs at least ${ph.minContributors} witches to contribute.`;
          card.appendChild(mc);
        }
      }
    }
    body.appendChild(card);
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
    if (covenActiveTab === 'rite') getWs().send(JSON.stringify({ type: 'rite_state' }));
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
  return { refreshCovenMenuRow, openCovenModal, closeCovenModal, renderCovenModal, renderCovenChat, openCovenInviteToast, refreshCovenTableVisual, renderCovenStandings, renderCovenRite };
}
