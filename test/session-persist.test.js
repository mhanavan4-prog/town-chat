// Regression guard for the "my level reset after the update" bug.
//
// Session tokens (token -> account) used to live only in an in-memory Map, so
// every server restart silently invalidated every login: a client's stored
// token resolved to no account on the fresh process, the player was dropped
// into a brand-new level-1 guest, and their real character sat unreachable in
// the DB. Tokens are now persisted. This proves a freshly minted token is
// written to the persistent store and is still resolvable by a brand-new
// persistence instance pointed at the same data dir (i.e. "after a restart").
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');

const DATA_DIR = fs.mkdtempSync(os.tmpdir() + '/tc-session-persist-');
const PORT = 38217;
process.env.DATA_DIR = DATA_DIR;
process.env.PORT = String(PORT);

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function post(path, body) {
  return new Promise((resolve, reject) => {
    const d = JSON.stringify(body);
    const req = http.request(
      { host: 'localhost', port: PORT, path, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(d) } },
      (rp) => { let b = ''; rp.on('data', c => b += c); rp.on('end', () => resolve({ status: rp.statusCode, body: b ? JSON.parse(b) : null })); }
    );
    req.on('error', reject); req.write(d); req.end();
  });
}

require('../server.js');

setTimeout(async () => {
  try {
    const reg = await post('/api/register', { username: 'LevelEight', password: 'bones1234', over18: true });
    check('register succeeds', reg.status === 200, reg.status);
    const token = reg.body && reg.body.token;
    check('register returns a token', !!token);

    // Same process: the token resolves to the account.
    const chars = await post('/api/characters', { token });
    check('token resolves in the running process', chars.status === 200, chars.status);

    // Simulate a restart: a brand-new persistence instance on the same data
    // dir must still see the token -> account mapping (what the old in-memory
    // Map lost on every deploy).
    const persistence = require('../lib/persistence')({ dataDir: DATA_DIR, reportError() {} });
    const loaded = persistence.persistLoad('sessions', DATA_DIR + '/sessions.json') || {};
    const rec = loaded[token];
    check('token is in the persisted store after a "restart"', !!rec);
    check('persisted token maps to the account key', rec && rec.k === 'leveleight', rec);
  } catch (e) {
    check('test ran without throwing', false, String(e));
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 500);
