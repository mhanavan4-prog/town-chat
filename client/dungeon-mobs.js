// ---------------------------------------------------------------------------
// Dungeon mobs (Tier 3.4 Phase C — the last mob variant). The KayKit-style
// low-poly archetype mesh builders (rodent/flyer/crawler/canine/serpent/brute/
// wraith) behind makeDungeonMob, plus pool mgmt over dungeonMobVisuals. Colour/
// scale come from DUNGEON_MOB_VISUALS; boss plates from DUNGEON_BOSS_NAMES. The
// pool stays in main (shared with dungeon-scene) — injected as a getter; the
// active/dungeon scenes and `me` are reassigned lets, also getters. THREE and
// LEGEND_FX are globals; the data tables + helpers are injected by reference.
// ---------------------------------------------------------------------------
export default function createDungeonMobs({ DUNGEON_BOSS_NAMES, DUNGEON_MOB_VISUALS, MOB_ATTACK_LUNGE_DIST, lerpAngle, makeHealthBarSprite, makeNpcNameSprite, mobAttackLungeAmount, updateHealthBar, getActiveScene, getDungeonScene, getDungeonMobVisuals, getMe }) {
// --- Resculpted dungeon creatures (KayKit-style flat-shaded low-poly) ---
// Builders take (color, eyeColor) and return a Group; per-type colour/
// scale come from DUNGEON_MOB_VISUALS via makeDungeonMob (unchanged).
function scShade(h,f){ let r=Math.min(255,(h>>16&255)*f|0), g=Math.min(255,(h>>8&255)*f|0), b=Math.min(255,(h&255)*f|0); return (r<<16)|(g<<8)|b; }
function scMat(h){ return new THREE.MeshStandardMaterial({ color:h, roughness:0.82, metalness:0.04, flatShading:true }); }
function scGlowMat(h){ return new THREE.MeshStandardMaterial({ color:h, emissive:h, emissiveIntensity:1.1, roughness:0.4, flatShading:true }); }
const SC_BONE=0xe9e0c8;
function scEyes(g,ec,y,z,sep,r){ for(const s of [-1,1]){ const e=new THREE.Mesh(new THREE.SphereGeometry(r,8,8),scGlowMat(ec)); e.position.set(s*sep,y,z); g.add(e);} }
function scLimb(m,r0,r1,len){ return new THREE.Mesh(new THREE.CylinderGeometry(r0,r1,len,5),m); }

function scRodent(c,ec){ const g=new THREE.Group(); const m=scMat(c),bl=scMat(scShade(c,1.4)),dk=scMat(scShade(c,0.55));
  const body=new THREE.Mesh(new THREE.IcosahedronGeometry(11,1),m); body.scale.set(1,0.85,1.45); body.position.y=11; g.add(body);
  const belly=new THREE.Mesh(new THREE.SphereGeometry(8,7,6),bl); belly.scale.set(0.85,0.7,1.15); belly.position.set(0,7,4); g.add(belly);
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(7,0),m); head.position.set(0,13,13); g.add(head);
  const snout=new THREE.Mesh(new THREE.ConeGeometry(3.4,9,6),m); snout.rotation.x=Math.PI/2; snout.position.set(0,11,20); g.add(snout);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(1.5,6,6),dk); nose.position.set(0,11,25); g.add(nose);
  for(const s of [-1,1]){ const t=new THREE.Mesh(new THREE.BoxGeometry(1.5,3.2,1),scMat(SC_BONE)); t.position.set(s*1.3,8.4,23); g.add(t); }
  for(const s of [-1,1]){ const ear=new THREE.Mesh(new THREE.SphereGeometry(4,6,5),m); ear.scale.set(1,1,0.3); ear.position.set(s*5,19,11); g.add(ear);
    const inr=new THREE.Mesh(new THREE.SphereGeometry(2.4,6,5),bl); inr.scale.set(1,1,0.3); inr.position.set(s*5,19,12); g.add(inr); }
  for(const [sx,sz] of [[-5.5,6],[5.5,6],[-5.5,-6],[5.5,-6]]){ const leg=scLimb(dk,1.9,1.3,7); leg.position.set(sx,3.5,sz); g.add(leg);
    const paw=new THREE.Mesh(new THREE.IcosahedronGeometry(2.3,0),dk); paw.position.set(sx,0.6,sz+1); g.add(paw); }
  for(let i=0;i<5;i++){ const seg=new THREE.Mesh(new THREE.SphereGeometry(2.1-i*0.32,5,4),dk); seg.position.set(Math.sin(i)*1.5,10-i*1.1,-12-i*4); g.add(seg); }
  scEyes(g,ec,14.5,18,2.6,1.5); return g; }

