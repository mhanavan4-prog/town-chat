// ---------------------------------------------------------------------------
// The Tree Alphabet (blueprint C) — ogham few-staves panel.
//
// Carve staves from the woods you gathered (the tree decides the letter), then
// cast three. Each letter is drawn as a real ogham stave in SVG — a stem line
// with its strokes: aicme B to the right, H to the left, M slanting across,
// A as notches across — so it renders on every device, no font required.
// All text is set with textContent.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

const OGHAM_SVGNS = 'http://www.w3.org/2000/svg';

// One letter as a vertical stave (the stem runs up the stone's edge; ogham is
// read from the bottom up).
export function oghamStaveSvg(aicme, n, size = 64) {
  const svg = document.createElementNS(OGHAM_SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 80');
  svg.setAttribute('width', String(size * 0.5));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', 'oghamGlyph');
  const line = (x1, y1, x2, y2) => { const l = document.createElementNS(OGHAM_SVGNS, 'line'); l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); svg.appendChild(l); };
  line(20, 4, 20, 76); // the stem
  const gap = 9, top = 40 - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) {
    const y = top + i * gap;
    if (aicme === 'B') line(20, y, 36, y);
    else if (aicme === 'H') line(4, y, 20, y);
    else if (aicme === 'M') line(6, y + 5, 34, y - 5);
    else line(13, y, 27, y); // A — a short notch across the stem
  }
  return svg;
}

export default function createOgham({ send, place }) {
  let state = null;
  let cast = null;

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

  function open() {
    const m = document.getElementById('oghamModal');
    if (!m) return;
    m.classList.remove('hidden');
    if (place) place(m);
    Modals.set('oghamOpen', true);
    send({ type: 'ogham_state' });
    render();
  }
  function close() {
    const m = document.getElementById('oghamModal');
    if (m) m.classList.add('hidden');
    Modals.set('oghamOpen', false);
  }
  function setState(s) { state = s; if (s && s.today) cast = s.today; if (Modals.isOpen('oghamOpen')) render(); }
  function setCast(c) { cast = c; if (Modals.isOpen('oghamOpen')) render(); }

  function staveCard(o, cls) {
    const card = el('div', 'ogCard ' + (cls || ''));
    card.dataset.key = o.key;
    card.appendChild(oghamStaveSvg(o.aicme, o.n));
    const t = el('div', 'ogText');
    t.appendChild(el('div', 'ogName', `${o.name} · ${o.letter}`));
    t.appendChild(el('div', 'ogTree', o.tree));
    return { card, t };
  }

  function render() {
    const body = document.getElementById('oghamContent');
    if (!body) return;
    body.innerHTML = '';
    if (!state) { body.appendChild(el('div', 'slNote', 'Laying out the staves…')); return; }
    if (state.isGuest) { body.appendChild(el('div', 'slNote', 'Log into an account to carve and keep staves.')); return; }

    // ── The cast ──
    const castWrap = el('div', 'ogCast');
    if (cast && cast.length) {
      castWrap.appendChild(el('div', 'ogSub', "Today's three staves"));
      const row = el('div', 'ogCastRow');
      for (const o of cast) {
        const { card, t } = staveCard(o, 'cast');
        t.appendChild(el('div', 'ogKenning', `“${o.kenning}”`));
        t.appendChild(el('div', 'ogReading', o.reading));
        card.appendChild(t);
        row.appendChild(card);
      }
      castWrap.appendChild(row);
      castWrap.appendChild(el('div', 'ogNote', 'The staves fall once a day. Come back tomorrow for another cast.'));
    } else {
      castWrap.appendChild(el('div', 'ogNote', state.carved >= state.castSize
        ? 'Shake the staves in their bag and draw three, one at a time.'
        : `Carve at least ${state.castSize} staves to cast. You hold ${state.carved}.`));
      const b = el('button', 'btn ogCastBtn', `🌳 Cast ${state.castSize} staves`);
      b.disabled = state.carved < state.castSize;
      b.addEventListener('click', () => { b.disabled = true; send({ type: 'ogham_cast' }); });
      castWrap.appendChild(b);
    }
    body.appendChild(castWrap);

    // ── The grove: every letter, carved / carvable / not yet ──
    body.appendChild(el('div', 'ogSub', `Your staves · ${state.carved}/${state.carvable} carved`));
    const groups = { B: 'Aicme Beithe', H: 'Aicme hÚatha', M: 'Aicme Muine', A: 'Aicme Ailme' };
    for (const ac of ['B', 'H', 'M', 'A']) {
      body.appendChild(el('div', 'ogAicme', groups[ac]));
      const grid = el('div', 'ogGrid');
      for (const o of state.letters.filter((x) => x.aicme === ac)) {
        const { card, t } = staveCard(o, o.carved ? 'carved' : (o.wood ? 'open' : 'absent'));
        t.appendChild(el('div', 'ogOrig', `name meant: ${o.meaningOrig}`));
        if (o.carved) t.appendChild(el('div', 'ogState', '✓ carved'));
        else if (o.wood) {
          const btn = el('button', 'ogCarve', `Carve · ${o.woodIcon} ${Math.min(o.have, o.need)}/${o.need} ${o.woodName}`);
          btn.disabled = !o.canCarve;
          btn.addEventListener('click', () => { btn.disabled = true; send({ type: 'ogham_carve', key: o.key }); });
          t.appendChild(btn);
        } else t.appendChild(el('div', 'ogState absent', `No ${o.tree.toLowerCase()} grows in the Wilds yet`));
        card.appendChild(t);
        grid.appendChild(card);
      }
      body.appendChild(grid);
    }
    const lore = el('div', 'ogLore');
    lore.appendChild(el('span', 'callerTier callerTier-revival', 'Modern revival — on a real script'));
    lore.appendChild(el('div', 'callerLoreText', state.lore.coll));
    lore.appendChild(el('div', 'callerLoreText', state.lore.provenance));
    lore.appendChild(el('div', 'callerSource', 'Sources: the Ogam Tract · Auraicept na n-Éces · Bríatharogam · D. McManus, A Guide to Ogam (1991)'));
    body.appendChild(lore);
  }

  (function wire() {
    const c = document.getElementById('oghamCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  return { open, close, setState, setCast, render };
}
