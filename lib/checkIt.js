// ---------------------------------------------------------------------------
// "Check it": the works a Myth or record? verdict or a Real Shelf book points
// to, each found on the Charm Book's Sources page where the book cites it, so
// a player can go from the claim to where it comes from. A citation the book
// doesn't hold (or a pointer like "the memorial by the Town Hall") stays as
// plain text. Pure: no state.
//
// checksFor(sources, { myth, books, folk }) → { 'myth:<id>': [part], 'book:<id>':
// [part], 'folk:<id>': [part] }, a part being { text, work } (work: a Sources
// work id, or null).
// ---------------------------------------------------------------------------
const { findWork } = require('./sources');

// A source line's citations: "A (1996); B" or "A · B".
function partsOf(source) {
  return String(source || '').split(/\s*;\s*|\s+·\s+/).map((s) => s.trim()).filter(Boolean);
}
function linesOf(sources, source) {
  return partsOf(source).map((text) => { const w = findWork(sources, text); return { text, work: w ? w.id : null }; });
}

function checksFor(sources, { myth = [], books = [], folk = [] } = {}) {
  const works = (sources && sources.works) || [];
  const citing = (chapter, id) => works.filter((w) => w.entries.some((e) => e.chapter === chapter && e.id === id));
  const out = {};
  for (const q of myth) out['myth:' + q.id] = linesOf(sources, q.source);
  // A book is written into the Library chapter under its author and title; the
  // Sources page lists it there.
  for (const b of books) out['book:' + b.id] = citing('library', b.id).map((w) => ({ text: w.cite, work: w.id }));
  for (const f of folk) out['folk:' + f.id] = linesOf(sources, f.source);
  return out;
}

module.exports = { checksFor, partsOf };
