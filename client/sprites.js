// ---------------------------------------------------------------------------
// Sprite makers (Tier 3.4 Phase C, shared prop library). Canvas->THREE.Sprite
// billboards: creature health bars (+updateHealthBar), the loot-bag icon, world
// signs, and NPC nameplates. Pure (THREE is a global). HOVER_NAME_SPRITES lives
// here — makeNpcNameSprite appends to it and it's re-exported for main's
// updateNameLabelHover()/debug snapshot.
// ---------------------------------------------------------------------------
export const HOVER_NAME_SPRITES = []; // every sprite made by makeNpcNameSprite()

// Floating billboard health bar for creatures. Hidden at full health; becomes
// visible as soon as damage is taken and color-shifts green→orange→red.
export function makeHealthBarSprite(yOffset) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = '#22cc55'; ctx.fillRect(1, 1, 62, 6);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.name = 'healthBar';
  sp.scale.set(24, 3, 1);
  sp.position.y = yOffset;
  sp.renderOrder = 100;
  sp.visible = false; // hidden until first damage
  sp._hpC = c; sp._hpCtx = ctx; sp._hpTex = tex;
  return sp;
}

export function updateHealthBar(sprite, hp, maxHp) {
  const pct = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
  sprite.visible = pct < 0.999;
  if (!sprite.visible) return;
  const ctx = sprite._hpCtx;
  ctx.clearRect(0, 0, 64, 8);
  ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = pct > 0.5 ? '#22cc55' : pct > 0.25 ? '#ffaa00' : '#dd2222';
  ctx.fillRect(1, 1, Math.max(0, Math.floor(62 * pct)), 6);
  sprite._hpTex.needsUpdate = true;
}

export function makeLootIconSprite() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const cx = c.getContext('2d');
  cx.font = '44px serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('💰', 32, 36);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(28, 28, 1);
  sprite.visible = false;
  return sprite;
}

export function makeSignSprite(text) {
  const font = 'bold 30px sans-serif';
  // The canvas used to be a fixed 256px wide regardless of text length, so
  // anything longer than a short label (e.g. "⛩️ Temple of the Flame",
  // "🕯️ Witch's Cave — Press F to enter") got clipped at the edge instead
  // of shrinking or wrapping. Measure first and widen the canvas to fit.
  const measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  const textWidth = measureCtx.measureText(text).width;
  const paddingX = 24;
  const width = Math.max(256, Math.ceil(textWidth) + paddingX * 2);
  const height = 64;

  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const cx = c.getContext('2d');
  cx.font = font;
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillStyle = 'rgba(10,16,12,0.55)';
  cx.fillRect(0, 0, c.width, c.height);
  cx.fillStyle = '#eafff0';
  cx.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  // Same world-units-per-canvas-pixel ratio the old fixed 256x64 -> 110x28
  // used, so every existing short sign renders at exactly the size it
  // always has — only text long enough to need a wider canvas gets wider.
  const scale = 110 / 256;
  sprite.scale.set(width * scale, height * scale, 1);
  return sprite;
}

// Stylised two-line (or one-line) nameplate for NPC characters.
// name  — displayed large in warm gold on the top line
// title — optional smaller italic line below a thin rule
export function makeNpcNameSprite(name, title) {
  const hasTtl = !!title;
  const H = hasTtl ? 80 : 52;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  // Canvas width: two-line NPC plates keep their fixed 360; single-line plates
  // (including the signature boss banners, e.g. "Old Gnawbone, the Rat King")
  // measure the text and grow the canvas to fit long names instead of clipping
  // them at a fixed 240px. Short single-line names still resolve to 240.
  let W;
  if (hasTtl) {
    W = 360;
  } else {
    ctx.font = 'bold 22px Georgia, "Times New Roman", serif';
    W = Math.max(240, Math.ceil(ctx.measureText(name).width) + 48);
  }
  c.width = W; c.height = H;

  ctx.fillStyle = 'rgba(8, 4, 18, 0.80)';
  ctx.fillRect(0, 0, W, H);

  // Outer border — two-tone: gold outer, purple inner
  ctx.strokeStyle = 'rgba(160, 120, 50, 0.50)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.strokeStyle = 'rgba(110, 60, 190, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (hasTtl) {
    // Name — warm gold, larger
    ctx.font = 'bold 26px Georgia, "Times New Roman", serif';
    ctx.shadowColor = 'rgba(210, 160, 30, 0.55)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#edd08a';
    ctx.fillText(name, W / 2, H * 0.30);

    // Thin rule
    ctx.shadowBlur = 0;
    const ry = Math.round(H / 2) - 1;
    ctx.strokeStyle = 'rgba(170, 130, 55, 0.38)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(26, ry); ctx.lineTo(W - 26, ry); ctx.stroke();

    // Small diamond glyphs at rule ends
    ctx.fillStyle = 'rgba(200, 160, 70, 0.45)';
    ctx.font = '10px sans-serif';
    ctx.fillText('◆', 18, ry + 1);
    ctx.fillText('◆', W - 18, ry + 1);

    // Title — soft lavender, italic
    ctx.font = 'italic 15px Georgia, "Times New Roman", serif';
    ctx.shadowColor = 'rgba(130, 70, 210, 0.45)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#bca0e0';
    ctx.fillText(title, W / 2, H * 0.73);
  } else {
    // Single line — warm cream
    ctx.font = 'bold 22px Georgia, "Times New Roman", serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.70)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#e0d4b2';
    ctx.fillText(name, W / 2, H / 2 + 1);
  }

  ctx.shadowBlur = 0;

  const tex = new THREE.CanvasTexture(c);
  // transparent so material.opacity can fade the whole label out — the mobile
  // "announce, then get out of the way" behavior in updateNameLabelHover().
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(hasTtl ? 158 : 102 * (W / 240), hasTtl ? 35 : 23, 1);
  sprite.visible = false; // hover-only — see updateNameLabelHover()
  HOVER_NAME_SPRITES.push(sprite);
  return sprite;
}
