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
      // No real 3D asset loader in the stub -> client.js KK.load() (~line 159)
      // early-settles into its procedural fallback instead of waiting out its
      // 12s preload cap, so attemptJoin() doesn't hold the join for 12s.
      if (p === 'GLTFLoader') return undefined;
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
    { charId: 2, name: 'MistSmoke',   spellbook: false, attacks: true,  storyTitle: 'Voices Beneath the Floorboards', panelTitle: 'Mystic Rites' },
    { charId: 3, name: 'KnightSmoke', spellbook: false, attacks: true,  storyTitle: 'The Hollow Oath', panelTitle: 'Knightly Arts' }
  ];

  for (const c of CASES) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => { errors.push(String(e)); console.log(`  [char ${c.charId}] PAGEERROR: ` + String(e).split('\n')[0]); });
    page.on('console', m => { if (m.type() === 'error') console.log(`  [char ${c.charId}] console.error: ` + m.text()); });
    await page.route('**/three.min.js', route => route.fulfill({ contentType: 'application/javascript', body: THREE_STUB }));
    await page.goto(`http://localhost:${PORT}/play`);
    await page.waitForSelector('#joinScreen', { timeout: 5000 });

    // Pick the character, type a name, join.
    await page.evaluate((idx) => {
      const opts = document.querySelectorAll('.charOption');
      if (opts[idx]) opts[idx].click();
    }, c.charId);
    await page.fill('#nameInput', c.name);
    await page.click('#joinBtn');
    try {
      await page.waitForSelector('#hud:not(.hidden)', { timeout: 8000 });
    } catch (err) {
      const diag = await page.evaluate(() => {
        const out = {};
        try { const j = document.getElementById('joinScreen'); out.joinScreenHidden = j ? j.classList.contains('hidden') : 'no #joinScreen'; } catch (e) { out.joinScreenErr = String(e); }
        try { const h = document.getElementById('hud'); out.hudHidden = h ? h.classList.contains('hidden') : 'no #hud'; } catch (e) { out.hudErr = String(e); }
        try { out.wsReadyState = (typeof ws !== 'undefined' && ws) ? ws.readyState : 'no ws'; } catch (e) { out.wsErr = String(e); }
        try { out.joinedName = (typeof me !== 'undefined' && me) ? (me.name || 'me-no-name') : 'no me'; } catch (e) {}
        return out;
      }).catch((e) => ({ evalErr: String(e) }));
      console.log(`\n  [char ${c.charId}] HUD never appeared within 8s.`);
      console.log('    state:', JSON.stringify(diag));
      console.log('    pageerrors captured:', errors.length ? errors.slice(0, 5) : '(none)');
      throw err;
    }

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
      // the Knight's story runs to twelve chapters (Episode III, at Ashminster); the rest to nine
      journalText.includes(`Chapter 1 of ${c.charId === 3 ? 12 : 9}`) && !!(await page.$('#journalBeginBtn')));
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
      // Title is now a carved class sigil (SVG) + the panel name, so compare the
      // trimmed text and assert the sigil rendered rather than an emoji fallback.
      const titleInfo = await page.$eval('#attackModalTitle', el => ({ text: el.textContent.trim(), hasSigil: !!el.querySelector('svg.uiIcon') }));
      check(`[char ${c.charId}] attacks panel titled "${c.panelTitle}"`, titleInfo.text === c.panelTitle && titleInfo.hasSigil);
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

    // The back gesture closes the open menu, not the game (client/back-closes.js).
    if (c.charId === 0) {
      // Start from the game with nothing open (the first-visit welcome can pop up
      // late on a slow runner and would add a level of its own).
      // (the Spellbook above is still open, and the welcome may be up): close them all.
      for (let k = 0; k < 6; k++) {
        const left = await page.evaluate(() => [...document.querySelectorAll('.overlay, .floatPanel, #menuSheet, [id$="Modal"]')].filter((e) => !e.classList.contains('hidden') && e.checkVisibility() && e.id !== 'joinScreen').length);
        if (!left) break;
        await page.keyboard.press('Escape');
        await sleep(250);
      }
      // Let any history step the welcome left be taken back off before starting.
      await sleep(600);
      await page.waitForFunction(() => !(history.state && history.state.thornreachMenu), null, { timeout: 3000 }).catch(() => {});
      await sleep(300);
      const url0 = page.url();
      const back = () => page.evaluate(() => history.back());
      const shown = (sel) => page.$eval(sel, (el) => !el.classList.contains('hidden'));
      await page.evaluate(() => document.getElementById('journalBtn').click());
      await page.waitForSelector('#journalModal:not(.hidden)', { timeout: 3000 });
      await page.waitForFunction(() => !!(history.state && history.state.thornreachMenu), null, { timeout: 2000 }).catch(() => {});
      await sleep(300);
      await back();
      await page.waitForSelector('#journalModal.hidden', { state: 'attached', timeout: 3000 }).catch(() => {});
      check('[char 0] going back closes the open panel and stays in the game', !(await shown('#journalModal')) && page.url() === url0 && await shown('#hud'));
      // A panel opened from the ☰ menu: back returns to the menu, back again closes it.
      await page.evaluate(() => { document.getElementById('menuSheet').classList.remove('hidden'); });
      await page.waitForFunction(() => !!(history.state && history.state.thornreachMenu), null, { timeout: 2000 }).catch(() => {});
      await page.evaluate(() => document.getElementById('menuSettings').click());
      await page.waitForSelector('#settingsModal:not(.hidden)', { timeout: 3000 });
      // Wait for what the checks below depend on, not for a fixed time: on a
      // loaded CI runner the history entries can lag the taps by more than a
      // fixed sleep, which failed all three of these together once.
      await page.waitForFunction(() => ((history.state && history.state.thornreachMenu) | 0) >= 2, null, { timeout: 5000 }).catch(() => {});
      await sleep(200);
      const len0 = await page.evaluate(() => history.length);
      const depth0 = await page.evaluate(() => (history.state && history.state.thornreachMenu) | 0);
      await back();
      await page.waitForFunction(() => document.getElementById('settingsModal').classList.contains('hidden') && !document.getElementById('menuSheet').classList.contains('hidden'), null, { timeout: 5000 }).catch(() => {});
      await sleep(200);
      check('[char 0] back from a panel opened from the menu goes back to the menu', !(await shown('#settingsModal')) && await shown('#menuSheet'));
      // Phone browsers skip, on a back gesture, history entries a page adds
      // without a tap: so the menu's entry must already be there, pushed at the
      // tap that opened the panel, and nothing pushed after the back.
      check('[char 0] …with nothing added to the history after the back (its entry was laid down at the tap)', depth0 >= 2 && (await page.evaluate(() => history.length)) === len0 && (await page.evaluate(() => (history.state && history.state.thornreachMenu) | 0)) === depth0 - 1);
      await sleep(100);
      await back();
      await page.waitForFunction(() => document.getElementById('menuSheet').classList.contains('hidden'), null, { timeout: 5000 }).catch(() => {});
      await sleep(200);
      check('[char 0] …and back again closes the menu, still in the game', !(await shown('#menuSheet')) && page.url() === url0 && await shown('#hud'));
      // Closed with its own button: the extra history entry is taken back off.
      await page.evaluate(() => document.getElementById('journalBtn').click());
      await page.waitForSelector('#journalModal:not(.hidden)', { timeout: 3000 });
      await sleep(100);
      const depthOf = () => page.evaluate(() => (history.state && history.state.thornreachMenu) | 0);
      const before = await depthOf();
      await page.evaluate(() => document.getElementById('journalCloseBtn').click());
      await sleep(400);
      // (Anything else still open, such as the first-visit welcome, keeps its own step.)
      check('[char 0] a menu closed by its own button leaves no extra back step behind', before >= 1 && (await depthOf()) === before - 1, { before, after: await depthOf() });
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
