// Boot-check for the bundled client (Tier 3.4 Phase C).
//
// Runs public/client.js in a Node `vm` with stubbed browser globals, EXECUTING
// all of its evaluation-time code (top-level statements + IIFEs like
// wireActionCluster). It catches boot crashes without a browser — in
// particular the TDZ class ("Cannot access 'X' before initialization") that
// appears when an extracted module's export (now a `const`, no longer a hoisted
// function) is referenced during initial evaluation, before its construction
// line. The Playwright smoke test also catches these, but this runs in ~50ms
// with no Chromium, so it fails fast in the sandbox and early in CI.
//
// How it stays low-maintenance: the sandbox proxy answers `has()` true for every
// name, so an unstubbed browser API resolves to a harmless self-returning stub
// instead of throwing "X is not defined". The bundle's OWN top-level bindings are
// lexically scoped inside the IIFE, so they never hit the proxy — a TDZ on one of
// them still throws, which is exactly what we want to detect.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import url from 'node:url';

const here = path.dirname(url.fileURLToPath(import.meta.url));
const file = process.argv[2] || path.resolve(here, '..', 'public', 'client.js');
const code = fs.readFileSync(file, 'utf8');

// Self-returning proxy: any property/call/construct/iteration yields itself.
const S = (() => {
  const f = function () {};
  const P = new Proxy(f, {
    get(t, p) {
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === Symbol.iterator) return function* () {};
      if (p === Symbol.asyncIterator) return async function* () {};
      if (p === 'length') return 0;
      return P;
    },
    set() { return true; },
    apply() { return P; },
    construct() { return P; },
    has() { return true; },
  });
  return P;
})();

const noop = () => {};
const timer = () => 0;
const stub = {
  document: S,
  navigator: { userAgent: 'node', serviceWorker: S, geolocation: S, maxTouchPoints: 0, mediaDevices: S, language: 'en' },
  location: { protocol: 'http:', search: '', hash: '', pathname: '/', hostname: 'localhost', host: 'localhost', href: 'http://localhost/', origin: 'http://localhost', replace: noop, reload: noop, assign: noop },
  history: { replaceState: noop, pushState: noop, back: noop },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop, clear: noop },
  sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop, clear: noop },
  performance: { now: () => 0 },
  setTimeout: timer, clearTimeout: noop, setInterval: timer, clearInterval: noop,
  requestAnimationFrame: timer, cancelAnimationFrame: noop, queueMicrotask: noop,
  WebSocket: Object.assign(function () { return S; }, { OPEN: 1, CONNECTING: 0, CLOSING: 2, CLOSED: 3 }),
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
  AudioContext: function () { return S; },
  webkitAudioContext: function () { return S; },
  Notification: Object.assign(function () {}, { requestPermission: () => Promise.resolve('denied'), permission: 'default' }),
  THREE: S, faceapi: S, FX: S, LEGEND_FX: S,
  atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
  btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
  alert: noop, prompt: () => null, confirm: () => false,
  getComputedStyle: () => S,
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop, removeListener: noop }),
  addEventListener: noop, removeEventListener: noop, scrollTo: noop,
  screen: { width: 1024, height: 768 },
  innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1,
};
// Pass real JS builtins through (referenced by name-string to keep lint happy).
for (const k of ['console', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'Math', 'JSON',
  'Date', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect', 'Function',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'Uint8Array', 'Int8Array',
  'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array', 'Float32Array', 'Float64Array', 'ArrayBuffer',
  'DataView', 'BigInt', 'structuredClone', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder',
  'Intl', 'WebAssembly', 'Blob', 'FileReader']) {
  if (k in globalThis) stub[k] = globalThis[k];
}
stub.window = stub; stub.self = stub; stub.globalThis = stub; stub.top = stub; stub.parent = stub;

const sandbox = new Proxy(stub, {
  has() { return true; },                        // every name is "in scope" -> unstubbed globals don't throw
  get(t, p) { return p in t ? t[p] : S; },       // known -> real; unknown browser API -> harmless stub
  set(t, p, v) { t[p] = v; return true; },
});

try {
  vm.runInContext(code, vm.createContext(sandbox), { filename: 'client.js', timeout: 15000 });
  console.log('boot-check OK — bundle evaluated (top-level + all IIFEs) with no boot crash');
} catch (e) {
  console.error('boot-check FAILED:', (e && e.name) || 'Error', '-', String((e && e.message) || '').split('\n')[0]);
  console.error('  (a "Cannot access X before initialization" here is a TDZ: an eval-time reference to a module export before its construction line)');
  process.exit(1);
}
