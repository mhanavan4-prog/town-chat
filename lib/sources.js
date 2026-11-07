// ---------------------------------------------------------------------------
// The Charm Book's Sources page: every work the book cites, A to Z, with the
// entries that cite it, so any claim in the game can be checked against where
// it comes from. Built from the entries' own `source` strings (works are
// separated by " · "), so it can never disagree with them.
//
// The same work is often cited with more or less detail ("O. Davies,
// Cunning-Folk (2003)" and "Owen Davies, Cunning-Folk (2003)"; "R. Scot …
// (1584), XV.12"). Those are folded together by the author's surname and the
// first year given; the page shows the plainest form, and each entry keeps its
// own page or chapter. Pure: no state.
//
// A work: { cite, sortKey, entries: [{ chapter, id, title|null, icon, met }] }.
// `title` is null for an entry the book keeps hidden until it is met (a
// caller), so the page gives nothing away.
// ---------------------------------------------------------------------------

// The citing name: text before the first comma, without any "(…)" or "; …".
function leadOf(cite) {
  return cite.split(',')[0].split(' (')[0].split(';')[0].replace(/\s+et al\.?$/, '').trim();
}

// "M. Martin" / "Martin Martin" → "martin"; "Opie & Tatem" → "opie"; but a
// paper, museum or archive ("Kelso Chronicle", "Pitt Rivers Museum 1911.32.7")
// keeps its whole name.
const PERSON = /^(?:(?:Sir|Lady|St)\s)?(?:(?:[A-Z]\.|[A-Z][A-Za-zà-ÿ'’-]+)\s)*([A-Z][A-Za-zà-ÿ'’-]+)$/;
const NOT_A_PERSON = /\b(Museum|Library|Chronicle|Packet|Monthly|Journal|Record|Records|Collection|Group|England|Archive|Survey|Dictionary|Account|Daily|Acts?|Glossary|Literature|Custom|Index|Bush|Saga|Lists|Queries|Cormaic|UK|Wales|Biography)\b/;
function nameKey(cite) {
  const lead = leadOf(cite).split(' & ')[0].trim();
  const m = !NOT_A_PERSON.test(lead) && lead.match(PERSON);
  // A body's name alone isn't one work: "Historic England, 'Discovering
  // Witches' Marks'" and "Historic England, list entry 1148581" are two. So a
  // paper, museum or archive is keyed by what follows its name, too.
  const key = m ? m[1] : cite.split(',').slice(0, 2).join(',').split(' (')[0].trim();
  return key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// The year of the work: the first one in brackets ("A Tour in Scotland, 1769
// (1771)" is 1771), else the first anywhere. Four-figure years only, except a
// three-figure one that is plainly a date: "c. 950", "AD 200", "423 BC", or
// a bare "(725)"; so "p. 161" and "Cod. 136" are not years.
const YEAR4 = /\b(1\d{3}|20\d{2})\b/;
const YEAR3 = /(?:\bc\.\s*|\bAD\s*)(\d{3})\b|^(\d{3})$|\b(\d{3})\s*BC\b/;
function yearIn(text) {
  const m = text.match(YEAR4);
  if (m) return m[1];
  const n = text.match(YEAR3);
  return n ? (n[1] || n[2] || n[3]) : '';
}
function firstYear(cite) {
  for (const b of cite.match(/\(([^)]*)\)/g) || []) { const y = yearIn(b.slice(1, -1).trim()); if (y) return y; }
  return yearIn(cite);
}

// For a person's work: the surname, and the title's first words ("Notes on the
// Folk-Lore of the Northern Counties (1879)" and "… of England and the Borders
// (1866; 1879 ed.)" are one book). A title starts with a capital or a quote;
// "A. Carmichael, notes" has none.
function personOf(cite) {
  const lead = leadOf(cite).split(' & ')[0].trim();
  const m = !NOT_A_PERSON.test(lead) && lead.match(PERSON);
  return m ? m[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : null;
}
function titleOf(cite) {
  const seg = (cite.split(',')[1] || '').trim();
  if (!/^[A-Z"'“‘]/.test(seg)) return '';
  return seg.split(' (')[0].replace(/["'“”‘’]/g, '').toLowerCase().replace(/^(the|a|an)\s+/, '').split(/\s+/).slice(0, 4).join(' ');
}

function worksOf(source) {
  return String(source || '').split(' · ').map((s) => s.trim()).filter(Boolean);
}

// Every citation string, with the entries that give it; then citations of the
// same work are joined: a person's by surname and year, or surname and title
// (so editions and volumes fold together); a paper, museum or archive by its
// name and document; and a person's citation with neither year nor title joins
// the one work of theirs, if there is exactly one.
function buildSources(chapters) {
  const uncited = [];
  const cites = new Map(); // cite -> { cite, entries: Map(chapter:id -> entry) }
  for (const ch of chapters || []) {
    for (const e of ch.entries || []) {
      const works = worksOf(e.source);
      if (!works.length) { if (!uncited.includes(ch.key)) uncited.push(ch.key); continue; }
      const hidden = ch.showNames === false && !e.met;
      for (const cite of works) {
        if (!cites.has(cite)) cites.set(cite, { cite, entries: new Map() });
        cites.get(cite).entries.set(ch.key + ':' + e.id, { chapter: ch.key, id: e.id, title: hidden ? null : e.title, icon: hidden ? null : (e.icon || null), met: !!e.met });
      }
    }
  }
  const nodes = [...cites.values()];
  const parent = nodes.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { parent[find(a)] = find(b); };
  const byKey = new Map();
  const loose = [];
  nodes.forEach((n, i) => {
    const person = personOf(n.cite);
    n.name = person || nameKey(n.cite);
    n.year = firstYear(n.cite);
    const keys = [];
    if (!person) keys.push('np:' + n.name);
    else {
      if (n.year) keys.push(`p:${person}|y:${n.year}`);
      const t = titleOf(n.cite);
      if (t) keys.push(`p:${person}|t:${t}`);
      if (!keys.length) loose.push(i);
    }
    for (const k of keys) { if (byKey.has(k)) union(i, byKey.get(k)); else byKey.set(k, i); }
  });
  for (const i of loose) {
    const groups = new Set(nodes.map((n, j) => (!loose.includes(j) && n.name === nodes[i].name ? find(j) : null)).filter((x) => x !== null));
    if (groups.size === 1) union(i, [...groups][0]);
  }
  const groups = new Map();
  nodes.forEach((n, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(n); });
  const works = [...groups.values()].map((ns) => {
    const dated = ns.filter((n) => n.year);
    const head = (dated.length ? dated : ns).slice().sort((a, b) => a.cite.length - b.cite.length)[0];
    const years = dated.map((n) => n.year).sort((a, b) => a.length - b.length || a.localeCompare(b));
    const entries = new Map();
    for (const n of ns) for (const [k, e] of n.entries) if (!entries.has(k)) entries.set(k, e);
    return { cite: head.cite, sortKey: head.name + '|' + (years[0] || ''), entries: [...entries.values()] };
  }).sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'en', { sensitivity: 'base' }));
  const note = uncited.map((k) => (chapters.find((c) => c.key === k) || {}).title).filter(Boolean);
  return { works, uncitedChapters: uncited, note: note.length ? `${note.join(' and ')} give${note.length === 1 ? 's' : ''} ${note.length === 1 ? 'its' : 'their'} sources once, in the chapter's note.` : '' };
}

module.exports = { buildSources, worksOf, nameKey, firstYear, personOf, titleOf };
