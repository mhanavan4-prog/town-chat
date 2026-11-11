// ---------------------------------------------------------------------------
// The jointed creatures (tools/models/build_critters.py): each model carries its
// joints as named nodes — leg_FL/FR/BL/BR (or leg_L/R for a bird, leg_L0..R2 for
// a moth), wing_L/R, head, tail, ear_L/R — each with its origin at the joint.
// critterRigFind collects them once; critterRigPose sets them each frame from
// the creature's gait phase and how fast it is going, so legs step, wings beat,
// a moorhen bobs its head and flicks its tail, and a rabbit hops with its hind
// legs together. Forward is +Z; L sits at +X.
// ---------------------------------------------------------------------------
export function critterRigFind(root, kind) {
  const rig = { kind, legs: [], wings: [], head: null, tail: null, ears: [] };
  root.traverse((o) => {
    const n = o.name || '';
    if (/^leg_/.test(n)) rig.legs.push({ o, name: n, rx: o.rotation.x });
    else if (/^wing_[LR]$/.test(n)) rig.wings.push({ o, side: n.endsWith('L') ? 1 : -1, rz: o.rotation.z });
    else if (n === 'head') rig.head = { o, rx: o.rotation.x, z: o.position.z };
    else if (n === 'tail') rig.tail = { o, rx: o.rotation.x };
    else if (/^ear_[LR]$/.test(n)) rig.ears.push({ o, side: n.endsWith('L') ? 1 : -1, rz: o.rotation.z });
  });
  return (rig.legs.length || rig.wings.length || rig.head) ? rig : null;
}

// phase: a running gait clock (radians); speed: 0 standing … 1 walking … 2 running.
export function critterRigPose(rig, phase, speed, t) {
  if (!rig) return;
  const s = Math.min(2, Math.max(0, speed));
  const walk = Math.min(1, s);
  const k = rig.kind;
  const many = k === 'spider' || k === 'beetle';
  for (const L of rig.legs) {
    const n = L.name;
    let a = 0;
    if (many && /^leg_[LR]\d$/.test(n)) {
      // eight or six legs, stepping in alternate sets: each sweeps fore and aft
      const i = +n.charAt(5), right = n.charAt(4) === 'R';
      const sweep = Math.sin(phase * 1.5 + ((i + (right ? 1 : 0)) % 2 ? Math.PI : 0)) * 0.35 * walk;
      L.o.rotation.y = (L.ry != null ? L.ry : (L.ry = L.o.rotation.y)) + sweep;
      L.o.rotation.x = L.rx + Math.max(0, sweep) * (right ? -0.4 : 0.4);
      continue;
    }
    if (k === 'rabbit' || (k === 'duskfawn' && s > 1.4)) {
      // a hop or a bound: hind legs together, forelegs together, opposed
      const back = /B/.test(n);
      a = Math.sin(phase + (back ? Math.PI : 0)) * 0.7 * walk;
    } else if (/^leg_[LR]\d$/.test(n)) {
      // a moth's six legs just dangle and stir
      a = Math.sin(t * 3 + n.charCodeAt(5)) * 0.08;
    } else if (/^leg_[LR]$/.test(n)) {
      a = Math.sin(phase + (n.endsWith('L') ? 0 : Math.PI)) * 0.55 * walk; // a bird's stride
    } else {
      // four legs, the diagonal pairs together (a walk/trot)
      const diag = (n === 'leg_FL' || n === 'leg_BR') ? 0 : Math.PI;
      a = Math.sin(phase + diag) * (0.45 + 0.15 * (s - 1 > 0 ? s - 1 : 0)) * walk;
    }
    L.o.rotation.x = L.rx + a;
  }
  for (const W of rig.wings) {
    // a moth always beats, a bat always flies; a bird only when it runs (flushing), else they lie folded
    const beat = k === 'embermoth' ? 0.55 + 0.35 * Math.sin(t * 22) : k === 'bat' ? 0.15 + 0.75 * Math.sin(t * 13) : (s > 1.3 ? 0.9 * Math.max(0, Math.sin(t * 18)) : 0);
    W.o.rotation.z = W.rz + W.side * beat;
  }
  if (rig.head) {
    if (k === 'mirefowl') rig.head.o.position.z = rig.head.z + Math.sin(phase * 2) * 0.06 * walk; // the moorhen's nod
    rig.head.o.rotation.x = rig.head.rx + (walk ? Math.sin(phase * 2) * 0.06 : Math.sin(t * 0.7) * 0.08 + 0.05);
    // an adder, a slug, a centipede: the head sways side to side as it goes, or as it waits
    if (k === 'adder' || k === 'slug' || k === 'centipede') rig.head.o.rotation.y = (rig.head.ry != null ? rig.head.ry : (rig.head.ry = rig.head.o.rotation.y)) + Math.sin(t * (walk ? 5 : 1.6)) * 0.25;
  }
  if (rig.tail) rig.tail.o.rotation.x = rig.tail.rx + (k === 'mirefowl' ? -0.25 * Math.max(0, Math.sin(phase * 2)) : Math.sin(t * (walk ? 9 : 2)) * 0.18);
  for (const E of rig.ears) E.o.rotation.z = E.rz + E.side * (Math.sin(t * 1.3 + E.side) > 0.92 ? 0.25 : 0.04);
}