function scFlyer(c,ec){ const g=new THREE.Group(); const m=scMat(c),mem=scMat(scShade(c,0.7)),dk=scMat(scShade(c,0.5));
  const body=new THREE.Mesh(new THREE.IcosahedronGeometry(6.5,0),m); body.scale.set(1,1.2,1); body.position.y=16; g.add(body);
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(5,0),m); head.position.set(0,23,2); g.add(head);
  for(const s of [-1,1]){ const ear=new THREE.Mesh(new THREE.ConeGeometry(1.8,7,5),m); ear.position.set(s*2.5,29,1); ear.rotation.z=-s*0.2; g.add(ear); }
  for(const t of [-1,1]){ const f=new THREE.Mesh(new THREE.ConeGeometry(0.8,3,4),scMat(SC_BONE)); f.rotation.x=Math.PI; f.position.set(t*1.3,18,5); g.add(f); }
  for(const s of [-1,1]){
    for(let k=0;k<3;k++){ const bone=scLimb(dk,0.9,0.5,20); bone.position.set(s*(8+k*5),18-k,-1); bone.rotation.z=s*(0.9-k*0.25); bone.rotation.y=s*0.2; g.add(bone); }
    const web=new THREE.Mesh(new THREE.CircleGeometry(13,3),mem); web.material.side=THREE.DoubleSide; web.position.set(s*13,17,-2); web.rotation.y=s*0.35; web.scale.set(1.4,1,1); g.add(web);
  }
  scEyes(g,ec,24,6,1.9,1.2); return g; }

function scCrawler(c,ec){ const g=new THREE.Group(); const m=scMat(c),dk=scMat(scShade(c,0.6));
  const abdo=new THREE.Mesh(new THREE.IcosahedronGeometry(11,1),m); abdo.scale.set(1.1,0.85,1.2); abdo.position.set(0,9,-5); g.add(abdo);
  const ceph=new THREE.Mesh(new THREE.IcosahedronGeometry(6,0),m); ceph.position.set(0,8,8); g.add(ceph);
  for(const s of [-1,1]){ const fang=new THREE.Mesh(new THREE.ConeGeometry(1.2,5,5),scMat(SC_BONE)); fang.rotation.x=2.4; fang.position.set(s*1.8,5,13); g.add(fang); }
  for(let i=0;i<4;i++) for(const s of [-1,1]){
    const a=(i-1.5)*0.5;
    const femur=scLimb(dk,1.2,0.9,13); femur.position.set(s*8,10,(i-1.5)*5); femur.rotation.z=s*1.1; femur.rotation.y=a; g.add(femur);
    const tibia=scLimb(dk,0.9,0.5,13); tibia.position.set(s*15,5,(i-1.5)*6); tibia.rotation.z=s*2.0; tibia.rotation.y=a; g.add(tibia); }
  for(const s of [-1,1]){ const e1=new THREE.Mesh(new THREE.SphereGeometry(1.3,6,6),scGlowMat(ec)); e1.position.set(s*2.2,10,12); g.add(e1);
    const e2=new THREE.Mesh(new THREE.SphereGeometry(0.9,6,6),scGlowMat(ec)); e2.position.set(s*3.4,8,11); g.add(e2); }
  return g; }

