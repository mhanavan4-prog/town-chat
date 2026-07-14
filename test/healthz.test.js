// Deploy health check (Tier 3.2) - /healthz is what Render pings to gate each
// deploy. Verifies it returns 200 with a healthy body.
process.env.PORT = '0';
process.env.DATA_DIR = require('os').tmpdir() + '/tc-healthz-' + process.pid;
const http = require('http');

let pass = 0, fail = 0;
function check(name, cond) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name); } }

function get(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
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

    const r = await get(port, '/healthz');
    check('/healthz returns 200', r.status === 200);
    let j = {};
    try { j = JSON.parse(r.body); } catch (_e) {}
    check('/healthz body is ok:true', j.ok === true);
    check('/healthz reports a numeric player count', typeof j.players === 'number');
    check('/healthz names the store (sqlite|json)', j.store === 'sqlite' || j.store === 'json');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  } catch (e) {
    console.log('FAIL - unexpected error:', e && e.message);
    process.exit(1);
  }
})();
