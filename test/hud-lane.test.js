// One rule for everything at the top middle of the screen (asked for after the Balefires line and the town bell
// overlapped): it all lives in #hudLane, which lays its children out one under another. This test is the lock: a new
// pill placed at the top middle on its own, outside the lane, fails here.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'client', 'main.js'), 'utf8');
const laneJs = fs.readFileSync(path.join(__dirname, '..', 'client', 'hud-lane.js'), 'utf8');

const laneHtml = html.slice(html.indexOf('<div id="hudLane">'), html.indexOf('<div id="gatherHint"'));
const inLane = [...laneHtml.matchAll(/^  <div id="([A-Za-z]+)"/gm)].map((m) => m[1]);

test('the lane holds the delve line, the finds line, the event tag, the town bell, the Hunt\'s line and the targeting banner', () => {
  assert.deepStrictEqual(inLane, ['delveHud', 'dungeonFindsHud', 'eventTag', 'bellTag', 'huntHud', 'targetingBanner']);
  for (const id of inLane) assert.strictEqual((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, id + ' is in the page once');
});

test('the lane is a column, and takes away any place a child gives itself', () => {
  assert.match(html, /#hudLane \{\s*position:fixed; top:62px; left:0; right:0; z-index:8;\s*display:flex; flex-direction:column; align-items:center; gap:6px; pointer-events:none;/);
  assert.match(html, /\n  #hudLane > \* \{\s*position:static !important; top:auto !important; left:auto !important; right:auto !important; bottom:auto !important;/);
  const rule = html.indexOf('\n  #hudLane > * {');
  for (const id of inLane) assert.ok(html.indexOf('#' + id + ' {') < rule, id + ': its own rule comes before the lane rule, so the lane has the last word on transform');
  assert.ok(!/@keyframes bellPulse[^}]*translateX/.test(html), 'the bell\'s pulse no longer centres itself');
});

test('nothing else is placed at the top middle on its own', () => {
  // every rule that is fixed, centred by left:50%, and hung from the top by a px offset
  const offenders = [];
  for (const m of html.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = m[2];
    if (!/position:\s*fixed/.test(body) || !/left:\s*50%/.test(body) || !/(^|[;\s])top:\s*\d+px/.test(body)) continue;
    offenders.push(m[1].trim().split('\n').pop().trim());
  }
  const allowed = new Set(['#targetingBanner', '#eventTag', '#bellTag', '#delveHud', '#dungeonFindsHud', '#attackHitNotification', '.loadPill']);   // the lane's own (overridden), and the hit card, which starts below the lane
  assert.deepStrictEqual(offenders.filter((s) => !allowed.has(s)), []);
  assert.match(html, /body:has\(\.loadPill\.show\) #hudLane \{ top:88px; \}/, 'the loading pill sits over the lane, so the lane steps down while it shows');
  assert.match(html, /#attackHitNotification \{ top:max\(72px, calc\(var\(--hudLaneBottom, 0px\) \+ 8px\)\); \}/);
});

test('the toasts and the banner begin where the lane ends', () => {
  assert.match(html, /#topStack \{ top:max\(100px, calc\(var\(--hudLaneBottom, 0px\) \+ 8px\)/);
  assert.match(main, /watchHudLane\(\);/);
  const L = new Function(laneJs.replace(/^export (const|function) /gm, '$1 ') + '\nreturn { laneBottom, watchHudLane };')();
  assert.strictEqual(L.laneBottom({ height: 0, bottom: 62 }), 0, 'an empty lane asks for no room');
  assert.strictEqual(L.laneBottom({ height: 58, bottom: 120.4 }), 120);
  const set = {}; let seen = null;
  const doc = { getElementById: () => ({ getBoundingClientRect: () => ({ height: 26, bottom: 88 }) }), body: { style: { setProperty: (k, v) => { set[k] = v; } } } };
  const win = { ResizeObserver: function (cb) { seen = cb; this.observe = () => {}; this.disconnect = () => {}; }, addEventListener() {}, removeEventListener() {} };
  const w = L.watchHudLane(doc, win);
  assert.strictEqual(set['--hudLaneBottom'], '88px');
  assert.ok(typeof seen === 'function' && w && typeof w.stop === 'function');
  assert.strictEqual(L.watchHudLane({ getElementById: () => null, body: { style: {} } }, win), null, 'no lane, no harm');
});

test('on a phone the lane is a column down the left under the vitals, under the kept-open chat when there is one, and banners come below it', () => {
  assert.match(html, /body\.touchMode #hudLane \{ top:calc\(max\(8px, env\(safe-area-inset-top\)\) \+ 86px\); align-items:flex-start;/);
  assert.match(html, /@media \(orientation:portrait\) \{ body\.touchMode\.chatPinned #hudLane \{ top:calc\(var\(--pinnedChatBottom, 236px\) \+ 6px\); \} \}/);
  assert.match(html, /body\.touchMode #chatNotifStack, body\.touchMode\.chatPinned #chatNotifStack \{ top:max\(calc\(max\(8px, env\(safe-area-inset-top\)\) \+ 86px\), calc\(var\(--hudLaneBottom, 0px\) \+ 6px\)\); \}/);
  assert.ok(!/findsHudUp #chatNotifStack/.test(html) && !/chatPinned #dungeonFindsHud/.test(html), 'the old one-pair-at-a-time rules are gone');
});

// The notices down the middle and the trackers at the top right (asked for after a new-ability notice landed on
// The Ancient Harvest's tracker on a phone).
test('a tracker the notice lane would cross pushes the lane below it; one clear of the lane moves nothing', () => {
  const src = laneJs.replace(/^export (const|function) /gm, '$1 ');
  const { sideBottom } = new Function(src + '\nreturn { sideBottom };')();
  const phone = 412, desk = 1440;
  const tracker = (vw) => ({ left: vw - 16 - 206, right: vw - 16, top: 112, bottom: 290, width: 206, height: 178 });
  assert.strictEqual(sideBottom([tracker(phone)], phone), 290, 'on a phone the lane starts below the tracker');
  assert.strictEqual(sideBottom([tracker(desk)], desk), 0, 'on a wide screen the tracker is out of the lane\'s way');
  assert.strictEqual(sideBottom([{ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }], phone), 0, 'a hidden tracker moves nothing');
  assert.strictEqual(sideBottom([{ ...tracker(phone), top: 600, bottom: 780 }], phone), 0, 'one dragged down the screen does not drag the notices with it');
  assert.strictEqual(sideBottom([tracker(phone), { ...tracker(phone), top: 300, bottom: 360 }], phone), 360, 'the quest and story trackers both count');
});
test('the stack of notices begins below whichever reaches lower, the lane or a tracker', () => {
  assert.match(html, /#topStack \{ top:max\(100px, calc\(var\(--hudLaneBottom, 0px\) \+ 8px\), calc\(var\(--hudSideBottom, 0px\) \+ 8px\)\); \}/);
  assert.match(html, /body\.touchMode #topStack \{ top:max\(max\(96px, calc\(env\(safe-area-inset-top\) \+ 88px\)\), calc\(var\(--hudLaneBottom, 0px\) \+ 8px\), calc\(var\(--hudSideBottom, 0px\) \+ 8px\)\); \}/);
  assert.match(main, /watchSideTrackers\(\);/);
  assert.match(laneJs, /attributeFilter: \['class', 'style'\]/, 'a tracker shown, hidden or dragged is measured again');
});
