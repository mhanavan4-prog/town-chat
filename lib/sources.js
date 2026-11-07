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
// (1771)" is 1771), else the first anywhere.
const YEAR = /\b(1\d{3}|20\d{2}|\d{3})\b/;
function firstYear(cite) {
  const inBrackets = (cite.match(/\(([^)]*)\)/g) || []).map((b) => b.match(YEAR)).find(Boolean);
  const m = inBrackets || cite.match(YEAR);
  return m ? m[1] : '';
}

function worksOf(source) {
  return String(source || '').split(' · ').map((s) => s.trim()).filter(Boolean);
}

function buildSources(chapters) {
  const byKey = new Map();
  const uncited = [];
  for (const ch of chapters || []) {
    for (const e of ch.entries || []) {
      const works = worksOf(e.source);
      if (!works.length) { if (!uncited.includes(ch.key)) uncited.push(ch.key); continue; }
      const seen = new Set();
      for (const cite of works) {
        const key = nameKey(cite) + '|' + firstYear(cite);
        if (seen.has(key)) continue; // one entry citing two parts of one work counts once
        seen.add(key);
        let w = byKey.get(key);
        if (!w) { w = { cite, sortKey: key, entries: [] }; byKey.set(key, w); }
        if (cite.length < w.cite.length) w.cite = cite; // the plainest form heads it
        const hidden = ch.showNames === false && !e.met;
        w.entries.push({ chapter: ch.key, id: e.id, title: hidden ? null : e.title, icon: hidden ? null : (e.icon || null), met: !!e.met });
      }
    }
  }
  // A citation with no year ("A. Carmichael, notes") joins the one dated work
  // by the same name, if there is exactly one.
  for (const [key, w] of [...byKey]) {
    if (!key.endsWith('|')) continue;
    const name = key.slice(0, -1);
    const dated = [...byKey.entries()].filter(([k]) => k !== key && k.startsWith(name + '|'));
    if (dated.length !== 1) continue;
    const into = dated[0][1];
    for (const e of w.entries) if (!into.entries.some((x) => x.chapter === e.chapter && x.id === e.id)) into.entries.push(e);
    byKey.delete(key);
  }
  const works = [...byKey.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'en', { sensitivity: 'base' }));
  const note = uncited.map((k) => (chapters.find((c) => c.key === k) || {}).title).filter(Boolean);
  return { works, uncitedChapters: uncited, note: note.length ? `${note.join(' and ')} give${note.length === 1 ? 's' : ''} ${note.length === 1 ? 'its' : 'their'} sources once, in the chapter's note.` : '' };
}

module.exports = { buildSources, worksOf, nameKey, firstYear };
