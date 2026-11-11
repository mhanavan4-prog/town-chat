// ---------------------------------------------------------------------------
// The back gesture closes menus, not the game.
//
// On a phone, swiping back (or the browser's back button) used to leave the
// site, because opening a menu never touched the history. Now, while any menu
// or panel is open, one extra history entry sits on top ("the guard"). Going
// back pops the guard instead of the page, and the topmost open menu closes,
// the same way Escape closes it (Escape's handlers know each panel, including
// going back to the ☰ menu a panel was opened from). If a panel takes no
// notice of Escape, its own close button is pressed; failing that, it is hidden.
// When the last menu closes by any other means (its ✕, a tap outside), the
// guard is taken back off, so the next back gesture leaves as it always did.
//
// Not closed by going back: the join screen, and a Delve boon that must be
// chosen. The ghost screen isn't a menu, so it isn't touched either.
//
// On a touch screen, a panel whose own close button is out of sight (many are
// a full screen tall, with Close at the very bottom) gets a ✕ in the top
// corner that closes it the same way, until its own close comes into view.
// ---------------------------------------------------------------------------
// Every panel: the overlays and float panels, the ☰ menu, anything named
// …Modal, and the inventory and shop panels, which are none of those.
export const BACK_MENU_SELECTOR = '.overlay, .floatPanel, #menuSheet, [id$="Modal"], #inventoryPanel, #invActionPanel, #witchShopPanel, #witchCraftPanel, #bankDepositPanel, #pickpocketPanel, #chatPanel, #playerContextMenu, #spyGlassPanel';
export const BACK_KEEP_IDS = new Set(['joinScreen', 'boonDraft']);
const BACK_GUARD = 'thornreachMenu';
// On a phone the chat (and the Log in it) is a sheet opened from 💬, so it is
// one of the panels; on a desktop it sits in its corner all the time and is not.
const BACK_TOUCH_ONLY = new Set(['chatPanel']);
// Panels that are closed their own way (handed in by the game), not by a button of theirs.
const backClosers = {};

function backShown(el) {
  if (!el || el.classList.contains('hidden') || BACK_KEEP_IDS.has(el.id)) return false;
  if (BACK_TOUCH_ONLY.has(el.id) && !document.body.classList.contains('touchMode')) return false;
  if (typeof el.checkVisibility === 'function') return el.checkVisibility();
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
}

// The open menus, topmost last: by z-index, then by place in the page.
export function backOpenMenus(doc) {
  const d = doc || document;
  const shown = [...d.querySelectorAll(BACK_MENU_SELECTOR)].filter(backShown);
  // One panel is one level: a matching element inside another open panel is part of it.
  const open = shown.filter((el) => !shown.some((o) => o !== el && o.contains(el)));
  const z = (el) => { const v = parseInt(getComputedStyle(el).zIndex, 10); return Number.isFinite(v) ? v : 0; };
  return open.map((el, i) => ({ el, i, z: z(el) })).sort((a, b) => a.z - b.z || a.i - b.i).map((x) => x.el);
}

// Close one menu, and only that one: its own close button if it has one (so
// it tidies up after itself), else Escape, else hide it.
function backCloseButton(top) {
  const vis = (b) => (typeof b.checkVisibility === 'function' ? b.checkVisibility() : b.getClientRects().length > 0);
  return [...top.querySelectorAll('[id$="CloseBtn"], [id$="Close"], .closeBtn, .modalClose, button[aria-label^="Close"]')].find(vis)
    || [...top.querySelectorAll('button')].find((b) => vis(b) && /^\s*(✕|×|✖|Close)\b/.test(b.textContent));
}
function backCloseTop(top) {
  if (backClosers[top.id]) { backClosers[top.id](); return; }
  const btn = backCloseButton(top);
  if (btn) btn.click();
  else window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  setTimeout(() => { if (backShown(top)) top.classList.add('hidden'); }, 0);
}

// Is the panel's own close (or done, or back) button on screen to tap?
const BACK_CLOSER = /close|✕|×|✖|\bdone\b|back to|leave it/i;
export function backCloseInReach(top) {
  const H = window.innerHeight, W = window.innerWidth;
  return [...top.querySelectorAll('button, [role=button]')].some((b) => {
    if (!BACK_CLOSER.test(`${b.textContent} ${b.id} ${b.getAttribute('aria-label') || ''}`)) return false;
    if (typeof b.checkVisibility === 'function' && !b.checkVisibility()) return false;
    const r = b.getBoundingClientRect();
    return r.height >= 24 && r.top >= 0 && r.bottom <= H && r.left >= 0 && r.right <= W;
  });
}

