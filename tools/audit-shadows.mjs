// Shadow-rig audit — walks into every building interior in a headless browser
// and checks the light that is actually casting shadows there.
//
// Shadow acne ("sawtoothing", the striping reported on the Phantom Parlor's
// floor and on the knights standing in it) scales with two things: how much
// world space one shadow-map texel covers, and how steeply the surface slopes
// away from the light. A light grazing the floor at 33 degrees over a coarse
// map stripes it no matter what bias you pick — so those are the two numbers
// this audit holds the line on, rather than eyeballing a screenshot.
//
//   node tools/audit-shadows.mjs          # every interior + outdoors
//   node tools/audit-shadows.mjs --json   # machine-readable
//
// Needs the real three.js (the smoke test's THREE stub has no lights), so it
// serves public/three.min.js from disk rather than the CDN.
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const PORT = 3262;
const asJson = process.argv.includes('--json');
const three = readFileSync(new URL('../public/three.min.js', import.meta.url));

// A caster this close to vertical leaves almost no slope for depth error to
// scale with; below it, interiors stripe.
const MIN_DOWNNESS = 0.9;
// World units per shadow-map texel. The interiors' own rig sits at ~0.25.
const MAX_TEXEL = 0.35;

const server = spawn('node', ['server.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT), DATA_DIR: mkdtempSync(join(tmpdir(), 'shadow-audit-')) },
  stdio: 'ignore',
});
await sleep(4500);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  await page.route('**/three.min.js', (r) => r.fulfill({ contentType: 'application/javascript', body: three }));
  await page.goto(`http://localhost:${PORT}/play?testdrive=1`);
  await page.waitForSelector('#joinScreen', { timeout: 20000 });
  await page.fill('#nameInput', 'ShadowAudit');
  await page.click('#joinBtn');
  await page.waitForFunction(() => window.__testDrive && window.__testDrive.me(), null, { timeout: 40000 });
  await sleep(6000);

  const outdoors = await page.evaluate(() => window.__testDrive.shadowRig());
  const ids = await page.evaluate(() => window.__testDrive.bldInfo().map((b) => b.id));
  const rooms = [];
  for (const id of ids) {
    const entered = await page.evaluate((i) => window.__testDrive.enterRoom(i), id);
    if (!entered) continue;
    // The rig is configured on the room's first render, so a room measured
    // too early reports no caster at all — which would quietly pass as an
    // "unlit room" and make this audit worthless. Wait for the scene to have
    // rendered once.
    await page.waitForFunction(() => {
      const r = window.__testDrive.shadowRig();
      return r.caster || !(r.lights || []).length;
    }, null, { timeout: 15000 }).catch(() => {});
    await sleep(600);
    rooms.push({ id, ...(await page.evaluate(() => window.__testDrive.shadowRig())) });
    await page.evaluate(() => window.__testDrive.leave());
    await sleep(700);
  }

  const faults = [];
  for (const r of rooms) {
    // A room with no directional light casts no shadows at all — fine. A room
    // that HAS one and still adopted nothing is a rig that failed to attach.
    if (!r.caster) {
      if ((r.lights || []).length) faults.push(`${r.id}: ${r.lights.length} directional light(s) but none casting — the shadow rig never attached`);
      continue;
    }
    if (r.downness < MIN_DOWNNESS) faults.push(`${r.id}: caster is slanted (downness ${r.downness}, want >= ${MIN_DOWNNESS}) — it will stripe the floor`);
    if (r.unitsPerTexel > MAX_TEXEL) faults.push(`${r.id}: ${r.unitsPerTexel} units per shadow texel (want <= ${MAX_TEXEL}) — shadow edges will stair-step`);
    const adopted = (r.lights || []).filter((l) => l.cast).length;
    if (adopted !== 1) faults.push(`${r.id}: ${adopted} lights casting shadows, expected exactly 1`);
  }

  if (asJson) {
    console.log(JSON.stringify({ outdoors, rooms, faults, errors }, null, 2));
  } else {
    const line = (r) => r.caster
      ? `straight-down ${r.downness}   ${r.unitsPerTexel} units/texel   box ${r.halfX}x${r.halfZ}   bias ${r.bias}/${r.normalBias}`
      : 'no shadow caster (unlit room)';
    console.log(`outdoors (unchanged by the interior rig): ${line(outdoors)}`);
    console.log('\n── building interiors ──');
    for (const r of rooms) console.log(`  ${r.id.padEnd(10)} ${line(r)}`);
    if (errors.length) console.log('\npage errors:', errors.slice(0, 5));
    if (faults.length) {
      console.log('');
      for (const f of faults) console.log(`  ✗ ${f}`);
    }
    console.log(faults.length || errors.length
      ? '\nFAIL — an interior is lit in a way that stripes its floor.'
      : '\nPASS — every interior casts from straight overhead at a fine enough texel.');
  }
  code = faults.length || errors.length ? 1 : 0;
} finally {
  await browser.close();
  server.kill();
}
process.exit(code);
