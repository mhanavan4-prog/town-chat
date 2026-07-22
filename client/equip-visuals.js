// ---------------------------------------------------------------------------
// Equip + status visuals (Tier 3.4 Phase C). applyEquipVisual / applyMyEquipVisual
// attach or strip a player's cosmetic gear on their rig — the pumpkin head, bat
// swarm, raven cloak, wolf mark and wolf-pact aura — only touching the scene graph
// on an actual change; applyStatusVisual (with clearStatusVisual) layers the
// active-status FX. CHAR/EQUIP_ATTACH + the glow texture + the visuals registry are
// injected (THREE/LEGEND_FX are globals); myId/players via getters.
// ---------------------------------------------------------------------------
export default function createEquipVisuals({ CHAR, EQUIP_ATTACH, makeGlowTexture, visuals, getMyId, getPlayers }) {
function applyEquipVisual(id, equipped) {
  const v = visuals[id];
  if (!v) return;
  // Pass itemIds directly so each slot can pick the right color/look.
  EQUIP_ATTACH.weapon(v, equipped.equippedWeapon || null);
  EQUIP_ATTACH.chest (v, equipped.equippedChest  || null);
  EQUIP_ATTACH.head  (v, equipped.equippedHead   || null);
  EQUIP_ATTACH.feet  (v, equipped.equippedFeet   || null);
  EQUIP_ATTACH.ring  (v, equipped.equippedRing   || null);
  // Legendary equipment effects — visible to everyone in the room.
  LEGEND_FX.sync(v, equipped);
  // Holly Wand bearers glow — a soft additive body aura (any player, any
  // scene), plus a real night light from the shared pool (updateWandLights).
  const hasWand = (equipped.equippedWeapon === 'holly_wand');
  if (hasWand && !v.wandAura) {
    const aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0xffeec2, transparent: true, opacity: 0.2,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    aura.scale.set(46, 52, 1);
    aura.position.y = 20;
    v.group.add(aura);
    v.wandAura = aura;
  } else if (!hasWand && v.wandAura) {
    v.group.remove(v.wandAura);
    v.wandAura = null;
  }
  v.hasWand = hasWand;
}

// inventory_state only ever describes the local player — routes it into
// applyEquipVisual and also keeps getPlayers()[getMyId()] in sync.
function applyMyEquipVisual(msg) {
  if (!getMyId() || !getPlayers()[getMyId()]) return;
  getPlayers()[getMyId()].equippedWeapon = msg.equippedWeapon || null;
  getPlayers()[getMyId()].equippedHead   = msg.equippedHead   || null;
  getPlayers()[getMyId()].equippedChest  = msg.equippedChest  || null;
  getPlayers()[getMyId()].equippedFeet   = msg.equippedFeet   || null;
  getPlayers()[getMyId()].equippedRing   = msg.equippedRing   || null;
  applyEquipVisual(getMyId(), getPlayers()[getMyId()]);
}

// ---------------------------------------------------------------------------
// Spell status visuals — six of the ten curse/blessing statuses change how
// a player looks (shrink/giant/pumpkin/bats/colorcycle/ravencloak); the
// other four (toad/gibberish/stumble/feather) are pure gameplay/text
// effects handled elsewhere (chat send, movement/jump) and have no mesh
// here at all. Only one status — and so only one visual — can be active
// on a given player at a time, matching the server's single activeStatus
// slot.
// ---------------------------------------------------------------------------
// PUMPKIN_HEAD_SCALE sizes the jack-o'-lantern to ENCASE the whole head. The
// classic rig hides its head sphere (v.head.visible=false) and the pumpkin
// stands in for it; the KayKit rig's head is a single skinned mesh that can't
// be hidden, so the pumpkin has to be big enough to swallow it whole. ~1.8x
// the head radius does that on both rigs — bump this if a head still peeks out.
const PUMPKIN_HEAD_SCALE = 2.0;
function makePumpkinHeadMesh() {
  const g = new THREE.Group();
  const R = CHAR.headR * PUMPKIN_HEAD_SCALE;
  const pumpkin = new THREE.Mesh(
    new THREE.SphereGeometry(R, 16, 12),
    new THREE.MeshLambertMaterial({ color: 0xe87b1e })
  );
  pumpkin.scale.set(1, 0.85, 1); // a touch squashed — pumpkins are wider than tall
  g.add(pumpkin);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.14, R * 0.2, R * 0.5, 6),
    new THREE.MeshLambertMaterial({ color: 0x4a7a2e })
  );
  stem.position.y = R * 0.72;
  g.add(stem);
  const faceMat = new THREE.MeshBasicMaterial({ color: 0x2a1505 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.ConeGeometry(R * 0.2, R * 0.28, 4), faceMat);
    eye.rotation.x = Math.PI;
    eye.position.set(side * R * 0.38, R * 0.12, R * 0.82);
    g.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(R * 0.7, R * 0.18, 2), faceMat);
  mouth.position.set(0, -R * 0.35, R * 0.82);
  g.add(mouth);
  return g;
}

function makeBatSwarm() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x16131a });
  const count = 5;
  for (let i = 0; i < count; i++) {
    const bat = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.4, 4), mat);
    const angle = (i / count) * Math.PI * 2;
    bat.position.set(Math.cos(angle) * 16, CHAR.headY + 8, Math.sin(angle) * 16);
    bat.userData.offset = Math.random() * Math.PI * 2;
    g.add(bat);
  }
  return g;
}

function makeRavenCloak() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x1a1018, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(14, 1, 9), mat);
    wing.position.set(side * 9, CHAR.shoulderY - 4, -6);
    wing.rotation.z = side * 0.3;
    wing.rotation.y = side * 0.4;
    g.add(wing);
  }
  return g;
}

function makeWolfMarkMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xf5a623 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(CHAR.headR * 0.7, 1.5, 6, 16), mat);
  ring.position.y = CHAR.headY + CHAR.headR * 1.8;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const paw = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 4), mat);
    paw.position.set(Math.cos(angle) * CHAR.headR * 0.7, CHAR.headY + CHAR.headR * 1.8, Math.sin(angle) * CHAR.headR * 0.7);
    g.add(paw);
  }
  return g;
}

function makeWolfPactAura() {
  const g = new THREE.Group();
  // Spinning ring of golden wolf eyes — 8 small glowing spheres in a circle
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 7, 7),
      new THREE.MeshLambertMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 1.0 })
    );
    s.position.set(Math.cos(ang) * 20, CHAR.headY + 18, Math.sin(ang) * 20);
    g.add(s);
  }
  // Outer golden ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(20, 1.5, 6, 20),
    new THREE.MeshLambertMaterial({ color: 0xffcc22, emissive: 0xffaa00, emissiveIntensity: 0.7 })
  );
  ring.position.y = CHAR.headY + 18;
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return g;
}

function clearStatusVisual(v) {
  if (!v) return;
  v.group.scale.setScalar(1);
  if (v.pumpkinMesh) {
    v.group.remove(v.pumpkinMesh);
    v.pumpkinMesh = null;
    if (v.head) v.head.visible = true;
  }
  if (v.batsGroup)     { v.group.remove(v.batsGroup);     v.batsGroup     = null; }
  if (v.cloakMesh)     { v.group.remove(v.cloakMesh);     v.cloakMesh     = null; }
  if (v.wolfMarkMesh)  { v.group.remove(v.wolfMarkMesh);  v.wolfMarkMesh  = null; }
  if (v.wolfPactMesh)  { v.group.remove(v.wolfPactMesh);  v.wolfPactMesh  = null; }
  if (v.wardMesh)      { v.group.remove(v.wardMesh);      v.wardMesh      = null; }
  // KayKit rigs expose `torso` as a positioning Group (no material) — the
  // shirt tint only exists on classic procedural humanoids. Guarding here
  // fixes the TypeError every status apply/clear threw on KayKit visuals
  // (user-reported via Raven's Cloak, Session I).
  if (v.torso && v.torso.material && v.baseShirtColor != null) v.torso.material.color.setHex(v.baseShirtColor);
  if (v.colorcycleSprite) { v.group.remove(v.colorcycleSprite); v.colorcycleSprite = null; }
  v.statusType = null;
}

function applyStatusVisual(id, status) {
  const v = visuals[id];
  if (!v) return;
  const newType = status ? status.type : null;
  if (v.statusType === newType) return;
  clearStatusVisual(v);
  v.statusType = newType;
  if (newType === 'colorcycle' && !(v.torso && v.torso.material)) {
    // Classic rigs tint the shirt; KayKit rigs get a hue-cycling glow.
    v.colorcycleSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: LEGEND_FX.glowTexture(), color: 0xffffff, transparent: true,
      opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    v.colorcycleSprite.scale.setScalar(46);
    v.colorcycleSprite.position.y = CHAR.hipY + CHAR.torsoH / 2;
    v.group.add(v.colorcycleSprite);
  }
  if (newType === 'shrink') {
    v.group.scale.setScalar(0.5);
  } else if (newType === 'giant') {
    v.group.scale.setScalar(2);
  } else if (newType === 'pumpkin') {
    if (v.head) v.head.visible = false;
    v.pumpkinMesh = makePumpkinHeadMesh();
    // CHAR.headY is where head-gear caps sit (the crown); drop the pumpkin's
    // center below that so the enlarged sphere wraps the whole head, not perches.
    v.pumpkinMesh.position.y = CHAR.headY - CHAR.headR * 0.7;
    v.group.add(v.pumpkinMesh);
  } else if (newType === 'bats') {
    v.batsGroup = makeBatSwarm();
    v.group.add(v.batsGroup);
  } else if (newType === 'ravencloak') {
    v.cloakMesh = makeRavenCloak();
    v.group.add(v.cloakMesh);
  } else if (newType === 'wolfmark') {
    v.wolfMarkMesh = makeWolfMarkMesh();
    v.group.add(v.wolfMarkMesh);
  } else if (newType === 'wolfpact') {
    v.wolfPactMesh = makeWolfPactAura();
    v.group.add(v.wolfPactMesh);
  } else if (newType === 'meditate') {
    // No mesh — just a timestamp so syncVisuals knows how far into the
    // sit-then-rise it is. The cross-legged pose and the rising Y offset
    // are both driven from there, every player who can see this player.
    v.meditateStartedAt = performance.now();
  } else if (newType === 'ward') {
    // The class-neutral defensive ward (Iron Pelt / Ethereal Veil / Oath
    // of Iron / Packmule's Guard / Spirit Ward / Guardian's Pledge) — a
    // faint translucent dome, same halved-damage effect as the Witch's
    // pumpkin without the jack-o'-lantern head. Pulses in updateStatusVisuals.
    v.wardMesh = new THREE.Mesh(
      new THREE.SphereGeometry(CHAR.headY * 0.95, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.18, depthWrite: false })
    );
    v.wardMesh.position.y = CHAR.headY * 0.55;
    v.group.add(v.wardMesh);
  }
  // 'colorcycle'/'speedboost'/'wolfpact' animate every frame in updateStatusVisuals.
  // 'toad'/'gibberish'/'stumble'/'feather'/'speedboost' have no 3D mesh.
}

  return { applyEquipVisual, applyMyEquipVisual, applyStatusVisual };
}
