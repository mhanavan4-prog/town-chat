// ---------------------------------------------------------------------------
// Dee's Monad, built at the Real Shelf by straight line and circle (data/monas.js
// holds the figure and checks it). You pick a tool and tap points on a lattice
// of "parts": a straight line between two points, a circle or a half-circle
// (hanging below its diameter) about a centre through a point, or a point.
// All text is set with textContent.
// ---------------------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
const U = 18, OX = 130, OY = 170; // one part, and where A sits on the board
const px = ([x, y]) => [OX + x * U, OY - y * U];

const STEPS = [
  'Let AB be one part, A where the stem crosses the crossbar.',
  'The stem: a straight line from C, three parts below A, to K, six above. "The whole of the line CK is composed of nine parts."',
  'The crossbar: a straight line through A, two parts either side.',
  'The Sun: a circle about I, three parts above A, passing through B; and mark its centre, "a circle having a visible center".',
  'The Moon: a half-circle about K, two parts either way, hanging below so its horns point up, "the figure of the Horns".',
  'Aries: two half-circles about points one part either side of C, each through C, "connected by one common point", arching up as the sign ♈︎ does.',
];
const TOOLS = [
  { key: 'line', label: '📏 Straight line', taps: 2, hint: 'Tap one end, then the other.' },
  { key: 'circle', label: '🧭 Circle', taps: 2, hint: 'Tap the centre, then a point the circle passes through.' },
  { key: 'cup', label: '◡ Half-circle below', taps: 2, hint: 'Tap the centre, then an end of its diameter. It hangs below, like a cup.' },
  { key: 'arch', label: '◠ Half-circle above', taps: 2, hint: 'Tap the centre, then an end of its diameter. It arches above, like a bridge.' },
  { key: 'dot', label: '• Point', taps: 1, hint: 'Tap the point to mark it.' },
];

