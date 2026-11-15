// Chat kept open while you move, on a phone (client/mobile-hud.js): the 💬 sheet is for writing and the controls
// step aside for it; "Keep open" leaves a small see-through window up instead, and the joystick and buttons stay.
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const html = read('public/index.html'), main = read('client/main.js'), hud = read('client/mobile-hud.js');

// the three states, played through with a stand-in page
function world() {
  const mk = (id) => ({ id, _c: new Set(), children: [], classList: { add(c) { this._o._c.add(c); }, remove(c) { this._o._c.delete(c); }, contains(c) { return this._o._c.has(c); }, toggle(c, on) { if (on === undefined ? !this._o._c.has(c) : on) this._o._c.add(c); else this._o._c.delete(c); } }, addEventListener(t, f) { this._h = f; }, focus() {}, querySelector() { return null; } });
  const els = {}; const get = (id) => { if (!els[id]) { els[id] = mk(id); els[id].classList._o = els[id]; } return els[id]; };
  const body = get('body'), store = {}, modals = {};
  const document = { getElementById: get, body };
  const localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const Modals = { set(k, v) { modals[k] = !!v; }, isOpen(k) { return !!modals[k]; } };
  const src = hud.slice(hud.indexOf('const PIN_KEY'), hud.indexOf('// ── Incoming-message banners'));
  const api = new Function('document', 'localStorage', 'Modals', 'refreshMobileHud', 'setTimeout', src + '\nreturn { setChatPinned, toggleMobileChat, showPinned, chatPinnedPref };')(document, localStorage, Modals, () => {}, () => {});
  get('chatPanel').classList.add('mobileClosed');
  const cp = get('chatPanel');
  const state = () => (Modals.isOpen('mobileChatOpen') ? 'writing' : cp.classList.contains('pinned') ? 'window' : cp.classList.contains('mobileClosed') ? 'away' : '?');
  return { api, state, store, body, Modals };
}
{ const w = world();
  check('chat starts put away', w.state() === 'away');
  w.api.toggleMobileChat(); check('💬 opens the sheet to write', w.state() === 'writing');
  w.api.toggleMobileChat(); check('and 💬 again puts it away, as before', w.state() === 'away');
  w.api.toggleMobileChat(true); w.api.setChatPinned(true);
  check('"Keep open" leaves the window up and steps the sheet down: nothing modal is open, so you can move', w.state() === 'window' && !w.Modals.isOpen('mobileChatOpen') && w.body.classList.contains('chatPinned'));
  check('and it is remembered', w.store.tc_chat_pinned === '1' && w.api.chatPinnedPref());
  w.api.toggleMobileChat(true); check('writing from the window brings the sheet back, and the window steps down while you write', w.state() === 'writing' && !w.body.classList.contains('chatPinned'));
  w.api.toggleMobileChat(false); check('done writing, it is the window again', w.state() === 'window');
  w.api.setChatPinned(false); check('✕ on the window puts chat away, and that is remembered too', w.state() === 'away' && w.store.tc_chat_pinned === '0' && !w.body.classList.contains('chatPinned'));
  w.api.toggleMobileChat(); w.api.toggleMobileChat(); check('after which 💬 is the plain sheet again', w.state() === 'away'); }

check('the controls step aside only for the sheet, not for the window', /!cp\.classList\.contains\('mobileClosed'\) && !cp\.classList\.contains\('pinned'\)\)\);/.test(main) && /body\.touchMode\.composeOpen #joyZone/.test(html));
const pin = html.slice(html.indexOf('  body.touchMode #chatPanel.pinned {'), html.indexOf('}', html.indexOf('  body.touchMode #chatPanel.pinned {')));
check('the window is small, see-through, and lets touches through to the game', /pointer-events:none/.test(pin) && /background:rgba\(14,10,7,0\.40\)/.test(pin) && /width:min\(66vw, 360px\)/.test(pin) && /bottom:auto/.test(pin));
check('only its row of buttons takes a tap', /#chatPanel\.pinned #chatTabs \{[^}]*pointer-events:auto/.test(html) && /#chatPanel\.pinned #chatLog \{[^}]*pointer-events:none/.test(html));
check('it shows the last lines of the chat (the phone otherwise has no chat log), or the newest of the Log', /#chatPanel\.pinned #chatLog \{ display:flex; justify-content:flex-end; max-height:96px/.test(html) && /#chatPanel\.pinned #chatMsgLog \{ height:96px/.test(html));
check('upright it sits under the vitals; sideways, top-centre, clear of the joystick and the buttons', /top:calc\(max\(8px, env\(safe-area-inset-top\)\) \+ 92px\)/.test(pin) && /@media \(orientation:landscape\) \{\s*body\.touchMode #chatPanel\.pinned \{ top:max\(6px, env\(safe-area-inset-top\)\); left:50%; transform:translateX\(-50%\)/.test(html));
check('the composer is the sheet\'s: the window has ✏️ to write and ✕ to put away', /#chatPanel\.pinned #chatInputRow[^{]*\{ display:none !important; \}/.test(html) && /id="chatWriteBtn"/.test(html) && /id="chatUnpinBtn"/.test(html) && /id="chatPinBtn"[^>]*>📌 Keep open</.test(html));
check('the three buttons take a tap (the panel itself lets touches through, so each asks for its own)', /\.chatCtl \{ pointer-events:auto;/.test(html) && /#chatPanel \{[^}]*pointer-events:none/.test(html));
check('these are a phone\'s: on a desktop none of the three buttons shows', /\.chatCtl, \.chatCtlGap \{ display:none; \}/.test(html));
check('a line already in the window is not also bannered; system lines and pictures still are, below it', /if \(document\.body\.classList\.contains\('chatPinned'\) && n\.kind !== 'system' && !n\.image\) return;/.test(hud) && /body\.touchMode\.chatPinned #chatNotifStack \{ top:/.test(html));
check('a full panel or the menu over it: the window steps aside like the rest of the HUD', /body\.touchMode\.panelOpen #chatPanel\.pinned \{ display:none !important; \}/.test(html));
check('with the finds line up (Balefires), the chat keeps its place under the vitals and the lane that holds the line starts wherever the chat ends', /@media \(orientation:portrait\) \{ body\.touchMode\.chatPinned #hudLane \{ top:calc\(var\(--pinnedChatBottom, 236px\) \+ 6px\); \} \}/.test(html) && /st\.setProperty\('--pinnedChatBottom', Math\.round\(b\) \+ 'px'\)/.test(hud) && /new ResizeObserver\(note\)/.test(hud) && /removeProperty\('--pinnedChatBottom'\)/.test(hud));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
