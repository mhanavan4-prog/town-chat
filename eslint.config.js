const globals = require('globals');

// Bug-catching rules. Errors have ~zero false positives on real code; the rest
// are a non-blocking warning backlog to burn down over time.
const bugRules = {
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-unreachable': 'error',
  'no-cond-assign': ['error', 'always'],
  'no-constant-condition': ['warn', { checkLoops: false }], // legacy toggles like `x || true` — surface, don't block
  'no-self-assign': 'error',
  'no-unsafe-negation': 'error',
  'valid-typeof': 'error',
  // Unused vars are informational. Ignore catch params + function args (common,
  // harmless) and _-prefixed intentionals; the rest are a backlog, not a gate.
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
};

module.exports = [
  {
    ignores: [
      'node_modules/**', '_to_delete/**',
      'public/three.min.js', 'public/face-api.min.js',
      'public/GLTFLoader.js', 'public/SkeletonUtils.js', 'public/fx.js',
      'test/three-stub.js',
    ],
  },
  // Server — pure Node. A browser global here WOULD be a real bug, so node-only.
  {
    files: ['server.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
  // Test + QA scripts. They drive a headless browser via Playwright, so their
  // page-context callbacks legitimately use browser globals (document/window/
  // localStorage/Touch/...). Give them BOTH node and browser.
  {
    files: ['test/**/*.js', 'test/**/*.cjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
  // ESM smoke/harness scripts — same browser-via-Playwright situation. `ws` and
  // `me` are app globals defined by client.js in the page context; the smoke
  // test reads them inside page.evaluate() diagnostics (guarded by typeof), so
  // declare them here rather than let no-undef flag legitimate page globals.
  {
    files: ['test/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node, ...globals.browser, ws: 'readonly', me: 'readonly' } },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
  // Extracted data modules (Tier 3.4 Phase A) - pure CommonJS data; the bug
  // rules here catch e.g. a duplicate item id (no-dupe-keys).
  {
    files: ['data/**/*.js', 'lib/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
  // Browser client — one big global <script>; leans on bundled-script globals
  // (THREE, fx.js -> FX/LEGEND_FX, face-api -> faceapi). Whitelist is complete
  // (0 no-undef warnings), so no-undef is now 'error' — an undefined global here
  // is a real load-crash bug, and the smoke test backs it up at runtime.
  {
    files: ['public/client.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser, THREE: 'readonly', faceapi: 'readonly', FX: 'readonly', LEGEND_FX: 'readonly' },
    },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
];
