// Password reset + email recovery (Session N). Exercises the HTTP endpoints
// end to end against a live server, plus the mailer module's safe-when-unconfigured
// behavior. Mail isn't actually sent (no RESEND_API_KEY), so redemption is tested
// by inserting a known token into the (test-exposed) reset store.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-reset-');
delete process.env.RESEND_API_KEY; // force the mailer into no-op mode for this run
const http = require('http');
const crypto = require('crypto');

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
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

require('../server.js');

(async () => {
  try {
    const hooks = global.__testHooks;
    const server = hooks.server;
    let port = 0;
    for (let i = 0; i < 40 && !port; i++) { const a = server && server.address(); port = (a && a.port) || 0; if (!port) await new Promise(r => setTimeout(r, 50)); }
    check('server bound a real port', port > 0);

    // ── Register with an optional email ───────────────────────────────────
    let r = await post(port, '/api/register', { username: 'alice', password: 'abcd', over18: true, email: 'Alice@Example.com' });
    check('register with email succeeds', r.status === 200 && r.j.token, r);
    check('email is stored lowercased on the account', hooks.accounts.alice && hooks.accounts.alice.email === 'alice@example.com');

    // Register requiring over18 still enforced, email still optional.
    r = await post(port, '/api/register', { username: 'bob', password: 'abcd', over18: true });
    check('register without email still works', r.status === 200 && r.j.token);
    const bobToken = r.j.token;
    check('no-email account has email null', hooks.accounts.bob && hooks.accounts.bob.email === null);

    // ── request-reset: enumeration-safe, creates a token only when matchable ─
    const before = Object.keys(hooks.passwordResets).length;
    r = await post(port, '/api/request-reset', { usernameOrEmail: 'alice' });
    check('request-reset returns ok for a real user', r.status === 200 && r.j.ok === true);
    check('request-reset created one reset token', Object.keys(hooks.passwordResets).length === before + 1);

    r = await post(port, '/api/request-reset', { usernameOrEmail: 'ghost-who-does-not-exist' });
    check('request-reset returns ok for an unknown user (no enumeration)', r.status === 200 && r.j.ok === true);
    check('no token created for an unknown user', Object.keys(hooks.passwordResets).length === before + 1);

    r = await post(port, '/api/request-reset', { usernameOrEmail: 'bob' });
    check('request-reset for a user with no email on file creates no token', Object.keys(hooks.passwordResets).length === before + 1);

    // ── reset-password: redeem a known token ─────────────────────────────
    const TOKEN = 'known-test-token-123';
    hooks.passwordResets[sha256(TOKEN)] = { key: 'alice', expiresAt: Date.now() + 3600000, createdAt: Date.now() };
    r = await post(port, '/api/reset-password', { token: 'nope', newPassword: 'whatever' });
    check('reset with a bad token is rejected', r.status === 400);
    r = await post(port, '/api/reset-password', { token: TOKEN, newPassword: 'ab' });
    check('reset rejects too-short passwords', r.status === 400);
    r = await post(port, '/api/reset-password', { token: TOKEN, newPassword: 'brandnew' });
    check('reset with a valid token succeeds', r.status === 200 && r.j.ok === true, r);

    // New password works, old one doesn't.
    r = await post(port, '/api/login', { username: 'alice', password: 'brandnew' });
    check('login works with the new password', r.status === 200 && r.j.token);
    r = await post(port, '/api/login', { username: 'alice', password: 'abcd' });
    check('old password no longer works', r.status === 401);

    // Single-use: the token is burned.
    r = await post(port, '/api/reset-password', { token: TOKEN, newPassword: 'thirdtime' });
    check('a reset token cannot be reused', r.status === 400);

    // Expired token is rejected.
    const EXP = 'expired-token';
    hooks.passwordResets[sha256(EXP)] = { key: 'alice', expiresAt: Date.now() - 1000 };
    r = await post(port, '/api/reset-password', { token: EXP, newPassword: 'nope1234' });
    check('an expired reset token is rejected', r.status === 400);

    // ── set-email: add/change on your own account ────────────────────────
    r = await post(port, '/api/set-email', { token: bobToken, email: 'bob@example.com' });
    check('set-email adds an email with a valid session', r.status === 200 && r.j.email === 'bob@example.com');
    check('the account now carries the email', hooks.accounts.bob.email === 'bob@example.com');
    r = await post(port, '/api/set-email', { token: bobToken, email: 'not-an-email' });
    check('set-email rejects an invalid address', r.status === 400);
    r = await post(port, '/api/set-email', { token: 'bogus-session', email: 'x@y.com' });
    check('set-email needs a real session', r.status === 401);

    // ── mailer module: safe when unconfigured ────────────────────────────
    const mailer = require('../lib/mailer')({});
    check('mailer is disabled without config', mailer.enabled === false);
    const sent = await mailer.send({ to: 'a@b.com', subject: 'hi' });
    check('sending with an unconfigured mailer is a no-op', sent.ok === false && sent.skipped === true);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.stack || e);
    process.exit(1);
  }
})();
