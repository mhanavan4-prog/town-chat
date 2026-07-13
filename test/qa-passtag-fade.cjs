// 🎟️ Town Pass HUD banner fade — live report: "make the town pass banner
// disappear after 6.5 seconds; it gets tiring seeing it in the way."
// Seeds a future pass into localStorage (client restores passUntil from
// tc_pass_until on load, line ~2237), joins, and watches the banner:
//   • shows on join, fully visible (not faded)
//   • ~6.5s later it has faded out of the way (.tagFaded → opacity 0)
//   • a tap peeks it back, then it fades again
// Run: node test/qa-passtag-fade.cjs   (starts its own server on :3017)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const STUB = path.join(__dirname, 'three-stub.js');
const PORT = 3017;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-qa-passtag-'));

let checks = 0, failures = 0;
const check = (desc, cond, detail) => {
  checks++;
  console.log(`  ${cond ? '✓' : '✗'} ${desc}${cond ? '' : (detail ? ' — ' + String(detail).slice(0, 200) : '')}`);
  if (!cond) failures++;
};

(async () => {
  const srv = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), DATA_DIR, PUSH_ALLOW_HTTP: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('server did not start in 8s')), 8000);
    srv.stdout.on('data', d => { if (/listening/.test(String(d))) { clearTimeout(to); res(); } });
    srv.stderr.on('data', d => process.stderr.write('[srv] ' + d));
  });

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('**/three.min.js*', r => r.fulfill({ path: STUB, contentType: 'application/javascript' }));
  // Seed a live pass (24h out) + the seen-flags BEFORE any client code runs, so
  // passUntil restores truthy and hasTownPass() is true from the first frame.
  await ctx.addInitScript(`(() => {
    try {
      localStorage.setItem('tc_pass_until', String(Date.now() + 24 * 3600 * 1000));
      localStorage.setItem('tc_controls_seen', '1');
      localStorage.setItem('tc_welcome_seen', '1');
    } catch (e) {}
  })();`);
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0, 180)));
  const td = (fn, ...args) => page.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);
  // passTag state: rendered (not .hidden), faded (.tagFaded), and live opacity.
  const tagState = () => page.evaluate(() => {
    const el = document.getElementById('passTag');
    if (!el) return { exists: false };
    return {
      exists: true,
      hidden: el.classList.contains('hidden'),
      faded: el.classList.contains('tagFaded'),
      opacity: parseFloat(getComputedStyle(el).opacity),
      text: el.textContent
    };
  });

  try {
    console.log('── Join as a guest carrying a (seeded) live pass ──');
    await page.goto(`http://localhost:${PORT}/?testdrive=1`, { waitUntil: 'networkidle' });
    await page.fill('#nameInput', 'PassPeeker');
    await page.click('#joinBtn');
    await page.waitForTimeout(1600);
    check('joined the town', !!(await td('me')));

    // give the join's refreshPassHud() a beat to run
    await page.waitForTimeout(400);
    let s = await tagState();
    check('pass banner is shown on join', s.exists && !s.hidden && /Town Pass/.test(s.text), JSON.stringify(s));
    check('pass banner starts fully visible (not faded)', !s.faded && s.opacity > 0.9, JSON.stringify(s));

    console.log('── Wait past the 6.5s fade window ──');
    await page.waitForTimeout(7200);
    s = await tagState();
    check('pass banner has faded out of the way after ~6.5s', s.faded && s.opacity < 0.05, JSON.stringify(s));
    check('faded banner ignores pointer events (out of the way)', await page.evaluate(() => getComputedStyle(document.getElementById('passTag')).pointerEvents === 'none'));

    console.log('── Tap to peek, then it fades again ──');
    await page.evaluate(() => {
      const el = document.getElementById('passTag');
      // it is pointer-events:none while faded, so dispatch the click directly —
      // this is exactly the handler a tap fires once it re-shows.
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(300);
    s = await tagState();
    check('tap re-shows the banner (peek the time left)', !s.faded && s.opacity > 0.9, JSON.stringify(s));
    await page.waitForTimeout(7200);
    s = await tagState();
    check('banner fades again ~6.5s after the peek', s.faded && s.opacity < 0.05, JSON.stringify(s));
  } catch (e) {
    console.log('  ✗ HARNESS THREW — ' + (e && e.message));
    failures++;
  }

  console.log(`\nchecks: ${checks}, failures: ${failures}`);
  console.log('PAGE ERRORS: ' + (errors.length ? [...new Set(errors)].join(' | ') : 'none'));
  if (errors.length) failures++;
  await browser.close();
  srv.kill('SIGTERM');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('HARNESS FAIL', e); try { process.exit(1); } catch (_) {} });
