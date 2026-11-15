// The lane (#hudLane in index.html): everything small at the top middle of the screen is laid out in it, one under
// another, so nothing there can overlap. This measures where the lane ends, into --hudLaneBottom, so the toasts and
// the announce banner (which sit above panels, in their own stack) begin below it.
export function laneBottom(rect) { return rect && rect.height > 0 ? Math.round(rect.bottom) : 0; }

export function watchHudLane(doc = document, win = window) {
  const lane = doc.getElementById('hudLane'), st = doc.body && doc.body.style;
  if (!lane || !st || typeof st.setProperty !== 'function' || typeof lane.getBoundingClientRect !== 'function') return null;
  const note = () => st.setProperty('--hudLaneBottom', laneBottom(lane.getBoundingClientRect()) + 'px');
  note();
  let ro = null;
  if (typeof win.ResizeObserver === 'function') { ro = new win.ResizeObserver(note); ro.observe(lane); }
  win.addEventListener('resize', note);
  return { note, stop() { if (ro) ro.disconnect(); win.removeEventListener('resize', note); } };
}
