// ---------------------------------------------------------------------------
// Procedural canvas textures (Tier 3.4 Phase C, shared prop library). Pure
// makers: each paints a <canvas> and returns a THREE.CanvasTexture — grass,
// the cached lamp glow, dirt/stone/white-stone ground, wood siding + roof
// shingles, and the altar pentacle + floor sigil. No deps (THREE is a global);
// makeGlowTexture memoizes via an internal _glowTexCache.
// ---------------------------------------------------------------------------
export function makeGrassTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  cx.fillStyle = '#3c6b40';
  cx.fillRect(0, 0, 256, 256);
  // mottled patches of lighter/darker green underneath the blades
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 10 + Math.random() * 26;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(70,120,68,0.25)' : 'rgba(40,80,42,0.25)';
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  }
  // individual blade strokes for texture
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const len = 3 + Math.random() * 6;
    const ang = Math.random() * Math.PI * 2;
    const shade = 90 + Math.random() * 70;
    cx.strokeStyle = `rgba(${shade - 40}, ${shade + 30}, ${shade - 40}, 0.55)`;
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(x, y);
    cx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    cx.stroke();
  }
  // sparse dry/yellow blades for variation
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    cx.fillStyle = 'rgba(180,170,90,0.3)';
    cx.fillRect(x, y, 2, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let _glowTexCache = null;
export function makeGlowTexture() {
  if (_glowTexCache) return _glowTexCache;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,220,150,0.5)');
  grad.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  _glowTexCache = new THREE.CanvasTexture(c);
  return _glowTexCache;
}

export function makeDirtTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#8a6b46';
  cx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 320; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    const r = 1 + Math.random() * 3;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(58,40,22,0.30)' : 'rgba(178,150,108,0.30)';
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  }
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    cx.fillStyle = 'rgba(40,28,16,0.4)';
    cx.fillRect(x, y, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Withered Moor — the town's spooky ground: cold dead moss, bare rotted-earth
// patches and half-dead straw instead of bright grass. Same procedural approach
// as makeGrassTexture, witch-hour palette. (The Wilds keeps makeGrassTexture.)
export function makeMoorTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  cx.fillStyle = '#2c3a2f';
  cx.fillRect(0, 0, 256, 256);
  // bare, rotted-earth patches
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 12 + Math.random() * 34;
    cx.fillStyle = 'rgba(28,34,26,0.5)';
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  }
  // mottled cold moss underneath
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const r = 10 + Math.random() * 26;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(59,77,60,0.22)' : 'rgba(22,32,24,0.3)';
    cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
  }
  // wispy, half-dead grass blades
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    const len = 3 + Math.random() * 6;
    const ang = Math.random() * Math.PI * 2;
    const shade = 55 + Math.random() * 45;
    cx.strokeStyle = `rgba(${shade - 18}, ${shade + 12}, ${shade - 22}, 0.5)`;
    cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(x, y);
    cx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); cx.stroke();
  }
  // withered straw flecks
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    cx.fillStyle = 'rgba(107,98,68,0.3)';
    cx.fillRect(x, y, 2, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Cracked Flagstone — the town's eerie paths + plaza: weathered slate flagstones
// with dark mortar cracks and moss creeping in, replacing the tan dirt.
export function makeFlagstoneTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const cx = c.getContext('2d');
  cx.fillStyle = '#191b1f'; // dark mortar shows through the cracks
  cx.fillRect(0, 0, 256, 256);
  const cols = 5, rows = 5, cw = 256 / cols, ch = 256 / rows, inset = 4;
  const fills = ['#464a54', '#5a5e69', '#2f323a', '#4c505b'];
  for (let ry = 0; ry < rows; ry++) {
    for (let cxi = 0; cxi < cols; cxi++) {
      const j = () => (Math.random() - 0.5) * 8;
      const x0 = cxi * cw, y0 = ry * ch;
      cx.fillStyle = fills[(Math.random() * fills.length) | 0];
      cx.beginPath();
      cx.moveTo(x0 + inset + j(), y0 + inset + j());
      cx.lineTo(x0 + cw - inset + j(), y0 + inset + j());
      cx.lineTo(x0 + cw - inset + j(), y0 + ch - inset + j());
      cx.lineTo(x0 + inset + j(), y0 + ch - inset + j());
      cx.closePath(); cx.fill();
    }
  }
  // moss creeping into the cracks
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    cx.fillStyle = 'rgba(63,90,58,0.4)';
    cx.beginPath(); cx.arc(x, y, 2 + Math.random() * 5, 0, Math.PI * 2); cx.fill();
  }
  // fine grain + hairline flecks on the stone
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * 256, y = Math.random() * 256;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(20,22,26,0.35)' : 'rgba(120,124,134,0.22)';
    cx.fillRect(x, y, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function makeStoneTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#6b6862';
  cx.fillRect(0, 0, 128, 128);
  cx.strokeStyle = 'rgba(35,32,28,0.5)';
  cx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = i * 22 + (i % 2 ? 6 : 0);
    cx.beginPath(); cx.moveTo(0, y); cx.lineTo(128, y); cx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(95,92,86,0.4)' : 'rgba(35,32,28,0.4)';
    cx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Same block-and-mortar pattern as makeStoneTexture(), just with a light
// base fill instead of dark gray — bakes its own colors in rather than
// being a white-multiply texture, so a plain mesh.color tint alone can't
// turn the gray version white; this is the actual light-stone variant.
export function makeWhiteStoneTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ece7d8';
  cx.fillRect(0, 0, 128, 128);
  cx.strokeStyle = 'rgba(170,162,140,0.45)';
  cx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = i * 22 + (i % 2 ? 6 : 0);
    cx.beginPath(); cx.moveTo(0, y); cx.lineTo(128, y); cx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.4)' : 'rgba(190,182,160,0.35)';
    cx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// White-based so it multiplies cleanly with a MeshLambertMaterial's own
