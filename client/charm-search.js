// ---------------------------------------------------------------------------
// Search the Charm Book: find any entry across every chapter by its name, or,
// once it is written in, by its lore or source. An entry still hidden in its
// chapter (an un-met caller) is not found at all, and an un-met entry is found
// by name only, so the search never tells more than the book does. Pure.
// ---------------------------------------------------------------------------
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function searchBook(book, query, limit = 60) {
  const q = fold(query).trim();
  if (!book || !Array.isArray(book.chapters) || q.length < 2) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const out = [];
  for (const ch of book.chapters) {
    for (const e of ch.entries || []) {
      if (!e.met && ch.showNames === false) continue;
      const title = fold(e.title);
      const body = e.met ? fold(`${e.lore || ''} ${e.source || ''}`) : '';
      if (!words.every((w) => title.includes(w) || body.includes(w))) continue;
      // Title matches first, then by chapter order.
      const score = words.every((w) => title.includes(w)) ? 0 : 1;
      let snippet = '';
      if (e.met && score) {
        const text = `${e.lore || ''} ${e.source || ''}`;
        const i = fold(text).indexOf(words[0]);
        if (i >= 0) {
          // About forty characters either side, cut at word boundaries.
          let from = Math.max(0, i - 40);
          if (from > 0) { const sp = text.indexOf(' ', from); from = sp >= 0 && sp < i ? sp + 1 : from; }
          let to = Math.min(text.length, i + 80);
          if (to < text.length) { const sp = text.lastIndexOf(' ', to); to = sp > i ? sp : to; }
          snippet = (from > 0 ? '…' : '') + text.slice(from, to).trim() + (to < text.length ? '…' : '');
        }
      }
      out.push({ chapter: ch.key, chapterTitle: ch.title, chapterIcon: ch.icon || '📜', id: e.id, title: e.title, icon: e.icon || '', tier: e.tier, met: !!e.met, snippet, score });
    }
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit);
}
