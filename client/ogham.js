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
  let carving = null; // { key, cuts: [], note, pending, done } while a stave is on the bench

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
    carving = null;
  }
  function setState(s) {
    state = s; if (s && s.today) cast = s.today;
    if (carving && s && s.letters) { const o = s.letters.find((x) => x.key === carving.key); if (o && o.carved) { carving.done = true; carving.pending = false; } }
    if (Modals.isOpen('oghamOpen')) render();
  }
  // The server found the letter wrong: say why; the cuts stay, to undo or add to.
  function error(message) {
    if (!carving || !carving.pending) return;
    carving.pending = false; carving.note = message || 'That is not the letter yet.';
    if (Modals.isOpen('oghamOpen')) render();
  }
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
    if (carving) { renderCarving(body); return; }

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
          btn.addEventListener('click', () => { carving = { key: o.key, cuts: [], note: carveHint(o) }; render(); });
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

  // ── The carving bench: cut the letter against the stave's edge yourself ──
  const AICME_HOW = { B: 'to the right of the edge', H: 'to the left of the edge', M: 'slanting across the edge', A: 'as notches on the edge (tap it)' };
  function carveHint(o) { return `${o.name}: ${o.n} stroke${o.n === 1 ? '' : 's'} ${AICME_HOW[o.aicme]}, close together and even. Drag to cut; tap the edge for a notch. Read from the bottom up.`; }
  function renderCarving(body) {
    const o = state.letters.find((x) => x.key === carving.key);
    const B = state.board || { w: 120, h: 300, stemX: 60, top: 20, bottom: 280 };
    if (!o) { carving = null; render(); return; }
    body.appendChild(el('div', 'ogSub', `Carving ${o.name} · ${o.letter} · ${o.tree}`));
    const bench = el('div', 'ogBench');
    const svg = document.createElementNS(OGHAM_SVGNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${B.w} ${B.h}`);
    svg.setAttribute('class', 'ogStave');
    svg.id = 'oghamBench';
    const add = (tag, attrs) => { const n = document.createElementNS(OGHAM_SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
    add('rect', { x: 8, y: 8, width: B.w - 16, height: B.h - 16, rx: 6, class: 'ogWood' });
    add('line', { x1: B.stemX, y1: B.top, x2: B.stemX, y2: B.bottom, class: 'ogArris' });
    for (const c of carving.cuts) {
      if (Math.hypot(c.x2 - c.x1, c.y2 - c.y1) < 6) add('circle', { cx: c.x1, cy: c.y1, r: 3.5, class: 'ogNotch' });
      else add('line', { x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, class: 'ogCut' });
    }
    const at = (e) => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * B.w / r.width, (e.clientY - r.top) * B.h / r.height]; };
    if (!carving.pending && !carving.done) {
      let start = null, guide = null;
      svg.addEventListener('pointerdown', (e) => {
        start = at(e);
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
        guide = add('line', { x1: start[0], y1: start[1], x2: start[0], y2: start[1], class: 'ogGuide' });
      });
      svg.addEventListener('pointermove', (e) => { if (!start || !guide) return; const [x, y] = at(e); guide.setAttribute('x2', x); guide.setAttribute('y2', y); });
      const lift = (e) => {
        if (!start) return;
        let [x, y] = at(e);
        let [x0, y0] = start;
        start = null;
        if (Math.hypot(x - x0, y - y0) < 6) { if (Math.abs(x0 - B.stemX) <= 8) { x0 = x = B.stemX; y = y0; } else { render(); return; } } // a tap on the edge is a notch
        // A cut that starts or ends right by the edge is taken to meet it.
        if (Math.abs(x0 - B.stemX) <= 6) x0 = B.stemX;
        if (Math.abs(x - B.stemX) <= 6) x = B.stemX;
        carving.cuts.push({ x1: Math.round(x0), y1: Math.round(y0), x2: Math.round(x), y2: Math.round(y) });
        render();
      };
      svg.addEventListener('pointerup', lift);
      svg.addEventListener('pointercancel', lift);
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `The stave, its edge running up the middle: ${carving.cuts.length} cut${carving.cuts.length === 1 ? '' : 's'} made.`);
    bench.appendChild(svg);
    const side = el('div', 'ogBenchSide');
    side.appendChild(el('div', 'ogNote', 'The letter, as it should read:'));
    side.appendChild(oghamStaveSvg(o.aicme, o.n, 96));
    const noteEl = el('div', 'ogNote', carving.done ? `${o.name} is cut. The stave is yours.` : carving.note);
    noteEl.setAttribute('aria-live', 'polite');
    side.appendChild(noteEl);
    if (!carving.pending && !carving.done) {
      // By keys: each button cuts one stroke of that kind, the next one up the
      // stave, evenly spaced, as a steady hand would.
      const kb = el('div', 'ogKeys');
      kb.setAttribute('role', 'group');
      kb.setAttribute('aria-label', 'Or cut by keys');
      kb.appendChild(el('div', 'ogNote', 'Or cut by keys:'));
      const S = B.stemX;
      const nextY = () => 200 - carving.cuts.length * 12;
      const kinds = [
        ['Cut to the right of the edge', (y) => ({ x1: S, y1: y, x2: S + 35, y2: y })],
        ['Cut to the left of the edge', (y) => ({ x1: S, y1: y, x2: S - 35, y2: y })],
        ['Cut slanting across the edge', (y) => ({ x1: S - 25, y1: y + 8, x2: S + 25, y2: y - 8 })],
        ['Notch the edge', (y) => ({ x1: S, y1: y, x2: S, y2: y })],
      ];
      for (const [label, mk] of kinds) {
        const b = el('button', 'btn ogCastBtn', label);
        b.disabled = carving.cuts.length >= 12;
        b.addEventListener('click', () => { carving.cuts.push(mk(nextY())); carving.note = `${carving.cuts.length} cut${carving.cuts.length === 1 ? '' : 's'} on the stave.`; render(); });
        kb.appendChild(b);
      }
      side.appendChild(kb);
    }
    if (!carving.done) {
      const undo = el('button', 'btn ogCastBtn', 'Undo the last cut');
      undo.disabled = !carving.cuts.length || !!carving.pending;
      undo.addEventListener('click', () => { carving.cuts.pop(); render(); });
      side.appendChild(undo);
      const go = el('button', 'btn ogCastBtn', `🌳 That's ${o.name} · ${o.woodIcon} ${o.need} ${o.woodName}`);
      go.disabled = !carving.cuts.length || !!carving.pending || !o.canCarve;
      go.addEventListener('click', () => { carving.pending = true; carving.note = 'You turn the stave to the light…'; send({ type: 'ogham_carve', key: o.key, cuts: carving.cuts.slice() }); render(); });
      side.appendChild(go);
    }
    const back = el('button', 'btn ogCastBtn', carving.done ? 'Back to the grove' : 'Put the knife down');
    back.addEventListener('click', () => { carving = null; render(); });
    side.appendChild(back);
    bench.appendChild(side);
    body.appendChild(bench);
    if (state.carvingLore) {
      const lore = el('div', 'ogLore');
      lore.appendChild(el('span', 'callerTier callerTier-record', 'Archaeological / documentary'));
      lore.appendChild(el('div', 'callerLoreText', state.carvingLore.text));
      lore.appendChild(el('div', 'callerSource', 'Sources: ' + state.carvingLore.source));
      body.appendChild(lore);
    }
  }
  function bench() { return carving ? { key: carving.key, cuts: carving.cuts.slice(), note: carving.note, pending: !!carving.pending, done: !!carving.done } : null; }

  (function wire() {
    const c = document.getElementById('oghamCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  return { open, close, setState, setCast, render, error, bench };
}
