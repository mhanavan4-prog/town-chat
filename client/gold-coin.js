// ---------------------------------------------------------------------------
// The gold coin: one struck emblem for gold wherever it is shown.
// The 🪙 emoji is drawn silver on Apple's platforms, so gold read as silver: in the loot bag, the notice board,
// the toasts, every message the server sends with a coin in it. Rather than chase each string, the page is
// watched: any 🪙 that reaches it becomes the emblem (a gold coin with a raised milled rim and a crescent moon
// struck in the face). The emoji stays in the text, hidden inside the emblem, so code that reads textContent
// back sees what it wrote. A .coin span with nothing in it (the bank, the shop, the menu) gets the same emblem.
// ---------------------------------------------------------------------------

export const COIN_CHAR = '\u{1FA99}';
export const COIN_SVG_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3CradialGradient id='f' cx='0.36' cy='0.3' r='0.8'%3E%3Cstop offset='0' stop-color='%23fff7c8'/%3E%3Cstop offset='0.32' stop-color='%23ffd84f'/%3E%3Cstop offset='0.72' stop-color='%23df9f1c'/%3E%3Cstop offset='1' stop-color='%2394620a'/%3E%3C/radialGradient%3E%3ClinearGradient id='r' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23fff0b0'/%3E%3Cstop offset='0.45' stop-color='%23d79a1c'/%3E%3Cstop offset='1' stop-color='%235e3e05'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='16' cy='16' r='15.4' fill='url(%23r)'/%3E%3Ccircle cx='16' cy='16' r='15.4' fill='none' stroke='%234a3004' stroke-width='0.9'/%3E%3Cg fill='%23fff1b6' opacity='0.7'%3E%3Ccircle cx='29.85' cy='16.00' r='0.78'/%3E%3Ccircle cx='29.38' cy='19.58' r='0.78'/%3E%3Ccircle cx='27.99' cy='22.92' r='0.78'/%3E%3Ccircle cx='25.79' cy='25.79' r='0.78'/%3E%3Ccircle cx='22.93' cy='27.99' r='0.78'/%3E%3Ccircle cx='19.58' cy='29.38' r='0.78'/%3E%3Ccircle cx='16.00' cy='29.85' r='0.78'/%3E%3Ccircle cx='12.42' cy='29.38' r='0.78'/%3E%3Ccircle cx='9.08' cy='27.99' r='0.78'/%3E%3Ccircle cx='6.21' cy='25.79' r='0.78'/%3E%3Ccircle cx='4.01' cy='22.92' r='0.78'/%3E%3Ccircle cx='2.62' cy='19.58' r='0.78'/%3E%3Ccircle cx='2.15' cy='16.00' r='0.78'/%3E%3Ccircle cx='2.62' cy='12.42' r='0.78'/%3E%3Ccircle cx='4.01' cy='9.08' r='0.78'/%3E%3Ccircle cx='6.21' cy='6.21' r='0.78'/%3E%3Ccircle cx='9.07' cy='4.01' r='0.78'/%3E%3Ccircle cx='12.42' cy='2.62' r='0.78'/%3E%3Ccircle cx='16.00' cy='2.15' r='0.78'/%3E%3Ccircle cx='19.58' cy='2.62' r='0.78'/%3E%3Ccircle cx='22.93' cy='4.01' r='0.78'/%3E%3Ccircle cx='25.79' cy='6.21' r='0.78'/%3E%3Ccircle cx='27.99' cy='9.07' r='0.78'/%3E%3Ccircle cx='29.38' cy='12.42' r='0.78'/%3E%3C/g%3E%3Ccircle cx='16' cy='16' r='12.3' fill='url(%23f)' stroke='%237a5108' stroke-width='1'/%3E%3Cpath d='M18.4 9.3A7.2 7.2 0 1 0 18.4 22.7A5.7 5.7 0 1 1 18.4 9.3Z' fill='%23fff3c4' transform='translate(0.55 0.6)' opacity='0.75'/%3E%3Cpath d='M18.4 9.3A7.2 7.2 0 1 0 18.4 22.7A5.7 5.7 0 1 1 18.4 9.3Z' fill='%23a8700d'/%3E%3Cellipse cx='11.6' cy='9.6' rx='5.2' ry='2.6' fill='%23fff' opacity='0.28' transform='rotate(-32 11.6 9.6)'/%3E%3C/svg%3E";

// '+12🪙 · done' -> ['+12', null, ' · done']: null marks where a coin goes (a following U+FE0F is swallowed)
export function coinParts(text) {
  const out = []; const s = String(text == null ? '' : text);
  let at = 0;
  for (;;) {
    const i = s.indexOf(COIN_CHAR, at);
    if (i < 0) break;
    if (i > at) out.push(s.slice(at, i));
    out.push(null);
    at = i + COIN_CHAR.length;
    if (s.charCodeAt(at) === 0xfe0f) at++;
  }
  if (at < s.length || !out.length) out.push(s.slice(at));
  return out;
}

const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SELECT: 1, TITLE: 1 };
function skipped(node) {
  for (let p = node.parentNode; p && p.nodeType === 1; p = p.parentNode) {
    if (SKIP[p.nodeName] || p.isContentEditable) return true;
    if (p.classList && p.classList.contains('coin')) return true;
  }
  return false;
}

function coinSpan(doc) {
  const c = doc.createElement('span'); c.className = 'coin'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'gold');
  const t = doc.createElement('span'); t.className = 'coinT'; t.textContent = COIN_CHAR; c.appendChild(t);
  return c;
}

function swapText(node) {
  if (!node || node.nodeType !== 3 || node.data.indexOf(COIN_CHAR) < 0 || !node.parentNode || skipped(node)) return;
  const doc = node.ownerDocument, frag = doc.createDocumentFragment();
  for (const p of coinParts(node.data)) frag.appendChild(p === null ? coinSpan(doc) : doc.createTextNode(p));
  node.parentNode.replaceChild(frag, node);
}

export function coinify(root) {
  if (!root) return;
  if (root.nodeType === 3) { swapText(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.textContent.indexOf(COIN_CHAR) < 0) return;
  const doc = root.ownerDocument || root, w = doc.createTreeWalker(root, 4), found = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.indexOf(COIN_CHAR) >= 0) found.push(n);
  for (const n of found) swapText(n);
}

// Swap every coin already on the page, and every one that arrives.
export function watchCoins(doc) {
  if (!doc || !doc.body || typeof MutationObserver === 'undefined') return null;
  coinify(doc.body);
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') swapText(m.target);
      else for (const n of m.addedNodes) coinify(n);
    }
  });
  mo.observe(doc.body, { childList: true, subtree: true, characterData: true });
  return mo;
}
