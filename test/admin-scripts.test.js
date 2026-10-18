// Guards against a broken inline <script> in a server-rendered admin page —
// e.g. a quote mis-escaped inside a template literal so the browser can't parse
// it and the page renders blank. `node -c lib/admin.js` can't catch this (the
// script is just a string in the module); the browser smoke test only loads the
// game. Here we serve each admin page and assert its inline scripts PARSE.
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const http = require('http');
const mountAdmin = require('../lib/admin.js');

test('admin page inline scripts parse in a browser JS engine', async () => {
  const app = express();
  // The HTML page routes only res.send() a static string, so stub deps minimally.
  mountAdmin(app, {
    getAdminKey: () => '',
    audit: { clientIp: () => '0.0.0.0', hit: () => 1, log: () => {} },
    bans: { list: () => [] },
    analytics: { snapshot: () => ({ days: [], data: {} }) }
  });
  const srv = http.createServer(app);
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const get = (p) => new Promise((res, rej) => {
    http.get('http://127.0.0.1:' + port + p, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d)); }).on('error', rej);
  });
  try {
    for (const p of ['/admin', '/admin/analytics', '/admin/reports']) {
      const html = await get(p);
      const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      assert.ok(scripts.length > 0, p + ' should have an inline script');
      for (const s of scripts) {
        // new Function parses (does not run) the body — throws SyntaxError on a
        // parse error exactly like the browser would.
        assert.doesNotThrow(() => new Function(s), p + ' inline script must parse');
      }
    }
  } finally {
    srv.close();
  }
});
