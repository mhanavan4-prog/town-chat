'use strict';
// Rendered Open Graph share cards. Composites a small per-entity text overlay
// (the player's or coven's real name + stats) onto the matching pre-rendered
// base card (a class card for players, a sigil card for covens) using sharp.
//
// Guarded by design: if sharp cannot be loaded this module reports
// available=false and the caller falls back to the plain static base card, so
// the site keeps working on any host where the native dep is missing.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let sharp = null;
try { sharp = require('sharp'); } catch (e) { sharp = null; }

function esc(s) {
  return String(s == null ? '' : s).replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
  ));
}
function fit(s, max) { s = String(s == null ? '' : s); return s.length > max ? s.slice(0, max - 1) + '…' : s; }
function sig(s) { return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 10); }

module.exports = function ogRenderFactory({ dataDir, publicDir }) {
  const available = !!sharp;
  const cacheDir = path.join(dataDir, 'og-cache');
  if (available) { try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) {} }

  // Keep only the newest variant per entity so a level-up / new honor quietly
  // supersedes the old card instead of piling up files forever.
  function pruneOld(prefix, keep) {
    try {
      for (const f of fs.readdirSync(cacheDir)) {
        if (f.startsWith(prefix) && f !== keep) { try { fs.unlinkSync(path.join(cacheDir, f)); } catch (e) {} }
      }
    } catch (e) {}
  }

  async function compose(base, svg, out) {
    await sharp(base)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toFile(out);
  }

  // A player's card: dark panel lower-left with name + "Level N · the Class".
  function playerSvg(W, H, name, meta) {
    const pY = H - 148, pH = 112, pW = Math.min(660, W - 96);
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="48" y="${pY}" width="${pW}" height="${pH}" rx="18" fill="#08050f" fill-opacity="0.82" stroke="#b98aff" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="74" y="${pY + 50}" font-family="DejaVu Sans, sans-serif" font-size="42" font-weight="bold" fill="#f3ecff">${esc(fit(name, 22))}</text>
  <text x="75" y="${pY + 90}" font-family="DejaVu Sans, sans-serif" font-size="24" fill="#b5a7d4">${esc(fit(meta, 50))}</text>
</svg>`;
  }

  // A coven's card: dark banner across the bottom with name + member/rank line,
  // sized to cover the base card's generic "THORNREACH / A COVEN" title.
  function covenSvg(W, H, name, meta) {
    const cx = W / 2, bH = 168, bY = H - bH;
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="120" y="${bY}" width="${W - 240}" height="${bH}" rx="20" fill="#0c0820" stroke="#b98aff" stroke-opacity="0.5" stroke-width="1.5"/>
  <text x="${cx}" y="${bY + 78}" text-anchor="middle" font-family="DejaVu Serif, serif" font-size="50" font-weight="bold" fill="#f1e9ff">${esc(fit(name, 24))}</text>
  <text x="${cx}" y="${bY + 124}" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="25" fill="#b5a7d4">${esc(fit(meta, 52))}</text>
</svg>`;
  }

  // Returns the absolute path to a cached rendered card, rendering it on first
  // request. `variant` is any string that changes when the overlay should change
  // (level, honor, membership) — it keys the cache so stale cards regenerate.
  async function card(kind, baseFile, idPart, name, meta, variant) {
    if (!available) return null;
    const base = path.join(publicDir, 'og', baseFile);
    if (!fs.existsSync(base)) return null;
    const prefix = `${kind}-${idPart}-`;
    const out = path.join(cacheDir, `${prefix}${sig(variant)}.png`);
    if (!fs.existsSync(out)) {
      try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) {}
      const m = await sharp(base).metadata();
      const svg = kind === 'player' ? playerSvg(m.width, m.height, name, meta) : covenSvg(m.width, m.height, name, meta);
      await compose(base, svg, out);
      pruneOld(prefix, path.basename(out));
    }
    return out;
  }

  return {
    available,
    playerCard: (charId, name, meta, variant) => card('player', `class-${charId}.png`, String(charId), name, meta, variant),
    covenCard: (sigilIndex, idPart, name, meta, variant) => card('coven', `coven-${sigilIndex}.png`, String(idPart), name, meta, variant)
  };
};
