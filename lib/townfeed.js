'use strict';
// Town Crier — a small, persisted feed of recent REAL player milestones
// (someone reached level 5, finished a chapter, founded a coven). It exists for
// one reason: a solo visitor in a quiet hour should still see evidence that
// real people play here, not an empty void. It is NOT a chat log and NOT an
// activity tracker for moderation — just a public highlight reel.
//
// Entries are deliberately low-volume: every source is a once-ever-per-account
// milestone, so the feed can't be spammed by repetition. Names are public
// display names; nothing private is stored. Bounded and persisted so it
// survives the frequent redeploys and shows history, not just this uptime.
const path = require('path');

module.exports = function createTownFeed(opts) {
  opts = opts || {};
  const { dataDir, persistLoad, persistSave, persistRegister } = opts;
  const MAX = opts.max || 40;
  const FILE = path.join(dataDir, 'townfeed.json');
  const data = persistLoad('townfeed', FILE) || { items: [], seq: 0 };
  if (!Array.isArray(data.items)) data.items = [];
  if (typeof data.seq !== 'number') data.seq = 0;
  if (persistRegister) persistRegister('townfeed', FILE, () => data);

  let dirty = false, timer = null;
  function save() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (dirty) { dirty = false; try { persistSave('townfeed', FILE, data); } catch (e) {} }
    }, 3000);
    if (timer && timer.unref) timer.unref();
  }

  // Add one entry. icon + text are server-authored (never raw user input);
  // name is a public display name. Returns the stored entry, or null if it was
  // suppressed as a duplicate of the most recent one.
  function push(icon, text) {
    text = String(text || '').slice(0, 120);
    if (!text) return null;
    icon = String(icon || '✨').slice(0, 8);
    const last = data.items[data.items.length - 1];
    if (last && last.text === text) return null; // no immediate repeats
    const item = { id: ++data.seq, icon, text, at: Date.now() };
    data.items.push(item);
    if (data.items.length > MAX) data.items.splice(0, data.items.length - MAX);
    dirty = true; save();
    return item;
  }

  // Most recent first, capped at n.
  function recent(n) {
    n = Math.max(1, Math.min(MAX, n || 20));
    return data.items.slice(-n).reverse();
  }

  return { push, recent };
};
