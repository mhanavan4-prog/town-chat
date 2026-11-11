// ---------------------------------------------------------------------------
// Threshold & Hearth (blueprint B) — the Wards of the House panel.
//
// Three real house-wards, worked at your own cottage: bury a witch bottle under
// the hearth, scribe a daisy wheel over the door (a compass minigame — one
// circle, six arcs, one radius, each arc set from where the last crossed the
// circle), and conceal a worn shoe by the chimney. State comes from the server
// (`wards_state`); every text node is set with textContent.
// ---------------------------------------------------------------------------
import { Modals } from './modals.js';

const WARDS_SVGNS = 'http://www.w3.org/2000/svg';
const WARDS_TIER_LABEL = { record: 'Archaeological / documentary', folk: 'Folk tradition', revival: 'Modern revival' };

export default function createWards({ send }) {
  let state = null;
  let compass = null; // the hexafoil minigame in progress
  let draw = null;    // the other drawn marks in progress: { kind: 'marian' | 'pentangle' | 'sator', … }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function open() {
    Modals.set('wardsOpen', true);
    document.getElementById('wardsModal').classList.remove('hidden');
    compass = null; draw = null;
    send({ type: 'wards_state' });
    render();
  }
  function close() {
    Modals.set('wardsOpen', false);
    document.getElementById('wardsModal').classList.add('hidden');
    compass = null; draw = null;
  }
  function setState(s) {
    state = s;
    if (draw && state && draw.kind === 'sheaf') {
      const h = state.lastSheaf && state.lastSheaf.hanging;
      if (h && h.at !== draw.prevAt) { draw.done = true; draw.pending = false; }
    } else if (draw && state && (draw.kind === 'bottle' ? state.bottle === 'buried' : state[draw.kind])) { draw.done = true; draw.pending = false; }
    if (Modals.isOpen('wardsOpen')) render();
  }
  // The server turned a drawing down: say why, and let the hand try again.
  function error(message) {
    if (!draw || !draw.pending) return;
    draw.pending = false; draw.slips++;
    draw.note = message || 'Not quite. Try again.';
    if (draw.kind === 'marian') { draw.cuts = []; draw.anchor = null; }
    if (draw.kind === 'pentangle') { draw.seq = []; draw.trail = []; }
    if (Modals.isOpen('wardsOpen')) render();
  }

  function loreBox(w) {
    const box = el('div', 'wardLore');
    box.appendChild(el('span', 'callerTier callerTier-' + w.tier, WARDS_TIER_LABEL[w.tier] || w.tier));
    box.appendChild(el('div', 'callerLoreText', w.lore));
    box.appendChild(el('div', 'callerSource', `Source: ${w.source}`));
    return box;
  }

  function wardCard(key, statusText, done) {
    const w = state.lore[key];
    const card = el('div', 'wardCard' + (done ? ' done' : ''));
    card.dataset.ward = key;
    const head = el('div', 'wardHead');
    head.appendChild(el('span', 'wardIcon', w.icon));
    const t = el('div', 'wardTitleWrap');
    t.appendChild(el('div', 'wardTitle', `${w.name} — ${w.where}`));
    t.appendChild(el('div', 'wardStatus', statusText));
    head.appendChild(t);
    card.appendChild(head);
    card.appendChild(el('div', 'wardBlurb', w.blurb));
    return card;
  }

  function render() {
    const body = document.getElementById('wardsBody');
    if (!body) return;
    body.innerHTML = '';
    if (!state) { body.appendChild(el('div', 'slNote', 'Walking the bounds of the house…')); return; }
    if (compass) { renderCompass(body); return; }
    if (draw) { if (draw.kind === 'bottle') { renderBottle(body); return; } if (draw.kind === 'rowan') { renderRowan(body); return; } if (draw.kind === 'horseshoe') { renderHorseshoe(body); return; } if (draw.kind === 'hagstone') { renderHagstone(body); return; } if (draw.kind === 'sheaf') { renderSheaf(body); return; } if (draw.kind === 'marian') renderMarian(body); else if (draw.kind === 'pentangle') renderPentangle(body); else if (draw.kind === 'burn') renderBurn(body); else renderSator(body); return; }

    const intro = el('div', 'wardIntro', state.atHome
      ? 'Old houses were warded at their weak places — the hearth, the door, the chimney. Work your own.'
      : 'Wards are worked at home. Step inside your own cottage to set them; you can read about them anywhere.');
    body.appendChild(intro);
    if (state.hearthWitch) body.appendChild(el('div', 'wardHearth', '🛡️ You walk the Hearth Path — your wards hold stronger: a bottle turns more curses, and each mark guards more.'));
    const pct = Math.round(state.guardEach * 100);
    const cols = el('div', 'menuCols'); // the four marks in two columns in the wide frame
    body.appendChild(cols);

    // 🍶 The witch bottle
    {
      const status = state.bottle === 'buried' ? `Buried · turns ${state.charges} more curse${state.charges === 1 ? '' : 's'}`
        : state.bottle === 'spent' ? 'Spent — the last one cracked. Bury another.' : 'None buried';
      const card = wardCard('bottle', status, state.bottle === 'buried');
      if (state.bottle !== 'buried') {
        const b = el('button', 'btn wardBtn', state.haveBottle ? `Fill and bury a witch bottle (holds ${state.maxCharges})` : 'Need a witch bottle');
        b.disabled = !state.atHome || !state.haveBottle;
        b.addEventListener('click', () => { draw = { kind: 'bottle', contents: [], bent: 0, corked: false, place: null, inverted: null, slips: 0, note: 'What goes in it? Urine first, then something sharp, as Blagrave has it.' }; render(); });
        card.appendChild(b);
        if (!state.haveBottle) card.appendChild(el('div', 'wardHow', "Hazel brews one at her cauldron from a Bellarmine Jug (Apothecary Vex), Bent Pins (Tailor Ines) and Iron Nails (Armorer Beck)."));
      }
      card.appendChild(loreBox(state.lore.bottle));
      cols.appendChild(card);
    }
    // ✡ The daisy wheel
    {
      const card = wardCard('hexafoil', state.hexafoil ? `Cut over the door · +${pct}% damage resist` : 'Not yet drawn', state.hexafoil);
      if (!state.hexafoil) {
        const b = el('button', 'btn wardBtn', 'Take up the compasses');
        b.disabled = !state.atHome;
        b.addEventListener('click', () => { compass = newCompass(); render(); });
        card.appendChild(b);
      }
      card.appendChild(loreBox(state.lore.hexafoil));
      cols.appendChild(card);
    }
    // Ⓜ️ The Marian mark, cut on the hearth beam
    if (state.lore.marian) {
      const card = wardCard('marian', state.marian ? `Cut on the hearth beam · +${pct}% damage resist` : 'Not yet cut', state.marian);
      if (!state.marian) {
        const b = el('button', 'btn wardBtn', 'Take up the knife');
        b.disabled = !state.atHome;
        b.addEventListener('click', () => { draw = { kind: 'marian', cuts: [], anchor: null, drag: null, slips: 0, note: 'Four cuts, each from a nick on the top edge to one on the bottom. Two Vs, the second crossing the first.' }; render(); });
        card.appendChild(b);
      }
      card.appendChild(loreBox(state.lore.marian));
      cols.appendChild(card);
    }
    // 🕯️ The taper burn mark, scorched on the door frame
    if (state.lore.burn) {
      const card = wardCard('burn', state.burn ? `Scorched on the door frame · +${pct}% damage resist` : 'Not yet burned', state.burn);
      if (!state.burn) {
        const b = el('button', 'btn wardBtn', 'Light the taper');
        b.disabled = !state.atHome;
        b.addEventListener('click', () => { draw = { kind: 'burn', slips: 0, note: 'Press and hold to set the flame to the beam; drag to slant the taper. Hold it there until the tear-shape forms, then let go.' }; render(); });
        card.appendChild(b);
      }
      card.appendChild(loreBox(state.lore.burn));
      cols.appendChild(card);
    }
    // 🍽️ The SATOR plate, kept by the hearth
    if (state.lore.sator) {
      const card = wardCard('sator', state.sator ? `Kept by the hearth · +${pct}% damage resist` : 'Not yet written', state.sator);
      if (!state.sator) {
        const b = el('button', 'btn wardBtn', 'Write the square');
        b.disabled = !state.atHome;
        b.addEventListener('click', () => { draw = { kind: 'sator', rows: ['', '', '', '', ''], slips: 0, note: 'Five words of five letters. Set them so the square reads the same across, down, and from either end.' }; render(); });
        card.appendChild(b);
      }
      card.appendChild(loreBox(state.lore.sator));
      cols.appendChild(card);
    }
    // 👞 The concealed shoe
    {
      const card = wardCard('shoe', state.shoe ? `Hidden by the chimney · +${pct}% damage resist` : 'None hidden', state.shoe);
      if (!state.shoe) {
        if (state.feet && state.feet.length) {
          const row = el('div', 'wardShoes');
          for (const f of state.feet) {
            const b = el('button', 'btn wardBtn wardShoeBtn', `Conceal ${f.icon} ${f.name}`);
            b.dataset.item = f.itemId;
            b.disabled = !state.atHome;
            b.addEventListener('click', () => { b.disabled = true; send({ type: 'conceal_shoe', itemId: f.itemId }); });
            row.appendChild(b);
          }
          card.appendChild(row);
        } else {
          card.appendChild(el('div', 'wardHow', 'You need a worn shoe in your pack — boots you have grown out of will do. It is hidden for good.'));
        }
      }
      card.appendChild(loreBox(state.lore.shoe));
      cols.appendChild(card);
    }
    // 🪶 The witch's ladder (harvest luck, not a guard)
    if (state.lore.ladder) {
      const fpct = Math.round((state.ladderForage || 0) * 100);
      const card = wardCard('ladder', state.ladder ? `Hanging in the rafters · +${fpct}% harvest luck` : 'None hung', state.ladder);
      if (!state.ladder) {
        const parts = state.ladderParts || [];
        const ready = parts.length && parts.every((pt) => pt.have >= pt.qty);
        const b = el('button', 'btn wardBtn', ready ? "Tie and hang a witch's ladder" : "Need cord and feathers");
        b.disabled = !state.atHome || !ready;
        b.addEventListener('click', () => { b.disabled = true; send({ type: 'hang_witch_ladder' }); });
        card.appendChild(b);
        card.appendChild(el('div', 'wardHow', parts.map((pt) => `${pt.name} ${Math.min(pt.have, pt.qty)}/${pt.qty}`).join(' · ') + ' — both from Tailor Ines.'));
      }
      card.appendChild(loreBox(state.lore.ladder));
      cols.appendChild(card);
    }
    horseshoeCard(cols, pct);
    hagstoneCard(cols, pct);
    rowanCard(cols, pct);
    sheafCard(cols, pct);
    pentangleCard(cols);
    sortWardCards(body, cols);
  }

  // Twelve cards is a long scroll on a phone: a strip of every ward at the top
  // (lit when made; tap one to go to it), then the cards grouped by where they
  // go in the house. A made ward's lore folds shut under it; an unmade one's
  // stays open to read (on a computer; on a phone all start folded). (Cards are built in any order above and placed here.)
  const WARD_GROUPS = [
    { key: 'door', title: '🚪 At the door', wards: ['hexafoil', 'burn', 'horseshoe', 'rowan'] },
    { key: 'hearth', title: '🔥 At the hearth and chimney', wards: ['bottle', 'marian', 'sator', 'shoe'] },
    { key: 'house', title: '🛏️ About the house', wards: ['hagstone', 'ladder', 'sheaf'] },
    { key: 'worn', title: '🛡️ Worn on you', wards: ['pentangle'] },
  ];
  function sortWardCards(body, cols) {
    const cards = [...cols.querySelectorAll(':scope > .wardCard')];
    const byKey = new Map(cards.map((c) => [c.dataset.ward, c]));
    const placed = new Set(WARD_GROUPS.flatMap((g) => g.wards));
    const groups = WARD_GROUPS.map((g) => ({ ...g, cards: g.wards.map((k) => byKey.get(k)).filter(Boolean) }));
    const other = cards.filter((c) => !placed.has(c.dataset.ward));
    if (other.length) groups.push({ key: 'other', title: '✨ Others', cards: other });
    const ordered = groups.flatMap((g) => g.cards);
    // The strip.
    const made = ordered.filter((c) => c.classList.contains('done')).length;
    const strip = el('div', 'wardSummary');
    strip.appendChild(el('div', 'wardSumCount', `${made} of ${ordered.length} made`));
    const icons = el('div', 'wardSumIcons');
    for (const c of ordered) {
      const w = state.lore[c.dataset.ward] || {};
      const done = c.classList.contains('done');
      const b = el('button', 'wardSumIcon' + (done ? ' made' : ''), w.icon || '•');
      b.type = 'button';
      b.title = `${w.name || c.dataset.ward}: ${done ? 'made' : 'not yet'}`;
      b.setAttribute('aria-label', b.title);
      b.addEventListener('click', () => { c.scrollIntoView({ block: 'start', behavior: 'smooth' }); c.classList.add('wardFlash'); setTimeout(() => c.classList.remove('wardFlash'), 1200); });
      icons.appendChild(b);
    }
    strip.appendChild(icons);
    cols.before(strip);
    // The groups.
    for (const g of groups) {
      if (!g.cards.length) continue;
      const sec = el('div', 'wardGroup');
      sec.dataset.group = g.key;
      const n = g.cards.filter((c) => c.classList.contains('done')).length;
      sec.appendChild(el('div', 'wardGroupHead', `${g.title} · ${n}/${g.cards.length}`));
      const grid = el('div', 'menuCols');
      for (const c of g.cards) grid.appendChild(c);
      sec.appendChild(grid);
      cols.before(sec);
    }
    cols.remove();
    // The lore, folded under a made ward, open under one still to make.
    for (const c of ordered) {
      const lore = c.querySelector(':scope > .wardLore');
      if (!lore) continue;
      const fold = document.createElement('details');
      fold.className = 'wardLoreFold';
      // On a phone every card's lore starts folded (the scroll is long enough).
      fold.open = !c.classList.contains('done') && !(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
      fold.appendChild(el('summary', '', '📜 The record, and where it comes from'));
      lore.before(fold);
      fold.appendChild(lore);
    }
  }


  // 🧲 The found horseshoe, and 🪨 the hag stone (data/wards.js).
  function horseshoeCard(cols, pct) {
    if (!state.lore.horseshoe || !state.horseshoePlaces) return;
    const where = state.horseshoe && state.horseshoePlaces[state.horseshoe];
    const card = wardCard('horseshoe', where ? `${where.label}, ${state.horseshoeUp === 'points_down' ? 'points down' : 'points up'} · +${pct}% damage resist` : 'None nailed up', !!where);
    if (!where) {
      const b = el('button', 'btn wardBtn', state.haveHorseshoe ? 'Nail up the horseshoe you found' : 'Find a horseshoe first');
      b.disabled = !state.atHome || !state.haveHorseshoe;
      b.addEventListener('click', () => { draw = { kind: 'horseshoe', place: null, up: null, slips: 0, note: 'Where will it go?' }; render(); });
      card.appendChild(b);
      if (!state.haveHorseshoe) card.appendChild(el('div', 'wardHow', 'It should be one you find, not one you buy. Horses cast their shoes: keep an eye on the ground as you gather.'));
    }
    card.appendChild(loreBox(state.lore.horseshoe));
    cols.appendChild(card);
  }
  function renderHorseshoe(body) {
    body.appendChild(el('div', 'wardIntro', '🧲 Nail up the horseshoe you found'));
    keysPanel(body, 'Where', Object.entries(state.horseshoePlaces).map(([k, p]) => ({
      text: `${draw.place === k ? '✓ ' : ''}${p.label} (${p.note})`, disabled: draw.pending || draw.done,
      on: () => { draw.place = k; draw.note = `${p.label}, as ${p.note} has it.`; render(); } })));
    keysPanel(body, 'Which way up (the old writers don\'t say)', [
      { text: `${draw.up === 'points_up' ? '✓ ' : ''}Points up`, disabled: draw.pending || draw.done, on: () => { draw.up = 'points_up'; draw.note = 'Points up.'; render(); } },
      { text: `${draw.up === 'points_down' ? '✓ ' : ''}Points down`, disabled: draw.pending || draw.done, on: () => { draw.up = 'points_down'; draw.note = 'Points down.'; render(); } },
    ]);
    keysPanel(body, 'And', [{ text: '🔨 Nail it up', disabled: draw.pending || draw.done || !draw.place || !draw.up,
      on: () => { draw.pending = true; draw.note = 'Three good blows…'; send({ type: 'nail_horseshoe', place: draw.place, up: draw.up }); render(); } }]);
    drawFooter(body, 'Put the horseshoe away');
  }
  function hagstoneCard(cols, pct) {
    if (!state.lore.hagstone || !state.hagstonePlaces) return;
    const where = state.hagstone && state.hagstonePlaces[state.hagstone];
    const card = wardCard('hagstone', where ? `${where.label} · +${pct}% damage resist` : 'None hung', !!where);
    if (!where) {
      const b = el('button', 'btn wardBtn', 'Hang a hag stone');
      b.disabled = !state.atHome;
      b.addEventListener('click', () => { draw = { kind: 'hagstone', stone: null, place: null, slips: 0, note: 'Which stone?' }; render(); });
      card.appendChild(b);
      if (!state.haveHagstone) card.appendChild(el('div', 'wardHow', 'It must be holed by nature. Look at the foot of the crotal stones in the Wilds as you scrape them.'));
    }
    card.appendChild(loreBox(state.lore.hagstone));
    cols.appendChild(card);
  }
  function renderHagstone(body) {
    body.appendChild(el('div', 'wardIntro', '🪨 Hang a hag stone against the night-hag'));
    keysPanel(body, 'Which stone', [
      { text: `${draw.stone === 'natural' ? '✓ ' : ''}The holed stone you found${state.haveHagstone ? '' : ' (you have none)'}`, disabled: draw.pending || draw.done || !state.haveHagstone,
        on: () => { draw.stone = 'natural'; draw.note = 'Holed right through, and nobody made the hole.'; render(); } },
      { text: `${draw.stone === 'bored' ? '✓ ' : ''}A pebble you bore through yourself`, disabled: draw.pending || draw.done,
        on: () => { draw.stone = 'bored'; draw.note = 'A good round pebble, and an awl.'; render(); } },
    ]);
    keysPanel(body, 'Where', Object.entries(state.hagstonePlaces).map(([k, p]) => ({
      text: `${draw.place === k ? '✓ ' : ''}${p.label} (${p.note})`, disabled: draw.pending || draw.done,
      on: () => { draw.place = k; draw.note = `${p.label}.`; render(); } })));
    keysPanel(body, 'And', [{ text: '🪨 Hang it', disabled: draw.pending || draw.done || !draw.stone || !draw.place,
      on: () => { draw.pending = true; draw.note = 'You thread the string…'; send({ type: 'hang_hagstone', stone: draw.stone, place: draw.place }); render(); } }]);
    drawFooter(body, 'Put the stone down');
  }

  // ✝️ The rowan cross over the door: the Scots way or the Manx (data/wards.js).
  function rowanCard(cols, pct) {
    if (!state.lore.rowan || !state.rowanWays) return;
    const card = wardCard('rowan', state.rowan ? `Over the door, made the ${state.rowan === 'manx' ? 'Manx' : 'Scots'} way · +${pct}% damage resist` : 'Not yet made', !!state.rowan);
    if (!state.rowan) {
      const can = Object.values(state.rowanWays).some((r) => r.parts.every((pt) => pt.have >= pt.qty));
      const b = el('button', 'btn wardBtn', can ? 'Make a rowan cross' : 'Need a sprig of rowan');
      b.disabled = !state.atHome || !can;
      b.addEventListener('click', () => { draw = { kind: 'rowan', way: null, tool: null, finish: null, slips: 0, note: 'Which way will you make it?' }; render(); });
      card.appendChild(b);
      card.appendChild(el('div', 'wardHow', Object.values(state.rowanWays).map((r) => `${r.label}: ${r.parts.map((pt) => `${pt.name} ${Math.min(pt.have, pt.qty)}/${pt.qty}`).join(', ')}`).join(' · ') + '. Red thread from Tailor Ines.'));
    }
    card.appendChild(loreBox(state.lore.rowan));
    cols.appendChild(card);
  }

  function renderRowan(body) {
    const W = state.rowanWays;
    body.appendChild(el('div', 'wardIntro', '✝️ Make a rowan cross and set it over the door'));
    keysPanel(body, 'Which way', Object.entries(W).map(([k, r]) => {
      const short = r.parts.find((pt) => pt.have < pt.qty);
      return { text: `${draw.way === k ? '✓ ' : ''}${r.label}${short ? ` (need ${short.name})` : ''}`, aria: `${r.label}. ${r.how}`, disabled: draw.pending || draw.done || !!short,
        on: () => { draw.way = k; draw.tool = null; draw.finish = null; draw.note = r.how; render(); } };
    }));
    if (draw.way) {
      keysPanel(body, 'Take two twigs from the rowan', [
        { text: `${draw.tool === 'hand' ? '✓ ' : ''}Break them off by hand`, disabled: draw.pending || draw.done, on: () => { draw.tool = 'hand'; draw.note = 'Two twigs, broken off by hand.'; render(); } },
        { text: `${draw.tool === 'knife' ? '✓ ' : ''}Cut them with your knife`, disabled: draw.pending || draw.done, on: () => { draw.tool = 'knife'; draw.note = 'Two twigs, cut clean.'; render(); } },
      ]);
    }
    if (draw.way === 'scots' && draw.tool) {
      keysPanel(body, 'Bind them crosswise with the red thread, then', [
        { text: `${draw.finish === 'knot' ? '✓ ' : ''}Tie it off with a knot`, disabled: draw.pending || draw.done, on: () => { draw.finish = 'knot'; draw.note = 'A good tight knot.'; render(); } },
        { text: `${draw.finish === 'tuck' ? '✓ ' : ''}Tuck the end under the winding`, disabled: draw.pending || draw.done, on: () => { draw.finish = 'tuck'; draw.note = 'The end tucked under, no knot anywhere in it.'; render(); } },
      ]);
    }
    const ready = draw.way && draw.tool && (draw.way !== 'scots' || draw.finish);
    keysPanel(body, 'And', [{ text: '✝️ Set it over the door', disabled: draw.pending || draw.done || !ready,
      on: () => { draw.pending = true; draw.note = 'You reach up to the lintel…'; send({ type: 'make_rowan_cross', way: draw.way, tool: draw.tool, finish: draw.finish }); render(); } }]);
    drawFooter(body, 'Put the rowan down');
  }

  // 🌾 The last sheaf: plaited at harvest, kept for its year (data/lastSheaf.js).
  function sheafCard(cols, pct) {
    const L = state.lastSheaf;
    if (!state.lore.sheaf || !L) return;
    const h = L.hanging, form = h && L.forms[h.form];
    const card = wardCard('sheaf', form ? `${form.name}, ${form.hangs} · +${pct}% damage resist` : 'None kept', !!form);
    if (form && L.endDue) {
      const end = L.ends[h.end];
      const b = el('button', 'btn wardBtn', `${form.icon} ${end.act}`);
      b.disabled = !state.atHome;
      b.addEventListener('click', () => { b.disabled = true; send({ type: 'end_last_sheaf' }); });
      card.appendChild(b);
    }
    if (L.canPlait) {
      const b = el('button', 'btn wardBtn', form ? 'Take it down and plait this year\'s' : 'Plait the last sheaf');
      b.disabled = !state.atHome;
      b.addEventListener('click', () => { draw = { kind: 'sheaf', form: null, end: null, ears: [], prevAt: h ? h.at : null, slips: 0, note: 'Which sheaf will you make? Each is as one part of the country kept it.' }; render(); });
      card.appendChild(b);
    }
    if (form && !L.endDue && !L.canPlait) {
      card.appendChild(el('div', 'wardHow', h.end === 'harvest' ? `It hangs till the next harvest (${L.endWhen.harvest}), when this year's takes its place.`
        : `${L.ends[h.end].promise} That comes round at ${L.endWhen[h.end]}.`));
    } else if (!form && !L.canPlait) {
      card.appendChild(el('div', 'wardHow', `The last sheaf is plaited when the last of the corn is cut: come back at ${L.plaitWhen}.`));
    }
    card.appendChild(loreBox(state.lore.sheaf));
    cols.appendChild(card);
  }

  // Picking out the best ears, choosing the form, and how its year will end.
  function renderSheaf(body) {
    const L = state.lastSheaf;
    body.appendChild(el('div', 'wardIntro', '🌾 Plait the last sheaf and keep it'));
    // Which sheaf: the three forms the collectors wrote down.
    keysPanel(body, 'Which sheaf', Object.entries(L.forms).map(([k, f]) => ({
      text: `${draw.form === k ? '✓ ' : ''}${f.icon} ${f.name} (${f.country})`, aria: `${f.name}, ${f.country}. ${f.how}`, disabled: draw.pending || draw.done,
      on: () => { draw.form = k; if (!f.ends[draw.end]) draw.end = null; draw.note = f.how; render(); },
    })));
    // The best ears: full ones and thin ones lie together; take every full one.
    const NS = WARDS_SVGNS;
    const row = el('div', 'sheafEars');
    L.ears.forEach((full, i) => {
      const on = draw.ears.includes(i);
      const b = el('button', 'btn sheafEar' + (on ? ' on' : ''));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', `Ear ${i + 1}: ${full ? 'full and heavy' : 'thin'}${on ? ', picked' : ''}`);
      b.disabled = draw.pending || draw.done;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 64'); svg.setAttribute('aria-hidden', 'true');
      const add = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const a in attrs) n.setAttribute(a, attrs[a]); svg.appendChild(n); return n; };
      add('line', { x1: 12, y1: 30, x2: 12, y2: 62, class: 'sheafStalk' });
      const grains = full ? 7 : 4;
      for (let g = 0; g < grains; g++) {
        const y = 6 + g * (full ? 3.6 : 5.5), side = g % 2 ? 1 : -1;
        add('ellipse', { cx: 12 + side * (full ? 3.2 : 2), cy: y, rx: full ? 3.2 : 1.6, ry: full ? 4.2 : 3, class: full ? 'sheafGrain' : 'sheafGrain thin' });
      }
      b.appendChild(svg);
      b.addEventListener('click', () => { draw.ears = on ? draw.ears.filter((x) => x !== i) : [...draw.ears, i]; draw.note = full ? 'A full ear, heavy in the hand.' : 'A thin ear. Hunt\'s reaper picked out "the best ears he can find".'; render(); });
      row.appendChild(b);
    });
    const earBox = el('div', 'kbPanel');
    earBox.appendChild(el('div', 'kbLabel', `The best ears (${draw.ears.length} picked)`));
    earBox.appendChild(row);
    body.appendChild(earBox);
    // How its year ends: only the endings recorded for that sheaf.
    const f = draw.form && L.forms[draw.form];
    if (f) {
      keysPanel(body, 'How its year ends', Object.entries(f.ends).map(([k, line]) => ({
        text: `${draw.end === k ? '✓ ' : ''}${L.ends[k].label}`, aria: `${L.ends[k].label}. ${line}`, disabled: draw.pending || draw.done,
        on: () => { draw.end = k; draw.note = line; render(); },
      })));
    }
    keysPanel(body, 'And', [{ text: `${f ? f.icon : '🌾'} Plait it and ${f ? f.put : 'keep it'}`, disabled: draw.pending || draw.done || !f || !draw.end,
      on: () => { draw.pending = true; draw.note = 'You plait the straws…'; send({ type: 'plait_last_sheaf', form: draw.form, end: draw.end, ears: draw.ears.slice() }); render(); } }]);
    drawFooter(body, 'Leave it for now');
  }

  // 🛡️ Gawain's pentangle: not a house mark, so drawn anywhere, and shown last.
  function pentangleCard(cols) {
    if (!state.lore.pentangle) return;
    const card = wardCard('pentangle', state.pentangle ? `Borne on shield and coat · +${state.pentangleVitality || 10} max health` : 'Not yet painted', state.pentangle);
    if (!state.pentangle) {
      const b = el('button', 'btn wardBtn', 'Take up the brush');
      b.addEventListener('click', () => { draw = { kind: 'pentangle', seq: [], trail: [], drawing: false, slips: 0, note: 'Set the brush on any point and draw the star in one stroke. Don\'t lift it until the knot is closed.' }; render(); });
      card.appendChild(b);
    }
    card.appendChild(loreBox(state.lore.pentangle));
    cols.appendChild(card);
  }

  // ── Shared bits for the drawn marks ───────────────────────────────────────
  function svgBoard(cls) {
    const svg = document.createElementNS(WARDS_SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 260 260');
    svg.setAttribute('class', 'hexCanvas ' + cls);
    const add = (tag, attrs) => { const n = document.createElementNS(WARDS_SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
    const at = (e) => { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left) * 260 / r.width, (e.clientY - r.top) * 260 / r.height]; };
    return { svg, add, at };
  }
  // The same drawing by keys: a row of buttons a keyboard or screen reader can
  // reach, each doing what a tap on the board would.
  function keysPanel(body, label, items) {
    const box = el('div', 'kbPanel');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', label);
    box.appendChild(el('div', 'kbLabel', label));
    for (const it of items) {
      if (it.node) { box.appendChild(it.node); continue; }
      const b = el('button', 'btn kbBtn', it.text);
      if (it.aria) b.setAttribute('aria-label', it.aria);
      b.disabled = !!it.disabled;
      b.addEventListener('click', it.on);
      box.appendChild(b);
    }
    body.appendChild(box);
  }
  const live = (node) => { node.setAttribute('aria-live', 'polite'); return node; };
  function drawFooter(body, idleLabel) {
    body.appendChild(live(el('div', 'hexNote', draw.done ? 'Done.' : draw.note)));
    if (draw.slips && !draw.done) body.appendChild(el('div', 'hexSlips', `Tried ${draw.slips} time${draw.slips === 1 ? '' : 's'} so far.`));
    const back = el('button', 'btn wardBtn wardBack', draw.done ? 'Back to the house' : idleLabel);
    back.addEventListener('click', () => { draw = null; render(); });
    body.appendChild(back);
  }
  const NEAR = 16;
  const nearest = (pts, x, y) => { let best = -1, bd = NEAR; pts.forEach((p, i) => { const d = Math.hypot(x - p[0], y - p[1]); if (d <= bd) { bd = d; best = i; } }); return best; };

  // ── The witch bottle, filled and set by hand (data/wards.js bottleProblem) ─
  function renderBottle(body) {
    const f = state.bottleFill || { fillings: [], places: {}, pins: 3 };
    body.appendChild(el('div', 'wardIntro', '🍶 Fill the bottle, cork it fast, and bury it'));
    // The jug, with what is in it so far, and the pins as they lie.
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 160 170'); svg.setAttribute('class', 'bottleJug');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `The jug: ${draw.contents.length ? draw.contents.map((k) => (f.fillings.find((x) => x.key === k) || {}).label).join(', ') : 'empty'}${draw.corked ? ', corked' : ''}.`);
    const add = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
    add('path', { d: 'M62 18 h36 v22 q34 14 34 62 q0 52 -52 56 q-52 -4 -52 -56 q0 -48 34 -62 z', class: 'bottleBody' });
    add('path', { d: 'M64 50 q16 6 32 0 q-2 14 -16 30 q-14 -16 -16 -30 z', class: 'bottleBeard' }); // the bearded face of a Bartmann jug
    add('path', { d: 'M70 58 l4 14 M80 60 l0 16 M90 58 l-4 14', class: 'bottleBeardLine' });
    add('circle', { cx: 72, cy: 46, r: 2.2, class: 'bottleFace' }); add('circle', { cx: 88, cy: 46, r: 2.2, class: 'bottleFace' });
    if (draw.corked) add('rect', { x: 64, y: 8, width: 32, height: 12, rx: 3, class: 'bottleCork' });
    if (draw.contents.includes('urine')) add('path', { d: 'M34 108 q46 8 92 0 q-4 44 -46 48 q-42 -4 -46 -48 z', class: 'bottleLiquid' });
    draw.contents.filter((k) => k !== 'urine').forEach((k, i) => { const t = add('text', { x: 50 + (i % 3) * 30, y: 100 + Math.floor(i / 3) * 22, class: 'bottleThing' }); t.textContent = { nails: '📍', pins: '📌', salt: '🧂', hair: '✂️', heart: '❤️', brimstone: '🟡' }[k] || '•'; });
    body.appendChild(svg);
    // What goes in.
    const items = f.fillings.map((x) => {
      const on = draw.contents.includes(x.key);
      return { text: `${on ? '✓ ' : ''}${x.label}`, aria: `${x.label}${on ? ', in' : ''}. ${x.src}`, disabled: draw.corked || draw.pending,
        on: () => { draw.contents = on ? draw.contents.filter((k) => k !== x.key) : [...draw.contents, x.key]; if (x.key === 'pins' && on) draw.bent = 0; draw.note = x.src; render(); } };
    });
    keysPanel(body, 'What goes in it', items);
    // The pins: bend them, or not (found "sometimes bent").
    if (draw.contents.includes('pins')) {
      const pins = el('div', 'bottlePins');
      pins.appendChild(el('div', 'kbLabel', 'The pins, found "sometimes bent": bend them if you like.'));
      for (let i = 0; i < f.pins; i++) {
        const bentIt = i < draw.bent;
        const b = el('button', 'btn kbBtn bottlePin' + (bentIt ? ' bent' : ''), bentIt ? `Pin ${i + 1}: bent ⌐` : `Bend pin ${i + 1}`);
        b.disabled = bentIt || i !== draw.bent || draw.corked || draw.pending;
        b.addEventListener('click', () => { draw.bent = i + 1; draw.note = `${draw.bent} of ${f.pins} pins bent.`; render(); });
        pins.appendChild(b);
      }
      body.appendChild(pins);
    }
    // Cork it fast.
    keysPanel(body, 'Then', [{ text: draw.corked ? '✓ Corked fast' : 'Cork it fast', disabled: draw.corked || draw.pending, on: () => { draw.corked = true; draw.note = 'Corked fast. In Glanvill\'s tale the cork flew out by the fire; this one will hold.'; render(); } }]);
    // Where, and which way up.
    keysPanel(body, 'Where to bury it', Object.entries(f.places).map(([k, p]) => ({ text: `${draw.place === k ? '✓ ' : ''}${p.label} (${p.note})`, disabled: draw.pending, on: () => { draw.place = k; render(); } })));
    keysPanel(body, 'Which way up', [
      { text: `${draw.inverted === true ? '✓ ' : ''}Neck down (as at Greenwich)`, disabled: draw.pending, on: () => { draw.inverted = true; render(); } },
      { text: `${draw.inverted === false ? '✓ ' : ''}Upright (as at Dukes Place, Aldgate)`, disabled: draw.pending, on: () => { draw.inverted = false; render(); } },
    ]);
    keysPanel(body, 'And', [{ text: '⛏️ Bury it', disabled: draw.pending, on: () => { draw.pending = true; draw.note = 'You lift the stone…'; send({ type: 'bury_witch_bottle', contents: draw.contents.slice(), bent: draw.bent, corked: draw.corked, place: draw.place, inverted: draw.inverted }); render(); } }]);
    drawFooter(body, 'Put the bottle back');
  }

  // ── The Marian mark: four knife cuts between the nicks ────────────────────
  function marianNicks() {
    const b = state.boards && state.boards.marian;
    return b ? [...b.tops.map((p, i) => ({ t: 'top', i, p })), ...b.bottoms.map((p, i) => ({ t: 'bottom', i, p }))] : [];
  }
  function marianPress(x, y) {
    const nicks = marianNicks();
    const k = nearest(nicks.map((n) => n.p), x, y);
    if (k < 0) return false;
    const n = nicks[k];
    if (draw.anchor && (draw.anchor.t !== n.t || draw.anchor.i !== n.i) && !draw.dragging) { marianCut(draw.anchor, n); return true; }
    draw.anchor = n; draw.dragging = true; draw.drag = n.p.slice();
    return true;
  }
  function marianCut(a, n) {
    draw.dragging = false; draw.drag = null;
    if (a.t === n.t) { draw.anchor = n; draw.note = 'A cut runs from the top edge to the bottom edge.'; return; }
    const top = a.t === 'top' ? a.i : n.i, bottom = a.t === 'bottom' ? a.i : n.i;
    draw.anchor = null;
    if (draw.cuts.some((c) => c[0] === top && c[1] === bottom)) { draw.note = 'That line is already cut.'; return; }
    draw.cuts.push([top, bottom]);
    const left = 4 - draw.cuts.length;
    draw.note = left ? `${left} cut${left === 1 ? '' : 's'} to go.` : 'The fourth cut…';
    if (!left) { draw.pending = true; send({ type: 'cut_marian', cuts: draw.cuts }); }
  }
  function renderMarian(body) {
    body.appendChild(el('div', 'wardIntro', 'Cutting a Marian mark into the hearth beam: two Vs, the second crossing the first.'));
    const { svg, add, at } = svgBoard('markCanvas');
    svg.id = 'marianCanvas';
    add('rect', { x: 0, y: 0, width: 260, height: 260, rx: 12, class: 'hexBeam' });
    const b = state.boards && state.boards.marian;
    if (b) for (const [t, bt] of draw.cuts) add('line', { x1: b.tops[t][0], y1: b.tops[t][1], x2: b.bottoms[bt][0], y2: b.bottoms[bt][1], class: 'hexLine' });
    if (draw.anchor && draw.drag) add('line', { x1: draw.anchor.p[0], y1: draw.anchor.p[1], x2: draw.drag[0], y2: draw.drag[1], class: 'markGuide' });
    for (const n of marianNicks()) add('circle', { cx: n.p[0], cy: n.p[1], r: draw.anchor && draw.anchor.t === n.t && draw.anchor.i === n.i ? 6 : 4, class: 'hexCentre' });
    if (!draw.done && !draw.pending) {
      // Drawn in place while the knife moves (re-rendering mid-drag would drop
      // the pointer); the board is rebuilt only when a cut lands.
      let guide = null;
      svg.addEventListener('pointerdown', (e) => {
        const [x, y] = at(e);
        const before = draw.cuts.length;
        if (!marianPress(x, y)) return;
        if (draw.cuts.length !== before || !draw.dragging) { render(); return; }
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
        guide = add('line', { x1: draw.anchor.p[0], y1: draw.anchor.p[1], x2: x, y2: y, class: 'markGuide' });
      });
      svg.addEventListener('pointermove', (e) => { if (!draw.dragging || !guide) return; const [x, y] = at(e); guide.setAttribute('x2', x); guide.setAttribute('y2', y); });
      const lift = (e) => {
        if (!draw.dragging) return;
        const [x, y] = at(e);
        const nicks = marianNicks();
        const k = nearest(nicks.map((n) => n.p), x, y);
        if (k >= 0 && (nicks[k].t !== draw.anchor.t || nicks[k].i !== draw.anchor.i)) marianCut(draw.anchor, nicks[k]);
        else { draw.dragging = false; draw.drag = null; } // a tap: the knife waits on that nick for the next
        render();
      };
      svg.addEventListener('pointerup', lift);
      svg.addEventListener('pointercancel', lift);
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `The hearth beam: ${draw.cuts.length} of 4 cuts made${draw.anchor ? `; the knife waits on the ${draw.anchor.t} nick ${draw.anchor.i + 1}` : ''}.`);
    body.appendChild(svg);
    if (!draw.done && !draw.pending) {
      const tapNick = (n) => { if (draw.anchor && (draw.anchor.t !== n.t || draw.anchor.i !== n.i)) marianCut(draw.anchor, n); else { draw.anchor = n; draw.note = `The knife is on the ${n.t} nick ${n.i + 1}. Choose the other end of the cut.`; } render(); };
      keysPanel(body, 'Or cut by keys: choose a nick, then the other end', marianNicks().map((n) => ({ text: `${n.t === 'top' ? 'Top' : 'Bottom'} ${n.i + 1}`, aria: `${n.t} nick ${n.i + 1} of ${n.t === 'top' ? 5 : 4}, counting from the left`, on: () => tapNick(n) })));
    }
    drawFooter(body, 'Put the knife down');
  }

  // ── Gawain's pentangle: one stroke, no lift ───────────────────────────────
  function pentPoints() { return (state.boards && state.boards.pentangle && state.boards.pentangle.points) || []; }
  function pentStart(x, y) {
    const k = nearest(pentPoints(), x, y);
    if (k < 0) { draw.note = 'Set the brush on one of the five points.'; return false; }
    draw.seq = [k]; draw.trail = [[x, y]]; draw.drawing = true;
    draw.note = 'Keep the brush down…';
    return true;
  }
  function pentMove(x, y) {
    if (!draw.drawing) return;
    draw.trail.push([x, y]);
    const k = nearest(pentPoints(), x, y);
    if (k >= 0 && k !== draw.seq[draw.seq.length - 1]) draw.seq.push(k);
  }
  function pentLift() {
    if (!draw.drawing) return;
    draw.drawing = false;
    if (draw.seq.length < 2) { draw.note = 'Draw without lifting the brush: five lines, one stroke.'; draw.seq = []; draw.trail = []; return; }
    draw.pending = true;
    draw.note = 'The brush lifts…';
    send({ type: 'paint_pentangle', seq: draw.seq });
  }
  function renderPentangle(body) {
    body.appendChild(el('div', 'wardIntro', 'Painting the pentangle on your shield: gold on red, one unbroken stroke, the endless knot.'));
    const { svg, add, at } = svgBoard('markCanvas');
    svg.id = 'pentangleCanvas';
    add('rect', { x: 0, y: 0, width: 260, height: 260, rx: 12, class: 'pentField' });
    const pts = pentPoints();
    if (draw.trail.length > 1) add('polyline', { points: draw.trail.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), class: 'markGuide' });
    for (let i = 1; i < draw.seq.length; i++) { const a = pts[draw.seq[i - 1]], b = pts[draw.seq[i]]; if (a && b) add('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'pentLine' }); }
    pts.forEach((p) => add('circle', { cx: p[0], cy: p[1], r: 5, class: 'pentPoint' }));
    if (!draw.done && !draw.pending) {
      // The stroke is drawn in place as the brush moves; the board is rebuilt
      // only once it lifts.
      let trail = null;
      svg.addEventListener('pointerdown', (e) => {
        const [x, y] = at(e);
        if (!pentStart(x, y)) { render(); return; }
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
        trail = add('polyline', { points: `${x.toFixed(1)},${y.toFixed(1)}`, class: 'markGuide' });
        const note = body.querySelector('.hexNote'); if (note) note.textContent = draw.note;
      });
      svg.addEventListener('pointermove', (e) => {
        if (!draw.drawing) return;
        const [x, y] = at(e);
        const before = draw.seq.length;
        pentMove(x, y);
        if (trail) trail.setAttribute('points', trail.getAttribute('points') + ` ${x.toFixed(1)},${y.toFixed(1)}`);
        if (draw.seq.length !== before) { const a = pts[draw.seq[draw.seq.length - 2]], b = pts[draw.seq[draw.seq.length - 1]]; add('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'pentLine' }); }
      });
      const lift = () => { if (!draw.drawing) return; pentLift(); render(); };
      svg.addEventListener('pointerup', lift);
      svg.addEventListener('pointercancel', lift);
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `The shield: ${Math.max(0, draw.seq.length - 1)} of 5 lines drawn${draw.drawing ? ', the brush still down' : ''}.`);
    body.appendChild(svg);
    if (!draw.done && !draw.pending) {
      const names = ['top', 'upper right', 'lower right', 'lower left', 'upper left'];
      const items = pts.map((p, i) => ({ text: `${i + 1} · ${names[i]}`, aria: `Point ${i + 1}, ${names[i]}`, on: () => { if (!draw.drawing) pentStart(p[0], p[1]); else pentMove(p[0], p[1]); render(); } }));
      items.push({ text: 'Lift the brush', disabled: !draw.drawing, on: () => { pentLift(); render(); } });
      keysPanel(body, 'Or by keys: the points in order, brush down from the first, then lift', items);
    }
    drawFooter(body, 'Put the brush down');
  }

  // ── The taper burn: slant the flame and hold it ───────────────────────────
  // The flame's tip touches the underside of the beam at one point; the taper
  // hangs from it toward the pointer. Time only counts while the button is
  // held; the mark grows as it does, and turns angry red once it's too long.
  function renderBurn(body) {
    body.appendChild(el('div', 'wardIntro', 'Scorching a burn mark into the door frame with a taper.'));
    const { svg, add, at } = svgBoard('markCanvas');
    svg.id = 'burnCanvas';
    const TIP = [130, 118];
    const [lo, hi] = state.burnAngle || [30, 60];
    const [hMin, hMax] = state.burnHold || [3, 8];
    add('rect', { x: 0, y: 0, width: 260, height: 260, rx: 12, class: 'burnRoom' });
    add('rect', { x: 10, y: 20, width: 240, height: 98, rx: 4, class: 'hexBeam' });
    const tear = add('path', { d: '', class: 'burnTear' });
    const taper = add('line', { x1: TIP[0], y1: TIP[1], x2: TIP[0], y2: TIP[1] + 110, class: 'burnTaper' });
    const flame = add('circle', { cx: TIP[0], cy: TIP[1] + 4, r: 0, class: 'burnFlame' });
    const read = add('text', { x: 130, y: 245, class: 'burnRead', 'text-anchor': 'middle' });
    read.textContent = draw.done ? 'The mark is made.' : 'Slant: upright';
    const tearPath = (t) => {
      // A tear: deepest at the foot where the flame touches, tapering up the grain.
      const k = Math.min(1, t / hMax), w = 3 + 9 * k, h = 8 + 52 * k;
      return `M ${TIP[0]} ${TIP[1]} C ${TIP[0] - w * 1.3} ${TIP[1] - h * 0.25}, ${TIP[0] - w * 0.4} ${TIP[1] - h * 0.8}, ${TIP[0]} ${TIP[1] - h} C ${TIP[0] + w * 0.4} ${TIP[1] - h * 0.8}, ${TIP[0] + w * 1.3} ${TIP[1] - h * 0.25}, ${TIP[0]} ${TIP[1]} Z`;
    };
    if (draw.done) tear.setAttribute('d', tearPath((hMin + hMax) / 2));
    if (!draw.done && !draw.pending) {
      let held = null; // { t0, angleSum, samples, angle, raf }
      const angleTo = ([x, y]) => { const dx = x - TIP[0], dy = Math.max(1, y - TIP[1]); return Math.round(Math.atan2(Math.abs(dx), dy) * 180 / Math.PI); };
      const pose = (p) => {
        const a = angleTo(p), dir = p[0] < TIP[0] ? -1 : 1, r = a * Math.PI / 180;
        taper.setAttribute('x2', TIP[0] + dir * 110 * Math.sin(r)); taper.setAttribute('y2', TIP[1] + 110 * Math.cos(r));
        return a;
      };
      const tick = () => {
        if (!held) return;
        const t = (performance.now() - held.t0) / 1000;
        held.angleSum += held.angle; held.samples++;
        const good = held.angle >= lo && held.angle <= hi;
        tear.setAttribute('d', tearPath(good ? t : t * 0.3));
        tear.setAttribute('class', 'burnTear' + (t > hMax ? ' over' : '') + (good ? '' : ' smudge'));
        read.textContent = `Slant ${held.angle}° · ${t.toFixed(1)}s held` + (good && t >= hMin && t <= hMax ? ' · the tear has formed' : t > hMax ? ' · it\'s catching!' : '');
        held.raf = requestAnimationFrame(tick);
      };
      svg.addEventListener('pointerdown', (e) => {
        try { svg.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
        held = { t0: performance.now(), angleSum: 0, samples: 0, angle: pose(at(e)) };
        flame.setAttribute('r', 6);
        held.raf = requestAnimationFrame(tick);
      });
      svg.addEventListener('pointermove', (e) => { if (held) held.angle = pose(at(e)); });
      const lift = () => {
        if (!held) return;
        cancelAnimationFrame(held.raf);
        const seconds = (performance.now() - held.t0) / 1000;
        const angle = held.samples ? Math.round(held.angleSum / held.samples) : held.angle;
        held = null;
        flame.setAttribute('r', 0);
        draw.pending = true; draw.note = 'You take the taper away and look…';
        send({ type: 'burn_mark', angle, seconds: Math.round(seconds * 10) / 10 });
        const n = body.querySelector('.hexNote'); if (n) n.textContent = draw.note;
      };
      svg.addEventListener('pointerup', lift);
      svg.addEventListener('pointercancel', lift);
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', draw.done ? 'The door frame, with a tear-shaped burn mark.' : 'The door frame and a lit taper beneath it.');
    body.appendChild(svg);
    if (!draw.done && !draw.pending) {
      // By keys: set the slant, then hold the flame to the wood and take it away.
      if (draw.kbAngle === undefined) draw.kbAngle = 0;
      const wrap = el('label', 'kbSlider');
      wrap.appendChild(el('span', '', 'Slant from upright: '));
      const rng = document.createElement('input');
      rng.type = 'range'; rng.min = '0'; rng.max = '90'; rng.step = '5'; rng.value = String(draw.kbAngle);
      rng.setAttribute('aria-label', 'Slant of the taper, in degrees from upright');
      const val = el('span', '', `${draw.kbAngle}°`);
      rng.addEventListener('input', () => { draw.kbAngle = Number(rng.value); val.textContent = `${draw.kbAngle}°`; });
      wrap.appendChild(rng); wrap.appendChild(val);
      const readout = live(el('div', 'kbReadout', ''));
      let t0 = null, timer = null;
      const hold = el('button', 'btn kbBtn', 'Hold the flame to the wood');
      hold.addEventListener('click', () => {
        if (t0 === null) {
          t0 = performance.now(); hold.textContent = 'Take the taper away'; rng.disabled = true;
          timer = setInterval(() => { const t = (performance.now() - t0) / 1000; readout.textContent = `${t.toFixed(0)} s held` + (t >= ((state.burnHold || [3, 8])[0]) && t <= ((state.burnHold || [3, 8])[1]) ? ', the tear has formed' : t > ((state.burnHold || [3, 8])[1]) ? ", it's catching!" : ''); }, 1000);
        } else {
          clearInterval(timer);
          const seconds = Math.round((performance.now() - t0) / 100) / 10; t0 = null;
          draw.pending = true; draw.note = 'You take the taper away and look…';
          send({ type: 'burn_mark', angle: draw.kbAngle, seconds });
          render();
        }
      });
      keysPanel(body, 'Or by keys: set the slant, then hold the flame and take it away', [{ node: wrap }, { node: hold }, { node: readout }]);
    }
    drawFooter(body, 'Snuff the taper');
  }

  // ── The SATOR square: five words, written row by row ──────────────────────
  function renderSator(body) {
    body.appendChild(el('div', 'wardIntro', 'Writing the SATOR square on a plate for the hearth.'));
    body.appendChild(el('div', 'satorWords', 'The five words: SATOR · AREPO · TENET · OPERA · ROTAS'));
    const grid = el('div', 'satorGrid');
    grid.setAttribute('aria-hidden', 'true');
    const cells = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const d = el('div', 'satorCell', (draw.rows[r] || '')[c] || ''); grid.appendChild(d); cells.push(d); }
    const refresh = () => { for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) cells[r * 5 + c].textContent = (draw.rows[r] || '')[c] || ''; };
    const form = el('div', 'satorRows');
    draw.rows.forEach((v, r) => {
      const inp = document.createElement('input');
      inp.className = 'satorRow'; inp.maxLength = 5; inp.value = v; inp.autocomplete = 'off'; inp.spellcheck = false;
      inp.setAttribute('aria-label', `Row ${r + 1}`);
      inp.disabled = !!(draw.done || draw.pending);
      inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5); draw.rows[r] = inp.value; refresh(); });
      form.appendChild(inp);
    });
    body.appendChild(form);
    body.appendChild(grid);
    if (!draw.done) {
      const go = el('button', 'btn wardBtn wardBack', 'Write it on the plate');
      go.disabled = !!draw.pending;
      go.addEventListener('click', () => { draw.pending = true; send({ type: 'write_sator', rows: draw.rows.slice() }); render(); });
      body.appendChild(go);
    }
    drawFooter(body, 'Put the pen down');
  }

  // ── The compass: draw a hexafoil the way a carpenter did ──────────────────
  // Step 0: set the point at the centre and swing the circle.
  // Then: set the point anywhere on the circle and swing an arc of the same
  // radius; each further arc is set where the last one crossed the circle.
  // Six arcs and the wheel closes. A miss just slips — no penalty.
  const C = 130, R = 82, HIT = 15;
  function newCompass() { return { stage: 'centre', base: null, used: [], slips: 0, note: 'Set the compass point on the centre mark, and swing the circle.' }; }
  function ptAt(k) { const t = compass.base + k * Math.PI / 3; return [C + R * Math.cos(t), C + R * Math.sin(t)]; }
  function arcPath(k) {
    const t = compass.base + k * Math.PI / 3, px = C + R * Math.cos(t), py = C + R * Math.sin(t);
    const pts = [];
    for (let i = 0; i <= 24; i++) { const a = t + Math.PI * 2 / 3 + (i / 24) * Math.PI * 2 / 3; pts.push(`${(px + R * Math.cos(a)).toFixed(1)},${(py + R * Math.sin(a)).toFixed(1)}`); }
    return 'M' + pts.join(' L');
  }
  function compassClick(x, y) {
    if (compass.stage === 'centre') {
      if (Math.hypot(x - C, y - C) <= HIT) { compass.stage = 'first'; compass.note = 'Good. Now set the point anywhere on the circle and swing an arc of the same radius.'; }
      else { compass.slips++; compass.note = 'The point skids — set it on the centre mark.'; }
    } else if (compass.stage === 'first') {
      if (Math.abs(Math.hypot(x - C, y - C) - R) <= HIT) {
        compass.base = Math.atan2(y - C, x - C);
        compass.used = [0]; compass.stage = 'arcs';
        compass.note = 'The arc crosses the circle twice. Set the point where it crosses, and swing again.';
      } else { compass.slips++; compass.note = 'Set the point ON the circle — the radius never changes.'; }
    } else if (compass.stage === 'arcs') {
      let hit = -1;
      for (let k = 0; k < 6; k++) {
        if (compass.used.includes(k)) continue;
        const adj = compass.used.includes((k + 1) % 6) || compass.used.includes((k + 5) % 6);
        const [px, py] = ptAt(k);
        if (adj && Math.hypot(x - px, y - py) <= HIT) { hit = k; break; }
      }
      if (hit >= 0) {
        compass.used.push(hit);
        const left = 6 - compass.used.length;
        compass.note = left ? `${left} arc${left === 1 ? '' : 's'} to go — each set where the last crossed the circle.` : 'The sixth arc closes the wheel.';
        if (!left) { compass.stage = 'done'; send({ type: 'scribe_hexafoil', slips: compass.slips }); }
      } else { compass.slips++; compass.note = 'Not there — set the point exactly where an arc crosses the circle.'; }
    }
    render();
  }
  function renderCompass(body) {
    body.appendChild(el('div', 'wardIntro', 'Scribing a daisy wheel over the door — one circle, six arcs, one radius.'));
    const svg = document.createElementNS(WARDS_SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 260 260');
    svg.setAttribute('class', 'hexCanvas');
    svg.id = 'hexCanvas';
    const add = (tag, attrs) => { const n = document.createElementNS(WARDS_SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); svg.appendChild(n); return n; };
    add('rect', { x: 0, y: 0, width: 260, height: 260, rx: 12, class: 'hexBeam' });
    if (compass.stage === 'centre') add('circle', { cx: C, cy: C, r: 4, class: 'hexCentre' });
    if (compass.stage !== 'centre') add('circle', { cx: C, cy: C, r: R, class: 'hexLine' });
    if (compass.base !== null) for (const k of compass.used) add('path', { d: arcPath(k), class: 'hexLine' });
    svg.addEventListener('click', (e) => {
      if (compass.stage === 'done') return;
      const r = svg.getBoundingClientRect();
      compassClick((e.clientX - r.left) * 260 / r.width, (e.clientY - r.top) * 260 / r.height);
    });
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', compass.stage === 'centre' ? 'The lintel, with a centre mark.' : `The lintel: a circle and ${compass.used.length} of 6 arcs.`);
    body.appendChild(svg);
    if (compass.stage !== 'done') {
      const clock = (x, y) => { const h = Math.round((Math.atan2(x - C, -(y - C)) * 6 / Math.PI + 12) % 12) || 12; return `${h} o'clock`; };
      let items;
      if (compass.stage === 'centre') items = [{ text: 'Set the point on the centre mark', on: () => compassClick(C, C) }];
      else if (compass.stage === 'first') items = [[C, C - R], [C + R, C], [C, C + R], [C - R, C]].map(([x, y]) => ({ text: `On the circle at ${clock(x, y)}`, on: () => compassClick(x, y) }));
      else items = [0, 1, 2, 3, 4, 5].filter((k) => !compass.used.includes(k) && (compass.used.includes((k + 1) % 6) || compass.used.includes((k + 5) % 6))).map((k) => { const [x, y] = ptAt(k); return { text: `Where it crosses at ${clock(x, y)}`, on: () => compassClick(x, y) }; });
      keysPanel(body, 'Or by keys', items);
    }
    body.appendChild(live(el('div', 'hexNote', compass.note)));
    if (compass.slips) body.appendChild(el('div', 'hexSlips', `The compass slipped ${compass.slips} time${compass.slips === 1 ? '' : 's'}.`));
    const back = el('button', 'btn wardBtn wardBack', compass.stage === 'done' ? 'Back to the house' : 'Put the compasses down');
    back.addEventListener('click', () => { compass = null; render(); });
    body.appendChild(back);
  }

  (function wire() {
    const c = document.getElementById('wardsCloseBtn');
    if (c) c.addEventListener('click', close);
  })();

  // Test seam: the compass's own geometry, so a harness can click true points.
  function compassPoints() {
    if (!compass) return null;
    const out = { stage: compass.stage, centre: [C, C], radius: R, used: compass.used.slice() };
    if (compass.base !== null) out.points = [0, 1, 2, 3, 4, 5].map(ptAt);
    return out;
  }

  function drawing() { return draw ? { kind: draw.kind, done: !!draw.done, pending: !!draw.pending, note: draw.note, cuts: draw.cuts, seq: draw.seq } : null; }
  return { open, close, setState, render, error, compassPoints, drawing };
}
