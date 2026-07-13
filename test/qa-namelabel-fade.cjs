// 🏷️ Mobile NPC name-label fade — live report: "on mobile, Torchkeeper Ada
// has a persistent banner; make it fade away like the others." On touch, the
// floating name labels are shown by proximity and used to stay up the whole
// time you were near a character. Now they announce on approach and fade after
// NAME_SHOW_MS (6.5s). This drives the real client on a phone viewport:
//   • walk up to a name label → it shows at full opacity
//   • keep standing there → ~6.5s later it has faded out of the way
//   • step away and back → it announces again
// Run: node test/qa-namelabel-fade.cjs   (starts its own server on :3018)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const STUB = path.join(__dirname, 'three-stub.js');
const PORT = 3018;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-qa-namelabel-'));

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
  // isMobile/hasTouch → isTouchDevice() true → NAME_HOVER_ENABLED false → the
  // proximity+fade branch under test.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('**/three.min.js*', r => r.fulfill({ path: STUB, contentType: 'application/javascript' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0, 180)));
  const td = (fn, ...args) => page.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);

  try {
    console.log('── Join (guest) on a phone viewport ──');
    await page.goto(`http://localhost:${PORT}/?testdrive=1`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.setItem('tc_controls_seen', '1'); localStorage.setItem('tc_welcome_seen', '1'); });
    await page.fill('#nameInput', 'LabelWalker');
    await page.click('#joinBtn');
    await page.waitForTimeout(1600);
    check('joined the town', !!(await td('me')));

    // Find a name label in the active scene and walk onto its spot.
    const labels = await td('nameLabels');
    check('there are name labels in the scene', Array.isArray(labels) && labels.length > 0, 'count=' + (labels && labels.length));
    const target = (labels || [])[0];
    if (!target) throw new Error('no name label to approach');

    console.log('── Approach the label — it should announce (full opacity) ──');
    // teleport(x, y) maps to me.x/me.y; the label world .z lines up with me.y.
    await td('teleport', target.x, target.z);
    await page.waitForTimeout(500); // let a couple RAF frames run updateNameLabelHover
    let near = await td('nameLabels');
    const shown = near.filter(l => l.visible && l.op > 0.9);
    check('a name label shows at full opacity on approach', shown.length >= 1, JSON.stringify(near.slice(0, 4)));

    console.log('── Keep standing there past the 6.5s window ──');
    await page.waitForTimeout(7200);
    // stay put — nudge the clock by re-reading; updateNameLabelHover runs each frame
    let after = await td('nameLabels');
    const stillFullyShown = after.filter(l => l.visible && l.op > 0.9);
    check('the label has faded out of the way after ~6.5s', stillFullyShown.length === 0, JSON.stringify(after.slice(0, 4)));
    const anyFadedOrHidden = after.every(l => !l.visible || l.op < 0.2);
    check('every nearby label is faded/hidden, none left lingering', anyFadedOrHidden, JSON.stringify(after.slice(0, 4)));

    console.log('── Step away, then back — it announces again ──');
    await td('teleport', target.x + 1200, target.z + 1200); // well out of the 190u range
    await page.waitForTimeout(500);
    await td('teleport', target.x, target.z);              // re-approach
    await page.waitForTimeout(500);
    const reshown = (await td('nameLabels')).filter(l => l.visible && l.op > 0.9);
    check('re-approaching re-announces the label', reshown.length >= 1, JSON.stringify(reshown.slice(0, 3)));
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
