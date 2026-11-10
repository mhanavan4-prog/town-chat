// ---------------------------------------------------------------------------
// Threshold & Hearth (blueprint B) — the Wards of the House panel.
//
// Three real house-wards, worked at your own cottage: bury a witch bottle under
// the hearth, scribe a daisy wheel over the door (a compass minigame — one
// circle, six arcs, one radius, each arc set from where the last crossed the
// circle), and conceal a worn shoe by the chimney. State comes from the server
// (`wards_state`); every text node is set with textContent.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

const WARDS_SVGNS = 'http://www.w3.org/2000/svg';
const WARDS_TIER_LABEL = { record: 'Archaeological / documentary', folk: 'Folk tradition', revival: 'Modern revival' };

export default function createWards({ send }) {
  let state = null;
  let compass = null; // the hexafoil minigame in progress
  let draw = null;    // the other drawn marks in progress: { kind: 'marian' | 'pentangle' | 'sator', … }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function open() {
    Modals.set('wardsOpen', true);
    document.getElementById('wardsModal').classList.remove('hidden');
    compass = null; draw = null;
    send({ type: 'wards_state' });
    render();
  }
  function close() {
    Modals.set('wardsOpen', false);
    document.getElementById('wardsModal').classList.add('hidden');
    compass = null; draw = null;
  }
  function setState(s) {
    state = s;
    if (draw && state && state[draw.kind]) { draw.done = true; draw.pending = false; }
    if (Modals.isOpen('wardsOpen')) render();
  }
  // The server turned a drawing down: say why, and let the hand try again.
  function error(message) {
    if (!draw || !draw.pending) return;
    draw.pending = false; draw.slips++;
    draw.note = message || 'Not quite. Try again.';
    if (draw.kind === 'marian') { draw.cuts = []; draw.anchor = null; }
    if (draw.kind === 'pentangle') { draw.seq = []; draw.trail = []; }
    if (Modals.isOpen('wardsOpen')) render();
  }

  function loreBox(w) {
    const box = el('div', 'wardLore');
    box.appendChild(el('span', 'callerTier callerTier-' + w.tier, WARDS_TIER_LABEL[w.tier] || w.tier));
    box.appendChild(el('div', 'callerLoreText', w.lore));
    box.appendChild(el('div', 'callerSource', `Source: ${w.source}`));
    return box;
  }

  function wardCard(key, statusText, done) {
    const w = state.lore[key];
    const card = el('div', 'wardCard' + (done ? ' done' : ''));
    card.dataset.ward = key;
    const head = el('div', 'wardHead');
    head.appendChild(el('span', 'wardIcon', w.icon));
    const t = el('div', 'wardTitleWrap');
    t.appendChild(el('div', 'wardTitle', `${w.name} — ${w.where}`));
    t.appendChild(el('div', 'wardStatus', statusText));
    head.appendChild(t);
    card.appendChild(head);
    card.appendChild(el('div', 'wardBlurb', w.blurb));
    return card;
  }

  function render() {
    const body = document.getElementById('wardsBody');
    if (!body) return;
    body.innerHTML = '';
    if (!state) { body.appendChild(el('div', 'slNote', 'Walking the bounds of the house…')); return; }
    if (compass) { renderCompass(body); return; }
    if (draw) { if (draw.kind === 'marian') renderMarian(body); else if (draw.kind === 'pentangle') renderPentangle(body); else if (draw.kind === 'burn') renderBurn(body); else renderSator(body); return; }

    const intro = el('div', 'wardIntro', state.atHome
      ? 'Old houses were warded at their weak places — the hearth, the door, the chimney. Work your own.'
      : 'Wards are worked at home. Step inside your own cottage to set them; you can read about them anywhere.');
    body.appendChild(intro);
    if (state.hearthWitch) body.appendChild(el('div', 'wardHearth', '🛡️ You walk the Hearth Path — your wards hold stronger: a bottle turns more curses, and each mark guards more.'));
    const pct = Math.round(state.guardEach * 100);
    const cols = el('div', 'menuCols'); // the four marks in two columns in the wide frame
    body.appendChild(cols);

    // 🍶 The witch bottle
    {
      const status = state.bottle === 'buried' ? `Buried · turns ${state.charges} more curse${state.charges === 1 ? '' : 's'}`
        : state.bottle === 'spent' ? 'Spent — the last one cracked. Bury another.' : 'None buried';
      const card = wardCard('bottle', status, state.bottle === 'buried');
      if (state.bottle !== 'buried') {
        const b = el('button', 'btn wardBtn', state.haveBottle ? `Bury a witch bottle (holds ${state.maxCharges})` : 'Need a witch bottle');
        b.disabled = !state.atHome || !state.haveBottle;
        b.addEventListener('click', () => { b.disabled = true; send({ type: 'bury_witch_bottle' }); });
        card.appendChild(b);
        if (!state.haveBottle) card.appendChild(el('div', 'wardHow', "Hazel brews one at her cauldron from a Bellarmine Jug (Apothecary Vex), Bent Pins (Tailor Ines) and Iron Nails (Armorer Beck)."));
      }
      card.appendChild(loreBox(state.lore.bottle));
      cols.appendChild(card);
    }
    // ✡ The daisy wheel
    {
      const card = wardCard('hexafoil', state.hexafoil ? `Cut over the door · +${pct}% damage resist` : 'Not yet drawn', state.hexafoil);
      if (!state.hexafoil) {
        const b = el('button', 'btn wardBtn', 'Take up the compasses');
        b.disabled = !state.atHome;
        b.addEventListener('click', () => { compass = newCompass(); render(); });
        card.appendChild(b);
      }
      card.appendChild(loreBox(state.lore.hexafoil));
      cols.appendChild(card);
    }
    // Ⓜ️ The Marian mark, cut on the hearth beam
    if (state.lore.marian) {
      const card = wardCard('marian', state.marian ? `Cut on the hearth beam · +${pct}% damage resist` : 'Not yet cut', state.marian);
      if (!state.marian) {
        const b = el('button', 'btn wardBtn', 'Take up the knife');
        b.disabled = !state.atHome;
        b.addEventListener('click', () => { draw = { kind: 'marian', cuts: [], anchor: null, drag: null, slips: 0, note: 'Four cuts, each from a nick on the top edge to one on the bottom. Two Vs, the second crossing the first.' }; render(); });
        card.appendChild(b);
      }
      card.appendChild(loreBox(state.lore.marian));
      cols.appendChild(card);
    }
    // 🕯️ The taper burn mark, scorched on the door frame
    if (state.lore.burn) {
      const card = wardCard('burn', state.burn ? `Scorched on the door frame · +${pct}% damage resist` : 'Not yet burned', state.burn);
      if (!state.burn) {
        const b = el('button', 'btn wardBtn', 'Light the taper');
        b.disabled = !state.atHome;
        b.addEventListener('click', () => { draw = { kind: 'burn', slips: 0, note: 'Press and hold to set the flame to the beam; drag to slant the taper. Hold it there until the tear-shape forms, then let go.' }; render(); });
        card.appendChild(b);
      }
      card.appendChild(loreBox(state.lore.burn));
      cols.appendChild(card);
    }
    // 🍽️ The SATOR plate, kept by the hearth
    if (state.lore.sator) {
      const card = wardCard('sator', state.sator ? `Kept by the hearth · +${pct}% damage resist` : 'Not yet written', state.sator);
      if (!state.sator) {
        const b = el('button', 'btn wardBtn', 'Write the square');
        b.disabled = !state.atHome;
        b.addEventListener('click', () => { draw = { kind: 'sator', rows: ['', '', '', '', ''], slips: 0, note: 'Five words of five letters. Set them so the square reads the same across, down, and from either end.' }; render(); });
        card.appendChild(b);
      }
      card.appendChild(loreBox(state.lore.sator));
      cols.appendChild(card);
    }
    // 👞 The concealed shoe
    {
      const card = wardCard('shoe', state.shoe ? `Hidden by the chimney · +${pct}% damage resist` : 'None hidden', state.shoe);
      if (!state.shoe) {
        if (state.feet && state.feet.length) {
          const row = el('div', 'wardShoes');
          for (const f of state.feet) {
            const b = el('button', 'btn wardBtn wardShoeBtn', `Conceal ${f.icon} ${f.name}`);
            b.dataset.item = f.itemId;
            b.disabled = !state.atHome;
            b.addEventListener('click', () => { b.disabled = true; send({ type: 'conceal_shoe', itemId: f.itemId }); });
            row.appendChild(b);
          }
          card.appendChild(row);
        } else {
          card.appendChild(el('div', 'wardHow', 'You need a worn shoe in your pack — boots you have grown out of will do. It is hidden for good.'));
        }
      }
      card.appendChild(loreBox(state.lore.shoe));
      cols.appendChild(card);
    }
    // 🪶 The witch's ladder (harvest luck, not a guard)
    if (state.lore.ladder) {
      const fpct = Math.round((state.ladderForage || 0) * 100);
      const card = wardCard('ladder', state.ladder ? `Hanging in the rafters · +${fpct}% harvest luck` : 'None hung', state.ladder);
      if (!state.ladder) {
        const parts = state.ladderParts || [];
        const ready = parts.length && parts.every((pt) => pt.have >= pt.qty);
        const b = el('button', 'btn wardBtn', ready ? "Tie and hang a witch's ladder" : "Need cord and feathers");
        b.disabled = !state.atHome || !ready;
        b.addEventListener('click', () => { b.disabled = true; send({ type: 'hang_witch_ladder' }); });
        card.appendChild(b);
        card.appendChild(el('div', 'wardHow', parts.map((pt) => `${pt.name} ${Math.min(pt.have, pt.qty)}/${pt.qty}`).join(' · ') + ' — both from Tailor Ines.'));
      }
      card.appendChild(loreBox(state.lore.ladder));
      cols.appendChild(card);
    }
    pentangleCard(cols);
  }

  // 🛡️ Gawain's pentangle: not a house mark, so drawn anywhere, and shown last.
  function pentangleCard(cols) {
    if (!state.lore.pentangle) return;
    const card = wardCard('pentangle', state.pentangle ? `Borne on shield and coat · +${state.pentangleVitality || 10} max health` : 'Not yet painted', state.pentangle);
    if (!state.pentangle) {
      const b = el('button', 'btn wardBtn', 'Take up the brush');
      b.addEventListener('click', () => { draw = { kind: 'pentangle', seq: [], trail: [], drawing: false, slips: 0, note: 'Set the brush on any point and draw the star in one stroke. Don\'t lift it until the knot is closed.' }; render(); });
      card.appendChild(b);
    }
    card.appendChild(loreBox(state.lore.pentangle));
    cols.appendChild(card);
  }

  // ── Shared bits for the drawn marks ───────────────────────────────────────
  function svgBoard(cls) {
    const svg = document.createElementNS(WARDS_SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 260 260');
    svg.setAttribute('class', 'hexCanvas ' + cls);
    const add = (tag, attrs) => { const n = document.createElementNS(WARDS_SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
    const at = (e) => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * 260 / r.width, (e.clientY - r.top) * 260 / r.height]; };
    return { svg, add, at };
  }
  function drawFooter(body, idleLabel) {
    body.appendChild(el('div', 'hexNote', draw.done ? 'Done.' : draw.note));
    if (draw.slips && !draw.done) body.appendChild(el('div', 'hexSlips', `Tried ${draw.slips} time${draw.slips === 1 ? '' : 's'} so far.`));
    const back = el('button', 'btn wardBtn wardBack', draw.done ? 'Back to the house' : idleLabel);
    back.addEventListener('click', () => { draw = null; render(); });
    body.appendChild(back);
  }
  const NEAR = 16;
  const nearest = (pts, x, y) => { let best = -1, bd = NEAR; pts.forEach((p, i) => { const d = Math.hypot(x - p[0], y - p[1]); if (d <= bd) { bd = d; best = i; } }); return best; };

  // ── The Marian mark: four knife cuts between the nicks ────────────────────
  function marianNicks() {
    const b = state.boards && state.boards.marian;
    return b ? [...b.tops.map((p, i) => ({ t: 'top', i, p })), ...b.bottoms.map((p, i) => ({ t: 'bottom', i, p }))] : [];
  }
  function marianPress(x, y) {
    const nicks = marianNicks();
    const k = nearest(nicks.map((n) => n.p), x, y);
    if (k < 0) return false;
    const n = nicks[k];
    if (draw.anchor && (draw.anchor.t !== n.t || draw.anchor.i !== n.i) && !draw.dragging) { marianCut(draw.anchor, n); return true; }
    draw.anchor = n; draw.dragging = true; draw.drag = n.p.slice();
    return true;
  }
  function marianCut(a, n) {
    draw.dragging = false; draw.drag = null;
    if (a.t === n.t) { draw.anchor = n; draw.note = 'A cut runs from the top edge to the bottom edge.'; return; }
    const top = a.t === 'top' ? a.i : n.i, bottom = a.t === 'bottom' ? a.i : n.i;
    draw.anchor = null;
    if (draw.cuts.some((c) => c[0] === top && c[1] === bottom)) { draw.note = 'That line is already cut.'; return; }
    draw.cuts.push([top, bottom]);
    const left = 4 - draw.cuts.length;
    draw.note = left ? `${left} cut${left === 1 ? '' : 's'} to go.` : 'The fourth cut…';
    if (!left) { draw.pending = true; send({ type: 'cut_marian', cuts: draw.cuts }); }
  }
  function renderMarian(body) {
    body.appendChild(el('div', 'wardIntro', 'Cutting a Marian mark into the hearth beam: two Vs, the second crossing the first.'));
    const { svg, add, at } = svgBoard('markCanvas');
    svg.id = 'marianCanvas';
    add('rect', { x: 0, y: 0, width: 260, height: 260, rx: 12, class: 'hexBeam' });
    const b = state.boards && state.boards.marian;
    if (b) for (const [t, bt] of draw.cuts) add('line', { x1: b.tops[t][0], y1: b.tops[t][1], x2: b.bottoms[bt][0], y2: b.bottoms[bt][1], class: 'hexLine' });
    if (draw.anchor && draw.drag) add('line', { x1: draw.anchor.p[0], y1: draw.anchor.p[1], x2: draw.drag[0], y2: draw.drag[1], class: 'markGuide' });
    for (const n of marianNicks()) add('circle', { cx: n.p[0], cy: n.p[1], r: draw.anchor && draw.anchor.t === n.t && draw.anchor.i === n.i ? 6 : 4, class: 'hexCentre' });
    if (!draw.done && !draw.pending) {
      // Drawn in place while the knife moves (re-rendering mid-drag would drop
      // the pointer); the board is rebuilt only when a cut lands.
      let guide = null;
      svg.addEventListener('pointerdown', (e) => {
        const [x, y] = at(e);
        const before = draw.cuts.length;
        if (!marianPress(x, y)) return;
        if (draw.cuts.length !== before || !draw.dragging) { render(); return; }
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
        guide = add('line', { x1: draw.anchor.p[0], y1: draw.anchor.p[1], x2: x, y2: y, class: 'markGuide' });
      });
      svg.addEventListener('pointermove', (e) => { if (!draw.dragging || !guide) return; const [x, y] = at(e); guide.setAttribute('x2', x); guide.setAttribute('y2', y); });
      const lift = (e) => {
        if (!draw.dragging) return;
        const [x, y] = at(e);
        const nicks = marianNicks();
        const k = nearest(nicks.map((n) => n.p), x, y);
        if (k >= 0 && (nicks[k].t !== draw.anchor.t || nicks[k].i !== draw.anchor.i)) marianCut(draw.anchor, nicks[k]);
        else { draw.dragging = false; draw.drag = null; } // a tap: the knife waits on that nick for the next
        render();
      };
      svg.addEventListener('pointerup', lift);
      svg.addEventListener('pointercancel', lift);
    }
    body.appendChild(svg);
    drawFooter(body, 'Put the knife down');
  }

  // ── Gawain's pentangle: one stroke, no lift ───────────────────────────────
  function pentPoints() { return (state.boards && state.boards.pentangle && state.boards.pentangle.points) || []; }
  function pentStart(x, y) {
    const k = nearest(pentPoints(), x, y);
    if (k < 0) { draw.note = 'Set the brush on one of the five points.'; return false; }
    draw.seq = [k]; draw.trail = [[x, y]]; draw.drawing = true;
    draw.note = 'Keep the brush down…';
    return true;
  }
  function pentMove(x, y) {
    if (!draw.drawing) return;
    draw.trail.push([x, y]);
    const k = nearest(pentPoints(), x, y);
    if (k >= 0 && k !== draw.seq[draw.seq.length - 1]) draw.seq.push(k);
  }
  function pentLift() {
    if (!draw.drawing) return;
    draw.drawing = false;
    if (draw.seq.length < 2) { draw.note = 'Draw without lifting the brush: five lines, one stroke.'; draw.seq = []; draw.trail = []; return; }
    draw.pending = true;
    draw.note = 'The brush lifts…';
    send({ type: 'paint_pentangle', seq: draw.seq });
  }
  function renderPentangle(body) {
    body.appendChild(el('div', 'wardIntro', 'Painting the pentangle on your shield: gold on red, one unbroken stroke, the endless knot.'));
    const { svg, add, at } = svgBoard('markCanvas');
    svg.id = 'pentangleCanvas';
    add('rect', { x: 0, y: 0, width: 260, height: 260, rx: 12, class: 'pentField' });
    const pts = pentPoints();
    if (draw.trail.length > 1) add('polyline', { points: draw.trail.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), class: 'markGuide' });
    for (let i = 1; i < draw.seq.length; i++) { const a = pts[draw.seq[i - 1]], b = pts[draw.seq[i]]; if (a && b) add('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'pentLine' }); }
    pts.forEach((p) => add('circle', { cx: p[0], cy: p[1], r: 5, class: 'pentPoint' }));
    if (!draw.done && !draw.pending) {
      // The stroke is drawn in place as the brush moves; the board is rebuilt
      // only once it lifts.
      let trail = null;
      svg.addEventListener('pointerdown', (e) => {
        const [x, y] = at(e);
        if (!pentStart(x, y)) { render(); return; }
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
        trail = add('polyline', { points: `${x.toFixed(1)},${y.toFixed(1)}`, class: 'markGuide' });
        const note = body.querySelector('.hexNote'); if (note) note.textContent = draw.note;
      });
      svg.addEventListener('pointermove', (e) => {
        if (!draw.drawing) return;
        const [x, y] = at(e);
        const before = draw.seq.length;
        pentMove(x, y);
        if (trail) trail.setAttribute('points', trail.getAttribute('points') + ` ${x.toFixed(1)},${y.toFixed(1)}`);
        if (draw.seq.length !== before) { const a = pts[draw.seq[draw.seq.length - 2]], b = pts[draw.seq[draw.seq.length - 1]]; add('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'pentLine' }); }
      });
      const lift = () => { if (!draw.drawing) return; pentLift(); render(); };
      svg.addEventListener('pointerup', lift);
      svg.addEventListener('pointercancel', lift);
    }
    body.appendChild(svg);
    drawFooter(body, 'Put the brush down');
  }

  // ── The taper burn: slant the flame and hold it ───────────────────────────
  // The flame's tip touches the underside of the beam at one point; the taper
  // hangs from it toward the pointer. Time only counts while the button is
  // held; the mark grows as it does, and turns angry red once it's too long.
  function renderBurn(body) {
    body.appendChild(el('div', 'wardIntro', 'Scorching a burn mark into the door frame with a taper.'));
    const { svg, add, at } = svgBoard('markCanvas');
    svg.id = 'burnCanvas';
    const TIP = [130, 118];
    const [lo, hi] = state.burnAngle || [30, 60];
    const [hMin, hMax] = state.burnHold || [3, 8];
    add('rect', { x: 0, y: 0, width: 260, height: 260, rx: 12, class: 'burnRoom' });
    add('rect', { x: 10, y: 20, width: 240, height: 98, rx: 4, class: 'hexBeam' });
    const tear = add('path', { d: '', class: 'burnTear' });
    const taper = add('line', { x1: TIP[0], y1: TIP[1], x2: TIP[0], y2: TIP[1] + 110, class: 'burnTaper' });
    const flame = add('circle', { cx: TIP[0], cy: TIP[1] + 4, r: 0, class: 'burnFlame' });
    const read = add('text', { x: 130, y: 245, class: 'burnRead', 'text-anchor': 'middle' });
    read.textContent = draw.done ? 'The mark is made.' : 'Slant: upright';
    const tearPath = (t) => {
      // A tear: deepest at the foot where the flame touches, tapering up the grain.
      const k = Math.min(1, t / hMax), w = 3 + 9 * k, h = 8 + 52 * k;
      return `M ${TIP[0]} ${TIP[1]} C ${TIP[0] - w * 1.3} ${TIP[1] - h * 0.25}, ${TIP[0] - w * 0.4} ${TIP[1] - h * 0.8}, ${TIP[0]} ${TIP[1] - h} C ${TIP[0] + w * 0.4} ${TIP[1] - h * 0.8}, ${TIP[0] + w * 1.3} ${TIP[1] - h * 0.25}, ${TIP[0]} ${TIP[1]} Z`;
    };
    if (draw.done) tear.setAttribute('d', tearPath((hMin + hMax) / 2));
    if (!draw.done && !draw.pending) {
      let held = null; // { t0, angleSum, samples, angle, raf }
      const angleTo = ([x, y]) => { const dx = x - TIP[0], dy = Math.max(1, y - TIP[1]); return Math.round(Math.atan2(Math.abs(dx), dy) * 180 / Math.PI); };
      const pose = (p) => {
        const a = angleTo(p), dir = p[0] < TIP[0] ? -1 : 1, r = a * Math.PI / 180;
        taper.setAttribute('x2', TIP[0] + dir * 110 * Math.sin(r)); taper.setAttribute('y2', TIP[1] + 110 * Math.cos(r));
        return a;
      };
      const tick = () => {
        if (!held) return;
        const t = (performance.now() - held.t0) / 1000;
        held.angleSum += held.angle; held.samples++;
        const good = held.angle >= lo && held.angle <= hi;
        tear.setAttribute('d', tearPath(good ? t : t * 0.3));
        tear.setAttribute('class', 'burnTear' + (t > hMax ? ' over' : '') + (good ? '' : ' smudge'));
        read.textContent = `Slant ${held.angle}° · ${t.toFixed(1)}s held` + (good && t >= hMin && t <= hMax ? ' · the tear has formed' : t > hMax ? ' · it\'s catching!' : '');
        held.raf = requestAnimationFrame(tick);
      };
      svg.addEventListener('pointerdown', (e) => {
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
        held = { t0: performance.now(), angleSum: 0, samples: 0, angle: pose(at(e)) };
        flame.setAttribute('r', 6);
        held.raf = requestAnimationFrame(tick);
      });
      svg.addEventListener('pointermove', (e) => { if (held) held.angle = pose(at(e)); });
      const lift = () => {
        if (!held) return;
        cancelAnimationFrame(held.raf);
        const seconds = (performance.now() - held.t0) / 1000;
        const angle = held.samples ? Math.round(held.angleSum / held.samples) : held.angle;
        held = null;
        flame.setAttribute('r', 0);
        draw.pending = true; draw.note = 'You take the taper away and look…';
        send({ type: 'burn_mark', angle, seconds: Math.round(seconds * 10) / 10 });
        const n = body.querySelector('.hexNote'); if (n) n.textContent = draw.note;
      };
      svg.addEventListener('pointerup', lift);
      svg.addEventListener('pointercancel', lift);
    }
    body.appendChild(svg);
    drawFooter(body, 'Snuff the taper');
  }

  // ── The SATOR square: five words, written row by row ──────────────────────
  function renderSator(body) {
    body.appendChild(el('div', 'wardIntro', 'Writing the SATOR square on a plate for the hearth.'));
    body.appendChild(el('div', 'satorWords', 'The five words: SATOR · AREPO · TENET · OPERA · ROTAS'));
    const grid = el('div', 'satorGrid');
    const cells = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const d = el('div', 'satorCell', (draw.rows[r] || '')[c] || ''); grid.appendChild(d); cells.push(d); }
    const refresh = () => { for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cells[r * 5 + c].textContent = (draw.rows[r] || '')[c] || ''; };
    const form = el('div', 'satorRows');
    draw.rows.forEach((v, r) => {
      const inp = document.createElement('input');
      inp.className = 'satorRow'; inp.maxLength = 5; inp.value = v; inp.autocomplete = 'off'; inp.spellcheck = false;
      inp.setAttribute('aria-label', `Row ${r + 1}`);
      inp.disabled = !!(draw.done || draw.pending);
      inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); draw.rows[r] = inp.value; refresh(); });
      form.appendChild(inp);
    });
    body.appendChild(form);
    body.appendChild(grid);
    if (!draw.done) {
      const go = el('button', 'btn wardBtn wardBack', 'Write it on the plate');
      go.disabled = !!draw.pending;
      go.addEventListener('click', () => { draw.pending = true; send({ type: 'write_sator', rows: draw.rows.slice() }); render(); });
      body.appendChild(go);
    }
    drawFooter(body, 'Put the pen down');
  }

  // ── The compass: draw a hexafoil the way a carpenter did ──────────────────
  // Step 0: set the point at the centre and swing the circle.
  // Then: set the point anywhere on the circle and swing an arc of the same
  // radius; each further arc is set where the last one crossed the circle.
  // Six arcs and the wheel closes. A miss just slips — no penalty.
  const C = 130, R = 82, HIT = 15;
  function newCompass() { return { stage: 'centre', base: null, used: [], slips: 0, note: 'Set the compass point on the centre mark, and swing the circle.' }; }
  function ptAt(k) { const t = compass.base + k * Math.PI / 3; return [C + R * Math.cos(t), C + R * Math.sin(t)]; }
  function arcPath(k) {
    const t = compass.base + k * Math.PI / 3, px = C + R * Math.cos(t), py = C + R * Math.sin(t);
    const pts = [];
    for (let i = 0; i <= 24; i++) { const a = t + Math.PI * 2 / 3 + (i / 24) * Math.PI * 2 / 3; pts.push(`${(px + R * Math.cos(a)).toFixed(1)},${(py + R * Math.sin(a)).toFixed(1)}`); }
    return 'M' + pts.join(' L');
  }
  function compassClick(x, y) {
    if (compass.stage === 'centre') {
      if (Math.hypot(x - C, y - C) <= HIT) { compass.stage = 'first'; compass.note = 'Good. Now set the point anywhere on the circle and swing an arc of the same radius.'; }
      else { compass.slips++; compass.note = 'The point skids — set it on the centre mark.'; }
    } else if (compass.stage === 'first') {
      if (Math.abs(Math.hypot(x - C, y - C) - R) <= HIT) {
        compass.base = Math.atan2(y - C, x - C);
        compass.used = [0]; compass.stage = 'arcs';
        compass.note = 'The arc crosses the circle twice. Set the point where it crosses, and swing again.';
      } else { compass.slips++; compass.note = 'Set the point ON the circle — the radius never changes.'; }
    } else if (compass.stage === 'arcs') {
      let hit = -1;
      for (let k = 0; k < 6; k++) {
        if (compass.used.includes(k)) continue;
        const adj = compass.used.includes((k + 1) % 6) || compass.used.includes((k + 5) % 6);
        const [px, py] = ptAt(k);
        if (adj && Math.hypot(x - px, y - py) <= HIT) { hit = k; break; }
      }
      if (hit >= 0) {
        compass.used.push(hit);
        const left = 6 - compass.used.length;
        compass.note = left ? `${left} arc${left === 1 ? '' : 's'} to go — each set where the last crossed the circle.` : 'The sixth arc closes the wheel.';
        if (!left) { compass.stage = 'done'; send({ type: 'scribe_hexafoil', slips: compass.slips }); }
      } else { compass.slips++; compass.note = 'Not there — set the point exactly where an arc crosses the circle.'; }
    }
    render();
  }
  function renderCompass(body) {
    body.appendChild(el('div', 'wardIntro', 'Scribing a daisy wheel over the door — one circle, six arcs, one radius.'));
    const svg = document.createElementNS(WARDS_SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 260 260');
    svg.setAttribute('class', 'hexCanvas');
    svg.id = 'hexCanvas';
    const add = (tag, attrs) => { const n = document.createElementNS(WARDS_SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
    add('rect', { x: 0, y: 0, width: 260, height: 260, rx: 12, class: 'hexBeam' });
    if (compass.stage === 'centre') add('circle', { cx: C, cy: C, r: 4, class: 'hexCentre' });
    if (compass.stage !== 'centre') add('circle', { cx: C, cy: C, r: R, class: 'hexLine' });
    if (compass.base !== null) for (const k of compass.used) add('path', { d: arcPath(k), class: 'hexLine' });
    svg.addEventListener('click', (e) => {
      if (compass.stage === 'done') return;
      const r = svg.getBoundingClientRect();
      compassClick((e.clientX - r.left) * 260 / r.width, (e.clientY - r.top) * 260 / r.height);
    });
    body.appendChild(svg);
    body.appendChild(el('div', 'hexNote', compass.note));
    if (compass.slips) body.appendChild(el('div', 'hexSlips', `The compass slipped ${compass.slips} time${compass.slips === 1 ? '' : 's'}.`));
    const back = el('button', 'btn wardBtn wardBack', compass.stage === 'done' ? 'Back to the house' : 'Put the compasses down');
    back.addEventListener('click', () => { compass = null; render(); });
    body.appendChild(back);
  }

  (function wire() {
    const c = document.getElementById('wardsCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  // Test seam: the compass's own geometry, so a harness can click true points.
  function compassPoints() {
    if (!compass) return null;
    const out = { stage: compass.stage, centre: [C, C], radius: R, used: compass.used.slice() };
    if (compass.base !== null) out.points = [0, 1, 2, 3, 4, 5].map(ptAt);
    return out;
  }

  function drawing() { return draw ? { kind: draw.kind, done: !!draw.done, pending: !!draw.pending, note: draw.note, cuts: draw.cuts, seq: draw.seq } : null; }
  return { open, close, setState, render, error, compassPoints, drawing };
}