function scCanine(c,ec){ const g=new THREE.Group(); const m=scMat(c),mane=scMat(scShade(c,0.55)),dk=scMat(scShade(c,0.5));
  const body=new THREE.Mesh(new THREE.IcosahedronGeometry(9,1),m); body.scale.set(1,0.95,1.9); body.position.set(0,15,-2); g.add(body);
  const chest=new THREE.Mesh(new THREE.IcosahedronGeometry(8,0),m); chest.position.set(0,15,11); g.add(chest);
  for(let i=0;i<7;i++){ const sp=new THREE.Mesh(new THREE.ConeGeometry(1.4,6+Math.sin(i)*2,4),mane); sp.position.set(0,22,10-i*3.5); g.add(sp); }
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(5,6,8,6),m); neck.position.set(0,18,16); neck.rotation.x=0.5; g.add(neck);
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(6,0),m); head.position.set(0,20,21); g.add(head);
  const snout=new THREE.Mesh(new THREE.BoxGeometry(4.5,4,8),m); snout.position.set(0,18,27); g.add(snout);
  for(const s of [-1,1]){ const t=new THREE.Mesh(new THREE.ConeGeometry(0.8,3,4),scMat(SC_BONE)); t.rotation.x=Math.PI; t.position.set(s*1.4,15.5,29); g.add(t); }
  for(const s of [-1,1]){ const ear=new THREE.Mesh(new THREE.ConeGeometry(2.2,6,4),m); ear.position.set(s*3.5,26,20); ear.rotation.z=-s*0.2; g.add(ear); }
  for(const [sx,sz] of [[-5.5,10],[5.5,10],[-5.5,-9],[5.5,-9]]){ const leg=scLimb(dk,2,1.5,15); leg.position.set(sx,7.5,sz); g.add(leg);
    const paw=new THREE.Mesh(new THREE.IcosahedronGeometry(2.6,0),dk); paw.position.set(sx,0.8,sz+1.5); g.add(paw); }
  const tail=scLimb(mane,2.4,0.6,16); tail.position.set(0,18,-14); tail.rotation.x=0.9; g.add(tail);
  scEyes(g,ec,21,25,2.4,1.3); return g; }

function scSerpent(c,ec){ const g=new THREE.Group(); const m=scMat(c),bl=scMat(scShade(c,1.5)),dk=scMat(scShade(c,0.6));
  const path=[[0,3,-6],[3,7,-2],[-2,12,2],[2,18,-1],[-1,24,3],[0,30,7]];
  for(let i=0;i<path.length;i++){ const [x,y,z]=path[i]; const seg=new THREE.Mesh(new THREE.IcosahedronGeometry(8-i*0.9,0),i%2?m:bl); seg.position.set(x,y,z); g.add(seg); }
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(6,0),m); head.scale.set(1.3,0.9,1.4); head.position.set(0,33,11); g.add(head);
  const jaw=new THREE.Mesh(new THREE.ConeGeometry(4.5,7,5),bl); jaw.rotation.x=1.9; jaw.position.set(0,30,15); g.add(jaw);
  const hood=new THREE.Mesh(new THREE.SphereGeometry(11,7,5),dk); hood.scale.set(1.5,1,0.35); hood.position.set(0,33,4); g.add(hood);
  const tongue=new THREE.Mesh(new THREE.ConeGeometry(0.7,7,4),scGlowMat(0xff3355)); tongue.rotation.x=1.7; tongue.position.set(0,30,21); g.add(tongue);
  for(const s of [-1,1]){ const fang=new THREE.Mesh(new THREE.ConeGeometry(0.9,4,4),scMat(SC_BONE)); fang.rotation.x=Math.PI; fang.position.set(s*2,30,17); g.add(fang); }
  scEyes(g,ec,35,15,2.6,1.4); return g; }

