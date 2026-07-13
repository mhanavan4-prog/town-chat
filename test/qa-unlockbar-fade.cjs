// 🔒 Parlor/Arcade upsell bar fade — live report: "the banner that says the
// ghost parlor & arcade take a town pass should also fade away." The #unlockBar
// is a desktop-only pill (it's display:none in touchMode); it used to sit up
// the whole time you lacked a pass. Now refreshUnlockUI announces it once, then
// fades it after 6.5s (the day pass stays in the ☰ menu + Cafe statue).
// A dummy STRIPE_SECRET_KEY makes the server report paymentsEnabled:true so the
// bar shows (no API call is made — the key is never charged against).
// Run: node test/qa-unlockbar-fade.cjs   (starts its own server on :3019)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const STUB = path.join(__dirname, 'three-stub.js');
const PORT = 3019;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-qa-unlockbar-'));

let checks = 0, failures = 0;
const check = (desc, cond, detail) => {
  checks++;
  console.log(`  ${cond ? '✓' : '✗'} ${desc}${cond ? '' : (detail ? ' — ' + String(detail).slice(0, 200) : '')}`);
  if (!cond) failures++;
};

(async () => {
  const srv = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), DATA_DIR, PUSH_ALLOW_HTTP: '1', STRIPE_SECRET_KEY: 'sk_test_dummy_qa_unlockbar' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('server did not start in 8s')), 8000);
    srv.stdout.on('data', d => { if (/listening/.test(String(d))) { clearTimeout(to); res(); } });
    srv.stderr.on('data', d => process.stderr.write('[srv] ' + d));
  });

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // DESKTOP context (no isMobile/hasTouch) → not touchMode → #unlockBar renders.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('**/three.min.js*', r => r.fulfill({ path: STUB, contentType: 'application/javascript' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0, 180)));
  const td = (fn, ...args) => page.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);
  const barState = () => page.evaluate(() => {
    const el = document.getElementById('unlockBar');
    const inner = document.getElementById('unlockInner');
    if (!el) return { exists: false };
    return {
      exists: true,
      hidden: el.classList.contains('hidden'),
      faded: el.classList.contains('tagFaded'),
      opacity: parseFloat(getComputedStyle(el).opacity),
      innerPointer: inner ? getComputedStyle(inner).pointerEvents : null,
      text: el.textContent.replace(/\s+/g, ' ').trim()
    };
  });

  try {
    console.log('── Join (guest, no pass) on desktop ──');
    await page.goto(`http://localhost:${PORT}/?testdrive=1`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.setItem('tc_controls_seen', '1'); localStorage.setItem('tc_welcome_seen', '1'); });
    await page.fill('#nameInput', 'PassBrowser');
    await page.click('#joinBtn');
    await page.waitForTimeout(1600);
    check('joined the town', !!(await td('me')));
    check('not in touchMode (desktop — the bar is meant to show here)', await page.evaluate(() => !document.body.classList.contains('touchMode')));

    await page.waitForTimeout(400);
    let s = await barState();
    check('upsell bar shows on join', s.exists && !s.hidden && /Town Pass/.test(s.text), JSON.stringify(s));
    check('upsell bar starts fully visible (not faded)', !s.faded && s.opacity > 0.9, JSON.stringify(s));
    check('its day-pass button is tappable while shown', s.innerPointer === 'auto', 'pointer=' + s.innerPointer);

    console.log('── Wait past the 6.5s fade window ──');
    await page.waitForTimeout(7200);
    s = await barState();
    check('upsell bar has faded out of the way after ~6.5s', s.faded && s.opacity < 0.05, JSON.stringify(s));
    check('faded bar drops pointer events (no phantom buy taps)', s.innerPointer === 'none', 'pointer=' + s.innerPointer);
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
