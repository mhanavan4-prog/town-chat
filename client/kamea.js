// ---------------------------------------------------------------------------
// Agrippa's tables of the planets at the Real Shelf (data/kamea.js has the
// tables and the check). Each square is a number box; the sums of every row,
// column and diagonal show as you go, and the server checks the finished
// table. Agrippa's own numbers, where given, are fixed. All text is set with
// textContent. (Top-level names carry the kamea prefix: the client bundle
// shares one scope.)
// ---------------------------------------------------------------------------
export default function createKamea({ send }) {
  let kameaKey = 'saturn';
  let kameaGrids = {}; // key -> n×n of numbers or ''
  let kameaNote = '';
  let kameaPending = false;
  let kameaWon = {}; // key -> which ('agrippa' | 'turned' | 'other')

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  function reset() { kameaKey = 'saturn'; kameaGrids = {}; kameaNote = ''; kameaPending = false; kameaWon = {}; }
  function gridFor(t) {
    if (!kameaGrids[t.key]) {
      const g = Array.from({ length: t.n }, () => Array(t.n).fill(''));
      for (const [i, j, v] of t.givens || []) g[i][j] = v;
      kameaGrids[t.key] = g;
    }
    return kameaGrids[t.key];
  }

  function render(container, info, onBack) {
    container.innerHTML = '';
    const tables = (info && info.tables) || [];
    const t = tables.find((x) => x.key === kameaKey) || tables[0];
    if (!t) { container.appendChild(el('div', 'cbIntro', 'The tables are not on the shelf.')); return; }
    const done = new Set((info && info.done) || []);
    container.appendChild(el('div', 'mythHead', '🔢 Agrippa\'s tables of the planets'));
    const pick = el('div', 'kameaPick');
    for (const x of tables) {
      const b = el('button', 'btn kameaTab' + (x.key === t.key ? ' on' : ''), `${x.symbol} ${x.name}${done.has(x.key) ? ' ✓' : ''}`);
      b.setAttribute('aria-pressed', x.key === t.key ? 'true' : 'false');
      b.addEventListener('click', () => { kameaKey = x.key; kameaNote = ''; render(container, info, onBack); });
      pick.appendChild(b);
    }
    container.appendChild(pick);
    container.appendChild(el('div', 'shelfText', `Agrippa: ${t.says}`));
    container.appendChild(el('div', 'kameaHow', `Put the numbers 1 to ${t.n * t.n} in the squares, each once, so that every row, every column and both diagonals make ${t.sum}.${(t.givens || []).length ? ' The numbers already in place are Agrippa\'s own.' : ''}`));
    const g = gridFor(t);
    const n = t.n;
    const fixed = new Set((t.givens || []).map(([i, j]) => `${i},${j}`));
    const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
    const lineSum = (cells) => { const vs = cells.map(num); return vs.every(Number.isFinite) ? vs.reduce((a, b) => a + b, 0) : null; };
    const wrap = el('div', 'kameaWrap');
    const table = el('div', 'kameaGrid');
    table.style.gridTemplateColumns = `repeat(${n + 1}, auto)`;
    table.setAttribute('role', 'group');
    table.setAttribute('aria-label', `${t.name}, ${n} by ${n}`);
    const sumCell = (s, label) => { const c = el('div', 'kameaSum' + (s === null ? '' : s === t.sum ? ' ok' : ' off'), s === null ? '·' : String(s)); c.setAttribute('aria-label', `${label}: ${s === null ? 'not full yet' : s}`); return c; };
    const won = kameaWon[t.key];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const inp = document.createElement('input');
        inp.className = 'kameaCell' + (fixed.has(`${i},${j}`) ? ' given' : '');
        inp.inputMode = 'numeric'; inp.autocomplete = 'off'; inp.maxLength = 2;
        inp.value = g[i][j] === '' ? '' : String(g[i][j]);
        inp.readOnly = fixed.has(`${i},${j}`) || kameaPending || !!won;
        inp.setAttribute('aria-label', `Row ${i + 1}, column ${j + 1}${fixed.has(`${i},${j}`) ? ', Agrippa\'s' : ''}`);
        inp.dataset.r = String(i); inp.dataset.c = String(j);
        inp.addEventListener('change', () => {
          const v = inp.value.replace(/\D/g, '');
          g[i][j] = v === '' ? '' : Number(v);
          kameaNote = '';
          render(container, info, onBack);
          const again = container.querySelector(`.kameaCell[data-r="${i}"][data-c="${j}"]`);
          if (again) { const nx = container.querySelectorAll('.kameaCell'); const idx = [...nx].indexOf(again); const next = [...nx].slice(idx + 1).find((x) => !x.readOnly); if (next) next.focus(); }
        });
        table.appendChild(inp);
      }
      table.appendChild(sumCell(lineSum(g[i]), `Row ${i + 1} makes`));
    }
    for (let j = 0; j < n; j++) table.appendChild(sumCell(lineSum(g.map((r) => r[j])), `Column ${j + 1} makes`));
    table.appendChild(sumCell(lineSum(g.map((r, i) => r[i])), 'The diagonal from the top left makes'));
    wrap.appendChild(table);
    wrap.appendChild(el('div', 'kameaAnti', `↗ the other diagonal: ${lineSum(g.map((r, i) => r[n - 1 - i])) ?? '·'}`));
    container.appendChild(wrap);
    const note = el('div', 'hexNote', won ? (won === 'agrippa' ? `Every line makes ${t.sum}: Agrippa's table, as he printed it.` : won === 'turned' ? `Every line makes ${t.sum}. It is Agrippa's table turned or mirrored: there is only the one three-by-three, in eight ways round.` : `Every line makes ${t.sum}.`) : kameaNote);
    note.setAttribute('aria-live', 'polite');
    container.appendChild(note);
    if (won) container.appendChild(el('div', 'shelfText', t.use));
    const row = el('div', 'monasTools');
    if (!won) {
      const clear = el('button', 'btn', 'Clear the table');
      clear.disabled = kameaPending;
      clear.addEventListener('click', () => { delete kameaGrids[t.key]; kameaNote = ''; render(container, info, onBack); });
      const fin = el('button', 'btn', 'It is finished');
      fin.disabled = kameaPending || g.some((r) => r.some((v) => v === ''));
      fin.addEventListener('click', () => { kameaPending = true; kameaNote = 'Agrippa runs his finger down each line…'; send({ type: 'fill_kamea', key: t.key, grid: g.map((r) => r.slice()) }); render(container, info, onBack); });
      row.appendChild(clear); row.appendChild(fin);
    } else {
      const again = el('button', 'btn', 'Fill it in again');
      again.addEventListener('click', () => { delete kameaWon[t.key]; delete kameaGrids[t.key]; render(container, info, onBack); });
      row.appendChild(again);
    }
    const back = el('button', 'btn', 'Back to the shelf');
    back.addEventListener('click', () => { reset(); onBack(); });
    row.appendChild(back);
    container.appendChild(row);
    if (info && info.lore) {
      container.appendChild(el('div', 'shelfText', info.lore));
      container.appendChild(el('div', 'shelfSrc', info.source || ''));
    }
  }
  function result(msg) {
    kameaPending = false;
    if (msg.ok) { kameaWon[msg.key] = msg.which || 'other'; kameaNote = ''; } else kameaNote = msg.problem || 'Not yet.';
  }
  function kameaState() { return { key: kameaKey, grids: JSON.parse(JSON.stringify(kameaGrids)), note: kameaNote, pending: kameaPending, won: { ...kameaWon } }; }
  return { render, result, reset, kameaState };
}