export default function installBackCloses(closers) {
  if (typeof window === 'undefined' || !window.history || !window.history.pushState) return null;
  Object.assign(backClosers, closers || {});
  // How many of our history entries sit on top of the page: one for every
  // level a back gesture should close. A panel opened from the ☰ menu is two
  // levels (back closes it to the menu, back again closes the menu). They are
  // pushed at the tap that opens the level: phone browsers skip, on a back
  // gesture, any history entry a page adds without a tap, so nothing may be
  // pushed after a swipe (that is how backing out to the menu once left the
  // site on the next swipe).
  let depth = (history.state && history.state[BACK_GUARD]) | 0;
  let ignorePop = 0;
  let settleUntil = 0; // just after a back: let the panels settle before counting
  let queued = false;
  let order = []; // the open panels, in the order they opened: back closes the newest

  function newestOpen() {
    const menus = backOpenMenus();
    order = order.filter((el) => menus.includes(el));
    for (const el of menus) if (!order.includes(el)) order.push(el);
    return { menus, top: order[order.length - 1] || null };
  }

  // The ✕ for touch screens, shown over a panel whose own close is out of reach.
  const touch = window.matchMedia ? window.matchMedia('(pointer:coarse)') : { matches: false };
  const fab = document.createElement('button');
  fab.id = 'backCloseFab'; fab.className = 'hidden'; fab.type = 'button';
  fab.textContent = '✕'; fab.setAttribute('aria-label', 'Close this panel');
  fab.addEventListener('click', () => { const { top } = newestOpen(); if (top) backCloseTop(top); });
  document.body.appendChild(fab);

  // The levels open now: each open panel, and the ☰ menu a panel came from.
  function wantedDepth(menus) {
    const sheet = document.getElementById('menuSheet');
    const fromMenu = !!window.__fromMenu && menus.length > 0 && !(sheet && menus.includes(sheet));
    return menus.length + (fromMenu ? 1 : 0);
  }

  function sync() {
    queued = false;
    const { menus, top } = newestOpen();
    const wantFab = !!top && touch.matches && !backCloseInReach(top);
    if (fab.classList.contains('hidden') === wantFab) fab.classList.toggle('hidden', !wantFab);
    if (Date.now() < settleUntil) { setTimeout(queue, settleUntil - Date.now() + 5); return; }
    const want = wantedDepth(menus);
    if (want > depth) {
      for (let d = depth + 1; d <= want; d++) history.pushState({ ...(history.state || {}), [BACK_GUARD]: d }, '');
      depth = want;
    } else if (want < depth) {
      // Closed some other way (its ✕, a tap outside): take the spare entries back off.
      ignorePop++;
      history.go(want - depth);
      depth = want;
    }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(sync); } }

  window.addEventListener('popstate', (e) => {
    const now = (e.state && e.state[BACK_GUARD]) | 0;
    if (ignorePop > 0) { ignorePop--; depth = now; return; }
    if (now >= depth) { depth = now; return; } // forward, or not one of ours: let it be
    const steps = depth - now;
    depth = now;
    settleUntil = Date.now() + 250;
    const fromMenu = !!window.__fromMenu;
    // Close the newest panel (one per step back); the rest stay as they were.
    const { top } = newestOpen();
    if (top) backCloseTop(top);
    if (steps > 1) for (const el of order.slice(-steps, -1).reverse()) backCloseTop(el);
    // A panel that came from the ☰ menu goes back to it, even one whose own
    // Escape doesn't know to (the menu's history entry is still waiting).
    setTimeout(() => {
      const sheet = document.getElementById('menuSheet');
      if (fromMenu && now >= 1 && sheet && sheet.classList.contains('hidden')) {
        const pc = document.getElementById('pcMenuBtn');
        if (pc) pc.click(); else sheet.classList.remove('hidden');
        window.__fromMenu = false;
      }
    }, 120);
    setTimeout(queue, 260);
  });

  new MutationObserver(queue).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  // A panel scrolled until its own close shows: the ✕ can go.
  window.addEventListener('scroll', queue, { capture: true, passive: true });
  window.addEventListener('resize', queue);
  queue();
  return { sync, menus: () => backOpenMenus().map((el) => el.id || el.className), fabShown: () => !fab.classList.contains('hidden') };
}
