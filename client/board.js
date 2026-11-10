// ---------------------------------------------------------------------------
// The Town Board (Tier 3.4 Phase C) — weekly leaderboards + tournament note.
// DI factory; open-state via the Modals registry. boardState is shared app
// state (injected via getBoardState).
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';
import { renderTroy } from './troy.js';

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
const TOOL_LABEL = { pendulum: '🪢 Pendulum', tarot: '🃏 Cards', runes: 'ᚱ Staves', scry: '🥣 Bowl', leaves: '☕ Teacup', ogham: '🌳 Staves' };
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
// The result replaces the working in the same list. "Finish" sits at the
// bottom of a long card, so a fresh result starts the list back at the top
// (the "— done" line and the reading), not wherever the working was scrolled.
let resultShown = null;
// The curse tablet being put together on the Board: the clauses chosen so far,
// in order, which way it is written, and the last thing the server said.
let tablet = { picks: [], backwards: 'none', note: '', pending: false };
function callerError(message) {
  if (tablet.pending) { tablet.pending = false; tablet.note = message || ''; renderBoardModal(); }
}
const revStr = (t) => [...t].reverse().join('');
function tabletLines(tiles, picks, way) {
  const lines = picks.map((k) => (tiles.find((t) => t.key === k) || {}).latin).filter(Boolean);
  if (way === 'whole') return lines.map(revStr).reverse();
  if (way === 'lines') return lines.map(revStr);
  if (way === 'words') return lines.map((l) => l.split(' ').map(revStr).join(' '));
  return lines;
}
function renderTablet(body, s) {
  const tb = s.tablet;
  const box = el('div', 'tabletBox');
  if (tb.use) box.appendChild(el('div', 'callerStepNote', tb.use));
  // The metal, with the clauses on it so far (backwards, if that's the way).
  const plate = el('div', 'tabletPlate');
  plate.setAttribute('role', 'group');
  plate.setAttribute('aria-label', `The tablet: ${tablet.picks.length} of 6 clauses written`);
  const lines = tabletLines(tb.tiles, tablet.picks, tablet.backwards);
  if (!lines.length) plate.appendChild(el('div', 'tabletEmpty', 'Bare pewter, waiting for the stylus.'));
  for (const ln of lines) plate.appendChild(el('div', 'tabletLine', ln));
  box.appendChild(plate);
  // In English, in the order chosen, whichever way the metal reads.
  if (tablet.picks.length) {
    const eng = el('ol', 'tabletEnglish');
    for (const k of tablet.picks) { const t = tb.tiles.find((q) => q.key === k); if (t) eng.appendChild(el('li', '', t.en)); }
    box.appendChild(eng);
  }
  // The clauses to choose from: one of each part, any of its wordings.
  const usedParts = new Set(tablet.picks.map((k) => (tb.tiles.find((t) => t.key === k) || {}).part));
  const tiles = el('div', 'tabletTiles');
  for (const t of tb.tiles) {
    const b = el('button', 'btn tabletTile');
    b.appendChild(el('span', 'tabletLatin', t.latin));
    b.appendChild(el('span', 'tabletEn', `${t.en} (${t.src})`));
    b.disabled = tablet.pending || tablet.picks.length >= 6 || usedParts.has(t.part);
    b.setAttribute('aria-label', `${t.latin}: ${t.en}. From ${t.src}. ${tb.parts[t.part] || ''}.`);
    b.addEventListener('click', () => { tablet.picks.push(t.key); tablet.note = ''; renderBoardModal(); });
    tiles.appendChild(b);
  }
  box.appendChild(tiles);
  // Which way round to write it.
  const way = el('label', 'tabletWay');
  way.appendChild(el('span', '', 'Written: '));
  const sel = document.createElement('select');
  sel.className = 'tabletWaySel';
  sel.setAttribute('aria-label', 'Which way round to write it');
  for (const w of tb.backwards || []) {
    const o = document.createElement('option'); o.value = w.key; o.textContent = w.label + (w.src ? ` (${w.src})` : '');
    if (w.key === tablet.backwards) o.selected = true;
    sel.appendChild(o);
  }
  sel.disabled = tablet.pending;
  sel.addEventListener('change', () => { tablet.backwards = sel.value; renderBoardModal(); });
  way.appendChild(sel);
  box.appendChild(way);
  const note = el('div', 'tabletNote', tablet.note);
  note.setAttribute('aria-live', 'polite');
  box.appendChild(note);
  const row = el('div', 'tabletBtns');
  const undo = el('button', 'btn charmSay', 'Scratch out the last clause');
  undo.disabled = tablet.pending || !tablet.picks.length;
  undo.addEventListener('click', () => { tablet.picks.pop(); tablet.note = ''; renderBoardModal(); });
  const fin = el('button', 'btn charmSay tabletFinish', '🪙 Finish the tablet');
  fin.disabled = tablet.pending || tablet.picks.length < 6;
  fin.addEventListener('click', () => {
    tablet.pending = true; tablet.note = '';
    send({ type: 'tablet_write', parts: tablet.picks.slice(), backwards: tablet.backwards });
    renderBoardModal();
  });
  row.appendChild(undo); row.appendChild(fin);
  box.appendChild(row);
  body.appendChild(box);
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
  if (r !== resultShown) { resultShown = r; list.scrollTop = 0; }
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
  // A tablet finished (or a working set aside) starts the next one clean.
  if (!st.active || !st.active.steps.some((s) => s.kind === 'tablet' && !s.done)) tablet = { picks: [], backwards: 'none', note: '', pending: false };
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
      } else if (s.done && s.kind === 'troy' && s.troy) {
        // The finished Caerdroia stays on the Board, all eight walls.
        if (s.note) body.appendChild(el('div', 'callerStepNote', s.note));
        renderTroy(body, s, send, el, renderBoardModal);
      } else if (s.done && s.kind === 'tablet' && s.tablet && s.tablet.written) {
        // …and so does the tablet, as it was written.
        if (s.note) body.appendChild(el('div', 'callerStepNote', s.note));
        const plate = el('div', 'tabletPlate');
        plate.setAttribute('role', 'group');
        plate.setAttribute('aria-label', 'The finished tablet');
        for (const ln of s.tablet.written) plate.appendChild(el('div', 'tabletLine', ln));
        body.appendChild(plate);
      } else if (s.done && s.note) {
        body.appendChild(el('div', 'callerStepNote', s.note));
      } else if (s.kind === 'knots' && !s.done) {
        // A counted working: a knot for every wart, nine strokes for a stye…
        if (s.use) body.appendChild(el('div', 'callerStepNote', s.use));
        const row = el('div', 'knotRow');
        for (let k = 0; k < s.count; k++) row.appendChild(el('span', 'knotMark' + (k < s.tied ? ' tied' : ''), k < s.tied ? '●' : '○'));
        body.appendChild(row);
        const b = el('button', 'btn charmSay', `${s.icon || '🪢'} ${s.verb || 'Tie a knot'} (${s.tied + 1} of ${s.count})`);
        b.addEventListener('click', () => { b.disabled = true; send({ type: 'knot_tie' }); });
        body.appendChild(b);
      } else if (s.kind === 'troy' && !s.done && s.troy) {
        // Caerdroia, wall by wall (client/troy.js).
        renderTroy(body, s, send, el, renderBoardModal);
      } else if (s.kind === 'rite' && !s.done && s.rite) {
        // A Hallowe'en rite: how it's done (after Burns's notes), then do it.
        body.appendChild(el('div', 'callerStepNote', s.rite.how));
        const b = el('button', 'btn charmSay', `${s.rite.icon} ${s.rite.name}`);
        b.addEventListener('click', () => { b.disabled = true; send({ type: 'rite_do' }); });
        body.appendChild(b);
      } else if (s.kind === 'charm' && !s.done && s.charm) {
        // Say it line by line: the lines already said, then the next to say.
        const box = el('div', 'charmBox');
        s.charm.lines.forEach((ln, li) => {
          if (li < s.said) box.appendChild(el('div', 'charmLine said', ln));
          else if (li === s.said) {
            const b = el('button', 'btn charmSay', `Say: “${ln}”`);
            b.addEventListener('click', () => { b.disabled = true; send({ type: 'charm_say', line: li }); });
            box.appendChild(b);
          }
        });
        if (s.charm.use) box.appendChild(el('div', 'callerStepNote', s.charm.use));
        body.appendChild(box);
      } else if (s.kind === 'scribe' && !s.done && s.scribe) {
        // Write it out: the lines so far, narrowing, then the next to write.
        const box = el('div', 'scribeBox');
        if (s.scribe.use) box.appendChild(el('div', 'callerStepNote', s.scribe.use));
        const slip = el('div', 'scribeSlip' + (s.scribe.copy ? ' copy' : ''));
        for (let li = 0; li < s.written; li++) slip.appendChild(el('div', 'scribeLine', s.scribe.lines[li]));
        box.appendChild(slip);
        if (s.scribe.copy && s.scribe.lines[s.written]) box.appendChild(el('div', 'scribeCopy', `Copy: ${s.scribe.lines[s.written]}`));
        const row = el('div', 'scribeRow');
        const inp = document.createElement('input');
        inp.className = 'scribeInput'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.maxLength = 20;
        inp.placeholder = s.scribe.copy ? 'Copy the line' : (s.written === 0 ? 'Write the whole word' : 'The line above, its last letter off');
        if (s.scribe.copy) inp.maxLength = 120;
        inp.setAttribute('aria-label', `Line ${s.written + 1} of ${s.scribe.lines.length}`);
        const write = () => { const t = inp.value.trim(); if (!t) return; b.disabled = true; send({ type: 'scribe_line', text: t }); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') write(); });
        const b = el('button', 'btn charmSay', `✍️ Write line ${s.written + 1} of ${s.scribe.lines.length}`);
        b.addEventListener('click', write);
        row.appendChild(inp); row.appendChild(b);
        box.appendChild(row);
        body.appendChild(box);
      } else if (s.kind === 'tablet' && !s.done && s.tablet) {
        renderTablet(body, s);
      } else if ((s.kind === 'sieve' || s.kind === 'key') && !s.done) {
        // Name them one by one; the sieve turns at one.
        body.appendChild(el('div', 'callerStepNote', s.kind === 'key'
          ? 'The key bound into the Bible at the 50th Psalm, the book held on two fingers. Read \u201cWhen thou sawest a thief\u2026\u201d and name them, one by one:'
          : 'The shears\u2019 points in the sieve\u2019s rim, held up on two fingertips. Name them, one by one:'));
        const names = el('div', 'sieveNames');
        for (const n of s.suspects || []) {
          const tried = (s.tried || []).includes(n);
          const b = el('button', 'btn sieveName' + (tried ? ' still' : ''), tried ? `${n} — still` : n);
          b.disabled = tried;
          b.addEventListener('click', () => { b.disabled = true; send({ type: s.kind === 'key' ? 'key_turn' : 'sieve_turn', name: n }); });
          names.appendChild(b);
        }
        body.appendChild(names);
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

  return { openBoardModal, closeBoardModal, renderBoardModal, callerError, tabletState: () => ({ ...tablet, picks: tablet.picks.slice() }) };
}
