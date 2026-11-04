// W3 (playtest review): a Discord link site-wide + in-game. Every link points at
// /discord, which redirects to the one DISCORD_URL — so the destination lives in
// a single place. Checks the redirect, that it's a newcomer-safe invite, and that
// each public page and the in-game menu carry the link.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-discord-');
const http = require('http');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const get = (port, p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: p }, (res) => { res.resume(); resolve({ status: res.statusCode, location: res.headers.location }); }).on('error', reject);
});

require('../server.js');

(async () => {
  const server = global.__testHooks.server;
  let port = 0;
  for (let i = 0; i < 40 && !port; i++) { const a = server && server.address(); port = (a && a.port) || 0; if (!port) await new Promise((r) => setTimeout(r, 50)); }
  check('server bound a real port', port > 0);

  const r = await get(port, '/discord');
  check('/discord redirects', r.status === 302, r);
  check('…to a discord.gg invite (works for newcomers, unlike a /channels/ URL)', /^https:\/\/discord\.gg\/[A-Za-z0-9]+$/.test(r.location || ''), r.location);

  for (const page of ['landing.html', 'faq.html', 'privacy.html', 'terms.html', 'index.html']) {
    const html = fs.readFileSync(path.join(__dirname, '../public', page), 'utf8');
    check(`${page} links to /discord`, html.includes('href="/discord"'));
    check(`${page} never hardcodes the raw Discord URL`, !/discord\.(gg|com)\//.test(html));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
