// ---------------------------------------------------------------------------
// "A word from now": the one plain modern line a working may carry, folded
// away under the story so it never interrupts it. Closed by default; the
// player opens it if they want it. textContent only.
// ---------------------------------------------------------------------------
export function nowNoteEl(text) {
  const box = document.createElement('details');
  box.className = 'nowNote';
  const head = document.createElement('summary');
  head.textContent = '🕯 A word from now';
  const body = document.createElement('div');
  body.className = 'nowNoteText';
  body.textContent = text;
  box.appendChild(head);
  box.appendChild(body);
  return box;
}
