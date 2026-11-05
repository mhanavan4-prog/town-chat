// Collider audit — walks the real town map in a headless browser and reports
// any collider that has NO visible geometry standing in it: an invisible
// obstacle. Also reports Wilds colliders that have leaked into the town list
// (see refitBuildingColliders), the class of bug behind two playtest reports.
//
//   node tools/audit-colliders.mjs          # town + Wilds
//   node tools/audit-colliders.mjs --json   # machine-readable
//
// Needs the real three.js (the smoke test's THREE stub has no geometry), so it
// serves public/three.min.js from disk rather than the CDN.
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const PORT = 3261;
const asJson = process.argv.includes('--json');
const three = readFileSync(new URL('../public/three.min.js', import.meta.url));

const server = spawn('node', ['server.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT), DATA_DIR: mkdtempSync(join(tmpdir(), 'collider-audit-')) },
  stdio: 'ignore',
});
await sleep(4500);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  await page.route('**/three.min.js', (r) => r.fulfill({ contentType: 'application/javascript', body: three }));
  await page.goto(`http://localhost:${PORT}/play?testdrive=1`);
  await page.waitForSelector('#joinScreen', { timeout: 20000 });
  await page.fill('#nameInput', 'ColliderAudit');
  await page.click('#joinBtn');
  await page.waitForFunction(() => window.__testDrive && window.__testDrive.me(), null, { timeout: 40000 });
  // The KayKit buildings + decor stream in and the collision refit runs once
  // both have settled — audit only after that.
  await sleep(20000);

  // Prove the detector still works before trusting a clean report: drop a
  // collider in open ground and require the audit to flag it.
  await page.evaluate(() => window.__testDrive.probeCollider(true));
  const probe = await page.evaluate(() => window.__testDrive.auditColliders());
  await page.evaluate(() => window.__testDrive.probeCollider(false));
  const probeWorks = probe.invisible.some((r) => r.x === 1700 && r.y === 1150);

  const fresh = await page.evaluate(() => window.__testDrive.auditColliders());
  // Then force the cold-load race that caused the leak (a refit that lands
  // while the player is out in the Wilds) and audit again.
  await page.evaluate(() => window.__testDrive.refitWhileIn('wilds'));
  const afterRace = await page.evaluate(() => window.__testDrive.auditColliders());
  const wilds = await page.evaluate(() => window.__testDrive.auditColliders('wilds'));

  const bad = fresh.invisible.length + afterRace.invisible.length + wilds.invisible.length
    + fresh.wildsLeak + afterRace.wildsLeak + errors.length + (probeWorks ? 0 : 1);
  if (asJson) {
    console.log(JSON.stringify({ probeWorks, fresh, afterRace, wilds, errors }, null, 2));
  } else {
    console.log(probeWorks
      ? 'self-check: the audit detects a planted invisible collider ✓'
      : 'self-check FAILED: a planted invisible collider was NOT detected — this audit proves nothing.');
    for (const [label, a] of [['town, fresh load', fresh], ['town, after a refit while in the Wilds', afterRace], ['the Wilds', wilds]]) {
      console.log(`\n── ${label} ──`);
      console.log(`  colliders: ${a.townWalls}   visible meshes checked: ${a.meshes}`);
      if (a.map === 'town') console.log(`  Wilds colliders leaked into town: ${a.wildsLeak}`);
      console.log(`  colliders with nothing visible in them: ${a.invisible.length}`);
      for (const r of a.invisible) console.log(`    - ${r.w}x${r.h} at (${r.x}, ${r.y})${r.wilds ? ' [from the Wilds]' : ''}`);
    }
    if (errors.length) console.log('\npage errors:', errors.slice(0, 5));
    console.log(bad ? '\nFAIL — invisible obstacles found.' : '\nPASS — every collider on both maps has visible geometry.');
  }
  code = bad ? 1 : 0;
} finally {
  await browser.close();
  server.kill();
}
process.exit(code);
