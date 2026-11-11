// Playtest: the old places in the Wilds, walked as a player, fast.
//
// The real client and the real server, in headless Chromium, with three.js
// swapped for test/three-stub.js: nothing is drawn, so a step costs
// milliseconds instead of the minutes a software-rendered Wilds frame takes,
// and the client's own movement (collision included), kiosks, toasts, panels,
// Board, map and Charm Book all run for real. (For how a place LOOKS, use a
// real three.js with ?gfx=low&draw=0.2, which testdrive mode honours, and
// __testDrive.sceneStats() to see what a frame costs.)
//
// Walks: the clootie well (Morag's working, start to finish), the Shepherd's
// Race in and out, the Crick-stone nine times, the Nine-and-Twenty counted
// twice, then the Wilds map and the Charm Book's Drawn & Walked chapter.
//
// Run: node test/qa-wilds-places.cjs        (starts its own server on :3141)
//      SHOTS=dir node test/qa-wilds-places.cjs   to keep screenshots
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const ROOT = path.join(__dirname, '..');
const STUB = path.join(__dirname, 'three-stub.js');
const PORT = 3141;
const SHOTS = process.env.SHOTS || null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let checks = 0, failures = 0;
const check = (desc, cond, detail) => { checks++; console.log(`  ${cond ? '✓' : '✗'} ${desc}${cond ? '' : (detail ? ' — ' + String(detail).slice(0, 220) : '')}`); if (!cond) failures++; };

