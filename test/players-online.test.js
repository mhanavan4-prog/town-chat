// The 👥 Players online panel (O) against the real server: who is on and
// roughly where, a whisper to one of them through the open chat's checks,
// and the client's panel, hotkey and menu entry.
process.env.PORT = '0';
process.env.DATA_DIR = require('fs').mkdtempSync(require('os').tmpdir() + '/tc-online-test-');
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('PASS -', name); } else { fail++; console.log('FAIL -', name, extra != null ? `(${JSON.stringify(extra)})` : ''); } }
function makeMockSocket(label) {
  return { label, OPEN: 1, readyState: 1, sent: [], _handlers: {}, _ip: '10.0.0.' + label.length,
    on(event, cb) { this._handlers[event] = cb; }, send(data) { this.sent.push(JSON.parse(data)); },
    emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
    lastOfType(type) { for (let i = this.sent.length - 1; i >= 0; i--) if (this.sent[i].type === type) return this.sent[i]; return null; } };
}
require('../server.js');

setTimeout(() => {
  const h = global.__testHooks;
  const wss = global.__wssInstances[0];
  const connHandler = (wss._handlers && wss._handlers.connection) || wss.listeners('connection')[0];
  const join = (name, charId) => { const s = makeMockSocket(name); connHandler(s); s.emit('message', JSON.stringify({ type: 'join', name, charId })); return [s, h.players.get(s.lastOfType('init').id)]; };
  const [aS, a] = join('Agnes', 0), [bS, b] = join('Bridget', 3), [cS, c] = join('Cuthbert', 1);
  a.accountKey = 'agnes'; b.accountKey = 'bridget';
  b.room = 'wilds'; c.room = 'ember_wastes';
  const say = (s, m) => { s.sent.length = 0; s.emit('message', JSON.stringify(m)); };

  say(aS, { type: 'online_list' });
  const L = aS.lastOfType('online_list');
  check('the list has everyone but the asker, with a count that includes her', L && L.players.length === 2 && L.count === 3 && !L.players.some((p) => p.id === a.id));
  const B = L.players.find((p) => p.name === 'Bridget'), C = L.players.find((p) => p.name === 'Cuthbert');
  check('each says class, level and roughly where, never coordinates', B.cls === 'Knight' && B.level >= 1 && B.where === 'in the Wilds' && C.where === 'in the Ember Wastes' && !('x' in B) && !('y' in B) && !('room' in B));
  check('it says who has an account (a cottage or coven wants one), and signed-in players come first', B.account === true && C.account === false && L.players[0].name === 'Bridget');
  check('and what the asker can offer', L.me && L.me.account === true && L.me.coven === null);
  const where = h.online.placeOf;
  check('places are named the way a person would say them', where({ room: 'outside' }) === 'in town' && /^at the /.test(where({ room: 'library' })) && /Wildlands Village/.test(where({ room: 'vh_barn' })) && where({ room: 'dungeon_t2' }) === 'underground' && where({ room: 'somewhere_new' }) === 'about the place');

  say(aS, { type: 'whisper', targetId: b.id, text: 'Meet me at the coin tree' });
  const got = bS.lastOfType('whisper'), echo = aS.lastOfType('whisper');
  check('a whisper reaches the one it is for, and comes back to the sender', got && got.from.name === 'Agnes' && got.text === 'Meet me at the coin tree' && !got.outgoing && echo && echo.outgoing === true && echo.to.name === 'Bridget');
  check('and nobody else hears it', !cS.sent.some((m) => m.type === 'whisper'));
  say(aS, { type: 'whisper', targetId: a.id, text: 'hello me' });
  check('you cannot whisper to yourself', aS.lastOfType('whisper_error') && !aS.sent.some((m) => m.type === 'whisper'));
  say(aS, { type: 'whisper', targetId: 'nobody', text: 'hello?' });
  check('nor to someone who has gone', /not online/.test(aS.lastOfType('whisper_error').message));
  say(aS, { type: 'whisper', targetId: b.id, text: '   ' });
  check('an empty whisper is nothing', aS.sent.length === 0);
  const bad = require('../data/wordfilter');
  const term = (bad.BLOCKLIST || [])[0] || null;
  if (term) { bS.sent.length = 0; say(aS, { type: 'whisper', targetId: b.id, text: 'you ' + term }); check('the language filter stops a whisper as it does the open chat', /language filter/.test((aS.lastOfType('whisper_error') || {}).message || '') && !bS.sent.some((m) => m.type === 'whisper')); }
  else check('the whisper goes through the language filter', /wordFilter\.matchBlocked\(text\)/.test(fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8')));
  let dropped = 0; bS.sent.length = 0;
  for (let i = 0; i < 14; i++) { aS.emit('message', JSON.stringify({ type: 'whisper', targetId: c.id, text: 'spam ' + i })); }
  dropped = 14 - cS.sent.filter((m) => m.type === 'whisper').length;
  check('a flood of whispers is cut off', dropped >= 4, dropped);

  const main = fs.readFileSync(path.join(__dirname, '..', 'client/main.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  check('O opens and shuts it, not while typing or with another panel up', /if \(\(e\.key !== 'o' && e\.key !== 'O'\) \|\| e\.repeat \|\| typing \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey\) return;/.test(main) && /if \(!gameStarted \|\| menuUp \|\| Modals\.any\(\)\) return;\n {2}e\.preventDefault\(\);\n {2}openOnlinePanel\(\);/.test(main));
  check('it is second in the ☰ menu, after the map, and the people count on desktop opens it too', /id="menuMap"[^\n]*\n {6}<button class="menuRow" id="menuOnline"/.test(html) && /on\('menuOnline'/.test(main) && /pt\.addEventListener\('click', \(\) => openOnlinePanel\(\)\)/.test(main));
  check('each row can message, invite (party, coven, cottage) and mute or report', /'Send ' \+ p\.name \+ ' a message'/.test(main) && /To your party/.test(main) && /To your coven/.test(main) && /To your cottage/.test(main) && /openPlayerMenu\(\{ id: p\.id, name: p\.name \}, e\)/.test(main));
  check('whispers show in the chat log, a muted name\'s are not shown, and a name there answers', /if \(!msg\.outgoing && isMutedName\(other\.name\)\) return;/.test(main) && /div\.className = 'chatLine whisperLine';/.test(main) && /openOnlinePanel\(m\.otherId\)/.test(main));
  check('on a phone it is a full-screen panel with Close in reach', /<div id="onlineModal" class="floatPanel hidden">/.test(html) && /<button class="btn" id="onlineCloseBtn"/.test(html));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 400);
