// ---------------------------------------------------------------------------
// The Macros panel (data/macros.js, lib/macros.js): build a chain of your own abilities and keep it on one button.
// Three macros to a class. Tap an ability to add it to the chain, tap a step to take it out; Save sends it to the
// server, which checks it and keeps it. Longer chains are bought here with Moonstones.
// The pure parts (what may be added, how a chain reads) are exported for the tests.
// ---------------------------------------------------------------------------

export const MACRO_PREFIX = 'macro_';
export const isMacroId = (id) => typeof id === 'string' && id.indexOf(MACRO_PREFIX) === 0;

// The catalog with her macros laid in beside her abilities, each a pseudo-ability of kind 'macro'.
export function withMacros(base, state) {
  if (!base) return null;
  const out = Object.assign({}, base);
  const list = (state && state.macros) || [];
  list.forEach((m, i) => {
    if (!m || !Array.isArray(m.steps)) return;
    const steps = m.steps.filter((id) => base[id]);
    if (steps.length < 2) return;
    out[MACRO_PREFIX + i] = { id: MACRO_PREFIX + i, name: m.name, icon: m.icon || '⛓️', kind: 'macro', effect: 'macro', steps,
      description: 'Casts in turn: ' + steps.map((id) => base[id].name || id).join(' → ') + '. Each keeps its own cooldown; one that is not ready is passed over.' };
  });
  return out;
}

// Which abilities can still be added to a chain: hers, open, not asking another's leave, not in it already.
export function macroChoices(base, steps, { open = () => true, barred = [] } = {}) {
  return Object.keys(base || {}).filter((id) => !isMacroId(id) && open(id) && barred.indexOf(base[id].effect) === -1 && steps.indexOf(id) === -1);
}

// Which steps of a chain go now: those she still has and that are not cooling.
export function macroReady(steps, { has = () => true, cooling = () => false } = {}) {
  return (steps || []).filter((id) => has(id) && !cooling(id));
}