export default function createMonas({ send }) {
  let tool = 'line', taps = [], elements = [], note = 'Choose a tool, then tap the lattice.', pending = false, done = false;

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  function reset() { tool = 'line'; taps = []; elements = []; note = 'Choose a tool, then tap the lattice.'; pending = false; done = false; }

  function drawEl(add, e) {
    if (e.tool === 'line') { const [a, b] = [px(e.a), px(e.b)]; add('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'monasInk' }); return; }
    if (e.tool === 'dot') { const c = px(e.c); add('circle', { cx: c[0], cy: c[1], r: 3, class: 'monasDot' }); return; }
    const r = Math.hypot(e.through[0] - e.c[0], e.through[1] - e.c[1]) * U, c = px(e.c);
    if (e.tool === 'circle') add('circle', { cx: c[0], cy: c[1], r, class: 'monasInk monasRing' });
    else add('path', { d: `M ${c[0] - r} ${c[1]} A ${r} ${r} 0 0 ${e.tool === 'arch' ? 1 : 0} ${c[0] + r} ${c[1]}`, class: 'monasInk monasRing' });
  }

  function render(container, info, onBack) {
    container.innerHTML = '';
    const lat = (info && info.lattice) || { xMin: -3, xMax: 3, yMin: -4, yMax: 7 };
    container.appendChild(el('div', 'mythHead', '☉ Dee\'s Monad, by straight line and circle'));
    const steps = el('ol', 'monasSteps');
    for (const t of STEPS) steps.appendChild(el('li', '', t));
    container.appendChild(steps);
    const toolRow = el('div', 'monasTools');
    for (const t of TOOLS) {
      const b = el('button', 'btn monasTool' + (tool === t.key ? ' on' : ''), t.label);
      b.disabled = pending || done;
      b.addEventListener('click', () => { tool = t.key; taps = []; note = t.hint; render(container, info, onBack); });
      toolRow.appendChild(b);
    }
    container.appendChild(toolRow);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 260 270');
    svg.setAttribute('class', 'monasBoard');
    svg.id = 'monasBoard';
    const add = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
    add('rect', { x: 0, y: 0, width: 260, height: 270, rx: 10, class: 'monasPage' });
    for (let y = lat.yMin; y <= lat.yMax; y++) for (let x = lat.xMin; x <= lat.xMax; x++) { const [cx, cy] = px([x, y]); add('circle', { cx, cy, r: 1.6, class: 'monasGrid' }); }
    for (const e of elements) drawEl(add, e);
    for (const t of taps) { const [cx, cy] = px(t); add('circle', { cx, cy, r: 5, class: 'monasTap' }); }
    const lab = (p, s) => { const [x, y] = px(p); const t = add('text', { x: x + 6, y: y - 4, class: 'monasLabel' }); t.textContent = s; };
    lab([0, 0], 'A'); lab([0, 1], 'B');
    if (!pending && !done) {
      svg.addEventListener('click', (e) => {
        const r = svg.getBoundingClientRect();
        const bx = (e.clientX - r.left) * 260 / r.width, by = (e.clientY - r.top) * 270 / r.height;
        const x = Math.round((bx - OX) / U), y = Math.round((OY - by) / U);
        if (x < lat.xMin || x > lat.xMax || y < lat.yMin || y > lat.yMax) return;
        const [gx, gy] = px([x, y]);
        if (Math.hypot(bx - gx, by - gy) > 9) return;
        tapPoint(x, y);
      });
    }
    function tapPoint(x, y) {
        taps.push([x, y]);
        const t = TOOLS.find((q) => q.key === tool);
        if (taps.length >= t.taps) {
          const e2 = tool === 'line' ? { tool, a: taps[0], b: taps[1] } : tool === 'dot' ? { tool, c: taps[0] } : { tool, c: taps[0], through: taps[1] };
          const bad = (tool === 'line' && taps[0][0] === taps[1][0] && taps[0][1] === taps[1][1]) || ((tool === 'circle' || tool === 'cup' || tool === 'arch') && taps[0][0] === taps[1][0] && taps[0][1] === taps[1][1]);
          if (!bad) { elements.push(e2); note = `${elements.length} mark${elements.length === 1 ? '' : 's'} drawn.`; } else note = 'Those are the same point.';
          taps = [];
        }
        render(container, info, onBack);
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `The page: ${elements.length} mark${elements.length === 1 ? '' : 's'} drawn${taps.length ? `, a point chosen at ${taps[0][0]} across, ${taps[0][1]} up` : ''}.`);
    container.appendChild(svg);
    if (!pending && !done) {
      // By keys: choose a point by its parts across and up from A, and use it.
      const kb = el('div', 'kbPanel');
      kb.setAttribute('role', 'group');
      kb.setAttribute('aria-label', 'Or choose points by keys');
      kb.appendChild(el('div', 'kbLabel', 'Or choose points by keys, in parts from A:'));
      const sel = (label, lo, hi, val) => {
        const w = el('label', 'kbSlider'); w.appendChild(el('span', '', label + ' '));
        const s2 = document.createElement('select'); s2.setAttribute('aria-label', label);
        for (let v = lo; v <= hi; v++) { const o = document.createElement('option'); o.value = String(v); o.textContent = String(v); if (v === val) o.selected = true; s2.appendChild(o); }
        w.appendChild(s2); kb.appendChild(w); return s2;
      };
      const sx = sel('Across (left is minus)', lat.xMin, lat.xMax, 0), sy = sel('Up (down is minus)', lat.yMin, lat.yMax, 0);
      const use = el('button', 'btn kbBtn', 'Use this point');
      use.addEventListener('click', () => tapPoint(Number(sx.value), Number(sy.value)));
      kb.appendChild(use);
      container.appendChild(kb);
    }
    const noteEl = el('div', 'hexNote', done ? 'The Monad stands on the page.' : note);
    noteEl.setAttribute('aria-live', 'polite');
    container.appendChild(noteEl);
    const row = el('div', 'monasTools');
    if (!done) {
      const undo = el('button', 'btn', 'Undo');
      undo.disabled = pending || (!elements.length && !taps.length);
      undo.addEventListener('click', () => { if (taps.length) taps = []; else elements.pop(); render(container, info, onBack); });
      const fin = el('button', 'btn', 'It is finished');
      fin.disabled = pending || !elements.length;
      fin.addEventListener('click', () => { pending = true; note = 'Dee looks over your shoulder…'; send({ type: 'construct_monas', elements: elements.slice() }); render(container, info, onBack); });
      row.appendChild(undo); row.appendChild(fin);
    }
    const back = el('button', 'btn', 'Back to the shelf');
    back.addEventListener('click', () => { reset(); onBack(); });
    row.appendChild(back);
    container.appendChild(row);
    if (info && info.lore) {
      const lore = el('div', 'shelfText', info.lore);
      container.appendChild(lore);
      container.appendChild(el('div', 'shelfSrc', info.source || ''));
    }
  }
  function result(msg) { pending = false; if (msg.ok) done = true; else note = msg.problem || 'Not yet.'; }
  function boardState() { return { tool, taps: taps.slice(), elements: elements.slice(), note, pending, done }; }
  return { render, result, reset, boardState };
}
