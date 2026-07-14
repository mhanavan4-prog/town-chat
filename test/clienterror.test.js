// Client error telemetry (Tier 3.1) — the /api/client-error endpoint that
// surfaces uncaught browser crashes (window.onerror / unhandledrejection) into
// the server logs. Verifies a valid report is accepted, a garbage body is
// coerced rather than crashing the route, and the per-IP throttle returns 429
// under a flood.
process.env.PORT = '0';
process.env.DATA_DIR = require('os').tmpdir() + '/tc-clienterror-test-' + process.pid;
require('fs').mkdirSync(process.env.DATA_DIR, { recursive: true });
const http = require('http');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS -', name); }
  else { fail++; console.log('FAIL -', name); }
}

// POST a JSON payload to /api/client-error; resolve with the HTTP status code.
function post(port, payload) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(payload));
    const req = http.request({
      host: '127.0.0.1', port, path: '/api/client-error', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

require('../server.js');

(async () => {
  try {
    const server = global.__testHooks.server;
    let port = 0;
    for (let i = 0; i < 40 && !port; i++) {
      const a = server && server.address();
      port = (a && a.port) || 0;
      if (!port) await new Promise(r => setTimeout(r, 50));
    }
    check('server bound a real port', port > 0);

    const ok = await post(port, {
      kind: 'error', message: 'boom', source: 'client.js',
      line: 42, col: 7, stack: 'at fn (client.js:42:7)', ua: 'test-agent',
    });
    check('a valid client-error report is accepted (204)', ok === 204);

    const junk = await post(port, { message: { not: 'a string' }, line: 'NaN', stack: 12345 });
    check('a garbage body is coerced, not crashed (204)', junk === 204);

    let got429 = false;
    for (let i = 0; i < 40; i++) {
      const code = await post(port, { message: 'flood ' + i });
      if (code === 429) { got429 = true; break; }
    }
    check('the per-IP throttle returns 429 under a flood', got429);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.message);
    process.exit(1);
  }
})();
