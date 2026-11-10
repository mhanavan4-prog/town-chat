// ---------------------------------------------------------------------------
// Caerdroia on the Board: the seed (a cross, four corners, four dots) and its
// sixteen loose ends; the player joins two ends at a time and the server says
// whether that is the next wall (data/troy.js has the rule and the check).
// Each wall is drawn as an arch over the top, from the end on one side out to
// its own troyRing and round to the end on the other. All text is textContent.
// ---------------------------------------------------------------------------
const TROY_NS = 'http://www.w3.org/2000/svg';
const TROY_U = 12, TROY_CX = 140, TROY_CY = 140; // one grid unit, and where the cross's centre sits
const troyPt = (x, y) => [TROY_CX + x * TROY_U, TROY_CY - y * TROY_U];
const troyRing = (k) => 2.6 + k; // each wall one unit outside the last

let troyPicked = null; // the end chosen first, waiting for its partner

// The arch for the k-th wall of a drawing that turns right (ends 8−k → 9+k),
// about a centre half a unit to the right of the cross. A left-turning drawing
// is its mirror image, so its walls are these, reflected.
function troyArchPath(ends, k, hand) {
  const m = hand === 'left' ? -1 : 1;
  const from = ends[(9 + k) % 16], to = ends[8 - k]; // right-hand end, then left
  const c = [0.5, 0], R = troyRing(k);
  const ang = (p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
  const a0 = ang(from), a1raw = ang(to);
  let a1 = a1raw; while (a1 <= a0) a1 += Math.PI * 2; // round anticlockwise, over the top
  const pt = (a) => [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)];
  const S = (q) => { const [x, y] = troyPt(m * q[0], q[1]); return `${x.toFixed(1)} ${y.toFixed(1)}`; };
  const p0 = pt(a0), p1 = pt(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  // Anticlockwise in the y-up grid is anticlockwise on screen (y down): sweep 0;
  // the mirror flips it.
  const sweep = m === 1 ? 0 : 1;
  return `M ${S(from)} L ${S(p0)} A ${(R * TROY_U).toFixed(1)} ${(R * TROY_U).toFixed(1)} 0 ${large} ${sweep} ${S(p1)} L ${S(to)}`;
}

export function renderTroy(body, s, send, el, rerender) {
  const t = s.troy;
  const joins = t.joins || [];
  const used = new Set(joins.flat());
  if (troyPicked !== null && used.has(troyPicked)) troyPicked = null;
  const box = el('div', 'troyBox');
  const done = joins.length >= t.total;
  if (t.use && !done) box.appendChild(el('div', 'callerStepNote', t.use));
  const svg = document.createElementNS(TROY_NS, 'svg');
  // The page zooms out as the walls go on: the bare seed fills it, so its
  // ends are easy to tap, and the finished figure just fits.
  const half = Math.max(3.4, joins.length ? troyRing(joins.length - 1) + 1.4 : 3.4) * TROY_U;
  svg.setAttribute('viewBox', `${TROY_CX - half} ${TROY_CY - half} ${2 * half} ${2 * half}`);
  svg.setAttribute('class', 'troyBoard');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Caerdroia: ${joins.length} of ${t.total} walls drawn${troyPicked !== null ? `, ${t.names[troyPicked]} chosen` : ''}.`);
  const add = (tag, attrs) => { const n = document.createElementNS(TROY_NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
  add('rect', { x: TROY_CX - half, y: TROY_CY - half, width: 2 * half, height: 2 * half, rx: half / 14, class: 'troyTurf' });
  for (const [a, b] of t.seed.lines) { const [x1, y1] = troyPt(...a), [x2, y2] = troyPt(...b); add('line', { x1, y1, x2, y2, class: 'troyWall', 'vector-effect': 'non-scaling-stroke' }); }
  for (const d of t.seed.dots) { const [cx, cy] = troyPt(...d); add('circle', { cx, cy, r: 0.2 * TROY_U, class: 'troyDot' }); }
  joins.forEach((_, k) => add('path', { d: troyArchPath(t.ends, k, t.hand), class: 'troyWall', 'vector-effect': 'non-scaling-stroke' }));
  // The loose ends: tap one, then its partner.
  t.ends.forEach((e, i) => {
    if (used.has(i) || done) return;
    const [cx, cy] = troyPt(...e);
    add('circle', { cx, cy, r: 0.24 * TROY_U, class: 'troyEnd' + (troyPicked === i ? ' on' : ''), 'vector-effect': 'non-scaling-stroke' });
    const hit = add('circle', { cx, cy, r: 0.48 * TROY_U, class: 'troyHit' });
    hit.addEventListener('click', () => pick(i));
  });
  box.appendChild(svg);
  function pick(i) {
    if (troyPicked === null) { troyPicked = i; rerender(); return; }
    if (troyPicked === i) { troyPicked = null; rerender(); return; }
    const a = troyPicked; troyPicked = null;
    send({ type: 'troy_join', a, b: i });
  }
  // By keys: choose the two ends by name.
  if (!done) {
    const kb = el('div', 'troyKeys');
    kb.setAttribute('role', 'group');
    kb.setAttribute('aria-label', 'Or join two ends by name');
    kb.appendChild(el('div', 'troyKeysLabel', 'Or join two ends by name:'));
    const free = t.ends.map((_, i) => i).filter((i) => !used.has(i));
    const mk = (label) => {
      const w = el('label', 'troySel'); w.appendChild(el('span', '', label + ' '));
      const q = document.createElement('select'); q.setAttribute('aria-label', label);
      for (const i of free) { const o = document.createElement('option'); o.value = String(i); o.textContent = t.names[i]; q.appendChild(o); }
      w.appendChild(q); kb.appendChild(w); return q;
    };
    const qa = mk('From'), qb = mk('to');
    const go = el('button', 'btn charmSay', 'Draw this wall');
    go.addEventListener('click', () => { troyPicked = null; send({ type: 'troy_join', a: Number(qa.value), b: Number(qb.value) }); });
    kb.appendChild(go);
    box.appendChild(kb);
  }
  const note = el('div', 'troyNote', t.note || (troyPicked !== null ? `From ${t.names[troyPicked]}: now tap the end to join it to.` : (done ? 'All eight walls drawn: run your finger in at the gate, and you never once come to a choice.' : `${joins.length} of ${t.total} walls drawn.`)));
  note.setAttribute('aria-live', 'polite');
  box.appendChild(note);
  if (joins.length && !done) {
    const again = el('button', 'btn charmSay', 'Rub it out and start again');
    again.addEventListener('click', () => { troyPicked = null; send({ type: 'troy_join', clear: true }); });
    box.appendChild(again);
  }
  body.appendChild(box);
}
