// Who is online, and a quiet word to one of them (the 👥 Players online panel,
// O on a keyboard). The list says roughly where each is, never exactly; a
// whisper goes to that one person and comes back to the sender, through the
// same checks as the open chat: the mute list, the word filter and a flood
// guard.
const PLACES = {
  outside: 'in town', wilds: 'in the Wilds', ember_wastes: 'in the Ember Wastes', ember_refuge: 'at the Ember Refuge',
  witch_cave: 'in Hazel\'s cave', crypt: 'in the crypt', manor: 'at the Coven Manor', cottage: 'at a cottage',
  bank: 'at the bank', bank_vault: 'at the bank',
};

module.exports = function createOnline({ players, send, sanitizeText, isMuted = () => false, blocked = () => null, flood = () => 0,
  buildings = [], villageHouses = {}, levelOf = () => 1, classOf = () => '', covenNameOf = () => null, now = () => Date.now() }) {
  // building names carry their emoji ("📚 The Library"); a sentence wants the words
  const B = Object.fromEntries(buildings.map((b) => [b.id, String(b.name).replace(/^[^A-Za-z]+/, '')]));
  const VH = Object.fromEntries(Object.values(villageHouses).map((h) => [h.room, h.name]));

  function placeOf(p) {
    const r = String(p.room || '');
    if (PLACES[r]) return PLACES[r];
    if (B[r]) return `at ${/^The /.test(B[r]) ? B[r].replace(/^The /, 'the ') : 'the ' + B[r]}`;
    if (VH[r]) return `at ${VH[r].replace(/^The /, 'the ')}, in the Wildlands Village`;
    if (/^dungeon/.test(r)) return 'underground';
    if (/delve/.test(r)) return 'in the Delve';
    return 'about the place';
  }

  // Everyone online but the asker, the ones she can do most with first.
  function list(asker) {
    const out = [];
    for (const p of players.values()) {
      if (!p || p.id === asker.id || !p.name) continue;
      out.push({ id: p.id, name: p.name, color: p.color || '#e8dcc0', cls: classOf(p), level: levelOf(p),
        where: placeOf(p), account: !!p.accountKey, coven: covenNameOf(p) });
    }
    out.sort((a, b) => (b.account - a.account) || a.name.localeCompare(b.name));
    // and what the asker can offer: a cottage wants an account, a coven a coven
    return { type: 'online_list', players: out, count: out.length + 1, me: { account: !!asker.accountKey, coven: covenNameOf(asker) }, at: now() };
  }

  function whisper(player, targetId, raw) {
    const target = players.get(String(targetId || ''));
    if (!target || target.id === player.id) { send(player.ws, { type: 'whisper_error', message: 'They are not online now.' }); return false; }
    const text = sanitizeText(raw);
    if (!text) return false;
    if (isMuted(player)) return false;   // a muted account is silently dropped, as in the open chat
    const why = blocked(text, player);
    if (why) { send(player.ws, { type: 'whisper_error', message: why }); return false; }
    if (flood(player) > 8) { send(player.ws, { type: 'whisper_error', message: 'Slow down a little.' }); return false; }
    const ts = now();
    send(target.ws, { type: 'whisper', from: { id: player.id, name: player.name, color: player.color }, text, ts });
    send(player.ws, { type: 'whisper', to: { id: target.id, name: target.name, color: target.color }, text, ts, outgoing: true });
    return true;
  }

  return { list, whisper, placeOf };
};