export default function createMacrosPanel({ getState, getBase, abilityOpen, send, glyph, setUnlockToast, haptic = () => {} }) {
  let drafts = null;   // [{ name, icon, steps }] being edited
  let adding = -1;     // which macro's "add an ability" list is open
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const modal = () => document.getElementById('macrosModal');

  function freshDrafts() {
    const st = getState() || {}, list = st.macros || [];
    drafts = [];
    for (let i = 0; i < (st.slots || 3); i++) { const m = list[i]; drafts.push(m ? { name: m.name, icon: m.icon, steps: m.steps.slice() } : { name: '', icon: (st.icons || ['⛓️'])[0], steps: [] }); }
  }
  function open() {
    if (!getBase()) { setUnlockToast('Join with a class kit first.', { always: true }); return; }
    freshDrafts(); adding = -1;
    send({ type: 'macros' });
    render();
    modal().classList.remove('hidden');
  }
  function close() { modal().classList.add('hidden'); }
  const isOpen = () => !!modal() && !modal().classList.contains('hidden');

  // the server has spoken: what is kept is what is shown (a save took, or was refused)
  function onState(msg) {
    if (!isOpen()) return;
    if (msg && msg.error) { setUnlockToast('⛓️ ' + msg.error, { always: true }); render(); return; }
    freshDrafts();
    if (msg && msg.saved != null) { adding = -1; setUnlockToast('⛓️ Kept. It is on your bar; move it in Loadout.', { always: true }); }
    render();
  }

  function render() {
    const body = document.getElementById('macrosBody');
    if (!body) return;
    const st = getState() || {}, base = getBase() || {};
    if (!drafts) freshDrafts();
    body.innerHTML = '';
    const size = st.size || 2;
    const top = el('div', 'mcTop');
    top.appendChild(el('div', 'mcSize', `Your macros hold ${size} abilities each.`));
    if (st.account === false) top.appendChild(el('div', 'mcNote', 'Log into an account to keep macros.'));
    else if (st.next) {
      const up = el('button', 'btn mcUp', `Longer: ${st.next.steps} abilities for ${st.next.cost} 💎`);
      up.addEventListener('click', () => { haptic(10); send({ type: 'macro_upgrade' }); });
      top.appendChild(up);
    } else top.appendChild(el('div', 'mcNote', 'That is as long as macros go.'));
    body.appendChild(top);

    drafts.forEach((d, i) => {
      const card = el('div', 'mcCard');
      const head = el('div', 'mcHead');
      const ic = el('button', 'mcIcon', d.icon); ic.title = 'Change the mark';
      ic.addEventListener('click', () => { const icons = st.icons || ['⛓️']; d.icon = icons[(icons.indexOf(d.icon) + 1) % icons.length]; render(); });
      const name = el('input', 'mcName'); name.type = 'text'; name.maxLength = st.nameMax || 16; name.placeholder = `Macro ${i + 1}`; name.value = d.name;
      name.addEventListener('input', () => { d.name = name.value; });
      name.addEventListener('keydown', (e) => e.stopPropagation());   // typing a name is not pressing the hotbar
      name.addEventListener('keyup', (e) => e.stopPropagation());
      head.appendChild(ic); head.appendChild(name);
      card.appendChild(head);

      const chain = el('div', 'mcChain');
      if (!d.steps.length) chain.appendChild(el('span', 'mcEmpty', 'Empty. Add two abilities or more.'));
      d.steps.forEach((id, k) => {
        if (k) chain.appendChild(el('span', 'mcArrow', '→'));
        const chip = el('button', 'mcStep'); chip.title = 'Take it out';
        chip.innerHTML = glyph(id, base[id] && base[id].icon); chip.appendChild(el('span', 'mcStepName', (base[id] && base[id].name) || id));
        chip.addEventListener('click', () => { d.steps.splice(k, 1); render(); });
        chain.appendChild(chip);
      });
      card.appendChild(chain);

      const row = el('div', 'mcRow');
      const add = el('button', 'btn mcAdd', adding === i ? 'Close the list' : '＋ Add an ability');
      add.disabled = d.steps.length >= size && adding !== i;
      add.addEventListener('click', () => { adding = adding === i ? -1 : i; render(); });
      const save = el('button', 'btn mcSave', 'Save');
      save.disabled = d.steps.length < 2 || st.account === false;
      save.addEventListener('click', () => { haptic(12); send({ type: 'macro_save', slot: i, name: d.name, icon: d.icon, steps: d.steps }); });
      const clear = el('button', 'btn mcClear', 'Clear');
      clear.addEventListener('click', () => { d.steps = []; d.name = ''; adding = -1; if ((st.macros || [])[i]) send({ type: 'macro_save', slot: i, steps: [] }); render(); });
      row.appendChild(add); row.appendChild(save); row.appendChild(clear);
      card.appendChild(row);
      if (d.steps.length >= size) card.appendChild(el('div', 'mcNote', `Full at ${size}.` + (st.next ? ` Longer macros are ${st.next.cost} 💎.` : '')));

      if (adding === i) {
        const pick = el('div', 'mcPick');
        const choices = d.steps.length >= size ? [] : macroChoices(base, d.steps, { open: abilityOpen, barred: st.barred || [] });
        if (!choices.length) pick.appendChild(el('span', 'mcEmpty', d.steps.length >= size ? 'This chain is full.' : 'Nothing left to add.'));
        for (const id of choices) {
          const b = el('button', 'mcChoice'); b.innerHTML = glyph(id, base[id].icon); b.appendChild(el('span', 'mcStepName', base[id].name || id));
          b.addEventListener('click', () => { if (d.steps.length < size) d.steps.push(id); if (d.steps.length >= size) adding = -1; render(); });
          pick.appendChild(b);
        }
        card.appendChild(pick);
      }
      body.appendChild(card);
    });
    body.appendChild(el('div', 'mcFoot', 'A macro casts its abilities one after another. Each keeps its own cooldown and its own rules, as if you had pressed them in turn. Press the macro again to stop it.'));
  }

  return { open, close, isOpen, onState, render };
}
