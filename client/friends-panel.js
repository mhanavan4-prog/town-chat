// Friends, in the Players online panel (lib/friends.js on the server): who has
// asked, who your friends are and whether they are in, and a box to ask
// someone by name. Blocking lives in each player's "⋯" menu; the names you
// have blocked are listed at the foot so they can be let back in.

// Names the server says are blocked, lower-cased, for hiding their chat.
function blockedNameSet(state) {
  return new Set(((state && state.blocked) || []).map((n) => String(n).toLowerCase()));
}
function isFriendName(state, name) {
  const n = String(name || '').toLowerCase();
  return !!(state && (state.friends || []).some((f) => String(f.name).toLowerCase() === n));
}

// Builds the friends part of the panel. send(type, extra); whisperTo({id,name}).
function buildFriendsSection(state, send, whisperTo) {
  const box = document.createElement('div'); box.className = 'frBox';
  const head = (text) => { const h = document.createElement('div'); h.className = 'frHead'; h.textContent = text; return h; };
  const btn = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const row = (name, meta, color, buttons, dim) => {
    const r = document.createElement('div'); r.className = 'olRow' + (dim ? ' frOut' : '');
    const who = document.createElement('div'); who.className = 'olWho';
    const nm = document.createElement('div'); nm.className = 'olName'; if (color) nm.style.color = color; nm.textContent = name;
    const mt = document.createElement('div'); mt.className = 'olMeta'; mt.textContent = meta;
    who.append(nm, mt);
    const bs = document.createElement('div'); bs.className = 'olBtns'; bs.append(...buttons);
    r.append(who, bs); return r;
  };
  if (!state) { box.append(head('Friends'), Object.assign(document.createElement('div'), { className: 'olEmpty', textContent: 'Looking for your friends…' })); return box; }

  if (state.account) {
    if (state.requests.length) {
      box.append(head('Asking to be your friend'));
      for (const name of state.requests) {
        box.append(row(name, 'wants to be your friend', null, [
          btn('Accept', 'Be friends with ' + name, () => send('friend_accept', { name })),
          btn('No', 'Turn ' + name + ' down. They are not told.', () => send('friend_decline', { name })),
        ]));
      }
    }
    box.append(head(`Friends${state.friends.length ? ' · ' + state.friends.length : ''}`));
    if (!state.friends.length) box.append(Object.assign(document.createElement('div'), { className: 'olEmpty', textContent: 'No friends kept yet. Ask someone below, or by name.' }));
    for (const f of state.friends) {
      const buttons = [];
      if (f.online) buttons.push(btn('💬', 'Send ' + f.name + ' a message', () => whisperTo({ id: f.id, name: f.name })));
      buttons.push(btn('✕', 'Take ' + f.name + ' off your friends', () => send('friend_remove', { name: f.name })));
      box.append(row(f.name, f.online ? ['in now', f.where, f.level && 'Lv ' + f.level].filter(Boolean).join(' · ') : 'not in', f.online ? f.color : null, buttons, !f.online));
    }
    // ask by name: someone who is not in just now
    const form = document.createElement('form'); form.className = 'frAsk'; form.autocomplete = 'off';
    const input = document.createElement('input'); input.maxLength = 24; input.placeholder = 'Ask by name…'; input.id = 'friendAskName';
    const go = document.createElement('button'); go.type = 'submit'; go.className = 'btn'; go.textContent = 'Ask';
    form.append(input, go);
    const askNow = () => { const name = input.value.trim(); if (name) { send('friend_ask', { name }); input.value = ''; } };
    form.addEventListener('submit', (e) => { e.preventDefault(); askNow(); });
    // Enter is asked for here: the game's own key handling may swallow the form's submit
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); askNow(); } else if (e.key === 'Escape') { e.preventDefault(); input.blur(); } });
    box.append(form);
  } else {
    box.append(head('Friends'), Object.assign(document.createElement('div'), { className: 'olEmpty', textContent: 'Friends are kept on an account. Make one from the menu and they stay with you.' }));
  }
  if (state.blocked.length) {
    box.append(head('Blocked'));
    for (const name of state.blocked) box.append(row(name, 'cannot message or invite you', null, [btn('Unblock', 'Let ' + name + ' back in', () => send('unblock_player', { name }))], true));
  }
  return box;
}

export { blockedNameSet, isFriendName, buildFriendsSection };