// tint color (b.color) — same trick the interior floor texture uses with
// floorTint. Horizontal plank seams plus scattered grain streaks.
export function makeWoodSidingTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, 128, 128);
  cx.strokeStyle = 'rgba(0,0,0,0.32)';
  cx.lineWidth = 2;
  const plankH = 16;
  for (let y = plankH; y < 128; y += plankH) {
    cx.beginPath(); cx.moveTo(0, y); cx.lineTo(128, y); cx.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 128, y = Math.random() * 128;
    cx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
    cx.fillRect(x, y, 1, 3 + Math.random() * 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Same white-based multiply trick as the siding texture above — rows of
// overlapping shingle arcs, offset every other row.
export function makeShingleTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const cx = c.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, 128, 128);
  const rowH = 14, tileW = 20;
  let row = 0;
  for (let y = 0; y < 128; y += rowH, row++) {
    const offset = (row % 2) * (tileW / 2);
    cx.strokeStyle = 'rgba(0,0,0,0.3)';
    cx.lineWidth = 1.5;
    for (let x = -tileW + offset; x < 128; x += tileW) {
      cx.beginPath();
      cx.moveTo(x, y + rowH);
      cx.lineTo(x + tileW / 2, y + 2);
      cx.lineTo(x + tileW, y + rowH);
      cx.stroke();
    }
    cx.strokeStyle = 'rgba(0,0,0,0.2)';
    cx.beginPath(); cx.moveTo(0, y + rowH); cx.lineTo(128, y + rowH); cx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// A bronze medallion etched with a circle + five-pointed star — solid
// background (unlike the floor sigil below), since this is a physical
// object resting on the altar, not a marking carved into existing stone.
export function makePentacleTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  grad.addColorStop(0, '#7a6238');
  grad.addColorStop(1, '#3a2c18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const cxp = 128, cyp = 128, r = 104;
  ctx.strokeStyle = '#241a10';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(cxp, cyp, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cxp, cyp, r - 16, 0, Math.PI * 2); ctx.stroke();

  const points = [];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    points.push([cxp + Math.cos(angle) * (r - 16), cyp + Math.sin(angle) * (r - 16)]);
  }
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#18110a';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i <= 5; i++) ctx.lineTo(points[(i * 2) % 5][0], points[(i * 2) % 5][1]);
  ctx.closePath();
  ctx.stroke();

  return new THREE.CanvasTexture(c);
}

// A ring of carved sigils meant to read as etched into the platform's own
// stone — fully transparent background (only the lines have any alpha) so
// the white stone texture underneath shows through everywhere else,
// instead of looking like a separate decal sitting on top of the floor.
export function makeSigilFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 300; c.height = 300;
  const ctx = c.getContext('2d');
  const cxp = 150, cyp = 150;

  ctx.strokeStyle = 'rgba(70,60,48,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cxp, cyp, 128, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cxp, cyp, 100, 0, Math.PI * 2); ctx.stroke();

  // Two overlapping triangles (a hexagram) for the classic "ritual circle" look.
  function triangle(rot) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = rot + i * (Math.PI * 2 / 3);
      const x = cxp + Math.cos(angle) * 92, y = cyp + Math.sin(angle) * 92;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }
  ctx.lineWidth = 2.5;
  triangle(-Math.PI / 2);
  triangle(Math.PI / 2);

  // Small rune ticks spaced around the outer ring.
  for (let i = 0; i < 10; i++) {
    const angle = i * (Math.PI * 2 / 10);
    const x1 = cxp + Math.cos(angle) * 132, y1 = cyp + Math.sin(angle) * 132;
    const x2 = cxp + Math.cos(angle) * 146, y2 = cyp + Math.sin(angle) * 146;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  return new THREE.CanvasTexture(c);
}
