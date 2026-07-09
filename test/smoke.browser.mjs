// Headless-browser smoke test. The sandbox this runs in cannot reach the
// three.js CDN, so a Proxy-based auto-stub is served in its place — enough
// for client.js to boot, join, and drive its real UI/WebSocket logic (the
// 3D output itself isn't under test). Run: node test/smoke.browser.mjs
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const PORT = 3123;

// A singleton THREE stub: one proxy that returns itself for every get/
// call/construct (flat memory no matter how many meshes the scene builds).
// 'parent' must be null (scene-root walks would otherwise never terminate)
// and 'children'/'length' must be real empties so iteration is finite.
const THREE_STUB = `
(() => {
  const fn = function () {};
  fn.__stubChildren = [];
  const P = new Proxy(fn, {
    get(t, p) {
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === Symbol.iterator) return function* () {};
      if (p === 'children') return t.__stubChildren;
      if (p === 'parent') return null;
      if (p === 'length') return 0;
      return P;
    },
    set() { return true; },
    apply() { return P; },
    construct() { return P; }
  });
  window.THREE = P;
})();
`;

let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!cond) failures++;
}

const server = spawn('node', ['server.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore'
});
await sleep(1200);

const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
try {
  const CASES = [
    { charId: 0, name: 'HexSmoke',    spellbook: true,  attacks: false, storyTitle: 'The Fifth Hand' },
    { charId: 2, name: 'MistSmoke',   spellbook: false, attacks: true,  storyTitle: 'Voices Beneath the Floorboards', panelTitle: '🕯️ Mystic Rites' },
    { charId: 3, name: 'KnightSmoke', spellbook: false, attacks: true,  storyTitle: 'The Hollow Oath', panelTitle: '⚔️ Knightly Arts' }
  ];

  for (const c of CASES) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/three.min.js', route => route.fulfill({ contentType: 'application/javascript', body: THREE_STUB }));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#joinScreen', { timeout: 5000 });

    // Pick the character, type a name, join.
    await page.evaluate((idx) => {
      const opts = document.querySelectorAll('.charOption');
      if (opts[idx]) opts[idx].click();
    }, c.charId);
    await page.fill('#nameInput', c.name);
    await page.click('#joinBtn');
    await page.waitForSelector('#hud:not(.hidden)', { timeout: 5000 });

    check(`[char ${c.charId}] joins and reaches the HUD`, true);
    check(`[char ${c.charId}] Journal button is visible`,
      await page.$eval('#journalBtn', el => !el.classList.contains('hidden')));
    check(`[char ${c.charId}] Spellbook button ${c.spellbook ? 'shown' : 'hidden'}`,
      await page.$eval('#spellbookBtn', el => el.classList.contains('hidden')) !== c.spellbook);
    check(`[char ${c.charId}] Attacks button ${c.attacks ? 'shown' : 'hidden'}`,
      await page.$eval('#attackBtn', el => el.classList.contains('hidden')) !== c.attacks);
    check(`[char ${c.charId}] hotbar has 12 slots`,
      await page.$$eval('#hotbar .hotbarSlot', els => els.length) === 12);

    // Journal: opens, shows the right storyline, chapter 1 can begin.
    await page.evaluate(() => document.getElementById('journalBtn').click());
    await page.waitForSelector('#journalModal:not(.hidden)', { timeout: 3000 });
    const journalText = await page.$eval('#journalContent', el => el.textContent);
    check(`[char ${c.charId}] Journal shows "${c.storyTitle}"`, journalText.includes(c.storyTitle));
    check(`[char ${c.charId}] Journal shows Chapter 1 with a Begin button`,
      journalText.includes('Chapter 1 of 6') && !!(await page.$('#journalBeginBtn')));
    await page.evaluate(() => document.getElementById('journalBeginBtn').click());
    await page.waitForSelector('#storyTracker:not(.hidden)', { timeout: 3000 });
    check(`[char ${c.charId}] beginning a chapter shows the story tracker`, true);
    const trackerText = await page.$eval('#storyTrackerCount', el => el.textContent);
    check(`[char ${c.charId}] tracker shows the objective with 0 progress`, / 0 \/ \d+/.test(trackerText));

    // Attacks panel for the classes that have one — all 12+ abilities listed.
    if (c.attacks) {
      await page.evaluate(() => document.getElementById('attackBtn').click());
      await page.waitForSelector('#attackModal:not(.hidden)', { timeout: 3000 });
      const rows = await page.$$eval('#attackList .attackRow', els => els.length);
      check(`[char ${c.charId}] attacks panel lists a full kit (${rows} abilities)`, rows >= 12);
      const title = await page.$eval('#attackModalTitle', el => el.textContent);
      check(`[char ${c.charId}] attacks panel titled "${c.panelTitle}"`, title === c.panelTitle);
      // Cast a self ability straight from the hotbar via its key.
      await page.keyboard.press('Escape');
      const wardKeyIdx = await page.evaluate(() => {
        // slot index of the first self-ward in this class's catalog — position of key in hotbar
        const slots = document.querySelectorAll('#hotbar .hotbarSlot .hotbarIcon');
        // self-cast wards only (Ethereal Veil / Oath of Iron) — the shield icons are targeted abilities, which need someone else present
        return Array.from(slots).findIndex(s => s.textContent === '🌫️' || s.textContent === '⚙️');
      });
      if (wardKeyIdx >= 0) {
        const KEYS = ['1','2','3','4','5','6','7','8','9','0','-','='];
        await page.keyboard.press(KEYS[wardKeyIdx]);
        await sleep(400);
        const cd = await page.$$eval('#hotbar .hotbarCooldownText', els => els.some(e => e.textContent.trim() !== ''));
        check(`[char ${c.charId}] hotbar cast starts a visible cooldown`, cd);
      }
    }

    // Witch: spellbook still renders all 12 spells.
    if (c.spellbook) {
      await page.evaluate(() => document.getElementById('spellbookBtn').click());
      await page.waitForSelector('#spellbookModal:not(.hidden)', { timeout: 3000 });
      const rows = await page.$$eval('#spellList .spellRow', els => els.length);
      check(`[char 0] spellbook lists 12 spells`, rows === 12);
    }

    const realErrors = errors.filter(e => !/THREE|WebGL|AudioContext/i.test(e));
    check(`[char ${c.charId}] no unexpected page errors (${realErrors.length})`, realErrors.length === 0);
    if (realErrors.length) console.log('   errors:', realErrors.slice(0, 3));
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} FAILURES` : '\nALL SMOKE CHECKS PASSED');
process.exit(failures ? 1 : 0);
