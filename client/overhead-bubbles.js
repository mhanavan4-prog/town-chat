// ---------------------------------------------------------------------------
// Overhead speech bubbles (Tier 3.4 Phase C). The desktop counterpart to the
// mobile chat banners: whoever speaks gets their words in a little parchment
// bubble over their head for ~6s, fading at the end. setOverheadBubble stashes
// the line + timer on the player; updateBubbleTag positions and fades it each
// frame (called from syncLabels). Reads the players map via a getter.
// ---------------------------------------------------------------------------
export default function createOverheadBubbles({ getPlayers }) {
function setOverheadBubble(playerId, text, hasImage) {
  const p = getPlayers()[playerId];
  if (!p) return;
  let t = (text || '').trim();
  if (hasImage) t = t ? t + ' 📷' : '📷 (sent a picture)';
  if (!t) return;
  if (t.length > 90) t = t.slice(0, 87) + '…';
  p.bubbleText = t;
  p.bubbleUntil = Date.now() + 6500;
}
function updateBubbleTag(p, v, headScreen, now) {
  const active = p.bubbleText && p.bubbleUntil > now && headScreen.visible;
  if (!active) {
    if (v.bubbleEl) v.bubbleEl.style.display = 'none';
    return;
  }
  if (!v.bubbleEl) {
    v.bubbleEl = document.createElement('div');
    v.bubbleEl.className = 'chatBubbleTag';
    document.body.appendChild(v.bubbleEl);
  }
  if (v.bubbleEl.textContent !== p.bubbleText) v.bubbleEl.textContent = p.bubbleText;
  v.bubbleEl.style.display = 'block';
  v.bubbleEl.style.left = headScreen.x + 'px';
  v.bubbleEl.style.top = (headScreen.y - 40) + 'px';
  const msLeft = p.bubbleUntil - now;
  v.bubbleEl.style.opacity = msLeft < 600 ? String(Math.max(0, msLeft / 600)) : '1';
}

  return { setOverheadBubble, updateBubbleTag };
}
