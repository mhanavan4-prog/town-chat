// Class showcase (Session N): the /class/:id pages + /api/class/:id JSON that
// drive the per-class 3D showcase, and the data/classShowcase.js module behind
// them. Boots the server and hits the real routes.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-classshow-');
const http = require('http');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

// GET a path; resolve { status, body, type }.
function get(port, p) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      let b = ''; res.on('data', (d) => b += d); res.on('end', () => resolve({ status: res.statusCode, body: b, type: res.headers['content-type'] || '', loc: res.headers.location }));
    }).on('error', reject);
  });
}

// ── Data module sanity (pure) ─────────────────────────────────────────────────
const showcase = require('../data/classShowcase');
check('six classes are defined', showcase.CLASSES.length === 6, showcase.CLASSES.length);
check('ids are 0..5 in order', showcase.CLASSES.every((c, i) => c.id === i));
let everyAbilityOk = true, everyModelExists = true;
for (const c of showcase.CLASSES) {
  if (!c.name || !c.tagline || !c.model || !Array.isArray(c.abilities) || !c.abilities.length) everyAbilityOk = false;
  for (const a of c.abilities) if (!a.icon || !a.name || !a.description) everyAbilityOk = false;
  if (!fs.existsSync(path.join(__dirname, '..', 'public', c.model))) everyModelExists = false;
}
check('every class has name/tagline/model + a non-empty ability list', everyAbilityOk);
check('every ability has icon + name + description', everyAbilityOk);
check('every referenced model file exists under public/', everyModelExists);
check('byId returns a class and null for unknown', !!showcase.byId(0) && showcase.byId(9) === null);
// Prop-culling data: the viewer hides every PROP_MESHES mesh not in a class's
// KEEP list, so the model doesn't render overlapping hand props (staff/book).
check('PROP_MESHES is exported and non-empty', Array.isArray(showcase.PROP_MESHES) && showcase.PROP_MESHES.length > 0);
check('every class carries a keep list', showcase.CLASSES.every(c => Array.isArray(c.keep)));
// ── The website's kit order matches the game's ────────────────────────────────
// The class pages show "slot 1, 2, 3…" for each kit. That order has to be the
// one the game actually gives a new player, or the site advertises a kit nobody
// gets (it drifted once: the Witch's consent-gated Open 3rd Eye was slot 1 on
// the site long after the game moved it to the end).
const { CONSENT_EFFECTS, defaultAbilityOrder } = require('../data/abilityOrder');
check('every showcase ability carries an id', showcase.CLASSES.every(c => c.abilities.every(a => typeof a.id === 'string' && a.id)));
{
  const ids = showcase.CLASSES.flatMap(c => c.abilities.map(a => c.id + ':' + a.id));
  check('ability ids are unique within each class', new Set(ids).size === ids.length);
}
// The client keeps its own copy of the rule (it can't require() CommonJS from
// the bundled ES modules), so pin the consent list the two share.
{
  const clientSrc = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
  const m = /const CONSENT_EFFECTS = new Set\(\[([^\]]*)\]\)/.exec(clientSrc);
  const clientList = m ? m[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean).sort() : null;
  check('client/main.js consent list matches data/abilityOrder.js',
    !!clientList && clientList.join() === [...CONSENT_EFFECTS].sort().join(), { clientList, shared: [...CONSENT_EFFECTS] });
}

check("the Witch keeps the staff (not the spellbook)", showcase.byId(0).keep.includes('2H_Staff') && !showcase.byId(0).keep.includes('Spellbook') && showcase.PROP_MESHES.includes('Spellbook'));

require('../server.js');

(async () => {
  try {
    const server = global.__testHooks.server;
    let port = 0;
    for (let i = 0; i < 40 && !port; i++) { const a = server && server.address(); port = (a && a.port) || 0; if (!port) await new Promise(r => setTimeout(r, 50)); }
    check('server bound a real port', port > 0);

    const page = await get(port, '/class/0');
    check('GET /class/0 serves HTML (200)', page.status === 200 && /text\/html/.test(page.type), page.status);
    check('the page carries the class OG title', /Witch — Thornreach/.test(page.body));
    check('the page fetches its data from the API', /\/api\/class\//.test(page.body));

    const api = await get(port, '/api/class/3');
    check('GET /api/class/3 returns JSON (200)', api.status === 200 && /application\/json/.test(api.type), api.status);
    const data = JSON.parse(api.body);
    check('it is the Knight with its model', data.name === 'Knight' && data.model === 'kk/Knight.glb', data.name);
    check('abilities come through with display fields', data.abilities.length > 0 && data.abilities.every(a => a.icon && a.name && a.description));
    check('the API includes prop-culling data (keep + propMeshes)', Array.isArray(data.keep) && Array.isArray(data.propMeshes) && data.propMeshes.length > 0);

    // The real thing: each class page's slot order must equal the order the
    // game hands a new player, computed from the live ability catalogs.
    {
      const h = global.__testHooks;
      const cats = Object.assign({ 0: h.SPELL_CATALOG }, h.ATTACK_CATALOGS);
      let allMatch = true;
      const diffs = [];
      for (const cls of showcase.CLASSES) {
        const cat = cats[cls.id];
        if (!cat) { allMatch = false; diffs.push({ cls: cls.id, why: 'no catalog' }); continue; }
        // The showcase lists a curated subset of the kit, so compare the shown
        // abilities in the order the game would place them.
        const want = defaultAbilityOrder(cat).filter((id) => cls.abilities.some((a) => a.id === id));
        const got = cls.abilities.map((a) => a.id);
        const unknown = got.filter((id) => !cat[id]);
        if (unknown.length) { allMatch = false; diffs.push({ cls: cls.id, unknown }); continue; }
        if (want.join() !== got.join()) { allMatch = false; diffs.push({ cls: cls.id, want, got }); }
      }
      check('every class page lists its kit in the order the game gives it', allMatch, diffs);
      // A consent ability (camera / rough location) is opt-in, never the
      // headline — it must never be slot 1 on a class page.
      const leadsWithConsent = showcase.CLASSES.filter((cls) => {
        const cat = cats[cls.id]; const first = cls.abilities[0];
        return cat && first && cat[first.id] && CONSENT_EFFECTS.has(cat[first.id].effect);
      }).map((c) => c.key);
      check('no class page leads with a consent-gated ability', leadsWithConsent.length === 0, leadsWithConsent);
    }

    const bad = await get(port, '/api/class/9');
    check('GET /api/class/9 (unknown) is a 404', bad.status === 404, bad.status);

    const redir = await get(port, '/class/42');
    check('GET /class/42 (unknown) redirects to the landing page', redir.status === 302 && redir.loc === '/', redir.status + ' ' + redir.loc);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.message);
    process.exit(1);
  }
})();
