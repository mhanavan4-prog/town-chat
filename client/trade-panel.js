// The trading table (lib/trade.js on the server): what you give on the left,
// what they give on the right, and nothing moves until both are ready.

// What of the pack can still be laid on the table: each thing once, with how
// many are held less how many are already offered.
function tradeChoices(slots, offered) {
  const have = new Map();
  for (const s of slots || []) if (s && s.itemId) have.set(s.itemId, (have.get(s.itemId) || 0) + (s.qty || 1));
  const out = [];
  for (const [itemId, qty] of have) {
    const on = (offered || []).reduce((n, i) => n + (i.itemId === itemId ? i.qty : 0), 0);
    if (qty - on > 0) out.push({ itemId, left: qty - on });
  }
  return out;
}
// Put n of a thing on the offer (or take it off with a negative n); never below nothing.
function tradeAdjust(items, itemId, n, max) {
  const out = (items || []).map((i) => ({ itemId: i.itemId, qty: i.qty }));
  const at = out.find((i) => i.itemId === itemId);
  if (at) at.qty = Math.max(0, Math.min(max != null ? max : Infinity, at.qty + n));
  else if (n > 0) out.push({ itemId, qty: Math.min(max != null ? max : Infinity, n) });
  return out.filter((i) => i.qty > 0);
}

export default function createTradePanel({ send, getInventory, getBalance, itemInfo, glyph, setUnlockToast }) {
  let state = null;          // the server's last word
  let goldDraft = null;      // what is being typed into the gold box, before it is sent
  const modal = () => document.getElementById('tradeModal');
  const isOpen = () => !!modal() && !modal().classList.contains('hidden');
  const sendOffer = (gold, items) => send({ type: 'trade_offer', gold, items });

  function close(tell) {
    if (tell && state && state.open) send({ type: 'trade_cancel' });
    if (modal()) modal().classList.add('hidden');
    state = null; goldDraft = null;
  }

  function side(title, offer, mine) {
    const col = document.createElement('div'); col.className = 'trSide';
    const h = document.createElement('div'); h.className = 'trSideHead'; h.textContent = title; col.appendChild(h);
    const gold = document.createElement('div'); gold.className = 'trGold';
    if (mine) {
      const lab = document.createElement('span'); lab.textContent = 'Gold ';
      const inp = document.createElement('input'); inp.type = 'number'; inp.min = '0'; inp.id = 'tradeGold'; inp.inputMode = 'numeric';
      inp.value = String(goldDraft != null ? goldDraft : offer.gold || '');
      inp.placeholder = '0';
      const commit = () => { const g = Math.max(0, Math.floor(Number(inp.value) || 0)); goldDraft = null; if (g !== offer.gold) sendOffer(g, offer.items); };
      inp.addEventListener('input', () => { goldDraft = inp.value; });
      inp.addEventListener('change', commit);
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      const of = document.createElement('span'); of.className = 'trOf'; of.textContent = ` of ${getBalance()} in the bank`;
      gold.append(lab, inp, of);
    } else {
      gold.textContent = offer.gold ? `🪙 ${offer.gold} gold` : 'No gold';
    }
    col.appendChild(gold);
    const list = document.createElement('div'); list.className = 'trItems';
    if (!offer.items.length) { const e = document.createElement('div'); e.className = 'trNone'; e.textContent = mine ? 'Nothing from your pack yet.' : 'Nothing yet.'; list.appendChild(e); }
    for (const it of offer.items) {
      const info = itemInfo(it.itemId) || {};
      const row = document.createElement(mine ? 'button' : 'div'); row.className = 'trItem';
      row.innerHTML = `<span class="trGi">${glyph(it.itemId, info.icon || '▫️')}</span>`;
      const nm = document.createElement('span'); nm.className = 'trName'; nm.textContent = `${info.name || it.name || it.itemId}${it.qty > 1 ? ' × ' + it.qty : ''}`;
      row.appendChild(nm);
      if (mine) { row.type = 'button'; row.title = 'Take one back'; row.addEventListener('click', () => sendOffer(offer.gold, tradeAdjust(offer.items, it.itemId, -1))); }
      list.appendChild(row);
    }
    col.appendChild(list);
    return col;
  }

  function render() {
    const body = document.getElementById('tradeBody');
    if (!body || !state || !state.open) return;
    const typing = document.activeElement && document.activeElement.id === 'tradeGold';
    body.innerHTML = '';
    document.getElementById('tradeTitle').textContent = `⚖️ Trading with ${state.with.name}`;
    const table = document.createElement('div'); table.className = 'trTable';
    table.append(side('You give', state.mine, true), side(`${state.with.name} gives`, state.theirs, false));
    body.appendChild(table);
    // the pack: tap a thing to lay one on the table
    const inv = getInventory();
    const choices = tradeChoices(inv && inv.slots, state.mine.items);
    const packHead = document.createElement('div'); packHead.className = 'trSideHead'; packHead.textContent = 'From your pack (tap to add one)';
    const pack = document.createElement('div'); pack.className = 'trPack';
    const full = state.mine.items.length >= (state.maxItems || 8);
    for (const c of choices) {
      const info = itemInfo(c.itemId) || {};
      const already = state.mine.items.some((i) => i.itemId === c.itemId);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'trItem';
      b.innerHTML = `<span class="trGi">${glyph(c.itemId, info.icon || '▫️')}</span>`;
      const nm = document.createElement('span'); nm.className = 'trName'; nm.textContent = `${info.name || c.itemId}${c.left > 1 ? ' × ' + c.left : ''}`;
      b.appendChild(nm);
      if (full && !already) { b.disabled = true; b.title = 'The table holds eight kinds of thing.'; }
      b.addEventListener('click', () => sendOffer(state.mine.gold, tradeAdjust(state.mine.items, c.itemId, 1)));
      pack.appendChild(b);
    }
    if (!choices.length) { const e = document.createElement('div'); e.className = 'trNone'; e.textContent = 'Your pack has nothing more to offer.'; pack.appendChild(e); }
    body.append(packHead, pack);
    const status = document.createElement('div'); status.className = 'trStatus';
    status.textContent = state.ready.me && state.ready.them ? 'Both ready.' : state.ready.me ? `Waiting for ${state.with.name}.` : state.ready.them ? `${state.with.name} is ready. Look it over, then say so.` : 'Nothing moves until you are both ready. Changing an offer un-readies you both.';
    body.appendChild(status);
    const rb = document.getElementById('tradeReadyBtn');
    if (rb) { rb.textContent = state.ready.me ? 'Not ready after all' : 'Ready'; rb.classList.toggle('trReadyOn', state.ready.me); }
    if (typing) { const g = document.getElementById('tradeGold'); if (g) { g.focus(); try { g.setSelectionRange(g.value.length, g.value.length); } catch (_) {} } }
  }

  function onState(msg) {
    if (!msg.open) {
      const was = isOpen();
      close(false);
      if (msg.message) setUnlockToast((msg.done ? '⚖️ ' : '') + msg.message, { always: true, level: msg.done ? 'important' : undefined });
      return was;
    }
    state = msg;
    modal().classList.remove('hidden');
    render();
    return true;
  }
  function toggleReady() { if (state && state.open) { const g = document.getElementById('tradeGold'); if (g && goldDraft != null) g.dispatchEvent(new Event('change')); send({ type: 'trade_ready', ready: !state.ready.me }); } }

  return { onState, close, isOpen, render, toggleReady };
}

export { tradeChoices, tradeAdjust };
