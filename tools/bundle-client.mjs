#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Thornreach client bundler (Tier 3.4 Phase C) — zero dependencies.
//
// Concatenates the client/ ES-module graph into ONE IIFE at public/client.js.
// This works (and is safe) precisely because every client/ module was carved
// out of one original closure: their top-level names are already globally
// unique, so a single shared scope via concatenation reproduces the exact
// pre-split runtime. We just strip the import/export *syntax* and emit modules
// dependency-first.
//
// Deliberately no tree-shaking / minification: the whole client ships as one
// closure anyway, and readable output helps the smoke test + error telemetry.
// If you ever want those, `build:client` is the only thing to swap (e.g. to
// esbuild) — nothing else in the pipeline cares how public/client.js is made.
//
// Supported module syntax (keep to these forms):
//   import X from './m.js';            import { a, b } from './m.js';
//   import './m.js';                   (side-effect only)
//   export default function X …        export function/const/let/var …
//   export { a, b };
// Anything else throws — a loud failure beats a silently mis-bundled client.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(url.fileURLToPath(import.meta.url), '..', '..');
const ENTRY = path.join(ROOT, 'client', 'main.js');
const OUT = path.join(ROOT, 'public', 'client.js');

const included = new Set();
const chunks = [];

function resolveDep(fromDir, spec) {
  let p = path.resolve(fromDir, spec);
  if (!fs.existsSync(p) && fs.existsSync(p + '.js')) p += '.js';
  if (!fs.existsSync(p)) throw new Error(`Cannot resolve import '${spec}' from ${fromDir}`);
  return p;
}

function process(file) {
  const abs = path.resolve(file);
  if (included.has(abs)) return;
  included.add(abs);

  const dir = path.dirname(abs);
  const deps = [];
  const body = [];

  for (const line of fs.readFileSync(abs, 'utf8').split('\n')) {
    // --- imports: record the dependency, drop the line ---
    const named = line.match(/^\s*import\b.*\bfrom\s*['"](.+?)['"]\s*;?\s*$/);
    const side = line.match(/^\s*import\s*['"](.+?)['"]\s*;?\s*$/);
    if (named) { deps.push(resolveDep(dir, named[1])); continue; }
    if (side) { deps.push(resolveDep(dir, side[1])); continue; }
    if (/^\s*import\b/.test(line)) throw new Error(`${path.relative(ROOT, abs)}: unsupported import form:\n  ${line}`);

    // --- exports: strip the keyword, keep the declaration ---
    if (/^\s*export\s*\{/.test(line)) continue;                       // export { a, b } — already in scope
    let l = line
      .replace(/^(\s*)export\s+default\s+(function|class)\b/, '$1$2')  // export default function X -> function X
      .replace(/^(\s*)export\s+(function|class|const|let|var)\b/, '$1$2');
    if (/^\s*export\s+default\b/.test(l)) throw new Error(`${path.relative(ROOT, abs)}: anonymous 'export default' unsupported:\n  ${line}`);
    if (/^\s*export\b/.test(l)) throw new Error(`${path.relative(ROOT, abs)}: unsupported export form:\n  ${line}`);
    body.push(l);
  }

  for (const d of deps) process(d);            // dependencies first (topological)
  chunks.push(`// ===== ${path.relative(ROOT, abs)} =====\n` + body.join('\n'));
}

process(ENTRY);
const bundle = '(() => {\n"use strict";\n' + chunks.join('\n') + '\n})();\n';
fs.writeFileSync(OUT, bundle);
console.log(`build:client — bundled ${included.size} module(s) -> ${path.relative(ROOT, OUT)} (${bundle.split('\n').length} lines)`);
