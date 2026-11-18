// ---------------------------------------------------------------------------
// The loot bag.
//
// Looting was one press that took everything on a body, sight unseen: the pack
// filled with things nobody chose. Now F (or a tap on the loot icon, or the
// prompt) opens the bag: what is on the body, listed. Take a thing by its row,
// or all of it with F again or the button; what you leave stays on the body
// for as long as the body does. Walking away, or Esc, closes it.
//
// The bag is small and does not stop the game: you can still move and fight
// with it open. The server decides everything (server.js loot_peek /
// loot_take); this only shows and asks.
// ---------------------------------------------------------------------------

const LB_RARITY = { uncommon: '#7fd08a', rare: '#6fb1ff', epic: '#c58bff', legendary: '#ffb648' };

// rows -> the short line under the title ("3 things", "1 thing", "Empty")
export function lootBagCount(items) { const n = (items || []).length; return n === 0 ? 'Empty' : n === 1 ? '1 thing' : `${n} things`; }

export function createLootBag({ send, doc = document, win = window, touch = () => false }) {
  let el = null, cur = null;   // cur: { targetType, targetId, items }
  function build() {
    el = doc.createElement('div'); el.id = 'lootBag'; el.className = 'hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Loot');
    el.innerHTML = '<div class="lbHead"><span class="lbTitle"></span><span class="lbCount"></span><button type="button" class="lbClose" aria-label="Leave it">✕</button></div><div class="lbRows"></div><div class="lbFoot"><button type="button" class="lbAll"></button></div>';
    doc.body.appendChild(el);
    el.querySelector('.lbClose').addEventListener('click', () => close());
    el.querySelector('.lbAll').addEventListener('click', () => takeAll());
    el.querySelector('.lbRows').addEventListener('click', (e) => { const row = e.target && e.target.closest ? e.target.closest('.lbRow') : null; if (row) take(Number(row.dataset.i)); });
    win.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { e.stopPropagation(); close(); } }, true);
  }
  const isOpen = () => !!(cur && el && !el.classList.contains('hidden'));
  function render() {
    el.querySelector('.lbTitle').textContent = '🎒 ' + (cur.title || 'On the body');
    el.querySelector('.lbCount').textContent = lootBagCount(cur.items);
    const rows = el.querySelector('.lbRows'); rows.textContent = '';
    for (const it of cur.items) {
      const b = doc.createElement('button'); b.type = 'button'; b.className = 'lbRow'; b.dataset.i = String(it.i);
      const ic = doc.createElement('span'); ic.className = 'lbIcon'; ic.textContent = it.icon || '❔';
      const nm = doc.createElement('span'); nm.className = 'lbName'; nm.textContent = it.name + (it.qty > 1 ? ` ×${it.qty}` : ''); if (it.rarity && LB_RARITY[it.rarity]) nm.style.color = LB_RARITY[it.rarity];
      // the rarity in a word as well: colour alone says nothing to someone who cannot tell these four apart
      if (it.rarity && LB_RARITY[it.rarity]) { const rw = doc.createElement('span'); rw.className = 'lbRarity'; rw.textContent = ' · ' + it.rarity; rw.style.cssText = 'font-size:11px;opacity:0.85;font-weight:400;'; nm.appendChild(rw); }
      const tk = doc.createElement('span'); tk.className = 'lbTake'; tk.textContent = 'Take';
      b.append(ic, nm, tk); rows.appendChild(b);
    }
    el.querySelector('.lbAll').textContent = touch() ? 'Take all' : 'Take all  (F)';
  }
  // The server's word on a body: rows to show, or none (which closes the bag if it was this body's).
  function show(msg) {
    if (!el) build();
    const items = Array.isArray(msg.items) ? msg.items : [];
    if (!items.length) { if (cur && cur.targetType === msg.targetType && cur.targetId === msg.targetId) close(); return; }
    cur = { targetType: msg.targetType, targetId: msg.targetId, title: msg.title, items };
    render(); el.classList.remove('hidden');
  }
  function close() { cur = null; if (el) el.classList.add('hidden'); }
  function take(i) { if (cur && Number.isInteger(i)) send({ type: 'loot_take', targetType: cur.targetType, targetId: cur.targetId, picks: [i] }); }
  function takeAll() { if (cur) send({ type: 'loot_take', targetType: cur.targetType, targetId: cur.targetId, all: true }); }
  return { show, close, take, takeAll, isOpen, target: () => (cur ? { lootType: cur.targetType, targetId: cur.targetId } : null) };
}