function scBrute(c,ec){ const g=new THREE.Group(); const m=scMat(c),dk=scMat(scShade(c,0.6)),crack=scGlowMat(scShade(ec,1.0));
  for(const s of [-1,1]){ const leg=new THREE.Mesh(new THREE.BoxGeometry(9,16,10),m); leg.position.set(s*6,8,0); g.add(leg);
    const foot=new THREE.Mesh(new THREE.BoxGeometry(11,5,14),dk); foot.position.set(s*6,2,2); g.add(foot); }
  const torso=new THREE.Mesh(new THREE.IcosahedronGeometry(15,1),m); torso.scale.set(1.4,1.2,1); torso.position.y=30; g.add(torso);
  const cr=new THREE.Mesh(new THREE.BoxGeometry(2,14,2),crack); cr.position.set(0,30,10); g.add(cr);
  const cr2=new THREE.Mesh(new THREE.BoxGeometry(9,2,2),crack); cr2.position.set(-2,34,10); g.add(cr2);
  const head=new THREE.Mesh(new THREE.IcosahedronGeometry(6.5,0),m); head.position.set(0,45,3); g.add(head);
  for(const s of [-1,1]){ const arm=new THREE.Mesh(new THREE.BoxGeometry(7,20,8),m); arm.position.set(s*17,30,0); arm.rotation.z=s*0.12; g.add(arm);
    const fist=new THREE.Mesh(new THREE.IcosahedronGeometry(6,0),dk); fist.position.set(s*18,18,1); g.add(fist); }
  for(const s of [-1,1]) for(const dz of [-1,1]){ const spike=new THREE.Mesh(new THREE.ConeGeometry(3,9,4),dk); spike.position.set(s*11,42,dz*4); spike.rotation.z=s*0.4; g.add(spike); }
  scEyes(g,ec,46,7,2.6,1.5); return g; }

function scWraith(c,ec){ const g=new THREE.Group();
  const m=new THREE.MeshStandardMaterial({ color:c, roughness:0.7, metalness:0.1, flatShading:true, transparent:true, opacity:0.94 });
  const dk=new THREE.MeshStandardMaterial({ color:scShade(c,0.55), roughness:0.7, flatShading:true, transparent:true, opacity:0.9 });
  for(let i=0;i<3;i++){ const layer=new THREE.Mesh(new THREE.ConeGeometry(11-i*1.5,20,7), i%2?m:dk); layer.position.y=8+i*8; g.add(layer); }
  for(let i=0;i<7;i++){ const a=(i/7)*Math.PI*2; const tip=new THREE.Mesh(new THREE.ConeGeometry(2.4,9,4),dk); tip.rotation.x=Math.PI; tip.position.set(Math.cos(a)*8,2,Math.sin(a)*8); g.add(tip); }
  const hood=new THREE.Mesh(new THREE.ConeGeometry(7.5,13,7),m); hood.position.set(0,33,0); g.add(hood);
  const face=new THREE.Mesh(new THREE.SphereGeometry(4.5,7,7),new THREE.MeshStandardMaterial({ color:0x040208, roughness:1, flatShading:true })); face.position.set(0,30,3); g.add(face);
  for(const s of [-1,1]){ const arm=new THREE.Mesh(new THREE.ConeGeometry(2.6,15,5),m); arm.position.set(s*9,20,3); arm.rotation.z=s*0.55; g.add(arm);
    for(let f=0;f<3;f++){ const claw=new THREE.Mesh(new THREE.ConeGeometry(0.6,5,4),dk); claw.position.set(s*13,13,3+(f-1)*1.6); claw.rotation.z=s*0.7; g.add(claw); } }
  scEyes(g,ec,31,5.5,2,1.4); return g; }