// An account name the town offers today's caller to (callers at the door are
// dealt per account per day): asked of the server code itself, offline.
function nameOfferedTo(callerId) {
  const out = execFileSync(process.execPath, ['-e', `
    process.env.PORT='0'; process.env.DATA_DIR=require('fs').mkdtempSync(require('os').tmpdir()+'/qa-find-');
    function mk(){return {OPEN:1,readyState:1,sent:[],_h:{},on(e,cb){this._h[e]=cb},send(d){this.sent.push(JSON.parse(d))},emit(e,...a){this._h[e]&&this._h[e](...a)},last(t){for(let i=this.sent.length-1;i>=0;i--)if(this.sent[i].type===t)return this.sent[i]}}}
    require(${JSON.stringify(path.join(ROOT, 'server.js'))});
    setTimeout(()=>{const h=global.__testHooks,w=global.__wssInstances[0];const ch=(w._handlers&&w._handlers.connection)||w.listeners('connection')[0];
      const s=mk();ch(s);s.emit('message',JSON.stringify({type:'join',name:'F',charId:0}));const p=h.players.get(s.last('init').id);
      for(let i=0;i<40000;i++){const n='qa'+i;p.accountKey=n;h.accounts[n]={};s.emit('message',JSON.stringify({type:'callers_state'}));
        if(s.last('callers_state').offered.some((o)=>o.id===${JSON.stringify(callerId)})){process.stdout.write(n);process.exit(0);} delete h.accounts[n];}
      process.exit(1);},300);`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const m = out.match(/\bqa\d+\s*$/);
  if (!m) throw new Error('no account found for ' + callerId);
  return m[0].trim();
}

(async () => {
  const user = nameOfferedTo('clootie');
  console.log(`(account ${user} has Morag at the door today)`);
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-wilds-'));
  const srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DATA_DIR: data }, stdio: 'ignore' });
  await sleep(2200);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.route('**/three.min.js*', (r) => r.fulfill({ path: STUB, contentType: 'application/javascript' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERR: ' + e.message.slice(0, 200)));
  page.on('crash', () => console.log('    (the page crashed)'));
  page.on('close', () => console.log('    (the page closed)'));
  const td = (fn, ...args) => page.evaluate(([f, a]) => window.__testDrive[f](...a), [fn, args]);
  const shot = async (name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
  const log = async () => (await td('msgLog')).map((m) => m.text);
  const hint = () => page.evaluate(() => { const h = document.getElementById('interactHint'); return h && !h.classList.contains('hidden') ? document.getElementById('interactHintText').textContent : null; });
  // Step to each point and wait until the client has sent a move from there.
  // Keep hold of the game's socket, so the walks can tell the server each step.
  await ctx.addInitScript(() => { const W = window.WebSocket; window.WebSocket = class extends W { constructor(...a) { super(...a); window.__ws = this; } }; });
  await page.goto(`http://localhost:${PORT}/play?testdrive=1`, { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.setItem('tc_controls_seen', '1'); localStorage.setItem('tc_welcome_seen', '1'); const o = WebSocket.prototype.send; window.__moves = 0; WebSocket.prototype.send = function (d) { window.__ws = this; if (/"type":"move"/.test(d)) window.__moves++; return o.call(this, d); }; });
  const walkChunk = (pts) => page.evaluate(async (pts) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // Put the player there, and tell the server at once, as the client's own
    // 20-a-second move would (a headless frame can take a while to come round).
    const room = window.__testDrive.room();
    for (const [x, y] of pts) { window.__testDrive.teleport(x, y); window.__ws.send(JSON.stringify({ type: 'move', x, y, room })); await sleep(4); }
  }, pts);
  // In chunks, so one long walk is many short evaluations.
  const walkTo = async (pts) => { for (let i = 0; i < pts.length; i += 40) { if (process.env.TRACE) console.log('    walk', i, '/', pts.length, JSON.stringify(pts[i]), new Date().toISOString().slice(11, 19)); await walkChunk(pts.slice(i, i + 40)); } };
  // A step with the client's own movement and collision (no teleport).
  const stride = (dx, dy, n) => page.evaluate(([dx, dy, n]) => { let p; for (let k = 0; k < n; k++) p = window.__testDrive.walk(dx, dy); return p; }, [dx, dy, n]);

  console.log('── An account, and Morag at the door ──');
  await page.click('#joinModeAccountBtn');
  await page.fill('#accountUserInput', user);
  await page.fill('#accountPassInput', 'hunter2222');
  await page.evaluate(() => { const c = document.getElementById('accountOver18'); if (c) c.checked = true; document.getElementById('accountRegisterBtn').click(); });
  await sleep(1500);
  await page.click('#joinBtn');
  await sleep(2500);
  await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/Just explore for now/.test(b.textContent) && b.offsetParent) b.click(); });
  check('joined the town as the account', !!(await td('me')));
  await page.evaluate(() => document.getElementById('menuBoard').click());
  await page.waitForSelector('#boardList .callerCard');
  const took = await page.evaluate(() => { const c = [...document.querySelectorAll('#boardList .callerCard')].find((x) => /A Cloot for the Thorn/.test(x.textContent)); const b = c && c.querySelector('.callerTake'); if (b) b.click(); return !!b; });
  check('Morag is at the door, and her working can be taken', took);
  await page.waitForSelector('.clootCloths button');
  await page.evaluate(() => [...document.querySelectorAll('.clootCloths button')].find((b) => /polyester/.test(b.textContent)).click());
  await sleep(400);
  check('the polyester ribbon is refused', (await log()).some((t) => /won't rot/.test(t)));
  await page.waitForSelector('.clootCloths button:not([disabled])');
  await page.evaluate(() => [...document.querySelectorAll('.clootCloths button')].find((b) => /wool/.test(b.textContent)).click());
  await page.waitForSelector('.clootBox .knotRow');
  check('wool is taken: the Board shows the rounds to walk', /Round the well sunways: 0 of 3/.test(await page.$eval('.clootBox', (b) => b.textContent)));
  await shot('01-board-cloot');
  await page.evaluate(() => document.getElementById('boardCloseBtn').click());

  console.log('── The callers by the Board ──');
  await page.waitForFunction(() => window.__testDrive.callersInTown().length > 0, null, { timeout: 15000 }).catch(() => {});
  check("Morag stands by the Town Board, marked as your working, with the day's others", await page.evaluate(() => { const s = window.__testDrive.callersInTown(); return s.length >= 1 && s[0].id === 'clootie' && s.every((c) => Math.hypot(c.x - 2010, c.z - 1150) < 160); }), JSON.stringify(await page.evaluate(() => window.__testDrive.callersInTown())));
  await walkTo([[1935, 1190]]);
  await sleep(400);
  check('walk up to her and the prompt names her', /hear Morag Fraser, from the Black Isle out/.test(await hint()), await hint());
  await td('interact');
  await sleep(400);
  check('…and interacting opens the Board', await page.evaluate(() => !document.getElementById('boardModal').classList.contains('hidden')));
  await page.evaluate(() => document.getElementById('boardCloseBtn').click());

  console.log('── Into the Wilds ──');
  const portal = (await td('world')) && 1;
  await walkTo([[1850, 650]]);
  await sleep(300);
  console.log('    (at the portal the hint reads: ' + (await hint()) + ')');
  await td('interact');
  for (let w = 0; w < 50 && (await td('room')) !== 'wilds'; w++) await sleep(200);
  check('through the portal into the Wilds', (await td('room')) === 'wilds', await td('room'));
  const w2 = await page.evaluate(() => window.__testDrive.world() && null);
  void portal; void w2;

  console.log('── The clootie well ──');
  const W = { x: 4400, y: 8200 };
  const ring = []; for (let k = 0; k <= 3 * 36 + 4; k++) { const a = (k / 36) * 2 * Math.PI + Math.PI / 2; ring.push([W.x + 130 * Math.cos(a), W.y + 130 * Math.sin(a)]); }
  await walkTo(ring);
  await sleep(300);
  const l1 = await log();
  check('three rounds sunways are counted, round by round', ['Once round', 'Twice round', 'Three times round'].every((s) => l1.some((t) => t.includes(s))), l1.filter((t) => /🎀/.test(t)));
  await walkTo([[W.x, W.y + 70]]);
  await sleep(300);
  check('at the spring the hint says to tie a cloot', /tie a cloot/.test((await hint()) || ''), await hint());
  await td('interact');
  await sleep(500);
  check('the cloot is tied: the working says it is ready', (await log()).some((t) => /Morag Fraser's working is ready/.test(t) || /Fraser, from the Black Isle's working is ready/.test(t)), (await log()).slice(-3));
  await shot('02-cloot-tied');

  console.log('── The Shepherd\'s Race ──');
  const { troyRunMoves } = require('./troy-walk-path');
  await walkTo(troyRunMoves(4));
  await sleep(400);
  const l2 = await log();
  check('in at the gate, to the centre, and out: the three messages', ['In at the gate of the Shepherd', 'The centre! Now run it out again', 'In and out without a false step'].every((s) => l2.some((t) => t.includes(s))), l2.filter((t) => /🌀/.test(t)));

  console.log('── The Crick-stone ──');
  const X = 5100, Y = 7800;
  // Walk up to the hole from the south with the client's own movement, to
  // show the gap in its walls lets a player through.
  await walkTo([[X, Y + 70]]);
  const through = await stride(0, -6, 30);
  check('the client lets a player walk through the hole itself', through && through.y < Y - 40, through);
  await walkTo([[X, Y + 70]]);
  const blocked = await (async () => { await walkTo([[X + 36, Y + 70]]); return stride(0, -6, 30); })();
  check('…but not through the stone beside it', blocked && blocked.y > Y + 10, blocked);
  const loop = []; const seg = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20); for (let k = 0; k < n; k++) loop.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); };
  const WP = [[X, Y + 80], [X, Y - 80], [X - 260, Y - 80], [X - 260, Y + 80], [X, Y + 80]];
  for (let k = 1; k < WP.length; k++) seg(WP[k - 1], WP[k]);
  await walkTo([[X, Y + 200]]);
  for (let i = 0; i < 9; i++) await walkTo(loop);
  await sleep(400);
  const l3 = await log();
  check('nine times through, against the sun: counted to nine, and done', l3.some((t) => /Through the Crick-stone: 8 of 9/.test(t)) && l3.some((t) => /Nine times through, against the sun/.test(t)), l3.filter((t) => /🪨/.test(t)).slice(-3));
  check('…and the stone answers in its own lore, the one plain line folded shut under it: no 💬, no quest button, no NHS', await page.evaluate(() => { const n = document.getElementById('npcHintNote'); return !document.getElementById('npcHintModal').classList.contains('hidden') && /^🪨/.test(document.getElementById('npcHintName').textContent) && document.getElementById('npcHintQuestBtn').classList.contains('hidden') && /Bottrell had it/.test(document.getElementById('npcHintText').textContent) && !/NHS|numbness/.test(document.getElementById('npcHintText').textContent) && !!n && n.tagName === 'DETAILS' && !n.open && /A word from now/.test(n.textContent); }));
  await page.evaluate(() => document.getElementById('npcHintCloseBtn').click());

  console.log('── The Nine-and-Twenty ──');
  await walkTo([[4500, 7800 + 165 + 55]]);
  await sleep(200);
  check('at the counting stone the hint says to count', /count the stones/.test((await hint()) || ''), await hint());
  await td('interact');
  await page.waitForSelector('.countPanel .countInput');
  for (const n of ['29', '30', '31', '31']) {
    await page.fill('.countInput', n);
    await page.press('.countInput', 'Enter');
    await page.waitForFunction(() => !document.querySelector('.countGo') || !document.querySelector('.countGo').disabled);
    await sleep(150);
  }
  const note = await page.$eval('.countNote', (n) => n.textContent);
  check('29 then 30 is never twice alike; 31 and 31 beats the record', /twice alike, and every stone/.test(note), note);
  await shot('03-count');
  await page.evaluate(() => document.querySelector('.countClose').click());

  console.log('── The map and the Charm Book ──');
  await page.keyboard.press('m');
  await sleep(500);
  check('the map opens in the Wilds', await page.evaluate(() => !document.getElementById('mapModal').classList.contains('hidden')));
  await shot('04-map');
  await page.keyboard.press('m');
  await td('charmBook');
  await sleep(600);
  const chapter = await page.evaluate(() => { const t = document.getElementById('charmBookModal') || document.body; return t.innerText; });
  check('the Charm Book has its Drawn & Walked chapter', /Drawn & Walked/.test(chapter));
  console.log(`\nchecks: ${checks}, failures: ${failures}`);
  console.log('PAGE ERRORS: ' + (errors.length ? [...new Set(errors)].join(' | ') : 'none'));
  await browser.close(); srv.kill();
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('HARNESS FAIL', e); process.exit(1); });
