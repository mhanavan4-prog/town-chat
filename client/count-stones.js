// ---------------------------------------------------------------------------
// Counting the Nine-and-Twenty: a small panel at the ring where you give your
// count, walk round, and give it again (the server says whether the two agree,
// and whether they're right). All text is textContent. (Top-level names carry
// the countStones prefix: the client bundle shares one scope.)
// ---------------------------------------------------------------------------
export default function createCountStones({ send }) {
  let countStonesEl = null, countStonesInfo = null, countStonesNote = '', countStonesStage = 'first';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  function close() { if (countStonesEl) { countStonesEl.remove(); countStonesEl = null; } }
  function render() {
    if (!countStonesEl) return;
    countStonesEl.innerHTML = '';
    countStonesEl.appendChild(el('div', 'countHead', '🪨 The Nine-and-Twenty'));
    countStonesEl.appendChild(el('div', 'countHow', countStonesStage === 'first'
      ? 'Walk round the ring and count every stone, standing or fallen, the low ones too. Then give your count.'
      : 'Now walk round and count them again.'));
    const row = el('div', 'countRow');
    const inp = document.createElement('input');
    inp.className = 'countInput'; inp.inputMode = 'numeric'; inp.maxLength = 3; inp.autocomplete = 'off';
    inp.setAttribute('aria-label', countStonesStage === 'first' ? 'Your first count' : 'Your second count');
    const go = el('button', 'btn countGo', countStonesStage === 'first' ? 'That is my count' : 'That is my second count');
    const sendIt = () => { const n = Number(inp.value.replace(/\D/g, '')); if (!n) return; go.disabled = true; send({ type: 'count_stones', n }); };
    go.addEventListener('click', sendIt);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendIt(); e.stopPropagation(); });
    row.appendChild(inp); row.appendChild(go);
    countStonesEl.appendChild(row);
    const note = el('div', 'countNote', countStonesNote);
    note.setAttribute('aria-live', 'polite');
    countStonesEl.appendChild(note);
    if (countStonesInfo) {
      countStonesEl.appendChild(el('div', 'countLore', countStonesInfo.lore));
      countStonesEl.appendChild(el('div', 'countLore', countStonesInfo.practical));
      countStonesEl.appendChild(el('div', 'countSrc', countStonesInfo.source));
    }
    const shut = el('button', 'btn countClose', 'Close');
    shut.addEventListener('click', close);
    countStonesEl.appendChild(shut);
    setTimeout(() => { try { inp.focus(); } catch (e) { /* fine */ } }, 0);
  }
  function open(info) {
    countStonesInfo = info || null;
    if (!countStonesEl) { countStonesEl = el('div', 'countPanel'); countStonesEl.setAttribute('role', 'dialog'); countStonesEl.setAttribute('aria-label', 'Count the stones'); document.body.appendChild(countStonesEl); }
    render();
  }
  function result(msg) {
    countStonesNote = msg.text || '';
    countStonesStage = msg.ok && msg.stage === 'first' ? 'second' : 'first';
    if (!countStonesEl) open(countStonesInfo); else render();
  }
  function isOpen() { return !!countStonesEl; }
  return { open, close, result, isOpen };
}
