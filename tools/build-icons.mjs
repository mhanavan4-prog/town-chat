#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Emits public/tr-icons.js — the custom icon set as a browser global, so the
// static marketing pages (landing.html, class.html, …) can render the same
// icons the game uses without importing the ESM module graph.
//
// Single source of truth: it imports client/ui-icons.js and serializes its
// UI_ICONS map plus the 8 moon phases + blood moon. Like public/client.js this
// is a generated, gitignored artifact — CI and the deploy build it.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(url.fileURLToPath(import.meta.url), '..', '..');
const OUT = path.join(ROOT, 'public', 'tr-icons.js');

const icons = await import(url.pathToFileURL(path.join(ROOT, 'client', 'ui-icons.js')).href);

const map = Object.assign({}, icons.UI_ICONS);
// Moon phases (generated, not registry entries) under moonphase_<key>.
for (const k of ['new', 'waxing_crescent', 'first_quarter', 'waxing_gibbous',
  'full', 'waning_gibbous', 'last_quarter', 'waning_crescent']) {
  map['moonphase_' + k] = icons.moonPhaseIcon(k, false);
}
map['moonphase_blood'] = icons.moonPhaseIcon('full', true);

const body = 'window.TR_ICONS=' + JSON.stringify(map) + ';';
fs.writeFileSync(OUT, body);
console.log(`build:icons — wrote ${Object.keys(map).length} icons -> ${path.relative(ROOT, OUT)} (${(body.length / 1024).toFixed(1)} KiB)`);
