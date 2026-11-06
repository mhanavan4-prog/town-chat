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

const SVGNS = 'http://www.w3.org/2000/svg';
const TIER_LABEL = { record: 'Archaeological / documentary', folk: 'Folk tradition', revival: 'Modern revival' };

export default function createWards({ send }) {
  let state = null;
  let compass = null; // the hexafoil minigame in progress

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function open() {
    Modals.set('wardsOpen', true);
    document.getElementById('wardsModal').classList.remove('hidden');
    compass = null;
    send({ type: 'wards_state' });
    render();
  }
  function close() {
    Modals.set('wardsOpen', false);
    document.getElementById('wardsModal').classList.add('hidden');
    compass = null;
  }
  function setState(s) { state = s; if (Modals.isOpen('wardsOpen')) render(); }

  function loreBox(w) {
    const box = el('div', 'wardLore');
    box.appendChild(el('span', 'callerTier callerTier-' + w.tier, TIER_LABEL[w.tier] || w.tier));
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

    const intro = el('div', 'wardIntro', state.atHome
      ? 'Old houses were warded at their weak places — the hearth, the door, the chimney. Work your own.'
      : 'Wards are worked at home. Step inside your own cottage to set them; you can read about them anywhere.');
    body.appendChild(intro);
    if (state.hearthWitch) body.appendChild(el('div', 'wardHearth', '🛡️ You walk the Hearth Path — your wards hold stronger: a bottle turns more curses, and each mark guards more.'));
    const pct = Math.round(state.guardEach * 100);

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
      body.appendChild(card);
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
      body.appendChild(card);
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
      body.appendChild(card);
    }
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
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 260 260');
    svg.setAttribute('class', 'hexCanvas');
    svg.id = 'hexCanvas';
    const add = (tag, attrs) => { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
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

  return { open, close, setState, render, compassPoints };
}
