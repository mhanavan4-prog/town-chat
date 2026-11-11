// ---------------------------------------------------------------------------
// Callers at the Door, standing in the town: the day's callers (lib/callers.js)
// wait beside the Town Board, where their workings are opened, as KayKit
// townsfolk you can walk up to. Yours only: every witch has her own callers,
// so these are drawn on your screen and nobody else's.
//
// The bodies are from the KayKit Mystery Monthly series (CC0, Kay Lousberg):
// the two Farmers (a bearded man, a woman, in straw hats and smocks) and the
// Lorekeeper (an old man with spectacles and a staff). They share the
// Adventurers rig, so they borrow its Idle the way Mother Yarrow does. Until
// they stream in, the plain town figure stands in.
// THREE is a global. (Top-level names carry the callersTown prefix.)
// ---------------------------------------------------------------------------

// Who looks like whom, from how the caller is named. Titles first (Widow,
// Mistress, Captain…), then the first given name; "Old" men are the
// Lorekeeper; children stand smaller.
const CALLERS_TOWN_WOMEN = new Set(('Morag Mary Nell Kirsty Hannah Agnes Annie Elspeth Jenny Meg Elin Mór Nora Bridie Kitty Hester Bridget Isobel Lucy ' +
  'Maud Síle Gwen Gwenno Jean Ann Ada Sukey Polly Ellen Sarah Martha Wenna Margery Thomasin Shona Seonaid Nan Lizzie Peig Breesha ' +
  'Abigail Jenny Kitty Lucy Hester Hannah Mother').split(/\s+/));
const CALLERS_TOWN_FEMALE_TITLES = /^(Goodwife|Widow|Mrs|Mistress|Mother|Old Mrs)\b/;
const CALLERS_TOWN_CHILDREN = /\b(children|twins|lads|Little)\b/;

export function callersTownBody(name) {
  const n = String(name || '').trim();
  const child = CALLERS_TOWN_CHILDREN.test(n);
  let female = CALLERS_TOWN_FEMALE_TITLES.test(n) || /\bher girls\b|\bQueen\b|\bmaid\b|\bwife\b|\bgirl\b/.test(n);
  if (!female) {
    const first = n.replace(/^(The|Old|Little|Captain|Skipper|Farmer|Master)\s+/, '').split(/[\s,]/)[0];
    female = CALLERS_TOWN_WOMEN.has(first);
  }
  const old = /^Old\b/.test(n) && !female;
  return { key: old ? 'npc_lorekeeper' : female ? 'npc_farmer_b' : 'npc_farmer_a', height: child ? 50 : 68 };
}

// Beside the Town Board (client/town-scene.js BOARD_SPOT 2010,1150), in the
// clear ground south-west of it, facing the square.
export const CALLERS_TOWN_SPOTS = [
  { x: 1935, y: 1228 }, { x: 1992, y: 1262 }, { x: 2052, y: 1255 }, { x: 2108, y: 1226 },
];

export default function createCallersInTown({ KK, createKayKitByKey, createHumanoid, kkSetState, getTownScene, makeNpcNameSprite, OUTDOOR_KIOSKS }) {
  let shown = []; // [{ id, key, group, label, kiosk }]
  let lastSig = '';
  let lastState = null;

  // The callers to stand in town: your working first, then those still waiting.
  function wanted(state) {
    if (!state || state.isGuest) return [];
    const out = [];
    if (state.active) out.push({ id: state.active.id, caller: state.active.caller, icon: state.active.icon, working: true });
    for (const o of state.offered || []) {
      if (o.served || (state.active && o.id === state.active.id)) continue;
      out.push({ id: o.id, caller: o.caller, icon: o.icon, working: false });
    }
    return out.slice(0, CALLERS_TOWN_SPOTS.length);
  }

  function clear() {
    for (const s of shown) {
      if (s.group && s.group.parent) s.group.parent.remove(s.group);
      if (s.label && s.label.parent) s.label.parent.remove(s.label);
      const i = OUTDOOR_KIOSKS.indexOf(s.kiosk);
      if (i !== -1) OUTDOOR_KIOSKS.splice(i, 1);
      if (s.dispose) { try { s.dispose(); } catch (e) { /* already gone */ } }
    }
    shown = [];
  }

  function build(c, spot, i) {
    const body = callersTownBody(c.caller);
    let group = null, dispose = null, real = false;
    if (KK && KK.has && KK.has(body.key) && createKayKitByKey) {
      const built = createKayKitByKey(body.key, body.height);
      if (built && built.group) {
        group = built.group; dispose = built.dispose; real = true;
        if (kkSetState && built.kk) kkSetState(built.kk, 'Idle');
      }
    }
    if (!group && createHumanoid) { try { group = createHumanoid(body.key === 'npc_farmer_b' ? 3 : 0).group; } catch (e) { group = null; } }
    if (!group) group = new THREE.Group();
    group.position.set(spot.x, 0, spot.y);
    // Facing the square, where you'll come from.
    group.rotation.y = Math.atan2(1600 - spot.x, 1100 - spot.y);
    group.userData.callerId = c.id;
    const label = makeNpcNameSprite ? makeNpcNameSprite(`${c.icon || '📜'} ${c.caller}${c.working ? ' · your working' : ''}`) : null;
    // Names at alternating heights, so neighbours' don't overlap.
    if (label) label.position.set(spot.x, body.height + 22 + (i % 2) * 16, spot.y);
    const kiosk = { x: spot.x, z: spot.y, npc: 'caller', callerId: c.id, callerName: c.caller, radius: 60 };
    return { id: c.id, key: body.key, real, group, label, kiosk, dispose };
  }

  // Draw the callers in a callers_state, rebuilding only when who's there
  // changes (or a body has streamed in since).
  function update(state) {
    if (state) lastState = state;
    const scene = getTownScene && getTownScene();
    if (!scene) return;
    const list = wanted(lastState);
    const sig = list.map((c) => c.id + (c.working ? '*' : '') + (KK && KK.has && KK.has(callersTownBody(c.caller).key) ? '+' : '')).join('|');
    if (sig === lastSig && shown.every((s) => s.group.parent === scene)) return;
    lastSig = sig;
    clear();
    list.forEach((c, i) => {
      const s = build(c, CALLERS_TOWN_SPOTS[i], i);
      scene.add(s.group);
      if (s.label) scene.add(s.label);
      OUTDOOR_KIOSKS.push(s.kiosk);
      shown.push(s);
    });
  }

  // When a body streams in, swap the stand-in for it.
  if (KK && KK.onAssetLoad) KK.onAssetLoad(() => { if (shown.some((s) => !s.real)) update(null); });

  return { update, shown: () => shown.map((s) => ({ id: s.id, key: s.key, real: s.real, x: s.kiosk.x, z: s.kiosk.z })) };
}
