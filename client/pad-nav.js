// ---------------------------------------------------------------------------
// 🎮 Finding your way round a panel with a controller (for playing on a TV).
// While any panel is open (an .overlay or .floatPanel, the ☰ sheet, the
// satchel), the d-pad or the left stick moves a highlight from one button to
// the next in the direction pushed, Ⓐ presses it, and Ⓑ goes back (main.js
// sends Escape). Nothing here knows any one panel: it looks at what is on the
// screen and on top, so new panels work without being told about.
//
// TV text: the first time a controller is used on a big screen (at least
// 1280 wide), the page is scaled up a size for reading from the sofa
// (body.tvMode). It can be turned off and on again with Select + Ⓨ, and is
// remembered (localStorage tc_tv_mode).
// ---------------------------------------------------------------------------
const PANEL_SEL = '.overlay:not(.hidden), .floatPanel:not(.hidden), #menuSheet:not(.hidden), #inventoryPanel:not(.hidden)';
const FOCUS_SEL = 'button, a[href], [role="button"], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), .padFocusable';
const REPEAT_FIRST = 0.38, REPEAT_NEXT = 0.14;

export default function createPadNav() {
  let current = null;        // the highlighted element
  let held = null, heldFor = 0, repeatIn = 0, lookIn = 0;

  const shown = (el) => {
    if (!el || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && !el.disabled;
  };

  // The panel on top: of those open, the one with the highest stacking, the latest in the page on a tie.
  function topPanel() {
    const open = [...document.querySelectorAll(PANEL_SEL)].filter((p) => { const r = p.getBoundingClientRect(); return r.width > 20 && r.height > 20 && getComputedStyle(p).display !== 'none'; });
    if (!open.length) return null;
    const z = (el) => { let v = 0; for (let e = el; e && e !== document.body; e = e.parentElement) { const n = parseInt(getComputedStyle(e).zIndex, 10); if (!Number.isNaN(n)) v = Math.max(v, n); } return v; };
    return open.map((p, i) => ({ p, z: z(p), i })).sort((a, b) => (b.z - a.z) || (b.i - a.i))[0].p;
  }
  // What can be pressed: buttons and the like, and anything else drawn with a pointing hand (slots, cards, tiles).
  const targets = (panel) => {
    const list = [...panel.querySelectorAll(FOCUS_SEL)].filter(shown);
    for (const el of panel.querySelectorAll('div, span, li, img, label')) {
      if (list.includes(el) || el.closest(FOCUS_SEL)) continue;
      if (getComputedStyle(el).cursor !== 'pointer' || (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer')) continue;
      if (shown(el)) list.push(el);
    }
    // in reading order, so the first is top-left
    return list.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (Math.abs(ra.top - rb.top) > 8 ? ra.top - rb.top : ra.left - rb.left); });
  };

  function mark(el) {
    if (current && current !== el) current.classList.remove('padFocus');
    current = el;
    if (!el) return;
    el.classList.add('padFocus');
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* old browsers */ }
  }

  // The nearest target in the direction pushed: mostly along it, a little across it.
  function step(dx, dy) {
    const panel = topPanel(); if (!panel) return;
    const list = targets(panel); if (!list.length) return;
    if (!current || !list.includes(current)) { mark(list[0]); return; }
    const a = current.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of list) {
      if (el === current) continue;
      const r = el.getBoundingClientRect(), bx = r.left + r.width / 2, by = r.top + r.height / 2;
      const along = (bx - ax) * dx + (by - ay) * dy;
      if (along <= 4) continue;
      const across = Math.abs((bx - ax) * dy - (by - ay) * dx);
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) mark(best);
  }

  // Called each frame from main.js's controller poll. Returns true when a panel is open (so the stick does not walk).
  function poll(pad, justPressed, dt) {
    const panel = topPanel();
    if (!panel) { if (current) mark(null); held = null; lookIn = 0; return false; }
    if (current && (!panel.contains(current) || !current.isConnected)) { mark(null); lookIn = 0; }
    // the first time a panel is looked at (and twice a second after, while it offers nothing to press)
    lookIn -= dt;
    if (!current && lookIn <= 0) { lookIn = 0.5; const list = targets(panel); if (list.length) mark(list[0]); }
    // direction: d-pad, or the left stick pushed well over
    const lx = pad.axes[0] || 0, ly = pad.axes[1] || 0, b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    let dir = null;
    if (b(12) || ly < -0.6) dir = 'up'; else if (b(13) || ly > 0.6) dir = 'down'; else if (b(14) || lx < -0.6) dir = 'left'; else if (b(15) || lx > 0.6) dir = 'right';
    if (dir !== held) { held = dir; heldFor = 0; repeatIn = 0; }
    if (dir) {
      heldFor += dt; repeatIn -= dt;
      if (repeatIn <= 0) {
        step(...({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] })[dir]);
        repeatIn = heldFor < REPEAT_FIRST ? REPEAT_FIRST : REPEAT_NEXT;
      }
    }
    // the right stick scrolls a long panel
    const ry = pad.axes[3] || 0;
    if (Math.abs(ry) > 0.25) { const sc = (current && current.closest('[class*="scroll"], .overlay > div, .floatPanel')) || panel; sc.scrollTop += ry * 900 * dt; }
    if (justPressed(0) && current) { current.click(); if (current.matches('input, select, textarea')) current.focus(); }
    return true;
  }

  // TV text
  const TV_KEY = 'tc_tv_mode';
  const read = () => { try { return localStorage.getItem(TV_KEY); } catch (e) { return null; } };
  const write = (v) => { try { localStorage.setItem(TV_KEY, v); } catch (e) { /* private window */ } };
  function setTv(on) { document.body.classList.toggle('tvMode', !!on); write(on ? '1' : '0'); }
  function padSeen() {
    const saved = read();
    if (saved === '1') setTv(true);
    else if (saved == null && innerWidth >= 1280 && !matchMedia('(pointer: coarse)').matches) { setTv(true); return true; }
    return false;
  }
  const toggleTv = () => { const on = !document.body.classList.contains('tvMode'); setTv(on); return on; };
  if (read() === '1') document.body.classList.add('tvMode');

  return { poll, padSeen, toggleTv, current: () => current, topPanel };
}
