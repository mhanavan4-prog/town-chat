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
// ---------------------------------------------------------------------------
export const BACK_MENU_SELECTOR = '.overlay, .floatPanel, #menuSheet, #crierModal';
export const BACK_KEEP_IDS = new Set(['joinScreen', 'boonDraft']);
const BACK_GUARD = 'thornreachMenu';

function backShown(el) {
  if (!el || el.classList.contains('hidden') || BACK_KEEP_IDS.has(el.id)) return false;
  if (typeof el.checkVisibility === 'function') return el.checkVisibility();
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
}

// The open menus, topmost last: by z-index, then by place in the page.
export function backOpenMenus(doc) {
  const d = doc || document;
  const open = [...d.querySelectorAll(BACK_MENU_SELECTOR)].filter(backShown);
  const z = (el) => { const v = parseInt(getComputedStyle(el).zIndex, 10); return Number.isFinite(v) ? v : 0; };
  return open.map((el, i) => ({ el, i, z: z(el) })).sort((a, b) => a.z - b.z || a.i - b.i).map((x) => x.el);
}

// Close one menu: Escape first; then its own close button; then hide it.
function backCloseTop(top) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  setTimeout(() => {
    if (!backShown(top)) return;
    const btn = top.querySelector('[id$="CloseBtn"], [id$="Close"], .closeBtn, .modalClose, button[aria-label^="Close"]')
      || [...top.querySelectorAll('button')].find((b) => /^\s*(✕|×|✖|Close)\s*$/.test(b.textContent));
    if (btn) btn.click();
    if (backShown(top)) top.classList.add('hidden');
  }, 0);
}

export default function installBackCloses() {
  if (typeof window === 'undefined' || !window.history || !window.history.pushState) return null;
  let guarded = !!(history.state && history.state[BACK_GUARD]);
  let ignorePop = 0;
  let queued = false;

  function sync() {
    queued = false;
    const open = backOpenMenus().length > 0;
    if (open && !guarded) {
      history.pushState({ ...(history.state || {}), [BACK_GUARD]: true }, '');
      guarded = true;
    } else if (!open && guarded && history.state && history.state[BACK_GUARD]) {
      // Closed some other way: take the guard back off.
      guarded = false;
      ignorePop++;
      history.back();
    }
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(sync); } }

  window.addEventListener('popstate', () => {
    if (ignorePop > 0) { ignorePop--; return; }
    if (!guarded) return; // an ordinary back, with no menu open: let it be
    guarded = false;
    const open = backOpenMenus();
    if (open.length) backCloseTop(open[open.length - 1]);
    setTimeout(queue, 30); // still something open (a menu under it)? guard again
  });

  new MutationObserver(queue).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  queue();
  return { sync, menus: () => backOpenMenus().map((el) => el.id || el.className) };
}
