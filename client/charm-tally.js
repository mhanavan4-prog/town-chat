// ---------------------------------------------------------------------------
// The Charm Book's tier tally: of what you have written in, how much is on
// the record, how much gathered from living custom, how much modern revival,
// and the same for the whole book, so it says plainly where its knowledge
// comes from. Pure.
// ---------------------------------------------------------------------------
const TIERS = ['record', 'folk', 'revival'];

export function tierTally(book) {
  const met = { record: 0, folk: 0, revival: 0 };
  const all = { record: 0, folk: 0, revival: 0 };
  for (const ch of (book && book.chapters) || []) {
    for (const e of ch.entries || []) {
      const t = TIERS.includes(e.tier) ? e.tier : 'folk';
      all[t] += 1;
      if (e.met) met[t] += 1;
    }
  }
  const sum = (o) => o.record + o.folk + o.revival;
  return { met, all, metTotal: sum(met), total: sum(all) };
}
