// The self-check: a short health report made in the player's own browser, for
// the browsers the automated tours cannot reach (Safari above all). It looks at
// the scene she is standing in, the text on screen and the browser itself, and
// writes a few plain lines into the bug report box, ready to send or to copy.

const SELF_BAD_TEXT = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|\bundefined\b|\bNaN\b|\[object /g;

// Words on screen that look like the game's inner names, with a little of what is round them.
function strangeWords(text, max) {
  const hits = new Set(), t = String(text || '');
  for (const m of t.matchAll(SELF_BAD_TEXT)) {
    if (hits.size >= (max || 4)) break;
    hits.add(t.slice(Math.max(0, m.index - 12), m.index + m[0].length + 8).replace(/\s+/g, ' ').trim());
  }
  return [...hits];
}

function browserName(ua) {
  const u = String(ua || '');
  const v = (re) => { const m = re.exec(u); return m ? m[1] : '?'; };
  if (/Edg\//.test(u)) return 'Edge ' + v(/Edg\/([\d.]+)/);
  if (/Firefox\//.test(u)) return 'Firefox ' + v(/Firefox\/([\d.]+)/);
  if (/Chrome\//.test(u) && !/Chromium/.test(u)) return 'Chrome ' + v(/Chrome\/([\d.]+)/);
  if (/Safari\//.test(u) && /Version\//.test(u)) return 'Safari ' + v(/Version\/([\d.]+)/);
  return u.slice(0, 40) || 'unknown';
}

// facts: gathered by the caller (the game knows its own scene); this only words them.
function selfCheckReport(f) {
  const lines = [];
  lines.push(`SELF-CHECK ${f.build || ''}`.trim());
  lines.push(`${browserName(f.ua)} · ${f.platform || '?'} · ${f.w}x${f.h} @${f.dpr}`);
  lines.push(`gfx ${f.gfx || '?'} · ${f.fps != null ? f.fps + ' fps' : 'fps ?'} · ${f.gpu || 'gpu ?'}`);
  lines.push(`place ${f.room || '?'} at ${f.x},${f.y}${f.night ? ' · night' : ''}`);
  if (f.floaters) {
    lines.push(`floating ${f.floaters.floating} of ${f.floaters.checked}` + (f.floaters.list.length ? ': ' + f.floaters.list.slice(0, 5).map((o) => `${o.name}@${o.x},${o.z}+${o.gap}`).join('; ') : ''));
  } else lines.push('floating ?');
  const odd = f.strange || [];
  lines.push(`odd text ${odd.length}` + (odd.length ? ': ' + odd.join(' | ') : ''));
  lines.push(`errors ${f.errors ? f.errors.length : 0}` + (f.errors && f.errors.length ? ': ' + f.errors.slice(0, 3).map((e) => String(e).slice(0, 90)).join(' | ') : ''));
  lines.push(`sound ${f.audio || '?'} · socket ${f.socket || '?'} · pad ${f.pad ? 'yes' : 'no'} · keys ${f.keys || 'default'} · text ${f.textSize || 'normal'}`);
  let out = lines.join('\n');
  if (out.length > 980) out = out.slice(0, 977) + '…';
  return out;
}

export { strangeWords, browserName, selfCheckReport };
