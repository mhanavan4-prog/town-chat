// Self-serve account deletion (/api/delete-account). Exercises the endpoint
// end to end against a live server: password gating, full purge of per-account
// stores, leaderboard scrub, and coven leadership transfer vs. disband.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-del-');
delete process.env.RESEND_API_KEY;
const http = require('http');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }

function post(port, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request({ host: '127.0.0.1', port, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let b = ''; res.on('data', (d) => { b += d; });
      res.on('end', () => { let j = {}; try { j = JSON.parse(b); } catch (_e) {} resolve({ status: res.statusCode, j }); });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

require('../server.js');

(async () => {
  try {
    const h = global.__testHooks;
    const server = h.server;
    let port = 0;
    for (let i = 0; i < 40 && !port; i++) { const a = server && server.address(); port = (a && a.port) || 0; if (!port) await new Promise(r => setTimeout(r, 50)); }
    check('server bound a real port', port > 0);

    // Two accounts who will share a coven.
    let r = await post(port, '/api/register', { username: 'alice', password: 'abcd', over18: true });
    const aliceTok = r.j.token;
    check('alice registered', r.status === 200 && aliceTok);
    r = await post(port, '/api/register', { username: 'bob', password: 'abcd', over18: true });
    const bobTok = r.j.token;
    check('bob registered', r.status === 200 && bobTok);

    // Put them in a coven, alice leading. (Founding needs gold/WS; seed directly.)
    h.covens.c1 = { id: 'c1', name: 'Test Circle', nameLower: 'test circle', sigil: '🌙',
      createdAt: Date.now(), leaderKey: 'alice', members: ['alice', 'bob'], motd: '',
      bank: { gold: 0, slots: [] }, honors: [], paidThroughAt: Date.now() + 1e9,
      manorBedrooms: { '1': 'alice', '2': 'bob' } };
    h.covenIndex.set('alice', 'c1'); h.covenIndex.set('bob', 'c1');

    // Seed a spread of alice's data across stores.
    h.lbBump('hunt', { accountKey: 'alice', name: 'alice' }, 100);
    h.lbBump('hunt', { accountKey: 'bob', name: 'bob' }, 50);
    h.townPasses.alice = Date.now() + 1e9;
    h.msData.balances.alice = 25;
    h.inventories.alice = { slots: [] };
    h.listings.push({ id: 'L1', sellerKey: 'alice', itemId: 'x', qty: 1, source: 'inventory' });
    const wk = h.weekKey(Date.now());

    // ── Wrong password is rejected, nothing deleted ──
    r = await post(port, '/api/delete-account', { token: aliceTok, password: 'nope' });
    check('wrong password -> 403', r.status === 403, r);
    check('account survives a bad password', !!h.accounts.alice);

    // ── Missing/!token -> 401 ──
    r = await post(port, '/api/delete-account', { token: 'garbage', password: 'abcd' });
    check('bad token -> 401', r.status === 401);

    // ── Correct password deletes alice (the leader) ──
    r = await post(port, '/api/delete-account', { token: aliceTok, password: 'abcd' });
    check('delete-account -> 200', r.status === 200 && r.j.ok === true, r);
    check('account record gone', !h.accounts.alice);
    check('session burned', h.sessions.get(aliceTok) === undefined);
    check('townPass purged', !h.townPasses.alice);
    check('moonstone balance purged', !h.msData.balances.alice);
    check('inventory purged', !h.inventories.alice);
    check('listing cancelled', !h.listings.some((l) => l.sellerKey === 'alice'));
    check('leaderboard entry scrubbed', !(h.leaderboards[wk] && h.leaderboards[wk].hunt && h.leaderboards[wk].hunt.alice));
    check("survivor bob's leaderboard entry intact", !!(h.leaderboards[wk] && h.leaderboards[wk].hunt && h.leaderboards[wk].hunt.bob));

    // Coven kept, leadership handed to bob, alice's bedroom freed.
    check('coven still exists', !!h.covens.c1);
    check('leadership transferred to bob', h.covens.c1 && h.covens.c1.leaderKey === 'bob');
    check('alice removed from members', h.covens.c1 && !h.covens.c1.members.includes('alice'));
    check('alice bedroom freed', h.covens.c1 && !Object.values(h.covens.c1.manorBedrooms).includes('alice'));
    check('covenIndex cleared for alice', h.covenIndex.get('alice') === undefined);

    // ── Deleting the last member disbands the coven ──
    r = await post(port, '/api/delete-account', { token: bobTok, password: 'abcd' });
    check('delete sole remaining member -> 200', r.status === 200 && r.j.ok === true, r);
    check('coven disbanded when last member leaves', !h.covens.c1);
    check('bob account gone', !h.accounts.bob);

    // A deleted account cannot be used to re-authenticate.
    r = await post(port, '/api/characters', { token: aliceTok });
    check('deleted token no longer authenticates', r.status === 401);

    // A freed username can be registered again.
    r = await post(port, '/api/register', { username: 'alice', password: 'wxyz', over18: true });
    check('deleted username is available again', r.status === 200 && r.j.token);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
