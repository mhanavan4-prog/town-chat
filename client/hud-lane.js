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

// The quest and story trackers hang at the top right. On a phone the toast lane down the middle is wider than the gap
// they leave, so a notice landed on top of the tracker (a new ability over The Ancient Harvest). This measures how far
// down any tracker that the lane would cross reaches, into --hudSideBottom, and the lane starts below that. A tracker
// clear of the lane (a wide screen, or one dragged out of the way) moves nothing.
export const LANE_MAX_W = 520, LANE_VW = 0.92;
export function sideBottom(rects, vw) {
  const half = Math.min(LANE_MAX_W, vw * LANE_VW) / 2, l = vw / 2 - half, r = vw / 2 + half;
  let b = 0;
  for (const q of rects) if (q && q.height > 0 && q.width > 0 && q.left < r && q.right > l && q.top < 400) b = Math.max(b, Math.round(q.bottom));
  return b;
}

export function watchSideTrackers(ids = ['questTracker', 'storyTracker'], doc = document, win = window) {
  const st = doc.body && doc.body.style, els = ids.map((id) => doc.getElementById(id)).filter(Boolean);
  if (!st || typeof st.setProperty !== 'function' || !els.length) return null;
  const note = () => st.setProperty('--hudSideBottom', sideBottom(els.map((e) => e.getBoundingClientRect()), win.innerWidth || 0) + 'px');
  note();
  const ro = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(note) : null;
  const mo = typeof win.MutationObserver === 'function' ? new win.MutationObserver(note) : null;
  for (const e of els) { if (ro) ro.observe(e); if (mo) mo.observe(e, { attributes: true, attributeFilter: ['class', 'style'] }); }
  win.addEventListener('resize', note);
  return { note, stop() { if (ro) ro.disconnect(); if (mo) mo.disconnect(); win.removeEventListener('resize', note); } };
}
