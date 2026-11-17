// ---------------------------------------------------------------------------
// Friends and the block list.
//
// Friends are kept between two accounts and both must agree: one asks, the
// other accepts. A friend is shown with whether she is in and roughly where
// (the same "roughly" as the Players online panel, never a spot on the map).
//
// Blocking is one-sided and quiet. Someone you have blocked cannot whisper you,
// invite you to a party or a coven, ask to be your friend or offer you a trade,
// and their open chat is not shown to you. They are not told. A guest can block
// too, for as long as she stays in; an account's list is kept.
//
//   state(player)            -> what the client is told
//   ask(player, who)         -> { ok, now? } or { error }   who: an online player's id, or a name
//   accept / decline / remove(player, name)
//   block(player, who) / unblock(player, name)
//   blocks(recipient, sender) -> true when recipient has blocked sender
// ---------------------------------------------------------------------------
const FRIENDS = { max: 100, pending: 30, blocked: 200 };

module.exports = function createFriends({ accounts, players, send, placeOf = () => '', levelOf = () => 1, save = () => {} }) {
  const lc = (s) => String(s || '').trim().toLowerCase();
  const nameOfKey = (key) => (accounts[key] && accounts[key].username) || key;
  function social(key) {
    const a = accounts[key];
    if (!a) return null;
    if (!a.social || typeof a.social !== 'object') a.social = { friends: [], asked: [], blocked: [] };
    for (const k of ['friends', 'asked', 'blocked']) if (!Array.isArray(a.social[k])) a.social[k] = [];
    return a.social;
  }
  function onlineByKey(key) { for (const p of players.values()) if (p && p.accountKey === key && !p._leaving) return p; return null; }

  // who: an online player's id, or a typed name. -> { key, name, player }
  function find(who) {
    const byId = players.get(String(who || ''));
    if (byId) return { key: byId.accountKey || null, name: byId.name, player: byId };
    const key = lc(who);
    if (key && accounts[key]) return { key, name: nameOfKey(key), player: onlineByKey(key) };
    for (const p of players.values()) if (p && lc(p.name) === key) return { key: p.accountKey || null, name: p.name, player: p };
    return null;
  }

  // The block list of whoever this is: kept on the account, or on the session for a guest.
  function blockedOf(player) {
    if (player.accountKey) { const s = social(player.accountKey); return s ? s.blocked : []; }
    if (!Array.isArray(player.guestBlocked)) player.guestBlocked = [];
    return player.guestBlocked;
  }
  function blocks(recipient, sender) {
    if (!recipient || !sender || recipient === sender) return false;
    const list = blockedOf(recipient);
    if (!list.length) return false;
    const key = sender.accountKey || null, name = lc(sender.name);
    return list.some((b) => (key && b.key === key) || (!b.key && lc(b.name) === name) || (!key && lc(b.name) === name));
  }

  function state(player) {
    const blocked = blockedOf(player).map((b) => b.name);
    if (!player.accountKey) return { type: 'friends_state', account: false, friends: [], requests: [], blocked, max: FRIENDS.max };
    const s = social(player.accountKey);
    const friends = s.friends.filter((k) => accounts[k]).map((k) => {
      const p = onlineByKey(k);
      return p ? { name: p.name, online: true, id: p.id, where: placeOf(p), level: levelOf(p), color: p.color || null } : { name: nameOfKey(k), online: false };
    });
    friends.sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name));
    return { type: 'friends_state', account: true, friends, requests: s.asked.filter((k) => accounts[k]).map(nameOfKey), blocked, max: FRIENDS.max };
  }
  const tell = (player, extra) => { if (player && player.ws) send(player.ws, { ...state(player), ...(extra || {}) }); };

  function befriend(aKey, bKey) {
    const a = social(aKey), b = social(bKey);
    if (!a.friends.includes(bKey)) a.friends.push(bKey);
    if (!b.friends.includes(aKey)) b.friends.push(aKey);
    a.asked = a.asked.filter((k) => k !== bKey); b.asked = b.asked.filter((k) => k !== aKey);
  }

  function ask(player, who) {
    if (!player.accountKey) return { error: 'Friends are kept on an account. Make one from the menu and they stay with you.' };
    const t = find(who);
    if (!t) return { error: 'No one of that name.' };
    if (!t.key) return { error: `${t.name} is here as a guest, and a guest cannot be kept as a friend.` };
    if (t.key === player.accountKey) return { error: 'That is you.' };
    const mine = social(player.accountKey), theirs = social(t.key);
    if (mine.friends.includes(t.key)) return { error: `${t.name} is already your friend.` };
    if (mine.blocked.some((b) => b.key === t.key)) return { error: `You have blocked ${t.name}. Unblock them first.` };
    if (mine.friends.length >= FRIENDS.max) return { error: `A friends list holds ${FRIENDS.max}.` };
    // they asked first: this is the answer
    if (mine.asked.includes(t.key)) {
      if (theirs.friends.length >= FRIENDS.max) return { error: `${t.name}'s friends list is full.` };
      befriend(player.accountKey, t.key); save();
      if (t.player) tell(t.player, { note: `${player.name} is now your friend.` });
      return { ok: true, now: true, name: t.name };
    }
    // blocked by them: it looks sent, and goes nowhere
    if (theirs.blocked.some((b) => b.key === player.accountKey)) return { ok: true, name: t.name };
    if (!theirs.asked.includes(player.accountKey)) {
      if (theirs.asked.length >= FRIENDS.pending) return { ok: true, name: t.name };
      theirs.asked.push(player.accountKey); save();
      if (t.player) tell(t.player, { note: `${player.name} asks to be your friend.`, asked: player.name });
    }
    return { ok: true, name: t.name };
  }

  function keyInList(list, name) { const n = lc(name); return list.find((k) => lc(nameOfKey(k)) === n || k === n) || null; }

  function accept(player, name) {
    if (!player.accountKey) return { error: 'Friends are kept on an account.' };
    const mine = social(player.accountKey), key = keyInList(mine.asked, name);
    if (!key) return { error: 'That request is gone.' };
    if (mine.friends.length >= FRIENDS.max) return { error: `A friends list holds ${FRIENDS.max}.` };
    if (social(key).friends.length >= FRIENDS.max) return { error: `${nameOfKey(key)}'s friends list is full.` };
    befriend(player.accountKey, key); save();
    const other = onlineByKey(key);
    if (other) tell(other, { note: `${player.name} is now your friend.` });
    return { ok: true, name: nameOfKey(key) };
  }
  function decline(player, name) {
    if (!player.accountKey) return { error: 'Friends are kept on an account.' };
    const mine = social(player.accountKey), key = keyInList(mine.asked, name);
    if (!key) return { error: 'That request is gone.' };
    mine.asked = mine.asked.filter((k) => k !== key); save();
    return { ok: true };
  }
  function unfriend(aKey, bKey) {
    const a = social(aKey), b = social(bKey);
    if (a) { a.friends = a.friends.filter((k) => k !== bKey); a.asked = a.asked.filter((k) => k !== bKey); }
    if (b) { b.friends = b.friends.filter((k) => k !== aKey); b.asked = b.asked.filter((k) => k !== aKey); }
  }
  function remove(player, name) {
    if (!player.accountKey) return { error: 'Friends are kept on an account.' };
    const key = keyInList(social(player.accountKey).friends, name);
    if (!key) return { error: 'They are not on your list.' };
    unfriend(player.accountKey, key); save();
    const other = onlineByKey(key);
    if (other) tell(other);   // their list changes; they are not told why
    return { ok: true };
  }

  function block(player, who) {
    const t = find(who);
    if (!t) return { error: 'No one of that name.' };
    if (t.player === player || (t.key && t.key === player.accountKey)) return { error: 'That is you.' };
    const list = blockedOf(player);
    if (list.some((b) => (t.key && b.key === t.key) || (!t.key && !b.key && lc(b.name) === lc(t.name)))) return { ok: true, name: t.name };
    if (list.length >= FRIENDS.blocked) return { error: `A block list holds ${FRIENDS.blocked}.` };
    list.push({ key: t.key || null, name: t.name });
    if (player.accountKey && t.key) { unfriend(player.accountKey, t.key); const other = onlineByKey(t.key); if (other) tell(other); }
    if (player.accountKey) save();
    return { ok: true, name: t.name };
  }
  function unblock(player, name) {
    const list = blockedOf(player), n = lc(name);
    const i = list.findIndex((b) => lc(b.name) === n);
    if (i < 0) return { error: 'They are not on your block list.' };
    list.splice(i, 1);
    if (player.accountKey) save();
    return { ok: true };
  }

  // A friend came in or went out: her friends who are in see their list change.
  function presence(player, cameIn) {
    if (!player || !player.accountKey) return;
    if (!cameIn) player._leaving = true;   // already gone, as her friends see it
    const s = social(player.accountKey);
    if (!s) return;
    for (const k of s.friends) { const f = onlineByKey(k); if (f && f !== player) tell(f, cameIn ? { note: `${player.name} has come in.`, quiet: true } : null); }
  }

  return { FRIENDS, state, ask, accept, decline, remove, block, unblock, blocks, presence };
};
