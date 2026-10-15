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
