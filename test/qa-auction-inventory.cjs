// 🔨🎒 Auction-from-inventory + gold-visibility — end-to-end UI sweep.
// Registers a real account, joins, and drives the REAL client + server:
//   • the pack header shows a live gold readout (live report: "I can't see
//     how much gold I have")
//   • the Auction House shows the same gold, and its sell picker offers a
//     "🎒 Your pack" group — listing a carried item needs no bank deposit
//   • listing a pack item round-trips: it leaves the pack and appears in
//     the live listings
// Run: node test/qa-auction-inventory.cjs   (starts its own server on :3011)
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const STUB = path.join(__dirname, 'three-stub.js');
const PORT = 3011;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tc-qa-auctinv-'));

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
  const page = await ctx.newPage();
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message.slice(0, 180)));
  const td = (fn, ...args) => page.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);
  const vis = (id) => page.evaluate((i) => { const el = document.getElementById(i); return !!el && !el.classList.contains('hidden') && el.getBoundingClientRect().height > 0; }, id);
  const txt = (id) => page.evaluate((i) => (document.getElementById(i) || {}).textContent || '', id);

  try {
    console.log('── Register + join as an account ──');
    await page.goto(`http://localhost:${PORT}/?testdrive=1`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.setItem('tc_controls_seen', '1'); localStorage.setItem('tc_welcome_seen', '1'); });
    const user = 'auctioneer' + Math.floor(Math.random() * 1e6);
    await page.evaluate(() => {
      const acct = [...document.querySelectorAll('#joinModeTabs button')].find(t => /account/i.test(t.textContent));
      if (acct) acct.click();
    });
    await page.waitForTimeout(250);
    await page.fill('#accountUserInput', user);
    await page.fill('#accountPassInput', 'hunter2222');
    await page.evaluate(() => document.getElementById('accountRegisterBtn').click());
    await page.waitForTimeout(900);
    await page.click('#joinBtn');
    await page.waitForTimeout(1600);
    check('joined the town as the account', !!(await td('me')));

    console.log('── Gold readout on the pack (live report #2) ──');
    await page.evaluate(() => document.getElementById('menuInventory').click());
    await page.waitForTimeout(500);
    check('inventory panel is open', await vis('inventoryPanel'));
    const goldLineVisible = await vis('invGoldLine');
    const goldLineText = await page.evaluate(() => document.getElementById('invGoldLine').innerHTML);
    check('pack shows a gold readout strip', goldLineVisible, 'visible=' + goldLineVisible);
    check('gold strip reports a live gold amount', /\d+/.test(goldLineText) && /gold/i.test(goldLineText), goldLineText);
    const menuGoldText = await txt('menuGoldVal');
    check('menu Inventory row carries a 🪙 gold badge', /🪙\s*\d+/.test(menuGoldText), 'badge=' + JSON.stringify(menuGoldText));

    console.log('── Move a carried item into the pack (unequip) ──');
    // A fresh account starts with its gear equipped and an empty pack, so
    // unequip the weapon to have something carried to list. Real player
    // action; just driven over the socket to skip the 3D slot raycast.
    await td('send', { type: 'inventory_unequip', equipSlot: 'weapon' });
    await page.waitForTimeout(500);
    const packCount = await page.evaluate(() => {
      const grid = document.getElementById('invSlotsGrid');
      return grid ? [...grid.children].filter(c => c.textContent.trim().length > 0).length : -1;
    });
    check('pack now holds the unequipped weapon', packCount >= 1, 'filled slots=' + packCount);
    await page.evaluate(() => { const b = document.getElementById('invCloseBtn'); if (b) b.click(); });
    await page.waitForTimeout(300);

    console.log('── Auction House: gold line + pack-sourced sell picker ──');
    // Enter the bank the deterministic way: stand ON the building footprint,
    // then a brief joystick nudge runs one updateOutdoor() tick, which detects
    // roomAt()==='bank' and calls enterBuilding() (see client.js). The proven
    // template walked in from OUTSIDE the door, which is distance-sensitive and
    // flaky headless; being inside the footprint first makes the first tick
    // enter regardless of how far the nudge travels.
    const buildings = (await td('world')).buildings;
    const bank = buildings.find(b => b.id === 'bank');
    // Keyboard drives `keys.up` (client.js line ~4838) which the movement loop
    // reads every frame — steadier headless than synthetic joystick touches.
    const nudge = async (key) => { await page.keyboard.down(key); await page.waitForTimeout(350); await page.keyboard.up(key); };
    let room = 'outside';
    const dirs = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (let attempt = 0; attempt < 6 && room !== 'bank'; attempt++) {
      await td('teleport', bank.x + bank.w / 2, bank.y + bank.h / 2);
      await page.waitForTimeout(60);
      await nudge(dirs[attempt % dirs.length]);
      await page.waitForTimeout(200);
      room = (await td('state')).room;
    }
    check('inside the bank building', room === 'bank', 'room=' + room);
    const kiosks = await td('interiorKiosks');
    const auct = (kiosks || []).find(k => k.npc === 'auctioneer');
    check('auctioneer kiosk found', !!auct);
    await td('teleport', auct.world.x, auct.world.y);
    await page.waitForTimeout(300);
    await td('interact');
    await page.waitForTimeout(800);
    const aUp = await page.evaluate(() => { const m = document.getElementById('auctionModal'); return m && !m.classList.contains('hidden'); });
    check('auction house modal opens', aUp);

    const aBalText = await txt('auctionBalanceLine');
    check('auction house shows my live gold balance', /🪙\s*\d+/.test(aBalText) && /bank/i.test(aBalText), 'line=' + JSON.stringify(aBalText));

    // open the "+ List an item" form and inspect the picker
    await page.evaluate(() => document.getElementById('auctionCreateToggleBtn').click());
    await page.waitForTimeout(400);
    const picker = await page.evaluate(() => {
      const sel = document.getElementById('auctionItemSelect');
      if (!sel) return null;
      const groups = [...sel.querySelectorAll('optgroup')].map(g => ({ label: g.label, n: g.children.length }));
      const opts = [...sel.options].map(o => ({ v: o.value, t: o.textContent }));
      return { groups, opts };
    });
    check('sell picker has a "🎒 Your pack" group', picker && picker.groups.some(g => /pack/i.test(g.label) && g.n >= 1), JSON.stringify(picker && picker.groups));
    const packOpt = picker && picker.opts.find(o => /^inv:/.test(o.v));
    check('a pack item is selectable (value starts inv:)', !!packOpt, packOpt && packOpt.t);

    console.log('── List the pack item end-to-end ──');
    const _listingsBefore = (await td('send', { type: 'auction_browse' }), await page.evaluate(() => {
      const l = document.getElementById('auctionListings');
      return l ? l.children.length : -1;
    }));
    await page.evaluate((val) => {
      const sel = document.getElementById('auctionItemSelect');
      sel.value = val;
      document.getElementById('auctionQty').value = '1';
      document.getElementById('auctionStartBid').value = '15';
      document.getElementById('auctionCreateSubmitBtn').click();
    }, packOpt.v);
    await page.waitForTimeout(900);
    const err = await txt('auctionModalErr');
    check('listing submitted without an error', !err.trim(), 'err=' + err);
    const listingsAfter = await page.evaluate(() => {
      const l = document.getElementById('auctionListings');
      return l ? [...l.children].map(c => c.textContent).join(' | ') : '';
    });
    check('the pack item now appears in the live listings', /15/.test(listingsAfter) && listingsAfter.length > 0, listingsAfter.slice(0, 160));
    // and it left the pack (reopen inventory)
    await page.evaluate(() => document.getElementById('auctionModalCloseBtn').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.getElementById('menuInventory').click());
    await page.waitForTimeout(500);
    const packCountAfter = await page.evaluate(() => {
      const grid = document.getElementById('invSlotsGrid');
      return grid ? [...grid.children].filter(c => c.textContent.trim().length > 0).length : -1;
    });
    check('the listed item left the pack', packCountAfter === packCount - 1, `before=${packCount} after=${packCountAfter}`);

    await page.screenshot({ path: path.join(DATA_DIR, 'auction-inventory.png') });
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