const MOB_ARCH_BUILDERS = { rodent: scRodent, flyer: scFlyer, crawler: scCrawler, canine: scCanine, serpent: scSerpent, brute: scBrute, wraith: scWraith };
function mobArchetype(t) {
  if (/rat_king/.test(t)) return 'rodent';
  if (/weaver/.test(t)) return 'crawler';
  if (/forge_tyrant/.test(t)) return 'brute';
  if (/sovereign/.test(t)) return 'wraith';
  if (/bat/.test(t)) return 'flyer';
  if (/spider|beetle|crawler/.test(t)) return 'crawler';
  if (/wolf|hound|warden|beast/.test(t)) return 'canine';
  if (/adder|serpent|dragon/.test(t)) return 'serpent';
  if (/golem|giant|troll|titan|brute|leviathan|lurker/.test(t)) return 'brute';
  if (/rat/.test(t)) return 'rodent';
  return 'wraith';
}
function makeDungeonMob(mobType) {
  const visual = DUNGEON_MOB_VISUALS[mobType] || { color: 0x2a1a33, eyeColor: 0xff2222, scale: 1.0 };
  const builder = MOB_ARCH_BUILDERS[mobArchetype(mobType)] || MOB_ARCH_BUILDERS.wraith;
  const g = builder(visual.color, visual.eyeColor);
  g.add(makeHealthBarSprite(38));
  g.scale.setScalar(visual.scale);
  // Signature bosses (Session L) wear their name and a low ember glow —
  // unmistakable across the arena.
  if (visual.boss && DUNGEON_BOSS_NAMES[mobType]) {
    const label = makeNpcNameSprite('⚔️ ' + DUNGEON_BOSS_NAMES[mobType]);
    label.position.set(0, 46 / visual.scale, 0);
    label.scale.multiplyScalar(1.5 / visual.scale);
    g.add(label);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: LEGEND_FX.glowTexture(), color: visual.eyeColor, transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    glow.scale.set(60 / visual.scale, 60 / visual.scale, 1);
    glow.position.set(0, 10, 0);
    g.add(glow);
  }
  return g;
}

function getOrCreateDungeonMobVisual(id, mobType) {
  let v = getDungeonMobVisuals()[id];
  if (!v) {
    const mesh = makeDungeonMob(mobType);
    mesh.visible = false;
    mesh.userData = { kind: 'dungeon', targetId: id };
    mesh.traverse(c => { if (c !== mesh) c.userData = mesh.userData; });
    if (getDungeonScene()) getDungeonScene().add(mesh);
    v = getDungeonMobVisuals()[id] = { mesh, x: 0, y: 0, targetX: 0, targetY: 0, facing: 0, targetFacing: 0, initialized: false, dead: false, attackAnimStartAt: null };
  }
  return v;
}

function applyDungeonMobState(list) {
  if (!getDungeonScene()) return;
  for (const m of list) {
    const v = getOrCreateDungeonMobVisual(m.id, m.mobType);
    v.targetX = m.x; v.targetY = m.y; v.targetFacing = m.facing; v.dead = !!m.dead;
    v.hasLoot = !!m.hasLoot;
    v.room = m.room;
    if (!v.initialized) { v.x = m.x; v.y = m.y; v.facing = m.facing; v.initialized = true; }
    if (m.health !== undefined) {
      const hpBar = v.mesh.getObjectByName('healthBar');
      if (hpBar) updateHealthBar(hpBar, m.health, m.maxHealth);
    }
  }
}

function updateDungeonMobVisuals(dt) {
  const inDungeon = getDungeonScene() && getActiveScene() === getDungeonScene();
  const f = 1 - Math.exp(-dt * 8);
  for (const id in getDungeonMobVisuals()) {
    const v = getDungeonMobVisuals()[id];
    v.x += (v.targetX - v.x) * f;
    v.y += (v.targetY - v.y) * f;
    v.facing = lerpAngle(v.facing, v.targetFacing, f);
    const lungeFactor = mobAttackLungeAmount(v);
    const lungeDist = lungeFactor * MOB_ATTACK_LUNGE_DIST;
    v.mesh.position.set(v.x + Math.sin(v.facing) * lungeDist, 0, v.y + Math.cos(v.facing) * lungeDist);
    v.mesh.rotation.y = v.facing;
    v.mesh.rotation.x = -0.5 * lungeFactor;
    const shouldShow = inDungeon && !v.dead && getMe() && v.room === getMe().room;
    v.mesh.visible = shouldShow;
  }
}

  return { applyDungeonMobState, updateDungeonMobVisuals };
}
