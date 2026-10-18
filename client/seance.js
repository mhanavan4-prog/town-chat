// ---------------------------------------------------------------------------
// The Séance Board (Tier 3.5) — a coven ritual in the Manor. DI factory,
// open-state via the Modals registry. The board, the planchette and the ask
// panel live here; the SERVER drives the ritual: it answers seance_state, and
// on a start it broadcasts seance_begin → seance_step… → seance_end to every
// member present, which this module animates in lockstep. The client never
// decides what the board spells — it only renders what the server sends.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

export default function createSeance({ send, getMe, shortWhen }) {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const REST = { x: 500, y: 330 };
  let coords = null;        // glyph key -> { x, y, el }
  let planchette = null;
  let built = false;
  let raf = 0;
  let pos = { x: REST.x, y: REST.y };
  let from = { x: REST.x, y: REST.y };
  let to = { x: REST.x, y: REST.y };
  let tStart = 0, tDur = 600, moving = false;
  let state = null;         // last seance_state payload
  let busy = false;         // a ritual is playing

  const reduce = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // ── build the board once ──────────────────────────────────────────────────
  function buildBoard() {
    const svg = document.getElementById('seanceBoardSvg');
    if (!svg || built) return;
    coords = {};
    const addText = (ch, x, y, cls, size) => {
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('class', 'sbGlyph' + (cls ? ' ' + cls : ''));
      t.setAttribute('font-size', size || 34);
      t.textContent = ch;
      svg.appendChild(t);
      return t;
    };
    const reg = (key, x, y, el) => { coords[key] = { x, y, el }; };
    const arc = (cx, cy, rx, ry, a0, a1) => {
      const p0 = [cx + rx * Math.cos(a0), cy + ry * Math.sin(a0)];
      const p1 = [cx + rx * Math.cos(a1), cy + ry * Math.sin(a1)];
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', `M ${p0[0]} ${p0[1]} A ${rx} ${ry} 0 0 1 ${p1[0]} ${p1[1]}`);
      path.setAttribute('class', 'sbArc');
      svg.appendChild(path);
    };
    arc(500, 250, 400, 150, Math.PI * 1.08, Math.PI * 1.92);
    arc(500, 250, 400, 236, Math.PI * 1.06, Math.PI * 1.94);
    reg('YES', 120, 92, addText('yes', 120, 92, 'sbWord', 30));
    reg('NO', 880, 92, addText('no', 880, 92, 'sbWord', 30));
    'ABCDEFGHIJKLM'.split('').forEach((ch, i) => {
      const t = i / 12, x = 170 + t * 660, y = 212 - 46 * Math.sin(Math.PI * t);
      reg(ch, x, y, addText(ch, x, y));
    });
    'NOPQRSTUVWXYZ'.split('').forEach((ch, i) => {
      const t = i / 12, x = 170 + t * 660, y = 316 - 34 * Math.sin(Math.PI * t);
      reg(ch, x, y, addText(ch, x, y));
    });
    '0123456789'.split('').forEach((ch, i) => {
      const t = i / 9, x = 250 + t * 500, y = 412 - 8 * Math.sin(Math.PI * t);
      reg(ch, x, y, addText(ch, x, y));
    });
    reg('GOODBYE', 500, 520, addText('goodbye', 500, 520, 'sbWord', 30));

    planchette = document.createElementNS(SVGNS, 'g');
    planchette.setAttribute('id', 'sbPlanchette');
    planchette.innerHTML =
      '<path class="sbBody" d="M0,-58 C34,-58 52,-30 44,2 C38,28 20,44 0,62 C-20,44 -38,28 -44,2 C-52,-30 -34,-58 0,-58 Z"></path>'
      + '<circle class="sbRing" cx="0" cy="-8" r="26"></circle>'
      + '<circle class="sbRingInner" cx="0" cy="-8" r="20"></circle>'
      + '<line class="sbTick" x1="0" y1="-16" x2="0" y2="0"></line>'
      + '<line class="sbTick" x1="-8" y1="-8" x2="8" y2="-8"></line>';
    svg.appendChild(planchette);
    placePlanchette(REST.x, REST.y);
    built = true;
  }

  function placePlanchette(x, y) {
    if (planchette) planchette.setAttribute('transform', `translate(${x.toFixed(2)},${(y - 8).toFixed(2)})`);
  }

  function loop(now) {
    if (!Modals.isOpen('seanceModalOpen')) { raf = 0; return; }
    let wx = 0, wy = 0;
    if (!reduce) { wx = 1.8 * Math.sin(now / 520) + 0.7 * Math.sin(now / 170); wy = 1.8 * Math.cos(now / 430); }
    if (moving) {
      const t = Math.min(1, (now - tStart) / tDur);
      const e = easeInOut(t);
      pos.x = from.x + (to.x - from.x) * e;
      pos.y = from.y + (to.y - from.y) * e;
      if (t >= 1) moving = false;
    }
    placePlanchette(pos.x + wx, pos.y + wy);
    raf = requestAnimationFrame(loop);
  }
  function startLoop() { if (!raf) raf = requestAnimationFrame(loop); }
  function glideTo(x, y, dur) {
    from = { x: pos.x, y: pos.y };
    to = { x, y };
    tStart = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    tDur = reduce ? Math.min(dur, 240) : dur;
    moving = true;
  }

  // ── readout ────────────────────────────────────────────────────────────────
  function setReadout(ghost) {
    const r = document.getElementById('seanceReadout');
    if (r) r.innerHTML = ghost ? `<span class="sbGhost">${ghost}</span>` : '<span class="sbCursor">◆</span>';
  }
  function pushReadout(chars) {
    const r = document.getElementById('seanceReadout');
    if (!r) return;
    const cursor = r.querySelector('.sbCursor');
    const span = document.createElement('span');
    span.textContent = chars;
    if (cursor) r.insertBefore(span, cursor); else r.appendChild(span);
  }
  function lightGlyph(key) {
    const g = key && coords && coords[key];
    if (!g || !g.el) return;
    g.el.classList.add('lit');
    setTimeout(() => g.el.classList.remove('lit'), 1600);
  }
  function veil(on, text) {
    const v = document.getElementById('seanceVeil');
    if (!v) return;
    if (text) v.querySelector('.sbVeilText').textContent = text;
    v.classList.toggle('on', !!on);
  }

  // ── ask panel ────────────────────────────────────────────────────────────────
  function renderPanel() {
    const status = document.getElementById('seanceStatus');
    const btn = document.getElementById('seanceCommuneBtn');
    if (!status || !btn) return;
    if (!state) { status.textContent = 'Consulting the board…'; btn.disabled = true; return; }
    const now = Date.now();
    let msg, canStart = false;
    if (busy || state.active) { msg = 'The board is speaking — hold the circle…'; }
    else if (!state.enabled) { msg = 'The veil is quiet tonight.'; }
    else if (state.cooldownUntil && state.cooldownUntil > now) { msg = `The veil is spent — it settles ${shortWhen(state.cooldownUntil)}.`; }
    else if (state.membersPresent < state.minMembers) { msg = `The ritual needs ${state.minMembers} here — ${state.membersPresent} present.`; }
    else { msg = `Offering: ${state.offeringCost} gold · ${state.membersPresent} gathered.`; canStart = true; }
    status.textContent = msg;
    btn.disabled = !canStart;
  }

  // ── public: open / close / render / message handling ──────────────────────
  function openSeanceModal() {
    buildBoard();
    Modals.set('seanceModalOpen', true);
    const m = document.getElementById('seanceModal');
    if (m) m.classList.remove('hidden');
    setReadout('the board waits in silence…');
    startLoop();
    send({ type: 'seance_state' });
    renderPanel();
  }
  function closeSeanceModal() {
    Modals.set('seanceModalOpen', false);
    const m = document.getElementById('seanceModal');
    if (m) m.classList.add('hidden');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  // Server → client ritual events. Returns true if it handled the message.
  function handleSeanceMessage(msg) {
    switch (msg.type) {
      case 'seance_state':
        state = msg;
        renderPanel();
        return true;
      case 'seance_begin':
        busy = true;
        setReadout();
        veil(true, 'opening the channel…');
        if (planchette) planchette.classList.add('channeling');
        renderPanel();
        return true;
      case 'seance_step': {
        veil(false);
        if (msg.kind === 'space') { pushReadout(' '); return true; }
        const g = coords && coords[msg.glyph];
        if (g) {
          if (msg.repeat) { glideTo(g.x, g.y - 22, 180); setTimeout(() => glideTo(g.x, g.y, 360), 190); }
          else glideTo(g.x, g.y, 560);
          lightGlyph(msg.glyph);
        }
        if (msg.char && !(msg.kind === 'word' && msg.char === '')) {
          pushReadout(msg.char.length > 1 ? ' ' + msg.char + ' ' : msg.char);
        }
        return true;
      }
      case 'seance_end':
        if (planchette) planchette.classList.remove('channeling');
        glideTo(REST.x, REST.y, 700);
        busy = false;
        { const c = document.getElementById('seanceReadout'); const cur = c && c.querySelector('.sbCursor'); if (cur) cur.remove(); }
        renderPanel();
        return true;
      case 'seance_error':
        if (window.__seanceToast) window.__seanceToast(msg.message);
        return true;
      default:
        return false;
    }
  }

  // wiring
  (function () {
    const close = document.getElementById('seanceCloseBtn');
    if (close) close.addEventListener('click', closeSeanceModal);
    const btn = document.getElementById('seanceCommuneBtn');
    if (btn) btn.addEventListener('click', () => {
      const q = document.getElementById('seanceQuestion');
      send({ type: 'seance_start', question: (q && q.value) || '' });
    });
    const q = document.getElementById('seanceQuestion');
    if (q) q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = document.getElementById('seanceCommuneBtn'); if (b && !b.disabled) b.click(); } });
  })();

  return { openSeanceModal, closeSeanceModal, handleSeanceMessage };
}
